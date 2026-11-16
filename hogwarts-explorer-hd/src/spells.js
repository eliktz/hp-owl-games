// Spell challenge courses (brief 2026-11-15): each classroom teaches ONE spell, then a short
// challenge course uses only that spell. Inspired by the 2001 Philosopher's Stone game.
//
//   COURSES        data: the spell, the teacher, the room + lesson station, the lesson script
//                  (lines, targets) and the course (stations: walk path, camera, what to lift
//                  where, a little "after" effect). The props of a course are built by its
//                  build(kit) function from a tiny kit (one merged static mesh + a few movers).
//   the runner     one generic state machine: lesson -> course -> reward. start(key), quit(),
//                  state(), test hooks. It owns the hero + camera through main.js's takeover
//                  slot (like Quidditch), so the joystick / wand / other prompts never fight it.
//   the gesture    Wingardium Leviosa = "swish and flick": touch a glowing thing (or the big
//                  🪄 button) and swipe UP; or hold the 🪄 button; or tap it a few times. The
//                  thing rises along a path to a glowing outline and snaps when close. Let go
//                  too early and it hovers, then floats gently back down beside you: no fail.
//   reward         1-3 stars, house points through HPLessons.progress.bonus (the same pool the
//                  Entrance Hall hourglasses show), best stars saved in localStorage hpSpells1.
//
// Budget: everything a course draws is ~11 draw calls (one merged vertex-coloured static mesh,
// instanced feathers / blocks / rings, a handful of single movers, one outline, one sparkle
// instanced quad set with a 32 px canvas texture), built on start and disposed on leave or room exit.
// No per-frame allocations in update(): temp vectors and pre-sampled paths only.
import {
  Group, Mesh, InstancedMesh, BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, ConeGeometry, ShapeGeometry, Shape, PlaneGeometry,
  MeshStandardMaterial, MeshBasicMaterial, BufferAttribute, CanvasTexture, SRGBColorSpace,
  Color, Vector3, Matrix4, Quaternion, Euler, CatmullRomCurve3, AdditiveBlending, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { animateChibi } from './chibi.js';
import * as fun from './fun.js';

const SAVE_KEY = 'hpSpells1';             // { charms: { stars, plays } } (new key; nothing else changes meaning)
const SNAP = 0.86;                        // lift progress at which the thing snaps into its outline
const HOVER = 1.1;                        // seconds a let-go thing hovers before it floats back down
const FALL = 0.4;                         // progress per second while floating back down
const HOLD = 1.0;                         // seconds of holding the 🪄 button for a full lift
const TAP = 0.34;                         // one tap on the 🪄 button lifts this much
const HINT_AFTER = 4;                     // seconds of no input before the ghost hand shows
const WALK = 2.2;                         // auto-walk speed between stations (m/s)
const CREST = { gryf: '🦁', slyt: '🐍', rave: '🦅', huff: '🦡' };

// ---------------------------------------------------------------------------------------
// Course #1: Charms, Professor Flitwick, Wingardium Leviosa. Room-local metres (floor y 0)
// in the classroom wing (28 x 18 m, Charms corner x -9). Flitwick stands at (-9, -6.2);
// the course lives on the free floor south of the Charms desks (x -13.5..-4.5, z 0.5..8).
// ---------------------------------------------------------------------------------------
export const COURSES = {
  charms: {
    spell: { he: 'וִינְגַרְדְיוּם לֶבִיּוֹסָה', icon: '🪶', gesture: 'up' },
    title: 'אֶתְגַּר הַנּוֹצָה', name: 'אֶתְגָּר: לְחָשִׁים',
    teacher: 'flitwick', room: 'classrooms', station: 'charms',
    build: buildCharms,
    lesson: {
      stand: [-9, -3.55], face: [-9, -4.75],
      cam: { pos: [-5.6, 2.3, -2.9], look: [-9.3, 1.1, -5.0] },
      intro: [
        { pose: 'talk', line: 'שָׁלוֹם! הַיּוֹם נִלְמַד לְהָרִים דְּבָרִים בְּקֶסֶם!', t: 3.4 },
        { pose: 'cast', line: 'וִינְגַרְדְיוּם לֶבִיּוֹסָה!', t: 3.0, burst: [-9, 1.2, -4.75] },
        { pose: 'talk', line: 'עַכְשָׁו אַתָּה! גַּע בַּנּוֹצָה וְהַחְלֵק לְמַעְלָה!', t: 3.2 },
      ],
      lifts: [0, 1, 2].map(i => ({ m: 'feather' + i, flutter: true,
        path: [[-9.6 + i * 0.6, 0.8, -4.75], [-9.55 + i * 0.55, 1.4, -4.7], [-9.7 + i * 0.7, 2.2, -4.85]],
        rot0: [0, 0.3 - i * 0.3, 0], rot1: [0.2, 0.3 - i * 0.3, 0.5] })),
      outro: 'עַכְשָׁו — לָאֶתְגָּר!',
    },
    praise: ['יָפֶה מְאֹד!', 'מְצֻיָּן!', 'כָּל הַכָּבוֹד!', 'נִפְלָא!'],
    oops: 'אוּפְּס! נַסֵּה שׁוּב',
    finale: 'אַתָּה קוֹסֵם אֲמִתִּי!',
    course: {
      star3: 240,                         // seconds: 3 stars = finished within this with <= 2 drops
      stations: [
        { id: 'shelf', icon: '📚', say: 'הָרֵם אֶת הַסֵּפֶר לַמַּדָּף!',
          walk: [[-9.0, -2.4], [-9.3, 0.2], [-10.6, 1.6]], face: [-13, 1.6],
          cam: { pos: [-8.4, 2.3, -0.3], look: [-12.4, 1.1, 2.0] },
          lifts: [{ m: 'book', path: [[-11.9, 0.05, 1.6], [-12.3, 1.0, 1.75], [-13.0, 1.75, 1.7], [-13.17, 1.56, 1.6]], rot0: [Math.PI / 2, 0.3, 0], rot1: [0, 0, 0] }] },
        { id: 'bridge', icon: '🧱', say: 'בְּנֵה גֶּשֶׁר לַיַּנְשׁוּף!',
          walk: [[-9.6, 3.0], [-9.6, 6.0], [-11.8, 7.0]], face: [-11.8, 4.3],
          cam: { pos: [-9.1, 3.3, 8.5], look: [-11.8, 0.8, 4.6] },
          lifts: [0, 1, 2].map(i => ({ m: 'block' + i, path: [[-12.4 + i * 0.6, 0.2, 5.5], [-12.4 + i * 0.6, 1.5, 5.0], [-12.4 + i * 0.6, 0.79, 4.3]], rot0: [0, 0.35 - i * 0.3, 0], rot1: [0, 0, 0] })),
          after: 'owlCross' },
        { id: 'arch', icon: '🚪', say: 'הָרֵם אֶת הַכָּרִית מֵהַדֶּלֶת!',
          walk: [[-10.0, 6.7]], face: [-8, 6.7],
          cam: { pos: [-12.6, 2.4, 4.4], look: [-8.0, 1.5, 6.7] },
          lifts: [{ m: 'cushion', bob: true, path: [[-8.0, 1.0, 6.7], [-8.25, 2.1, 6.7], [-8.0, 2.95, 6.7], [-8.0, 2.47, 6.7]], rot0: [0, 0, 0], rot1: [0, 0.6, 0] }] },
        { id: 'chest', icon: '🔑', say: 'הָרֵם אֶת הַמַּפְתֵּחַ אֶל הַוָּו!',
          walk: [[-8.0, 6.7], [-6.6, 6.7], [-5.3, 6.1]], face: [-4.8, 3.6],
          cam: { pos: [-7.0, 2.3, 8.6], look: [-5.2, 1.5, 3.8] },
          lifts: [{ m: 'key', path: [[-5.0, 0.05, 4.9], [-5.1, 1.4, 4.4], [-4.6, 2.75, 3.75], [-4.5, 2.4, 3.6]], rot0: [Math.PI / 2, 0, 0.4], rot1: [0, 0, -Math.PI / 2] }],
          after: 'chestOpen' },
        { id: 'rings', icon: '🪶', say: 'הַעֲבֵר אֶת הַנּוֹצָה בַּטַּבָּעוֹת!',
          walk: [[-7.0, 5.0], [-7.2, 1.9]], face: [-8.4, -2],
          cam: { pos: [-6.0, 2.5, 5.6], look: [-8.8, 1.9, -1.4] },
          lifts: [{ m: 'feather3', flutter: true, rings: ['ring0', 'ring1', 'ring2'],
            path: [[-8.5, 0.87, 0.7], [-8.7, 1.3, 0.2], [-8.9, 1.8, -0.5], [-9.0, 2.5, -1.7], [-9.0, 3.1, -3.0], [-9.0, 3.3, -3.9]], rot0: [0, Math.PI / 2, 0], rot1: [0.1, Math.PI / 2, 0.35] }] },
      ],
    },
  },
};

// ---- tiny geometry helpers (build time only) ----
const _m4 = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function paint(geo, hex, hex2 = null, axis = 'y') {
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), a = new Color(hex), b = new Color(hex2 ?? hex);
  geo.computeBoundingBox(); const bb = geo.boundingBox, lo = bb.min[axis], span = (bb.max[axis] - lo) || 1;
  for (let i = 0; i < n; i++) { const k = (geo.attributes.position.getComponent(i, axis === 'x' ? 0 : axis === 'y' ? 1 : 2) - lo) / span; _c.copy(a).lerp(b, k); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  return geo;
}
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return geo.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
}
const merge = (parts) => { const g = mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p)); for (const p of parts) p.dispose(); return g; };

function featherGeo() {
  const s = new Shape(); s.moveTo(0, 0);
  s.quadraticCurveTo(0.16, 0.075, 0.44, 0.02); s.quadraticCurveTo(0.49, 0, 0.44, -0.015); s.quadraticCurveTo(0.17, -0.08, 0.04, -0.02); s.lineTo(0, 0);
  const vane = paint(new ShapeGeometry(s, 8), 0xf6f1e6, 0xd8ccff, 'x'); vane.rotateX(-Math.PI / 2);
  const quill = paint(place(new CylinderGeometry(0.006, 0.004, 0.54, 4), 0.22, 0.004, 0, 0, 0, Math.PI / 2), 0xd8c9a0);
  return merge([vane, quill]).translate(-0.22, 0, 0);
}
function owlGeo() {
  return merge([
    paint(place(new SphereGeometry(0.2, 12, 10), 0, 0.22, 0, 0, 0, 0, 1, 1.15, 0.95), 0x8a7a6c),
    paint(place(new SphereGeometry(0.15, 10, 8), 0, 0.19, 0.08), 0xd8ccb8),
    paint(place(new SphereGeometry(0.06, 8, 8), -0.08, 0.3, 0.16), 0xffb020), paint(place(new SphereGeometry(0.06, 8, 8), 0.08, 0.3, 0.16), 0xffb020),
    paint(place(new SphereGeometry(0.028, 6, 6), -0.08, 0.3, 0.21), 0x1a1420), paint(place(new SphereGeometry(0.028, 6, 6), 0.08, 0.3, 0.21), 0x1a1420),
    paint(place(new ConeGeometry(0.035, 0.08, 5), 0, 0.24, 0.21, Math.PI / 2), 0xff8a10),
    paint(place(new ConeGeometry(0.05, 0.12, 4), -0.12, 0.44, 0, 0, 0, 0.3), 0x6a5a4c), paint(place(new ConeGeometry(0.05, 0.12, 4), 0.12, 0.44, 0, 0, 0, -0.3), 0x6a5a4c),
  ]);
}

// The Charms course props. kit.solid(geo) adds to the ONE merged static mesh; kit.mesh / kit.inst
// make movers (a lift target, an owl, a lid, rings) that the runner and the effects can pose.
function buildCharms(kit) {
  const WOOD = 0x6a4424, DARK = 0x3a2614, STONE = 0x7a6a56, STONE2 = 0x9a8a70, BRASS = 0xb98b2e;
  const BOOKS = [0x6a1e1e, 0x1f3b5e, 0x2c4a2a, 0x5a3a1e, 0x4a2a52, 0x7a5a1e];
  const { solid } = kit;
  // lesson bench in front of Flitwick with three feathers
  solid(paint(place(new BoxGeometry(1.9, 0.08, 0.52), -9, 0.74, -4.6), WOOD));
  for (const sx of [-0.85, 0.85]) solid(paint(place(new BoxGeometry(0.08, 0.7, 0.44), -9 + sx, 0.35, -4.6), DARK));
  // 1 bookshelf against the west wall, a gap on the middle shelf where the red book belongs
  const SX = -13.35, SZ = 1.6;
  solid(paint(place(new BoxGeometry(0.04, 2.25, 1.5), SX - 0.17, 1.125, SZ), DARK));
  for (const dz of [-0.75, 0.75]) solid(paint(place(new BoxGeometry(0.38, 2.25, 0.06), SX, 1.125, SZ + dz), WOOD));
  for (const y of [0.04, 0.72, 1.38, 2.22]) solid(paint(place(new BoxGeometry(0.38, 0.05, 1.5), SX, y, SZ), WOOD));
  let k = 0;
  for (const [y, gap] of [[0.745, false], [1.405, true]]) {
    for (let z = SZ - 0.68; z < SZ + 0.66;) {
      const t = 0.07 + ((k * 37) % 5) * 0.012, h = 0.26 + ((k * 53) % 4) * 0.03;
      if (gap && z + t > SZ - 0.13 && z < SZ + 0.13) { z = SZ + 0.13; continue; }
      solid(paint(place(new BoxGeometry(0.24, h, t), SX + 0.03, y + h / 2, z + t / 2), BOOKS[k % BOOKS.length])); z += t + 0.006; k++;
    }
  }
  kit.mesh('book', merge([paint(new BoxGeometry(0.26, 0.34, 0.14), 0xb3262a), paint(place(new BoxGeometry(0.24, 0.32, 0.144), 0.016), 0xf0e4c0), paint(place(new BoxGeometry(0.02, 0.35, 0.15), -0.12), 0xd8a940)]), { glowHex: 0xff6a5a });
  // 2 a toy bridge with three holes; the owl waits on the west tower
  for (const x of [-13.2, -10.4]) solid(paint(place(new BoxGeometry(0.5, 1.0, 0.62), x, 0.5, 4.3), STONE, STONE2));
  for (const dz of [-0.27, 0.27]) solid(paint(place(new BoxGeometry(2.3, 0.05, 0.05), -11.8, 0.975, 4.3 + dz), DARK));
  for (const [x0, x1] of [[-12.95, -12.61], [-12.19, -12.01], [-11.59, -11.41], [-10.99, -10.65]]) solid(paint(place(new BoxGeometry(x1 - x0, 0.1, 0.5), (x0 + x1) / 2, 0.95, 4.3), 0x8a6a40));
  kit.inst('block', paint(new BoxGeometry(0.4, 0.4, 0.5), 0xffffff, 0xd8d0c0), 3, [0xe8473a, 0x3a7ae8, 0xf2c230], { glowHex: 0xffd27a });
  kit.mesh('owl', owlGeo(), { glow: false });
  // 3 a little stone arch; a fat purple cushion floats in the doorway
  for (const z of [6.0, 7.4]) solid(paint(place(new BoxGeometry(0.32, 2.0, 0.32), -8.0, 1.0, z), STONE, STONE2));
  solid(paint(place(new BoxGeometry(0.44, 0.3, 1.86), -8.0, 2.15, 6.7), STONE2));
  solid(paint(place(new ConeGeometry(0.3, 0.35, 4), -8.0, 2.47, 6.7, 0, Math.PI / 4), STONE2));
  kit.mesh('cushion', merge([paint(place(new SphereGeometry(0.42, 16, 8), 0, 0, 0, 0, 0, 0, 1, 0.36, 0.8), 0x7a3a9a, 0x9a5ac0), ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => paint(place(new SphereGeometry(0.05, 6, 5), a * 0.36, 0, b * 0.26), 0xffcf4a))]), { glowHex: 0xc080ff });
  // 4 a hook on the column, a treasure chest by it
  solid(paint(place(new BoxGeometry(0.22, 0.22, 0.04), -4.5, 2.66, 3.43), BRASS));
  solid(paint(place(new TorusGeometry(0.06, 0.014, 6, 12, Math.PI * 1.3), -4.5, 2.56, 3.5, 0, 0, Math.PI * 0.85), 0xd8b04a));
  solid(paint(place(new BoxGeometry(0.84, 0.46, 0.52), -6.3, 0.23, 3.9), 0x6a4220, 0x7a5028));
  for (const dx of [-0.3, 0.3]) solid(paint(place(new BoxGeometry(0.07, 0.47, 0.53), -6.3 + dx, 0.235, 3.9), 0xd8b04a));
  solid(paint(place(new BoxGeometry(0.7, 0.06, 0.4), -6.3, 0.45, 3.9), 0xffd23f));                 // the gold inside
  kit.mesh('key', place(merge([paint(place(new TorusGeometry(0.055, 0.017, 6, 14), -0.15), 0xffd86a), paint(new BoxGeometry(0.24, 0.03, 0.03), 0xe8c050),
    paint(place(new BoxGeometry(0.03, 0.06, 0.02), 0.09, -0.04), 0xe8c050), paint(place(new BoxGeometry(0.03, 0.045, 0.02), 0.04, -0.035), 0xe8c050)]), 0, 0, 0, 0, 0, 0, 1.8), { glowHex: 0xffd86a });
  kit.mesh('lid', merge([paint(place(new BoxGeometry(0.86, 0.14, 0.54), 0, 0.07, 0.27), 0x7a5028, 0x8a5a2e), paint(place(new BoxGeometry(0.07, 0.15, 0.55), -0.3, 0.07, 0.27), 0xd8b04a), paint(place(new BoxGeometry(0.07, 0.15, 0.55), 0.3, 0.07, 0.27), 0xd8b04a)]), { glow: false });
  // 5 a brass pedestal with the big feather, and three floating rings
  solid(paint(place(new CylinderGeometry(0.16, 0.22, 0.8, 12), -8.5, 0.4, 0.7), BRASS, 0xd8b04a));
  kit.inst('feather', featherGeo(), 4, [0xffffff, 0xffffff, 0xffffff, 0xffffff], { glowHex: 0xffd27a, scales: [1.6, 1.6, 1.6, 2.4] });
  kit.inst('ring', new TorusGeometry(0.46, 0.05, 8, 28), 3, [0x8a6a30, 0x8a6a30, 0x8a6a30], { glow: false, emissive: 0xffb030, emissiveIntensity: 0.35 });
  const ringAt = [[-8.9, 1.8, -0.5, 0.15], [-9.0, 2.5, -1.7, -0.1], [-9.0, 3.1, -3.0, 0.12]];

  const owlA = [-13.2, 1.0, 4.3], owlB = [-10.4, 1.0, 4.3];
  return {
    reset(M) {
      M.owl.pose(owlA[0], owlA[1], owlA[2], 0, Math.PI / 2, 0);
      M.lid.pose(-6.3, 0.46, 3.64, 0, 0, 0);
      ringAt.forEach(([x, y, z, ry], i) => { M['ring' + i].pose(x, y, z, 0, ry, 0); M['ring' + i].color(0x8a6a30); });
    },
    // idle life: the owl bobs, the rings drift
    tick(M, t) {
      ringAt.forEach(([x, y, z, ry], i) => M['ring' + i].pose(x, y + Math.sin(t * 1.3 + i * 2) * 0.05, z, 0, ry + Math.sin(t * 0.7 + i) * 0.08, 0, M['ring' + i].lit ? 1.12 : 1));
    },
    effects: {
      // the owl hops across the finished bridge (2.6 s)
      owlCross(M, t) {
        const k = Math.min(1, t / 2.4), x = owlA[0] + (owlB[0] - owlA[0]) * k;
        M.owl.pose(x, owlA[1] + Math.abs(Math.sin(k * Math.PI * 5)) * 0.18, owlA[2], 0, Math.PI / 2, Math.sin(t * 14) * 0.12);
        if (k >= 1) M.owl.pose(owlB[0], owlB[1], owlB[2], 0, -0.4, 0);
        return t < 2.6;
      },
      // the lid swings open (1.6 s)
      chestOpen(M, t) {
        const k = Math.min(1, t / 0.9), e = 1 - (1 - k) * (1 - k) * (1 - k);
        M.lid.pose(-6.3, 0.46, 3.64, -1.95 * e, 0, 0);
        return t < 1.6;
      },
    },
  };
}

// ---------------------------------------------------------------------------------------
// the runner
// ---------------------------------------------------------------------------------------
export function createSpells({ scene, camera, player, interiors, lessons, setTakeover, isModal, isTakeover }) {
  let save = {};
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { save = {}; }
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ } };
  const best = (key) => (save[key] && save[key].stars) || 0;

  // ---- DOM ----
  const css = document.createElement('style');
  css.textContent = `
  body.inSpell .pill,body.inSpell #quest,body.inSpell #mapBtn,body.inSpell #muteBtn,body.inSpell #timeBtn,body.inSpell #camctl,body.inSpell #bellBtn,body.inSpell #enterBtn,
  body.inSpell #exitBtn,body.inSpell #bubble,body.inSpell #wandBtn,body.inSpell #musicBtn,body.inSpell #funPrompt,body.inSpell #spPrompt,body.inSpell #joy,body.inSpell #joyKnob{display:none !important}
  #spPrompt{position:fixed;left:calc(50% - 128px);bottom:calc(120px + env(safe-area-inset-bottom));transform:translateX(-50%) scale(0);z-index:14;width:96px;height:96px;border-radius:50%;
    border:5px solid #fff;background:radial-gradient(circle at 40% 30%,#c9a6ff,#6a3ad0);font-size:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;
    box-shadow:0 0 26px rgba(190,140,255,.95);cursor:pointer;transition:transform .25s cubic-bezier(.3,1.7,.5,1);touch-action:manipulation;-webkit-tap-highlight-color:transparent;padding:0;line-height:1}
  #spPrompt .l{font:bold 15px 'Rubik',sans-serif;color:#fff;margin-top:2px;text-shadow:0 1px 0 #2a1060} #spPrompt.on{transform:translateX(-50%) scale(1)}
  body.modalOn #spPrompt,body.inMatch #spPrompt{display:none}
  #spOv{position:fixed;inset:0;z-index:12;display:none;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  body.inSpell #spOv{display:block}
  #spTop{position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top));transform:translateX(-50%);z-index:15;display:none;gap:8px;align-items:center;
    background:rgba(32,20,70,.82);border:3px solid #ffd76a;border-radius:30px;padding:5px 14px;direction:rtl;pointer-events:none}
  body.inSpell #spTop{display:flex}
  #spTop i{font-style:normal;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;background:rgba(255,255,255,.12);filter:grayscale(1) brightness(.75);transition:all .3s}
  #spTop i.on{filter:none;background:radial-gradient(circle,#ffe48a,#d8901a);box-shadow:0 0 12px #ffd76a}
  #spTop i.cur{filter:none;animation:spPip 1s ease-in-out infinite;background:rgba(255,215,106,.35)}
  @keyframes spPip{50%{transform:scale(1.18)}}
  #spX{right:calc(18px + env(safe-area-inset-right));top:calc(14px + env(safe-area-inset-top));width:64px;height:64px;font-size:28px;display:none;z-index:16}
  body.inSpell #spX{display:flex}
  #spBtn{right:calc(28px + env(safe-area-inset-right));bottom:calc(32px + env(safe-area-inset-bottom));width:124px;height:124px;font-size:62px;display:none;z-index:16;
    background:radial-gradient(circle at 50% 35%,rgba(210,170,255,.97),rgba(90,40,170,.9));touch-action:none}
  body.inSpell #spBtn.on{display:flex}
  #spBtn.hold{box-shadow:0 0 0 8px rgba(255,215,106,.6),0 0 36px #ffd76a}
  #spSay{position:fixed;left:50%;top:calc(80px + env(safe-area-inset-top));transform:translateX(-50%) scale(.7);z-index:15;opacity:0;pointer-events:none;transition:opacity .2s,transform .25s cubic-bezier(.3,1.7,.5,1);
    background:rgba(255,248,228,.97);border:4px solid #ffd76a;border-radius:22px;padding:8px 18px;color:#2a1a12;font:bold 28px 'Rubik',sans-serif;direction:rtl;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
  #spSay.on{opacity:1;transform:translateX(-50%) scale(1)}
  #spHand{position:fixed;z-index:15;font-size:64px;pointer-events:none;display:none;margin:-10px 0 0 -26px;filter:drop-shadow(0 0 10px #fff)}
  #spHand.on{display:block;animation:spHand 1.5s ease-in-out infinite}
  @keyframes spHand{0%{transform:translateY(40px);opacity:0}15%{opacity:1}70%{transform:translateY(-130px);opacity:1}100%{transform:translateY(-150px);opacity:0}}
  #spEnd{position:fixed;inset:0;z-index:48;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(40,24,90,.7),rgba(5,3,25,.92));font-family:'Rubik',sans-serif;direction:rtl}
  #spEnd.on{display:flex}
  #spEnd .p{background:rgba(32,20,70,.97);border:5px solid #ffd76a;border-radius:28px;padding:18px 26px 22px;text-align:center;color:#fff;width:min(90vw,520px);box-sizing:border-box}
  #spEnd .tr{font-size:110px;line-height:1.05} #spEnd .ti{font-size:44px;font-weight:bold;color:#ffd76a;text-shadow:0 3px 0 #7a3b00}
  #spEnd .sc{font-size:40px;font-weight:bold;margin:6px 0} #spEnd .st{font-size:54px;letter-spacing:6px}
  #spEnd .row{display:flex;gap:14px;justify-content:center;margin-top:14px}
  #spEnd button{min-width:150px;min-height:76px;border-radius:40px;border:4px solid #fff;font:bold 30px 'Rubik',sans-serif;cursor:pointer;touch-action:manipulation}
  #spEnd .again{background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00} #spEnd .done{background:linear-gradient(#b5a0ff,#7a52d6);color:#fff}
  @media (max-height:520px){
    #spTop{padding:3px 10px;gap:5px} #spTop i{width:34px;height:34px;font-size:20px} #spSay{top:calc(58px + env(safe-area-inset-top));font-size:21px;padding:5px 14px}
    #spBtn{width:100px;height:100px;font-size:50px;bottom:calc(18px + env(safe-area-inset-bottom))} #spX{width:54px;height:54px;font-size:24px}
    #spPrompt{bottom:calc(104px + env(safe-area-inset-bottom));width:84px;height:84px;font-size:38px;left:calc(50% - 112px)}
    #spEnd .p{padding:8px 20px 10px} #spEnd .tr{font-size:56px} #spEnd .ti{font-size:30px} #spEnd .sc{font-size:26px;margin:2px 0} #spEnd .st{font-size:34px}
    #spEnd .row{margin-top:8px} #spEnd button{min-height:60px;min-width:130px;font-size:26px}
  }`;
  document.head.appendChild(css);
  const el = (tag, id, cls, html) => { const e = document.createElement(tag); e.id = id; if (cls) e.className = cls; if (html) e.innerHTML = html; document.body.appendChild(e); return e; };
  const promptB = el('button', 'spPrompt', '', '🪄<span class="l">אֶתְגָּר</span>'); promptB.setAttribute('aria-label', 'אֶתְגָּר');
  const ov = el('div', 'spOv'), top = el('div', 'spTop'), xB = el('button', 'spX', 'gamebtn', '✕'), spB = el('button', 'spBtn', 'gamebtn', '🪄');
  const sayEl = el('div', 'spSay'), hand = el('div', 'spHand', '', '👆'), endOv = el('div', 'spEnd');
  xB.setAttribute('aria-label', 'יציאה'); spB.setAttribute('aria-label', 'לחש');

  // Spoken Hebrew, as quidditch.js speak() does (no recorded voices in the HD repo, no audio files).
  function speak(text) {
    try {
      if (window.HP && window.HP.sfx && window.HP.sfx.isMuted && window.HP.sfx.isMuted()) return;
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text.replace(/[—!]/g, ' ')); u.lang = 'he-IL'; u.rate = 0.92; u.pitch = 1.35;   // Flitwick: a little higher
      const v = (speechSynthesis.getVoices() || []).find(x => /^(he|iw)/i.test(x.lang)); if (v) u.voice = v;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { /* no speech here */ }
  }
  const hush = () => { try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch { /* ignore */ } };

  // ---- state ----
  const S = { on: false, key: null, C: null, phase: null, sub: null, step: 0, casts: 0, drops: 0, stars: 0, clock: 0, tCourse: 0, doneStations: 0,
    speed: 1, q: [], lifts: null, sel: null, hold: false, holdT: 0, idle: 0, walk: null, wantYaw: 0, fx: null, fxT: 0, sayT: 0, praise: 0, result: null };
  let K = null;                            // the built kit for the running course: { group, movers, lesson, stations, ... }
  let drag = null;
  const tmp = new Vector3(), tmp2 = new Vector3(), camPos = new Vector3(), camLook = new Vector3(), camPosGoal = new Vector3(), camLookGoal = new Vector3();
  const worldOff = new Vector3();

  function at(sec, fn) { S.q.push({ t: S.clock + sec, fn }); }
  function runQueue() {
    for (let i = 0; i < S.q.length; i++) { const it = S.q[i]; if (it.t <= S.clock) { S.q.splice(i, 1); i--; it.fn(); if (!S.on) return; } }
  }
  function flushUntil(cond) {       // test hooks: fast-forward scripted waits
    for (let guard = 0; guard < 40 && !cond() && S.q.length; guard++) {
      let k = 0; for (let i = 1; i < S.q.length; i++) if (S.q[i].t < S.q[k].t) k = i;
      const it = S.q.splice(k, 1)[0]; S.clock = Math.max(S.clock, it.t); it.fn(); if (!S.on) return;
    }
  }

  // ---- the teacher ----
  function prof() { return lessons.figure ? lessons.figure(S.C.station) : null; }
  function pose(name) { if (lessons.pose) lessons.pose(S.C.station, name); }
  function line(text, sec = 3.2, profPose = 'talk') {
    sayEl.textContent = '🧙‍♂️ ' + text; sayEl.classList.add('on'); S.sayT = sec;
    speak(text);
    const f = prof();
    if (f) { f.getWorldPosition(tmp); tmp.y += f.userData.labelY ? Math.min(2.4, f.userData.labelY) : 1.9; fun.say(tmp, text, sec, 'spell'); }
    if (profPose === 'cast') { if (!(lessons.signature && lessons.signature(S.C.station))) hop(); }
    else if (profPose) { pose(profPose); at(Math.max(1, sec - 0.6), () => pose(null)); }
  }
  let hopT = 0;
  function hop() { hopT = 0.6; }            // the chibi fallback's little flourish

  // ---- kit: build the course props into the room ----
  function buildKit(C, room) {
    const group = new Group(); group.name = 'spell-' + S.key;
    const solids = [], movers = {}, mats = [], geos = [], glowMats = [];
    const kit = {
      solid: (g) => solids.push(g),
      mesh(name, geo, o = {}) {
        const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: DoubleSide, emissive: new Color(o.glowHex || 0xffd27a), emissiveIntensity: 0 });
        const m = new Mesh(geo, mat); m.name = 'spell-' + name; m.frustumCulled = false; m.raycast = () => {}; group.add(m);
        mats.push(mat); geos.push(geo); if (o.glow !== false) glowMats.push(mat);
        movers[name] = { name, mesh: m, geo, mat, scale: 1, glows: o.glow !== false,
          pose(x, y, z, rx, ry, rz, s = 1) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.setScalar(s); },
          color(hex) { mat.color.setHex(hex); } };
      },
      inst(name, geo, n, colors, o = {}) {
        const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: DoubleSide, emissive: new Color(o.emissive || o.glowHex || 0xffd27a), emissiveIntensity: o.emissiveIntensity || 0 });
        const im = new InstancedMesh(geo, mat, n); im.name = 'spell-' + name; im.frustumCulled = false; im.raycast = () => {}; group.add(im);
        mats.push(mat); geos.push(geo); if (o.glow !== false) glowMats.push(mat);
        for (let i = 0; i < n; i++) {
          const s0 = (o.scales && o.scales[i]) || 1;
          im.setColorAt(i, _c.setHex(colors[i]));
          movers[name + i] = { name: name + i, mesh: im, geo, mat, scale: s0, glows: o.glow !== false, lit: false,
            pose(x, y, z, rx, ry, rz, s = 1) { _m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.setScalar(s * s0)); im.setMatrixAt(i, _m4); im.instanceMatrix.needsUpdate = true; },
            color(hex) { im.setColorAt(i, _c.setHex(hex)); im.instanceColor.needsUpdate = true; } };
        }
      },
    };
    const B = C.build(kit);
    if (solids.length) {
      const g = mergeGeometries(solids.map(p => p.index ? p.toNonIndexed() : p)); solids.forEach(p => p.dispose());
      const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
      const m = new Mesh(g, mat); m.name = 'spell-props'; m.raycast = () => {}; group.add(m); mats.push(mat); geos.push(g);
    }
    // the outline where the thing belongs + the sparkles
    const ghostMat = new MeshBasicMaterial({ color: 0xffe58a, transparent: true, opacity: 0.35, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const ghost = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), ghostMat); ghost.visible = false; ghost.frustumCulled = false; ghost.raycast = () => {}; ghost.renderOrder = 4; group.add(ghost);
    mats.push(ghostMat); geos.push(ghost.geometry);
    const NP = 64, pPos = new Float32Array(NP * 3), pGeo = new PlaneGeometry(1, 1);
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g2 = cv.getContext('2d'), gr = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.35, 'rgba(255,220,120,.85)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 32, 32);
    const pTex = new CanvasTexture(cv); pTex.colorSpace = SRGBColorSpace;
    // sparkles: camera-facing quads in ONE instanced mesh (PointsMaterial sizes are 1 px under WebGPURenderer)
    const pMat = new MeshBasicMaterial({ map: pTex, transparent: true, depthWrite: false, blending: AdditiveBlending, color: 0xffe9a0, side: DoubleSide });
    const sparks = new InstancedMesh(pGeo, pMat, NP); sparks.name = 'spell-sparkles'; sparks.frustumCulled = false; sparks.raycast = () => {}; sparks.renderOrder = 5; group.add(sparks);
    mats.push(pMat); geos.push(pGeo);
    const parts = []; for (let i = 0; i < NP; i++) parts.push({ mode: 0, a: Math.random() * 6.3, r: 0.25 + Math.random() * 0.2, sp: 1.5 + Math.random() * 2, y: Math.random(), vx: 0, vy: 0, vz: 0, x: 0, yy: 0, z: 0, life: 0 });
    // pre-sample every lift path (arc-length spaced), so update() only reads arrays
    const mkLift = (L) => {
      const mv = movers[L.m]; if (!mv) return null;
      const pts = L.path.map(p => new Vector3(p[0], p[1], p[2]));
      const N = 48, curve = new CatmullRomCurve3(pts, false, 'centripetal'), sp = curve.getSpacedPoints(N - 1), arr = new Float32Array(N * 3);
      sp.forEach((v, i) => { arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; });
      const rings = (L.rings || []).map(n => { const r = movers[n]; return r ? { mv: r, u: 0, ringIdx: n } : null; }).filter(Boolean);
      return { spec: L, mv, N, arr, rot0: L.rot0 || [0, 0, 0], rot1: L.rot1 || [0, 0, 0], p: 0, peak: 0, hover: 0, done: false, snap: -1, ph: Math.random() * 6, moved: false, rings };
    };
    const lesson = C.lesson.lifts.map(mkLift).filter(Boolean);
    const stations = C.course.stations.map(st => st.lifts.map(mkLift).filter(Boolean));
    room.group.add(group);
    group.updateMatrixWorld(true); group.getWorldPosition(worldOff);
    group.userData.onTeardown = () => { if (S.on && K && K.group === group) leave(false, true); };   // the room is being disposed (mid-traverse: do not detach)
    const k = { group, movers, mats, geos, B, ghost, ghostMat, sparks, pPos, pGeo, parts, pTex, lesson, stations };
    k.glowMats = glowMats;
    resetKit(k, true);
    // ring params: how far along the feather's path each ring sits (the sample nearest its centre)
    for (const set of stations) for (const L of set) for (const r of L.rings) {
      const i = Number(r.ringIdx.replace(/\D/g, ''));
      r.mv.mesh.getMatrixAt(i, _m4); _v.setFromMatrixPosition(_m4);
      let bi = 0, bd = 1e9; for (let s = 0; s < L.N; s++) { const d = (L.arr[s * 3] - _v.x) ** 2 + (L.arr[s * 3 + 1] - _v.y) ** 2 + (L.arr[s * 3 + 2] - _v.z) ** 2; if (d < bd) { bd = d; bi = s; } }
      r.u = bi / (L.N - 1);
    }
    return k;
  }
  function resetLift(L) { L.p = 0; L.peak = 0; L.hover = 0; L.done = false; L.snap = -1; L.moved = false; for (const r of L.rings) r.mv.lit = false; poseLift(L, 0); }
  function resetKit(k, lessonToo) {
    k.B.reset(k.movers);
    if (lessonToo) for (const L of k.lesson) resetLift(L);
    for (const set of k.stations) for (const L of set) resetLift(L);
  }
  function disposeKit(inTeardown = false) {
    if (!K) return;
    const k = K; K = null;
    if (k.group.parent && !inTeardown) k.group.parent.remove(k.group);
    k.group.userData.onTeardown = null;
    for (const g of k.geos) { try { g.dispose(); } catch { /* backend quirk */ } }
    for (const m of k.mats) { try { m.dispose(); } catch { /* backend quirk */ } }
    try { k.pTex.dispose(); } catch { /* ignore */ }
  }

  // ---- lifts ----
  function samplePath(L, p, out) {
    const f = Math.max(0, Math.min(1, p)) * (L.N - 1), i = Math.min(L.N - 2, f | 0), k = f - i, a = L.arr;
    return out.set(a[i * 3] + (a[i * 3 + 3] - a[i * 3]) * k, a[i * 3 + 1] + (a[i * 3 + 4] - a[i * 3 + 1]) * k, a[i * 3 + 2] + (a[i * 3 + 5] - a[i * 3 + 2]) * k);
  }
  function poseLift(L, t) {
    const e = L.p * L.p * (3 - 2 * L.p);
    samplePath(L, L.p, tmp2);
    const live = L.p > 0.01 && !L.done, bob = (L.spec.bob || live) ? Math.sin(t * 2.4 + L.ph) * (L.done ? 0.025 : 0.04) : 0;
    const fl = L.spec.flutter ? Math.sin(t * 4 + L.ph) * 0.3 * Math.min(1, L.p * 3) : 0;
    const r0 = L.rot0, r1 = L.rot1;
    L.mv.pose(tmp2.x, tmp2.y + bob, tmp2.z, r0[0] + (r1[0] - r0[0]) * e, r0[1] + (r1[1] - r0[1]) * e + (L.done && L.spec.flutter ? Math.sin(t * 0.8 + L.ph) * 0.3 : 0), r0[2] + (r1[2] - r0[2]) * e + fl);
  }
  const open = () => { if (!S.lifts) return null; for (const L of S.lifts) if (!L.done) return L; return null; };
  function select(L) { if (L && !L.done && S.sel !== L) { S.sel = L; fun.sfx.tink(2); } }
  function liftWorld(L, out) { samplePath(L, L.p, out); return out.add(worldOff); }
  function pick(x, y) {
    if (!S.lifts) return null;
    const R = Math.max(80, Math.min(innerWidth, innerHeight) * 0.13);   // >= 160 px across on every screen
    let best = null, bd = R;
    for (const L of S.lifts) {
      if (L.done) continue;
      liftWorld(L, tmp).project(camera); if (tmp.z > 1) continue;
      const d = Math.hypot((tmp.x * 0.5 + 0.5) * innerWidth - x, (-tmp.y * 0.5 + 0.5) * innerHeight - y);
      if (d < bd) { bd = d; best = L; }
    }
    return best;
  }
  function nudge(L, v) {                     // set a lift's progress from a gesture
    if (!L || L.done || L.snap >= 0) return;
    if (!L.moved && v > 0.02) { L.moved = true; player.play('Wave'); fun.sfx.whoosh(); }
    L.p = Math.max(0, Math.min(1, v)); L.hover = HOVER; if (L.p > L.peak) L.peak = L.p;
    S.idle = 0;
  }
  function snapLift(L) { if (L.done || L.snap >= 0) return; L.snap = 0; L.p = Math.max(L.p, SNAP); fun.sfx.chime(); }
  function liftDone(L) {
    L.done = true; L.p = 1; L.snap = -1; L.peak = 0; poseLift(L, S.clock);
    for (const r of L.rings) if (!r.mv.lit) { r.mv.lit = true; r.mv.color(0xffe07a); }
    S.casts++; if (S.sel === L) S.sel = null;
    liftWorld(L, tmp); burst(tmp.x - worldOff.x, tmp.y - worldOff.y, tmp.z - worldOff.z, 20);
    fun.sfx.sparkle(); fun.sfx.tune([1047, 1319, 1568], 0.09, 'sine');
    setPips();
    if (S.lifts.every(x => x.done)) setDone();
    else { line(S.C.praise[S.praise++ % S.C.praise.length], 1.8); }
  }
  function drop(L) {
    S.drops++; L.peak = 0; L.moved = false;
    line(S.C.oops, 1.8, null); fun.sfx.soft();
  }

  // ---- sparkles ----
  function burst(x, y, z, n) {
    let c = 0;
    for (const p of S.on && K ? K.parts : []) {
      if (p.mode === 1) continue;
      p.mode = 1; p.life = 0.7 + Math.random() * 0.5; p.x = x; p.yy = y; p.z = z;
      const a = Math.random() * 6.3, u = Math.random() * 2 - 1, sp = 1.2 + Math.random() * 1.6;
      p.vx = Math.cos(a) * Math.sqrt(1 - u * u) * sp; p.vy = Math.abs(u) * sp + 0.6; p.vz = Math.sin(a) * Math.sqrt(1 - u * u) * sp;
      if (++c >= n) break;
    }
  }
  function tickSparks(dt, t) {
    const k = K, pos = k.pPos;
    // orbiting sparkles: the not-yet-done lifts of the current set (the selected one gets most)
    let nOpen = 0; if (S.sub === 'cast' && S.lifts) for (const L of S.lifts) if (!L.done) nOpen++;
    let oi = 0;
    for (let i = 0; i < k.parts.length; i++) {
      const p = k.parts[i];
      if (p.mode === 1) {
        p.life -= dt; p.vy -= dt * 2.2; p.x += p.vx * dt; p.yy += p.vy * dt; p.z += p.vz * dt;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.yy; pos[i * 3 + 2] = p.z;
        if (p.life <= 0) p.mode = 0;
        continue;
      }
      if (nOpen && oi < 36) {
        // spread orbiters over the open lifts
        let target = null, j = oi % nOpen;
        for (const L of S.lifts) { if (L.done) continue; if (j-- === 0) { target = L; break; } }
        if (S.sel && !S.sel.done && oi % 3 !== 0) target = S.sel;
        oi++;
        samplePath(target, target.p, tmp2);
        const a = p.a + t * p.sp, r = p.r * (target === S.sel ? 1.25 : 1) * (target.mv.scale > 1.5 ? 1.6 : 1);
        pos[i * 3] = tmp2.x + Math.cos(a) * r; pos[i * 3 + 1] = tmp2.y + 0.1 + ((p.y + t * 0.35) % 1) * 0.45; pos[i * 3 + 2] = tmp2.z + Math.sin(a) * r;
      } else { pos[i * 3] = 0; pos[i * 3 + 1] = -60; pos[i * 3 + 2] = 0; }
    }
    const q = camera.quaternion;
    for (let i = 0; i < k.parts.length; i++) {
      const hidden = pos[i * 3 + 1] < -50, p = k.parts[i];
      const sz = hidden ? 0 : p.mode === 1 ? 0.2 * Math.min(1, p.life * 2) : 0.13 + Math.sin(t * 6 + p.a * 3) * 0.04;
      _m4.compose(_v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), q, _s.setScalar(sz)); k.sparks.setMatrixAt(i, _m4);
    }
    k.sparks.instanceMatrix.needsUpdate = true;
  }

  // ---- HUD ----
  let pipKey = '';
  function setPips() {
    if (!S.on) return;
    let html = '', key = S.phase + ':';
    if (S.phase === 'lesson') { const ls = K ? K.lesson : []; ls.forEach((L, i) => { const c = L.done ? 'on' : (open() === L ? 'cur' : ''); key += c + i; html += '<i class="' + c + '">🪶</i>'; }); }
    else { S.C.course.stations.forEach((st, i) => { const c = i < S.doneStations ? 'on' : i === S.step && S.phase === 'course' ? 'cur' : S.phase === 'reward' ? 'on' : ''; key += c + i; html += '<i class="' + c + '">' + st.icon + '</i>'; }); }
    if (key !== pipKey) { pipKey = key; top.innerHTML = html; }
  }
  function setBtn(on) { spB.classList.toggle('on', !!on); if (!on) { S.hold = false; spB.classList.remove('hold'); } }

  // ---- gestures ----
  const range = () => Math.max(110, Math.min(300, innerHeight * 0.3));
  ov.addEventListener('pointerdown', e => {
    if (!S.on || S.sub !== 'cast') return;
    e.preventDefault(); S.idle = 0;
    const hit = pick(e.clientX, e.clientY);
    if (hit) select(hit); else if (!S.sel || S.sel.done) select(open());
    drag = { id: e.pointerId, y0: e.clientY, p0: S.sel ? S.sel.p : 0, t0: performance.now(), moved: false, onTarget: !!hit };
    try { ov.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  ov.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id || !S.sel) return;
    const dy = drag.y0 - e.clientY;
    if (dy > 10 || drag.moved) { drag.moved = true; nudge(S.sel, drag.p0 + Math.max(0, dy - 10) / range()); if (S.sel && S.sel.p >= SNAP) snapLift(S.sel); }
  });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const L = S.sel, dy = drag.y0 - (e ? e.clientY : drag.y0), quick = performance.now() - drag.t0 < 350;
    if (L && !L.done) {
      if (drag.moved && quick && dy > 50) snapLift(L);                     // a quick flick up: the swish-and-flick
      else if (!drag.moved && drag.onTarget) nudge(L, L.p + TAP * 0.6);   // a tap on the thing: a little hop up
    }
    drag = null;
  };
  ov.addEventListener('pointerup', endDrag); ov.addEventListener('pointercancel', endDrag);
  spB.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    if (!S.on || S.sub !== 'cast') return;
    if (!S.sel || S.sel.done) select(open());
    S.hold = true; S.holdT = 0; S.idle = 0; spB.classList.add('hold');
    try { spB.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  const endHold = (e) => {
    if (e) e.stopPropagation();
    if (!S.hold) return;
    S.hold = false; spB.classList.remove('hold');
    if (S.holdT < 0.25 && S.sel) nudge(S.sel, S.sel.p + TAP);              // a tap: a third of the way up
  };
  spB.addEventListener('pointerup', endHold); spB.addEventListener('pointercancel', endHold);
  xB.addEventListener('click', e => { e.stopPropagation(); quit(); });

  // ---- flow ----
  function placeHero(x, z, yaw) {
    player.pos.set(x + worldOff.x, worldOff.y, z + worldOff.z); player.smoothY = player.pos.y; player._lastPos.copy(player.pos);
    player.yaw = yaw; S.wantYaw = yaw;
  }
  const yawTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);
  function camTo(c) { camPosGoal.set(c.pos[0], c.pos[1], c.pos[2]).add(worldOff); camLookGoal.set(c.look[0], c.look[1], c.look[2]).add(worldOff); }

  function startLesson() {
    const Ls = S.C.lesson;
    S.phase = 'lesson'; S.sub = 'intro'; S.step = 0; S.lifts = K.lesson; S.sel = null;
    placeHero(Ls.stand[0], Ls.stand[1], yawTo(Ls.stand[0], Ls.stand[1], Ls.face[0], Ls.face[1]));
    camTo(Ls.cam);
    setPips(); setBtn(false);
    let t = 0.4;
    for (const b of Ls.intro) {
      at(t, () => { line(b.line, b.t, b.pose); if (b.burst) { burst(b.burst[0], b.burst[1], b.burst[2], 18); fun.sfx.sparkle(); } });
      t += b.t;
    }
    at(t, beginCast);
  }
  function beginCast() { S.sub = 'cast'; S.idle = 0; S.sel = null; select(open()); setBtn(true); setPips(); }
  function setDone() {
    S.sub = 'after'; setBtn(false); hideHand(); S.sel = null;
    if (S.phase === 'lesson') {
      line(S.C.praise[0], 2.0); player.play('Cheer');
      at(2.2, () => { line(S.C.lesson.outro, 2.4); });
      at(4.4, () => startStation(0));
      return;
    }
    const st = S.C.course.stations[S.step];
    S.doneStations = S.step + 1; setPips();
    line(S.C.praise[S.praise++ % S.C.praise.length], 2.0);
    const fx = st.after && K.B.effects[st.after];
    if (fx) { S.fx = fx; S.fxT = 0; if (st.after === 'chestOpen') { fun.sfx.tada(); fun.confetti(['⭐', '🪙', '✨', '💛'], 18); } else fun.sfx.hoot(); }
    at(fx ? 2.8 : 1.6, () => { S.fx = null; if (S.step + 1 < S.C.course.stations.length) startStation(S.step + 1); else finish(); });
  }
  function startStation(i) {
    const st = S.C.course.stations[i];
    if (S.phase !== 'course') { S.phase = 'course'; S.tCourse = 0; }
    S.step = i; S.sub = 'walk'; S.lifts = K.stations[i]; S.sel = null; S.fx = null;
    S.walk = { pts: st.walk, i: 0 };
    camTo(st.cam); setPips(); setBtn(false); hideHand();
  }
  function arrive() {
    const st = S.C.course.stations[S.step];
    S.walk = null; S.sub = 'intro';
    const p = st.walk[st.walk.length - 1]; S.wantYaw = yawTo(p[0], p[1], st.face[0], st.face[1]);
    line(st.say, 2.6, 'talk');
    at(1.4, beginCast);
  }
  function finish() {
    S.phase = 'reward'; S.sub = 'reward'; setBtn(false); hideHand(); setPips();
    const C = S.C, three = S.tCourse <= C.course.star3 && S.drops <= 2;
    S.stars = three ? 3 : 2;
    award(S.stars);
    line(C.finale, 2.6, 'cast'); player.play('Cheer');
    fun.sfx.tada(); fun.confetti(['🪶', '⭐', '✨', '🌟', '💜'], 34);
    at(2.6, showReward);
  }
  function award(stars) {
    const rec = save[S.key] = save[S.key] || { stars: 0, plays: 0 };
    rec.stars = Math.max(rec.stars || 0, stars); rec.plays = (rec.plays || 0) + 1; persist();
    const pts = stars * 10;
    try { window.HPLessons.progress.bonus(pts); } catch { /* lessons not loaded */ }
    S.result = { stars, pts, t: Math.round(S.tCourse), drops: S.drops, casts: S.casts };
    return pts;
  }
  function showReward() {
    if (!S.on) return;
    const r = S.result, crest = CREST[fun.store.house] || CREST.gryf;
    endOv.innerHTML = '<div class="p"><div class="tr">' + S.C.spell.icon + '</div><div class="ti">' + (r.stars >= 3 ? 'כָּל הַכָּבוֹד!' : 'יָפֶה מְאֹד!') + '</div>'
      + '<div class="st">' + '⭐'.repeat(r.stars) + '☆'.repeat(3 - r.stars) + '</div><div class="sc">' + crest + ' +' + r.pts + '</div>'
      + '<div class="row"><button class="again">🔁 שׁוּב</button><button class="done">סִיּוּם</button></div></div>';
    endOv.querySelector('.again').addEventListener('click', e => { e.stopPropagation(); again(); });
    endOv.querySelector('.done').addEventListener('click', e => { e.stopPropagation(); leave(true); });
    endOv.classList.add('on'); speak(r.stars >= 3 ? 'כָּל הַכָּבוֹד! שָׁלוֹשׁ כּוֹכָבִים!' : 'יָפֶה מְאֹד!');
  }
  function again() {
    if (!S.on) return;
    endOv.classList.remove('on'); S.q.length = 0;
    resetKit(K, false); S.drops = 0; S.casts = 0; S.doneStations = 0; S.praise = 0; S.result = null; S.stars = 0; S.phase = 'course'; S.tCourse = 0;
    startStation(0);
  }

  // ---- start / leave ----
  const takeover = { spell: true, update };
  function start(key = 'charms') {
    const C = COURSES[key];
    if (!C || S.on || isModal() || isTakeover()) return false;
    if (interiors.active !== C.room || !interiors.room) return false;
    S.key = key; S.C = C;
    Object.assign(S, { on: true, phase: null, sub: null, step: 0, casts: 0, drops: 0, stars: 0, clock: 0, tCourse: 0, doneStations: 0, sel: null, hold: false, idle: 0, walk: null, fx: null, praise: 0, result: null });
    S.q.length = 0; pipKey = '';
    try { K = buildKit(C, interiors.room); } catch (e) { console.warn('[spells] course props failed -', e && e.message || e); K = null; S.on = false; return false; }
    setTakeover(takeover);
    document.body.classList.add('inSpell'); promptB.classList.remove('on');
    // things that follow you or roam the room hold still / hide while the course owns the frame
    for (const n of ['pip', 'trevor', 'peeves']) { const o = scene.getObjectByName(n); if (o) o.visible = false; }
    player._applyFade && player._applyFade(1);
    camPos.copy(camera.position); camera.getWorldDirection(tmp); camLook.copy(camera.position).addScaledVector(tmp, 6);
    fun.sfx.sparkle();
    startLesson();
    return true;
  }
  function leave(restore, inTeardown = false) {
    if (!S.on) return;
    const C = S.C;
    S.on = false; S.q.length = 0; drag = null; S.hold = false; S.walk = null; S.fx = null;
    hush(); hideHand(); setBtn(false);
    endOv.classList.remove('on'); sayEl.classList.remove('on');
    document.body.classList.remove('inSpell');
    try { pose(null); } catch { /* lessons gone */ }
    const f = prof(); if (f && f.userData.rig) f.position.y = 0;
    disposeKit(inTeardown);
    setTakeover(null);
    if (restore && interiors.active === C.room) {
      const st = lessons.stations && lessons.stations[C.station];
      if (st) { player.yaw = Math.PI; player.teleport(st.x + worldOff.x, st.z + 3.1 + worldOff.z); player.pos.y = worldOff.y; player.smoothY = worldOff.y; }
    }
  }
  function quit() {
    if (!S.on) return false;
    // left early after at least two stations: still a star (forgiving)
    if (S.phase === 'course' && S.doneStations >= 2 && !S.result) { const pts = award(1); fun.toast('⭐', '+' + pts, 1800); }
    leave(true);
    return true;
  }

  // ---- per frame (main.js takeover slot) ----
  function hideHand() { hand.classList.remove('on'); }
  function update(dt) {
    if (!S.on) return;
    if (!K || interiors.active !== S.C.room || !K.group.parent) { leave(false); return; }
    dt *= S.speed;                         // 1 in play; tests on a slow software renderer may raise it
    S.clock += dt; const t = S.clock;
    if (S.phase === 'course' && S.sub !== 'reward') S.tCourse += dt;
    runQueue(); if (!S.on) return;
    if (S.sayT > 0) { S.sayT -= dt; if (S.sayT <= 0) sayEl.classList.remove('on'); }

    // hero: auto-walk between stations, else turn to the work
    let moving = false;
    if (S.walk) {
      const w = S.walk, p = w.pts[w.i], tx = p[0] + worldOff.x, tz = p[1] + worldOff.z, dx = tx - player.pos.x, dz = tz - player.pos.z, d = Math.hypot(dx, dz), step = WALK * dt;
      if (d <= step) { player.pos.x = tx; player.pos.z = tz; if (++w.i >= w.pts.length) arrive(); }
      else { player.pos.x += dx / d * step; player.pos.z += dz / d * step; S.wantYaw = Math.atan2(dx, dz); moving = true; }
    }
    let dy = S.wantYaw - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); player.yaw += dy * Math.min(1, dt * (moving ? 10 : 5));
    player._moving = moving;
    player.animate(dt, { moving, running: false }, moving ? WALK : 0);
    player.model.position.copy(player.pos); player.model.rotation.y = player.yaw;
    player._lastPos.copy(player.pos);

    // the teacher turns to the child; GLB clips keep playing (lessons.anim), the chibi breathes
    const f = prof();
    if (f) {
      const ud = f.userData;
      if (!ud.casting) { f.getWorldPosition(tmp); let fy = Math.atan2(player.pos.x - tmp.x, player.pos.z - tmp.z) - f.rotation.y; fy = Math.atan2(Math.sin(fy), Math.cos(fy)); f.rotation.y += fy * Math.min(1, dt * 3); }
      if (ud.rig) { animateChibi(ud.rig, dt, { moving: false }); if (hopT > 0) { hopT -= dt; f.position.y = Math.sin((1 - hopT / 0.6) * Math.PI) * 0.35; } else f.position.y = 0; }
    }
    if (lessons.anim) lessons.anim(dt);

    // lifts
    if (S.hold) S.holdT += dt;
    if (S.sub === 'cast') {
      S.idle += dt;
      if (S.hold && S.sel && !S.sel.done && S.holdT >= 0.25) { nudge(S.sel, S.sel.p + dt / HOLD); if (S.sel.p >= SNAP) snapLift(S.sel); }
    }
    for (let s = -1; s < K.stations.length; s++) {
      const set = s < 0 ? K.lesson : K.stations[s];
      for (let j = 0; j < set.length; j++) {
        const L = set[j];
        if (!L.done && L.snap >= 0) { L.snap += dt; L.p = Math.min(1, L.p + dt * 2.4); if (L.p >= 1 || L.snap > 0.4) { liftDone(L); if (!S.on) return; continue; } }
        else if (!L.done && L.p > 0 && !(drag && S.sel === L) && !(S.hold && S.sel === L)) {
          if (L.p >= SNAP) snapLift(L);
          else { L.hover -= dt; if (L.hover <= 0) { L.p -= dt * FALL; if (L.p <= 0) { L.p = 0; if (L.peak >= 0.3) drop(L); else L.peak = 0; L.moved = false; } } }
        }
        // rings light as the feather passes them (and stay lit)
        for (const r of L.rings) if (!r.mv.lit && L.p >= r.u) { r.mv.lit = true; r.mv.color(0xffe07a); fun.sfx.tink(3); }
        poseLift(L, t);
      }
    }
    K.B.tick(K.movers, t);
    if (S.fx) { S.fxT += dt; if (!S.fx(K.movers, S.fxT)) S.fx = null; }

    // glow, outline, ghost hand
    const pulse = 0.55 + Math.sin(t * 5) * 0.35;
    for (const m of K.glowMats) m.emissiveIntensity = 0;
    const cur = S.sub === 'cast' ? (S.sel && !S.sel.done ? S.sel : open()) : null;
    if (S.sub === 'cast' && S.lifts) for (const L of S.lifts) if (!L.done) L.mv.mat.emissiveIntensity = pulse;
    if (cur) {
      const g = K.ghost; if (g.geometry !== cur.mv.geo) g.geometry = cur.mv.geo;
      const a = cur.arr, n = (cur.N - 1) * 3, r1 = cur.rot1;
      g.position.set(a[n], a[n + 1], a[n + 2]); g.rotation.set(r1[0], r1[1], r1[2]); g.scale.setScalar(cur.mv.scale * 1.06);
      K.ghostMat.opacity = 0.42 + Math.sin(t * 4) * 0.16; g.visible = true;
    } else K.ghost.visible = false;
    if (cur && S.idle > HINT_AFTER && cur.p < 0.05) {
      liftWorld(cur, tmp).project(camera);
      hand.style.left = ((tmp.x * 0.5 + 0.5) * innerWidth) + 'px'; hand.style.top = ((-tmp.y * 0.5 + 0.5) * innerHeight) + 'px';
      if (!hand.classList.contains('on')) { hand.classList.add('on'); }
    } else if (hand.classList.contains('on')) hideHand();
    if (S.sub === 'cast') setPips();
    tickSparks(dt, t);

    // a gentle camera: eased toward the station's framing, never a cut, never a shake
    const kc = 1 - Math.exp(-dt * 1.8);
    camPos.lerp(camPosGoal, kc); camLook.lerp(camLookGoal, kc);
    camera.position.copy(camPos); camera.lookAt(camLook);
  }

  // ---- outside the course: the 🪄 challenge prompt next to the lesson ▶ ----
  promptB.addEventListener('click', e => { e.stopPropagation(); fun.sfx.squeak(); const k = promptB.dataset.k; if (k) start(k); });
  let promptOn = false;
  function idle() {
    let k = null;
    if (!S.on && !isModal() && !isTakeover() && interiors.active) {
      const near = lessons.near && lessons.near();
      if (near && fun.promptId() === 'lesson:' + near) for (const key in COURSES) if (COURSES[key].station === near && COURSES[key].room === interiors.active) { k = key; break; }
    }
    if (!!k !== promptOn || (k && promptB.dataset.k !== k)) { promptOn = !!k; promptB.classList.toggle('on', promptOn); if (k) promptB.dataset.k = k; }
  }

  // ---- the 🔔 picker card ----
  function pickerCard(key) {
    const C = COURSES[key];
    return {
      key, icon: '🪄', name: C.name, best: () => best(key),
      fn: async () => {
        if (S.on) return;
        await lessons.go(C.station);
        setTimeout(() => start(key), 500);
      },
    };
  }

  const api = {
    courses: COURSES, start, quit, idle, pickerCard, best,
    state() {
      return { on: S.on, key: S.key, phase: S.on ? S.phase : null, sub: S.on ? S.sub : null, step: S.step, casts: S.casts, drops: S.drops, stars: S.stars,
        best: S.key ? best(S.key) : 0, t: Math.round(S.tCourse * 10) / 10, doneStations: S.doneStations, result: S.result,
        lifts: S.lifts ? S.lifts.map(L => ({ p: Math.round(L.p * 100) / 100, done: L.done })) : null, prompt: promptOn };
    },
    // test hooks
    _cast() {
      if (!S.on || S.phase === 'reward') return false;
      if (S.sub === 'walk' && S.walk) { const w = S.walk, p = w.pts[w.pts.length - 1]; player.pos.x = p[0] + worldOff.x; player.pos.z = p[1] + worldOff.z; arrive(); }
      flushUntil(() => S.sub === 'cast');
      const L = (S.sel && !S.sel.done) ? S.sel : open(); if (!L) return false;
      L.moved = true; liftDone(L); return true;
    },
    _drop() {
      if (!S.on || S.sub !== 'cast') return false;
      const L = (S.sel && !S.sel.done) ? S.sel : open(); if (!L) return false;
      L.p = 0; drop(L); return true;
    },
    _skipTo(step) {
      if (!S.on || !K) return false;
      S.q.length = 0; endOv.classList.remove('on');
      for (const L of K.lesson) if (!L.done) { L.done = true; L.p = 1; }
      const n = S.C.course.stations.length;
      for (let i = 0; i < Math.min(step, n); i++) for (const L of K.stations[i]) { L.done = true; L.p = 1; for (const r of L.rings) { r.mv.lit = true; r.mv.color(0xffe07a); } }
      if (S.phase !== 'course') { S.phase = 'course'; S.tCourse = 0; }
      S.doneStations = Math.min(step, n);
      if (step >= n) { finish(); return true; }
      startStation(step); return true;
    },
    _flush() { flushUntil(() => false); },
    _speed(k) { S.speed = Math.max(0.1, Math.min(8, +k || 1)); return S.speed; },
    _target() {                            // screen point of the thing to lift now (for real-touch tests)
      if (!S.on || !S.lifts) return null;
      const L = (S.sel && !S.sel.done) ? S.sel : open(); if (!L) return null;
      liftWorld(L, tmp).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * innerWidth, y: (-tmp.y * 0.5 + 0.5) * innerHeight, p: L.p };
    },
    get _kit() { return K; },
  };
  fun.mods.spells = api;
  return api;
}
