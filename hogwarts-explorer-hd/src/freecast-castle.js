// Free-play spells, batch 3 (freecast.js): five new spells (Petrificus Totalus lives with the dummies in
// freecast-duel.js) and three new spots around the castle, so the wheel works beyond the practice corner.
//   Lumos Maxima: a big ball of light flies up from the wand and lights the area round Harry (~6 s), then fades.
//                 ONE point light (made at start-up with intensity 0, so no shader rebuild ever) + a sprite + a floor pool.
//   Engorgio / Reducio: grow / shrink a prop one step (small, normal, huge) with a bouncy scale; anywhere else the
//                 wand-tip sparkle swells / shrinks.
//   Avis:         a little flock of six code-built birds bursts from the wand, circles Harry and flies away.
//   Orchideous:   a bunch of flowers pops out of the wand; aimed at an empty vase or flower pot, flowers bloom in it
//                 and stay for the session.
// Spots (room-local x,z indoors, world outdoors; every old spell reuses its old handler through TARGETS):
//   Entrance Hall (built into the room each time it streams in): east side a brazier (Incendio / Aguamenti),
//     a locked chest (Alohomora: +5 house points once per session, sparkles after), a teapot on a little table
//     (Engorgio / Reducio); west side a knight's helmet in pieces by its stand (Reparo), an empty vase on a
//     pedestal (Orchideous), a stack of books on a stool (Leviosa / Accio).   3 draw calls.
//   Library (the same way): a candelabra under the south-east window (Incendio / Aguamenti), an empty flower pot
//     under the north-east window (Orchideous, then Aguamenti makes the flowers grow), a giant book on a lectern
//     (Engorgio / Reducio / Leviosa / Accio).   3 draw calls.
//   Hagrid's pumpkin patch (grounds-film.js 'hut-pumpkins', the real instanced pumpkins): Engorgio, Reducio,
//     Aguamenti (grows one step), Leviosa.   0 new draw calls.
// Shared effects: ball + pool (2 calls while lit), swell sprite (1, briefly), birds (2 while flying), bouquet (1).
// Nothing is allocated per frame; everything new is pooled or built once (rooms: once per visit).
import {
  Group, Mesh, InstancedMesh, PlaneGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry,
  LatheGeometry, ShapeGeometry, Shape, Vector2, Vector3, Quaternion, Euler, Matrix4, Color, PointLight,
  MeshBasicMaterial, MeshStandardMaterial, AdditiveBlending, DoubleSide, SkinnedMesh, Skeleton, Bone,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plain, bone, paint, place, rod } from './freecast-corner.js';

// ---- spot coordinates (room-local x,z; floor y 0) ----
export const HALL = {
  brazier: { x: 6.3, z: -3.6 }, chest: { x: 5.6, z: -5.6 }, teapot: { x: 6.8, z: -7.4 },
  helmet: { x: -6.3, z: -3.8 }, vase: { x: -5.6, z: -5.8 }, books: { x: -6.8, z: -7.6 },
};
export const LIB = { candles: { x: 9.7, z: -3.6 }, pot: { x: 9.8, z: 3.6 }, lectern: { x: 7.2, z: 0 } };

const _m4 = new Matrix4(), _m5 = new Matrix4(), _q = new Quaternion(), _q2 = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const backOut = (k) => { k = Math.min(1, Math.max(0, k)); const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const bouncy = (k) => (k >= 1 ? 1 : 1 - Math.exp(-5 * k) * Math.cos(k * 11));   // overshoots, wobbles, settles at 1
const M = (g) => mergeGeometries(g.map(plain));
const STEEL = 0x8a929e, STEEL2 = 0xd4dae2, WOOD = 0x6a4424, DARK = 0x3e2816, IRON = 0x34303a, STONE = 0x8a7f72, STONE2 = 0xb9ab93, GOLD = 0xd8b04a;

function starGeo(r = 0.2) {
  const s = new Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  return paint(new ShapeGeometry(s), 0xffe27a, 0xffb820);
}
// a bunch of flowers, stems from the origin up (~0.36 m); wrap: a paper cone round the stems (the wand bouquet)
function bouquetGeo(pal, wrap = false) {
  const P = [], N = pal.length;
  if (wrap) { const c = new ConeGeometry(0.075, 0.2, 9, 1, true); c.rotateX(Math.PI); c.translate(0, 0.1, 0); P.push(paint(c, 0xe85a9a, 0xffb0d8)); }
  for (let i = 0; i < N; i++) {
    const a = i * 2.39996, r = i === 0 ? 0 : 0.055 + (i % 2) * 0.03, h = 0.3 + ((i * 7) % 5) * 0.018, tx = Math.cos(a) * r * 1.5, tz = Math.sin(a) * r * 1.5;
    P.push(paint(rod([Math.cos(a) * r * 0.2, 0, Math.sin(a) * r * 0.2], [tx, h, tz], 0.008, 0.007, 4), 0x2e6a22, 0x4a9a34));
    P.push(paint(place(new SphereGeometry(0.03, 6, 4), tx, h + 0.005, tz), 0xffd23f));
    for (let k = 0; k < 5; k++) { const b = k * Math.PI * 2 / 5 + a; P.push(paint(place(new SphereGeometry(0.04, 5, 3), tx + Math.cos(b) * 0.042, h, tz + Math.sin(b) * 0.042, 0, -b, 0, 1.25, 0.32, 0.75), pal[i])); }
    if (i % 2) P.push(paint(place(new SphereGeometry(0.045, 5, 3), tx * 0.5 + 0.03, h * 0.45, tz * 0.5, 0, a, -0.7, 1, 0.22, 0.5), 0x3a8a2a));
  }
  return M(P);
}
const PAL_WAND = [0xff5a8a, 0xffd040, 0xa86adf, 0xff7a3a, 0xfff4e0, 0x5aa8ff, 0xff9ad8];
const PAL_VASE = [0xe8473a, 0xff7ab8, 0xfff4e0, 0xf2c230, 0xff9ad8, 0xe8473a, 0xffffff];
const PAL_POT = [0x7a5ae0, 0x5a8aff, 0xc89aff, 0x9ad0ff, 0x7a5ae0, 0xffe27a, 0xb07ae8];

// ---- a small kit for a spot: static parts merge into one mesh, every moving part is a bone of one skinned mesh ----
function spotKit(name) {
  const stat = [], mov = [], bones = [];
  return {
    S: (g) => stat.push(plain(g)),
    B: (idx, x, y, z) => { const b = new Bone(); b.name = name + idx; b.position.set(x, y, z); bones[idx] = b; return b; },
    P: (g, idx) => mov.push(bone(g, idx)),
    finish(parent, extra = []) {
      const group = new Group(); group.name = name;
      const statMesh = new Mesh(mergeGeometries(stat), new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: DoubleSide }));
      statMesh.name = name + '-static'; statMesh.castShadow = true; statMesh.receiveShadow = true; group.add(statMesh);
      const skin = new SkinnedMesh(mergeGeometries(mov), new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: DoubleSide }));
      skin.name = name + '-props'; skin.castShadow = true; skin.frustumCulled = false;
      for (const b of bones) skin.add(b);
      group.add(skin);
      for (const o of extra) group.add(o);
      parent.add(group); group.updateMatrixWorld(true);
      skin.bind(new Skeleton(bones));
      for (const o of [statMesh, skin, ...extra]) o.raycast = () => {};
      group.userData.onTeardown = () => { for (const o of [statMesh, skin, ...extra]) { try { o.material.dispose(); } catch { /* backend quirk */ } } };
      const rest = bones.map(b => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }));
      return { group, statMesh, skin, bones, rest };
    },
  };
}
// additive camera-facing flames (n instances), posed by the fire ticks below
function flameMesh(n, tex, name) {
  const f = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }), n);
  f.name = name; f.frustumCulled = false; f.visible = false; f.renderOrder = 3;
  for (let i = 0; i < n; i++) f.setMatrixAt(i, _m4.makeScale(0, 0, 0));
  return f;
}

export function createCastle({ scene, camera, player, interiors, env, fun, emit, burst, stream, bolt, boltAhead, tip, tipV, glowTex, best, BYKEY }) {
  const pos = player.pos;
  let T = 0;
  const targets = [];
  const SP = {};
  const v0 = new Vector3(), v1 = new Vector3(), v2 = new Vector3(), tv = new Vector3(), _rw = new Vector3();
  const col = (k) => BYKEY[k].col;

  // ======================= shared state machines =======================
  // grow/shrink: level -1 small, 0 normal, 1 huge; f = the current scale factor (bouncy tween)
  function newScal(sizes) { return { level: 0, f: 1, from: 1, to: 1, t: 1, pend: 0, sizes, grows: 0, shrinks: 0, maxF: 1, minF: 1 }; }
  function stepScal(s, dir) {   // dir +1 / -1; returns false at the end of the range
    const n = s.level + dir; if (n < -1 || n > 1) return false;
    s.level = n; s.from = s.f; s.to = s.sizes[n + 1]; s.t = -0.35; if (dir > 0) s.grows++; else s.shrinks++;
    return true;
  }
  function tickScal(s, dt) {   // returns true while animating
    if (s.t >= 1) return false;
    s.t += dt / 0.8; if (s.t < 0) return true;
    s.f = s.from + (s.to - s.from) * bouncy(Math.min(1, s.t)); if (s.t >= 1) s.f = s.to;
    s.maxF = Math.max(s.maxF, s.f); s.minF = Math.min(s.minF, s.f);
    return true;
  }
  // Leviosa (float, bob, spin, set down) and Accio (fly to Harry, hover, go home): the world offset + a spin
  function newMover() { return { mode: null, t: 0, maxRise: 0, floats: 0, accios: 0, reached: 0, returned: 0, reachedNow: false, from: new Vector3(), off: new Vector3(), ang: 0, tilt: 0 }; }
  const startMover = (m, k) => { m.mode = k === 'accio' ? 'accio' : 'float'; m.t = -0.35; m.maxRise = 0; };
  const FL = 5.9, AA = 0.9, AH = 3.0, AR = 1.1;
  function hoverPoint(out) { const f = player.yaw; tip(); return out.set(tipV.x + Math.sin(f) * 0.55, pos.y + 1.2 * player.model.scale.y, tipV.z + Math.cos(f) * 0.55); }
  // restW: the prop's resting world position; writes m.off (world offset from rest) and m.ang; false when idle
  function tickMover(m, dt, restW, hex) {
    if (!m.mode) return false;
    m.t += dt; const t = m.t;
    if (t < 0) { m.off.set(0, 0, 0); m.ang = 0; m.tilt = 0; return true; }
    if (m.mode === 'float') {
      const y = t < 1 ? ease(t) * 1.3 : t < 4.6 ? 1.3 + Math.sin((t - 1) * 3) * 0.12 : 1.3 * (1 - ease((t - 4.6) / 1.3));
      m.off.set(0, y, 0); m.maxRise = Math.max(m.maxRise, y);
      m.ang = Math.PI * 4 * ease(Math.min(t, FL) / FL); m.tilt = Math.sin(t * 2.3) * 0.25 * Math.sin(Math.PI * Math.min(1, t / FL));
      if (Math.random() < dt * 8) emit(restW.x + (Math.random() - 0.5) * 0.4, restW.y + y, restW.z + (Math.random() - 0.5) * 0.4, 0, -0.2, 0, 0.8, 0.18, hex || 0xd8c8ff);
      if (t >= FL) { m.mode = null; m.floats++; m.off.set(0, 0, 0); m.ang = 0; m.tilt = 0; fun.sfx.soft(); }
      return true;
    }
    if (t < AA) { const k = ease(t / AA); hoverPoint(v2); v1.lerpVectors(restW, v2, k); v1.y += Math.sin(k * Math.PI) * 1.0; m.ang = k * Math.PI * 2; }
    else if (t < AA + AH) {
      if (!m.reachedNow) { m.reachedNow = true; m.reached++; hoverPoint(v2); fun.sfx.pop(); burst(v2.x, v2.y, v2.z, 0x9ad8ff, 10, 1.2, 0.5, 0.18, 0); }
      hoverPoint(v1); v1.y += Math.sin((t - AA) * 3.2) * 0.08; m.ang = (t - AA) * 1.2; m.from.copy(v1);
    } else { const k = ease((t - AA - AH) / AR); v1.lerpVectors(m.from, restW, k); v1.y += Math.sin(k * Math.PI) * 0.9; m.ang = (1 - k) * AH * 1.2; }
    m.off.copy(v1).sub(restW); m.tilt = 0;
    if (Math.random() < dt * 10) emit(v1.x, v1.y, v1.z, 0, 0.1, 0, 0.6, 0.16, 0x9ad8ff);
    if (t >= AA + AH + AR) { m.mode = null; m.reachedNow = false; m.returned++; m.accios++; m.off.set(0, 0, 0); m.ang = 0; fun.sfx.soft(); }
    return true;
  }
  // fires (a brazier, a candelabra): Incendio lights after the sparks land, Aguamenti puts out
  function newFire() { return { lit: false, k: 0, pend: 0, out: 0, lights: 0, douses: 0 }; }
  function fireCast(f, k) { if (k === 'incendio') f.pend = 0.4; else f.out = 1.0; }
  function tickFireState(f, dt, spotsW) {
    if (f.pend > 0) { f.pend -= dt; if (f.pend <= 0) { f.pend = 0; f.lit = true; f.lights++; for (const p of spotsW) burst(p.x, p.y, p.z, 0xff9a30, 14, 2, 0.7, 0.22, 1); fun.sfx.whoosh(); fun.sfx.boom(); } }
    if (f.out > 0) { f.out -= dt; if (f.out <= 0.45 && f.lit) { f.lit = false; f.douses++; for (const p of spotsW) for (let n = 0; n < 8; n++) emit(p.x + (Math.random() - 0.5) * 0.3, p.y, p.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3, 1.4, 0.4, 0x707a84, 0.2, 0.5); fun.sfx.noise(0.7, 0.14, 0, 3000, 0.8, 'highpass'); } if (f.out < 0) f.out = 0; }
    f.k += ((f.lit ? 1 : 0) - f.k) * Math.min(1, dt * (f.lit ? 5 : 8));
  }
  const fireOk = (f, k) => (k === 'incendio' ? !f.lit && !f.pend : f.lit && !f.out);

  // ======================= the Entrance Hall spot =======================
  const HS = {   // session state (survives leaving and re-entering the hall; not saved)
    chest: { state: 'locked', t: 0, opens: 0, paid: 0, popped: false, rewarded: false, paidSession: false },
    fire: newFire(),
    helmet: { state: 'broken', t: 0, mends: 0, breaks: 0 },
    vase: { bloomed: false, k: 0, pend: 0, blooms: 0 },
    books: newMover(),
    teapot: newScal([0.45, 1, 2.3]),
  };
  const HB = { lid: 0, lock: 1, reward: 2, domeL: 3, domeR: 4, visor: 5, plume: 6, flowers: 7, books: 8, teapot: 9 };
  const NHP = 4;   // helmet pieces (bones 3..6)
  let hall = null;   // the live build: { room, kit..., origin }
  const HCtr = { x: HALL.helmet.x, y: 1.36, z: HALL.helmet.z };
  const helmetBroken = [];
  for (let i = 0; i < NHP; i++) {
    const a = i * 1.6 + 0.5, r = 0.55 + (i % 2) * 0.18;
    helmetBroken.push({ p: new Vector3(HCtr.x + Math.cos(a) * r, i === 3 ? 0.06 : 0.16, HCtr.z + Math.sin(a) * r + 0.25),
      q: new Quaternion().setFromEuler(new Euler(i === 2 ? -1.45 : 0.25 * i, a * 1.7, i === 0 ? 1.5 : i === 1 ? -1.5 : i === 3 ? 1.57 : 0)) });
  }
  function buildHall(room) {
    const K = spotKit('freecast-hall');
    const { S, B, P } = K;
    // --- east: the brazier ---
    const BZ = HALL.brazier;
    S(paint(place(new CylinderGeometry(0.3, 0.35, 0.12, 12), BZ.x, 0.06, BZ.z), STONE, STONE2));
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + 0.3; S(paint(rod([BZ.x + Math.cos(a) * 0.25, 0.1, BZ.z + Math.sin(a) * 0.25], [BZ.x + Math.cos(a) * 0.15, 0.78, BZ.z + Math.sin(a) * 0.15], 0.025, 0.02, 6), IRON, 0x5a5560)); }
    S(paint(place(new LatheGeometry([[0.06, 0], [0.24, 0.08], [0.34, 0.22], [0.37, 0.27]].map(([r, y]) => new Vector2(r, y)), 14), BZ.x, 0.74, BZ.z), IRON, 0x5a5560));
    S(paint(place(new TorusGeometry(0.37, 0.025, 5, 18), BZ.x, 1.01, BZ.z, Math.PI / 2), GOLD));
    for (const r of [0.4, -0.7, 1.6]) S(paint(place(new BoxGeometry(0.42, 0.07, 0.08), BZ.x, 0.95, BZ.z, 0, r, 0.1), 0x2a1a10, 0x4a3018));
    // --- east: the locked chest (lid + lock + reward star are bones) ---
    const CH = HALL.chest;
    S(paint(place(new BoxGeometry(0.8, 0.42, 0.5), CH.x, 0.23, CH.z), 0x4a2a5a, 0x6a3e7a));
    for (const dx of [-0.3, 0.3]) S(paint(place(new BoxGeometry(0.07, 0.43, 0.51), CH.x + dx, 0.235, CH.z), GOLD));
    S(paint(place(new BoxGeometry(0.62, 0.04, 0.36), CH.x, 0.43, CH.z), 0xffd23f));
    for (const dx of [-0.34, 0.34]) for (const dz of [-0.19, 0.19]) S(paint(place(new BoxGeometry(0.08, 0.05, 0.08), CH.x + dx, 0.025, CH.z + dz), DARK));
    const hinge = [CH.x, 0.44, CH.z - 0.25]; B(HB.lid, ...hinge);
    P(paint(place(new BoxGeometry(0.82, 0.13, 0.52), hinge[0], hinge[1] + 0.065, hinge[2] + 0.26), 0x6a3e7a, 0x7a4a8a), HB.lid);
    for (const dx of [-0.3, 0.3]) P(paint(place(new BoxGeometry(0.075, 0.14, 0.53), hinge[0] + dx, hinge[1] + 0.07, hinge[2] + 0.26), GOLD), HB.lid);
    P(paint(place(starGeo(0.07), hinge[0], hinge[1] + 0.136, hinge[2] + 0.26, -Math.PI / 2, 0, 0), 0xffe27a), HB.lid);
    const LK = [CH.x, 0.38, CH.z + 0.27]; B(HB.lock, ...LK);
    P(paint(place(new BoxGeometry(0.13, 0.14, 0.05), LK[0], LK[1], LK[2]), 0xffd86a, 0xc8962a), HB.lock);
    P(paint(place(new TorusGeometry(0.045, 0.014, 6, 12, Math.PI), LK[0], LK[1] + 0.07, LK[2]), 0xe8c050), HB.lock);
    P(paint(place(new BoxGeometry(0.025, 0.05, 0.02), LK[0], LK[1] - 0.01, LK[2] + 0.03), 0x2a1a10), HB.lock);
    const RW = [CH.x, 0.4, CH.z]; B(HB.reward, ...RW);
    P(place(starGeo(0.2), RW[0], RW[1], RW[2]), HB.reward);
    P(paint(place(new SphereGeometry(0.06, 8, 6), RW[0], RW[1], RW[2]), 0xfff2b0), HB.reward);
    // --- east: the teapot on a little round table (Engorgio / Reducio; the bone sits at the pot's foot) ---
    const TP = HALL.teapot;
    S(paint(place(new CylinderGeometry(0.33, 0.33, 0.04, 16), TP.x, 0.72, TP.z), WOOD, 0x8a5a2e));
    S(paint(rod([TP.x, 0.04, TP.z], [TP.x, 0.7, TP.z], 0.04, 0.035, 8), DARK, WOOD));
    S(paint(place(new CylinderGeometry(0.2, 0.24, 0.05, 12), TP.x, 0.025, TP.z), DARK, WOOD));
    const TB = [TP.x, 0.74, TP.z]; B(HB.teapot, ...TB);
    {
      const pp = [];
      pp.push(paint(new LatheGeometry([[0.001, 0], [0.09, 0], [0.14, 0.04], [0.16, 0.11], [0.14, 0.18], [0.08, 0.215], [0.001, 0.215]].map(([r, y]) => new Vector2(r, y)), 16), 0xf4ecf4, 0xffb8d8));
      pp.push(paint(place(new TorusGeometry(0.158, 0.012, 5, 18), 0, 0.11, 0, Math.PI / 2), GOLD));
      pp.push(paint(place(new SphereGeometry(0.03, 8, 6), 0, 0.235, 0), GOLD));
      pp.push(paint(rod([-0.12, 0.07, 0], [-0.27, 0.2, 0], 0.03, 0.014, 7), 0xf4ecf4, 0xffb8d8));
      pp.push(paint(place(new TorusGeometry(0.065, 0.016, 5, 10, Math.PI * 1.25), 0.14, 0.12, 0, 0, 0, -Math.PI * 0.62), 0xf4ecf4, 0xffb8d8));
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; pp.push(paint(place(new SphereGeometry(0.028, 6, 4), Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15, 0, -a, 0, 0.4, 1, 1), 0xe8475a)); }
      P(M(pp).translate(...TB), HB.teapot);
    }
    // --- west: the knight's helmet in four pieces by its stand (Reparo) ---
    const HM = HALL.helmet;
    for (const r of [0, Math.PI / 2]) S(paint(place(new BoxGeometry(0.6, 0.06, 0.1), HM.x, 0.03, HM.z, 0, r, 0), DARK, WOOD));
    S(paint(rod([HM.x, 0.05, HM.z], [HM.x, 1.18, HM.z], 0.04, 0.035, 8), DARK, WOOD));
    S(paint(place(new CylinderGeometry(0.07, 0.05, 0.05, 10), HM.x, 1.2, HM.z), GOLD));
    for (let i = 0; i < NHP; i++) B(HB.domeL + i, HCtr.x, HCtr.y, HCtr.z);
    const HC = [HCtr.x, HCtr.y, HCtr.z];
    for (const [i, phi] of [[0, Math.PI * 1.5], [1, Math.PI / 2]]) P(paint(place(new SphereGeometry(0.17, 12, 8, phi, Math.PI, 0, Math.PI * 0.6), HC[0], HC[1], HC[2], 0, 0, 0, 1, 1.12, 1.08), STEEL, STEEL2), HB.domeL + i);
    P(paint(place(new BoxGeometry(0.018, 0.2, 0.36), HC[0], HC[1] + 0.1, HC[2], 0.05, 0, 0), STEEL2, 0xf0f4f8), HB.domeR);   // the crest ridge
    {
      const vp = [];
      vp.push(paint(place(new CylinderGeometry(0.172, 0.16, 0.16, 14, 1, true, -1.0, 2.0), 0, -0.08, 0), STEEL, STEEL2));
      for (const y of [-0.04, -0.1]) vp.push(paint(place(new BoxGeometry(0.2, 0.016, 0.02), 0, y, 0.168), 0x1a1a22));
      vp.push(paint(place(new TorusGeometry(0.15, 0.02, 5, 16), 0, -0.165, 0, Math.PI / 2), STEEL, STEEL2));
      for (const sx of [-1, 1]) vp.push(paint(place(new SphereGeometry(0.018, 6, 4), sx * 0.15, -0.06, 0.05), GOLD));
      P(M(vp).translate(...HC), HB.visor);
    }
    P(M([paint(place(new SphereGeometry(0.1, 9, 6), 0, 0.27, -0.03, 0, 0, 0, 0.35, 0.9, 1.8), 0xc81e2a, 0xff5a5a), paint(place(new CylinderGeometry(0.025, 0.03, 0.06, 6), 0, 0.2, 0), GOLD)]).translate(...HC), HB.plume);
    // --- west: the empty vase on a pedestal (Orchideous: flowers bloom in it and stay) ---
    const VS = HALL.vase;
    S(paint(place(new CylinderGeometry(0.18, 0.24, 0.78, 10), VS.x, 0.39, VS.z), STONE, STONE2));
    S(paint(place(new BoxGeometry(0.46, 0.06, 0.46), VS.x, 0.79, VS.z), STONE2));
    S(paint(place(new BoxGeometry(0.5, 0.08, 0.5), VS.x, 0.04, VS.z), STONE));
    S(paint(place(new LatheGeometry([[0.001, 0], [0.1, 0], [0.16, 0.08], [0.18, 0.2], [0.13, 0.33], [0.07, 0.42], [0.065, 0.46], [0.11, 0.52]].map(([r, y]) => new Vector2(r, y)), 14), VS.x, 0.82, VS.z), 0x2f5fb8, 0xf2ecdc));
    S(paint(place(new TorusGeometry(0.17, 0.012, 5, 16), VS.x, 1.0, VS.z, Math.PI / 2), GOLD));
    B(HB.flowers, VS.x, 1.26, VS.z);
    P(bouquetGeo(PAL_VASE).scale(1.35, 1.35, 1.35).translate(VS.x, 1.26, VS.z), HB.flowers);
    // --- west: a stack of books on a stool (Leviosa / Accio) ---
    const BK = HALL.books;
    S(paint(place(new BoxGeometry(0.7, 0.06, 0.42), BK.x, 0.45, BK.z), WOOD, 0x8a5a2e));
    for (const dx of [-0.29, 0.29]) for (const dz of [-0.16, 0.16]) S(paint(place(new BoxGeometry(0.06, 0.43, 0.06), BK.x + dx, 0.215, BK.z + dz), DARK));
    const BC = [BK.x, 0.6, BK.z]; B(HB.books, ...BC);
    {
      const bp = []; let y = -0.12;
      [[0x8a1e24, 0.09, 0.1], [0x1f3b5e, 0.07, -0.25], [0x2c6a2a, 0.08, 0.35]].forEach(([c, h, r]) => {
        bp.push(paint(place(new BoxGeometry(0.4, h, 0.3), 0, y + h / 2, 0, 0, r, 0), c, c));
        bp.push(paint(place(new BoxGeometry(0.38, h * 0.78, 0.305), 0.012, y + h / 2, 0.003, 0, r, 0), 0xf0e4c0));
        bp.push(paint(place(new BoxGeometry(0.02, h + 0.004, 0.31), -0.19, y + h / 2, 0, 0, r, 0), 0xd8a940));
        y += h;
      });
      P(M(bp).translate(...BC), HB.books);
    }
    // --- flames for the brazier: core, glow, a warm pool on the floor ---
    const flames = flameMesh(3, glowTex, 'freecast-hall-flames');
    flames.setColorAt(0, _c.setHex(0xffb040)); flames.setColorAt(1, _c.setHex(0xff7a20)); flames.setColorAt(2, _c.setHex(0x6a3008));
    const k = K.finish(room.group, [flames]);
    // solid bits (room colliders: room-local x,z)
    for (const [p, r] of [[BZ, 0.38], [CH, 0.46], [TP, 0.34], [HM, 0.28], [VS, 0.3], [BK, 0.4]]) room.colliders.push({ type: 'circle', x: p.x, z: p.z, r, freecast: true });
    const h = Object.assign(k, { room, flames, origin: room.group.position.clone(), flameY: 1.12 });
    h.bones[HB.reward].scale.setScalar(0.001);
    return h;
  }
  const hallLive = () => !!hall && interiors.room === hall.room && interiors.active === 'entrancehall';
  const HO = () => (hall ? hall.origin : v0.set(0, -200, 0));   // room origin (rooms sit at FLOOR_Y)
  const hW = (x, y, z, o) => o.set(x, y, z).add(HO());
  const hBoneW = (i, o) => o.copy(hall.bones[i].position).add(hall.origin);
  const hTarget = (t) => { t.indoor = 'entrancehall'; targets.push(t); return t; };
  hTarget({ id: 'hall-brazier', spells: ['incendio', 'aguamenti'], front: [0, 1], at: (o) => hW(HALL.brazier.x, 1.1, HALL.brazier.z, o), ok: (k) => hallLive() && fireOk(HS.fire, k), cast: (k) => fireCast(HS.fire, k) });
  hTarget({ id: 'hall-chest', spells: ['alohomora'], front: [0, 1], at: (o) => hW(HALL.chest.x, 0.38, HALL.chest.z + 0.27, o), ok: () => hallLive() && HS.chest.state === 'locked', cast: () => { const c = HS.chest; c.state = 'opening'; c.t = -0.35; c.opens++; c.rewarded = false; c.popped = false; } });
  hTarget({ id: 'hall-teapot', spells: ['engorgio', 'reducio'], front: [-1, 0], at: (o) => hW(HALL.teapot.x, 0.74 + 0.12 * HS.teapot.f, HALL.teapot.z, o), ok: (k) => hallLive() && HS.teapot.t >= 1 && (k === 'engorgio' ? HS.teapot.level < 1 : HS.teapot.level > -1), cast: (k) => stepScal(HS.teapot, k === 'engorgio' ? 1 : -1) });
  hTarget({ id: 'hall-helmet', spells: ['reparo'], front: [0, 1], at: (o) => hW(HCtr.x, 0.5, HCtr.z + 0.2, o), ok: () => hallLive() && HS.helmet.state === 'broken', cast: () => { HS.helmet.state = 'mending'; HS.helmet.t = -0.35; } });
  hTarget({ id: 'hall-vase', spells: ['orchideous'], front: [1, 0], at: (o) => hW(HALL.vase.x, 1.28, HALL.vase.z, o), ok: () => hallLive() && !HS.vase.bloomed && !HS.vase.pend, cast: () => { HS.vase.pend = 0.75; } });
  hTarget({ id: 'hall-books', spells: ['leviosa', 'accio'], front: [1, 0], at: (o) => (hall ? hBoneW(HB.books, o) : hW(HALL.books.x, 0.6, HALL.books.z, o)), ok: () => hallLive() && !HS.books.mode, cast: (k) => startMover(HS.books, k) });

  function tickHall(dt) {
    if (!hallLive()) return;
    const bones = hall.bones, rest = hall.rest;
    const reset = (i) => { bones[i].position.copy(rest[i].p); bones[i].quaternion.copy(rest[i].q); bones[i].scale.copy(rest[i].s); };
    // chest (the corner chest's timing; +5 house points once per session)
    const c = HS.chest;
    if (c.state !== 'locked') {
      c.t += dt; const t = c.t;
      const lk = bones[HB.lock], lr = rest[HB.lock], ld = bones[HB.lid], lrr = rest[HB.lid], rw = bones[HB.reward], rr = rest[HB.reward];
      if (t >= 0 && t < 3.2) {
        const k = Math.min(1, t / 0.7);
        lk.position.copy(lr.p); lk.position.y += Math.sin(k * Math.PI) * 0.45 + k * 0.1; lk.position.z += k * 0.45;
        lk.quaternion.copy(_q.setFromEuler(_e.set(k * 9, 0, 0))).multiply(lr.q); lk.scale.setScalar(Math.max(0.001, 1 - ease((k - 0.5) * 2)));
        if (!c.popped) { c.popped = true; fun.sfx.clank(); hBoneW(HB.lock, v0); burst(v0.x, v0.y, v0.z, 0xffd76a, 18, 2, 0.7, 0.2, -2); }
        ld.quaternion.copy(lrr.q).multiply(_q.setFromEuler(_e.set(-1.9 * ease((t - 0.25) / 0.6), 0, 0)));
        if (t > 0.8) {
          const k2 = ease((t - 0.8) / 1.2), out = t > 2.6 ? 1 - ease((t - 2.6) / 0.5) : 1;
          rw.position.copy(rr.p); rw.position.y += k2 * 1.1; rw.quaternion.setFromEuler(_e.set(0, t * 5, 0)); rw.scale.setScalar(Math.max(0.001, k2 * out * 1.3));
          if (Math.random() < dt * 14) { hBoneW(HB.reward, v0); emit(v0.x + (Math.random() - 0.5) * 0.4, v0.y + (Math.random() - 0.5) * 0.4, v0.z, 0, 0.3, 0, 0.7, 0.2, 0xffe27a); }
        }
        if (t > 2.6 && !c.rewarded) {
          c.rewarded = true; hBoneW(HB.reward, v0); burst(v0.x, v0.y, v0.z, 0xffe27a, 26, 2.4, 0.9, 0.24, -1.5); fun.sfx.tada();
          if (!c.paidSession) {
            c.paidSession = true; c.paid++;
            try { window.HPLessons.progress.bonus(5); } catch { /* lessons not loaded */ }
            fun.toast('🔓⭐', '+5 נְקֻדּוֹת לַבַּיִת!', 2400); fun.confetti(['⭐', '✨', '🪙', '💜'], 16);
          } else fun.toast('🔓✨', 'נִפְתַּח!', 1400);
        }
      } else if (t >= 3.2 && t < 10) {
        c.state = 'open'; lk.scale.setScalar(0.001); rw.scale.setScalar(0.001); ld.quaternion.copy(lrr.q).multiply(_q.setFromEuler(_e.set(-1.9, 0, 0)));
      } else if (t >= 10 && t < 11.4) {
        ld.quaternion.copy(lrr.q).multiply(_q.setFromEuler(_e.set(-1.9 * (1 - ease((t - 10) / 0.8)), 0, 0)));
        if (t > 10.8) { reset(HB.lock); lk.scale.setScalar(Math.max(0.001, ease((t - 10.8) / 0.5))); }
      } else if (t >= 11.4) { reset(HB.lid); reset(HB.lock); c.state = 'locked'; fun.sfx.tink(); }
    }
    // brazier
    hW(HALL.brazier.x, hall.flameY, HALL.brazier.z, v1);
    tickFireState(HS.fire, dt, [v1]);
    const F = hall.flames, f = HS.fire;
    if (f.k > 0.01) {
      F.visible = true; const fl = 1 + Math.sin(T * 17) * 0.08 + Math.sin(T * 29) * 0.05, kk = f.k;
      const bx = HALL.brazier.x, bz = HALL.brazier.z, y = hall.flameY;
      F.setMatrixAt(0, _m4.compose(v0.set(bx, y + 0.12 * fl, bz), camera.quaternion, _s.set(0.62 * kk, 0.95 * kk * fl, 1)));
      F.setMatrixAt(1, _m4.compose(v0.set(bx, y, bz), camera.quaternion, _s.set(2.2 * kk * fl, 2.2 * kk * fl, 1)));
      F.setMatrixAt(2, _m4.compose(v0.set(bx, 0.03, bz), _q.setFromEuler(_e.set(-Math.PI / 2, 0, 0)), _s.set(4.2 * kk, 4.2 * kk, 1)));
      F.instanceMatrix.needsUpdate = true;
      if (f.lit && Math.random() < dt * 9) emit(v1.x + (Math.random() - 0.5) * 0.3, v1.y + 0.15, v1.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, 0.9, 0.09, 0xffa040, 0.4);
    } else if (F.visible) F.visible = false;
    // helmet
    tickHelmet(dt);
    // vase flowers
    const vs = HS.vase;
    if (vs.pend > 0) {
      vs.pend -= dt;
      if (vs.pend <= 0) { vs.pend = 0; vs.bloomed = true; vs.blooms++; hW(HALL.vase.x, 1.4, HALL.vase.z, v0); for (const cc of [0xff7ab8, 0xffe27a, 0xffffff]) burst(v0.x, v0.y, v0.z, cc, 12, 1.8, 0.8, 0.2, -1); fun.sfx.sparkle(); fun.sfx.giggle(true); }
    }
    vs.k = vs.bloomed ? Math.min(1, vs.k + dt / 0.7) : 0;
    bones[HB.flowers].scale.setScalar(Math.max(0.001, vs.bloomed ? backOut(vs.k) : 0));
    // books
    const bk = HS.books, bb = bones[HB.books], br = rest[HB.books];
    if (tickMover(bk, dt, _rw.copy(br.p).add(hall.origin), 0xd8c8ff) || bk.was) {
      bk.was = !!bk.mode;
      bb.position.copy(br.p).add(bk.off); bb.quaternion.setFromEuler(_e.set(bk.tilt, bk.ang, bk.tilt * 0.6));
    }
    // teapot
    tickScal(HS.teapot, dt);
    bones[HB.teapot].scale.setScalar(HS.teapot.f);
  }
  function poseHelmet(k, arc = 0) {   // k = 0 in pieces .. 1 whole (k may be a function of the piece)
    for (let i = 0; i < NHP; i++) {
      const b = hall.bones[HB.domeL + i], r = hall.rest[HB.domeL + i], br = helmetBroken[i], kk = typeof k === 'function' ? k(i) : k;
      b.position.lerpVectors(br.p, r.p, kk); b.position.y += Math.sin(kk * Math.PI) * arc;
      b.quaternion.slerpQuaternions(br.q, r.q, kk);
    }
  }
  function tickHelmet(dt) {
    const h = HS.helmet;
    if (h.state === 'broken') { poseHelmet(0); return; }
    h.t += dt; const t = h.t;
    if (h.state === 'mending') {
      if (t < 0) { poseHelmet(0); return; }
      poseHelmet((i) => ease((t - i * 0.12) / 0.9), 0.7);
      if (Math.random() < dt * 20) { const b = hall.bones[HB.domeL + ((Math.random() * NHP) | 0)]; v0.copy(b.position).add(hall.origin); emit(v0.x, v0.y + 0.1, v0.z, 0, 0.4, 0, 0.6, 0.18, 0x9affc8); }
      if (t >= 1.5) { poseHelmet(1); h.state = 'whole'; h.t = 0; h.mends++; hW(HCtr.x, HCtr.y + 0.2, HCtr.z, v0); burst(v0.x, v0.y, v0.z, 0x9affc8, 22, 2, 0.8, 0.22, -1); fun.sfx.tink(0); fun.sfx.tink(3); fun.sfx.chime(); }
    } else if (h.state === 'whole') {
      poseHelmet(1);
      if (t > 25) { h.state = 'wobble'; h.t = 0; }
    } else if (h.state === 'wobble') {
      const a = Math.sin(t * 16) * 0.14 * Math.min(1, t / 0.8);
      _q2.setFromEuler(_e.set(a * 0.5, 0, a));
      for (let i = 0; i < NHP; i++) { const b = hall.bones[HB.domeL + i], r = hall.rest[HB.domeL + i]; b.position.copy(r.p); b.quaternion.copy(_q2).multiply(r.q); }
      if (t > 1.0) { h.state = 'falling'; h.t = 0; }
    } else if (h.state === 'falling') {
      poseHelmet(1 - ease(t / 0.45), 0.25);
      if (t >= 0.45) { poseHelmet(0); h.state = 'broken'; h.breaks++; fun.sfx.clank(); }
    }
  }

  // ======================= the Library spot =======================
  const LS = { fire: newFire(), pot: { bloomed: false, k: 0, pend: 0, blooms: 0, grow: 1, growTo: 1, waters: 0 }, book: newMover(), bookS: newScal([0.5, 1, 2.2]) };
  const LB = { book: 0, flowers: 1 };
  let lib = null;
  const CANDLES = [[-0.2, 1.2], [0, 1.32], [0.2, 1.2]].map(([dz, y]) => ({ x: LIB.candles.x, y: y + 0.22, z: LIB.candles.z + dz }));
  function buildLib(room) {
    const K = spotKit('freecast-lib');
    const { S, B, P } = K;
    // the candelabra on a little table under the south-east window (arms spread along z, toward the room)
    const CA = LIB.candles;
    S(paint(place(new BoxGeometry(0.5, 0.05, 0.62), CA.x, 0.78, CA.z), WOOD, 0x8a5a2e));
    for (const dx of [-0.2, 0.2]) for (const dz of [-0.26, 0.26]) S(paint(place(new BoxGeometry(0.05, 0.76, 0.05), CA.x + dx, 0.38, CA.z + dz), DARK));
    S(paint(place(new CylinderGeometry(0.06, 0.09, 0.04, 12), CA.x, 0.82, CA.z), GOLD, 0xf0d070));
    S(paint(rod([CA.x, 0.82, CA.z], [CA.x, 1.3, CA.z], 0.018, 0.014, 6), GOLD, 0xf0d070));
    S(paint(rod([CA.x, 1.12, CA.z - 0.2], [CA.x, 1.12, CA.z + 0.2], 0.014, 0.014, 6), GOLD, 0xf0d070));
    for (const c of CANDLES) {
      S(paint(place(new CylinderGeometry(0.035, 0.025, 0.04, 8), c.x, c.y - 0.22, c.z), GOLD, 0xf0d070));
      S(paint(place(new CylinderGeometry(0.022, 0.024, 0.18, 8), c.x, c.y - 0.11, c.z), 0xf3e6c0, 0xfff8e4));
      S(paint(place(new CylinderGeometry(0.003, 0.003, 0.03, 4), c.x, c.y - 0.01, c.z), 0x1a1a1a));
    }
    for (const dz of [-0.2, 0.2]) S(paint(rod([CA.x, 1.12, CA.z + dz], [CA.x, CANDLES[0].y - 0.24, CA.z + dz], 0.012, 0.012, 5), GOLD, 0xf0d070));
    // the empty flower pot under the north-east window
    const FP = LIB.pot;
    S(paint(place(new LatheGeometry([[0.001, 0], [0.2, 0], [0.27, 0.36], [0.3, 0.38], [0.3, 0.44], [0.001, 0.44]].map(([r, y]) => new Vector2(r, y)), 16), FP.x, 0, FP.z), 0xa8502a, 0xd87a4a));
    S(paint(place(new CylinderGeometry(0.27, 0.27, 0.02, 16), FP.x, 0.43, FP.z), 0x3a2414, 0x4a3020));
    B(LB.flowers, FP.x, 0.42, FP.z);
    P(bouquetGeo(PAL_POT).scale(1.9, 1.7, 1.9).translate(FP.x, 0.42, FP.z), LB.flowers);
    // the giant book on a lectern facing the reading tables (-x)
    const LT = LIB.lectern;
    S(paint(place(new BoxGeometry(0.6, 0.06, 0.6), LT.x, 0.03, LT.z), DARK, WOOD));
    S(paint(rod([LT.x, 0.06, LT.z], [LT.x, 0.98, LT.z], 0.06, 0.05, 8), DARK, WOOD));
    S(paint(place(new BoxGeometry(0.5, 0.05, 0.62), LT.x, 1.02, LT.z, 0, 0, 0.4), WOOD, 0x8a5a2e));
    S(paint(place(new BoxGeometry(0.04, 0.06, 0.62), LT.x - 0.24, 0.95, LT.z, 0, 0, 0.4), DARK));
    const BKc = [LT.x, 1.09, LT.z]; B(LB.book, ...BKc);
    {
      const bp = [];
      bp.push(paint(place(new BoxGeometry(0.44, 0.025, 0.66), 0, -0.02, 0), 0x5a1e1a, 0x7a2a22));
      for (const sz of [-1, 1]) bp.push(paint(place(new BoxGeometry(0.4, 0.05, 0.3), 0, 0.015, sz * 0.158, sz * 0.06, 0, 0), 0xf2e8cc, 0xfff8e8));
      for (const sz of [-1, 1]) for (let k = 0; k < 4; k++) bp.push(paint(place(new BoxGeometry(0.26, 0.004, 0.012), 0.02 - k * 0.0, 0.042, sz * (0.08 + k * 0.05)), 0x6a5a4a));
      bp.push(paint(place(new BoxGeometry(0.03, 0.01, 0.2), 0.12, 0.045, -0.15), 0xc81e2a));   // a ribbon
      P(M(bp).applyMatrix4(_m4.compose(v0.set(...BKc), _q.setFromEuler(_e.set(0, 0, 0.4)), _s.set(1, 1, 1))), LB.book);
    }
    const flames = flameMesh(6, glowTex, 'freecast-lib-flames');
    for (let i = 0; i < 6; i++) flames.setColorAt(i, _c.setHex(i < 3 ? 0xffb040 : 0xff8a30));
    const k = K.finish(room.group, [flames]);
    for (const [p, r] of [[CA, 0.36], [FP, 0.32], [LT, 0.36]]) room.colliders.push({ type: 'circle', x: p.x, z: p.z, r, freecast: true });
    return Object.assign(k, { room, flames, origin: room.group.position.clone() });
  }
  const libLive = () => !!lib && interiors.room === lib.room && interiors.active === 'library';
  const LO = () => (lib ? lib.origin : v0.set(0, -200, 0));
  const lW = (x, y, z, o) => o.set(x, y, z).add(LO());
  const lTarget = (t) => { t.indoor = 'library'; targets.push(t); return t; };
  lTarget({ id: 'lib-candles', spells: ['incendio', 'aguamenti'], front: [-1, 0], at: (o) => lW(LIB.candles.x, 1.4, LIB.candles.z, o), ok: (k) => libLive() && fireOk(LS.fire, k), cast: (k) => fireCast(LS.fire, k) });
  lTarget({ id: 'lib-pot', spells: ['orchideous', 'aguamenti'], front: [-1, 0], at: (o) => lW(LIB.pot.x, 0.6, LIB.pot.z, o),
    ok: (k) => libLive() && (k === 'orchideous' ? !LS.pot.bloomed && !LS.pot.pend : LS.pot.bloomed && LS.pot.growTo < 1.3 && !LS.pot.pend), cast: (k) => { LS.pot.pend = k === 'orchideous' ? 0.75 : 0.9; LS.pot.pendK = k; } });
  lTarget({ id: 'lib-book', spells: ['engorgio', 'reducio', 'leviosa', 'accio'], front: [-1, 0], at: (o) => (lib ? o.copy(lib.bones[LB.book].position).add(lib.origin) : lW(LIB.lectern.x, 1.09, LIB.lectern.z, o)),
    ok: (k) => libLive() && !LS.book.mode && LS.bookS.t >= 1 && (k === 'engorgio' ? LS.bookS.level < 1 : k === 'reducio' ? LS.bookS.level > -1 : true),
    cast: (k) => { if (k === 'engorgio' || k === 'reducio') stepScal(LS.bookS, k === 'engorgio' ? 1 : -1); else startMover(LS.book, k); } });
  function tickLib(dt) {
    if (!libLive()) return;
    const bones = lib.bones, rest = lib.rest;
    // candelabra
    const spotsW = CANDLES.map((c, i) => lW(c.x, c.y, c.z, [v0, v1, v2][i]));
    tickFireState(LS.fire, dt, spotsW);
    const F = lib.flames, f = LS.fire;
    if (f.k > 0.01) {
      F.visible = true;
      CANDLES.forEach((c, i) => {
        const fl = 1 + Math.sin(T * 17 + i * 2.1) * 0.08 + Math.sin(T * 29 + i) * 0.05;
        F.setMatrixAt(i, _m4.compose(tv.set(c.x, c.y + 0.03 * fl, c.z), camera.quaternion, _s.set(0.09 * f.k, 0.17 * f.k * fl, 1)));
        F.setMatrixAt(3 + i, _m4.compose(tv.set(c.x, c.y, c.z), camera.quaternion, _s.set(0.75 * f.k * fl, 0.75 * f.k * fl, 1)));
      });
      F.instanceMatrix.needsUpdate = true;
    } else if (F.visible) F.visible = false;
    // pot
    const p = LS.pot;
    if (p.pend > 0) {
      p.pend -= dt;
      if (p.pend <= 0) {
        p.pend = 0; lW(LIB.pot.x, 0.8, LIB.pot.z, v0);
        if (p.pendK === 'orchideous') { p.bloomed = true; p.blooms++; for (const cc of [0xa88aff, 0xffe27a, 0x9ad0ff]) burst(v0.x, v0.y, v0.z, cc, 12, 1.8, 0.8, 0.2, -1); fun.sfx.sparkle(); fun.sfx.giggle(true); }
        else { p.growTo = 1.4; p.waters++; burst(v0.x, v0.y, v0.z, 0x9aff7a, 18, 1.6, 0.9, 0.22, -0.5); fun.sfx.giggle(true); fun.sfx.sparkle(); }
      }
    }
    p.k = p.bloomed ? Math.min(1, p.k + dt / 0.7) : 0;
    p.grow += (p.growTo - p.grow) * Math.min(1, dt * 2.5);
    const fb = bones[LB.flowers];
    if (p.bloomed) { const s = backOut(p.k); fb.scale.set(s, s * p.grow, s); } else fb.scale.setScalar(0.001);
    // book: float/accio + grow/shrink
    const bk = LS.book, bb = bones[LB.book], br = rest[LB.book];
    tickMover(bk, dt, _rw.copy(br.p).add(lib.origin), 0xd8c8ff);
    tickScal(LS.bookS, dt);
    bb.position.copy(br.p).add(bk.off); bb.quaternion.setFromEuler(_e.set(bk.tilt, bk.ang, bk.tilt * 0.6)); bb.scale.setScalar(LS.bookS.f);
  }

  // ======================= Hagrid's pumpkin patch (the real instanced pumpkins) =======================
  const PK = { im: null, base: [], st: [], cols: [] };
  try {
    const im = scene.getObjectByName('hut-pumpkins');
    if (im && im.isInstancedMesh) {
      PK.im = im; im.parent.updateMatrixWorld(true);
      const S = im.parent.scale.x || 1;
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, _m4); const p = new Vector3(), q = new Quaternion(), s = new Vector3(); _m4.decompose(p, q, s);
        PK.base.push({ p, q, s });
        const d = s.x;   // ~ the diameter in metres (local)
        const sc = newScal([0.5, 1, Math.min(3.2, Math.max(1.6, 1.7 / d))]);
        const st = { i, sc, mv: newMover(), pend: 0, waters: 0, dirty: false };
        PK.st.push(st);
        // a collider that only exists while the pumpkin is huge (parked far away otherwise)
        const c = { type: 'circle', x: 1e5, z: 1e5, r: 0.01, freecast: true }; player.colliders.push(c); PK.cols.push(c);
        const centre = (o) => o.set(p.x, p.y + 0.32 * s.y * sc.f, p.z).applyMatrix4(im.matrixWorld).add(st.mv.off);
        targets.push({ id: 'pumpkin' + i, grp: im.parent, spells: ['engorgio', 'reducio', 'aguamenti', 'leviosa'], at: centre,
          ok: (k) => !st.mv.mode && sc.t >= 1 && !st.pend && (k === 'engorgio' || k === 'aguamenti' ? sc.level < 1 : k === 'reducio' ? sc.level > -1 : true),
          cast: (k) => { if (k === 'leviosa') startMover(st.mv, k); else if (k === 'aguamenti') st.pend = 0.9; else stepScal(sc, k === 'engorgio' ? 1 : -1); } });
        st.S = S;
      }
    }
  } catch (e) { console.warn('[freecast] pumpkins skipped -', e && e.message || e); PK.im = null; }
  const _pp = new Vector3(), _ps = new Vector3();
  function tickPumpkins(dt) {
    const im = PK.im; if (!im) return;
    let any = false;
    for (const st of PK.st) {
      const b = PK.base[st.i];
      if (st.pend > 0) { st.pend -= dt; if (st.pend <= 0) { st.pend = 0; st.waters++; stepScal(st.sc, 1); st.sc.t = 0; v0.set(b.p.x, b.p.y + 0.3 * b.s.y, b.p.z).applyMatrix4(im.matrixWorld); burst(v0.x, v0.y, v0.z, 0x9aff7a, 16, 1.6, 0.9, 0.22, -0.5); fun.sfx.giggle(true); } }
      const a = tickScal(st.sc, dt);
      v1.copy(b.p).applyMatrix4(im.matrixWorld);
      const m = tickMover(st.mv, dt, _rw.copy(v1), 0xffb060);
      if (!a && !m && !st.dirty) continue;
      st.dirty = a || m;
      const S = st.S, f = st.sc.f;
      _pp.copy(b.p); _pp.y += st.mv.off.y / S;
      _q.copy(b.q).multiply(_q2.setFromEuler(_e.set(st.mv.tilt, st.mv.ang, 0)));
      im.setMatrixAt(st.i, _m4.compose(_pp, _q, _ps.copy(b.s).multiplyScalar(f)));
      any = true;
      const c = PK.cols[st.i];
      if (f > 1.15 && !st.mv.mode) { c.x = v1.x; c.z = v1.z; c.r = 0.45 * b.s.x * f * S; } else { c.x = 1e5; c.z = 1e5; }
    }
    if (any) { im.instanceMatrix.needsUpdate = true; im.boundingSphere = null; }
  }

  // ======================= Lumos Maxima =======================
  const light = new PointLight(0xfff0d0, 0, 20, 1.6); light.name = 'freecast-maxima-light'; light.castShadow = false;
  scene.add(light);   // always present (intensity 0 when idle) so materials never rebuild for a new light
  const addMat = (hex, op = 1) => new MeshBasicMaterial({ map: glowTex, color: hex, transparent: true, opacity: op, depthWrite: false, blending: AdditiveBlending, fog: false });
  const ball = new Mesh(new PlaneGeometry(1, 1), addMat(0xfff6dc)); ball.name = 'freecast-maxima';
  const pool = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), addMat(0xffe0a0, 0.4)); pool.name = 'freecast-maxima-pool';
  for (const o of [ball, pool]) { o.visible = false; o.frustumCulled = false; o.raycast = () => {}; o.renderOrder = 5; scene.add(o); }
  const MX = { t: -1, dur: 7.6, casts: 0, maxI: 0, maxH: 0, inside: false, p: new Vector3(), from: new Vector3() };
  SP.maxima = {
    noFallback: true, lastId: 'maxima',
    cast() { MX.t = 0; MX.casts++; tip(); MX.from.copy(tipV); MX.p.copy(tipV); burst(tipV.x, tipV.y, tipV.z, 0xfff6d0, 26, 2.6, 0.8, 0.28, 0); fun.sfx.chime(); fun.sfx.tune([784, 988, 1175, 1568], 0.1, 'sine'); return true; },
    tick(dt, inside, busy) {
      if (MX.t < 0) return;
      MX.t += dt; const t = MX.t;
      if (t >= MX.dur || busy) { MX.t = -1; ball.visible = pool.visible = false; light.intensity = 0; return; }
      MX.inside = inside;
      const dark = inside || (env ? env.time !== 'day' : false);
      const H = inside ? 2.9 : 4.2, f = player.yaw;
      v0.set(pos.x + Math.sin(f) * 0.8, pos.y + H + Math.sin(t * 2.2) * 0.12, pos.z + Math.cos(f) * 0.8);   // the hover spot, above and a bit ahead
      if (t < 0.8) { const k = ease(t / 0.8); MX.p.lerpVectors(MX.from, v0, k); MX.p.y += Math.sin(k * Math.PI) * 0.6; }
      else MX.p.lerp(v0, Math.min(1, dt * 2.5));
      const grow = Math.min(1, t / 0.8), fade = Math.min(1, (MX.dur - t) / 1.2), k = grow * fade;
      ball.position.copy(MX.p); ball.quaternion.copy(camera.quaternion);
      ball.scale.setScalar((0.6 + 1.6 * grow) * (1 + Math.sin(t * 11) * 0.04) * (0.5 + 0.5 * fade));
      ball.material.opacity = Math.min(1, 0.4 + 0.6 * k);
      pool.position.set(MX.p.x, (inside ? pos.y : heightAt(MX.p.x, MX.p.z)) + 0.07, MX.p.z);
      pool.scale.setScalar(11 * k + 0.01); pool.material.opacity = (dark ? 0.42 : 0.18) * k;
      light.position.copy(MX.p); light.intensity = (dark ? 60 : 30) * k; light.distance = inside ? 16 : 22;
      ball.visible = pool.visible = true;
      MX.maxI = Math.max(MX.maxI, light.intensity); MX.maxH = Math.max(MX.maxH, MX.p.y - pos.y);
      if (Math.random() < dt * 14 * k) emit(MX.p.x + (Math.random() - 0.5) * 0.8, MX.p.y - 0.2, MX.p.z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.3, -0.5, (Math.random() - 0.5) * 0.3, 1.2, 0.16, 0xfff2c0, -0.3, 0.3);
    },
    state: () => ({ on: MX.t >= 0, t: +Math.max(0, MX.t).toFixed(2), casts: MX.casts, visible: ball.visible, intensity: +light.intensity.toFixed(1), maxIntensity: +MX.maxI.toFixed(1), height: +(MX.p.y - pos.y).toFixed(2), maxHeight: +MX.maxH.toFixed(2) }),
  };
  function heightAt(x, z) { try { return player.heightAt ? player.heightAt(x, z) : pos.y; } catch { return pos.y; } }

  // ======================= Engorgio / Reducio =======================
  const swell = new Mesh(new PlaneGeometry(1, 1), addMat(0xffffff)); swell.name = 'freecast-swell';
  swell.visible = false; swell.frustumCulled = false; swell.raycast = () => {}; swell.renderOrder = 5; scene.add(swell);
  const SW = { t: -1, dir: 1, n: 0 };
  function swellStart(dir) {
    SW.t = 0; SW.dir = dir; SW.n++; swell.material.color.setHex(dir > 0 ? 0xff9ae8 : 0x9af0ff);
    fun.sfx.tone(dir > 0 ? 300 : 900, 0.5, 'sine', 0.12, 0, dir > 0 ? 900 : 260);
  }
  function tickSwell(dt) {
    if (SW.t < 0) return;
    SW.t += dt; const t = SW.t, D = 0.9;
    if (t >= D) {
      SW.t = -1; swell.visible = false; tip();
      if (SW.dir > 0) burst(tipV.x, tipV.y, tipV.z, 0xff9ae8, 22, 2.6, 0.6, 0.24, -0.5); else burst(tipV.x, tipV.y, tipV.z, 0x9af0ff, 8, 0.5, 0.5, 0.12, 0);
      fun.sfx.pop(); return;
    }
    tip(); const k = t / D;
    const s = SW.dir > 0 ? 0.15 + 1.5 * bouncy(k) * (0.9 + 0.1 * Math.sin(t * 30)) : 1.3 * (1 - ease(k)) + 0.03;
    swell.position.copy(tipV); swell.quaternion.copy(camera.quaternion); swell.scale.setScalar(s); swell.visible = true;
    if (Math.random() < dt * 30) { const a = Math.random() * 6.283, r = SW.dir > 0 ? s * 0.4 : 0.9 * (1 - k); emit(tipV.x + Math.cos(a) * r, tipV.y + Math.sin(a) * r, tipV.z, SW.dir > 0 ? Math.cos(a) * 1.2 : -Math.cos(a) * 1.4, SW.dir > 0 ? Math.sin(a) * 1.2 : -Math.sin(a) * 1.4, 0, 0.4, 0.14, SW.dir > 0 ? 0xffc8f4 : 0xc8fcff); }
  }
  function sizeSpell(key) {
    const dir = key === 'engorgio' ? 1 : -1;
    return {
      noFallback: true,
      cast() {
        const t = best(key);
        if (!t) { swellStart(dir); this.lastId = null; return false; }
        t.at(tv); stream(tv, col(key)); t.cast(key); this.lastId = t.id;
        fun.sfx.tone(dir > 0 ? 260 : 1000, 0.6, 'sine', 0.12, 0.3, dir > 0 ? 780 : 300);
        return true;
      },
    };
  }
  SP.engorgio = Object.assign(sizeSpell('engorgio'), {
    tick(dt) { tickSwell(dt); tickPumpkins(dt); },
    state: () => ({ swells: SW.n, swelling: SW.t >= 0, teapot: { level: HS.teapot.level, f: +HS.teapot.f.toFixed(2), maxF: +HS.teapot.maxF.toFixed(2), minF: +HS.teapot.minF.toFixed(2) },
      book: { level: LS.bookS.level, f: +LS.bookS.f.toFixed(2) },
      pumpkins: PK.st.map(s => ({ i: s.i, level: s.sc.level, f: +s.sc.f.toFixed(2), waters: s.waters, floats: s.mv.floats, mode: s.mv.mode, maxRise: +s.mv.maxRise.toFixed(2) })) }),
  });
  SP.reducio = Object.assign(sizeSpell('reducio'), { state: () => SP.engorgio.state() });

  // ======================= Avis: a little flock =======================
  const NB = 6, AV = { t: -1, dur: 6.6, casts: 0, maxR: 0, flew: 0, tw: 0 };
  let birdBody = null, birdWing = null;
  const birdP = Array.from({ length: NB }, () => ({ p: new Vector3(), prev: new Vector3(), yaw: 0, pitch: 0 }));
  function makeBirds() {
    const P = [];
    P.push(paint(place(new SphereGeometry(0.09, 10, 7), 0, 0, 0, 0, 0, 0, 0.8, 0.8, 1.35), 0xf4f4f4, 0x4a8ae8));
    P.push(paint(place(new SphereGeometry(0.066, 9, 7), 0, 0.06, 0.1), 0x5a9af0, 0x3a7ad8));
    P.push(paint(place(new ConeGeometry(0.02, 0.06, 6), 0, 0.05, 0.18, Math.PI / 2, 0, 0), 0xffa020));
    for (const sx of [-1, 1]) P.push(paint(place(new SphereGeometry(0.012, 5, 4), sx * 0.04, 0.08, 0.148), 0x101018));
    P.push(paint(place(new ConeGeometry(0.05, 0.13, 4), 0, 0.01, -0.15, -Math.PI / 2, 0, 0, 1, 1, 0.3), 0x3a6ac8, 0x5a9af0));
    birdBody = new InstancedMesh(M(P), new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), NB);
    const w = new Shape(); w.moveTo(0, -0.045); w.quadraticCurveTo(0.12, -0.06, 0.2, -0.01); w.quadraticCurveTo(0.12, 0.05, 0, 0.045); w.lineTo(0, -0.045);
    const wg = paint(new ShapeGeometry(w, 5), 0x3a7ad8, 0xbfe0ff, 'x'); wg.rotateX(-Math.PI / 2);
    birdWing = new InstancedMesh(plain(wg), new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: DoubleSide }), NB * 2);
    const tints = [0xffffff, 0xfff0a0, 0xffc0d8, 0xc0ffd0, 0xffffff, 0xe0c8ff];
    for (let i = 0; i < NB; i++) { birdBody.setColorAt(i, _c.setHex(tints[i])); birdWing.setColorAt(i * 2, _c); birdWing.setColorAt(i * 2 + 1, _c); }
    for (const o of [birdBody, birdWing]) { o.name = 'freecast-avis'; o.frustumCulled = false; o.visible = false; o.raycast = () => {}; o.castShadow = false; scene.add(o); }
  }
  const _bm = new Matrix4(), _wm = new Matrix4();
  SP.avis = {
    noFallback: true, lastId: 'avis',
    cast() {
      if (!birdBody) makeBirds();
      AV.t = 0; AV.casts++; AV.maxR = 0; AV.tw = 0; AV.yaw0 = player.yaw; tip();
      for (const b of birdP) { b.p.copy(tipV); b.prev.copy(tipV); }
      burst(tipV.x, tipV.y, tipV.z, 0xbfe0ff, 20, 2.4, 0.7, 0.22, -1); burst(tipV.x, tipV.y, tipV.z, 0xffffff, 10, 1.6, 0.5, 0.14, -2);
      fun.sfx.poof(); fun.sfx.tweet(); return true;
    },
    tick(dt, inside, busy) {
      if (AV.t < 0) return;
      AV.t += dt; const t = AV.t;
      if (t >= AV.dur || busy) { AV.t = -1; birdBody.visible = birdWing.visible = false; AV.flew++; return; }
      AV.tw -= dt; if (AV.tw <= 0) { AV.tw = 0.6 + Math.random() * 0.5; fun.sfx.tweet(); }
      tip();
      const e0 = ease(Math.min(1, t / 0.9)), away = Math.max(0, t - 4.4);
      for (let i = 0; i < NB; i++) {
        const b = birdP[i], R = 2.1 + (i % 3) * 0.45, h = (inside ? 1.6 : 2.0) + (i % 2) * 0.45, w = 2.3 * (0.92 + 0.04 * i);
        const ang = AV.yaw0 + (i - 2.5) * 0.22 + w * t, r = R * e0 + away * away * 2.4;
        const cx = tipV.x + (pos.x - tipV.x) * e0, cz = tipV.z + (pos.z - tipV.z) * e0;
        b.prev.copy(b.p);
        b.p.set(cx + Math.sin(ang) * r, tipV.y + (pos.y + h - tipV.y) * e0 + away * away * (inside ? 0.5 : 1.6) + Math.sin(t * 3 + i) * 0.15, cz + Math.cos(ang) * r);
        const dx = b.p.x - b.prev.x, dy = b.p.y - b.prev.y, dz = b.p.z - b.prev.z, hz = Math.hypot(dx, dz);
        if (hz > 1e-4) { b.yaw = Math.atan2(dx, dz); b.pitch = -Math.atan2(dy, hz) * 0.6; }
        AV.maxR = Math.max(AV.maxR, Math.hypot(b.p.x - pos.x, b.p.z - pos.z));
        const sc = 1.4 * Math.min(1, t / 0.25) * (t > AV.dur - 0.8 ? Math.max(0.01, (AV.dur - t) / 0.8) : 1);
        _bm.compose(b.p, _q.setFromEuler(_e.set(b.pitch, b.yaw, -0.35, 'YXZ')), _s.set(sc, sc, sc));
        birdBody.setMatrixAt(i, _bm);
        const flap = Math.sin(T * 21 + i * 1.3) * 0.85 + 0.15;
        for (const side of [1, -1]) {
          _wm.compose(_v.set(side * 0.05, 0.03, 0.01), _q2.setFromEuler(_e.set(0, 0, side * flap)), _s.set(side, 1, 1));
          birdWing.setMatrixAt(i * 2 + (side > 0 ? 0 : 1), _m5.multiplyMatrices(_bm, _wm));
        }
        if (Math.random() < dt * 3) emit(b.p.x, b.p.y, b.p.z, 0, -0.3, 0, 0.6, 0.1, 0xdff0ff, -0.5);
      }
      birdBody.instanceMatrix.needsUpdate = birdWing.instanceMatrix.needsUpdate = true;
      birdBody.visible = birdWing.visible = true;
    },
    state: () => ({ on: AV.t >= 0, t: +Math.max(0, AV.t).toFixed(2), casts: AV.casts, flew: AV.flew, visible: !!(birdBody && birdBody.visible), maxR: +AV.maxR.toFixed(2), birds: NB }),
  };

  // ======================= Orchideous =======================
  let bq = null;
  const OR = { t: -1, target: null, to: new Vector3(), casts: 0, wand: 0, toVase: 0 };
  SP.orchideous = {
    noFallback: true,
    cast() {
      if (!bq) { bq = new Mesh(bouquetGeo(PAL_WAND, true), new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: DoubleSide })); bq.name = 'freecast-bouquet'; bq.visible = false; bq.frustumCulled = false; bq.raycast = () => {}; scene.add(bq); }
      const t = best('orchideous');
      OR.t = 0; OR.casts++; OR.target = t || null;
      tip(); burst(tipV.x, tipV.y, tipV.z, 0xff9ad8, 18, 2, 0.6, 0.2, -1); fun.sfx.poof(); fun.sfx.sparkle();
      if (t) { t.at(OR.to); stream(OR.to, col('orchideous'), 0.7); t.cast('orchideous'); OR.toVase++; this.lastId = t.id; return true; }
      OR.wand++; this.lastId = null; return false;
    },
    tick(dt, inside, busy) {
      if (OR.t < 0 || !bq) return;
      OR.t += dt; const t = OR.t;
      tip(); const f = player.yaw;
      if (busy) { OR.t = -1; bq.visible = false; return; }
      if (OR.target) {   // pops out, then flies to the vase and shrinks into it (the vase blooms by itself)
        if (t < 0.25) { bq.position.copy(tipV); bq.scale.setScalar(backOut(t / 0.25) * 1.2); }
        else if (t < 0.75) { const k = ease((t - 0.25) / 0.5); bq.position.lerpVectors(tipV, OR.to, k); bq.position.y += Math.sin(k * Math.PI) * 0.6; bq.scale.setScalar(1.2 * (1 - k * 0.8)); }
        else { OR.t = -1; bq.visible = false; return; }
        bq.rotation.set(0, t * 6, 0);
      } else {           // a bunch held out in front of Harry, then a puff of petals
        if (t < 0.35) bq.scale.setScalar(backOut(t / 0.35) * 1.6); else bq.scale.setScalar(1.6);
        bq.position.set(tipV.x + Math.sin(f) * 0.15, tipV.y - 0.1 + Math.sin(t * 4) * 0.03, tipV.z + Math.cos(f) * 0.15);
        bq.rotation.set(0.25 * Math.cos(f), f + Math.sin(t * 2) * 0.2, -0.25 * Math.sin(f));
        if (t >= 2.6) { OR.t = -1; bq.visible = false; for (const c of PAL_WAND.slice(0, 4)) burst(bq.position.x, bq.position.y + 0.4, bq.position.z, c, 8, 1.6, 0.9, 0.18, -1.2); fun.sfx.pop(); return; }
      }
      bq.visible = true;
    },
    state: () => ({ on: OR.t >= 0, casts: OR.casts, wand: OR.wand, toVase: OR.toVase, visible: !!(bq && bq.visible), hallVase: HS.vase.bloomed, libPot: LS.pot.bloomed, potGrow: +LS.pot.grow.toFixed(2), potWaters: LS.pot.waters }),
  };

  // ======================= the rooms: build the spots when their room streams in; per-frame =======================
  let seenRoom = null, builds = 0;
  SP._castle = {
    noFallback: true,
    tick(dt) {
      T += dt;
      const r = interiors.room;
      if (r !== seenRoom) {
        seenRoom = r; hall = null; lib = null;
        if (r && r.group) {
          try {
            if (interiors.active === 'entrancehall') { hall = buildHall(r); builds++; }
            else if (interiors.active === 'library') { lib = buildLib(r); builds++; }
          } catch (e) { console.warn('[freecast] castle spot skipped -', e && e.message || e); hall = lib = null; }
        }
      }
      tickHall(dt); tickLib(dt);
    },
    state: () => ({ room: interiors.active, hall: hallLive(), lib: libLive(), builds,
      chest: { state: HS.chest.state, opens: HS.chest.opens, paid: HS.chest.paid }, brazier: { lit: HS.fire.lit, lights: HS.fire.lights, douses: HS.fire.douses },
      helmet: { state: HS.helmet.state, mends: HS.helmet.mends, breaks: HS.helmet.breaks }, books: { mode: HS.books.mode, floats: HS.books.floats, accios: HS.books.accios, reached: HS.books.reached, maxRise: +HS.books.maxRise.toFixed(2) },
      candles: { lit: LS.fire.lit, lights: LS.fire.lights, douses: LS.fire.douses }, libBook: { mode: LS.book.mode, floats: LS.book.floats, accios: LS.book.accios, level: LS.bookS.level } }),
  };

  // ======================= debug API (window.__game.freecast.castle) =======================
  const meshCount = (g) => { let n = 0; if (g) g.traverse(o => { if (o.isMesh) n++; }); return n; };
  const api = {
    spots: () => ({
      hall: { room: 'entrancehall', ...Object.fromEntries(Object.entries(HALL).map(([k, p]) => [k, { x: p.x, z: p.z }])), meshes: hall ? meshCount(hall.group) : null },
      library: { room: 'library', ...Object.fromEntries(Object.entries(LIB).map(([k, p]) => [k, { x: p.x, z: p.z }])), meshes: lib ? meshCount(lib.group) : null },
      pumpkins: PK.im ? { n: PK.st.length, x: +PK.im.parent.position.x.toFixed(2), z: +PK.im.parent.position.z.toFixed(2), meshes: 0 } : null,
    }),
    ids: () => targets.map(t => t.id),
    // stand Harry d metres in front of a target, facing it (indoor targets: be in that room first)
    aim(id, d = 2.6) {
      const t = targets.find(x => x.id === id); if (!t) return null;
      t.at(tv); let fx = t.front ? t.front[0] : 0, fz = t.front ? t.front[1] : 1;
      if (!t.front) { const dx = pos.x - tv.x, dz = pos.z - tv.z, l = Math.hypot(dx, dz) || 1; fx = dx / l; fz = dz / l; }
      const x = tv.x + fx * d, z = tv.z + fz * d;
      try { player.teleport(x, z); } catch { pos.x = x; pos.z = z; }
      pos.x = x; pos.z = z; player.yaw = Math.atan2(tv.x - x, tv.z - z);
      return { x: +x.toFixed(2), z: +z.toFixed(2), tx: +tv.x.toFixed(2), tz: +tv.z.toFixed(2) };
    },
    state: () => SP._castle.state(),
    light: () => ({ intensity: light.intensity, distance: light.distance }),
  };
  return { targets, SP, api };
}
