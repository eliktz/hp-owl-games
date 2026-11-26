// Book 3, quest 3 geometry (adventure-b3-map.js runs it), all code-built (vertex colours + small canvas textures <= 512 px,
// no disk textures): the folded parchment on a little side table (common room), the one-eyed witch statue that slides
// aside in the staircase hall (+ the warm passage behind it), and Honeydukes ('b3honey'): a small bright sweet shop with
// shelves of jars, striped boxes, a counter, a barrel, a trapdoor back to the passage and a window onto a snowy evening
// street where Filch (slightly comic: stooped, flat cap, red scarf, rosy nose, a lantern) shuffles past.
// Budgets: Honeydukes about 14 draw calls and < 12k triangles; the statue + passage 2 draw calls; the table 1.
import {
  Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, PlaneGeometry, InstancedMesh, Object3D,
  Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace,
  AdditiveBlending, RepeatWrapping, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew','Heebo',Arial,sans-serif";
const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
export function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); }
export function paint(geo, hex) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k); return n; };
export const merge = (list) => mergeGeometries(list.map(strip), false);
export const triCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { const g = m.geometry, per = (g.index ? g.index.count : g.attributes.position.count) / 3; n += m.isInstancedMesh ? per * m.count : per; } }); return Math.round(n); };
export const drawCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { let p = m.parent, vis = true; while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; } if (vis && (!m.isInstancedMesh || m.count > 0)) n++; } }); return n; };
const vmat = (rough = 0.75) => new MeshStandardMaterial({ vertexColors: true, roughness: rough });
const quiet = (o) => { o.frustumCulled = false; o.raycast = () => {}; return o; };
function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }
export function softTex() {   // a round soft glow (additive cards)
  return canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
}
// brighten the room while it is the active interior; the lights are given back when the room is torn down
export function roomLight(g, { amb = 1.1, ambC = 0xfff0dc, hemi = 1.0, sky = 0xfff0f8, ground = 0x8a6a5a, fogC = null, fogD = null, bg = null }) {
  const L = { saved: null };
  const apply = () => {
    if (L.saved || !g.parent) return;
    const sc = g.parent, list = []; for (const o of sc.children) if (o.isAmbientLight || o.isHemisphereLight) list.push({ o, i: o.intensity, c: o.color.getHex(), g: o.groundColor ? o.groundColor.getHex() : null });
    L.saved = { list, fog: sc.fog ? { c: sc.fog.color.getHex(), d: sc.fog.density } : null, bg: sc.background && sc.background.isColor ? sc.background.getHex() : null, sc };
    for (const { o } of list) { if (o.isHemisphereLight) { o.intensity = hemi; o.color.setHex(sky); o.groundColor.setHex(ground); } else { o.intensity = amb; o.color.setHex(ambC); } }
    if (sc.fog && fogC !== null) { sc.fog.color.setHex(fogC); if (fogD !== null && sc.fog.density !== undefined) sc.fog.density = fogD; }
    if (bg !== null && sc.background && sc.background.isColor) sc.background.setHex(bg);
  };
  const restore = () => {
    const s = L.saved; if (!s) return; L.saved = null;
    for (const l of s.list) { l.o.intensity = l.i; l.o.color.setHex(l.c); if (l.g !== null && l.o.groundColor) l.o.groundColor.setHex(l.g); }
    if (s.fog && s.sc.fog) { s.sc.fog.color.setHex(s.fog.c); if (s.fog.d !== undefined) s.sc.fog.density = s.fog.d; }
    if (s.bg !== null && s.sc.background && s.sc.background.isColor) s.sc.background.setHex(s.bg);
  };
  const marker = new Object3D(); marker.name = 'b3-light'; marker.userData.onTeardown = restore; g.add(marker);
  return { apply, restore, on: () => !!L.saved };
}

// ---------------- the common room: a little round side table with the folded parchment ----------------
export const TABLE = { x: 4.7, z: 2.2 };                 // common room (room-local); Harry taps it from the door side
export function buildTable() {
  const P = [], W = 0x6a4228, D = 0x4a2a18;
  P.push(paint(place(new CylinderGeometry(0.42, 0.42, 0.05, 16), 0, 0.72, 0), W));
  P.push(paint(place(new CylinderGeometry(0.05, 0.07, 0.7, 8), 0, 0.36, 0), D));
  P.push(paint(place(new CylinderGeometry(0.26, 0.3, 0.04, 12), 0, 0.02, 0), D));
  P.push(paint(place(new BoxGeometry(0.36, 0.03, 0.26), 0, 0.76, 0, 0, 0.3, 0), 0xd8c49a));      // the folded parchment
  P.push(paint(place(new BoxGeometry(0.34, 0.025, 0.12), 0.02, 0.785, -0.04, 0, 0.3, 0.06), 0xc8b088));
  P.push(paint(place(new CylinderGeometry(0.03, 0.03, 0.012, 8), 0.05, 0.802, 0.0), 0x9a2a1a));   // a wax seal
  const g = new Group(); g.name = 'b3-map-table'; g.add(quiet(new Mesh(merge(P), vmat(0.7)))); g.position.set(TABLE.x, 0, TABLE.z);
  return g;
}

// ---------------- the staircase hall: the one-eyed witch statue + the passage behind her ----------------
export const STATUE = { x: 6.3, z: 9.85, slide: 1.45 };   // room-local; her back to the south wall (inner face z 10.5), facing -z
export function buildStatue() {
  const g = new Group(); g.name = 'b3-statue'; g.position.set(STATUE.x, 0, STATUE.z);
  const ST = 0x9a958c, ST2 = 0x84807a, LT = 0xb8b4ac, P = [];
  P.push(paint(place(new BoxGeometry(1.1, 0.5, 0.8), 0, 0.25, 0), ST2));
  P.push(paint(place(new BoxGeometry(1.2, 0.08, 0.9), 0, 0.52, 0), LT));
  P.push(paint(place(new SphereGeometry(0.44, 14, 10), 0, 1.06, 0, 0, 0, 0, 1, 1.3, 0.95), ST));              // the round cloak
  P.push(paint(place(new SphereGeometry(0.3, 12, 8), 0.04, 1.42, 0.16), ST));                                  // the hump
  P.push(paint(place(new SphereGeometry(0.21, 12, 9), 0, 1.6, -0.18), LT));                                    // the head, leaning forward
  P.push(paint(place(new ConeGeometry(0.2, 0.62, 12), -0.02, 1.98, -0.12, -0.2, 0, 0.12), ST2));               // the pointy hat
  P.push(paint(place(new CylinderGeometry(0.3, 0.3, 0.04, 14), 0, 1.75, -0.16, 0.1, 0, 0), ST2));              // its brim
  P.push(paint(place(new SphereGeometry(0.085, 10, 7), 0, 1.64, -0.36), 0xd8d4cc));                            // ONE big round friendly eye
  P.push(paint(place(new SphereGeometry(0.04, 8, 6), 0, 1.64, -0.43), 0x5a5650));
  P.push(paint(place(new ConeGeometry(0.04, 0.16, 6), 0, 1.53, -0.4, -1.3, 0, 0), ST));                        // a long nose
  P.push(paint(place(new TorusGeometry(0.05, 0.015, 4, 8, Math.PI), 0, 1.47, -0.36, 0, 0, Math.PI), 0x6a6660)); // a little smile
  P.push(paint(place(new CylinderGeometry(0.025, 0.03, 1.15, 6), 0.42, 1.05, -0.2, 0.05, 0, -0.08), ST2));      // a crooked cane
  P.push(paint(place(new SphereGeometry(0.07, 8, 6), 0.38, 1.62, -0.22), ST));
  const body = quiet(new Mesh(merge(P), vmat(0.85))); body.name = 'b3-statue-body'; g.add(body);
  // the passage: a warm golden arch in the wall behind her (seen once she slides)
  const t = canvasTex(128, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.save(); x.beginPath(); x.moveTo(8, h); x.lineTo(8, 64); x.arc(64, 64, 56, Math.PI, 0); x.lineTo(120, h); x.closePath(); x.clip();
    const g2 = x.createRadialGradient(64, 150, 6, 64, 150, 120); g2.addColorStop(0, '#ffe2a0'); g2.addColorStop(0.45, '#d8903a'); g2.addColorStop(1, '#4a2410'); x.fillStyle = g2; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(90,50,20,.55)'; for (let k = 0; k < 6; k++) x.fillRect(30 + k * 2, 180 + k * 12, 68 - k * 4, 5);   // little steps down
    x.restore(); x.strokeStyle = '#6a625a'; x.lineWidth = 8; x.beginPath(); x.moveTo(8, h); x.lineTo(8, 64); x.arc(64, 64, 56, Math.PI, 0); x.lineTo(120, h); x.stroke();
  });
  const hole = quiet(new Mesh(new PlaneGeometry(1.15, 2.3).rotateY(Math.PI).translate(0, 1.15, 0.6), new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false })));
  hole.name = 'b3-passage'; hole.visible = false; g.add(hole);
  return { g, body, hole };
}

// ---------------- Honeydukes ----------------
export const HONEY = { W: 11, D: 9, H: 3.4 };
export const HSPAWN = { x: 0.8, z: -1.0, yaw: 0 };                 // facing +z: the counter, the shelves and the window ahead
export const TRAP = { x: -4.1, z: -3.6 };                          // the trapdoor back into the passage (north-west corner)
export const BARREL = { x: -1.7, z: -0.9 }, HIDE = { x: -1.8, z: -2.2 };
export const WIN = { x: 0, z: 4.5, w: 4.2, y0: 0.95, y1: 2.65 };
export const FILCH_Z = 5.5;
// ten places for sweets (room-local x, y, z): shelves, the counter, the barrel lid
export const SWEET_SPOTS = [[-4.85, 1.02, -1.4], [-4.85, 1.62, 0.6], [-4.85, 2.22, 2.4], [-4.85, 1.02, 2.6], [3.4, 1.12, -0.6], [3.4, 1.12, 0.7], [3.1, 1.12, 1.9],
  [-3.4, 1.62, 4.0], [3.6, 1.62, 4.0], [-1.7, 1.08, -0.9]];
const PASTEL = [0xe87aa8, 0x7ad8b8, 0xe8d06a, 0x7ab0e8, 0xb88ae0, 0xe89a5a, 0x8ae07a];
export function buildHoney() {
  const { W, D, H } = HONEY, g = new Group(); g.name = 'b3honey';
  const cols = [], S = [];
  // floor: a cheerful pink-and-cream checker (canvas 256)
  const ft = canvasTex(256, 256, (x) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#e8b8c8' : '#f4e6d0'; x.fillRect(i * 32, j * 32, 32, 32); } });
  ft.wrapS = ft.wrapT = RepeatWrapping; ft.repeat.set(W / 4, D / 4);
  const floor = new Mesh(new PlaneGeometry(W, D).rotateX(-Math.PI / 2), new MeshStandardMaterial({ map: ft, roughness: 0.8 })); floor.name = 'honey-floor'; floor.raycast = () => {}; g.add(floor);
  // walls (mint above a raspberry wainscot), the ceiling, the window wall built round its hole
  const MINT = 0xa8d8c4, RASP = 0xc8507a, CREAM = 0xf0e2c8, WOOD = 0x8a5a34, DW = 0x6a4228;
  const wallBox = (x, z, w, d, y0 = 0, y1 = H) => { S.push(paint(place(new BoxGeometry(w, y1 - y0, d), x, (y0 + y1) / 2, z), MINT)); if (y0 < 1) S.push(paint(place(new BoxGeometry(w + 0.02, Math.min(1.0, y1) - y0, d + 0.06), x, (y0 + Math.min(1.0, y1)) / 2, z), RASP)); };
  wallBox(0, -D / 2 - 0.15, W, 0.3); wallBox(-W / 2 - 0.15, 0, 0.3, D); wallBox(W / 2 + 0.15, 0, 0.3, D);
  const wx0 = WIN.x - WIN.w / 2, wx1 = WIN.x + WIN.w / 2, zS = D / 2 + 0.15;
  wallBox((-W / 2 + wx0) / 2, zS, wx0 + W / 2, 0.3); wallBox((wx1 + W / 2) / 2, zS, W / 2 - wx1, 0.3);
  wallBox(WIN.x, zS, WIN.w, 0.3, 0, WIN.y0); wallBox(WIN.x, zS, WIN.w, 0.3, WIN.y1, H);
  for (const c of [[0, -D / 2 - 0.15, W / 2, 0.3], [-W / 2 - 0.15, 0, 0.3, D / 2], [W / 2 + 0.15, 0, 0.3, D / 2], [0, zS, W / 2, 0.3]]) cols.push({ type: 'box', x: c[0], z: c[1], hw: c[2], hd: c[3], angle: 0 });
  S.push(paint(place(new BoxGeometry(W, 0.1, D), 0, H + 0.05, 0), CREAM));
  for (const x of [-3.6, 0, 3.6]) S.push(paint(place(new BoxGeometry(0.14, 0.12, D), x, H - 0.06, 0), WOOD));                        // beams
  // the window frame (white mullions) and a sill
  S.push(paint(place(new BoxGeometry(WIN.w + 0.2, 0.12, 0.4), WIN.x, WIN.y0, WIN.z - 0.05), CREAM));
  for (const dx of [-WIN.w / 2, -WIN.w / 6, WIN.w / 6, WIN.w / 2]) S.push(paint(place(new BoxGeometry(0.08, WIN.y1 - WIN.y0, 0.1), WIN.x + dx, (WIN.y0 + WIN.y1) / 2, WIN.z - 0.1), CREAM));
  S.push(paint(place(new BoxGeometry(WIN.w + 0.2, 0.1, 0.12), WIN.x, WIN.y1, WIN.z - 0.1), CREAM));
  // shelves: the west wall (three tiers), each side of the window, the east wall north end
  const shelf = (x, z, len, axis, ys) => { for (const y of ys) S.push(paint(place(axis === 'z' ? new BoxGeometry(0.45, 0.06, len) : new BoxGeometry(len, 0.06, 0.4), x, y, z), WOOD)); S.push(paint(place(axis === 'z' ? new BoxGeometry(0.06, ys[ys.length - 1] + 0.3, len) : new BoxGeometry(len, ys[ys.length - 1] + 0.3, 0.06), axis === 'z' ? x - Math.sign(x) * 0.2 : x, (ys[ys.length - 1] + 0.3) / 2, axis === 'z' ? z : z + 0.18), DW)); };
  shelf(-5.25, 0.6, 6.4, 'z', [0.98, 1.58, 2.18]); shelf(-3.6, 4.25, 2.6, 'x', [0.98, 1.58, 2.18]); shelf(3.6, 4.25, 2.6, 'x', [0.98, 1.58, 2.18]); shelf(5.25, -2.6, 3.2, 'z', [0.98, 1.58, 2.18]);
  // the counter (with candy stripes), a big barrel, two giant lollipops, the trapdoor rim
  S.push(paint(place(new BoxGeometry(1.0, 1.0, 3.6), 3.4, 0.5, 0.6), 0xf0d0dc));
  for (let i = 0; i < 6; i++) S.push(paint(place(new BoxGeometry(1.02, 1.0, 0.18), 3.4, 0.5, -1.0 + i * 0.6), i % 2 ? 0xe87aa8 : 0xf6e8e0));
  S.push(paint(place(new BoxGeometry(1.2, 0.08, 3.8), 3.4, 1.04, 0.6), WOOD));
  cols.push({ type: 'box', x: 3.4, z: 0.6, hw: 0.6, hd: 1.9, angle: 0 });
  S.push(paint(place(new CylinderGeometry(0.42, 0.42, 1.0, 14), BARREL.x, 0.5, BARREL.z, 0, 0, 0, 1, 1, 1), WOOD));
  S.push(paint(place(new CylinderGeometry(0.48, 0.48, 0.6, 14), BARREL.x, 0.5, BARREL.z), 0x9a6a3a));
  for (const y of [0.16, 0.84]) S.push(paint(place(new TorusGeometry(0.46, 0.025, 4, 16), BARREL.x, y, BARREL.z, Math.PI / 2, 0, 0), 0x4a4440));
  cols.push({ type: 'circle', x: BARREL.x, z: BARREL.z, r: 0.55 });
  for (const [lx, lz, c] of [[-4.6, -3.7, 0xe87aa8], [4.6, 3.5, 0x7ab0e8]]) {
    S.push(paint(place(new CylinderGeometry(0.04, 0.04, 1.6, 6), lx, 0.8, lz), CREAM));
    S.push(paint(place(new CylinderGeometry(0.42, 0.42, 0.08, 18), lx, 1.9, lz, Math.PI / 2, 0, 0), c));
    S.push(paint(place(new TorusGeometry(0.26, 0.04, 4, 16), lx, 1.9, lz + 0.05), 0xf6e8e0));
    cols.push({ type: 'circle', x: lx, z: lz, r: 0.3 });
  }
  S.push(paint(place(new BoxGeometry(1.4, 0.06, 1.2), TRAP.x, 0.03, TRAP.z), 0x5a3a22));
  S.push(paint(place(new BoxGeometry(1.2, 0.08, 1.0), TRAP.x, 0.55, TRAP.z - 0.62, -1.25, 0, 0), WOOD));                             // the hatch, open
  const shell = new Mesh(merge(S), vmat(0.78)); shell.name = 'honey-shell'; shell.frustumCulled = false; g.add(shell);   // (the camera's spring arm stops on it)
  // jars on the shelves (one instanced mesh, pastel sweets inside)
  const jarGeo = merge([paint(new CylinderGeometry(0.11, 0.11, 0.26, 10).translate(0, 0.13, 0), 0xd8d8d8), paint(new CylinderGeometry(0.08, 0.08, 0.05, 10).translate(0, 0.285, 0), 0x8a8a8a)]);
  const jarSpots = [];
  for (const y of [0.98, 1.58, 2.18]) { for (let k = 0; k < 7; k++) jarSpots.push([-5.1, y + 0.03, -2.2 + k * 0.85]); for (let k = 0; k < 4; k++) { jarSpots.push([-4.6 + k * 0.62, y + 0.03, 4.25]); jarSpots.push([2.6 + k * 0.62, y + 0.03, 4.25]); } for (let k = 0; k < 4; k++) jarSpots.push([5.1, y + 0.03, -3.8 + k * 0.8]); }
  const jars = quiet(new InstancedMesh(jarGeo, vmat(0.35), jarSpots.length)); jars.name = 'honey-jars';
  jarSpots.forEach((p, i) => { _m.makeTranslation(p[0], p[1], p[2]); jars.setMatrixAt(i, _m); jars.setColorAt(i, _c.setHex(PASTEL[(i * 3) % PASTEL.length])); });
  g.add(jars);
  // the sweets to collect: striped boxes (one instanced mesh; a collected box scales to 0)
  const boxGeo = merge([paint(new BoxGeometry(0.34, 0.24, 0.26).translate(0, 0.12, 0), 0xd6d6d6), paint(new BoxGeometry(0.36, 0.26, 0.07).translate(0, 0.12, 0), 0xf8f8f8), paint(new BoxGeometry(0.07, 0.26, 0.28).translate(0, 0.12, 0), 0xf8f8f8),
    paint(new SphereGeometry(0.06, 8, 5).translate(0, 0.27, 0), 0xf8f8f8)]);
  const sweetMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0xffe0a0, emissiveIntensity: 0.25 });
  const sweets = quiet(new InstancedMesh(boxGeo, sweetMat, SWEET_SPOTS.length)); sweets.name = 'honey-sweets';
  SWEET_SPOTS.forEach((p, i) => sweets.setColorAt(i, _c.setHex(PASTEL[i % PASTEL.length])));
  g.add(sweets);
  // warm round ceiling lamps (emissive)
  const lamps = quiet(new Mesh(merge([[-2.6, -1.5], [1.5, -1.2], [-1.0, 2.2], [2.6, 2.4]].map(([x, z]) => paint(new SphereGeometry(0.2, 10, 7).translate(x, H - 0.45, z), 0xffffff))), new MeshStandardMaterial({ vertexColors: true, emissive: 0xffd890, emissiveIntensity: 1.6 })));
  lamps.name = 'honey-lamps'; g.add(lamps);
  // the shop sign over the counter (canvas)
  const st = canvasTex(512, 128, (x, w, h) => { x.fillStyle = '#7a2a4a'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 24); x.fill(); x.strokeStyle = '#e8c860'; x.lineWidth = 6; x.stroke();
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 60px ' + FONT; x.fillStyle = '#ffe8a8'; x.fillText('🍬 הוניידוקס 🍭', w / 2, h / 2 + 4); });
  const sign = quiet(new Mesh(new PlaneGeometry(2.6, 0.65).rotateY(-Math.PI / 2).translate(W / 2 - 0.02, 2.55, 0.6), new MeshBasicMaterial({ map: st, toneMapped: false })));
  sign.name = 'honey-sign'; g.add(sign);
  // glass, and the snowy street outside (one canvas card)
  const glass = quiet(new Mesh(new PlaneGeometry(WIN.w, WIN.y1 - WIN.y0).translate(WIN.x, (WIN.y0 + WIN.y1) / 2, WIN.z + 0.05), new MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.18, depthWrite: false })));
  glass.name = 'honey-glass'; g.add(glass);
  const street = quiet(new Mesh(new PlaneGeometry(18, 6).rotateY(Math.PI).translate(0, 2.2, 8.2), new MeshBasicMaterial({ map: streetTex(), toneMapped: false, fog: false })));
  street.name = 'honey-street'; g.add(street);
  // the trapdoor glow (warm light up from the passage)
  const soft = softTex();
  const trapGlow = quiet(new Mesh(new PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2).translate(TRAP.x, 0.08, TRAP.z), new MeshBasicMaterial({ map: soft, color: 0xffc070, transparent: true, depthWrite: false, blending: AdditiveBlending })));
  trapGlow.name = 'honey-trapglow'; g.add(trapGlow);
  // Filch outside the window + his lantern glow + the lantern light that falls in on the floor
  const F = buildFilch(); F.g.position.set(-7, 0, FILCH_Z); g.add(F.g);
  const lglow = quiet(new Mesh(new PlaneGeometry(1.1, 1.1), new MeshBasicMaterial({ map: soft, color: 0xffd070, transparent: true, depthWrite: false, blending: AdditiveBlending })));
  lglow.name = 'filch-lantern-glow'; g.add(lglow);
  const pool = quiet(new Mesh(new PlaneGeometry(2.6, 3.2).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: soft, color: 0xffc860, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending })));
  pool.name = 'filch-light-pool'; pool.position.set(0, 0.04, 2.6); g.add(pool);
  return { g, cols, sweets, sweetMat, F, lglow, pool, trapGlow, glass, jars };
}
function streetTex() {
  return canvasTex(512, 192, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5a6aa8'); g.addColorStop(0.55, '#b89ab8'); g.addColorStop(1, '#d8c4b0'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.arc((i * 97) % w, (i * 53) % (h * 0.5), 1.5, 0, 7); x.fill(); }
    const houses = [[0, 70, 110, '#8a5a4a'], [100, 56, 120, '#6a5a7a'], [210, 78, 100, '#9a6a4a'], [300, 60, 110, '#5a6a6a'], [400, 72, 120, '#8a4a5a']];
    for (const [hx, top, hw, c] of houses) {
      x.fillStyle = c; x.fillRect(hx, top, hw, h - top); x.fillStyle = '#f4f4f8'; x.beginPath(); x.moveTo(hx - 6, top + 4); x.lineTo(hx + hw / 2, top - 28); x.lineTo(hx + hw + 6, top + 4); x.closePath(); x.fill();
      x.fillStyle = '#ffd880'; for (let k = 0; k < 2; k++) x.fillRect(hx + 18 + k * (hw - 54), top + 26, 18, 22);
    }
    x.fillStyle = '#e8e4ec'; x.fillRect(0, h - 26, w, 26); x.fillStyle = 'rgba(140,130,150,.35)'; for (let i = 0; i < w; i += 22) x.fillRect(i, h - 20, 12, 4);
  });
}
// Filch: stooped, flat cap, red scarf, rosy round nose, a lantern held out in front (faces +x; turned to walk)
export function buildFilch() {
  const P = [], COAT = 0x6a4a32, COAT2 = 0x5a3e2a, SKIN = 0xe2bc9a, CAP = 0x4a5a3a;
  for (const sz of [-1, 1]) P.push(paint(place(new CylinderGeometry(0.07, 0.08, 0.6, 7), 0, 0.3, sz * 0.12), 0x4a4038));
  for (const sz of [-1, 1]) P.push(paint(place(new BoxGeometry(0.26, 0.1, 0.14), 0.06, 0.05, sz * 0.12), 0x2a2420));
  P.push(paint(place(new CylinderGeometry(0.24, 0.36, 0.75, 12), 0, 0.88, 0), COAT));
  P.push(paint(place(new CylinderGeometry(0.2, 0.25, 0.42, 12), 0.1, 1.38, 0, 0, 0, -0.45), COAT2));            // the stooped back
  P.push(paint(place(new TorusGeometry(0.15, 0.06, 6, 12), 0.22, 1.55, 0, Math.PI / 2, 0, 0.3), 0xb8402a));       // the red scarf
  P.push(paint(place(new SphereGeometry(0.17, 12, 9), 0.33, 1.68, 0), SKIN));                                       // head, pushed forward
  P.push(paint(place(new SphereGeometry(0.07, 8, 6), 0.5, 1.66, 0), 0xd88a7a));                                     // a big rosy nose
  for (const sz of [-1, 1]) { P.push(paint(place(new SphereGeometry(0.025, 6, 4), 0.47, 1.73, sz * 0.06), 0x3a3030)); P.push(paint(place(new BoxGeometry(0.03, 0.025, 0.08), 0.46, 1.78, sz * 0.065, 0, 0, sz * 0.1), 0x9a9690)); }
  P.push(paint(place(new CylinderGeometry(0.2, 0.19, 0.07, 12), 0.32, 1.82, 0), CAP));                             // the flat cap
  P.push(paint(place(new BoxGeometry(0.16, 0.03, 0.26), 0.5, 1.8, 0), CAP));                                        // its peak
  P.push(paint(place(new CylinderGeometry(0.05, 0.05, 0.5, 6), 0.35, 1.25, 0.18, 0, 0, -1.2), COAT2));              // the arm, held out
  P.push(paint(place(new CylinderGeometry(0.012, 0.012, 0.18, 4), 0.6, 1.05, 0.2), 0x3a3028));
  P.push(paint(place(new BoxGeometry(0.16, 0.2, 0.16), 0.6, 0.86, 0.2), 0x3a3028));
  P.push(paint(place(new BoxGeometry(0.12, 0.14, 0.12), 0.6, 0.86, 0.2), 0xffe080));                                 // the lantern's light
  const g = new Group(); g.name = 'b3-filch';
  const body = quiet(new Mesh(merge(P), vmat(0.8))); body.name = 'filch-body'; g.add(body);
  return { g, body, lantern: new Vector3(0.6, 0.86, 0.2) };
}
