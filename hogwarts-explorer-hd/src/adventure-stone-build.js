// Quest 1 geometry (adventure-stone.js runs it): the chambers under the trapdoor, built in code. ONE interior
// ('chambers'), six rooms in a row along -z (centres z = 0, -10, ... -50): Fluffy, Devil's Snare, the flying keys,
// the chess board, the potion bottles, the Mirror of Erised. Warm torchlit honey stone, never dark.
// Static shell (walls, floor, ceiling, torches) merges per material; each room's props are a group that is only
// shown when Harry is in or next to that room. Fluffy: soft and round, three sleeping heads, under 4k triangles.
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, LatheGeometry, TubeGeometry, IcosahedronGeometry,
  CatmullRomCurve3, Vector2, Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture,
  InstancedMesh, Object3D, DoubleSide, AdditiveBlending, SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { floor, ceiling, torch, mergeStatic, stoneMat, MAT, woodMat } from './interior-kit.js';
import { bakeLight } from './atmosphere.js';
import { FLOOR_Y } from './rooms.js';

export const H = 4.6, X = 4.5, N = 6;
export const zc = (i) => -10 * i;
export const DOOR_Z = (i) => zc(i) - 5;            // the doorway between room i and i+1
export const SPOTS = {
  fluffy: { x: 0, z: -2.4 }, harp: { x: -2.9, z: 0.4 }, trap: { x: 2.7, z: 0.6 },
  land: { x: 0, z: -7.2 }, snare: { x: 0, y: 1.3, z: -13.6 },
  keysIn: { x: 0, z: -16.2 }, lock: { x: 0.45, y: 1.25, z: -24.35 },
  chessIn: { x: 0, z: -26.4 }, mirrorIn: { x: 0, z: -46.3 }, look: { x: 0, z: -52.0 }, mirror: { x: 0, y: 1.9, z: -54.3 },
  potionIn: { x: 0, z: -36.3 }, table: { x: 0, z: -41 },
};
export const BOARD = { s: 0.8, x0: -2.0, z0: -28.0, n: 6 };   // square (c, r): x = x0 + c*s, z = z0 - r*s (row 0 nearest the door Harry comes in by)
export const sq = (c, r, out = new Vector3()) => out.set(BOARD.x0 + c * BOARD.s, 0, BOARD.z0 - r * BOARD.s);
export const COLOURS = [
  { k: 'red', hex: 0xd8302a, name: 'האדום', e: '❤️' }, { k: 'orange', hex: 0xf08a1a, name: 'הכתום', e: '🧡' }, { k: 'yellow', hex: 0xf4d23a, name: 'הצהוב', e: '💛' },
  { k: 'green', hex: 0x3ab84a, name: 'הירוק', e: '💚' }, { k: 'blue', hex: 0x2a6ee8, name: 'הכחול', e: '💙' }, { k: 'purple', hex: 0x8a3ad8, name: 'הסגול', e: '💜' },
  { k: 'pink', hex: 0xf07ab8, name: 'הוורוד', e: '🩷' },
];

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); }
function paint(geo, hex) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const merge = (list) => mergeGeometries(list.map(strip), false);
const vc = (opts = {}) => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, ...opts });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }
const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew',Arial,sans-serif";

// ---------------- Fluffy (code-built: soft, round, three sleeping heads; ~3.5k tris, 4 draw calls) ----------------
function fluffy() {
  const g = new Group(); g.name = 'adv-fluffy';
  const FUR = 0x9a6a40, DARK = 0x6a4428, MUZ = 0xd0a878, NOSE = 0x2a1a14, COLLAR = 0xc0302a;
  const S = (r, w, h) => new SphereGeometry(r, w, h);
  const body = [];
  body.push(paint(place(S(1, 16, 10), 0, 0.85, -0.5, 0, 0, 0, 1.2, 0.85, 1.7), FUR));
  for (const sx of [-1, 1]) {
    body.push(paint(place(S(1, 10, 7), sx * 0.8, 0.62, -1.4, 0, 0, 0, 0.62, 0.6, 0.78), FUR));
    body.push(paint(place(S(1, 8, 6), sx * 0.55, 0.18, 1.05, 0, 0, 0, 0.3, 0.2, 0.55), DARK));
    body.push(paint(place(S(1, 8, 6), sx * 1.05, 0.18, -0.95, 0, 0, 0, 0.3, 0.2, 0.5), DARK));
  }
  for (const [x, y, z, r] of [[0.5, 0.55, -2.1, 0.2], [0.85, 0.45, -2.35, 0.17], [1.2, 0.36, -2.25, 0.14]]) body.push(paint(place(S(r, 8, 6), x, y, z), FUR));
  const bodyMesh = new Mesh(merge(body), vc({ roughness: 0.95 })); bodyMesh.name = 'fluffy-body'; g.add(bodyMesh);
  // one head (dog faces +z), reused three times
  const hp = [];
  hp.push(paint(place(S(1, 12, 8), 0, 0, 0, 0, 0, 0, 0.48, 0.42, 0.5), FUR));
  hp.push(paint(place(S(1, 10, 7), 0, -0.11, 0.42, 0, 0, 0, 0.27, 0.2, 0.32), MUZ));
  hp.push(paint(place(S(1, 8, 5), 0, -0.02, 0.73, 0, 0, 0, 0.1, 0.075, 0.07), NOSE));
  for (const sx of [-1, 1]) {
    hp.push(paint(place(S(1, 8, 5), sx * 0.38, -0.08, -0.04, 0, 0, sx * 0.45, 0.14, 0.32, 0.1), DARK));                // floppy ears
    hp.push(paint(place(S(1, 8, 5), sx * 0.17, 0.09, 0.41, 0, 0, sx * -0.15, 0.11, 0.022, 0.04), NOSE));               // closed, smiling eyes
  }
  hp.push(paint(place(new SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0.08, -0.25, 0.58, Math.PI, 0, 0, 0.09, 0.09, 0.05), 0xe87a8a));   // a little pink tongue
  hp.push(paint(place(S(1, 10, 6), 0, -0.15, -0.42, 0, 0, 0, 0.32, 0.32, 0.45), FUR));
  hp.push(paint(place(new TorusGeometry(0.33, 0.055, 5, 12), 0, -0.15, -0.36, 0, 0, 0), COLLAR));
  hp.push(paint(place(S(0.06, 6, 4), 0, -0.47, -0.3), 0xffd76a));
  const headGeo = merge(hp), headMat = vc({ roughness: 0.92 });
  const heads = [];
  for (const [x, y, z, yaw, roll] of [[-0.82, 0.62, 1.0, 0.45, 0.25], [0, 0.7, 1.3, 0, -0.08], [0.82, 0.6, 1.0, -0.45, -0.22]]) {
    const h = new Mesh(headGeo, headMat); h.position.set(x, y, z); h.rotation.set(0.12, yaw, roll); h.userData.base = { y, rx: 0.12 }; g.add(h); heads.push(h);
  }
  return { g, heads, body: bodyMesh };
}

// ---------------- the room shell + props ----------------
export function buildChambers(progress) {
  const g = new Group(); g.name = 'adv-chambers'; const cols = [];
  const WALL = 0xc0a47c, wallM = stoneMat(3.3, 1.5, WALL), LINT = stoneMat(1.2, 0.5, WALL);
  const add = (geo, mat, parent = g) => { const m = new Mesh(geo, mat); parent.add(m); return m; };
  const box = (x, z, w, d, h = H, y = h / 2, mat = wallM) => add(new BoxGeometry(w, h, d).translate(x, y, z), mat);
  const fl = floor(g, 11, 61, 0xb0a288, 2.5, 0.8); fl.position.z = -25;
  const cl = ceiling(g, 11, 61, H, 0x6a5a48); cl.position.z = -25;
  for (let i = 0; i < N; i++) for (const sx of [-1, 1]) { box(sx * 5, zc(i), 1, 11); cols.push({ type: 'box', x: sx * 5, z: zc(i), hw: 0.5, hd: 5.5, angle: 0 }); }
  // south wall (a doorway back to the staircase hall), north wall
  for (const sx of [-1, 1]) { box(sx * 3.35, 5, 3.3, 1); cols.push({ type: 'box', x: sx * 3.35, z: 5, hw: 1.65, hd: 0.5, angle: 0 }); }
  box(0, 5, 3.4, 1, H - 3.2, 3.2 + (H - 3.2) / 2, LINT);
  box(0, -55, 11, 1); cols.push({ type: 'box', x: 0, z: -55, hw: 5.5, hd: 0.5, angle: 0 });
  // dividers: room 0|1 is solid (the trapdoor goes down), the rest have a 2.4 m doorway with a barrier until the step is done
  const barriers = [];
  for (let i = 0; i < N - 1; i++) {
    const z = DOOR_Z(i);
    if (i === 0) { box(0, z, 11, 1); cols.push({ type: 'box', x: 0, z, hw: 5.5, hd: 0.5, angle: 0 }); barriers.push(null); continue; }
    for (const sx of [-1, 1]) { box(sx * 3.35, z, 3.3, 1); cols.push({ type: 'box', x: sx * 3.35, z, hw: 1.65, hd: 0.5, angle: 0 }); }
    box(0, z, 3.4, 1, H - 3.2, 3.2 + (H - 3.2) / 2, LINT);
    const b = { type: 'box', x: 0, z, hw: 1.2, hd: 0.5, angle: 0 }; cols.push(b); barriers.push(b);
  }
  // torches: two per room, warm
  for (let i = 0; i < N; i++) for (const sx of [-1, 1]) { const t = torch(g, sx * 4.4, 2.7, zc(i) + 1.8, 0xff9a3a, { shared: true }); if (sx > 0) t.rotation.y = Math.PI; }
  // a warm floor pool in every room (bakeLight 'glow')
  for (let i = 0; i < N; i++) { const o = new Object3D(); o.position.set(0, 0.1, zc(i)); o.userData.light = { k: 'glow', c: 0xffd8a0, r: 4.2, a: 0.22 }; g.add(o); }
  // the doorway back to the staircase: warm glow beyond
  const back = add(new PlaneGeometry(2.4, 3.2).rotateY(Math.PI).translate(0, 1.6, 5.4), new MeshBasicMaterial({ map: canvasTex(64, 128, (x, w, h) => { const gr = x.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#ffcf8a'); gr.addColorStop(1, '#8a4a1a'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }) }));
  back.name = 'adv-back-glow';
  mergeStatic(g, g.children.filter(c => c !== back));

  const rooms = [];
  for (let i = 0; i < N; i++) { const r = new Group(); r.name = 'adv-room-' + i; g.add(r); rooms.push(r); }
  const P = {};
  // ---- 0: Fluffy, the harp, the trapdoor ----
  {
    const f = fluffy(); f.g.position.set(SPOTS.fluffy.x, 0, SPOTS.fluffy.z); rooms[0].add(f.g); P.fluffy = f;
    cols.push({ type: 'circle', x: SPOTS.fluffy.x, z: SPOTS.fluffy.z - 0.2, r: 1.9 });
    // the Z's of the snore: one instanced quad texture
    const zt = canvasTex(64, 64, (x) => { x.font = 'bold 54px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff6d0'; x.strokeStyle = '#6a4a8a'; x.lineWidth = 6; x.strokeText('z', 32, 34); x.fillText('z', 32, 34); });
    const zs = new InstancedMesh(new PlaneGeometry(0.4, 0.4), new MeshBasicMaterial({ map: zt, transparent: true, depthWrite: false }), 6);
    zs.frustumCulled = false; zs.count = 6; zs.name = 'fluffy-z'; zs.raycast = () => {}; rooms[0].add(zs); P.zs = zs;
    // the harp on a stool
    const hg = new Group(); hg.position.set(SPOTS.harp.x, 0, SPOTS.harp.z); hg.rotation.y = 0.6; rooms[0].add(hg);
    const gold = [];
    gold.push(place(new CylinderGeometry(0.035, 0.045, 1.0, 8), -0.28, 1.15, 0));
    gold.push(place(new TorusGeometry(0.3, 0.035, 6, 14, Math.PI * 0.95), 0.0, 1.62, 0, 0, 0, 0.05));
    gold.push(place(new CylinderGeometry(0.03, 0.09, 1.05, 4), 0.2, 1.12, 0, 0, 0, -0.35));
    gold.push(place(new BoxGeometry(0.62, 0.08, 0.26), 0, 0.62, 0));
    const harp = new Mesh(merge(gold), MAT.gold); hg.add(harp);
    const stool = new Mesh(merge([place(new CylinderGeometry(0.34, 0.34, 0.08, 12), 0, 0.55, 0), ...[0, 1, 2].map(k => place(new CylinderGeometry(0.03, 0.03, 0.55, 5), Math.cos(k * 2.1) * 0.24, 0.27, Math.sin(k * 2.1) * 0.24))]), woodMat(1, 1)); hg.add(stool);
    const str = []; for (let k = 0; k < 7; k++) { const x = -0.2 + k * 0.065, top = 1.5 + Math.sin((k / 6) * Math.PI) * 0.32 - k * 0.02; str.push(place(new BoxGeometry(0.008, top - 0.7 - k * 0.04, 0.008), x, (top + 0.7 + k * 0.04) / 2, 0)); }
    const strings = new Mesh(merge(str), new MeshBasicMaterial({ color: 0xfff2c0 })); hg.add(strings);
    cols.push({ type: 'circle', x: SPOTS.harp.x, z: SPOTS.harp.z, r: 0.45 });
    P.harp = { g: hg, strings };
    // the trapdoor: a dark-green glowing hole under a hinged oak lid with an iron ring
    const hole = add(new PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2).translate(SPOTS.trap.x, 0.012, SPOTS.trap.z), new MeshBasicMaterial({ map: canvasTex(64, 64, (x, w, h) => { const gr = x.createRadialGradient(32, 32, 2, 32, 32, 34); gr.addColorStop(0, '#9adf6a'); gr.addColorStop(0.5, '#2e6a2a'); gr.addColorStop(1, '#14240e'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }) }), rooms[0]);
    const pivot = new Group(); pivot.position.set(SPOTS.trap.x, 0.02, SPOTS.trap.z - 0.7); rooms[0].add(pivot);
    const lid = new Mesh(merge([paint(place(new BoxGeometry(1.4, 0.07, 1.4), 0, 0.035, 0.7), 0x7a5230), ...[-0.4, 0, 0.4].map(x => paint(place(new BoxGeometry(0.03, 0.075, 1.38), x, 0.04, 0.7), 0x4a3018)), paint(place(new TorusGeometry(0.12, 0.022, 5, 12), 0, 0.08, 1.15, Math.PI / 2, 0, 0), 0x2e2b30)]), vc());
    pivot.add(lid); P.trap = { pivot, hole };
    if (progress >= 1) pivot.rotation.x = -1.9;
  }
  // ---- 1: Devil's Snare (soft green vines; a curtain over the far doorway that shrinks back from light) ----
  {
    const R = rooms[1], Z = zc(1), vines = [], curtain = [];
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const vine = (pts, r, list, hex) => { const geo = new TubeGeometry(new CatmullRomCurve3(pts.map(p => new Vector3(...p))), 18, r, 5, false); list.push(paint(geo, hex)); };
    for (let k = 0; k < 9; k++) { const x = -1.15 + k * 0.29, s = rnd() - 0.5; vine([[x, 3.2, 0], [x + s * 0.5, 2.3, 0.15], [x - s * 0.4, 1.3, -0.1], [x + s * 0.3, 0.3, 0.2], [x + s, 0.02, 0.6]], 0.06 + rnd() * 0.03, curtain, k % 2 ? 0x3a8a3a : 0x4aa040); }
    for (let k = 0; k < 4; k++) { const y = 0.8 + k * 0.7; vine([[-1.25, y, 0], [-0.4, y + 0.25, 0.12], [0.4, y - 0.2, 0.1], [1.25, y + 0.1, 0]], 0.05, curtain, 0x58b048); }
    for (let k = 0; k < 14; k++) {
      const sx = k % 2 ? 1 : -1, z = Z + 3.5 - (k >> 1) * 1.1, y0 = 0.05;
      vine([[sx * 4.4, 3.4 * rnd() + 0.6, z], [sx * 3.6, 1.2, z + 0.4 * (rnd() - 0.5)], [sx * (2.4 + rnd()), 0.3, z + rnd() - 0.5], [sx * (1.6 + rnd()), y0, z + rnd()]], 0.07, vines, k % 3 ? 0x3e8c38 : 0x5aa848);
    }
    for (const [x, z, s] of [[-2.6, Z + 2.2, 1], [2.4, Z + 1.0, 0.9], [-1.6, Z - 2.0, 0.8], [2.8, Z - 2.6, 1.1], [0, Z + 3.4, 0.7]]) vines.push(paint(place(new SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), x, 0, z, 0, 0, 0, s, 0.35 * s, s), 0x3a7a34));
    const vm = vc({ roughness: 0.75 });
    const room = new Mesh(merge(vines), vm); room.name = 'snare-room'; R.add(room);
    const cg = new Group(); cg.position.set(0, 0, DOOR_Z(1) + 0.55); R.add(cg);
    const cur = new Mesh(merge(curtain), vm); cur.name = 'snare-curtain'; cg.add(cur);
    // leaves: one instanced quad
    const lt = canvasTex(64, 64, (x) => { x.fillStyle = '#6ac850'; x.beginPath(); x.ellipse(32, 32, 14, 28, 0.5, 0, 7); x.fill(); x.strokeStyle = '#2e6a2a'; x.lineWidth = 3; x.beginPath(); x.moveTo(20, 54); x.lineTo(44, 10); x.stroke(); });
    const leaves = new InstancedMesh(new PlaneGeometry(0.32, 0.32), new MeshStandardMaterial({ map: lt, transparent: true, alphaTest: 0.4, side: DoubleSide, roughness: 0.8 }), 40);
    const d = new Object3D(); for (let k = 0; k < 40; k++) { d.position.set(-1.2 + rnd() * 2.4, 0.2 + rnd() * 3, (rnd() - 0.5) * 0.5); d.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); d.updateMatrix(); leaves.setMatrixAt(k, d.matrix); }
    leaves.name = 'snare-leaves'; cg.add(leaves);
    P.snare = { curtain: cg, room };
    if (progress >= 2) { cg.scale.set(1, 0.06, 1); cg.position.y = 3.1; room.scale.set(1, 0.7, 1); }
  }
  // ---- 2: the flying keys + the locked door ----
  {
    const R = rooms[2];
    const keyParts = (big) => { const s = big ? 1.6 : 1; return [
      place(new CylinderGeometry(0.022 * s, 0.022 * s, 0.38 * s, 6), 0, 0, 0, 0, 0, Math.PI / 2),
      place(new TorusGeometry(0.07 * s, 0.02 * s, 5, 12), -0.25 * s, 0, 0),
      place(new BoxGeometry(0.06 * s, 0.1 * s, 0.02 * s), 0.17 * s, -0.06 * s, 0)]; };
    const wingGeo = (s, bent) => { const a = place(new PlaneGeometry(0.24 * s, 0.11 * s), 0, 0.09 * s, 0.1 * s, -0.5, 0, 0.2), b = place(new PlaneGeometry(0.24 * s, 0.11 * s), 0, 0.09 * s, -0.1 * s, 0.5, 0, bent ? -0.55 : -0.2); return merge([a, b]); };
    const keyM = new MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.35 });
    const NK = 11;
    const keys = new InstancedMesh(merge(keyParts(false)), keyM, NK); keys.frustumCulled = false; keys.name = 'keys';
    const wings = new InstancedMesh(wingGeo(1, false), new MeshStandardMaterial({ color: 0xf4f0ff, side: DoubleSide, roughness: 0.6, transparent: true, opacity: 0.9 }), NK); wings.frustumCulled = false; wings.name = 'key-wings';
    for (let k = 0; k < NK; k++) keys.setColorAt(k, _c.setHex([0xe0b040, 0xc08a3a, 0xd8c070][k % 3]));
    R.add(keys, wings);
    const sk = new Group(); sk.name = 'special-key';
    sk.add(new Mesh(merge(keyParts(true)), new MeshStandardMaterial({ color: 0xd8dde8, metalness: 0.8, roughness: 0.25 })));
    sk.add(new Mesh(wingGeo(1.6, true), new MeshStandardMaterial({ color: 0x4a8af0, emissive: 0x1a3a90, emissiveIntensity: 0.5, side: DoubleSide, roughness: 0.5 })));
    R.add(sk);
    // the door: oak leaf on a hinge at x -1.2 + a brass lock plate
    const hinge = new Group(); hinge.position.set(-1.2, 0, DOOR_Z(2) + 0.45); R.add(hinge);
    const leaf = new Mesh(merge([paint(place(new BoxGeometry(2.4, 3.2, 0.1), 1.2, 1.6, 0), 0x6a4426), ...[0.6, 2.6].map(y => paint(place(new BoxGeometry(2.4, 0.14, 0.12), 1.2, y, 0.01), 0x2e2b30)),
      paint(place(new BoxGeometry(0.34, 0.4, 0.06), 1.65, 1.25, 0.07), 0xd8a840), paint(place(new BoxGeometry(0.06, 0.14, 0.02), 1.65, 1.22, 0.11), 0x1a1008)]), vc({ roughness: 0.7 }));
    hinge.add(leaf);
    if (progress >= 3) { hinge.rotation.y = 1.7; sk.visible = false; }
    P.keys = { keys, wings, sk, hinge, NK };
  }
  // ---- 3: giant chess (simplified, nothing smashed: the white king bows and lays down his crown) ----
  {
    const R = rooms[3], s = BOARD.s;
    const bt = canvasTex(256, 256, (x) => { x.fillStyle = '#5a3a20'; x.fillRect(0, 0, 256, 256); const c = 236 / 6; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { x.fillStyle = (i + j) % 2 ? '#3a2a22' : '#e8dcc0'; x.fillRect(10 + i * c, 10 + j * c, c, c); } });
    const bw = s * 6 * 256 / 236;
    const board = new Mesh(new PlaneGeometry(bw, bw).rotateX(-Math.PI / 2), new MeshStandardMaterial({ map: bt, roughness: 0.6 }));
    board.position.set(BOARD.x0 + 2.5 * s, 0.015, BOARD.z0 - 2.5 * s); R.add(board);
    const prof = (pts) => new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), 12);
    const pawn = () => prof([[0, 0], [0.3, 0], [0.3, 0.1], [0.18, 0.18], [0.12, 0.55], [0.2, 0.62], [0.12, 0.66], [0.17, 0.8], [0.1, 0.95], [0, 0.97]]);
    const rook = () => prof([[0, 0], [0.33, 0], [0.33, 0.12], [0.22, 0.22], [0.2, 0.9], [0.3, 0.95], [0.3, 1.2], [0, 1.2]]);
    const king = () => prof([[0, 0], [0.36, 0], [0.36, 0.14], [0.22, 0.25], [0.15, 1.1], [0.28, 1.2], [0.14, 1.28], [0.25, 1.55], [0, 1.6]]);
    const knight = () => merge([prof([[0, 0], [0.33, 0], [0.33, 0.12], [0.22, 0.22], [0.2, 0.55], [0, 0.6]]), place(new BoxGeometry(0.28, 0.6, 0.5), 0, 0.85, 0.06, -0.3, 0, 0), place(new BoxGeometry(0.24, 0.24, 0.4), 0, 1.0, 0.32, 0.4, 0, 0), place(new BoxGeometry(0.06, 0.16, 0.1), 0.08, 1.2, 0, 0, 0, 0), place(new BoxGeometry(0.06, 0.16, 0.1), -0.08, 1.2, 0, 0, 0, 0)]);
    const WH = 0xece4d2, BL = 0x3a2c26, wList = [], bList = [];
    const at = (geo, c, r, list, hex) => { sq(c, r, _v); list.push(paint(place(geo, _v.x, 0, _v.z), hex)); };
    at(pawn(), 0, 1, bList, BL); at(pawn(), 4, 1, bList, BL); at(rook(), 5, 0, bList, BL); at(pawn(), 3, 1, bList, BL);
    at(pawn(), 0, 4, wList, WH); at(pawn(), 4, 4, wList, WH); at(rook(), 0, 5, wList, WH); at(pawn(), 5, 4, wList, WH);
    R.add(new Mesh(merge(bList), vc({ roughness: 0.4 })), new Mesh(merge(wList), vc({ roughness: 0.4 })));
    const knightM = new Mesh(strip(paint(knight(), BL)), vc({ roughness: 0.4 })); sq(1, 1, _v); knightM.position.set(_v.x, 0, _v.z); R.add(knightM);
    const kingM = new Mesh(strip(paint(king(), WH)), vc({ roughness: 0.4 })); sq(3, 5, _v); kingM.position.set(_v.x, 0, _v.z); R.add(kingM);
    const crown = new Mesh(merge([paint(place(new CylinderGeometry(0.17, 0.14, 0.12, 10, 1, true), 0, 0.06, 0), 0xffd040), ...[0, 1, 2, 3, 4].map(k => paint(place(new SphereGeometry(0.035, 6, 4), Math.cos(k * 1.256) * 0.16, 0.14, Math.sin(k * 1.256) * 0.16), 0xffe070))]), vc({ metalness: 0.6, roughness: 0.3, emissive: 0x3a2a00 }));
    crown.position.set(kingM.position.x, 1.6, kingM.position.z); R.add(crown);
    const doorRook = new Mesh(strip(paint(rook(), WH)), vc({ roughness: 0.4 })); doorRook.position.set(0, 0, DOOR_Z(3) + 1.0); doorRook.scale.setScalar(1.25); R.add(doorRook);
    const hl = new InstancedMesh(new PlaneGeometry(s * 0.92, s * 0.92).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false }), 3);
    hl.frustumCulled = false; hl.count = 0; hl.name = 'chess-hl'; R.add(hl);
    for (const [c, r] of [[0, 1], [4, 1], [5, 0], [3, 1], [0, 4], [4, 4], [0, 5], [5, 4], [3, 5]]) { sq(c, r, _v); cols.push({ type: 'circle', x: _v.x, z: _v.z, r: 0.3 }); }
    if (progress >= 4) { sq(2, 3, _v); knightM.position.set(_v.x, 0, _v.z); kingM.rotation.x = 0.35; crown.position.set(kingM.position.x, 0.06, kingM.position.z + 0.6); doorRook.position.x = -2.4; }
    P.chess = { knightM, kingM, crown, doorRook, hl };
  }
  // ---- 4: seven coloured bottles + the purple flame curtain ----
  {
    const R = rooms[4], T = SPOTS.table;
    R.add(new Mesh(merge([place(new BoxGeometry(3.4, 0.1, 0.9), T.x, 0.9, T.z), ...[[-1.55, -0.35], [1.55, -0.35], [-1.55, 0.35], [1.55, 0.35]].map(([x, z]) => place(new BoxGeometry(0.1, 0.9, 0.1), T.x + x, 0.45, T.z + z))]), woodMat(1, 1)));
    cols.push({ type: 'box', x: T.x, z: T.z, hw: 1.75, hd: 0.5, angle: 0 });
    const bottleGeo = new LatheGeometry([[0, 0], [0.09, 0], [0.11, 0.04], [0.11, 0.2], [0.07, 0.26], [0.035, 0.3], [0.035, 0.4], [0.045, 0.42], [0, 0.43]].map(([r, y]) => new Vector2(r * 1.4, y * 1.4)), 12);
    const bottles = new InstancedMesh(bottleGeo, new MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.1, emissive: 0x222222 }), 7);
    bottles.frustumCulled = false; bottles.name = 'bottles';
    const d = new Object3D(), bpos = [];
    for (let k = 0; k < 7; k++) { const x = T.x - 1.35 + k * 0.45; bpos.push(new Vector3(x, 0.95, T.z - 0.05)); d.position.copy(bpos[k]); d.updateMatrix(); bottles.setMatrixAt(k, d.matrix); bottles.setColorAt(k, _c.setHex(COLOURS[k].hex)); }
    R.add(bottles);
    const scroll = new Mesh(new PlaneGeometry(0.6, 0.4).rotateX(-Math.PI / 2 + 0.3), new MeshStandardMaterial({ map: canvasTex(128, 96, (x) => { x.fillStyle = '#f4e4bc'; x.fillRect(0, 0, 128, 96); x.strokeStyle = '#8a6a3a'; x.lineWidth = 2; for (let y = 18; y < 90; y += 14) { x.beginPath(); x.moveTo(14, y); x.lineTo(114, y); x.stroke(); } x.fillStyle = '#7a3a12'; x.font = 'bold 26px serif'; x.textAlign = 'center'; x.fillText('🧪', 64, 60); }), roughness: 0.9 }));
    scroll.position.set(T.x, 0.97, T.z + 0.3); R.add(scroll);
    const ft = canvasTex(64, 128, (x) => { const gr = x.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,220,255,1)'); gr.addColorStop(0.35, 'rgba(190,90,255,.9)'); gr.addColorStop(1, 'rgba(90,20,160,0)'); x.fillStyle = gr; for (let k = 0; k < 4; k++) { x.beginPath(); const cx = 8 + k * 16; x.moveTo(cx - 9, 128); x.quadraticCurveTo(cx - 10, 50, cx, 4 + (k % 2) * 20); x.quadraticCurveTo(cx + 10, 50, cx + 9, 128); x.fill(); } });
    const fm = new MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const flames = [];
    for (const sx of [-1, 1]) { const p = new Group(); p.position.set(sx * 1.2, 0, DOOR_Z(4) + 0.6); R.add(p); for (let k = 0; k < 2; k++) { const f = new Mesh(new PlaneGeometry(1.2, 2.6).translate(-sx * 0.6, 1.3, k * 0.12), fm); p.add(f); } flames.push(p); }
    if (progress >= 5) for (const f of flames) f.scale.x = 0.02;
    P.potions = { bottles, bpos, flames };
  }
  // ---- 5: the Mirror of Erised ----
  {
    const R = rooms[5], M = SPOTS.mirror, mz = -54.45;
    const fr = [place(new BoxGeometry(0.22, 3.3, 0.2), -1.0, 1.65, mz), place(new BoxGeometry(0.22, 3.3, 0.2), 1.0, 1.65, mz), place(new TorusGeometry(1.0, 0.11, 6, 18, Math.PI), 0, 3.3, mz),
      place(new BoxGeometry(2.3, 0.22, 0.24), 0, 0.3, mz), place(new BoxGeometry(2.0, 0.28, 0.06), 0, 4.0, mz + 0.05), ...[-1, 1].map(sx => place(new SphereGeometry(0.14, 8, 6), sx * 1.05, 0.1, mz + 0.1))];
    R.add(new Mesh(merge(fr), new MeshStandardMaterial({ color: 0xd8a840, metalness: 0.7, roughness: 0.3, emissive: 0x2a1a00 })));
    const band = new Mesh(new PlaneGeometry(1.9, 0.24), new MeshBasicMaterial({ map: canvasTex(256, 32, (x) => { x.fillStyle = '#6a4a14'; x.fillRect(0, 0, 256, 32); x.fillStyle = '#ffe9a0'; x.font = 'italic bold 17px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('erised stra ehru oyt ube cafru oyt on wohsi', 128, 17); }) }));
    band.position.set(0, 4.0, mz + 0.09); R.add(band);
    const mc = document.createElement('canvas'); mc.width = 256; mc.height = 384;
    const mt = new CanvasTexture(mc); mt.colorSpace = SRGBColorSpace;
    const glass = new Mesh(new PlaneGeometry(1.8, 3.0), new MeshBasicMaterial({ map: mt })); glass.position.set(0, 1.85, mz + 0.02); R.add(glass);
    const stone = new Mesh(new IcosahedronGeometry(0.11, 0), new MeshStandardMaterial({ color: 0xe0202a, emissive: 0xa00a14, emissiveIntensity: 1.2, roughness: 0.2 })); stone.visible = false; stone.name = 'the-stone'; R.add(stone);
    cols.push({ type: 'box', x: 0, z: mz + 0.2, hw: 1.3, hd: 0.3, angle: 0 });
    P.mirror = { canvas: mc, tex: mt, stone, glass };
  }
  const light = bakeLight(g, cols);
  return { g, cols, barriers, rooms, P, light };
}

// the Mirror's picture: soft gold mist; `show` 0..1 brings up Harry holding the red stone
export function drawMirror(c, show, t) {
  const x = c.getContext('2d'), w = c.width, h = c.height;
  const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a4630'); gr.addColorStop(0.5, '#8a7050'); gr.addColorStop(1, '#4a3828'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 7; k++) { const cx = w / 2 + Math.sin(t * 0.5 + k * 1.7) * 70, cy = h * (0.2 + k * 0.1) + Math.cos(t * 0.4 + k) * 12, r = 60 + k * 6; const m = x.createRadialGradient(cx, cy, 2, cx, cy, r); m.addColorStop(0, 'rgba(255,236,190,.22)'); m.addColorStop(1, 'rgba(255,236,190,0)'); x.fillStyle = m; x.fillRect(0, 0, w, h); }
  if (show > 0) {
    x.save(); x.globalAlpha = Math.min(1, show);
    const cx = w / 2;
    x.fillStyle = '#2a2430'; x.beginPath(); x.moveTo(cx - 70, h); x.quadraticCurveTo(cx - 78, 200, cx - 40, 178); x.lineTo(cx + 40, 178); x.quadraticCurveTo(cx + 78, 200, cx + 70, h); x.fill();          // robe
    x.fillStyle = '#9a1a1a'; x.fillRect(cx - 34, 176, 68, 16); x.fillStyle = '#d8a830'; x.fillRect(cx - 34, 184, 68, 5);                                                                                        // scarf
    x.fillStyle = '#f0c8a0'; x.beginPath(); x.ellipse(cx, 135, 34, 40, 0, 0, 7); x.fill();                                                                                                                     // face
    x.fillStyle = '#1e1612'; x.beginPath(); x.ellipse(cx, 104, 40, 22, 0, Math.PI, 0); x.fill(); for (let k = -3; k <= 3; k++) { x.beginPath(); x.ellipse(cx + k * 11, 102, 8, 14, k * 0.3, 0, 7); x.fill(); } // hair
    x.strokeStyle = '#1a1a1a'; x.lineWidth = 3; for (const sx of [-1, 1]) { x.beginPath(); x.arc(cx + sx * 14, 136, 10, 0, 7); x.stroke(); } x.beginPath(); x.moveTo(cx - 4, 136); x.lineTo(cx + 4, 136); x.stroke();
    x.strokeStyle = '#a02020'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx + 6, 108); x.lineTo(cx + 1, 116); x.lineTo(cx + 7, 116); x.lineTo(cx + 2, 124); x.stroke();                                     // the scar
    x.strokeStyle = '#7a3a2a'; x.lineWidth = 3; x.beginPath(); x.arc(cx, 150, 12, 0.2, Math.PI - 0.2); x.stroke();                                                                                             // smile
    x.fillStyle = '#f0c8a0'; x.beginPath(); x.ellipse(cx - 18, 252, 16, 12, 0, 0, 7); x.ellipse(cx + 18, 252, 16, 12, 0, 0, 7); x.fill();                                                                        // hands
    const sg = x.createRadialGradient(cx, 240, 2, cx, 240, 46); sg.addColorStop(0, 'rgba(255,120,120,1)'); sg.addColorStop(0.3, 'rgba(230,30,40,.9)'); sg.addColorStop(1, 'rgba(230,30,40,0)');
    x.fillStyle = sg; x.fillRect(cx - 50, 190, 100, 100); x.fillStyle = '#e0202a'; x.beginPath(); x.moveTo(cx, 226); x.lineTo(cx + 13, 240); x.lineTo(cx, 254); x.lineTo(cx - 13, 240); x.closePath(); x.fill();
    x.restore();
  }
}
export { FLOOR_Y, FONT };
