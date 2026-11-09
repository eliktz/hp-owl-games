/* Delight core — the shared plumbing for all the little surprises (delight/*.js):
 *   HPFun.store   one persisted save (house, pet, hats, secrets found…)
 *   HPFun.sfx     silly procedural WebAudio sounds (giggle, raspberry, ribbit, zap, burp…)
 *   HPFun.toast   a big bouncy emoji+word banner        HPFun.confetti  emoji confetti rain
 *   HPFun.say     a speech bubble pinned to a 3D point   HPFun.prompt    a round "do it" button
 *   HPFun.badge   register + award a sticker             HPFun.pois      walk-to spots (tests)
 *   HPFun.inside(fn) / HPFun.always(fn)   per-frame ticks (indoors only / everywhere)
 * Modules boot once window.__game exists. Text stays tiny + Hebrew; everything is original. */
(function () {
  const T = window.THREE;
  const F = (window.HPFun = { pois: [], mods: {} });

  // ---------------- persisted save ----------------
  const KEY = 'hpFun1';
  let store = {};
  try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { store = {}; }
  F.store = store;
  F.save = function () { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  F.today = function () { try { return new Date().toDateString(); } catch (e) { return 'day'; } };

  // ---------------- silly sounds ----------------
  let ac = null, master = null;
  function ctx() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); }
      catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { if (window.__game && __game.started) ctx(); }, { passive: true }));
  const quiet = () => !ac || (window.HP && HP.sfx.isMuted());
  function tone(f, dur, type, vol, when, slide) {
    if (quiet()) return;
    const t0 = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, when, freq, q, type) {
    if (quiet()) return;
    const t0 = ac.currentTime + (when || 0), len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 800; f.Q.value = q || 1;
    const g = ac.createGain(); g.gain.setValueAtTime(vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0);
  }
  const S = (F.sfx = { tone, noise });
  S.giggle = (hi) => { const b = hi ? 900 : 620; for (let i = 0; i < 6; i++) tone(b + (i % 2 ? 140 : 0) - i * 22, 0.09, 'triangle', 0.16, i * 0.085, b * 1.15); };
  S.raspberry = () => { if (quiet()) return; for (let i = 0; i < 22; i++) tone(95 + Math.random() * 40, 0.035, 'sawtooth', 0.2, i * 0.03); noise(0.7, 0.07, 0, 300, 0.8); };
  S.ribbit = (v) => { const k = v == null ? 1 : v; tone(190, 0.1, 'square', 0.1 * k, 0, 320); tone(240, 0.16, 'square', 0.1 * k, 0.13, 150); };
  S.zap = () => { tone(1400, 0.28, 'sawtooth', 0.09, 0, 240); tone(2100, 0.2, 'sine', 0.1, 0.02, 3200); noise(0.25, 0.06, 0, 3000, 2); };
  S.clank = () => { for (let i = 0; i < 4; i++) { tone(700 + Math.random() * 900, 0.07, 'square', 0.07, i * 0.11); noise(0.06, 0.12, i * 0.11, 2500, 3); } };
  S.burp = () => { tone(150, 0.32, 'sawtooth', 0.2, 0, 70); tone(210, 0.12, 'square', 0.08, 0.05, 120); };
  S.hic = () => { tone(520, 0.07, 'sine', 0.2, 0, 1150); };
  S.squeak = () => { tone(1500, 0.09, 'sine', 0.16, 0, 2300); tone(2000, 0.08, 'sine', 0.12, 0.1, 1500); };
  S.boing = () => { tone(180, 0.4, 'sine', 0.24, 0, 640); };
  S.poof = () => { noise(0.4, 0.18, 0, 500, 0.6); tone(260, 0.3, 'sine', 0.12, 0, 120); };
  S.tada = () => { [523, 659, 784, 1047, 1319].forEach((n, i) => { tone(n, i === 4 ? 0.6 : 0.16, 'triangle', 0.2, i * 0.09); tone(n / 2, 0.2, 'sine', 0.08, i * 0.09); }); };
  S.drum = () => { for (let i = 0; i < 14; i++) noise(0.05, 0.1 + i * 0.008, i * 0.075, 220, 1.2, 'lowpass'); };
  S.tink = (i) => { tone(1300 + (i || 0) * 90 + Math.random() * 200, 0.2, 'sine', 0.1); };
  S.yelp = () => { tone(500, 0.3, 'triangle', 0.2, 0, 1500); tone(1500, 0.25, 'triangle', 0.14, 0.28, 400); };
  S.munch = () => { for (let i = 0; i < 3; i++) noise(0.07, 0.18, i * 0.13, 900, 1.5); };
  S.heart = () => { tone(660, 0.14, 'sine', 0.16); tone(880, 0.3, 'sine', 0.16, 0.13); };
  S.tune = (notes, step, type) => { notes.forEach((n, i) => { if (n) tone(n, (step || 0.2) * 0.9, type || 'triangle', 0.1, i * (step || 0.2)); }); };

  // ---------------- DOM: styles, toast, confetti, world bubble, prompt ----------------
  const css = document.createElement('style');
  css.textContent = `
  #funToast{position:fixed;left:50%;top:30%;transform:translate(-50%,-50%) scale(0);z-index:44;pointer-events:none;text-align:center;
    background:rgba(32,20,70,.95);border:4px solid #ffd76a;border-radius:26px;padding:12px 26px 14px;color:#fff;font-family:'Rubik',sans-serif;
    box-shadow:0 10px 36px rgba(0,0,0,.55);transition:transform .42s cubic-bezier(.3,1.8,.5,1);max-width:86vw;direction:rtl}
  #funToast.on{transform:translate(-50%,-50%) scale(1)}
  #funToast .e{font-size:70px;line-height:1.05;filter:drop-shadow(0 0 14px rgba(255,215,106,.7))}
  #funToast .t{font-size:30px;font-weight:bold;color:#ffe9a8;text-shadow:0 2px 0 #000}
  .funConf{position:fixed;top:-50px;z-index:43;pointer-events:none;font-size:34px;animation:funFall linear forwards;will-change:transform}
  @keyframes funFall{0%{transform:translate3d(0,0,0) rotate(0)}100%{transform:translate3d(var(--dx),108vh,0) rotate(var(--rot))}}
  .funBub{position:fixed;transform:translate(-50%,-100%) scale(.6);padding:8px 14px;border-radius:18px;background:rgba(255,248,228,.96);
    border:3px solid #ffd76a;color:#2a1a12;font:bold 24px 'Rubik',sans-serif;text-align:center;z-index:12;pointer-events:none;opacity:0;
    transition:opacity .18s,transform .25s cubic-bezier(.3,1.7,.5,1);max-width:56vw;white-space:nowrap;direction:rtl}
  .funBub.on{opacity:1;transform:translate(-50%,-100%) scale(1)}
  #funPrompt{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%) scale(0);z-index:12;
    width:96px;height:96px;border-radius:50%;border:5px solid #fff;background:linear-gradient(#ffe48a,#ffb020);font-size:50px;
    display:flex;align-items:center;justify-content:center;box-shadow:0 0 26px rgba(255,210,90,.9);cursor:pointer;
    transition:transform .25s cubic-bezier(.3,1.7,.5,1);touch-action:manipulation;-webkit-tap-highlight-color:transparent;padding:0}
  #funPrompt.on{transform:translateX(-50%) scale(1);animation:funPulse 1.1s infinite .3s}
  @keyframes funPulse{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.1)}}
  body.modalOn #funPrompt,body.modalOn .funBub{display:none}`;
  document.head.appendChild(css);

  let toastEl = null, toastT = null;
  F.toast = function (emoji, text, ms) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'funToast'; document.body.appendChild(toastEl); }
    toastEl.innerHTML = '<div class="e">' + emoji + '</div>' + (text ? '<div class="t">' + text + '</div>' : '');
    toastEl.classList.add('on'); clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('on'), ms || 2200);
    F.lastToast = { emoji, text };
  };

  F.confetti = function (set, n) {
    set = set || ['✨', '⭐', '🎉', '🌟', '💛', '🎊'];
    n = Math.round((n || 18) * Math.max(0.5, (window.HP && HP.perf.quality) || 1));
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div'); d.className = 'funConf';
      d.textContent = set[(Math.random() * set.length) | 0];
      d.style.left = (Math.random() * 100) + 'vw';
      d.style.setProperty('--dx', ((Math.random() - 0.5) * 30) + 'vw');
      d.style.setProperty('--rot', ((Math.random() - 0.5) * 900) + 'deg');
      d.style.animationDuration = (1.5 + Math.random() * 1.4) + 's';
      d.style.animationDelay = (Math.random() * 0.4) + 's';
      d.style.fontSize = (24 + Math.random() * 22) + 'px';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 3600);
    }
  };

  // speech bubbles pinned to a world position (re-projected every frame)
  const bubs = [];
  const v3 = T ? new T.Vector3() : null;
  F.say = function (pos, text, sec, key) {
    let b = key && bubs.find((x) => x.key === key);
    if (!b) { b = { el: document.createElement('div'), key }; b.el.className = 'funBub'; document.body.appendChild(b.el); bubs.push(b); }
    b.pos = pos; b.t = sec || 2.4; b.world = window.__game ? __game.world : 'inside';
    if (b.text !== text) { b.text = text; b.el.textContent = text; }
    return b;
  };
  function tickBubs(dt, world, camera) {
    for (let i = bubs.length - 1; i >= 0; i--) {
      const b = bubs[i]; b.t -= dt;
      if (b.t <= 0 || b.world !== world) { b.el.classList.remove('on'); if (b.t < -0.4) { b.el.remove(); bubs.splice(i, 1); } continue; }
      v3.copy(b.pos).project(camera);
      if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) { b.el.classList.remove('on'); continue; }
      b.el.style.left = (v3.x * 0.5 + 0.5) * window.innerWidth + 'px';
      b.el.style.top = (-v3.y * 0.5 + 0.5) * window.innerHeight + 'px';
      b.el.classList.add('on');
    }
  }

  // one shared round action button ("put on the hat", "look in the mirror"…). Each frame a
  // module may offer(); the nearest offer wins; nothing offered → the button hides.
  let promptEl = null, offer = null, shown = null;
  F.offer = function (id, emoji, dist, fn) { if (!offer || dist < offer.dist) offer = { id, emoji, dist, fn }; };
  function tickPrompt() {
    if (!promptEl) {
      promptEl = document.createElement('button'); promptEl.id = 'funPrompt'; document.body.appendChild(promptEl);
      promptEl.addEventListener('click', (e) => { e.stopPropagation(); if (shown && shown.fn) { const f = shown.fn; S.squeak(); f(); } });
    }
    const lessonPrompt = document.getElementById('lsnStart');
    if (offer && !(lessonPrompt && lessonPrompt.classList.contains('on'))) {
      if (!shown || shown.id !== offer.id) promptEl.textContent = offer.emoji;
      shown = offer; promptEl.classList.add('on');
    } else { shown = null; promptEl.classList.remove('on'); }
    offer = null;
  }
  F.promptId = () => (shown ? shown.id : null);

  // ---------------- stickers ----------------
  F.badge = function (id, e, n) { const B = __game.BADGES; if (!B.find((b) => b.id === id)) B.push({ id, e, n }); };
  F.award = function (id) { try { __game.award(id); } catch (e) {} };

  // ---------------- tiny 3D helpers ----------------
  F.glow = function (color, size, opacity) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color, transparent: true, opacity: opacity == null ? 0.6 : opacity, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    s.scale.setScalar(size || 2); return s;
  };
  F.mesh = function (geo, color, x, y, z, opts) {
    const m = new T.Mesh(geo, new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.8 }, opts || {})));
    m.position.set(x || 0, y || 0, z || 0); return m;
  };
  F.emojiSprite = function (emoji, size) {
    const tex = HP.canvasTex(128, (g, s) => { g.clearRect(0, 0, s, s); g.font = '96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, s / 2, s / 2 + 6); });
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    sp.scale.setScalar(size || 1); return sp;
  };
  // add a static prop to the castle so room-culling manages it; dynamic things pass dyn=true
  F.addInside = function (obj, dyn) {
    obj.userData.noCam = true;                 // decorations never block the camera arm
    __game.inside.scene.add(obj);
    if (!dyn && window.HPI && HPI.cull) HPI.cull.add(obj);
    return obj;
  };
  F.poi = function (id, x, z) { F.pois.push({ id, x, z }); };
  F.floor = (x, z) => __game.inside.floorH(x, z);
  F.dist = (p, x, z) => Math.hypot(p.x - x, p.z - z);

  // ---------------- frame loop + boot ----------------
  const insideFns = [], alwaysFns = [], boots = [];
  F.inside = (fn) => insideFns.push(fn);
  F.always = (fn) => alwaysFns.push(fn);
  F.boot = (fn) => boots.push(fn);
  let lastModal = false;
  function tick(dt, t, world, playing) {
    const g = __game, modal = g.modal;
    if (modal !== lastModal) { lastModal = modal; document.body.classList.toggle('modalOn', modal); }
    tickBubs(dt, world, g.camera);
    if (!playing || modal) { tickPrompt(); return; }
    const p = g.player;
    for (const fn of alwaysFns) fn(dt, t, p, world);
    if (world === 'inside') for (const fn of insideFns) fn(dt, t, p);
    tickPrompt();
  }
  (function boot() {
    if (!window.__game || !__game.hooks || !window.HPI || document.readyState !== 'complete') return void setTimeout(boot, 60);
    for (const fn of boots) { try { fn(__game); } catch (e) { console.error('[delight boot]', e); } }
    __game.hooks.push(tick);
    F.ready = true;
  })();
})();
