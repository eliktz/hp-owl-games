// Book 2, adventure 2: "האזהרה של דובי" (Dobby's warning + the mandrakes). Data for adventures.js + the scene code.
// Friendly and funny, never scary; Dobby and the mandrakes are TAPPED, never hexed (a spell cast near them gets a kind
// bubble). Everything of the quest exists only while it runs: Dobby + the letters are added to the live common room,
// the Herbology corner (table, pots, mandrakes, bench, earmuffs) is added outdoors by the glasshouse (< 3k tris).
// Steps: 1 go to the Gryffindor common room (arrow; Floo and map work) -> 2 tap Dobby bouncing on the sofa: he warns
// Harry not to stay at school this year, then admits he hid Harry's letters -> 3 find the letters (3 / 4 / 5 by
// level; level 1 they glow) -> 4 go to the glasshouse and tap the fluffy pink earmuffs on the bench: Harry wears them
// -> 5 repot the mandrakes (3 / 4 / 5): tap one to pull it up (a muffled, squeaky "wah"; it wriggles), then tap the
// bigger empty pot (levels 2-3: the pot's ribbon must match the mandrake's; a wrong pot = a kind bubble). The last one
// in: they all go quiet and snore.
import { Vector3, Box3, Color, Matrix4, MeshStandardMaterial } from 'three';
import { FLOOR_Y } from './rooms.js';
import { PLACES } from './config.js';
import { buildDobby, buildLetter, buildHerbology, buildMandrake, buildEarmuffs, RIBBONS, RIB_NAME, TABLE_H, triCount } from './adventure-b2-dobby-build.js';

const HERM = { ico: '👧', name: 'הרמיוני' };
const DOBBY = '🧝 דובי';
export const B2DOBBY = {
  id: 'b2-dobby', book: 2, title: 'האזהרה של דובי', ico: '🧝', col: '#3a4a2a', col2: '#a8b878', helper: HERM, confetti: ['✨', '⭐', '💌', '🌱'],
  pic: [['🧝', 0.36, 0.56, 64], ['💌', 0.78, 0.3, 32], ['🌱', 0.78, 0.72, 34]],
  intro: [
    'שנה שנייה בהוגוורטס! 📗',
    'אבל השנה מישהו קטן ומוזר מחכה להארי בחדר המועדון...',
    'בוא נלך לחדר של גריפינדור. אני הרמיוני, ואני אעזור לך! ✨',
  ],
  steps: [
    { line: 'לך אל חדר המועדון של גריפינדור 🦁', hints: ['חדר המועדון נמצא למעלה, ליד המדרגות הנעות 🦁', 'לך אחרי החץ הזהוב', 'אפשר גם לטוס ברשת הפלו או במפה 🔥🗺️'], glowL1: true },
    { line: 'גע בדובי שקופץ על הספה 🧝', hints: ['מי זה קופץ על הספה? גע בו! 🧝', 'דובי רוצה להגיד משהו. גע בו', 'גע בדובי, היצור הקטן עם האוזניים הגדולות'], glowL1: true },
    { line: 'מצא את המכתבים שדובי החביא 💌', hints: ['דובי החביא מכתבים בחדר. חפש אותם! 💌', 'המכתבים זוהרים עכשיו. גע בהם', 'בדוק ליד הכורסאות, השולחן והקיר 💌'] },
    { line: 'לך אל החממה ושים את מחממי האוזניים 🎧', hints: ['שיעור צמחי מרפא בחממה, בחוץ 🌿', 'מחממי האוזניים הוורודים על הספסל. גע בהם!', 'לך אחרי החץ הזהוב אל החממה 🌿'], glowL1: true },
    { line: 'העבר את המנדרייקים לעציצים הגדולים 🌱', hints: ['גע במנדרייק כדי לשלוף אותו, ואז בעציץ גדול 🌱', 'המנדרייק זוהר? שלוף אותו! אחר כך גע בעציץ', 'עציץ גדול וריק מחכה. גע בו 🪴'] },
  ],
  create: (ctx) => dobbyScene(ctx),
  art: drawDobbyCard,
};

// the reward card picture: Dobby with big ears and green eyes, holding a letter, a mandrake in a pot beside him
function drawDobbyCard(x, cx, cy) {
  const E = (px, py, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, 7); x.fill(); };
  x.save(); x.translate(cx - 20, cy + 10);
  E(-70, -40, 60, 22, '#b4ac86', 0.35); E(70, -40, 60, 22, '#b4ac86', -0.35); E(-70, -40, 40, 12, '#c89a8a', 0.35); E(70, -40, 40, 12, '#c89a8a', -0.35);
  x.fillStyle = '#c8c0aa'; x.beginPath(); x.moveTo(-40, 40); x.lineTo(40, 40); x.lineTo(50, 110); x.lineTo(-50, 110); x.closePath(); x.fill();
  E(0, -30, 56, 52, '#b4ac86');
  for (const sx of [-1, 1]) { E(sx * 22, -36, 19, 22, '#f0ece0'); E(sx * 21, -34, 12, 14, '#3a9a4a'); E(sx * 21, -34, 6, 7, '#1a1a18'); E(sx * 18, -38, 3, 3, '#ffffff'); }
  x.fillStyle = '#a0986e'; x.beginPath(); x.moveTo(-6, -22); x.lineTo(6, -22); x.lineTo(0, 6); x.closePath(); x.fill();
  x.strokeStyle = '#6a2a24'; x.lineWidth = 4; x.beginPath(); x.arc(0, -2, 20, 0.3, Math.PI - 0.3); x.stroke();
  x.fillStyle = '#d6ccb0'; x.fillRect(30, 50, 46, 30); x.strokeStyle = '#a89a7a'; x.lineWidth = 2; x.beginPath(); x.moveTo(30, 50); x.lineTo(53, 66); x.lineTo(76, 50); x.stroke(); E(53, 66, 5, 5, '#b01e1e');
  x.restore();
  x.save(); x.font = '46px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🌱', cx + 80, cy + 80); x.restore();
}

const GH = PLACES.greenhouse;   // the glasshouse floor centre is GH.z - 8; its door faces +z (Sprout's side)
export const HERB = { x: GH.x + 4.6, z: GH.z - 1.6 };   // the Herbology corner (table centre), right of the glasshouse door
const NEED = { 1: 3, 2: 4, 3: 5 };
// common-room spots for the letters (room-local; y above the floor) + how each lies
const SPOTS = [
  { x: -3.85, y: 0.63, z: -1.15, rx: 0, ry: 0.5, rz: 0 },          // on the wing chair's cushion
  { x: -1.35, y: 0.03, z: -2.3, rx: 0, ry: 0.3, rz: 0 },           // peeking out under the chess table
  { x: 4.1, y: 0.03, z: -4.2, rx: 0, ry: -0.6, rz: 0 },            // on the rug by the east wing chair
  { x: 8.36, y: 2.05, z: 1.45, rx: 0, ry: 0, rz: Math.PI / 2 },    // pinned on the notice board
  { x: 0.75, y: 4.02, z: -7.25, rx: -Math.PI / 2 + 0.35, ry: 0, rz: 0 },   // leaning on the mantel
];
const SOFA = { x: 1.2, y: 0.62, z: -1.45 };
const DS = 1.3;     // Dobby's scale (about 1.2 m: he reads clearly over the sofa back)
const HS = 1.3;     // the Herbology corner's scale (bigger mandrakes and pots for small fingers)

function dobbyScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit, camera, scene } = ctx;
  const S = { active: false, lastRoom: null, room: null, dob: null, letters: [], found: 0, talk: 0, talkDone: 0, bye: 0, arrived: 0, herb: null, muffsOn: 0, muffsT: 0, muffs: null, mand: [], held: -1, potted: [], potFull: [], wrong: 0, snore: 0, glowHint: false, casts0: 0, done: {}, t: 0, wahT: 0, headY: 1.62 };
  const lv = () => ctx.level;
  const need = () => NEED[lv()] || 3;
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0, type = 'triangle', v = 0.1, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  const wah = () => { tone(620, 0.16, 0, 'sine', 0.06, 940); tone(900, 0.2, 0.15, 'sine', 0.05, 560); tone(1300, 0.08, 0.36, 'sine', 0.04, 1700); };   // muffled, squeaky, never a scream
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const inCommon = () => interiors.active === 'commonroom' && interiors.room && interiors.room.group;
  const outdoors = () => !interiors.active;
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3();
  const FI = freecast && freecast._internal;
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();
  // the pot ribbons: level 1 in the same order as the mandrakes (any empty pot is fine); levels 2-3 shuffled
  const order = Array.from({ length: need() }, (_, i) => i);
  if (lv() > 1) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const potCols = order.map(i => RIBBONS[i]);

  // ---- the common room: Dobby on the sofa + the letters (added to the live room while the quest needs them) ----
  function dressCommon(step) {
    const r = interiors.room; if (!r || !r.group) return;
    const g = r.group;
    if (step <= 2 && !S.dob) {
      const D = buildDobby(); D.root.position.set(SOFA.x, SOFA.y, SOFA.z); D.root.scale.setScalar(DS); g.add(D.root); S.dob = D;
      S.dobTris = triCount(D.root);
    }
    if (step === 2 && !S.letters.length) {
      const lm = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, emissive: new Color(0xffc860), emissiveIntensity: 0 }); S.letterMat = lm;
      for (let i = 0; i < need(); i++) { const sp = SPOTS[i], m = buildLetter(lm); m.position.set(sp.x, sp.y, sp.z); m.rotation.set(sp.rx, sp.ry, sp.rz); g.add(m); S.letters.push({ m, sp, got: 0, fly: 0 }); }
    }
  }
  function undressCommon() {
    if (S.dob && S.dob.root.parent) S.dob.root.parent.remove(S.dob.root);
    for (const L of S.letters) if (L.m.parent) L.m.parent.remove(L.m);
    S.dob = null; S.letters = [];
  }
  const RW = (x, y, z, out = new Vector3()) => out.set(x, y, z).add(interiors.room.group.position);

  // ---- outdoors: the Herbology corner ----
  function dressHerb() {
    if (S.herb || !outdoors()) return;
    const y0 = player.heightAt ? player.heightAt(HERB.x, HERB.z) : 0;
    const H = buildHerbology(need(), potCols); H.g.position.set(HERB.x, y0, HERB.z); H.g.scale.setScalar(HS); scene.add(H.g); S.herb = H;
    S.mand = []; S.potted = []; S.potFull = new Array(need()).fill(-1);
    for (let i = 0; i < need(); i++) { const m = buildMandrake(RIBBONS[i]); m.g.position.set(H.smallX[i], TABLE_H + 0.1, 0); H.g.add(m.g); S.mand.push({ ...m, i, st: 'pot', t: 0, pot: -1, from: new Vector3(), to: new Vector3() }); }
    H.muffs.visible = !S.muffsOn;
    S.herbTris = triCount(H.g);
  }
  function undressHerb() { if (S.herb && S.herb.g.parent) S.herb.g.parent.remove(S.herb.g); S.herb = null; S.mand = []; }
  const HWo = (x, y, z, out = new Vector3()) => out.set(x, y, z).multiplyScalar(HS).add(S.herb.g.position);
  function headY() { try { const b = new Box3().setFromObject(player.model); const h = b.max.y - player.pos.y; if (h > 1.1 && h < 1.95) return h; } catch { /* ok */ } return 1.7; }
  // the head bone of the rigged Harry (the muffs follow it exactly); null on the chibi fallback
  function headBone() { let hb = null; try { player.model.traverse(o => { if (!hb && o.isBone && /head$/i.test(o.name) && !/top|end/i.test(o.name)) hb = o; }); } catch { /* ok */ } return hb; }
  function headAt(out) { if (S.bone && S.bone.parent) { S.bone.getWorldPosition(out); out.y += 0.1; return out; } return out.set(player.pos.x, player.pos.y + S.headY - 0.14, player.pos.z); }
  function wearMuffs() {
    if (S.muffs) return;
    const m = buildEarmuffs(); m.name = 'adv-earmuffs-worn'; scene.add(m); S.muffs = m; S.headY = headY(); S.bone = headBone();
  }
  function dropMuffs() { if (S.muffs && S.muffs.parent) S.muffs.parent.remove(S.muffs); S.muffs = null; }

  // ---- step actions ----
  function talk() {
    if (S.talk || ctx.step !== 1) return; S.talk = 0.001; sfx('squeak');
    ctx.say('הארי פוטר! דובי כל כך שמח לפגוש אותך! 😃', DOBBY, 4);
  }
  function grabLetter(L) {
    if (L.got) return; L.got = 1; L.fly = 0.001; S.found++; ctx.poke(); sfx('chime'); sfx('flip');
    const p = RW(L.sp.x, L.sp.y + 0.1, L.sp.z, v1); burst(p.x, p.y, p.z, 0xffe07a, 16, 1.6, 0.8, 0.2, -0.6);
    const left = need() - S.found;
    try { fun.toast('💌', S.found + ' / ' + need(), 900); } catch { /* ok */ }
    if (left > 0) ctx.say(left === 1 ? 'מצאת מכתב! עוד אחד אחרון 💌' : 'מצאת מכתב! עוד ' + left + ' 💌', null, 2.2);
    else { S.bye = 0.001; ctx.say('דובי מצטער! דובי ילך עכשיו... להתראות, הארי פוטר! 👋', DOBBY, 4); }
  }
  function takeMuffs() {
    if (S.muffsOn || ctx.step !== 3 || !S.herb) return; S.muffsOn = 1; wearMuffs(); S.muffsT = 0.001; sfx('pop');
    ctx.say('מחממי אוזניים ורודים ופרוותיים! עכשיו אפשר לשלוף מנדרייקים 🎧', '🌿 פרופסור ספראוט', 4);
  }
  function pull(k) {
    const M = S.mand[k]; if (!M || M.st !== 'pot') return;
    if (S.held >= 0) { ctx.say('קודם שים את המנדרייק שביד בעציץ גדול 🪴', null, 2.5); return; }
    S.held = k; M.st = 'up'; M.t = 0; M.from.copy(M.g.position); wah(); S.wahT = 1.3; ctx.poke();
    if (S.mand.filter(m => m.st !== 'pot').length === 1) ctx.say('ואה! 😄 הוא צווח - אבל עם מחממי האוזניים זה רק ציוץ קטן. עכשיו לעציץ גדול!', null, 4);
  }
  function plant(j) {
    if (S.held < 0) { ctx.say('קודם גע במנדרייק כדי לשלוף אותו 🌱', null, 2.5); return; }
    if (S.potFull[j] >= 0) { ctx.oops('בעציץ הזה כבר יש מנדרייק 🙂 נסה עציץ ריק'); return; }
    const k = S.held, M = S.mand[k];
    if (lv() > 1 && order[j] !== k) { S.wrong++; ctx.oops('הסרט של העציץ ' + RIB_NAME[order[j]] + ' 🎀 והמנדרייק עם סרט ' + RIB_NAME[k] + '. נסה עציץ אחר!'); return; }
    S.held = -1; S.potFull[j] = k; M.st = 'fly'; M.t = 0; M.pot = j; M.from.copy(M.g.position); M.to.set(S.herb.bigX[j], 0.2, 0.95); ctx.poke(); sfx('pop');
  }

  // ---- per frame ----
  function update(dt, step) {
    S.t += dt;
    const r = interiors.room;
    if (r !== S.lastRoom) { S.lastRoom = r; if (S.room && S.room !== r) { S.dob = null; S.letters = []; } S.room = inCommon() ? r : null; if (S.room && S.active) dressCommon(step); }
    if (S.active && inCommon() && step >= 1 && step <= 2 && (!S.dob || (step === 2 && !S.letters.length))) dressCommon(step);
    if (S.active && outdoors() && step >= 3) dressHerb();
    if (S.herb) S.herb.g.visible = outdoors();
    // step 1: arriving in the common room
    if (step === 0 && inCommon() && S.active) { S.arrived += dt; if (S.arrived > 1.2 && !S.done[0]) { ctx.say('תראה! מי זה קופץ על הספה? 😮', null, 3.5); done(0); } } else if (step === 0) S.arrived = 0;
    // a spell near Dobby or the mandrakes: a kind word (they are tapped, never hexed)
    const n = casts();
    if (n !== S.casts0) { S.casts0 = n;
      if (inCommon() && step >= 1 && step <= 2 && S.dob) ctx.say('לא מטילים לחשים על דובי 🙂 רק נוגעים בו!', null, 3);
      else if (outdoors() && step >= 3 && S.herb && Math.hypot(player.pos.x - HERB.x, player.pos.z - HERB.z) < 14) ctx.say('את המנדרייקים לא מכשפים 🙂 שולפים אותם ביד!', null, 3);
    }
    animDobby(dt, step);
    animLetters(dt, step);
    animHerb(dt, step);
    // the worn earmuffs follow Harry's head
    if (S.muffs) {
      const k = S.muffsT > 0 && S.muffsT < 1 ? S.muffsT : 1;
      S.muffs.visible = !!player.model.visible;
      if (S.muffsT > 0 && S.muffsT < 1 && S.herb) { S.muffsT += dt * 1.4; HWo(2.6, 0.53, 0.3, v1); headAt(v2); S.muffs.position.lerpVectors(v1, v2, Math.min(1, S.muffsT)); S.muffs.position.y += Math.sin(Math.min(1, S.muffsT) * Math.PI) * 0.8; if (S.muffsT >= 1 && !S.muffsDone) { S.muffsDone = 1; sfx('sparkle'); burst(v2.x, v2.y + 0.2, v2.z, 0xff9ad0, 18, 1.6, 0.8, 0.22, -0.5); setTimeout(() => done(3), 600); } }
      else headAt(S.muffs.position);
      S.muffs.rotation.set(0, player.model.rotation.y, 0); void k;
    }
  }
  function animDobby(dt, step) {
    const D = S.dob; if (!D) return;
    const R0 = D.root;
    // bounce on the sofa, face Harry, flap ears
    const face = Math.atan2(player.pos.x - (SOFA.x + interiors.room.group.position.x), player.pos.z - (SOFA.z + interiors.room.group.position.z));
    R0.rotation.y += (face - R0.rotation.y) * Math.min(1, dt * 3);
    const bounce = S.bye ? 0 : Math.abs(Math.sin(S.t * (S.talk ? 2.2 : 3.4))) * (S.talk ? 0.18 : 0.42);
    R0.position.y = SOFA.y + bounce; R0.scale.set(DS, DS * (1 - Math.max(0, 0.08 - bounce) * 1.2), DS);
    D.ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * (0.1 + Math.sin(S.t * (S.talk ? 7 : 3) + i) * (S.talk ? 0.22 : 0.12)); });
    D.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (S.talk ? 1.8 + Math.sin(S.t * 8 + i * 2) * 0.5 : 0.25 + Math.sin(S.t * 3.4) * 0.4); });
    if (step === 1 && !S.talk) { if (Math.random() < dt * 3) { RW(SOFA.x, SOFA.y + 1.2 + bounce, SOFA.z, v1); emit(v1.x + (Math.random() - 0.5) * 0.4, v1.y, v1.z, 0, 0.4, 0, 0.8, 0.16, 0xffe07a, 0); } }
    // the talk: three bubbles, then the letters step
    if (S.talk > 0 && !S.talkDone) {
      const t0 = S.talk; S.talk += dt; const t = S.talk;
      if (t0 < 4.3 && t >= 4.3) { ctx.say('אבל דובי בא להזהיר: הארי פוטר לא צריך להישאר בהוגוורטס השנה! 😟', DOBBY, 4.5); sfx('soft'); }
      if (t0 < 9.0 && t >= 9.0) { ctx.say('ו... דובי מודה: דובי החביא את המכתבים של הארי! סליחה! 🙈', DOBBY, 4.5); sfx('giggle', true); }
      if (t >= 12.8) { S.talkDone = 1; done(1); }
    }
    // goodbye: a little bow, then POP (a puff of sparkles) and he is gone
    if (S.bye > 0) {
      S.bye += dt; R0.rotation.x = Math.min(0.5, S.bye * 0.6);
      if (S.bye > 3.2 && R0.visible) { R0.visible = false; RW(SOFA.x, SOFA.y + 0.5, SOFA.z, v1); burst(v1.x, v1.y, v1.z, 0xffffff, 26, 2.4, 0.9, 0.3, -0.4); sfx('poof'); }
      if (S.bye > 3.8) { done(2); }
    }
  }
  function animLetters(dt, step) {
    if (!S.letters.length) return;
    const L1 = lv() === 1, gl = L1 ? 0.55 : lv() === 2 ? 0.2 : 0;
    if (S.letterMat) S.letterMat.emissiveIntensity = Math.max(gl, S.glowHint ? 0.6 : 0) * (0.6 + 0.4 * Math.sin(S.t * 4));
    for (const L of S.letters) {
      if (L.fly > 0) { L.fly += dt; const k = Math.min(1, L.fly / 0.8); const g = interiors.room.group.position;
        L.m.position.set(L.sp.x + (player.pos.x - g.x - L.sp.x) * k, L.sp.y + (1.3 - L.sp.y) * k + Math.sin(k * Math.PI) * 0.6, L.sp.z + (player.pos.z - g.z - L.sp.z) * k); L.m.rotation.y += dt * 8; L.m.scale.setScalar(1 - k * 0.7);
        if (k >= 1) { L.m.visible = false; L.fly = -1; } continue; }
      if (!L.got && (L1 || S.glowHint) && Math.random() < dt * (L1 ? 3 : 2)) { RW(L.sp.x, L.sp.y + 0.12, L.sp.z, v1); emit(v1.x + (Math.random() - 0.5) * 0.3, v1.y, v1.z + (Math.random() - 0.5) * 0.3, 0, 0.35, 0, 0.8, 0.14, 0xffe07a, 0); }
    }
  }
  function animHerb(dt, step) {
    const H = S.herb; if (!H || !H.g.visible) return;
    if (H.muffs) H.muffs.visible = !S.muffsOn && step >= 3;
    if (step === 3 && !S.muffsOn && (lv() === 1 || S.glowHint) && Math.random() < dt * 3) { HWo(2.6, 0.6, 0.3, v1); emit(v1.x + (Math.random() - 0.5) * 0.3, v1.y, v1.z, 0, 0.4, 0, 0.8, 0.16, 0xff9ad0, 0); }
    let asleep = 0;
    S.mand.forEach((M, k) => {
      M.t += dt;
      if (M.st === 'pot') {   // sitting in its small pot, leaves poking out, a tiny sleepy sway
        M.g.position.set(H.smallX[k], TABLE_H + 0.1 + Math.sin(S.t * 1.5 + k) * 0.005, 0); M.g.rotation.set(0, 0, Math.sin(S.t * 0.8 + k) * 0.05); M.mouth.scale.set(1, 1, 1);
        if (step === 4 && S.held < 0 && (lv() === 1 || S.glowHint) && k === S.mand.findIndex(m => m.st === 'pot') && Math.random() < dt * 4) { HWo(H.smallX[k], TABLE_H + 0.45, 0, v1); emit(v1.x, v1.y, v1.z, (Math.random() - 0.5) * 0.3, 0.3, 0, 0.7, 0.14, 0xffe07a, 0); }
      } else if (M.st === 'up') {   // pulled up: it rises, wriggles its leaf hair and arms, mouth open
        const k1 = Math.min(1, M.t / 0.5); M.g.position.set(H.smallX[k], TABLE_H + 0.1 + k1 * 0.38, 0.05 * k1);
        M.g.rotation.set(0, Math.sin(S.t * 5) * 0.3, Math.sin(S.t * 14) * 0.25); M.mouth.scale.set(1.3, 4 + Math.sin(S.t * 20) * 1.2, 1);
        S.wahT -= dt; if (S.wahT <= 0) { S.wahT = 1.6; wah(); }
      } else if (M.st === 'fly') {   // into the big pot
        const k1 = Math.min(1, M.t / 0.7); M.g.position.lerpVectors(M.from, M.to, k1); M.g.position.y += Math.sin(k1 * Math.PI) * 0.5; M.g.rotation.set(0, 0, 0); M.mouth.scale.set(1, 2, 1);
        if (k1 >= 1) { M.st = 'in'; M.t = 0; burst(...HWo(M.to.x, 0.5, M.to.z, v1).toArray(), 0x9ad070, 14, 1.4, 0.7, 0.18, -1); sfx('chime'); const left = need() - S.mand.filter(m => m.st === 'in').length;
          if (left > 0) ctx.say(left === 1 ? 'יופי! עוד מנדרייק אחד 🌱' : 'יופי! עוד ' + left + ' מנדרייקים 🌱', null, 2.2);
          else { S.snore = 0.001; ctx.say('ששש... המנדרייקים נרדמים בעציצים החדשים 😴', null, 4); } }
      } else if (M.st === 'in') {   // tucked in: only the leaves and the face peek out; asleep at the end
        M.g.position.set(M.to.x, 0.2 + Math.sin(S.t * 1.2 + k) * 0.01, M.to.z); M.mouth.scale.set(1, S.snore ? 1.6 + Math.sin(S.t * 1.3 + k) * 0.6 : 1, 1); asleep++;
      }
    });
    // the sleepy z's over the pots (the end of step 5)
    const zs = H.zs;
    if (S.snore > 0) {
      S.snore += dt; zs.count = S.mand.length;
      S.mand.forEach((M, k) => { const u = (S.t * 0.35 + k / S.mand.length) % 1; v1.set(M.to.x + 0.1 + u * 0.2, 0.55 + u * 0.6, M.to.z); zs.setMatrixAt(k, _mat(v1, 0.6 + u)); });
      zs.instanceMatrix.needsUpdate = true;
      if ((S.snoreT = (S.snoreT || 0) - dt) <= 0) { S.snoreT = 2.8; tone(140, 0.8, 0, 'sine', 0.04, 100); }
      if (S.snore > 3.2) done(4);
    } else zs.count = 0;
    void asleep;
  }
  const M4 = new Matrix4();
  function _mat(p, s) { return M4.compose(p, camera.quaternion, v2.set(s, s, s)); }

  // ---- taps ----
  function tap(x, y, step) {
    const rr = R();
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (inCommon() && S.dob && S.dob.root.visible && (step === 1 || step === 2)) {
      const d = near(RW(SOFA.x, S.dob.root.position.y + 0.7, SOFA.z, v1));
      if (step === 1 && d < rr * 1.8) { talk(); return true; }
      if (step === 2) {
        let best = null, bd = 1e9; for (const L of S.letters) { if (L.got) continue; const dd = near(RW(L.sp.x, L.sp.y + 0.05, L.sp.z, v1)); if (dd < bd) { bd = dd; best = L; } }
        if (best && bd < rr * 1.5) { grabLetter(best); return true; }
        if (d < rr * 1.5) { ctx.say('דובי מצטער! 🙈 המכתבים מוסתרים בחדר', DOBBY, 2.5); return true; }
      }
      return false;
    }
    if (outdoors() && S.herb && step >= 3) {
      if (step === 3) { if (!S.muffsOn && near(HWo(2.6, 0.55, 0.3, v1)) < rr * 1.6) { takeMuffs(); return true; } return false; }
      if (step === 4 && !S.snore) {
        let bk = -1, bd = 1e9; S.mand.forEach((M, k) => { if (M.st !== 'pot') return; const dd = near(HWo(S.herb.smallX[k], TABLE_H + 0.3, 0, v1)); if (dd < bd) { bd = dd; bk = k; } });
        let bj = -1, bdj = 1e9; S.herb.bigX.forEach((x, j) => { const dd = near(HWo(x, 0.3, 0.95, v1)); if (dd < bdj) { bdj = dd; bj = j; } });
        if (S.held >= 0 && bj >= 0 && bdj < rr * 1.4 && bdj <= bd) { plant(bj); return true; }
        if (bk >= 0 && bd < rr * 1.3) { pull(bk); return true; }
        if (bj >= 0 && bdj < rr * 1.4) { plant(bj); return true; }
      }
    }
    return false;
  }

  // ---- the arrow ----
  function routeOut(out) {
    const r = interiors.room;
    if (interiors.active === 'entrancehall') { const p = (r.portals || []).find(p => p.to === 'out'); return p ? out.set(p.x, r.group.position.y, p.z) : null; }
    return ctx.routeTo('entrancehall', out, ['staircase', 'entrancehall']);
  }
  function goal(step, out) {
    if (step === 0) { if (inCommon()) return null; return ctx.routeTo('commonroom', out, ['staircase', 'entrancehall']); }
    if (step <= 2) {
      if (!inCommon()) return ctx.routeTo('commonroom', out, ['staircase', 'entrancehall']);
      if (step === 1) return S.talk ? null : RW(SOFA.x, 0.4, SOFA.z, out);
      if (S.bye) return null;
      let best = null, bd = 1e9; const g = interiors.room.group.position;
      for (const L of S.letters) { if (L.got) continue; const d = Math.hypot(player.pos.x - g.x - L.sp.x, player.pos.z - g.z - L.sp.z); if (d < bd) { bd = d; best = L; } }
      if (!best) return null;
      if (!(lv() === 1 || S.glowHint)) return null;   // levels 2-3: find them by looking (the glow hint brings the arrow back)
      return RW(best.sp.x, Math.max(0, best.sp.y - 0.5), best.sp.z, out);
    }
    if (interiors.active) return routeOut(out);
    if (!S.herb) return out.set(HERB.x, player.pos.y, HERB.z);
    if (step === 3) return S.muffsOn ? null : HWo(2.6, 0.1, 0.3, out);
    if (step === 4) {
      if (S.snore) return null;
      if (S.held >= 0) { const j = lv() > 1 ? order.indexOf(S.held) : S.potFull.findIndex(v => v < 0); if (lv() > 1 && !S.glowHint) return null; return j >= 0 ? HWo(S.herb.bigX[j], 0.1, 0.95, out) : null; }
      const k = S.mand.findIndex(m => m.st === 'pot'); return k >= 0 ? HWo(S.herb.smallX[k], TABLE_H, 0, out) : null;
    }
    return null;
  }

  function begin(step, resumed) {
    S.active = true;
    if (step >= 3 && S.dob) undressCommon();
    if (step >= 4) { S.muffsOn = 1; wearMuffs(); }
    if (step === 3 && S.muffsOn === 0) dropMuffs();
    if (step === 4 && !resumed) { /* fresh: the arrow goes to the first mandrake */ }
    if (step === 3 && !resumed) ctx.say('עכשיו לשיעור צמחי מרפא בחממה! 🌿 בחוץ, ליד הבקתות', null, 4);
    if (step === 4 && !resumed) ctx.say('שלוף מנדרייק ושים אותו בעציץ גדול 🌱' + (lv() > 1 ? ' - עם סרט באותו צבע 🎀' : ''), '🌿 פרופסור ספראוט', 4.5);
    if (!resumed) return;
    // a resume (reload / the book): go to the right place; the step starts over
    if (step >= 1 && step <= 2) { if (!inCommon()) interiors.enter('commonroom'); else dressCommon(step); }
    if (step === 4) { if (interiors.active) interiors.exit(); player.yaw = Math.PI; player.teleport(HERB.x, HERB.z + 3.2); }
  }
  function glow(step, on) { S.glowHint = !!on; }
  function together(step, fast) {
    if (step === 0) { if (inCommon()) done(0); else interiors.enter('commonroom'); return; }
    if (step === 1) { if (!inCommon()) { interiors.enter('commonroom'); setTimeout(() => { talk(); }, 1500); return; } talk(); if (fast) S.talk = Math.max(S.talk, 12.7); return; }
    if (step === 2) { if (!inCommon()) { interiors.enter('commonroom'); return; } S.letters.filter(L => !L.got).forEach((L, i) => setTimeout(() => grabLetter(L), fast ? 0 : i * 500)); if (fast) setTimeout(() => { S.bye = Math.max(S.bye, 3.7); }, 50); return; }
    if (step === 3) { if (!outdoors()) { interiors.exit(); } player.yaw = Math.PI; player.teleport(HERB.x + 2.6, HERB.z + 2.4); setTimeout(() => { dressHerb(); takeMuffs(); }, 800); return; }
    if (step === 4) {
      if (!outdoors() || !S.herb) { if (!outdoors()) interiors.exit(); player.teleport(HERB.x, HERB.z + 3.2); setTimeout(() => together(4, fast), 900); return; }
      const run1 = () => { if (S.held < 0) { const k = S.mand.findIndex(m => m.st === 'pot'); if (k < 0) return; pull(k); } const k = S.held; const j = lv() > 1 ? order.indexOf(k) : S.potFull.findIndex(v => v < 0); if (j >= 0) plant(j); };
      const n = S.mand.filter(m => m.st === 'pot').length + (S.held >= 0 ? 1 : 0);
      for (let i = 0; i < n; i++) setTimeout(run1, fast ? i * 30 : i * 900);
    }
  }
  function end() {
    S.active = false;
    undressCommon(); undressHerb(); dropMuffs();
  }
  function state() {
    return { room: interiors.active, dobby: !!(S.dob && S.dob.root.visible), dobbyTris: S.dobTris || null, talk: S.talk > 0, talkDone: !!S.talkDone, letters: S.letters.length, found: S.found, need: need(), bye: S.bye > 0,
      herb: !!S.herb, herbTris: S.herbTris || null, muffs: !!S.muffsOn, worn: !!S.muffs, held: S.held, potted: S.mand.filter(m => m.st === 'in').length, wrong: S.wrong, snore: S.snore > 0, order: order.slice() };
  }
  ctx._dobby = {
    dobbyW: () => (S.dob && inCommon() ? RW(SOFA.x, S.dob.root.position.y + 0.7, SOFA.z) : null),
    letterW: (i) => { const L = S.letters.filter(l => !l.got)[i || 0]; return L && inCommon() ? RW(L.sp.x, L.sp.y + 0.05, L.sp.z) : null; },
    letterSpot: (i) => { const L = S.letters.filter(l => !l.got)[i || 0]; return L ? { ...L.sp } : null; },
    muffsW: () => (S.herb ? HWo(2.6, 0.55, 0.3) : null),
    mandW: (k) => (S.herb ? HWo(S.herb.smallX[k], TABLE_H + 0.3, 0) : null),
    potW: (j) => (S.herb ? HWo(S.herb.bigX[j], 0.3, 0.95) : null),
    potFor: (k) => (lv() > 1 ? order.indexOf(k) : S.potFull.findIndex(v => v < 0)),
    herb: () => ({ ...HERB, y: S.herb ? S.herb.g.position.y : null }),
  };
  return { begin, update, goal, tap, glow, together, end, state };
}
