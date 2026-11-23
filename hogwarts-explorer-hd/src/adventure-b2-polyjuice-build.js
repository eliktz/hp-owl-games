// Book 2, quest 4 geometry (adventure-b2-polyjuice.js runs it): Moaning Myrtle as a friendly translucent ghost
// stand-in, the cauldron by the open stall with its bench and ladle, the ingredient jars (one InstancedMesh, a colour
// each), the recipe card (a canvas redrawn as the brew goes) and the Slytherin common-room door with a snake knocker in
// the dungeon. All code-built: vertex colours + canvas textures <= 512 px, no disk textures.
// Budgets: Myrtle <= 2.5k tris; the bathroom dressing <= 6k tris and <= 6 draw calls (the troll is absent there).
import {
  Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, ConeGeometry, CapsuleGeometry, LatheGeometry,
  CircleGeometry, PlaneGeometry, Vector2, Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute, MeshStandardMaterial,
  MeshBasicMaterial, CanvasTexture, InstancedMesh, SRGBColorSpace, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from './interior-kit.js';

const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew','Heebo',Arial,sans-serif";
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

// ---------------- the bathroom spots (room-local; the room is 10 x 12, sinks on the west wall, stalls on the east) ----------------
export const MYRTLE = { x: -3.75, y: 1.05, z: -1.7 };          // floating over the second sink, facing into the room (+x)
export const CAULDRON = { x: 2.3, z: -0.3 };                  // in front of the open stall (stall 2, z -0.3)
export const BENCH = { x: 2.05, z: 1.25, y: 0.55 };           // the ingredient bench beside it (slots along x)
export const SLOT_X = (i) => BENCH.x + (i - 2) * 0.34;
// the three ingredients to find: by the sinks, under the moon window, in the corner by the door
export const FIND = [{ x: -3.7, y: 0, z: 0.85 }, { x: 0.0, y: 0, z: -5.3 }, { x: 3.2, y: 0, z: 4.9 }];
// colours (non-emissive albedo <= 0.84) + names: green knotgrass, blue lacewing flies, gold horn powder, purple, orange
export const ING = [
  { hex: 0x4aa84a, css: '#4aa84a', name: 'עשב קשרים', short: 'ירוק' },
  { hex: 0x3a72d0, css: '#3a72d0', name: 'זבובי תחרה', short: 'כחול' },
  { hex: 0xd0a030, css: '#d0a030', name: 'אבקת קרן', short: 'צהוב' },
  { hex: 0x9a4ac8, css: '#9a4ac8', name: 'פרחי לילך', short: 'סגול' },
  { hex: 0xd0702a, css: '#d0702a', name: 'שורש כתום', short: 'כתום' },
];

// ---------------- Myrtle: a friendly giggling ghost (pale blue, pigtails, round glasses); faces +z, about 1.45 m ----------------
export function buildMyrtle() {
  const PALE = 0xb8d4e8, PALE2 = 0x9cbcd8, ROBE = 0x8aa8c8, HAIR = 0x7a9ab8, RIM = 0x3a4a6a, DARK = 0x2a3448, CHEEK = 0xd8b8d0;
  const L = [];
  // the robe: a soft bell that fades into a wispy tail (she floats)
  L.push(paint(new LatheGeometry([[0.0, -0.25], [0.12, -0.2], [0.26, 0.05], [0.3, 0.35], [0.24, 0.72], [0.17, 0.92], [0.1, 1.0], [0, 1.0]].map(([r, y]) => new Vector2(r, y)), 14), ROBE));
  L.push(paint(place(new CylinderGeometry(0.17, 0.12, 0.08, 12), 0, 0.96, 0), 0xa8c0d8));        // collar
  L.push(paint(place(new TorusGeometry(0.15, 0.025, 4, 12), 0, 0.9, 0, Math.PI / 2, 0, 0), 0x6a7aa0));   // a tie band
  // arms (hands clasped in front, shy)
  for (const sx of [-1, 1]) { L.push(paint(place(new CapsuleGeometry(0.05, 0.32, 2, 6), sx * 0.2, 0.7, 0.1, 0.6, 0, sx * 0.35), ROBE)); L.push(paint(place(S(8, 6), sx * 0.08, 0.55, 0.24, 0, 0, 0, 0.055), PALE)); }
  // head: round face, rosy cheeks, a big smile, eyes behind round glasses
  L.push(paint(place(S(16, 12), 0, 1.22, 0, 0, 0, 0, 0.19, 0.2, 0.18), PALE));
  L.push(paint(place(S(14, 8), 0, 1.3, -0.03, -0.25, 0, 0, 0.205, 0.17, 0.2), HAIR));           // hair cap
  for (const sx of [-1, 1]) {
    L.push(paint(place(S(10, 8), sx * 0.2, 1.08, -0.02, 0, 0, sx * 0.4, 0.07, 0.15, 0.07), HAIR));   // pigtails
    L.push(paint(place(new TorusGeometry(0.035, 0.015, 4, 8), sx * 0.17, 1.2, -0.02, 0, Math.PI / 2, 0), 0x6a7aa0));   // bobbles
    L.push(paint(place(new TorusGeometry(0.058, 0.009, 4, 14), sx * 0.075, 1.24, 0.17), RIM));       // round glasses
    L.push(paint(place(S(8, 6), sx * 0.075, 1.24, 0.155, 0, 0, 0, 0.022, 0.026, 0.012), DARK));      // happy eyes
    L.push(paint(place(S(6, 4), sx * 0.12, 1.16, 0.15, 0, 0, 0, 0.035, 0.022, 0.015), CHEEK));
  }
  L.push(paint(place(new BoxGeometry(0.045, 0.008, 0.008), 0, 1.245, 0.18), RIM));                   // the bridge of the glasses
  L.push(paint(place(new TorusGeometry(0.055, 0.012, 4, 10, Math.PI), 0, 1.15, 0.165, 0, 0, Math.PI), 0x5a5a8a));   // a wide smile
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, transparent: true, opacity: 0.62, depthWrite: false, emissive: new Color(0x5a8ab8), emissiveIntensity: 0.45 });
  const m = new Mesh(merge(L), mat); m.name = 'myrtle-body'; m.renderOrder = 4;
  const root = new Group(); root.name = 'adv-myrtle'; root.add(m);
  noRay(root);
  return { root, mat };
}

// ---------------- the cauldron + its little fire logs + the bench (one mesh), the brew (glowing), the ladle ----------------
export function buildCauldronSet() {
  const IRON = 0x2e2b30, IRON2 = 0x3c3840, WOOD = 0x7a5232, WOOD2 = 0x5e3e24;
  const L = [];
  // the cauldron (local to CAULDRON): a round-bellied iron pot on three stubby feet over two logs
  L.push(paint(place(new LatheGeometry([[0.0, 0.18], [0.28, 0.2], [0.42, 0.36], [0.46, 0.55], [0.42, 0.74], [0.36, 0.8], [0.4, 0.84], [0.37, 0.86], [0.33, 0.8], [0.0, 0.78]].map(([r, y]) => new Vector2(r, y)), 18), CAULDRON.x, 0, CAULDRON.z), IRON));
  for (let k = 0; k < 3; k++) { const a = k * 2.094; L.push(paint(place(new CylinderGeometry(0.04, 0.05, 0.24, 6), CAULDRON.x + Math.cos(a) * 0.26, 0.11, CAULDRON.z + Math.sin(a) * 0.26), IRON2)); }
  for (const sx of [-1, 1]) L.push(paint(place(new CylinderGeometry(0.05, 0.05, 0.5, 6), CAULDRON.x, 0.05, CAULDRON.z + sx * 0.08, 0, sx * 0.6, Math.PI / 2), WOOD2));
  // the bench: a low oak plank on two legs
  L.push(paint(place(new BoxGeometry(1.8, 0.07, 0.42), BENCH.x, BENCH.y - 0.035, BENCH.z), WOOD));
  for (const sx of [-1, 1]) L.push(paint(place(new BoxGeometry(0.08, BENCH.y - 0.07, 0.36), BENCH.x + sx * 0.78, (BENCH.y - 0.07) / 2, BENCH.z), WOOD2));
  const pot = new Mesh(merge(L), vc({ roughness: 0.55, metalness: 0.2 })); pot.name = 'adv-cauldron';
  // the brew: a glowing disc in the pot (its colour follows the recipe)
  const brew = new Mesh(new CircleGeometry(0.36, 20).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: 0x3a3a30, emissive: new Color(0x4a5a3a), emissiveIntensity: 0.6, roughness: 0.3 }));
  brew.position.set(CAULDRON.x, 0.77, CAULDRON.z); brew.name = 'adv-brew';
  // the ladle: a long wooden handle with a bowl, pivoting at the pot centre (it stirs round)
  const ladle = new Group(); ladle.position.set(CAULDRON.x, 0.78, CAULDRON.z); ladle.name = 'adv-ladle';
  const LL = [paint(place(new CylinderGeometry(0.02, 0.025, 0.9, 6), 0.16, 0.32, 0, 0, 0, -0.35), 0x8a6a42), paint(place(S(8, 5), 0.02, -0.08, 0, 0, 0, 0, 0.08, 0.05, 0.08), 0x6a4a2a), paint(place(S(6, 4), 0.31, 0.74, 0, 0, 0, 0, 0.035), 0x6a4a2a)];
  ladle.add(new Mesh(merge(LL), vc({ roughness: 0.7 })));
  const g = new Group(); g.name = 'adv-brewset'; g.add(pot, brew, ladle);
  noRay(g);
  return { g, pot, brew, ladle };
}

// ---------------- the ingredient jars: one InstancedMesh (a colour per instance) ----------------
export function buildJars(n) {
  const L = [];
  L.push(paint(new LatheGeometry([[0, 0], [0.08, 0], [0.095, 0.03], [0.095, 0.17], [0.07, 0.2], [0.06, 0.22], [0, 0.22]].map(([r, y]) => new Vector2(r, y)), 10), 0xd8dce0));   // the glass, tinted by the instance colour
  L.push(paint(place(new CylinderGeometry(0.085, 0.085, 0.12, 10), 0, 0.08, 0), 0xffffff));                                                                                      // the contents: the full colour
  L.push(paint(place(new CylinderGeometry(0.065, 0.06, 0.05, 8), 0, 0.245, 0), 0x8a6a4a));                                                                                       // cork
  const mesh = new InstancedMesh(merge(L), vc({ roughness: 0.35, emissive: new Color(0x000000) }), n);
  mesh.name = 'adv-jars'; mesh.frustumCulled = false; mesh.count = n; mesh.raycast = () => {};
  return mesh;
}

// ---------------- the recipe card: coloured circles in order (RTL: the first on the right), ticked as they go in ----------------
export function buildRecipe() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace;
  const m = new Mesh(new PlaneGeometry(1.3, 0.65), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  m.name = 'adv-recipe'; m.renderOrder = 5; m.raycast = () => {};
  function draw(order, added, stir) {
    const x = c.getContext('2d'); x.clearRect(0, 0, 512, 256);
    x.fillStyle = '#efe0bc'; x.strokeStyle = '#8a5a20'; x.lineWidth = 8; x.beginPath(); x.roundRect(6, 6, 500, 244, 26); x.fill(); x.stroke();
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#5a2a10'; x.font = `bold 40px ${FONT}`; x.fillText('המתכון', 256, 46);
    const n = order.length, gap = 440 / n;
    order.forEach((k, i) => {
      const cx = 476 - gap / 2 - i * gap + 0 - 10, cy = 130;
      x.fillStyle = ING[k].css; x.beginPath(); x.arc(cx, cy, Math.min(38, gap * 0.36), 0, 7); x.fill();
      x.lineWidth = 5; x.strokeStyle = i === added ? '#ffffff' : '#3a2410'; x.stroke();
      x.fillStyle = '#fff6dc'; x.font = `bold 34px ${FONT}`; x.fillText(String(i + 1), cx, cy + 2);
      if (i < added) { x.strokeStyle = '#1a5a1a'; x.lineWidth = 9; x.beginPath(); x.moveTo(cx - 18, cy + 2); x.lineTo(cx - 4, cy + 16); x.lineTo(cx + 20, cy - 14); x.stroke(); }
      if (i < n - 1) { x.fillStyle = '#8a5a20'; x.beginPath(); x.moveTo(cx - gap / 2 + 6, cy - 9); x.lineTo(cx - gap / 2 - 8, cy); x.lineTo(cx - gap / 2 + 6, cy + 9); x.fill(); }
    });
    x.fillStyle = '#5a2a10'; x.font = `bold 30px ${FONT}`;
    x.fillText(added < n ? 'ואז לערבב 3 פעמים 🥄' : stir < 3 ? 'לערבב: ' + stir + ' / 3' : 'מוכן! 🧪', 256, 214);
    tex.needsUpdate = true;
  }
  return { m, draw };
}

// ---------------- the Slytherin door in the dungeon (east wall, inner face x 8.5, centred z 1.8; mirrors the Floo) ----------------
export const SDOOR = { x: 8.48, z: 1.8 };
export function buildSnakeDoor() {
  const g = new Group(); g.name = 'adv-snake-door';
  const F = [];
  for (const sz of [-1, 1]) F.push(place(new BoxGeometry(0.3, 2.7, 0.32), SDOOR.x - 0.12, 1.35, SDOOR.z + sz * 0.95));
  F.push(place(new BoxGeometry(0.32, 0.36, 2.22), SDOOR.x - 0.12, 2.86, SDOOR.z));
  const frame = new Mesh(mergeGeometries(F, false), MAT.stone); frame.name = 'snake-door-frame'; g.add(frame);
  // the leaf: dark green oak with silver bands and a friendly coiled snake knocker (canvas), hinged on its south edge
  const tex = canvasTex(256, 384, (x) => {
    x.fillStyle = '#1e3a2a'; x.fillRect(0, 0, 256, 384);
    for (let k = 0; k < 5; k++) { x.fillStyle = k % 2 ? '#24442f' : '#1f3d2b'; x.fillRect(k * 51 + 2, 0, 47, 384); }
    x.fillStyle = '#9aa4a8'; x.fillRect(0, 60, 256, 12); x.fillRect(0, 312, 256, 12);
    x.save(); x.translate(128, 190);
    x.strokeStyle = '#c8d0d4'; x.lineWidth = 14; x.lineCap = 'round'; x.beginPath(); x.arc(0, 10, 44, -0.6, Math.PI * 1.7); x.stroke();   // the coiled body (a ring knocker)
    x.fillStyle = '#c8d0d4'; x.beginPath(); x.ellipse(30, -34, 22, 16, -0.5, 0, 7); x.fill();                                           // the round head
    x.fillStyle = '#1e3a2a'; x.beginPath(); x.arc(24, -40, 5, 0, 7); x.fill(); x.beginPath(); x.arc(38, -36, 5, 0, 7); x.fill();          // two dot eyes
    x.strokeStyle = '#1e3a2a'; x.lineWidth = 3; x.beginPath(); x.arc(34, -28, 7, 0.2, Math.PI - 0.2); x.stroke();                       // a smile
    x.fillStyle = '#8a3a3a'; x.fillRect(48, -30, 12, 3);                                                                                // a little tongue
    x.restore();
    x.fillStyle = '#c8d0d4'; x.beginPath(); x.arc(40, 200, 9, 0, 7); x.fill();
  });
  const hinge = new Group(); hinge.position.set(SDOOR.x - 0.14, 0, SDOOR.z + 0.8); g.add(hinge);
  const leaf = new Mesh(new PlaneGeometry(1.6, 2.68).rotateY(-Math.PI / 2).translate(0, 1.34, -0.8), new MeshStandardMaterial({ map: tex, roughness: 0.75, side: DoubleSide }));
  leaf.name = 'snake-door-leaf'; hinge.add(leaf);
  // a soft green glow behind the door (seen when it opens)
  const glow = new Mesh(new PlaneGeometry(1.6, 2.68).rotateY(-Math.PI / 2).translate(SDOOR.x - 0.005, 1.34, SDOOR.z), new MeshBasicMaterial({ color: 0x3a8a5a, toneMapped: false }));
  glow.name = 'snake-door-glow'; g.add(glow);
  noRay(g);
  return { g, hinge, leaf };
}
export { FONT };
