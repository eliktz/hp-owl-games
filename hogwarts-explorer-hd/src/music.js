// Device-local background music. The game ships, fetches and names NO track: the family
// picks an audio file on each device ('מוּזִיקָה 🎵' button), it is kept in IndexedDB on that
// device only (one store, one key) and played as a gentle loop. Nothing is uploaded.
//
//   init({ audio, isMatch })  -> api        (audio = createAudio(); its AudioContext is reused)
//   api.choose(file)  store + play (call from the tap that chose it)
//   api.remove()      delete the stored track and stop
//   api.setOn(bool)   music on/off, remembered in localStorage 'hpMusicOn1'
//   api.duck(ms)      lower to ~35% for ms (Web Speech is also detected by polling)
//   api.unlock()      call from the first user gesture (iOS autoplay rules)
//   api.poke()        call from any gesture that may make music audible again (unmute)
//   api.state()       for tests
//
// Volume: ~0.18 castle/grounds, ~0.32 in a Quidditch match, ~1 s smooth ramps. iOS ignores
// HTMLAudioElement.volume, so the element is routed through the game's AudioContext
// (MediaElementSource -> Gain -> destination) once one exists; element.volume elsewhere.
const ON_KEY = 'hpMusicOn1';
const DB_NAME = 'hpMusic1', STORE = 'track', REC = 'current';
const VOL_CASTLE = 0.18, VOL_MATCH = 0.32, DUCK = 0.35, TAU = 0.33;   // TAU: ~95% in 1 s

const T = {
  title: 'מוּזִיקָה 🎵',
  choose: 'בַּחֲרוּ שִׁיר',
  remove: 'הָסֵר',
  none: 'עוֹד לֹא נִבְחַר שִׁיר, אָז אֵין מוּזִיקָה.',
  hint: 'הַשִּׁיר נִשְׁמָר רַק בַּמַּכְשִׁיר הַזֶּה.',
  session: 'הַשִּׁיר יִתְנַגֵּן עַכְשָׁו, אֲבָל לֹא יִזָּכֵר בַּפַּעַם הַבָּאָה.',
  quota: 'הַקּוֹבֶץ גָּדוֹל מִדַּי לִשְׁמִירָה בַּמַּכְשִׁיר. הוּא יִתְנַגֵּן רַק עַכְשָׁו.',
  bad: 'אֶת הַקּוֹבֶץ הַזֶּה אִי אֶפְשָׁר לְנַגֵּן. נַסּוּ שִׁיר אַחֵר.',
  tap: 'גְּעוּ בַּמָּסָךְ כְּדֵי לְהַתְחִיל אֶת הַמּוּזִיקָה.',
  on: 'מוּזִיקָה פּוֹעֶלֶת', off: 'מוּזִיקָה כְּבוּיָה',
};

// ---------- IndexedDB (one store, one key) ----------
function openDB() {
  return new Promise((res, rej) => {
    let req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { rej(e); return; }
    req.onupgradeneeded = () => { try { req.result.createObjectStore(STORE); } catch (e) { /* exists */ } };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error || new Error('idb open failed'));
    req.onblocked = () => rej(new Error('idb blocked'));
  });
}
function tx(db, mode, fn) {
  return new Promise((res, rej) => {
    let t, out;
    try { t = db.transaction(STORE, mode); out = fn(t.objectStore(STORE)); } catch (e) { rej(e); return; }
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error || (out && out.error) || new Error('idb tx failed'));
    t.onabort = () => rej(t.error || new Error('idb aborted'));
  });
}

export function init({ audio, isMatch = () => false } = {}) {
  const el = new Audio();
  el.loop = true; el.preload = 'auto';
  el.setAttribute('playsinline', ''); el.setAttribute('webkit-playsinline', '');
  let url = null, name = '', hasTrack = false, persisted = false, note = '';
  let on = true; try { on = localStorage.getItem(ON_KEY) !== '0'; } catch { /* private mode */ }
  let unlocked = false, primed = false, hiddenPaused = false;
  let level = 0, duckUntil = 0, src = null, gain = null, routedCtx = null, lastPlayErr = null;
  let dbP = null, loadMs = -1;
  const db = () => (dbP = dbP || (typeof indexedDB === 'undefined' ? Promise.reject(new Error('no idb')) : openDB()));

  const globalMuted = () => !!(audio && audio.muted);
  const speaking = () => { try { return !!(window.speechSynthesis && speechSynthesis.speaking); } catch { return false; } };
  const ducked = () => performance.now() < duckUntil || speaking();
  function target() {
    if (!hasTrack || !on || globalMuted()) return 0;
    return (isMatch() ? VOL_MATCH : VOL_CASTLE) * (ducked() ? DUCK : 1);
  }
  const audible = () => hasTrack && on && !globalMuted();

  // Route through the game's AudioContext (iOS volume). Only once per element (spec rule).
  function route() {
    if (src) return;
    const ctx = audio && audio.ctx;
    if (!ctx || !ctx.createMediaElementSource) return;
    try {
      src = ctx.createMediaElementSource(el);
      gain = ctx.createGain(); gain.gain.value = level;
      src.connect(gain); gain.connect(ctx.destination);
      routedCtx = ctx; el.volume = 1;
    } catch (e) { src = null; gain = null; }
  }
  function apply() {
    if (gain) { try { gain.gain.setTargetAtTime(level, routedCtx.currentTime, 0.03); } catch { gain.gain.value = level; } }
    else { try { el.volume = Math.max(0, Math.min(1, level)); } catch { /* read-only on iOS */ } }
  }

  function tryPlay() {
    if (!url || !unlocked || document.hidden || !audible()) return;
    route();
    if (routedCtx && routedCtx.state !== 'running') routedCtx.resume().catch(() => {});   // iOS reports 'interrupted' after a lock or a call
    if (!el.paused) return;
    const p = el.play();
    if (p && p.catch) p.then(() => { lastPlayErr = null; render(); }, e => { lastPlayErr = e && e.name || 'error'; render(); });
  }

  // iOS: an element played once inside a gesture may play later without one. Prime it with a
  // tiny generated silent WAV (built in memory here; no file) if no track is loaded yet.
  function prime() {
    if (primed || url) return;
    primed = true;
    try {
      const n = 800, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), s = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
      s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
      const u = URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
      el.src = u; el.muted = true;
      const done = () => { if (!url) { el.pause(); el.removeAttribute('src'); try { el.load(); } catch { /* */ } } el.muted = false; URL.revokeObjectURL(u); };
      const p = el.play(); if (p && p.then) p.then(done, done); else done();
    } catch { el.muted = false; }
  }

  function setSource(blob, nm) {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob); name = nm || ''; hasTrack = true;
    el.muted = false; el.src = url; level = 0; apply();
  }
  function clearSource() {
    el.pause(); hasTrack = false; name = '';
    if (url) { URL.revokeObjectURL(url); url = null; }
    el.removeAttribute('src'); try { el.load(); } catch { /* */ }
  }

  // ---------- loop: ramps, auto pause when silent ----------
  let lastT = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = Math.min(0.5, (now - lastT) / 1000); lastT = now;
    if (gain === null && audio && audio.ctx && url && !el.paused) route();
    const tg = target();
    level += (tg - level) * (1 - Math.exp(-dt / TAU));
    if (Math.abs(tg - level) < 0.0015) level = tg;
    apply();
    if (tg === 0 && level === 0 && !el.paused && !audible()) el.pause();
  }, 50);

  // ---------- visibility ----------
  function onHide() { if (!el.paused) { hiddenPaused = true; el.pause(); } }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onHide();
    else if (hiddenPaused) { hiddenPaused = false; tryPlay(); }
  });
  addEventListener('pagehide', onHide);
  addEventListener('pageshow', () => { if (hiddenPaused && !document.hidden) { hiddenPaused = false; tryPlay(); } });
  // Any later tap retries (a play() that iOS refused outside a gesture, or after an interruption).
  const retry = () => { if (unlocked && url && audible() && !document.hidden) tryPlay(); };   // also when the element 'plays' into a context iOS interrupted
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => addEventListener(ev, retry, { capture: true, passive: true }));

  // ---------- storage ----------
  async function load() {
    try {
      const rec = await db().then(d => tx(d, 'readonly', s => s.get(REC)));
      if (rec && (rec.blob || rec.buf)) {
        const blob = rec.blob || new Blob([rec.buf], { type: rec.type || 'audio/mpeg' });
        persisted = true; setSource(blob, rec.name); note = ''; render(); tryPlay();
      }
    } catch { /* no IndexedDB: nothing remembered */ }
    loadMs = performance.now();
  }
  async function store(file) {
    const rec = { blob: file, name: file.name || '', type: file.type || '', size: file.size || 0, saved: Date.now() };
    const d = await db();
    try { await tx(d, 'readwrite', s => { s.clear(); return s.put(rec, REC); }); }
    catch (e) {
      if (e && e.name === 'DataCloneError') {   // old Safari could not store Blobs: keep the bytes
        const buf = await file.arrayBuffer();
        await tx(d, 'readwrite', s => { s.clear(); return s.put({ buf, name: rec.name, type: rec.type, size: rec.size, saved: rec.saved }, REC); });
      } else throw e;
    }
  }

  // ---------- UI ----------
  const css = document.createElement('style');
  css.textContent = `
  #musicBtn{right:calc(114px + env(safe-area-inset-right));bottom:calc(128px + env(safe-area-inset-bottom));flex-direction:column;gap:0;line-height:1;padding:0}
  #musicBtn .ic{font-size:30px} #musicBtn .lb{font-size:13px;font-weight:bold;color:#ffe9a8;margin-top:3px;text-shadow:0 1px 0 #000}
  #musicBtn.off .ic{opacity:.45}
  body.inMatch #musicBtn{display:none !important}
  #musicPanel{position:fixed;inset:0;z-index:36;display:none;align-items:center;justify-content:center;background:rgba(5,6,13,.55);direction:rtl}
  #musicPanel.on{display:flex}
  #musicPanel .box{position:relative;width:min(440px,92vw);max-height:92vh;overflow:auto;box-sizing:border-box;padding:16px 20px 18px;border-radius:24px;
    background:rgba(32,20,70,.97);border:4px solid #ffd76a;color:#fff;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.6);font-family:'Rubik',sans-serif}
  #musicPanel h3{margin:0 0 8px;color:#ffd76a;font-size:28px;text-shadow:0 2px 0 #000}
  #musicPanel .x{position:absolute;top:8px;left:8px;width:56px;height:56px;border-radius:50%;border:3px solid #ffd76a;background:rgba(60,40,120,.85);color:#fff;font-size:26px;cursor:pointer;touch-action:manipulation}
  #musicPanel .nm{font-size:20px;font-weight:bold;color:#ffe9a8;margin:6px 0;word-break:break-word;direction:auto}
  #musicPanel .nt{font-size:17px;color:#d8ccff;margin:4px 0 10px;min-height:1em}
  #musicPanel .row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
  #musicPanel .row button{min-width:84px;min-height:64px;border-radius:32px;border:3px solid #ffd76a;background:rgba(60,40,120,.85);color:#fff;
    font:bold 22px 'Rubik',sans-serif;padding:0 18px;cursor:pointer;touch-action:manipulation}
  #musicPanel .row button:active,#musicPanel .x:active{transform:scale(.93)}
  #musicPanel .row button[disabled]{opacity:.4}
  #musicPanel .tg{font-size:30px !important}
  #musicFile{display:none}`;
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.id = 'musicBtn'; btn.className = 'gamebtn'; btn.setAttribute('aria-label', T.title);
  btn.innerHTML = '<span class="ic">🎵</span><span class="lb">מוּזִיקָה</span>';
  const panel = document.createElement('div'); panel.id = 'musicPanel';
  panel.innerHTML = `<div class="box" role="dialog" aria-label="${T.title}">
    <button class="x" aria-label="סְגִירָה">✕</button>
    <h3>${T.title}</h3>
    <div class="nm"></div><div class="nt"></div>
    <div class="row"><button class="ch">${T.choose}</button><button class="tg" aria-label="${T.on}">🎵</button><button class="rm">${T.remove}</button></div>
    <input id="musicFile" type="file" accept="audio/*">
  </div>`;
  document.body.appendChild(btn); document.body.appendChild(panel);
  const $ = s => panel.querySelector(s);
  const nmEl = $('.nm'), ntEl = $('.nt'), tgB = $('.tg'), rmB = $('.rm'), input = $('#musicFile');
  // Taps on our UI must not reach the game (joystick / look).
  [btn, panel].forEach(n => ['pointerdown', 'touchstart', 'mousedown'].forEach(ev => n.addEventListener(ev, e => e.stopPropagation(), { passive: true })));

  function render() {
    nmEl.textContent = hasTrack ? '🎶 ' + name : T.none;
    let n = note;
    if (!n && hasTrack) n = persisted ? T.hint : T.session;
    if (hasTrack && audible() && el.paused && lastPlayErr === 'NotAllowedError') n = T.tap;
    ntEl.textContent = n;
    tgB.textContent = on ? '🎵' : '🔇'; tgB.setAttribute('aria-label', on ? T.on : T.off); tgB.setAttribute('aria-pressed', String(on));
    rmB.disabled = !hasTrack;
    btn.classList.toggle('off', !on || !hasTrack);
  }
  const open = () => { panel.classList.add('on'); render(); };
  const close = () => panel.classList.remove('on');
  btn.addEventListener('click', e => { e.stopPropagation(); api.unlock(); open(); });
  $('.x').addEventListener('click', e => { e.stopPropagation(); close(); });
  panel.addEventListener('click', e => { if (e.target === panel) close(); });
  $('.ch').addEventListener('click', e => { e.stopPropagation(); api.unlock(); prime(); input.value = ''; input.click(); });
  input.addEventListener('change', () => { const f = input.files && input.files[0]; if (f) api.choose(f); });
  tgB.addEventListener('click', e => { e.stopPropagation(); api.unlock(); api.setOn(!on); });
  rmB.addEventListener('click', e => { e.stopPropagation(); api.remove(); });
  el.addEventListener('error', () => { if (hasTrack && el.error) { note = T.bad; render(); } });

  const api = {
    unlock() { if (audio && audio.resume) audio.resume(); unlocked = true; prime(); tryPlay(); },
    poke() { tryPlay(); },
    async choose(file) {
      if (!file) return false;
      unlocked = true;                 // chosen via a tap
      note = ''; setSource(file, file.name); persisted = false; render();
      tryPlay();
      try { await store(file); persisted = true; note = ''; }
      catch (e) { persisted = false; note = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || '')) ? T.quota : T.session; }
      render();
      return persisted;
    },
    async remove() {
      clearSource(); persisted = false; note = ''; render();
      try { await db().then(d => tx(d, 'readwrite', s => s.delete(REC))); } catch { /* nothing stored */ }
      return true;
    },
    setOn(v) {
      on = !!v; try { localStorage.setItem(ON_KEY, on ? '1' : '0'); } catch { /* private mode */ }
      if (on) tryPlay();
      render(); return on;
    },
    duck(ms = 2500) { duckUntil = Math.max(duckUntil, performance.now() + ms); },
    open, close,
    state() {
      return { hasTrack, name, on, unlocked, persisted, playing: !el.paused, paused: el.paused, currentTime: el.currentTime,
        level, target: target(), gain: gain ? gain.gain.value : el.volume, routed: !!gain, ducked: ducked(), match: !!isMatch(),
        globalMuted: globalMuted(), note: ntEl.textContent, panelOpen: panel.classList.contains('on'), loadMs };
    },
    el,
  };
  render();
  load();
  return api;
}
