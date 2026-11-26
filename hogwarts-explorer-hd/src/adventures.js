// Book adventures: structured, opt-in quests from the books (Elik's son's ask, 22 Nov 2026; brief
// briefs/2026-11-22-book-quests.md in the art repo). Not the old stars-and-letters game (quests.js): that stays.
//
// A 📖 button opens the book: one chapter card per quest (picture, Hebrew title, 🔒 / open / ⭐, "בקרוב" on stubs).
// Start: a narrated intro (a parchment card + Hebrew speechSynthesis), then 3 to 6 steps. The tracker (top, RTL, big)
// shows the step line + progress dots and a ⏸ button ("לעצור את ההרפתקה?" stay / leave; leaving keeps the step).
// The goal: a bobbing gold arrow over it, a sparkle trail from Harry toward it, a screen-edge chevron when it is off
// screen (in another room: the door that leads there). Hints by idle time on a step (level 1: 15/30/45/60 s, levels
// 2-3: 25/45/65/85): a helper bubble, the target glows, the right spell pulses on the wheel, then "ביחד!" does the
// step with the player. Each step: sparkles + 5 house points; the finish: a chapter card + a star, saved.
// Kid-safe: no fail state, no timers that fail, a wrong choice only gives a gentle bubble.
//
// Quest data + scene code live in adventure-*.js (declarative: id, title, intro, steps[{ line, hints, spell }],
// create(ctx) -> scene { begin(step, resumed), update(dt, step), goal(step, out), tap(x, y, step), glow(step, on),
// together(step), end(), state() }). Save: localStorage 'hpAdventures1' = { v: 1, done: { id: { stars, lv, n } },
// cur: { id, step, lv, paused } | null }; anything unreadable is treated as empty.
// Budgets: one pooled InstancedMesh (120 quads) for every sparkle, one arrow mesh, one glow quad; nothing per frame.
// Debug: window.__game.adventures  list() state() start(id, lv) skipStep() hint(n) clock(s) hold(on) leave() reset()
import { InstancedMesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, Color, Vector3, Matrix4, Quaternion, Mesh, ConeGeometry, CylinderGeometry, AdditiveBlending, SRGBColorSpace } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { speak as voiceSpeak } from './voice.js';
import { DOOR } from './castle.js';
import { QUESTS } from './adventure-stone.js';

const KEY = 'hpAdventures1';
const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew','Heebo',Arial,sans-serif";
const HINT_T = { 1: [15, 30, 45, 60], 2: [25, 45, 65, 85], 3: [25, 45, 65, 85] };
const BYID = Object.fromEntries(QUESTS.map(q => [q.id, q]));
const BOOKS = { 1: '📕 ספר 1: אבן החכמים', 2: '📗 ספר 2: חדר הסודות', 3: '📘 ספר 3: האסיר מאזקבאן' };

// ---------------- save (versioned; never throws, never trusts what it reads) ----------------
const empty = () => ({ v: 1, done: {}, cur: null });
export function readSave() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(KEY)); } catch { return empty(); }
  if (!o || typeof o !== 'object' || o.v !== 1) return empty();
  const s = empty();
  try {
    if (o.done && typeof o.done === 'object') for (const k of Object.keys(o.done)) {
      const d = o.done[k]; if (!BYID[k] || !d || typeof d !== 'object') continue;
      s.done[k] = { stars: Math.max(0, Math.min(3, d.stars | 0)), lv: Math.max(1, Math.min(3, d.lv | 0 || 1)), n: Math.max(0, d.n | 0) };
    }
    const c = o.cur;
    if (c && typeof c === 'object' && BYID[c.id] && !BYID[c.id].soon && Number.isFinite(c.step)) {
      const n = BYID[c.id].steps.length, st = c.step | 0;
      if (st >= 0 && st < n) s.cur = { id: c.id, step: st, lv: Math.max(1, Math.min(3, c.lv | 0 || 1)), paused: !!c.paused };
    }
  } catch { return empty(); }
  return s;
}

export function createAdventures({ scene, camera, player, interiors, fun, freecast, setModal, isModal, isTakeover, setTakeover }) {
  const save = readSave();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode */ } };
  const log = { starts: 0, steps: 0, hints: [], oops: 0, togethers: 0, finishes: 0, spoken: [], taps: 0, rewards: 0, cards: 0, errors: 0 };
  const sfx = (k, ...a) => { try { const s = fun.sfx; if (s && s[k]) s[k](...a); } catch { /* no audio */ } };
  const debug = /[?&]debug=1/.test(location.search);

  // ---------------- voice ----------------
  const muted = () => { try { return !!(window.HP && window.HP.sfx && window.HP.sfx.isMuted && window.HP.sfx.isMuted()); } catch { return false; } };
  function speak(text) {
    log.spoken.push(text); if (log.spoken.length > 10) log.spoken.shift();
    try {
      if (!muted()) voiceSpeak(text, { preset: 'narrator' });   // voice.js: the family's / best Hebrew voice
    } catch { /* no speech here */ }
  }

  // ---------------- pooled sparkles (one InstancedMesh, additive, camera-facing) ----------------
  const NP = 120;
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.8)'); g.addColorStop(0.65, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(30, 2, 4, 60); x.fillRect(2, 30, 60, 4);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
  })();
  const pMesh = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: AdditiveBlending }), NP);
  pMesh.frustumCulled = false; pMesh.count = 0; pMesh.visible = false; pMesh.raycast = () => {}; pMesh.renderOrder = 6; pMesh.name = 'adv-fx';
  const _c = new Color(); for (let i = 0; i < NP; i++) pMesh.setColorAt(i, _c.setRGB(0, 0, 0));
  scene.add(pMesh);
  const pp = new Float32Array(NP * 3), pv = new Float32Array(NP * 3), pl = new Float32Array(NP * 2), ps = new Float32Array(NP), pc = new Float32Array(NP * 3), pg = new Float32Array(NP);
  let alive = 0;
  function emit(x, y, z, vx, vy, vz, life, size, hex, grav = 0) {
    let i = -1; for (let k = 0; k < NP; k++) if (pl[k * 2] <= 0) { i = k; break; }
    if (i < 0) return;
    pp[i * 3] = x; pp[i * 3 + 1] = y; pp[i * 3 + 2] = z; pv[i * 3] = vx; pv[i * 3 + 1] = vy; pv[i * 3 + 2] = vz;
    pl[i * 2] = pl[i * 2 + 1] = life; ps[i] = size; pg[i] = grav; _c.setHex(hex); pc[i * 3] = _c.r; pc[i * 3 + 1] = _c.g; pc[i * 3 + 2] = _c.b; alive++;
  }
  function burst(x, y, z, hex = 0xffd76a, n = 18, spd = 2, life = 0.9, size = 0.22, grav = -1) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = spd * (0.4 + Math.random() * 0.6), h = Math.sqrt(1 - u * u);
      emit(x, y, z, Math.cos(a) * h * s, u * s + spd * 0.3, Math.sin(a) * h * s, life * (0.6 + Math.random() * 0.5), size * (0.6 + Math.random() * 0.7), hex, grav); }
  }
  const _m = new Matrix4(), _p = new Vector3(), _s = new Vector3();
  function tickParticles(dt) {
    if (alive <= 0) { if (pMesh.visible) { pMesh.visible = false; pMesh.count = 0; } return; }
    let n = 0, a = 0;
    for (let i = 0; i < NP; i++) {
      if (pl[i * 2] <= 0) continue;
      pl[i * 2] -= dt; if (pl[i * 2] <= 0) continue;
      a++; const i3 = i * 3, f = pl[i * 2] / pl[i * 2 + 1], k = Math.max(0, 1 - 1.2 * dt);
      pv[i3] *= k; pv[i3 + 2] *= k; pv[i3 + 1] = pv[i3 + 1] * k + pg[i] * dt;
      pp[i3] += pv[i3] * dt; pp[i3 + 1] += pv[i3 + 1] * dt; pp[i3 + 2] += pv[i3 + 2] * dt;
      const al = f < 0.3 ? f / 0.3 : 1, sz = ps[i] * (0.5 + 0.5 * f);
      _m.compose(_p.set(pp[i3], pp[i3 + 1], pp[i3 + 2]), camera.quaternion, _s.set(sz, sz, sz)); pMesh.setMatrixAt(n, _m);
      pMesh.setColorAt(n, _c.setRGB(pc[i3] * al, pc[i3 + 1] * al, pc[i3 + 2] * al)); n++;
    }
    alive = a; pMesh.count = n; pMesh.visible = n > 0;
    pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
  }

  // ---------------- the goal arrow (one mesh) + the target glow (one quad) ----------------
  const arrowGeo = mergeGeometries([new ConeGeometry(0.32, 0.55, 14).rotateX(Math.PI).translate(0, 0.27, 0), new CylinderGeometry(0.12, 0.12, 0.6, 10).translate(0, 0.82, 0)], false);
  const arrow = new Mesh(arrowGeo, new MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.95, depthTest: false }));
  arrow.renderOrder = 7; arrow.visible = false; arrow.frustumCulled = false; arrow.raycast = () => {}; arrow.name = 'adv-arrow'; scene.add(arrow);
  const glow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: glowTex, color: 0xffd76a, transparent: true, depthWrite: false, blending: AdditiveBlending }));
  glow.renderOrder = 6; glow.visible = false; glow.frustumCulled = false; glow.raycast = () => {}; glow.name = 'adv-glow'; scene.add(glow);

  // ---------------- DOM: 📖 button, the book, the intro, the tracker, the ask, the hint bubble, the edge chevron, the card ----------------
  const css = document.createElement('style');
  css.textContent = `
  #advBtn{right:calc(18px + env(safe-area-inset-right));bottom:calc(224px + env(safe-area-inset-bottom));font-size:40px;padding:0;cursor:pointer;touch-action:manipulation;
    background:radial-gradient(circle at 50% 35%,rgba(210,150,80,.95),rgba(110,50,20,.9))}
  #advBtn.glint{animation:advGlint 1.6s ease-in-out infinite}
  @keyframes advGlint{0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.4)}50%{box-shadow:0 0 22px 6px rgba(255,215,106,.75)}}
  #advBook{position:fixed;inset:0;z-index:37;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;direction:rtl;font-family:${FONT};
    background:radial-gradient(ellipse at 50% 40%,rgba(96,60,30,.97),rgba(26,14,8,.98));touch-action:manipulation}
  #advBook.on{display:flex}
  #advBook h2{color:#ffe9a8;font-size:32px;margin:0;text-shadow:0 2px 0 #000,0 0 18px rgba(255,200,90,.55)}
  #advBook .pages{display:block;width:min(1040px,94vw);padding:10px 16px 16px;box-sizing:border-box;border-radius:22px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;
    background:linear-gradient(90deg,#efe0bc,#f8ecd0 48%,#d9c49a 50%,#f8ecd0 52%,#efe0bc);box-shadow:0 10px 40px rgba(0,0,0,.6),inset 0 0 30px rgba(120,80,30,.35);max-height:72vh;overflow:auto}
  #advBook .sec{margin:4px 0 8px;padding:4px 14px;border-radius:14px;background:linear-gradient(90deg,rgba(122,58,18,.0),rgba(122,58,18,.85) 20%,rgba(122,58,18,.85) 80%,rgba(122,58,18,0));
    color:#ffe9a8;font-size:23px;font-weight:bold;text-align:center;text-shadow:0 2px 0 #000}
  #advBook .grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:12px}
  #advBook .card canvas{max-height:16vh;object-fit:cover}
  #advBook .card{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 6px 10px;border-radius:16px;border:3px solid #b8862e;background:rgba(255,250,236,.9);
    font-family:inherit;color:#3a2410;cursor:pointer;touch-action:manipulation;box-shadow:0 4px 12px rgba(80,50,10,.3)}
  #advBook .card:active{transform:scale(.96)}
  #advBook .card canvas{width:100%;height:auto;border-radius:10px;display:block}
  #advBook .card .t{font-size:19px;font-weight:bold;line-height:1.15;text-align:center;min-height:2.3em;display:flex;align-items:center}
  #advBook .card .s{font-size:17px;font-weight:bold;padding:4px 12px;border-radius:14px;background:#7a3a12;color:#ffe9a8;white-space:nowrap}
  #advBook .sec.gold{color:#fff3b0;text-shadow:0 2px 0 #000,0 0 14px rgba(255,215,106,.95)}
  #advBook .card.soon{filter:grayscale(.7);opacity:.75;cursor:default} #advBook .card.soon .s{background:#7a7064}
  #advBook .card.done .s{background:#2e6a2a}
  #advBook .card .star{position:absolute;top:2px;left:6px;font-size:28px;filter:drop-shadow(0 0 6px rgba(255,200,60,.9))}
  #advBook .close{padding:10px 30px;border-radius:22px;border:3px solid #ffd76a;background:rgba(90,50,20,.85);color:#ffe9a8;font-size:22px;font-weight:bold;cursor:pointer;font-family:inherit}
  @media (max-aspect-ratio:1/1){#advBook .pages{padding:8px 10px;max-height:74vh;width:94vw;background:linear-gradient(#f8ecd0,#efe0bc)} #advBook .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px} #advBook .sec{font-size:20px}
    #advBook .card canvas{height:min(17vw,96px);object-fit:cover} #advBook .card{gap:3px;padding:6px 5px 8px} #advBook .card .t{font-size:17px} #advBook .card .s{font-size:15px} #advBook h2{font-size:26px}}
  #advIntro{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:38;display:none;width:min(680px,92vw);box-sizing:border-box;
    padding:16px 22px 14px;border-radius:22px;border:4px solid #b8862e;background:linear-gradient(#fbf1d6,#ecd9ae);color:#3a2410;direction:rtl;font-family:${FONT};
    box-shadow:0 10px 36px rgba(0,0,0,.55);text-align:center;touch-action:manipulation;cursor:pointer}
  #advIntro.on{display:block;animation:advIn .45s cubic-bezier(.3,1.6,.5,1)}
  @keyframes advIn{0%{transform:translateX(-50%) scale(.6);opacity:0}100%{transform:translateX(-50%) scale(1);opacity:1}}
  #advIntro .who{font-size:18px;font-weight:bold;color:#8a4a12} #advIntro .ln{font-size:25px;font-weight:bold;line-height:1.35;margin:6px 0 10px}
  #advIntro .nx{display:inline-block;padding:8px 26px;border-radius:20px;background:#7a3a12;color:#ffe9a8;font-size:21px;font-weight:bold}
  #advTrack{position:fixed;top:calc(8px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(660px,calc(100vw - 230px));z-index:15;display:none;direction:rtl;font-family:${FONT};
    box-sizing:border-box;padding:8px 12px 8px 64px;border-radius:20px;border:3px solid #ffd76a;background:rgba(40,22,10,.82);color:#fff6dc;box-shadow:0 4px 16px rgba(0,0,0,.45)}
  #advTrack.on{display:block}
  #advTrack .ln{font-size:24px;font-weight:bold;line-height:1.2;text-shadow:0 2px 0 #000;text-align:right}
  #advTrack .dots{margin-top:4px;font-size:15px;letter-spacing:3px;color:#ffd76a;text-align:right}
  #advTrack .dots b{color:#ffe9a8} #advTrack .dots i{font-style:normal;opacity:.45}
  #advTrack .pz{position:absolute;left:8px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:3px solid #ffd76a;background:rgba(90,50,20,.9);color:#fff;font-size:22px;
    display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;padding:0}
  #advTogether{position:fixed;left:50%;top:calc(110px + env(safe-area-inset-top));transform:translateX(-50%);z-index:15;display:none;padding:12px 34px;border-radius:30px;border:4px solid #fff;
    background:linear-gradient(#ffe48a,#ffb020);color:#4a2400;font:bold 30px ${FONT};direction:rtl;box-shadow:0 0 26px rgba(255,210,90,.9);cursor:pointer;touch-action:manipulation;animation:enterPulse 1.4s ease-in-out infinite}
  #advTogether.on{display:block}
  #advHint{position:fixed;left:50%;bottom:calc(132px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:13;display:none;max-width:min(560px,80vw);box-sizing:border-box;
    padding:10px 18px;border-radius:20px;border:3px solid #ffd76a;background:rgba(255,248,228,.97);color:#2a1a12;direction:rtl;font:bold 22px ${FONT};text-align:center;box-shadow:0 6px 22px rgba(0,0,0,.45);pointer-events:none}
  #advHint.on{display:block;animation:advIn .35s cubic-bezier(.3,1.6,.5,1)}
  #advHint .who{display:block;font-size:16px;color:#8a4a12}
  #advEdge{position:fixed;left:0;top:0;width:58px;height:58px;margin:-29px 0 0 -29px;z-index:12;display:none;pointer-events:none;border-radius:50%;
    background:radial-gradient(circle,rgba(255,226,120,.95),rgba(255,170,40,.85));border:3px solid #fff;box-shadow:0 0 18px rgba(255,210,90,.9);color:#5a2a00;font:bold 34px/52px Arial;text-align:center}
  #advEdge.on{display:block}
  #advAsk{position:fixed;inset:0;z-index:39;display:none;align-items:center;justify-content:center;background:rgba(12,6,2,.55);direction:rtl;font-family:${FONT}}
  #advAsk.on{display:flex}
  #advAsk .box{padding:20px 24px;border-radius:24px;border:4px solid #ffd76a;background:linear-gradient(#fbf1d6,#ecd9ae);color:#3a2410;text-align:center;max-width:88vw;box-sizing:border-box}
  #advAsk .q{font-size:27px;font-weight:bold;margin-bottom:6px} #advAsk .sub{font-size:18px;margin-bottom:14px}
  #advAsk button{margin:6px;padding:12px 26px;border-radius:22px;border:3px solid #b8862e;font:bold 23px ${FONT};cursor:pointer;touch-action:manipulation}
  #advAsk .stay{background:#2e6a2a;color:#fff} #advAsk .leave{background:#fff6dc;color:#5a3010}
  #advCard{position:fixed;inset:0;z-index:45;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(10,6,24,.6);direction:rtl;font-family:${FONT}}
  #advCard.on{display:flex} #advCard canvas{height:min(62vh,420px);width:auto;max-width:82vw;border-radius:18px;box-shadow:0 0 40px rgba(255,215,106,.85);animation:advSpin .6s cubic-bezier(.3,1.6,.5,1)}
  #advCard .t{margin-top:12px;font-size:min(5vh,7vw,30px);font-weight:bold;color:#ffe9a8;text-shadow:0 2px 0 #000;text-align:center;padding:0 10px}
  @keyframes advSpin{0%{transform:scale(.2) rotate(-200deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}
  #fcWheel .sp.advHint{animation:advPulse .8s ease-in-out infinite;border-color:#fff}
  #fcBtn.advHint{animation:advPulse .8s ease-in-out infinite}
  @keyframes advPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,230,120,.0)}50%{box-shadow:0 0 0 8px rgba(255,230,120,.85),0 0 30px rgba(255,220,100,.95)}}
  body.inAdv #time,body.inAdv #quest{display:none !important}
  body.modalOn #advBtn,body.inMatch #advBtn,body.inSpell #advBtn,body.inFloo #advBtn,body.modalOn #advTrack,body.inMatch #advTrack,body.inSpell #advTrack,body.inFloo #advTrack,
  body.modalOn #advTogether,body.modalOn #advEdge,body.modalOn #advHint,body.inMatch #advEdge,body.inSpell #advEdge{display:none !important}
  @media (max-width:700px){#advTrack{left:calc(96px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));width:auto;transform:none;padding:6px 10px 6px 56px}
    #advTrack .ln{font-size:19px} #advTrack .dots{font-size:13px;margin-top:2px} #advTrack .pz{width:42px;height:42px;font-size:19px;left:6px}
    #advTogether{top:calc(196px + env(safe-area-inset-top));font-size:26px;padding:10px 26px} #advHint{font-size:19px;bottom:auto;top:calc(270px + env(safe-area-inset-top));max-width:76vw}}`;
  document.head.appendChild(css);
  const el = (tag, id, cls, parent = document.body) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; parent.appendChild(e); return e; };
  const stop = (e) => e.stopPropagation();
  const guard = (node) => { for (const ev of ['pointerdown', 'touchstart', 'mousedown']) node.addEventListener(ev, stop, { passive: true }); };

  const btn = el('button', 'advBtn', 'gamebtn'); btn.textContent = '📖'; btn.setAttribute('aria-label', 'הרפתקאות'); guard(btn);
  btn.addEventListener('click', (e) => { e.stopPropagation(); openBook(); });
  if (!save.cur && !Object.keys(save.done).length) btn.classList.add('glint');

  // the book
  const book = el('div', 'advBook'); guard(book);
  el('h2', null, null, book).textContent = '📖 ספר ההרפתקאות';
  const pages = el('div', null, 'pages', book);
  const bookClose = el('button', null, 'close', book); bookClose.textContent = '✨ חזרה למשחק';
  bookClose.addEventListener('click', (e) => { e.stopPropagation(); closeBook(); });
  const cardEls = {};
  const grids = {};
  for (const [b, t] of Object.entries(BOOKS)) { const sec = el('div', null, 'sec', pages); sec.textContent = t; sec.dataset.book = b; grids[b] = el('div', null, 'grid', pages); grids[b].dataset.book = b; }
  for (const q of QUESTS) {
    const c = el('button', null, 'card', grids[q.book || 1] || grids[1]); c.dataset.id = q.id;
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 170; c.appendChild(cv);
    try { drawPicture(cv.getContext('2d'), q, 240, 170); } catch { /* picture optional */ }
    el('div', null, 't', c).textContent = q.title;
    el('div', null, 's', c); el('span', null, 'star', c);
    c.addEventListener('click', (e) => { e.stopPropagation(); pickCard(q.id); });
    cardEls[q.id] = c;
  }
  let bookOpen = false;
  function cardState(q) {
    if (q.soon) return 'soon';
    const i = QUESTS.indexOf(q), prev = QUESTS.slice(0, i).filter(p => !p.soon && (p.book || 1) === (q.book || 1));   // unlock in order inside each book
    if (prev.some(p => !save.done[p.id])) return 'locked';
    if (save.cur && save.cur.id === q.id) return 'resume';
    return save.done[q.id] ? 'done' : 'open';
  }
  function refreshBook() {
    for (const q of QUESTS) {
      const c = cardEls[q.id], st = cardState(q);
      c.classList.toggle('soon', st === 'soon' || st === 'locked'); c.classList.toggle('done', st === 'done');
      c.dataset.state = st;
      c.querySelector('.s').textContent = { soon: 'בקרוב', locked: '🔒', open: '▶ להתחיל', resume: '▶ להמשיך (' + (save.cur ? save.cur.step + 1 : 1) + '/' + (q.steps ? q.steps.length : 0) + ')', done: '⭐ לשחק שוב' }[st];
      c.querySelector('.star').textContent = save.done[q.id] ? '⭐' : '';
    }
    // a section's title gets a gold ⭐ when it has no stubs left and all its quests are done
    for (const sec of pages.querySelectorAll('.sec')) {
      const b = sec.dataset.book, qs = QUESTS.filter(q => String(q.book || 1) === b), all = qs.length && qs.every(q => !q.soon && save.done[q.id]);
      sec.textContent = BOOKS[b] + (all ? ' ⭐' : ''); sec.classList.toggle('gold', !!all);
    }
  }
  function openBook() {
    if (isModal() || isTakeover() || busyBody()) return false;
    refreshBook(); book.classList.add('on'); bookOpen = true; setModal(true); sfx('flip'); btn.classList.remove('glint'); return true;
  }
  function closeBook() { if (!bookOpen) return; book.classList.remove('on'); bookOpen = false; setModal(false); }
  function pickCard(id) {
    const q = BYID[id], st = cardState(q);
    if (st === 'soon' || st === 'locked') { sfx('soft'); return; }
    closeBook();
    if (run && run.q.id === id) { toastLine('📖', 'ממשיכים!'); return; }
    if (st === 'resume') resume(id); else start(id);
  }

  // intro card
  const intro = el('div', 'advIntro'); guard(intro);
  const introWho = el('div', null, 'who', intro), introLn = el('div', null, 'ln', intro), introNx = el('div', null, 'nx', intro);
  intro.addEventListener('click', (e) => { e.stopPropagation(); nextIntro(); });
  // tracker
  const track = el('div', 'advTrack'); guard(track);
  const trackLn = el('div', null, 'ln', track), trackDots = el('div', null, 'dots', track);
  const pz = el('button', null, 'pz', track); pz.textContent = '⏸'; pz.setAttribute('aria-label', 'לעצור');
  pz.addEventListener('click', (e) => { e.stopPropagation(); ask(); });
  const together = el('button', 'advTogether'); together.textContent = '🤝 ביחד!'; guard(together);
  together.addEventListener('click', (e) => { e.stopPropagation(); doTogether(); });
  const hintEl = el('div', 'advHint');
  const edge = el('div', 'advEdge'); edge.textContent = '➜';
  // ask (pause / leave)
  const askEl = el('div', 'advAsk'); guard(askEl);
  const askBox = el('div', null, 'box', askEl);
  el('div', null, 'q', askBox).textContent = 'לעצור את ההרפתקה?';
  el('div', null, 'sub', askBox).textContent = 'אפשר להמשיך מאותו מקום מתי שרוצים 📖';
  const stayB = el('button', null, 'stay', askBox); stayB.textContent = '▶ להמשיך';
  const leaveB = el('button', null, 'leave', askBox); leaveB.textContent = '⏸ לעצור';
  stayB.addEventListener('click', (e) => { e.stopPropagation(); askEl.classList.remove('on'); setModal(false); });
  leaveB.addEventListener('click', (e) => { e.stopPropagation(); askEl.classList.remove('on'); setModal(false); leave(); });
  function ask() { if (!run || isModal()) return; askEl.classList.add('on'); setModal(true); sfx('flip'); }
  // reward card
  const cardOv = el('div', 'advCard'); guard(cardOv);
  cardOv.addEventListener('click', (e) => { e.stopPropagation(); hideCard(); });
  let cardT = null;
  function showCard(q) {
    cardOv.innerHTML = ''; const cv = document.createElement('canvas'); cv.width = 300; cv.height = 420; cardOv.appendChild(cv);
    try { drawCard(cv.getContext('2d'), q); } catch { /* card art optional */ }
    el('div', null, 't', cardOv).textContent = '⭐ פרק חדש בספר! ' + q.title;
    cardOv.classList.add('on'); log.cards++; sfx('fanfare'); try { fun.confetti(q.confetti || ['✨', '⭐', '📖'], 22); } catch { /* ok */ }
    clearTimeout(cardT); cardT = setTimeout(hideCard, 4200);
  }
  function hideCard() { cardOv.classList.remove('on'); clearTimeout(cardT); }

  const busyBody = () => { const c = document.body.classList; return c.contains('inSpell') || c.contains('inMatch') || c.contains('inFloo'); };
  function toastLine(e, t, ms = 1800) { try { fun.toast(e, t, ms); } catch { /* ok */ } }

  // ---------------- run state ----------------
  let run = null;   // { q, scene, step, idle, stage, lv, intro, hold }
  // A takeover a quest scene starts itself with { adv: true } (the flying car) keeps hints, taps and the arrow alive.
  let advTk = null;
  const advSetTakeover = (o) => { advTk = o && o.adv ? o : null; setTakeover(o); };
  const tkBusy = () => { try { return isTakeover() && !(advTk && window.__game && window.__game.takeover === advTk); } catch { return isTakeover(); } };
  const ctx = {
    scene, camera, player, interiors, fun, freecast, emit, burst, speak, glowTex, setTakeover: advSetTakeover, isModal, isTakeover,
    poke: () => { if (run) run.idle = 0; },
    get level() { return run ? run.lv : 1; },
    get step() { return run ? run.step : -1; },
    done: (i) => completeStep(i),
    oops: (text) => { log.oops++; helperSay(text, true); sfx('soft'); },
    say: (text, who, sec) => helperSay(text, false, who, sec),
    screen: (v, out = { x: 0, y: 0, on: false }) => { _p.copy(v).project(camera); out.x = (_p.x * 0.5 + 0.5) * innerWidth; out.y = (-_p.y * 0.5 + 0.5) * innerHeight; out.on = _p.z < 1 && Math.abs(_p.x) <= 1.05 && Math.abs(_p.y) <= 1.05; return out; },
    routeTo,
  };
  function helperSay(text, isOops = false, who = null, sec = 4.5) {
    const h = run ? run.q.helper : { ico: '👧', name: 'הרמיוני' };
    hintEl.innerHTML = ''; const w = el('span', null, 'who', hintEl); w.textContent = who || (h.ico + ' ' + h.name);
    hintEl.appendChild(document.createTextNode(text));
    hintEl.classList.remove('on'); void hintEl.offsetWidth; hintEl.classList.add('on');
    hintT = sec; speak(text);
    if (isOops) log.lastOops = text;
    log.lastSay = text;
  }
  let hintT = 0;

  function start(id, lv) {
    const q = BYID[id]; if (!q || q.soon) return false;
    if (isModal() || isTakeover() || busyBody()) return false;
    if (run) end(false);
    const d = save.done[id];
    lv = Math.max(1, Math.min(3, lv || (d ? Math.min(3, (d.lv || 1) + 1) : 1)));
    if (!makeRun(q, 0, lv)) return false;
    save.cur = { id, step: 0, lv, paused: false }; persist(); log.starts++;
    run.intro = 0; showIntro();
    return true;
  }
  function resume(id) {
    const q = BYID[id]; if (!q || !save.cur || save.cur.id !== id) return false;
    if (isModal() || isTakeover() || busyBody()) return false;
    if (run) end(false);
    if (!makeRun(q, save.cur.step, save.cur.lv)) return false;
    save.cur.paused = false; persist();
    toastLine('📖', 'ממשיכים את ההרפתקה!');
    beginStep(true);
    return true;
  }
  function makeRun(q, step, lv) {
    let sc = null;
    try { sc = q.create(ctx); } catch (e) { console.warn('[adventures] scene failed -', e && e.message || e); log.errors++; return false; }
    run = { q, scene: sc, step, idle: 0, stage: 0, lv, intro: -1, hold: false };
    document.body.classList.add('inAdv');
    return true;
  }
  function showIntro() {
    const q = run.q; intro.classList.add('on'); setModal(true);
    introWho.textContent = '📖 ' + q.title; setIntroLine();
  }
  function setIntroLine() {
    const q = run.q, ln = q.intro[run.intro];
    introLn.textContent = ln; speak(ln);
    introNx.textContent = run.intro < q.intro.length - 1 ? 'הלאה ◀' : 'יוצאים לדרך! ✨';
  }
  function nextIntro() {
    if (!run || run.intro < 0) return;
    sfx('flip');
    if (run.intro < run.q.intro.length - 1) { run.intro++; setIntroLine(); return; }
    run.intro = -1; intro.classList.remove('on'); setModal(false);
    beginStep(false);
  }
  function beginStep(resumed) {
    if (!run) return;
    run.idle = 0; run.stage = 0; clearHints();
    try { run.scene.begin(run.step, resumed); } catch (e) { console.warn('[adventures] begin failed -', e && e.message || e); log.errors++; }
    refreshTrack();
  }
  function refreshTrack() {
    if (!run) { track.classList.remove('on'); return; }
    const st = run.q.steps[run.step];
    trackLn.textContent = st ? st.line : '';
    trackDots.innerHTML = run.q.steps.map((_, i) => i < run.step ? '<b>●</b>' : i === run.step ? '<b>◉</b>' : '<i>○</i>').join(' ');
    track.classList.toggle('on', run.intro < 0);
  }
  function clearHints() {
    together.classList.remove('on'); glow.visible = false;
    try { if (run) run.scene.glow(run.step, false); } catch { /* ok */ }
    for (const t of document.querySelectorAll('.advHint')) t.classList.remove('advHint');
  }
  function completeStep(i) {
    if (!run || i !== run.step) return false;
    clearHints();
    log.steps++; log.rewards++;
    const s = player.model.scale.y || 1;
    burst(player.pos.x, player.pos.y + 1.2 * s, player.pos.z, 0xffd76a, 26, 2.4, 1.1, 0.26, -1.2);
    burst(player.pos.x, player.pos.y + 1.6 * s, player.pos.z, 0xffffff, 10, 1.4, 0.7, 0.3, -0.5);
    try { window.HPLessons.progress.bonus(5); } catch { /* lessons not loaded */ }
    sfx('chime'); setTimeout(() => sfx('sparkle'), 180);
    toastLine('✨⭐', '+5 נקודות לבית!', 1600);
    run.step++;
    if (run.step >= run.q.steps.length) { setTimeout(() => finish(), 1400); save.cur = null; persist(); refreshTrack(); track.classList.remove('on'); return true; }
    save.cur = { id: run.q.id, step: run.step, lv: run.lv, paused: false }; persist();
    beginStep(false);
    return true;
  }
  function finish() {
    if (!run) return;
    const q = run.q, d = save.done[q.id];
    save.done[q.id] = { stars: 1, lv: Math.max(run.lv, d ? d.lv : 1), n: (d ? d.n : 0) + 1 };
    save.cur = null; persist(); log.finishes++;
    showCard(q);
    if (q.bonus && !d) {   // a quest's extra house points, the first time only (once per save)
      try { window.HPLessons.progress.bonus(q.bonus); } catch { /* lessons not loaded */ }
      log.bonus = (log.bonus || 0) + q.bonus;
      setTimeout(() => { try { fun.toast('🏆', '+' + q.bonus + ' נקודות לבית!', 2600); } catch { /* ok */ } }, 7200);
    }
    try { window.HPLessons.progress.bonus(10); } catch { /* lessons not loaded */ }
    setTimeout(() => { try { fun.toast('📖⭐', 'כוכב בספר ההרפתקאות!', 2600); } catch { /* ok */ } }, 4400);
    end(true);
  }
  function leave() {
    if (!run) return;
    save.cur = { id: run.q.id, step: run.step, lv: run.lv, paused: true }; persist();
    end(false);
    toastLine('📖', 'ההרפתקה מחכה לך בספר', 2000);
  }
  function end(finished) {
    if (!run) return;
    clearHints();
    try { run.scene.end(finished); } catch (e) { console.warn('[adventures] end failed -', e && e.message || e); }
    run = null; arrow.visible = false; glow.visible = false; edge.classList.remove('on'); hintEl.classList.remove('on');
    intro.classList.remove('on'); track.classList.remove('on'); document.body.classList.remove('inAdv');
  }
  function doTogether() {
    if (!run) return;
    together.classList.remove('on'); log.togethers++;
    helperSay('ביחד! 🤝', false, null, 2.5);
    try { run.scene.together(run.step); } catch (e) { console.warn('[adventures] together failed -', e && e.message || e); completeStep(run.step); }
  }
  function setStage(n) {
    if (!run) return;
    const st = run.q.steps[run.step]; if (!st) return;
    run.stage = n; log.hints.push(run.step + ':' + n);
    let own = null; try { own = run.scene.hintText ? run.scene.hintText(run.step, n) : null; } catch { own = null; }   // a scene may word a hint itself (levels 2-3)
    if (own && n < 4) { if (n === 2) { try { run.scene.glow(run.step, true); } catch { /* ok */ } } if (n === 3 && st.spell) { const t = document.querySelector('#fcWheel .sp[data-k="' + st.spell + '"]'); if (t) t.classList.add('advHint'); const b = document.getElementById('fcBtn'); if (b) b.classList.add('advHint'); } helperSay(own); return; }
    if (n === 1) helperSay((st.hints && st.hints[0]) || st.line);
    else if (n === 2) { try { run.scene.glow(run.step, true); } catch { /* ok */ } helperSay((st.hints && st.hints[1]) || 'תראה מה זוהר! ✨'); }
    else if (n === 3) {
      if (st.spell) {
        const t = document.querySelector('#fcWheel .sp[data-k="' + st.spell + '"]'); if (t) t.classList.add('advHint');
        const b = document.getElementById('fcBtn'); if (b) b.classList.add('advHint');
        helperSay((st.hints && st.hints[2]) || 'בחר את הלחש הזוהר בגלגל הלחשים 🪄');
      } else helperSay((st.hints && st.hints[2]) || (st.hints && st.hints[1]) || st.line);
    } else if (n === 4) { together.classList.add('on'); helperSay('רוצה שנעשה את זה ביחד? 🤝'); }
  }

  // ---------------- the goal: arrow, trail, edge chevron ----------------
  const goalV = new Vector3(), tmpV = new Vector3(), scr = { x: 0, y: 0, on: false };
  // Another room: the door (portal) of the current room that leads toward `room` (or the castle's front doors outside).
  function routeTo(room, out, via = ['staircase', 'entrancehall']) {
    if (interiors.active === room) return null;
    if (!interiors.active) return out.set(DOOR.x, player.pos.y, DOOR.enterZ - 1.5);
    const r = interiors.room, ps = (r && r.portals) || [], Y = r && r.group ? r.group.position.y : -200;
    const pick = ps.find(p => p.to === room) || via.map(v => ps.find(p => p.to === v)).find(Boolean) || ps.find(p => p.to === 'out');
    if (!pick) return null;
    return out.set(pick.x, Y, pick.z);
  }
  let trailT = 0, T = 0;
  function tickGoal(dt, busy) {
    let g = null;
    if (run && run.intro < 0 && !busy) { try { g = run.scene.goal(run.step, goalV); } catch { g = null; } }
    if (!g) { arrow.visible = false; edge.classList.remove('on'); glow.visible = false; return; }
    const big = run.lv === 1 ? 1.25 : 1;
    arrow.visible = true; arrow.position.set(g.x, g.y + 1.25 + Math.sin(T * 3) * 0.15, g.z); arrow.rotation.y = T * 1.5; arrow.scale.setScalar(big);
    if (run.stage >= 2 || (run.lv === 1 && run.q.steps[run.step] && run.q.steps[run.step].glowL1)) {
      glow.visible = true; glow.position.set(g.x, g.y + 0.5, g.z); glow.quaternion.copy(camera.quaternion);
      glow.scale.setScalar((run.lv === 1 ? 2.2 : 1.5) * (1 + Math.sin(T * 5) * 0.12));
    } else glow.visible = false;
    // the trail: sparkles from Harry's feet toward the goal, a few metres ahead
    trailT -= dt;
    const dx = g.x - player.pos.x, dz = g.z - player.pos.z, d = Math.hypot(dx, dz);
    if (trailT <= 0 && d > 1.6) {
      trailT = run.lv === 1 ? 0.09 : 0.16;
      const k = Math.min(1, (0.8 + Math.random() * Math.min(5, d - 1)) / d);
      emit(player.pos.x + dx * k + (Math.random() - 0.5) * 0.2, player.pos.y + 0.15 + Math.random() * 0.2, player.pos.z + dz * k + (Math.random() - 0.5) * 0.2, dx / d * 0.3, 0.25, dz / d * 0.3, 0.9, 0.2, 0xffe07a, 0);
    }
    // the edge chevron when the goal is off screen
    ctx.screen(tmpV.set(g.x, g.y + 1, g.z), scr);
    if (scr.on) { edge.classList.remove('on'); return; }
    _p.copy(tmpV).applyMatrix4(camera.matrixWorldInverse);   // camera space: behind the lens flips
    let sx = _p.x, sy = _p.y; if (_p.z > 0) { sx = -sx; sy = -sy; }
    const ang = Math.atan2(-sy, sx), W = innerWidth, H = innerHeight, m = 40;
    const cx = W / 2, cy = H / 2, c = Math.cos(ang), s = Math.sin(ang);
    const kx = c ? (W / 2 - m) / Math.abs(c) : 1e9, ky = s ? (H / 2 - m - 40) / Math.abs(s) : 1e9, k = Math.min(kx, ky);
    edge.style.left = (cx + c * k).toFixed(0) + 'px'; edge.style.top = (cy + s * k).toFixed(0) + 'px';
    edge.style.transform = 'rotate(' + (ang * 180 / Math.PI).toFixed(0) + 'deg)';
    edge.classList.add('on');
  }

  // ---------------- taps on the world (the canvas only; a drag is not a tap) ----------------
  const view = document.getElementById('view');
  let down = null;
  if (view) {
    view.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; }, { passive: true });
    view.addEventListener('pointerup', (e) => {
      const d0 = down; down = null;
      if (!d0 || d0.id !== e.pointerId || !run || run.intro >= 0 || isModal() || tkBusy()) return;
      if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 18 || performance.now() - d0.t > 900) return;
      log.taps++;
      try { run.scene.tap(e.clientX, e.clientY, run.step); } catch (er) { console.warn('[adventures] tap failed -', er && er.message || er); }
    }, { passive: true });
  }

  // ---------------- per frame ----------------
  let resumeAt = save.cur && !save.cur.paused ? 2.5 : -1;   // a quest that was running when the page closed resumes by itself
  function update(dt, inside) {
    T += dt;
    if (resumeAt > 0) { resumeAt -= dt; if (resumeAt <= 0) { if (save.cur && !save.cur.paused && !run) { if (!resume(save.cur.id)) resumeAt = 1.5; } } }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) hintEl.classList.remove('on'); }
    const busy = isModal() || tkBusy() || busyBody();
    if (run) {
      try { run.scene.update(dt, run.step, busy); } catch (e) { if (!log.updErr) console.warn('[adventures] scene update failed -', e && e.message || e); log.updErr = (log.updErr || 0) + 1; }
      if (run && run.intro < 0 && !busy && !run.hold) {
        run.idle += dt;
        const th = HINT_T[run.lv] || HINT_T[1];
        if (run.stage < 4 && run.idle >= th[run.stage]) setStage(run.stage + 1);
      }
    }
    tickGoal(dt, busy);
    tickParticles(dt);
  }

  const api = {
    list: () => QUESTS.map(q => ({ id: q.id, book: q.book || 1, title: q.title, soon: !!q.soon, steps: q.steps ? q.steps.length : 0, state: cardState(q), stars: save.done[q.id] ? save.done[q.id].stars : 0 })),
    state: () => ({
      quest: run ? run.q.id : null, step: run ? run.step : null, stage: run ? run.stage : null, level: run ? run.lv : null, idle: run ? +run.idle.toFixed(2) : null,
      intro: run ? run.intro : -1, line: run && run.q.steps[run.step] ? run.q.steps[run.step].line : null, book: bookOpen, save: JSON.parse(JSON.stringify(save)),
      arrow: arrow.visible ? { x: +arrow.position.x.toFixed(2), y: +arrow.position.y.toFixed(2), z: +arrow.position.z.toFixed(2) } : null, edge: edge.classList.contains('on'),
      together: together.classList.contains('on'), hint: hintEl.classList.contains('on') ? hintEl.textContent : null, particles: alive,
      scene: run ? (() => { try { return run.scene.state(); } catch { return null; } })() : null, ...log, hints: log.hints.slice(), spoken: log.spoken.slice(),
    }),
    start: (id = 'stone', lv) => start(id, lv),
    resume: (id = 'stone') => resume(id),
    open: openBook, close: closeBook,
    intro: () => { if (run && run.intro >= 0) { nextIntro(); return true; } return false; },
    skipIntro: () => { if (!run || run.intro < 0) return false; run.intro = run.q.intro.length - 1; nextIntro(); return true; },
    skipStep: () => { if (!run || run.intro >= 0) return false; const i = run.step; try { run.scene.together(i, true); } catch { completeStep(i); } return true; },
    hint: (n) => { if (!run) return false; for (let k = run.stage + 1; k <= Math.min(4, n); k++) setStage(k); return run.stage; },
    clock: (s) => { if (run) run.idle += s; return run ? run.idle : null; },
    hold: (on = true) => { if (run) run.hold = !!on; return run ? run.hold : null; },
    together: doTogether, ask, leave,
    reset: () => { end(false); save.done = {}; save.cur = null; persist(); resumeAt = -1; return true; },
    _ctx: ctx,
  };
  if (debug) window.__adv = api;
  return { update, api };
}

// ---------------- canvas art: chapter pictures + the reward card ----------------
function rtl(x, s, cx, cy, size, col, maxW) {
  x.save(); x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${size}px ${FONT}`;
  const m = x.measureText(s).width; if (m > maxW) { x.translate(cx, cy); x.scale(maxW / m, 1); x.translate(-cx, -cy); }
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillText(s, cx + 2, cy + 2); x.fillStyle = col; x.fillText(s, cx, cy); x.restore();
}
function emo(x, e, cx, cy, size) { x.save(); x.font = `${size}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, cx, cy); x.restore(); }
function drawPicture(x, q, w, h) {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, q.col2 || '#c48a3a'); g.addColorStop(1, q.col || '#5a2a10');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = x.createRadialGradient(w / 2, h * 0.55, 6, w / 2, h * 0.55, w * 0.55); r.addColorStop(0, 'rgba(255,240,190,.55)'); r.addColorStop(1, 'rgba(255,240,190,0)');
  x.fillStyle = r; x.fillRect(0, 0, w, h);
  if (q.pic) for (const [e, px, py, s] of q.pic) emo(x, e, px * w, py * h, s);
  else emo(x, q.ico || '📖', w / 2, h * 0.55, 80);
  if (q.soon) { x.fillStyle = 'rgba(40,30,20,.35)'; x.fillRect(0, 0, w, h); }
}
function drawCard(x, q) {
  x.fillStyle = '#c9a046'; x.beginPath(); x.roundRect(0, 0, 300, 420, 26); x.fill();
  x.fillStyle = '#8a6420'; x.beginPath(); x.roundRect(8, 8, 284, 404, 20); x.fill();
  const g = x.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, q.col2 || '#c48a3a'); g.addColorStop(1, q.col || '#5a2a10');
  x.fillStyle = g; x.beginPath(); x.roundRect(14, 14, 272, 392, 16); x.fill();
  x.save(); x.beginPath(); x.ellipse(150, 165, 104, 124, 0, 0, 7); x.fillStyle = '#f6ecd0'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#e8c060'; x.stroke(); x.clip();
  const rg = x.createRadialGradient(150, 150, 10, 150, 165, 130); rg.addColorStop(0, '#fff8e4'); rg.addColorStop(1, '#e6d2a4'); x.fillStyle = rg; x.fillRect(40, 30, 220, 270);
  if (q.gem) {   // a red stone drawn in canvas (the emoji gem is blue)
    const gg = x.createRadialGradient(150, 160, 4, 150, 172, 70); gg.addColorStop(0, 'rgba(255,140,140,.95)'); gg.addColorStop(1, 'rgba(255,60,60,0)'); x.fillStyle = gg; x.fillRect(60, 80, 180, 190);
    const P = [[150, 102], [204, 150], [180, 236], [120, 236], [96, 150]]; x.fillStyle = q.gem; x.beginPath(); P.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(150, 102); x.lineTo(204, 150); x.lineTo(150, 160); x.lineTo(96, 150); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(120,0,10,.6)'; x.lineWidth = 3; x.beginPath(); x.moveTo(150, 160); x.lineTo(180, 236); x.moveTo(150, 160); x.lineTo(120, 236); x.stroke();
  } else if (q.art) { try { q.art(x, 150, 170); } catch { emo(x, q.ico || '📖', 150, 172, 120); } }   // a quest may paint its own card picture
  else emo(x, q.ico || '📖', 150, 172, 120);
  x.restore();
  for (const [sx, sy] of [[34, 34], [266, 34], [34, 300], [266, 300]]) { x.fillStyle = '#ffe9a0'; x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 4 : 10; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.fill(); }
  x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.roundRect(28, 310, 244, 84, 14); x.fill();
  rtl(x, q.title, 150, 342, 36, '#fff2c0', 230);
  rtl(x, '⭐ פרק בספר ההרפתקאות', 150, 378, 18, '#ffe08a', 230);
}
