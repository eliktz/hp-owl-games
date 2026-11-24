// Book 2, adventure 6: "אל תוך החדר" (into the Chamber). Data for adventures.js + the scene code. The last book 2 quest.
// Kid-safe and bright: the chamber hall is green-gold with warm torches, nothing lurks; the basilisk is ONLY a soft,
// blurred, long shadow sliding AWAY along the far wall for a few seconds while Fawkes swoops (no head, no eyes, no
// teeth, never approaching, only a soft whoosh); the fang is a small curved ivory tooth lying on the floor that glows;
// touching the diary with it is a burst of golden sparkles (no stabbing, the ink turns to light); Ginny is asleep
// peacefully, then wakes cheerful. Spells never act on Fawkes, Ginny or Myrtle (a kind bubble).
// Steps: 1 Myrtle's bathroom (BATH.myrtle; the same Entrance Hall door): find the sink whose tap has a tiny snake
// (level 1 glows; levels 2-3: look closely) -> 2 say "פתח" in snake language: press and hold the snake; a sparkle ring
// fills (letting go keeps what it has, "ביחד!" fills it); the sink slides aside -> 3 Glisseo (or the 🛝 prompt): an
// on-rails pipe slide (a takeover with a safe abort: any failure gives the controls back at the hall's spawn) into the
// new interior 'b2chamber' -> 4 Fawkes glides in with the Sorting Hat: tap the hat, the sword's ruby hilt pops out ->
// 5 tap the glowing fang, then the diary: golden sparkles, the ink fades to light; Ginny sits up, yawns, "איפה אני?";
// Fawkes lifts everyone out (a golden fade to the Entrance Hall). Finish: +25 house points once per save (adventures.js
// `bonus`), confetti and Ron's line; the book 2 section title gets a gold ⭐ when all six are done.
import { Vector3 } from 'three';
import { BUILDERS, FLOOR_Y } from './rooms.js';
import { BATH } from './adventure-troll.js';
import { buildHallDoor, HALL_DOOR, SPAWN, SINK_Z, SINK_X } from './adventure-troll-build.js';
import { buildMyrtle, MYRTLE } from './adventure-b2-polyjuice-build.js';
import { buildDiary } from './adventure-b2-diary-build.js';
import { buildChamberHall, buildShadow, buildTapSnake, buildPipeMouth, buildFawkes, buildHat, buildSword, buildFang, buildGinny, slideCurve, triCount,
  HALL_SPAWN, POOL, SPOT, SHADOW, FONT } from './adventure-b2-chamber-build.js';

const RON = { ico: '👦', name: 'רון' };
const MYR = '👻 מיילי', GIN = '👧 ג\'יני';
export const B2CHAMBER = {
  id: 'b2-chamber', book: 2, title: 'אל תוך החדר', ico: '🐦‍🔥', col: '#2a3a2a', col2: '#c8a040', helper: RON, bonus: 25, confetti: ['✨', '⭐', '🐦‍🔥', '🎩', '🎉'],
  pic: [['🐦‍🔥', 0.5, 0.52, 64], ['🎩', 0.2, 0.3, 30], ['✨', 0.8, 0.3, 30]],
  intro: [
    'ג\'יני נעלמה, והיומן אצלה! 📓',
    'הדלת לחדר הסודות מוסתרת בשירותים של מיילי.',
    'אני רון. בוא נמצא את ג\'יני ונחזיר אותה הביתה! 💛',
  ],
  steps: [
    { line: 'מצא את הכיור עם הנחש 🐍', hints: ['השירותים של מיילי, דרך הדלת באולם הכניסה 🚪', 'על אחד הברזים יש נחש קטן קטן. הסתכל מקרוב! 🔍', 'גע בכיור שעל הברז שלו יש נחש 🐍'], glowL1: true },
    { line: 'החזק את הנחש: "פתח" 🐍', hints: ['לחץ על הטבעת והחזק את האצבע 👆', 'אם עוזבים, הטבעת שומרת את מה שמילאת ✨', 'עוד קצת! להחזיק עד שהטבעת מתמלאת 🐍'] },
    { line: 'החלק במגלשה למטה! 🛝', hints: ['הטל גליסאו ליד הפתח, או גע ב-🛝', 'בגלגל הלחשים: גליסאו 🛝', 'הלחש הזוהר בגלגל: גליסאו 🛝'], spell: 'glisseo', glowL1: true },
    { line: 'גע במצנפת המיון 🎩', hints: ['פוקס הביא את מצנפת המיון! 🎩', 'המצנפת על הרצפה. גע בה!', 'גע במצנפת, משהו מבריק מחכה בפנים ✨'], glowL1: true },
    { line: 'גע בשן, ואז ביומן ✨', hints: ['שן קטנה זוהרת על הרצפה ליד היומן ✨', 'קודם השן, ואחר כך היומן 📓', 'גע בשן הזוהרת, ואז ביומן השחור ליד הבריכה'], glowL1: true },
  ],
  create: (ctx) => chamberScene(ctx),
  art: drawChamberCard,
};

// the reward card picture: Fawkes red and gold with his wings open over the Sorting Hat, a ruby sparkle (canvas)
function drawChamberCard(x, cx, cy) {
  const E = (px, py, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, 7); x.fill(); };
  x.save(); x.translate(cx, cy + 70);
  E(0, 30, 80, 12, '#5a4230'); x.fillStyle = '#6a5038'; x.beginPath(); x.moveTo(-48, 28); x.quadraticCurveTo(-30, -60, 10, -70); x.quadraticCurveTo(30, -40, 48, 28); x.closePath(); x.fill();
  x.strokeStyle = '#3a2a1c'; x.lineWidth = 3; for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 14, -8, 7, Math.PI, 0); x.stroke(); } x.beginPath(); x.arc(0, 8, 10, 0.2, Math.PI - 0.2); x.stroke();
  x.restore();
  x.save(); x.translate(cx, cy - 50);
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { x.fillStyle = ['#c8301c', '#d84a1c', '#e06a20', '#e0a830', '#f0c040'][k]; x.beginPath(); x.ellipse(s * (36 + k * 13), -4 - k * 5, 30, 9, s * (0.3 + k * 0.15), 0, 7); x.fill(); }
  E(0, 8, 26, 34, '#c8301c'); E(0, -30, 18, 18, '#c8301c'); E(0, 14, 15, 18, '#e0a830');
  x.fillStyle = '#d8b050'; x.beginPath(); x.moveTo(-5, -26); x.lineTo(5, -26); x.lineTo(0, -14); x.closePath(); x.fill();
  for (const s of [-1, 1]) { E(s * 8, -33, 6, 6, '#faf6ea'); E(s * 8, -32, 4, 4, '#1a1410'); E(s * 7, -34, 1.5, 1.5, '#ffffff'); }
  for (let k = 0; k < 3; k++) { x.fillStyle = k === 1 ? '#e0a830' : '#e06a20'; x.beginPath(); x.ellipse((k - 1) * 6, -52, 4, 10, (k - 1) * 0.4, 0, 7); x.fill(); }
  x.restore();
  x.save(); x.font = '30px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('✨', cx - 92, cy - 96); x.fillText('✨', cx + 92, cy - 20); x.fillText('💎', cx + 70, cy + 70); x.restore();
}

// the hall interior: always registered; the quest dresses it for its step when it arrives
BUILDERS.b2chamber = () => {
  const B = buildChamberHall(); const g = B.g; g.position.y = FLOOR_Y; g.userData.adv = B;
  return { group: g, colliders: B.cols, portals: [], spawn: { ...HALL_SPAWN, y: FLOOR_Y }, update(dt, t) { try { B.light.update(t); } catch { /* ok */ } } };
};

const HOLD_T = { 1: 2.0, 2: 3.0, 3: 3.0 };
const ease = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

function chamberScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit, camera, scene } = ctx;
  const S = { active: false, ended: false, lastRoom: null, B: null, H: null, hall: null, sink: -1, found: 0, hold: 0, holding: false, assist: false, opened: 0, slide: null, slides: 0, aborts: 0, arrived: 0,
    fk: null, hatT: 0, hatHit: 0, shadowT: -1, shadowRuns: 0, shadowMaxOp: 0, fang: 0, zap: 0, wake: 0, lift: 0, wrong: 0, glowHint: false, casts0: 0, done: {}, t: 0, giggles: 0, lit: null, refused: 0, slideBreak: false };
  const lv = () => ctx.level;
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0, type = 'triangle', v = 0.1, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const inBath = () => interiors.active === 'trollroom' && interiors.room && interiors.room.group;
  const inHall = () => interiors.active === 'b2chamber' && interiors.room && interiors.room.group;
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3(), v3 = new Vector3();
  const FI = freecast && freecast._internal;
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();
  const RW = (x, y, z, out = new Vector3()) => out.set(x, y, z).add(interiors.room.group.position);
  const tapW = (i, out = new Vector3()) => RW(SINK_X - 0.2, 1.24, SINK_Z[i], out);
  // the snake's sink (drawn in begin(): the level is not known yet while adventures.js creates the scene)
  function init() { if (S.sink >= 0) return; S.sink = lv() === 1 ? 2 : [0, 2, 3, 4][Math.floor(Math.random() * 4)]; }

  // ---------------- Glisseo: while the slide waits, the wheel's Glisseo slides Harry down our pipe (restored at the end) ----------------
  const SPg = FI && FI.SP && FI.SP.glisseo;
  const origCast = SPg ? SPg.cast : null;
  function ourCast() { if (S.active && ctx.step === 2 && inBath() && S.B && S.opened && !S.slide) { this.lastId = 'adv-b2-slide'; S.byWand = true; startSlide(); return true; } return origCast.call(this); }
  if (SPg && origCast) SPg.cast = ourCast;

  // ---------------- light: brighter, green-gold, never dark (saved and given back when the hall goes away) ----------------
  function applyLight() {
    if (S.lit) return;
    const L = { lights: [] };
    for (const o of scene.children) if (o.isAmbientLight || o.isHemisphereLight) L.lights.push({ o, i: o.intensity, c: o.color.getHex(), g: o.groundColor ? o.groundColor.getHex() : null });
    if (scene.fog) L.fog = { c: scene.fog.color.getHex(), d: scene.fog.density };
    S.lit = L;
    for (const { o } of L.lights) { if (o.isHemisphereLight) { o.intensity = 0.95; o.color.setHex(0xe0f0c8); o.groundColor.setHex(0x6a6a3a); } else { o.intensity = 1.05; o.color.setHex(0xfff0d0); } }
    if (scene.fog && scene.fog.density !== undefined) { scene.fog.density = 0.006; scene.fog.color.setHex(0x34402c); }
  }
  function restoreLight() {
    const L = S.lit; if (!L) return; S.lit = null;
    for (const l of L.lights) { l.o.intensity = l.i; l.o.color.setHex(l.c); if (l.g !== null && l.o.groundColor) l.o.groundColor.setHex(l.g); }
    if (L.fog && scene.fog) { scene.fog.color.setHex(L.fog.c); if (L.fog.d !== undefined) scene.fog.density = L.fog.d; }
  }

  // ---------------- DOM: the hold ring + the golden fade ----------------
  const css = document.createElement('style'); css.id = 'b2chamberCss';
  css.textContent = `#b2Hold{position:fixed;left:0;top:0;width:132px;height:132px;margin:-66px 0 0 -66px;z-index:14;display:none;border-radius:50%;border:none;padding:0;background:none;cursor:pointer;
    touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  #b2Hold.on{display:block} #b2Hold svg{width:100%;height:100%;display:block;pointer-events:none}
  #b2Hold .lab{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font:bold 24px ${FONT};color:#fff8d8;text-shadow:0 2px 0 #000,0 0 10px rgba(80,200,90,.9);pointer-events:none;direction:rtl}
  #b2Hold .lab i{font-style:normal;font-size:38px;line-height:1}
  #b2Hold.held .lab{transform:scale(.94)} #b2Hold.glow svg .bg{animation:b2hPulse 1s ease-in-out infinite}
  @keyframes b2hPulse{0%,100%{stroke:rgba(255,230,140,.35)}50%{stroke:rgba(255,240,170,.95)}}
  #b2Fade{position:fixed;inset:0;z-index:30;pointer-events:none;opacity:0;background:radial-gradient(circle,#fff8d8,#ffd76a);transition:opacity .9s}
  #b2Fade.on{opacity:1}
  body.modalOn #b2Hold,body.inSpell #b2Hold{display:none !important}`;
  document.head.appendChild(css);
  const hold = document.createElement('button'); hold.id = 'b2Hold'; hold.setAttribute('aria-label', 'פתח');
  hold.innerHTML = '<svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="60" fill="rgba(20,60,30,.72)"/><circle class="bg" cx="66" cy="66" r="52" fill="none" stroke="rgba(255,230,140,.35)" stroke-width="12"/>'
    + '<circle class="fg" cx="66" cy="66" r="52" fill="none" stroke="#ffd76a" stroke-width="12" stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="326.7" transform="rotate(-90 66 66)"/></svg><div class="lab"><i>🐍</i>פתח</div>';
  document.body.appendChild(hold);
  const ring = hold.querySelector('.fg');
  const fade = document.createElement('div'); fade.id = 'b2Fade'; document.body.appendChild(fade);
  const holdOn = (e) => { e.preventDefault(); e.stopPropagation(); if (ctx.step !== 1 || S.opened) return; S.holding = true; hold.classList.add('held'); try { hold.setPointerCapture(e.pointerId); } catch { /* ok */ } ctx.poke(); sfx('sparkle'); };
  const holdOff = (e) => { if (e) e.stopPropagation(); if (S.holding) { S.holding = false; hold.classList.remove('held'); if (S.hold < 1 && ctx.step === 1) ctx.say('יופי! הטבעת שומרת את מה שמילאת ✨ עוד קצת!', null, 2.4); } };
  hold.addEventListener('pointerdown', holdOn);
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) hold.addEventListener(ev, holdOff);
  for (const ev of ['touchstart', 'mousedown', 'contextmenu']) hold.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'contextmenu') e.preventDefault(); }, { passive: ev !== 'contextmenu' });
  function drawRing() { ring.setAttribute('stroke-dashoffset', (326.7 * (1 - Math.min(1, S.hold))).toFixed(1)); }

  // ---------------- the Entrance Hall door (our own copy + portal while steps 1-3 run) ----------------
  function dressHall() {
    const r = interiors.room; if (!r || !r.group || r.group.userData.advBathCh) return;
    const door = buildHallDoor(); r.group.add(door);
    const p = { x: HALL_DOOR.x, z: HALL_DOOR.z - 0.9, r: 0.9, to: 'trollroom', at: { ...SPAWN }, locked: () => !S.active || ctx.step > 2, armed: false };
    r.portals.push(p);
    r.colliders.push({ type: 'box', x: HALL_DOOR.x, z: HALL_DOOR.z - 0.1, hw: 1.1, hd: 0.15, angle: 0 });
    r.group.userData.advBathCh = { door, p }; S.hall = { door, p };
  }
  // ---------------- the bathroom: Myrtle, the snake on one tap; later the sink slides aside over the pipe mouth ----------------
  function dressBath(step) {
    const r = interiors.room; if (!r || !r.group || S.B) return;
    const g = r.group, B = { g };
    B.my = buildMyrtle(); B.my.root.position.set(MYRTLE.x, MYRTLE.y, MYRTLE.z); B.my.root.rotation.y = Math.PI / 2; g.add(B.my.root);
    B.snake = buildTapSnake(); B.snake.position.set(SINK_X - 0.24, 1.215, SINK_Z[S.sink]); B.snake.rotation.y = Math.PI / 2; g.add(B.snake);
    B.mouth = buildPipeMouth(); B.mouth.position.set(SINK_X + 0.05, 0, SINK_Z[S.sink]); B.mouth.visible = false; g.add(B.mouth);
    // the sink's own vertices in the room's 'sinks' mesh (moved aside when it opens, put back at the end)
    B.sinkMesh = g.getObjectByName('sinks');
    try {
      const p = B.sinkMesh && B.sinkMesh.geometry.attributes.position; B.idx = []; B.orig = [];
      if (p) for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); if (x > SINK_X - 0.45 && x < SINK_X + 0.46 && Math.abs(z - SINK_Z[S.sink]) < 0.46) { B.idx.push(i); B.orig.push(p.getY(i), z); } }
    } catch { B.idx = []; }
    B.tris = triCount(B.snake) + triCount(B.mouth); B.myTris = triCount(B.my.root);
    S.B = B;
    if (step >= 2) { S.opened = Math.max(S.opened, 3); setSink(1); B.mouth.visible = true; }
  }
  function setSink(k) {   // 0 = in place, 1 = slid aside (+z) and a little down
    const B = S.B; if (!B || !B.idx || !B.idx.length || !B.sinkMesh) return;
    try {
      const p = B.sinkMesh.geometry.attributes.position;
      B.idx.forEach((i, n) => { p.setY(i, B.orig[n * 2] - 0.12 * k); p.setZ(i, B.orig[n * 2 + 1] + 0.85 * k); });
      p.needsUpdate = true; B.sinkMesh.geometry.computeBoundingSphere();
    } catch { /* the sink just stays */ }
    B.snake.position.z = SINK_Z[S.sink] + 0.85 * k; B.snake.position.y = 1.215 - 0.12 * k;
  }
  function undressBath() {
    if (!S.B) return;
    try { setSink(0); } catch { /* ok */ }
    for (const o of [S.B.my.root, S.B.snake, S.B.mouth]) if (o.parent) o.parent.remove(o);
    S.B = null;
  }
  // ---------------- the chamber hall: Fawkes, the hat, the sword, the shadow, the diary, the fang, Ginny ----------------
  function dressChamber(step) {
    const r = interiors.room; if (!r || !r.group || S.H) return;
    const g = r.group, H = { g };
    H.fk = buildFawkes(); H.fk.root.scale.setScalar(1.25); g.add(H.fk.root);
    H.hat = buildHat(); H.hat.scale.setScalar(1.15); g.add(H.hat);
    H.sword = buildSword(); H.sword.visible = false; g.add(H.sword);
    H.shadow = buildShadow(); H.shadow.position.set(SHADOW.x0, SHADOW.y, SHADOW.z); g.add(H.shadow);
    H.diary = buildDiary(false); H.diary.scale.setScalar(2.6); H.diary.position.set(SPOT.diary.x, 0.05, SPOT.diary.z); H.diary.rotation.y = 0.6; g.add(H.diary);
    H.fang = buildFang(); H.fang.scale.setScalar(2.3); H.fang.position.set(SPOT.fang.x, 0.02, SPOT.fang.z); H.fang.rotation.y = 0.8; g.add(H.fang);
    H.gin = buildGinny(); H.gin.root.position.set(SPOT.ginny.x, 0.26, SPOT.ginny.z); H.gin.root.rotation.set(-Math.PI / 2, Math.PI * 0.5, 0, 'YXZ'); g.add(H.gin.root);
    H.fkTris = triCount(H.fk.root);
    S.H = H;
    // the step decides where everyone is (a fresh arrival, a resume)
    S.fk = { mode: step >= 3 ? (step === 3 ? 'in' : 'circle') : 'off', t: 0 };
    H.fk.root.visible = step >= 3;
    H.hat.visible = step >= 3; H.hat.position.set(SPOT.hat.x, step === 3 ? 7 : 0, SPOT.hat.z);
    if (step >= 4) { S.hatT = 9; H.sword.visible = true; H.sword.position.set(SPOT.hat.x, 1.4, SPOT.hat.z); }
    H.diary.visible = H.fang.visible = step >= 4;
    setGinny(0);
  }
  function setGinny(k) {   // 0 asleep (lying, eyes shut) .. 1 awake, sitting up and then standing
    const G = S.H && S.H.gin; if (!G) return;
    const lie = Math.max(0, 1 - k * 1.25);
    G.root.rotation.set(-Math.PI / 2 * lie, Math.PI * 0.5, 0, 'YXZ'); G.root.position.y = 0.26 + 0.36 * Math.min(1, k * 1.25);
    const awake = k > 0.1; for (const e of G.eyes) e.visible = awake; for (const s of G.shut) s.visible = !awake;
  }
  function undressChamber() {
    if (!S.H) return;
    for (const o of [S.H.fk.root, S.H.hat, S.H.sword, S.H.shadow, S.H.diary, S.H.fang, S.H.gin.root]) if (o.parent) o.parent.remove(o);
    S.H = null;
  }

  // ---------------- step actions ----------------
  const GIG = ['היי-היי! 😄 שוב באתם לבקר אותי?', 'הי-הי! אני אוהבת את הכיור האמצעי 😄', 'היי-היי! מה אתם מחפשים? 🤭'];
  function meet() { S.giggles++; sfx('giggle', true); ctx.say(GIG[S.giggles % GIG.length], MYR, 3); }
  function tapSink(i) {
    if (ctx.step !== 0 || S.found) return;
    ctx.poke();
    if (i !== S.sink) { S.wrong++; sfx('soft'); ctx.oops('זה כיור רגיל 🙂 חפש נחש קטן על הברז'); return; }
    S.found = 0.001; sfx('chime'); tapW(i, v1); burst(v1.x, v1.y, v1.z, 0x9ae09a, 18, 1.4, 0.8, 0.18, -0.4);
    ctx.say('הנה הוא! נחש קטן על הברז 🐍 זאת הדלת לחדר!', '👦 רון', 3.5);
    setTimeout(() => done(0), 2200);
  }
  function opened() {
    if (S.opened) return;
    S.opened = 0.001; S.holding = false; hold.classList.remove('on', 'held'); sfx('whoosh'); tone(180, 0.9, 0, 'sine', 0.05, 120); tone(260, 0.6, 0.2, 'sine', 0.04, 200);
    ctx.say('סססס... "פתח"! 🐍✨', '🧑 הארי (בשפת הנחשים)', 3);
    if (S.B) { tapW(S.sink, v1); burst(v1.x, v1.y, v1.z, 0x9ae09a, 26, 1.8, 1.0, 0.22, -0.3); }
  }
  function startSlide() {
    if (S.slide || ctx.step !== 2 || !inBath() || !S.B || !S.opened) return;
    ctx.poke(); S.slides++;
    const m = player.model;
    S.slide = { t: 0, ph: 'hop', T: 0, from: new Vector3().copy(player.pos), curve: slideCurve(), s0: m.scale.clone() };
    sfx('whoosh'); tone(500, 0.8, 0, 'sine', 0.08, 1200); sfx('sparkle');
    RW(SINK_X + 0.05, 0.3, SINK_Z[S.sink], v1); burst(v1.x, v1.y, v1.z, 0x9ae0ff, 22, 1.8, 0.9, 0.2, -0.5);
    S.tk = { update: (dt) => { try { slideTick(dt); } catch (e) { console.warn('[b2-chamber] slide -', e && e.message || e); abortSlide(); } } };
    ctx.setTakeover(S.tk);
  }
  function endTakeover() {
    if (S.tk) { const tk = S.tk; S.tk = null; try { if (!window.__game || window.__game.takeover === tk) ctx.setTakeover(null); } catch { ctx.setTakeover(null); } }
    try { const m = player.model; m.rotation.x = 0; if (S.slide && S.slide.s0) m.scale.copy(S.slide.s0); m.visible = true; } catch { /* ok */ }
  }
  function abortSlide() {   // any failure: the controls come back and Harry stands at the hall's spawn
    S.aborts++;
    endTakeover(); S.slide = null;
    try { if (inHall()) { player.yaw = HALL_SPAWN.yaw; player.teleport(HALL_SPAWN.x, HALL_SPAWN.z); } else if (S.active) interiors.enter('b2chamber', { ...HALL_SPAWN }); } catch { /* ok */ }
  }
  const tang = new Vector3(), camP = new Vector3(), camL = new Vector3();
  function slideTick(dt) {
    const L = S.slide; if (!L) { endTakeover(); return; }
    if (S.slideBreak) { S.slideBreak = false; throw new Error('test: a broken slide'); }
    L.t += dt; L.T += dt;
    const m = player.model;
    if (L.ph === 'hop') {   // a little hop over the pipe mouth, sparkles swirl, then down we go
      const k = ease(L.t / 0.9), mx = interiors.room.group.position.x + SINK_X + 0.05, mz = interiors.room.group.position.z + SINK_Z[S.sink];
      player.pos.set(L.from.x + (mx - L.from.x) * k, L.from.y + Math.sin(k * Math.PI) * 0.9, L.from.z + (mz - L.from.z) * k);
      m.position.copy(player.pos); m.scale.copy(L.s0).multiplyScalar(1 - 0.6 * Math.max(0, (L.t - 0.6) / 0.4));
      if (Math.random() < dt * 30) emit(mx + (Math.random() - 0.5) * 0.8, player.pos.y + Math.random(), mz + (Math.random() - 0.5) * 0.8, 0, 0.5, 0, 0.7, 0.16, 0x9ae09a, -0.3);
      if (L.t >= 1.0 && !L.entering) { L.entering = true; interiors.enter('b2chamber', { ...HALL_SPAWN }); }
      if (inHall()) { L.ph = 'ride'; L.t = 0; m.scale.copy(L.s0); sfx('whoosh'); tone(900, 1.8, 0, 'sine', 0.07, 300); }
      if (L.T > 14) abortSlide();   // the hall never came: safe abort
      return;
    }
    if (!inHall()) { abortSlide(); return; }
    // the ride: on rails down the pipe, faster and faster, a soft kick-out at the bottom
    const u = Math.min(1, L.t / 4.6), s = u < 0.8 ? 0.85 * (u / 0.8) * (u / 0.8) : 0.85 + (1 - Math.pow(1 - (u - 0.8) / 0.2, 2)) * 0.15;
    const G = interiors.room.group.position;
    L.curve.getPointAt(Math.min(1, s), v1); L.curve.getTangentAt(Math.min(1, s), tang);
    player.pos.set(G.x + v1.x, G.y + v1.y - 0.75, G.z + v1.z);
    const yaw = Math.atan2(tang.x, tang.z);
    player.yaw = yaw; m.position.copy(player.pos); m.rotation.y = yaw; m.rotation.x = -0.35 * Math.min(1, (1 - s) * 3);
    try { player.animate(dt, { moving: false }, 0); } catch { /* ok */ }
    if (L.t > 0.3 && !L.said) { L.said = true; ctx.say('וִיייי! 🛝', '🧑 הארי', 2.2); }
    if (Math.random() < dt * 30) emit(player.pos.x + (Math.random() - 0.5) * 0.9, player.pos.y + 0.3, player.pos.z + (Math.random() - 0.5) * 0.9, -tang.x * 0.8, 0.4, -tang.z * 0.8, 0.5, 0.18, Math.random() < 0.5 ? 0xffffff : 0x9ae09a, -0.5);
    // the camera rides behind and above, looking down the pipe
    camP.set(player.pos.x - tang.x * 2.6, player.pos.y + 1.15 - tang.y * 1.0, player.pos.z - tang.z * 2.6);
    camL.set(player.pos.x + tang.x * 3, player.pos.y + 0.6 + tang.y * 2, player.pos.z + tang.z * 3);
    camera.position.copy(camP); camera.lookAt(camL); camera.updateMatrixWorld();
    if (u >= 1) {
      burst(player.pos.x, player.pos.y + 0.3, player.pos.z, 0x9ae09a, 22, 2.0, 0.8, 0.22, -1); sfx('pop'); sfx('giggle', true);
      S.slide = null; endTakeover();
      player.yaw = HALL_SPAWN.yaw; player.teleport(HALL_SPAWN.x, HALL_SPAWN.z); S.reframe = 'hat';
    }
  }
  function tapHat() {
    if (ctx.step !== 3 || S.hatHit || !S.H || !S.hatLanded) return;
    S.hatHit = 0.001; ctx.poke(); sfx('chime'); sfx('sparkle');
    RW(SPOT.hat.x, 0.6, SPOT.hat.z, v1); burst(v1.x, v1.y, v1.z, 0xffd76a, 26, 2.2, 1.0, 0.24, -0.6); burst(v1.x, v1.y, v1.z, 0xff4a5a, 10, 1.6, 0.9, 0.2, -0.4);
    S.H.sword.visible = true;
    setTimeout(() => { if (S.active) ctx.say('החרב של גריפינדור! עם אבן אודם בידית ✨', '👦 רון', 4); }, 900);
    setTimeout(() => { if (S.active) done(3); }, 4200);
  }
  function tapFang() {
    if (ctx.step !== 4 || S.fang || !S.H) return;
    S.fang = 0.001; ctx.poke(); sfx('chime'); RW(SPOT.fang.x, 0.3, SPOT.fang.z, v1); burst(v1.x, v1.y, v1.z, 0xfff0c0, 14, 1.2, 0.8, 0.18, -0.4);
    ctx.say('יש לך את השן! עכשיו גע ביומן 📓✨', '👦 רון', 3);
  }
  function tapDiary() {
    if (ctx.step !== 4 || S.zap || !S.H) return;
    ctx.poke();
    if (!S.fang) { S.wrong++; sfx('soft'); ctx.oops('קודם השן הזוהרת ✨ היא על הרצפה ליד היומן'); return; }
    S.zap = 0.001; sfx('whoosh');
  }

  // ---------------- per frame ----------------
  function update(dt, step, busy) {
    S.t += dt;
    const r = interiors.room;
    if (r !== S.lastRoom) {
      const wasHall = S.lastRoom && S.lastRoom.id === 'b2chamber';
      S.lastRoom = r; S.B = null; S.H = null; S.hall = null;
      if (wasHall && !inHall()) restoreLight();
      if (inHall()) applyLight();
      if (interiors.active === 'entrancehall' && S.active && step <= 2) dressHall();
      if (interiors.active === 'entrancehall' && r && r.group && r.group.userData.advBathCh) S.hall = r.group.userData.advBathCh;
    }
    if (S.active && inBath() && step <= 2 && !S.B) dressBath(step);
    if (S.active && inHall() && !S.H) dressChamber(step);
    if (S.reframe && !busy && ((S.reframe === 'sink' && S.B) || (S.reframe !== 'sink' && S.H))) { const k = S.reframe; S.reframe = null; if (k === 'sink') faceSink(); else if (k === 'stand') standHall(); else frame(RW(SPOT.hat.x, 0, SPOT.hat.z, v3), 0.3); }
    if (S.hall) S.hall.door.visible = S.active && interiors.active === 'entrancehall' && step <= 2;
    // casts: never on Myrtle, Fawkes or Ginny (a kind word); the Glisseo of step 3 is ours (ourCast)
    const n = casts();
    if (n !== S.casts0) {
      S.casts0 = n;
      if (S.byWand) S.byWand = false;
      else if (inBath() && S.B) { if (step === 2 && S.opened) ctx.say('לגליסאו צריך לעמוד ליד הפתח 🛝 או לגעת ב-🛝', null, 3); else { S.refused++; ctx.say('לא מטילים לחשים על מיילי או על הכיור 🙂 גע בכיור עם הנחש', null, 3.5); } }
      else if (inHall() && S.H) { S.refused++; ctx.say(step >= 4 && S.wake ? 'ג\'יני צריכה רק חיבוק, לא לחש 🙂' : 'לא מטילים לחשים על פוקס 🙂 הוא חבר שלנו! גע במה שזוהר', null, 3.5); }
    }
    tickBath(dt, step, busy);
    tickHall(dt, step, busy);
    tickFinale(dt);
    // step 3 is done once Harry is in the hall (by the ride, or by a safe abort)
    if (step === 2 && inHall() && !S.slide) { S.arrived += dt; if (S.arrived > 0.6) { done(2); } }
  }
  function tickBath(dt, step, busy) {
    const B = S.B; if (!B) { hold.classList.remove('on'); return; }
    const M = B.my.root, g = B.g.position;
    M.position.y = MYRTLE.y + Math.sin(S.t * 1.4) * 0.08;
    const face = Math.atan2(player.pos.x - g.x - MYRTLE.x, player.pos.z - g.z - MYRTLE.z); M.rotation.y += (face - M.rotation.y) * Math.min(1, dt * 2);
    B.my.mat.opacity = 0.58 + Math.sin(S.t * 2.1) * 0.06;
    // the snake: a tiny wiggle; level 1 / the glow hint: sparkles round its tap
    B.snake.rotation.z = Math.sin(S.t * 3) * 0.08;
    if (step === 0 && !S.found && (lv() === 1 || S.glowHint) && Math.random() < dt * 4) { tapW(S.sink, v1); emit(v1.x + (Math.random() - 0.5) * 0.3, v1.y + Math.random() * 0.2, v1.z + (Math.random() - 0.5) * 0.3, 0, 0.3, 0, 0.8, 0.14, 0x9ae09a, 0); }
    // the hold ring over the snake (bottom centre if the snake is off screen)
    const showHold = step === 1 && !S.opened && !busy;
    hold.classList.toggle('on', showHold);
    if (showHold) {
      ctx.screen(tapW(S.sink, v1), scr);
      let x = scr.on ? scr.x : innerWidth / 2, y = scr.on ? scr.y : innerHeight - 190;
      x = Math.max(80, Math.min(innerWidth - 80, x)); y = Math.max(innerWidth < 700 ? 330 : 170, Math.min(innerHeight - 150, y));
      hold.style.left = x.toFixed(0) + 'px'; hold.style.top = y.toFixed(0) + 'px';
      hold.classList.toggle('glow', lv() === 1 || S.glowHint);
      if (S.holding || S.assist) { S.hold = Math.min(1, S.hold + dt / (HOLD_T[lv()] || 2.5)); drawRing(); if (Math.random() < dt * 20) { emit(v1.x + (Math.random() - 0.5) * 0.4, v1.y + (Math.random() - 0.5) * 0.3, v1.z + (Math.random() - 0.5) * 0.4, 0, 0.3, 0, 0.6, 0.14, 0x9ae09a, 0); } if (S.hold >= 1) opened(); }
    }
    // the sink slides aside, the pipe mouth glows
    if (S.opened > 0 && S.opened < 3) {
      S.opened += dt; const k = ease(Math.min(1, S.opened / 1.6)); setSink(k);
      if (S.opened > 1.0) B.mouth.visible = true;
      if (S.opened >= 2.6 && step === 1) done(1);
      if (S.opened >= 3) S.opened = 3;
    }
    if (B.mouth.visible) {
      if (step === 2 && !S.slide && Math.random() < dt * 6) { RW(SINK_X + 0.05 + (Math.random() - 0.5) * 0.6, 0.1, SINK_Z[S.sink] + (Math.random() - 0.5) * 0.6, v1); emit(v1.x, v1.y, v1.z, 0, 0.6, 0, 0.9, 0.16, 0x9ae09a, 0); }
      const d = Math.hypot(player.pos.x - g.x - SINK_X, player.pos.z - g.z - SINK_Z[S.sink]);
      if (step === 2 && !S.slide && !busy && d < 4.5) { try { fun.offer('adv-slide', '🛝', d, () => startSlide()); } catch { /* ok */ } }
    }
  }
  function tickHall(dt, step, busy) {
    const H = S.H; if (!H) return;
    const F = H.fk, fr = F.root, f = S.fk;
    f.t += dt;
    // Fawkes: glides in from the far end with the hat, drops it, then circles high round the hall (flapping by transforms)
    let flap = 1.0;
    if (f.mode === 'in') {
      const k = ease(f.t / 4.2);
      fr.position.set(SPOT.hat.x + (0 - SPOT.hat.x) * (1 - k), 7.5 - 3.3 * k + Math.sin(k * Math.PI) * 0.6, -14 + (SPOT.hat.z + 0.2 + 14) * k);
      fr.rotation.set(0.1, 0, Math.sin(S.t * 1.3) * 0.08);
      if (!S.hatT) H.hat.position.set(fr.position.x, fr.position.y - 0.75, fr.position.z);
      if (f.t >= 4.2) { f.mode = 'circle'; f.t = 0; S.hatT = 0.001; sfx('whoosh'); if (step === 3) { ctx.say('פוקס! הציפור של דמבלדור! והוא הביא את מצנפת המיון 🎩', '👦 רון', 4.5); S.shadowT = 0; } }
    } else if (f.mode === 'circle' || f.mode === 'lift') {
      const a = f.t * 0.45, rr = 3.2;
      if (f.mode === 'lift') { const k = ease(f.t / 2.5); fr.position.set(SPOT.ginny.x - 1.2, 3 - 1.2 * k, SPOT.ginny.z + 1.4); fr.rotation.set(0, Math.PI, 0); }
      else { fr.position.set(Math.sin(a) * rr, 3.8 + Math.sin(f.t * 1.3) * 0.4, 0.5 + Math.cos(a) * rr * 1.2); fr.rotation.set(0, a + Math.PI / 2, -0.25); }
    } else { fr.position.set(0, -20, 0); flap = 0; }
    const w = Math.sin(S.t * (f.mode === 'in' ? 5 : 7)) * 0.65 * flap;
    F.wL.rotation.z = w; F.wR.rotation.z = -w;
    // the hat falls softly to the floor, wobbles; the sword's hilt rises out of it
    if (S.hatT > 0 && S.hatT < 9) {
      S.hatT += dt; const k = Math.min(1, S.hatT / 1.2);
      if (!S.hatHit) H.hat.position.set(SPOT.hat.x, (1 - k * k) * 3.4, SPOT.hat.z);
      if (k >= 1 && !S.hatLanded) { S.hatLanded = 1; sfx('pop'); RW(SPOT.hat.x, 0.2, SPOT.hat.z, v1); burst(v1.x, v1.y, v1.z, 0xffffff, 12, 1.2, 0.7, 0.2, -0.8); }
    }
    if (H.hat.visible && S.hatLanded) H.hat.rotation.z = Math.sin(S.t * 2.2) * 0.04;
    if (step === 3 && S.hatLanded && !S.hatHit && (lv() === 1 || S.glowHint) && Math.random() < dt * 4) { RW(SPOT.hat.x, 0.9, SPOT.hat.z, v1); emit(v1.x + (Math.random() - 0.5) * 0.6, v1.y, v1.z + (Math.random() - 0.5) * 0.6, 0, 0.3, 0, 0.8, 0.16, 0xffe07a, 0); }
    if (S.hatHit > 0) { S.hatHit += dt; const k = ease(S.hatHit / 1.6); H.sword.position.set(SPOT.hat.x, 0.2 + 1.2 * k, SPOT.hat.z); H.sword.rotation.y = S.t * 0.8; if (Math.random() < dt * 8) { RW(SPOT.hat.x, 1.6 * k + 0.4, SPOT.hat.z, v1); emit(v1.x, v1.y + 0.9, v1.z, 0, 0.3, 0, 0.7, 0.16, 0xff6a7a, 0); } }
    else if (step >= 4 && H.sword.visible) { H.sword.rotation.y = S.t * 0.8; H.sword.position.y = 1.4 + Math.sin(S.t * 1.6) * 0.06; }
    // the shadow: once, while Fawkes swoops: soft, blurred, long, sliding AWAY along the far wall and fading (a soft whoosh)
    if (S.shadowT >= 0) {
      S.shadowT += dt; const t = S.shadowT, T = 6.0;
      if (t - dt <= 0.05) { S.shadowRuns++; tone(160, 1.6, 0, 'sine', 0.025, 90); }
      const op = t < 1 ? t * 0.5 : t < T - 1.6 ? 0.5 : Math.max(0, 0.5 * (T - t) / 1.6);
      H.shadow.visible = op > 0.01; H.shadow.material.opacity = op; S.shadowMaxOp = Math.max(S.shadowMaxOp, op);
      H.shadow.position.set(SHADOW.x0 + (SHADOW.x1 - SHADOW.x0) * ease(t / T), SHADOW.y + Math.sin(t * 1.5) * 0.08, SHADOW.z);
      if (t >= T) { S.shadowT = -1; H.shadow.visible = false; if (step === 3 && !S.hatHit) ctx.say('פוקס שומר עלינו. עכשיו גע במצנפת! 🎩', '👦 רון', 3.5); }
    }
    // the diary + the fang (step 5)
    if (step === 4 && !S.fang && (lv() === 1 || S.glowHint) && Math.random() < dt * 4) { RW(SPOT.fang.x, 0.2, SPOT.fang.z, v1); emit(v1.x + (Math.random() - 0.5) * 0.3, v1.y, v1.z + (Math.random() - 0.5) * 0.3, 0, 0.3, 0, 0.8, 0.14, 0xfff0b0, 0); }
    H.fang.material.emissiveIntensity = 0.5 + Math.sin(S.t * 4) * 0.25;
    if (S.fang > 0 && !S.zap) {   // the fang floats beside Harry
      S.fang += dt; const k = ease(S.fang / 0.8), G = H.g.position;
      v2.set(player.pos.x - G.x + Math.cos(player.yaw) * 0.6, 1.2 + Math.sin(S.t * 3) * 0.06, player.pos.z - G.z - Math.sin(player.yaw) * 0.6);
      H.fang.position.lerpVectors(v3.set(SPOT.fang.x, 0.02, SPOT.fang.z), v2, k); H.fang.rotation.y += dt * 2;
    }
    if (S.zap > 0) {
      S.zap += dt; const t = S.zap, G = H.g.position;
      if (t < 0.7) { H.fang.position.lerp(v2.set(SPOT.diary.x, 0.35, SPOT.diary.z), Math.min(1, dt * 6)); }
      else if (!S.zapped) {
        S.zapped = 1; H.fang.visible = false; sfx('sparkle'); sfx('chime'); setTimeout(() => sfx('sparkle'), 250);
        RW(SPOT.diary.x, 0.3, SPOT.diary.z, v1); burst(v1.x, v1.y, v1.z, 0xffd76a, 36, 3.0, 1.3, 0.3, -0.3); burst(v1.x, v1.y, v1.z, 0xffffff, 18, 2.0, 1.0, 0.26, 0.2);
        ctx.say('וואו! הדיו הופך לאור! ✨', '👦 רון', 3);
      }
      if (t > 0.7) {   // the ink turns to light: the book glows gold, light rises, it fades away
        const k = Math.min(1, (t - 0.7) / 2.2), m = H.diary.material;
        if (m.emissive) { m.emissive.setRGB(1, 0.8, 0.35); m.emissiveIntensity = 1.4 * (1 - k * 0.3); }
        if (Math.random() < dt * 24) { RW(SPOT.diary.x + (Math.random() - 0.5) * 0.4, 0.2, SPOT.diary.z + (Math.random() - 0.5) * 0.4, v1); emit(v1.x, v1.y, v1.z, 0, 1.2 + Math.random(), 0, 1.0, 0.2, 0xffe8a0, 0.2); }
        H.diary.scale.setScalar(2.6 * (1 - 0.9 * Math.max(0, (t - 2.2) / 1.0))); if (t > 3.2) H.diary.visible = false;
      }
      if (t > 3.4 && !S.wake) { S.wake = 0.001; }
    }
    // Ginny: asleep (soft z-z sparkles), then she sits up, yawns, and stands up cheerful
    if (H.gin) {
      if (!S.wake && Math.random() < dt * 1.5) { RW(SPOT.ginny.x, 0.9, SPOT.ginny.z, v1); emit(v1.x, v1.y, v1.z, 0.1, 0.35, 0, 1.4, 0.14, 0xe8f0ff, 0); }
      if (S.wake > 0) {
        const t = S.wake, k = t < 1.6 ? 0.45 * ease(t / 1.6) : t < 2.8 ? 0.45 : 0.45 + 0.55 * ease((t - 2.8) / 1.4);
        setGinny(k);
        if (H.gin.head) H.gin.head.rotation.x = t > 1.0 && t < 2.6 ? -0.3 * Math.sin((t - 1.0) / 1.6 * Math.PI) : 0;   // the yawn
        if (t > 7.8 && f.mode !== 'lift') { f.mode = 'lift'; f.t = 0; }
      }
    }
  }
  // the finale runs on its own clock (it carries on through the move to the Entrance Hall)
  function tickFinale(dt) {
    if (!(S.wake > 0) || S.lift >= 2) return;
    const t0 = S.wake; S.wake += dt; const t = S.wake, at = (s) => t0 < s && t >= s;
    if (at(1.0)) { ctx.say('יאאא... 🥱 איפה אני?', GIN, 3.2); tone(420, 0.5, 0, 'sine', 0.05, 300); }
    if (at(4.4)) { ctx.say('ג\'יני! את בסדר! כולם בטוחים עכשיו 💛', '👦 רון', 3.5); sfx('heart'); }
    if (at(7.8)) ctx.say('פוקס יוציא אותנו מכאן! תחזיקו חזק 🐦‍🔥', '👦 רון', 3);
    if (at(10.2)) { fade.classList.add('on'); sfx('whoosh'); tone(600, 1.4, 0, 'sine', 0.06, 1200); }
    if (at(11.4)) { S.lift = 1; try { interiors.enter('entrancehall', { x: 0, z: 6, yaw: Math.PI }); } catch { /* ok */ } }
    if (t >= 12.2 && S.lift === 1) { S.lift = 2; fade.classList.remove('on'); celebrate(); done(4); }
  }
  function celebrate() {
    try { fun.confetti(['🎉', '⭐', '✨', '🐦‍🔥', '💛'], 30); } catch { /* ok */ }
    sfx('fanfare');
    setTimeout(() => { try { ctx.say('הצלחנו! ג\'יני בטוחה, ובית הספר בטוח! 🎉', '👦 רון', 5); } catch { /* ok */ } }, 300);
  }

  // ---------------- taps ----------------
  function tap(x, y, step) {
    const rr = R();
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (inBath() && S.B) {
      if (step === 0 && !S.found) {
        let bi = -1, bd = 1e9; SINK_Z.forEach((z, i) => { const d = Math.min(near(tapW(i, v1)), near(RW(SINK_X + 0.05, 0.85, z, v1))); if (d < bd) { bd = d; bi = i; } });
        if (bi >= 0 && bd < rr * 1.5) { tapSink(bi); return true; }
      }
      if (near(RW(MYRTLE.x, MYRTLE.y + 0.8, MYRTLE.z, v1)) < rr * 2.0) { meet(); return true; }
    }
    if (inHall() && S.H) {
      if (step === 3 && near(RW(SPOT.hat.x, 0.4, SPOT.hat.z, v1)) < rr * 2.0) { tapHat(); return true; }
      if (step === 4) {
        const dF = S.fang ? 1e9 : near(RW(SPOT.fang.x, 0.05, SPOT.fang.z, v1)), dD = S.zap ? 1e9 : near(RW(SPOT.diary.x, 0.1, SPOT.diary.z, v1));   // the nearer of the two wins
        if (dF < rr * 1.6 && dF <= dD) { tapFang(); return true; }
        if (dD < rr * 1.7) { tapDiary(); return true; }
        if (!S.wake && near(RW(SPOT.ginny.x, 0.4, SPOT.ginny.z, v1)) < rr * 1.8) { ctx.say('ג\'יני ישנה בשקט... 😴 קודם השן, ואז היומן ✨', null, 3); return true; }
      }
      if (S.H.fk.root.visible) { S.H.fk.root.getWorldPosition(v1); if (near(v1) < rr * 1.6) { tone(880, 0.2, 0, 'sine', 0.05, 1320); tone(1320, 0.25, 0.2, 'sine', 0.04, 990); ctx.say('פוקס שר שיר יפה 🎶', '👦 רון', 2.5); return true; } }
    }
    return false;
  }

  // ---------------- the arrow ----------------
  function goal(step, out) {
    if (step <= 2) {
      if (S.slide) return null;
      if (!inBath()) {
        if (interiors.active === 'entrancehall') return out.set(HALL_DOOR.x, FLOOR_Y + 1.95, HALL_DOOR.z - 0.7);
        return ctx.routeTo('entrancehall', out, ['entrancehall', 'staircase']);
      }
      if (!S.B) return null;
      if (step === 0) return S.found || !(lv() === 1 || S.glowHint) ? null : RW(SINK_X + 0.1, 0.35, SINK_Z[S.sink], out);
      if (step === 1) return null;   // the hold ring is the target
      return RW(SINK_X + 0.6, -0.4, SINK_Z[S.sink], out);
    }
    if (!inHall() || !S.H) return null;
    if (step === 3) return S.hatLanded && !S.hatHit ? RW(SPOT.hat.x, 0.1, SPOT.hat.z, out) : null;
    if (step === 4) { if (S.zap) return null; return S.fang ? RW(SPOT.diary.x, -0.3, SPOT.diary.z, out) : RW(SPOT.fang.x, -0.4, SPOT.fang.z, out); }
    return null;
  }

  function begin(step, resumed) {
    init(); S.active = true; BATH.myrtle = step <= 2;
    if (step === 1 && !resumed) setTimeout(() => { if (S.active && inBath() && ctx.step === 1) { faceSink(); ctx.say('עכשיו אומרים "פתח" בשפת הנחשים: לחץ על הטבעת והחזק 🐍', '👦 רון', 4.5); } }, 600);
    if (step === 2 && !resumed) ctx.say('הכיור זז! יש מגלשה למטה 🛝 הטל גליסאו או גע ב-🛝', '👦 רון', 4.5);
    if (step === 3 && S.H && S.fk && S.fk.mode === 'off') { S.fk.mode = 'in'; S.fk.t = 0; S.H.fk.root.visible = true; S.H.hat.visible = true; }
    if (step === 4 && S.H) { S.H.diary.visible = S.H.fang.visible = true; }
    if (step === 3 && !resumed) ctx.say('וואו... חדר הסודות! הכל ירוק וזהוב. תראה, מישהו עף לכאן! 🐦‍🔥', '👦 רון', 4.5);
    if (step === 4 && !resumed) { setTimeout(() => { if (S.active && inHall() && ctx.step === 4) { standHall(); ctx.say('הנה ג\'יני, היא ישנה! והיומן שם ליד הבריכה 📓', '👦 רון', 4.5); } }, 1200); }
    if (!resumed) return;
    // a resume (reload / the book): go to the right place; the step starts over
    if (step <= 2) { const at = step === 0 ? { ...SPAWN } : standAt(); if (!inBath()) interiors.enter('trollroom', at); else { player.yaw = at.yaw; player.teleport(at.x, at.z); } if (step >= 1) S.reframe = 'sink'; }
    if (step >= 3) { const at = step === 4 ? { x: SPOT.stand.x, z: SPOT.stand.z, yaw: Math.PI } : { ...HALL_SPAWN }; if (!inHall()) interiors.enter('b2chamber', at); else { player.yaw = at.yaw; player.teleport(at.x, at.z); } S.reframe = step === 4 ? 'stand' : 'hat'; }
  }
  // in front of the snake's sink, a little to the side so Harry never hides it
  function standAt() { const z = SINK_Z[S.sink], sz = z > 2 ? -1 : 1; return { x: SINK_X + 2.6, z: z + 2.3 * sz, yaw: Math.atan2(-2.6, -2.3 * sz) + 0.62 * sz }; }
  function faceSink() { const at = standAt(); player.teleport(at.x, at.z); frame(tapW(S.sink, v3)); }
  // face Harry to a target and swing the lens behind-beside him, a little higher, so he never hides it (until he walks)
  function frame(t, side = 0.5, pitch = 0.42) {
    try { const yaw = Math.atan2(t.x - player.pos.x, t.z - player.pos.z), C = player.cam; player.yaw = yaw; if (player.model) player.model.rotation.y = yaw; if (C) { C.yaw = yaw + Math.PI + side; C.pitch = pitch; C.userControlled = false; C.idle = 0; } } catch { /* ok */ }
  }
  function standHall() { player.teleport(SPOT.stand.x, SPOT.stand.z); frame(RW((SPOT.fang.x + SPOT.diary.x) / 2, 0, (SPOT.fang.z + SPOT.diary.z) / 2, v3)); }
  function glow(step, on) { S.glowHint = !!on; }
  function together(step, fast) {
    const soon = (ok, fn, n = 0) => { if (!S.active) return; if (ok()) { try { fn(); } catch (e) { console.warn('[b2-chamber] together -', e && e.message || e); } return; } if (n < 80) setTimeout(() => soon(ok, fn, n + 1), 250); };   // waits for the room
    const inside = (fn) => { if (!(inBath() && S.B)) interiors.enter('trollroom', standAt()); soon(() => inBath() && S.B, fn); };
    const inHallDo = (fn) => { if (!(inHall() && S.H)) interiors.enter('b2chamber', { ...HALL_SPAWN }); soon(() => inHall() && S.H, fn); };
    if (step === 0) { inside(() => tapSink(S.sink)); return; }
    if (step === 1) { inside(() => { faceSink(); if (fast) { S.hold = 1; drawRing(); opened(); S.opened = Math.max(S.opened, 2.5); } else S.assist = true; }); return; }
    if (step === 2) { if (fast && !inBath()) { interiors.enter('b2chamber', { ...HALL_SPAWN }); return; } inside(() => { if (!S.opened) { S.opened = 3; setSink(1); if (S.B) S.B.mouth.visible = true; } startSlide(); }); return; }
    if (step === 3) { const go = () => { if (S.hatT < 4.6) { S.hatT = 4.7; S.hatLanded = 1; if (S.fk) { S.fk.mode = 'circle'; S.fk.t = 0; } if (S.H) S.H.hat.position.set(SPOT.hat.x, 0, SPOT.hat.z); } tapHat(); if (fast) setTimeout(() => done(3), 200); }; inHallDo(go); return; }
    if (step === 4) { const go = () => { tapFang(); setTimeout(() => { tapDiary(); if (fast) { S.zap = Math.max(S.zap, 3.3); S.wake = Math.max(S.wake || 0, 11.3); } }, fast ? 50 : 1200); }; inHallDo(go); }
  }
  function end(finished) {
    S.ended = true; S.active = false; BATH.myrtle = false;
    if (S.slide || S.tk) { endTakeover(); S.slide = null; }
    try { undressBath(); } catch { /* keep going */ }
    try { undressChamber(); } catch { /* keep going */ }
    restoreLight();
    if (SPg && SPg.cast === ourCast) SPg.cast = origCast;
    if (S.hall) S.hall.door.visible = false;
    // never leave Harry in the chamber without the quest: back up to the Entrance Hall
    if (interiors.active === 'b2chamber') { try { interiors.enter('entrancehall', { x: 0, z: 6, yaw: Math.PI }); } catch { /* ok */ } }
    hold.classList.remove('on'); try { hold.remove(); css.remove(); } catch { /* ok */ }
    setTimeout(() => { try { fade.classList.remove('on'); fade.remove(); } catch { /* ok */ } }, finished ? 1200 : 0);
  }
  function state() {
    const H = S.H;
    return { room: interiors.active, bath: !!S.B, myTris: S.B ? S.B.myTris : null, bathTris: S.B ? S.B.tris : null, sink: S.sink, found: S.found > 0, wrong: S.wrong,
      hold: +S.hold.toFixed(3), holding: S.holding, holdOn: hold.classList.contains('on'), assist: S.assist, opened: S.opened > 0, sinkVerts: S.B && S.B.idx ? S.B.idx.length : 0,
      slide: S.slide ? S.slide.ph : null, slides: S.slides, aborts: S.aborts, takeover: !!S.tk, hall: !!H, hallTris: inHall() ? triCount(interiors.room.group) : null, fkTris: H ? H.fkTris : null,
      fawkes: S.fk ? S.fk.mode : null, hatLanded: !!S.hatLanded, hatHit: S.hatHit > 0, sword: !!(H && H.sword.visible), shadow: S.shadowT >= 0, shadowRuns: S.shadowRuns, shadowMaxOp: +S.shadowMaxOp.toFixed(2),
      fang: S.fang > 0, zap: S.zap > 0, wake: S.wake > 0, lit: !!S.lit, refused: S.refused, glisseoOurs: !!(SPg && SPg.cast === ourCast),
      troll: !!(interiors.room && interiors.room.group && interiors.room.group.getObjectByName('adv-troll')) };
  }
  ctx._chamber = {
    tapW: (i) => (inBath() ? tapW(i) : null), sinkW: (i) => (inBath() ? RW(SINK_X + 0.05, 0.85, SINK_Z[i]) : null), sink: () => S.sink, nSinks: SINK_Z.length,
    myrtleW: () => (inBath() ? RW(MYRTLE.x, MYRTLE.y + 0.8, MYRTLE.z) : null), mouthW: () => (inBath() ? RW(SINK_X + 0.05, 0, SINK_Z[S.sink]) : null),
    hatW: () => (inHall() ? RW(SPOT.hat.x, 0.4, SPOT.hat.z) : null), fangW: () => (inHall() ? RW(SPOT.fang.x, 0.05, SPOT.fang.z) : null), diaryW: () => (inHall() ? RW(SPOT.diary.x, 0.1, SPOT.diary.z) : null),
    ginnyW: () => (inHall() ? RW(SPOT.ginny.x, 0.6, SPOT.ginny.z) : null), fawkesW: () => (S.H ? S.H.fk.root.getWorldPosition(new Vector3()) : null), shadowW: () => (S.H ? S.H.shadow.getWorldPosition(new Vector3()) : null),
    standAt: () => standAt(), spawn: HALL_SPAWN, spot: SPOT, breakSlide: () => { S.slideBreak = true; }, faceSink, standHall, frameHat: () => frame(RW(SPOT.hat.x, 0, SPOT.hat.z, new Vector3()), 0.3),
    frameAt: (x, z, side, pitch) => frame(RW(x, 0, z, new Vector3()), side, pitch),
  };
  return { begin, update, goal, tap, glow, together, end, state };
}
