// Book 3, quest 1 geometry (adventure-b3-bus.js runs it): the on-rails night street 'b3street'. All built in code, no disk
// textures (canvas <= 512 px). Night-blue but bright and friendly: lit windows, lamp glow, stars, a big soft moon.
// Local frame: the bus drives toward -z at local y 0 (the room group sits at FLOOR_Y); three lanes at x -2.6 / 0 / +2.6;
// the kerb (pavement, the bus stop sign, the Leaky Cauldron) is on the +x side. The world scrolls past (a treadmill):
// the road's and the house fronts' texture offsets, the lamp posts, tickets and obstacles move toward +z.
// Parts: sky dome (follows the camera) + moon | street (road + pavements: one textured plane) | house fronts (one
// plane per side, one material) | lamp posts + their glows (two instanced meshes) | the stop sign | the purple
// triple-decker Knight Bus stand-in (< 4k tris: headlight eyes, a grille smile, lit windows, a brass bed in a window,
// the conductor at the door) | Harry and Ron at the kerb (reused from the flying car) | tickets (instanced) |
// obstacles (a hanging pub sign, a lamp-post pair, a slow flock of pigeons: one per lane, the safe lane left empty) |
// the safe-lane hoop | the Leaky Cauldron front (slides in for the last step).
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, ConeGeometry,
  Matrix4, Quaternion, Euler, Vector3, Color, BufferAttribute, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture,
  InstancedMesh, DoubleSide, BackSide, SRGBColorSpace, RepeatWrapping, AdditiveBlending,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildKid } from './adventure-b2-car-build.js';

export const LANES = [-2.6, 0, 2.6];
export const STOP = { lane: 1, z: 0 };            // the bus stops in the middle lane (its door side faces the kerb and the camera)
export const SIGN = { x: 6.3, z: -4.6 };          // the bus stop sign on the pavement
export const DOOR = { x: 1.2, y: 1.05, z: -2.35 }; // the bus door when it stands at STOP (right side, near the front)
export const PUB = { x: 7.15, y: 1.6, z: -9.15 };  // the Leaky Cauldron's door (the front's group offset 0)
export const PUB_SIGN = { x: 5.7, y: 3.6, z: -11.6 };
const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew',Arial,sans-serif";
export const NLAMP = 22, LAMP_GAP = 12;

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); }
function paint(geo, hex) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); if (!n.attributes.color) paint(n, 0xffffff); return n; };
const merge = (list) => mergeGeometries(list.map(strip), false);
const vc = (opts = {}) => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...opts });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }
const S = (w, h) => new SphereGeometry(1, w, h);
const noRay = (o) => { o.traverse(m => { if (m.isMesh) m.raycast = () => {}; }); return o; };
const noCull = (o) => { o.traverse(m => { if (m.isMesh) m.frustumCulled = false; }); return o; };
export const triCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { let p = m.parent, vis = true; while (p && p !== o) { if (p.visible === false) { vis = false; break; } p = p.parent; } if (!vis) return; const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); } }); return Math.round(n); };
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const rr = (x, a, b, w, h, r) => { x.beginPath(); x.roundRect(a, b, w, h, r); x.fill(); };
function rtlText(x, s, cx, cy, size, col, maxW, stroke = null) {
  x.save(); x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${size}px ${FONT}`;
  const m = x.measureText(s).width; if (m > maxW) { x.translate(cx, cy); x.scale(maxW / m, 1); x.translate(-cx, -cy); }
  if (stroke) { x.lineWidth = Math.max(3, size * 0.14); x.strokeStyle = stroke; x.strokeText(s, cx, cy); }
  x.fillStyle = col; x.fillText(s, cx, cy); x.restore();
}

// ---------------- the window art of the bus (one transparent canvas for both sides, one for the back + front) ----------------
// A lit window: warm glow, a little curtain; kind = 'bed' (a brass bed with a red blanket), 'stan' (the conductor in a
// purple cap waving), 'lamp' (a bedside lamp + a pillow), 'plain'.
function busWindow(x, a, b, w, h, kind) {
  const g = x.createLinearGradient(0, b, 0, b + h); g.addColorStop(0, '#fff2b8'); g.addColorStop(1, '#ffc860');
  x.fillStyle = '#c8a040'; rr(x, a - 4, b - 4, w + 8, h + 8, 8);
  x.fillStyle = g; rr(x, a, b, w, h, 6);
  x.fillStyle = 'rgba(200,60,80,.85)'; x.fillRect(a, b, w * 0.18, h); x.fillRect(a + w * 0.82, b, w * 0.18, h);   // curtains
  if (kind === 'bed') {
    x.strokeStyle = '#b8862e'; x.lineWidth = 4; x.beginPath(); x.moveTo(a + w * 0.22, b + h); x.lineTo(a + w * 0.22, b + h * 0.38); x.arc(a + w * 0.3, b + h * 0.38, w * 0.08, Math.PI, 0); x.lineTo(a + w * 0.38, b + h); x.stroke();
    x.fillStyle = '#ffffff'; rr(x, a + w * 0.26, b + h * 0.55, w * 0.18, h * 0.16, 6);                  // pillow
    x.fillStyle = '#c0303a'; rr(x, a + w * 0.36, b + h * 0.62, w * 0.44, h * 0.3, 6);                   // blanket
    x.fillStyle = '#ffe0a0'; for (let k = 0; k < 4; k++) x.fillRect(a + w * (0.4 + k * 0.1), b + h * 0.66, w * 0.04, h * 0.22);
  } else if (kind === 'stan') {
    x.fillStyle = '#5a2a8a'; rr(x, a + w * 0.34, b + h * 0.5, w * 0.32, h * 0.5, 10);                    // jacket
    x.fillStyle = '#f0c8a0'; x.beginPath(); x.arc(a + w * 0.5, b + h * 0.38, w * 0.13, 0, 7); x.fill();
    x.fillStyle = '#4a1a7a'; rr(x, a + w * 0.36, b + h * 0.18, w * 0.28, h * 0.1, 4);                     // cap
    x.fillStyle = '#c8a040'; x.fillRect(a + w * 0.36, b + h * 0.27, w * 0.28, h * 0.03);
    x.fillStyle = '#2a1a12'; x.beginPath(); x.arc(a + w * 0.45, b + h * 0.37, 3, 0, 7); x.arc(a + w * 0.55, b + h * 0.37, 3, 0, 7); x.fill();
    x.strokeStyle = '#2a1a12'; x.lineWidth = 2.5; x.beginPath(); x.arc(a + w * 0.5, b + h * 0.41, w * 0.06, 0.2, Math.PI - 0.2); x.stroke();
    x.strokeStyle = '#f0c8a0'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(a + w * 0.64, b + h * 0.6); x.lineTo(a + w * 0.8, b + h * 0.3); x.stroke();   // a wave
  } else if (kind === 'lamp') {
    x.fillStyle = '#ffffff'; rr(x, a + w * 0.3, b + h * 0.62, w * 0.3, h * 0.16, 6);
    x.fillStyle = '#3a6ac0'; rr(x, a + w * 0.22, b + h * 0.72, w * 0.56, h * 0.24, 6);
    x.fillStyle = '#e86a8a'; x.beginPath(); x.moveTo(a + w * 0.66, b + h * 0.3); x.lineTo(a + w * 0.78, b + h * 0.3); x.lineTo(a + w * 0.82, b + h * 0.46); x.lineTo(a + w * 0.62, b + h * 0.46); x.closePath(); x.fill();
  }
}
function sideTex() {
  // top half (v 0.5..1): the kerb side (+x; the front is on the right, the door by it); bottom half: the other side (front on the left)
  return canvasTex(512, 512, (x, w) => {
    x.clearRect(0, 0, 512, 512);
    for (const half of [0, 1]) {
      const y0 = half * 256, front = half === 0 ? 'right' : 'left';
      const rows = [[y0 + 14, 'deck 3'], [y0 + 92, 'deck 2'], [y0 + 170, 'deck 1']];
      rows.forEach(([b], ri) => {
        const n = 5;
        for (let k = 0; k < n; k++) {
          let a = 20 + k * 96;
          if (half === 0 && ri === 2 && k === n - 1) continue;   // the door goes there
          const kind = ri === 2 && k === (half === 0 ? 1 : 2) ? 'bed' : ri === 1 && k === 3 ? 'lamp' : ri === 0 && k === 0 ? 'bed' : 'plain';
          busWindow(x, a, b, 76, 50, kind);
        }
      });
      // the gold title band between decks 1 and 2 (always reads right to left)
      rtlText(x, 'אוטובוס האבירים', 256, y0 + 154, 26, '#ffd76a', 380, '#3a1060');
      if (half === 0) {   // the door (open, warm light inside) with the conductor waving in it
        busWindow(x, 404, y0 + 160, 84, 92, 'stan');
        x.strokeStyle = '#ffd76a'; x.lineWidth = 4; x.strokeRect(402, y0 + 158, 88, 96);
      }
      void front;
    }
  });
}
function endsTex() {
  // left half: the back (a big rear window with a brass bed, lit windows above, a gold "3"); right half: the front
  // (the windscreen with the driver's hands on a big wheel, the destination sign)
  return canvasTex(512, 512, (x) => {
    x.clearRect(0, 0, 512, 512);
    // back
    busWindow(x, 30, 26, 196, 100, 'lamp'); busWindow(x, 30, 166, 196, 100, 'plain'); busWindow(x, 30, 306, 196, 118, 'bed');
    x.fillStyle = '#ffd76a'; x.beginPath(); x.arc(128, 466, 26, 0, 7); x.fill(); rtlText(x, '3', 128, 468, 34, '#5a2a8a', 60);
    x.fillStyle = '#ff5a5a'; x.fillRect(20, 450, 34, 30); x.fillRect(202, 450, 34, 30);   // tail lights
    // front
    x.fillStyle = '#2a1650'; rr(x, 280, 18, 208, 58, 10); rtlText(x, 'לונדון ✨', 384, 48, 32, '#ffe9a8', 190);
    busWindow(x, 290, 100, 188, 100, 'plain'); busWindow(x, 290, 232, 188, 96, 'plain');
    // (the lower front stays plain purple: the headlight eyes and the grille smile are the face there)
  });
}

// ---------------- the Knight Bus (faces -z, wheels on y 0, about 6.6 m long, 4.7 m tall, 2.3 m wide) ----------------
export function buildBus() {
  const PURPLE = 0x5a2a9a, PURPLE2 = 0x4a1e82, GOLD = 0xc8a040, CHROME = 0xbcbcc0, TYRE = 0x26242a, DARK = 0x1a1a22;
  const root = new Group(); root.name = 'b3-bus';
  const body = new Group(); body.name = 'b3-bus-body'; root.add(body);   // body squashes / stretches / wobbles; pivot at the road
  const W = 2.3, L = 6.6, Y0 = 0.45, Y1 = 4.5;
  const B = [];
  B.push(paint(place(new BoxGeometry(W, Y1 - Y0, L), 0, (Y0 + Y1) / 2, 0), PURPLE));
  B.push(paint(place(new CylinderGeometry(W / 2, W / 2, L, 16, 1, false, -Math.PI / 2, Math.PI), 0, Y1, 0, Math.PI / 2, 0, 0, 1, 1, 0.26), PURPLE2));   // a round roof
  for (const y of [1.9, 3.15]) B.push(paint(place(new BoxGeometry(W + 0.06, 0.1, L + 0.06), 0, y, 0), GOLD));                               // gold deck bands
  B.push(paint(place(new BoxGeometry(W + 0.08, 0.12, L + 0.08), 0, Y0 + 0.08, 0), PURPLE2));
  B.push(paint(place(new BoxGeometry(W + 0.1, 0.22, 0.18), 0, 0.55, -L / 2 - 0.06), CHROME));                                              // bumpers
  B.push(paint(place(new BoxGeometry(W + 0.1, 0.22, 0.18), 0, 0.55, L / 2 + 0.06), CHROME));
  B.push(paint(place(new TorusGeometry(0.46, 0.06, 6, 16, Math.PI), 0, 1.0, -L / 2 - 0.03, 0, 0, Math.PI), CHROME));                       // the grille: a big smile
  for (const sx of [-1, 1]) {
    B.push(paint(place(new TorusGeometry(0.27, 0.05, 6, 14), sx * 0.66, 1.42, -L / 2 - 0.03), CHROME));                                     // headlight rims
    B.push(paint(place(S(10, 7), sx * 0.62, 1.44, -L / 2 - 0.2, 0, 0, 0, 0.11, 0.13, 0.04), DARK));                                         // pupils
    B.push(paint(place(S(6, 4), sx * 0.58, 1.5, -L / 2 - 0.23, 0, 0, 0, 0.035, 0.035, 0.012), 0xffffff));
    B.push(paint(place(new BoxGeometry(0.3, 0.06, 0.04), sx * 0.66, 1.82, -L / 2 - 0.05, 0, 0, sx * 0.22), DARK));                            // happy eyebrows (outer ends up)
    B.push(paint(place(new BoxGeometry(0.06, 0.6, 0.06), sx * (W / 2 + 0.04), 0.85, -L / 2 + 0.3), CHROME));                                 // corner trims
  }
  const WH = [];
  for (const [x, z] of [[-1.08, -2.2], [1.08, -2.2], [-1.08, 2.2], [1.08, 2.2]]) {
    WH.push(paint(place(new CylinderGeometry(0.45, 0.45, 0.28, 12), x, 0.45, z, 0, 0, Math.PI / 2), TYRE));
    WH.push(paint(place(new CylinderGeometry(0.22, 0.22, 0.3, 8, 1), x, 0.45, z, 0, 0, Math.PI / 2), GOLD));
  }
  const bodyMesh = new Mesh(merge([...B, ...WH]), vc({ roughness: 0.5, metalness: 0.1 })); bodyMesh.name = 'bus-body'; body.add(bodyMesh);
  // the window art: two sides (one material), the back and the front (one material); transparent between the windows
  const sT = sideTex(), eT = endsTex();
  const sideGeo = (sx) => { const g = new PlaneGeometry(L - 0.2, Y1 - Y0 - 0.1); g.rotateY(sx > 0 ? Math.PI / 2 : -Math.PI / 2); g.translate(sx * (W / 2 + 0.012), (Y0 + Y1) / 2, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, sx > 0 ? 0.5 + uv.getY(i) * 0.5 : uv.getY(i) * 0.5); return g; };
  const sides = new Mesh(mergeGeometries([sideGeo(1), sideGeo(-1)], false), new MeshBasicMaterial({ map: sT, transparent: true, alphaTest: 0.05, side: DoubleSide }));
  sides.name = 'bus-windows'; body.add(sides);
  const endGeo = (back) => { const g = new PlaneGeometry(W - 0.1, Y1 - Y0 - 0.1); if (!back) g.rotateY(Math.PI); g.translate(0, (Y0 + Y1) / 2, back ? L / 2 + 0.012 : -L / 2 - 0.012);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, back ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5); return g; };
  const ends = new Mesh(mergeGeometries([endGeo(true), endGeo(false)], false), new MeshBasicMaterial({ map: eT, transparent: true, alphaTest: 0.05 }));
  ends.name = 'bus-ends'; body.add(ends);
  // the headlight eyes (they glow: true lights) + a little roof lamp
  const lamps = new Mesh(merge([...[-1, 1].map(sx => place(new SphereGeometry(0.25, 12, 8), sx * 0.66, 1.42, -L / 2 - 0.04, 0, 0, 0, 1, 1, 0.45)), place(new SphereGeometry(0.16, 10, 6), 0, Y1 + 0.32, -L / 2 + 0.5)]),
    new MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe6a0, emissiveIntensity: 0.95, roughness: 0.3 }));
  lamps.name = 'bus-eyes'; body.add(lamps);
  noCull(root); noRay(root);
  return { root, body, W, L, H: Y1 + 0.3 };
}

// ---------------- the street ----------------
function skyTex() {
  return canvasTex(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#16205a'); g.addColorStop(0.35, '#26357a'); g.addColorStop(0.5, '#4a5aa0'); g.addColorStop(0.56, '#5a62a2'); g.addColorStop(1, '#2a2a5a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let k = 0; k < 260; k++) { const px = r() * w, py = r() * h * 0.46, s = r() < 0.12 ? 1.8 : 1; x.fillStyle = `rgba(255,${240 + (r() * 15) | 0},${200 + (r() * 55) | 0},${0.55 + r() * 0.45})`; x.beginPath(); x.arc(px, py, s, 0, 7); x.fill(); }
    for (let k = 0; k < 14; k++) { const px = r() * w, py = 8 + r() * h * 0.36; x.fillStyle = 'rgba(255,250,220,.95)'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i % 2 ? 1.2 : 4; x.lineTo(px + Math.cos(a) * q, py + Math.sin(a) * q); } x.fill(); }
  });
}
function roadTex() {
  // across x -7.5..7.5 (u 0..1): pavement slabs | kerb | cobbled road with lane dashes | kerb | pavement slabs
  const t = canvasTex(256, 256, (x, w, h) => {
    const px = (m) => (m + 7.5) / 15 * w;
    x.fillStyle = '#6a6a86'; x.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 18; i++) { const cx = px(-5.2) + i * (px(5.2) - px(-5.2)) / 18 + (j % 2) * 4, cy = j * 16 + 8; x.fillStyle = `rgb(${84 + r() * 22 | 0},${84 + r() * 20 | 0},${108 + r() * 22 | 0})`; rr(x, cx - 5, cy - 6, 11, 12, 4); }
    for (const sx of [-1, 1]) {
      const a = sx < 0 ? 0 : px(5.6), b = sx < 0 ? px(-5.6) : w;
      x.fillStyle = '#9a98b0'; x.fillRect(a, 0, b - a, h);
      x.strokeStyle = 'rgba(60,60,90,.35)'; x.lineWidth = 2; for (let k = 0; k <= h; k += 32) { x.beginPath(); x.moveTo(a, k); x.lineTo(b, k); x.stroke(); }
      x.fillStyle = '#c8c4d4'; x.fillRect(sx < 0 ? px(-5.6) : px(5.2), 0, px(-5.2) - px(-5.6), h);   // kerb stones
    }
    x.fillStyle = 'rgba(255,240,190,.75)'; for (const m of [-1.3, 1.3]) for (let k = 0; k < h; k += 64) x.fillRect(px(m) - 2, k + 8, 4, 30);
  });
  t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 4; return t;
}
function housesTex() {
  // a row of four terraced houses (16 m of street): warm brick / cream / blue, lit windows, doors with fanlights, chimneys
  const t = canvasTex(512, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const cols = ['#8a4a3a', '#b8a888', '#5a6a8a', '#9a5a42'], r = rng(21);
    for (let k = 0; k < 4; k++) {
      const a = k * 128, top = 40 + (k % 2) * 14;
      x.fillStyle = cols[k]; x.fillRect(a, top, 128, h - top);
      x.fillStyle = 'rgba(0,0,0,.12)'; for (let y = top + 6; y < h; y += 9) x.fillRect(a, y, 128, 1);
      x.fillStyle = '#3a3448'; x.beginPath(); x.moveTo(a - 2, top + 2); x.lineTo(a + 64, top - 30); x.lineTo(a + 130, top + 2); x.fill();   // roof
      x.fillStyle = '#5a3a30'; x.fillRect(a + 90, top - 44, 16, 30); x.fillStyle = '#c86a4a'; x.fillRect(a + 92, top - 50, 5, 8); x.fillRect(a + 99, top - 50, 5, 8);   // chimney
      for (const [wx, wy] of [[18, top + 20], [76, top + 20], [18, top + 86], [76, top + 86]]) {
        const lit = r() < 0.8, g = x.createLinearGradient(0, wy, 0, wy + 44); g.addColorStop(0, lit ? '#fff0b0' : '#5a6aa0'); g.addColorStop(1, lit ? '#ffb850' : '#3a4a80');
        x.fillStyle = '#e8e0d0'; x.fillRect(a + wx - 3, wy - 3, 40, 50); x.fillStyle = g; x.fillRect(a + wx, wy, 34, 44);
        x.fillStyle = '#e8e0d0'; x.fillRect(a + wx + 15, wy, 4, 44); x.fillRect(a + wx, wy + 20, 34, 3);
        if (lit && r() < 0.5) { x.fillStyle = 'rgba(200,70,90,.8)'; x.fillRect(a + wx, wy, 8, 44); x.fillRect(a + wx + 26, wy, 8, 44); }
      }
      x.fillStyle = ['#2a4a8a', '#8a2a3a', '#2a6a4a', '#c8a040'][k]; x.fillRect(a + 48, h - 66, 32, 66);   // door
      x.fillStyle = '#ffd88a'; x.beginPath(); x.arc(a + 64, h - 66, 16, Math.PI, 0); x.fill();
      x.fillStyle = '#ffd76a'; x.beginPath(); x.arc(a + 74, h - 34, 3, 0, 7); x.fill();
    }
  });
  t.wrapS = RepeatWrapping; t.anisotropy = 4; return t;
}
function moonTex() { return canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.32, 'rgba(255,246,210,1)'); g.addColorStop(0.36, 'rgba(255,240,200,.45)'); g.addColorStop(1, 'rgba(200,210,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.fillStyle = 'rgba(220,210,180,.5)'; for (const [a, b, q] of [[54, 56, 6], [72, 70, 4], [60, 76, 3]]) { x.beginPath(); x.arc(a, b, q, 0, 7); x.fill(); } }); }
function stopSignTex() {
  return canvasTex(256, 256, (x) => {
    x.fillStyle = '#ffd76a'; x.beginPath(); x.arc(128, 128, 122, 0, 7); x.fill();
    x.fillStyle = '#5a2a9a'; x.beginPath(); x.arc(128, 128, 108, 0, 7); x.fill();
    x.font = '84px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🪄', 128, 104);
    rtlText(x, 'עצור כאן!', 128, 184, 40, '#ffe9a8', 190);
  });
}
function ticketTex() {
  return canvasTex(128, 64, (x) => {
    x.fillStyle = '#ffd040'; rr(x, 2, 2, 124, 60, 10); x.fillStyle = '#fff2b0'; rr(x, 8, 8, 112, 48, 7);
    x.strokeStyle = '#c88a10'; x.setLineDash([4, 4]); x.lineWidth = 3; x.beginPath(); x.moveTo(36, 8); x.lineTo(36, 56); x.stroke(); x.setLineDash([]);
    x.font = '30px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⭐', 20, 33); x.fillText('🚌', 82, 33);
  });
}
function pubSignTex() {
  return canvasTex(256, 192, (x) => {
    x.fillStyle = '#5a3a22'; rr(x, 0, 0, 256, 192, 14); x.fillStyle = '#c8a040'; rr(x, 8, 8, 240, 176, 10); x.fillStyle = '#2a4a3a'; rr(x, 14, 14, 228, 164, 8);
    x.font = '76px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🫖', 128, 80);
    rtlText(x, 'התה המעופף', 128, 150, 30, '#ffe9a8', 210);
  });
}
function cauldronFrontTex() {
  // the Leaky Cauldron front, seen from the street: dark old wood, a warm bay window, the round-topped door, a lantern
  return canvasTex(512, 512, (x) => {
    x.fillStyle = '#3a2618'; x.fillRect(0, 0, 512, 512);
    x.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 512; k += 22) x.fillRect(k, 0, 3, 512);
    x.fillStyle = '#2a1a10'; x.fillRect(0, 0, 512, 40); x.fillStyle = '#c8a040'; x.fillRect(0, 36, 512, 6);
    rtlText(x, 'הקלחת הדולפת', 256, 92, 54, '#ffd76a', 440, '#1a0e06');
    // the bay window: small warm panes, people-shaped silhouettes and a fire glow
    const g = x.createLinearGradient(0, 150, 0, 380); g.addColorStop(0, '#fff0b0'); g.addColorStop(1, '#ff9a40');
    x.fillStyle = '#6a4a2a'; x.fillRect(36, 146, 220, 240); x.fillStyle = g; x.fillRect(46, 156, 200, 220);
    x.fillStyle = 'rgba(120,60,20,.55)'; x.beginPath(); x.arc(110, 300, 26, 0, 7); x.fill(); x.fillRect(84, 320, 52, 56); x.beginPath(); x.arc(184, 296, 24, 0, 7); x.fill(); x.fillRect(160, 316, 48, 60);
    x.strokeStyle = '#6a4a2a'; x.lineWidth = 5; for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(46 + k * 50, 156); x.lineTo(46 + k * 50, 376); x.stroke(); } for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(46, 156 + k * 55); x.lineTo(246, 156 + k * 55); x.stroke(); }
    // the door
    x.fillStyle = '#c8a040'; x.beginPath(); x.moveTo(300, 512); x.lineTo(300, 230); x.arc(380, 230, 80, Math.PI, 0); x.lineTo(460, 512); x.fill();
    x.fillStyle = '#6a3a1e'; x.beginPath(); x.moveTo(310, 512); x.lineTo(310, 232); x.arc(380, 232, 70, Math.PI, 0); x.lineTo(450, 512); x.fill();
    x.fillStyle = '#ffd88a'; x.beginPath(); x.arc(380, 232, 44, Math.PI, 0); x.fill();
    x.strokeStyle = '#4a2a14'; x.lineWidth = 4; for (const yy of [300, 380, 450]) { x.beginPath(); x.moveTo(316, yy); x.lineTo(444, yy); x.stroke(); }
    x.fillStyle = '#ffd76a'; x.beginPath(); x.arc(428, 390, 9, 0, 7); x.fill();
    x.fillStyle = '#5a5a6a'; x.fillRect(0, 486, 512, 26);
  });
}
function cauldronSignTex() {
  return canvasTex(256, 256, (x) => {
    x.fillStyle = '#2a1a10'; rr(x, 0, 0, 256, 256, 18); x.fillStyle = '#c8a040'; rr(x, 8, 8, 240, 240, 14); x.fillStyle = '#3a2618'; rr(x, 16, 16, 224, 224, 10);
    // a fat black cauldron with a drip and steam
    x.fillStyle = '#1a1a22'; x.beginPath(); x.ellipse(128, 120, 66, 54, 0, 0, 7); x.fill(); x.fillStyle = '#3a3a48'; x.fillRect(58, 66, 140, 14);
    x.fillStyle = '#7ad0ff'; x.beginPath(); x.moveTo(160, 172); x.quadraticCurveTo(170, 196, 160, 204); x.quadraticCurveTo(150, 196, 160, 172); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 5; x.beginPath(); x.moveTo(100, 60); x.bezierCurveTo(90, 40, 116, 34, 104, 16); x.moveTo(150, 60); x.bezierCurveTo(140, 40, 166, 34, 154, 16); x.stroke();
    rtlText(x, 'הקלחת הדולפת', 128, 222, 28, '#ffd76a', 210);
  });
}

export function buildStreet() {
  const g = new Group(); g.name = 'adv-b3street';
  // the night sky dome (follows the camera) + the moon
  const dome = new Mesh(new SphereGeometry(420, 24, 14), new MeshBasicMaterial({ map: skyTex(), side: BackSide, fog: false, depthWrite: false }));
  dome.name = 'sky-dome'; dome.renderOrder = -5; dome.frustumCulled = false; g.add(dome);
  const moon = new Mesh(new PlaneGeometry(60, 60), new MeshBasicMaterial({ map: moonTex(), transparent: true, fog: false, depthWrite: false, blending: AdditiveBlending }));
  moon.position.set(-60, 150, -330); moon.lookAt(0, 0, 0); moon.name = 'moon'; moon.renderOrder = -4; g.add(moon);
  // the road + pavements (one plane), the house fronts (both sides, one material; their u runs toward +z on both)
  const rT = roadTex(); rT.repeat.set(1, 50);
  const road = new Mesh(new PlaneGeometry(15, 400).rotateX(-Math.PI / 2), new MeshStandardMaterial({ map: rT, roughness: 0.9 })); road.name = 'road'; g.add(road);
  const hT = housesTex(); hT.repeat.set(25, 1);
  const front = (sx) => { const p = new PlaneGeometry(400, 12); p.rotateY(sx > 0 ? -Math.PI / 2 : Math.PI / 2); p.translate(sx * 7.5, 6, 0);
    if (sx < 0) { const uv = p.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); } return p; };
  const houses = new Mesh(mergeGeometries([front(1), front(-1)], false), new MeshBasicMaterial({ map: hT, transparent: true, alphaTest: 0.1 })); houses.name = 'houses'; g.add(houses);
  // lamp posts along both pavements (instanced; the quest scrolls them) + their warm glows (instanced additive cards)
  const LP = [];
  LP.push(paint(place(new CylinderGeometry(0.09, 0.13, 4.2, 8), 0, 2.1, 0), 0x2e2b40));
  LP.push(paint(place(new CylinderGeometry(0.22, 0.26, 0.3, 8), 0, 0.15, 0), 0x2e2b40));
  LP.push(paint(place(new BoxGeometry(0.42, 0.5, 0.42), 0, 4.45, 0), 0xd8c890));
  LP.push(paint(place(new ConeGeometry(0.36, 0.3, 4), 0, 4.85, 0, 0, Math.PI / 4, 0), 0x2e2b40));
  const lamps = new InstancedMesh(merge(LP), vc({ roughness: 0.7, emissive: 0x302810 }), NLAMP); lamps.name = 'lamp-posts'; lamps.frustumCulled = false; g.add(lamps);
  const glowT = canvasTex(64, 64, (x) => { const q = x.createRadialGradient(32, 32, 0, 32, 32, 32); q.addColorStop(0, 'rgba(255,230,160,1)'); q.addColorStop(0.35, 'rgba(255,200,110,.55)'); q.addColorStop(1, 'rgba(255,180,90,0)'); x.fillStyle = q; x.fillRect(0, 0, 64, 64); });
  const glows = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }), NLAMP);
  glows.name = 'lamp-glows'; glows.frustumCulled = false; glows.renderOrder = 2; g.add(glows);
  // the bus stop sign (pole + a round purple sign with a wand)
  const stop = new Group(); stop.name = 'stop-sign'; stop.position.set(SIGN.x, 0, SIGN.z); g.add(stop);
  stop.add(new Mesh(merge([paint(place(new CylinderGeometry(0.07, 0.09, 2.6, 8), 0, 1.3, 0), 0x2e2b40), paint(place(new CylinderGeometry(0.2, 0.24, 0.12, 10), 0, 0.06, 0), 0x2e2b40)]), vc()));
  const signFace = new Mesh(new PlaneGeometry(1.3, 1.3), new MeshBasicMaterial({ map: stopSignTex(), transparent: true, alphaTest: 0.1, side: DoubleSide }));
  signFace.position.set(0, 2.9, 0); signFace.rotation.y = Math.PI + 0.5; stop.add(signFace);
  // the bus, Harry and Ron at the kerb
  const bus = buildBus(); g.add(bus.root);
  const ron = buildKid(0xc0521c), harry = buildKid(0x2a1a14, true);
  for (const k of [ron, harry]) { k.scale.setScalar(1.15); g.add(k); }
  // tickets (instanced, gold, they glow) + the safe-lane hoop
  const tT = ticketTex();
  const tickets = new InstancedMesh(new BoxGeometry(1.1, 0.56, 0.06), new MeshStandardMaterial({ map: tT, emissive: 0xffffff, emissiveMap: tT, emissiveIntensity: 0.55, roughness: 0.4 }), 4);
  tickets.name = 'tickets'; tickets.count = 0; tickets.frustumCulled = false; g.add(tickets);
  const hoop = new Mesh(new TorusGeometry(1.5, 0.13, 8, 30), new MeshBasicMaterial({ color: 0x9cffa0, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }));
  hoop.name = 'safe-hoop'; hoop.visible = false; hoop.frustumCulled = false; g.add(hoop);
  // obstacles: one per lane for each kind (the safe lane's is hidden)
  const obs = buildObstacles(); g.add(obs.g);
  // the Leaky Cauldron front (slides in along z for the last step)
  const pub = buildPub(); g.add(pub.g);
  noRay(g);
  return { g, P: { dome, moon, road, rT, houses, hT, lamps, glows, stop, signFace, bus, ron, harry, tickets, hoop, obs, pub } };
}

// ---------------- obstacles ----------------
function buildObstacles() {
  const g = new Group(); g.name = 'obstacles';
  // the hanging pub sign: a beam high over the road (all lanes), a painted board on chains under it in each blocked lane
  const sign = new Group(); sign.name = 'obs-sign'; g.add(sign);
  const beam = new Mesh(merge([paint(place(new BoxGeometry(15, 0.32, 0.32), 0, 6.4, 0), 0x4a2e1c), ...[-1, 1].map(sx => paint(place(new BoxGeometry(0.3, 6.6, 0.3), sx * 6.9, 3.3, 0), 0x4a2e1c))]), vc());
  sign.add(beam);
  const sMat = new MeshStandardMaterial({ map: pubSignTex(), roughness: 0.7 }), chainMat = vc({ roughness: 0.5, metalness: 0.4 });
  const boards = LANES.map((lx) => {
    const b = new Group(); b.position.set(lx, 6.25, 0); sign.add(b);
    const m = new Mesh(new BoxGeometry(1.9, 1.45, 0.12).translate(0, -2.6, 0), sMat); b.add(m);
    b.add(new Mesh(merge([-0.7, 0.7].map(x => paint(place(new CylinderGeometry(0.03, 0.03, 1.9, 4), x, -0.95, 0), 0x8a8a96))), chainMat));
    return b;
  });
  // the lamp-post pair: a fat friendly lamp post standing in each blocked lane
  const lamp = new Group(); lamp.name = 'obs-lamp'; g.add(lamp);
  const lpGeo = merge([paint(place(new CylinderGeometry(0.16, 0.24, 4.4, 10), 0, 2.2, 0), 0x2e2b40), paint(place(new CylinderGeometry(0.42, 0.5, 0.4, 10), 0, 0.2, 0), 0x2e2b40),
    paint(place(new ConeGeometry(0.6, 0.45, 6), 0, 5.25, 0), 0x2e2b40), paint(place(new TorusGeometry(0.3, 0.05, 5, 10), 0, 3.6, 0, Math.PI / 2, 0, 0), 0xc8a040)]);
  const lpMat = vc({ roughness: 0.6 }), lanternMat = new MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd080, emissiveIntensity: 0.9 });
  const posts = LANES.map((lx) => { const p = new Group(); p.position.x = lx; lamp.add(p); p.add(new Mesh(lpGeo, lpMat)); p.add(new Mesh(new BoxGeometry(0.62, 0.66, 0.62).translate(0, 4.75, 0), lanternMat)); return p; });
  // the pigeons: round, grey and friendly, flapping slowly (instanced: 4 per blocked lane)
  const PG = [];
  PG.push(paint(place(S(10, 8), 0, 0, 0, 0, 0, 0, 0.36, 0.3, 0.42), 0x9a9ab0));
  PG.push(paint(place(S(10, 8), 0, 0.26, -0.3, 0, 0, 0, 0.22), 0x8a8aa8));
  PG.push(paint(place(new ConeGeometry(0.07, 0.18, 6), 0, 0.22, -0.55, -Math.PI / 2, 0, 0), 0xf0a030));
  for (const sx of [-1, 1]) { PG.push(paint(place(S(6, 4), sx * 0.09, 0.32, -0.47, 0, 0, 0, 0.06), 0xffffff)); PG.push(paint(place(S(6, 4), sx * 0.09, 0.32, -0.52, 0, 0, 0, 0.03), 0x141018));
    PG.push(paint(place(S(8, 4), sx * 0.42, 0.08, 0, 0, 0, sx * 0.4, 0.34, 0.06, 0.24), 0x7a7a98)); }
  PG.push(paint(place(S(6, 4), 0, 0.14, -0.4, 0, 0, 0, 0.16, 0.08, 0.06), 0x6ab0a0));   // a shiny green neck patch
  const birds = new InstancedMesh(merge(PG), vc({ roughness: 0.8 }), 12); birds.name = 'obs-birds'; birds.count = 0; birds.frustumCulled = false; g.add(birds);
  for (const o of [sign, lamp]) o.visible = false;
  g.traverse(m => { if (m.isMesh) m.frustumCulled = false; });
  return { g, sign, boards, lamp, posts, birds };
}

// ---------------- the Leaky Cauldron front (a facade + a hanging sign; the door is on the street side, facing -x) ----------------
function buildPub() {
  const g = new Group(); g.name = 'leaky-cauldron'; g.visible = false;
  const W = 6.0, H = 7.0;
  const frame = new Mesh(merge([paint(place(new BoxGeometry(0.7, H, W + 0.6), 7.55, H / 2, -10.6), 0x2a1a10), paint(place(new BoxGeometry(1.2, 0.4, W + 1.0), 7.3, H + 0.2, -10.6), 0x3a2618),
    paint(place(new BoxGeometry(1.6, 0.18, 0.18), PUB_SIGN.x + 0.8, PUB_SIGN.y + 1.0, PUB_SIGN.z), 0x2a1a10)]), vc());
  g.add(frame);
  const face = new Mesh(new PlaneGeometry(W, H).rotateY(-Math.PI / 2).translate(7.18, H / 2, -10.6), new MeshBasicMaterial({ map: cauldronFrontTex() })); face.name = 'pub-front'; g.add(face);
  const sign = new Mesh(new PlaneGeometry(1.7, 1.7), new MeshBasicMaterial({ map: cauldronSignTex(), side: DoubleSide })); sign.name = 'pub-sign';
  sign.position.set(PUB_SIGN.x, PUB_SIGN.y, PUB_SIGN.z); sign.rotation.y = -Math.PI / 2; g.add(sign);
  const lantern = new Mesh(merge([place(new BoxGeometry(0.36, 0.46, 0.36), 6.9, 2.9, -7.2), place(new BoxGeometry(0.36, 0.46, 0.36), 6.9, 2.9, -14.0)]), new MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffc070, emissiveIntensity: 1.0 }));
  g.add(lantern);
  g.traverse(m => { if (m.isMesh) m.frustumCulled = false; });
  return { g, sign, face };
}
export { FONT };
