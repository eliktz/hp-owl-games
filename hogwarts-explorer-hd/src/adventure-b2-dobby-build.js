// Book 2, quest 2 geometry (adventure-b2-dobby.js runs it): Dobby, the hidden letters, the Herbology corner by the
// glasshouse (a potting table, small pots with baby mandrakes, bigger empty pots with ribbons, a bench with fluffy pink
// earmuffs) and the earmuffs Harry wears. All code-built, vertex colours, no disk textures, friendly and funny.
// Budgets: Dobby <= 2.5k tris; everything at the glasshouse <= 3k tris (it is outdoors: the cap there is 300k).
import {
  Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, ConeGeometry, CapsuleGeometry, LatheGeometry,
  IcosahedronGeometry, CircleGeometry, PlaneGeometry, Vector2, Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, InstancedMesh, SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); }
function paint(geo, hex) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const merge = (list) => mergeGeometries(list.map(strip), false);
const vc = (opts = {}) => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...opts });
const S = (w, h) => new SphereGeometry(1, w, h);
const noRay = (o) => { o.traverse(m => { if (m.isMesh) m.raycast = () => {}; }); return o; };
export const triCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); } }); return Math.round(n); };
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }

export const RIBBONS = [0xc0302a, 0x2a5ac0, 0xd8b020, 0x8a3ac0, 0x2a9a4a];
export const RIB_NAME = ['אדום', 'כחול', 'צהוב', 'סגול', 'ירוק'];

// ---------------- Dobby (faces +z, feet at y 0, about 0.95 m; arms on shoulder pivots, ears on their own pivots) ----------------
export function buildDobby() {
  const SKIN = 0xb4ac86, SKIN2 = 0xa0986e, EAR_IN = 0xc89a8a, SACK = 0xc8c0aa, SACK2 = 0xa89e86, DARK = 0x1a1a18, IRIS = 0x3a9a4a;
  const mat = vc({ roughness: 0.85 });
  const root = new Group(); root.name = 'adv-dobby';
  const L = [];
  // the pillowcase: a sack with a knot on one shoulder and a ragged hem
  L.push(paint(place(new CylinderGeometry(0.15, 0.2, 0.42, 14, 1, true), 0, 0.33, 0), SACK));
  L.push(paint(place(new CircleGeometry(0.2, 14).rotateX(Math.PI / 2), 0, 0.12, 0), SACK));
  L.push(paint(place(S(8, 4), 0, 0.54, 0, 0, 0, 0, 0.16, 0.06, 0.13), SACK));
  L.push(paint(place(S(8, 6), 0.11, 0.56, 0.02, 0, 0, 0, 0.06), SACK2));
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; L.push(paint(place(new ConeGeometry(0.05, 0.08, 4), Math.cos(a) * 0.18, 0.09, Math.sin(a) * 0.18, Math.PI, 0, 0), SACK2)); }
  // thin legs, big feet
  for (const sx of [-1, 1]) { L.push(paint(place(new CapsuleGeometry(0.03, 0.1, 2, 6), sx * 0.08, 0.07, 0), SKIN)); L.push(paint(place(S(10, 6), sx * 0.09, 0.03, 0.06, 0, 0, 0, 0.065, 0.035, 0.11), SKIN2)); }
  // neck + head (a big round head), long pointy nose, a wide happy smile, huge green eyes
  L.push(paint(place(new CylinderGeometry(0.04, 0.05, 0.08, 8), 0, 0.6, 0), SKIN));
  L.push(paint(place(S(14, 10), 0, 0.78, 0, 0, 0, 0, 0.23, 0.21, 0.22), SKIN));
  L.push(paint(place(new ConeGeometry(0.04, 0.18, 8), 0, 0.74, 0.27, Math.PI / 2 + 0.35, 0, 0), SKIN2));
  L.push(paint(place(new TorusGeometry(0.075, 0.014, 5, 12, Math.PI), 0, 0.68, 0.2, 0.25, 0, Math.PI), 0x6a2a24));
  for (const sx of [-1, 1]) {
    L.push(paint(place(S(10, 8), sx * 0.095, 0.8, 0.15, 0, 0, 0, 0.085, 0.095, 0.07), 0xf0ece0));
    L.push(paint(place(S(10, 6), sx * 0.09, 0.79, 0.205, 0, 0, 0, 0.055, 0.06, 0.03), IRIS));
    L.push(paint(place(S(8, 6), sx * 0.09, 0.79, 0.228, 0, 0, 0, 0.028, 0.032, 0.015), DARK));
    L.push(paint(place(S(6, 4), sx * 0.075, 0.81, 0.236, 0, 0, 0, 0.012), 0xffffff));
    L.push(paint(place(S(6, 3), sx * 0.095, 0.86, 0.16, 0.4, 0, 0, 0.095, 0.04, 0.075), SKIN2));   // brows / lids
  }
  const bodyMesh = new Mesh(merge(L), mat); bodyMesh.name = 'dobby-body'; root.add(bodyMesh);
  // ears: huge, flat, a little droopy (pivots so they can flap)
  const ears = [-1, 1].map((sx) => {
    const p = new Group(); p.position.set(sx * 0.2, 0.8, -0.01); root.add(p);
    const E = [paint(place(S(10, 6), sx * 0.2, 0.02, 0, 0, 0, sx * -0.25, 0.24, 0.1, 0.025), SKIN), paint(place(S(8, 4), sx * 0.2, 0.02, 0.016, 0, 0, sx * -0.25, 0.18, 0.065, 0.012), EAR_IN)];
    const m = new Mesh(merge(E), mat); p.add(m); return p;
  });
  const arms = [-1, 1].map((sx) => {
    const p = new Group(); p.position.set(sx * 0.15, 0.5, 0); root.add(p);
    const A = [paint(place(new CapsuleGeometry(0.025, 0.2, 2, 6), sx * 0.02, -0.12, 0, 0, 0, sx * 0.25), SKIN), paint(place(S(8, 6), sx * 0.05, -0.26, 0.01, 0, 0, 0, 0.04), SKIN)];
    const m = new Mesh(merge(A), mat); p.add(m); return p;
  });
  noRay(root);
  return { root, ears, arms, mat };
}

// ---------------- the hidden letters (one small mesh each, sharing one material whose glow the quest drives) ----------------
export function buildLetter(mat) {
  const L = [paint(new BoxGeometry(0.32, 0.018, 0.22), 0xd6ccb0), paint(place(new BoxGeometry(0.3, 0.004, 0.012), 0, 0.011, -0.02, 0, 0.6, 0), 0xa89a7a), paint(place(new BoxGeometry(0.3, 0.004, 0.012), 0, 0.011, -0.02, 0, -0.6, 0), 0xa89a7a),
    paint(place(new CylinderGeometry(0.035, 0.035, 0.012, 10), 0, 0.014, 0.02), 0xb01e1e)];
  const m = new Mesh(merge(L), mat); m.name = 'adv-letter'; m.raycast = () => {}; return m;
}

// ---------------- Herbology by the glasshouse: table, bench, earmuffs, small pots + mandrakes, big pots ----------------
// lite (levels 2-3: 4 or 5 of them): fewer segments on the same shapes, so the corner stays under 3k tris at every level
export function buildMandrake(ribbon, lite = false) {
  const ROOT = 0x9a7a52, ROOT2 = 0x7e6040, LEAF = 0x4a8a3a, LEAF2 = 0x5e9e46, DARK = 0x2a1a12;
  const g = new Group(); g.name = 'adv-mandrake';
  const B = [];
  const sm = lite ? S(4, 3) : S(6, 4);
  B.push(paint(place(lite ? S(8, 6) : S(10, 8), 0, 0.13, 0, 0, 0, 0, 0.095, 0.13, 0.09), ROOT));                                   // the round wrinkly root-baby
  B.push(paint(place(sm.clone(), 0, 0.02, 0, 0, 0, 0, 0.05, 0.05, 0.05), ROOT2));
  for (const sx of [-1, 1]) { B.push(paint(place(sm.clone(), sx * 0.035, 0.17, 0.08, 0, 0, 0, 0.016, 0.01, 0.01), DARK)); B.push(paint(place(new ConeGeometry(0.012, 0.09, lite ? 3 : 4), sx * 0.04, 0.0, 0.02, 0, 0, sx * 0.5), ROOT2)); }   // shut eyes, little root legs
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; B.push(paint(place(new ConeGeometry(0.035, 0.2, 4), Math.cos(a) * 0.03, 0.33, Math.sin(a) * 0.03, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5), k % 2 ? LEAF : LEAF2)); }   // leaf hair
  B.push(paint(place(new TorusGeometry(0.035, 0.012, lite ? 3 : 4, lite ? 6 : 8), 0, 0.25, 0, Math.PI / 2, 0, 0), ribbon));                   // the ribbon round its leaf tuft
  B.push(paint(place(sm.clone(), 0.05, 0.26, 0.01, 0, 0, 0, 0.03, 0.02, 0.015), ribbon));
  for (const sx of [-1, 1]) B.push(paint(place(lite ? new ConeGeometry(0.014, 0.08, 4) : new CapsuleGeometry(0.012, 0.06, 2, 4), sx * 0.1, 0.13, 0, 0, 0, sx * 0.9), ROOT2));   // little arms (up: wriggling)
  const mat = vc({ roughness: 0.85 });
  const body = new Mesh(merge(B), mat); g.add(body);
  const mouth = new Mesh(paint(place(lite ? S(6, 3) : S(8, 4), 0, 0, 0, 0, 0, 0, 0.028, 0.008, 0.01), 0x4a1a14), mat); mouth.position.set(0, 0.11, 0.088); g.add(mouth);
  noRay(g);
  return { g, body, mouth, mat };
}
// local frame of the Herbology corner: table along x at z 0, big pots in a row at z +0.9 on the ground, bench at x +2.6
export const SMALL_X = (n) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * 0.5);
export const TABLE_H = 0.85;
export function buildHerbology(n, potCols) {
  const g = new Group(); g.name = 'adv-herbology';
  const WOOD = 0x7a5232, WOOD2 = 0x5e3e24, POT = 0xa85a32, POT2 = 0x8a4626, SOIL = 0x3e2a1a;
  const L = [];
  // the potting table
  L.push(paint(place(new BoxGeometry(2.8, 0.08, 0.8), 0, TABLE_H, 0), WOOD));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(paint(place(new BoxGeometry(0.08, TABLE_H, 0.08), sx * 1.3, TABLE_H / 2, sz * 0.32), WOOD2));
  // the bench (earmuffs go on it)
  L.push(paint(place(new BoxGeometry(1.3, 0.07, 0.45), 2.7, 0.48, 0.3), WOOD));
  for (const sx of [-1, 1]) L.push(paint(place(new BoxGeometry(0.08, 0.46, 0.4), 2.7 + sx * 0.55, 0.23, 0.3), WOOD2));
  // small pots on the table (the mandrakes sit in them)
  const smallProf = [[0, 0], [0.09, 0], [0.12, 0.17], [0.135, 0.18], [0.12, 0.19], [0, 0.17]].map(([r, y]) => new Vector2(r, y));
  for (const x of SMALL_X(n)) L.push(paint(place(new LatheGeometry(smallProf, 8), x, TABLE_H + 0.04, 0), POT));
  // the bigger empty pots on the ground with a coloured ribbon band each
  const bigProf = [[0, 0], [0.18, 0], [0.26, 0.36], [0.29, 0.38], [0.27, 0.4], [0, 0.34]].map(([r, y]) => new Vector2(r, y));
  const bigX = SMALL_X(n).map(x => x * 1.35);
  bigX.forEach((x, i) => {
    L.push(paint(place(new LatheGeometry(bigProf, 10), x, 0, 0.95), POT2));
    L.push(paint(place(new CylinderGeometry(0.245, 0.235, 0.06, 10, 1, true), x, 0.25, 0.95), potCols[i]));
  });
  const mesh = new Mesh(merge(L), vc({ roughness: 0.9 })); mesh.name = 'herbology-props'; g.add(mesh);
  // the earmuffs on the bench
  const muffs = buildEarmuffs(); muffs.position.set(2.6, 0.53, 0.3); muffs.rotation.set(-Math.PI / 2 + 0.3, 0, 0); g.add(muffs);
  // a soft "z" for the sleeping mandrakes (one instanced card mesh)
  const zT = canvasTex(64, 64, (x) => { x.font = 'bold 54px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff6d0'; x.strokeStyle = '#3a6a3a'; x.lineWidth = 6; x.strokeText('z', 32, 34); x.fillText('z', 32, 34); });
  const zs = new InstancedMesh(new PlaneGeometry(0.22, 0.22), new MeshBasicMaterial({ map: zT, transparent: true, depthWrite: false }), 5);
  zs.count = 0; zs.frustumCulled = false; zs.name = 'mandrake-z'; g.add(zs);
  noRay(g);
  return { g, mesh, muffs, zs, bigX, smallX: SMALL_X(n) };
}
export function buildEarmuffs() {
  const PINK = 0xe88ab0, PINK2 = 0xd8709c;
  const L = [paint(place(new TorusGeometry(0.13, 0.018, 4, 10, Math.PI), 0, 0, 0), 0xb04a7a)];
  for (const sx of [-1, 1]) L.push(paint(place(new IcosahedronGeometry(1, 1), sx * 0.135, -0.01, 0, 0, 0, 0, 0.055, 0.075, 0.065), sx < 0 ? PINK : PINK2));
  const m = new Mesh(merge(L), vc({ roughness: 1 })); m.name = 'adv-earmuffs'; m.raycast = () => {};
  const g = new Group(); g.add(m); return g;
}
