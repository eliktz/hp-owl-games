// Secret rooms behind real locked doors (HD, "spells in the real castle", batch 6). A child asked
// for it: the wheel's Alohomora opens REAL locked doors in the castle, with a small reward room
// behind each. Built like the shower hall (showers.js):
//   secretDoor(g, id)      the locked oak door + padlock + sign in its host room (frame merges with the
//                          host's stone; the moving leaf + glow are 2 draw calls) and its portal
//   secretRoom(room, id)   the room itself (one tiled shell, props, glow, chest: <= 10 draw calls)
//   createSecretRooms(...) the controller: door unlocks (Alohomora targets), the locked bubble, the
//                          reward chest (Alohomora or a tap), the chocolate frog, the card overlay, the snitch
// Doors stay open for the session (memory only). Cards are saved in localStorage 'hpCards1' (ids);
// the chest pays +10 house points once per session, the card once ever (the frog always hops).
import {
  Group, Mesh, Object3D, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, CircleGeometry, TorusGeometry, ConeGeometry,
  BufferGeometry, Float32BufferAttribute, Vector3, Color, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from './interior-kit.js';
import * as fun from './fun.js';

const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew','Heebo',Arial,sans-serif";
const KEY = 'hpCards1';
// Doors: x, z = the host room's inner wall face (room-local), n = the wall's normal into the host room.
export const SPECS = {
  broomcupboard: { host: 'entrancehall', door: { x: 7.5, z: 4.8, nx: -1, nz: 0 }, sign: -1, name: 'אֲרוֹן הַמַּטְאֲטֵאִים', icon: '🧹', card: 'dumbledore', W: 4.4, D: 5.2, H: 3.0 },
  trophyroom: { host: 'staircase', door: { x: 6.6, z: -10.5, nx: 0, nz: 1 }, sign: -1, name: 'חֲדַר הַגְּבִיעִים', icon: '🏆', card: 'merlin', W: 6, D: 5, H: 3.6 },
  forgottenclass: { host: 'classrooms', door: { x: -9, z: 8.5, nx: 0, nz: -1 }, sign: -1, name: 'הַכִּתָּה הַנִּשְׁכַּחַת', icon: '📚', card: 'hedwig', W: 6, D: 6, H: 4.0 },
};
export const CARDS = {
  dumbledore: { name: 'דַּמְבְּלְדוֹר', emoji: '🧙‍♂️', col: '#5a2e9a', col2: '#9a6ad8' },
  merlin: { name: 'מֶרְלִין', emoji: '🔮', col: '#1d4f96', col2: '#5a9ae0' },
  hedwig: { name: 'הֶדְוִיג', emoji: '🦉', col: '#22685a', col2: '#6ac0a0' },
};
export const IDS = Object.keys(SPECS);
export const LABELS = Object.fromEntries(IDS.map(id => [id, SPECS[id].name]));
// session state (module level: rooms are rebuilt on every visit and read it at build time)
const DOORS = Object.fromEntries(IDS.map(id => [id, { state: 'locked', t: 0, opens: 0, shown: false, bubbles: 0 }]));
const CHESTS = Object.fromEntries(IDS.map(id => [id, { state: 'locked', t: 0, opens: 0, paid: 0, cardGiven: false, frogs: 0 }]));

const box = (w, h, d, x, y, z) => new BoxGeometry(w, h, d).translate(x, y, z);
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const doorYaw = (s) => Math.atan2(s.door.nx, s.door.nz);
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c) { const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t; }
// map a geometry's 0..1 uvs into a region [x, y, w, h] of a S px canvas
function uvTo(geo, [rx, ry, rw, rh], S = 256) {
  const u = geo.attributes.uv;
  for (let i = 0; i < u.count; i++) u.setXY(i, (rx + u.getX(i) * rw) / S, 1 - (ry + (1 - u.getY(i)) * rh) / S);
  return geo;
}
const flat = (g) => { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.uv) n.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
function rtlText(x, s, cx, cy, size, col, maxW, shadow = true) {
  x.save(); x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${size}px ${FONT}`;
  const m = x.measureText(s).width; if (m > maxW) { x.translate(cx, cy); x.scale(maxW / m, 1); x.translate(-cx, -cy); }
  if (shadow) { x.fillStyle = 'rgba(0,0,0,.4)'; x.fillText(s, cx + 2, cy + 2); }
  x.fillStyle = col; x.fillText(s, cx, cy); x.restore();
}
function emoji(x, e, cx, cy, size) { x.save(); x.font = `${size}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, cx, cy); x.restore(); }

// ============================== the door (host room) ==============================
// One 256 px canvas pair per door: colour map + emissive map, same layout.
// leaf [0,0,128,256] oak planks + iron straps | interior [128,0,64,128] warm room glow | keyhole [192,0,64,64]
// brass [192,64,64,64] | sign [128,128,128,128] dark plate, 🔒 + the room's name
const DR = { leaf: [0, 0, 64, 256], inside: [64, 0, 64, 128], key: [128, 0, 64, 64], brass: [192, 0, 64, 64], sign: [64, 128, 192, 128] };
const _doorMat = {};
function doorMat(id) {
  if (_doorMat[id]) return _doorMat[id];
  const s = SPECS[id], C = canvas(256, 256), E = canvas(256, 256), x = C.getContext('2d'), e = E.getContext('2d');
  let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256); e.fillStyle = '#000'; e.fillRect(0, 0, 256, 256);
  // leaf: five oak planks, grain, two iron straps with rivets
  for (let k = 0; k < 5; k++) {
    const v = (r() - 0.5) * 16; x.fillStyle = `rgb(${110 + v | 0},${70 + v | 0},${40 + v * 0.6 | 0})`; x.fillRect(k * 12.8 + 0.5, 0, 12, 256);
    for (let j = 0; j < 7; j++) { x.strokeStyle = `rgba(50,28,12,${0.15 + r() * 0.25})`; x.lineWidth = 1; x.beginPath(); const gx = k * 12.8 + 2 + r() * 9; x.moveTo(gx, 0); x.bezierCurveTo(gx + 2, 80, gx - 2, 170, gx + 1, 256); x.stroke(); }
  }
  for (const y of [40, 200]) { x.fillStyle = '#2a2622'; x.fillRect(0, y, 64, 14); for (let k = 0; k < 4; k++) { x.fillStyle = '#5a544c'; x.beginPath(); x.arc(8 + k * 16, y + 7, 2.2, 0, 7); x.fill(); } }
  // interior: a warm lit room glimpsed through the doorway (emissive), a shelf silhouette
  { const [ix, iy, iw, ih] = DR.inside, g = e.createRadialGradient(ix + iw / 2, iy + ih * 0.7, 4, ix + iw / 2, iy + ih * 0.6, ih * 0.75);
    g.addColorStop(0, '#ffd890'); g.addColorStop(0.45, '#e88c3a'); g.addColorStop(1, '#4a1e08'); e.fillStyle = g; e.fillRect(ix, iy, iw, ih);
    e.fillStyle = 'rgba(60,28,8,.7)'; e.fillRect(ix + 6, iy + 40, iw - 12, 4); e.fillRect(ix + 6, iy + 70, iw - 12, 4); e.fillRect(ix + 4, iy + 118, iw - 8, 10);
    emoji(e, s.icon, ix + iw / 2, iy + 100, 20); x.fillStyle = '#100804'; x.fillRect(ix, iy, iw, ih); }
  // keyhole: a soft gold glow round a black keyhole
  { const [kx, ky] = DR.key, g = e.createRadialGradient(kx + 32, ky + 32, 2, kx + 32, ky + 32, 30); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, '#ffc040'); g.addColorStop(1, 'rgba(120,60,0,0)');
    e.fillStyle = g; e.fillRect(kx, ky, 64, 64); x.fillStyle = '#b88a30'; x.fillRect(kx, ky, 64, 64);
    for (const c of [x, e]) { c.fillStyle = c === x ? '#1a1008' : '#ffe9a0'; c.beginPath(); c.arc(kx + 32, ky + 26, 8, 0, 7); c.fill(); c.beginPath(); c.moveTo(kx + 27, ky + 28); c.lineTo(kx + 37, ky + 28); c.lineTo(kx + 40, ky + 48); c.lineTo(kx + 24, ky + 48); c.closePath(); c.fill(); } }
  // brass
  { const [bx, by] = DR.brass, g = x.createLinearGradient(bx, by, bx + 64, by + 64); g.addColorStop(0, '#f4d27a'); g.addColorStop(0.5, '#c8962a'); g.addColorStop(1, '#8a6018'); x.fillStyle = g; x.fillRect(bx, by, 64, 64); }
  // the sign: dark oak plate, gold border, 🔒 and the name (emissive at half: readable in the torchlight)
  { const [sx, sy, sw, sh] = DR.sign;
    for (const c of [x, e]) {
      c.fillStyle = '#c9a046'; c.beginPath(); c.roundRect(sx + 3, sy + 3, sw - 6, sh - 6, 14); c.fill();
      c.fillStyle = '#3a2414'; c.beginPath(); c.roundRect(sx + 9, sy + 9, sw - 18, sh - 18, 10); c.fill();
      emoji(c, '🔒', sx + sw / 2, sy + 40, 40);
      rtlText(c, s.name, sx + sw / 2, sy + 92, 30, '#ffe9a8', sw - 24);
    }
    e.fillStyle = 'rgba(0,0,0,.45)'; e.fillRect(sx, sy, sw, sh); }
  const m = new MeshStandardMaterial({ map: tex(C), emissiveMap: tex(E), emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.7, metalness: 0.05 });
  m.name = 'secret-door-' + id;
  return (_doorMat[id] = m);
}

// The padlock (big, brass, glowing keyhole), in leaf-local coordinates (face at z 0.1).
function padlockGeos(px, py, pz) {
  const G = [];
  G.push(uvTo(new BoxGeometry(0.42, 0.36, 0.1), DR.brass).translate(px, py, pz));
  const sh = uvTo(new TorusGeometry(0.14, 0.035, 8, 16, Math.PI), DR.brass); sh.translate(px, py + 0.18, pz); G.push(sh);
  G.push(uvTo(new PlaneGeometry(0.22, 0.22), DR.key).translate(px, py - 0.01, pz + 0.052));
  return G;
}

export function secretDoor(g, id) {
  const s = SPECS[id], D = s.door, yaw = doorYaw(s), st = DOORS[id];
  if (st.state === 'opening') st.state = 'open';
  const open = st.state === 'open';
  // a local frame: x along the wall, y up, z out of the wall into the host room
  const put = (geo) => geo.rotateY(yaw).translate(D.x, 0, D.z);
  const add = (geo, mat) => { const m = new Mesh(put(geo), mat); g.add(m); return m; };
  // static frame (merges with the host room's stone / gold): jambs, arch, a threshold step, the sign's brass backing
  for (const sx of [-1, 1]) add(box(0.26, 2.4, 0.26, sx * 0.88, 1.2, 0.12), MAT.stone);
  add(new TorusGeometry(0.88, 0.13, 6, 18, Math.PI).translate(0, 2.4, 0.12), MAT.stone);
  add(box(1.9, 0.08, 0.5, 0, 0.04, 0.25), MAT.stone);
  add(box(1.26, 0.86, 0.03, s.sign * 1.75, 1.75, 0.015), MAT.gold);
  // live: the glow mesh (interior + fanlight + sign) and the leaf (planks + straps + padlock), one material
  const live = new Group(); live.name = 'secret-door-' + id;
  const mat = doorMat(id), GL = [];
  GL.push(uvTo(new PlaneGeometry(1.5, 2.4), DR.inside).translate(0, 1.2, 0.01));
  GL.push(uvTo(new CircleGeometry(0.75, 18, 0, Math.PI), DR.inside).translate(0, 2.4, 0.01));
  GL.push(uvTo(new PlaneGeometry(1.17, 0.78), DR.sign).translate(s.sign * 1.75, 1.75, 0.034));
  const glow = new Mesh(put(mergeGeometries(GL.map(flat), false)), mat); glow.name = 'secret-door-glow'; live.add(glow);
  const pivot = new Group(); pivot.position.set(D.x, 0, D.z); pivot.rotation.y = yaw; live.add(pivot);
  const hinge = new Group(); hinge.position.set(0.75, 0, 0.05); pivot.add(hinge);
  const LP = [uvTo(new BoxGeometry(1.5, 2.4, 0.08), DR.leaf).translate(-0.75, 1.2, 0)];
  const fan = new CircleGeometry(0.74, 18, 0, Math.PI); uvTo(fan, DR.leaf); LP.push(fan.translate(-0.75, 2.4, 0.0));
  LP.push(uvTo(new TorusGeometry(0.07, 0.015, 6, 12), DR.brass).translate(-1.25, 1.0, 0.06));
  const nBase = LP.reduce((a, q) => a + flat(q).attributes.position.count, 0);
  const pad = open ? [] : padlockGeos(-1.2, 1.2, 0.09);
  const geo = mergeGeometries([...LP, ...pad].map(flat), false);
  const leaf = new Mesh(geo, mat); leaf.name = 'secret-door-leaf'; hinge.add(leaf);
  hinge.rotation.y = open ? 1.75 : 0;
  // the flying padlock (shown only while it pops off: 1 extra call for under a second)
  const fly = new Mesh(mergeGeometries(padlockGeos(0, 0, 0).map(flat), false), mat); fly.visible = false; fly.name = 'secret-door-padlock'; live.add(fly);
  const glowSpot = new Object3D(); glowSpot.position.set(D.x + D.nx * 1.2, 0.5, D.z + D.nz * 1.2); glowSpot.userData.light = { k: 'glow', c: 0xffd8a0, r: 1.6, a: open ? 0.22 : 0.1 }; g.add(glowSpot);
  g.userData.secretDoor = { id, live, hinge, leaf, fly, padStart: nBase, padCount: open ? 0 : geo.attributes.position.count - nBase };
  return { live, portal: { x: D.x + D.nx * 0.85, z: D.z + D.nz * 0.85, r: 1.0, to: id, locked: () => DOORS[id].state !== 'open', at: { x: 0, z: s.D / 2 - 2.4, yaw: Math.PI } } };
}

// ============================== the rooms ==============================
// shared 256 px atlas for every shell: stone blocks [0,0], oak boards [128,0], flagstones [0,128], ceiling boards [128,128]
const AT = { stone: [0, 0, 128, 128], planks: [128, 0, 128, 128], flags: [0, 128, 128, 128], boards: [128, 128, 128, 128] };
let _shellMat = null;
function shellMat() {
  if (_shellMat) return _shellMat;
  const C = canvas(256, 256), x = C.getContext('2d');
  let seed = 3; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const speck = (rx, ry, n, a) => { for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '60,45,30' : '255,245,225'},${r() * a})`; x.fillRect(rx + r() * 128, ry + r() * 128, 2, 2); } };
  // stone blocks: 4 courses, offset joints
  x.fillStyle = '#6e6250'; x.fillRect(0, 0, 128, 128);
  for (let j = 0; j < 4; j++) for (let i = -1; i < 3; i++) { const v = (r() - 0.5) * 26, b = 178 + v; x.fillStyle = `rgb(${b | 0},${b - 12 | 0},${b - 30 | 0})`; x.fillRect(i * 64 + (j % 2) * 32 + 2, j * 32 + 2, 60, 28); }
  speck(0, 0, 700, 0.18);
  // oak boards: 4 boards with grain
  for (let k = 0; k < 4; k++) { const v = (r() - 0.5) * 18; x.fillStyle = `rgb(${120 + v | 0},${80 + v | 0},${48 + v * 0.6 | 0})`; x.fillRect(128, k * 32, 128, 31); x.fillStyle = '#3a2412'; x.fillRect(128, k * 32 + 31, 128, 1);
    for (let j = 0; j < 10; j++) { x.strokeStyle = `rgba(60,34,16,${0.12 + r() * 0.2})`; x.beginPath(); const gy = k * 32 + 3 + r() * 26; x.moveTo(128, gy); x.bezierCurveTo(170, gy + 3, 210, gy - 3, 256, gy + 1); x.stroke(); }
    x.fillStyle = '#2a1a0c'; x.fillRect(128 + ((k * 53) % 100) + 10, k * 32 + 14, 3, 3); }
  // flagstones: 2x2 big flags
  x.fillStyle = '#5a5248'; x.fillRect(0, 128, 128, 128);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const v = (r() - 0.5) * 20, b = 150 + v; x.fillStyle = `rgb(${b | 0},${b - 6 | 0},${b - 16 | 0})`; x.fillRect(i * 64 + 2, 128 + j * 64 + 2, 60, 60); }
  speck(0, 128, 500, 0.16);
  // ceiling boards (dark)
  for (let k = 0; k < 4; k++) { const v = (r() - 0.5) * 10; x.fillStyle = `rgb(${70 + v | 0},${48 + v | 0},${30 | 0})`; x.fillRect(128, 128 + k * 32, 128, 31); x.fillStyle = '#1a1008'; x.fillRect(128, 128 + k * 32 + 31, 128, 1); }
  _shellMat = new MeshStandardMaterial({ map: tex(C), vertexColors: true, roughness: 0.85 }); _shellMat.name = 'secret-shell';
  return _shellMat;
}
// a tiled surface: cells of `tile` metres, each cell samples the whole atlas region; vertex colour = tint * shade(y)
function tiled(P, region, uLen, vLen, tile, at, normal, tint, shade) {
  const [rx, ry, rw, rh] = region, c = new Color(tint);
  for (let u0 = 0; u0 < uLen - 1e-4; u0 += tile) for (let v0 = 0; v0 < vLen - 1e-4; v0 += tile) {
    const u1 = Math.min(uLen, u0 + tile), v1 = Math.min(vLen, v0 + tile);
    const q = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
    for (const [u, v] of q) {
      const p = at(u, v); P.pos.push(p[0], p[1], p[2]); P.nor.push(normal[0], normal[1], normal[2]);
      const fu = (u - u0) / tile, fv = (v - v0) / tile;
      P.uv.push((rx + fu * rw) / 256, 1 - (ry + (1 - fv) * rh) / 256);
      const k = shade(p[1]); P.col.push(c.r * k, c.g * k, c.b * k);
    }
  }
}
function shellMesh(W, D, H, { wall = AT.stone, floorR = AT.planks, wallTint = 0xffffff, floorTint = 0xffffff, ceilTint = 0xffffff } = {}) {
  const P = { pos: [], nor: [], uv: [], col: [] };
  const sh = (y) => Math.min(1, 0.62 + y * 0.5) * (1 - 0.35 * Math.max(0, (y - (H - 0.9)) / 0.9));
  const X = W / 2, Z = D / 2;
  tiled(P, wall, W, H, 1.5, (u, v) => [-X + u, v, -Z], [0, 0, 1], wallTint, sh);        // north
  tiled(P, wall, W, H, 1.5, (u, v) => [X - u, v, Z], [0, 0, -1], wallTint, sh);         // south
  tiled(P, wall, D, H, 1.5, (u, v) => [-X, v, Z - u], [1, 0, 0], wallTint, sh);         // west
  tiled(P, wall, D, H, 1.5, (u, v) => [X, v, -Z + u], [-1, 0, 0], wallTint, sh);        // east
  const fsh = (x, z) => 1 - 0.3 * Math.max(0, 1 - Math.min(X - Math.abs(x), Z - Math.abs(z)) / 0.7);
  const P2 = { pos: [], nor: [], uv: [], col: [] };
  tiled(P2, floorR, W, D, 1.2, (u, v) => [-X + u, 0, Z - v], [0, 1, 0], floorTint, () => 1);
  for (let i = 0; i < P2.col.length; i += 3) { const k = fsh(P2.pos[i], P2.pos[i + 2]); P2.col[i] *= k; P2.col[i + 1] *= k; P2.col[i + 2] *= k; }
  tiled(P2, AT.boards, W, D, 1.2, (u, v) => [-X + u, H, -Z + v], [0, -1, 0], ceilTint, () => 0.8);
  for (const k of ['pos', 'nor', 'uv', 'col']) P[k].push(...P2[k]);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(P.pos, 3)); geo.setAttribute('normal', new Float32BufferAttribute(P.nor, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(P.uv, 2)); geo.setAttribute('color', new Float32BufferAttribute(P.col, 3));
  const m = new Mesh(geo, shellMat()); m.name = 'secret-shell'; m.receiveShadow = true; return m;
}

// shared emissive atlas for the rooms (256 px): lamp [0,0,64,64], moon window [64,0,64,128], blackboard [128,0,128,64],
// fanlight [0,64,64,64], cup plaque [128,64,128,64], frog card back [0,128,64,64]
const GR = { lamp: [0, 0, 64, 64], moon: [64, 0, 64, 128], board: [128, 0, 128, 64], fan: [0, 64, 64, 64], plaque: [128, 64, 128, 64] };
let _glowMat = null;
function glowMat() {
  if (_glowMat) return _glowMat;
  const C = canvas(256, 256), x = C.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  { const g = x.createRadialGradient(32, 32, 2, 32, 32, 34); g.addColorStop(0, '#fff6dc'); g.addColorStop(0.7, '#ffc070'); g.addColorStop(1, '#a05010'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
  // a tall leaded window full of moonlight, a round moon in the top panes
  { const [mx, my, mw, mh] = GR.moon, g = x.createLinearGradient(0, my, 0, my + mh); g.addColorStop(0, '#9ab8f0'); g.addColorStop(1, '#3a5aa0'); x.fillStyle = g; x.fillRect(mx, my, mw, mh);
    x.fillStyle = '#fffbe8'; x.beginPath(); x.arc(mx + 40, my + 26, 11, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.7)'; for (const [sx, sy] of [[12, 14], [22, 50], [50, 62], [14, 84], [44, 100]]) x.fillRect(mx + sx, my + sy, 2, 2);
    x.strokeStyle = '#1a1a24'; x.lineWidth = 3; for (let k = 1; k < 3; k++) { x.beginPath(); x.moveTo(mx + k * mw / 3, my); x.lineTo(mx + k * mw / 3, my + mh); x.stroke(); }
    for (let k = 1; k < 6; k++) { x.beginPath(); x.moveTo(mx, my + k * mh / 6); x.lineTo(mx + mw, my + k * mh / 6); x.stroke(); } x.lineWidth = 5; x.strokeRect(mx + 1, my + 1, mw - 2, mh - 2); }
  // the blackboard with chalk stars (dim: it is chalk, not a lamp)
  { const [bx, by, bw, bh] = GR.board; x.fillStyle = '#16241c'; x.fillRect(bx, by, bw, bh); x.fillStyle = 'rgba(200,210,200,.08)'; for (let k = 0; k < 40; k++) x.fillRect(bx + Math.random() * bw, by + Math.random() * bh, 6, 2);
    const star = (cx, cy, r) => { x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.stroke(); };
    x.strokeStyle = '#d8dcc8'; x.lineWidth = 2; for (const [sx, sy, sr] of [[20, 18, 10], [52, 40, 7], [86, 16, 12], [120, 44, 9], [160, 20, 11], [196, 42, 8], [230, 18, 10], [104, 32, 4], [178, 50, 4]]) star(bx + sx, by + sy, sr);
    x.beginPath(); x.arc(bx + 140, by + 30, 9, 0.6, 5.2); x.stroke(); }
  { const [fx, fy] = GR.fan, g = x.createLinearGradient(0, fy, 0, fy + 64); g.addColorStop(0, '#ffe2a8'); g.addColorStop(1, '#c87830'); x.fillStyle = g; x.fillRect(fx, fy, 64, 64); }
  { const [px, py, pw, ph] = GR.plaque; x.fillStyle = '#5a1018'; x.fillRect(px, py, pw, ph); x.strokeStyle = '#e8c060'; x.lineWidth = 4; x.strokeRect(px + 4, py + 4, pw - 8, ph - 8); rtlText(x, 'גְּבִיעַ הַבָּתִּים', px + pw / 2, py + ph / 2 + 2, 24, '#ffe08a', pw - 20); }
  _glowMat = new MeshStandardMaterial({ color: 0x050505, emissive: 0xffffff, emissiveMap: tex(C), emissiveIntensity: 1, roughness: 0.5 }); _glowMat.name = 'secret-glow';
  return _glowMat;
}
// soft decals (cobwebs, a moonbeam): transparent, unlit
let _decalMat = null;
function decalMat() {
  if (_decalMat) return _decalMat;
  const C = canvas(128, 128), x = C.getContext('2d');
  x.clearRect(0, 0, 128, 128);
  // cobweb in [0,0,64,64]: corner at the top-left
  x.strokeStyle = 'rgba(235,235,240,.75)'; x.lineWidth = 1.2;
  for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI / 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 64, Math.sin(a) * 64); x.stroke(); }
  for (let rr = 10; rr < 64; rr += 10) { x.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI / 2, w = rr - (k % 2) * 2; k ? x.lineTo(Math.cos(a) * w, Math.sin(a) * w) : x.moveTo(Math.cos(a) * w, Math.sin(a) * w); } x.stroke(); }
  // moonbeam in [64,0,64,128]: a soft vertical gradient, fading at the sides
  const g = x.createLinearGradient(64, 0, 128, 0); g.addColorStop(0, 'rgba(170,200,255,0)'); g.addColorStop(0.5, 'rgba(190,215,255,.5)'); g.addColorStop(1, 'rgba(170,200,255,0)'); x.fillStyle = g; x.fillRect(64, 0, 64, 128);
  // sparkle in [0,64,64,64]
  { const r = x.createRadialGradient(32, 96, 0, 32, 96, 30); r.addColorStop(0, 'rgba(255,240,180,1)'); r.addColorStop(1, 'rgba(255,220,120,0)'); x.fillStyle = r; x.fillRect(0, 64, 64, 64); }
  const t = tex(C);
  _decalMat = new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: DoubleSide, fog: false }); _decalMat.name = 'secret-decal';
  return _decalMat;
}
function vcMesh(parts, name, opts = {}) {
  const c = new Color();
  const geos = parts.map(([g, hex]) => {
    const n = g.index ? g.toNonIndexed() : g; if (n.attributes.uv) n.deleteAttribute('uv');
    const col = new Float32Array(n.attributes.position.count * 3); c.setHex(hex);
    for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
    n.setAttribute('color', new Float32BufferAttribute(col, 3)); return n;
  });
  const m = new Mesh(mergeGeometries(geos, false), opts.basic ? new MeshBasicMaterial({ vertexColors: true }) : new MeshStandardMaterial({ vertexColors: true, roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0 }));
  m.name = name; return m;
}

// the reward chest: body into the room's props, lid and lock as their own meshes (lid opens, lock pops)
function chest(g, P, cols, x, z, yaw, opened) {
  const grp = new Group(); grp.position.set(x, 0, z); grp.rotation.y = yaw; g.add(grp);
  const B = [];
  B.push([box(0.8, 0.42, 0.5, 0, 0.23, 0), 0x5a3418]);
  for (const dx of [-0.3, 0.3]) B.push([box(0.07, 0.43, 0.51, dx, 0.235, 0), 0xc89a3a]);
  B.push([box(0.62, 0.02, 0.36, 0, 0.44, 0), 0x2a1408]);
  for (const dx of [-0.34, 0.34]) for (const dz of [-0.19, 0.19]) B.push([box(0.08, 0.05, 0.08, dx, 0.025, dz), 0x241408]);
  const body = vcMesh(B, 'secret-chest-body'); grp.add(body);
  const lidPivot = new Group(); lidPivot.position.set(0, 0.44, -0.25); grp.add(lidPivot);
  const L = [[box(0.82, 0.13, 0.52, 0, 0.065, 0.26), 0x6a3e1c]];
  for (const dx of [-0.3, 0.3]) L.push([box(0.075, 0.14, 0.53, dx, 0.07, 0.26), 0xc89a3a]);
  L.push([new CylinderGeometry(0.26, 0.26, 0.8, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.4, 1).translate(0, 0.13, 0.26), 0x7a4a22]);
  const lid = vcMesh(L, 'secret-chest-lid'); lidPivot.add(lid);
  const lock = vcMesh([[box(0.15, 0.16, 0.06, 0, 0, 0), 0xe8c050], [new TorusGeometry(0.05, 0.016, 6, 12, Math.PI).translate(0, 0.08, 0), 0xf0d070], [box(0.03, 0.06, 0.02, 0, -0.01, 0.035), 0x1a1008]], 'secret-chest-lock', { metal: 0.6, rough: 0.35 });
  lock.position.set(0, 0.38, 0.28); grp.add(lock);
  if (opened) { lidPivot.rotation.x = -1.9; lock.visible = false; }
  cols.push({ type: 'circle', x, z, r: 0.55 });
  return { grp, lidPivot, lock, lockRest: lock.position.clone(), x, z, yaw };
}
// a chocolate frog (hops out when the chest opens)
function frogMesh() {
  const B = 0x5a3216, L = 0x7a4a24;
  const m = vcMesh([
    [new SphereGeometry(0.09, 12, 8).scale(1, 0.7, 1.25).translate(0, 0.07, 0), B],
    [new SphereGeometry(0.06, 10, 8).translate(0, 0.11, 0.08), B],
    ...[-1, 1].flatMap(s => [[new SphereGeometry(0.024, 8, 6).translate(s * 0.035, 0.16, 0.1), 0xf0e8d0], [new SphereGeometry(0.012, 6, 4).translate(s * 0.036, 0.165, 0.12), 0x101010],
      [new SphereGeometry(0.04, 8, 6).scale(1, 0.6, 1.6).translate(s * 0.08, 0.03, -0.05), L], [new SphereGeometry(0.025, 6, 4).scale(1, 0.6, 1.4).translate(s * 0.06, 0.02, 0.09), L]]),
  ], 'secret-frog', { rough: 0.35 });
  m.visible = false; return m;
}
const _cardTex = {};
export function cardCanvas(cid) {
  const c = CARDS[cid], C = canvas(300, 420), x = C.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, c.col2); g.addColorStop(1, c.col);
  x.fillStyle = '#c9a046'; x.beginPath(); x.roundRect(0, 0, 300, 420, 26); x.fill();
  x.fillStyle = '#8a6420'; x.beginPath(); x.roundRect(8, 8, 284, 404, 20); x.fill();
  x.fillStyle = g; x.beginPath(); x.roundRect(14, 14, 272, 392, 16); x.fill();
  // the portrait oval
  x.save(); x.beginPath(); x.ellipse(150, 165, 104, 124, 0, 0, 7); x.fillStyle = '#f6ecd0'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#e8c060'; x.stroke(); x.clip();
  const rg = x.createRadialGradient(150, 150, 10, 150, 165, 130); rg.addColorStop(0, '#fff8e4'); rg.addColorStop(1, '#e6d2a4'); x.fillStyle = rg; x.fillRect(40, 30, 220, 270); x.restore();
  emoji(x, c.emoji, 150, 172, 132);
  for (const [sx, sy] of [[34, 34], [266, 34], [34, 300], [266, 300]]) { x.fillStyle = '#ffe9a0'; x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 4 : 10; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.fill(); }
  x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.roundRect(28, 310, 244, 84, 14); x.fill();
  rtlText(x, c.name, 150, 342, 40, '#fff2c0', 230);
  rtlText(x, 'קְלַף צְפַרְדֵּעַ שׁוֹקוֹלָד 🐸', 150, 378, 18, '#ffe08a', 230, false);
  return C;
}
function cardTex(cid) { return _cardTex[cid] || (_cardTex[cid] = tex(cardCanvas(cid))); }

// one room: walls/floor/ceiling (1 call), props (1), glow (1), decals/gold/glass where used, chest lid + lock, the baked light pools
export function secretRoom(room, id) {
  const s = SPECS[id], { W, D, H } = s, X = W / 2, Z = D / 2;
  const g = new Group(); g.name = 'secret-room-' + id; const cols = [];
  const P = [], GL = [], GO = [], GS = [], DC = [];   // props (vertex colour), glow, gold, glass, decals
  const t = 0.4;
  for (const [w, d, x, z] of [[W + 2 * t, t, 0, -Z - t / 2], [W + 2 * t, t, 0, Z + t / 2], [t, D, -X - t / 2, 0], [t, D, X + t / 2, 0]]) cols.push({ type: 'box', x, z, hw: w / 2, hd: d / 2, angle: 0 });
  const opened = CHESTS[id].state !== 'locked';
  if (CHESTS[id].state === 'opening') CHESTS[id].state = 'open';
  // the way back out: an oak door in the south wall, stone surround, brass knob, a warm fanlight
  const inPlane = (w, h, x, y, dz) => new PlaneGeometry(w, h).rotateY(Math.PI).translate(x, y, Z - dz);
  P.push([inPlane(1.2, 2.3, 0, 1.15, 0.03), 0x6a4426]);
  for (const y of [0.6, 1.7]) for (const sx of [-1, 1]) P.push([inPlane(0.42, 0.7, sx * 0.27, y, 0.04), 0x5a3a20]);
  for (const sx of [-1, 1]) P.push([inPlane(0.16, 2.5, sx * 0.68, 1.25, 0.05), 0xd9ccb0]);
  P.push([inPlane(1.52, 0.18, 0, 2.5, 0.05), 0xd9ccb0]);
  P.push([new SphereGeometry(0.05, 10, 8).translate(0.42, 1.1, Z - 0.1), 0xd8b04a]);
  { const f = uvTo(new CircleGeometry(0.5, 14, 0, Math.PI), GR.fan); f.rotateY(Math.PI); f.translate(0, 2.6, Z - 0.01); GL.push(f); }
  const doorGlow = new Object3D(); doorGlow.position.set(0, 0.5, Z - 1.1); doorGlow.userData.light = { k: 'glow', c: 0xffd8a0, r: 1.4, a: 0.12 }; g.add(doorGlow);
  // per room furnishings
  let shell, ch, mop = null, snitch = null;
  const light = (x, y, z, c, r, a) => { const o = new Object3D(); o.position.set(x, y, z); o.userData.light = { k: 'glow', c, r, a }; g.add(o); };
  if (id === 'broomcupboard') {
    shell = shellMesh(W, D, H, { wall: AT.stone, floorR: AT.planks, wallTint: 0xd8c8b0, floorTint: 0xd0b090 });
    // broom rack on the west wall: a rail with pegs and five brooms standing in it
    P.push([box(0.08, 0.1, 3.0, -X + 0.06, 1.75, -0.2), 0x4a2a14], [box(0.08, 0.1, 3.0, -X + 0.06, 0.35, -0.2), 0x4a2a14]);
    for (let k = 0; k < 5; k++) {
      const z = -1.5 + k * 0.65, tilt = (k % 2 ? 0.06 : -0.05);
      P.push([new CylinderGeometry(0.022, 0.025, 1.7, 6).rotateX(tilt).translate(-X + 0.2, 1.2, z), 0x8a5a2e]);
      P.push([new ConeGeometry(0.13, 0.5, 9).rotateX(tilt).translate(-X + 0.2, 0.3, z - tilt * 1.4), [0xc8a050, 0xb89040, 0xd0aa5a][k % 3]]);
      P.push([new CylinderGeometry(0.06, 0.06, 0.05, 9).translate(-X + 0.2, 0.56, z - tilt * 1.2), 0x6a2a1a]);
      P.push([new CylinderGeometry(0.012, 0.012, 0.16, 5).rotateZ(Math.PI / 2).translate(-X + 0.12, 1.75, z), 0x2a1a0c]);
    }
    cols.push({ type: 'box', x: -X + 0.25, z: -0.2, hw: 0.3, hd: 1.6, angle: 0 });
    // shelves on the east wall: jars, folded rags, a polish tin, brushes
    for (const y of [0.9, 1.5, 2.1]) P.push([box(0.4, 0.04, 2.4, X - 0.22, y, -0.6), 0x6a4426]);
    for (const dz of [-1.75, 0.55]) P.push([box(0.38, 2.15, 0.05, X - 0.22, 1.075, dz), 0x4a2a14]);
    let sd = 5; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (const y of [0.92, 1.52, 2.12]) for (let k = 0; k < 5; k++) {
      const z = -1.5 + k * 0.45 + r() * 0.1, kind = (k + y * 10 | 0) % 3;
      if (kind === 0) P.push([new CylinderGeometry(0.07, 0.07, 0.2, 10).translate(X - 0.24, y + 0.1, z), [0x5a8a6a, 0x8a5a9a, 0xb07030][k % 3]], [new CylinderGeometry(0.075, 0.075, 0.03, 10).translate(X - 0.24, y + 0.215, z), 0xc8a050]);
      else if (kind === 1) for (let n = 0; n < 3; n++) P.push([box(0.28, 0.05, 0.22, X - 0.24, y + 0.025 + n * 0.05, z), [0xd8d0c0, 0xa83030, 0x3a5aa0][(n + k) % 3]]);
      else P.push([box(0.2, 0.06, 0.08, X - 0.24, y + 0.03, z), 0x6a4426], [box(0.18, 0.05, 0.07, X - 0.24, y + 0.085, z), 0xd8c8a0]);
    }
    cols.push({ type: 'box', x: X - 0.22, z: -0.6, hw: 0.24, hd: 1.25, angle: 0 });
    // buckets by the shelves
    for (const [bx, bz, c] of [[X - 0.45, 1.25, 0x8a8f98], [X - 0.95, 1.55, 0x7a6a50]]) {
      P.push([new CylinderGeometry(0.2, 0.16, 0.34, 14, 1, true).translate(bx, 0.17, bz), c], [new CircleGeometry(0.16, 14).rotateX(-Math.PI / 2).translate(bx, 0.02, bz), 0x3a4a5a]);
      P.push([new CylinderGeometry(0.17, 0.17, 0.02, 14).translate(bx, 0.25, bz), 0x5a8ab8]);   // soapy water
      P.push([new TorusGeometry(0.19, 0.008, 4, 14, Math.PI).translate(bx, 0.34, bz), 0x3a3a3a]);
      cols.push({ type: 'circle', x: bx, z: bz, r: 0.28 });
    }
    // one lamp: a little wall lantern over the shelves, warm glow
    P.push([box(0.04, 0.04, 0.24, X - 0.12, 2.48, 1.2), 0x2a2622], [new CylinderGeometry(0.06, 0.09, 0.06, 8).translate(X - 0.24, 2.6, 1.2), 0x2a2622], [new CylinderGeometry(0.08, 0.06, 0.04, 8).translate(X - 0.24, 2.33, 1.2), 0x2a2622]);
    GL.push(uvTo(new SphereGeometry(0.1, 12, 8), GR.lamp).translate(X - 0.24, 2.46, 1.2));
    light(X - 0.6, 0.5, 1.0, 0xffc880, 2.2, 0.32); light(0, 0.5, -0.5, 0xffd8a0, 2.4, 0.14);
    // the mop that sweeps by itself (its own mesh: it moves)
    mop = vcMesh([[new CylinderGeometry(0.02, 0.022, 1.35, 6).translate(0, 0.78, 0), 0x9a6a3a], [new CylinderGeometry(0.05, 0.05, 0.08, 8).translate(0, 0.1, 0), 0x6a6a70],
      ...Array.from({ length: 9 }, (_, k) => [new CylinderGeometry(0.025, 0.012, 0.18, 4).rotateZ((k - 4) * 0.12).rotateY(k * 0.7).translate(Math.sin(k) * 0.05, 0.03, Math.cos(k) * 0.05), 0xe8e0c8])], 'secret-mop');
    g.add(mop);
    ch = chest(g, P, cols, 0, -Z + 0.5, 0, opened);
  } else if (id === 'trophyroom') {
    shell = shellMesh(W, D, H, { wall: AT.stone, floorR: AT.flags, wallTint: 0xe0c8a8, floorTint: 0xd8ccb8 });
    // the red carpet from the door to the plinth, gold edging
    P.push([box(1.4, 0.012, 3.0, 0, 0.006, Z - 1.6), 0x8a1420]);
    for (const sx of [-1, 1]) GO.push(box(0.05, 0.014, 3.0, sx * 0.68, 0.007, Z - 1.6));
    // the big house cup on a plinth (centre)
    P.push([box(0.9, 0.12, 0.9, 0, 0.06, -0.5), 0x6a6258], [box(0.7, 0.9, 0.7, 0, 0.57, -0.5), 0x8a8274], [box(0.84, 0.08, 0.84, 0, 1.06, -0.5), 0xa89c88]);
    GL.push(uvTo(new PlaneGeometry(0.6, 0.15), GR.plaque).translate(0, 0.62, -0.5 + 0.352));
    const cup = (x, y, z, k) => {   // k = size
      GO.push(new CylinderGeometry(0.16 * k, 0.2 * k, 0.06 * k, 16).translate(x, y + 0.03 * k, z), new CylinderGeometry(0.04 * k, 0.05 * k, 0.22 * k, 10).translate(x, y + 0.17 * k, z));
      GO.push(new SphereGeometry(0.22 * k, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 1.25, 1).translate(x, y + 0.56 * k, z));
      GO.push(new CylinderGeometry(0.22 * k, 0.22 * k, 0.28 * k, 16, 1, true).translate(x, y + 0.7 * k, z), new TorusGeometry(0.22 * k, 0.018 * k, 6, 18).rotateX(Math.PI / 2).translate(x, y + 0.84 * k, z));
      for (const sx of [-1, 1]) GO.push(new TorusGeometry(0.1 * k, 0.022 * k, 6, 12, Math.PI * 1.3).rotateZ(sx > 0 ? -Math.PI * 0.65 : Math.PI * 0.35).translate(x + sx * 0.25 * k, y + 0.62 * k, z));
    };
    cup(0, 1.1, -0.5, 1.5);
    cols.push({ type: 'box', x: 0, z: -0.5, hw: 0.5, hd: 0.5, angle: 0 });
    // four glass cases along the side walls: oak base, glass box, two shelves of cups and house shields
    const HOUSE = [[0x9a1622, 0xd8a830], [0x1c3c8a, 0xb88a5a], [0xd8a820, 0x2a2420], [0x1a6a32, 0xb8bcc4]];
    let hk = 0;
    for (const sx of [-1, 1]) for (const cz of [-1.2, 0.9]) {
      const cx = sx * (X - 0.4);
      P.push([box(0.62, 0.7, 1.5, cx, 0.35, cz), 0x4a2a14], [box(0.66, 0.06, 1.54, cx, 0.72, cz), 0x5a3418], [box(0.66, 0.06, 1.54, cx, 2.15, cz), 0x5a3418]);
      GS.push(box(0.6, 1.4, 1.48, cx, 1.43, cz));
      P.push([box(0.56, 0.03, 1.44, cx, 1.45, cz), 0xd8d0c0]);
      for (const y of [0.75, 1.47]) for (const dz of [-0.45, 0.45]) cup(cx, y, cz + dz, 0.55);
      // a shield in house colours on the wall above each case
      const [c1, c2] = HOUSE[hk++ % 4], wx = sx * (X - 0.03), wz = cz;
      const shieldG = new CylinderGeometry(0.32, 0.32, 0.05, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI).scale(1, 1.4, 1).translate(0, 0.0, 0);
      const sg = (geo) => geo.rotateY(sx > 0 ? -Math.PI / 2 : Math.PI / 2).translate(wx - sx * 0.03, 2.75, wz);
      P.push([sg(shieldG), c1], [sg(box(0.62, 0.3, 0.05, 0, 0.15, 0)), c1], [sg(box(0.1, 0.62, 0.06, 0, 0.0, 0.004)), c2]);
      GO.push(sg(new TorusGeometry(0.33, 0.025, 5, 20, Math.PI).rotateZ(Math.PI).scale(1, 1.4, 1)), sg(box(0.66, 0.04, 0.06, 0, 0.3, 0)));
      cols.push({ type: 'box', x: cx, z: cz, hw: 0.34, hd: 0.77, angle: 0 });
    }
    // two wall lamps on the north wall either side of the chest, warm pools
    for (const lx of [-1.6, 1.6]) {
      GO.push(box(0.04, 0.04, 0.22, lx, 2.3, -Z + 0.11), new CylinderGeometry(0.05, 0.08, 0.05, 10).translate(lx, 2.48, -Z + 0.24));
      GL.push(uvTo(new SphereGeometry(0.11, 12, 8), GR.lamp).translate(lx, 2.36, -Z + 0.24));
      light(lx, 0.5, -Z + 0.9, 0xffc878, 2.2, 0.26);
    }
    light(0, 0.5, -0.5, 0xffe0a0, 2.6, 0.18);
    ch = chest(g, P, cols, 0, -Z + 0.45, 0, opened);
  } else {
    shell = shellMesh(W, D, H, { wall: AT.stone, floorR: AT.planks, wallTint: 0xc0b8b8, floorTint: 0xb8a898, ceilTint: 0xb0a8b0 });
    // the blackboard with chalk stars (north wall), a chalk ledge, the teacher's desk under a sheet
    P.push([box(2.6, 1.4, 0.06, 0, 1.75, -Z + 0.03), 0x3a2614]);
    GL.push(uvTo(new PlaneGeometry(2.4, 1.2), GR.board).translate(0, 1.75, -Z + 0.065));
    P.push([box(2.4, 0.04, 0.1, 0, 1.03, -Z + 0.08), 0x3a2614], [box(0.1, 0.03, 0.03, 0.6, 1.065, -Z + 0.08), 0xf0f0e8], [box(0.08, 0.03, 0.03, 0.8, 1.065, -Z + 0.09), 0xf0d0d8]);
    const SHEET = 0xd8d2c4, SHEET2 = 0xc8c0b0;
    const sheeted = (x, z, w, d, h) => {   // a desk under a dust sheet: the draped top, the sheet hanging down, a few folds
      P.push([box(w + 0.08, 0.05, d + 0.08, x, h, z), SHEET]);
      for (const sz of [-1, 1]) P.push([box(w + 0.1, h - 0.15, 0.02, x, (h + 0.15) / 2 - 0.02, z + sz * (d / 2 + 0.05)), SHEET2]);
      for (const sxx of [-1, 1]) P.push([box(0.02, h - 0.2, d + 0.1, x + sxx * (w / 2 + 0.05), (h + 0.2) / 2 - 0.02, z), SHEET2]);
      for (let k = 0; k < 3; k++) P.push([new CylinderGeometry(0.025, 0.04, h - 0.2, 5).translate(x - w / 2 + 0.2 + k * (w - 0.4) / 2, (h - 0.2) / 2 + 0.06, z + d / 2 + 0.06), SHEET]);
      cols.push({ type: 'box', x, z, hw: w / 2 + 0.08, hd: d / 2 + 0.08, angle: 0 });
    };
    sheeted(-1.5, -1.9, 1.3, 0.7, 0.85);
    for (const dx of [-1.7, 0, 1.7]) for (const dz of [-0.2, 1.3]) sheeted(dx, dz, 1.0, 0.6, 0.78);
    // a stack of old books, a globe under a sheet in the corner, a chair upside down on a desk
    for (let k = 0; k < 4; k++) P.push([box(0.32, 0.07, 0.24, -1.5 + (k % 2) * 0.03, 0.91 + k * 0.07, -1.95), [0x5a1e1a, 0x1f3b5e, 0x2c4a2a, 0x5a3a1e][k]]);
    P.push([new SphereGeometry(0.42, 12, 10).scale(1, 1.15, 1).translate(X - 0.6, 0.7, -Z + 0.6), SHEET], [new CylinderGeometry(0.45, 0.5, 0.25, 12).translate(X - 0.6, 0.12, -Z + 0.6), SHEET2]);
    cols.push({ type: 'circle', x: X - 0.6, z: -Z + 0.6, r: 0.5 });
    P.push([box(0.4, 0.04, 0.4, 1.7, 0.98, 1.3), 0x5a3a20]); for (const lx of [-0.17, 0.17]) for (const lz of [-0.17, 0.17]) P.push([box(0.04, 0.42, 0.04, 1.7 + lx, 1.2, 1.3 + lz), 0x5a3a20]);
    // the tall window with moonlight (west wall), a sill, a moonbeam to the floor, a cool pool
    GL.push(uvTo(new PlaneGeometry(1.0, 2.2), GR.moon).rotateY(Math.PI / 2).translate(-X + 0.012, 2.1, -0.4));
    P.push([box(0.12, 0.08, 1.2, -X + 0.06, 0.98, -0.4), 0xb8b0a0], [box(0.08, 0.1, 1.2, -X + 0.04, 3.25, -0.4), 0x6a6258]);
    for (const dz of [-0.56, 0.56]) P.push([box(0.08, 2.3, 0.08, -X + 0.04, 2.1, -0.4 + dz), 0x6a6258]);
    { const beam = new PlaneGeometry(1.0, 3.2); const u = beam.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, 0.5 + u.getX(i) * 0.5, u.getY(i)); beam.rotateZ(-0.62).rotateY(Math.PI / 2).translate(-X + 1.0, 1.25, -0.4); DC.push(beam); }
    light(-X + 1.8, 0.5, -0.4, 0x9ab8ff, 1.8, 0.26); light(0, 0.5, 0.5, 0xc8c0e0, 3.0, 0.1);
    // cobwebs in the top corners
    for (const [cx, cz, ry] of [[-X, -Z, 0], [X, -Z, -Math.PI / 2], [-X, Z, Math.PI / 2], [X, Z, Math.PI]]) {
      const w = uvTo(new PlaneGeometry(0.9, 0.9), [0, 0, 64, 64], 128); w.translate(0.45, -0.45, 0); w.rotateY(Math.PI / 4).rotateY(ry); w.translate(cx, H - 0.02, cz); DC.push(w);
    }
    // a warm candle stub on the teacher's desk (friendly, not spooky)
    P.push([new CylinderGeometry(0.03, 0.035, 0.12, 8).translate(-1.15, 0.94, -1.8), 0xf0e6c8]);
    GL.push(uvTo(new SphereGeometry(0.03, 8, 6).scale(1, 1.6, 1), GR.lamp).translate(-1.15, 1.03, -1.8));
    light(-1.15, 0.9, -1.6, 0xffc070, 1.4, 0.2);
    // the golden snitch (released by the chest; hidden until then)
    snitch = vcMesh([[new SphereGeometry(0.045, 12, 8), 0xffd040], ...[-1, 1].map(sx => [new PlaneGeometry(0.16, 0.06).translate(sx * 0.1, 0.01, 0).rotateZ(sx * 0.3), 0xfff8e0])], 'secret-snitch', { basic: true });
    snitch.material.side = DoubleSide; snitch.visible = false; g.add(snitch);
    ch = chest(g, P, cols, 1.6, -Z + 0.5, 0, opened);
  }
  g.add(shell);
  const props = vcMesh(P, 'secret-props'); props.castShadow = true; g.add(props);
  const glow = new Mesh(mergeGeometries(GL.map(flat), false), glowMat()); glow.name = 'secret-glow'; g.add(glow);
  if (GO.length) { const gold = new Mesh(mergeGeometries(GO.map(flat), false), new MeshStandardMaterial({ color: 0xd8a83a, metalness: 0.85, roughness: 0.28, emissive: 0x2a1800 })); gold.name = 'secret-gold'; g.add(gold); }
  if (GS.length) { const glass = new Mesh(mergeGeometries(GS.map(flat), false), new MeshStandardMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false })); glass.name = 'secret-glass'; glass.renderOrder = 3; glass.raycast = () => {}; g.add(glass); }
  if (DC.length) { const dc = new Mesh(mergeGeometries(DC.map(flat), false), decalMat()); dc.name = 'secret-decals'; dc.renderOrder = 4; dc.raycast = () => {}; g.add(dc); }
  const frog = frogMesh(); g.add(frog);
  const card = new Mesh(new PlaneGeometry(0.42, 0.59), new MeshBasicMaterial({ map: cardTex(s.card), side: DoubleSide, fog: false })); card.visible = false; card.name = 'secret-card'; g.add(card);
  g.userData.secretRoom = { id, group: g, chest: ch, frog, card, mop, snitch, W, D, H };
  const D0 = s.door;
  return room(g, cols, { x: 0, z: Z - 2.4, yaw: Math.PI }, {
    id,
    portals: [{ x: 0, z: Z - 0.6, r: 0.8, to: s.host, at: { x: D0.x + D0.nx * 1.9, z: D0.z + D0.nz * 1.9, yaw: doorYaw(s) } }],
  });
}

// ============================== the controller ==============================
function roomDraws(g) { let n = 0; g.traverse(o => { if (o.isMesh && o.visible && (!o.isInstancedMesh || o.count > 0)) { let v = true; for (let p = o.parent; p && p !== g; p = p.parent) if (!p.visible) v = false; if (v) n++; } }); return n; }
export function createSecretRooms({ camera, player, interiors, freecast, env }) {
  const pos = player.pos, debug = /[?&]debug=1/.test(location.search);
  let cards = [];
  try { const a = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(a)) cards = a.filter(c => CARDS[c]); } catch { /* private mode */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(cards)); } catch { /* private mode */ } };
  const FI = freecast && freecast._internal;
  const burst = (...a) => { try { FI && FI.burst(...a); } catch { /* fx are optional */ } };
  const _v = new Vector3(), _w = new Vector3();
  let T = 0, curRoom = null, base = null, snitchT = 0, overlayN = 0, lastCard = null, unlocks = 0;
  // ---- world helpers ----
  const hostLive = (id) => interiors.active === SPECS[id].host && interiors.room && interiors.room.group && interiors.room.group.userData.secretDoor && interiors.room.group.userData.secretDoor.id === id;
  const roomLive = (id) => interiors.active === id && curRoom && curRoom.id === id;
  const FY = () => (interiors.room && interiors.room.group ? interiors.room.group.position.y : -200);
  function doorPoint(id, lx, ly, lz, out) {   // a point in the door's local frame -> world
    const s = SPECS[id], D = s.door, yaw = doorYaw(s), c = Math.cos(yaw), sn = Math.sin(yaw);
    return out.set(D.x + lx * c + lz * sn, FY() + ly, D.z - lx * sn + lz * c);
  }
  const padW = (id, out) => doorPoint(id, -0.45, 1.2, 0.2, out);
  // ---- Alohomora targets: the three doors and the three chests ----
  if (FI && Array.isArray(FI.TARGETS)) {
    for (const id of IDS) {
      FI.TARGETS.push({ id: 'door-' + id, spells: ['alohomora'], at: (o) => padW(id, o), ok: () => hostLive(id) && DOORS[id].state === 'locked', cast: () => unlock(id) });
      FI.TARGETS.push({ id: 'chest-' + id, spells: ['alohomora'], at: (o) => chestLockW(id, o), ok: () => roomLive(id) && CHESTS[id].state === 'locked', cast: () => openChest(id) });
    }
  }
  function chestLockW(id, out) {
    if (roomLive(id)) { const c = curRoom.chest; c.lock.getWorldPosition(out); return out; }
    return out.set(0, FY() + 0.4, 0);
  }
  function unlock(id) {
    const d = DOORS[id]; if (d.state !== 'locked') return false;
    d.state = 'opening'; d.t = 0; d.opens++; unlocks++; d.popped = false;
    return true;
  }
  // ---- the door animation + the locked bubble (host room) ----
  function tickDoor(sd, dt) {
    const id = sd.id, d = DOORS[id], s = SPECS[id], D = s.door;
    const px = D.x + D.nx * 0.85, pz = D.z + D.nz * 0.85, dist = Math.hypot(pos.x - px, pos.z - pz);
    if (d.state === 'locked') {
      if (dist < 2.4 && !d.shown) { d.shown = true; d.bubbles++; fun.say(doorPoint(id, 0, 3.0, 0.4, _v), '🔒 נָעוּל! נַסּוּ אָלוֹהוֹמוֹרָה', 2.8, 'srlock'); fun.sfx.tink(); }
      else if (dist > 4.5) d.shown = false;
      return;
    }
    if (d.state !== 'opening') return;
    d.t += dt; const t = d.t;
    if (!d.popped) {
      d.popped = true;
      const p = sd.leaf.geometry.attributes.position, hole = new Vector3(-1.2, 1.2, 0.09);
      for (let i = sd.padStart; i < sd.padStart + sd.padCount; i++) p.setXYZ(i, hole.x, hole.y, hole.z);
      p.needsUpdate = true; sd.leaf.geometry.computeBoundingSphere();
      sd.fly.visible = true; padW(id, _v); burst(_v.x, _v.y, _v.z, 0xffd76a, 26, 2.4, 0.8, 0.22, -2); burst(_v.x, _v.y, _v.z, 0xffffff, 10, 1.4, 0.6, 0.16, -1);
      fun.sfx.clank(); fun.sfx.sparkle();
    }
    if (sd.fly.visible) {
      const k = Math.min(1, t / 0.9); doorPoint(id, -0.45 - k * 0.3, 1.2 + Math.sin(k * Math.PI) * 0.7 + k * 0.2, 0.2 + k * 0.9, _v);
      sd.fly.position.set(_v.x, _v.y - FY(), _v.z); sd.fly.rotation.set(k * 8, doorYaw(s) + k * 3, 0); sd.fly.scale.setScalar(Math.max(0.001, 1 - ease((k - 0.5) * 2)));
      if (k >= 1) sd.fly.visible = false;
    }
    sd.hinge.rotation.y = 1.75 * ease((t - 0.3) / 1.0);
    if (t > 1.3) {
      d.state = 'open'; sd.hinge.rotation.y = 1.75; sd.fly.visible = false;
      doorPoint(id, 0, 1.4, 0.6, _v); burst(_v.x, _v.y, _v.z, 0xffe8a0, 22, 1.8, 0.9, 0.2, -0.5);
      fun.sfx.chime(); fun.toast('🔓✨', s.name, 1800);
    }
  }
  // ---- the room: ambient, chest, frog, card, mop, snitch ----
  function enterRoom(r) {
    curRoom = r; base = { amb: env.amb.intensity, hemi: env.hemi.intensity };
    env.amb.intensity = base.amb * 1.35; env.hemi.intensity = base.hemi * 1.25;
    r.frogT = -1; r.cardT = -1; snitchT = 0;
    if (r.snitch && CHESTS[r.id].state !== 'locked') r.snitch.visible = true;
  }
  function leaveRoom() {
    if (base && interiors.active) { env.amb.intensity = base.amb; env.hemi.intensity = base.hemi; }
    base = null; curRoom = null;
  }
  function openChest(id) {
    const c = CHESTS[id]; if (c.state !== 'locked' || !roomLive(id)) return false;
    c.state = 'opening'; c.t = -0.2; c.opens++; c.popped = false; c.rewarded = false;
    return true;
  }
  function tickRoom(r, dt) {
    const id = r.id, c = CHESTS[id], chs = r.chest, F = FY();
    // a tap when Harry is within 2 m (the game's round prompt button)
    const cd = Math.hypot(pos.x - chs.x, pos.z - chs.z);
    if (c.state === 'locked' && cd < 2.0) fun.offer('secret-chest', '🔓', cd, () => openChest(id));
    if (c.state === 'opening') {
      c.t += dt; const t = c.t;
      if (t >= 0 && !c.popped) { c.popped = true; chs.lock.getWorldPosition(_v); burst(_v.x, _v.y, _v.z, 0xffd76a, 20, 2, 0.7, 0.2, -2); fun.sfx.clank(); }
      if (t >= 0) {
        const k = Math.min(1, t / 0.7);
        chs.lock.position.copy(chs.lockRest); chs.lock.position.z += k * 0.5; chs.lock.position.y += Math.sin(k * Math.PI) * 0.5;
        chs.lock.rotation.x = k * 9; chs.lock.scale.setScalar(Math.max(0.001, 1 - ease((k - 0.5) * 2))); if (k >= 1) chs.lock.visible = false;
        chs.lidPivot.rotation.x = -1.9 * ease((t - 0.25) / 0.6);
      }
      if (t > 0.7 && r.frogT < 0) { r.frogT = 0; c.frogs++; r.frog.visible = true; fun.sfx.ribbit(); }
      if (t > 1.0 && r.cardT < 0 && !cards.includes(SPECS[id].card)) { r.cardT = 0; r.card.visible = true; }
      if (t > 2.2 && !c.rewarded) {
        c.rewarded = true; fun.sfx.tada();
        const cid = SPECS[id].card, isNew = !cards.includes(cid);
        if (isNew) { cards.push(cid); persist(); c.cardGiven = true; showCard(cid); }
        const pts = !c.paid;
        if (pts) { c.paid++; try { window.HPLessons.progress.bonus(10); } catch { /* lessons not loaded */ } }
        setTimeout(() => { if (pts) { fun.toast('🐸⭐', '+10 נְקֻדּוֹת לַבַּיִת!', 2400); fun.confetti(['⭐', '✨', '🐸', '🍫'], 16); } else fun.toast('🐸', 'צְפַרְדֵּעַ שׁוֹקוֹלָד!', 1600); }, isNew ? 3200 : 0);
        if (r.snitch) { r.snitch.visible = true; snitchT = 0; chs.grp.getWorldPosition(_v); burst(_v.x, _v.y + 0.8, _v.z, 0xffd040, 16, 1.6, 0.8, 0.18, -0.5); }
      }
      if (t > 2.6) { c.state = 'open'; chs.lidPivot.rotation.x = -1.9; chs.lock.visible = false; }
    }
    // the frog: four hops away from the chest, then off it goes
    if (r.frogT >= 0) {
      r.frogT += dt; const ft = r.frogT, hop = Math.floor(ft / 0.55), u = (ft % 0.55) / 0.55;
      const fwd = new Vector3(Math.sin(chs.yaw + 0.5), 0, Math.cos(chs.yaw + 0.5));
      const along = 0.3 + (Math.min(hop, 4) + (hop < 4 ? ease(u) : 0)) * 0.55;
      const y0 = hop === 0 ? 0.45 * (1 - ease(u)) : 0;
      r.frog.position.set(chs.x + fwd.x * along, (hop < 4 ? Math.sin(u * Math.PI) * 0.35 : 0) + y0 + 0.02, chs.z + fwd.z * along);
      r.frog.rotation.y = Math.atan2(fwd.x, fwd.z); r.frog.scale.setScalar(ft > 2.4 ? Math.max(0.001, 1 - (ft - 2.4) / 0.4) * 1.6 : 1.6);
      if (u < dt / 0.55 && hop > 0 && hop < 4) fun.sfx.ribbit(0.6);
      if (ft > 2.8) { r.frog.visible = false; r.frogT = -1; }
    }
    // the card flies up out of the chest, spinning
    if (r.cardT >= 0) {
      r.cardT += dt; const k = Math.min(1, r.cardT / 1.2);
      r.card.position.set(chs.x, 0.6 + ease(k) * 1.4, chs.z + 0.2); r.card.rotation.y = r.cardT * 7; r.card.scale.setScalar(0.6 + k * 0.6);
      if (Math.random() < dt * 20) { r.card.getWorldPosition(_v); burst(_v.x, _v.y, _v.z, 0xffe27a, 2, 0.6, 0.6, 0.14, -0.4); }
      if (k >= 1) { r.card.visible = false; r.cardT = -1; }
    }
    if (r.mop) {   // sweeps a little loop on its own, swishing
      const a = T * 0.9;
      r.mop.position.set(0.9 + Math.cos(a) * 0.45, 0, 0.5 + Math.sin(a) * 0.35);
      r.mop.rotation.set(Math.sin(T * 5) * 0.25, -a, 0.22 + Math.sin(T * 5) * 0.12);
    }
    if (r.snitch && r.snitch.visible) {   // flits round the room: two incommensurate loops + a quick darting jitter
      snitchT += dt; const q = snitchT;
      r.snitch.position.set(Math.sin(q * 0.9) * (r.W / 2 - 0.8) + Math.sin(q * 3.3) * 0.3, 2.1 + Math.sin(q * 1.7) * 0.6 + Math.sin(q * 5.1) * 0.12, Math.sin(q * 0.63 + 1) * (r.D / 2 - 0.9) + Math.cos(q * 2.9) * 0.3);
      r.snitch.rotation.y = q * 2.2; r.snitch.scale.set(1, 1 + Math.sin(q * 40) * 0.5, 1);
      if (Math.random() < dt * 6) { r.snitch.getWorldPosition(_w); burst(_w.x, _w.y, _w.z, 0xffe070, 1, 0.3, 0.5, 0.1, 0); }
    }
    r.F = F;
  }
  // ---- the card overlay (canvas-drawn, ~3 s, tap to close early) ----
  let ovEl = null, ovT = null;
  function showCard(cid) {
    if (!ovEl) {
      const css = document.createElement('style');
      css.textContent = `#srCard{position:fixed;inset:0;z-index:45;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(10,6,24,.55);direction:rtl;font-family:'Rubik',sans-serif}
        #srCard.on{display:flex} #srCard canvas{height:min(64vh,420px);width:auto;max-width:80vw;border-radius:18px;box-shadow:0 0 40px rgba(255,215,106,.85);animation:srIn .55s cubic-bezier(.3,1.6,.5,1)}
        #srCard .t{margin-top:min(2vh,12px);font-size:min(5vh,30px);font-weight:bold;color:#ffe9a8;text-shadow:0 2px 0 #000;white-space:nowrap}
        @keyframes srIn{0%{transform:scale(.2) rotate(-200deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}`;
      document.head.appendChild(css);
      ovEl = document.createElement('div'); ovEl.id = 'srCard'; document.body.appendChild(ovEl);
      ovEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); hideCard(); });
    }
    ovEl.innerHTML = ''; const cv = cardCanvas(cid); ovEl.appendChild(cv);
    const tt = document.createElement('div'); tt.className = 't'; tt.textContent = '🐸 קְלָף חָדָשׁ! ' + cards.length + '/3'; ovEl.appendChild(tt);
    ovEl.classList.add('on'); overlayN++; lastCard = cid; fun.sfx.fanfare(); fun.confetti(['✨', '⭐', '🐸', '🍫'], 18);
    clearTimeout(ovT); ovT = setTimeout(hideCard, 3000);
  }
  function hideCard() { if (ovEl) ovEl.classList.remove('on'); clearTimeout(ovT); }

  function update(dtRaw) {
    const dt = dtRaw; T += dt;
    const r = interiors.room, g = r && r.group;
    const sd = g && g.userData.secretDoor;
    if (sd && interiors.active === SPECS[sd.id].host) tickDoor(sd, dt);
    const sr = g && interiors.active && g.userData.secretRoom;
    if ((sr || null) !== curRoom) { if (curRoom) leaveRoom(); if (sr) enterRoom(sr); }
    if (sr) tickRoom(sr, dt);
  }
  const api = {
    update,
    state: () => ({
      T: +T.toFixed(2), room: interiors.active, inSecret: curRoom ? curRoom.id : null, unlocks, cards: cards.slice(), overlays: overlayN, lastCard,
      overlay: !!(ovEl && ovEl.classList.contains('on')),
      doors: Object.fromEntries(IDS.map(id => [id, { state: DOORS[id].state, locked: DOORS[id].state !== 'open', opens: DOORS[id].opens, bubbles: DOORS[id].bubbles }])),
      chests: Object.fromEntries(IDS.map(id => [id, { state: CHESTS[id].state, opened: CHESTS[id].state !== 'locked', opens: CHESTS[id].opens, paid: CHESTS[id].paid, frogs: CHESTS[id].frogs }])),
      snitch: curRoom && curRoom.snitch ? { visible: curRoom.snitch.visible, t: +snitchT.toFixed(2), x: +curRoom.snitch.position.x.toFixed(2), y: +curRoom.snitch.position.y.toFixed(2), z: +curRoom.snitch.position.z.toFixed(2) } : null,
      frog: curRoom ? { visible: curRoom.frog.visible, t: +(curRoom.frogT || 0).toFixed(2) } : null,
      meshes: curRoom ? roomDraws(curRoom.group) : 0,
      doorMeshes: (() => { const gg = interiors.room && interiors.room.group, d = gg && gg.userData.secretDoor; return d ? roomDraws(d.live) : 0; })(),
    }),
    doors: () => IDS.map(id => { const s = SPECS[id], D = s.door; return { id, host: s.host, name: s.name, x: D.x, z: D.z, nx: D.nx, nz: D.nz, portal: { x: D.x + D.nx * 0.85, z: D.z + D.nz * 0.85, r: 1.0 }, card: s.card }; }),
    cardsList: CARDS,
  };
  if (debug) Object.assign(api, {
    go: (id) => interiors.enter(id),
    // stand Harry in front of a door in its host room (enters the host room first if needed), facing it
    async stand(id, d = 2.6) {
      const s = SPECS[id], D = s.door;
      if (interiors.active !== s.host) await interiors.enter(s.host);
      player.yaw = Math.atan2(-D.nx, -D.nz); player.teleport(D.x + D.nx * d, D.z + D.nz * d);
      return { x: pos.x, z: pos.z, yaw: player.yaw };
    },
    standChest(d = 1.4) { if (!curRoom) return null; const c = curRoom.chest; player.yaw = Math.PI + c.yaw; player.teleport(c.x + Math.sin(c.yaw) * d, c.z + Math.cos(c.yaw) * d); return { x: pos.x, z: pos.z }; },
    resetCards() { cards = []; persist(); },
  });
  return api;
}
