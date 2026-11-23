// Book adventure 1: "אבן החכמים" (the Philosopher's Stone chambers) + the chapter stubs 2-5 ("בקרוב").
// Data for adventures.js + the scene code. Reached by the PERMANENT door "המסדרון האסור / קומה שלישית" in the
// moving-staircase hall (south wall, x -6); it leads into the chambers interior (adventure-stone-build.js).
// One interior, two states: while quest 1 runs (CORRIDOR.quest) it is built in the quest's scripted state from the
// step; otherwise (never started, paused, finished) it is built for free play and corridor-free.js drives it.
// Steps: 1 Fluffy (play the harp: tap it / any spell on it / the 🎵 prompt) -> 2 Devil's Snare (Lumos or Incendio via
// the spell wheel) -> 3 flying keys (tap the big silver key with the bent blue wing) -> 4 chess (tap the lit square)
// -> 5 potions (tap the bottle of the colour in the riddle) -> 6 the Mirror of Erised (walk up and look).
// Kid-safe: Fluffy only sleeps, the snare only shrinks from the light, no piece is smashed, no villain, no fail.
import { Vector3, Group, Mesh, PlaneGeometry, BoxGeometry, TorusGeometry, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, Object3D, Raycaster, Plane, Vector2 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDERS } from './rooms.js';
import { MAT } from './interior-kit.js';
import { TROLL } from './adventure-troll.js';
import { buildChambers, drawMirror, SPOTS, DOOR_Z, zc, sq, BOARD, COLOURS, FLOOR_Y, FONT, N } from './adventure-stone-build.js';

const HERM = { ico: '👧', name: 'הרמיוני' };
export const QUESTS = [
  {
    id: 'stone', title: 'אבן החכמים', ico: '💎', gem: '#d8202a', confetti: ['✨', '⭐', '❤️', '📖'], col: '#5a1a2a', col2: '#c0503a', helper: HERM,
    pic: [['🐶', 0.22, 0.62, 46], ['🔑', 0.5, 0.3, 34], ['♟️', 0.78, 0.62, 40], ['💎', 0.5, 0.66, 52]],
    intro: [
      'מישהו רוצה לגנוב את אבן החכמים!',
      'האבן מוסתרת מתחת לטירה, מאחורי שבעה... טוב, שישה חדרים קסומים.',
      'בוא נמצא אותה לפני כולם. אני אעזור לך! ✨',
    ],
    steps: [
      { line: 'נגן בנבל כדי שפלאפי ימשיך לישון 🎵', hints: ['פלאפי אוהב מוזיקה. גע בנבל הזהב 🎵', 'הנבל זוהר ליד הקיר. גע בו!', 'לך אל הנבל וגע בו 🎵'], glowL1: true },
      { line: 'הטל לומוס על הצמח כדי שיזוז 💡', hints: ['צמח השטן לא אוהב אור! 💡', 'בחר לומוס בגלגל הלחשים ואז נופף בשרביט', 'הלחש הזוהר בגלגל: לומוס 💡'], spell: 'lumos' },
      { line: 'תפוס את המפתח הכסוף עם הכנף הכחולה 🔑', hints: ['חפש מפתח גדול עם כנף כחולה עקומה 🔑', 'המפתח הנכון זוהר! גע בו', 'גע במפתח הגדול עם הכנף הכחולה'], glowL1: true },
      { line: 'גע במשבצת הזוהרת כדי לנצח בשחמט ♟️', hints: ['הפרש שלנו יכול לקפוץ למשבצת הזוהרת ♟️', 'גע במשבצת הצהובה על הלוח', 'המשבצת הזוהרת היא המהלך המנצח!'] },
      { line: 'מצא את הבקבוק הנכון 🧪', hints: ['קרא את החידה וחפש את הצבע 🧪', 'הבקבוק הנכון זוהר עכשיו', 'גע בבקבוק הזוהר'] },
      { line: 'לך אל המראה והבט בה 🪞', hints: ['המראה הגדולה מחכה לך 🪞', 'עמוד ממש מול המראה', 'לך אל החץ הזהוב מול המראה'], glowL1: true },
    ],
    create: (ctx) => stoneScene(ctx),
  },
  TROLL,
  { id: 'norbert', title: 'נורברט הדרקון הקטן', ico: '🐉', soon: true, col: '#5a2a10', col2: '#d8803a', pic: [['🐉', 0.5, 0.55, 74], ['🏡', 0.2, 0.3, 30]] },
  { id: 'chamber', title: 'חדר הסודות', ico: '🐦‍🔥', soon: true, col: '#2a2a4a', col2: '#6a6ab0', pic: [['🔥', 0.5, 0.55, 66], ['💡', 0.2, 0.3, 30]] },
  { id: 'buckbeak', title: 'קידה לאבזם', ico: '🦅', soon: true, col: '#3a3a2a', col2: '#a0a070', pic: [['🦅', 0.5, 0.55, 72], ['🙇', 0.8, 0.3, 30]] },
];

// The chambers interior: always registered (built from the quest's progress at build time, or for free play).
let PROGRESS = 0;
export const CORRIDOR = { quest: false };   // true while quest 1 runs (begin .. end)
BUILDERS.chambers = () => {
  const free = !CORRIDOR.quest;
  const B = buildChambers(free ? 0 : PROGRESS, { free });
  const g = B.g; g.position.y = FLOOR_Y;
  const portals = [{ x: 0, z: 7.7, r: 0.9, to: 'staircase', at: { x: -6, z: 7.8, yaw: Math.PI } }];
  for (const p of portals) p.armed = false;
  g.userData.adv = B;
  return { group: g, colliders: B.cols, portals, spawn: { x: 0, z: 4.6, y: FLOOR_Y, yaw: Math.PI }, update(dt, t) { B.light.update(t); } };
};
const STAIR_DOOR = { x: -6, z: 10.5 };
// The door in the staircase hall: part of the hall itself (added to every build), so it is there in free play too.
function stairDoor(r) {
  if (!r || !r.group || r.group.userData.advDoor) return;
  const g = new Group(); g.name = 'adv-stair-door';
  const D = STAIR_DOOR, z = D.z - 0.02;
  const stone = mergeGeometries([new BoxGeometry(0.3, 2.8, 0.3).translate(D.x - 1.0, 1.4, z - 0.1), new BoxGeometry(0.3, 2.8, 0.3).translate(D.x + 1.0, 1.4, z - 0.1),
    new TorusGeometry(1.0, 0.15, 6, 16, Math.PI).translate(D.x, 2.8, z - 0.1)].map(x => x.toNonIndexed()), false);
  g.add(new Mesh(stone, MAT.stone));
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 320, 0, 80); gr.addColorStop(0, '#ffd08a'); gr.addColorStop(0.6, '#c06a2a'); gr.addColorStop(1, '#4a2410'); x.fillStyle = gr; x.fillRect(0, 80, 256, 240);
  x.fillStyle = '#2a1608'; x.fillRect(0, 0, 256, 80); x.fillStyle = '#c9a046'; x.fillRect(4, 4, 248, 72); x.fillStyle = '#3a2414'; x.fillRect(9, 9, 238, 62);
  x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 30px ' + FONT; x.fillStyle = '#ffe9a8'; x.fillText('המסדרון האסור', 128, 30);
  x.font = 'bold 19px ' + FONT; x.fillStyle = '#e8c070'; x.fillText('קומה שלישית', 128, 57);
  x.font = '60px serif'; x.fillText('🐾', 128, 210);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  g.add(new Mesh(new PlaneGeometry(2.0, 3.6).rotateY(Math.PI).translate(D.x, 1.8 + 0.25, z - 0.26), new MeshBasicMaterial({ map: t })));
  r.group.add(g); r.group.userData.advDoor = g;
  r.portals.push({ x: D.x, z: D.z - 0.95, r: 0.95, to: 'chambers', at: { x: 0, z: 4.6, yaw: Math.PI }, armed: false });
}
const baseStair = BUILDERS.staircase;
if (baseStair) BUILDERS.staircase = (...a) => {
  const r = baseStair(...a), add = (x) => { try { stairDoor(x); } catch (e) { console.warn('[corridor] door skipped -', e && e.message || e); } return x; };
  return r && typeof r.then === 'function' ? r.then(add) : add(r);
};

function stoneScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit, camera } = ctx;
  const S = { harp: 0, snare: 0, key: 0, chess: 0, potion: 0, mirror: 0, hop: 0, look: 0, answer: 4, distract: [], wrong: 0, dark: [], casts0: 0, lastRoom: null, B: null, stair: null, played: false, hopT: -1 };
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0) => sfx('tone', f, d, 'triangle', 0.12, w);
  const lv = () => ctx.level;
  // the riddle colour (never purple: the flames are purple); level 2-3 add distractor squares on the board
  S.answer = [0, 1, 2, 3, 4, 6][Math.floor(Math.random() * 6)];
  const inCh = () => interiors.active === 'chambers' && S.B;
  const Y = () => FLOOR_Y;
  const room = () => Math.max(0, Math.min(N - 1, Math.round(-player.pos.z / 10)));
  const W = (x, y, z, out = new Vector3()) => out.set(x, Y() + y, z);
  const FI = freecast && freecast._internal;
  const scr = { x: 0, y: 0, on: false };
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);

  // ---- spells: Incendio / any charm on the harp; the snare takes Lumos (watched below) and Incendio (a target) ----
  const T = [];
  if (FI && Array.isArray(FI.TARGETS)) {
    T.push({ id: 'adv-harp', spells: ['leviosa', 'accio', 'alohomora', 'reparo', 'tarantallegra', 'engorgio', 'orchideous', 'rictusempra', 'avis', 'incendio'], at: (o) => W(SPOTS.harp.x, 1.2, SPOTS.harp.z, o),
      ok: () => inCh() && ctx.step === 0 && !S.played, cast: () => { S.castHit = true; playHarp(); } });
    T.push({ id: 'adv-snare', spells: ['incendio'], at: (o) => W(SPOTS.snare.x, SPOTS.snare.y, SPOTS.snare.z, o), ok: () => inCh() && ctx.step === 1 && !S.snare && room() === 1, cast: () => { S.castHit = true; clearSnare(); } });
    for (const t of T) FI.TARGETS.push(t);
  }
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();

  // ---- step actions ----
  function playHarp() {
    if (S.played) return; S.played = true; S.harp = 0.001;
    [523, 659, 784, 1047, 784, 659, 523, 392].forEach((f, i) => tone(f, 0.5, i * 0.28));
    ctx.say('הנבל מנגן... פלאפי ישן עמוק 💤', null, 3);
    ctx.done(0);
    S.hopT = 2.6;
  }
  function hopDown() {   // a short takeover: Harry walks to the trapdoor, hops in, lands softly on the leaves
    if (S.hop) return; S.hop = 0.001;
    const start = { x: player.pos.x, z: player.pos.z };
    let t = 0, landed = false;
    ctx.setTakeover({ spell: true, update(dt) {
      t += dt; const tp = SPOTS.trap;
      if (t < 0.8) { const k = t / 0.8; place(start.x + (tp.x - start.x) * k, 0, start.z + (tp.z + 0.1 - start.z) * k, Math.atan2(tp.x - start.x, tp.z - start.z), true); }
      else if (t < 1.3) { const k = (t - 0.8) / 0.5; place(tp.x, -k * 1.8 + Math.sin(k * Math.PI) * 0.6, tp.z, player.yaw, false); }
      else if (!landed) { landed = true; player.yaw = Math.PI; player.teleport(SPOTS.land.x, SPOTS.land.z); burst(player.pos.x, Y() + 0.5, player.pos.z, 0x6ac850, 22, 2.2, 1.0, 0.24, -1.5); sfx('boing'); ctx.say('וואו, נחיתה רכה על העלים! 🌿', null, 2.6); }
      else if (t > 1.6) { S.hop = 0; ctx.setTakeover(null); }
      player.animate(dt, { moving: t < 0.8 }, 1.4);
      player.cam.update(dt, player.pos, player.yaw, false);
    } });
  }
  function place(x, y, z, yaw, walk) { player.pos.set(x, Y() + y, z); player.smoothY = Y() + y; player.yaw = yaw; player.model.position.copy(player.pos); player.model.rotation.y = yaw; }
  function clearSnare() {
    if (S.snare) return; S.snare = 0.001;
    burst(player.pos.x, Y() + 1.5, player.pos.z, 0xfff0b0, 30, 3, 1.2, 0.3, -0.3);
    W(SPOTS.snare.x, SPOTS.snare.y, SPOTS.snare.z, v1); burst(v1.x, v1.y, v1.z, 0xfff6c8, 26, 2.4, 1.2, 0.28, -0.4);
    sfx('sparkle'); ctx.say('הצמח בורח מהאור! הדרך פתוחה ✨', null, 3);
    ctx.done(1);
  }
  function catchKey() { if (S.key) return; S.key = 0.001; sfx('chime'); ctx.say('תפסת אותו! המפתח עף אל המנעול! 🔑', null, 3); }
  function chessMove() { if (S.chess) return; S.chess = 0.001; sfx('drum'); }
  function pickBottle() { if (S.potion) return; S.potion = 0.001; sfx('sparkle'); ctx.say('גלוּם... הלהבות נפתחות! 💜', null, 3); }
  function lookMirror() {
    if (S.look) return; S.look = 0.001;
    let t = 0, flew = false;
    const focus = new Vector3();
    ctx.setTakeover({ spell: true, update(dt) {
      t += dt; S.look = t;
      place(SPOTS.look.x, 0, SPOTS.look.z, Math.PI, false);
      const c = player.cam; c.yaw = 0.35; c.pitch = 0.12; c.dist = 3.6; c.userControlled = false; c.idle = 0;
      focus.set(0, Y(), SPOTS.look.z - 0.8); c.update(dt, focus, 0, false);
      player.animate(dt, { moving: false }, 0);
      const st = S.B && S.B.P.mirror.stone;
      if (st && t > 2.2 && !flew) { flew = true; st.visible = true; sfx('chime'); }
      if (st && flew) {
        const k = Math.min(1, (t - 2.2) / 1.6);
        st.position.set(SPOTS.mirror.x + (player.pos.x - SPOTS.mirror.x) * k, 1.4 + Math.sin(k * Math.PI) * 0.6 + (1.0 - 1.4) * k, SPOTS.mirror.z + 0.2 + (player.pos.z + 0.3 - SPOTS.mirror.z - 0.2) * k);
        st.rotation.y += dt * 4; if (Math.random() < dt * 20) { st.getWorldPosition(v1); emit(v1.x, v1.y, v1.z, 0, 0.3, 0, 0.6, 0.18, 0xff6070, 0); }
        if (k >= 1 && st.visible) { st.visible = false; burst(player.pos.x, Y() + 1.1, player.pos.z, 0xff4050, 24, 2, 1.0, 0.24, -1); sfx('tada'); }
      }
      if (t > 4.2 && !S.mirror) { S.mirror = 1; ctx.say('כל הכבוד, הארי. האבן בטוחה איתך! 💎', '🧙‍♂️ דמבלדור', 5); ctx.setTakeover(null); ctx.done(5); }
    } });
  }
  const v1 = new Vector3(), v2 = new Vector3();

  // ---- per frame ----
  let tt = 0;
  function update(dt, step) {
    tt += dt;
    const r = interiors.room;
    if (r !== S.lastRoom) {   // a room arrived
      S.lastRoom = r; S.B = interiors.active === 'chambers' && r && r.group ? r.group.userData.adv : null;
    }
    // casts: Lumos in the snare room clears it; another spell there gets a gentle word
    const n = casts();
    if (n !== S.casts0) {
      S.casts0 = n; const k = freecast && freecast.selected ? freecast.selected() : null, hit = S.castHit; S.castHit = false;
      if (inCh() && step === 1 && room() === 1 && !S.snare) { if (k === 'lumos' || k === 'incendio' || k === 'maxima') clearSnare(); else ctx.oops('הצמח אוהב חושך... נסה לחש של אור! 💡'); }
      else if (inCh() && step === 0 && room() === 0 && !hit && !S.played) ctx.say('נסה לנגן בנבל 🎵 גע בו!', null, 3);
    }
    if (!S.B) return;
    const B = S.B, P = B.P, cur = room();
    for (let i = 0; i < N; i++) B.rooms[i].visible = Math.abs(i - cur) <= 1;
    // Fluffy breathes and snores (one head at a time), Z's float up
    const f = P.fluffy, br = Math.sin(tt * 1.3);
    f.body.scale.set(1, 1 + br * 0.035, 1 + br * 0.015);
    f.heads.forEach((h, i) => { const ph = Math.sin(tt * 1.3 + i * 2.1); h.position.y = h.userData.base.y + ph * 0.04; h.rotation.x = h.userData.base.rx + ph * 0.04; });
    if (B.rooms[0].visible) {
      const d = new Object3D();
      for (let k = 0; k < 6; k++) { const u = ((tt * 0.35 + k / 6) % 1), hx = f.heads[k % 3]; hx.getWorldPosition(v1); v1.y -= Y(); d.position.set(v1.x + u * 0.5 + Math.sin(u * 6 + k) * 0.15, v1.y + 0.4 + u * 1.4, v1.z + 0.2); d.quaternion.copy(camera.quaternion); d.scale.setScalar(0.5 + u * 0.9 * (1 - u)); d.updateMatrix(); P.zs.setMatrixAt(k, d.matrix); }
      P.zs.instanceMatrix.needsUpdate = true;
    }
    // harp: strings shimmer while it plays; the trapdoor opens
    if (S.harp > 0) { S.harp += dt; P.harp.strings.material.color.setHSL(0.13, 1, 0.75 + Math.sin(tt * 30) * 0.2); if (Math.random() < dt * 10) { P.harp.g.getWorldPosition(v1); emit(v1.x + (Math.random() - 0.5) * 0.6, v1.y + 1.4, v1.z, (Math.random() - 0.5) * 0.4, 0.6, 0, 1.4, 0.2, 0xffe070, 0); } if (S.harp > 4) { S.harp = 0; P.harp.strings.material.color.setHex(0xfff2c0); } }
    const lid = P.trap.pivot; const lidWant = step >= 1 || S.played ? -1.9 : 0; lid.rotation.x += (lidWant - lid.rotation.x) * Math.min(1, dt * 3);
    if (S.hopT > 0) { S.hopT -= dt; if (S.hopT <= 0 && cur === 0 && !ctx.isModal() && !ctx.isTakeover()) hopDown(); else if (S.hopT <= 0 && (ctx.isModal() || ctx.isTakeover())) S.hopT = 0.5; }
    if (step >= 1 && cur === 0 && !S.hop && !ctx.isTakeover() && Math.hypot(player.pos.x - SPOTS.trap.x, player.pos.z - SPOTS.trap.z) < 0.75) hopDown();
    if (step === 0 && cur === 0 && !S.played && Math.hypot(player.pos.x - SPOTS.harp.x, player.pos.z - SPOTS.harp.z) < 2.2) fun.offer('adv-harp', '🎵', 1, playHarp);
    // snare: the curtain shrinks up into the lintel, the room vines pull back
    const cg = P.snare.curtain;
    if (S.snare > 0 || step >= 2) { cg.scale.y += (0.06 - cg.scale.y) * Math.min(1, dt * 2); cg.position.y = 3.2 * (1 - cg.scale.y); P.snare.room.scale.y += (0.7 - P.snare.room.scale.y) * Math.min(1, dt * 2); }
    else { cg.scale.y = 1 + Math.sin(tt * 1.2) * 0.02; cg.position.y = 0; }
    setBarrier(1, step >= 2 || cg.scale.y < 0.3);
    // keys fly; the special key is slower and lower; caught: it flies to the lock and the door swings
    const K = P.keys;
    if (B.rooms[2].visible) {
      const d = new Object3D(), Z2 = zc(2), sp = lv() === 1 ? 0.6 : 0.85, ks = innerWidth <= 560 ? 1.3 : 1;   // phones: keys 30% bigger
      for (let k = 0; k < K.NK; k++) {
        const a = tt * (0.25 + (k % 4) * 0.05) * sp + k * 0.57;
        d.position.set(Math.sin(a * 1.3 + k) * 3.2, 1.6 + Math.sin(a * 2.1 + k * 0.7) * 1.2, Z2 + Math.cos(a + k * 0.3) * 3.0); d.rotation.set(0, a * 2 + k, Math.sin(a * 3) * 0.3); d.scale.setScalar(ks); d.updateMatrix();
        K.keys.setMatrixAt(k, d.matrix); d.scale.set(ks, ks * (1 + Math.sin(tt * 18 + k) * 0.5), ks); d.updateMatrix(); K.wings.setMatrixAt(k, d.matrix);
      }
      K.keys.instanceMatrix.needsUpdate = true; K.wings.instanceMatrix.needsUpdate = true;
      if (!S.key && step <= 2) { const a = tt * 0.3 * sp; K.sk.position.set(Math.sin(a) * 2.2, 1.5 + Math.sin(a * 1.7) * 0.35, Z2 + 0.8 + Math.cos(a * 0.8) * 1.6); K.sk.rotation.set(0, a * 2.5, Math.sin(tt * 2) * 0.2); K.sk.children[1].scale.y = 1 + Math.sin(tt * 14) * 0.4; K.sk.scale.setScalar(ks); }
      else if (S.key > 0) {
        S.key += dt; const L = SPOTS.lock, k = Math.min(1, S.key / 1.4);
        K.sk.position.lerp(v1.set(L.x, L.y, L.z + 0.15), Math.min(1, dt * 4)); K.sk.rotation.set(0, Math.PI / 2, k > 0.7 ? (k - 0.7) * 5 : 0);
        if (S.key > 1.8) K.hinge.rotation.y += (1.7 - K.hinge.rotation.y) * Math.min(1, dt * 2.5);
        if (S.key > 1.8 && !S.keyDone) { S.keyDone = 1; sfx('clank'); ctx.done(2); }
        if (S.key > 3) K.sk.visible = false;
      }
    }
    setBarrier(2, step >= 3 && K.hinge.rotation.y > 1.0);
    // chess: highlights; the knight hops, the king bows and lays his crown down, the door rook steps aside
    const C = P.chess;
    if (step === 3 && !S.chess && B.rooms[3].visible) {
      const d = new Object3D(), lit = [[2, 3], ...(lv() > 1 ? (lv() > 2 ? [[0, 3], [3, 2]] : [[0, 3]]) : [])].filter(([c, r]) => !S.dark.includes(c + ',' + r));
      lit.forEach(([c, r], i) => { sq(c, r, v1); d.position.set(v1.x, 0.03, v1.z); d.updateMatrix(); C.hl.setMatrixAt(i, d.matrix); });
      C.hl.count = lit.length; C.hl.instanceMatrix.needsUpdate = true; C.hl.material.opacity = 0.45 + Math.sin(tt * 4) * 0.25;
      if (C.beam) { if (lv() > 1) { lit.forEach(([c, r], i) => { sq(c, r, v1); d.position.set(v1.x, 0.02, v1.z); d.updateMatrix(); C.beam.setMatrixAt(i, d.matrix); }); C.beam.count = lit.length; C.beam.instanceMatrix.needsUpdate = true; C.beam.material.opacity = 0.28 + Math.sin(tt * 4) * 0.1; } else C.beam.count = 0; }
    } else { C.hl.count = 0; if (C.beam) C.beam.count = 0; }
    if (S.chess > 0) {
      S.chess += dt; const t = S.chess; sq(1, 1, v1); sq(2, 3, v2);
      const k = Math.min(1, t / 1.0); C.knightM.position.set(v1.x + (v2.x - v1.x) * k, Math.sin(k * Math.PI) * 0.8, v1.z + (v2.z - v1.z) * k);
      if (t > 1.3) C.kingM.rotation.x += (0.35 - C.kingM.rotation.x) * Math.min(1, dt * 2);
      if (t > 2.0) { const u = Math.min(1, (t - 2.0) / 0.9); C.crown.position.set(C.kingM.position.x, 1.6 - 1.54 * u + Math.sin(u * Math.PI) * 0.3, C.kingM.position.z + 0.6 * u); }
      if (t > 2.4) C.doorRook.position.x += (-2.4 - C.doorRook.position.x) * Math.min(1, dt * 2);
      if (t > 2.2 && !S.chessSay) { S.chessSay = 1; ctx.say('המלך הלבן משתחווה ונותן את הכתר. ניצחת! 👑', null, 3.5); }
      if (t > 3.2 && !S.chessDone) { S.chessDone = 1; ctx.done(3); }
    }
    setBarrier(3, step >= 4 && C.doorRook.position.x < -1.6);
    // potions: the flames flicker; the right bottle rises and the curtain parts
    const Pp = P.potions;
    for (const fl of Pp.flames) { if (S.potion > 0 || step >= 5) fl.scale.x += (0.02 - fl.scale.x) * Math.min(1, dt * 2); else fl.scale.y = 1 + Math.sin(tt * 7 + fl.position.x) * 0.06; }
    if (S.potion > 0) {
      S.potion += dt; const d = new Object3D(), b = Pp.bpos[S.answer]; d.position.set(b.x, b.y + Math.min(0.5, S.potion * 0.5), b.z); d.rotation.y = S.potion * 3; d.updateMatrix(); Pp.bottles.setMatrixAt(S.answer, d.matrix); Pp.bottles.instanceMatrix.needsUpdate = true;
      if (S.potion > 2.2 && !S.potionDone) { S.potionDone = 1; ctx.done(4); }
    }
    setBarrier(4, step >= 5 && Pp.flames[0].scale.x < 0.2);
    // the mirror: mist; when Harry looks, the picture; walking up starts the look
    if (B.rooms[5].visible) { if ((S.mtick = (S.mtick || 0) + dt) > 0.12) { S.mtick = 0; drawMirror(P.mirror.canvas, S.look ? Math.min(1, S.look / 1.5) : 0, tt); P.mirror.tex.needsUpdate = true; } }
    if (step === 5 && cur === 5 && !S.look && !ctx.isTakeover() && Math.hypot(player.pos.x - SPOTS.look.x, player.pos.z - SPOTS.look.z) < 1.3) lookMirror();
  }
  function setBarrier(i, open) { const b = S.B && S.B.barriers[i]; if (b) { b.hw = open ? 0 : 1.2; b.hd = open ? 0 : 0.5; } }

  // ---- taps: the harp, the keys, the board, the bottles ----
  function tap(x, y, step) {
    if (!inCh()) return false;
    const cur = room(), P = S.B.P, rr = R();
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (step === 0 && cur === 0) { if (near(W(SPOTS.harp.x, 1.1, SPOTS.harp.z, v1)) < rr * 1.3) { playHarp(); return true; } return false; }
    if (step === 1 && cur === 1) { if (near(W(SPOTS.snare.x, SPOTS.snare.y, SPOTS.snare.z, v1)) < rr * 2) { ctx.oops('הצמח לא זז ממגע... הוא בורח מאור! נסה לומוס 💡'); return true; } return false; }
    if (step === 2 && cur === 2 && !S.key) {
      P.keys.sk.getWorldPosition(v1); const ds = near(v1);
      let best = 1e9; const m = new Object3D();
      for (let k = 0; k < P.keys.NK; k++) { P.keys.keys.getMatrixAt(k, m.matrix); v2.setFromMatrixPosition(m.matrix).add(S.B.g.position); best = Math.min(best, near(v2)); }
      if (ds < rr * 1.25) { catchKey(); return true; }
      if (best < rr) { S.wrong++; ctx.oops('זה מפתח קטן... חפש את הגדול עם הכנף הכחולה 🔑'); return true; }
      return false;
    }
    if (step === 3 && cur === 3 && !S.chess) {
      if (lv() > 1) {   // levels 2-3: a tap on a lit square's gold beam picks that square, so small phone screens stay fair
        const lit = [[2, 3], [0, 3], ...(lv() > 2 ? [[3, 2]] : [])].filter(([c, r]) => !S.dark.includes(c + ',' + r));
        let best = null, bd = 1e9;
        for (const [c, r] of lit) for (const hy of [0.9, 1.5]) { const o = sq(c, r, v2); const dd = near(W(o.x, hy, o.z, v1)); if (dd < bd) { bd = dd; best = [c, r]; } }
        if (best && bd < rr * 0.7) return pickSquare(best[0], best[1]);
      }
      const ndc = new Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), rc = new Raycaster(); rc.setFromCamera(ndc, camera);
      const hit = rc.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -Y()), v1); if (!hit) return false;
      const c = Math.round((v1.x - BOARD.x0) / BOARD.s), r = Math.round((BOARD.z0 - v1.z) / BOARD.s);
      if (c < 0 || c > 5 || r < 0 || r > 5) return false;
      return pickSquare(c, r);
    }
    if (step === 4 && cur === 4 && !S.potion) {
      let bi = -1, bd = 1e9; P.potions.bpos.forEach((b, i) => { const d = near(v1.copy(b).add(S.B.g.position).setY(Y() + b.y + 0.3)); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0 || bd > rr) return false;
      if (bi === S.answer) { pickBottle(); return true; }
      S.wrong++; ctx.oops('זה הבקבוק ' + COLOURS[bi].name + '. החידה אמרה: ' + COLOURS[S.answer].name + ' ' + COLOURS[S.answer].e); return true;
    }
    return false;
  }

  function pickSquare(c, r) {
    if (c === 2 && r === 3) { chessMove(); return true; }
    S.wrong++;
    // levels 2-3: a lit distractor goes dark after a try, so every wrong tap narrows the choice (always beatable)
    if (lv() > 1 && ((c === 0 && r === 3) || (lv() > 2 && c === 3 && r === 2)) && !S.dark.includes(c + ',' + r)) { S.dark.push(c + ',' + r); ctx.oops('לא לשם 🙂 משם הפרש לא מגיע למלך הלבן 👑 נסה משבצת זוהרת אחרת'); return true; }
    ctx.oops('לא לשם 🙂 נסה את המשבצת הזוהרת'); return true;
  }
  // ---- where the arrow points ----
  function goal(step, out) {
    if (step === 0 && interiors.active === 'staircase') return out.set(STAIR_DOOR.x, Y(), STAIR_DOOR.z - 0.6);
    if (!inCh()) return ctx.routeTo('chambers', out, ['staircase', 'entrancehall']);
    const cur = room(), want = [0, 1, 2, 3, 4, 5][step];
    if (cur < want) { if (cur === 0) return W(SPOTS.trap.x, 0, SPOTS.trap.z, out); return W(0, 0, DOOR_Z(cur), out); }
    if (step === 0) return W(SPOTS.harp.x, 0.9, SPOTS.harp.z, out);
    if (step === 1) return W(SPOTS.snare.x, 0.6, SPOTS.snare.z + 0.5, out);
    if (step === 2) { if (S.key) return null; S.B.P.keys.sk.getWorldPosition(out); out.y -= 1.0; return out; }
    if (step === 3) { sq(2, 3, out); return out.set(out.x, Y(), out.z); }
    if (step === 4) return ctx._glowBottle ? W(S.B.P.potions.bpos[S.answer].x, 0.9, S.B.P.potions.bpos[S.answer].z, out) : W(SPOTS.table.x, 0.9, SPOTS.table.z, out);
    if (step === 5) return W(SPOTS.look.x, 0, SPOTS.look.z, out);
    return null;
  }

  function begin(step, resumed) {
    S.active = true; PROGRESS = step; CORRIDOR.quest = true;
    if (step === 4) setTimeout(() => ctx.say('החידה: הבקבוק ' + COLOURS[S.answer].name + ' יעביר אותך דרך האש ' + COLOURS[S.answer].e, '📜 החידה', 6), resumed ? 2500 : 600);
    if (!resumed && step > 0) return;
    // fresh start or resume: go to the right place
    if (step === 0) { if (interiors.active === 'staircase') { player.yaw = 0; player.teleport(-6, 5.2); } else interiors.enter('staircase', { x: -6, z: 5.2, yaw: 0 }); return; }
    const at = [null, { x: SPOTS.land.x, z: SPOTS.land.z, yaw: Math.PI }, { ...SPOTS.keysIn, yaw: Math.PI }, { ...SPOTS.chessIn, yaw: Math.PI }, { ...SPOTS.potionIn, yaw: Math.PI }, { ...SPOTS.mirrorIn, yaw: Math.PI }][step];
    interiors.enter('chambers', at);
  }
  function glow(step, on) { ctx._glowBottle = on && step === 4; }
  // levels 2-3 only (level 1 keeps its hint texts): the chess clue and the riddle colour again
  function hintText(step, n) {
    if (lv() === 1) return null;
    if (step === 3 && n === 1) return 'המהלך המנצח: המשבצת הזוהרת הקרובה ביותר למלך הלבן 👑';
    if (step === 3 && n === 2) return 'הפרש קופץ אל המשבצת שליד המלך הלבן ♞👑';
    if (step === 4 && n === 1) return 'החידה אמרה: הבקבוק ' + COLOURS[S.answer].name + ' ' + COLOURS[S.answer].e;
    if (step === 4 && n === 2) return 'הבקבוק ' + COLOURS[S.answer].name + ' זוהר עכשיו ' + COLOURS[S.answer].e;
    return null;
  }
  function together(step) {
    if (step === 0) playHarp();
    else if (step === 1) { if (!inCh() || room() !== 1) { interiors.enter('chambers', { x: SPOTS.land.x, z: SPOTS.land.z, yaw: Math.PI }); setTimeout(clearSnare, 900); } else clearSnare(); }
    else if (step === 2) catchKey();
    else if (step === 3) chessMove();
    else if (step === 4) pickBottle();
    else if (step === 5) { if (inCh() && room() === 5) lookMirror(); else { interiors.enter('chambers', { ...SPOTS.look, yaw: Math.PI }); setTimeout(lookMirror, 1200); } }
  }
  function end() {
    S.active = false; CORRIDOR.quest = false;
    if (FI && Array.isArray(FI.TARGETS)) for (const t of T) { const i = FI.TARGETS.indexOf(t); if (i >= 0) FI.TARGETS.splice(i, 1); }
    if (ctx.isTakeover() && (S.hop || (S.look && !S.mirror))) ctx.setTakeover(null);
  }
  function state() {
    return { room: inCh() ? room() : null, answer: COLOURS[S.answer].k, answerIdx: S.answer, played: S.played, snare: S.snare > 0, key: S.key > 0, chess: S.chess > 0, potion: S.potion > 0, look: S.look > 0, mirror: !!S.mirror, wrong: S.wrong, hop: S.hop > 0,
      stairDoor: !!(interiors.active === 'staircase' && interiors.room && interiors.room.group && interiors.room.group.userData.advDoor), spots: SPOTS };
  }
  // shown props for a debug camera / test: world position of things to tap
  ctx._stone = {
    keyW: () => { if (!S.B) return null; const o = new Vector3(); S.B.P.keys.sk.getWorldPosition(o); return o; },
    smallKeyW: (k = 0) => { if (!S.B) return null; const m = new Object3D(); S.B.P.keys.keys.getMatrixAt(k, m.matrix); return new Vector3().setFromMatrixPosition(m.matrix).add(S.B.g.position); },
    squareW: (c, r) => { const o = sq(c, r); return o.set(o.x, Y() + 0.02, o.z); },
    bottleW: (i) => { if (!S.B) return null; const b = S.B.P.potions.bpos[i]; return new Vector3(b.x, Y() + b.y + 0.3, b.z); },
    harpW: () => W(SPOTS.harp.x, 1.1, SPOTS.harp.z),
  };
  return { begin, update, goal, tap, glow, together, end, state, hintText };
}
