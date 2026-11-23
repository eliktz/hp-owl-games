// Book 2, adventure 3: "הכתובת על הקיר" (the writing on the wall). Data for adventures.js + the scene code.
// Gentle, never scary: the writing is only "חדר הסודות נפתח!" in a soft gold glow; Mrs Norris sits frozen like a little
// frosty statue with her eyes shut as if asleep; the spiders are tiny, round and friendly. Spells NEVER act on the cat
// or the spiders (house rule): the cat is thawed with Professor Sprout's mandrake tonic (taps); a spell cast at her gets
// a kind bubble. Everything exists only while the quest runs (added to the live rooms, gone with them / at the end).
// Steps: 1 go to the moving-staircase hall (a dim stretch of the east wall, a puddle) -> 2 Lumos: the writing glows ->
// 3 tap the bottle of mandrake tonic, then Mrs Norris: she thaws, stretches, purrs and trots off -> 4 follow the
// spiders: they scuttle from the puddle to three waypoints (each waits for Harry) and out of a little window (Lumos or
// Point Me makes their trail glow; the arrow works anyway) -> 5 the library: tap the big old potion book with the
// cauldron on its spine (level 1: it glows; levels 2-3: 3 / 4 books, no glow).
import { Vector3, Matrix4, Quaternion, Euler, Color } from 'three';
import { buildWallDressing, buildWriting, buildNorris, buildTonic, buildSpiders, buildBooks, triCount,
  WALL, PUDDLE, NORRIS, TONIC, WINDOW, TRAIL, SHELF } from './adventure-b2-wall-build.js';

const HERM = { ico: '👧', name: 'הרמיוני' };
export const B2WALL = {
  id: 'b2-wall', book: 2, title: 'הכתובת על הקיר', ico: '🐈', col: '#3a2a1a', col2: '#b08a5a', helper: HERM, confetti: ['✨', '⭐', '🐈', '📕'],
  pic: [['🐈', 0.5, 0.58, 66], ['💡', 0.2, 0.3, 30], ['🕷️', 0.8, 0.3, 28]],
  intro: [
    'משהו מוזר קרה בטירה... 🏰',
    'על הקיר ליד המדרגות הופיעה כתובת, וגברת נוריס, החתולה של פילץ\', קפאה כמו פסל קטן.',
    'בוא נגלה מה קרה. אני הרמיוני, ואני אעזור לך! ✨',
  ],
  steps: [
    { line: 'לך אל אולם המדרגות הנעות 🪜', hints: ['אולם המדרגות נמצא ליד אולם הכניסה 🪜', 'לך אחרי החץ הזהוב', 'אפשר גם לטוס במפה אל המדרגות הנעות 🗺️'], glowL1: true },
    { line: 'הטל לומוס על הקיר החשוך 💡', hints: ['הקיר חשוך מדי לקרוא. צריך אור! 💡', 'בחר לומוס בגלגל הלחשים ונופף בשרביט', 'הלחש הזוהר בגלגל: לומוס 💡'], spell: 'lumos', glowL1: true },
    { line: 'עזור לגברת נוריס להפשיר 🐈', hints: ['פרופסור ספראוט השאירה בקבוק של שיקוי מנדרייק 🧴', 'קודם גע בבקבוק הירוק, ואז בחתולה', 'הבקבוק זוהר על הרצפה. גע בו, ואז בגברת נוריס 🐈'], glowL1: true },
    { line: 'לך אחרי העכבישים הקטנים 🕷️', hints: ['העכבישים הקטנים מחכים לך. לך אליהם! 🕷️', 'הטל לומוס או "הצבע לי" כדי לראות את השביל ✨', 'לך אחרי החץ הזהוב, העכבישים מחכים'], glowL1: true },
    { line: 'מצא בספרייה את ספר השיקויים 📕', hints: ['ספר השיקויים נמצא במדף בספרייה 📚', 'חפש את הספר עם הקלחת על הגב', 'גע בספר הגדול עם הקלחת הזהובה 📕'] },
  ],
  create: (ctx) => wallScene(ctx),
  art: drawWallCard,
};

// the reward card picture: a sleepy, cosy grey cat (eyes shut, smiling), a tiny round spider and a book (canvas)
function drawWallCard(x, cx, cy) {
  const E = (px, py, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, 7); x.fill(); };
  x.save(); x.translate(cx - 10, cy + 20);
  E(0, 40, 64, 50, '#7e7468'); E(0, 52, 30, 30, '#b8ac98');
  x.strokeStyle = '#6a6056'; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.arc(46, 82, 40, -0.3, 1.9); x.stroke();
  E(0, -30, 46, 40, '#7e7468');
  for (const sx of [-1, 1]) { x.fillStyle = '#6a6056'; x.beginPath(); x.moveTo(sx * 40, -48); x.lineTo(sx * 30, -92); x.lineTo(sx * 10, -62); x.closePath(); x.fill(); x.fillStyle = '#c88a8a'; x.beginPath(); x.moveTo(sx * 33, -55); x.lineTo(sx * 28, -80); x.lineTo(sx * 17, -62); x.closePath(); x.fill(); }
  x.strokeStyle = '#2a2420'; x.lineWidth = 4; for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 18, -34, 9, 0.2, Math.PI - 0.2); x.stroke(); }
  E(0, -16, 6, 4, '#c88a8a'); x.beginPath(); x.arc(-6, -10, 6, 0.2, Math.PI - 0.6); x.stroke(); x.beginPath(); x.arc(6, -10, 6, 0.6, Math.PI - 0.2); x.stroke();
  x.restore();
  // a little round spider waving
  x.save(); x.translate(cx + 56, cy - 70); x.strokeStyle = '#3a2e26'; x.lineWidth = 3; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(-26, -6 + k * 5); x.lineTo(26, 6 - k * 5); x.stroke(); }
  E(0, 0, 15, 13, '#5e4a3c'); E(-5, -3, 5, 5, '#f4f0e8'); E(5, -3, 5, 5, '#f4f0e8'); E(-5, -2, 2, 2, '#141210'); E(5, -2, 2, 2, '#141210'); x.restore();
  // a soft gold sparkle
  x.save(); x.translate(cx - 60, cy - 80); x.fillStyle = '#ffe08a'; x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 6 : 18; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); x.restore();
}

const BOOKS = { 1: 3, 2: 3, 3: 4 };
const WAIT_R = { 1: 4.2, 2: 3.4, 3: 3.4 };
const FROST = new Color(0.72, 0.86, 1.0), ICE = new Color(0.32, 0.42, 0.55), WHITE = new Color(1, 1, 1), BLACK = new Color(0, 0, 0);
const NSP = 8;

function wallScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit } = ctx;
  const S = { active: false, lastRoom: null, room: null, D: null, lib: null, arrived: 0, lit: 0, tonic: 0, thaw: 0, sp: null, spS: 0, spWait: 1, spGone: 0, trail: 0, wrong: 0, picked: -1, t: 0, glowHint: false, casts0: 0, done: {} };
  const lv = () => ctx.level;
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0, type = 'triangle', v = 0.1, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  const purr = () => { for (let i = 0; i < 10; i++) tone(72 + (i % 2) * 8, 0.12, i * 0.11, 'triangle', 0.05, 64); };
  const mew = () => { tone(760, 0.18, 0, 'sine', 0.06, 560); tone(640, 0.22, 0.2, 'sine', 0.05, 820); };
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const inHall = () => interiors.active === 'staircase' && interiors.room && interiors.room.group;
  const inLib = () => interiors.active === 'library' && interiors.room && interiors.room.group;
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3();
  const FI = freecast && freecast._internal;
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();
  const RW = (x, y, z, out = new Vector3()) => out.set(x, y, z).add(interiors.room.group.position);
  // the library books: which slot holds the cauldron book
  // (set in begin(): the level is not known yet while adventures.js creates the scene)
  let nB = 3, right = 0, bookZ = [], inited = false;
  function init() { if (inited) return; inited = true; nB = BOOKS[lv()] || 3; right = Math.floor(Math.random() * nB); bookZ = Array.from({ length: nB }, (_, i) => (i - (nB - 1) / 2) * 0.46); }
  const others = ['star', 'moon', 'leaf'];

  // ---- the staircase hall dressing (added to the live room while the quest needs it) ----
  function dressHall(step) {
    const r = interiors.room; if (!r || !r.group || S.D) return;
    const g = r.group, D = { g };
    D.dress = buildWallDressing(); g.add(D.dress);
    D.writing = buildWriting(); g.add(D.writing);
    D.writing.material.opacity = step >= 2 ? 1 : lv() === 1 ? 0.12 : 0.06;
    if (step <= 2) {
      D.cat = buildNorris(); D.cat.root.position.set(NORRIS.x, 0, NORRIS.z); D.cat.root.rotation.y = NORRIS.ry; D.cat.root.scale.setScalar(1.4); g.add(D.cat.root);
      D.cat.mat.color.copy(FROST); D.cat.mat.emissive.copy(ICE); D.catTris = triCount(D.cat.root);
      D.tonic = buildTonic(); D.tonic.position.set(TONIC.x, 0, TONIC.z); g.add(D.tonic); D.tonic.visible = !S.tonic;
    }
    if (step === 3) { D.sp = buildSpiders(NSP); D.sp.count = NSP; g.add(D.sp); S.spS = 0; S.spWait = 1; S.spGone = 0; D.spTris = triCount(D.sp); }
    S.D = D; S.dressTris = [D.dress, D.writing, D.cat && D.cat.root, D.tonic, D.sp].filter(Boolean).reduce((n, o) => n + triCount(o), 0);
  }
  function undressHall() {
    const D = S.D; if (!D) return;
    for (const o of [D.dress, D.writing, D.cat && D.cat.root, D.tonic, D.sp]) if (o && o.parent) o.parent.remove(o);
    S.D = null;
  }
  function dropCat() { const D = S.D; if (D && D.cat) { if (D.cat.root.parent) D.cat.root.parent.remove(D.cat.root); D.cat = null; } if (D && D.tonic) { if (D.tonic.parent) D.tonic.parent.remove(D.tonic); D.tonic = null; } }
  function addSpiders() { const D = S.D; if (!D || D.sp) return; D.sp = buildSpiders(NSP); D.sp.count = NSP; D.g.add(D.sp); S.spS = 0; S.spWait = 1; S.spGone = 0; D.spTris = triCount(D.sp); }
  function dropSpiders() { const D = S.D; if (D && D.sp) { if (D.sp.parent) D.sp.parent.remove(D.sp); D.sp = null; } }

  // ---- the library books ----
  function dressLib() {
    const r = interiors.room; if (!r || !r.group || S.lib) return;
    const B = buildBooks(4), list = [];
    let oi = 0;
    for (let i = 0; i < nB; i++) {
      const want = i === right ? 'cauldron' : others[oi++ % others.length];
      const b = B.books.find(x => x.icon === want); const m = b.m;
      if (i === right) { m.material = B.mat.clone(); S.rightMat = m.material; }
      m.position.set(SHELF.x, SHELF.y, bookZ[i]); r.group.add(m); list.push({ m, icon: want, wig: 0, fly: 0 });
    }
    S.lib = { list, B };
    S.libTris = list.reduce((n, b) => n + triCount(b.m), 0);
  }
  function undressLib() { if (S.lib) for (const b of S.lib.list) if (b.m.parent) b.m.parent.remove(b.m); S.lib = null; }

  // ---- the spiders' trail (room-local points; P4/P5: the foot of the west wall, then up to the window) ----
  const PTS = [...TRAIL.map(([x, z]) => new Vector3(x, 0, z)), new Vector3(-9.42, 0, WINDOW.z), new Vector3(-9.42, WINDOW.y - 0.35, WINDOW.z)];
  const CUM = [0]; for (let i = 1; i < PTS.length; i++) CUM.push(CUM[i - 1] + PTS[i].distanceTo(PTS[i - 1]));
  const TOTAL = CUM[CUM.length - 1];
  function along(s, out) {   // a point on the trail at distance s; returns the segment index
    s = Math.max(0, Math.min(TOTAL, s));
    let i = 1; while (i < CUM.length - 1 && CUM[i] < s) i++;
    const k = (s - CUM[i - 1]) / Math.max(1e-6, CUM[i] - CUM[i - 1]); out.lerpVectors(PTS[i - 1], PTS[i], k); return i - 1;
  }
  const _M = new Matrix4(), _Q = new Quaternion(), _E = new Euler(), _S = new Vector3(), _P = new Vector3(), _D = new Vector3();
  const CLIMB = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0)));
  function tickSpiders(dt, step) {
    const D = S.D; if (!D || !D.sp) return;
    // the leader runs to the next waypoint, then waits there until Harry comes close
    const stopAt = S.spWait <= 3 ? CUM[S.spWait] : TOTAL + 1.2 + NSP * 0.32;
    S.spS = Math.min(stopAt, S.spS + dt * 1.2);
    if (S.spWait <= 3 && S.spS >= CUM[S.spWait] - 0.01) {
      const w = PTS[S.spWait], g = D.g.position, d = Math.hypot(player.pos.x - g.x - w.x, player.pos.z - g.z - w.z);
      if (d < (WAIT_R[lv()] || 3.4)) { S.spWait++; ctx.poke(); sfx('tink', 2); if (S.spWait === 4) ctx.say('הם מטפסים אל החלון הקטן! 🕷️🪟', null, 3); else ctx.say(S.spWait === 2 ? 'הם ממשיכים! בוא אחריהם 🕷️' : 'עוד קצת! 🕷️', null, 2.2); }
    }
    let n = 0;
    for (let k = 0; k < NSP; k++) {
      const s = S.spS - k * 0.32; if (s > TOTAL + 0.05) continue;
      const seg = along(Math.max(0, s), _P), a = PTS[seg], b = PTS[seg + 1];
      const side = ((k % 3) - 1) * 0.12;
      if (seg >= PTS.length - 2) { _Q.copy(CLIMB); _P.z += side; _P.x += 0.02; }
      else { _D.subVectors(b, a); _Q.setFromEuler(_E.set(0, Math.atan2(_D.x, _D.z), 0)); _P.x += _D.z / (_D.length() || 1) * side; _P.z -= _D.x / (_D.length() || 1) * side; _P.y += Math.abs(Math.sin(S.t * 18 + k)) * 0.015; }
      const sc = 1.6 * (s > TOTAL - 0.25 ? Math.max(0.05, (TOTAL + 0.05 - s) / 0.3) : 1);
      D.sp.setMatrixAt(n++, _M.compose(_P, _Q, _S.set(sc, sc, sc)));
    }
    D.sp.count = n; D.sp.instanceMatrix.needsUpdate = true;
    // the glowing trail ahead of them (level 1 always a little; Lumos / Point Me: brightly for a while)
    const glowOn = S.trail > 0 || lv() === 1 || S.glowHint;
    if (glowOn && Math.random() < dt * (S.trail > 0 ? 14 : 4)) {
      const s = S.spS + Math.random() * Math.max(0.5, Math.min(TOTAL, (S.spWait <= 3 ? CUM[Math.min(3, S.spWait)] + 3 : TOTAL)) - S.spS);
      along(s, _P); RW(_P.x, _P.y + 0.05, _P.z, v1); emit(v1.x, v1.y, v1.z, 0, 0.25, 0, 0.9, 0.16, S.trail > 0 ? 0xbfe8ff : 0xffe07a, 0);
    }
    if (n === 0 && !S.spGone) { S.spGone = 1; ctx.say('הם יצאו מהחלון! 🕷️ עכבישים בורחים... ממה? אולי ספר בספרייה יגיד 📚', null, 4.5); setTimeout(() => done(3), 1200); }
  }

  // ---- step actions ----
  function light() {
    if (S.lit || ctx.step !== 1) return; S.lit = 0.001; ctx.poke(); sfx('sparkle'); tone(520, 0.5, 0, 'sine', 0.08, 1040);
    if (S.D) { RW(WALL.x - 0.2, WALL.y, WALL.z, v1); burst(v1.x, v1.y, v1.z, 0xffe7a0, 22, 1.6, 1.0, 0.24, -0.3); }
  }
  function takeTonic() {
    if (S.tonic || ctx.step !== 2) return; S.tonic = 1; ctx.poke(); sfx('pop'); sfx('chime');
    if (S.D && S.D.tonic) { RW(TONIC.x, 0.4, TONIC.z, v1); burst(v1.x, v1.y, v1.z, 0x8ad08a, 16, 1.4, 0.8, 0.2, -0.6); S.D.tonic.visible = false; }
    try { fun.toast('🧴', 'יש לך את שיקוי המנדרייק!', 1600); } catch { /* ok */ }
    ctx.say('שיקוי מנדרייק של פרופסור ספראוט! עכשיו גע בגברת נוריס 🐈', null, 3.5);
  }
  function thaw() {
    if (S.thaw || ctx.step !== 2) return;
    if (!S.tonic) { ctx.say('גברת נוריס קפואה כמו פסל קטן 🧊 צריך את שיקוי המנדרייק! הבקבוק הירוק על הרצפה 🧴', null, 3.5); return; }
    S.thaw = 0.001; ctx.poke(); sfx('sparkle'); tone(880, 0.6, 0, 'sine', 0.06, 440);
    if (S.D && S.D.tonic) { S.D.tonic.visible = true; S.D.tonic.position.set(NORRIS.x - 0.3, 0.9, NORRIS.z); S.D.tonic.rotation.set(0, 0, 0); }
  }
  function pickBook(i) {
    const L = S.lib; if (!L || S.picked >= 0 || ctx.step !== 4) return;
    const b = L.list[i]; if (!b) return;
    if (i !== right) { b.wig = 0.001; S.wrong++; ctx.oops('זה ספר על ' + ({ star: 'כוכבים ⭐', moon: 'הירח 🌙', leaf: 'צמחים 🍃' }[b.icon] || 'משהו אחר') + '. חפש את הספר עם הקלחת על הגב!'); return; }
    S.picked = i; b.fly = 0.001; ctx.poke(); sfx('flip'); sfx('chime');
    ctx.say('מצאת! "שיקויים רבי עוצמה" 📕 יש בו מתכון לשיקוי פולימיצי... זה ההרפתקה הבאה! 🧪', null, 4.5);
  }

  // ---- per frame ----
  function update(dt, step) {
    S.t += dt;
    const r = interiors.room;
    if (r !== S.lastRoom) { S.lastRoom = r; S.D = null; S.lib = null; }
    if (S.active && inHall() && step <= 3 && !S.D) dressHall(step);
    if (S.active && inHall() && step === 3 && S.D && !S.D.sp && !S.spGone) addSpiders();
    if (S.active && inLib() && step === 4 && !S.lib) dressLib();
    // 1: arriving in the staircase hall
    if (step === 0 && inHall() && S.active) { S.arrived += dt; if (S.arrived > 1.2 && !S.done[0]) { ctx.say('תראה! הקיר שם חשוך... ומים על הרצפה 💧 ומה זה יושב שם?', null, 4); done(0); } } else if (step === 0) S.arrived = 0;
    // casts: Lumos lights the wall; never a spell on the cat or the spiders (a kind word)
    const n = casts();
    if (n !== S.casts0) {
      S.casts0 = n; const k = freecast && freecast.selected ? freecast.selected() : null;
      if (inHall() && step === 1 && !S.lit) { if (k === 'lumos' || k === 'maxima') light(); else ctx.oops('הקיר עדיין חשוך... נסה לחש של אור 💡'); }
      else if (inHall() && step === 2 && S.D && S.D.cat) { const g = S.D.g.position; if (Math.hypot(player.pos.x - g.x - NORRIS.x, player.pos.z - g.z - NORRIS.z) < 9) ctx.say('לא מטילים לחשים על חתולים 🙂 גברת נוריס צריכה את שיקוי המנדרייק 🧴', null, 3.5); }
      else if (inHall() && step === 3) { if (k === 'lumos' || k === 'maxima' || k === 'pointme') { S.trail = 8; ctx.say('השביל של העכבישים זוהר! ✨ לך אחריו', null, 3); } else ctx.say('לא מכשפים עכבישים 🙂 רק הולכים אחריהם!', null, 3); }
      else if (inLib() && step === 4 && S.picked < 0) ctx.say('כאן לא צריך לחשים 🙂 גע בספר עם הקלחת על הגב', null, 3);
    }
    if (S.trail > 0) S.trail -= dt;
    const D = S.D;
    if (D) {
      // the writing: faint until Lumos, then it glows softly (a slow breathing shimmer)
      const W = D.writing.material;
      if (S.lit > 0) { S.lit += dt; W.opacity = Math.min(1, W.opacity + dt * 0.7); if (S.lit > 0.4 && S.lit - dt <= 0.4) ctx.say('כתוב: "חדר הסודות נפתח!" ✨ מה זה אומר?', null, 4); if (S.lit > 3.6) done(1); }
      if (step >= 2) W.opacity = 0.86 + Math.sin(S.t * 1.6) * 0.12;
      else if (!S.lit && (lv() === 1 || S.glowHint) && Math.random() < dt * 2) { RW(WALL.x - 0.15, WALL.y + (Math.random() - 0.5) * 0.6, WALL.z + (Math.random() - 0.5) * 2.6, v1); emit(v1.x, v1.y, v1.z, -0.1, 0.1, 0, 0.9, 0.14, 0xffe07a, 0); }
      tickCat(dt, step);
      tickSpiders(dt, step);
    }
    tickBooks(dt, step);
  }
  function tickCat(dt, step) {
    const D = S.D, C = D.cat; if (!C) return;
    const g = D.g.position;
    // the tonic bottle: bobs and sparkles while it waits (level 1 / the glow hint); pours over her when used
    if (D.tonic && !S.tonic) { D.tonic.position.y = 0.02 + Math.sin(S.t * 2.2) * 0.02; D.tonic.rotation.y = S.t * 0.6; D.tonic.material.emissiveIntensity = (step === 2 && (lv() === 1 || S.glowHint)) ? 0.5 + Math.sin(S.t * 4) * 0.25 : 0.2;
      if (step === 2 && (lv() === 1 || S.glowHint) && Math.random() < dt * 3) { RW(TONIC.x, 0.5, TONIC.z, v1); emit(v1.x + (Math.random() - 0.5) * 0.3, v1.y, v1.z, 0, 0.4, 0, 0.8, 0.16, 0x9ae09a, 0); } }
    if (S.thaw <= 0) {
      // frozen: a still little statue, frosty, tiny icy sparkles round her
      if (Math.random() < dt * 3) { RW(NORRIS.x + (Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 0.6, NORRIS.z + (Math.random() - 0.5) * 0.5, v1); emit(v1.x, v1.y, v1.z, 0, 0.15, 0, 0.9, 0.1, 0xdff4ff, 0); }
      return;
    }
    S.thaw += dt; const t = S.thaw;
    // 0..1.2: the tonic tips over her (green sparkles); 0.6..2.6: the frost melts away; 2.8..4.2: a big stretch + purr;
    // 4.4..: she trots off toward the south door and slips out of sight
    if (D.tonic && t < 1.4) { D.tonic.rotation.z = Math.min(1.9, t * 2.4); if (Math.random() < dt * 30) { RW(NORRIS.x - 0.3 + 0.12, 0.85, NORRIS.z, v1); emit(v1.x, v1.y, v1.z, (Math.random() - 0.5) * 0.3, -0.4, (Math.random() - 0.5) * 0.3, 0.8, 0.14, 0x9ae09a, -1.5); } }
    else if (D.tonic && D.tonic.visible) { D.tonic.visible = false; RW(NORRIS.x - 0.3, 0.9, NORRIS.z, v1); burst(v1.x, v1.y, v1.z, 0x9ae09a, 10, 1, 0.6, 0.16, -0.5); }
    const k = Math.min(1, Math.max(0, (t - 0.6) / 2.0));
    C.mat.color.copy(FROST).lerp(WHITE, k); C.mat.emissive.copy(ICE).lerp(BLACK, k);
    if (t - dt < 0.7 && t >= 0.7) { sfx('sparkle'); RW(NORRIS.x, 0.5, NORRIS.z, v1); burst(v1.x, v1.y, v1.z, 0xdff4ff, 24, 1.4, 1.1, 0.22, -0.3); }
    if (t > 2.8 && t < 4.2) { const u = Math.sin((t - 2.8) / 1.4 * Math.PI); C.body.scale.set(1, 1 + u * 0.12, 1 + u * 0.1); C.body.rotation.x = -u * 0.12; if (!S.purred) { S.purred = 1; purr(); mew(); ctx.say('מיאו! 😺 גברת נוריס התעוררה! היא מגרגרת', null, 3.5); } }
    C.tail.rotation.y = t > 2.6 ? Math.sin(t * 3) * 0.4 : 0;
    if (t > 4.4) {
      const u = Math.min(1, (t - 4.4) / 3.2), ex = 3.2, ez = 10.2;
      C.root.position.set(NORRIS.x + (ex - NORRIS.x) * u, Math.abs(Math.sin(t * 9)) * 0.03, NORRIS.z + (ez - NORRIS.z) * u);
      C.root.rotation.y = Math.atan2(ex - NORRIS.x, ez - NORRIS.z);
      if (u >= 1 && C.root.visible) { C.root.visible = false; }
    }
    if (t > 4.6 && !S.done[2]) done(2);
    void g;
  }
  function tickBooks(dt, step) {
    const L = S.lib; if (!L) return;
    const glowOn = step === 4 && S.picked < 0 && (lv() === 1 || S.glowHint);
    if (S.rightMat) { S.rightMat.emissive.setHex(glowOn ? 0xffd070 : 0xffffff); S.rightMat.emissiveIntensity = glowOn ? 0.55 + Math.sin(S.t * 4) * 0.25 : 0.22; }
    L.list.forEach((b, i) => {
      if (b.wig > 0) { b.wig += dt; b.m.rotation.x = Math.sin(b.wig * 22) * 0.08 * Math.max(0, 1 - b.wig / 0.8); if (b.wig > 0.8) { b.wig = 0; b.m.rotation.x = 0; } }
      if (b.fly > 0) {
        b.fly += dt; const t = b.fly;
        if (t < 0.8) b.m.position.x = SHELF.x - (t / 0.8) * 0.45;
        else { const u = Math.min(1, (t - 0.8) / 1.2); b.m.position.set(SHELF.x - 0.45 - u * 0.9, SHELF.y + u * 0.6 + Math.sin(u * Math.PI) * 0.2, bookZ[i]); b.m.rotation.y = u * Math.PI * 0.5; }
        if (Math.random() < dt * 10) { RW(b.m.position.x, b.m.position.y + 0.25, b.m.position.z, v1); emit(v1.x, v1.y, v1.z, 0, 0.3, 0, 0.8, 0.16, 0xffe07a, 0); }
        if (t > 2.6) done(4);
      }
      if (glowOn && i === right && Math.random() < dt * 3) { RW(SHELF.x - 0.2, SHELF.y + 0.3, bookZ[i], v1); emit(v1.x, v1.y, v1.z + (Math.random() - 0.5) * 0.1, -0.1, 0.25, 0, 0.8, 0.14, 0xffe07a, 0); }
    });
  }

  // ---- taps ----
  function tap(x, y, step) {
    const rr = R();
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (inHall() && S.D) {
      if (step === 1 && near(RW(WALL.x - 0.1, WALL.y, WALL.z, v1)) < rr * 2.4) { if (!S.lit) ctx.say('חשוך מדי לקרוא... הטל לומוס 💡', null, 2.6); return true; }
      if (step === 2) {
        const dT = S.D.tonic && S.D.tonic.visible && !S.tonic ? near(RW(TONIC.x, 0.25, TONIC.z, v1)) : 1e9;
        const dC = S.D.cat && !S.thaw ? near(RW(NORRIS.x, 0.35, NORRIS.z, v2)) : 1e9;
        if (dT < rr * 1.5 && dT <= dC) { takeTonic(); return true; }
        if (dC < rr * 1.7) { thaw(); return true; }
      }
      if (step <= 1 && S.D.cat && near(RW(NORRIS.x, 0.35, NORRIS.z, v1)) < rr * 1.5) { ctx.say('גברת נוריס קפואה כמו פסל קטן 🧊 נעזור לה עוד מעט', null, 3); return true; }
      if (step === 3 && S.D.sp) { along(S.spS, _P); if (near(RW(_P.x, _P.y + 0.1, _P.z, v1)) < rr * 1.6) { ctx.say('עכבישים קטנים וחמודים 🕷️ לך אחריהם!', null, 2.4); return true; } }
      return false;
    }
    if (inLib() && S.lib && step === 4 && S.picked < 0) {
      let bi = -1, bd = 1e9; S.lib.list.forEach((b, i) => { const d = near(RW(SHELF.x - 0.1, SHELF.y + 0.24, bookZ[i], v1)); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0 && bd < rr * 1.2) { pickBook(bi); return true; }
    }
    return false;
  }

  // ---- the arrow ----
  function goal(step, out) {
    if (step <= 3) {
      if (!inHall()) return ctx.routeTo('staircase', out, ['staircase', 'entrancehall']);
      if (step === 0) return null;
      if (step === 1) return S.lit ? null : RW(PUDDLE.x - 0.4, -1.0, PUDDLE.z, out);
      if (step === 2) { if (S.thaw) return null; if (!S.tonic) return RW(TONIC.x, -0.35, TONIC.z, out); return RW(NORRIS.x, -0.1, NORRIS.z, out); }
      if (step === 3) { if (S.spGone || !S.D || !S.D.sp) return null; const w = S.spWait <= 3 ? PTS[S.spWait] : PTS[4]; return RW(w.x, -0.4, w.z, out); }
    }
    if (step === 4) {
      if (!inLib()) return ctx.routeTo('library', out, ['entrancehall', 'staircase']);
      if (S.picked >= 0) return null;
      if (lv() === 1 || S.glowHint) return RW(SHELF.x - 0.35, SHELF.y - 0.6, bookZ[right], out);
      return RW(SHELF.x - 0.6, SHELF.y - 1.4, 0, out);
    }
    return null;
  }

  function begin(step, resumed) {
    init(); S.active = true;
    if (step === 3 && S.D) { dropCat(); addSpiders(); }
    if (step === 1 && !resumed) { /* the arrow sits under the writing */ }
    if (step === 2 && !resumed) ctx.say('גברת נוריס קפואה! 🧊 אבל היא רק ישנה עמוק. פרופסור ספראוט השאירה כאן שיקוי מנדרייק 🧴', null, 4.5);
    if (step === 3 && !resumed) ctx.say('תראה! עכבישים קטנים יוצאים מהשלולית... בוא נלך אחריהם 🕷️', null, 4);
    if (step === 4 && !resumed) ctx.say('העכבישים ברחו. בוא נחפש בספרייה ספר שיסביר מה קורה 📚', null, 4);
    if (!resumed) return;
    // a resume (reload / the book): go to the right place; the step starts over
    if (step >= 1 && step <= 3) { const at = { x: 6.2, z: 4.6, yaw: Math.atan2(WALL.x - 6.2, WALL.z - 4.6) }; if (!inHall()) interiors.enter('staircase', at); else { player.yaw = at.yaw; player.teleport(at.x, at.z); } }
    if (step === 4) { const at = { x: 7.4, z: 0.4, yaw: Math.PI / 2 }; if (!inLib()) interiors.enter('library', at); else { player.yaw = at.yaw; player.teleport(at.x, at.z); } }
  }
  function glow(step, on) { S.glowHint = !!on; }
  function together(step, fast) {
    const hall = (fn, d = 1300) => { if (inHall() && S.D) fn(); else { interiors.enter('staircase', { x: 6.2, z: 4.6, yaw: Math.atan2(WALL.x - 6.2, WALL.z - 4.6) }); setTimeout(fn, d); } };
    if (step === 0) { if (inHall()) done(0); else interiors.enter('staircase', { x: 6.2, z: 4.6, yaw: Math.atan2(WALL.x - 6.2, WALL.z - 4.6) }); return; }
    if (step === 1) { hall(() => { light(); if (fast) S.lit = Math.max(S.lit, 3.5); }); return; }
    if (step === 2) { hall(() => { takeTonic(); setTimeout(() => { thaw(); if (fast) S.thaw = Math.max(S.thaw, 4.5); }, fast ? 0 : 900); }); return; }
    if (step === 3) { hall(() => { S.spWait = 4; if (fast) S.spS = TOTAL + NSP * 0.32 + 0.2; S.trail = 8; }); return; }
    if (step === 4) { const go = () => pickBook(right); if (inLib() && S.lib) go(); else { interiors.enter('library', { x: 7.4, z: 0.4, yaw: Math.PI / 2 }); setTimeout(go, 1500); } if (fast) setTimeout(() => done(4), 1700); }
  }
  function end() {
    S.active = false;
    undressHall(); undressLib();
  }
  function state() {
    const D = S.D;
    return { room: interiors.active, dressed: !!D, writing: D ? +D.writing.material.opacity.toFixed(2) : null, lit: S.lit > 0, tonic: !!S.tonic, thaw: S.thaw > 0, thawed: S.thaw > 2.6, cat: !!(D && D.cat && D.cat.root.visible),
      catTris: D ? D.catTris || null : null, spiders: D && D.sp ? D.sp.count : 0, spTris: D ? D.spTris || null : null, spWait: S.spWait, spGone: !!S.spGone, trail: S.trail > 0,
      books: S.lib ? S.lib.list.length : 0, libTris: S.libTris || null, right, wrong: S.wrong, picked: S.picked };
  }
  ctx._wall = {
    wallW: () => (inHall() ? RW(WALL.x - 0.1, WALL.y, WALL.z) : null),
    tonicW: () => (inHall() && S.D && S.D.tonic ? RW(TONIC.x, 0.25, TONIC.z) : null),
    catW: () => (inHall() && S.D && S.D.cat ? RW(NORRIS.x, 0.35, NORRIS.z) : null),
    leadW: () => { if (!inHall() || !S.D || !S.D.sp) return null; along(S.spS, _P); return RW(_P.x, _P.y + 0.1, _P.z); },
    waitW: () => { if (!inHall()) return null; const w = PTS[Math.min(4, S.spWait)]; return RW(w.x, 0, w.z); },
    bookW: (i) => (inLib() && S.lib ? RW(SHELF.x - 0.1, SHELF.y + 0.24, bookZ[i]) : null),
    right: () => right, nBooks: () => nB,
    spots: { WALL, NORRIS, TONIC, SHELF, PUDDLE },
  };
  return { begin, update, goal, tap, glow, together, end, state };
}
