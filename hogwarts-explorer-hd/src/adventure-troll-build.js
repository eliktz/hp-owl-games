// Quest 2 geometry (adventure-troll.js runs it): the girls' bathroom ('trollroom'), the troll, the muddy footprints,
// the quest door in the Entrance Hall and the feast pumpkins. All built in code, warm and torchlit, never dark.
// Room: 10 x 12 m, 5 m high; entry door on the south wall (z +6); five sinks under one long mirror on the west wall,
// three wooden stalls on the east wall. The troll: a big round sleepy lump (< 5k tris, ONE vertex-colour material,
// group transforms only: root turn, body sway, head look, arms, legs for sitting, mouth for the yawn).
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, ConeGeometry, LatheGeometry,
  Vector2, Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture,
  InstancedMesh, Object3D, DoubleSide, SRGBColorSpace, RepeatWrapping,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { floor, ceiling, torch, mergeStatic, stoneMat, MAT, woodMat } from './interior-kit.js';
import { bakeLight } from './atmosphere.js';
import { buildChibi } from './chibi.js';

export const RW = 10, RD = 12, RH = 5;
export const SINK_Z = [-3.4, -1.7, 0, 1.7, 3.4];
export const SINK_X = -4.45;                       // the basin centre (the wall face is x -4.5... -5)
export const STALL_Z = [-3.6, -1.95, -0.3];        // stall centres on the east wall (doors at x STALL_X, open inward +x)
export const STALL_X = 3.35;
export const TROLL_AT = { x: 1.35, z: -1.95 };
export const SPAWN = { x: 0.4, z: 4.3, yaw: Math.PI };
export const HALL_DOOR = { x: 5.9, z: 11.5 };      // the Entrance Hall south wall, east of the front doors (mirror of the Floo)
// the footprints: from the Great Hall archway (west) across the Entrance Hall to the new door
export const PRINT_PATH = [[-7.3, 1.0], [-4.6, 2.2], [-1.6, 4.0], [1.4, 6.2], [3.8, 8.3], [5.6, 10.0]];
const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew',Arial,sans-serif";

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); }
function paint(geo, hex) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const merge = (list) => mergeGeometries(list.map(strip), false);
const vc = (opts = {}) => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, ...opts });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }
const S = (w, h) => new SphereGeometry(1, w, h);
const noRay = (o) => { o.traverse(m => { if (m.isMesh) m.raycast = () => {}; }); return o; };
export const triCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); } }); return Math.round(n); };

// ---------------- the troll (faces +z in its own frame, feet at y 0, about 3.1 m tall) ----------------
export function buildTroll() {
  const SKIN = 0x8c9a72, SKIN2 = 0x76865e, BELLY = 0xa2ac84, CLOTH = 0x7a5634, ROPE = 0x4e3820, NAIL = 0xd8ceb0, DARK = 0x221c16, CHEEK = 0xc8907a, MOUTH = 0x5a2a26;
  const mat = vc({ roughness: 0.9 });
  const root = new Group(); root.name = 'adv-troll';
  const mk = (list, name, parent) => { const m = new Mesh(merge(list), mat); m.name = name; parent.add(m); return m; };
  // legs (one mesh, pivot at the hips so he can sit: rotate x)
  const legs = new Group(); legs.position.set(0, 0.95, 0); root.add(legs);
  const L = [];
  for (const sx of [-1, 1]) {
    L.push(paint(place(S(10, 8), sx * 0.46, -0.42, 0, 0, 0, 0, 0.36, 0.55, 0.38), SKIN2));
    L.push(paint(place(S(10, 6), sx * 0.5, -0.83, 0.2, 0, 0, 0, 0.36, 0.16, 0.5), SKIN2));
    for (let k = -1; k <= 1; k++) L.push(paint(place(S(6, 4), sx * 0.5 + k * 0.15, -0.88, 0.66, 0, 0, 0, 0.09, 0.08, 0.1), NAIL));
  }
  const legMesh = mk(L, 'troll-legs', legs);
  // body: pivot at the hips; belly, chest, loincloth with a rope belt
  const body = new Group(); body.position.set(0, 0.95, 0); root.add(body);
  const B = [];
  B.push(paint(place(S(16, 12), 0, 0.62, 0.05, 0, 0, 0, 1.08, 1.0, 0.98), SKIN));
  B.push(paint(place(S(12, 8), 0, 0.55, 0.42, 0, 0, 0, 0.82, 0.75, 0.66), BELLY));
  B.push(paint(place(S(14, 10), 0, 1.38, -0.05, 0, 0, 0, 1.12, 0.62, 0.82), SKIN));
  B.push(paint(place(new CylinderGeometry(1.02, 1.08, 0.5, 16, 1, true), 0, 0.1, 0.02), CLOTH));
  B.push(paint(place(new TorusGeometry(1.03, 0.06, 5, 18), 0, 0.33, 0.02, Math.PI / 2, 0, 0), ROPE));
  B.push(paint(place(S(6, 4), 0.02, 0.62, 0.96, 0, 0, 0, 0.06, 0.05, 0.03), SKIN2));   // belly button
  const bodyMesh = mk(B, 'troll-body', body);
  // head (pivot at the neck): small and round, big nose, floppy ears, sleepy eyes, rosy cheeks, a tuft
  const head = new Group(); head.position.set(0, 1.78, 0.1); body.add(head);
  const Hd = [];
  Hd.push(paint(place(S(14, 10), 0, 0.32, 0.02, 0, 0, 0, 0.44, 0.4, 0.42), SKIN));
  Hd.push(paint(place(S(10, 8), 0, 0.28, 0.46, 0.25, 0, 0, 0.15, 0.13, 0.22), SKIN2));       // the nose
  for (const sx of [-1, 1]) {
    Hd.push(paint(place(S(8, 6), sx * 0.46, 0.34, -0.02, 0, 0, sx * 0.6, 0.2, 0.1, 0.14), SKIN2));   // ears
    Hd.push(paint(place(S(8, 6), sx * 0.15, 0.42, 0.36, 0, 0, 0, 0.06, 0.06, 0.04), 0xf0ead8));     // eye whites
    Hd.push(paint(place(S(6, 4), sx * 0.15, 0.415, 0.39, 0, 0, 0, 0.035, 0.035, 0.02), DARK));       // pupils
    Hd.push(paint(place(S(8, 4, 0), sx * 0.15, 0.44, 0.37, 0.25, 0, 0, 0.075, 0.05, 0.05), SKIN2));   // heavy lids
    Hd.push(paint(place(S(6, 4), sx * 0.27, 0.22, 0.32, 0, 0, 0, 0.08, 0.06, 0.04), CHEEK));
  }
  for (let k = -1; k <= 1; k++) Hd.push(paint(place(new ConeGeometry(0.05, 0.22, 5), k * 0.08, 0.74, -0.02, 0, 0, -k * 0.4), DARK));
  mk(Hd, 'troll-head', head);
  // the mouth: its own small mesh so the yawn can open it
  const mouth = new Mesh(merge([paint(place(S(10, 6), 0, 0, 0, 0, 0, 0, 0.14, 0.035, 0.05), MOUTH)]), mat); mouth.position.set(0, 0.14, 0.38); mouth.name = 'troll-mouth'; head.add(mouth);
  // arms: pivots at the shoulders; long, hands almost to the knees
  const arm = (sx) => {
    const a = new Group(); a.position.set(sx * 1.02, 2.35, 0); root.add(a);
    const A = [];
    A.push(paint(place(S(10, 8), sx * 0.12, -0.45, 0, 0, 0, sx * 0.12, 0.3, 0.55, 0.3), SKIN));
    A.push(paint(place(S(10, 8), sx * 0.2, -1.05, 0.05, 0, 0, 0, 0.24, 0.45, 0.24), SKIN));
    A.push(paint(place(S(10, 8), sx * 0.22, -1.5, 0.08, 0, 0, 0, 0.27, 0.25, 0.27), SKIN2));
    for (let k = -1; k <= 1; k++) A.push(paint(place(S(6, 4), sx * 0.22 + k * 0.1, -1.68, 0.22, 0, 0, 0, 0.07, 0.07, 0.07), NAIL));
    mk(A, sx < 0 ? 'troll-arm-r' : 'troll-arm-l', a); return a;
  };
  const armR = arm(-1), armL = arm(1);
  // the club: in the troll's frame, resting on the floor in his right hand
  const club = new Group(); club.name = 'troll-club';
  const C = [];
  C.push(paint(new LatheGeometry([[0, -0.02], [0.08, 0], [0.09, 0.5], [0.15, 1.0], [0.22, 1.35], [0.2, 1.55], [0, 1.62]].map(([r, y]) => new Vector2(r, y)), 10), 0x8a5e36));
  for (const [x, y, z] of [[0.18, 1.2, 0.05], [-0.15, 1.35, 0.1], [0.05, 1.45, -0.18]]) C.push(paint(place(S(6, 4), x, y, z, 0, 0, 0, 0.08), 0x6a4426));
  const clubMesh = new Mesh(merge(C).rotateX(Math.PI).translate(0, 1.62, 0), mat); clubMesh.name = 'club'; club.add(clubMesh);   // pivot at the knob, the handle along +y
  root.add(club);
  // at rest: the knob on the floor beside his right foot, the handle leaning up into his right hand
  const knob = new Vector3(-1.75, 0.2, 1.15), hand = new Vector3(-1.24, 0.85, 0.08), dir = hand.clone().sub(knob);
  const CLUB_REST = { pos: knob, quat: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize()), scale: dir.length() / 1.64 };
  const restClub = () => { club.position.copy(CLUB_REST.pos); club.quaternion.copy(CLUB_REST.quat); club.scale.setScalar(CLUB_REST.scale); };
  restClub();
  // the stars that circle his head (one instanced mesh) and the sleepy z's (another)
  const starT = canvasTex(64, 64, (x) => { x.translate(32, 32); x.fillStyle = '#ffe26a'; x.strokeStyle = '#a86a10'; x.lineWidth = 3; x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 11 : 27; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); });
  const stars = new InstancedMesh(new PlaneGeometry(0.34, 0.34), new MeshBasicMaterial({ map: starT, transparent: true, depthWrite: false }), 5);
  stars.frustumCulled = false; stars.count = 0; stars.name = 'troll-stars'; root.add(stars);
  const zT = canvasTex(64, 64, (x) => { x.font = 'bold 54px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff6d0'; x.strokeStyle = '#4a6a3a'; x.lineWidth = 6; x.strokeText('z', 32, 34); x.fillText('z', 32, 34); });
  const zs = new InstancedMesh(new PlaneGeometry(0.5, 0.5), new MeshBasicMaterial({ map: zT, transparent: true, depthWrite: false }), 4);
  zs.frustumCulled = false; zs.count = 0; zs.name = 'troll-z'; root.add(zs);
  noRay(root);
  return { root, body, head, mouth, armL, armR, legs, club, clubMesh, stars, zs, restClub, CLUB_REST, mats: [mat], meshes: [legMesh, bodyMesh] };
}

// ---------------- the bathroom ----------------
function tileTex(a, b, n) {
  const t = canvasTex(256, 256, (x) => { const s = 256 / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * s, j * s, s, s); } x.strokeStyle = 'rgba(60,40,20,.35)'; x.lineWidth = 2; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, 256); x.stroke(); x.beginPath(); x.moveTo(0, i * s); x.lineTo(256, i * s); x.stroke(); } });
  t.wrapS = t.wrapT = RepeatWrapping; return t;
}
export function buildTrollRoom(progress) {
  const g = new Group(); g.name = 'adv-trollroom'; const cols = [];
  const WALL = 0xc4a47a, wallM = stoneMat(3.3, 1.6, WALL), LINT = stoneMat(1.2, 0.5, WALL);
  const add = (geo, mat, parent = g) => { const m = new Mesh(geo, mat); parent.add(m); return m; };
  const box = (x, z, w, d, h = RH, y = h / 2, mat = wallM) => add(new BoxGeometry(w, h, d).translate(x, y, z), mat);
  // floor: warm cream / sage chequer tiles; ceiling: dark oak
  const fT = tileTex('#cfc2a2', '#7f9a84', 8); fT.repeat.set(RW / 4, RD / 4);
  const fl = add(new PlaneGeometry(RW, RD).rotateX(-Math.PI / 2), new MeshStandardMaterial({ map: fT, roughness: 0.55 })); fl.receiveShadow = true; fl.name = 'tiles';
  ceiling(g, RW, RD, RH, 0x5a4636);
  // walls (1 m thick, inner faces at x +-5, z +-6); the south wall has the doorway at x 0
  for (const sx of [-1, 1]) { box(sx * (RW / 2 + 0.5), 0, 1, RD + 2); cols.push({ type: 'box', x: sx * (RW / 2 + 0.5), z: 0, hw: 0.5, hd: RD / 2 + 1, angle: 0 }); }
  box(0, -(RD / 2 + 0.5), RW + 2, 1); cols.push({ type: 'box', x: 0, z: -(RD / 2 + 0.5), hw: RW / 2 + 1, hd: 0.5, angle: 0 });
  for (const sx of [-1, 1]) { const w = (RW - 1.8) / 2, x = sx * (0.9 + w / 2); box(x, RD / 2 + 0.5, w, 1); cols.push({ type: 'box', x, z: RD / 2 + 0.5, hw: w / 2, hd: 0.5, angle: 0 }); }
  box(0, RD / 2 + 0.5, 1.8, 1, RH - 2.7, 2.7 + (RH - 2.7) / 2, LINT);
  // a green-tiled wainscot round the room (1.3 m), one material
  const wT = tileTex('#5e8a72', '#6e9a80', 6); wT.repeat.set(6, 1.3);
  const wM = new MeshStandardMaterial({ map: wT, roughness: 0.45 });
  add(new PlaneGeometry(RD, 1.3).rotateY(Math.PI / 2).translate(-RW / 2 + 0.01, 0.65, 0), wM);
  add(new PlaneGeometry(RD, 1.3).rotateY(-Math.PI / 2).translate(RW / 2 - 0.01, 0.65, 0), wM);
  add(new PlaneGeometry(RW, 1.3).translate(0, 0.65, -RD / 2 + 0.01), wM);
  for (const sx of [-1, 1]) add(new PlaneGeometry((RW - 1.8) / 2, 1.3).rotateY(Math.PI).translate(sx * (0.9 + (RW - 1.8) / 4), 0.65, RD / 2 - 0.01), wM);
  // the doorway: warm light beyond (the Entrance Hall)
  add(new PlaneGeometry(1.8, 2.7).rotateY(Math.PI).translate(0, 1.35, RD / 2 + 0.6), new MeshBasicMaterial({ map: canvasTex(64, 128, (x, w, h) => { const gr = x.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#ffcf8a'); gr.addColorStop(1, '#8a4a1a'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }) }));
  // torches: warm, two per long wall and two flanking the door, plus a little moonlit window on the north wall
  for (const z of [-5.0, 5.0]) { torch(g, -RW / 2 + 0.6, 3.3, z, 0xff9a3a, { shared: true, glowBall: false }); const t = torch(g, RW / 2 - 0.6, 3.3, z, 0xff9a3a, { shared: true, glowBall: false }); t.rotation.y = Math.PI; }
  for (const sx of [-1, 1]) { const t = torch(g, sx * 1.6, 3.1, RD / 2 - 0.6, 0xff9a3a, { shared: true, glowBall: false }); t.rotation.y = -Math.PI / 2; }
  { const t = torch(g, -1.6, 3.3, -RD / 2 + 0.6, 0xff9a3a, { shared: true, glowBall: false }); t.rotation.y = Math.PI / 2; const u = torch(g, 1.6, 3.3, -RD / 2 + 0.6, 0xff9a3a, { shared: true, glowBall: false }); u.rotation.y = Math.PI / 2; }
  const win = add(new PlaneGeometry(1.0, 1.8).translate(0, 3.2, -RD / 2 + 0.02), new MeshBasicMaterial({ map: canvasTex(64, 128, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a5a9a'); gr.addColorStop(1, '#8aa8d8'); x.fillStyle = gr; x.beginPath(); x.moveTo(0, h); x.lineTo(0, 32); x.arc(32, 32, 32, Math.PI, 0); x.lineTo(64, h); x.fill(); x.fillStyle = '#fff6d0'; x.beginPath(); x.arc(42, 40, 9, 0, 7); x.fill(); x.fillStyle = '#2a2420'; x.fillRect(30, 0, 4, h); x.fillRect(0, 76, 64, 4); }), transparent: true }));
  win.name = 'moon-window';
  for (const [x, z, r, a] of [[0, 3, 4.2, 0.24], [0, -2.5, 4.2, 0.24], [-3.2, 0, 3.4, 0.18], [3.0, -1.9, 3.0, 0.16]]) { const o = new Object3D(); o.position.set(x, 0.1, z); o.userData.light = { k: 'glow', c: 0xffd8a0, r, a }; g.add(o); }

  // ---- the sinks: five porcelain basins on pedestals, copper taps, one long mirror ----
  const SK = [];
  for (const z of SINK_Z) {
    SK.push(paint(new LatheGeometry([[0.0, 0.66], [0.2, 0.68], [0.32, 0.78], [0.36, 0.92], [0.33, 0.94], [0.28, 0.84], [0.0, 0.8]].map(([r, y]) => new Vector2(r, y)), 14).translate(SINK_X + 0.05, 0, z), 0xd8d2c4));
    SK.push(paint(place(new CylinderGeometry(0.09, 0.14, 0.68, 10), SINK_X + 0.05, 0.34, z), 0xc8c0b0));
    SK.push(paint(place(new CylinderGeometry(0.03, 0.03, 0.3, 6), SINK_X - 0.33, 1.06, z), 0xb87a3a));               // tap pipe
    SK.push(paint(place(new CylinderGeometry(0.025, 0.025, 0.24, 6), SINK_X - 0.22, 1.2, z, 0, 0, Math.PI / 2), 0xb87a3a));   // spout
    SK.push(paint(place(new TorusGeometry(0.06, 0.015, 4, 8), SINK_X - 0.33, 1.24, z, Math.PI / 2, 0, 0), 0xc88a40));   // handle wheel
  }
  const sinks = add(merge(SK), vc({ roughness: 0.25, metalness: 0.1 })); sinks.name = 'sinks';
  cols.push({ type: 'box', x: SINK_X, z: 0, hw: 0.45, hd: 4.0, angle: 0 });
  const mirT = canvasTex(256, 64, (x, w, h) => { const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#9aa8a8'); gr.addColorStop(0.45, '#c8d0cc'); gr.addColorStop(0.55, '#e0e4dc'); gr.addColorStop(1, '#8a9898'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,240,210,.25)'; for (let k = 0; k < 5; k++) x.fillRect(20 + k * 52, 0, 10, h); });
  const mirror = add(new PlaneGeometry(8.0, 1.1).rotateY(Math.PI / 2).translate(-RW / 2 + 0.04, 1.95, 0), new MeshBasicMaterial({ map: mirT, color: 0xc8c8c0 })); mirror.name = 'mirror';
  const frame = [place(new BoxGeometry(0.08, 0.12, 8.2), -RW / 2 + 0.05, 2.56, 0), place(new BoxGeometry(0.08, 0.12, 8.2), -RW / 2 + 0.05, 1.34, 0), place(new BoxGeometry(0.08, 1.3, 0.1), -RW / 2 + 0.05, 1.95, -4.05), place(new BoxGeometry(0.08, 1.3, 0.1), -RW / 2 + 0.05, 1.95, 4.05)];
  add(merge(frame), MAT.gold).name = 'mirror-frame';

  // ---- three wooden stalls on the east wall: partitions + fascia (static), doors on hinges (live) ----
  const SW = 1.65, SD = 1.6, ST = [];
  for (let i = 0; i <= 3; i++) { const z = STALL_Z[0] - SW / 2 + i * SW; ST.push(place(new BoxGeometry(SD, 2.1, 0.07), STALL_X + SD / 2, 1.2, z)); }
  ST.push(place(new BoxGeometry(0.08, 0.35, SW * 3 + 0.1), STALL_X, 2.12, STALL_Z[1]));          // the top rail over the doors
  for (let i = 0; i <= 3; i++) ST.push(place(new BoxGeometry(0.1, 2.3, 0.1), STALL_X, 1.15, STALL_Z[0] - SW / 2 + i * SW));   // posts
  add(merge(ST), woodMat(1, 1, 0x7a5232)).name = 'stalls';
  cols.push({ type: 'box', x: STALL_X + SD / 2, z: STALL_Z[1], hw: SD / 2 + 0.05, hd: SW * 1.5 + 0.05, angle: 0 });
  // a mop in one stall, a bucket in another (the wrong ones at levels 2-3)
  const mop = add(merge([paint(place(new CylinderGeometry(0.025, 0.025, 1.5, 6), 0, 0.85, 0, 0, 0, 0.18), 0x9a7a50), paint(place(new ConeGeometry(0.2, 0.35, 10, 1, true), -0.13, 0.12, 0, Math.PI, 0, 0.18), 0xd8d0c0)]), vc());
  mop.name = 'mop'; mop.visible = false;
  const bucket = add(merge([paint(new LatheGeometry([[0, 0], [0.18, 0], [0.24, 0.42], [0.22, 0.42], [0.16, 0.03], [0, 0.03]].map(([r, y]) => new Vector2(r, y)), 12), 0x8a8e96), paint(place(new TorusGeometry(0.2, 0.012, 4, 12, Math.PI), 0, 0.42, 0), 0x5a5e66)]), vc({ metalness: 0.4, roughness: 0.4 }));
  bucket.name = 'bucket'; bucket.visible = false;
  const doorGeo = merge([paint(place(new BoxGeometry(0.06, 1.75, SW - 0.16), 0, 0, (SW - 0.16) / 2), 0x8a5e3a), ...[-0.5, 0.5].map(y => paint(place(new BoxGeometry(0.075, 0.1, SW - 0.2), 0, y, (SW - 0.16) / 2), 0x6a4426)),
    paint(place(new BoxGeometry(0.1, 0.1, 0.06), -0.04, 0.05, SW - 0.3), 0xd8a840)]);
  const doorMat = vc({ roughness: 0.7 });
  const doors = STALL_Z.map((z, i) => { const h = new Group(); h.position.set(STALL_X, 1.12, z - (SW - 0.16) / 2); g.add(h); const d = new Mesh(doorGeo, doorMat); d.name = 'stall-door-' + i; h.add(d); return h; });

  // static merge (walls, wainscot, torches' sticks, sinks, stalls, frame)
  mergeStatic(g, g.children.filter(c => !doors.includes(c) && c !== mop && c !== bucket));

  // ---- Hermione's stand-in (a chibi; adventure-troll.js swaps in the rigged model when it is cached) ----
  const herm = buildChibi({ robe: 0x1a1414, trim: 0x7a1020, house: 0x7a1020, hair: 0x7a4a26 });
  herm.name = 'adv-hermione'; herm.scale.setScalar(1.15); herm.visible = false; g.add(noRay(herm));
  // level 1: a little speech bubble over Hermione's stall ("הלו?")
  const bub = new Mesh(new PlaneGeometry(1.1, 0.75), new MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(192, 128, (x) => {
    x.fillStyle = '#fff8e4'; x.strokeStyle = '#b8862e'; x.lineWidth = 6; x.beginPath(); x.roundRect(6, 6, 180, 92, 26); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(70, 96); x.lineTo(96, 124); x.lineTo(110, 96); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#fff8e4'; x.fillRect(72, 90, 36, 8);
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#5a2a10'; x.font = 'bold 40px ' + FONT; x.fillText('הלו? 👧', 96, 54); }) }));
  bub.name = 'herm-bubble'; bub.visible = false; bub.renderOrder = 5; bub.raycast = () => {}; g.add(bub);
  // the troll
  const T = buildTroll(); T.root.position.set(TROLL_AT.x, 0, TROLL_AT.z); T.root.rotation.y = Math.PI / 2; g.add(T.root);
  cols.push({ type: 'circle', x: TROLL_AT.x, z: TROLL_AT.z, r: 1.25 });
  if (progress >= 3) T.root.rotation.y = -Math.PI / 2;
  const light = bakeLight(g, cols);
  return { g, cols, P: { troll: T, doors, mop, bucket, herm, sinks, bub }, light };
}

// ---------------- the Entrance Hall door "שירותי הבנות" (added to the live hall while the quest runs) ----------------
export function buildHallDoor() {
  const g = new Group(); g.name = 'adv-bath-door';
  const D = HALL_DOOR, z = D.z;
  for (const sx of [-1, 1]) { const j = new Mesh(new BoxGeometry(0.3, 2.7, 0.3), MAT.stone); j.position.set(D.x + sx * 0.95, 1.35, z - 0.12); g.add(j); }
  const arch = new Mesh(new TorusGeometry(0.95, 0.15, 6, 16, Math.PI), MAT.stone); arch.position.set(D.x, 2.7, z - 0.12); g.add(arch);
  const c = document.createElement('canvas'); c.width = 256; c.height = 384; const x = c.getContext('2d');
  // the oak door with planks + a warm crack of light, and a painted sign
  x.fillStyle = '#6a4426'; x.fillRect(0, 0, 256, 384);
  for (let k = 0; k < 5; k++) { x.fillStyle = k % 2 ? '#7a5030' : '#70482a'; x.fillRect(k * 51 + 2, 0, 47, 384); }
  x.fillStyle = '#2e2b30'; x.fillRect(0, 70, 256, 14); x.fillRect(0, 300, 256, 14);
  x.fillStyle = '#d8a840'; x.beginPath(); x.arc(200, 210, 11, 0, 7); x.fill();
  x.fillStyle = '#f4e4bc'; x.beginPath(); x.roundRect(28, 110, 200, 104, 14); x.fill(); x.strokeStyle = '#b8862e'; x.lineWidth = 6; x.stroke();
  x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#5a2a10'; x.font = 'bold 34px ' + FONT; x.fillText('שירותי', 128, 140); x.fillText('הבנות', 128, 182);
  x.font = '44px serif'; x.fillText('🚰', 128, 262);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  const m = new Mesh(new PlaneGeometry(1.7, 3.3).rotateY(Math.PI).translate(D.x, 1.65 + 0.02, z - 0.27), new MeshStandardMaterial({ map: t, roughness: 0.8 })); m.name = 'bath-door-leaf'; g.add(m);
  noRay(g);
  return g;
}

// ---------------- the muddy footprints (one merged mesh of decals) ----------------
let _printTex = null;
function printTex() {
  if (_printTex) return _printTex;
  _printTex = canvasTex(128, 128, (x) => {
    x.fillStyle = 'rgba(70,46,26,0.88)';
    x.beginPath(); x.ellipse(64, 80, 30, 40, 0, 0, 7); x.fill();
    for (const [tx, ty, r] of [[34, 30, 12], [64, 20, 14], [94, 30, 12]]) { x.beginPath(); x.arc(tx, ty, r, 0, 7); x.fill(); }
    x.fillStyle = 'rgba(40,26,14,0.55)'; x.beginPath(); x.ellipse(64, 84, 18, 26, 0, 0, 7); x.fill();
  });
  return _printTex;
}
export function buildFootprints(path, stride = 1.15) {
  const quads = [];
  let k = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, z0] = path[i], [x1, z1] = path[i + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / stride)), ang = Math.atan2(x1 - x0, z1 - z0);
    const px = Math.cos(ang), pz = -Math.sin(ang);
    for (let s = 0; s < n; s++, k++) {
      const u = s / n, side = k % 2 ? 1 : -1, x = x0 + (x1 - x0) * u + px * side * 0.32, z = z0 + (z1 - z0) * u + pz * side * 0.32;
      quads.push(place(new PlaneGeometry(0.62, 0.78).rotateX(-Math.PI / 2), x, 0.02 + (k % 3) * 0.001, z, 0, ang + Math.PI + side * 0.12, 0));
    }
  }
  const mesh = new Mesh(merge(quads), new MeshStandardMaterial({ map: printTex(), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.name = 'adv-footprints'; mesh.renderOrder = 2; mesh.raycast = () => {};
  return mesh;
}

// ---------------- feast pumpkins (carved, glowing faces; one instanced mesh) ----------------
export function buildPumpkins(n = 6) {
  const geo = new SphereGeometry(0.42, 18, 10), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = 1 + 0.07 * Math.cos(a * 8); p.setXYZ(i, x * r, y * 0.8, z * r); }
  geo.computeVertexNormals();
  const draw = (emis) => (x, w, h) => {
    x.fillStyle = emis ? '#000' : '#e07a1a'; x.fillRect(0, 0, w, h);
    if (!emis) for (let k = 0; k < 16; k++) { x.fillStyle = k % 2 ? 'rgba(150,60,0,.25)' : 'rgba(255,190,90,.15)'; x.fillRect(k * w / 16, 0, w / 32, h); }
    x.fillStyle = emis ? '#ffc040' : '#3a1800';
    const cx = w * 0.25, cy = h * 0.5;   // the face looks toward +z (u = 0.25)
    for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(cx + sx * 22, cy - 22); x.lineTo(cx + sx * 34, cy - 6); x.lineTo(cx + sx * 10, cy - 6); x.fill(); }
    x.beginPath(); x.moveTo(cx - 38, cy + 6); x.quadraticCurveTo(cx, cy + 40, cx + 38, cy + 6); x.lineTo(cx + 26, cy + 14); x.lineTo(cx + 14, cy + 8); x.lineTo(cx, cy + 18); x.lineTo(cx - 14, cy + 8); x.lineTo(cx - 26, cy + 14); x.fill();
  };
  const map = canvasTex(256, 128, draw(false)), em = canvasTex(256, 128, draw(true));
  const mesh = new InstancedMesh(geo, new MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.6 }), n);
  mesh.frustumCulled = false; mesh.name = 'adv-pumpkins'; mesh.raycast = () => {};
  const stem = new InstancedMesh(new CylinderGeometry(0.04, 0.06, 0.16, 6), new MeshStandardMaterial({ color: 0x4a6a2a, roughness: 0.9 }), n);
  stem.frustumCulled = false; stem.raycast = () => {}; stem.name = 'adv-pumpkin-stems';
  return { mesh, stem, n };
}
export { FONT };
