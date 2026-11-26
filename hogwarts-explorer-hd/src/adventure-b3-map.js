// Book 3, adventure 3: "מפת הטרדנים" (the Marauder's Map), helper Ron. Data for adventures.js + the scene code.
// Decisions: briefs/2026-11-26-book3-piece-b.md. The parchment itself is marauder-map.js (a DOM overlay, shared with free play).
// Steps: 1 the common room: a folded parchment glows on a little side table: tap it -> 2 say the words: big tiles spell
// "אני נשבע" (level 1: the next tile glows; levels 2-3: shuffled, plus "בחגיגיות"); the oath is read aloud and the castle
// plan draws itself -> 3 the map: little labelled footprints (Harry, Ron, Hermione, the roaming teachers at their places,
// Hagrid, Buckbeak) and a pulsing secret passage: tap it; the map closes and the arrow leads to the staircase hall, where a
// round one-eyed witch statue slides aside on a tap -> 4 Honeydukes ('b3honey', a small bright sweet shop): collect 5 / 7 / 9
// glowing sweets; Filch shuffles past the window on a slow loop: when his lantern light falls in, "פססס, מתחבאים!" and Harry
// ducks behind the barrel by himself for 2 s (taps wait; never a fail; Filch never chases, never catches, no spell ever acts
// on him: a cast in the shop gets a kind bubble) -> 5 back through the trapdoor; the map opens: tap "השובבות הסתיימה".
// Free play (from a fresh save): the statue in the staircase hall slides aside on a tap and the passage leads to Honeydukes,
// where sweets can be collected any time (+5 once per session); Filch only passes the window. Hidden / inactive while an
// adventure, a lesson / course, Quidditch or the Floo runs. Debug: window.__b3honey (state, sweetW, statueW, ...).
import { Vector3, Matrix4 } from 'three';
import { BUILDERS, FLOOR_Y } from './rooms.js';
import { buildTable, buildStatue, buildHoney, roomLight, drawCount, triCount, TABLE, STATUE, HSPAWN, TRAP, HIDE, WIN, FILCH_Z, SWEET_SPOTS } from './adventure-b3-map-build.js';
import { openParchment, setPhase, setOpts, close as closeParchment, glowHint, sayLine, MM } from './marauder-map.js';

const RON = { ico: '👦', name: 'רון' };
const RON_WHO = '👦 רון', FILCH_WHO = '🏮 פילץ\'';
const NSWEETS = { 1: 5, 2: 7, 3: 9 }, FREE_N = 5;
export const B3MAP = {
  id: 'b3-map', book: 3, title: 'מפת הטרדנים', ico: '🗺️', col: '#4a3418', col2: '#d8b878', helper: RON, confetti: ['✨', '👣', '🍬', '📜'],
  pic: [['🗺️', 0.5, 0.56, 66], ['👣', 0.22, 0.3, 28], ['🍬', 0.8, 0.3, 28]],
  intro: [
    'הפעם רון גילה סוד: קלף ישן ומקופל בחדר המועדון 📜',
    'זו מפת הטרדנים! מי שאומר את המילים הנכונות רואה את כל הטירה... ואת כל מי שבה 👣',
    'ויש בה מעבר סודי לחנות הממתקים הכי טעימה! בוא נלך 🍬',
  ],
  steps: [
    { line: 'מצא את הקלף בחדר המועדון וגע בו 📜', hints: ['הקלף המקופל מחכה בחדר המועדון 📜', 'הוא מונח על שולחן קטן ועגול. גע בו!', 'לך אחרי החץ הזהוב אל השולחן 📜'], glowL1: true },
    { line: 'אמור את המילים: גע במילים לפי הסדר ✨', hints: ['מתחילים ב"אני" ✨', 'גע במילים לפי הסדר: אני... נשבע...', 'המילה הבאה זוהרת. גע בה!'] },
    { line: 'גע במעבר הסודי, ואז בפסל במדרגות 🗿', hints: ['רואה את הקו הוורוד המהבהב במפה? גע בו ✨', 'המעבר מתחיל בפסל המכשפה במדרגות הנעות 🗿', 'גע בפסל העגול, והוא יזוז הצידה!'], glowL1: true },
    { line: 'אסוף ממתקים זוהרים בהוניידוקס 🍬', hints: ['הקופסאות הזוהרות הן הממתקים. גע בהן 🍬', 'יש ממתקים על המדפים ועל הדלפק', 'הקופסה הזוהרת הבאה מחכה לך! 🍭'], glowL1: true },
    { line: 'חוזרים במעבר וסוגרים את המפה 🤫', hints: ['לך אל דלת הרצפה הפתוחה בפינה 🕳️', 'המפה נפתחת: גע ב"השובבות הסתיימה" 🤫', 'גע בכפתור הזהוב במפה 🤫'], glowL1: true },
  ],
  create: (ctx) => mapScene(ctx),
  art: drawMapCard,
};

// the reward card: the open parchment with footprints and a striped Honeydukes box
function drawMapCard(x, cx, cy) {
  const g = x.createLinearGradient(0, cy - 140, 0, cy + 130); g.addColorStop(0, '#f2dcae'); g.addColorStop(1, '#d8b878'); x.fillStyle = g; x.fillRect(cx - 120, cy - 150, 240, 290);
  x.save(); x.translate(cx, cy - 10); x.rotate(-0.08);
  x.fillStyle = '#f6e8c4'; x.fillRect(-92, -86, 184, 150); x.strokeStyle = '#8a5a1a'; x.lineWidth = 3; x.strokeRect(-92, -86, 184, 150);
  x.strokeStyle = '#5a2a0a'; x.lineWidth = 2; for (const [a, b, w, h] of [[-80, -74, 70, 50], [-2, -74, 80, 50], [-80, -16, 158, 40]]) x.strokeRect(a, b, w, h);
  x.fillStyle = '#5a2a0a'; for (const [a, b] of [[-50, -50], [-40, -40], [30, -52], [40, -42], [-20, 8], [-10, 16], [40, 4], [50, 12]]) { x.beginPath(); x.ellipse(a, b, 3.5, 6, 0.2, 0, 7); x.fill(); }
  x.strokeStyle = '#c82a6a'; x.setLineDash([6, 5]); x.lineWidth = 3; x.beginPath(); x.moveTo(60, 30); x.quadraticCurveTo(90, 60, 70, 90); x.stroke(); x.setLineDash([]);
  x.restore();
  x.save(); x.translate(cx + 66, cy + 92); x.rotate(0.2); x.fillStyle = '#e87aa8'; x.fillRect(-24, -16, 48, 32); x.fillStyle = '#fff4f0'; x.fillRect(-4, -16, 8, 32); x.fillRect(-24, -3, 48, 6); x.restore();
  x.save(); x.font = '28px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('✨', cx - 86, cy + 92); x.fillText('🍭', cx - 90, cy - 110); x.restore();
}

// ---------------- shared state: the statue (staircase hall) and Honeydukes, used by the quest and free play ----------------
const HS = { quest: false, questOpen: false, openT: 0, slide: 0, leftHoney: -1e9, room: null, stair: null, paid: false, got: 0, err: 0, tap: false, casts0: -1, saidCast: 0, filchPass: 0, visits: 0 };
const sfx = (k, ...a) => { try { const s = window.HPFun && window.HPFun.sfx; if (s && s[k]) s[k](...a); } catch { /* no audio */ } };
const fxBurst = (...a) => { try { const fi = window.__game && window.__game.freecast && window.__game.freecast._internal; if (fi && fi.burst) fi.burst(...a); } catch { /* ok */ } };
const fxEmit = (...a) => { try { const fi = window.__game && window.__game.freecast && window.__game.freecast._internal; if (fi && fi.emit) fi.emit(...a); } catch { /* ok */ } };
const _v = new Vector3(), _w = new Vector3();
function freeBusy() {
  const c = document.body.classList;
  return c.contains('inSpell') || c.contains('inMatch') || c.contains('inFloo') || c.contains('inAdv') || c.contains('modalOn') || c.contains('mmOn') || !!(window.__game && window.__game.takeover);
}
const statueOpen = () => HS.openT > 0 || (HS.quest && HS.questOpen);

// the staircase hall: the statue is part of the hall (every build), like the stone quest's door
const baseStair = BUILDERS.staircase;
if (baseStair) BUILDERS.staircase = (...a) => {
  const r = baseStair(...a), add = (x) => { try { addStatue(x); } catch (e) { console.warn('[b3-map] statue skipped -', e && e.message || e); } return x; };
  return r && typeof r.then === 'function' ? r.then(add) : add(r);
};
function addStatue(r) {
  if (!r || !r.group || r.group.userData.b3statue) return;
  const T = buildStatue(); r.group.add(T.g); r.group.userData.b3statue = T;
  T.col = { type: 'box', x: STATUE.x, z: STATUE.z, hw: 0.6, hd: 0.45, angle: 0, b3: true }; r.colliders.push(T.col);
  r.portals.push({ x: STATUE.x, z: STATUE.z - 0.05, r: 0.62, to: 'b3honey', at: { ...HSPAWN }, armed: false, locked: () => !statueOpen() });
  T.tris = triCount(T.g);
  if (performance.now() - HS.leftHoney < 4000) { HS.openT = Math.max(HS.openT, 5); HS.slide = 1; }   // back from Honeydukes: the statue still stands aside
  else if (!statueOpen()) HS.slide = 0;
  const up = r.update;
  r.update = (dt, t) => { if (up) up(dt, t); try { stairTick(T, dt); } catch (e) { if (!HS.err++) console.warn('[b3-map] statue tick failed -', e && e.message || e); } };
  HS.stair = T;
}
function stairTick(T, dt) {
  installTap();
  if (HS.openT > 0) {   // free play: it slides back once Harry has walked away (or went through)
    let far = true; try { const p = window.__game.player.pos; far = Math.hypot(p.x - STATUE.x, p.z - STATUE.z) > 4.5; } catch { far = true; }
    if (far || freeBusy()) HS.openT -= dt;
  }
  const want = statueOpen() ? 1 : 0;
  HS.slide += (want - HS.slide) * Math.min(1, dt * (want ? 1.6 : 2.2));
  if (Math.abs(want - HS.slide) < 0.002) HS.slide = want;
  const k = HS.slide;
  T.body.position.x = k * STATUE.slide; T.body.rotation.z = Math.sin(k * Math.PI) * 0.03;
  T.col.x = STATUE.x + k * STATUE.slide;
  T.hole.visible = k > 0.02;
  if (k > 0.5 && Math.random() < dt * 5) { const y = roomY(); fxEmit(STATUE.x + (Math.random() - 0.5) * 0.8, y + 0.4 + Math.random() * 1.6, STATUE.z + 0.3, 0, 0.3, -0.2, 0.9, 0.2, 0xffd890, 0); }
}
function openStatue(free) {
  if (statueOpen() && HS.slide > 0.5) return false;
  if (free) HS.openT = 20; else HS.questOpen = true;
  sfx('whoosh'); try { window.HPFun.sfx.tone(140, 0.6, 'sawtooth', 0.04, 0, 90); } catch { /* ok */ }
  stW(_w, 1.2); fxBurst(_w.x, _w.y, _w.z, 0xffd76a, 20, 2, 0.9, 0.24, -0.6);
  return true;
}
function roomY() { try { const r = window.__game.interiors.room; return r && r.group ? r.group.position.y : FLOOR_Y; } catch { return FLOOR_Y; } }
const stW = (out, y = 1.2) => out.set(STATUE.x + HS.slide * STATUE.slide * 0, roomY() + y, STATUE.z);

// ---------------- Honeydukes (always registered) ----------------
BUILDERS.b3honey = () => {
  const B = buildHoney(); const g = B.g; g.position.y = FLOOR_Y; g.userData.honey = B;
  const L = roomLight(g, { amb: 1.15, ambC: 0xfff0e0, hemi: 1.05, sky: 0xfff4fa, ground: 0x9a7a6a, fogC: 0xf0d8e0, fogD: 0.004, bg: 0xe8c8d0 });
  const marker = g.children.find(o => o.name === 'b3-light'); if (marker) { const r0 = marker.userData.onTeardown; marker.userData.onTeardown = () => { r0(); HS.leftHoney = performance.now(); if (HS.room === room) HS.room = null; }; }
  Object.assign(B, { filchX: -7, filchDir: 1, T: 0, got: new Array(SWEET_SPOTS.length).fill(true), shown: new Array(SWEET_SPOTS.length).fill(false), free: false, duck: 0, ducked: false, L, tris: 0, draws: 0 });
  const room = {
    group: g, colliders: B.cols, portals: [{ x: TRAP.x, z: TRAP.z, r: 0.7, to: 'staircase', at: { x: STATUE.x, z: STATUE.z - 1.7, yaw: Math.PI }, armed: false }],
    spawn: { x: HSPAWN.x, z: HSPAWN.z, y: FLOOR_Y, yaw: HSPAWN.yaw },
    update(dt) { try { honeyTick(B, dt); } catch (e) { if (!HS.err++) console.warn('[b3-map] honey tick failed -', e && e.message || e); } },
  };
  HS.room = room; HS.visits++;
  if (!HS.quest) freeSweets(B);
  B.tris = triCount(g);
  return room;
};
function setSweets(B, list) {   // list: indices to show (the rest are hidden)
  for (let i = 0; i < SWEET_SPOTS.length; i++) { const on = list.includes(i); B.shown[i] = on; B.got[i] = !on; }
  B.dirty = true;
}
// free play: FREE_N random spots, never the barrel lid (it sits right under the lens and the buttons there)
function freeSweets(B) { const idx = SWEET_SPOTS.map((_, i) => i).filter(i => i !== 9).sort(() => Math.random() - 0.5).slice(0, FREE_N); setSweets(B, idx); B.free = true; HS.got = 0; }
const _mat = { m: new Matrix4() };
function honeyTick(B, dt) {
  installTap();
  B.L.apply();
  B.T += dt; const T = B.T;
  // Filch: a slow, slightly comic shuffle past the window, back and forth (he never comes in)
  const spd = HS.quest ? 0.75 : 0.85;
  B.filchX += B.filchDir * spd * dt;
  if (B.filchX > 7.5) { B.filchDir = -1; B.ducked = false; } else if (B.filchX < -7.5) { B.filchDir = 1; B.ducked = false; }
  const F = B.F; F.g.position.set(B.filchX, Math.abs(Math.sin(T * 4.2)) * 0.03, FILCH_Z); F.g.rotation.set(0, B.filchDir > 0 ? 0 : Math.PI, Math.sin(T * 4.2) * 0.04);
  F.g.updateMatrixWorld(true); _v.copy(F.lantern).applyMatrix4(F.g.matrixWorld);
  B.lglow.position.copy(_v).sub(B.g.position); B.lglow.quaternion.copy(cam().quaternion); B.lglow.scale.setScalar(1 + Math.sin(T * 7) * 0.08);
  const near = Math.max(0, 1 - Math.abs(B.filchX - WIN.x) / 3.2);
  B.pool.material.opacity = 0.55 * near; B.pool.position.x = B.filchX * 0.5; B.pool.visible = near > 0.01;
  // sweets: collected ones vanish; the rest glow softly
  const M = _mat.m;
  for (let i = 0; i < SWEET_SPOTS.length; i++) {
    const s = SWEET_SPOTS[i], on = B.shown[i] && !B.got[i], k = on ? 1 + Math.sin(T * 3 + i) * 0.06 : 0.0001;
    M.makeRotationY(T * 0.6 + i); M.scale(_w.set(k, k, k)); M.setPosition(s[0], s[1] + (on ? Math.sin(T * 2 + i) * 0.03 : 0), s[2]); B.sweets.setMatrixAt(i, M);
  }
  B.sweets.instanceMatrix.needsUpdate = true;
  B.sweetMat.emissiveIntensity = 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(T * 4));
  B.trapGlow.material.opacity = 0.6 + 0.25 * Math.sin(T * 2.5);
  // a spell in the shop: never on Filch (nobody gets a spell); a kind word instead
  let n = -1; try { n = window.__game.freecast._internal.log.casts; } catch { n = -1; }
  if (HS.casts0 < 0) HS.casts0 = n;
  if (n !== HS.casts0) { HS.casts0 = n; castWord(); }
  if (!HS.quest && !B.framed) { B.framed = true; try { const C = window.__game.player.cam; C.yaw = window.__game.player.yaw + Math.PI + 0.55; C.pitch = 0.3; C.dist = 4.2; C.userControlled = false; } catch { /* ok */ } }   // the lens beside Harry: the window stays in view
  if (!HS.quest) freeHoneyTick(B, dt);
  if (HS.honeyHook) { try { HS.honeyHook(B, dt); } catch (e) { if (!HS.err++) console.warn('[b3-map] honey hook -', e && e.message || e); } }
}
const CAST_WORD = 'בחנות הממתקים לא צריך לחשים, ועל פילץ\' אף פעם לא מטילים לחש 🙂 רק אוספים ממתקים בשקט!';
function castWord() {
  HS.saidCast++;
  if (HS.quest && HS.qctx) { HS.qctx.say(CAST_WORD, RON_WHO, 4); return; }
  try { const p = window.__game.player.pos; window.HPFun.say(_w.set(p.x, p.y + 2.2, p.z), CAST_WORD, 4); } catch { /* ok */ }
}
function cam() { return window.__game.camera; }
function freeHoneyTick(B, dt) {
  if (freeBusy()) return;
  // level-1-like sparkles on the free sweets
  if (Math.random() < dt * 3) { const i = Math.floor(Math.random() * SWEET_SPOTS.length); if (B.shown[i] && !B.got[i]) { const s = SWEET_SPOTS[i]; fxEmit(s[0] + (Math.random() - 0.5) * 0.4, roomY() + s[1] + 0.3, s[2] + (Math.random() - 0.5) * 0.4, 0, 0.3, 0, 0.8, 0.18, 0xffe07a, 0); } }   // (no allocation)
}
function collect(B, i, free) {
  if (!B.shown[i] || B.got[i]) return false;
  B.got[i] = true; const s = SWEET_SPOTS[i], y = roomY();
  fxBurst(s[0], y + s[1] + 0.2, s[2], 0xff9ad8, 18, 2.2, 0.8, 0.24, -0.8); fxBurst(s[0], y + s[1] + 0.2, s[2], 0xffe27a, 10, 1.6, 0.7, 0.2, -0.6);
  sfx('munch'); setTimeout(() => sfx('tink', 3), 160);
  if (free) {
    HS.got++;
    const left = B.shown.filter((on, k) => on && !B.got[k]).length;
    try { window.HPFun.toast('🍬', HS.got + ' / ' + FREE_N, 900); } catch { /* ok */ }
    if (!left && !HS.paid) { HS.paid = true; try { window.HPLessons.progress.bonus(5); } catch { /* lessons not loaded */ } setTimeout(() => { try { window.HPFun.toast('✨⭐', '+5 נקודות לבית!', 1600); } catch { /* ok */ } }, 950); }
    if (!left) setTimeout(() => { const r = HS.room; if (r && r.group.userData.honey === B && !HS.quest) freeSweets(B); }, 6000);   // a fresh batch a little later
  }
  return true;
}
const sweetW = (i, out = new Vector3()) => { const s = SWEET_SPOTS[i]; return out.set(s[0], roomY() + s[1] + 0.14, s[2]); };
function curHoney() { try { const g = window.__game; return g.interiors.active === 'b3honey' && g.interiors.room && g.interiors.room.group ? g.interiors.room.group.userData.honey || null : null; } catch { return null; } }
function curStatue() { try { const g = window.__game; return g.interiors.active === 'staircase' && g.interiors.room && g.interiors.room.group ? g.interiors.room.group.userData.b3statue || null : null; } catch { return null; } }
// the nearest on-screen sweet to a tap (or -1)
function sweetAt(B, x, y, R) {
  const c = window.__game.adventures && window.__game.adventures._ctx; if (!c) return -1;
  let best = -1, bd = 1e9;
  for (let i = 0; i < SWEET_SPOTS.length; i++) { if (!B.shown[i] || B.got[i]) continue; const s = c.screen(sweetW(i, _v)); if (!s.on) continue; const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = i; } }
  return bd < R ? best : -1;
}
const tapR = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08) * 1.6;
// taps in free play (adventures.js routes taps only to a running quest): the statue and the sweets
function installTap() {
  if (HS.tap) return; const view = document.getElementById('view'); if (!view) return;
  HS.tap = true; let down = null;
  view.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; }, { passive: true });
  view.addEventListener('pointerup', (e) => {
    const d0 = down; down = null;
    try {
      if (!d0 || d0.id !== e.pointerId || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 18 || performance.now() - d0.t > 900 || freeBusy()) return;
      const c = window.__game.adventures && window.__game.adventures._ctx; if (!c) return;
      const B = curHoney();
      if (B) { const i = sweetAt(B, e.clientX, e.clientY, tapR()); if (i >= 0) collect(B, i, true); return; }
      const T = curStatue();
      if (T && HS.slide < 0.5) {
        const p = window.__game.player.pos, s = c.screen(stW(_v, 1.2));
        if (s.on && Math.hypot(s.x - e.clientX, s.y - e.clientY) < tapR() * 1.3 && Math.hypot(p.x - STATUE.x, p.z - STATUE.z) < 10) openStatue(true);
      }
    } catch { /* never break the game's own taps */ }
  }, { passive: true });
}
const FREE_API = {
  state: () => { const B = curHoney(), T = curStatue(); return { quest: HS.quest, paid: HS.paid, got: HS.got, visits: HS.visits, busy: freeBusy(), slide: +HS.slide.toFixed(2), open: statueOpen(), saidCast: HS.saidCast,
    statue: T ? { visible: T.g.visible && T.body.visible && !!T.g.parent, hole: T.hole.visible, tris: T.tris } : null,
    honey: B ? { sweets: B.shown.map((on, i) => ({ i, on, got: B.got[i] })).filter(s => s.on), filchX: +B.filchX.toFixed(2), filchVisible: B.F.g.visible && B.F.body.visible, tris: B.tris, draws: drawCount(B.g) } : null }; },
  statueW: () => (curStatue() ? stW(new Vector3(), 1.2) : null),
  sweetW: (i) => (curHoney() ? sweetW(i) : null),
  sweets: () => { const B = curHoney(); return B ? B.shown.map((on, i) => (on && !B.got[i] ? i : -1)).filter(i => i >= 0) : []; },
  filchW: () => { const B = curHoney(); return B ? new Vector3(B.filchX, roomY() + 1.5, FILCH_Z) : null; },
  filchTo: (x) => { const B = curHoney(); if (B) { B.filchX = x; B.filchDir = x < 0 ? 1 : -1; B.ducked = false; } return !!B; },
  trapW: () => (curHoney() ? new Vector3(TRAP.x, roomY() + 0.3, TRAP.z) : null),
};
try { if (/[?&]debug=1/.test(location.search)) window.__b3honey = FREE_API; } catch { /* ok */ }

// ---------------- the quest scene ----------------
function mapScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit } = ctx;
  const S = { active: false, done: {}, inited: false, N: 5, sub: 'map', table: null, tableRoom: null, tapT: 0, glowHint: false, assist: false, assistT: 0, duck: 0, ducks: 0, back: null, slideT: 0,
    reframe: null, shownIdx: [], got: 0, managedOpen: false, filchSaid: 0, t: 0, wrong: 0, passage: 0, openedFrom: null };
  const lv = () => ctx.level;
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const inRoom = (id) => interiors.active === id && interiors.room && interiors.room.group;
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3();
  const Y = () => (interiors.room && interiors.room.group ? interiors.room.group.position.y : FLOOR_Y);
  HS.qctx = ctx;

  // ---- the parchment on the common room table (only while the quest needs it) ----
  function tableTick() {
    const want = S.active && ctx.step === 0 && inRoom('commonroom');
    if (want && (!S.table || S.tableRoom !== interiors.room)) { dropTable(); S.table = buildTable(); interiors.room.group.add(S.table); S.tableRoom = interiors.room; S.tcol = { type: 'circle', x: TABLE.x, z: TABLE.z, r: 0.5, b3: true }; interiors.room.colliders.push(S.tcol); }
    else if (!want && S.table) dropTable();
  }
  function dropTable() {
    if (!S.table) return;
    if (S.table.parent) S.table.parent.remove(S.table);
    S.table.traverse(o => { if (o.isMesh) { try { o.geometry.dispose(); } catch { /* backend quirk */ } } });
    const cs = S.tableRoom && S.tableRoom.colliders, i = cs ? cs.indexOf(S.tcol) : -1; if (i >= 0) cs.splice(i, 1);
    S.table = null; S.tableRoom = null; S.tcol = null;
  }
  const tableW = (out = new Vector3()) => out.set(TABLE.x, Y() + 0.85, TABLE.z);

  // ---- the parchment overlay ----
  function openOath() {
    openParchment({ mode: 'quest', phase: 'oath', level: lv(), speak: (t) => ctx.speak(t), onWrong: (t) => { S.wrong++; ctx.oops(t); }, onOath: () => { ctx.poke(); done(1); } });
  }
  function openMap() {
    if (!MM.state().open) openParchment({ mode: 'quest', phase: 'map', level: lv(), speak: (t) => ctx.speak(t), onPassage: passage });
    else { setOpts({ onPassage: passage }); setPhase('map'); }
  }
  function passage() {
    if (ctx.step !== 2 || S.sub !== 'map') return;
    S.passage++; S.sub = 'statue'; ctx.poke(); sfx('sparkle');
    sayLine('המעבר מתחיל בפסל המכשפה במדרגות הנעות! 🗿');
    setTimeout(() => { if (S.active && ctx.step === 2) { closeParchment(); ctx.say('ראית? המעבר הסודי מתחיל בפסל המכשפה במדרגות! בוא 🗿', RON_WHO, 4); } }, 1600);
  }
  function openManage() {
    S.managedOpen = true;
    openParchment({ mode: 'quest', phase: 'manage', level: lv(), speak: (t) => ctx.speak(t), onManaged: () => { ctx.poke(); setTimeout(() => { closeParchment(); done(4); }, 300); } });
    ctx.say('עכשיו סוגרים את המפה בסוד: גע ב"השובבות הסתיימה" 🤫', RON_WHO, 4);
  }

  // ---- framing (Harry turns toward the thing; the lens behind-beside him so he never hides it) ----
  function frame(tx, tz, opt = {}) {
    try {
      const phone = innerWidth / Math.max(1, innerHeight) < 0.8;
      const yaw = Math.atan2(tx - player.pos.x, tz - player.pos.z), C = player.cam, side = opt.side != null ? opt.side : (phone ? 0.3 : 0.45);
      player.yaw = yaw; if (player.model) player.model.rotation.y = yaw;
      if (C) { C.yaw = yaw + Math.PI + side; C.pitch = opt.pitch != null ? opt.pitch : (phone ? 0.14 : 0.3); C.dist = opt.dist || (phone ? 3.6 : Math.min(C.dist || 5, 4.4)); C.userControlled = false; C.idle = 0; }
    } catch { /* ok */ }
  }
  function nextSweet() { const B = curHoney(); if (!B) return -1; let best = -1, bd = 1e9; for (let i = 0; i < SWEET_SPOTS.length; i++) { if (!B.shown[i] || B.got[i]) continue; const s = SWEET_SPOTS[i], d = Math.hypot(s[0] - player.pos.x, s[2] - player.pos.z); if (d < bd) { bd = d; best = i; } } return best; }
  function faceNext() { const i = nextSweet(); if (i >= 0) { const s = SWEET_SPOTS[i]; frame(s[0], s[2], { pitch: 0.22, dist: 3.4 }); } }

  // ---- Honeydukes: the quest's part of the shop tick (sweets, the Filch duck) ----
  HS.honeyHook = (B, dt) => {
    if (!S.active || ctx.step !== 3) return;
    if (!S.inited3) { S.inited3 = true; questSweets(B); }
    // level-1 / glow-hint sparkles on the sweets
    if ((lv() === 1 || S.glowHint) && Math.random() < dt * 5) { const i = nextSweet(); if (i >= 0) { sweetW(i, v1); emit(v1.x + (Math.random() - 0.5) * 0.5, v1.y + 0.1, v1.z + (Math.random() - 0.5) * 0.5, 0, 0.3, 0, 0.8, 0.2, 0xffe07a, 0); } }
    // Filch's lantern falls into the shop: Harry ducks behind the barrel by himself for 2 s (never a fail)
    if (!S.duck && !B.ducked && Math.abs(B.filchX - WIN.x) < 1.0) { B.ducked = true; startDuck(); }
    if (S.duck > 0) {
      S.duck += dt;
      if (S.duck > 2.3 && !S.filchSaid) { S.filchSaid = 1; ctx.say('מי שם?... אה, כנראה רק חתול 🐈', FILCH_WHO, 3); sfx('soft'); }
      if (S.duck > 2.6) { S.duck = 0; S.filchSaid = 0; if (S.back) { player.yaw = S.back.yaw; player.teleport(S.back.x, S.back.z); } S.back = null; faceNext(); ctx.say('הוא הלך! ממשיכים לאסוף 🍬', RON_WHO, 2.5); }
    }
    if (S.assist && !S.duck) { S.assistT += dt; if (S.assistT > 1.0) { S.assistT = 0; const i = nextSweet(); if (i >= 0) { faceNext(); takeSweet(B, i); } } }
  };
  function startDuck() {
    S.duck = 0.001; S.ducks++; ctx.poke();
    S.back = { x: player.pos.x, z: player.pos.z, yaw: player.yaw };
    player.yaw = Math.atan2(WIN.x - HIDE.x, WIN.z - HIDE.z); player.teleport(HIDE.x, HIDE.z);
    const phone = innerWidth / Math.max(1, innerHeight) < 0.8;   // a narrow phone looks almost straight at the window (Filch passes in view)
    frame(WIN.x, WIN.z, phone ? { pitch: 0.1, dist: 4.0, side: 0.3 } : { pitch: 0.16, dist: 3.4, side: 0.75 });
    ctx.say('פססס, מתחבאים! 🤫 מאחורי החבית...', RON_WHO, 2.4); sfx('whoosh');
  }
  function questSweets(B) {
    const n = S.N, idx = SWEET_SPOTS.map((_, i) => i);
    // the nearest spots first at level 1 (all in front of Harry), shuffled at levels 2-3
    if (lv() > 1) idx.sort(() => Math.random() - 0.5); else idx.sort((a, b) => [4, 5, 9, 6, 0, 1, 8, 7, 3, 2].indexOf(a) - [4, 5, 9, 6, 0, 1, 8, 7, 3, 2].indexOf(b));
    S.shownIdx = idx.slice(0, n); setSweets(B, S.shownIdx); S.got = 0; B.free = false;
  }
  function takeSweet(B, i) {
    if (!collect(B, i, false)) return false;
    S.got++; ctx.poke();
    try { fun.toast('🍬', S.got + ' / ' + S.N, 900); } catch { /* ok */ }
    if (S.got >= S.N) { ctx.say('כל הממתקים! יאמי! 🍬 עכשיו חוזרים בשקט...', RON_WHO, 3); setTimeout(() => done(3), 900); }
    else { if (S.got === 1) ctx.say('יאמי! עוד ממתקים זוהרים מחכים 🍭', RON_WHO, 2.4); setTimeout(() => { if (S.active && ctx.step === 3 && !S.duck) faceNext(); }, 500); }
    return true;
  }

  // ---- per frame ----
  function update(dt, step) {
    S.t += dt;
    tableTick();
    if (S.reframe) { const k = S.reframe; if (k === 'honey' && curHoney()) { S.reframe = null; player.yaw = HSPAWN.yaw; player.teleport(HSPAWN.x, HSPAWN.z); faceNext(); } else if (k === 'stair' && curStatue()) { S.reframe = null; frame(STATUE.x, STATUE.z); } else if (k === 'table' && S.table) { S.reframe = null; frame(TABLE.x, TABLE.z); } }
    if (step === 0 && S.table && (lv() === 1 || S.glowHint) && Math.random() < dt * 5) { tableW(v1); emit(v1.x + (Math.random() - 0.5) * 0.6, v1.y, v1.z + (Math.random() - 0.5) * 0.6, 0, 0.3, 0, 0.8, 0.2, 0xffe07a, 0); }
    if (step === 0 && S.tapT > 0) { S.tapT += dt; if (S.tapT > 1.0) done(0); }
    if (step === 2) {
      if (S.sub === 'statue' && HS.questOpen && HS.slide > 0.85 && !S.slideT) S.slideT = 0.001;
      if (S.slideT) { S.slideT += dt; if (S.slideT > 0.6) done(2); }
      if (S.sub === 'statue' && curStatue() && !HS.questOpen && (lv() === 1 || S.glowHint) && Math.random() < dt * 5) { stW(v1, 0.6 + Math.random() * 1.4); emit(v1.x + (Math.random() - 0.5) * 1.0, v1.y, v1.z - 0.4, 0, 0.3, 0, 0.8, 0.2, 0xffe07a, 0); }
      if (ctx.step === 2 && S.sub === 'map' && !MM.state().open && S.active) openMap();   // (a reload / a stray close: the map comes back; ctx.step: this frame may have just finished the step)
    }
    if (step === 4 && ctx.step === 4 && !S.managedOpen && !inRoom('b3honey')) openManage();
  }

  // ---- taps ----
  function tap(x, y, step) {
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (step === 0) { if (S.table && !S.tapT && near(tableW(v1)) < R() * 2.4) { S.tapT = 0.001; ctx.poke(); sfx('flip'); burst(v1.x, v1.y, v1.z, 0xffd76a, 20, 2, 0.9, 0.24, -0.6); ctx.say('מצאת אותו! קלף ישן... נראה ריק. אבל רון יודע את הסוד 😉', RON_WHO, 3.5); return true; } return false; }
    if (step === 2 && S.sub === 'statue' && curStatue()) { if (!HS.questOpen && near(stW(v1, 1.2)) < R() * 2.6) { openStatue(false); ctx.poke(); ctx.say('הפסל זז הצידה! הנה המעבר הסודי 🗿✨', RON_WHO, 3); return true; } return false; }
    if (step === 3) {
      const B = curHoney(); if (!B) return false;
      if (S.duck > 0) { ctx.say('ששש... מחכים רגע מאחורי החבית 🤫', RON_WHO, 1.6); return true; }
      const i = sweetAt(B, x, y, tapR()); if (i >= 0) { takeSweet(B, i); return true; }
      return false;
    }
    return false;
  }
  // ---- the arrow ----
  function goal(step, out) {
    if (step === 0) { if (!inRoom('commonroom')) return ctx.routeTo('commonroom', out, ['staircase', 'entrancehall']); return S.table && !S.tapT ? tableW(out) : null; }
    if (step === 1) return null;
    if (step === 2) { if (S.sub !== 'statue') return null; if (!inRoom('staircase')) return ctx.routeTo('staircase', out, ['staircase', 'entrancehall']); return HS.questOpen ? null : stW(out, 0.6); }
    if (step === 3) { if (!inRoom('b3honey')) return ctx.routeTo('b3honey', out, ['staircase', 'entrancehall']); const i = nextSweet(); return i >= 0 && !S.duck ? sweetW(i, out) : null; }
    if (step === 4) { if (inRoom('b3honey')) return out.set(TRAP.x, Y(), TRAP.z); return null; }
    return null;
  }
  function begin(step, resumed) {
    if (!S.inited) { S.inited = true; S.N = NSWEETS[lv()] || 5; }   // the level: read at run time
    S.active = true; HS.quest = true; S.assist = false; S.assistT = 0; S.duck = 0; S.back = null; S.slideT = 0; S.tapT = 0; S.managedOpen = false; S.inited3 = false;
    HS.questOpen = step === 3 || (step === 2 && S.sub === 'statue' && HS.questOpen);
    if (step === 0) { if (inRoom('commonroom')) S.reframe = 'table'; return; }   // the child walks there (the arrow leads)
    if (step === 1) { openOath(); ctx.say('אני יודע את המילים הסודיות! גע בהן לפי הסדר ✨', RON_WHO, 4); return; }
    if (step === 2) { S.sub = 'map'; openMap(); ctx.say('תראה! כל הטירה, וכל מי שבה! 👣 ומה זה הקו הוורוד המהבהב?', RON_WHO, 4.5); return; }
    if (step === 3) {
      if (MM.state().open) closeParchment();
      const B = curHoney();
      if (B) { questSweets(B); S.inited3 = true; player.yaw = HSPAWN.yaw; player.teleport(HSPAWN.x, HSPAWN.z); faceNext(); }
      else { interiors.enter('b3honey', { ...HSPAWN }); S.reframe = 'honey'; }
      ctx.say('הוניידוקס! איזה ממתקים! 🍬 אסוף את הקופסאות הזוהרות... ושים לב לפילץ\' בחלון 🏮', RON_WHO, 5);
      return;
    }
    if (step === 4) {
      HS.questOpen = true;   // the passage stays open behind us
      if (inRoom('b3honey')) ctx.say('חוזרים במעבר הסודי: לך אל דלת הרצפה בפינה 🕳️', RON_WHO, 4);
      else if (resumed || !inRoom('b3honey')) openManage();
    }
  }
  function glow(step, on) { S.glowHint = !!on; if (step === 1) glowHint(on); }
  function together(step, fast) {
    const soon = (ok, fn, n = 0) => { if (!S.active) return; if (ok()) { try { fn(); } catch (e) { console.warn('[b3-map] together -', e && e.message || e); } return; } if (n < 80) setTimeout(() => soon(ok, fn, n + 1), 250); };
    if (step === 0) { if (fast) { done(0); return; } if (!inRoom('commonroom')) interiors.enter('commonroom', { x: TABLE.x - 1.6, z: TABLE.z + 1.4, yaw: Math.atan2(1.6, -1.4) }); soon(() => !!S.table, () => { S.reframe = 'table'; S.tapT = 0.001; }); return; }
    if (step === 1) { if (fast) { done(1); return; } const st = MM.state(); const words = st.words.slice(st.typed); words.forEach((w, k) => setTimeout(() => { const p = MM.tileScreen(w); if (p) { const el = document.elementFromPoint(p.x, p.y); if (el) el.click(); } }, 500 * (k + 1))); return; }
    if (step === 2) {
      if (fast) { HS.questOpen = true; done(2); return; }
      if (S.sub === 'map') passage();
      const go = () => { soon(() => !!curStatue(), () => { S.reframe = 'stair'; openStatue(false); }); };
      if (!inRoom('staircase')) { setTimeout(() => { interiors.enter('staircase', { x: STATUE.x - 0.4, z: STATUE.z - 2.6, yaw: Math.PI }); go(); }, 1800); } else go();
      return;
    }
    if (step === 3) { if (fast) { done(3); return; } if (!curHoney()) { interiors.enter('b3honey', { ...HSPAWN }); S.reframe = 'honey'; } soon(() => !!curHoney(), () => { S.assist = true; }); return; }
    if (step === 4) { if (fast) { closeParchment(); done(4); return; } if (inRoom('b3honey')) interiors.enter('staircase', { x: STATUE.x, z: STATUE.z - 1.7, yaw: Math.PI }); soon(() => MM.state().open && MM.state().phase === 'manage', () => { const b = document.querySelector('#mmOv .mng'); if (b) b.click(); }); }
  }
  function end() {
    S.active = false; HS.quest = false; HS.questOpen = false; HS.honeyHook = null; HS.qctx = null;
    dropTable();
    if (MM.state().open && MM.state().mode === 'quest') closeParchment();
    const B = curHoney(); if (B) freeSweets(B);
  }
  function state() {
    const B = curHoney(), T = curStatue();
    return { room: interiors.active, sub: S.sub, N: S.N, got: S.got, ducks: S.ducks, duck: S.duck > 0, wrong: S.wrong, passage: S.passage,
      table: S.table ? { visible: S.table.visible && !!S.table.parent } : null,
      statue: T ? { visible: T.g.visible && T.body.visible && !!T.g.parent, open: statueOpen(), slide: +HS.slide.toFixed(2), hole: T.hole.visible } : null,
      honey: B ? { left: B.shown.map((on, i) => (on && !B.got[i] ? i : -1)).filter(i => i >= 0), visible: B.sweets.visible, filchX: +B.filchX.toFixed(2), filchVisible: B.F.g.visible && B.F.body.visible, draws: drawCount(B.g), tris: B.tris } : null,
      parchment: MM.state(), free: FREE_API.state() };
  }
  ctx._map = {
    tableW: () => (S.table ? tableW(new Vector3()) : null),
    statueW: () => (curStatue() ? stW(new Vector3(), 1.2) : null),
    sweetW: (i) => (curHoney() ? sweetW(i) : null),
    nextSweet: () => nextSweet(),
    filchW: FREE_API.filchW, filchTo: FREE_API.filchTo, trapW: FREE_API.trapW,
  };
  return { begin, update, goal, tap, glow, together, end, state };
}
