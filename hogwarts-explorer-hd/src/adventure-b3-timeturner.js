// Book 3, adventure 5: "מחזיר הזמן" (the Time-Turner), helper Hermione. Data for adventures.js + the scene code.
// Decisions: briefs/2026-11-26-book3-piece-c.md. Played in the staircase hall (quest props on its west side, only while the
// quest runs). Steps: 1 meet Hermione's bubble in the staircase hall: she shows the Time-Turner (a small gold hourglass in
// rings on a chain, spinning above Harry's hand) and a ⏳ button appears -> 2 a big oak door swings shut by itself unless
// someone holds its handle, and behind it a runaway golden ball keeps bouncing: tap the handle: Harry holds the door for
// 5 s (a ring fills; the ball zooms round and he cannot let go to catch it; nothing fails) -> 3 tap ⏳: the gold / sepia
// rewind: a translucent GOLD Harry walks backwards to the door and STAYS there holding the handle (smiling, warm) -> 4 the
// real Harry is free: tap the ball as it comes by (level 1: slow, glowing, 2 taps; levels 2-3: 3 taps, and first one more
// rewind beat: the other Harry also pulls a lever that wakes the ball); a miss = "כמעט!" and it comes round again ->
// 5 both Harrys wave, the gold Harry fades in sparkles, Hermione: "עכשיו אתה יודע את הסוד". No fail anywhere.
// Spells: none needed; a spell cast here (or at the other Harry) only gets a kind bubble. Budgets (indoor): the door 1 draw
// call, its leaf 1, the ball 1, the Time-Turner 1, the gold Harry 1, the lever 1 (levels 2-3): <= +6 over the hall.
// Debug: window.__game.adventures._ctx._tt (handleW, ballW, ghostW, turnerW, leverW, doorState ...)
import { Vector3 } from 'three';
import { FLOOR_Y } from './rooms.js';
import { getRewind, buildTimeTurner, buildDoor, buildBall, buildLever, DOOR, NOOK } from './adventure-b3-timeturner-build.js';

const HERM = { ico: '👧', name: 'הרמיוני' };
const HERM_WHO = '👧 הרמיוני';
const HOLD_T = 5, OPEN = 1.9, TAPS = { 1: 2, 2: 3, 3: 3 }, LOOP_T = { 1: 8, 2: 5.5, 3: 5 };
const LOOP = { x: -3.6, z: 7.2, rx: 2.6, rz: 1.5 };   // the ball's circuit out of the doorway (s decreasing from PI: north first)
const FREE = { x: -2.3, z: 4.5 };                       // where the real Harry waits for the ball
const LEVER_AT = { x: -5.75, z: 4.05 };                  // levels 2-3: beside the other Harry
export const B3TIMETURNER = {
  id: 'b3-timeturner', book: 3, title: 'מחזיר הזמן', ico: '⏳', col: '#4a3a10', col2: '#e8c860', helper: HERM, confetti: ['✨', '⏳', '⭐', '🌀'],
  pic: [['⏳', 0.5, 0.56, 66], ['✨', 0.2, 0.3, 30], ['🔄', 0.8, 0.3, 28]],
  intro: [
    'להרמיוני יש סוד קטן ונוצץ... ⏳',
    'זה מחזיר זמן! מסובבים אותו, והזמן חוזר קצת אחורה.',
    'בוא נפגוש אותה באולם המדרגות ונראה מה הוא יודע לעשות ✨',
  ],
  steps: [
    { line: 'לך אל אולם המדרגות ופגוש את הרמיוני ⏳', hints: ['הרמיוני מחכה באולם המדרגות הנעות ⏳', 'לך אחרי החץ הזהוב', 'אולם המדרגות נמצא מעבר לאולם הכניסה 🏰'], glowL1: true },
    { line: 'גע בידית של הדלת והחזק אותה 🚪', hints: ['הדלת נסגרת לבד! גע בידית הזהובה 🚪', 'הידית העגולה על הדלת זוהרת', 'גע בידית, והארי יחזיק את הדלת פתוחה'], glowL1: true },
    { line: 'סובב את מחזיר הזמן: לחץ ⏳', hints: ['אי אפשר להחזיק את הדלת וגם לתפוס. יש לנו מחזיר זמן! ⏳', 'לחץ על הכפתור ⏳ הזוהר', 'הכפתור ⏳ מחזיר את הזמן אחורה'] },
    { line: 'תפוס את הכדור הזהוב כשהוא עובר 🌀', hints: ['הכדור הזהוב עף מסביב. גע בו כשהוא עובר! 🌀', 'חכה שהכדור יעבור לידך, ואז גע בו', 'הכדור זוהר. גע בו!'], glowL1: true },
    { line: 'נופפו ביחד לשלום 👋', hints: ['שני הארי מנופפים! 👋', 'עוד רגע...', 'כמעט!'] },
  ],
  create: (ctx) => ttScene(ctx),
  art: drawCard,
};

// the reward card: a gold hourglass in two rings, sparkles running backwards round it
function drawCard(x, cx, cy) {
  const g = x.createRadialGradient(cx, cy, 10, cx, cy, 150); g.addColorStop(0, '#fff2c8'); g.addColorStop(1, '#c89040'); x.fillStyle = g; x.fillRect(cx - 120, cy - 150, 240, 290);
  x.save(); x.translate(cx, cy - 4);
  x.strokeStyle = '#a0701a'; x.lineWidth = 7; x.beginPath(); x.ellipse(0, 0, 86, 86, 0, 0, 7); x.stroke();
  x.strokeStyle = '#d8a840'; x.lineWidth = 6; x.beginPath(); x.ellipse(0, 0, 30, 100, 0.5, 0, 7); x.stroke();
  x.fillStyle = '#f6ecd0'; x.beginPath(); x.moveTo(-34, -58); x.lineTo(34, -58); x.lineTo(4, 0); x.lineTo(34, 58); x.lineTo(-34, 58); x.lineTo(-4, 0); x.closePath(); x.fill();
  x.fillStyle = '#e8b048'; x.beginPath(); x.moveTo(-24, 52); x.lineTo(24, 52); x.lineTo(0, 22); x.closePath(); x.fill();
  x.fillStyle = '#c8901e'; x.fillRect(-42, -66, 84, 10); x.fillRect(-42, 56, 84, 10);
  x.restore();
  x.save(); x.font = '28px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('✨', cx - 90, cy - 100); x.fillText('🔄', cx + 88, cy + 96); x.fillText('✨', cx + 84, cy - 96); x.restore();
}

function ttScene(ctx) {
  const { interiors, player, fun, freecast, camera, scene } = ctx;
  const RW = getRewind({ scene, camera, player, fun, emit: ctx.emit });
  const S = { active: false, done: {}, t: 0, room: null, door: null, ball: null, lever: null, turner: null, cols: [], open: 0, openTo: 0, holding: false, holdT: 0, held: false,
    arrive: 0, shown: false, showT: 0, ballS: Math.PI, ballOut: false, taps: 0, miss: 0, caught: 0, catchT: 0, leverDown: false, leverT: 0, spins: 0, waved: 0, glowHint: false,
    casts0: 0, spellSays: 0, said: {}, ghostAt: null, standYaw: 0, hp: null };
  const lv = () => ctx.level;
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const inHall = () => interiors.active === 'staircase' && interiors.room && interiors.room.group;
  const Y = () => (interiors.room && interiors.room.group ? interiors.room.group.position.y : FLOOR_Y);
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3(), v3 = new Vector3();
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const FI = freecast && freecast._internal;
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();

  // ---- the quest's own ⏳ button (the free toy's is hidden during adventures) + the hold ring ----
  const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew',Arial,sans-serif";
  const css = document.createElement('style'); css.id = 'ttQCss';
  css.textContent = `#ttQBtn{right:calc(18px + env(safe-area-inset-right));bottom:calc(320px + env(safe-area-inset-bottom));font-size:40px;padding:0;cursor:pointer;touch-action:manipulation;display:none;
    background:radial-gradient(circle at 50% 35%,rgba(255,232,160,.97),rgba(170,120,30,.92))}
  #ttQBtn.on{display:block} #ttQBtn.pulse{animation:ttQPulse .9s ease-in-out infinite}
  @keyframes ttQPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,230,120,0)}50%{box-shadow:0 0 0 10px rgba(255,230,120,.85),0 0 34px rgba(255,220,100,.95)}}
  body.modalOn #ttQBtn,body.inSpell #ttQBtn,body.inMatch #ttQBtn,body.inFloo #ttQBtn{display:none !important}
  #ttRing{position:fixed;left:50%;top:calc(104px + env(safe-area-inset-top));width:120px;height:120px;margin-left:-60px;z-index:14;display:none;pointer-events:none}
  #ttRing.on{display:block} #ttRing svg{width:100%;height:100%}
  #ttRing .lab{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font:bold 19px ${FONT};color:#fff8d8;text-shadow:0 2px 0 #000;direction:rtl}
  #ttRing .lab i{font-style:normal;font-size:40px;line-height:1}
  body.modalOn #ttRing{display:none !important}
  @media (max-width:700px){#ttRing{top:auto;bottom:calc(330px + env(safe-area-inset-bottom));width:104px;height:104px;margin-left:-52px}}`;
  document.head.appendChild(css);
  const qb = document.createElement('button'); qb.id = 'ttQBtn'; qb.className = 'gamebtn'; qb.textContent = '⏳'; qb.setAttribute('aria-label', 'מחזיר הזמן');
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) qb.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  qb.addEventListener('click', (e) => { e.stopPropagation(); spinPressed(); });
  document.body.appendChild(qb);
  const ringEl = document.createElement('div'); ringEl.id = 'ttRing';
  ringEl.innerHTML = '<svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="60" fill="rgba(70,46,20,.78)"/><circle cx="66" cy="66" r="52" fill="none" stroke="rgba(255,230,140,.35)" stroke-width="12"/>'
    + '<circle class="fg" cx="66" cy="66" r="52" fill="none" stroke="#ffd76a" stroke-width="12" stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="326.7" transform="rotate(-90 66 66)"/></svg><div class="lab"><i>🚪</i><span>מחזיק</span></div>';
  document.body.appendChild(ringEl);
  const ringFg = ringEl.querySelector('.fg');
  const drawRing = (k) => ringFg.setAttribute('stroke-dashoffset', (326.7 * (1 - Math.max(0, Math.min(1, k)))).toFixed(1));

  // ---- props in the hall (rebuilt for each visit to the room; nothing of the quest outside it) ----
  function propsTick() {
    const want = S.active && inHall();
    if (want && S.room !== interiors.room) {
      dropProps(); const g = interiors.room.group; S.room = interiors.room;
      S.door = buildDoor(); S.door.position.set(DOOR.x, 0, DOOR.z); g.add(S.door);
      S.ball = buildBall(); g.add(S.ball);
      if (lv() >= 2) { S.lever = buildLever(); S.lever.position.set(LEVER_AT.x, 0, LEVER_AT.z); S.lever.rotation.y = 0.6; g.add(S.lever); if (S.leverDown) S.lever.userData.arm.rotation.z = -0.6; }
      S.turner = buildTimeTurner(); S.turner.visible = false; g.add(S.turner);
      S.cols = [{ type: 'circle', x: DOOR.x, z: DOOR.z - DOOR.w / 2 - 0.17, r: 0.32, b3: true }, { type: 'circle', x: DOOR.x, z: DOOR.z + DOOR.w / 2 + 0.17, r: 0.32, b3: true }];
      if (S.lever) S.cols.push({ type: 'circle', x: LEVER_AT.x, z: LEVER_AT.z, r: 0.3, b3: true });
      for (const c of S.cols) interiors.room.colliders.push(c);
      S.door.updateMatrixWorld(true); standSpot();
    } else if (!want && S.room) dropProps();
  }
  function dropProps() {
    const cs = S.room && S.room.colliders;
    if (cs) for (const c of S.cols) { const i = cs.indexOf(c); if (i >= 0) cs.splice(i, 1); }
    for (const o of [S.door, S.ball, S.lever, S.turner]) if (o && o.parent) o.parent.remove(o);
    for (const o of [S.door, S.ball, S.lever, S.turner]) if (o) o.traverse(m => { if (m.isMesh) { try { m.geometry.dispose(); } catch { /* backend quirk */ } } });
    S.door = S.ball = S.lever = S.turner = null; S.room = null; S.cols = [];
    if (RW.ghost && RW.ghost.parent && RW.ghost.parent !== scene) RW.drop();
  }
  // world points (room-local + the room's height)
  function handleW(out) {
    if (!S.door) return out.set(DOOR.x + 0.2, Y() + 1.05, DOOR.z);
    const p = S.door.userData.pivot; p.updateWorldMatrix(true, false);
    return out.copy(S.door.userData.handleLocal).setZ(DOOR.w - 0.22).applyMatrix4(p.matrixWorld);
  }
  // where a Harry stands to hold the open door: beside the leaf's end, on its south side, facing the handle
  function standSpot() {
    const a = OPEN, dx = Math.sin(a), dz = Math.cos(a), hx = DOOR.x + dx * (DOOR.w - 0.22), hz = DOOR.z - DOOR.w / 2 + dz * (DOOR.w - 0.22);
    const sx = hx + dz * 0.55 + dx * 0.12, sz = hz - dx * 0.55 + dz * 0.12;   // (dz, -dx): the leaf's south side, outside the ball's circuit
    S.hp = { x: hx, z: hz, sx, sz }; S.standYaw = Math.atan2(hx - sx, hz - sz);
    return S.hp;
  }
  const loopW = (s, out) => out.set(LOOP.x + LOOP.rx * Math.cos(s), Y() + 1.25 + Math.sin(s * 3) * 0.3, LOOP.z + LOOP.rz * Math.sin(s));
  function ballW(out) { return S.ball ? S.ball.getWorldPosition(out) : out.set(NOOK.x, Y() + 1, NOOK.z); }
  function turnerW(out) { return S.turner ? S.turner.getWorldPosition(out) : null; }
  function leverW(out) { return S.lever ? out.set(LEVER_AT.x, Y() + 1.3, LEVER_AT.z) : null; }
  function frame(x, z, yaw, dist = 4.6) {
    player.yaw = yaw; player.teleport(x, z);
    const C = player.cam; if (!C) return;
    const ph = innerWidth / innerHeight < 0.8;
    try { C.reset(yaw); C.yaw += ph ? 0.25 : 0.4; C.pitch = ph ? 0.2 : 0.26; C.dist = ph ? dist + 1.4 : dist; C.userControlled = false; C.idle = 0; } catch { /* ok */ }
  }
  const atFree = () => frame(FREE.x, FREE.z, Math.atan2(DOOR.x - 1.2 - FREE.x, DOOR.z - FREE.z));

  // ---- actions ----
  function startHold() {
    if (ctx.step !== 1 || S.holding || !inHall() || !S.door) return false;
    standSpot(); frame(S.hp.sx, S.hp.sz, S.standYaw, 5.2);
    S.holding = true; S.holdT = 0; S.openTo = 1; S.ballOut = true; S.ballS = Math.PI; ctx.poke(); sfx('pop');
    ringEl.classList.add('on'); drawRing(0);
    ctx.say('הארי מחזיק את הדלת... אוי! הכדור בורח החוצה! 🌀', HERM_WHO, 3.5);
    return true;
  }
  function endHold(full) {
    S.holding = false; ringEl.classList.remove('on'); S.openTo = 0;
    if (full) { S.held = true; sfx('soft'); ctx.say('אי אפשר להחזיק את הדלת וגם לתפוס את הכדור... אבל יש לנו מחזיר זמן! ⏳', HERM_WHO, 4.5); setTimeout(() => done(1), 1600); }
    else ctx.say('הדלת נסגרה. זה בסדר! גע שוב בידית 🚪', HERM_WHO, 3);
  }
  function spinPressed() {
    ctx.poke();
    if (RW.on) return;
    if (ctx.step === 2 && inHall()) { spinBack(); return; }
    if (ctx.step === 3 && lv() >= 2 && !S.leverDown && RW.holding) { spinLever(); return; }
    if (ctx.step <= 1) { ctx.say(ctx.step === 0 ? 'עוד רגע נשתמש בו ⏳' : 'קודם נסה להחזיק את הדלת 🚪', HERM_WHO, 2.6); return; }
    try { fun.toast('⏳', '✨', 900); } catch { /* ok */ }
  }
  function spinBack() {
    if (!S.door) return false;
    standSpot();
    const ok = RW.start({ secs: 3, mode: 'hold', to: { x: S.hp.sx, z: S.hp.sz, faceYaw: S.standYaw }, parent: interiors.room.group, onEnd: () => {
      S.openTo = 1; S.ballOut = lv() === 1; S.ballS = Math.PI; sfx('chime');
      ctx.say(lv() === 1 ? 'רואה? הארי השני מחזיק את הדלת! עכשיו אתה חופשי 🌀' : 'הארי השני מחזיק את הדלת! אבל הכדור עדיין ישן... צריך למשוך גם את הידית ⏳', HERM_WHO, 4.5);
      setTimeout(() => done(2), 1400);
    } });
    if (ok) { S.spins++; S.t0 = S.t; }
    return ok;
  }
  function spinLever() {
    const ok = RW.start({ secs: 2, sepiaOnly: true, onEnd: () => {
      S.leverDown = true; S.leverT = 0.001; RW.wave(); sfx('clank'); S.ballOut = true; S.ballS = Math.PI;
      ctx.say('הארי השני משך את הידית! הכדור התעורר! 🌀', HERM_WHO, 3.5);
    } });
    if (ok) S.spins++;
    return ok;
  }
  function tapBall() {
    if (ctx.step !== 3 || !S.ballOut || S.catchT) return false;
    S.taps++; ctx.poke(); ballW(v1); ctx.burst(v1.x, v1.y, v1.z, 0xffd76a, 18, 2, 0.8, 0.24, -0.6); sfx('tink', S.taps);
    const need = TAPS[lv()] || 2;
    if (S.taps >= need) { S.catchT = 0.001; sfx('sparkle'); ctx.say('תפסת את הכדור! 🌀✨', HERM_WHO, 3); return true; }
    try { fun.toast('🌀', S.taps + ' / ' + need, 900); } catch { /* ok */ }
    ctx.say(S.taps === 1 ? 'יופי! עוד פעם כשהוא חוזר 🌀' : 'עוד אחת! 🌀', HERM_WHO, 2.2);
    return true;
  }

  // ---- per frame ----
  function update(dt, step, busy) {
    S.t += dt;
    propsTick();
    if (!busy || RW.on) RW.update(dt);
    if (!S.active) return;
    if (!RW.on && !RW.holding && step <= 2) RW.record(dt);
    const here = inHall();
    // the ⏳ button: from the Time-Turner's showing until the end of step 4 (not during the hold)
    const btnOn = here && S.shown && step <= 3;
    qb.classList.toggle('on', btnOn);
    qb.classList.toggle('pulse', btnOn && ((step === 2 && !RW.on) || (step === 3 && lv() >= 2 && !S.leverDown && !RW.on)) && (lv() === 1 || S.glowHint || S.t - (S.stepT || 0) > 6));
    if (!here) { ringEl.classList.remove('on'); if (S.holding) { S.holding = false; S.openTo = 0; } return; }
    // a spell here: a kind word (spells never act on Harry or the other Harry)
    const n = casts(); if (n !== S.casts0) { S.casts0 = n; S.spellSays++; ctx.say(RW.holding ? 'לא מטילים לחשים על הארי השני 🙂 הוא חבר!' : 'כאן לא צריך לחש. מחזיר הזמן יעזור לנו ⏳', HERM_WHO, 3); }
    // 1: arriving: Hermione's bubble, the Time-Turner over Harry's hand, the ⏳ button
    if (step === 0) { S.arrive += dt; if (S.arrive > 1.0 && !S.shown) { S.shown = true; S.showT = 0; sfx('sparkle'); ctx.say('תראה מה יש לי! מחזיר זמן ⏳ מסובבים אותו, והזמן חוזר אחורה', HERM_WHO, 4.5); } if (S.shown) { S.showT += dt; if (S.showT > 3.2) done(0); } }
    // the Time-Turner floats and spins above Harry's hand (steps 1-4)
    if (S.turner) {
      const show = S.shown && step <= 3;
      S.turner.visible = show;
      if (show) { const s = player.model ? player.model.scale.y || 1 : 1, f = player.yaw, gp = interiors.room.group.position;
        S.turner.position.set(player.pos.x - gp.x + Math.sin(f) * 0.42 * s + Math.cos(f) * 0.14, player.pos.y - gp.y + 1.08 * s + Math.sin(S.t * 2.6) * 0.05, player.pos.z - gp.z + Math.cos(f) * 0.42 * s - Math.sin(f) * 0.14);
        S.turner.rotation.set(0.25, S.t * (RW.on ? 14 : 2.2), 0); }
    }
    // the door: shut by itself unless someone (Harry, then the other Harry) holds it
    if (S.door) {
      const want = S.holding || RW.holding ? 1 : 0;
      S.open += (want - S.open) * Math.min(1, dt * (want ? 3.2 : 4.5));
      S.door.userData.pivot.rotation.y = S.open * OPEN;
      if (want === 0 && S.open < 0.03 && S.wasOpen) { S.wasOpen = false; sfx('clank'); }
      if (S.open > 0.5) S.wasOpen = true;
    }
    // the lever (levels 2-3)
    if (S.lever) { const arm = S.lever.userData.arm, to = S.leverDown ? -0.6 : 0.6; arm.rotation.z += (to - arm.rotation.z) * Math.min(1, dt * 6); }
    // the ball: bouncing in the nook while the door is shut; out on its circuit while the door is open and it is awake
    if (S.ball) {
      const out = S.ballOut && S.open > 0.6;
      if (S.catchT > 0) {   // caught: it flies into Harry's hand
        S.catchT += dt; const k = Math.min(1, S.catchT / 0.8), gp = interiors.room.group.position;
        v2.set(player.pos.x - gp.x, player.pos.y - gp.y + 1.2, player.pos.z - gp.z); S.ball.position.lerp(v2, k);
        if (S.catchT > 1.2 && !S.done[3]) { S.caught++; done(3); }
      } else if (out) {
        const per = LOOP_T[lv()] || 6; S.ballS -= dt * Math.PI * 2 / per; if (S.ballS < -Math.PI) S.ballS += Math.PI * 2;
        loopW(S.ballS, v1); v1.y -= Y(); S.ball.position.copy(v1);
        if ((lv() === 1 || S.glowHint) && step === 3 && Math.random() < dt * 12) { ballW(v2); ctx.emit(v2.x + (Math.random() - 0.5) * 0.3, v2.y + (Math.random() - 0.5) * 0.3, v2.z + (Math.random() - 0.5) * 0.3, 0, 0.2, 0, 0.6, 0.2, 0xffe07a, 0); }
      } else { S.ball.position.set(NOOK.x, Math.abs(Math.sin(S.t * 3.1)) * 1.4 + 0.25, NOOK.z + Math.sin(S.t * 1.3) * 0.6); }
      S.ball.rotation.y = S.t * 9; S.ball.scale.setScalar(lv() === 1 && step === 3 ? 1.35 : 1.1);
    }
    // 2: the hold (5 s; Harry can let go by walking away: the door simply shuts, no fail)
    if (step === 1 && S.holding) {
      S.holdT += dt; drawRing(S.holdT / HOLD_T); ctx.poke();
      faceTo(S.hp.x, S.hp.z);
      if (Math.hypot(player.pos.x - S.hp.sx, player.pos.z - S.hp.sz) > 1.4) endHold(false);
      else if (S.holdT >= HOLD_T) endHold(true);
    }
    // 3 / 4 resumed (or a room change): the other Harry is back at the door at once
    if (step >= 2 && step <= 4 && !RW.on && !RW.holding && S.door && (step >= 3 || S.done[2]) && !S.faded) { standSpot(); RW.setGhost(S.hp.sx, Y(), S.hp.sz, S.standYaw, interiors.room.group); if (step === 3 && (lv() === 1 || S.leverDown)) { S.ballOut = true; } }
    if (S.leverT > 0) { S.leverT += dt; if (S.leverT > 1.2) S.leverT = 0; }
    // 5: both wave, the gold Harry fades in sparkles, Hermione's line
    if (step === 4) {
      S.waved += dt;
      if (S.waved > 0.5 && !S.said.wave) { S.said.wave = 1; try { player.play('Wave'); } catch { /* ok */ } RW.wave(); sfx('heart'); ctx.say('שני הארי מנופפים לשלום! 👋', HERM_WHO, 3); }
      if (S.waved > 3.0 && !S.said.fade) { S.said.fade = 1; S.faded = true; RW.fadeOut(1.2); S.openTo = 0; sfx('sparkle'); }
      if (S.waved > 4.4 && !S.said.secret) { S.said.secret = 1; ctx.say('עכשיו אתה יודע את הסוד ⏳✨', HERM_WHO, 4); }
      if (S.waved > 7.0) done(4);
    }
  }
  function faceTo(x, z) { player.yaw = Math.atan2(x - player.pos.x, z - player.pos.z); }

  // ---- framework hooks ----
  function begin(step, resumed) {
    S.active = true; S.stepT = S.t; RW.ensureGhost();
    if (step === 1) S.holding = false;
    if (step === 3) { S.taps = 0; S.catchT = 0; }
    if (step === 4) { S.waved = 0; S.said = {}; }
    if (step >= 1) S.shown = true;
    if (step === 1 && !resumed) ctx.say('הדלת הזאת נסגרת לבד! והכדור הזהוב מאחוריה... גע בידית 🚪', HERM_WHO, 4);
    if (step === 3 && !resumed) atFree();
    if (!resumed) return;
    // a resume (reload / the book): into the staircase hall; the step starts over
    if (step >= 1) {
      const spot = step === 1 ? { x: -2.2, z: 6.0, yaw: -Math.PI / 2 } : { x: FREE.x, z: FREE.z, yaw: Math.atan2(DOOR.x - 1.2 - FREE.x, DOOR.z - FREE.z) };
      const go = () => { if (step >= 2) atFree(); else frame(spot.x, spot.z, spot.yaw); };
      if (!inHall()) { interiors.enter('staircase', spot); soon(() => !!S.door, go); } else go();
    }
  }
  function soon(test, fn, n = 0) { if (test()) { try { fn(); } catch { /* ok */ } return; } if (n < 60 && S.active) setTimeout(() => soon(test, fn, n + 1), 150); }
  function goal(step, out) {
    if (!inHall()) return ctx.routeTo('staircase', out, ['staircase', 'entrancehall']);
    if (step === 0) return null;
    if (step === 1) return S.holding ? null : handleW(out).setY(out.y - 0.6);
    if (step === 3) return S.ballOut && !S.catchT && S.open > 0.6 ? ballW(out).setY(out.y - 0.9) : (S.lever && !S.leverDown ? leverW(out).setY(out.y - 1.0) : null);
    return null;
  }
  function tap(x, y, step) {
    if (!inHall() || RW.on) return false;
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (step === 1 && !S.holding) { handleW(v1); const d = near(v1); v2.set(DOOR.x, Y() + 1.3, DOOR.z); if (d < R() * 2.2 || near(v2) < R() * 1.6) { startHold(); return true; } return false; }
    if (S.ball && S.ballOut && S.open > 0.6) {
      ballW(v1); const d = near(v1);
      if (step === 1 && S.holding && d < R() * 2.4) { ctx.say('אני לא יכול לעזוב את הדלת! 😅', '⚡ הארי', 2.2); return true; }
      if (step === 3) { const big = lv() === 1 ? 2.4 : 1.8; if (d < R() * big) { tapBall(); return true; } if (d < R() * 5) { S.miss++; ctx.oops('כמעט! הכדור יחזור עוד רגע 🌀'); return true; } }
    }
    if (RW.holding && RW.ghost) { RW.ghostW(v1); if (near(v1) < R() * 1.5) { ctx.say('הארי השני מחייך אליך 😊', HERM_WHO, 2.2); return true; } }
    return false;
  }
  function glow(step, on) { S.glowHint = !!on; }
  function hintText(step, n) {
    if (step === 3 && lv() >= 2 && !S.leverDown) return ['', 'צריך עוד יד אחת למשוך את הידית ⏳', 'סובב שוב את מחזיר הזמן: לחץ ⏳', 'הכפתור ⏳ זוהר. לחץ עליו!'][n] || null;
    return null;
  }
  function together(step, fast) {
    if (step === 0) { if (!inHall()) interiors.enter('staircase', { x: 0, z: 6, yaw: Math.PI }); soon(() => inHall(), () => { S.shown = true; if (fast) done(0); }); return; }
    if (step === 1) {
      const go = () => { if (!S.holding) startHold(); if (fast) { S.holdT = HOLD_T; endHold(true); done(1); } };
      if (!inHall()) { interiors.enter('staircase', { x: -2.2, z: 6.0, yaw: -Math.PI / 2 }); soon(() => !!S.door, go); } else go();
      return;
    }
    if (step === 2) { const go = () => { if (!RW.on && !RW.holding) spinBack(); if (fast) { RW.drop(); standSpot(); RW.setGhost(S.hp.sx, Y(), S.hp.sz, S.standYaw, interiors.room.group); S.openTo = 1; done(2); } }; if (!inHall()) { interiors.enter('staircase', FREE); soon(() => !!S.door, go); } else go(); return; }
    if (step === 3) {
      const go = () => {
        if (lv() >= 2 && !S.leverDown) { if (fast) { S.leverDown = true; S.ballOut = true; } else if (!RW.on) { spinLever(); setTimeout(() => together(3, false), 2600); return; } }
        S.ballOut = true; if (fast) { S.taps = TAPS[lv()] || 2; done(3); return; }
        for (let i = S.taps; i < (TAPS[lv()] || 2); i++) setTimeout(() => { if (ctx.step === 3) tapBall(); }, (i - S.taps) * 900 + 300);
      };
      if (!inHall()) { interiors.enter('staircase', FREE); soon(() => !!S.door, go); } else go();
      return;
    }
    if (step === 4 && fast) { S.waved = Math.max(S.waved, 6.9); }
  }
  function end(finished) {
    S.active = false;
    dropProps(); RW.drop();
    try { qb.remove(); ringEl.remove(); css.remove(); } catch { /* ok */ }
    void finished;
  }
  function state() {
    const vis = (o) => !!(o && o.visible && o.parent);
    const on = (fn) => { try { const v = fn(new Vector3()); if (!v) return false; ctx.screen(v, scr); return !!(scr.on && scr.x > 0 && scr.x < innerWidth && scr.y > 0 && scr.y < innerHeight); } catch { return false; } };
    const rw = RW.state();
    let draws = 0, tris = 0; for (const o of [S.door, S.ball, S.lever, S.turner, RW.ghost]) if (vis(o)) o.traverse(m => { if (m.isMesh && m.visible) { draws++; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    return { inHall: !!inHall(), shown: S.shown, btn: qb.classList.contains('on'), holding: S.holding, holdT: +S.holdT.toFixed(2), held: S.held, open: +S.open.toFixed(2), ballOut: S.ballOut, taps: S.taps, need: TAPS[lv()] || 2, miss: S.miss, caught: S.caught,
      lever: !!S.lever, leverDown: S.leverDown, spins: S.spins, spellSays: S.spellSays, rewind: rw,
      door: { visible: vis(S.door), onScreen: on(handleW) }, ball: { visible: vis(S.ball), onScreen: on(ballW) }, turner: { visible: vis(S.turner), onScreen: on(turnerW) },
      ghost: { visible: !!rw.ghostVisible, onScreen: rw.ghostVisible && on((o) => RW.ghostW(o)), holding: RW.holding, clip: rw.ghostClip }, draws, tris: Math.round(tris) };
  }
  ctx._tt = { handleW: () => handleW(new Vector3()), ballW: () => ballW(new Vector3()), ghostW: () => RW.ghostW(new Vector3()), turnerW: () => turnerW(new Vector3()), leverW: () => leverW(new Vector3()), stand: () => standSpot(), free: () => ({ ...FREE }) };
  return { begin, update, goal, tap, glow, together, end, state, hintText };
}
