// Book 3, adventure 1: "אוטובוס האבירים" (the Knight Bus). Data for adventures.js + the scene code.
// Played in its own on-rails night street 'b3street' (an interior-style room built by adventure-b3-bus-build.js, so it
// adds no outdoor triangles), like the flying car's 'b2sky'. The quest drives the bus and the camera through an
// adventure-owned takeover ({ adv: true }), so hints, taps and the arrow stay alive. Kid-safe: bouncy and funny, no
// crash, no fall, no scary speed; a touch is a soft bounce + "אופס!" and that obstacle comes again; a missed ticket
// just comes again. Helper: Ron.
// Steps: 1 tap the glowing stop sign (the wand arm): the bus pops in with a BANG-bounce -> 2 tap the bus door: Harry
// and Ron hop on, the bus jumps off -> 3 collect 5/6/7 gold tickets (three lanes: ◀ ▶ or a tap on a screen half) ->
// 4 the squeeze: 3 (levels 2-3: 4) obstacles in a row (a hanging pub sign, a lamp-post pair, a slow flock of pigeons):
// the safe lane's hoop glows (level 1 at once, level 2 later, level 3 only the gap); the bus goes thin and tall as it
// squeezes through -> 5 the Leaky Cauldron: tap the glowing sign to stop, then the door: a tiny warm room card with a
// hot chocolate. Leaving / pausing mid-ride puts Harry back where he started (localStorage 'hpAdvB3Bus' keeps that spot
// across a reload); a resume restarts the current step.
import { Vector3, Matrix4, Quaternion, Euler } from 'three';
import { BUILDERS, FLOOR_Y } from './rooms.js';
import { buildStreet, LANES, STOP, SIGN, DOOR, PUB, PUB_SIGN, NLAMP, LAMP_GAP, triCount, FONT } from './adventure-b3-bus-build.js';

const RON = { ico: '👦', name: 'רון' };
const FROM_KEY = 'hpAdvB3Bus';
export const B3BUS = {
  id: 'b3-bus', book: 3, title: 'אוטובוס האבירים', ico: '🚌', col: '#2a1a5a', col2: '#8a6ae0', helper: RON, confetti: ['✨', '⭐', '🚌', '🎫'],
  pic: [['🌙', 0.18, 0.26, 30], ['🚌', 0.5, 0.58, 72], ['🎫', 0.82, 0.3, 30], ['✨', 0.84, 0.74, 26]],
  intro: [
    'לילה שקט ברחוב קטן בלונדון. הפנסים דולקים והכוכבים מנצנצים 🌙',
    'מי שצריך טרמפ קסום מרים את השרביט... ואוטובוס סגול ענק מגיע! 🚌✨',
    'אני רון. בוא נעלה על אוטובוס האבירים! תחזיק חזק, הוא קופצני! 😄',
  ],
  steps: [
    { line: 'הרם את השרביט: גע בשלט הזוהר 🪄', hints: ['רואה את השלט הזוהר ליד המדרכה? גע בו 🪄', 'השלט עם השרביט זוהר. גע בו, והאוטובוס יגיע!', 'גע בשלט העגול על המדרכה 🪄'], glowL1: true },
    { line: 'עלה לאוטובוס: גע בדלת 🚪', hints: ['הדלת של האוטובוס הסגול פתוחה. גע בה 🚪', 'גע בדלת הזוהרת בצד של האוטובוס', 'לחיצה על הדלת - ועולים! 🚌'], glowL1: true },
    { line: 'אסוף כרטיסי זהב בדרך 🎫', hints: ['הכרטיסים מגיעים מקדימה. זוז אליהם! 🎫', 'גע בחיצים ◀ ▶ או בצד של המסך כדי לזוז', 'החץ הזהוב מראה איפה הכרטיס הבא 🎫'] },
    { line: 'נדחקים! עבור לנתיב הפנוי 😮', hints: ['משהו בדרך! עבור לנתיב שאין בו כלום 😮', 'החישוק הירוק מראה את הנתיב הבטוח', 'זוז עם ◀ ▶ אל הנתיב הפנוי'] },
    { line: 'עוצרים בקלחת הדולפת: גע בשלט ואז בדלת ☕', hints: ['רואה את השלט של הקלחת הדולפת? גע בו כדי לעצור 🛑', 'אחרי העצירה, גע בדלת העץ הזוהרת 🚪', 'גע בשלט הזוהר, ואחר כך בדלת ☕'], glowL1: true },
  ],
  create: (ctx) => busScene(ctx),
  art: drawBusCard,
};

// the reward card picture: the purple triple-decker under the stars, a crescent moon, a gold ticket
function drawBusCard(x, cx, cy) {
  const g = x.createLinearGradient(0, cy - 140, 0, cy + 130); g.addColorStop(0, '#1e2a6a'); g.addColorStop(1, '#5a62a8'); x.fillStyle = g; x.fillRect(cx - 120, cy - 150, 240, 290);
  x.fillStyle = '#fff6d8'; for (const [a, b] of [[-90, -110], [-40, -80], [70, -120], [95, -60], [-100, -30], [20, -128]]) { x.beginPath(); x.arc(cx + a, cy + b, 2.4, 0, 7); x.fill(); }
  x.fillStyle = '#fff2c0'; x.beginPath(); x.arc(cx + 70, cy - 95, 20, 0, 7); x.fill(); x.fillStyle = '#26357a'; x.beginPath(); x.arc(cx + 80, cy - 101, 18, 0, 7); x.fill();
  x.fillStyle = '#6a6a86'; x.fillRect(cx - 120, cy + 96, 240, 44);
  x.save(); x.translate(cx - 6, cy - 14); x.rotate(-0.06); x.scale(0.9, 0.9);
  const R = (a, b, w, h, r, c) => { x.fillStyle = c; x.beginPath(); x.roundRect(a, b, w, h, r); x.fill(); };
  R(-62, -112, 124, 196, 22, '#5a2a9a');
  for (const y of [-38, 18]) R(-64, y, 128, 6, 3, '#c8a040');
  for (const [y, n] of [[-98, 3], [-28, 3]]) for (let k = 0; k < n; k++) R(-50 + k * 36, y, 28, 30, 6, '#ffd880');
  R(-50, 30, 64, 34, 6, '#ffd880'); x.fillStyle = '#c0303a'; x.fillRect(-36, 48, 36, 12); x.fillStyle = '#ffffff'; x.fillRect(-46, 42, 12, 8);   // the bed window
  for (const sx of [-1, 1]) { x.fillStyle = '#fff2c8'; x.beginPath(); x.arc(sx * 32, 74, 13, 0, 7); x.fill(); x.fillStyle = '#1a1a22'; x.beginPath(); x.arc(sx * 30, 75, 5, 0, 7); x.fill(); }
  x.strokeStyle = '#d8d8e0'; x.lineWidth = 4; x.beginPath(); x.arc(0, 74, 18, 0.25, Math.PI - 0.25); x.stroke();
  x.fillStyle = '#26242a'; for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 40, 88, 14, 0, 7); x.fill(); }
  x.restore();
  x.save(); x.translate(cx - 78, cy + 50); x.rotate(-0.3); x.fillStyle = '#ffd040'; x.beginPath(); x.roundRect(-24, -13, 48, 26, 5); x.fill(); x.font = '16px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⭐', 0, 1); x.restore();
}

// the street interior: always registered; the quest dresses it for its step when it arrives
BUILDERS.b3street = () => {
  const B = buildStreet(); const g = B.g; g.position.y = FLOOR_Y; g.userData.adv = B;
  return { group: g, colliders: [], portals: [], spawn: { x: 0, z: 30, y: FLOOR_Y, yaw: 0 }, update() {} };
};

const SPEED = { 1: 8, 2: 9.5, 3: 11 }, NTIX = { 1: 5, 2: 6, 3: 7 }, GAP = { 1: 2.4, 2: 2.2, 3: 1.9 }, NOBS = { 1: 3, 2: 4, 3: 4 };
const SHOW = { 1: 0, 2: 1.2, 3: 99 }, START_Z = { 1: -46, 2: -44, 3: -42 };
const KINDS = ['sign', 'lamp', 'birds', 'sign'];
const KID = { ron: { x: 5.0, z: -0.8 }, harry: { x: 5.5, z: 0.5 } };   // Harry and Ron wait on the kerb by the bus door
const ease = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

function busScene(ctx) {
  const { interiors, player, fun, burst, emit, camera, scene } = ctx;
  const S = { B: null, lastRoom: null, entering: false, reT: 0, tk: null, lit: null, from: null, lane: STOP.lane, x: LANES[STOP.lane], y: 0, axPrev: 0, t: 0,
    arrive: 0, arrived: 0, hop: 0, tix: [], lastLane: -1, got: 0, spawnT: 1, ob: null, obGap: 1, passed: 0, bounce: 0, bounces: 0, sq: 0,
    pubT: 0, stopT: 0, stopped: 0, room: 0, autop: false, glowHint: false, done: {}, camP: new Vector3(), camL: new Vector3(), camInit: false, puffT: 0, lampZ: 0 };
  const FK = ctx.free ? FROM_KEY + 'Free' : FROM_KEY;   // the free ride keeps its own start spot
  const lv = () => ctx.level;
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0, type = 'triangle', v = 0.1, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  const inSt = () => interiors.active === 'b3street' && !!S.B;
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3(), M4 = new Matrix4(), Q = new Quaternion(), E = new Euler(), SC = new Vector3(1, 1, 1);
  const G = () => S.B.g.position;
  const W = (x, y, z, out = new Vector3()) => out.set(x, y, z).add(G());
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const bang = () => { sfx('boom'); sfx('boing'); tone(160, 0.25, 0.05, 'square', 0.08, 90); };
  const honk = () => { tone(440, 0.18, 0, 'square', 0.07); tone(554, 0.18, 0, 'triangle', 0.06); tone(440, 0.24, 0.26, 'square', 0.07); tone(554, 0.24, 0.26, 'triangle', 0.06); };
  const vroom = () => { tone(90, 0.5, 0, 'sawtooth', 0.06, 180); tone(120, 0.5, 0.1, 'square', 0.04, 240); };

  // ---- DOM: the lane buttons, the warm room card + hiding the free-play buttons while riding ----
  const css = document.createElement('style'); css.id = 'b3busCss';
  css.textContent = `#b3L,#b3R{position:fixed;bottom:calc(24px + env(safe-area-inset-bottom));width:96px;height:96px;border-radius:50%;border:4px solid #fff;padding:0;
    background:radial-gradient(circle at 50% 35%,rgba(190,150,250,.96),rgba(90,42,154,.94));color:#fff;font:bold 46px/88px Arial;display:none;z-index:14;touch-action:manipulation;
    box-shadow:0 6px 18px rgba(0,0,0,.4);cursor:pointer;text-shadow:0 2px 0 rgba(0,0,0,.4)}
  #b3L{left:calc(22px + env(safe-area-inset-left))} #b3R{right:calc(22px + env(safe-area-inset-right))} #b3L:active,#b3R:active{transform:scale(.9)}
  body.advBus.b3lanes #b3L,body.advBus.b3lanes #b3R{display:block}
  #b3Room{position:fixed;left:50%;top:54%;transform:translate(-50%,-50%);z-index:16;display:none;pointer-events:none;text-align:center;direction:rtl;font-family:${FONT}}
  #b3Room.on{display:block;animation:b3In .5s cubic-bezier(.3,1.6,.5,1)} #b3Room canvas{width:min(340px,80vw);height:auto;border-radius:20px;border:5px solid #ffd76a;box-shadow:0 0 34px rgba(255,190,90,.85)}
  #b3Room div{margin-top:8px;font-size:min(26px,6vw);font-weight:bold;color:#ffe9a8;text-shadow:0 2px 0 #000}
  @keyframes b3In{0%{transform:translate(-50%,-50%) scale(.5);opacity:0}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
  body.advBus .gamebtn,body.advBus #camctl,body.advBus #fcBtn,body.advBus #wandBtn,body.advBus #bellBtn,body.advBus #enterBtn,body.advBus #joy,body.advBus #joyKnob,
  body.advBus #quest,body.advBus #bubble,body.advBus #funPrompt,body.advBus #fcWheel,body.advBus #exitBtn{display:none !important}`;
  document.head.appendChild(css);
  const mkBtn = (id, txt, dir) => { const b = document.createElement('button'); b.id = id; b.textContent = txt; b.setAttribute('aria-label', dir < 0 ? 'שמאלה' : 'ימינה');
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) b.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    b.addEventListener('click', (e) => { e.stopPropagation(); steer(dir); }); document.body.appendChild(b); return b; };
  const bL = mkBtn('b3L', '◀', -1), bR = mkBtn('b3R', '▶', 1);
  const roomEl = document.createElement('div'); roomEl.id = 'b3Room'; document.body.appendChild(roomEl);
  const cls = (k, on) => document.body.classList.toggle(k, !!on);
  const lanesOn = (step) => step === 2 || step === 3;

  function steer(dir) {
    if (!inSt() || !lanesOn(ctx.step) || S.bounce > 0.6) return;
    const n = Math.max(0, Math.min(2, S.lane + dir)); if (n !== S.lane) { S.lane = n; sfx('whoosh'); }
  }

  // ---- the spot Harry started from (back there when the ride ends) ----
  function saveFrom() {
    if (interiors.active === 'b3street') return;
    const f = { room: interiors.active || null, x: player.pos.x, z: player.pos.z, yaw: player.yaw };
    S.from = f; try { localStorage.setItem(FK, JSON.stringify(f)); } catch { /* private mode */ }
  }
  function readFrom() {
    if (S.from) return S.from;
    try { const f = JSON.parse(localStorage.getItem(FK)); if (f && Number.isFinite(f.x) && Number.isFinite(f.z)) return { room: typeof f.room === 'string' ? f.room : null, x: f.x, z: f.z, yaw: +f.yaw || 0 }; } catch { /* corrupt */ }
    return null;
  }
  function goHome() {
    const f = readFrom(); S.from = null; try { localStorage.removeItem(FK); } catch { /* ok */ }
    if (f && f.room && f.room !== 'b3street') { interiors.enter(f.room, { x: f.x, z: f.z, yaw: f.yaw }); return; }
    if (interiors.active || S.entering) interiors.exit();
    if (f) { player.yaw = f.yaw; player.teleport(f.x, f.z); }
  }
  function enterSt() { S.entering = true; S.reT = 0; interiors.enter('b3street'); }

  // ---- night light: blue but bright (saved and given back when the street goes away) ----
  function applyLight() {
    if (S.lit) return;
    const L = { lights: [] };
    for (const o of scene.children) if (o.isAmbientLight || o.isHemisphereLight) L.lights.push({ o, i: o.intensity, c: o.color.getHex(), g: o.groundColor ? o.groundColor.getHex() : null });
    if (scene.fog) L.fog = { c: scene.fog.color.getHex(), d: scene.fog.density };
    S.lit = L;
    for (const { o } of L.lights) { if (o.isHemisphereLight) { o.intensity = 1.25; o.color.setHex(0xb8c4ff); o.groundColor.setHex(0x5a4a6a); } else { o.intensity = 0.95; o.color.setHex(0xffe6cc); } }
    if (scene.fog && scene.fog.density !== undefined) { scene.fog.density = 0.006; scene.fog.color.setHex(0x3a4a8a); }
  }
  function restoreLight() {
    const L = S.lit; if (!L) return; S.lit = null;
    for (const l of L.lights) { l.o.intensity = l.i; l.o.color.setHex(l.c); if (l.g !== null && l.o.groundColor) l.o.groundColor.setHex(l.g); }
    if (L.fog && scene.fog) { scene.fog.color.setHex(L.fog.c); if (L.fog.d !== undefined) scene.fog.density = L.fog.d; }
  }

  // ---- arriving in the street / leaving it ----
  const tk = { adv: true, spell: true, update: (dt, axis) => { try { sim(dt, axis); } catch (e) { if (!S.simErr) console.warn('[b3-bus] sim failed -', e && e.message || e); S.simErr = (S.simErr || 0) + 1; } } };
  function arrive(step) {
    applyLight(); setup(step, true);
    player.model.visible = false; parkPlayer();
    S.tk = tk; ctx.setTakeover(tk); cls('advBus', true); S.camInit = false;
  }
  function leaveSt() {
    restoreLight();
    if (S.tk) { S.tk = null; try { if (window.__game && window.__game.takeover === tk) ctx.setTakeover(null); } catch { ctx.setTakeover(null); } }
    player.model.visible = true; cls('advBus', false); cls('b3lanes', false); roomEl.classList.remove('on');
  }
  function parkPlayer() { player.pos.set(0, FLOOR_Y, 500); player.model.position.copy(player.pos); }   // far behind the camera: no blob shadow, no trail in view

  // ---- per-step dressing (fresh start or a resume) ----
  function setup(step, resumed) {
    const P = S.B.P;
    S.tix = []; S.got = 0; S.spawnT = 1.2; S.ob = null; S.obGap = 1.4; S.passed = 0; S.bounce = 0; S.sq = 0; S.autop = false; S.hop = 0;
    S.pubT = 0; S.stopT = 0; S.stopped = 0; S.room = 0; S.autoIn = false; S.fastIn = false;
    if (step >= 2 && step <= 3 && resumed) { S.lane = 1; S.x = 0; }
    if (step <= 1) { S.lane = STOP.lane; S.x = LANES[STOP.lane]; }
    if (step === 4) { S.lane = 2; if (resumed) S.x = LANES[2]; }
    S.arrive = step === 0 ? 0 : 1; S.arrived = step === 0 ? 0 : 1;
    const b = P.bus;
    b.root.visible = step >= 1; b.root.position.set(S.x, 0, 0); b.root.rotation.set(0, 0, 0); b.body.scale.set(1, 1, 1); b.body.rotation.set(0, 0, 0); b.body.position.set(0, 0, 0);
    P.stop.visible = step <= 1;
    P.ron.visible = P.harry.visible = step <= 1;
    P.ron.position.set(KID.ron.x, 0, KID.ron.z); P.harry.position.set(KID.harry.x, 0, KID.harry.z); P.ron.scale.setScalar(1.15); P.harry.scale.setScalar(1.15);
    P.tickets.count = 0; P.hoop.visible = false; P.obs.sign.visible = P.obs.lamp.visible = false; P.obs.birds.count = 0;
    P.pub.g.visible = step === 4; P.pub.g.position.z = step === 4 ? -70 : 0;
    cls('b3lanes', lanesOn(step));
    roomEl.classList.remove('on');
    placeLamps(0);
  }
  function placeLamps(dz) {
    const P = S.B.P; S.lampZ = (S.lampZ + dz) % LAMP_GAP;
    const half = NLAMP / 2;
    for (let i = 0; i < NLAMP; i++) {
      const side = i < half ? 1 : -1, k = i % half, z = -LAMP_GAP * (half - 2) + k * LAMP_GAP + S.lampZ + (side > 0 ? LAMP_GAP / 2 : 0);
      const hide = side > 0 && ctx.step === 4 ? 0.001 : 1;   // at the Leaky Cauldron its own lanterns light the kerb (no post in front of the door)
      M4.makeScale(hide, hide, hide); M4.setPosition(side * 6.5, 0, z); P.lamps.setMatrixAt(i, M4);
      M4.makeScale(2.6 * hide, 2.6 * hide, 2.6 * hide); M4.setPosition(side * 6.5, 4.45, z); P.glows.setMatrixAt(i, M4);
    }
    P.lamps.instanceMatrix.needsUpdate = true;
  }
  function faceGlows() {   // the lamp glow cards face the camera
    const P = S.B.P; Q.copy(camera.quaternion);
    for (let i = 0; i < NLAMP; i++) { P.glows.getMatrixAt(i, M4); v1.setFromMatrixPosition(M4); const k = i < NLAMP / 2 && ctx.step === 4 ? 0.001 : 2.6; M4.compose(v1, Q, SC.set(k, k, k)); P.glows.setMatrixAt(i, M4); }
    P.glows.instanceMatrix.needsUpdate = true; SC.set(1, 1, 1);
  }

  // ---- step actions ----
  function hailBus() {
    if (ctx.step !== 0 || S.arrive || !inSt()) return;
    S.arrive = 0.001; S.B.P.bus.root.visible = true; sfx('whoosh'); ctx.say('הרמת את השרביט! הנה הוא בא... 🚌', '👦 רון', 2.6);
    W(SIGN.x, 2.9, SIGN.z, v1); burst(v1.x, v1.y, v1.z, 0xffd76a, 22, 2.2, 0.9, 0.26, -0.8);
  }
  function hopOn() {
    if (ctx.step !== 1 || S.hop || !inSt()) return;
    S.hop = 0.001; sfx('pop'); ctx.say('וואו! יש פה מיטות במקום כיסאות! 🛏️ יאללה, עולים!', '👦 רון', 3.2);
  }
  function collectTicket(t) {
    S.got++; ctx.poke(); const p = W(LANES[t.lane], 2.0, 0, v1);
    burst(p.x, p.y, p.z, 0xffd76a, 20, 2.4, 0.9, 0.3, -0.6); sfx('tink', S.got); sfx('sparkle');
    try { fun.toast('🎫', S.got + ' / ' + need(), 900); } catch { /* ok */ }
    if (S.got >= need()) { ctx.say('כל הכרטיסים! הנהג אומר תודה! 🎫', '👦 רון', 2.6); setTimeout(() => done(2), 700); }
  }
  const need = () => NTIX[lv()] || 5;
  function stopAtPub() {
    if (ctx.step !== 4 || S.stopT || S.pubT < 1 || !inSt()) return;
    S.stopT = 0.001; sfx('chime'); ctx.say('עוצרים! תחזיק חזק... 🛑', '👦 רון', 2);
  }
  function enterPub() {
    if (ctx.step !== 4 || !S.stopped || S.room || !inSt()) return;
    S.room = 0.001; sfx('pop'); showRoom();
  }
  function showRoom() {
    roomEl.innerHTML = ''; const cv = document.createElement('canvas'); cv.width = 340; cv.height = 240; roomEl.appendChild(cv);
    try { drawRoom(cv.getContext('2d')); } catch { /* art optional */ }
    const t = document.createElement('div'); t.textContent = '☕ שוקו חם בקלחת הדולפת!'; roomEl.appendChild(t);
    roomEl.classList.add('on'); sfx('heart');
  }

  // ---- the simulation (runs inside the takeover, before the frame draws) ----
  function sim(dt, axis) {
    if (!inSt()) return;
    const P = S.B.P, step = ctx.step, L = lv();
    S.t += dt;
    const frozen = ctx.isModal();
    if (!frozen) {
      const ax = axis ? axis.x : 0, dir = ax > 0.5 ? 1 : ax < -0.5 ? -1 : 0;
      if (dir && dir !== S.axPrev) steer(dir); S.axPrev = dir;
      if (S.autop && lanesOn(step)) autopilot(step);
      let spd = 0;
      if (step === 1 && S.hop > 2.0) spd = Math.min(1, (S.hop - 2.0) / 1.5) * SPEED[L] * 0.7;
      else if (step === 2 || step === 3) spd = SPEED[L];
      else if (step === 4) spd = S.stopT ? Math.max(0, 1 - S.stopT / 0.9) * SPEED[L] * 0.35 : (S.pubT < 1 ? SPEED[L] * (1 - ease(S.pubT) * 0.75) : SPEED[L] * 0.25);
      if (step === 4 && S.stopped) spd = 0;
      P.rT.offset.y += spd * dt / 8; P.hT.offset.x -= spd * dt / 16; placeLamps(spd * dt);
      if (step === 0) stepHail(dt);
      else if (step === 1) stepHop(dt);
      else if (step === 2) stepTickets(dt, spd);
      else if (step === 3) stepSqueeze(dt, spd);
      else if (step === 4) stepPub(dt, spd);
      // the bus: lane glide, a bouncy ride (it is a funny bus), the squeeze, a soft bounce
      const b = P.bus;
      if (lanesOn(step) || (step === 4 && !S.stopped)) {
        const tx = LANES[S.lane], vx = tx - S.x; S.x += vx * Math.min(1, dt * 4);
        let bounceY = 0, wob = 0;
        if (S.bounce > 0) { S.bounce -= dt; const k = S.bounce / 1.2; bounceY = Math.abs(Math.sin((1 - k) * Math.PI * 3)) * 0.7 * k; wob = Math.sin(S.t * 20) * 0.12 * k;
          if (Math.random() < dt * 30) { const a = S.t * 8 + Math.random(); emit(G().x + S.x + Math.cos(a) * 1.4, G().y + 5.0, G().z + Math.sin(a) * 1.4, -Math.sin(a) * 1.5, 0.2, Math.cos(a) * 1.5, 0.6, 0.3, 0xffe26a, 0); } }
        S.y = Math.abs(Math.sin(S.t * 3.1)) * 0.12 + bounceY;
        b.root.position.set(S.x, S.y, S.bounce > 0 ? Math.sin((1 - S.bounce / 1.2) * Math.PI) * 1.6 : 0);
        b.root.rotation.set(0, -vx * 0.05, -vx * 0.06 + wob);
        const tsq = S.sq; b.body.scale.set(1 - 0.3 * tsq, 1 + 0.2 * tsq, 1);
      }
      if (lanesOn(step) && Math.random() < dt * 6) { W(S.x + (Math.random() - 0.5) * 0.4, 0.5, 3.4, v1); emit(v1.x, v1.y, v1.z, (Math.random() - 0.5) * 0.3, 0.4, 1.2, 0.9, 0.5, 0xb8b4d0, 0.2); }
    }
    placeCamera(dt, step);
    faceGlows();
    P.dome.position.set(camera.position.x - G().x, camera.position.y - G().y, camera.position.z - G().z);
  }

  function stepHail(dt) {
    const P = S.B.P, b = P.bus;
    const faceCam = (k) => { k.rotation.y = Math.atan2(S.camP.x - G().x - k.position.x, S.camP.z - G().z - k.position.z); };
    for (const [k, ph] of [[P.ron, 0], [P.harry, 1.7]]) { faceCam(k); k.position.y = Math.abs(Math.sin(S.t * 2.2 + ph)) * 0.1; }
    P.signFace.scale.setScalar(1 + Math.sin(S.t * 4) * (S.arrive ? 0 : 0.06));
    if (!S.arrive) { if ((lv() === 1 || S.glowHint) && Math.random() < dt * 5) { W(SIGN.x + (Math.random() - 0.5) * 1.2, 2.9 + (Math.random() - 0.5) * 1.2, SIGN.z, v1); emit(v1.x, v1.y, v1.z, 0, 0.3, 0, 0.8, 0.22, 0xffe07a, 0); } return; }
    S.arrive += dt; const t = S.arrive;
    // the bus zooms in from far down the street (toward the camera), screeches to a stop by the kerb: BANG, squash, wobble
    if (t < 1.3) { const k = 1 - Math.pow(1 - t / 1.3, 3); b.root.position.set(LANES[STOP.lane], 0, 90 * (1 - k)); b.body.scale.set(1, 1, 1 + 0.25 * (1 - k)); if (Math.random() < dt * 20) { W(LANES[STOP.lane] + (Math.random() - 0.5) * 2, 0.3, b.root.position.z + 3.4, v1); emit(v1.x, v1.y, v1.z, 0, 0.6, 2, 0.8, 0.6, 0xc8c4e0, 0.2); } }
    else {
      if (!S.banged) { S.banged = 1; bang(); W(LANES[STOP.lane], 1.0, -3.4, v1); burst(v1.x, v1.y, v1.z, 0xffe8a0, 30, 3, 1.0, 0.34, -1); try { fun.toast('💥', 'בַּאנְג!', 1200); } catch { /* ok */ } }
      const u = t - 1.3, a = Math.exp(-3.2 * u) * 0.22;
      b.root.position.set(LANES[STOP.lane], 0, 0); b.body.scale.set(1 + Math.sin(u * 16) * a * 0.6, 1 - Math.sin(u * 16) * a, 1); b.body.rotation.x = Math.sin(u * 10) * a * 0.3;
      if (t > 2.4 && !S.saidArr) { S.saidArr = 1; ctx.say('ברוכים הבאים לאוטובוס האבירים! 🚌', '🎩 סטן הכרטיסן', 3); honk(); }
      if (t > 3.6) { b.body.scale.set(1, 1, 1); b.body.rotation.x = 0; done(0); }
    }
  }
  function stepHop(dt) {
    const P = S.B.P, b = P.bus;
    if (!S.hop) {
      for (const [k, ph] of [[P.ron, 0], [P.harry, 1.7]]) { k.rotation.y = Math.atan2(S.camP.x - G().x - k.position.x, S.camP.z - G().z - k.position.z); k.position.y = Math.abs(Math.sin(S.t * 2.2 + ph)) * 0.1; }
      if ((lv() === 1 || S.glowHint) && Math.random() < dt * 6) { W(DOOR.x + 0.1, DOOR.y + (Math.random() - 0.5) * 1.6, DOOR.z + (Math.random() - 0.5) * 0.8, v1); emit(v1.x, v1.y, v1.z, 0.2, 0.2, 0, 0.8, 0.22, 0xffe07a, 0); }
      b.body.position.y = Math.sin(S.t * 9) * 0.01;   // the engine idles
      return;
    }
    S.hop += dt; const t = S.hop;
    if (t < 1.2) {   // hop: an arc from the kerb in at the door
      for (const [k, x0, z0, d] of [[P.ron, KID.ron.x, KID.ron.z, 0], [P.harry, KID.harry.x, KID.harry.z, 0.2]]) {
        const u = ease((t - d) / 0.9); k.visible = u < 0.98; k.position.set(x0 + (DOOR.x - x0) * u, Math.sin(u * Math.PI) * 1.4 + u * 0.4, z0 + (DOOR.z - z0) * u); k.scale.setScalar(1.15 * (1 - u * 0.5));
      }
      return;
    }
    if (!S.offOn) { S.offOn = 1; P.ron.visible = P.harry.visible = false; vroom(); ctx.say('דינג-דינג! יוצאים לדרך! 🚌💨', '🎩 סטן הכרטיסן', 2.6); }
    if (t > 1.6 && t < 2.2) { const u = (t - 1.6) / 0.6; b.body.scale.set(1, 1 + Math.sin(u * Math.PI) * 0.12, 1 - Math.sin(u * Math.PI) * 0.06); b.body.rotation.x = Math.sin(u * Math.PI) * 0.06; }   // a little jump before it goes
    if (t > 2.2) { b.body.scale.set(1, 1, 1); b.body.rotation.x = 0; P.stop.visible = t < 3.0; }
    if (t > 3.2) done(1);
  }
  function stepTickets(dt, spd) {
    const P = S.B.P, L = lv();
    S.spawnT -= dt;
    if (S.got < need() && S.spawnT <= 0 && S.tix.length < 3) {
      let lane = Math.floor(Math.random() * 3); if (lane === S.lastLane) lane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
      S.lastLane = lane; S.tix.push({ lane, z: -50, rot: Math.random() * 6 }); S.spawnT = GAP[L];
    }
    for (let i = S.tix.length - 1; i >= 0; i--) {
      const t = S.tix[i], z0 = t.z; t.z += spd * dt; t.rot += dt * 2.5;
      if (z0 < -3.3 && t.z >= -3.3) { if (Math.abs(S.x - LANES[t.lane]) < 1.3 && S.got < need()) { collectTicket(t); S.tix.splice(i, 1); continue; } }
      if (t.z > 14) S.tix.splice(i, 1);
      else if (L === 1 && Math.random() < dt * 6) { W(LANES[t.lane] + (Math.random() - 0.5) * 1.2, 2.0 + (Math.random() - 0.5), t.z, v1); emit(v1.x, v1.y, v1.z, 0, 0.3, 0, 0.6, 0.22, 0xffe07a, 0); }
    }
    const im = P.tickets; im.count = S.tix.length;
    S.tix.forEach((t, i) => { M4.makeRotationY(t.rot); M4.setPosition(LANES[t.lane], 2.0 + Math.sin(t.rot * 0.8) * 0.18, t.z); im.setMatrixAt(i, M4); });
    im.instanceMatrix.needsUpdate = true;
  }
  function stepSqueeze(dt, spd) {
    const P = S.B.P, O = P.obs, L = lv();
    const want = NOBS[L] || 3;
    if (!S.ob) {
      S.sq += (0 - S.sq) * Math.min(1, dt * 5);
      S.obGap -= dt; P.hoop.visible = false; O.sign.visible = O.lamp.visible = false; O.birds.count = 0;
      if (S.obGap <= 0 && S.passed < want) {
        const kind = S.nextKind || KINDS[S.passed % KINDS.length], safe = S.nextSafe !== undefined ? S.nextSafe : pickSafe();
        S.nextKind = undefined; S.nextSafe = undefined; S.ob = { kind, safe, z: START_Z[L], t: 0, hit: false };
        sfx('whoosh');
        if (S.saidOb !== kind) { S.saidOb = kind; ctx.say({ sign: 'שלט של פאב תלוי באמצע הרחוב! 🫖 לנתיב הפנוי!', lamp: 'שני פנסים באמצע הדרך! 🏮 לנתיב הפנוי!', birds: 'להקת יונים! 🐦 לנתיב הפנוי!' }[kind], '👦 רון', 3); }
      }
      return;
    }
    const ob = S.ob; ob.t += dt; const z0 = ob.z; ob.z += spd * dt;
    // show this kind in the blocked lanes
    O.sign.visible = ob.kind === 'sign'; O.lamp.visible = ob.kind === 'lamp';
    if (ob.kind === 'sign') { O.sign.position.z = ob.z; O.boards.forEach((bd, i) => { bd.visible = i !== ob.safe; bd.rotation.x = Math.sin(S.t * 2.2 + i) * 0.12; }); }
    if (ob.kind === 'lamp') { O.lamp.position.z = ob.z; O.posts.forEach((p, i) => { p.visible = i !== ob.safe; }); }
    if (ob.kind === 'birds') {
      let n = 0;
      for (let ln = 0; ln < 3; ln++) { if (ln === ob.safe) continue; for (let k = 0; k < 4; k++) { const ph = S.t * 5 + k * 1.7 + ln; E.set(Math.sin(ph) * 0.15, Math.PI + Math.sin(S.t + k) * 0.3, Math.sin(ph * 0.7) * 0.2); Q.setFromEuler(E);
        v1.set(LANES[ln] + ((k % 2) - 0.5) * 1.0, 1.6 + (k >> 1) * 1.3 + Math.abs(Math.sin(ph)) * 0.25, ob.z + ((k >> 1) - 0.5) * 0.8); M4.compose(v1, Q, SC.set(1.5, 1.5, 1.5)); O.birds.setMatrixAt(n++, M4); } }
      SC.set(1, 1, 1); O.birds.count = n; O.birds.instanceMatrix.needsUpdate = true;
      if (Math.random() < dt * 1.5) sfx('tweet');
    } else O.birds.count = 0;
    // the safe lane's hoop (level 1 at once, level 2 after a while, level 3 never: only the gap)
    const show = ob.t >= SHOW[L] || S.glowHint;
    P.hoop.visible = show && ob.z < -2;
    if (P.hoop.visible) { P.hoop.position.set(LANES[ob.safe], 2.2, ob.z + 0.4); P.hoop.rotation.z = S.t; P.hoop.scale.setScalar(L === 1 ? 1.25 : 1); P.hoop.material.opacity = 0.6 + Math.sin(S.t * 6) * 0.25;
      if (L === 1 && Math.random() < dt * 10) { W(LANES[ob.safe] + (Math.random() - 0.5) * 2.4, 2.2 + (Math.random() - 0.5) * 2.4, ob.z + 0.4, v1); emit(v1.x, v1.y, v1.z, 0, 0.3, 0.5, 0.8, 0.25, 0x9cffa0, 0); } }
    // the squeeze: thin and tall while the obstacle goes by
    const near = ob.z > -9 && ob.z < 5;
    S.sq += ((near ? 1 : 0) - S.sq) * Math.min(1, dt * 6);
    if (near && !ob.squeak) { ob.squeak = 1; tone(700, 0.25, 0, 'sine', 0.08, 1400); }
    // contact as it reaches the bus's front
    if (z0 < -3.3 && ob.z >= -3.3) {
      let li = 0; for (let i = 1; i < 3; i++) if (Math.abs(S.x - LANES[i]) < Math.abs(S.x - LANES[li])) li = i;
      if (li !== ob.safe) { ob.hit = true; S.bounce = 1.2; S.bounces++; sfx('boing'); setTimeout(() => sfx('boing'), 220); ctx.oops('אופס! 😄 בום רך! המיטות החליקו... ננסה שוב בנתיב הפנוי'); S.nextKind = ob.kind; S.nextSafe = ob.safe; }
      else { S.passed++; ctx.poke(); sfx('sparkle'); W(S.x, 2.6, -2, v1); burst(v1.x, v1.y, v1.z, 0x9cffa0, 18, 2.2, 0.9, 0.28, -0.4); try { fun.toast('😮', S.passed + ' / ' + want, 900); } catch { /* ok */ } if (S.passed < want) ctx.say(['נדחקנו! 😄', 'וּוּש! עברנו!', 'כמעט נגענו! 😂'][S.passed % 3], '👦 רון', 1.8); }
    }
    if (ob.z > 9) { S.ob = null; S.obGap = 0.8; if (S.passed >= want && !S.done[3]) { ctx.say('עברנו הכל! עכשיו לקלחת הדולפת ☕', '👦 רון', 2.6); setTimeout(() => done(3), 600); } }
  }
  function pickSafe() { let s = Math.floor(Math.random() * 3); if (s === S.lastSafe) s = (s + 1 + Math.floor(Math.random() * 2)) % 3; S.lastSafe = s; return s; }
  function autopilot(step) {
    let want = S.lane;
    if (step === 2) { const n = S.tix.filter(t => t.z < -3.3).sort((a, b) => b.z - a.z)[0]; if (n) want = n.lane; else if (S.got < need()) S.spawnT = Math.min(S.spawnT, 0.6); }
    else if (step === 3 && S.ob) want = S.ob.safe;
    S.lane = want;
  }
  function stepPub(dt) {
    const P = S.B.P, pub = P.pub.g, b = P.bus;
    if (S.pubT < 1) { S.pubT = Math.min(1, S.pubT + dt / 3.5); pub.position.z = -70 * (1 - ease(S.pubT)); if (S.pubT >= 1 && !S.saidPub) { S.saidPub = 1; ctx.say('הנה הקלחת הדולפת! גע בשלט כדי לעצור 🛑', '👦 רון', 3.5); } }
    else if (!S.stopped) pub.position.z = 0;
    S.sq += (0 - S.sq) * Math.min(1, dt * 5);
    // the sign glows (level 1 / the glow hint), then the door
    const glowOn = lv() === 1 || S.glowHint;
    P.pub.sign.rotation.z = Math.sin(S.t * 2) * 0.06;
    if (S.pubT >= 1 && !S.stopT && glowOn && Math.random() < dt * 6) { W(PUB_SIGN.x + (Math.random() - 0.5) * 0.4, PUB_SIGN.y + (Math.random() - 0.5) * 1.6, PUB_SIGN.z + (Math.random() - 0.5) * 1.6, v1); emit(v1.x, v1.y, v1.z, -0.2, 0.3, 0, 0.8, 0.24, 0xffe07a, 0); }
    if (S.stopT && !S.stopped) {
      S.stopT += dt; const t = S.stopT;
      if (t > 0.9) { S.stopped = 0.001; bang(); W(S.x, 1.0, -3.4, v1); burst(v1.x, v1.y, v1.z, 0xffe8a0, 26, 2.6, 0.9, 0.3, -1); ctx.say('בַּאנְג! עצרנו! עכשיו גע בדלת 🚪', '👦 רון', 3); }
    }
    if (S.stopped) {
      S.stopped += dt; const u = S.stopped, a = Math.exp(-3.2 * u) * 0.22;
      if (S.autoIn && !S.room && (u > 1.0 || S.fastIn)) { enterPub(); if (S.fastIn) S.room = 4.5; }
      b.root.position.set(S.x, 0, 0); b.root.rotation.set(0, 0, 0); b.body.scale.set(1 + Math.sin(u * 16) * a * 0.6, 1 - Math.sin(u * 16) * a, 1); b.body.rotation.x = -Math.sin(u * 10) * a * 0.3;
      if (!S.room && glowOn && Math.random() < dt * 6) { W(PUB.x - 0.1, PUB.y + (Math.random() - 0.5) * 2.2, PUB.z + (Math.random() - 0.5) * 1.2, v1); emit(v1.x, v1.y, v1.z, -0.2, 0.3, 0, 0.8, 0.24, 0xffe07a, 0); }
    }
    if (S.room) { S.room += dt; if (Math.random() < dt * 8) { W(PUB.x - 0.2, PUB.y + 0.6, PUB.z, v1); emit(v1.x, v1.y, v1.z, -0.3, 0.6, 0, 1.0, 0.3, 0xffc070, 0); } if (S.room > 3.6 && !S.saidRoom) { S.saidRoom = 1; ctx.say('איזה שוקו חם! איזו נסיעה! 😄 תודה, אוטובוס האבירים!', '👦 רון', 4.5); honk(); } if (S.room > 4.6) done(4); }
  }

  // ---- the camera (our own takeover camera; the distance grows on a narrow phone so everything fits) ----
  function placeCamera(dt, step) {
    const g = G(), aspect = innerWidth / Math.max(1, innerHeight), vf = camera.fov * Math.PI / 180;
    const hh = Math.atan(Math.tan(vf / 2) * aspect), dFor = (half, lo, hi) => Math.max(lo, Math.min(hi, half / Math.tan(hh)));
    let px, py, pz, lx, ly, lz;
    if (step <= 1) {   // the kerb from the street, a little in front: the bus's face, its door side, the sign and the kids
      const d = dFor(4.2, 9, 22), tall = aspect < 1; px = 5.0; py = 2.6 + d * 0.26; pz = -1.6 - d * 0.88; lx = tall ? (step === 0 && !S.arrive ? 5.4 : 2.9) : 3.0; ly = 1.5; lz = -1.2;   // a narrow phone: the sign + kids first, then the door + kids
    } else if (step === 4) {   // from behind-left, high: the bus, the pub's sign and door ahead on the right
      const d = dFor(5.6, 13, 32), tall = aspect < 1, ty = tall ? 5.2 : 2.6; px = Math.max(-6.0, 4.2 - 0.62 * d); py = ty + 0.36 * d; pz = -7.4 + 0.72 * d; lx = 4.2; ly = ty; lz = -7.4;
    } else { const d = dFor(5.0, 9, 26); px = S.x * 0.35; py = 5.0 + d * 0.3; pz = d + 3; lx = S.x * 0.2; ly = 1.4; lz = -16; }
    v1.set(px, py, pz).add(g); v2.set(lx, ly, lz).add(g);
    if (!S.camInit) { S.camP.copy(v1); S.camL.copy(v2); S.camInit = true; }
    const k = Math.min(1, dt * 2.5); S.camP.lerp(v1, k); S.camL.lerp(v2, k);
    camera.position.copy(S.camP); camera.lookAt(S.camL); camera.updateMatrixWorld();
  }

  // ---- framework hooks ----
  function update(dt, step) {
    const r = interiors.room;
    if (r !== S.lastRoom) {
      S.lastRoom = r; const was = !!S.B;
      S.B = interiors.active === 'b3street' && r && r.group ? r.group.userData.adv : null;
      if (S.B) { S.entering = false; arrive(step); } else if (was) leaveSt();
    }
    // the ride is on rails: if anything took Harry out of the street mid-quest, bring him back (the step restarts)
    if (S.active && !S.B && !S.entering && !S.ended) { S.reT += dt; if (S.reT > 1.2 && !ctx.isModal()) enterSt(); }
    if (S.B) { cls('b3lanes', lanesOn(step) && !ctx.isModal()); parkPlayer(); }
  }
  function begin(step, resumed) {
    S.active = true;
    if (step === 0 && !resumed) saveFrom();
    else if (!readFrom() && interiors.active !== 'b3street') saveFrom();
    if (!inSt()) { if (!S.entering) enterSt(); return; }
    setup(step, resumed);
    if (step === 2) ctx.say('יוהו! אנחנו נוסעים! אסוף את כרטיסי הזהב! 🎫', '👦 רון', 3.5);
    if (step === 3) ctx.say('הרחוב נהיה צר! האוטובוס יודע להידחק... בחר את הנתיב הפנוי 😮', '👦 רון', 4);
    if (step === 4) ctx.say('לאט לאט... אנחנו מגיעים לקלחת הדולפת ☕', '👦 רון', 3);
  }
  function goal(step, out) {
    if (!inSt()) return null;
    const P = S.B.P;
    if (step === 0) return S.arrive ? null : W(SIGN.x, 2.2, SIGN.z, out);
    if (step === 1) return S.hop ? null : W(S.x + DOOR.x - LANES[STOP.lane] + 0.2, 0.4, DOOR.z, out);
    if (step === 2) { const n = S.tix.filter(t => t.z < -4).sort((a, b) => b.z - a.z)[0]; return n ? W(LANES[n.lane], 1.6, n.z, out) : null; }
    if (step === 3) return S.ob && P.hoop.visible ? W(LANES[S.ob.safe], 2.6, S.ob.z, out) : null;
    if (step === 4) { if (S.pubT < 1 || S.room) return null; if (!S.stopT) return W(PUB_SIGN.x, PUB_SIGN.y - 1.0, PUB_SIGN.z, out); return S.stopped ? W(PUB.x - 0.3, 0.2, PUB.z, out) : null; }
    return null;
  }
  function tap(x, y, step) {
    if (!inSt()) return false;
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (step === 0) { if (S.arrive) return true; if (near(W(SIGN.x, 2.9, SIGN.z, v1)) < R() * 2.2) { hailBus(); return true; } ctx.say('גע בשלט העגול הזוהר 🪄', '👦 רון', 2); return true; }
    if (step === 1) { if (S.hop) return true; const d1 = near(W(DOOR.x, DOOR.y, DOOR.z, v1)), d2 = near(W(LANES[STOP.lane], 2.3, -0.5, v2)); if (d1 < R() * 2.2 || d2 < R() * 3) { hopOn(); return true; } ctx.say('גע בדלת של האוטובוס הסגול 🚪', '👦 רון', 2); return true; }
    if (lanesOn(step)) { steer(x < innerWidth / 2 ? -1 : 1); return true; }
    if (step === 4) {
      if (S.room) return true;
      if (!S.stopT) { if (S.pubT >= 1 && near(W(PUB_SIGN.x, PUB_SIGN.y, PUB_SIGN.z + P_Z(), v1)) < R() * 2.2) { stopAtPub(); return true; } if (S.pubT >= 1) ctx.say('גע בשלט עם הקלחת 🛑', '👦 רון', 2); return true; }
      if (S.stopped && near(W(PUB.x, PUB.y, PUB.z, v1)) < R() * 2.4) { enterPub(); return true; }
      if (S.stopped) ctx.say('גע בדלת העץ הזוהרת 🚪', '👦 רון', 2);
      return true;
    }
    return false;
  }
  const P_Z = () => (S.B ? S.B.P.pub.g.position.z : 0);
  function glow(step, on) { S.glowHint = !!on; }
  function together(step, fast) {
    if (!inSt()) { if (fast) done(step); return; }
    if (step === 0) { hailBus(); if (fast) S.arrive = Math.max(S.arrive, 3.5); }
    else if (step === 1) { hopOn(); if (fast) S.hop = Math.max(S.hop, 3.5); }
    else if (step === 4) {
      S.pubT = 1; S.B.P.pub.g.position.z = 0; S.autoIn = true;   // stepPub walks in once the bus has stopped
      if (!S.stopT) stopAtPub();
      if (fast) { S.stopT = Math.max(S.stopT, 0.95); S.fastIn = true; }
    }
    else if (fast) done(step);
    else S.autop = true;
  }
  function end() {
    S.ended = true; S.active = false;
    const wasIn = interiors.active === 'b3street' || S.entering;
    leaveSt(); S.B = null; S.lastRoom = null;
    if (wasIn) goHome(); else { S.from = null; try { localStorage.removeItem(FK); } catch { /* ok */ } }
    S.entering = false;
    try { bL.remove(); bR.remove(); roomEl.remove(); css.remove(); } catch { /* ok */ }
  }
  function state() {
    const P = S.B && S.B.P, b = P && P.bus;
    return { room: interiors.active, street: inSt(), lane: S.lane, x: +S.x.toFixed(2), arrive: S.arrive > 0, arrived: !!S.done[0], hop: S.hop > 0, got: S.got, need: need(), tickets: S.tix.length,
      ob: S.ob ? { kind: S.ob.kind, safe: S.ob.safe, z: +S.ob.z.toFixed(1), hoop: !!(P && P.hoop.visible) } : null, passed: S.passed, want: NOBS[lv()] || 3, bounces: S.bounces, squeeze: +S.sq.toFixed(2),
      pub: S.pubT >= 1, stopping: S.stopT > 0, stopped: S.stopped > 0, inPub: S.room > 0, roomCard: roomEl.classList.contains('on'),
      takeover: !!S.tk, lanes: document.body.classList.contains('b3lanes'), from: readFrom(), autop: S.autop,
      bus: b ? { visible: b.root.visible && b.root.parent && b.root.parent.visible !== false, x: +b.root.position.x.toFixed(2), z: +b.root.position.z.toFixed(2) } : null,
      sign: P ? P.stop.visible : null, pubVisible: P ? P.pub.g.visible : null,
      tris: S.B ? triCount(S.B.g) : null, busTris: b ? triCount(b.root) : null };
  }
  ctx._bus = {
    busW: () => (S.B ? W(S.B.P.bus.root.position.x, 2.3, S.B.P.bus.root.position.z) : null),
    signW: () => (S.B ? W(SIGN.x, 2.9, SIGN.z) : null),
    doorW: () => (S.B ? W(DOOR.x, DOOR.y, DOOR.z) : null),
    pubSignW: () => (S.B ? W(PUB_SIGN.x, PUB_SIGN.y, PUB_SIGN.z + P_Z()) : null),
    pubDoorW: () => (S.B ? W(PUB.x, PUB.y, PUB.z + P_Z()) : null),
    obsW: () => (S.B && S.ob ? W(LANES[[0, 1, 2].find(i => i !== S.ob.safe)], 2.4, S.ob.z) : null),
    safe: () => (S.ob ? S.ob.safe : null),
    nextLane: () => { if (ctx.step === 2) { const n = S.tix.filter(t => t.z < -3.3).sort((a, b) => b.z - a.z)[0]; return n ? n.lane : null; } return S.ob ? S.ob.safe : null; },
  };
  return { begin, update, goal, tap, glow, together, end, state };
}

// ---------------- the free ride (the map card "האוטובוס הלילי"): the same scene code, no quest, no tracker ----------------
// Steps reused: 0 the stop sign -> 1 the door -> 3 the squeeze (obstacles, the soft bounce; no tickets) -> 4 the Leaky
// Cauldron; then a 🏠 button takes Harry back where he came from (the button is there the whole ride, too).
// Debug: window.__game.busRide (the state, or null when no ride runs).
let RIDE = null;
export function freeRideState() { return RIDE ? { step: RIDE.step, ended: RIDE.ended, scene: (() => { try { return RIDE.sc.state(); } catch { return null; } })(), ctx: RIDE.ctx } : null; }
export function startFreeRide() {
  if (RIDE) return false;
  const A = window.__game && window.__game.adventures, base = A && A._ctx; if (!base) return false;
  const busy = () => { const c = document.body.classList; return c.contains('inSpell') || c.contains('inMatch') || c.contains('inFloo') || c.contains('inAdv'); };
  try { if (A.state().quest || base.isModal() || base.isTakeover() || busy()) { base.fun.toast('🚌', 'האוטובוס יחכה לך אחר כך', 1800); return false; } } catch { return false; }
  const R = { step: 0, ended: false, sc: null, ctx: null, raf: 0, last: performance.now() };
  const ctx = Object.create(base);
  Object.defineProperty(ctx, 'step', { get: () => R.step }); Object.defineProperty(ctx, 'level', { get: () => 1 });
  ctx.free = true; ctx.poke = () => {};
  ctx.done = (i) => {
    if (R.ended || i !== R.step) return false;
    try { base.fun.sfx.chime(); } catch { /* no audio */ }
    if (i === 4) { back.classList.add('end'); base.say('איזה טיול! רוצה לחזור? גע ב-🏠', '👦 רון', 4); return true; }
    R.step = { 0: 1, 1: 3, 3: 4 }[i]; try { R.sc.begin(R.step, false); } catch (e) { console.warn('[b3-bus] free ride -', e && e.message || e); }
    return true;
  };
  R.ctx = ctx;
  const back = document.createElement('button'); back.id = 'b3Back'; back.textContent = '🏠 חזרה'; back.setAttribute('aria-label', 'חזרה');
  const css = document.createElement('style'); css.id = 'b3BackCss';
  css.textContent = `#b3Back{position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:15;padding:10px 26px;border-radius:24px;border:3px solid #ffd76a;
    background:rgba(60,30,110,.9);color:#ffe9a8;font:bold 24px 'Rubik','Arial Hebrew',Arial,sans-serif;cursor:pointer;touch-action:manipulation;box-shadow:0 4px 14px rgba(0,0,0,.45)}
    #b3Back.end{animation:enterPulse 1.2s ease-in-out infinite;background:linear-gradient(#ffe48a,#ffb020);color:#4a2400}`;
  document.head.appendChild(css); document.body.appendChild(back);
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) back.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  const view = document.getElementById('view'); let down = null;
  const pd = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; };
  const pu = (e) => { const d0 = down; down = null; if (!d0 || d0.id !== e.pointerId || R.ended || base.isModal()) return; if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 18 || performance.now() - d0.t > 900) return; try { R.sc.tap(e.clientX, e.clientY, R.step); } catch (er) { console.warn('[b3-bus] free tap -', er && er.message || er); } };
  if (view) { view.addEventListener('pointerdown', pd, { passive: true }); view.addEventListener('pointerup', pu, { passive: true }); }
  function stop() {
    if (R.ended) return; R.ended = true; cancelAnimationFrame(R.raf);
    try { R.sc.end(true); } catch (e) { console.warn('[b3-bus] free end -', e && e.message || e); }
    if (view) { view.removeEventListener('pointerdown', pd); view.removeEventListener('pointerup', pu); }
    try { back.remove(); css.remove(); } catch { /* ok */ }
    RIDE = null;
  }
  back.addEventListener('click', (e) => { e.stopPropagation(); stop(); });
  const tick = (now) => { if (R.ended) return; const dt = Math.min(0.1, Math.max(0, (now - R.last) / 1000)); R.last = now; try { R.sc.update(dt, R.step); } catch (e) { if (!R.err++) console.warn('[b3-bus] free update -', e && e.message || e); } R.raf = requestAnimationFrame(tick); };
  R.err = 0; R.stop = stop;
  try { R.sc = busScene(ctx); R.sc.begin(0, false); } catch (e) { console.warn('[b3-bus] free ride failed -', e && e.message || e); R.ended = true; try { back.remove(); css.remove(); } catch { /* ok */ } return false; }
  RIDE = R; R.raf = requestAnimationFrame(tick);
  return true;
}

// the tiny warm room card: a fire, a round table, a big mug of hot chocolate with steam
function drawRoom(x) {
  const g = x.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, '#5a3020'); g.addColorStop(1, '#8a4a28'); x.fillStyle = g; x.fillRect(0, 0, 340, 240);
  x.fillStyle = 'rgba(0,0,0,.15)'; for (let k = 0; k < 340; k += 26) x.fillRect(k, 0, 3, 170);
  x.fillStyle = '#6a3a22'; x.fillRect(0, 170, 340, 70);
  x.fillStyle = '#4a4a56'; x.fillRect(20, 60, 110, 110); x.fillStyle = '#1a1010'; x.fillRect(36, 90, 78, 80);
  const f = x.createRadialGradient(75, 150, 4, 75, 140, 50); f.addColorStop(0, '#fff2a0'); f.addColorStop(0.5, '#ff9a30'); f.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = f; x.fillRect(30, 90, 90, 80);
  x.fillStyle = '#c8a040'; x.fillRect(14, 54, 122, 10);
  x.fillStyle = '#8a5a30'; x.beginPath(); x.ellipse(230, 176, 84, 18, 0, 0, 7); x.fill(); x.fillRect(222, 176, 16, 50);
  x.fillStyle = '#d84a4a'; x.beginPath(); x.roundRect(200, 116, 56, 58, 10); x.fill();
  x.strokeStyle = '#d84a4a'; x.lineWidth = 8; x.beginPath(); x.arc(258, 142, 14, -1.2, 1.2); x.stroke();
  x.fillStyle = '#6a3a1e'; x.beginPath(); x.ellipse(228, 120, 26, 7, 0, 0, 7); x.fill();
  x.fillStyle = '#fff6e0'; for (const [a, b, r] of [[218, 116, 6], [234, 118, 5]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 4; for (const sx of [214, 236]) { x.beginPath(); x.moveTo(sx, 106); x.bezierCurveTo(sx - 10, 90, sx + 10, 80, sx, 62); x.stroke(); }
  x.font = '30px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🕯️', 300, 150); x.fillText('🖼️', 220, 40);
}
