// The Hogwarts shower hall (HD): a bright, warm, tiled bathhouse off the Entrance Hall, in the
// spirit of the Prefects' bathroom. A place to PLAY, never to bathe: Harry stays in his robes,
// nobody else is ever in here (Peeves is kept out), and the fun is magical water.
//   showerDoor(g)      the oak door + towel sign on the Entrance Hall's west wall (+ its portal)
//   showerHall(room)   the room itself (14 x 7 m, 4.5 m high), built like the other rooms
//   createShowers(...) the play controller: runs ONLY while the hall is the active room
// Play: step under one of the seven shower heads (each does something different), the big brass
// tap wheel turns all seven on, bubbles float up and pop when tapped (🫧 counter, saved in
// hpShowers1), Harry gets a wet sparkle and a towel puff dries him, a rubber duck squeaks.
// Budget: the room draws in ~11 calls (tiles+ceiling, floor, brass, props, glass+lamps, light
// pools, haze, water streams, ONE pooled particle system capped at 400, tap wheel, duck); all
// textures are small canvases made once and cached; nothing is allocated per frame.
import {
  Group, Mesh, Object3D, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, CircleGeometry, TorusGeometry,
  TubeGeometry, ConeGeometry, CatmullRomCurve3, Vector3, Color, Matrix4, InstancedMesh, InstancedBufferAttribute,
  MeshStandardMaterial, MeshBasicMaterial, MeshBasicNodeMaterial, CanvasTexture, SRGBColorSpace, RepeatWrapping,
  DoubleSide, DynamicDrawUsage,
} from 'three';
import { texture, uv, instancedDynamicBufferAttribute } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from './interior-kit.js';
import { propMesh } from './room-film.js';
import * as fun from './fun.js';

const W = 14, D = 7, H = 4.5;                       // the hall (x along its length, z across)
const BAY_X = [-5.4, -3.9, -2.4, -0.9, 0.6, 2.1, 3.6];  // the seven open bays along the north wall
const HEAD_Y = 2.55, HEAD_Z = -2.75, BAY_FRONT = -2.05;
const MODES = ['water', 'bubbles', 'rainbow', 'gold', 'foam', 'houses', 'surprise'];
const HOUSE_RGB = [[0.95, 0.2, 0.24], [0.2, 0.42, 1.0], [1.0, 0.8, 0.18], [0.18, 0.75, 0.38]];   // Gryffindor, Ravenclaw, Hufflepuff, Slytherin
const WHEEL = { x: -W / 2 + 0.17, y: 1.35, z: 0 };
const DUCK = { x: 4.35, y: 1.345, z: -2.32 };
const NP = 400, FOAM_N = 48, POOL = NP - FOAM_N;   // hard particle cap: pool + foam mound blobs
const NAME = 'הַמִּקְלָחוֹת שֶׁל הוֹגְווֹרְטְס';
const KEY = 'hpShowers1';
const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew','Heebo',Arial,sans-serif";

const box = (w, h, d, x, y, z) => new BoxGeometry(w, h, d).translate(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = Math.random;

// ============================== canvas textures (made once) ==============================
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, repeat) {
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; }
  return t;
}
let _tiles = null, _floor = null, _glass = null, _atlas = null, _stream = null, _haze = null;

// Wall tiles, one texture for the whole wall height (v = y / H, u repeats every 1.2 m):
// bottle-green glazed tiles to 1.42 m, a dark band behind the brass rail, cream-white subway tiles
// with one green accent row, a green border and cream plaster at the top (the ceiling samples it).
function tilesTex() {
  if (_tiles) return _tiles;
  const C = canvas(256, 512), x = C.getContext('2d'), PX = 512 / H, row = (y) => Math.round(512 - y * PX);
  let seed = 11; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  x.fillStyle = '#e6dac2'; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '160,140,110' : '255,250,235'},${r() * 0.08})`; x.fillRect(r() * 256, r() * row(3.98), 3, 3); }
  const tiles = (y0, y1, tw, th, shades, grout, glaze) => {
    x.fillStyle = grout; x.fillRect(0, y0, 256, y1 - y0);
    for (let y = y1, k = 0; y > y0; y -= th, k++) {
      const off = (k % 2) * tw / 2, top = Math.max(y0, y - th);
      for (let xx = -off; xx < 256; xx += tw) {
        const s = shades[(r() * shades.length) | 0];
        x.fillStyle = s; x.fillRect(xx + 1, top + 1, tw - 2, y - top - 2);
        const gr = x.createLinearGradient(xx, top, xx + tw * 0.6, y);
        gr.addColorStop(0, `rgba(255,255,255,${glaze})`); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.06)');
        x.fillStyle = gr; x.fillRect(xx + 1, top + 1, tw - 2, y - top - 2);
      }
    }
  };
  tiles(row(3.92), row(1.62), 64, 17, ['#e4dfd2', '#e8e3d6', '#dfd9cb', '#e6e0d0', '#ddd6c6'], '#aaa392', 0.35);   // cream-white
  tiles(row(3.15), row(3.0), 32, 17, ['#1e5a40', '#225f44', '#1a5138'], '#bcb6a6', 0.3);                          // accent row
  x.fillStyle = '#184631'; x.fillRect(0, row(3.98), 256, row(3.92) - row(3.98));                                    // top border
  x.fillStyle = '#c9a046'; x.fillRect(0, row(3.95) - 1, 256, 2);
  tiles(row(1.42), row(0.12), 64, 17, ['#1d5a3f', '#21603f', '#195238', '#235f46', '#1b553c'], '#5f7466', 0.32);   // bottle green
  x.fillStyle = '#163d2b'; x.fillRect(0, row(1.62), 256, row(1.42) - row(1.62));                                    // band behind the rail
  x.fillStyle = '#123224'; x.fillRect(0, row(0.12), 256, 512 - row(0.12));                                          // skirting
  _tiles = tex(C); _tiles.wrapS = RepeatWrapping;
  return _tiles;
}

// Pale stone floor: big honed tiles (0.6 m; the texture covers 2.4 m), faint veins, light grout.
function floorTex() {
  if (_floor) return _floor;
  const C = canvas(512, 512), x = C.getContext('2d');
  let seed = 5; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  x.fillStyle = '#a69d8b'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const v = (r() - 0.5) * 18, b = 196 + v;
    x.fillStyle = `rgb(${b | 0},${(b - 7) | 0},${(b - 22) | 0})`; x.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
    for (let k = 0; k < 3; k++) {
      x.strokeStyle = `rgba(150,138,118,${0.12 + r() * 0.16})`; x.lineWidth = 1 + r() * 1.5; x.beginPath();
      const sx = i * 128 + r() * 128, sy = j * 128 + r() * 128; x.moveTo(sx, sy);
      x.quadraticCurveTo(sx + (r() - 0.5) * 120, sy + (r() - 0.5) * 120, sx + (r() - 0.5) * 140, sy + (r() - 0.5) * 140); x.stroke();
    }
    for (let k = 0; k < 90; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '120,110,95' : '250,245,235'},${r() * 0.14})`; x.fillRect(i * 128 + 2 + r() * 122, j * 128 + 2 + r() * 122, 2, 2); }
    const gr = x.createRadialGradient(i * 128 + 64, j * 128 + 54, 4, i * 128 + 64, j * 128 + 64, 90);
    gr.addColorStop(0, 'rgba(255,252,240,0.10)'); gr.addColorStop(1, 'rgba(255,252,240,0)');
    x.fillStyle = gr; x.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
  }
  _floor = tex(C, true); _floor.repeat.set(W / 2.4, D / 2.4);
  return _floor;
}

// One 512 px emissive canvas for every glowing surface: the stained-glass window (left half),
// the 'all showers' plaque, warm lamp glass, the door's frosted fanlight, the door sign with its
// towel icon, and the seven mode badges over the bays. Region rects in px: [x, y, w, h].
const R = { win: [0, 0, 256, 512], plaque: [256, 0, 256, 128], lamp: [256, 128, 64, 64], fan: [320, 128, 192, 64], sign: [256, 192, 256, 256] };
const badgeRect = (i) => [256 + 2 + i * 36, 452, 34, 34];
function glassTex() {
  if (_glass) return _glass;
  const C = canvas(512, 512), x = C.getContext('2d');
  let seed = 23; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512);
  // ---- the window: a mermaid's tail curling out of the waves under a sun, in leaded glass ----
  x.save(); x.beginPath(); x.rect(0, 0, 256, 512); x.clip();
  const lead = (w = 4) => { x.strokeStyle = '#120e0a'; x.lineWidth = w; x.lineJoin = 'round'; x.stroke(); };
  // background quarries: a jittered grid of panes, warm amber in the arch, aqua sky below
  const GX = 5, GY = 10, pts = [];
  for (let j = 0; j <= GY; j++) for (let i = 0; i <= GX; i++) {
    const edge = i === 0 || i === GX || j === 0 || j === GY;
    pts.push([i * 256 / GX + (edge ? 0 : (r() - 0.5) * 30), j * 512 / GY + (edge ? 0 : (r() - 0.5) * 26)]);
  }
  const P = (i, j) => pts[j * (GX + 1) + i];
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.lineTo(...c); x.lineTo(...d); x.closePath();
    const t = j / GY, h = t < 0.22 ? 38 + r() * 14 : 168 + r() * 22, s = t < 0.22 ? 80 : 45 + r() * 20, l = t < 0.22 ? 62 + r() * 10 : 66 + r() * 10;
    x.fillStyle = `hsl(${h},${s}%,${l}%)`; x.fill(); lead(3);
  }
  // the sun in the arch, with rays
  x.save(); x.translate(128, 92);
  for (let k = 0; k < 12; k++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(-9, 34); x.lineTo(0, 78); x.lineTo(9, 34); x.closePath(); x.fillStyle = k % 2 ? '#ffc23a' : '#ff9a2a'; x.fill(); lead(3); }
  x.beginPath(); x.arc(0, 0, 34, 0, 7); x.fillStyle = '#ffd84a'; x.fill(); lead(4);
  x.restore();
  // waves: three scalloped bands
  const wave = (y0, amp, col, ph) => {
    x.beginPath(); x.moveTo(0, 512); x.lineTo(0, y0);
    for (let k = 0; k <= 6; k++) { const xx = k * 256 / 6; x.quadraticCurveTo(xx - 256 / 12, y0 - amp * (k % 2 ? 1 : -0.4) - ph, xx, y0); }
    x.lineTo(256, 512); x.closePath(); x.fillStyle = col; x.fill(); lead(4);
  };
  wave(372, 22, '#2e8fb0', 4); wave(412, 20, '#1d6f9a', -3); wave(452, 18, '#175a86', 2);
  // the mermaid's tail curling up out of the water, scales and a two-lobed fin
  x.beginPath(); x.moveTo(84, 420); x.bezierCurveTo(70, 340, 112, 282, 146, 246); x.lineTo(168, 258); x.bezierCurveTo(138, 296, 118, 342, 128, 420); x.closePath();
  const tg = x.createLinearGradient(80, 420, 170, 250); tg.addColorStop(0, '#1f9a7a'); tg.addColorStop(1, '#4fd0a0'); x.fillStyle = tg; x.fill();
  x.save(); x.clip(); x.strokeStyle = 'rgba(10,60,50,0.55)'; x.lineWidth = 2;
  for (let yy = 250; yy < 420; yy += 12) for (let xx = 70; xx < 180; xx += 14) { x.beginPath(); x.arc(xx + ((yy / 12) % 2) * 7, yy, 7, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); }
  x.restore(); x.beginPath(); x.moveTo(84, 420); x.bezierCurveTo(70, 340, 112, 282, 146, 246); x.lineTo(168, 258); x.bezierCurveTo(138, 296, 118, 342, 128, 420); lead(4);
  x.beginPath(); x.moveTo(146, 246); x.quadraticCurveTo(112, 236, 98, 188); x.quadraticCurveTo(140, 200, 157, 236); x.quadraticCurveTo(176, 196, 214, 198); x.quadraticCurveTo(196, 238, 168, 258); x.closePath();
  x.fillStyle = '#7fe0c0'; x.fill(); lead(4);
  for (const [a, b, c2, d2] of [[150, 240, 112, 198], [160, 240, 200, 206]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d2); x.strokeStyle = 'rgba(20,90,70,.7)'; x.lineWidth = 2; x.stroke(); }
  // a few golden splash drops
  for (const [dx, dy, rr] of [[60, 330, 7], [196, 320, 6], [210, 360, 5], [44, 370, 5], [180, 290, 4]]) { x.beginPath(); x.arc(dx, dy, rr, 0, 7); x.fillStyle = '#fff0a0'; x.fill(); lead(2); }
  // age: a warm patina, uneven darker panes, grime toward the edges
  x.fillStyle = 'rgba(255,190,110,0.10)'; x.fillRect(0, 0, 256, 512);
  for (let k = 0; k < 26; k++) { x.fillStyle = `rgba(60,40,20,${0.05 + r() * 0.1})`; x.beginPath(); x.arc(r() * 256, r() * 512, 8 + r() * 26, 0, 7); x.fill(); }
  const eg = x.createRadialGradient(128, 260, 120, 128, 260, 300); eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(30,18,6,0.35)'); x.fillStyle = eg; x.fillRect(0, 0, 256, 512);
  x.strokeStyle = '#120e0a'; x.lineWidth = 6; x.strokeRect(0, 0, 256, 512);
  x.restore();
  // ---- enamel plaque over the tap wheel ----
  const enamel = ([rx, ry, rw, rh], bg, rad = 18) => {
    x.fillStyle = '#8a6a2a'; x.beginPath(); x.roundRect(rx + 2, ry + 2, rw - 4, rh - 4, rad); x.fill();
    x.fillStyle = '#d8b25a'; x.beginPath(); x.roundRect(rx + 6, ry + 6, rw - 12, rh - 12, rad - 3); x.fill();
    x.fillStyle = bg; x.beginPath(); x.roundRect(rx + 11, ry + 11, rw - 22, rh - 22, rad - 6); x.fill();
  };
  const text = (s, cx, cy, size, col, maxW) => {
    x.save(); x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${size}px ${FONT}`;
    const m = x.measureText(s).width; if (m > maxW) { x.translate(cx, cy); x.scale(maxW / m, 1); x.translate(-cx, -cy); }
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillText(s, cx + 2, cy + 2); x.fillStyle = col; x.fillText(s, cx, cy); x.restore();
  };
  enamel(R.plaque, '#1d4a34');
  text('כָּל הַמִּקְלָחוֹת!', 384, 66, 40, '#f4e6b8', 210);
  // ---- warm lamp glass ----
  { const [lx, ly] = R.lamp, gr = x.createRadialGradient(lx + 32, ly + 32, 2, lx + 32, ly + 32, 40); gr.addColorStop(0, '#fff6dc'); gr.addColorStop(1, '#ffc878'); x.fillStyle = gr; x.fillRect(lx, ly, 64, 64); }
  // ---- frosted fanlight (steam-lit) ----
  { const [fx, fy, fw, fh] = R.fan; x.fillStyle = '#f2e2c4'; x.fillRect(fx, fy, fw, fh); for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(255,255,255,${r() * 0.25})`; x.fillRect(fx + r() * fw, fy, 2, fh); } }
  // ---- the door sign: a towel on a rail and the word ----
  { const [sx, sy, sw] = R.sign; enamel(R.sign, '#d9ceb0', 26);
    const cx = sx + sw / 2;
    x.strokeStyle = '#8a6a2a'; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - 62, sy + 52); x.lineTo(cx + 62, sy + 52); x.stroke();   // brass rail
    x.fillStyle = '#f7f2e6'; x.beginPath(); x.roundRect(cx - 50, sy + 48, 100, 104, [6, 6, 18, 18]); x.fill();                                              // the towel
    x.strokeStyle = '#7a6a50'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#b8242e'; x.fillRect(cx - 50, sy + 112, 100, 12); x.fillStyle = '#e0b030'; x.fillRect(cx - 50, sy + 128, 100, 7);                  // stripes
    x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(cx - 50, sy + 56, 22, 92);
    for (const [dx, dy] of [[-74, 96], [72, 80], [80, 120]]) { x.fillStyle = '#3a8ed8'; x.beginPath(); x.moveTo(cx + dx, sy + dy - 12); x.quadraticCurveTo(cx + dx + 9, sy + dy + 2, cx + dx, sy + dy + 6); x.quadraticCurveTo(cx + dx - 9, sy + dy + 2, cx + dx, sy + dy - 12); x.fill(); }
    text('מִקְלָחוֹת', cx, sy + 200, 50, '#1d4a34', 200); }
  // ---- the seven mode badges ----
  for (let i = 0; i < 7; i++) {
    const [bx, by, bw] = badgeRect(i), cx = bx + bw / 2, cy = by + bw / 2, rr = bw / 2 - 1;
    x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.fillStyle = '#c9a046'; x.fill();
    x.beginPath(); x.arc(cx, cy, rr - 3, 0, 7);
    if (i === 5) { x.save(); x.clip(); ['#c8303a', '#2f64d8', '#f2c230', '#2fa05a'].forEach((c, k) => { x.fillStyle = c; x.fillRect(cx - rr + (k % 2) * rr, cy - rr + (k >> 1) * rr, rr, rr); }); x.restore(); continue; }
    x.fillStyle = ['#2f86d8', '#7fd6f0', '#ffffff', '#3a2a10', '#f4f4f8', '', '#6a3ab0'][i]; x.fill();
    x.save(); x.beginPath(); x.arc(cx, cy, rr - 3, 0, 7); x.clip();
    if (i === 0) { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(cx, cy - 10); x.quadraticCurveTo(cx + 8, cy + 3, cx, cy + 8); x.quadraticCurveTo(cx - 8, cy + 3, cx, cy - 10); x.fill(); }
    if (i === 1) for (const [dx, dy, rb] of [[-5, 3, 6], [5, -4, 5], [4, 7, 3]]) { x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(cx + dx, cy + dy, rb, 0, 7); x.stroke(); }
    if (i === 2) ['#e8343c', '#ff9a2a', '#f2d230', '#3ab05a', '#2f64d8', '#7a3ab0'].forEach((c, k) => { x.strokeStyle = c; x.lineWidth = 2.4; x.beginPath(); x.arc(cx, cy + 8, 13 - k * 2.2, Math.PI, 0); x.stroke(); });
    if (i === 3) { x.fillStyle = '#ffd84a'; x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rs = k % 2 ? 5 : 12; x.lineTo(cx + Math.cos(a) * rs, cy + Math.sin(a) * rs); } x.fill(); }
    if (i === 4) for (const [dx, dy, rb] of [[-6, 3, 6], [0, -2, 7], [7, 3, 6]]) { x.fillStyle = '#cfd6e0'; x.beginPath(); x.arc(cx + dx, cy + dy + 1, rb, 0, 7); x.fill(); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(cx + dx, cy + dy, rb - 1, 0, 7); x.fill(); }
    if (i === 6) { x.fillStyle = '#ffe9a8'; x.font = `bold 24px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', cx, cy + 1); }
    x.restore();
  }
  _glass = tex(C);
  return _glass;
}
let _glassMat = null;
function glassMat() {
  if (_glassMat) return _glassMat;
  _glassMat = new MeshStandardMaterial({ color: 0x050505, roughness: 0.35, emissive: 0xffffff, emissiveMap: glassTex(), emissiveIntensity: 1.0 });
  _glassMat.name = 'showers-glass';
  return _glassMat;
}
// map a geometry's 0..1 uvs into a canvas region [x, y, w, h] of the 512 glass canvas
function uvTo(geo, [rx, ry, rw, rh]) {
  const u = geo.attributes.uv;
  for (let i = 0; i < u.count; i++) u.setXY(i, (rx + u.getX(i) * rw) / 512, 1 - (ry + (1 - u.getY(i)) * rh) / 512);
  return geo;
}

// Particle atlas, 2x2 cells: soft dot (drops), soap bubble, sparkle star, fluffy puff.
function atlasTex() {
  if (_atlas) return _atlas;
  const C = canvas(128, 128), x = C.getContext('2d');
  const radial = (cx, cy, r0, stops) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r0); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
  x.fillStyle = radial(32, 32, 30, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, 0, 64, 64);
  // bubble: a faint body, a bright iridescent rim, a highlight
  x.fillStyle = radial(96, 32, 28, [[0, 'rgba(220,240,255,.12)'], [0.72, 'rgba(230,245,255,.22)'], [0.86, 'rgba(255,255,255,.95)'], [0.93, 'rgba(255,230,250,.7)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(64, 0, 64, 64);
  x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.ellipse(86, 21, 6, 3.5, -0.7, 0, 7); x.fill();
  x.fillStyle = 'rgba(190,230,255,.5)'; x.beginPath(); x.arc(104, 42, 3, 0, 7); x.fill();
  // sparkle: a four-point star on a glow
  x.fillStyle = radial(32, 96, 24, [[0, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, 64, 64, 64);
  x.fillStyle = '#fff'; x.beginPath();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? 4 : 30; x.lineTo(32 + Math.cos(a) * rr, 96 + Math.sin(a) * rr); } x.fill();
  // puff: overlapping soft lobes, a touch of shade underneath
  for (const [cx, cy, rr, c] of [[96, 102, 22, '205,212,222'], [84, 94, 17, '255,255,255'], [104, 92, 18, '255,255,255'], [95, 86, 16, '255,255,255'], [96, 98, 20, '250,252,255']]) { x.fillStyle = radial(cx, cy, rr, [[0, `rgba(${c},1)`], [0.6, `rgba(${c},.85)`], [1, `rgba(${c},0)`]]); x.fillRect(64, 64, 64, 64); }
  _atlas = tex(C);
  return _atlas;
}
const CELL = [[0, 0.5], [0.5, 0.5], [0, 0], [0.5, 0]];   // uv offsets of the four cells (dot, bubble, star, puff)

function streamTex() {
  if (_stream) return _stream;
  const C = canvas(64, 128), x = C.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const xx = Math.random() * 64, w = 1 + Math.random() * 2.5, y0 = Math.random() * 128, len = 20 + Math.random() * 90;
    const g = x.createLinearGradient(0, y0, 0, y0 + len); const a = 0.35 + Math.random() * 0.6;
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(xx, y0, w, len); x.fillRect(xx, y0 - 128, w, len);
  }
  _stream = tex(C, true);
  return _stream;
}
function hazeTex() {
  if (_haze) return _haze;
  const C = canvas(256, 256), x = C.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const cx = Math.random() * 256, cy = Math.random() * 256, rr = 20 + Math.random() * 60;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rr); g.addColorStop(0, `rgba(255,255,255,${0.1 + Math.random() * 0.12})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(cx + ox - rr, cy + oy - rr, rr * 2, rr * 2);
    }
  }
  _haze = tex(C, true);
  return _haze;
}

// Planar uvs for the tiled surfaces, from room coordinates: u along the wall (1.2 m per repeat),
// v = height / H, so the green dado, the brass line and the white field line up everywhere.
function tileUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const along = ay > ax && ay > az ? p.getX(i) : ax > az ? p.getZ(i) : p.getX(i);
    u.setXY(i, along / 1.2, clamp(p.getY(i) / H, 0.004, 0.994));
  }
  return geo;
}

let _brass = null, _tileMat = null, _floorMat = null;
const brassMat = () => _brass || (_brass = Object.assign(new MeshStandardMaterial({ color: 0xc89a42, metalness: 0.85, roughness: 0.3 }), { name: 'showers-brass' }));
const tileMat = () => _tileMat || (_tileMat = Object.assign(new MeshStandardMaterial({ map: tilesTex(), roughness: 0.24, metalness: 0 }), { name: 'showers-tiles' }));
const floorMat = () => _floorMat || (_floorMat = Object.assign(new MeshStandardMaterial({ map: floorTex(), roughness: 0.3, metalness: 0 }), { name: 'showers-floor' }));

// ============================== the door in the Entrance Hall ==============================
// West wall (inner face x -7.5), centred z 7: between the torches at z 3 and 9 and clear below the
// long Ravenclaw banner (z 5, its hem 4.2 m up). The sign hangs beside the door, under the z 9 torch.
export const HALL_DOOR = { x: -7.5, z: 7 };
export function showerDoor(g) {
  const X = HALL_DOOR.x, Z = HALL_DOOR.z;
  const add = (geo, mat) => { const m = new Mesh(geo, mat); g.add(m); return m; };
  add(box(0.08, 2.4, 1.5, X + 0.04, 1.2, Z), MAT.wood);                                          // oak leaf
  for (const dz of [-0.375, 0, 0.375]) add(box(0.012, 2.3, 0.025, X + 0.085, 1.2, Z + dz), MAT.dark);   // plank joints
  for (const y of [0.45, 1.95]) add(box(0.014, 0.08, 1.42, X + 0.09, y, Z), MAT.dark);          // iron straps
  for (const s of [-1, 1]) add(box(0.24, 2.4, 0.26, X + 0.12, 1.2, Z + s * 0.88), MAT.stone);   // jambs
  const arch = new TorusGeometry(0.88, 0.13, 6, 18, Math.PI); arch.rotateY(Math.PI / 2); arch.translate(X + 0.12, 2.4, Z); add(arch, MAT.stone);
  const fan = uvTo(new CircleGeometry(0.75, 18, 0, Math.PI), R.fan); fan.rotateY(Math.PI / 2); fan.translate(X + 0.03, 2.4, Z); add(fan, glassMat());   // frosted, steam-lit fanlight
  add(new TorusGeometry(0.06, 0.014, 6, 12).rotateY(Math.PI / 2).translate(X + 0.12, 1.15, Z - 0.5), MAT.gold);                   // ring handle
  add(new CylinderGeometry(0.025, 0.025, 0.06, 8).rotateZ(Math.PI / 2).translate(X + 0.11, 1.22, Z - 0.5), MAT.gold);
  // the sign: a brass-framed enamel plate with a towel and 'מִקְלָחוֹת'
  add(box(0.03, 0.9, 0.9, X + 0.015, 1.85, Z + 1.45), MAT.gold);
  const sign = uvTo(new PlaneGeometry(0.8, 0.8), R.sign); sign.rotateY(Math.PI / 2); sign.translate(X + 0.035, 1.85, Z + 1.45); add(sign, glassMat());
  const glow = new Group(); glow.position.set(X + 1.1, 0.5, Z); glow.userData.light = { k: 'glow', c: 0xffe6c0, r: 1.8, a: 0.2 }; g.add(glow);
  return { portal: { x: X + 0.85, z: Z, r: 1.05, to: 'showers', at: { x: 4.2, z: 0, yaw: -Math.PI / 2 } } };
}

// ============================== the hall ==============================
export function showerHall(room) {
  const g = new Group(); g.name = 'showers-hall'; const cols = [];
  const T = [], B = [], P = [], GL = [];   // tiles, brass, vertex-coloured props, glass
  const wallBox = (w, d, x, z) => { T.push(box(w, H, d, x, H / 2, z)); cols.push({ type: 'box', x, z, hw: w / 2, hd: d / 2, angle: 0 }); };
  const t = 0.4;
  wallBox(W + 2 * t, t, 0, -D / 2 - t / 2); wallBox(W + 2 * t, t, 0, D / 2 + t / 2);
  wallBox(t, D, -W / 2 - t / 2, 0); wallBox(t, D, W / 2 + t / 2, 0);
  T.push(new PlaneGeometry(W, D).rotateX(Math.PI / 2).translate(0, H, 0));                         // ceiling (plaster band)
  // cornice: a tiled cove all round under the ceiling
  for (const [w, d, x, z] of [[W, 0.16, 0, -D / 2 + 0.08], [W, 0.16, 0, D / 2 - 0.08], [0.16, D, -W / 2 + 0.08, 0], [0.16, D, W / 2 - 0.08, 0]]) T.push(box(w, 0.14, d, x, H - 0.07, z));
  // low tiled dividers between the bays (no doors, no curtains), brass caps
  for (let i = 0; i <= 7; i++) {
    const x = BAY_X[0] - 0.75 + i * 1.5, dz = 1.3, cz = -D / 2 + dz / 2;
    T.push(box(0.12, 1.3, dz, x, 0.65, cz)); cols.push({ type: 'box', x, z: cz, hw: 0.08, hd: dz / 2, angle: 0 });
    B.push(box(0.16, 0.035, dz + 0.02, x, 1.318, cz + 0.01), new CylinderGeometry(0.05, 0.05, 1.34, 10).translate(x, 0.67, cz + dz / 2), new SphereGeometry(0.065, 10, 6).translate(x, 1.36, cz + dz / 2));
  }
  // brass trim line round the walls (split at the door), pipes, brackets
  const rail = (w, d, x, z) => B.push(box(w, 0.05, d, x, 1.47, z));
  rail(W, 0.035, 0, -D / 2 + 0.017); rail(W, 0.035, 0, D / 2 - 0.017); rail(0.035, D, -W / 2 + 0.017, 0);
  rail(0.035, 2.65, W / 2 - 0.017, -2.175); rail(0.035, 2.65, W / 2 - 0.017, 2.175);
  const pipeX = (x0, x1, y, z, r = 0.045) => B.push(new CylinderGeometry(r, r, x1 - x0, 10).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, y, z));
  const pipeZ = (z0, z1, y, x, r = 0.045) => B.push(new CylinderGeometry(r, r, z1 - z0, 10).rotateX(Math.PI / 2).translate(x, y, (z0 + z1) / 2));
  const pipeY = (y0, y1, x, z, r = 0.045) => B.push(new CylinderGeometry(r, r, y1 - y0, 10).translate(x, (y0 + y1) / 2, z));
  const elbow = (x, y, z, r = 0.07) => B.push(new SphereGeometry(r, 10, 8).translate(x, y, z));
  const PZ = -D / 2 + 0.09, PY = 3.35;
  pipeX(-W / 2 + 0.09, 4.9, PY, PZ); elbow(4.9, PY, PZ);
  for (let x = -6.2; x < 5; x += 1.5) B.push(box(0.05, 0.12, 0.1, x + 0.75, PY, PZ - 0.04));
  // the tap wheel's feed: across the west wall, up a riser, along to the north main
  pipeZ(-0.7, 0, WHEEL.y, -W / 2 + 0.09); elbow(-W / 2 + 0.09, WHEEL.y, -0.7); pipeY(WHEEL.y, PY, -W / 2 + 0.09, -0.7); elbow(-W / 2 + 0.09, PY, -0.7);
  pipeZ(PZ, -0.7, PY, -W / 2 + 0.09); elbow(-W / 2 + 0.09, PY, PZ);
  B.push(new CylinderGeometry(0.08, 0.1, 0.18, 12).rotateZ(Math.PI / 2).translate(-W / 2 + 0.09, WHEEL.y, 0));   // valve body
  // hot and cold along the south wall, low, behind the benches
  for (const [y, r] of [[0.24, 0.04], [0.38, 0.04]]) { pipeX(-W / 2 + 0.1, W / 2 - 0.1, y, D / 2 - 0.09, r); }
  // each bay: a curved gooseneck down to a big round shower head, a cross-handle tap, a badge
  BAY_X.forEach((bx, i) => {
    const curve = new CatmullRomCurve3([new Vector3(bx, PY, PZ), new Vector3(bx, 3.08, PZ), new Vector3(bx, 2.9, -3.24), new Vector3(bx, 2.84, -2.98), new Vector3(bx, 2.72, -2.79), new Vector3(bx, HEAD_Y + 0.08, HEAD_Z)]);
    B.push(new TubeGeometry(curve, 16, 0.034, 8, false));
    B.push(new CylinderGeometry(0.235, 0.15, 0.08, 22).translate(bx, HEAD_Y + 0.02, HEAD_Z), new TorusGeometry(0.235, 0.018, 6, 22).rotateX(Math.PI / 2).translate(bx, HEAD_Y - 0.02, HEAD_Z));
    B.push(new SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(bx, HEAD_Y + 0.05, HEAD_Z));
    P.push([new CircleGeometry(0.22, 22).rotateX(Math.PI / 2).translate(bx, HEAD_Y - 0.021, HEAD_Z), 0x4a3a24]);   // the rose, underneath
    const ty = 1.12, tz = -D / 2 + 0.05;
    B.push(new CylinderGeometry(0.05, 0.06, 0.08, 10).rotateX(Math.PI / 2).translate(bx + 0.42, ty, tz), box(0.2, 0.03, 0.03, bx + 0.42, ty, tz + 0.05), box(0.03, 0.2, 0.03, bx + 0.42, ty, tz + 0.05));
    GL.push(uvTo(new CircleGeometry(0.15, 18), badgeRect(i)).translate(bx, 1.86, -D / 2 + 0.012));
    B.push(new TorusGeometry(0.155, 0.016, 6, 18).translate(bx, 1.86, -D / 2 + 0.014));
  });
  // floor + the central brass drain grille line
  const fl = new Mesh(new PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat()); fl.receiveShadow = true; fl.name = 'showers-floor'; g.add(fl);
  P.push([box(11.8, 0.012, 0.16, -0.3, 0.006, 0), 0x2a241c]);
  for (const s of [-1, 1]) B.push(box(11.8, 0.016, 0.025, -0.3, 0.008, s * 0.092));
  for (let x = -6.15; x <= 5.55; x += 0.12) B.push(box(0.022, 0.014, 0.16, x, 0.009, 0));
  // two oak slat benches under the window wall
  const benches = [-2.6, 2.6];
  for (const bx of benches) {
    const bz = D / 2 - 0.5;
    for (let k = 0; k < 4; k++) P.push([box(2.2, 0.035, 0.085, bx, 0.45, bz - 0.15 + k * 0.1), k % 2 ? 0xa8743e : 0xb27c44]);
    for (const lx of [-0.95, 0, 0.95]) { for (const lz of [-0.15, 0.15]) P.push([box(0.06, 0.43, 0.06, bx + lx, 0.215, bz + lz), 0x6a4626]); P.push([box(0.06, 0.05, 0.36, bx + lx, 0.4, bz), 0x6a4626]); }
    P.push([box(2.0, 0.05, 0.04, bx, 0.14, bz), 0x6a4626]);
    cols.push({ type: 'box', x: bx, z: bz, hw: 1.12, hd: 0.24, angle: 0 });
  }
  // the towel shelf in the south-west corner: fluffy folded towels in the four house colours
  { const sx = -W / 2 + 1.0, sz = D / 2 - 0.32, OAK = 0x7a5230;
    for (const dx of [-0.55, 0.55]) for (const dz of [-0.16, 0.16]) P.push([box(0.05, 1.56, 0.05, sx + dx, 0.78, sz + dz), OAK]);
    for (const y of [0.12, 0.66, 1.2]) P.push([box(1.16, 0.03, 0.38, sx, y, sz), OAK]);
    const towel = (x, y, z, hex, stripe) => {
      P.push([box(0.4, 0.07, 0.27, x, y + 0.035, z), hex]);
      P.push([new CylinderGeometry(0.035, 0.035, 0.4, 8).rotateZ(Math.PI / 2).translate(x, y + 0.035, z - 0.135), hex]);   // the soft folded edge
      P.push([box(0.405, 0.071, 0.025, x, y + 0.035, z + 0.05), stripe]);
    };
    const HT = [[0x8a1622, 0xd9a830], [0x1c3c7a, 0xa8805a], [0xd8a820, 0x2a2420], [0x1a5a32, 0xb8bcc4]];
    HT.forEach(([hex, st], k) => { const x = sx + (k % 2 ? 0.27 : -0.27), y0 = k < 2 ? 0.675 : 1.215; for (let n = 0; n < 3; n++) towel(x + (n % 2) * 0.012, y0 + n * 0.074, sz, hex, st); });
    for (let n = 0; n < 4; n++) towel(sx + (n % 2 ? 0.27 : -0.27), 0.135 + (n >> 1) * 0.074, sz, 0xf2eee4, 0xd8d0c0);   // plain white ones below
    cols.push({ type: 'box', x: sx, z: sz, hw: 0.62, hd: 0.22, angle: 0 });
  }
  // the stained-glass window (south wall, centred): a mermaid's tail in the waves, warm light in
  { const ww = 1.3, wh = 1.95, th = wh + ww / 2, wy0 = 1.7, wz = D / 2 - 0.012;
    const pane = new PlaneGeometry(ww, wh), pu = pane.attributes.uv;
    for (let i = 0; i < pu.count; i++) pu.setXY(i, pu.getX(i) * 0.5, pu.getY(i) * wh / th);
    const head = new CircleGeometry(ww / 2, 18, 0, Math.PI), hp = head.attributes.position, hu = head.attributes.uv;
    for (let i = 0; i < hu.count; i++) hu.setXY(i, (hp.getX(i) / ww + 0.5) * 0.5, (wh + hp.getY(i)) / th);
    pane.translate(0, wy0 + wh / 2, 0); head.translate(0, wy0 + wh, 0);
    for (const p of [pane, head]) { p.rotateY(Math.PI); p.translate(0, 0, wz); GL.push(p); }
    for (const s of [-1, 1]) B.push(box(0.06, wh, 0.05, s * (ww / 2 + 0.03), wy0 + wh / 2, wz - 0.02));
    B.push(new TorusGeometry(ww / 2 + 0.03, 0.03, 6, 22, Math.PI).translate(0, wy0 + wh, wz - 0.02));
    P.push([box(ww + 0.3, 0.08, 0.2, 0, wy0 - 0.04, wz - 0.1), 0xd9ccb0]);
    const o = new Object3D(); o.position.set(0, 2.6, wz - 0.1); o.rotation.y = Math.PI; o.position.z = wz - 2.4; o.position.y = 0.5; o.userData.light = { k: 'glow', c: 0xffd9a0, r: 3, a: 0.16 }; g.add(o);
    const tint = new Object3D(); tint.position.set(0, 0.5, D / 2 - 1.2); tint.userData.light = { k: 'glow', c: 0x6fd8c0, r: 1.5, a: 0.16 }; g.add(tint);
  }
  // three warm wall lamps (two on the window wall, one over the tap wheel): brass arm + glass globe
  const lamps = [[-4.0, D / 2, 0, -1], [4.0, D / 2, 0, -1], [-W / 2, 0, 1, 0]];
  for (const [lx, lz, nx, nz] of lamps) {
    const ly = lx === -W / 2 ? 3.15 : 2.75, ox = lx + nx * 0.26, oz = lz + nz * 0.26;
    B.push(box(Math.abs(nx) * 0.26 + 0.04, 0.04, Math.abs(nz) * 0.26 + 0.04, lx + nx * 0.13, ly - 0.05, lz + nz * 0.13), box(nz ? 0.16 : 0.03, 0.2, nx ? 0.16 : 0.03, lx + nx * 0.015, ly - 0.05, lz + nz * 0.015));
    B.push(new CylinderGeometry(0.06, 0.09, 0.06, 12).translate(ox, ly + 0.13, oz), new CylinderGeometry(0.07, 0.05, 0.05, 12).translate(ox, ly - 0.12, oz));
    GL.push(uvTo(new SphereGeometry(0.13, 14, 10), R.lamp).translate(ox, ly, oz));
    const m = new Object3D(); m.position.set(ox, ly, oz); m.userData.light = { k: 'torch', c: 0xffd49a, wr: 2.6, wa: 0.26, fr: 3.6, fa: 0.2 }; g.add(m);
  }
  // the 'all showers' plaque above the tap wheel
  GL.push(uvTo(new PlaneGeometry(1.12, 0.56), R.plaque).rotateY(Math.PI / 2).translate(-W / 2 + 0.02, 2.25, 0));
  B.push(box(0.014, 0.6, 1.16, -W / 2 + 0.006, 2.25, 0));   // brass backing, its face 7 mm behind the plaque
  // the way back out: an oak door in the east end wall, cream stone surround, brass knob
  { const X = W / 2;
    P.push([box(0.06, 2.3, 1.2, X - 0.03, 1.15, 0), 0x6a4426]);
    for (const y of [0.6, 1.7]) for (const s of [-1, 1]) P.push([box(0.02, 0.7, 0.42, X - 0.065, y, s * 0.27), 0x5a3a20]);
    for (const s of [-1, 1]) P.push([box(0.1, 2.5, 0.16, X - 0.05, 1.25, s * 0.68), 0xd9ccb0]);
    P.push([box(0.1, 0.18, 1.52, X - 0.05, 2.5, 0), 0xd9ccb0]);
    B.push(new SphereGeometry(0.05, 10, 8).translate(X - 0.1, 1.1, 0.42), new CylinderGeometry(0.02, 0.02, 0.06, 8).rotateZ(Math.PI / 2).translate(X - 0.07, 1.1, 0.42));
    const gl = new Object3D(); gl.position.set(X - 1.2, 0.5, 0); gl.userData.light = { k: 'glow', c: 0xffd8a0, r: 1.6, a: 0.12 }; g.add(gl);
  }
  // build the static meshes: tiles (+ceiling), brass, props, glass
  const tiles = new Mesh(mergeGeometries(T.map(tileUV), false), tileMat()); tiles.name = 'showers-tiles'; tiles.receiveShadow = true; g.add(tiles);
  const brass = new Mesh(mergeGeometries(B.map(b => { const n = b.index ? b.toNonIndexed() : b; return n; }), false), brassMat()); brass.name = 'showers-brass'; g.add(brass);
  propMesh(g, P, 'showers-props');
  const glass = new Mesh(mergeGeometries(GL.map(q => { const n = q.index ? q.toNonIndexed() : q; if (!n.attributes.normal) n.computeVertexNormals(); return n; }), false), glassMat()); glass.name = 'showers-glass'; g.add(glass);
  // ---- the moving parts (each one draw call) ----
  // steam haze: three soft layers under the ceiling, drifting
  const hz = [];
  for (const [y, s] of [[3.75, 1], [4.0, 1.4], [4.28, 0.8]]) { const p = new PlaneGeometry(W - 0.3, D - 0.3).rotateX(Math.PI / 2); const u = p.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * 3 * s, u.getY(i) * 1.5 * s); p.translate(0, y, 0); hz.push(p); }
  const haze = new Mesh(mergeGeometries(hz, false), new MeshBasicMaterial({ map: hazeTex(), transparent: true, opacity: 0.2, depthWrite: false, side: DoubleSide, fog: false }));
  haze.name = 'showers-haze'; haze.renderOrder = 4; haze.raycast = () => {}; g.add(haze);
  // water streams: seven open cones, instanced, scrolling streaks tinted per shower
  const sg = new CylinderGeometry(0.15, 0.34, 1, 16, 1, true).translate(0, -0.5, 0);
  const streams = new InstancedMesh(sg, new MeshBasicMaterial({ map: streamTex(), transparent: true, opacity: 0.75, depthWrite: false, side: DoubleSide, fog: false }), 7);
  streams.name = 'showers-streams'; streams.renderOrder = 5; streams.frustumCulled = false; streams.raycast = () => {}; streams.instanceMatrix.setUsage(DynamicDrawUsage);
  { const m = new Matrix4().makeScale(0, 0, 0), c = new Color(1, 1, 1); for (let i = 0; i < 7; i++) { streams.setMatrixAt(i, m); streams.setColorAt(i, c); } }
  streams.visible = false; g.add(streams);
  // the ONE pooled particle system (water drops, bubbles, sparkles, steam, foam, towel puffs)
  const parts = particleMesh(); g.add(parts);
  // the big brass tap wheel (spins when you turn it) and the rubber duck (hops when tapped)
  const wheel = new Mesh(wheelGeo(), brassMat()); wheel.name = 'showers-wheel';
  wheel.position.set(WHEEL.x, WHEEL.y, WHEEL.z); wheel.rotation.y = Math.PI / 2; g.add(wheel);
  const duck = duckMesh(); duck.position.set(DUCK.x, DUCK.y, DUCK.z); duck.rotation.y = -Math.PI / 2 - 0.5; g.add(duck);
  // the wand (🪄) can wake the duck and the wheel too
  g.userData.enchant = [
    { id: 'duck', obj: duck, cast() { if (CTRL) CTRL.squeak(); return '🦆'; } },
    { id: 'tapwheel', obj: wheel, cast() { if (CTRL) CTRL.allOn(); return '🚿'; } },
  ];
  g.userData.showers = { group: g, haze, streams, parts, wheel, duck, glass };
  return room(g, cols, { x: 4.2, z: 0, yaw: -Math.PI / 2 }, {
    id: 'showers',
    portals: [{ x: W / 2 - 0.75, z: 0, r: 0.95, to: 'entrancehall', at: { x: HALL_DOOR.x + 1.6, z: HALL_DOOR.z, yaw: Math.PI / 2 } }],
  });
}

function wheelGeo() {
  const parts = [new TorusGeometry(0.36, 0.035, 8, 30), new CylinderGeometry(0.07, 0.07, 0.1, 14).rotateX(Math.PI / 2), new SphereGeometry(0.045, 10, 6).translate(0, 0, 0.06)];
  for (let k = 0; k < 4; k++) parts.push(new CylinderGeometry(0.018, 0.018, 0.7, 6).rotateZ(k * Math.PI / 4));
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; parts.push(new SphereGeometry(0.04, 8, 6).translate(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0)); }   // knobs to grip
  return mergeGeometries(parts.map(p => (p.index ? p.toNonIndexed() : p)), false);
}
function duckMesh() {
  const P = [], Y = 0xffd23f, O = 0xff8a1e;
  P.push([new SphereGeometry(0.1, 14, 10).scale(1.3, 0.82, 1).translate(0, 0.08, 0), Y]);
  P.push([new ConeGeometry(0.06, 0.1, 10).rotateZ(Math.PI / 2 + 0.6).translate(-0.13, 0.13, 0), Y]);          // tail flick
  P.push([new SphereGeometry(0.068, 14, 10).translate(0.075, 0.2, 0), Y]);
  P.push([new SphereGeometry(0.04, 10, 6).scale(1.5, 0.55, 1).translate(0.15, 0.19, 0), O]);                   // beak
  for (const s of [-1, 1]) { P.push([new SphereGeometry(0.014, 8, 6).translate(0.12, 0.225, s * 0.042), 0x101010]); P.push([new SphereGeometry(0.05, 8, 6).scale(1.2, 0.6, 0.5).translate(-0.01, 0.1, s * 0.085), 0xf2c230]); }
  const g = new Group(); g.name = 'showers-duck';
  const m = propMesh(g, P, 'showers-duck-body'); m.material.roughness = 0.35; m.scale.setScalar(1.35);
  return g;
}

// The particle mesh: one InstancedMesh of camera-facing quads on the 2x2 atlas. Per instance: a
// colour (instanceColor) and (cell u, cell v, alpha) in one small dynamic attribute.
function particleMesh() {
  const geo = new PlaneGeometry(1, 1);
  const cellA = new InstancedBufferAttribute(new Float32Array(NP * 3), 3); cellA.setUsage(DynamicDrawUsage);
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  const c = instancedDynamicBufferAttribute(cellA, 'vec3');
  mat.colorNode = texture(atlasTex(), uv().mul(0.5).add(c.xy));
  mat.opacityNode = c.z;
  const m = new InstancedMesh(geo, mat, NP);
  m.instanceMatrix.setUsage(DynamicDrawUsage);
  const z = new Matrix4().makeScale(0, 0, 0), col = new Color(1, 1, 1);
  for (let i = 0; i < NP; i++) { m.setMatrixAt(i, z); m.setColorAt(i, col); }
  m.instanceColor.setUsage(DynamicDrawUsage);
  m.userData.cell = cellA; m.count = 0; m.visible = false;
  m.frustumCulled = false; m.renderOrder = 6; m.raycast = () => {}; m.name = 'showers-fx';
  return m;
}

// ============================== play ==============================
// the hall's own draw calls: its visible meshes (each instanced mesh is one call), for tests
function roomTris(g) { let n = 0; g.traverse(o => { if (o.isMesh && o.visible && o.geometry) { const c = o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count; n += (c / 3) * (o.isInstancedMesh ? o.count : 1); } }); return Math.round(n); }
function roomDraws(g) { let n = 0; g.traverse(o => { if (o.isMesh && o.visible && (!o.isInstancedMesh || o.count > 0)) { let v = true; for (let p = o.parent; p && p !== g; p = p.parent) if (!p.visible) v = false; if (v) n++; } }); return n; }
let CTRL = null;
export function createShowers({ camera, player, interiors, delight, freecast, env }) {
  const pos = player.pos;
  let saved = { popped: 0, best: 0, visits: 0, quacks: 0 };
  try { saved = Object.assign(saved, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { /* private mode */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* private mode */ } };
  const debug = /[?&]debug=1/.test(location.search);
  let Hh = null, T = 0, speed = 1, FY = -200;
  // ---- per-bay state ----
  const bays = BAY_X.map((x, i) => ({ x, i, mode: MODES[i], hold: 0, on: false, k: 0, runs: 0, onT: 0, acc: new Float32Array(6), eff: MODES[i], house: 0, switches: 0, made: new Int32Array(7), seen: 0, houses: 0, hues: 0 }));
  let allT = 0, allRuns = 0, wheelSpin = 0, steam = 0, steamBoost = 0, foam = 0, foamMax = 0, wet = 0, wasUnder = false, towels = 0, wetSparks = 0;
  let duckHop = 0, quacks = 0, visitPopped = 0, splashes = 0, steamPuffs = 0, hissT = 0, lumK = 0, maxAlive = 0, maxDrawn = 0, popTaps = 0;
  let base = null;   // the room's ambient/hemi on entry (restored when we walk on to another room)
  // ---- particle pool: flat typed arrays, a free-list stack, nothing allocated per frame ----
  const S = 16, PD = new Float32Array(POOL * S), KIND = new Uint8Array(POOL), free = new Int16Array(POOL); let nFree = 0, alive = 0;
  const resetPool = () => { nFree = 0; for (let i = POOL - 1; i >= 0; i--) { free[nFree++] = i; PD[i * S + 6] = 0; } alive = 0; };
  resetPool();
  const K_DROP = 0, K_BUBBLE = 1, K_SPARK = 2, K_PUFF = 3, K_SPLASH = 4, K_STEAM = 5, K_FOAM = 6;
  const KCELL = [0, 1, 2, 3, 0, 3, 3];
  function emit(kind, x, y, z, vx, vy, vz, life, size, r, gg, b, grav = 0, drag = 0, grow = 0) {
    if (nFree <= 0) return -1;
    const i = free[--nFree], o = i * S;
    PD[o] = x; PD[o + 1] = y; PD[o + 2] = z; PD[o + 3] = vx; PD[o + 4] = vy; PD[o + 5] = vz; PD[o + 6] = life; PD[o + 7] = life;
    PD[o + 8] = size; PD[o + 9] = r; PD[o + 10] = gg; PD[o + 11] = b; PD[o + 12] = grav; PD[o + 13] = drag; PD[o + 14] = grow; PD[o + 15] = rnd() * 6.28;
    KIND[i] = kind; alive++;
    return i;
  }
  const kill = (i) => { PD[i * S + 6] = 0; free[nFree++] = i; alive--; };
  // foam mound blobs: fixed spots in a disc on bay 5's floor, shown by the foam level
  const FB = []; for (let k = 0; k < FOAM_N; k++) { const a = k * 2.39996, rr = 0.62 * Math.sqrt((k + 0.5) / FOAM_N); FB.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.8, 1 - (rr / 0.62) ** 2, 0.8 + ((k * 37) % 10) / 25]); }
  const FOAM_BAY = MODES.indexOf('foam');
  // ---- colours ----
  const col = new Color(), _m = new Matrix4(), _p = new Vector3(), _s = new Vector3(), _v = new Vector3();
  const hue = (h, l = 0.6) => col.setHSL(((h % 1) + 1) % 1, 0.95, l);
  // ---- DOM: the bubble counter (only while in the hall) ----
  let cntEl = null;
  function ensureDom() {
    if (cntEl) return;
    const css = document.createElement('style');
    css.textContent = `#shwCount{position:fixed;left:calc(18px + env(safe-area-inset-left));top:calc(138px + env(safe-area-inset-top));z-index:10;display:none;
      padding:4px 14px;border-radius:20px;background:rgba(30,20,70,.62);border:2px solid rgba(255,215,106,.75);color:#ffe9a8;font-size:22px;font-weight:bold;
      text-shadow:0 2px 0 #000;pointer-events:none;direction:rtl;font-family:inherit;transition:transform .18s cubic-bezier(.3,1.8,.5,1)}
    #shwCount.on{display:block} #shwCount.bump{transform:scale(1.25)}
    body.modalOn #shwCount,body.inMatch #shwCount,body.inSpell #shwCount{display:none !important}`;
    document.head.appendChild(css);
    cntEl = document.createElement('div'); cntEl.id = 'shwCount'; cntEl.setAttribute('aria-label', 'בּוּעוֹת'); document.body.appendChild(cntEl);
  }
  let shownN = -1, bumpT = 0;
  const showCount = () => { if (shownN !== saved.popped) { shownN = saved.popped; cntEl.textContent = '🫧 ' + saved.popped; } };
  // ---- taps on the 3D view: pop a bubble, squeak the duck, turn the wheel ----
  let downX = 0, downY = 0, downT = 0, downOn = false;
  const onDown = (e) => { if (e.target && e.target.id === 'view') { downOn = true; downX = e.clientX; downY = e.clientY; downT = performance.now(); } else downOn = false; };
  const onUp = (e) => { if (!downOn) return; downOn = false; if (Math.hypot(e.clientX - downX, e.clientY - downY) > 16 || performance.now() - downT > 700) return; tapAt(e.clientX, e.clientY); };
  const toScreen = (x, y, z, out) => { _v.set(x, y, z).project(camera); out.x = (_v.x * 0.5 + 0.5) * innerWidth; out.y = (-_v.y * 0.5 + 0.5) * innerHeight; out.z = _v.z; return out; };
  const sp = { x: 0, y: 0, z: 0 };
  const pxPerM = (x, y, z) => { const d = Math.max(0.5, camera.position.distanceTo(_p.set(x, y, z))); return innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360) * d); };
  function tapAt(cx, cy) {
    if (!Hh) return null;
    let best = -1, bd = 1e9, kind = null;
    for (let i = 0; i < POOL; i++) {
      const o = i * S; if (PD[o + 6] <= 0 || KIND[i] !== K_BUBBLE) continue;
      toScreen(PD[o], FY + PD[o + 1], PD[o + 2], sp); if (sp.z > 1) continue;
      const rad = Math.max(34, PD[o + 8] * pxPerM(PD[o], FY + PD[o + 1], PD[o + 2]) * 0.8), d = Math.hypot(sp.x - cx, sp.y - cy);
      if (d < rad && d < bd) { bd = d; best = i; kind = 'bubble'; }
    }
    const dk = Hh.duck.position; toScreen(dk.x, FY + dk.y + 0.15, dk.z, sp);
    if (sp.z < 1) { const d = Math.hypot(sp.x - cx, sp.y - cy), rad = Math.max(44, 0.3 * pxPerM(dk.x, FY + dk.y, dk.z)); if (d < rad && d < bd) { bd = d; kind = 'duck'; } }
    toScreen(WHEEL.x, FY + WHEEL.y, WHEEL.z, sp);
    if (sp.z < 1) { const d = Math.hypot(sp.x - cx, sp.y - cy), rad = Math.max(44, 0.42 * pxPerM(WHEEL.x, FY + WHEEL.y, WHEEL.z)); if (d < rad && d < bd) { bd = d; kind = 'wheel'; } }
    if (kind === 'bubble') pop(best);
    else if (kind === 'duck') squeak();
    else if (kind === 'wheel') allOn();
    return kind;
  }
  function pop(i) {
    const o = i * S, x = PD[o], y = PD[o + 1], z = PD[o + 2], s = PD[o + 8];
    kill(i);
    for (let k = 0; k < 7; k++) { const a = k * 0.9 + rnd(); emit(K_SPARK, x, y, z, Math.cos(a) * 0.9, 0.2 + rnd() * 0.6, Math.sin(a) * 0.9, 0.35 + rnd() * 0.2, s * 0.45, 1.1, 1.15, 1.3, -1.5, 2); }
    saved.popped++; visitPopped++; popTaps++; if (visitPopped > saved.best) saved.best = visitPopped; persist();
    bumpT = 0.18; if (cntEl) cntEl.classList.add('bump');
    fun.sfx.pop();
  }
  function squeak() {
    if (!Hh) return; duckHop = 0.65; quacks++; saved.quacks = (saved.quacks || 0) + 1; persist();
    fun.sfx.squeak(); setTimeout(() => { try { fun.sfx.squeak(); } catch { /* ignore */ } }, 170);
    const d = Hh.duck.position; for (let k = 0; k < 5; k++) emit(K_SPARK, d.x, d.y + 0.25, d.z, (rnd() - 0.5) * 0.8, 0.6 + rnd() * 0.5, (rnd() - 0.5) * 0.8, 0.6, 0.12, 1.6, 1.4, 0.4, -1.2, 1);
    fun.say(_p.set(d.x, FY + d.y + 0.75, d.z), 'קְוָואק! 🦆', 1.6, 'duck');
  }
  function allOn() {
    if (!Hh) return;
    allT = 12; allRuns++; wheelSpin = 1.6;
    for (const b of bays) b.hold = Math.max(b.hold, 12);
    fun.sfx.tune([523, 659, 784, 1047, 1319], 0.09, 'sine'); fun.sfx.noise(1.2, 0.08, 0.1, 2400, 0.6);
    fun.say(_p.set(WHEEL.x + 0.4, FY + 2.75, WHEEL.z), 'כָּל הַמִּקְלָחוֹת! 🚿', 2.2, 'wheel');
  }
  // spell hooks (freecast targets added at runtime; they answer only while the hall is the room)
  function nearestBay() { let bi = 0, bd = 1e9; for (const b of bays) { const d = Math.hypot(b.x - pos.x, HEAD_Z - pos.z); if (d < bd) { bd = d; bi = b.i; } } return bi; }
  function aguamenti() {
    const b = bays[nearestBay()]; b.hold = Math.max(b.hold, 6); splashes++;
    for (let k = 0; k < 34; k++) { const a = rnd() * 6.28, sp2 = 1 + rnd() * 2.2; emit(K_SPLASH, b.x + Math.cos(a) * 0.15, 0.08, HEAD_Z + Math.sin(a) * 0.15, Math.cos(a) * sp2 * 0.6, 2 + rnd() * 2.4, Math.sin(a) * sp2 * 0.6, 0.9, 0.09, 0.75, 0.9, 1.15, -7, 0.3); }
    fun.sfx.noise(0.8, 0.14, 0, 1400, 0.7);
  }
  function incendio() {
    steamBoost = 6; steamPuffs++;
    for (let k = 0; k < 30; k++) emit(K_STEAM, (rnd() - 0.5) * (W - 2), 0.6 + rnd() * 2.2, (rnd() - 0.5) * (D - 2), (rnd() - 0.5) * 0.4, 0.3 + rnd() * 0.3, (rnd() - 0.5) * 0.4, 3.5 + rnd() * 1.5, 0.8 + rnd() * 0.6, 1, 1, 1, 0, 0.2, 0.5);
    fun.sfx.noise(1.6, 0.16, 0, 900, 0.5); fun.sfx.poof();
  }
  const FI = freecast && freecast._internal;
  if (FI && Array.isArray(FI.TARGETS)) {
    FI.TARGETS.push({ id: 'shower-bay', spells: ['aguamenti'], at: (o) => o.set(BAY_X[nearestBay()], FY + 2.2, HEAD_Z), ok: () => !!Hh, cast: () => aguamenti() });
    FI.TARGETS.push({ id: 'shower-steam', spells: ['incendio'], at: (o) => o.set(pos.x + Math.sin(player.yaw) * 2, FY + 2.6, pos.z + Math.cos(player.yaw) * 2), ok: () => !!Hh && steamBoost < 4, cast: () => incendio() });
  }
  const lumosOn = () => { try { return !!(FI && FI.SP && FI.SP.lumos && FI.SP.lumos.isOn()); } catch { return false; } };

  function attach(h) {
    Hh = h; FY = h.group.position.y; ensureDom(); cntEl.classList.add('on'); shownN = -1; showCount();
    resetPool(); visitPopped = 0; saved.visits++; persist();
    for (const b of bays) { b.hold = 0; b.on = false; b.k = 0; b.acc.fill(0); }
    allT = 0; steam = 0; steamBoost = 0; foam = 0; wet = 0; wasUnder = false; duckHop = 0;
    base = { amb: env.amb.intensity, hemi: env.hemi.intensity };
    addEventListener('pointerdown', onDown, true); addEventListener('pointerup', onUp, true);
    CTRL = api;
  }
  function detach() {
    Hh = null; if (cntEl) cntEl.classList.remove('on');
    removeEventListener('pointerdown', onDown, true); removeEventListener('pointerup', onUp, true);
    resetPool();
    // walked on to another room: put its candle-lit ambient back (going outside, interiors.exit restored it already)
    if (base && interiors.active) { env.amb.intensity = base.amb; env.hemi.intensity = base.hemi; }
    base = null; CTRL = null;
  }

  // ---- per-bay effects ----
  function effOf(b) {
    if (b.mode !== 'surprise') return b.mode;
    if (!b.on && b.k <= 0) return b.eff === 'surprise' ? 'water' : b.eff;
    const k = Math.floor((T - b.onT) / 2.4) % 6; if (k !== b._sub) { b._sub = k; b.switches++; if (b.on && b.switches > 1) fun.sfx.flip(); }
    return MODES[k];
  }
  function streamColor(b, eff) {
    switch (eff) {
      case 'bubbles': return col.setRGB(0.6, 0.95, 1.25);
      case 'rainbow': return hue(T * 0.6, 0.7).multiplyScalar(0.9);
      case 'gold': return col.setRGB(1.5, 1.1, 0.32);
      case 'foam': return col.setRGB(1.15, 1.15, 1.18);
      case 'houses': { const h = HOUSE_RGB[b.house]; return col.setRGB(h[0] * 1.3, h[1] * 1.3, h[2] * 1.3); }
      default: return col.setRGB(0.42, 0.74, 1.4);
    }
  }
  function runBay(b, eff, dt) {
    const k = b.k, A = b.acc, x0 = b.x, M = b.made;
    if (eff === 'houses') { b.house = Math.floor((T - b.onT) / 1.2) % 4; b.houses |= 1 << b.house; }
    b.seen |= 1 << MODES.indexOf(eff);
    if (eff === 'rainbow') b.hues |= 1 << (Math.floor(((T * 0.15) % 1) * 6) % 6);
    const rates = eff === 'water' ? [26, 0, 0, 1.3, 6] : eff === 'bubbles' ? [12, 5, 0, 0.8, 3] : eff === 'rainbow' ? [44, 0, 5, 0.8, 6]
      : eff === 'gold' ? [16, 0, 16, 0.6, 4] : eff === 'foam' ? [6, 1.6, 0, 0.6, 2] : [22, 0, 4, 0.8, 5];
    // [drops, bubbles, sparkles, steam, splashes] per second (+ foam puffs below)
    for (let j = 0; j < 5; j++) A[j] += rates[j] * k * dt;
    if (eff === 'foam') A[5] += 9 * k * dt;
    while (A[0] >= 1) { A[0]--; M[K_DROP]++;
      const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * 0.17, rb = eff === 'rainbow', c = rb ? hue(a / 6.28 + T * 0.15, 0.6).multiplyScalar(1.5) : streamColor(b, eff);
      emit(K_DROP, x0 + Math.cos(a) * rr, HEAD_Y - 0.06, HEAD_Z + Math.sin(a) * rr, Math.cos(a) * rr * 1.2, -4.2 - rnd() * 1.2, Math.sin(a) * rr * 1.2, 1.2, rb ? 0.1 + rnd() * 0.04 : 0.08 + rnd() * 0.04, c.r, c.g, c.b, -6, 0); }
    while (A[1] >= 1) { A[1]--; M[K_BUBBLE]++;
      const c = hue(rnd(), 0.88);
      emit(K_BUBBLE, x0 + (rnd() - 0.5) * 0.8, 0.5 + rnd() * 1.4, HEAD_Z + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.15, 0.3 + rnd() * 0.3, 0.18 + rnd() * 0.25, 9 + rnd() * 4, 0.16 + rnd() * 0.18, c.r * 1.05, c.g * 1.05, c.b * 1.1, 0, 0); }
    while (A[2] >= 1) { A[2]--; M[K_SPARK]++;
      const c = eff === 'gold' ? col.setRGB(2.4, 1.8, 0.55) : eff === 'rainbow' ? hue(rnd(), 0.7).multiplyScalar(1.8) : streamColor(b, eff).multiplyScalar(1.5);
      emit(K_SPARK, x0 + (rnd() - 0.5) * 0.7, 0.2 + rnd() * 2.2, HEAD_Z + (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.2, 0.1 + rnd() * 0.3, (rnd() - 0.5) * 0.2, 0.7 + rnd() * 0.5, 0.1 + rnd() * 0.08, c.r, c.g, c.b, 0, 0.5); }
    while (A[3] >= 1) { A[3]--; M[K_STEAM]++;
      emit(K_STEAM, x0 + (rnd() - 0.5) * 0.5, 1.7 + rnd() * 0.6, HEAD_Z + 0.2, (rnd() - 0.5) * 0.15, 0.3 + rnd() * 0.15, 0.15 + rnd() * 0.15, 3.6, 0.45, 1, 1, 1, 0, 0.1, 0.55); }
    while (A[4] >= 1) { A[4]--; M[K_SPLASH]++;
      const a = rnd() * 6.28, c = eff === 'rainbow' ? hue(rnd(), 0.65) : streamColor(b, eff);
      emit(K_SPLASH, x0 + Math.cos(a) * 0.3, 0.05, HEAD_Z + Math.sin(a) * 0.3, Math.cos(a) * 0.9, 1.1 + rnd() * 0.9, Math.sin(a) * 0.9, 0.5, 0.06, c.r, c.g, c.b, -8, 0.5); }
    while (A[5] >= 1) { A[5]--; M[K_FOAM]++;
      emit(K_FOAM, x0 + (rnd() - 0.5) * 0.3, HEAD_Y - 0.1, HEAD_Z + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, -1.4, (rnd() - 0.5) * 0.3, 3, 0.14 + rnd() * 0.08, 1.05, 1.05, 1.08, -3, 0.6); }
  }
  const moundH = (x, z) => { if (foam <= 0) return 0; const dx = (x - BAY_X[FOAM_BAY]) / 0.62, dz = (z - HEAD_Z) / 0.5, q = 1 - dx * dx - dz * dz; return q > 0 ? q * 0.55 * foam : 0; };

  function tickParticles(dt) {
    const parts = Hh.parts, cellA = parts.userData.cell, ca = cellA.array, q = camera.quaternion;
    let n = 0;
    for (let i = 0; i < POOL; i++) {
      const o = i * S; if (PD[o + 6] <= 0) continue;
      PD[o + 6] -= dt; if (PD[o + 6] <= 0) { free[nFree++] = i; alive--; PD[o + 6] = 0; continue; }
      const kd = KIND[i], drag = Math.exp(-PD[o + 13] * dt);
      PD[o + 3] *= drag; PD[o + 5] *= drag; PD[o + 4] = PD[o + 4] * drag + PD[o + 12] * dt;
      PD[o] += PD[o + 3] * dt; PD[o + 1] += PD[o + 4] * dt; PD[o + 2] += PD[o + 5] * dt;
      if (PD[o + 14]) PD[o + 8] *= 1 + PD[o + 14] * dt;
      if (kd === K_BUBBLE) { PD[o] += Math.sin(T * 2.3 + PD[o + 15]) * 0.12 * dt; if (PD[o + 1] > H - 0.25) { kill(i); continue; } }
      if ((kd === K_DROP || kd === K_SPLASH) && PD[o + 1] < 0.03) { if (kd === K_DROP && rnd() < 0.18) emit(K_SPLASH, PD[o], 0.04, PD[o + 2], (rnd() - 0.5) * 1.2, 0.8 + rnd() * 0.8, (rnd() - 0.5) * 1.2, 0.35, 0.05, PD[o + 9], PD[o + 10], PD[o + 11], -8, 0); kill(i); continue; }
      if (kd === K_FOAM && PD[o + 1] < Math.max(0.06, moundH(PD[o], PD[o + 2]))) { if (Math.abs(PD[o] - BAY_X[FOAM_BAY]) < 0.8) foam = Math.min(1, foam + 0.012); kill(i); continue; }   // (the surprise shower's foam just fizzles)
      if (n >= NP - FOAM_N) continue;
      const f = PD[o + 6] / PD[o + 7];
      let a = Math.min(1, (1 - f) * 10) * Math.min(1, f * 4), s = PD[o + 8], sy = s;
      if (kd === K_DROP) { sy = s * 3.2; a *= 0.85; }
      else if (kd === K_STEAM) a = Math.sin(Math.PI * (1 - f)) * 0.3;
      else if (kd === K_BUBBLE) a = Math.min(1, (1 - f) * 6) * Math.min(1, f * 8) * 0.95;
      else if (kd === K_PUFF) a = Math.min(1, f * 2.5) * 0.95;
      parts.setMatrixAt(n, _m.compose(_p.set(PD[o], PD[o + 1], PD[o + 2]), q, _s.set(s, sy, 1)));
      parts.setColorAt(n, col.setRGB(PD[o + 9], PD[o + 10], PD[o + 11]));
      const cl = CELL[KCELL[kd]]; ca[n * 3] = cl[0]; ca[n * 3 + 1] = cl[1]; ca[n * 3 + 2] = a;
      n++;
    }
    // the foam mound (bay 5): blobs grow with the level, wobble gently, melt away when it stops
    if (foam > 0.01) {
      const vis = Math.min(FOAM_N, Math.ceil(foam * FOAM_N * 1.15)), cx = BAY_X[FOAM_BAY], cl = CELL[3];
      for (let k = 0; k < vis; k++) {
        const [fx, fz, hgt, sz] = FB[k], s = (0.34 + 0.22 * foam) * sz;
        parts.setMatrixAt(n, _m.compose(_p.set(cx + fx * (0.6 + 0.4 * foam), 0.08 + hgt * 0.5 * foam + Math.sin(T * 1.7 + k) * 0.01, HEAD_Z + fz * (0.6 + 0.4 * foam)), q, _s.set(s, s * 0.85, 1)));
        parts.setColorAt(n, col.setRGB(1.04, 1.04, 1.08)); ca[n * 3] = cl[0]; ca[n * 3 + 1] = cl[1]; ca[n * 3 + 2] = Math.min(1, foam * 3) * 0.97; n++;
      }
    }
    parts.count = n; parts.visible = n > 0; if (n > maxDrawn) maxDrawn = n;
    if (alive > maxAlive) maxAlive = alive;
    if (n) { parts.instanceMatrix.needsUpdate = true; parts.instanceColor.needsUpdate = true; cellA.needsUpdate = true; }
  }

  function update(dtRaw) {
    const h = interiors.active === 'showers' && interiors.room && interiors.room.group && interiors.room.group.userData.showers;
    if (!h) { if (Hh) detach(); return; }
    if (Hh !== h) { if (Hh) detach(); attach(h); }
    const dt = dtRaw * speed; T += dt;
    // nobody else in here: keep Peeves from popping up while the hall is the room
    try { const pv = delight && delight.peeves; if (pv && pv.state() === 'gone') pv.soon(25); } catch { /* ignore */ }
    // ---- who is under which shower ----
    let under = -1;
    for (const b of bays) {
      const inside = Math.abs(pos.x - b.x) < 0.66 && pos.z < BAY_FRONT;
      if (inside) { b.hold = Math.max(b.hold, 3); under = b.i; }
      if (b.hold > 0) b.hold -= dt;
      const on = b.hold > 0;
      if (on && !b.on) { b.runs++; b.onT = T; b._sub = -1; b.switches = 0; b.acc.fill(0); onSound(b); }
      b.on = on;
      b.k = clamp(b.k + (on ? dt * 2.5 : -dt * 1.4), 0, 1);
      b.eff = effOf(b);
      if (b.k > 0.02) runBay(b, b.eff, dt);
    }
    if (allT > 0) allT -= dt;
    // ---- the streams ----
    let anyOn = 0;
    const st = Hh.streams;
    for (const b of bays) {
      if (b.k > 0.01) anyOn++;
      const len = (HEAD_Y - 0.04) * clamp(b.k * 1.4, 0, 1), wide = 0.4 + 0.6 * b.k, foamy = b.eff === 'foam' ? 1.15 : 1;
      _m.compose(_p.set(b.x, HEAD_Y - 0.03, HEAD_Z), _q0, _s.set(wide * foamy, len || 1e-4, wide * foamy)); if (b.k <= 0.01) _m.makeScale(0, 0, 0);
      st.setMatrixAt(b.i, _m); st.setColorAt(b.i, streamColor(b, b.eff));
    }
    st.visible = anyOn > 0;
    if (anyOn) { st.instanceMatrix.needsUpdate = true; st.instanceColor.needsUpdate = true; st.material.map.offset.y = (T * 2.6) % 1; }
    // ---- wet sparkle under the water, a towel puff when Harry walks out of the bays ----
    const underOn = under >= 0 && bays[under].k > 0.3;
    if (underOn) { wet = Math.max(wet, 1.4); wasUnder = true; }
    if (wet > 0) {
      wet -= dt;
      if (rnd() < dt * 16) { const a = rnd() * 6.28, r0 = 0.3 + rnd() * 0.2; wetSparks++; emit(K_SPARK, pos.x + Math.cos(a) * r0, 0.3 + rnd() * 1.4, pos.z + Math.sin(a) * r0, 0, -0.4, 0, 0.5, 0.1 + rnd() * 0.05, 1.4, 1.7, 2.1, -1, 0); }
    }
    if (wasUnder && under < 0 && pos.z > BAY_FRONT + 0.15) { wasUnder = false; wet = 0; towelPuff(); }
    // ---- foam: piles up while its shower runs, melts slowly after ----
    const fb = bays[FOAM_BAY];
    if (!(fb.k > 0.2 && fb.eff === 'foam')) foam = Math.max(0, foam - dt / 22);
    if (foam > foamMax) foamMax = foam;
    // ---- steam haze, lamps (Lumos brightens the hall), the wheel and the duck ----
    if (steamBoost > 0) steamBoost -= dt;
    const want = Math.min(1, anyOn / 5 + (steamBoost > 0 ? 0.8 : 0));
    steam += (want - steam) * Math.min(1, dt * (want > steam ? 0.5 : 0.25));
    Hh.haze.material.opacity = 0.14 + 0.4 * steam;
    Hh.haze.material.map.offset.set((T * 0.012) % 1, (T * 0.006) % 1);
    lumK += ((lumosOn() ? 1 : 0) - lumK) * Math.min(1, dt * 4);
    Hh.glass.material.emissiveIntensity = (1 + Math.sin(T * 1.3) * 0.03) * (1 + 0.7 * lumK);
    if (base) { env.amb.intensity = base.amb * 1.45 + 0.3 * lumK; env.hemi.intensity = base.hemi * 1.35 + 0.15 * lumK; }
    if (wheelSpin > 0) { wheelSpin -= dt; Hh.wheel.rotation.z += dt * 9 * Math.min(1, wheelSpin); }
    const d = Hh.duck;
    if (duckHop > 0) { duckHop -= dt; const u = 1 - Math.max(0, duckHop) / 0.65; d.position.y = DUCK.y + Math.sin(Math.PI * Math.min(1, u * 1.25)) * 0.32; d.rotation.z = Math.sin(u * 18) * 0.25 * (1 - u); }
    else { d.position.y = DUCK.y; d.rotation.z = Math.sin(T * 1.3) * 0.04; }
    // ---- the tap wheel: the game's round prompt button when you walk up to it ----
    const wd = Math.hypot(pos.x - WHEEL.x, pos.z - WHEEL.z);
    if (wd < 2.4) fun.offer('showers-all', '🚿', wd, allOn);
    // ---- a soft water hiss while anything runs (fun.sfx respects the mute) ----
    hissT -= dt;
    if (anyOn && hissT <= 0) { hissT = 1.5; fun.sfx.noise(1.7, 0.02 + 0.008 * anyOn, 0, 3200, 0.7); }
    // ---- counter ----
    showCount();
    if (bumpT > 0) { bumpT -= dt; if (bumpT <= 0) cntEl.classList.remove('bump'); }
    tickParticles(dt);
  }
  const _q0 = new (camera.quaternion.constructor)();
  function onSound(b) {
    const e = b.mode === 'surprise' ? 'surprise' : b.mode;
    fun.sfx.noise(0.5, 0.07, 0, 2000, 0.8);
    if (e === 'bubbles') { fun.sfx.pop(); setTimeout(() => fun.sfx.pop(), 140); }
    else if (e === 'rainbow') fun.sfx.tune([784, 988, 1175, 1568], 0.08, 'sine');
    else if (e === 'gold') fun.sfx.sparkle();
    else if (e === 'foam') fun.sfx.poof();
    else if (e === 'houses') fun.sfx.chime();
    else if (e === 'surprise') fun.sfx.giggle(true);
  }
  function towelPuff() {
    towels++;
    for (let k = 0; k < 24; k++) { const a = k / 24 * 6.28, y = 0.25 + (k % 6) * 0.26; emit(K_PUFF, pos.x + Math.cos(a) * 0.25, y, pos.z + Math.sin(a) * 0.25, Math.cos(a) * 1.1, 0.25 + rnd() * 0.3, Math.sin(a) * 1.1, 0.9 + rnd() * 0.3, 0.42 + rnd() * 0.2, 1.05, 1.03, 1.0, 0, 2.2, 0.9); }
    for (let k = 0; k < 8; k++) emit(K_SPARK, pos.x + (rnd() - 0.5) * 0.8, 0.4 + rnd() * 1.4, pos.z + (rnd() - 0.5) * 0.8, 0, 0.5, 0, 0.8, 0.12, 1.8, 1.7, 1.3, 0, 0.5);
    fun.sfx.poof(); fun.sfx.tune([1319, 1568, 2093], 0.08, 'sine');
  }

  const seenList = (m) => MODES.filter((_, j) => m & (1 << j));
  const bits = (m) => { let n = 0; for (; m; m >>= 1) n += m & 1; return n; };
  const bayState = () => bays.map(b => ({ i: b.i, x: b.x, mode: b.mode, eff: b.eff, on: b.on, k: +b.k.toFixed(2), runs: b.runs, house: b.house, switches: b.switches,
    made: { drops: b.made[K_DROP], bubbles: b.made[K_BUBBLE], sparks: b.made[K_SPARK], steam: b.made[K_STEAM], splashes: b.made[K_SPLASH], foam: b.made[K_FOAM] }, seen: seenList(b.seen), houses: bits(b.houses), hues: bits(b.hues) }));
  const api = {
    update,
    state: () => ({
      T: +T.toFixed(2), active: !!Hh, room: interiors.active, bays: bayState(), allT: +Math.max(0, allT).toFixed(2), allRuns,
      particles: alive, drawn: Hh ? Hh.parts.count : 0, cap: NP, pool: POOL, maxAlive, maxDrawn, foam: +foam.toFixed(3), foamMax: +foamMax.toFixed(3),
      wet: wet > 0, wetSparks, towels, popped: saved.popped, best: saved.best, visitPopped, popTaps, quacks, duckHop: +Math.max(0, duckHop).toFixed(2),
      duckY: Hh ? +Hh.duck.position.y.toFixed(3) : null, steam: +steam.toFixed(2), steamBoost: +Math.max(0, steamBoost).toFixed(2), steamPuffs, splashes,
      lumos: +lumK.toFixed(2), wheelSpin: +Math.max(0, wheelSpin).toFixed(2), counter: cntEl ? { on: cntEl.classList.contains('on'), text: cntEl.textContent } : null,
      streamsVisible: Hh ? Hh.streams.visible : false, partsVisible: Hh ? Hh.parts.visible : false, name: NAME, meshes: Hh ? roomDraws(Hh.group) : 0, tris: Hh ? roomTris(Hh.group) : 0,
    }),
    squeak, allOn, tapAt,
  };
  if (debug) Object.assign(api, {
    go: () => interiors.enter('showers'),
    // stand under shower i, facing the wall (the camera then looks into the bay from the hall)
    stand(i) { player.yaw = Math.PI; player.teleport(BAY_X[i], -2.6); return { x: pos.x, z: pos.z }; },
    out(x = 0.5, z = 1.6) { player.teleport(x, z); return { x: pos.x, z: pos.z }; },
    // screen position of the duck / the wheel / the nearest on-screen bubble (for real taps in tests)
    screen(what) {
      if (!Hh) return null; camera.updateMatrixWorld(true);
      if (what === 'duck') { const p = Hh.duck.position; toScreen(p.x, FY + p.y + 0.15, p.z, sp); return { x: sp.x, y: sp.y, on: sp.z < 1 }; }
      if (what === 'wheel') { toScreen(WHEEL.x, FY + WHEEL.y, WHEEL.z, sp); return { x: sp.x, y: sp.y, on: sp.z < 1 }; }
      let best = null;
      for (let i = 0; i < POOL; i++) {
        const o = i * S; if (PD[o + 6] <= 0 || KIND[i] !== K_BUBBLE || PD[o + 6] < 1.5) continue;
        toScreen(PD[o], FY + PD[o + 1], PD[o + 2], sp);
        if (sp.z < 1 && sp.x > 120 && sp.x < innerWidth - 120 && sp.y > 150 && sp.y < innerHeight - 160 && (!best || PD[o + 8] > best.s)) best = { x: sp.x, y: sp.y, s: PD[o + 8], vy: PD[o + 4] };
      }
      return best;
    },
    _speed(k) { speed = k || 1; },
    hallDoor: HALL_DOOR, bayX: BAY_X, wheel: WHEEL, duck: DUCK,
  });
  return api;
}
