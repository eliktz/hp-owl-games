// Book 1 quest 3 geometry (adventure-norbert.js runs it): baby Norbert, the egg in a black kettle over the fieldstone
// hearth behind Hagrid's hut, the straw nest, the hay that smokes a little, the bowl, the bucket, the crate with the
// teddy, the thought bubble, and the four far broom riders with lanterns for the tower. All code-built, vertex colours,
// canvas textures <= 256 px, no disk textures. Silly and warm, never scary.
// Budgets: Norbert <= 3k tris (2 meshes: body + both stubby wings); the hut props <= 3k tris (one merged mesh + the egg +
// the crate); the riders, lanterns and harness ropes: 3 draw calls, < 2k tris.
// Frames: the hut props are in the HEARTH's own frame (opening toward +z, the back on z 0, ground at y 0: the hearth
// slab top is y 0.08); Norbert faces +z with his feet at y 0.
import {
  Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, ConeGeometry, LatheGeometry, ShapeGeometry, Shape,
  CircleGeometry, PlaneGeometry, Vector2, Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute, BufferGeometry,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, InstancedMesh, LineSegments, LineBasicMaterial, SRGBColorSpace, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); }
function paint(geo, hex) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const merge = (list) => mergeGeometries(list.map(strip), false);
const vc = (opts = {}) => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...opts });
const S = (w, h) => new SphereGeometry(1, w, h);
const noRay = (o) => { o.traverse(m => { if (m.isMesh || m.isLineSegments) m.raycast = () => {}; }); return o; };
export const triCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); } }); return Math.round(n); };
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }

// ---------------- where things stand by the hearth (hearth frame) ----------------
export const SLAB_Y = 0.08;
export const KETTLE = { x: 0, y: 1.52, z: 0.36 };          // the kettle's centre, hanging over the fire
export const EGG_Y = KETTLE.y + 0.3;                        // the egg's centre, sitting in the kettle
export const NEST = { x: -1.3, z: 1.45 };
export const HAY = { x: -0.62, z: 1.15 };                  // the little pile of hay his hiccup sparks make smoke
export const BOWL = { x: 1.05, z: 1.45 };
export const BUCKET = { x: 1.62, z: 1.0 };
export const CRATE = { x: -2.55, z: 1.55 };
export const NS = 1.35;                                     // Norbert's scale (about 0.8 m: he reads clearly from the camera)

// ---------------- baby Norbert (round, big head, big eyes, stubby wings) ----------------
export function buildNorbert() {
  const GREEN = 0x5f9e4c, GREEN2 = 0x4c8640, BELLY = 0xf0dca0, SNOUT = 0x74b05c, DARK = 0x1a1612, WHITE = 0xffffff, SPIKE = 0xe8903a, HORN = 0xf4e6c0, BLUSH = 0xf08a8a;
  const root = new Group(); root.name = 'adv-norbert';
  const body = new Group(); root.add(body);                 // body pivots round its belly (the roll-over)
  body.position.y = 0.2;
  const L = [];
  // round body + cream belly
  L.push(paint(place(S(14, 10), 0, 0, 0, 0, 0, 0, 0.19, 0.2, 0.18), GREEN));
  L.push(paint(place(S(12, 8), 0, -0.01, 0.07, 0, 0, 0, 0.14, 0.15, 0.12), BELLY));
  for (let k = 0; k < 3; k++) L.push(paint(place(new TorusGeometry(0.1 - k * 0.012, 0.006, 3, 12, Math.PI), 0, -0.07 + k * 0.05, 0.172 - k * 0.006, 0, 0, Math.PI), 0xd8c088));   // belly stripes
  // stubby legs: two front paws, two round back feet
  for (const sx of [-1, 1]) {
    L.push(paint(place(S(8, 6), sx * 0.1, -0.13, 0.08, 0, 0, 0, 0.055, 0.07, 0.06), GREEN2));
    L.push(paint(place(S(8, 6), sx * 0.13, -0.17, -0.02, 0, 0, 0, 0.075, 0.05, 0.095), GREEN2));
    for (let t = -1; t <= 1; t++) L.push(paint(place(S(5, 3), sx * 0.13 + t * 0.03, -0.18, 0.07, 0, 0, 0, 0.018), HORN));   // little toes
  }
  // tail: three tapering beads curling round, a soft spade tip
  L.push(paint(place(S(8, 6), 0, -0.12, -0.2, 0, 0, 0, 0.08, 0.07, 0.09), GREEN));
  L.push(paint(place(S(8, 6), 0.08, -0.15, -0.3, 0, 0, 0, 0.055, 0.05, 0.07), GREEN));
  L.push(paint(place(S(6, 4), 0.17, -0.15, -0.33, 0, 0, 0, 0.04), GREEN));
  L.push(paint(place(new ConeGeometry(0.06, 0.09, 4), 0.24, -0.14, -0.33, 0, 0, -Math.PI / 2, 1, 1, 0.4), SPIKE));
  // big round head
  const HY = 0.29, HZ = 0.05;
  L.push(paint(place(S(16, 12), 0, HY, HZ, 0, 0, 0, 0.2, 0.185, 0.19), GREEN));
  L.push(paint(place(S(12, 8), 0, HY - 0.05, HZ + 0.15, 0, 0, 0, 0.12, 0.085, 0.09), SNOUT));                 // snout
  for (const sx of [-1, 1]) L.push(paint(place(S(5, 3), sx * 0.04, HY - 0.02, HZ + 0.235, 0, 0, 0, 0.014, 0.01, 0.01), DARK));   // nostrils
  L.push(paint(place(new TorusGeometry(0.05, 0.008, 3, 10, Math.PI), 0, HY - 0.08, HZ + 0.215, 0.3, 0, Math.PI), 0x6a2a24));   // a happy smile
  for (const sx of [-1, 1]) {
    L.push(paint(place(S(12, 10), sx * 0.085, HY + 0.035, HZ + 0.13, 0, 0, 0, 0.075, 0.082, 0.06), WHITE));    // huge eyes
    L.push(paint(place(S(10, 8), sx * 0.088, HY + 0.03, HZ + 0.172, 0, 0, 0, 0.055, 0.062, 0.03), 0x3a2418));  // brown iris
    L.push(paint(place(S(8, 6), sx * 0.088, HY + 0.03, HZ + 0.19, 0, 0, 0, 0.034, 0.04, 0.02), DARK));
    L.push(paint(place(S(6, 4), sx * 0.07, HY + 0.06, HZ + 0.205, 0, 0, 0, 0.016), WHITE));                    // sparkle
    L.push(paint(place(S(5, 3), sx * 0.105, HY + 0.005, HZ + 0.205, 0, 0, 0, 0.008), WHITE));
    L.push(paint(place(S(6, 4), sx * 0.14, HY - 0.05, HZ + 0.12, 0, 0, 0, 0.035, 0.022, 0.012), BLUSH));       // rosy cheeks
    L.push(paint(place(new ConeGeometry(0.03, 0.09, 6), sx * 0.08, HY + 0.18, HZ - 0.03, -0.35, 0, -sx * 0.35), HORN));   // tiny soft horns
    L.push(paint(place(new ConeGeometry(0.035, 0.08, 4), sx * 0.17, HY + 0.07, HZ - 0.04, 0, 0, -sx * 1.1, 1, 1, 0.45), GREEN2));   // ear frills
  }
  for (let k = 0; k < 5; k++) L.push(paint(place(new ConeGeometry(0.032 - k * 0.003, 0.07 - k * 0.006, 4), 0, HY + 0.13 - k * 0.1, HZ - 0.17 - k * 0.025 + (k > 1 ? 0.0 : 0), -0.7 - k * 0.25, 0, 0, 1, 1, 0.5), SPIKE));   // soft ridge
  const mat = vc({ roughness: 0.65 });
  const bodyMesh = new Mesh(merge(L), mat); bodyMesh.name = 'norbert-body'; body.add(bodyMesh);
  // stubby wings on shoulder pivots (flat, both sides)
  const wingShape = new Shape();
  wingShape.moveTo(0, 0); wingShape.lineTo(0.05, 0.16); wingShape.lineTo(0.22, 0.2); wingShape.quadraticCurveTo(0.2, 0.12, 0.23, 0.07);
  wingShape.quadraticCurveTo(0.16, 0.06, 0.16, 0.0); wingShape.quadraticCurveTo(0.08, 0.02, 0, 0);
  const wmat = vc({ roughness: 0.7, side: DoubleSide });
  const wings = new Group(); wings.position.set(0, 0.08, -0.1); body.add(wings);   // both wings in ONE mesh (one draw call): they spread and fold together
  const WL = [-1, 1].map((sx) => {
    const g = paint(new ShapeGeometry(wingShape, 4), 0xe0a050);
    const bone = paint(place(new CylinderGeometry(0.012, 0.012, 0.22, 4), 0.11, 0.18, 0.003, 0, 0, -1.35), GREEN2);
    const geo = merge([g, bone]); if (sx < 0) geo.scale(-1, 1, 1);
    return place(geo, sx * 0.12, 0, 0, 0, sx * 0.5, sx * 0.25);
  });
  const wm = new Mesh(merge(WL), wmat); wm.name = 'norbert-wings'; wings.add(wm);
  noRay(root);
  return { root, body, wings, mat, headY: 0.2 + HY };
}

// ---------------- the egg (whole, then the broken bottom half) ----------------
export function buildEgg() {
  const SHELL = 0xeedcb4, SPECK = 0x8a5a3a;
  const L = [paint(place(S(14, 10), 0, 0, 0, 0, 0, 0, 0.17, 0.23, 0.17), SHELL)];
  for (let k = 0; k < 11; k++) { const a = k * 2.4, y = -0.15 + (k % 5) * 0.075, r = Math.sqrt(Math.max(0.02, 1 - (y / 0.23) ** 2)); L.push(paint(place(S(5, 3), Math.cos(a) * 0.165 * r, y, Math.sin(a) * 0.165 * r, 0, -a, 0, 0.012, 0.025, 0.03), k % 3 ? SPECK : 0x5a7a3a)); }
  const whole = merge(L);
  // the bottom cup with a zig-zag rim (the top flies off as shell bits)
  const prof = []; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * (Math.PI / 2 + 0.15); prof.push(new Vector2(Math.cos(a) * 0.17, Math.sin(a) * 0.23)); }
  const cup = paint(new LatheGeometry(prof, 14), SHELL);
  const zig = []; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; zig.push(paint(place(new ConeGeometry(0.035, 0.07, 3), Math.cos(a) * 0.165, 0.065, Math.sin(a) * 0.165, 0, -a, 0), SHELL)); }
  const broken = merge([cup, ...zig]);
  const mesh = new Mesh(whole, vc({ roughness: 0.55, side: DoubleSide })); mesh.name = 'adv-egg'; mesh.raycast = () => {};
  return { mesh, whole, broken };
}

// ---------------- the hut props (one merged mesh): kettle + chain, logs, nest, hay, bowl + drumstick, bucket ----------------
export function buildHutProps() {
  const IRON = 0x2e2b30, IRON2 = 0x45404a, WOOD = 0x7a5232, WOOD2 = 0x5e3e24, STRAW = 0xd0a856, STRAW2 = 0xb08a3e, LOG = 0x4a3020;
  const L = [];
  // the black kettle hanging from the lintel on a chain (bail handle + rim)
  const kp = [[0, -0.2], [0.16, -0.2], [0.27, -0.1], [0.3, 0.04], [0.26, 0.17], [0.25, 0.21]].map(([r, y]) => new Vector2(r, y));
  L.push(paint(place(new LatheGeometry(kp, 14), KETTLE.x, KETTLE.y, KETTLE.z), IRON));
  L.push(paint(place(new TorusGeometry(0.255, 0.025, 5, 16), KETTLE.x, KETTLE.y + 0.21, KETTLE.z, Math.PI / 2, 0, 0), IRON2));
  L.push(paint(place(new TorusGeometry(0.28, 0.015, 4, 12, Math.PI), KETTLE.x, KETTLE.y + 0.2, KETTLE.z), IRON2));
  for (let k = 0; k < 5; k++) L.push(paint(place(new TorusGeometry(0.035, 0.01, 3, 6), KETTLE.x, KETTLE.y + 0.53 + k * 0.065, KETTLE.z, 0, k % 2 ? Math.PI / 2 : 0, 0), IRON2));   // chain links up to the lintel
  for (const sx of [-1, 1]) L.push(paint(place(new CylinderGeometry(0.02, 0.02, 0.12, 4), KETTLE.x + sx * 0.3, KETTLE.y + 0.0, KETTLE.z, 0, 0, Math.PI / 2), IRON2));   // lugs
  // a few logs in the firebox (the fire bed hides them once lit)
  for (const [x, ry] of [[-0.25, 0.25], [0.25, -0.2], [0, 0.05]]) L.push(paint(place(new CylinderGeometry(0.09, 0.1, 0.9, 6), x, 0.14, 0.34, 0, ry, Math.PI / 2), LOG));
  // the straw nest on the slab (a fat ring + loose straws)
  L.push(paint(place(new TorusGeometry(0.3, 0.11, 6, 14), NEST.x, SLAB_Y + 0.08, NEST.z, Math.PI / 2, 0, 0, 1, 1, 0.75), STRAW));
  L.push(paint(place(new CircleGeometry(0.3, 12), NEST.x, SLAB_Y + 0.03, NEST.z, -Math.PI / 2, 0, 0), STRAW2));
  for (let k = 0; k < 14; k++) { const a = k * 0.9, r = 0.28 + (k % 3) * 0.05; L.push(paint(place(new BoxGeometry(0.22, 0.012, 0.012), NEST.x + Math.cos(a) * r, SLAB_Y + 0.12 + (k % 2) * 0.04, NEST.z + Math.sin(a) * r, 0, a + 1.2, (k % 4 - 1.5) * 0.25), k % 2 ? STRAW : STRAW2)); }
  // the little hay pile (it smokes a little when his hiccup sparks land on it)
  L.push(paint(place(new ConeGeometry(0.26, 0.24, 8), HAY.x, SLAB_Y + 0.11, HAY.z, 0, 0, 0, 1, 1, 0.85), STRAW));
  for (let k = 0; k < 9; k++) { const a = k * 0.7; L.push(paint(place(new BoxGeometry(0.2, 0.01, 0.01), HAY.x + Math.cos(a) * 0.14, SLAB_Y + 0.05 + (k % 3) * 0.06, HAY.z + Math.sin(a) * 0.14, 0, a, (k % 3 - 1) * 0.5), STRAW2)); }
  // the bowl with a big drumstick
  const bp = [[0, 0], [0.14, 0], [0.22, 0.1], [0.24, 0.14], [0.21, 0.13], [0, 0.04]].map(([r, y]) => new Vector2(r, y));
  L.push(paint(place(new LatheGeometry(bp, 12), BOWL.x, SLAB_Y, BOWL.z), WOOD));
  L.push(paint(place(S(8, 6), BOWL.x - 0.03, SLAB_Y + 0.15, BOWL.z, 0, 0, 0.5, 0.1, 0.075, 0.075), 0xa8582a));   // the meat
  L.push(paint(place(new CylinderGeometry(0.02, 0.02, 0.16, 5), BOWL.x + 0.09, SLAB_Y + 0.21, BOWL.z, 0, 0, -0.9), 0xf2ead8));
  for (const dz of [-0.02, 0.02]) L.push(paint(place(S(5, 3), BOWL.x + 0.15, SLAB_Y + 0.26, BOWL.z + dz, 0, 0, 0, 0.025), 0xf2ead8));
  // the wooden bucket of water
  L.push(paint(place(new CylinderGeometry(0.2, 0.16, 0.36, 10, 1, true), BUCKET.x, SLAB_Y + 0.18, BUCKET.z), WOOD2));
  L.push(paint(place(new CircleGeometry(0.19, 10), BUCKET.x, SLAB_Y + 0.31, BUCKET.z, -Math.PI / 2, 0, 0), 0x4a8ac8));
  for (const y of [0.06, 0.3]) L.push(paint(place(new TorusGeometry(0.19 - y * 0.08, 0.012, 3, 12), BUCKET.x, SLAB_Y + y, BUCKET.z, Math.PI / 2, 0, 0), IRON2));
  L.push(paint(place(new TorusGeometry(0.2, 0.01, 3, 10, Math.PI), BUCKET.x, SLAB_Y + 0.36, BUCKET.z), IRON2));
  const mesh = new Mesh(merge(L), vc({ roughness: 0.85 })); mesh.name = 'norbert-props'; mesh.receiveShadow = true;
  return noRay(mesh);
}

// ---------------- the crate (slats, air holes, a teddy peeking out); bottom at y 0 ----------------
export function buildCrate() {
  const WOOD = 0xa0743e, WOOD2 = 0x7a5428, TED = 0xb8834e, TED2 = 0xd8b088;
  const L = [];
  const W = 0.9, D = 0.62, H = 0.5;
  L.push(paint(place(new BoxGeometry(W, 0.04, D), 0, 0.02, 0), WOOD2));
  for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) L.push(paint(place(new BoxGeometry(W, 0.13, 0.03), 0, 0.09 + k * 0.16, sz * (D / 2)), k % 2 ? WOOD2 : WOOD));
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) L.push(paint(place(new BoxGeometry(0.03, 0.13, D), sx * (W / 2), 0.09 + k * 0.16, 0), k % 2 ? WOOD : WOOD2));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(paint(place(new BoxGeometry(0.06, H, 0.06), sx * (W / 2 - 0.01), H / 2, sz * (D / 2 - 0.01)), WOOD2));
  for (let k = 0; k < 4; k++) L.push(paint(place(new CircleGeometry(0.025, 6), -0.27 + k * 0.18, 0.28, D / 2 + 0.017), 0x2a1a10));   // air holes
  // the teddy sitting in the corner
  const tx = 0.27, tz = -0.12;
  L.push(paint(place(S(8, 6), tx, 0.22, tz, 0, 0, 0, 0.09, 0.11, 0.08), TED));
  L.push(paint(place(S(8, 6), tx, 0.39, tz, 0, 0, 0, 0.08), TED));
  L.push(paint(place(S(6, 4), tx, 0.37, tz + 0.07, 0, 0, 0, 0.035, 0.028, 0.025), TED2));
  for (const sx of [-1, 1]) { L.push(paint(place(S(6, 4), tx + sx * 0.06, 0.46, tz, 0, 0, 0, 0.03), TED)); L.push(paint(place(S(4, 3), tx + sx * 0.03, 0.41, tz + 0.07, 0, 0, 0, 0.01), 0x1a1210)); }
  L.push(paint(place(new TorusGeometry(0.05, 0.012, 3, 8), tx, 0.31, tz + 0.02, Math.PI / 2 - 0.3, 0, 0), 0xc0302a));   // a red bow
  const mesh = new Mesh(merge(L), vc({ roughness: 0.85 })); mesh.name = 'adv-crate';
  const g = new Group(); g.name = 'adv-crate-root'; g.add(mesh);
  return { g: noRay(g), mesh, W, D, H };
}

// ---------------- the thought bubble (one plane; three canvases, one per want) ----------------
export const WANTS = ['hungry', 'tickle', 'hiccup'];
const WANT_EMO = { hungry: '🍗', tickle: '😄', hiccup: '🔥' };
export function buildBubble() {
  const tex = {};
  for (const k of WANTS) tex[k] = canvasTex(256, 224, (x) => {
    const cloud = (cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.stroke(); };
    x.fillStyle = '#fffaf0'; x.strokeStyle = '#8a6a3a'; x.lineWidth = 6;
    cloud(40, 210, 9); cloud(64, 186, 14);
    x.beginPath(); x.ellipse(140, 92, 104, 78, 0, 0, 7); x.fill(); x.stroke();
    for (const [cx, cy, r] of [[60, 60, 38], [120, 30, 34], [190, 44, 36], [220, 110, 32], [168, 156, 34], [92, 150, 34], [46, 112, 30]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
    x.font = '108px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(WANT_EMO[k], 140, 98);
    if (k === 'hiccup') { x.font = 'bold 30px Arial'; x.fillStyle = '#c0502a'; x.fillText('היק!', 214, 168); }
  });
  const mat = new MeshBasicMaterial({ map: tex.hungry, transparent: true, depthWrite: false });
  const mesh = new Mesh(new PlaneGeometry(0.8, 0.7), mat); mesh.name = 'norbert-bubble'; mesh.renderOrder = 5; mesh.raycast = () => {};
  return { mesh, tex, set: (k) => { if (tex[k] && mat.map !== tex[k]) { mat.map = tex[k]; mat.needsUpdate = true; } } };
}

// ---------------- the four broom riders with lanterns + the harness ropes (tower) ----------------
export function buildRiders(n = 4) {
  const CLOAK = 0x3a3a52, SKIN = 0xe8c0a0, WOOD = 0x7a5232, BRIST = 0xc8a050, HAT = 0x2a2a3a;
  const L = [];
  L.push(paint(place(new CylinderGeometry(0.03, 0.03, 1.6, 5), 0, 0, 0, Math.PI / 2, 0, 0), WOOD));          // broom along +z (the front)
  L.push(paint(place(new ConeGeometry(0.16, 0.45, 7), 0, 0, -0.95, -Math.PI / 2, 0, 0), BRIST));
  L.push(paint(place(new ConeGeometry(0.24, 0.7, 7), 0, 0.3, -0.1, -0.25, 0, 0), CLOAK));                   // the rider: cloak
  L.push(paint(place(S(8, 6), 0, 0.72, -0.05, 0, 0, 0, 0.13), SKIN));
  L.push(paint(place(new ConeGeometry(0.15, 0.3, 7), 0, 0.9, -0.08, -0.2, 0, 0), HAT));                     // a warm woolly hat
  L.push(paint(place(new CylinderGeometry(0.02, 0.02, 0.2, 4), 0, -0.1, 0.65), 0x2e2b30));                  // the lantern hook
  const geo = merge(L);
  const riders = new InstancedMesh(geo, vc({ roughness: 0.85 }), n); riders.name = 'norbert-riders'; riders.frustumCulled = false;
  const lantern = new InstancedMesh(new SphereGeometry(0.11, 8, 6), new MeshBasicMaterial({ color: 0xffd36a }), n); lantern.name = 'norbert-lanterns'; lantern.frustumCulled = false;
  const pos = new Float32Array(n * 2 * 3); const lg = new BufferGeometry(); lg.setAttribute('position', new BufferAttribute(pos, 3));
  const ropes = new LineSegments(lg, new LineBasicMaterial({ color: 0xe8d8b0 })); ropes.name = 'norbert-ropes'; ropes.frustumCulled = false;
  const g = new Group(); g.name = 'adv-riders'; g.add(riders, lantern, ropes);
  return { g: noRay(g), riders, lantern, ropes, pos, n };
}
