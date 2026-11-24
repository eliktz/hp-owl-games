// Book 2, quest 6 geometry (adventure-b2-chamber.js runs it): the chamber hall 'b2chamber' (a tall green-gold stone
// hall with carved coil pillars, a long pool, warm torches, the pipe slide coming in through the south wall), the tiny
// snake on a bathroom tap, the pipe mouth that opens under the sink, Fawkes (a code-built red-gold phoenix, round
// friendly eyes; wings flap by group transforms), the Sorting Hat, the sword hilt, the fang, the soft shadow on the far
// wall, and Ginny (the chibi builder: red hair, Gryffindor robe). Code-built: vertex colours, canvas textures <= 512 px.
// Kid-safe by construction: nothing in the hall has a face but Fawkes, the hat and Ginny; the "basilisk" is only a
// blurred dark smudge texture on the far wall (no head, no eyes, no teeth) that slides away and fades.
// Budgets: the hall <= 40k tris and <= 55 draw calls with everyone in it; Fawkes <= 2.5k tris.
import {
  Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, ConeGeometry, CircleGeometry, PlaneGeometry,
  TubeGeometry, LatheGeometry, OctahedronGeometry, CatmullRomCurve3, Curve, Vector2, Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, RepeatWrapping, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ceiling, torch, mergeStatic, stoneMat } from './interior-kit.js';
import { bakeLight } from './atmosphere.js';
import { buildChibi } from './chibi.js';

export const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew','Heebo',Arial,sans-serif";
const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); }
function paint(geo, hex) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const merge = (list) => mergeGeometries(list.map(strip), false);
const vc = (opts = {}) => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...opts });
const noRay = (o) => { o.traverse(m => { if (m.isMesh) m.raycast = () => {}; }); return o; };
export const triCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); } }); return Math.round(n); };
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }

// ---------------- the hall (room-local; 16 x 34 m, 10 m high; the pipe slide comes in at the south end) ----------------
export const HW = 16, HD = 34, HH = 10;
export const HALL_SPAWN = { x: 0, z: 9.6, yaw: Math.PI };            // the foot of the slide, facing north (-z)
export const POOL = { x: 0, z: -6, w: 4.6, d: 7.0 };                 // the long pool in the middle
export const SPOT = {
  hat: { x: -1.1, z: 2.6 },                                          // where Fawkes drops the hat (in front of Harry)
  diary: { x: 2.9, z: -2.0 },                                        // by the pool's near east corner
  fang: { x: 1.2, z: -0.9 },                                         // a small glowing fang on the floor near the diary
  ginny: { x: 3.4, z: -4.6 },                                        // asleep by the pool's east side
  stand: { x: -0.6, z: 2.2 },                                        // a good place for Harry in step 5 (the fang and the diary ahead-right)
};
export const SHADOW = { z: -HD / 2 + 0.06, y: 1.7, x0: -2.5, x1: 9.5 };   // the far wall: the soft shadow slides away to the east
// the slide: from high outside the south wall down a curving pipe to the hall floor (room-local)
export const SLIDE = [[0, 15.5, 40], [2.5, 12.5, 32], [-1.5, 9.0, 25], [1.0, 5.6, 19.8], [0, 3.4, 16.9], [0, 1.6, 14.2], [0, 0.25, HALL_SPAWN.z + 0.2]];
export const slideCurve = () => new CatmullRomCurve3(SLIDE.map(([x, y, z]) => new Vector3(x, y, z)), false, 'catmullrom', 0.3);
// the pipe itself ends at its mouth in the south wall (z 16.9); the last stretch is a soft hop out onto the floor
const pipeCurve = () => new CatmullRomCurve3(SLIDE.slice(0, 5).map(([x, y, z]) => new Vector3(x, y, z)), false, 'catmullrom', 0.3);

function floorTex() {
  const t = canvasTex(256, 256, (x) => {
    x.fillStyle = '#5e6a4e'; x.fillRect(0, 0, 256, 256);
    let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const v = 0.85 + r() * 0.3; x.fillStyle = `rgb(${Math.round(110 * v)},${Math.round(120 * v)},${Math.round(90 * v)})`;
      x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
      x.fillStyle = 'rgba(255,240,190,.08)'; x.fillRect(i * 64 + 6, j * 64 + 6, 30, 8);
    }
  });
  t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(HW / 3, HD / 3); return t;
}
function pipeTex() {
  const t = canvasTex(128, 256, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#6a7a4a'); g.addColorStop(0.5, '#8a9058'); g.addColorStop(1, '#6a7a4a');
    x.fillStyle = g; x.fillRect(0, 0, 128, 256);
    x.fillStyle = 'rgba(210,180,90,.55)'; x.fillRect(0, 0, 128, 14); x.fillRect(0, 128, 128, 14);   // gold-green rings
    x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(54, 0, 20, 256);                               // a wet, slippery shine
  });
  t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(1, 18); return t;
}

// a coil carved round a pillar: a tube along a helix with soft rounded ends (no head, just a carved spiral band)
class Helix extends Curve {
  constructor(r, h, turns, y0) { super(); this.r = r; this.h = h; this.turns = turns; this.y0 = y0; }
  getPoint(t, out = new Vector3()) { const a = t * this.turns * Math.PI * 2; return out.set(Math.cos(a) * this.r, this.y0 + t * this.h, Math.sin(a) * this.r); }
}

export function buildChamberHall() {
  const g = new Group(); g.name = 'adv-b2chamber'; const cols = [];
  const WALL = 0xa8a47e, wallM = stoneMat(4, 2, WALL);
  const add = (geo, mat, parent = g) => { const m = new Mesh(geo, mat); parent.add(m); return m; };
  const box = (x, z, w, d, h = HH, y = h / 2, mat = wallM) => add(new BoxGeometry(w, h, d).translate(x, y, z), mat);
  // floor + ceiling
  const fl = add(new PlaneGeometry(HW, HD).rotateX(-Math.PI / 2), new MeshStandardMaterial({ map: floorTex(), roughness: 0.6 })); fl.name = 'chamber-floor'; fl.receiveShadow = true;
  ceiling(g, HW, HD, HH, 0x3a4a34);
  // walls: 1 m thick, inner faces at x +-8, z +-17
  for (const sx of [-1, 1]) { box(sx * (HW / 2 + 0.5), 0, 1, HD + 2); cols.push({ type: 'box', x: sx * (HW / 2 + 0.5), z: 0, hw: 0.5, hd: HD / 2 + 1, angle: 0 }); }
  for (const sz of [-1, 1]) { box(0, sz * (HD / 2 + 0.5), HW + 2, 1); cols.push({ type: 'box', x: 0, z: sz * (HD / 2 + 0.5), hw: HW / 2 + 1, hd: 0.5, angle: 0 }); }
  // the pillars: two rows of round stone columns with a carved gold-green coil each (one vertex-coloured mesh)
  const PIL = [], STONE = 0x8a8e6a, COIL = 0xb0a050, CAP = 0x7a7e5a;
  const PZ = [-13, -8.6, -4.2, 0.2, 4.6, 9.0];
  for (const sx of [-1, 1]) for (const z of PZ) {
    const x = sx * 4.8;
    PIL.push(paint(place(new CylinderGeometry(0.55, 0.62, HH, 12, 1, true), x, HH / 2, z), STONE));
    PIL.push(paint(place(new BoxGeometry(1.5, 0.4, 1.5), x, 0.2, z), CAP), paint(place(new BoxGeometry(1.5, 0.5, 1.5), x, HH - 0.25, z), CAP));
    const tube = new TubeGeometry(new Helix(0.62, HH - 1.6, 2.5, 0.8), 70, 0.11, 5, false); tube.translate(x, 0, z); PIL.push(paint(tube, COIL));
    for (const y of [0.8, HH - 0.8]) PIL.push(paint(place(new SphereGeometry(0.13, 6, 4), x + 0.62 * (y < 1 ? 1 : Math.cos(2.5 * Math.PI * 2)), y, z + (y < 1 ? 0 : 0.62 * Math.sin(2.5 * Math.PI * 2))), COIL));
    cols.push({ type: 'circle', x, z, r: 0.8 });
  }
  const stoneVC = vc({ roughness: 0.72 });
  const pillars = add(merge(PIL), stoneVC); pillars.name = 'chamber-pillars';
  // the pool: a low stone rim round a long, still, green-gold water surface
  const RIM = [], P = POOL, rw = 0.45, rh = 0.3;
  RIM.push(paint(place(new BoxGeometry(P.w + 2 * rw, rh, rw), P.x, rh / 2, P.z - P.d / 2 - rw / 2), 0x9a9a78), paint(place(new BoxGeometry(P.w + 2 * rw, rh, rw), P.x, rh / 2, P.z + P.d / 2 + rw / 2), 0x9a9a78));
  RIM.push(paint(place(new BoxGeometry(rw, rh, P.d), P.x - P.w / 2 - rw / 2, rh / 2, P.z), 0x9a9a78), paint(place(new BoxGeometry(rw, rh, P.d), P.x + P.w / 2 + rw / 2, rh / 2, P.z), 0x9a9a78));
  // the far wall: a tall carved arch (an empty stone niche, no face) and a dark low opening at its east end
  RIM.push(paint(place(new TorusGeometry(3.2, 0.35, 6, 20, Math.PI), 0, 4.2, -HD / 2 + 0.3), 0x9a9670));
  for (const sx of [-1, 1]) RIM.push(paint(place(new BoxGeometry(0.7, 4.2, 0.6), sx * 3.2, 2.1, -HD / 2 + 0.3), 0x9a9670));
  RIM.push(paint(place(new PlaneGeometry(5.7, 7.2).translate(0, 3.6, 0), 0, 0, -HD / 2 + 0.05), 0x56603e));
  for (const sx of [-1, 1]) RIM.push(paint(place(new BoxGeometry(0.4, 3.0, 0.4), 7.0 + sx * 1.1, 1.5, -HD / 2 + 0.2), 0x9a9670));
  RIM.push(paint(place(new BoxGeometry(2.6, 0.4, 0.4), 7.0, 3.1, -HD / 2 + 0.2), 0x9a9670));
  RIM.push(paint(place(new PlaneGeometry(1.8, 3.0).translate(0, 1.5, 0), 7.0, 0, -HD / 2 + 0.04), 0x2a3022));
  RIM.push(paint(new TorusGeometry(1.3, 0.22, 6, 18).translate(0, 3.4, 16.95), 0x9a9670));   // a carved stone collar round the pipe mouth
  const rim = add(merge(RIM), stoneVC); rim.name = 'chamber-rim';
  cols.push({ type: 'box', x: P.x, z: P.z, hw: P.w / 2 + rw, hd: P.d / 2 + rw, angle: 0 });
  const water = add(new PlaneGeometry(P.w, P.d).rotateX(-Math.PI / 2).translate(P.x, 0.14, P.z), new MeshStandardMaterial({ color: 0x3a6a4a, emissive: new Color(0x2a5a34), emissiveIntensity: 0.45, roughness: 0.08, metalness: 0.3 }));
  water.name = 'chamber-water';
  // torches on every pillar (warm), facing into the hall
  for (const sx of [-1, 1]) for (const z of PZ) { const t = torch(g, sx * 4.15, 3.4, z, 0xffb050, { shared: true, glowBall: false }); t.rotation.y = sx < 0 ? 0 : Math.PI; }
  for (const sx of [-1, 1]) { const t = torch(g, sx * 2.0, 3.6, -HD / 2 + 0.6, 0xffb050, { shared: true, glowBall: false }); t.rotation.y = Math.PI / 2; }
  // soft green-gold pools of light on the floor (baked by atmosphere.js from these markers)
  for (const [x, z, r, a] of [[0, 8, 5.5, 0.22], [0, 1, 5.5, 0.22], [0, -6, 5.5, 0.2], [0, -12.5, 5.0, 0.18], [-5.5, -2, 3.6, 0.14], [5.5, -2, 3.6, 0.14]]) { const o = new Group(); o.position.set(x, 0.1, z); o.userData.light = { k: 'glow', c: 0xe8e0a0, r, a }; g.add(o); }
  // the pipe slide: a big green-gold tube from outside the south wall down to the floor (seen from inside on the ride)
  const curve = pipeCurve();
  const pipe = add(new TubeGeometry(curve, 56, 1.15, 12, false), new MeshStandardMaterial({ map: pipeTex(), color: 0xc8c8a0, emissive: new Color(0x3a4a24), emissiveIntensity: 0.55, roughness: 0.35, side: DoubleSide }));
  pipe.name = 'chamber-pipe';
  mergeStatic(g, g.children.filter(c => c !== pipe && c !== water));
  const light = bakeLight(g, cols);
  pipe.raycast = () => {}; water.raycast = () => {};   // the camera arm may sit in front of the pipe mouth
  return { g, cols, light, P: { pipe, water } };
}

// ---------------- the soft shadow: a long, blurred, dark smudge (no shape, no eyes) on the far wall ----------------
export function buildShadow() {
  const tex = canvasTex(256, 64, (x) => {
    for (let i = 0; i < 14; i++) {
      const cx = 30 + i * 15, r = 20 + Math.sin(i * 0.7) * 3;
      const gr = x.createRadialGradient(cx, 32, 0, cx, 32, r); gr.addColorStop(0, 'rgba(20,28,18,.32)'); gr.addColorStop(1, 'rgba(20,28,18,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 256, 64);
    }
  });
  const m = new Mesh(new PlaneGeometry(9, 1.6), new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff }));
  m.name = 'adv-shadow'; m.renderOrder = 3; m.visible = false; noRay(m);
  return m;
}

// ---------------- the tiny snake curled on a bathroom tap (a carved bronze-green coil with a round head and a smile) ----------------
export function buildTapSnake() {
  const L = [], GREEN = 0x4aa84a, GREEN2 = 0x3a8a3a;
  const tube = new TubeGeometry(new Helix(0.045, 0.1, 2.2, 0), 30, 0.014, 5, false); L.push(paint(tube, GREEN));
  L.push(paint(place(new SphereGeometry(0.028, 8, 6), 0.05, 0.11, 0.0, 0, 0, 0, 1.2, 0.9, 1), GREEN2));
  for (const sz of [-1, 1]) L.push(paint(place(new SphereGeometry(0.007, 5, 4), 0.07, 0.122, sz * 0.012), 0x141410));
  const m = new Mesh(merge(L), vc({ roughness: 0.4, metalness: 0.3, emissive: new Color(0x1a3a1a), emissiveIntensity: 0.4 }));
  m.name = 'adv-tap-snake'; noRay(m); m.scale.setScalar(2.6);
  return m;
}
// the pipe mouth that opens where the sink was: a gold-green ring round a soft green glow
export function buildPipeMouth() {
  const L = [paint(place(new TorusGeometry(0.42, 0.07, 6, 20), 0, 0.03, 0, Math.PI / 2, 0, 0), 0xb0a050)];
  const ring = new Mesh(merge(L), vc({ roughness: 0.5, metalness: 0.3 }));
  const hole = new Mesh(new CircleGeometry(0.42, 20).rotateX(-Math.PI / 2).translate(0, 0.02, 0), new MeshBasicMaterial({ color: 0x3a7a4a, toneMapped: false }));
  const g = new Group(); g.name = 'adv-pipe-mouth'; g.add(ring, hole); noRay(g);
  return g;
}

// ---------------- Fawkes: a red-gold phoenix with round friendly eyes; faces +z; wings are their own groups ----------------
export function buildFawkes() {
  const RED = 0xc8301c, RED2 = 0xa82418, GOLD = 0xe0a830, ORANGE = 0xe06a20, BEAK = 0xd8b050, EYE = 0x1a1410, WHITE = 0xfaf6ea;
  const B = [];
  B.push(paint(place(new SphereGeometry(0.32, 14, 10), 0, 0, 0, 0, 0, 0, 0.85, 0.8, 1.15), RED));                  // body
  B.push(paint(place(new SphereGeometry(0.2, 12, 9), 0, 0.26, 0.34), RED));                                         // head
  B.push(paint(place(new SphereGeometry(0.17, 10, 6), 0, 0.02, 0.18, 0, 0, 0, 1, 1, 0.8), GOLD));                   // a golden breast
  B.push(paint(place(new ConeGeometry(0.06, 0.16, 8), 0, 0.22, 0.56, Math.PI / 2 + 0.35, 0, 0), BEAK));              // a small hooked beak
  for (const sx of [-1, 1]) {
    B.push(paint(place(new SphereGeometry(0.06, 10, 8), sx * 0.1, 0.31, 0.47), WHITE));                                // round friendly eyes
    B.push(paint(place(new SphereGeometry(0.038, 8, 6), sx * 0.105, 0.31, 0.51), EYE));
    B.push(paint(place(new SphereGeometry(0.014, 5, 4), sx * 0.09, 0.33, 0.545), WHITE));
  }
  for (let k = 0; k < 3; k++) B.push(paint(place(new ConeGeometry(0.04, 0.22, 6), (k - 1) * 0.06, 0.48, 0.28 - k * 0.04, -0.5 - k * 0.15, 0, (k - 1) * 0.3), k === 1 ? GOLD : ORANGE));   // the crest
  for (let k = 0; k < 5; k++) B.push(paint(place(new ConeGeometry(0.07, 1.1 + (k === 2 ? 0.4 : 0), 6), (k - 2) * 0.07, -0.08, -0.75 - (k === 2 ? 0.2 : 0), -Math.PI / 2 - 0.1, (k - 2) * 0.12, 0, 1, 1, 0.35), k % 2 ? GOLD : ORANGE));   // the long tail
  const mat = vc({ roughness: 0.6, emissive: new Color(0x5a1a08), emissiveIntensity: 0.35 });
  const body = new Mesh(merge(B), mat); body.name = 'fawkes-body';
  const wing = (sx) => {
    const W = [];
    for (let k = 0; k < 5; k++) W.push(paint(place(new BoxGeometry(0.5 + k * 0.05, 0.03, 0.15), sx * (0.3 + k * 0.08), 0, 0.1 - k * 0.11, 0, sx * (0.12 + k * 0.08), 0), k < 2 ? RED : k < 4 ? ORANGE : GOLD));
    W.push(paint(place(new BoxGeometry(0.42, 0.05, 0.3), sx * 0.22, 0.01, 0.0), RED2));
    const w = new Group(); w.position.set(sx * 0.18, 0.08, 0.05); w.add(new Mesh(merge(W), mat)); return w;
  };
  const wL = wing(-1), wR = wing(1);
  const root = new Group(); root.name = 'adv-fawkes'; root.add(body, wL, wR);
  noRay(root);
  return { root, wL, wR, mat };
}

// ---------------- the Sorting Hat (patched brown felt, a slumped tip, friendly creases for eyes and mouth) ----------------
export function buildHat() {
  const FELT = 0x6a5038, FELT2 = 0x5a4230, DARK = 0x3a2a1c, PATCH = 0x8a6a48, L = [];
  L.push(paint(new CylinderGeometry(0.5, 0.54, 0.06, 18), FELT2));
  L.push(paint(new LatheGeometry([[0.3, 0.03], [0.3, 0.2], [0.25, 0.38], [0.17, 0.52], [0.1, 0.62], [0.0, 0.66]].map(([r, y]) => new Vector2(r, y)), 14), FELT));
  L.push(paint(place(new ConeGeometry(0.1, 0.3, 10), 0.12, 0.72, 0, 0, 0, -1.0), FELT));                         // the slumped tip
  for (const sx of [-1, 1]) L.push(paint(place(new TorusGeometry(0.05, 0.012, 4, 8, Math.PI), sx * 0.1, 0.36, 0.25, 0, 0, Math.PI), DARK));   // smiling crease eyes
  L.push(paint(place(new TorusGeometry(0.08, 0.014, 4, 10, Math.PI), 0, 0.23, 0.29, 0, 0, Math.PI), DARK));       // a smiling crease mouth
  L.push(paint(place(new BoxGeometry(0.12, 0.1, 0.02), -0.16, 0.14, 0.26, 0, -0.5, 0.2), PATCH));
  const m = new Mesh(merge(L), vc({ roughness: 0.95 })); m.name = 'adv-hat'; noRay(m);
  return m;
}
// ---------------- the sword: a silver blade, a gold guard, a ruby in the hilt (it rises out of the hat; never used) ----------------
export function buildSword() {
  const L = [];
  L.push(paint(place(new BoxGeometry(0.07, 0.95, 0.018), 0, 0.48, 0), 0xc8ccd0));
  L.push(paint(place(new ConeGeometry(0.05, 0.1, 4), 0, -0.03, 0, Math.PI, Math.PI / 4, 0, 1, 1, 0.35), 0xc8ccd0));
  L.push(paint(place(new BoxGeometry(0.34, 0.05, 0.06), 0, 0.98, 0), 0xd0a040));
  L.push(paint(place(new CylinderGeometry(0.025, 0.025, 0.22, 8), 0, 1.11, 0), 0x6a4a2a));
  L.push(paint(place(new SphereGeometry(0.045, 8, 6), 0, 1.25, 0), 0xd0a040));
  L.push(paint(place(new OctahedronGeometry(0.045, 0), 0, 0.98, 0.04), 0xd02030));   // the ruby
  const sword = new Mesh(merge(L), vc({ roughness: 0.3, metalness: 0.5, emissive: new Color(0x2a0a0a), emissiveIntensity: 0.6 }));
  const g = new Group(); g.name = 'adv-sword'; g.add(sword); noRay(g);
  return g;
}
// ---------------- the fang: a small curved ivory tooth that glows softly ----------------
export function buildFang() {
  const geo = new ConeGeometry(0.045, 0.28, 8, 4); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.14; p.setX(i, p.getX(i) + 0.25 * y * y); }
  geo.computeVertexNormals(); geo.rotateZ(Math.PI / 2); geo.translate(0, 0.04, 0);
  const m = new Mesh(geo, new MeshStandardMaterial({ color: 0xe8e0c8, emissive: new Color(0xffe8a0), emissiveIntensity: 0.5, roughness: 0.4 }));
  m.name = 'adv-fang'; noRay(m);
  return m;
}
// ---------------- Ginny: the chibi builder (red hair, Gryffindor robe); asleep = eyes shut; she lies and sits up ----------------
export function buildGinny() {
  const c = buildChibi({ robe: 0x1a1414, trim: 0x2a1a18, house: 0x7a1020, hair: 0xc04a1c });
  const head = c.children.find(o => o.isGroup && Math.abs(o.position.y - 1.5) < 0.01);
  const eyes = [], shut = [];
  if (head) {
    for (const o of head.children) if (o.isMesh && o.position.z >= 0.26 && Math.abs(Math.abs(o.position.x) - 0.1) < 0.01) eyes.push(o);
    const hm = head.children.find(o => o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0xc04a1c);
    // long hair down the back + a fringe
    if (hm) { const back = new Mesh(new SphereGeometry(0.3, 12, 10), hm.material); back.scale.set(1.05, 1.35, 0.7); back.position.set(0, -0.22, -0.14); head.add(back); }
    const lid = new MeshStandardMaterial({ color: 0x5a3020, roughness: 0.8 });
    for (const sx of [-0.1, 0.1]) { const s = new Mesh(new TorusGeometry(0.04, 0.01, 4, 10, Math.PI), lid); s.position.set(sx, 0.01, 0.285); s.rotation.z = Math.PI; head.add(s); shut.push(s); }
  }
  // fewer draw calls: she never walks, so the body merges per material, the head too (the eyes and the shut lids stay
  // their own meshes so they can swap when she wakes)
  let open = eyes, closed = shut;
  try {
    const whites = eyes.filter(e => e.geometry.parameters && e.geometry.parameters.radius > 0.04), pupils = eyes.filter(e => !whites.includes(e));
    for (const e of whites) e.material = whites[0].material; for (const e of pupils) e.material = pupils[0].material;
    mergeStatic(c, c.children.filter(o => o !== head), 'ginny-body');
    if (head) {
      mergeStatic(head, head.children.filter(o => o.isMesh && !eyes.includes(o) && !shut.includes(o)), 'ginny-head');
      mergeStatic(head, whites, 'ginny-eyes'); mergeStatic(head, pupils, 'ginny-eyes'); mergeStatic(head, shut, 'ginny-lids');
      open = head.children.filter(o => o.name === 'ginny-eyes' || eyes.includes(o)); closed = head.children.filter(o => o.name === 'ginny-lids' || shut.includes(o));
    }
  } catch { open = eyes; closed = shut; }
  const pivot = new Group(); pivot.name = 'adv-ginny'; c.position.y = -0.62; pivot.add(c);
  noRay(pivot);
  return { root: pivot, chibi: c, head, eyes: open, shut: closed, rig: c.userData.rig };
}
