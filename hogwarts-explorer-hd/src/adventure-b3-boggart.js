// Book 3, adventure 2: "ארון הבוגארט" (the boggart wardrobe, a Defence lesson with Tonks). Data for adventures.js +
// the scene code. Played in `classrooms`, in the Defence corner (Tonks's station, x 9): a tall friendly wardrobe that
// rattles stands there only while the quest runs (and, once the quest is done, for free play). Tonks stays at her
// station (roam.js holds every teacher home during an adventure); her lines come as bubbles.
// Kid-safe: the shapes are round, bright, big-eyed and silly (a grumpy giant hat, a wobbly pumpkin on little feet, a
// bedsheet with a hiccup, a cupboard with bushy eyebrows, a huge sock); they wobble in place on a stage 1.35 m in
// front of the wardrobe, never move toward Harry, and a collider keeps Harry 2.5 m+ from the stage. Spells act on the
// SHAPE only. No fail state: a wrong spell gives a kind bubble; the 😂 prompt button always works.
// Steps: 1 go to the Defence corner -> 2 Tonks explains; tap the wardrobe to knock -> 3 shapes come out one at a time
// (2 / 3 / 4 by level): Riddikulus (wheel target or 😂) turns each silly and it giggles back in -> 4 the last shape needs
// two casts (it sneezes confetti first) -> 5 tap the wardrobe to say thanks; Tonks cheers. Reward: card + star.
// Free play (from a fresh save on, Elik's ask 26 Nov): the wardrobe always stands in the corner of `classrooms`, hidden only
// while another adventure, a lesson / course (body.inSpell, a modal) or Quidditch runs. A tap on it (a knock) or a
// Riddikulus cast brings one random silly shape; Riddikulus (or the 😂 prompt nearby) dresses it and it giggles back in.
// Endless; +5 house points once per session (memory only, like corridor-free.js).
import { Vector3 } from 'three';
import { BUILDERS } from './rooms.js';
import { buildWardrobe, buildShape, disposeShape, disposeWardrobe, triCount, SPOT, WARD, STAGE, STAGE_D, TONKS, KINDS, NAMES } from './adventure-b3-boggart-build.js';

const HERM = { ico: '👧', name: 'הרמיוני' };
const TONKS_WHO = '🩷 טונקס';
const NSHAPES = { 1: 3, 2: 4, 3: 5 };
export const B3BOGGART = {
  id: 'b3-boggart', book: 3, title: 'ארון הבוגארט', ico: '🚪', col: '#3a1a4a', col2: '#c89ae0', helper: HERM, confetti: ['✨', '😂', '🎩', '🌸'],
  pic: [['🚪', 0.5, 0.56, 62], ['😂', 0.2, 0.3, 30], ['🎩', 0.8, 0.3, 30]],
  intro: [
    'שיעור הגנה מפני כוחות האופל עם טונקס! 🩷',
    'בארון הישן מסתתר בוגארט: הוא הופך למשהו קצת מפחיד...',
    'אבל עם הלחש רידיקולוס הופכים אותו למצחיק! 😂 בוא ננסה',
  ],
  steps: [
    { line: 'לך לפינת ההגנה בכיתות הלימוד 🏫', hints: ['טונקס מחכה בכיתות הלימוד, בפינה של ההגנה 🩷', 'לך אחרי החץ הזהוב אל הארון הגדול', 'הארון עם הדלתות המקשקשות נמצא ליד טונקס 🚪'], glowL1: true },
    { line: 'דפוק על הארון 🚪', hints: ['גע בארון הגדול כדי לדפוק עליו 🚪', 'הארון זוהר. גע בו!', 'טוק-טוק! גע בדלתות הארון'], glowL1: true },
    { line: 'הטל רידיקולוס על מה שיוצא מהארון 😂', hints: ['כשמשהו יוצא מהארון, הטל רידיקולוס! 😂', 'בחר רידיקולוס בגלגל הלחשים, או גע בכפתור 😂', 'הלחש הזוהר בגלגל: רידיקולוס 😂'], spell: 'riddikulus', glowL1: true },
    { line: 'האחרון עקשן! עוד רידיקולוס 😂', hints: ['הוא התעטש? הטל רידיקולוס עוד פעם! 😂', 'גע בכפתור 😂 או בחר רידיקולוס בגלגל', 'עוד לחש אחד והוא יהיה הכי מצחיק! 😂'], spell: 'riddikulus', glowL1: true },
    { line: 'גע בארון ותגיד תודה לטונקס 🩷', hints: ['גע בארון כדי להגיד תודה 🩷', 'הארון זוהר. גע בו!', 'עוד נגיעה אחת בארון - וסיימנו! ⭐'], glowL1: true },
  ],
  create: (ctx) => bogScene(ctx),
  art: drawBogCard,
};

// the reward card picture: the wardrobe, doors open, a giggling pumpkin in a pink tutu and a flowered bonnet on a hook
function drawBogCard(x, cx, cy) {
  const E = (px, py, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, 0, 0, 7); x.fill(); };
  const g = x.createLinearGradient(0, cy - 140, 0, cy + 130); g.addColorStop(0, '#e8d8f4'); g.addColorStop(1, '#c8a8e0'); x.fillStyle = g; x.fillRect(cx - 120, cy - 150, 240, 290);
  x.fillStyle = '#6a4228'; x.fillRect(cx - 70, cy - 110, 140, 200); x.fillStyle = '#4a3a5a'; x.fillRect(cx - 58, cy - 98, 116, 176);
  x.fillStyle = '#8a5a34'; x.save(); x.translate(cx - 70, cy - 110); x.transform(1, 0.12, 0, 1, 0, 0); x.fillRect(-48, 0, 46, 196); x.restore();
  x.save(); x.translate(cx + 70, cy - 110); x.transform(1, -0.12, 0, 1, 0, 0); x.fillRect(2, 0, 46, 196); x.restore();
  // the pumpkin in a tutu
  E(cx, cy + 30, 48, 40, '#d87a1a'); x.fillStyle = '#e87ab0'; x.beginPath(); x.ellipse(cx, cy + 52, 62, 14, 0, 0, 7); x.fill();
  E(cx - 16, cy + 18, 11, 12, '#f4f0e8'); E(cx + 16, cy + 18, 11, 12, '#f4f0e8'); E(cx - 14, cy + 20, 5, 6, '#2a2030'); E(cx + 18, cy + 20, 5, 6, '#2a2030');
  x.strokeStyle = '#5a2020'; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy + 34, 12, 0.2, Math.PI - 0.2); x.stroke();
  x.fillStyle = '#5a6a2a'; x.fillRect(cx - 4, cy - 18, 8, 12);
  // a bonnet with flowers floating above
  E(cx + 60, cy - 90, 26, 18, '#e8c84a'); for (const [dx, c] of [[-10, '#e86aa0'], [4, '#9a7ae0'], [16, '#e86a6a']]) E(cx + 60 + dx, cy - 104, 6, 6, c);
  x.save(); x.font = '28px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('😂', cx - 70, cy - 100); x.fillText('✨', cx + 80, cy + 60); x.restore();
}

// ---------------- the wardrobe in the classroom (shared by the quest and free play) ----------------
const KEY = 'hpAdventures1';
const QUEST = { on: false };
const FREE = { done: false, paid: false, casts: 0, knocks: 0, T: null, err: 0, last: null, tap: false };
function readDone() { try { const o = JSON.parse(localStorage.getItem(KEY)); return !!(o && o.done && o.done['b3-boggart']); } catch { return false; } }
const sfx = (k, ...a) => { try { const s = window.HPFun && window.HPFun.sfx; if (s && s[k]) s[k](...a); } catch { /* no audio */ } };
const tone = (f, d, w = 0, type = 'triangle', v = 0.1, to) => { try { window.HPFun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
const fxBurst = (...a) => { try { const fi = window.__game && window.__game.freecast && window.__game.freecast._internal; if (fi && fi.burst) fi.burst(...a); } catch { /* ok */ } };
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const _w = new Vector3();

const baseClass = BUILDERS.classrooms;
if (baseClass) BUILDERS.classrooms = (...a) => {
  const r = baseClass(...a), add = (x) => { try { hookRoom(x); } catch (e) { console.warn('[b3-boggart] room hook skipped -', e && e.message || e); } return x; };
  return r && typeof r.then === 'function' ? r.then(add) : add(r);
};
function hookRoom(r) {
  if (!r || !r.group) return;
  FREE.done = readDone();
  const up = r.update;
  r.update = (dt, t) => {
    if (up) up(dt, t);
    try { roomTick(r, dt); } catch (e) { if (!FREE.err++) console.warn('[b3-boggart] tick failed -', e && e.message || e); }
  };
}
// free play gives way to anything else that uses the room (another quest, a lesson / course, Quidditch, a Floo trip)
function freeBusy() {
  const c = document.body.classList;
  return c.contains('inSpell') || c.contains('inMatch') || c.contains('inFloo') || c.contains('inAdv') || c.contains('modalOn') || !!(window.__game && window.__game.takeover);
}
function roomTick(r, dt) {
  let W = r.group.userData.bog;
  if (!W) W = addWard(r);
  const show = QUEST.on || !freeBusy();
  if (W.g.visible !== show) { W.g.visible = show; if (!show && !QUEST.on) dropShape(W); }
  tickWard(W, dt);
  if (!QUEST.on) freeTick(W, dt);
}
function addWard(r) {
  const W = buildWardrobe();
  Object.assign(W, { ph: 'none', t: 0, shape: null, door: 0, doorWant: 0, rt: 2.5, rattle: 0, knock: 0, happy: 0, sneeze: 0, auto: false, onIn: null, wob: 0, T: 0, glow: false });
  r.group.add(W.g); r.group.userData.bog = W;
  // solid: the wardrobe, and the stage (so Harry can never stand closer than ~2.5 m to a shape)
  W.cols = [{ type: 'circle', x: WARD.x, z: WARD.z, r: 0.75, b3: true }, { type: 'circle', x: STAGE.x, z: STAGE.z, r: 2.25, b3: true }];
  for (const c of W.cols) r.colliders.push(c);
  W.wardTris = triCount(W.g);
  return W;
}
function dropWard(r, W) {
  dropShape(W);
  for (const c of W.cols || []) { const i = r.colliders.indexOf(c); if (i >= 0) r.colliders.splice(i, 1); }
  disposeWardrobe(W); r.group.userData.bog = null;
}
function dropShape(W) { if (W.shape) { disposeShape(W.shape); W.shape = null; } W.ph = 'none'; W.doorWant = 0; W.sneeze = 0; }
// show one shape: it hops out of the wardrobe to the stage (auto: free play, it turns silly by itself)
function showShape(W, kind, auto = false) {
  dropShape(W);
  const s = buildShape(kind); s.g.position.set(0, 0.3, 0); s.g.scale.setScalar(0.4); W.holder.add(s.g);
  // the triangle count includes the silly item
  W.shape = s; s.silly.visible = true; W.shapeTris = triCount(s.g); s.silly.visible = false;
  W.ph = 'out'; W.t = 0; W.doorWant = 1; W.auto = auto; W.rattle = 0.5;
  tone(330, 0.12, 0, 'square', 0.05); tone(440, 0.16, 0.1, 'triangle', 0.06);
}
function makeSilly(W) {
  if (!W.shape || W.ph !== 'wait') return false;
  W.ph = 'silly'; W.t = 0; W.shape.silly.visible = true;
  sfx('giggle', true); setTimeout(() => sfx('giggle', false), 700); sfx('sparkle');
  stageW(_w, 0.8); fxBurst(_w.x, _w.y, _w.z, 0xff9ad8, 26, 2.4, 0.9, 0.26, -0.8); fxBurst(_w.x, _w.y + 0.4, _w.z, 0xffe27a, 14, 1.8, 0.8, 0.22, -0.6);
  return true;
}
function sneezeShape(W) {
  if (!W.shape || W.ph !== 'wait') return false;
  W.sneeze = 0.001; tone(700, 0.08, 0, 'square', 0.05, 900); tone(260, 0.25, 0.18, 'sawtooth', 0.05, 140); sfx('pop');
  stageW(_w, 1.0); for (const c of [0xff6ab0, 0x6ab0ff, 0xffe27a, 0x8aff8a]) fxBurst(_w.x, _w.y, _w.z, c, 10, 2.6, 1.0, 0.2, -1.4);
  return true;
}
// world position of a point above the stage / the wardrobe (the room group sits at FLOOR_Y)
function roomY() { try { const r = window.__game.interiors.room; return r && r.group ? r.group.position.y : -200; } catch { return -200; } }
function stageW(out, y = 0.8) { return out.set(STAGE.x, roomY() + y, STAGE.z); }
function wardW(out, y = 1.1) { return out.set(WARD.x + Math.sin(WARD.yaw) * 0.4, roomY() + y, WARD.z + Math.cos(WARD.yaw) * 0.4); }

function tickWard(W, dt) {
  W.T += dt; const T = W.T;
  // the doors: open while a shape is out; a little jiggle when it rattles
  W.door += (W.doorWant - W.door) * Math.min(1, dt * (W.doorWant > W.door ? 7 : 4));
  let jig = 0, rz = 0, hop = 0;
  if (W.ph === 'none' && W.knock <= 0 && W.happy <= 0) { W.rt -= dt; if (W.rt <= 0) { W.rt = 3 + Math.random() * 3; W.rattle = 0.7; tone(150, 0.05, 0, 'square', 0.03); tone(170, 0.05, 0.12, 'square', 0.03); } }
  if (W.rattle > 0) { W.rattle -= dt; const k = Math.max(0, W.rattle / 0.7); jig = Math.abs(Math.sin(T * 40)) * 0.12 * k; rz = Math.sin(T * 34) * 0.025 * k; }
  if (W.knock > 0) { W.knock -= dt; const k = W.knock / 1.6; hop = Math.abs(Math.sin(T * 9)) * 0.08 * k; jig = Math.max(jig, Math.abs(Math.sin(T * 30)) * 0.18 * k); rz += Math.sin(T * 20) * 0.03 * k; }
  if (W.happy > 0) { W.happy -= dt; const k = W.happy / 2.2; hop = Math.abs(Math.sin(T * 7)) * 0.14 * k; jig = Math.max(jig, (0.5 + 0.5 * Math.sin(T * 8)) * 0.6 * k); }
  W.g.position.y = hop; W.g.rotation.z = rz;
  const open = W.door * 1.25 + jig;
  W.doorL.rotation.y = -open; W.doorR.rotation.y = open;
  const s = W.shape; if (!s) return;
  W.t += dt; const t = W.t;
  if (W.ph === 'out') {   // hop out to the stage in a soft arc
    const k = ease(t / 1.1); s.g.position.set(0, 0.3 * (1 - k) + Math.sin(k * Math.PI) * 0.5, STAGE_D * k); s.g.scale.setScalar(0.4 + 0.6 * k); s.g.rotation.set(0, 0, 0);
    if (t >= 1.1) { W.ph = 'wait'; W.t = 0; W.waitT = 0; sfx('boing'); }
  } else if (W.ph === 'wait') {   // wobble in place (never toward Harry); the bedsheet hiccups; a sneeze squashes it
    W.waitT += dt;
    let sy = 1 + Math.sin(t * 4.2) * 0.04, sx = 1 - Math.sin(t * 4.2) * 0.03, y = 0;
    if (s.kind === 'ghost') { const h = (t % 2.4); if (h < 0.3) { y = Math.sin(h / 0.3 * Math.PI) * 0.12; } y += 0.08 + Math.sin(t * 2) * 0.05; }
    if (s.kind === 'pumpkin') y = Math.abs(Math.sin(t * 3)) * 0.05;
    if (W.sneeze > 0) { W.sneeze += dt; const u = W.sneeze; if (u < 0.35) { sy = 1 - 0.25 * (u / 0.35); sx = 1 + 0.15 * (u / 0.35); } else if (u < 0.7) { const v = (u - 0.35) / 0.35; sy = 0.75 + 0.45 * Math.sin(v * Math.PI) + 0.25 * v; sx = 1.15 - 0.15 * v; } else W.sneeze = 0; }
    s.g.position.set(0, y, STAGE_D); s.g.scale.set(sx, sy, sx); s.g.rotation.set(0, Math.sin(t * 1.3) * 0.15, Math.sin(t * 3.1) * 0.1);
    if (W.auto && t > 0.7) makeSilly(W);
  } else if (W.ph === 'silly') {   // a happy giggle-wiggle and a spin
    const k = Math.min(1, t / 0.25); s.silly.scale.setScalar(0.3 + 0.7 * k);
    s.g.position.set(0, Math.abs(Math.sin(t * 9)) * 0.12, STAGE_D); s.g.rotation.set(0, Math.sin(t * 2.2) * 0.5, Math.sin(t * 16) * 0.12); s.g.scale.setScalar(1 + Math.sin(t * 16) * 0.03);
    if (t >= 2.4) { W.ph = 'in'; W.t = 0; }
  } else if (W.ph === 'in') {   // hop back into the wardrobe, the doors shut
    const k = ease(t / 1.0); s.g.position.set(0, 0.3 * k + Math.sin(k * Math.PI) * 0.45, STAGE_D * (1 - k)); s.g.scale.setScalar(1 - 0.6 * k);
    if (t >= 1.0) { dropShape(W); W.rattle = 0.4; tone(220, 0.08, 0, 'square', 0.04); const f = W.onIn; W.onIn = null; if (f) { try { f(); } catch (e) { console.warn('[b3-boggart] next failed -', e && e.message || e); } } }
  }
}

// ---------------- free play: Riddikulus at the wardrobe -> one random silly shape (+5 once per session) ----------------
function curW() { try { const r = window.__game.interiors.room; return window.__game.interiors.active === 'classrooms' && r && r.group ? r.group.userData.bog || null : null; } catch { return null; } }
const freeOn = (W) => !!W && W.g.visible && !QUEST.on && !freeBusy();
function freeTick(W, dt) {
  installTap();
  if (!FREE.T) {
    let fi = null; try { fi = window.__game && window.__game.freecast && window.__game.freecast._internal; } catch { fi = null; }
    if (fi && Array.isArray(fi.TARGETS)) {
      FREE.T = { id: 'b3-wardrobe', spells: ['riddikulus'], at: (o) => { const w = curW(); return w && w.shape ? stageW(o, 0.7) : w ? wardW(o, 1.0) : o.set(0, -9999, 0); },
        ok: () => { const w = curW(); return freeOn(w) && (w.ph === 'none' || w.ph === 'wait'); }, cast: () => freeCast() };
      fi.TARGETS.push(FREE.T);
    }
  }
  if (!freeOn(W)) return;
  if (W.ph === 'wait') {
    // the 😂 prompt while Harry is near; a shape nobody dresses goes back in by itself after a while
    let near = false; try { const p = window.__game.player.pos; near = Math.hypot(p.x - STAGE.x, p.z - STAGE.z) < 9; } catch { near = false; }
    if (near) { try { window.HPFun.offer('free-riddikulus', '😂', 0.06, () => freeDress()); } catch { /* ok */ } }
    if ((W.waitT || 0) > 60) { W.ph = 'in'; W.t = 0; }
  }
  void dt;
}
function pickKind() { let k = KINDS[Math.floor(Math.random() * KINDS.length)]; if (k === FREE.last) k = KINDS[(KINDS.indexOf(k) + 1) % KINDS.length]; FREE.last = k; return k; }
function pay() {
  if (FREE.paid) return; FREE.paid = true;
  try { window.HPLessons.progress.bonus(5); } catch { /* lessons not loaded */ }
  try { window.HPFun.toast('✨⭐', '+5 נקודות לבית!', 1600); } catch { /* ok */ }
}
function freeKnock() {
  const W = curW(); if (!freeOn(W) || W.ph !== 'none') return false;
  FREE.knocks++; W.knock = 1.2; for (let i = 0; i < 3; i++) tone(190, 0.07, i * 0.2, 'square', 0.08, 150);
  showShape(W, pickKind(), false); return true;
}
function freeDress() { const W = curW(); if (!freeOn(W) || W.ph !== 'wait') return false; if (makeSilly(W)) { FREE.casts++; pay(); } return true; }
function freeCast() {   // Riddikulus at the wardrobe: dresses the shape that is out, or brings one out already dressed
  const W = curW(); if (!freeOn(W)) return;
  if (W.ph === 'wait') { freeDress(); return; }
  if (W.ph !== 'none') return;
  FREE.casts++; showShape(W, pickKind(), true); pay();
}
// taps in free play: adventures.js routes taps only to a running quest, so the wardrobe listens itself (a short tap)
function installTap() {
  if (FREE.tap) return; const view = document.getElementById('view'); if (!view) return;
  FREE.tap = true; let down = null;
  view.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; }, { passive: true });
  view.addEventListener('pointerup', (e) => {
    const d0 = down; down = null;
    try {
      if (!d0 || d0.id !== e.pointerId || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 18 || performance.now() - d0.t > 900) return;
      const W = curW(); if (!freeOn(W) || W.ph !== 'none') return;
      const c = window.__game.adventures && window.__game.adventures._ctx; if (!c) return;
      const s = c.screen(wardW(_t, 1.1)); if (!s.on) return;
      if (Math.hypot(s.x - e.clientX, s.y - e.clientY) < Math.max(46, Math.min(innerWidth, innerHeight) * 0.08) * 2.2) freeKnock();
    } catch { /* never break the game's own taps */ }
  }, { passive: true });
}
const _t = new Vector3();
const FREE_API = {
  knock: () => freeKnock(),
  state: () => { const W = curW(); return { done: FREE.done, paid: FREE.paid, casts: FREE.casts, knocks: FREE.knocks, busy: freeBusy(), target: !!FREE.T, quest: QUEST.on, ward: W ? { visible: W.g.visible && !!W.g.parent, ph: W.ph, kind: W.shape ? W.shape.kind : null, silly: !!(W.shape && W.shape.silly.visible) } : null }; },
  wardW: () => (curW() ? wardW(new Vector3(), 1.1) : null),
  shapeW: () => { const W = curW(); return W && W.shape ? stageW(new Vector3(), 0.7) : null; },
};
try { if (/[?&]debug=1/.test(location.search)) window.__b3bog = FREE_API; } catch { /* ok */ }

// ---------------- the quest scene ----------------
function bogScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit } = ctx;
  const S = { active: false, done: {}, inited: false, N: 3, kinds: [], k: 0, spawnT: 1.2, sneezed: false, castHit: false, casts0: 0, assist: false, assistT: 0,
    knock: 0, thanks: 0, wrong: 0, reframe: false, glowHint: false, shown: [], sillied: [], t: 0 };
  const lv = () => ctx.level;
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const inCls = () => interiors.active === 'classrooms' && interiors.room && interiors.room.group;
  const W = () => (inCls() ? interiors.room.group.userData.bog || null : null);
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3();
  const FI = freecast && freecast._internal;
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();
  const Y = () => (inCls() ? interiors.room.group.position.y : -200);
  // the hint bubble moves up while the 😂 prompt button shows, so it never covers it (same rule as the Norbert quest)
  const css = document.createElement('style'); css.id = 'advB3BogCss';
  css.textContent = '@media (min-width:701px){body.inAdv:has(#funPrompt.on) #advHint{bottom:calc(236px + env(safe-area-inset-bottom))}}';
  document.head.appendChild(css);

  // the wheel target: the shape on the stage (Riddikulus only)
  const T = [];
  if (FI && Array.isArray(FI.TARGETS)) {
    T.push({ id: 'b3-boggart', spells: ['riddikulus'], at: (o) => stageW(o, 0.7), ok: () => { const w = W(); return S.active && !!w && (ctx.step === 2 || ctx.step === 3) && w.ph === 'wait'; },
      cast: () => { S.castHit = true; riddi(); } });
    for (const t of T) FI.TARGETS.push(t);
  }

  const SILLY_SAY = { hat: 'כובע עם שפם מסולסל ופרחים! 😂', pumpkin: 'דלעת בטוטו ורוד! 🩰😂', ghost: 'סדין עם כובע פרחים! 🌸😂', cupboard: 'ארונית עם נעלי ליצן ואף אדום! 🤡', sock: 'גרב עם כובע מסיבה! 🎉😂' };
  const OUT_SAY = { hat: 'כובע ענק ועצבני! 🎩 עכשיו - רידיקולוס!', pumpkin: 'דלעת מתנדנדת על רגליים קטנות! 🎃 רידיקולוס!', ghost: 'סדין עם שיהוק... היק! 😮 רידיקולוס!', cupboard: 'ארונית עם גבות עבות! רידיקולוס!', sock: 'גרב ענקית! 🧦 רידיקולוס!' };
  function riddi() {
    const w = W(); if (!w || w.ph !== 'wait' || !(ctx.step === 2 || ctx.step === 3)) return;
    ctx.poke(); S.assistT = 0;
    if (ctx.step === 3 && !S.sneezed) { S.sneezed = true; sneezeShape(w); ctx.say("אַפְּצִ'י! 🤧 הוא התעטש קונפטי! עוד רידיקולוס אחד!", TONKS_WHO, 4); return; }
    if (makeSilly(w)) { S.sillied.push(w.shape.kind); ctx.say(SILLY_SAY[w.shape.kind] || 'איזה מצחיק! 😂', null, 3); w.onIn = afterIn; }
  }
  function afterIn() {
    if (!S.active) return;
    if (ctx.step === 2) { S.k++; if (S.k >= S.N - 1) { ctx.say('כל הכבוד! נשאר רק עוד אחד... 😉', TONKS_WHO, 3); done(2); } else S.spawnT = 0.9; }
    else if (ctx.step === 3) { done(3); }
  }
  function spawn() {
    const w = W(); if (!w) return;
    const kind = S.kinds[S.k]; showShape(w, kind, false); S.shown.push(kind);
    ctx.say(OUT_SAY[kind] || 'רידיקולוס! 😂', null, 3.2);
  }
  function knock() {
    if (S.knock || ctx.step !== 1) return; const w = W(); if (!w) return;
    S.knock = 0.001; ctx.poke(); w.knock = 1.6;
    for (let i = 0; i < 3; i++) tone(190, 0.07, i * 0.2, 'square', 0.08, 150);
    ctx.say('טוק-טוק-טוק! 🚪 משהו מקשקש בפנים...', null, 3);
  }
  function thanks() {
    if (S.thanks || ctx.step !== 4) return; const w = W(); if (!w) return;
    S.thanks = 0.001; ctx.poke(); w.happy = 2.2; sfx('heart'); sfx('chime');
    wardW(v1, 1.6); burst(v1.x, v1.y, v1.z, 0xff9ad8, 24, 2.2, 1.0, 0.26, -0.6);
    ctx.say('השיער שלי נהיה ורוד-זהב מרוב שמחה! כל הכבוד, הארי! 🩷✨', TONKS_WHO, 5);
  }
  // face Harry toward the stage and swing the lens behind-beside him, a little higher, so he never hides it
  function frame() {
    try {
      // a portrait phone: a flatter, closer lens swung to the side, so the shape sits mid-screen under the hint bubble (which is
      // pinned high on phones) and beside Harry, never behind him
      const phone = innerWidth / Math.max(1, innerHeight) < 0.8;
      const yaw = Math.atan2(STAGE.x - player.pos.x, STAGE.z - player.pos.z), C = player.cam, side = phone ? 0.35 : 0.5;
      player.yaw = yaw; if (player.model) player.model.rotation.y = yaw;
      if (C) { C.yaw = yaw + Math.PI + side; C.pitch = phone ? 0.12 : 0.32; C.dist = phone ? 4.6 : Math.min(C.dist || 6, 5.4); C.userControlled = false; C.idle = 0; }
    } catch { /* ok */ }
  }
  function standAt() { player.yaw = Math.atan2(STAGE.x - SPOT.x, STAGE.z - SPOT.z); player.teleport(SPOT.x, SPOT.z); frame(); }

  // ---- per frame ----
  function update(dt, step) {
    S.t += dt;
    const w = W();
    if (S.reframe && w) { S.reframe = false; standAt(); }
    // 1: arriving at the Defence corner
    if (step === 0 && inCls() && Math.hypot(player.pos.x - SPOT.x, player.pos.z - SPOT.z) < 3.4) { ctx.say('הנה טונקס, והארון המקשקש! 🚪', null, 3); done(0); }
    if (step === 1 && S.knock > 0) { S.knock += dt; if (S.knock > 1.7) done(1); }
    if (step === 4 && S.thanks > 0) { S.thanks += dt; if (S.thanks > 2.4) done(4); }
    // the shapes: one at a time
    if (w && (step === 2 || step === 3) && w.ph === 'none' && !w.onIn) {
      const more = step === 2 ? S.k < S.N - 1 : !S.done[3];
      if (more) { S.spawnT -= dt; if (S.spawnT <= 0) { S.spawnT = 1.2; spawn(); } }
    }
    // the 😂 prompt (level 1 at once; levels 2-3 after a little while) and the "ביחד!" assist
    if (w && (step === 2 || step === 3) && w.ph === 'wait') {
      if (lv() === 1 || (w.waitT || 0) > 8) { try { fun.offer('adv-riddikulus', '😂', 0.05, () => { sparkTo(); riddi(); }); } catch { /* ok */ } }
      if (S.assist) { S.assistT += dt; if (S.assistT > 0.9) { sparkTo(); riddi(); } }
    }
    // glow: sparkles on the wardrobe (steps 2 / 5) or the waiting shape
    if (w && (lv() === 1 || S.glowHint) && Math.random() < dt * 4) {
      if ((step === 1 && !S.knock) || (step === 4 && !S.thanks)) { wardW(v1, 0.6 + Math.random() * 1.6); emit(v1.x + (Math.random() - 0.5) * 1.0, v1.y, v1.z + (Math.random() - 0.5) * 0.6, 0, 0.3, 0, 0.8, 0.2, 0xffe07a, 0); }
      else if ((step === 2 || step === 3) && w.ph === 'wait') { stageW(v1, 0.3 + Math.random() * 1.0); emit(v1.x + (Math.random() - 0.5) * 0.9, v1.y, v1.z + (Math.random() - 0.5) * 0.9, 0, 0.3, 0, 0.8, 0.18, 0xff9ad8, 0); }
    }
    // casts: Riddikulus on the shape is the target; anything else gets a kind word
    const n = casts();
    if (n !== S.casts0) {
      S.casts0 = n; const k = freecast && freecast.selected ? freecast.selected() : null, hit = S.castHit; S.castHit = false;
      if (!hit && inCls()) {
        if ((step === 2 || step === 3) && w && w.ph === 'wait') { S.wrong++; if (k === 'riddikulus') ctx.say('עוד קצת קרוב לארון, ושוב רידיקולוס! 😂', null, 3); else ctx.oops('לחש יפה! אבל כדי שיהיה מצחיק צריך רידיקולוס 😂'); }
        else if (step === 1 && !S.knock) ctx.say('קודם דופקים על הארון 🚪 גע בו!', null, 3);
      }
    }
  }
  function sparkTo() { stageW(v2, 0.8); const s = player.model ? player.model.scale.y || 1 : 1; v1.set(player.pos.x, player.pos.y + 1.3 * s, player.pos.z); for (let i = 0; i < 10; i++) { const k = i / 10; emit(v1.x + (v2.x - v1.x) * k, v1.y + (v2.y - v1.y) * k, v1.z + (v2.z - v1.z) * k, 0, 0.2, 0, 0.5 + k * 0.3, 0.2, 0xff9ad8, 0); } }

  // ---- taps ----
  function tap(x, y, step) {
    if (!inCls() || !W()) return false;
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    const rr = R(), dW = near(wardW(v1, 1.1)), dS = W().shape ? near(stageW(v2, 0.7)) : 1e9;
    if (step === 1) { if (dW < rr * 2.4) { knock(); return true; } return false; }
    if (step === 4) { if (dW < rr * 2.4 || near(v1.set(TONKS.x, Y() + 1.3, TONKS.z)) < rr * 1.6) { thanks(); return true; } return false; }
    if ((step === 2 || step === 3) && (dS < rr * 2 || dW < rr * 2)) { ctx.say('הטל רידיקולוס מהשרביט, או גע בכפתור 😂', null, 3); return true; }
    return false;
  }
  // ---- the arrow ----
  function goal(step, out) {
    if (!inCls()) return ctx.routeTo('classrooms', out, ['staircase', 'entrancehall']);
    const w = W();
    if (step === 0) return out.set(SPOT.x, Y(), SPOT.z);
    if (!w) return null;
    if (step === 1) return S.knock ? null : wardW(out, 1.5);
    if (step === 4) return S.thanks ? null : wardW(out, 1.5);
    if ((step === 2 || step === 3) && w.ph === 'wait') return stageW(out, 0.85);
    return null;
  }
  function begin(step, resumed) {
    if (!S.inited) { S.inited = true; S.N = NSHAPES[lv()] || 3; S.kinds = KINDS.slice(0, S.N); }   // the level: read at run time
    S.active = true; QUEST.on = true;
    S.spawnT = 1.3; S.sneezed = false; S.assist = false; S.assistT = 0; S.knock = 0; S.thanks = 0;
    if (step <= 2) S.k = 0;
    if (step === 3) S.k = S.N - 1;
    const w = W(); if (w && w.shape) { w.onIn = null; dropShape(w); }
    if (step === 1) ctx.say('שלום! אני טונקס 🩷 בארון הזה גר בוגארט. משהו קצת מפחיד יוצא - ואז נהפוך אותו למצחיק! דפוק על הארון 🚪', TONKS_WHO, 6.5);
    if (step === 2 && !resumed) ctx.say('כשמשהו יוצא, הטל רידיקולוס! 😂', TONKS_WHO, 4);
    if (step === 3) ctx.say('האחרון הכי עקשן... אולי יצטרך שני לחשים! 😉', TONKS_WHO, 4);
    if (step === 4) ctx.say('הבוגארט צוחק בתוך הארון! 😂 גע בארון כדי להגיד תודה', TONKS_WHO, 4.5);
    if (step === 0) return;   // the child walks there (the arrow leads)
    if (inCls()) { if (w) standAt(); else S.reframe = true; }
    else { interiors.enter('classrooms', { x: SPOT.x, z: SPOT.z, yaw: Math.atan2(STAGE.x - SPOT.x, STAGE.z - SPOT.z) }); S.reframe = true; }
  }
  function glow(step, on) { S.glowHint = !!on; }
  function together(step, fast) {
    const soon = (ok, fn, n = 0) => { if (!S.active) return; if (ok()) { try { fn(); } catch (e) { console.warn('[b3-boggart] together -', e && e.message || e); } return; } if (n < 80) setTimeout(() => soon(ok, fn, n + 1), 250); };
    const there = (fn) => { if (!(inCls() && W())) { interiors.enter('classrooms', { x: SPOT.x, z: SPOT.z, yaw: 0 }); S.reframe = true; } soon(() => inCls() && W(), fn); };
    if (step === 0) { there(() => { standAt(); done(0); }); return; }
    if (step === 1) { there(() => { knock(); if (fast) S.knock = Math.max(S.knock, 1.65); }); return; }
    if (step === 2 || step === 3) { if (fast) { const w = W(); if (w) { w.onIn = null; dropShape(w); } done(step); return; } there(() => { S.assist = true; }); return; }
    if (step === 4) { there(() => { thanks(); if (fast) S.thanks = Math.max(S.thanks, 2.35); }); }
  }
  function end() {
    S.active = false; QUEST.on = false;
    if (FI && Array.isArray(FI.TARGETS)) for (const t of T) { const i = FI.TARGETS.indexOf(t); if (i >= 0) FI.TARGETS.splice(i, 1); }
    FREE.done = readDone();
    const w = W(); if (w) { w.onIn = null; dropShape(w); }
    try { css.remove(); } catch { /* ok */ }
  }
  function state() {
    const w = W();
    return { room: interiors.active, ward: w ? { visible: w.g.visible && !!w.g.parent, ph: w.ph, door: +w.door.toFixed(2) } : null,
      shape: w && w.shape ? { kind: w.shape.kind, visible: w.shape.g.visible && w.shape.body.visible, silly: w.shape.silly.visible, ph: w.ph } : null,
      shapeTris: w ? w.shapeTris || null : null, wardTris: w ? w.wardTris : null, k: S.k, N: S.N, kinds: S.kinds, sneezed: S.sneezed, knock: S.knock > 0, thanks: S.thanks > 0,
      wrong: S.wrong, assist: S.assist, shown: S.shown.slice(), sillied: S.sillied.slice(), prompt: (() => { try { return fun.promptId ? fun.promptId() : null; } catch { return null; } })(), free: FREE_API.state() };
  }
  ctx._bog = {
    wardW: () => (W() ? wardW(new Vector3(), 1.1) : null),
    shapeW: () => (W() && W().shape ? stageW(new Vector3(), 0.7) : null),
    tonksW: () => (inCls() ? new Vector3(TONKS.x, Y() + 1.3, TONKS.z) : null),
    spot: SPOT, stage: STAGE, free: FREE_API,
  };
  return { begin, update, goal, tap, glow, together, end, state };
}
