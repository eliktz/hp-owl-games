// Book adventure 2: "הטרול בשירותים" (the troll in the girls' bathroom). Data for adventures.js + the scene code.
// Silly, never scary: a big round sleepy troll sniffs, scratches his head and yawns; he never chases or swings.
// Spells go on OBJECTS only (the club, a stall latch), never on the troll or a person. No fail state.
// Steps: 1 feast (walk to the Great Hall: quest pumpkins float over the tables, Ron's bubble) -> 2 follow the muddy
// footprints across the Entrance Hall to a door "שירותי הבנות" (south wall, east of the front doors; only while the
// quest runs) into the 'trollroom' interior -> 3 tap sinks (3/4/5 by level) until the troll turns to look at them ->
// 4 Wingardium Leviosa on his club (a real freecast target): it floats up, drops "boing" on his head, stars, he sits,
// yawns and falls asleep -> 5 tap Hermione's stall (or Alohomora on its latch): she steps out, "עכשיו אנחנו חברים!".
// Levels 2-3: more sinks, her stall not marked; the other two hold a mop and a bucket with a kind "לא כאן".
import { Vector3, Object3D, Quaternion, AnimationMixer, LoopOnce } from 'three';
import { animateChibi } from './chibi.js';
import { BUILDERS, FLOOR_Y } from './rooms.js';
import { loadAnimated } from './models.js';
import { buildTrollRoom, buildHallDoor, buildFootprints, buildPumpkins, SINK_Z, SINK_X, STALL_Z, STALL_X, TROLL_AT, SPAWN, HALL_DOOR, PRINT_PATH, triCount } from './adventure-troll-build.js';

const RON = { ico: '👦', name: 'רון' };
export const TROLL = {
  id: 'troll', title: 'הטרול בשירותים', ico: '🧌', col: '#3a5a3a', col2: '#8ab07a', helper: RON, confetti: ['✨', '⭐', '🪶', '🎃'],
  pic: [['🧌', 0.5, 0.55, 74], ['🪶', 0.8, 0.3, 34], ['🎃', 0.18, 0.3, 32]],
  intro: [
    'ליל כל הקדושים בהוגוורטס! 🎃',
    'כל התלמידים בסעודה הגדולה... אבל משהו מצחיק קורה בטירה.',
    'בוא נלך לאולם הגדול. אני רון, ואני אעזור לך! ✨',
  ],
  steps: [
    { line: 'לך אל האולם הגדול לסעודה 🎃', hints: ['האולם הגדול נמצא ליד אולם הכניסה 🎃', 'לך אחרי החץ הזהוב אל הדלת הגדולה', 'אפשר גם לטוס ברשת הפלו אל האולם הגדול 🔥'], glowL1: true },
    { line: 'עקוב אחרי העקבות הגדולות 👣', hints: ['ראית את עקבות הבוץ הגדולות? 👣', 'העקבות מובילות אל דלת חדשה באולם הכניסה', 'לך אל הדלת "שירותי הבנות" 🚪'], glowL1: true },
    { line: 'עשה רעש כדי שהטרול יסתובב 🚰', hints: ['גע בברזים של הכיורים כדי לעשות רעש 🚰', 'הכיורים ליד המראה הגדולה. גע בהם!', 'עוד כיור ועוד כיור... הטרול יסתובב!'], glowL1: true },
    { line: 'הטל וינגרדיום לביוסה על האלה 🪶', hints: ['האלה של הטרול על הרצפה. בוא נרים אותה! 🪶', 'בחר וינגרדיום לביוסה בגלגל ונופף בשרביט', 'הלחש הזוהר בגלגל: וינגרדיום לביוסה 🪶'], spell: 'leviosa' },
    { line: 'פתח את הדלת להרמיוני 🚪', hints: ['הרמיוני מסתתרת באחד התאים 🚪', 'הקשב: מאיזה תא מגיע הקול?', 'גע בדלת של התא, או הטל אלוהומורה 🔓'], spell: 'alohomora' },
  ],
  create: (ctx) => trollScene(ctx),
  art: drawSleepyTroll,
};
// the reward card picture: a round, friendly, sleeping troll with his club on the floor and a feather above (canvas)
function drawSleepyTroll(x, cx, cy) {
  const E = (px, py, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, 7); x.fill(); };
  x.save(); x.translate(cx, cy + 20);
  x.strokeStyle = '#6a4426'; x.lineWidth = 14; x.lineCap = 'round'; x.beginPath(); x.moveTo(-90, 72); x.lineTo(-20, 86); x.stroke(); E(-98, 70, 20, 16, '#8a5e36');   // the club on the floor
  E(0, 30, 70, 62, '#8c9a72'); E(0, 42, 48, 40, '#a2ac84'); E(0, 66, 74, 18, '#7a5634');                          // the round body, belly, loincloth
  E(-58, 84, 26, 14, '#76865e'); E(58, 84, 26, 14, '#76865e');                                                    // feet
  E(-66, 40, 18, 36, '#8c9a72', 0.4); E(66, 40, 18, 36, '#8c9a72', -0.4);                                         // arms
  E(0, -40, 36, 32, '#8c9a72'); E(-38, -42, 12, 7, '#76865e', 0.5); E(38, -42, 12, 7, '#76865e', -0.5);            // head, ears
  E(0, -34, 12, 10, '#76865e'); E(-18, -28, 7, 5, '#c8907a'); E(18, -28, 7, 5, '#c8907a');                         // nose, cheeks
  x.strokeStyle = '#2a2018'; x.lineWidth = 3; for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 13, -46, 6, 0.2, Math.PI - 0.2); x.stroke(); }   // closed, sleeping eyes
  x.beginPath(); x.arc(0, -22, 7, 0.3, Math.PI - 0.3); x.stroke();                                                  // a little smile
  x.fillStyle = '#4a6a3a'; x.font = 'bold 30px Arial'; x.fillText('z', 36, -76); x.font = 'bold 22px Arial'; x.fillText('z', 58, -98); x.font = 'bold 16px Arial'; x.fillText('z', 74, -114);
  x.restore();
  x.save(); x.font = '40px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🪶', cx - 60, cy - 90); x.restore();
}

// the bathroom interior: always registered (built from the quest's progress at build time)
let PROGRESS = 0;
export const BATH = { myrtle: false };   // true while b2-polyjuice runs: the same room, no troll (adventure-b2-polyjuice.js)
BUILDERS.trollroom = () => {
  const B = buildTrollRoom(PROGRESS, { noTroll: BATH.myrtle });
  const g = B.g; g.position.y = FLOOR_Y;
  const portals = [{ x: 0, z: 5.4, r: 0.85, to: 'entrancehall', at: { x: HALL_DOOR.x, z: HALL_DOOR.z - 2.2, yaw: Math.PI } }];
  for (const p of portals) p.armed = false;
  g.userData.adv = B;
  return { group: g, colliders: B.cols, portals, spawn: { ...SPAWN, y: FLOOR_Y }, update(dt, t) { B.light.update(t); } };
};

const PUMPKIN_AT = [[-5, 2.7, 12], [5, 2.9, 10], [-5, 3.1, 4], [5, 2.6, 0], [-5, 2.8, -5], [5, 3.0, -9]];
const NEED = { 1: 3, 2: 4, 3: 5 };
// the club's flight, in the troll's own frame (he faces +z there): up over his head, flat, then down on the floor
const CLUB_TOP = new Vector3(0.75, 4.25, 0.15), CLUB_HIT = new Vector3(0.75, 3.5, 0.15), CLUB_FLOOR = new Vector3(-1.1, 0.12, 1.5);
const Q_FLAT = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);

function trollScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit, camera } = ctx;
  const S = { active: false, lastRoom: null, B: null, door: null, prints: null, pk: null, feast: -1, sinks: [], turn: 0, club: 0, clubDone: 0, herm: 2, opened: [0, 0, 0], wrongT: [0, 0, 0], out: 0, outDone: 0, wrong: 0, casts0: 0, castHit: false, voiceT: 4, scratch: 0, scratchT: 3, hermGlb: null, mixer: null };
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0, type = 'triangle', v = 0.12, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  const lv = () => ctx.level;
  const need = () => NEED[lv()] || 3;
  const inRoom = () => interiors.active === 'trollroom' && S.B;
  const Y = FLOOR_Y;
  const W = (x, y, z, out = new Vector3()) => out.set(x, Y + y, z);
  const FI = freecast && freecast._internal;
  const scr = { x: 0, y: 0, on: false };
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const v1 = new Vector3(), d0 = new Object3D();
  S.herm = lv() === 1 ? 2 : Math.floor(Math.random() * 3);

  // ---- spells: Leviosa on the club; Alohomora on a stall latch (objects only, never the troll) ----
  const T = [];
  if (FI && Array.isArray(FI.TARGETS)) {
    T.push({ id: 'adv-club', spells: ['leviosa'], at: (o) => clubW(o), ok: () => inRoom() && ctx.step === 3 && !S.club, cast: () => { S.castHit = true; liftClub(); } });
    STALL_Z.forEach((z, i) => T.push({ id: 'adv-latch-' + i, spells: ['alohomora'], at: (o) => W(STALL_X - 0.05, 1.15, z + 0.5, o), ok: () => inRoom() && ctx.step === 4 && !S.opened[i] && !S.out, cast: () => { S.castHit = true; openStall(i); } }));
    for (const t of T) FI.TARGETS.push(t);
  }
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();
  function clubW(o = new Vector3()) { if (!S.B) return W(TROLL_AT.x, 0.8, TROLL_AT.z, o); S.B.P.troll.club.getWorldPosition(o); o.y += 0.3; return o; }

  // ---- room dressing added to live rooms while the quest runs ----
  function dressHall() {
    const r = interiors.room; if (!r || !r.group || r.group.userData.advBath) return;
    const door = buildHallDoor(), prints = buildFootprints(PRINT_PATH);
    r.group.add(door, prints); r.group.userData.advBath = { door, prints };
    const p = { x: HALL_DOOR.x, z: HALL_DOOR.z - 0.9, r: 0.9, to: 'trollroom', at: { ...SPAWN }, locked: () => !S.active || ctx.step < 1, armed: false };
    r.portals.push(p);
    r.colliders.push({ type: 'box', x: HALL_DOOR.x, z: HALL_DOOR.z - 0.1, hw: 1.1, hd: 0.15, angle: 0 });
    S.door = { door, prints, p };
  }
  function dressGreatHall() {
    const r = interiors.room; if (!r || !r.group || r.group.userData.advPumpkins) return;
    const pk = buildPumpkins(PUMPKIN_AT.length); r.group.add(pk.mesh, pk.stem); r.group.userData.advPumpkins = pk; S.pk = pk;
  }

  // ---- step actions ----
  function feast() {
    if (S.feast >= 0) return; S.feast = 0.001;
    ctx.say('הארי! טרול נכנס לטירה! 😮 והרמיוני בשירותי הבנות - היא לא יודעת! בוא נזהיר אותה!', '👦 רון', 7);
    sfx('chime');
  }
  function tapSink(i) {
    if (S.turn || S.sinks.includes(i)) { squirt(i); return; }
    S.sinks.push(i); squirt(i); sfx('clank'); tone(300 + S.sinks.length * 80, 0.18, 0.05, 'sine', 0.1, 900);
    const left = need() - S.sinks.length;
    if (left > 0) ctx.say(left === 1 ? 'עוד כיור אחד! הטרול מרחרח... 👃' : 'קלאנג! עוד ' + left + ' כיורים 🚰', null, 2.4);
    else { S.turn = 0.001; ctx.say('הטרול מסתובב לראות מה הרעש! 😄', null, 3); }
  }
  const squirts = [];
  function squirt(i) { squirts.push({ i, t: 2.2 }); }
  function liftClub() {
    if (S.club) return; S.club = 0.001; sfx('sparkle'); tone(660, 0.4, 0, 'sine', 0.1, 1320);
    ctx.say('וינגרדיום לביוסה! האלה עפה למעלה! 🪶', null, 3);
  }
  function openStall(i) {
    if (S.out || S.opened[i] && i === S.herm) return;
    if (i === S.herm) { S.opened[i] = 0.001; S.out = 0.001; sfx('pop'); ctx.say('הרמיוני! מצאנו אותך! 💛', null, 3); return; }
    S.opened[i] = 0.001; S.wrongT[i] = 0.001; S.wrong++; sfx('soft');
    ctx.oops('לא כאן 🙂 רק ' + (propOf(i) === 0 ? 'מגב 🧹' : 'דלי 🪣') + '. נסה תא אחר!');
  }
  // which prop stands in which wrong stall
  const propOf = (i) => { const wrong = [0, 1, 2].filter(k => k !== S.herm); return wrong.indexOf(i); };

  // ---- the rigged Hermione (cached GLB) replaces the chibi when it is available ----
  function upgradeHerm(B) {
    if (B.hermTried) return; B.hermTried = true;
    loadAnimated('hermione_young', () => S.active && S.B === B).then(r => {
      if (!r || S.B !== B) return;
      const idle = r.clips.find(c => c.name === 'Idle'); if (!idle) return;
      const o = r.obj; o.updateMatrixWorld(true);
      let minY = 1e9, maxY = -1e9; o.traverse(m => { if (m.isMesh) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld); minY = Math.min(minY, b.min.y); maxY = Math.max(maxY, b.max.y); } });
      let h = maxY - minY; if (!(h > 0.5 && h < 10)) h = 1.43;
      const k = 1.62 / h; o.scale.setScalar(k); o.position.y = -(Math.abs(minY) < 0.5 ? minY : 0) * k;
      o.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.userData.sharedGeo = true; m.raycast = () => {}; } });
      const herm = B.P.herm; for (const c of herm.children) c.visible = false; herm.scale.setScalar(1); herm.add(o); herm.userData.rig = null;
      S.hermGlb = { o, clips: r.clips };
      {
        const mx = new AnimationMixer(o), acts = {};
        for (const n of ['Idle', 'Wave', 'Talk', 'Cheer']) { const c = r.clips.find(a => a.name === n); if (c) acts[n.toLowerCase()] = mx.clipAction(c); }
        if (acts.wave) { acts.wave.setLoop(LoopOnce, 1); acts.wave.clampWhenFinished = true; }
        acts.idle.play(); S.mixer = mx; S.acts = acts;
        o.userData.onTeardown = () => { try { mx.stopAllAction(); } catch { /* ok */ } };
      }
    }).catch(() => {});
  }

  // ---- per frame ----
  let tt = 0;
  function update(dt, step) {
    tt += dt;
    const r = interiors.room;
    if (r !== S.lastRoom) {   // a room arrived
      S.lastRoom = r; S.B = interiors.active === 'trollroom' && r && r.group ? r.group.userData.adv : null;
      if (interiors.active === 'entrancehall' && S.active) dressHall();
      if (interiors.active === 'greathall' && S.active) dressGreatHall();
      if (S.B) { upgradeHerm(S.B); syncRoom(S.B, step); if (step === 1) arrive(); }
    }
    if (S.door) { const on = S.active && interiors.active === 'entrancehall' && step >= 1; S.door.door.visible = on; S.door.prints.visible = on && step <= 1; }
    // the feast: pumpkins bob over the tables; arriving in the Great Hall completes step 1
    if (S.pk && interiors.active === 'greathall') {
      const pk = S.pk; pk.mesh.visible = pk.stem.visible = S.active;
      for (let i = 0; i < pk.n; i++) { const [x, y, z] = PUMPKIN_AT[i], yy = y + Math.sin(tt * 0.9 + i * 1.3) * 0.18, ry = Math.sin(tt * 0.4 + i) * 0.5;
        d0.position.set(x + Math.sin(tt * 0.3 + i) * 0.3, yy, z); d0.rotation.set(0, ry, Math.sin(tt * 0.8 + i) * 0.08); d0.scale.setScalar(1); d0.updateMatrix(); pk.mesh.setMatrixAt(i, d0.matrix);
        d0.position.y += 0.36; d0.updateMatrix(); pk.stem.setMatrixAt(i, d0.matrix); }
      pk.mesh.instanceMatrix.needsUpdate = true; pk.stem.instanceMatrix.needsUpdate = true;
    }
    if (step === 0 && interiors.active === 'greathall' && S.active) { if (S.feast < 0) feast(); }
    if (S.feast > 0) { S.feast += dt; if (S.feast > 2.2 && !S.feastDone) { S.feastDone = 1; ctx.done(0); } }
    if (step === 1 && inRoom() && !S.arrived) arrive();
    // casts: the wrong spell in the bathroom gets a kind word
    const n = casts();
    if (n !== S.casts0) {
      S.casts0 = n; const k = freecast && freecast.selected ? freecast.selected() : null, hit = S.castHit; S.castHit = false;
      if (inRoom() && step === 3 && !S.club && !hit) { if (k === 'leviosa') liftClub(); else ctx.oops('האלה כבדה מדי לזה... נסה וינגרדיום לביוסה 🪶'); }
      else if (inRoom() && step === 4 && !S.out && !hit) ctx.say('גע בדלת של התא, או הטל אלוהומורה 🔓', null, 3);
      else if (inRoom() && step === 2 && !hit) ctx.say('קודם רעש! גע בברזים של הכיורים 🚰', null, 3);
    }
    if (!S.B) return;
    const B = S.B, P = B.P, Tr = P.troll;
    // water squirts from the taps
    for (let k = squirts.length - 1; k >= 0; k--) { const q = squirts[k]; q.t -= dt; if (q.t <= 0) { squirts.splice(k, 1); continue; }
      if (Math.random() < dt * 30) emit(SINK_X - 0.1 + B.g.position.x, Y + 1.15, SINK_Z[q.i] + (Math.random() - 0.5) * 0.06, 0.6 + Math.random() * 0.5, 1.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4, 0.8, 0.12, 0x8ad0ff, -6); }
    // level 1: untapped sinks sparkle a little
    if (step === 2 && !S.turn && lv() === 1 && Math.random() < dt * 4) { const free = SINK_Z.map((_, i) => i).filter(i => !S.sinks.includes(i)); const i = free[Math.floor(Math.random() * free.length)]; if (i !== undefined) emit(SINK_X - 0.2, Y + 1.3, SINK_Z[i], 0, 0.4, 0, 0.9, 0.18, 0xffe07a, 0); }
    animTroll(dt, step, Tr);
    // stall doors: wrong ones swing open, show a mop / bucket, close again; Hermione's opens and she steps out
    P.doors.forEach((h, i) => {
      let want = 0;
      if (S.opened[i] && i === S.herm) want = 1.6;
      else if (S.wrongT[i] > 0) { S.wrongT[i] += dt; want = S.wrongT[i] < 2.6 ? 1.3 : 0.25; }
      h.rotation.y += (want - h.rotation.y) * Math.min(1, dt * 3);
    });
    const showProp = (i) => { const k = propOf(i); const m = k === 0 ? P.mop : P.bucket; if (!m) return; m.visible = true; m.position.set(STALL_X + 0.9, 0, STALL_Z[i] + 0.2); };
    [0, 1, 2].forEach(i => { if (i !== S.herm && S.wrongT[i] > 0) showProp(i); });
    if (S.wrongT.some((t, i) => t > 0 && i !== S.herm) === false) { P.mop.visible = P.bucket.visible = false; }
    // the voice from the stall (levels 2-3: unmarked; level 1: the arrow + a bubble over the right door)
    if (step === 4 && !S.out) {
      S.voiceT -= dt;
      if (S.voiceT <= 0) { S.voiceT = lv() === 1 ? 9 : 14; ctx.say(lv() === 1 ? 'הלו? מה הרעש הזה? אני כאן, בתא הזה! 🚪' : 'הלו? יש פה מישהו? 😮', '👧 קול מתוך תא', 3.5); }
    }
    // level 1 (or the glow hint): the bubble bobs over her stall
    const bub = P.bub; if (bub) { bub.visible = step === 4 && !S.out && (lv() === 1 || !!S.glow); if (bub.visible) { bub.position.set(STALL_X - 0.15, 2.75 + Math.sin(tt * 2.5) * 0.08, STALL_Z[S.herm]); bub.quaternion.copy(camera.quaternion); } }
    // Hermione
    const H = P.herm;
    if (S.out > 0) {
      S.out += dt; H.visible = true;
      const k1 = Math.min(1, Math.max(0, (S.out - 0.6) / 1.0)), k2 = Math.min(1, Math.max(0, (S.out - 1.6) / 1.0)), z = STALL_Z[S.herm], k = k1 < 1 ? k1 * 0.5 : 0.5 + k2 * 0.5;
      H.position.set(STALL_X + 0.9 - 1.4 * k1, 0, z + (1.0 - z) * k2);
      const face = Math.atan2(player.pos.x - H.position.x, player.pos.z - H.position.z), walkYaw = k1 < 1 ? -Math.PI / 2 : (z < 1.0 ? 0 : Math.PI);
      H.rotation.y = S.out > 2.7 ? face : walkYaw;
      if (H.userData.rig) { try { animateChibi(H.userData.rig, dt, { moving: k > 0 && k < 1 }); } catch { /* ok */ } }
      if (S.out > 2.9 && !S.saidThanks) { S.saidThanks = 1; ctx.say('תודה, הארי ורון! עכשיו אנחנו חברים! 💛', '👧 הרמיוני', 5); if (S.acts && S.acts.wave) { S.acts.idle.fadeOut(0.3); S.acts.wave.reset().fadeIn(0.3).play(); } sfx('heart'); W(H.position.x, 1.8, H.position.z, v1); burst(v1.x, v1.y, v1.z, 0xff8aa0, 20, 1.6, 1.2, 0.22, -0.6); }
      if (S.out > 4.6 && !S.outDone) { S.outDone = 1; ctx.done(4); }
    } else if (step >= 5) { H.visible = true; }
    if (S.mixer) { try { S.mixer.update(dt); } catch { /* ok */ } }
  }
  function arrive() { if (S.arrived) return; S.arrived = true; ctx.say('ששש... הנה הטרול! הוא מרחרח ליד התאים 👃 הרמיוני שם!', '👦 רון', 5); ctx.done(1); }
  // a room built after a reload / resume: put things where the progress says
  function syncRoom(B, step) {
    const Tr = B.P.troll;
    if (step >= 3) { S.turn = S.turn || 9; Tr.root.rotation.y = -Math.PI / 2; }
    if (step >= 4) { S.club = S.club || 99; S.clubDone = 1; }
    if (step >= 5) { S.out = S.out || 99; }
  }

  function animTroll(dt, step, Tr) {
    // the turn toward the sinks (step 3)
    if (S.turn > 0) { S.turn += dt; const k = Math.min(1, S.turn / 2.2), e = k * k * (3 - 2 * k); Tr.root.rotation.y = Math.PI / 2 + (-Math.PI) * e;
      if (S.turn > 2.6 && !S.turnDone) { S.turnDone = 1; if (step === 2) ctx.done(2); } }
    // the club: lifts out of his hand, hovers, drops on his head (boing), stars, he sits, yawns, sleeps
    const c = Tr.club, cr = Tr.CLUB_REST;
    if (S.club > 0 && S.club < 99) {
      S.club += dt; const t = S.club;
      if (t < 1.8) { const k = t / 1.8, e = k * k * (3 - 2 * k); c.position.lerpVectors(cr.pos, CLUB_TOP, e); c.quaternion.slerpQuaternions(cr.quat, Q_FLAT, e); c.rotateY(t * 1.5); Tr.head.rotation.x = -0.55 * e; Tr.armR.rotation.x = -0.6 * e; }
      else if (t < 3.0) { c.position.set(CLUB_TOP.x + Math.sin(t * 3) * 0.12, CLUB_TOP.y + Math.sin(t * 5) * 0.08, CLUB_TOP.z); c.quaternion.copy(Q_FLAT); c.rotateY(t * 1.5); Tr.head.rotation.x = -0.55; Tr.head.rotation.z = Math.sin(t * 2) * 0.15;
        if (!S.puzzled) { S.puzzled = 1; ctx.say('הטרול מסתכל למעלה... "מה? איפה האלה שלי?" 🤔', '👦 רון', 3); } }
      else if (t < 3.35) { const k = (t - 3.0) / 0.35; c.position.set(CLUB_TOP.x, CLUB_TOP.y - 0.75 * k * k, CLUB_TOP.z); Tr.head.rotation.x = -0.55 * (1 - k); }
      else {
        if (!S.boing) { S.boing = 1; sfx('boing'); setTimeout(() => sfx('boing'), 260); ctx.say('בוינג! 😵‍💫', null, 2); Tr.head.getWorldPosition(v1); burst(v1.x, v1.y + 0.8, v1.z, 0xffe26a, 16, 1.6, 0.9, 0.22, -0.5); }
        // the club bounces off and lies down on the floor beside him
        const k = Math.min(1, (t - 3.35) / 0.9); c.position.lerpVectors(CLUB_HIT, CLUB_FLOOR, k); c.position.y += Math.sin(k * Math.PI) * 0.7; c.quaternion.copy(Q_FLAT); c.rotateZ(k * 0.3);
        const sq = Math.max(0, 1 - (t - 3.35) * 3); Tr.head.scale.set(1 + sq * 0.15, 1 - sq * 0.2, 1 + sq * 0.15);
        // stars circle for a while
        const st = Tr.stars; if (t < 6.5) { st.count = 5; const qi = Tr.root.quaternion.clone().invert(); for (let i = 0; i < 5; i++) { const a = t * 3 + i * 1.256; d0.position.set(Math.cos(a) * 0.55, 3.05 - (S.sit || 0) * 0.62 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.55 + 0.1); d0.quaternion.copy(camera.quaternion).premultiply(qi); d0.scale.setScalar(1); d0.updateMatrix(); st.setMatrixAt(i, d0.matrix); } st.instanceMatrix.needsUpdate = true; } else st.count = 0;
        if (t > 4.2) { S.sit = Math.min(1, (t - 4.2) / 1.0); }
        if (t > 5.4 && t < 6.8) { const y = Math.sin((t - 5.4) / 1.4 * Math.PI); Tr.mouth.scale.set(1 + y * 0.4, 1 + y * 6, 1); Tr.armL.rotation.x = -2.4 * y; Tr.armR.rotation.x = -2.2 * y; if (!S.yawn) { S.yawn = 1; tone(220, 1.0, 0, 'sine', 0.12, 140); } }
        if (t > 7.2 && !S.clubDone) { S.clubDone = 1; ctx.say('הוא נרדם! זזזז... 😴', null, 3); ctx.done(3); }
      }
    }
    if (S.club >= 99) { c.position.copy(CLUB_FLOOR); c.quaternion.copy(Q_FLAT); c.rotateZ(0.3); S.sit = 1; Tr.stars.count = 0; }
    const sit = S.sit || 0;
    Tr.body.position.y = 0.95 - 0.62 * sit; Tr.legs.position.y = 0.95 - 0.62 * sit; Tr.legs.rotation.x = -1.35 * sit;
    Tr.armL.position.y = Tr.armR.position.y = 2.35 - 0.62 * sit;
    const sleeping = S.club > 7.0;
    if (sleeping) {
      const br = Math.sin(tt * 1.1);
      Tr.body.scale.set(1, 1 + br * 0.03, 1 + br * 0.02); Tr.head.rotation.x = 0.35 + br * 0.04; Tr.head.rotation.z = 0.25; Tr.mouth.scale.set(1, 1.6 + br * 0.6, 1);
      if (!(S.club > 5.4 && S.club < 6.8)) { Tr.armL.rotation.x = -0.3; Tr.armR.rotation.x = -0.3; Tr.armL.rotation.z = 0.25; Tr.armR.rotation.z = -0.25; }
      const zs = Tr.zs; zs.count = 4; const qi = Tr.root.quaternion.clone().invert();
      for (let k = 0; k < 4; k++) { const u = ((tt * 0.3 + k / 4) % 1); d0.position.set(0.3 + u * 0.6, 2.6 + u * 1.4, 0.4 + Math.sin(u * 6 + k) * 0.15); d0.quaternion.copy(camera.quaternion).premultiply(qi); d0.scale.setScalar(0.5 + u * 1.2 * (1 - u)); d0.updateMatrix(); zs.setMatrixAt(k, d0.matrix); }
      zs.instanceMatrix.needsUpdate = true;
      if ((S.snoreT = (S.snoreT || 0) - dt) <= 0) { S.snoreT = 3.6; if (inRoom()) tone(110, 0.9, 0, 'sine', 0.05, 80); }
    } else if (!(S.club > 0)) {
      // awake: slow sway, sniffing, now and then a head scratch
      Tr.body.rotation.z = Math.sin(tt * 0.6) * 0.04; Tr.head.rotation.y = Math.sin(tt * 0.5) * 0.25; Tr.head.rotation.x = Math.sin(tt * 3.2) * 0.04 + (step === 2 && !S.turn ? 0.05 : 0);
      const br = Math.sin(tt * 1.3); Tr.body.scale.set(1, 1 + br * 0.025, 1);
      S.scratchT -= dt;
      if (S.scratchT <= 0 && !S.scratch) { S.scratch = 0.001; S.scratchT = 6 + Math.random() * 4; }
      if (S.scratch > 0) { S.scratch += dt; const k = S.scratch; const up = k < 0.8 ? k / 0.8 : k > 2.6 ? Math.max(0, 1 - (k - 2.6) / 0.8) : 1; Tr.armL.rotation.x = -2.9 * up; Tr.armL.rotation.z = -0.5 * up + (up > 0.9 ? Math.sin(k * 18) * 0.08 : 0); if (k > 3.4) { S.scratch = 0; Tr.armL.rotation.set(0, 0, 0); } }
      // a yawn now and then (cute, harmless)
      const yw = Math.max(0, Math.sin(tt * 0.35)) ** 12; Tr.mouth.scale.set(1 + yw * 0.3, 1 + yw * 4, 1);
    }
  }

  // ---- taps: sinks, stalls; tapping the troll gets a kind word ----
  function tap(x, y, step) {
    if (!inRoom()) return false;
    const rr = R();
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (step === 2 && !S.turn) {
      let bi = -1, bd = 1e9; SINK_Z.forEach((z, i) => { const d = near(W(SINK_X - 0.1, 1.0, z, v1)); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0 && bd < rr * 1.3) { tapSink(bi); return true; }
    }
    if (step === 4 && !S.out) {
      let bi = -1, bd = 1e9; STALL_Z.forEach((z, i) => { const d = near(W(STALL_X, 1.1, z, v1)); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0 && bd < rr * 1.6) { openStall(bi); return true; }
    }
    if (near(W(TROLL_AT.x, 2.0, TROLL_AT.z, v1)) < rr * 1.8) {
      ctx.say(step >= 4 ? 'ששש... הטרול ישן 😴' : step === 3 ? 'לא נוגעים בטרול 🙂 מרימים את האלה בלחש 🪶' : 'הטרול לא שם לב... בוא נעשה רעש עם הכיורים 🚰', null, 2.6); return true;
    }
    return false;
  }

  // ---- where the arrow points ----
  function goal(step, out) {
    if (step === 0) { if (interiors.active === 'greathall') return null; return ctx.routeTo('greathall', out, ['entrancehall', 'staircase']); }
    if (!inRoom()) {
      if (interiors.active === 'entrancehall') return out.set(HALL_DOOR.x, Y + 1.95, HALL_DOOR.z - 0.7);   // the arrow floats over the door, clear of its sign
      return ctx.routeTo('entrancehall', out, ['entrancehall', 'staircase']);
    }
    if (step === 2) { if (S.turn) return null; const free = SINK_Z.map((_, i) => i).filter(i => !S.sinks.includes(i)); let bi = free[0], bd = 1e9; for (const i of free) { const d = Math.hypot(player.pos.x - SINK_X, player.pos.z - SINK_Z[i]); if (d < bd) { bd = d; bi = i; } } return W(SINK_X + 0.1, 0.5, SINK_Z[bi], out); }
    if (step === 3) { if (S.club) return null; return clubW(out).setY(Y + 0.2); }
    if (step === 4) { if (S.out) return null; if (lv() === 1 || S.glow) return W(STALL_X - 0.2, 0.3, STALL_Z[S.herm], out); return W(STALL_X - 1.0, 0, STALL_Z[1], out); }
    return null;
  }

  function begin(step, resumed) {
    S.active = true; PROGRESS = step; S.voiceT = 3;
    if (step === 0) { if (interiors.active !== 'greathall') { if (interiors.active === 'entrancehall') { player.yaw = -Math.PI / 2; player.teleport(-1.5, 1.0); } else interiors.enter('entrancehall', { x: -1.5, z: 1.0, yaw: -Math.PI / 2 }); } return; }
    if (!resumed) return;
    if (step === 1) { if (interiors.active !== 'entrancehall') interiors.enter('entrancehall', { x: -5.6, z: 1.6, yaw: 0.9 }); else { player.yaw = 0.9; player.teleport(-5.6, 1.6); } return; }
    if (interiors.active !== 'trollroom') interiors.enter('trollroom', { ...SPAWN }); else if (S.B) syncRoom(S.B, step);
  }
  function glow(step, on) { S.glow = on && step === 4; }
  function together(step, fast) {
    const inside = (fn, d = 1100) => { if (inRoom()) fn(); else { interiors.enter('trollroom', { ...SPAWN }); setTimeout(fn, d); } };
    if (step === 0) { if (interiors.active === 'greathall') feast(); else interiors.enter('greathall'); }
    else if (step === 1) { if (inRoom()) arrive(); else interiors.enter('trollroom', { ...SPAWN }); }
    else if (step === 2) inside(() => { const free = SINK_Z.map((_, i) => i).filter(i => !S.sinks.includes(i)); free.slice(0, Math.max(0, need() - S.sinks.length)).forEach((i, k) => setTimeout(() => tapSink(i), fast ? 0 : k * 450)); });
    else if (step === 3) inside(liftClub);
    else if (step === 4) inside(() => openStall(S.herm));
  }
  function end() {
    S.active = false;
    if (S.door) { S.door.door.visible = false; S.door.prints.visible = false; }
    if (S.pk) S.pk.mesh.visible = S.pk.stem.visible = false;
    if (FI && Array.isArray(FI.TARGETS)) for (const t of T) { const i = FI.TARGETS.indexOf(t); if (i >= 0) FI.TARGETS.splice(i, 1); }
  }
  function state() {
    return { room: interiors.active, sinks: S.sinks.slice(), need: need(), turned: !!S.turnDone, club: S.club > 0, asleep: S.club > 7, herm: S.herm, opened: S.opened.map(Boolean), out: S.out > 0, wrong: S.wrong, feast: S.feast > 0,
      door: !!(S.door && S.door.door.visible), prints: !!(S.door && S.door.prints.visible), pumpkins: !!(S.pk && S.pk.mesh.visible), hermGlb: !!S.hermGlb,
      trollTris: S.B ? triCount(S.B.P.troll.root) : null };
  }
  ctx._troll = {
    sinkW: (i) => W(SINK_X - 0.1, 1.0, SINK_Z[i]),
    stallW: (i) => W(STALL_X, 1.1, STALL_Z[i]),
    clubW: () => clubW(),
    trollW: () => W(TROLL_AT.x, 2.0, TROLL_AT.z),
    doorW: () => new Vector3(HALL_DOOR.x, Y + 1.6, HALL_DOOR.z - 0.3),
  };
  return { begin, update, goal, tap, glow, together, end, state };
}
