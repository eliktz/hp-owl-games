// Book 2, adventure 1: "המכונית המעופפת" (the flying Ford Anglia). Data for adventures.js + the scene code.
// Played in its own on-rails sky scene 'b2sky' (an interior-style room built by adventure-b2-car-build.js, so it adds
// no outdoor triangles). The quest drives the car and the camera through an adventure-owned takeover ({ adv: true }),
// so hints, taps and the arrow stay alive. Kid-safe: no fail state, no timer; a missed star or ring just comes again,
// a willow branch touch is a soft bounce + "אופס!" and that sweep repeats.
// Steps: 1 tap the car (Ron and Harry hop in, "פוט-פוט", take-off) -> 2 collect 5/6/7 gold stars over the fields
// (three lanes: ◀ ▶ buttons or a tap on the left/right half of the screen) -> 3 fly through 3 of the train's smoke
// rings -> 4 the Whomping Willow: three slow branch sweeps, move into the SAFE lane (level 1: the green hoop glows from
// the start; level 2: later; level 3: only the branch shadows) -> 5 tap the glowing landing spot; the car parks and
// honks, the willow waves, Ron's line. Leaving / pausing mid-flight puts Harry back where he started the quest
// (localStorage 'hpAdvB2Car' keeps that spot across a reload); a resume restarts the current step.
import { Vector3, Matrix4 } from 'three';
import { BUILDERS, FLOOR_Y } from './rooms.js';
import { buildSky, LANES, FLY_GROUND, LAWN_Y, LAND, triCount } from './adventure-b2-car-build.js';

const RON = { ico: '👦', name: 'רון' };
const FROM_KEY = 'hpAdvB2Car';
export const B2CAR = {
  id: 'b2-car', book: 2, title: 'המכונית המעופפת', ico: '🚗', col: '#1a4a6a', col2: '#7ac8e8', helper: RON, confetti: ['✨', '⭐', '🚗', '☁️'],
  pic: [['☁️', 0.22, 0.3, 34], ['🚗', 0.5, 0.56, 70], ['⭐', 0.8, 0.28, 30], ['🌳', 0.84, 0.74, 30]],
  intro: [
    'הארי ורון פספסו את הרכבת להוגוורטס! 🚂',
    'אבל לאבא של רון יש מכונית כחולה... שיודעת לעוף! 🚗✨',
    'אני רון. בוא נטוס להוגוורטס! תחזיק חזק!',
  ],
  steps: [
    { line: 'גע במכונית כדי להתניע 🚗', hints: ['המכונית הכחולה מחכה. גע בה! 🚗', 'גע במכונית, ואנחנו קופצים פנימה', 'לחיצה אחת על המכונית - ופוט-פוט! 🚗'], glowL1: true },
    { line: 'אסוף כוכבי זהב בדרך ⭐', hints: ['הכוכבים מגיעים מקדימה. זוז אליהם! ⭐', 'גע בחיצים ◀ ▶ או בצד של המסך כדי לזוז', 'החץ הזהוב מראה איפה הכוכב הבא ⭐'] },
    { line: 'עוף דרך טבעות העשן של הרכבת 💨', hints: ['הרכבת שולחת טבעות עשן. עוף דרכן! 💨', 'זוז אל הנתיב של הטבעת עם ◀ ▶', 'החץ הזהוב מראה איפה הטבעת 💨'] },
    { line: 'עבור ליד הערבה המפליקה 🌳', hints: ['הערבה מניפה ענף! עבור לנתיב הבטוח 🌳', 'החישוק הירוק מראה את הנתיב הבטוח', 'זוז אל הנתיב שאין עליו צל של ענף'] },
    { line: 'נחת על המדשאה 🛬', hints: ['רואה את העיגול הזוהר על הדשא? 🛬', 'גע בעיגול הזוהר כדי לנחות', 'גע בעיגול הזהוב - ונוחתים!'], glowL1: true },
  ],
  create: (ctx) => carScene(ctx),
  art: drawCarCard,
};

// the reward card picture: the turquoise car in a blue sky with clouds and stars, Ron and Harry in the windows
function drawCarCard(x, cx, cy) {
  const E = (px, py, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, 0, 0, 7); x.fill(); };
  const g = x.createLinearGradient(0, cy - 140, 0, cy + 130); g.addColorStop(0, '#5a8ed0'); g.addColorStop(1, '#cfe4f4'); x.fillStyle = g; x.fillRect(cx - 120, cy - 150, 240, 290);
  for (const [px, py, s] of [[-70, -90, 1], [60, 70, 1.2], [80, -60, 0.8]]) { E(cx + px, cy + py, 30 * s, 14 * s, '#ffffff'); E(cx + px + 18 * s, cy + py - 8 * s, 18 * s, 12 * s, '#ffffff'); }
  x.save(); x.translate(cx, cy + 10); x.rotate(-0.12);
  E(0, 10, 92, 30, '#4aa8a4'); x.fillStyle = '#d6d0c2'; x.beginPath(); x.roundRect(-48, -38, 96, 40, 16); x.fill();
  x.fillStyle = '#9ac8e0'; x.beginPath(); x.roundRect(-42, -32, 38, 28, 8); x.fill(); x.beginPath(); x.roundRect(4, -32, 38, 28, 8); x.fill();
  E(-23, -14, 11, 11, '#e8c49a'); E(-23, -22, 12, 7, '#c0521c'); E(23, -14, 11, 11, '#e8c49a'); E(23, -22, 12, 7, '#2a1a14');
  x.strokeStyle = '#1a1a22'; x.lineWidth = 2; x.beginPath(); x.arc(19, -14, 4, 0, 7); x.stroke(); x.beginPath(); x.arc(28, -14, 4, 0, 7); x.stroke();
  E(-58, 40, 15, 15, '#26242a'); E(58, 40, 15, 15, '#26242a'); E(-58, 40, 6, 6, '#bcbcc0'); E(58, 40, 6, 6, '#bcbcc0');
  E(-86, 6, 11, 11, '#fff2c8'); E(-88, 7, 4, 5, '#1a1a22');
  x.restore();
  x.save(); x.font = '30px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⭐', cx - 80, cy - 40); x.fillText('⭐', cx + 70, cy - 100); x.fillText('⭐', cx + 90, cy + 20); x.restore();
}

// the sky interior: always registered; the quest dresses it for its step when it arrives
BUILDERS.b2sky = () => {
  const B = buildSky(); const g = B.g; g.position.y = FLOOR_Y; g.userData.adv = B;
  return { group: g, colliders: [], portals: [], spawn: { x: 0, z: 30, y: FLOOR_Y, yaw: 0 }, update() {} };
};

const SPEED = { 1: 8, 2: 10.5, 3: 12.5 }, NSTAR = { 1: 5, 2: 6, 3: 7 }, GAP = { 1: 3.0, 2: 2.5, 3: 2.1 };
const TELE = { 1: 3.4, 2: 2.9, 3: 2.6 }, SHOW = { 1: 0, 2: 1.5, 3: 99 };
const ease = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

function carScene(ctx) {
  const { interiors, player, fun, burst, emit, camera, scene } = ctx;
  const S = { B: null, lastRoom: null, entering: false, reT: 0, tk: null, lit: null, from: null, lane: 1, x: 0, y: 0, axPrev: 0, t: 0,
    hop: 0, put: 0, stars: [], lastLane: -1, got: 0, spawnT: 1, ring: null, rings: 0, ringT: 1, approach: 1, sw: null, swGap: 1, passed: 0, bounce: 0, bounces: 0,
    landing: 0, landed: 0, autop: false, glowHint: false, done: {}, camP: new Vector3(), camL: new Vector3(), camInit: false, puffT: 0, putT: 0 };
  const lv = () => ctx.level;
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0, type = 'triangle', v = 0.1, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  const inSky = () => interiors.active === 'b2sky' && !!S.B;
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3(), M4 = new Matrix4();
  const G = () => S.B.g.position;
  const W = (x, y, z, out = new Vector3()) => out.set(x, y, z).add(G());
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const putput = (n = 4, v = 0.06) => { for (let i = 0; i < n; i++) { tone(105, 0.07, i * 0.15, 'square', v); tone(80, 0.06, i * 0.15 + 0.07, 'square', v * 0.8); } };
  const honk = () => { tone(520, 0.16, 0, 'square', 0.07); tone(660, 0.16, 0, 'triangle', 0.06); tone(520, 0.22, 0.24, 'square', 0.07); tone(660, 0.22, 0.24, 'triangle', 0.06); };

  // ---- DOM: the lane buttons + hiding the free-play buttons while flying ----
  const css = document.createElement('style'); css.id = 'b2carCss';
  css.textContent = `#b2L,#b2R{position:fixed;bottom:calc(24px + env(safe-area-inset-bottom));width:96px;height:96px;border-radius:50%;border:4px solid #fff;padding:0;
    background:radial-gradient(circle at 50% 35%,rgba(130,215,235,.96),rgba(30,110,150,.94));color:#fff;font:bold 46px/88px Arial;display:none;z-index:14;touch-action:manipulation;
    box-shadow:0 6px 18px rgba(0,0,0,.4);cursor:pointer;text-shadow:0 2px 0 rgba(0,0,0,.4)}
  #b2L{left:calc(22px + env(safe-area-inset-left))} #b2R{right:calc(22px + env(safe-area-inset-right))} #b2L:active,#b2R:active{transform:scale(.9)}
  body.advSky.b2lanes #b2L,body.advSky.b2lanes #b2R{display:block}
  body.advSky .gamebtn,body.advSky #camctl,body.advSky #fcBtn,body.advSky #wandBtn,body.advSky #bellBtn,body.advSky #enterBtn,body.advSky #joy,body.advSky #joyKnob,
  body.advSky #quest,body.advSky #bubble,body.advSky #funPrompt,body.advSky #fcWheel{display:none !important}`;
  document.head.appendChild(css);
  const mkBtn = (id, txt, dir) => { const b = document.createElement('button'); b.id = id; b.textContent = txt; b.setAttribute('aria-label', dir < 0 ? 'שמאלה' : 'ימינה');
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) b.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    b.addEventListener('click', (e) => { e.stopPropagation(); steer(dir); }); document.body.appendChild(b); return b; };
  const bL = mkBtn('b2L', '◀', -1), bR = mkBtn('b2R', '▶', 1);
  const cls = (k, on) => document.body.classList.toggle(k, !!on);

  function steer(dir) {
    if (!inSky() || ctx.step < 1 || ctx.step > 3 || S.bounce > 0.6) return;
    const n = Math.max(0, Math.min(2, S.lane + dir)); if (n !== S.lane) { S.lane = n; sfx('whoosh'); }
  }

  // ---- the spot Harry started from (back there when the flight ends) ----
  function saveFrom() {
    const f = { room: interiors.active && interiors.active !== 'b2sky' ? interiors.active : null, x: player.pos.x, z: player.pos.z, yaw: player.yaw };
    if (interiors.active === 'b2sky') return;
    S.from = f; try { localStorage.setItem(FROM_KEY, JSON.stringify(f)); } catch { /* private mode */ }
  }
  function readFrom() {
    if (S.from) return S.from;
    try { const f = JSON.parse(localStorage.getItem(FROM_KEY)); if (f && Number.isFinite(f.x) && Number.isFinite(f.z)) return { room: typeof f.room === 'string' ? f.room : null, x: f.x, z: f.z, yaw: +f.yaw || 0 }; } catch { /* corrupt */ }
    return null;
  }
  function goHome() {
    const f = readFrom(); S.from = null; try { localStorage.removeItem(FROM_KEY); } catch { /* ok */ }
    if (f && f.room && f.room !== 'b2sky') { interiors.enter(f.room, { x: f.x, z: f.z, yaw: f.yaw }); return; }
    if (interiors.active || S.entering) interiors.exit();
    if (f) { player.yaw = f.yaw; player.teleport(f.x, f.z); }
  }
  function enterSky() { S.entering = true; S.reT = 0; interiors.enter('b2sky'); }

  // ---- light + haze for a day sky (saved and given back when the sky scene goes away) ----
  function applyLight() {
    if (S.lit) return;
    const L = { lights: [] };
    for (const o of scene.children) if (o.isAmbientLight || o.isHemisphereLight) L.lights.push({ o, i: o.intensity, c: o.color.getHex(), g: o.groundColor ? o.groundColor.getHex() : null });
    if (scene.fog) L.fog = { c: scene.fog.color.getHex(), d: scene.fog.density };
    S.lit = L;
    for (const { o } of L.lights) { if (o.isHemisphereLight) { o.intensity = 1.05; o.color.setHex(0xd0e4ff); o.groundColor.setHex(0x7a8a5a); } else { o.intensity = 0.95; o.color.setHex(0xfff2e0); } }
    if (scene.fog && scene.fog.density !== undefined) { scene.fog.density = 0.0032; scene.fog.color.setHex(0xc4d8e4); }
  }
  function restoreLight() {
    const L = S.lit; if (!L) return; S.lit = null;
    for (const l of L.lights) { l.o.intensity = l.i; l.o.color.setHex(l.c); if (l.g !== null && l.o.groundColor) l.o.groundColor.setHex(l.g); }
    if (L.fog && scene.fog) { scene.fog.color.setHex(L.fog.c); if (L.fog.d !== undefined) scene.fog.density = L.fog.d; }
  }

  // ---- arriving in the sky / leaving it ----
  const tk = { adv: true, spell: true, update: (dt, axis) => { try { sim(dt, axis); } catch (e) { if (!S.simErr) console.warn('[b2-car] sim failed -', e && e.message || e); S.simErr = (S.simErr || 0) + 1; } } };
  function arrive(step) {
    applyLight(); setup(step, true);
    player.model.visible = false; parkPlayer();
    S.tk = tk; ctx.setTakeover(tk); cls('advSky', true); S.camInit = false;
  }
  function leaveSky() {
    restoreLight();
    if (S.tk) { S.tk = null; try { if (window.__game && window.__game.takeover === tk) ctx.setTakeover(null); } catch { ctx.setTakeover(null); } }
    player.model.visible = true; cls('advSky', false); cls('b2lanes', false);
  }
  function parkPlayer() { player.pos.set(0, FLOOR_Y, 500); player.model.position.copy(player.pos); }   // far behind the camera: no blob shadow, no trail in view

  // ---- per-step dressing (fresh start or a resume) ----
  function setup(step, resumed) {
    const P = S.B.P;
    S.stars = []; S.got = 0; S.spawnT = 1.2; S.ring = null; S.rings = 0; S.ringT = 1.2; S.sw = null; S.swGap = 1.2; S.passed = 0; S.bounce = 0;
    S.landing = 0; S.landed = 0; S.autop = false; S.hop = 0;
    if (step >= 1 && step <= 3 && resumed) { S.lane = 1; S.x = 0; }
    S.approach = step === 3 && !resumed ? 0 : 1;
    P.pad.visible = step === 0;
    P.ground.position.y = step === 0 ? 0 : step <= 2 ? FLY_GROUND : (S.approach < 1 ? FLY_GROUND : LAWN_Y - 0.4);
    P.viaduct.visible = step <= 2 || S.approach < 0.4;
    P.lawnG.visible = step >= 3; P.lawnG.position.z = step >= 3 && S.approach >= 1 ? 0 : -230;
    P.ron.visible = P.harry.visible = step === 0; P.car.kids.visible = step > 0;
    P.ron.position.set(-1.6, 0, -0.8); P.harry.position.set(1.6, 0, -0.6);
    const c = P.car.root; c.position.set(step === 0 ? 0 : LANES[S.lane], 0, 0); c.rotation.set(0, 0, 0); P.car.body.scale.set(1, 1, 1); P.car.body.rotation.set(0, 0, 0); P.car.body.position.set(0, 0, 0);
    if (step === 0) S.x = 0;
    P.land.visible = step === 4; P.hoop.visible = false; for (const s of P.shadows) s.visible = false;
    P.stars.count = 0; P.ring.visible = false;
    P.willow.arm.rotation.x = P.willow.REST_RX; for (const b of P.willow.bundles) b.visible = true;
    cls('b2lanes', step >= 1 && step <= 3);
    initClouds();
  }
  function initClouds() {
    const P = S.B.P; if (P.cl) return;
    P.cl = []; let k = 0;
    for (let i = 0; i < P.NC; i++) {
      let x, y; do { x = (Math.random() * 2 - 1) * 90; y = -22 + Math.random() * 48; k++; } while (Math.abs(x) < 9 && Math.abs(y) < 7 && k < 400);
      P.cl.push({ x, y, z: -300 + Math.random() * 320, w: 16 + Math.random() * 18 });
    }
  }

  // ---- step actions ----
  function startCar() {
    if (ctx.step !== 0 || S.hop || !inSky()) return;
    S.hop = 0.001; sfx('pop'); ctx.say('יאללה! קופצים פנימה! 🚗', '👦 רון', 2.5);
  }
  function collectStar(st) {
    S.got++; ctx.poke(); const p = W(LANES[st.lane], 0.9, 0, v1);
    burst(p.x, p.y, p.z, 0xffd76a, 20, 2.4, 0.9, 0.3, -0.6); sfx('tink', S.got); sfx('sparkle');
    try { fun.toast('⭐', S.got + ' / ' + need(), 900); } catch { /* ok */ }
    if (S.got >= need()) { ctx.say('כל הכוכבים! איזה טייס! ⭐', '👦 רון', 2.5); setTimeout(() => done(1), 700); }
  }
  const need = () => NSTAR[lv()] || 5;
  function startLanding() {
    if (ctx.step !== 4 || S.landing || !inSky()) return;
    S.landing = 0.001; S.from0 = { x: S.x, y: S.y }; sfx('whoosh'); S.B.P.land.visible = false;
  }

  // ---- the simulation (runs inside the takeover, before the frame draws) ----
  function sim(dt, axis) {
    if (!inSky()) return;
    const P = S.B.P, step = ctx.step, L = lv();
    S.t += dt;
    const frozen = ctx.isModal();
    if (!frozen) {
      // steering: the joystick / arrow keys push one lane per push
      const ax = axis ? axis.x : 0, dir = ax > 0.5 ? 1 : ax < -0.5 ? -1 : 0;
      if (dir && dir !== S.axPrev) steer(dir); S.axPrev = dir;
      if (S.autop && step >= 1 && step <= 3) autopilot(step);
      // world speed (a treadmill)
      let spd = 0;
      if (step === 0 && S.hop > 1.2) spd = Math.min(1, (S.hop - 1.2) / 3) * SPEED[L] * 0.6;
      else if (step === 1 || step === 2) spd = SPEED[L];
      else if (step === 3 && S.approach < 1) spd = SPEED[L] * (1 - ease(S.approach) * 0.85);
      P.fT.offset.y += spd * dt / 200; P.aT.offset.x += spd * dt / 14;
      // clouds drift past (and slowly on their own)
      if (P.cl) for (const c of P.cl) { c.z += (spd + 1.2) * dt; if (c.z > 40) c.z -= 340; }
      if (step === 0) stepStart(dt);
      else if (step === 1) stepStars(dt, spd);
      else if (step === 2) stepRings(dt, spd);
      else if (step === 3) stepWillow(dt);
      else if (step === 4) stepLand(dt);
      // the car: lane glide, bob, bank
      const c = P.car.root;
      if (step >= 1 && step <= 3) {
        const tx = LANES[S.lane], vx = (tx - S.x); S.x += vx * Math.min(1, dt * 4);
        let bounceY = 0, wob = 0;
        if (S.bounce > 0) { S.bounce -= dt; const k = S.bounce / 1.2; bounceY = Math.sin((1 - k) * Math.PI * 2) * 0.9 * k; wob = Math.sin(S.t * 22) * 0.25 * k;
          if (Math.random() < dt * 30) { const a = S.t * 8 + Math.random(); emit(G().x + S.x + Math.cos(a) * 1.1, G().y + 1.9, G().z + Math.sin(a) * 1.1, -Math.sin(a) * 1.5, 0.2, Math.cos(a) * 1.5, 0.6, 0.28, 0xffe26a, 0); } }
        S.y = Math.sin(S.t * 1.7) * 0.18 + bounceY;
        c.position.set(S.x, S.y, S.bounce > 0 ? Math.sin((1 - S.bounce / 1.2) * Math.PI) * 1.5 : 0);
        c.rotation.set(0.03 * Math.sin(S.t * 1.3), 0, -vx * 0.14 + wob);
      }
      // the train puffs smoke (steps 1-2)
      if ((step === 1 || step === 2) && P.viaduct.visible) { S.puffT -= dt; if (S.puffT <= 0) { S.puffT = 0.22; chimney(v1); emit(v1.x, v1.y, v1.z, (Math.random() - 0.5) * 0.6, 2.2, 0.8, 2.6, 2.4, 0xe4e2de, 0.25); } }
      // the willow sways a little; the train rocks along
      P.willow.tree.rotation.z = Math.sin(S.t * 0.7) * 0.015;
      P.train.position.z = -40 + Math.sin(S.t * 0.12) * 8;
    }
    placeCamera(dt, step);
    // clouds + dome follow the camera
    if (P.cl) { const im = P.clouds; let i = 0; for (const c of P.cl) { M4.makeScale(c.w, c.w * 0.5, 1); M4.setPosition(c.x, c.y, c.z); im.setMatrixAt(i++, M4); } im.count = i; im.instanceMatrix.needsUpdate = true; }
    P.dome.position.set(camera.position.x - G().x, camera.position.y - G().y, camera.position.z - G().z);
  }
  function chimney(out) { const P = S.B.P; return out.set(P.viaduct.position.x, P.ground.position.y + 10.25 + 3.0, P.train.position.z - 3.8).add(G()); }

  function stepStart(dt) {
    const P = S.B.P, c = P.car.root;
    // the kids wave; a tap on the car starts the hop-in
    const faceCam = (k) => { k.rotation.y = Math.atan2(S.camP.x - G().x - k.position.x, S.camP.z - G().z - k.position.z); };
    if (!S.hop) {
      for (const [k, ph] of [[P.ron, 0], [P.harry, 1.7]]) { faceCam(k); k.position.y = Math.abs(Math.sin(S.t * 2.2 + ph)) * 0.12; }
      c.position.set(0, 0, 0); P.car.body.position.y = Math.sin(S.t * 9) * 0.004;
      return;
    }
    S.hop += dt; const t = S.hop;
    if (t < 1.1) {   // hop: an arc from their spots to the seats, then the heads show in the windows
      for (const [k, sx, z0, x0] of [[P.ron, -0.34, -0.8, -1.6], [P.harry, 0.34, -0.6, 1.6]]) {
        const u = ease(t / 1.0); k.visible = u < 0.98; k.position.set(x0 + (sx - x0) * u, Math.sin(u * Math.PI) * 1.6 + u * 0.2, z0 + (0.25 - z0) * u); k.scale.setScalar(1 - u * 0.4);
      }
      if (t > 0.95) P.car.kids.visible = true;
      return;
    }
    if (!S.putOn) { S.putOn = 1; P.ron.visible = P.harry.visible = false; P.car.kids.visible = true; ctx.say('פוט-פוט-פוט... ממריאים! 🚗💨', '👦 רון', 3); }
    S.putT -= dt; if (S.putT <= 0) { S.putT = 0.6; putput(4, 0.05); }
    const k = ease((t - 1.3) / 3.2);
    P.ground.position.y = FLY_GROUND * k;
    c.position.set(0, Math.sin(t * 3) * 0.1 * k, 0); c.rotation.set(-0.12 * Math.sin(Math.min(1, (t - 1.2)) * Math.PI), 0, 0);
    P.car.body.position.y = Math.sin(t * 40) * 0.02 * (1 - k);
    if (Math.random() < dt * 14) { W(0, 0.4, 2.1, v1); emit(v1.x, v1.y, v1.z, (Math.random() - 0.5) * 0.4, 0.3, 1.2, 1.0, 0.5, 0xd8d8d8, 0.3); }
    if (k > 0.5) P.pad.visible = false;
    if (t > 4.8) { S.x = 0; S.lane = 1; done(0); }
  }
  function stepStars(dt, spd) {
    const P = S.B.P, L = lv();
    S.spawnT -= dt;
    if (S.got < need() && S.spawnT <= 0 && S.stars.length < 3) {
      let lane = Math.floor(Math.random() * 3); if (lane === S.lastLane) lane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
      S.lastLane = lane; S.stars.push({ lane, z: -72, rot: Math.random() * 6 }); S.spawnT = GAP[L];
    }
    for (let i = S.stars.length - 1; i >= 0; i--) {
      const st = S.stars[i], z0 = st.z; st.z += spd * dt; st.rot += dt * 3;
      if (z0 < 0 && st.z >= 0) { if (Math.abs(S.x - LANES[st.lane]) < 1.3 && S.got < need()) { collectStar(st); S.stars.splice(i, 1); continue; } }
      if (st.z > 14) S.stars.splice(i, 1);
      else if (L === 1 && Math.random() < dt * 6) { W(LANES[st.lane] + (Math.random() - 0.5) * 1.2, 0.9 + (Math.random() - 0.5), st.z, v1); emit(v1.x, v1.y, v1.z, 0, 0.3, 0, 0.6, 0.22, 0xffe07a, 0); }
    }
    const im = P.stars; im.count = S.stars.length;
    S.stars.forEach((st, i) => { M4.makeRotationY(st.rot); M4.setPosition(LANES[st.lane], 0.9 + Math.sin(st.rot * 0.7) * 0.15, st.z); im.setMatrixAt(i, M4); });
    im.instanceMatrix.needsUpdate = true;
  }
  function stepRings(dt, spd) {
    const P = S.B.P, rg = P.ring;
    if (!S.ring) {
      rg.visible = false; S.ringT -= dt;
      if (S.ringT <= 0 && S.rings < 3) { let lane = Math.floor(Math.random() * 3); if (lane === S.lastLane) lane = (lane + 1) % 3; S.lastLane = lane; S.ring = { lane, t: 0, z: -58 }; sfx('whoosh'); }
      return;
    }
    const r = S.ring; r.t += dt;
    if (r.t < 2.6) {   // the ring rises out of the chimney and drifts to its lane
      chimney(v1).sub(G()); const k = ease(r.t / 2.6);
      rg.position.set(v1.x + (LANES[r.lane] - v1.x) * k, v1.y + (1.0 - v1.y) * k, v1.z + (r.z - v1.z) * k); rg.scale.setScalar(0.3 + 0.7 * k);
    } else {
      const z0 = rg.position.z; rg.position.z += spd * 0.8 * dt; rg.position.x = LANES[r.lane]; rg.scale.setScalar(1 + Math.sin(S.t * 3) * 0.04);
      if (z0 < 0 && rg.position.z >= 0) {
        if (Math.abs(S.x - LANES[r.lane]) < 1.25) {
          S.rings++; ctx.poke(); W(rg.position.x, 1.0, 0, v1); burst(v1.x, v1.y, v1.z, 0xffffff, 22, 2.6, 0.9, 0.35, -0.2); sfx('sparkle'); sfx('whoosh');
          try { fun.toast('💨', S.rings + ' / 3', 900); } catch { /* ok */ }
          if (S.rings >= 3) { ctx.say('שלוש טבעות! וואו! 💨', '👦 רון', 2.5); setTimeout(() => done(2), 700); }
        } else ctx.say('פספסנו... עוד טבעת מגיעה! 💨', '👦 רון', 2);
      }
      if (rg.position.z > 10) { S.ring = null; S.ringT = 0.8; }
    }
    rg.visible = !!S.ring; rg.rotation.set(0, 0, S.t * 0.4);
    if (S.ring && Math.random() < dt * 8) { W(rg.position.x + (Math.random() - 0.5) * 3, rg.position.y + (Math.random() - 0.5) * 3, rg.position.z, v1); emit(v1.x, v1.y, v1.z, 0, 0.4, 0, 1.0, 0.8, 0xe8e6e2, 0.1); }
  }
  function stepWillow(dt) {
    const P = S.B.P, Wl = P.willow, L = lv();
    if (S.approach < 1) {   // fly in: the fields rise to the lawn, the willow and the castle slide in
      S.approach = Math.min(1, S.approach + dt / 5); const k = ease(S.approach);
      P.lawnG.visible = true; P.lawnG.position.z = -230 * (1 - k);
      P.ground.position.y = FLY_GROUND + (LAWN_Y - 0.4 - FLY_GROUND) * k; P.viaduct.visible = S.approach < 0.4;
      if (S.approach >= 1) { ctx.say('אוי... הערבה המפליקה! היא מניפה ענפים. עבור לנתיב הבטוח! 🌳', '👦 רון', 4); S.swGap = 1.6; }
      return;
    }
    if (!S.sw) {
      S.swGap -= dt; Wl.arm.rotation.x += (Wl.REST_RX - Wl.arm.rotation.x) * Math.min(1, dt * 2);
      if (S.swGap <= 0 && S.passed < 3) { const safe = S.nextSafe !== undefined ? S.nextSafe : pickSafe(); S.nextSafe = undefined; S.sw = { safe, t: 0, ph: 'tele', hit: false }; Wl.bundles.forEach((b, i) => { b.visible = i !== safe; }); sfx('whoosh'); }
      for (const s of P.shadows) s.visible = false; P.hoop.visible = false;
      return;
    }
    const sw = S.sw; sw.t += dt; const TL = TELE[L];
    const showHoop = sw.ph !== 'up' && (sw.t >= SHOW[L] || S.glowHint);
    P.hoop.visible = showHoop && sw.ph === 'tele'; if (P.hoop.visible) { P.hoop.position.set(LANES[sw.safe], 0.9, -1.2); P.hoop.rotation.z = S.t; P.hoop.material.opacity = 0.6 + Math.sin(S.t * 6) * 0.25; if (L === 1 && Math.random() < dt * 10) { W(LANES[sw.safe] + (Math.random() - 0.5) * 2.4, 0.9 + (Math.random() - 0.5) * 2.4, -1.2, v1); emit(v1.x, v1.y, v1.z, 0, 0.3, 0.5, 0.8, 0.25, 0x9cffa0, 0); } }
    P.shadows.forEach((s, i) => { s.visible = i !== sw.safe && sw.ph !== 'up'; s.material.opacity = sw.ph === 'tele' ? Math.min(0.8, sw.t / TL) : 0.85; });
    if (sw.ph === 'tele') {   // wind-up: the arm lifts a little further back and trembles
      Wl.arm.rotation.x = Wl.REST_RX - 0.18 * ease(sw.t / TL) + Math.sin(S.t * 18) * 0.02 * (sw.t / TL);
      if (sw.t >= TL) { sw.ph = 'slam'; sw.t = 0; sfx('whoosh'); }
    } else if (sw.ph === 'slam') {
      const k = Math.min(1, sw.t / 0.55), e = k * k; Wl.arm.rotation.x = (Wl.REST_RX - 0.18) + (Wl.SLAM_RX - Wl.REST_RX + 0.18) * e;
      if (k >= 1) {
        sw.ph = 'hold'; sw.t = 0;
        let li = 0; for (let i = 1; i < 3; i++) if (Math.abs(S.x - LANES[i]) < Math.abs(S.x - LANES[li])) li = i;
        if (li !== sw.safe) { sw.hit = true; S.bounce = 1.2; S.bounces++; sfx('boing'); setTimeout(() => sfx('boing'), 200); ctx.oops('אופס! 😄 בום רך! בוא ננסה שוב - לנתיב הבטוח'); S.nextSafe = sw.safe; }
        else { S.passed++; ctx.poke(); sfx('sparkle'); W(S.x, 1.4, 0, v1); burst(v1.x, v1.y, v1.z, 0x9cffa0, 18, 2.2, 0.9, 0.28, -0.4); try { fun.toast('🌳', S.passed + ' / 3', 900); } catch { /* ok */ } if (S.passed < 3) ctx.say('ווש! עברנו! 💨', '👦 רון', 1.8); }
      }
    } else if (sw.ph === 'hold') { Wl.arm.rotation.x = Wl.SLAM_RX + Math.sin(sw.t * 20) * 0.03 * (1 - sw.t / 0.5); if (sw.t > 0.5) { sw.ph = 'up'; sw.t = 0; } }
    else if (sw.ph === 'up') {
      Wl.arm.rotation.x = Wl.SLAM_RX + (Wl.REST_RX - Wl.SLAM_RX) * ease(sw.t / 1.4);
      if (sw.t > 1.4) { S.sw = null; S.swGap = 1.0; if (S.passed >= 3) { ctx.say('עברנו את הערבה! עכשיו נוחתים 🛬', '👦 רון', 2.5); setTimeout(() => done(3), 500); } }
    }
  }
  function pickSafe() { let s = Math.floor(Math.random() * 3); if (s === S.lastSafe) s = (s + 1 + Math.floor(Math.random() * 2)) % 3; S.lastSafe = s; return s; }
  function autopilot(step) {
    let want = S.lane;
    if (step === 1) { const n = S.stars.filter(s => s.z < 0).sort((a, b) => b.z - a.z)[0]; if (n) want = n.lane; else if (S.got < need()) S.spawnT = Math.min(S.spawnT, 0.6); }
    else if (step === 2 && S.ring) want = S.ring.lane;
    else if (step === 3 && S.sw) want = S.sw.safe;
    S.lane = want;
  }
  function stepLand(dt) {
    const P = S.B.P, c = P.car.root, Wl = P.willow;
    if (!S.landing) {
      c.position.set(S.x, Math.sin(S.t * 1.7) * 0.18, 0); c.rotation.set(0, 0, 0);
      P.land.material.opacity = 0.7 + Math.sin(S.t * 4) * 0.3; P.land.scale.setScalar(1 + Math.sin(S.t * 4) * 0.06);
      Wl.arm.rotation.x += (Wl.REST_RX - Wl.arm.rotation.x) * Math.min(1, dt * 2);
      return;
    }
    S.landing += dt; const t = S.landing, k = ease(t / 2.6), f = S.from0 || { x: 0, y: 0 };
    if (t < 2.6) { c.position.set(f.x + (LAND.x - f.x) * k, f.y + (LAWN_Y - f.y) * k + Math.sin(k * Math.PI) * 1.2, LAND.z * k); c.rotation.set(0, Math.PI * k, -Math.sin(k * Math.PI) * 0.15); }
    else {
      if (!S.landed) { S.landed = 1; sfx('boing'); W(LAND.x, LAWN_Y + 0.2, LAND.z, v1); burst(v1.x, v1.y, v1.z, 0xc8e8a0, 22, 2.4, 1.0, 0.3, -1.2); setTimeout(honk, 450); }
      const sq = Math.max(0, 1 - (t - 2.6) * 3); c.position.set(LAND.x, LAWN_Y, LAND.z); c.rotation.set(0, Math.PI, 0); P.car.body.scale.set(1 + sq * 0.08, 1 - sq * 0.12, 1 + sq * 0.05);
      Wl.arm.rotation.x = Wl.REST_RX + 0.25 + Math.sin(t * 3.2) * 0.3; Wl.root.rotation.z = Math.sin(t * 2) * 0.03;   // the willow waves
      if (t > 3.4 && !S.saidLand) { S.saidLand = 1; ctx.say('נחתנו בהוגוורטס! 😄 תראה, הערבה מנופפת לנו!', '👦 רון', 5); sfx('heart'); }
      if (t > 6.6) done(4);
    }
  }

  // ---- the camera (our own takeover camera; distance grows on a narrow phone so all three lanes fit) ----
  function placeCamera(dt, step) {
    const P = S.B.P, g = G(), aspect = innerWidth / Math.max(1, innerHeight), vf = camera.fov * Math.PI / 180;
    const hh = Math.atan(Math.tan(vf / 2) * aspect), dFor = (half, lo, hi) => Math.max(lo, Math.min(hi, half / Math.tan(hh)));
    let px, py, pz, lx, ly, lz;
    if (step === 0) { const d = dFor(3.8, 6.5, 22); px = -d * 0.5; py = 1.8 + d * 0.16; pz = -d * 0.85; lx = 0; ly = 0.8; lz = 0; }
    else if (step === 4) {
      const d = dFor(5.2, 9, 26);
      if (S.landing > 0) { px = LAND.x * 0.6; py = LAWN_Y + 2.6 + d * 0.12; pz = LAND.z + d * 0.95; lx = LAND.x * 0.4; ly = LAWN_Y + 2.4; lz = -8; }
      else { px = S.x * 0.4 + 1; py = 2.4 + d * 0.25; pz = d; lx = LAND.x * 0.6; ly = LAWN_Y + 1; lz = LAND.z - 2; }
    } else if (step === 3) { const d = dFor(5.0, 8.5, 26); px = S.x * 0.3; py = 2.2 + d * 0.24; pz = d + 1; lx = 0; ly = 1.8; lz = -10; }
    else { const d = dFor(4.8, 7.5, 26); px = S.x * 0.4; py = S.y + 1.6 + d * 0.22; pz = d; lx = S.x * 0.25; ly = S.y + 0.3; lz = -12; }
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
      S.B = interiors.active === 'b2sky' && r && r.group ? r.group.userData.adv : null;
      if (S.B) { S.entering = false; arrive(step); } else if (was) leaveSky();
    }
    // the flight is on rails: if anything took Harry out of the sky mid-quest, fly him back (the step restarts)
    if (S.active && !S.B && !S.entering && !S.ended) { S.reT += dt; if (S.reT > 1.2 && !ctx.isModal()) enterSky(); }
    if (S.B) { cls('b2lanes', step >= 1 && step <= 3 && !ctx.isModal()); parkPlayer(); }
  }
  function begin(step, resumed) {
    S.active = true;
    if (step === 0 && !resumed) saveFrom();
    else if (!readFrom() && interiors.active !== 'b2sky') saveFrom();
    if (!inSky()) { if (!S.entering) enterSky(); return; }
    setup(step, resumed);
    if (step === 1) ctx.say('יוהו! אנחנו עפים! אסוף את כוכבי הזהב! ⭐', '👦 רון', 3.5);
    if (step === 2) ctx.say('הנה הרכבת להוגוורטס! עוף דרך טבעות העשן 💨', '👦 רון', 3.5);
    if (step === 4) ctx.say('עכשיו נוחתים... גע בעיגול הזוהר על הדשא 🛬', '👦 רון', 3.5);
  }
  function goal(step, out) {
    if (!inSky()) return null;
    const P = S.B.P;
    if (step === 0) return S.hop ? null : W(0, 0.5, 0, out);
    if (step === 1) { const n = S.stars.filter(s => s.z < -1).sort((a, b) => b.z - a.z)[0]; return n ? W(LANES[n.lane], 0.5, n.z, out) : null; }
    if (step === 2) return S.ring && S.ring.t >= 2.6 ? W(P.ring.position.x, 1.4, P.ring.position.z, out) : null;
    if (step === 3) return S.sw && P.hoop.visible ? W(LANES[S.sw.safe], 1.2, -1.2, out) : null;
    if (step === 4) return S.landing ? null : W(LAND.x, LAWN_Y, LAND.z, out);
    return null;
  }
  function tap(x, y, step) {
    if (!inSky()) return false;
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (step === 0) { if (S.hop) return true; if (near(W(0, 0.8, 0, v1)) < R() * 2.6) { startCar(); return true; } ctx.say('גע במכונית הכחולה 🚗', '👦 רון', 2); return true; }
    if (step >= 1 && step <= 3) { steer(x < innerWidth / 2 ? -1 : 1); return true; }
    if (step === 4) { if (S.landing) return true; if (near(W(LAND.x, LAWN_Y, LAND.z, v1)) < R() * 2.4) { startLanding(); return true; } ctx.say('גע בעיגול הזוהר על הדשא 🛬', '👦 רון', 2); return true; }
    return false;
  }
  function glow(step, on) { S.glowHint = !!on; }
  function together(step, fast) {
    if (!inSky()) { if (fast) done(step); return; }
    if (step === 0) { startCar(); if (fast) S.hop = Math.max(S.hop, 4.7); }
    else if (step === 4) { startLanding(); if (fast) S.landing = Math.max(S.landing, 6.5); }
    else if (fast) { if (step === 3) S.approach = 1; done(step); }
    else S.autop = true;
  }
  function end() {
    S.ended = true; S.active = false;
    const wasIn = interiors.active === 'b2sky' || S.entering;
    leaveSky(); S.B = null; S.lastRoom = null;
    if (wasIn) goHome(); else { S.from = null; try { localStorage.removeItem(FROM_KEY); } catch { /* ok */ } }
    S.entering = false;
    try { bL.remove(); bR.remove(); css.remove(); } catch { /* ok */ }
  }
  function state() {
    const P = S.B && S.B.P;
    return { room: interiors.active, sky: inSky(), lane: S.lane, x: +S.x.toFixed(2), hop: S.hop > 0, got: S.got, need: need(), stars: S.stars.length, rings: S.rings, ring: S.ring ? { lane: S.ring.lane, z: P ? +P.ring.position.z.toFixed(1) : null } : null,
      approach: S.approach, sweep: S.sw ? { safe: S.sw.safe, ph: S.sw.ph, hoop: !!(P && P.hoop.visible) } : null, passed: S.passed, bounces: S.bounces, landing: S.landing > 0, landed: !!S.landed,
      takeover: !!S.tk, lanes: document.body.classList.contains('b2lanes'), from: readFrom(), autop: S.autop,
      tris: S.B ? triCount(S.B.g) : null, carTris: P ? triCount(P.car.root) : null };
  }
  ctx._car = {
    carW: () => (S.B ? W(S.B.P.car.root.position.x, S.B.P.car.root.position.y + 0.8, S.B.P.car.root.position.z) : null),
    landW: () => (S.B ? W(LAND.x, LAWN_Y, LAND.z) : null),
    safe: () => (S.sw ? S.sw.safe : null), phase: () => (S.sw ? S.sw.ph : null),
    nextLane: () => { if (ctx.step === 1) { const n = S.stars.filter(s => s.z < 0).sort((a, b) => b.z - a.z)[0]; return n ? n.lane : null; } if (ctx.step === 2) return S.ring ? S.ring.lane : null; return S.sw ? S.sw.safe : null; },
  };
  return { begin, update, goal, tap, glow, together, end, state };
}
