// Book 3, adventure 4: "אקספקטו פטרונום" (helper Hermione, Tonks in bubbles). Data for adventures.js + the scene code.
// Decisions: briefs/2026-11-26-book3-piece-b.md. The Patronus is the existing free-cast stag (freecast.js), steered by
// its small exported hook (patronusRunTo / SP.patronum.runTo). Kid-safe: the grey shadows are small soft faceless smoke
// wisps (pale grey, a faint silver edge, no face, no hood, no hands) that drift slowly and NEVER come near Harry or the
// camera (the practice one stays at the wardrobe's stage, 4.8 m away behind a collider; the lake ones 12 m+ out over the
// water); a Patronus melts them into silver sparkles. The scenes are bright (a sunny classroom, a gold-silver dusk lake).
// Steps: 1 go to the Defence corner (classrooms): Tonks explains: think of a happy memory -> 2 pick a happy memory: three
// picture cards (flying, friends, a birthday cake), any one is right -> 3 practice: ONE grey wisp floats out of the
// wardrobe; Expecto Patronum (wheel, or the 🦌 prompt) and the stag trots to it: it fades like mist -> 4 the lake ('b3lake',
// entered with a fade): 3 / 4 / 5 wisps drift far over the water; cast: the stag runs across the water to one and it melts
// (level 1: the stag aims itself; levels 2-3: tap a shadow to send the stag) -> 5 the lake glows silver, fireflies; tap the
// lake: Tonks: "זה היה פטרונוס אמיתי!"; reward.
// Free play: the map card "האגם בערב 🦌" -> 'b3lake' in a free state: wisps drift in now and then, a Patronum cast (or 🦌)
// sends the stag to melt the nearest one (+5 once per session), a 🏠 button back. The real grounds stay shadow-free.
import { Vector3, Matrix4 } from 'three';
import { BUILDERS, FLOOR_Y } from './rooms.js';
import { buildWardrobe, disposeWardrobe, SPOT, WARD, STAGE, STAGE_D } from './adventure-b3-boggart-build.js';
import { roomLight } from './adventure-b3-map-build.js';
import { buildLake, buildWisps, drawWisps, drawMemory, triCount, drawCount, LAKE, LSPAWN } from './adventure-b3-patronus-build.js';

const HERM = { ico: '👧', name: 'הרמיוני' };
const TONKS_WHO = '🩷 טונקס';
const NWISPS = { 1: 3, 2: 4, 3: 5 };
const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew','Heebo',Arial,sans-serif";
export const B3PATRONUS = {
  id: 'b3-patronus', book: 3, title: 'אקספקטו פטרונום', ico: '🦌', col: '#1a2a4a', col2: '#9ab8e8', helper: HERM, confetti: ['✨', '🦌', '🌙', '💙'],
  pic: [['🦌', 0.5, 0.56, 66], ['✨', 0.2, 0.3, 30], ['🌙', 0.8, 0.28, 28]],
  intro: [
    'טונקס רוצה ללמד אותך את הלחש הכי מיוחד: אקספקטו פטרונום 🦌',
    'ליד האגם מרחפים צללים אפורים, כמו ערפל עצוב. הם לא אוהבים אור!',
    'פטרונוס הוא אור כסוף ושמח שמגרש אותם, כמו מנורה שמגרשת צללים. בוא ננסה ✨',
  ],
  steps: [
    { line: 'לך לפינת ההגנה בכיתות הלימוד 🏫', hints: ['טונקס מחכה בכיתות הלימוד, בפינת ההגנה 🩷', 'לך אחרי החץ הזהוב', 'הפינה עם הארון הגדול, ליד טונקס 🚪'], glowL1: true },
    { line: 'בחר זיכרון שמח 💛', hints: ['כל אחד מהזיכרונות הוא נכון! גע באחד 💛', 'גע בתמונה שהכי משמחת אותך', 'איזה זיכרון שמח בוחרים? גע בו!'] },
    { line: 'הטל אקספקטו פטרונום על הצל האפור 🦌', hints: ['הצל האפור יצא מהארון. הטל אקספקטו פטרונום! 🦌', 'בחר אקספקטו פטרונום בגלגל הלחשים, או גע בכפתור 🦌', 'הלחש הזוהר בגלגל: אקספקטו פטרונום 🦌'], spell: 'patronum', glowL1: true },
    { line: 'גרש את הצללים האפורים מעל האגם 🦌', hints: ['הטל אקספקטו פטרונום, והאייל ירוץ על המים! 🦌', 'גע בכפתור 🦌 או בחר אקספקטו פטרונום בגלגל', 'הלחש הזוהר בגלגל: אקספקטו פטרונום 🦌'], spell: 'patronum', glowL1: true },
    { line: 'האגם זוהר בכסף! גע באגם 🌙', hints: ['גע באגם הזוהר 🌙', 'גע איפה שתרצה על המים ✨', 'עוד נגיעה אחת - וסיימנו! ⭐'], glowL1: true },
  ],
  create: (ctx) => patScene(ctx),
  art: drawPatCard,
};
function drawPatCard(x, cx, cy) {
  const g = x.createLinearGradient(0, cy - 140, 0, cy + 130); g.addColorStop(0, '#7a88c8'); g.addColorStop(0.55, '#e8b0a0'); g.addColorStop(1, '#5a7ab0'); x.fillStyle = g; x.fillRect(cx - 120, cy - 150, 240, 290);
  x.fillStyle = '#f6f2e6'; x.beginPath(); x.arc(cx + 70, cy - 100, 16, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,255,255,.45)'; for (let i = 0; i < 8; i++) x.fillRect(cx - 30 + (i % 3) * 8, cy + 60 + i * 9, 50 - i * 4, 2);
  x.save(); x.translate(cx - 6, cy + 10); x.shadowColor = '#bfe4ff'; x.shadowBlur = 24; x.fillStyle = 'rgba(210,236,255,.95)';
  x.beginPath(); x.ellipse(0, 0, 46, 22, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(40, -30, 12, 26, 0.5, 0, 7); x.fill(); x.beginPath(); x.ellipse(50, -58, 14, 10, 0.3, 0, 7); x.fill();
  x.strokeStyle = 'rgba(210,236,255,.95)'; x.lineWidth = 6; x.lineCap = 'round'; for (const [a, b, c, d] of [[-30, 14, -50, 46], [-20, 14, -10, 48], [24, 14, 40, 44], [32, 12, 60, 34]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }
  x.lineWidth = 3; for (const [a, b, c, d] of [[46, -66, 34, -96], [40, -84, 24, -92], [54, -66, 70, -94], [62, -82, 78, -86]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }
  x.restore();
  x.save(); x.font = '26px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('✨', cx - 84, cy - 96); x.fillText('✨', cx + 90, cy + 40); x.restore();
}

// ---------------- the lake scene (always registered) + shared state ----------------
const LK = { B: null, room: null, wisps: [], silver: 0, mode: null, T: 0, paid: false, melted: 0, err: 0, flies: 0 };
const fi = () => { try { return window.__game.freecast._internal; } catch { return null; } };
const fxBurst = (...a) => { try { const f = fi(); if (f && f.burst) f.burst(...a); } catch { /* ok */ } };
const fxEmit = (...a) => { try { const f = fi(); if (f && f.emit) f.emit(...a); } catch { /* ok */ } };
const sfx = (k, ...a) => { try { const s = window.HPFun && window.HPFun.sfx; if (s && s[k]) s[k](...a); } catch { /* no audio */ } };
const _v = new Vector3(), _base = new Vector3();
BUILDERS.b3lake = () => {
  const B = buildLake(); const g = B.g; g.position.y = FLOOR_Y; g.userData.lake = B;
  B.L = roomLight(g, { amb: 1.0, ambC: 0xffe6c8, hemi: 1.15, sky: 0xd8d0ff, ground: 0xb89a70, fogC: 0xe8c4a0, fogD: 0.0022, bg: 0xe8c0a0 });
  const marker = g.children.find(o => o.name === 'b3-light'); if (marker) { const r0 = marker.userData.onTeardown; marker.userData.onTeardown = () => { r0(); if (LK.B === B) { LK.B = null; LK.room = null; } }; }
  LK.B = B; LK.silver = 0; LK.wisps = [];
  B.tris = triCount(g);
  const room = { group: g, colliders: B.cols, portals: [], spawn: { x: LSPAWN.x, z: LSPAWN.z, y: FLOOR_Y, yaw: LSPAWN.yaw }, update(dt) { try { lakeTick(B, dt); } catch (e) { if (!LK.err++) console.warn('[b3-patronus] lake tick failed -', e && e.message || e); } } };
  LK.room = room;
  return room;
};
function lakeTick(B, dt) {
  B.L.apply();
  LK.T += dt; const T = LK.T, cam = window.__game.camera, pl = window.__game.player.pos;
  B.shimMat.map.offset.y = (T * 0.03) % 1;
  const s = LK.silver;   // the finale: the gold sun path turns silver and the water a little paler
  B.shimMat.color.setRGB(1, 0.85 + 0.15 * s, 0.63 + 0.37 * s); B.shimMat.opacity = 0.7 + 0.25 * s; B.waterMat.color.setRGB(1 - 0.08 * s, 1 - 0.02 * s, 1);
  // the lantern glow cards face the camera
  for (let i = 0; i < 2; i++) { _v.set(i ? 1.15 : -1.15, 2.1, -7.4); const k = 1.3 + Math.sin(T * 6 + i) * 0.08; _m4.compose(_v, cam.quaternion, _sc.set(k, k, k)); B.glows.setMatrixAt(i, _m4); }
  B.glows.instanceMatrix.needsUpdate = true;
  // the wisps drift slowly sideways far out over the water; they never come nearer than 12 m (they drift away instead)
  for (const w of LK.wisps) {
    if (!w.alive) continue;
    w.age = (w.age || 0) + dt;
    if (w.melt > 0) { w.melt += dt / 1.3; if (Math.random() < dt * 30) fxEmit(B.g.position.x + w.x + (Math.random() - 0.5) * 1.2, B.g.position.y + w.y + Math.random() * 1.8, w.z + (Math.random() - 0.5) * 0.6, 0, 0.6, 0, 1.0, 0.26, Math.random() < 0.5 ? 0xffffff : 0xcfe8ff, -0.1); if (w.melt >= 1) { w.alive = false; LK.melted++; } continue; }
    const X = xMax() + 0.6; w.x += Math.sin(T * 0.25 + w.ph) * 0.35 * dt; w.x = Math.max(-X, Math.min(X, w.x));
    const dx = w.x - pl.x, dz = w.z - pl.z, d = Math.hypot(dx, dz);
    if (d < 12.5 && d > 0.01) { const k = (12.5 - d) / d; w.x += dx * k * Math.min(1, dt * 2); w.z += dz * k * Math.min(1, dt * 2); }
  }
  _base.set(0, 0, 0);   // (the wisp mesh is a child of the lake group: local coordinates)
  drawWisps(B.W, LK.wisps, cam, _base, T);
  // the silver finale: fireflies over the water and the reeds
  if (LK.silver > 0 && Math.random() < dt * 14) { LK.flies++; fxEmit((Math.random() - 0.5) * 18, B.g.position.y + 0.2 + Math.random() * 1.6, -2 - Math.random() * 14, (Math.random() - 0.5) * 0.3, 0.15, (Math.random() - 0.5) * 0.3, 2.2, 0.16, Math.random() < 0.5 ? 0xfff2a0 : 0xd8f0ff, 0); }
}
const _m4 = new Matrix4();
const _sc = new Vector3(1, 1, 1);
// a narrow phone sees a narrow slice of the lake: the shadows spread less there (so every one stays on screen)
const xMax = () => (innerWidth / Math.max(1, innerHeight) < 0.8 ? 3.0 : 6.5);
function spawnWisp(i, n) {
  const span = n > 1 ? (i / (n - 1)) * 2 - 1 : 0, X = xMax();
  return { x: span * X + (Math.random() - 0.5) * (X / 5), y: LAKE.water + 1.6 + Math.random() * 0.9, z: -21 - Math.random() * 9, s: 1.25 + Math.random() * 0.35, ph: Math.random() * 6, alive: true, melt: 0, age: 0, i };
}
const lakeWorld = (w, out = new Vector3(), dy = 1.0) => out.set(w.x, FLOOR_Y + w.y + dy * w.s, w.z);
function nearestWisp() {
  let best = null, bd = 1e9; const p = window.__game.player.pos;
  for (const w of LK.wisps) { if (!w.alive || w.melt > 0 || w.targeted) continue; const d = Math.hypot(w.x - p.x, w.z - p.z); if (d < bd) { bd = d; best = w; } }
  return best;
}
// send the stag (already cast) running over the water to this wisp; it melts on arrival
function sendStag(w, onMelt) {
  const f = fi(); if (!f || !f.SP || !f.SP.patronum || !f.SP.patronum.runTo || !w) return false;
  const p = _v.set(w.x, FLOOR_Y + LAKE.water + 0.05, w.z), d = Math.hypot(w.x - window.__game.player.pos.x, w.z - window.__game.player.pos.z);
  const ok = f.SP.patronum.runTo(p, () => { meltWisp(w); if (onMelt) onMelt(w); }, Math.max(1.4, d / 9));
  if (ok) w.targeted = true;
  return ok;
}
function meltWisp(w) {
  if (!w.alive || w.melt > 0) return;
  w.melt = 0.001; lakeWorld(w, _v, 0.9);
  fxBurst(_v.x, _v.y, _v.z, 0xe8f6ff, 30, 2.6, 1.1, 0.3, -0.3); fxBurst(_v.x, _v.y, _v.z, 0xfff2b0, 12, 1.8, 0.9, 0.24, -0.2);
  sfx('sparkle'); sfx('chime'); try { window.HPFun.sfx.noise(0.5, 0.05, 0, 900, 0.5); } catch { /* a soft whoosh */ }
}
function untarget() { for (const w of LK.wisps) if (w.alive && !(w.melt > 0)) w.targeted = false; }
const stagState = () => { try { return fi().SP.patronum.state(); } catch { return null; } };
const castStag = () => { try { const f = fi(); f.SP.patronum.cast(); return true; } catch { return false; } };   // the 🦌 prompt: the same stag as the wheel

// a soft gold fade when entering the lake
function fadeIn() {
  let d = document.getElementById('b3fade');
  if (!d) { d = document.createElement('div'); d.id = 'b3fade'; d.style.cssText = 'position:fixed;inset:0;z-index:30;pointer-events:none;background:radial-gradient(ellipse at 50% 60%,#fff2d0,#e8c0a0);opacity:0;transition:opacity .6s'; document.body.appendChild(d); }
  d.style.transition = 'none'; d.style.opacity = '1'; void d.offsetWidth; d.style.transition = 'opacity 1.1s'; setTimeout(() => { d.style.opacity = '0'; }, 250);
}

// ---------------- the quest scene ----------------
function patScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit } = ctx;
  const S = { active: false, done: {}, inited: false, N: 3, ward: null, wardRoom: null, prac: null, pracW: null, mem: null, picked: -1, casts0: 0, pat0: 0, assist: false, assistT: 0, glowHint: false,
    reframe: null, sel: null, wrong: 0, finT: 0, t: 0, sent: 0, entering: false, list: [] };
  const lv = () => ctx.level;
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const inRoom = (id) => interiors.active === id && interiors.room && interiors.room.group;
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3();
  const FI = freecast && freecast._internal;
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  const pats = () => { const s = stagState(); return s ? s.casts : 0; };
  S.casts0 = casts(); S.pat0 = pats();
  const Y = () => (interiors.room && interiors.room.group ? interiors.room.group.position.y : FLOOR_Y);
  const css = document.createElement('style'); css.id = 'b3patCss';
  css.textContent = `#b3mem{position:fixed;left:0;right:0;bottom:0;top:calc(92px + env(safe-area-inset-top));z-index:14;display:none;align-items:center;justify-content:center;flex-direction:column;gap:10px;direction:rtl;font-family:${FONT};background:rgba(30,30,60,.45)}
  #b3mem.on{display:flex} #b3mem .hd{font-size:26px;font-weight:bold;color:#fff6dc;text-shadow:0 2px 0 #000}
  #b3mem .row{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:96vw}
  #b3mem button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px;border-radius:18px;border:4px solid #ffd76a;background:#fff8e8;color:#3a2410;font:bold 21px ${FONT};cursor:pointer;touch-action:manipulation;box-shadow:0 6px 18px rgba(0,0,0,.4)}
  #b3mem button canvas{width:min(220px,40vw);height:auto;border-radius:12px;display:block}
  #b3mem button.pick{animation:b3pick 1s ease-in-out infinite;border-color:#fff} #b3mem.glow button{animation:b3pick 1.4s ease-in-out infinite}
  @keyframes b3pick{0%,100%{box-shadow:0 0 0 rgba(255,220,120,0)}50%{box-shadow:0 0 26px 8px rgba(255,220,120,.95)}}
  @media (max-width:700px){#b3mem{top:calc(104px + env(safe-area-inset-top))} #b3mem button canvas{width:38vw} #b3mem button{font-size:17px;padding:6px} #b3mem .hd{font-size:21px}}
  @media (min-width:701px){body.inAdv:has(#funPrompt.on) #advHint{bottom:calc(236px + env(safe-area-inset-bottom))}}`;
  document.head.appendChild(css);

  // ---- the practice wardrobe + ONE wisp (classrooms, only while the quest needs them; the free-play wardrobe hides in adventures) ----
  function wardTick(dt) {
    const want = S.active && ctx.step <= 2 && inRoom('classrooms');
    if (want && (!S.ward || S.wardRoom !== interiors.room)) {
      dropWard(); const W = buildWardrobe(); W.door = 0; interiors.room.group.add(W.g); S.ward = W; S.wardRoom = interiors.room;
      const P = buildWisps(1); P.mesh.name = 'b3-wisp-practice'; interiors.room.group.add(P.mesh); S.pracW = P;
    } else if (!want && S.ward) dropWard();
    if (!S.ward) return;
    const W = S.ward, out = S.prac && S.prac.alive && ctx.step === 2;
    W.door += ((out ? 1 : 0) - W.door) * Math.min(1, dt * 3);
    W.doorL.rotation.y = -W.door * 1.2; W.doorR.rotation.y = W.door * 1.2;
    S.list.length = 0; if (S.prac && ctx.step === 2) S.list.push(S.prac);
    if (S.prac && S.prac.alive) {
      S.prac.age += dt;
      const k = Math.min(1, S.prac.age / 1.6);   // floats out of the wardrobe to the stage, then stays there
      S.prac.x = WARD.x + Math.sin(WARD.yaw) * STAGE_D * k; S.prac.z = WARD.z + Math.cos(WARD.yaw) * STAGE_D * k;
      if (S.prac.melt > 0) { S.prac.melt += dt / 1.3; pracW(v1, 0.9); if (Math.random() < dt * 30) emit(v1.x + (Math.random() - 0.5), v1.y + Math.random() * 1.2, v1.z + (Math.random() - 0.5), 0, 0.6, 0, 1.0, 0.24, 0xe8f6ff, -0.1); if (S.prac.melt >= 1) S.prac.alive = false; }
    }
    _base.set(0, 0, 0);
    drawWisps(S.pracW, S.list, ctx.camera, _base, S.t);
  }
  function dropWard() {
    if (S.ward) { try { disposeWardrobe(S.ward); } catch { /* ok */ } }
    if (S.pracW) { if (S.pracW.mesh.parent) S.pracW.mesh.parent.remove(S.pracW.mesh); try { S.pracW.mesh.geometry.dispose(); } catch { /* ok */ } }
    S.ward = null; S.wardRoom = null; S.pracW = null;
  }
  const pracW = (out = new Vector3(), dy = 0.9) => out.set(S.prac ? S.prac.x : STAGE.x, Y() + (S.prac ? S.prac.y : 0.5) + dy * (S.prac ? S.prac.s : 1), S.prac ? S.prac.z : STAGE.z);
  function practiceSend() {
    const f = FI; if (!f || !f.SP.patronum.runTo || !S.prac || !S.prac.alive || S.prac.melt > 0 || S.prac.targeted) return false;
    S.prac.targeted = true;
    return f.SP.patronum.runTo(v2.set(STAGE.x, Y() + 0.02, STAGE.z), () => { if (!S.prac) return; S.prac.melt = 0.001; pracW(v1, 0.9); burst(v1.x, v1.y, v1.z, 0xe8f6ff, 30, 2.4, 1.0, 0.28, -0.3); sfx('sparkle'); sfx('chime');
      ctx.say('הצל נמס כמו ערפל בשמש! ✨ כל הכבוד!', TONKS_WHO, 3); setTimeout(() => done(2), 1500); }, 1.3);
  }
  // face Harry toward a point; the lens behind-beside him, a little higher
  function frame(tx, tz, opt = {}) {
    try {
      const phone = innerWidth / Math.max(1, innerHeight) < 0.8;
      const yaw = Math.atan2(tx - player.pos.x, tz - player.pos.z), C = player.cam, side = opt.side != null ? opt.side : (phone ? 0.35 : 0.5);
      player.yaw = yaw; if (player.model) player.model.rotation.y = yaw;
      if (C) { C.yaw = yaw + Math.PI + side; C.pitch = opt.pitch != null ? opt.pitch : (phone ? 0.12 : 0.3); C.dist = opt.dist || (phone ? 4.6 : Math.min(C.dist || 6, 5.4)); C.userControlled = false; C.idle = 0; }
    } catch { /* ok */ }
  }
  const standSpot = () => { player.yaw = Math.atan2(STAGE.x - SPOT.x, STAGE.z - SPOT.z); player.teleport(SPOT.x, SPOT.z); frame(STAGE.x, STAGE.z); };
  const standLake = () => { const ph = innerWidth / innerHeight < 0.8; player.yaw = LSPAWN.yaw; player.teleport(LSPAWN.x, LSPAWN.z); frame(0, -26, { pitch: ph ? 0.16 : 0.18, side: ph ? 0.1 : 0.22, dist: ph ? 5.4 : 5.0 }); };

  // ---- the memory cards ----
  const MEM = [['fly', 'עפים על מטאטא 🧹'], ['friends', 'עם החברים 💛'], ['cake', 'עוגת יום הולדת 🎂']];
  function openMem() {
    if (!S.mem) {
      const d = document.createElement('div'); d.id = 'b3mem';
      for (const ev of ['pointerdown', 'touchstart', 'mousedown']) d.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
      const hd = document.createElement('div'); hd.className = 'hd'; hd.textContent = '💛 איזה זיכרון שמח בוחרים?'; d.appendChild(hd);
      const row = document.createElement('div'); row.className = 'row'; d.appendChild(row);
      MEM.forEach(([k, t], i) => { const b = document.createElement('button'); b.dataset.i = i; const cv = document.createElement('canvas'); cv.width = 240; cv.height = 200; try { drawMemory(cv.getContext('2d'), k); } catch { /* art optional */ }
        b.appendChild(cv); const s = document.createElement('span'); s.textContent = t; b.appendChild(s); b.addEventListener('click', (e) => { e.stopPropagation(); pickMem(i, b); }); row.appendChild(b); });
      document.body.appendChild(d); S.mem = d;
    }
    S.mem.classList.add('on'); S.mem.classList.toggle('glow', lv() === 1 || S.glowHint);
  }
  function pickMem(i, b) {
    if (S.picked >= 0 || ctx.step !== 1) return;
    S.picked = i; ctx.poke(); if (b) b.classList.add('pick'); sfx('heart'); sfx('sparkle');
    ctx.say(['לעוף זה הכי כיף! 🧹 תחזיק את הזיכרון הזה בלב...', 'חברים טובים הם האור הכי חזק! 💛 תחזיק את הזיכרון בלב...', 'עוגה ונרות ושירים! 🎂 תחזיק את הזיכרון בלב...'][i], TONKS_WHO, 3.5);
    setTimeout(() => { if (S.mem) S.mem.classList.remove('on'); done(1); }, 1400);
  }

  // ---- the lake: wisps, casts, the stag ----
  function lakeSetup() {
    LK.mode = 'quest'; LK.silver = 0; LK.wisps = []; S.sel = null;
    for (let i = 0; i < S.N; i++) LK.wisps.push(spawnWisp(i, S.N));
  }
  function onLakeCast() {
    untarget();   // a new cast starts a new stag: an earlier run (if any) is over
    const st = stagState(); if (!st || !st.on) return;
    let w = null;
    if (lv() === 1) w = nearestWisp();
    else if (S.sel && S.sel.alive && !S.sel.melt && !S.sel.targeted) w = S.sel;
    if (w) { S.sel = null; sendStag(w, lakeMelted); S.sent++; ctx.say(lv() === 1 ? 'האייל רץ על המים! 🦌✨' : 'האייל רץ אל הצל שבחרת! 🦌', TONKS_WHO, 2.4); }
    else if (lv() > 1) ctx.say('יופי! עכשיו גע בצל אפור, והאייל ירוץ אליו 🦌', TONKS_WHO, 3);
  }
  function lakeMelted() {
    ctx.poke();
    const left = LK.wisps.filter(w => w.alive && !(w.melt > 0)).length;
    try { fun.toast('✨', (S.N - left) + ' / ' + S.N, 900); } catch { /* ok */ }
    if (left === 0) { ctx.say('כל הצללים נעלמו! 🌙 תראה את האגם...', TONKS_WHO, 3); setTimeout(() => done(3), 1600); }
    else ctx.say(['הצל נמס לניצוצות! ✨ עוד אחד!', 'וּוּש! עוד צל נעלם ✨', 'האור מגרש את הצללים! ✨'][left % 3], TONKS_WHO, 2.2);
  }
  function wispAtTap(x, y) {
    let best = null, bd = 1e9;
    for (const w of LK.wisps) { if (!w.alive || w.melt > 0) continue; ctx.screen(lakeWorld(w, v1, 0.8), scr); if (!scr.on) continue; const d = Math.hypot(scr.x - x, scr.y - y); if (d < bd) { bd = d; best = w; } }
    return bd < R() * 2.4 ? best : null;
  }

  // ---- per frame ----
  function update(dt, step) {
    S.t += dt;
    wardTick(dt);
    if (S.reframe === 'spot' && inRoom('classrooms') && S.ward) { S.reframe = null; standSpot(); }
    if (S.reframe === 'lake' && inRoom('b3lake') && LK.B) { S.reframe = null; S.entering = false; if (step === 3 && !LK.wisps.length) lakeSetup(); standLake(); }
    if (step === 0 && inRoom('classrooms') && Math.hypot(player.pos.x - SPOT.x, player.pos.z - SPOT.z) < 3.4) { ctx.say('הי הארי! 🩷 פטרונוס מתחיל ממחשבה: תחשוב על זיכרון שמח מאוד...', TONKS_WHO, 4.5); done(0); }
    // the practice wisp
    if (step === 2 && inRoom('classrooms') && S.ward) {
      if (!S.prac) { S.prac = { x: WARD.x, y: 0.55, z: WARD.z, s: 0.95, ph: 1.3, alive: true, melt: 0, age: 0 }; ctx.say('הנה צל אפור קטן יצא מהארון. הוא רך כמו ערפל... הטל אקספקטו פטרונום! 🦌', TONKS_WHO, 4.5); }
      if (S.prac.alive && !S.prac.melt && !S.prac.targeted && S.prac.age > 1.6) {
        if (lv() === 1 || S.prac.age > 9) { try { fun.offer('adv-patronum', '🦌', 0.05, () => { castStag(); }); } catch { /* ok */ } }
        if (S.assist) { S.assistT += dt; if (S.assistT > 0.8) { S.assistT = 0; S.assist = false; castStag(); } }
        if ((lv() === 1 || S.glowHint) && Math.random() < dt * 4) { pracW(v1, 0.4 + Math.random() * 1.2); emit(v1.x + (Math.random() - 0.5) * 0.9, v1.y, v1.z + (Math.random() - 0.5) * 0.9, 0, 0.3, 0, 0.8, 0.18, 0xd8ecff, 0); }
      }
    }
    // the lake wisps
    if (step === 3 && inRoom('b3lake') && LK.wisps.length) {
      const any = LK.wisps.some(w => w.alive && !(w.melt > 0) && !w.targeted);
      const st = stagState(), running = st && st.on;
      if (any && !running && (lv() === 1 || S.t > 8)) { try { fun.offer('adv-patronum', '🦌', 0.05, () => { castStag(); }); } catch { /* ok */ } }
      if (S.assist && any) { S.assistT += dt; if (S.assistT > 1.0) { S.assistT = 0; if (!running) castStag(); else { const w = nearestWisp(); if (w) { sendStag(w, lakeMelted); S.sent++; } } } }
      if ((lv() === 1 || S.glowHint) && Math.random() < dt * 3) { const w = nearestWisp(); if (w) { lakeWorld(w, v1, 0.4); emit(v1.x + (Math.random() - 0.5) * 2, v1.y - 1.0, v1.z + (Math.random() - 0.5) * 1.5, 0, 0.3, 0, 0.9, 0.3, 0xfff2b0, 0); } }
    }
    if (step === 4 && inRoom('b3lake')) { LK.silver = Math.min(1, LK.silver + dt / 2.5); if (S.finT > 0) { S.finT += dt; if (S.finT > 2.6) done(4); } }
    // casts: a Patronus (the stag) or another spell (a kind word)
    const n = casts(), p = pats();
    if (p !== S.pat0) {
      S.pat0 = p; ctx.poke();
      if (step === 2 && inRoom('classrooms') && S.prac && S.prac.alive && S.prac.age > 1.0) { if (!S.prac.melt) S.prac.targeted = false; practiceSend(); }
      else if (step === 3 && inRoom('b3lake')) onLakeCast();
    }
    if (n !== S.casts0) {
      S.casts0 = n; const k = freecast && freecast.selected ? freecast.selected() : null;
      if (k !== 'patronum' && ((step === 2 && S.prac && S.prac.alive) || (step === 3 && inRoom('b3lake')))) { S.wrong++; ctx.oops('לחש יפה! אבל לצל אפור צריך אקספקטו פטרונום 🦌'); }
    }
  }
  // ---- taps ----
  function tap(x, y, step) {
    if (step === 3 && inRoom('b3lake')) {
      const w = wispAtTap(x, y); if (!w) return false;
      if (lv() === 1) { const st = stagState(); if (!st || !st.on) ctx.say('קודם הטל אקספקטו פטרונום 🦌', TONKS_WHO, 2.4); return true; }
      const st = stagState();
      if (st && st.on) { S.sel = null; if (sendStag(w, lakeMelted)) { S.sent++; ctx.say('האייל רץ אל הצל שבחרת! 🦌', TONKS_WHO, 2.2); } }
      else { S.sel = w; ctx.say('בחרת צל! עכשיו הטל אקספקטו פטרונום 🦌', TONKS_WHO, 2.6); }
      return true;
    }
    if (step === 4 && inRoom('b3lake')) { if (!S.finT && LK.silver > 0.3) { S.finT = 0.001; ctx.poke(); sfx('fanfare'); ctx.say('זה היה פטרונוס אמיתי! 🦌✨ אני כל כך גאה בך!', TONKS_WHO, 4); burst(player.pos.x, player.pos.y + 2, player.pos.z - 2, 0xe8f6ff, 30, 2.6, 1.2, 0.3, -0.4); } return true; }
    if (step === 2 && inRoom('classrooms') && S.prac) { ctx.screen(pracW(v1), scr); if (scr.on && Math.hypot(scr.x - x, scr.y - y) < R() * 2.2) { ctx.say('הטל אקספקטו פטרונום מהשרביט, או גע בכפתור 🦌', TONKS_WHO, 2.6); return true; } }
    return false;
  }
  function goal(step, out) {
    if (step <= 2) { if (!inRoom('classrooms')) return ctx.routeTo('classrooms', out, ['staircase', 'entrancehall']); if (step === 0) return out.set(SPOT.x, Y(), SPOT.z); if (step === 2 && S.prac && S.prac.alive && !S.prac.melt) return pracW(out, 0.2); return null; }
    if (step === 3) { if (!inRoom('b3lake')) return null; const w = lv() > 1 && S.sel && S.sel.alive ? S.sel : nearestWisp(); return w ? lakeWorld(w, out, 0.2) : null; }
    return null;
  }
  function begin(step, resumed) {
    if (!S.inited) { S.inited = true; S.N = NWISPS[lv()] || 3; }   // the level: read at run time
    S.active = true; S.assist = false; S.assistT = 0; S.finT = 0;
    if (step !== 2) S.prac = null;
    if (step === 0) return;
    if (step <= 2) {
      if (inRoom('classrooms')) { if (S.ward) standSpot(); else S.reframe = 'spot'; }
      else { interiors.enter('classrooms', { x: SPOT.x, z: SPOT.z, yaw: Math.atan2(STAGE.x - SPOT.x, STAGE.z - SPOT.z) }); S.reframe = 'spot'; }
      if (step === 1) { S.picked = -1; openMem(); ctx.say('בחר את הזיכרון הכי שמח שלך 💛', TONKS_WHO, 3.5); }
      if (step === 2) { S.prac = null; if (resumed) ctx.say('הצל האפור מחכה ליד הארון 🦌', TONKS_WHO, 3); }
      return;
    }
    if (step === 3 || step === 4) {
      if (inRoom('b3lake') && LK.B) { if (step === 3) lakeSetup(); else LK.mode = 'quest'; standLake(); }
      else { fadeIn(); S.entering = true; interiors.enter('b3lake', { ...LSPAWN }); S.reframe = 'lake'; if (step === 3) LK.wisps = []; LK.mode = 'quest'; }
      if (step === 3) ctx.say('ערב שקט ליד האגם... ושם, מעל המים, צללים אפורים. הטל אקספקטו פטרונום! 🦌', TONKS_WHO, 5);
      if (step === 4) { LK.wisps = []; ctx.say('תראה איך האגם זוהר בכסף! 🌙 גע באגם', TONKS_WHO, 4); }
    }
  }
  function glow(step, on) { S.glowHint = !!on; if (S.mem) S.mem.classList.toggle('glow', lv() === 1 || S.glowHint); }
  function together(step, fast) {
    if (fast) { if (step === 1 && S.mem) S.mem.classList.remove('on'); done(step); return; }
    if (step === 0) { interiors.enter('classrooms', { x: SPOT.x, z: SPOT.z, yaw: 0 }); S.reframe = 'spot'; return; }
    if (step === 1) { const b = S.mem && S.mem.querySelector('button'); pickMem(0, b); return; }
    if (step === 2 || step === 3) { S.assist = true; S.assistT = 0; return; }
    if (step === 4) tap(innerWidth / 2, innerHeight / 2, 4);
  }
  function end() {
    S.active = false; dropWard();
    if (S.mem) { S.mem.remove(); S.mem = null; }
    try { css.remove(); } catch { /* ok */ }
    LK.wisps = []; LK.silver = 0; LK.mode = null;
    if (interiors.active === 'b3lake') interiors.enter('classrooms', { x: SPOT.x, z: SPOT.z, yaw: Math.atan2(STAGE.x - SPOT.x, STAGE.z - SPOT.z) });
  }
  function state() {
    const B = LK.B, st = stagState();
    return { room: interiors.active, N: S.N, picked: S.picked, mem: !!(S.mem && S.mem.classList.contains('on')), wrong: S.wrong, sent: S.sent, silver: +LK.silver.toFixed(2), flies: LK.flies,
      ward: S.ward ? { visible: S.ward.g.visible && !!S.ward.g.parent, door: +S.ward.door.toFixed(2) } : null,
      prac: S.prac ? { alive: S.prac.alive, melt: +S.prac.melt.toFixed(2), visible: !!(S.pracW && S.pracW.mesh.visible && S.pracW.mesh.count > 0), d: +Math.hypot(S.prac.x - player.pos.x, S.prac.z - player.pos.z).toFixed(2) } : null,
      wisps: LK.wisps.map(w => ({ i: w.i, alive: w.alive, melt: +(w.melt || 0).toFixed(2), d: +Math.hypot(w.x - player.pos.x, w.z - player.pos.z).toFixed(2), targeted: !!w.targeted })),
      wispMesh: B ? { visible: B.W.mesh.visible, count: B.W.mesh.count } : null, lake: B ? { tris: B.tris, draws: drawCount(B.g) } : null,
      stag: st, sel: S.sel ? S.sel.i : null, prompt: (() => { try { return fun.promptId ? fun.promptId() : null; } catch { return null; } })() };
  }
  ctx._pat = {
    wispW: (i) => { const w = LK.wisps.find(x => x.i === i && x.alive); return w ? lakeWorld(w, new Vector3(), 0.8) : null; },
    pracW: () => (S.prac && S.prac.alive ? pracW(new Vector3()) : null),
    wardW: () => (S.ward ? new Vector3(WARD.x, Y() + 1.1, WARD.z) : null),
    memScreen: (i) => { const b = S.mem && S.mem.querySelectorAll('button')[i]; if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  };
  return { begin, update, goal, tap, glow, together, end, state };
}

// ---------------- the free lake (the map card "האגם בערב 🦌") ----------------
let FREE = null;
const FREE_KEY = 'hpAdvB3LakeFree';
export function freeLakeState() { return FREE ? { on: true, wisps: LK.wisps.map(w => ({ i: w.i, alive: w.alive, melt: +(w.melt || 0).toFixed(2), d: +Math.hypot(w.x - window.__game.player.pos.x, w.z - window.__game.player.pos.z).toFixed(2) })), melted: FREE.melted, paid: LK.paid, room: window.__game.interiors.active, mesh: LK.B ? { visible: LK.B.W.mesh.visible, count: LK.B.W.mesh.count } : null, lake: LK.B ? { tris: LK.B.tris, draws: drawCount(LK.B.g) } : null } : { on: false, paid: LK.paid }; }
export function startFreeLake() {
  if (FREE) return false;
  const G = window.__game, A = G && G.adventures, base = A && A._ctx; if (!G || !base) return false;
  const busy = () => { const c = document.body.classList; return c.contains('inSpell') || c.contains('inMatch') || c.contains('inFloo') || c.contains('inAdv') || c.contains('advBus'); };
  try { if (A.state().quest || base.isModal() || base.isTakeover() || busy()) { base.fun.toast('🦌', 'האגם יחכה לך אחר כך', 1800); return false; } } catch { return false; }
  const from = { room: G.interiors.active || null, x: G.player.pos.x, z: G.player.pos.z, yaw: G.player.yaw };
  try { localStorage.setItem(FREE_KEY, JSON.stringify(from)); } catch { /* private mode */ }
  const F = { from, raf: 0, last: performance.now(), spawnT: 2.0, pat0: -1, melted: 0, i: 0, ended: false, arrived: false, err: 0 };
  FREE = F; LK.mode = 'free'; LK.wisps = []; LK.silver = 0;
  fadeIn(); G.interiors.enter('b3lake', { ...LSPAWN });
  const back = document.createElement('button'); back.id = 'b3LakeBack'; back.textContent = '🏠 חזרה'; back.setAttribute('aria-label', 'חזרה');
  const css = document.createElement('style'); css.id = 'b3LakeBackCss';
  css.textContent = `#b3LakeBack{position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:15;padding:10px 26px;border-radius:24px;border:3px solid #ffd76a;
    background:rgba(40,60,120,.9);color:#ffe9a8;font:bold 24px ${FONT};cursor:pointer;touch-action:manipulation;box-shadow:0 4px 14px rgba(0,0,0,.45)}`;
  document.head.appendChild(css); document.body.appendChild(back);
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) back.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  back.addEventListener('click', (e) => { e.stopPropagation(); stop(true); });
  function stop(home) {
    if (F.ended) return; F.ended = true; cancelAnimationFrame(F.raf);
    try { back.remove(); css.remove(); } catch { /* ok */ }
    LK.wisps = []; LK.mode = null; FREE = null;
    try { localStorage.removeItem(FREE_KEY); } catch { /* ok */ }
    if (home) { const f = F.from; if (f && f.room && f.room !== 'b3lake') G.interiors.enter(f.room, { x: f.x, z: f.z, yaw: f.yaw }); else { if (G.interiors.active) G.interiors.exit(); if (f) { G.player.yaw = f.yaw; G.player.teleport(f.x, f.z); } } }
  }
  F.stop = stop;
  const tick = (now) => {
    if (F.ended) return;
    const dt = Math.min(0.1, Math.max(0, (now - F.last) / 1000)); F.last = now;
    try {
      const inLake = G.interiors.active === 'b3lake' && !!LK.B;
      if (inLake && !F.arrived) { F.arrived = true; const p = G.player, C = p.cam; p.yaw = LSPAWN.yaw; p.teleport(LSPAWN.x, LSPAWN.z); if (C) { const ph = innerWidth / innerHeight < 0.8; C.yaw = LSPAWN.yaw + Math.PI + (ph ? 0.1 : 0.22); C.pitch = ph ? 0.16 : 0.18; C.dist = ph ? 5.4 : 5; C.userControlled = false; } base.say('האגם בערב 🌙 צללים אפורים מרחפים לפעמים מעל המים. אקספקטו פטרונום מגרש אותם! 🦌', '🩷 טונקס', 4.5); }
      if (F.arrived && !inLake) { stop(false); return; }   // the child went somewhere else (the map, the Floo): the free lake simply ends
      if (inLake) {
        // a wisp drifts in now and then (up to 3)
        const alive = LK.wisps.filter(w => w.alive);
        F.spawnT -= dt; if (F.spawnT <= 0 && alive.length < 3) { F.spawnT = 7 + Math.random() * 5; const w = spawnWisp(Math.floor(Math.random() * 5), 5); w.i = F.i++; LK.wisps.push(w); }
        if (LK.wisps.length > 12) LK.wisps = LK.wisps.filter(w => w.alive);
        const st = stagState(), n = st ? st.casts : 0; if (F.pat0 < 0) F.pat0 = n;
        if (n !== F.pat0) { F.pat0 = n; untarget(); const w = nearestWisp(); if (w && st.on) sendStag(w, () => { F.melted++; if (!LK.paid) { LK.paid = true; try { window.HPLessons.progress.bonus(5); } catch { /* lessons not loaded */ } try { base.fun.toast('✨⭐', '+5 נקודות לבית!', 1600); } catch { /* ok */ } } }); }
        if (alive.some(w => !w.melt && !w.targeted) && !(st && st.on)) { try { base.fun.offer('free-patronum', '🦌', 0.05, () => castStag()); } catch { /* ok */ } }
      }
    } catch (e) { if (!F.err++) console.warn('[b3-patronus] free lake -', e && e.message || e); }
    F.raf = requestAnimationFrame(tick);
  };
  F.raf = requestAnimationFrame(tick);
  return true;
}
const DBG = { state: () => freeLakeState(), start: () => startFreeLake(), stop: () => { if (FREE) FREE.stop(true); return true; }, wispW: (i) => { const w = LK.wisps.find(x => x.i === i && x.alive); return w ? lakeWorld(w, new Vector3(), 0.8) : null; } };
try { if (/[?&]debug=1/.test(location.search)) window.__b3lake = DBG; } catch { /* ok */ }
