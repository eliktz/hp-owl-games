// Book 2, quest 5 geometry + pictures (adventure-b2-diary.js runs it): the little black diary, the puddle it lies in
// (Myrtle's bathroom), a writing desk for the common room, the red hair ribbon clue, and the three warm sepia memory
// cards (2D canvas: young Hagrid hugging a box, a fuzzy big-eyed baby spider peeking out, Hagrid looking wistful).
// All code-built: vertex colours, canvas pictures <= 512 px, no disk textures. Kind and soft, nothing scary.
// Budgets: the bathroom dressing (diary + puddle) < 400 tris, the common-room desk set < 1.5k tris, 2-3 draw calls each.
import {
  Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, ConeGeometry, CircleGeometry, PlaneGeometry,
  Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute, MeshStandardMaterial, MeshBasicMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew','Heebo',Arial,sans-serif";
const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); }
function paint(geo, hex) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const merge = (list) => mergeGeometries(list.map(strip), false);
const vc = (opts = {}) => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...opts });
const noRay = (o) => { o.traverse(m => { if (m.isMesh) m.raycast = () => {}; }); return o; };
export const triCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); } }); return Math.round(n); };

// ---------------- spots (room-local) ----------------
export const PUDDLE = { x: -2.3, z: -3.6 };                 // the bathroom: between the sinks and the window, a shallow puddle
export const DESK = { x: -6.9, z: 2.2, top: 0.8 };          // the common room: a small writing desk by the west window, facing +x
export const DESK_STAND = { x: -4.7, z: 4.0, yaw: Math.atan2(-2.2, -1.8) + 0.55 };   // where Harry stands to write (the desk ahead, beside him, never hidden by him)

// ---------------- the diary: a small, plain black book with cream page edges (closed or open) ----------------
export function buildDiary(open = false) {
  const L = [], BLACK = 0x1e1a1e, PAGE = 0xe8dcc0, EDGE = 0xd8c8a0, BAND = 0x5a4a3a;
  if (!open) {
    L.push(paint(new BoxGeometry(0.2, 0.045, 0.28), BLACK));
    L.push(paint(place(new BoxGeometry(0.185, 0.032, 0.012), 0.004, 0, 0.136), EDGE));
    L.push(paint(place(new BoxGeometry(0.012, 0.032, 0.26), 0.096, 0, 0), EDGE));
    L.push(paint(place(new BoxGeometry(0.205, 0.008, 0.02), 0, 0.022, -0.09), BAND));
  } else {
    for (const s of [-1, 1]) {
      L.push(paint(place(new BoxGeometry(0.2, 0.012, 0.28), s * 0.103, 0, 0, 0, 0, s * 0.06), BLACK));
      L.push(paint(place(new BoxGeometry(0.19, 0.02, 0.265), s * 0.1, 0.012, 0, 0, 0, s * 0.06), PAGE));
    }
  }
  const m = new Mesh(merge(L), vc({ roughness: 0.55, emissive: new Color(0x000000) }));
  m.name = 'adv-diary'; noRay(m);
  return m;
}

// ---------------- the puddle: a soft, shallow, blue-grey disc on the tiles ----------------
export function buildPuddle() {
  const geo = new CircleGeometry(0.8, 22).rotateX(-Math.PI / 2); geo.scale(1, 1, 0.72);
  const m = new Mesh(geo, new MeshStandardMaterial({ color: 0x8aa8b8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55, depthWrite: false }));
  m.name = 'adv-puddle'; m.renderOrder = 2; m.position.y = 0.012; noRay(m);
  return m;
}

// ---------------- the writing desk (common room): a small oak desk, a stool, an inkpot and a quill ----------------
export function buildDesk() {
  const L = [], OAK = 0x7a5232, OAK2 = 0x5e3e24, INK = 0x1a2440, QUILL = 0xe8e0d0;
  const h = DESK.top;
  L.push(paint(place(new BoxGeometry(0.9, 0.06, 1.3), 0, h - 0.03, 0), OAK));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(paint(place(new BoxGeometry(0.07, h - 0.06, 0.07), sx * 0.38, (h - 0.06) / 2, sz * 0.58), OAK2));
  L.push(paint(place(new BoxGeometry(0.06, 0.24, 1.2), -0.42, h + 0.12, 0), OAK2));                      // a low back rail
  L.push(paint(place(new CylinderGeometry(0.2, 0.2, 0.05, 12), 0.85, 0.5, 0), OAK));                     // the stool
  for (let k = 0; k < 3; k++) { const a = k * 2.094; L.push(paint(place(new CylinderGeometry(0.025, 0.03, 0.48, 5), 0.85 + Math.cos(a) * 0.13, 0.24, Math.sin(a) * 0.13), OAK2)); }
  L.push(paint(place(new CylinderGeometry(0.045, 0.055, 0.08, 10), -0.18, h + 0.04, 0.42), INK));           // the inkpot
  L.push(paint(place(new ConeGeometry(0.035, 0.42, 6), -0.14, h + 0.22, 0.4, 0, 0, -0.35), QUILL));          // the quill
  L.push(paint(place(new BoxGeometry(0.34, 0.03, 0.26), -0.15, h + 0.015, -0.35, 0, 0.2, 0), 0xd8c8a0));      // a stack of parchment
  const m = new Mesh(merge(L), vc({ roughness: 0.75 }));
  m.name = 'adv-desk'; noRay(m);
  return m;
}

// ---------------- the clue: a small red hair ribbon tied in a bow ----------------
export function buildRibbon() {
  const RED = 0xc8282a, RED2 = 0xa01c22, L = [];
  for (const s of [-1, 1]) {
    L.push(paint(place(new TorusGeometry(0.06, 0.02, 6, 12), s * 0.065, 0.025, 0, Math.PI / 2, 0, 0, 1, 0.6, 1), RED));   // the loops
    L.push(paint(place(new BoxGeometry(0.03, 0.012, 0.13), s * 0.03, 0.01, 0.08, 0, s * 0.45, 0), RED2));               // the tails
  }
  L.push(paint(place(new SphereGeometry(0.028, 8, 6), 0, 0.028, 0), RED2));                                            // the knot
  const m = new Mesh(merge(L), vc({ roughness: 0.6, emissive: new Color(0x5a0a0a), emissiveIntensity: 0.25 }));
  m.name = 'adv-ribbon'; noRay(m); m.scale.setScalar(1.6);
  return m;
}

// ---------------- the memory cards: warm sepia drawings, soft edges ----------------
// k 0: young Hagrid (a big, kind boy with bushy hair) hugging a wooden box with air holes
// k 1: a fuzzy round baby spider peeking out of the box with big shiny eyes and a little smile
// k 2: Hagrid holding the empty box, a wistful face (a soft down-turned mouth, no tears)
export function drawMemory(x, k, W = 480, H = 340) {
  x.save();
  const bg = x.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, W * 0.62);
  bg.addColorStop(0, '#f3e2bc'); bg.addColorStop(0.7, '#d9bd8a'); bg.addColorStop(1, '#a8834e');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const ink = '#5a3a1e', mid = '#9a7448', soft = '#c8a472', pale = '#e8d2a4';
  const E = (px, py, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, 7); x.fill(); };
  const line = (w = 4) => { x.strokeStyle = ink; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; };
  // a soft floor and a far window
  x.fillStyle = 'rgba(120,86,46,.25)'; x.fillRect(0, H * 0.78, W, H * 0.22);
  x.fillStyle = 'rgba(255,246,220,.5)'; x.beginPath(); x.roundRect(W * 0.08, H * 0.12, 70, 96, [35, 35, 4, 4]); x.fill();
  const box = (bx, by, open) => {   // a wooden box with air holes
    x.fillStyle = mid; x.beginPath(); x.roundRect(bx - 62, by - 40, 124, 80, 8); x.fill(); line(3); x.stroke();
    x.fillStyle = ink; for (const [hx, hy] of [[-30, -8], [0, -8], [30, -8], [-15, 14], [15, 14]]) { x.beginPath(); x.arc(bx + hx, by + hy, 4, 0, 7); x.fill(); }
    if (open) { x.fillStyle = soft; x.save(); x.translate(bx - 62, by - 40); x.rotate(-0.5); x.fillRect(0, -10, 124, 12); x.restore(); }
    else { x.fillStyle = soft; x.fillRect(bx - 66, by - 48, 132, 12); }
  };
  const hagrid = (hx, hy, mood) => {   // a big, friendly boy: bushy hair, round face, a big coat
    E(hx, hy + 120, 86, 80, mid); line(3); x.beginPath(); x.ellipse(hx, hy + 120, 86, 80, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
    E(hx, hy, 58, 58, pale); line(3); x.beginPath(); x.arc(hx, hy, 58, 0, 7); x.stroke();
    x.fillStyle = ink; for (let i = 0; i < 11; i++) { const a = Math.PI * (1.05 + i * 0.09); E(hx + Math.cos(a) * 58, hy + Math.sin(a) * 58, 18, 15, '#6a4626'); }
    E(hx - 20, hy - 4, 6, 7, ink); E(hx + 20, hy - 4, 6, 7, ink); E(hx - 18, hy - 6, 2, 2, pale); E(hx + 22, hy - 6, 2, 2, pale);   // kind dark eyes
    E(hx - 36, hy + 14, 10, 6, 'rgba(200,120,90,.45)'); E(hx + 36, hy + 14, 10, 6, 'rgba(200,120,90,.45)');                          // rosy cheeks
    line(4); x.beginPath();
    if (mood === 'sad') { x.arc(hx, hy + 34, 14, Math.PI * 1.2, Math.PI * 1.8); x.stroke(); line(3); x.beginPath(); x.moveTo(hx - 32, hy - 15); x.lineTo(hx - 12, hy - 22); x.moveTo(hx + 32, hy - 15); x.lineTo(hx + 12, hy - 22); x.stroke(); }
    else { x.arc(hx, hy + 14, 18, 0.25, Math.PI - 0.25); x.stroke(); }
  };
  if (k === 0) {
    hagrid(W * 0.5, H * 0.34, 'happy'); box(W * 0.5, H * 0.72, false);
    E(W * 0.5 - 70, H * 0.66, 20, 26, pale); E(W * 0.5 + 70, H * 0.66, 20, 26, pale);   // big hands round the box
    x.fillStyle = '#b07a3a'; x.font = `bold 30px ${FONT}`; x.textAlign = 'center'; x.fillText('♥', W * 0.5, H * 0.56);
  } else if (k === 1) {
    box(W * 0.5, H * 0.72, true);
    // the baby spider: a round fuzzy ball with big shiny eyes and a tiny smile, peeking over the edge
    const sx = W * 0.5, sy = H * 0.5;
    line(5); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(sx + s * 34, sy + 6 + i * 9); x.quadraticCurveTo(sx + s * 62, sy - 8 + i * 12, sx + s * 70, sy + 22 + i * 10); x.stroke(); }
    x.fillStyle = '#7a5434'; for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; E(sx + Math.cos(a) * 42, sy + Math.sin(a) * 38, 8, 8, '#7a5434'); }
    E(sx, sy, 44, 40, '#8a6240');
    for (const s of [-1, 1]) { E(sx + s * 16, sy - 6, 15, 17, '#fffaf0'); E(sx + s * 16, sy - 3, 9, 11, '#2a1a10'); E(sx + s * 12, sy - 9, 4, 4, '#ffffff'); }
    line(3); x.beginPath(); x.arc(sx, sy + 16, 8, 0.3, Math.PI - 0.3); x.stroke();
    E(sx - 30, sy + 12, 7, 4, 'rgba(220,140,110,.5)'); E(sx + 30, sy + 12, 7, 4, 'rgba(220,140,110,.5)');
    x.fillStyle = ink; x.font = `bold 34px ${FONT}`; x.textAlign = 'center'; x.fillText('✨', sx + 90, sy - 50); x.fillText('✨', sx - 96, sy - 30);
  } else {
    hagrid(W * 0.5, H * 0.34, 'sad'); box(W * 0.62, H * 0.78, true);
    E(W * 0.5 - 70, H * 0.7, 20, 26, pale); E(W * 0.5 + 70, H * 0.7, 20, 26, pale);
  }
  // the soft vignette and a worn edge
  const v = x.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7); v.addColorStop(0, 'rgba(90,60,30,0)'); v.addColorStop(1, 'rgba(90,60,30,.45)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(110,76,40,.8)'; x.lineWidth = 10; x.strokeRect(5, 5, W - 10, H - 10);
  x.restore();
}
