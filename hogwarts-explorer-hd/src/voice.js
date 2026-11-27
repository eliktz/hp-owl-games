// One Hebrew voice for the whole game (kid feedback 23 Nov 2026, brief briefs/2026-11-23-kid-feedback.md, part 3).
// Every speaker (spell courses, free casting, Floo, Quidditch, book adventures) calls speak(text, { preset }) here
// instead of picking "the first he-IL voice" on its own. No audio files: speechSynthesis only, and every failure is
// silent (the speech bubbles still show; a device without speechSynthesis just stays quiet).
//
// Voice choice: the device's Hebrew voices (lang he / he-IL / iw-IL), read again on `voiceschanged` and on the first
// tap (iOS Safari can report none until then). Score: Enhanced/Premium (+100), on-device (+10), Carmit (+5),
// "compact" (-20). The family's own pick in the 🗣️ panel (localStorage 'hpVoice' = voiceURI) wins while installed.
// Speaking: emoji stripped, niqqud kept, a small pronunciation map for spell names, split at commas (150 ms pause)
// and sentence ends (250 ms), cancel() before every new line (iOS queue stalls otherwise).
//
// The pure parts (scoreVoice, pickVoice, cleanText, splitChunks, createVoice with injected synth) import in plain
// node for tests; the DOM panel is built only by initVoice() in a browser. Debug: window.HPVoice.state().

export const KEY = 'hpVoice';
export const PREVIEW = 'שָׁלוֹם הָארִי!';
export const PAUSE_COMMA = 150, PAUSE_SENTENCE = 250;

// Presets: kid-friendly default; Flitwick higher (a course may override the pitch per teacher); the narrator calmer.
export const PRESETS = {
  default: { rate: 0.85, pitch: 1.1 },
  flitwick: { rate: 0.9, pitch: 1.35 },
  narrator: { rate: 0.82, pitch: 1.0 },
  commentator: { rate: 0.92, pitch: 1.15 },   // Quidditch: a little livelier, it has to keep up with the match
};

// ---------------- voice choice (pure) ----------------
export const isHebrew = v => !!v && /^(he|iw)([-_]|$)/i.test(String(v.lang || ''));
const RE_BETTER = /premium|enhanced|מורחב|משופר|neural|natural/i;
export function scoreVoice(v) {
  const name = String((v && v.name) || '');
  let s = 0;
  if (RE_BETTER.test(name)) s += 100;
  if (v && v.localService) s += 10;
  if (/carmit|כרמית/i.test(name)) s += 5;
  if (/compact/i.test(name)) s -= 20;
  if (/^he[-_]il$/i.test(String(v.lang || ''))) s += 1;
  return s;
}
export const voiceId = v => (v && (v.voiceURI || v.name)) || '';
export const isBetter = v => RE_BETTER.test(String((v && v.name) || ''));
export function hebrewVoices(all) {
  const list = (all || []).filter(isHebrew);
  return list.map((v, i) => ({ v, i, s: scoreVoice(v) })).sort((a, b) => b.s - a.s || a.i - b.i).map(o => o.v);
}
// saved: a voiceURI (or name) the family picked; ignored when that voice is no longer installed.
export function pickVoice(all, saved) {
  const list = hebrewVoices(all);
  if (!list.length) return null;
  if (saved) { const own = list.find(v => voiceId(v) === saved || v.name === saved); if (own) return own; }
  return list[0];
}

// ---------------- text (pure) ----------------
const L = '[\\p{L}\\p{M}]';
const heWord = (w, out) => [new RegExp(`(^|[^\\p{L}\\p{M}])([והבלמשכ]?)${w}(?!${L})`, 'gu'), `$1$2${out}`];
const enWord = (w, out) => [new RegExp(`(^|[^\\p{L}])${w}(?![\\p{L}])`, 'giu'), `$1${out}`];
// Spell names: Latin spellings and unpointed Hebrew spellings -> pointed Hebrew Carmit reads well. Pointed text passes as is.
export const PRONOUNCE = [
  enWord('expecto\\s+patronum', 'אֶקְסְפֶּקְטוֹ פַּטְרוֹנוּם'), enWord('wingardium\\s+leviosa', 'וִינְגַּארְדְיוּם לֵבְיוֹסָה'),
  enWord('alohomora', 'אָלוֹהוֹמוֹרָה'), enWord('glisseo', 'גְּלִיסֵאוֹ'), enWord('diffindo', 'דִּיפִינְדוֹ'),
  enWord('finite\\s+incantatem', 'פִינִיטֶה אִינְקַנְטָטֶם'), enWord('sonorus', 'סוֹנוֹרוּס'), enWord('point\\s+me', 'כַּוֵּן אוֹתִי'),
  enWord('herbivicus', 'הֶרְבִּיוִיקוּס'), enWord('lumos', 'לוּמוֹס'), enWord('nox', 'נוֹקְס'), enWord('accio', 'אַצְיוֹ'),
  enWord('reparo', 'רֶפָּארוֹ'), enWord('incendio', 'אִינְסֶנְדְיוֹ'), enWord('aguamenti', 'אָגֶוַאמֶנטִי'),
  enWord('expelliarmus', 'אֶקְסְפֶּלְיַארְמוּס'), enWord('riddikulus', 'רִידִיקוּלוּס'), enWord('protego', 'פְּרוֹטֶגוֹ'),
  enWord('petrificus\\s+totalus', 'פֶּטְרִיפִיקוּס טוֹטָלוּס'), enWord('stupefy', 'שְׁתֹק'),
  heWord('אקספקטו', 'אֶקְסְפֶּקְטוֹ'), heWord('פטרונום', 'פַּטְרוֹנוּם'), heWord('וינגארדיום', 'וִינְגַּארְדְיוּם'),
  heWord('לביוסה', 'לֵבְיוֹסָה'), heWord('אלוהומורה', 'אָלוֹהוֹמוֹרָה'), heWord('גליסאו', 'גְּלִיסֵאוֹ'),
  heWord('דיפינדו', 'דִּיפִינְדוֹ'), heWord('פיניטה', 'פִינִיטֶה'), heWord('אינקנטטם', 'אִינְקַנְטָטֶם'),
  heWord('סונורוס', 'סוֹנוֹרוּס'), heWord('הרביוויקוס', 'הֶרְבִּיוִיקוּס'), heWord('אקספליארמוס', 'אֶקְסְפֶּלְיַארְמוּס'),
  heWord('רפארו', 'רֶפָּארוֹ'), heWord('אינסנדיו', 'אִינְסֶנְדְיוֹ'), heWord('אגואמנטי', 'אָגֶוַאמֶנטִי'),
  heWord('הוגוורטס', 'הוֹגְוָורְטְס'), heWord('דמבלדור', 'דַּמְבֶּלְדוֹר'), heWord('פליטיק', 'פְלִיטִיק'), heWord('בקביק', 'בַּקְבִּיק'), heWord('אוטונוס', 'אוֹטוֹנוֹס'), heWord('דובשנרייה', 'דֻּבְשָׁנֶרִיָּה'),
  heWord('דודאים', 'דּוּדָאִים'), heWord('דודא', 'דּוּדָא'), heWord('מירטל', 'מִירְטֶל'), heWord('קונדסאים', 'קוּנְדֵסָאִים'), heWord('קונדס', 'קוּנְדֵס'), heWord('מחולל', 'מְחוֹלֵל'),
];
const RE_EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}︎️‍⃣]/gu;
export function cleanText(text) {
  let t = String(text == null ? '' : text);
  t = t.replace(RE_EMOJI, ' ');
  for (const [re, out] of PRONOUNCE) t = t.replace(re, out);
  t = t.replace(/\s*[—–\/]\s*/g, ', ')            // dashes and "a / b" read as a short pause
    .replace(/\.{3,}|…/g, '. ')
    .replace(/!+/g, '. ')                          // as before: no shouted "!" (it is a sentence end here)
    .replace(/[«»"״“”()[\]{}*_#<>|~^]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return t;
}
// Short pieces: a pause at each comma (150 ms) and sentence end (250 ms). '?' stays (question intonation).
export function splitChunks(text) {
  const out = [];
  const re = /([^,،;:.?]+)([,،;:]|[.?]+|$)/g;
  let m;
  const s = String(text || '');
  while ((m = re.exec(s))) {
    if (!m[0]) { re.lastIndex++; continue; }
    const body = m[1].trim(), p = m[2] || '';
    if (!body || !/[\p{L}\p{N}]/u.test(body)) continue;
    const q = p.includes('?') ? '?' : '';
    out.push({ text: body + q, pause: /[,،;:]/.test(p) ? PAUSE_COMMA : PAUSE_SENTENCE });
  }
  if (out.length) out[out.length - 1].pause = 0;
  return out;
}

// ---------------- the speaker (pure: everything injected) ----------------
// env: { synth, Utterance, storage, isMuted(), setTimeout, clearTimeout, onVoicesChanged(cb) }
export function createVoice(env = {}) {
  const synth = env.synth || null, Utt = env.Utterance || null, storage = env.storage || null;
  const isMuted = env.isMuted || (() => false);
  const later = env.setTimeout || ((f, ms) => setTimeout(f, ms)), unlater = env.clearTimeout || (t => clearTimeout(t));
  let voices = [], gen = 0, timer = null, cur = null, saved = null;
  const log = { spoken: [], speaks: 0, utterances: 0, cancels: 0, refreshes: 0, errors: 0, last: null };
  try { saved = storage ? storage.getItem(KEY) : null; } catch { saved = null; }

  function refresh() {
    log.refreshes++;
    try { voices = (synth && synth.getVoices && synth.getVoices()) || []; } catch { voices = []; }
    return voices;
  }
  const list = () => { if (!voices.length) refresh(); return hebrewVoices(voices); };
  const chosen = () => { if (!voices.length) refresh(); return pickVoice(voices, saved); };
  if (env.onVoicesChanged) { try { env.onVoicesChanged(() => { refresh(); if (api.onchange) api.onchange(); }); } catch { /* old browser */ } }
  refresh();

  function stop() { gen++; if (timer != null) { unlater(timer); timer = null; } cur = null; }
  function hush() {
    stop();
    try { if (synth) { synth.cancel(); log.cancels++; } } catch { /* ignore */ }
  }
  // speak(text, { preset, rate, pitch, voice, force }) -> true when it started speaking
  function speak(text, o = {}) {
    log.spoken.push(String(text)); if (log.spoken.length > 12) log.spoken.shift();
    try {
      if (!synth || !Utt) return false;
      if (!o.force && isMuted()) return false;
      const P = PRESETS[o.preset] || PRESETS.default;
      const rate = o.rate || P.rate, pitch = o.pitch || P.pitch;
      const chunks = splitChunks(cleanText(text));
      if (!chunks.length) return false;
      const v = o.voice || chosen();
      hush();                                    // always: a stale queue stalls iOS
      log.speaks++;
      log.last = { text: String(text), chunks: chunks.map(c => c.text), voice: v ? v.name : null, voiceURI: voiceId(v), rate, pitch, preset: o.preset || 'default' };
      const my = gen;
      let i = 0;
      const next = () => {
        timer = null;
        if (my !== gen || i >= chunks.length) return;
        const c = chunks[i++];
        let done = false;
        const u = new Utt(c.text);
        u.lang = (v && v.lang) || 'he-IL'; u.rate = rate; u.pitch = pitch; if (v) u.voice = v;
        // Next piece after the pause. A watchdog covers engines that never fire 'end' (old iOS).
        const go = () => { if (done || my !== gen) return; done = true; if (i < chunks.length) timer = later(next, c.pause); };
        u.onend = go;
        u.onerror = () => { log.errors++; done = true; };     // cancelled or failed: stop this line quietly
        cur = u; log.utterances++;
        synth.speak(u);
        if (i < chunks.length) {
          const est = 1200 + c.text.length * 110 / Math.max(0.5, rate);
          later(() => { if (!done && my === gen) go(); }, est);
        }
      };
      next();
      return true;
    } catch { log.errors++; return false; }
  }
  function choose(id) {
    saved = id || null;
    try { if (!storage) { /* nothing to save */ } else if (saved) storage.setItem(KEY, saved); else storage.removeItem(KEY); } catch { /* private mode */ }
    return chosen();
  }
  const api = {
    speak, hush, refresh, choose, list, chosen, log, onchange: null,
    get saved() { return saved; },
    get available() { return !!(synth && Utt); },
    speaking() { try { return !!(synth && synth.speaking) || timer != null; } catch { return false; } },
    state() {
      const c = chosen();
      return { available: api.available, voices: list().map(v => ({ name: v.name, lang: v.lang, uri: voiceId(v), local: !!v.localService, score: scoreVoice(v) })),
        chosen: c ? c.name : null, chosenURI: voiceId(c), saved, speaks: log.speaks, utterances: log.utterances, last: log.last, errors: log.errors,
        panelOpen: !!(typeof document !== 'undefined' && document.getElementById('voicePanel') && document.getElementById('voicePanel').classList.contains('on')) };
    },
  };
  return api;
}

// ---------------- the browser singleton ----------------
let V = null;
function browserVoice() {
  if (V) return V;
  const w = typeof window !== 'undefined' ? window : null;
  let synth = null, Utt = null, storage = null;
  try { if (w && 'speechSynthesis' in w && w.SpeechSynthesisUtterance) { synth = w.speechSynthesis; Utt = w.SpeechSynthesisUtterance; } } catch { /* none */ }
  try { storage = w ? w.localStorage : null; } catch { storage = null; }
  V = createVoice({
    synth, Utterance: Utt, storage,
    isMuted: () => { try { return !!(w && w.HP && w.HP.sfx && w.HP.sfx.isMuted && w.HP.sfx.isMuted()); } catch { return false; } },
    onVoicesChanged: cb => { if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', cb); else if (synth) synth.onvoiceschanged = cb; },
  });
  if (w) {
    w.HPVoice = V;
    // iOS: the list can stay empty until the first tap.
    const tap = () => { V.refresh(); if (V.onchange) V.onchange(); w.removeEventListener('pointerdown', tap, true); };
    try { w.addEventListener('pointerdown', tap, true); } catch { /* ignore */ }
  }
  return V;
}
// What the game modules call. Never throws.
export function speak(text, o) { try { return browserVoice().speak(text, o); } catch { return false; } }
export function hush() { try { browserVoice().hush(); } catch { /* ignore */ } }

// ---------------- the 🗣️ panel (browser only) ----------------
const T = {
  btn: 'קוֹל', title: '🗣️ קוֹל', auto: '✨ אוֹטוֹמָטִי (הַטּוֹב בְּיוֹתֵר)', better: 'מְשֻׁפָּר', close: 'סְגִירָה',
  none: 'לֹא מָצָאנוּ קוֹל עִבְרִי בַּמַּכְשִׁיר הַזֶּה. הַבּוּעוֹת מַמְשִׁיכוֹת לְהוֹפִיעַ, וְאֶפְשָׁר לְשַׂחֵק כָּרָגִיל.',
  noSpeech: 'הַמַּכְשִׁיר הַזֶּה לֹא מְדַבֵּר. הַבּוּעוֹת מַמְשִׁיכוֹת לְהוֹפִיעַ, וְאֶפְשָׁר לְשַׂחֵק כָּרָגִיל.',
  tapToHear: 'נוֹגְעִים בְּקוֹל כְּדֵי לִשְׁמֹעַ אוֹתוֹ.',
  hint: '👪 לַהוֹרִים: אֶפְשָׁר לְהוֹרִיד קוֹל מְשֻׁפָּר בַּהַגְדָּרוֹת',
  how: 'iOS 18 ואילך: הגדרות › נגישות › הקראה ודיבור (Read & Speak) › קולות › עברית › כרמית › לגעת בסמל ההורדה (ענן) של Enhanced / Premium, ב-Wi-Fi (100MB+). ' +
    'iOS 17 ומטה: הגדרות › נגישות › תוכן מוקרא (Spoken Content) › קולות › עברית. אחר כך לסגור את ספארי לגמרי ולפתוח מחדש. רק קול משופר אחד לכל שפה מגיע לדפדפן.',
};
export function initVoice() {
  if (typeof document === 'undefined') return null;
  const api = browserVoice();
  try {
    const css = document.createElement('style');
    css.textContent = `
  #voiceBtn{right:calc(210px + env(safe-area-inset-right));bottom:calc(128px + env(safe-area-inset-bottom));flex-direction:column;gap:0;line-height:1;padding:0;cursor:pointer;touch-action:manipulation}
  #voiceBtn .ic{font-size:30px} #voiceBtn .lb{font-size:13px;font-weight:bold;color:#ffe9a8;margin-top:3px;text-shadow:0 1px 0 #000}
  body.inMatch #voiceBtn,body.inSpell #voiceBtn,body.inFloo #voiceBtn,body.modalOn #voiceBtn{display:none !important}
  #voicePanel{position:fixed;inset:0;z-index:36;display:none;align-items:center;justify-content:center;background:rgba(5,6,13,.55);direction:rtl}
  #voicePanel.on{display:flex}
  #voicePanel .box{position:relative;width:min(460px,92vw);max-height:90vh;overflow:auto;box-sizing:border-box;padding:16px 18px 16px;border-radius:24px;
    background:rgba(32,20,70,.97);border:4px solid #ffd76a;color:#fff;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.6);font-family:'Rubik','Arial Hebrew',sans-serif}
  #voicePanel h3{margin:0 0 8px;color:#ffd76a;font-size:28px;text-shadow:0 2px 0 #000}
  #voicePanel .x{position:absolute;top:8px;left:8px;width:56px;height:56px;border-radius:50%;border:3px solid #ffd76a;background:rgba(60,40,120,.85);color:#fff;font-size:26px;cursor:pointer;touch-action:manipulation}
  #voicePanel .nt{font-size:18px;color:#d8ccff;margin:4px 0 10px}
  #voicePanel .list{display:flex;flex-direction:column;gap:8px;margin:0 0 10px}
  #voicePanel .vo{min-height:58px;border-radius:29px;border:3px solid #ffd76a;background:rgba(60,40,120,.85);color:#fff;font:bold 20px 'Rubik','Arial Hebrew',sans-serif;
    padding:6px 16px;cursor:pointer;touch-action:manipulation;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
  #voicePanel .vo .n{direction:ltr;unicode-bidi:isolate}
  #voicePanel .vo .b{font-size:15px;color:#2b1d00;background:#ffd76a;border-radius:12px;padding:2px 8px}
  #voicePanel .vo.on{background:rgba(255,215,106,.28);box-shadow:0 0 14px rgba(255,215,106,.6)}
  #voicePanel .vo:active,#voicePanel .x:active{transform:scale(.95)}
  #voicePanel .hint{font-size:17px;color:#ffe9a8;margin:8px 0 2px}
  #voicePanel details{font-size:14px;color:#cfc4f2;text-align:right;margin:4px 6px 0;line-height:1.45}
  #voicePanel summary{cursor:pointer;color:#ffe9a8;text-align:center;font-size:15px}`;
    document.head.appendChild(css);
    const btn = document.createElement('button');
    btn.id = 'voiceBtn'; btn.className = 'gamebtn'; btn.setAttribute('aria-label', T.title);
    btn.innerHTML = `<span class="ic">🗣️</span><span class="lb">${T.btn}</span>`;
    const panel = document.createElement('div'); panel.id = 'voicePanel';
    panel.innerHTML = `<div class="box" role="dialog" aria-label="${T.title}">
    <button class="x" aria-label="${T.close}">✕</button>
    <h3>${T.title}</h3><div class="nt"></div><div class="list"></div>
    <div class="hint">${T.hint}</div>
    <details><summary>אֵיךְ?</summary><div>${T.how}</div></details>
  </div>`;
    document.body.appendChild(btn); document.body.appendChild(panel);
    const ntEl = panel.querySelector('.nt'), listEl = panel.querySelector('.list');
    [btn, panel].forEach(n => ['pointerdown', 'touchstart', 'mousedown'].forEach(ev => n.addEventListener(ev, e => e.stopPropagation(), { passive: true })));
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function render() {
      const vs = api.list(), c = api.chosen();
      ntEl.textContent = !api.available ? T.noSpeech : vs.length ? T.tapToHear : T.none;
      let h = '';
      if (vs.length > 1) h += `<button class="vo${api.saved ? '' : ' on'}" data-id="">${T.auto}</button>`;
      vs.forEach((v, i) => {
        const id = voiceId(v), on = !!api.saved && c && voiceId(c) === id || (vs.length === 1);
        h += `<button class="vo${on ? ' on' : ''}" data-i="${i}" aria-pressed="${on}">${on ? '✔ ' : ''}<span class="n">${esc(v.name)}</span>${isBetter(v) ? `<span class="b">⭐ ${T.better}</span>` : ''}</button>`;
      });
      listEl.innerHTML = h;
      listEl.querySelectorAll('.vo').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const vv = b.dataset.i != null ? vs[+b.dataset.i] : null;
        const nv = api.choose(vv ? voiceId(vv) : null);
        render();
        speak(PREVIEW, { force: true, voice: nv || undefined });
      }));
    }
    api.onchange = () => { if (panel.classList.contains('on')) render(); };
    const open = () => { api.refresh(); render(); panel.classList.add('on'); };
    const close = () => panel.classList.remove('on');
    btn.addEventListener('click', e => { e.stopPropagation(); open(); });
    panel.querySelector('.x').addEventListener('click', e => { e.stopPropagation(); close(); });
    panel.addEventListener('click', e => { if (e.target === panel) close(); });
    api.open = open; api.close = close;
  } catch { /* the game runs without the panel */ }
  return api;
}
