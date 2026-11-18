// Grounds film look, pass 1 (art-direction-film.md): Hagrid's hut with its pumpkin patch, and the
// Victorian glasshouse behind Sprout's Herbology station. Everything is built in code from the
// committed film stone maps (castle_wall_slates), the wood map and small canvases (<= 512 px);
// no downloaded models. Each building merges into one mesh per material (<= 8 draw calls):
//   hut   stone (walls, chimney, step, path) | roof shingles | wood | iron | glow (windows, lantern)
//         | pumpkins (instanced) | garden (soil, leaves, vines, scarecrow cloth: one cutout atlas)
//         | chimney smoke (instanced additive quads)
// Windows and lamps glow through emissive materials whose intensity follows the time of day
// (groundsTime, called from environment.onTime); no runtime lights. Nothing allocates per frame.
import {
  Group, Mesh, InstancedMesh, Object3D, BufferGeometry, Float32BufferAttribute, BoxGeometry, CylinderGeometry,
  SphereGeometry, ConeGeometry, PlaneGeometry, IcosahedronGeometry, TorusGeometry, LatheGeometry, TubeGeometry, CatmullRomCurve3, Shape,
  ExtrudeGeometry, Vector2, Vector3, Color, Matrix4, Euler, Quaternion, MeshStandardMaterial, MeshBasicMaterial,
  CanvasTexture, SRGBColorSpace, LinearSRGBColorSpace, RepeatWrapping, ClampToEdgeWrapping, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadFilmMaps } from './materials.js';
import { stoneTexture, woodTexture } from './textures.js';

// ---------------------------------------------------------------------------------------------
// shared maps + time of day
let MAPS = null;
// main.js calls this once before building (the film maps are already loading there).
export async function initGrounds({ wood } = {}) {
  const film = await loadFilmMaps().catch(() => null);
  MAPS = { stone: film?.wall || null, wood: wood || null };
  return MAPS;
}
const glow = [];                       // { mat, base }: emissive materials that follow the time of day
let glowK = 0.12;
const glowOf = (p) => Math.max(0.12, Math.min(1, (p?.win ?? 0.25) / 2.6));
// chimney smoke: light grey by day, warm-grey at dusk, dim blue-grey at night
const SMOKE = { color: new Color(0x8a8682), mats: [], by: { day: 0x8a8682, dusk: 0x7e706a, night: 0x3c4450 } };
export function groundsTime(p, key) {
  glowK = glowOf(p); for (const g of glow) g.mat.emissiveIntensity = g.base * glowK;
  SMOKE.color.setHex(SMOKE.by[key] ?? (glowK > 0.8 ? SMOKE.by.night : glowK > 0.4 ? SMOKE.by.dusk : SMOKE.by.day));
  for (const m of SMOKE.mats) m.color.copy(SMOKE.color);
}
function glowMat(o, base) {
  const m = new MeshStandardMaterial({ roughness: 0.5, ...o });
  m.emissiveIntensity = base * glowK; glow.push({ mat: m, base }); return m;
}

// deterministic random
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
function ctex(c, { srgb = true, repeat = true } = {}) {
  const t = new CanvasTexture(c); t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping; t.anisotropy = 4; return t;
}
// Tangent-space normal map from a height field (h: Float32Array w*h, 0..1), canvas y down = -v.
function normalCanvas(h, w, H, k = 2.5) {
  const [c, g] = canvas(w, H), img = g.createImageData(w, H);
  const at = (x, y) => h[((y + H) % H) * w + ((x + w) % w)];
  for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y - 1) - at(x, y + 1)) * k;   // dh/du, dh/dv (v up)
    let nx = -dx, ny = -dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4; img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return c;
}

// ---------------------------------------------------------------------------------------------
// geometry helpers
const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3();
function xf(g, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')); _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz)); g.applyMatrix4(_m); return g;
}
// planar UVs in metres / tile, picked per vertex by its dominant normal axis (rot: swap u/v)
function projUV(g, tile, rot = false) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    if (rot) { const t = u; u = v; v = t; }
    uv.setXY(i, u / tile, v / tile);
  }
  return g;
}
// UVs squeezed into an atlas cell [u0,v0]-[u0+du,v0+dv]
function cellUV(g, u0, v0, du, dv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv); return g; }
const flatUV = (g, u, v) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v); return g; };
function merge(list) {
  const gs = list.map(g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); g.clearGroups(); return g; });
  return mergeGeometries(gs, false);
}
// A raw triangle soup builder (position/normal/uv arrays)
class Soup {
  constructor() { this.p = []; this.n = []; this.u = []; }
  v(p, n, u) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.u.push(u[0], u[1]); }
  // quad a b c d (counter-clockwise seen from the front), per-corner normals and uvs
  quad(a, b, c, d, na, nb, nc, nd, ua, ub, uc, ud) { this.v(a, na, ua); this.v(b, nb, ub); this.v(c, nc, uc); this.v(a, na, ua); this.v(c, nc, uc); this.v(d, nd, ud); }
  // flat quad: normal from the corners, flipped to agree with `want` (if given)
  fquad(a, b, c, d, want, uvf) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(x => x / l);
    if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { [b, d] = [d, b]; n = n.map(x => -x); }
    const U = (q) => uvf(q, n);
    this.quad(a, b, c, d, n, n, n, n, U(a), U(b), U(c), U(d));
  }
  geo() { const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new Float32BufferAttribute(this.u, 2)); return g; }
}
const projOf = (tile) => (q, n) => {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  return ay >= ax && ay >= az ? [q[0] / tile, q[2] / tile] : ax >= az ? [q[2] / tile, q[1] / tile] : [q[0] / tile, q[1] / tile];
};

// ---------------------------------------------------------------------------------------------
// materials
const STONE_TILE = 5.0;        // metres per film-stone tile (fieldstones ~0.25-0.4 m)
function stoneMaterial(color, name) {
  const st = MAPS?.stone;
  const m = st ? new MeshStandardMaterial({ map: st.col, normalMap: st.nor || null, normalScale: new Vector2(1.0, -1.0), color, roughness: 0.95 })
    : new MeshStandardMaterial({ map: stoneTexture(1, '#6d6a63'), color, roughness: 0.95 });
  m.name = name; return m;
}
// the wood map is shared with the castle (repeat may be 2): tiles are divided by it
// The castle's wood map is a saturated orange: weathered outdoor oak wants it greyed. One 512 px
// desaturated canvas copy, shared by the hut and the glasshouse (repeat 1).
let _greyWood = null;
function greyWood() {
  if (_greyWood !== null) return _greyWood;
  const img = MAPS?.wood?.image;
  _greyWood = false;
  if (!img || !(img.width > 0)) return _greyWood;
  try {
    const [c, g] = canvas(512); g.drawImage(img, 0, 0, 512, 512);
    const d = g.getImageData(0, 0, 512, 512), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const y = a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11; a[i] = y + (a[i] - y) * 0.38; a[i + 1] = y + (a[i + 1] - y) * 0.38; a[i + 2] = y + (a[i + 2] - y) * 0.38; }
    g.putImageData(d, 0, 0); _greyWood = ctex(c);
  } catch (e) { _greyWood = false; }
  return _greyWood;
}
function woodMaterial(color, name) {
  const t = greyWood() || MAPS?.wood || woodTexture(1);
  const m = new MeshStandardMaterial({ map: t, color, roughness: 0.86 }); m.name = name;
  m.userData.rep = t.repeat?.x || 1; return m;
}
const ironMaterial = () => { const m = new MeshStandardMaterial({ color: 0x2b2725, roughness: 0.62, metalness: 0.55 }); m.name = 'grounds-iron'; return m; };

// Weathered wooden shingles: 4 staggered rows (one per roof course), colour + normal, 512 px.
let _shingle = null;
function shingleMaps() {
  if (_shingle) return _shingle;
  const W = 512, H = 512, [c, g] = canvas(W, H), hgt = new Float32Array(W * H), r = rng(91);
  const img = g.createImageData(W, H), d = img.data;
  const put = (x, y, rr, gg, bb, h) => { const i = y * W + x; d[i * 4] = rr; d[i * 4 + 1] = gg; d[i * 4 + 2] = bb; d[i * 4 + 3] = 255; hgt[i] = h; };
  for (let row = 0; row < 4; row++) {
    const y0 = row * 128;              // canvas top of the row band (= the TOP of a course, under the next course's lip)
    let x = Math.floor(r() * 40) - 40;
    while (x < W) {
      const w = 38 + Math.floor(r() * 34), len = 128 - Math.floor(r() * 10);   // a few shingles a little shorter
      const v = 74 + r() * 30, base = [v * 1.06, v * 1.0, v * 0.9];
      if (r() < 0.25) { base[0] *= 0.92; base[1] *= 0.94; base[2] *= 0.98; }      // some greyer, older shingles
      const ph = r() * 50, mossy = r() < 0.35;
      for (let xx = 0; xx < w; xx++) {
        const px = ((x + xx) % W + W) % W, edge = xx < 2 || xx > w - 3;
        const grain = Math.sin((xx + ph) * 0.9 + Math.sin((xx + ph) * 0.23) * 3) * 0.5 + 0.5;
        for (let yy = 0; yy < 128; yy++) {
          const py = y0 + yy, fromBottom = 127 - yy;
          if (edge || fromBottom >= len) { put(px, py, 30, 26, 22, 0.0); continue; }        // gaps between shingles
          const shade = 0.72 + 0.28 * Math.min(1, yy / 26);                                 // shadow under the course above
          const tip = fromBottom < 5 ? 0.78 : 1;                                             // the worn butt end
          const k = (0.86 + grain * 0.18 + (r() - 0.5) * 0.1) * shade * tip;
          let R = base[0] * k, G = base[1] * k, B = base[2] * k;
          if (mossy && fromBottom < 40 && r() < 0.18 * (1 - fromBottom / 40)) { R = R * 0.85 + 6; G = G * 0.9 + 12; B = B * 0.75; }   // moss creeping up from the butt
          put(px, py, R, G, B, 0.55 + grain * 0.12 + (yy / 128) * 0.25);
        }
      }
      x += w;
    }
  }
  g.putImageData(img, 0, 0);
  const col = ctex(c), nor = ctex(normalCanvas(hgt, W, H, 1.6), { srgb: false });
  return (_shingle = { col, nor });
}

// Garden atlas (512): TL soil bed (ragged alpha) | TR pumpkin leaf (alpha) | BL burlap | BR straw + vine green.
let _garden = null;
const GA = { soil: [0, 0.5], leaf: [0.5, 0.5], burlap: [0, 0], straw: [0.5, 0], vine: [0.875, 0.375], twine: [0.875, 0.125] };
function gardenMap() {
  if (_garden) return _garden;
  const [c, g] = canvas(512), r = rng(57);
  // soil: dark tilled earth, clods and pebbles, in a ragged disc
  g.save(); g.beginPath();
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, rr = 112 + Math.sin(a * 5) * 6 + Math.sin(a * 13) * 4 + (r() - 0.5) * 6; g.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); }
  g.closePath(); g.clip();
  g.fillStyle = '#35281b'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = r(); g.fillStyle = v < 0.4 ? '#2a1f15' : v < 0.8 ? '#45331f' : '#5a4630'; const s = 2 + r() * 5; g.fillRect(r() * 256, r() * 256, s, s * 0.7); }
  for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? '#6a6458' : '#4f4a42'; g.beginPath(); g.ellipse(r() * 256, r() * 256, 1.5 + r() * 2.5, 1 + r() * 2, r() * 3, 0, 7); g.fill(); }
  for (let y = 0; y < 256; y += 22) { g.fillStyle = 'rgba(20,14,8,0.35)'; g.fillRect(0, y + r() * 6, 256, 3); }   // furrows
  g.restore();
  // pumpkin leaf: five rounded lobes, veins from the stalk
  g.save(); g.beginPath(); g.rect(256, 0, 256, 256); g.clip(); g.translate(384, 250); g.scale(0.68, 0.68);
  const lobe = (a, L, w) => { g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-w, -L * 0.3, -w * 1.1, -L * 0.85, 0, -L); g.bezierCurveTo(w * 1.1, -L * 0.85, w, -L * 0.3, 0, 0); g.fill(); g.restore(); };
  const grd = g.createRadialGradient(0, -20, 10, 0, -110, 210); grd.addColorStop(0, '#5c7f38'); grd.addColorStop(0.6, '#3f6a2a'); grd.addColorStop(1, '#2c4f1e');
  g.fillStyle = grd;
  for (const [a, L, w] of [[0, 200, 70], [-0.75, 175, 62], [0.75, 175, 62], [-1.45, 130, 50], [1.45, 130, 50]]) lobe(a, L, w);
  g.strokeStyle = 'rgba(160,190,110,0.55)'; g.lineWidth = 3;
  for (const [a, L] of [[0, 180], [-0.75, 155], [0.75, 155], [-1.45, 110], [1.45, 110]]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(a) * L, -Math.cos(a) * L); g.stroke(); }
  g.lineWidth = 1.2; for (let i = 0; i < 60; i++) { const a = (r() - 0.5) * 3, L = 30 + r() * 120; g.beginPath(); g.moveTo(Math.sin(a) * L * 0.6, -Math.cos(a) * L * 0.6); g.lineTo(Math.sin(a + (r() - 0.5) * 0.6) * L, -Math.cos(a + (r() - 0.5) * 0.6) * L); g.stroke(); }
  g.restore();
  // burlap
  g.fillStyle = '#6e5e40'; g.fillRect(0, 256, 256, 256);
  for (let y = 256; y < 512; y += 3) { g.fillStyle = `rgba(40,30,15,${0.12 + r() * 0.12})`; g.fillRect(0, y, 256, 1); }
  for (let x = 0; x < 256; x += 3) { g.fillStyle = `rgba(150,130,90,${0.08 + r() * 0.1})`; g.fillRect(x, 256, 1, 256); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(40,28,14,0.25)'; g.beginPath(); g.ellipse(r() * 256, 256 + r() * 256, 6 + r() * 16, 4 + r() * 10, r() * 3, 0, 7); g.fill(); }   // patches + stains
  // straw
  g.fillStyle = '#8a7240'; g.fillRect(256, 256, 192, 256);
  for (let i = 0; i < 700; i++) { const x = 256 + r() * 192, y = 256 + r() * 256; g.strokeStyle = r() < 0.5 ? '#a88c50' : '#6a5630'; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 8, y + 12 + r() * 20); g.stroke(); }
  // vine green + twine swatches
  g.fillStyle = '#3c5a26'; g.fillRect(448, 256, 64, 128);
  g.fillStyle = '#7a6848'; g.fillRect(448, 384, 64, 128);
  const t = ctex(c, { repeat: false });
  return (_garden = t);
}

// Leaded window panes (64 px): warm glass with small quarries and a faint candle bloom low down.
let _pane = null;
function paneMap() {
  if (_pane) return _pane;
  const [c, g] = canvas(64, 96), r = rng(13);
  const grd = g.createRadialGradient(32, 70, 4, 32, 60, 70); grd.addColorStop(0, '#ffd890'); grd.addColorStop(1, '#a8682a');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 96);
  for (let y = 0; y < 96; y += 16) for (let x = 0; x < 64; x += 16) { g.fillStyle = `rgba(${r() < 0.5 ? '255,230,180' : '90,50,20'},${0.08 + r() * 0.12})`; g.fillRect(x, y, 16, 16); }
  g.strokeStyle = '#1c1410'; g.lineWidth = 2;
  for (let x = 16; x < 64; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 96); g.stroke(); }
  for (let y = 16; y < 96; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  return (_pane = ctex(c, { repeat: false }));
}
// ---------------------------------------------------------------------------------------------
// Hagrid's hut. Built in film metres in a local frame (door toward +z, y up from the ground at
// the hut centre), then scaled by S: the game's cast is ~1.3x life size (Hagrid 3.5 m, professors
// x1.3), so the 6 m film hut is built at 7.8 m to keep its proportions next to him.
export const HUT = { x: 86, z: 42, door: [-0.78, -0.62], S: 1.3, cull: 95 };
const R0 = 3.0, WALL_H = 2.6, BATTER = 0.14, EAVE_R = 3.78, EAVE_Y = 2.55, APEX = 6.5;

export function buildHut({ scene, heightAt, colliders, camera, obstacles }) {
  const S = HUT.S, th = Math.atan2(HUT.door[0], HUT.door[1]), cs = Math.cos(th), sn = Math.sin(th);
  const y0 = heightAt(HUT.x, HUT.z);
  const toWorld = (lx, lz) => [HUT.x + S * (lx * cs + lz * sn), HUT.z + S * (-lx * sn + lz * cs)];
  const hAt = (lx, lz) => { const [wx, wz] = toWorld(lx, lz); return (heightAt(wx, wz) - y0) / S; };
  const root = new Group(); root.name = 'hagrid-hut';
  root.position.set(HUT.x, y0, HUT.z); root.rotation.y = th; root.scale.setScalar(S);

  const ST = [], WD = [], IR = [], GL = [], RF = [], GD = [];
  const stone = stoneMaterial(new Color(1.18, 1.04, 0.88), 'hut-stone');
  const wood = woodMaterial(0xf0e2d4, 'hut-wood'), wrep = wood.userData.rep;
  const WT = 1.6 * wrep;       // wood tile metres (in UV units, divided by the map repeat)

  // ---- the round fieldstone wall, with real openings (deep reveals) for the door and windows ----
  let ymin = 0; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ymin = Math.min(ymin, hAt(Math.sin(a) * R0, Math.cos(a) * R0)); }
  const yb = ymin - 0.5, gd = hAt(0, R0);
  const doorY0 = gd + 0.16, doorY1 = doorY0 + 2.12;
  const OPEN = [
    { a: 0, hw: 0.68, y0: doorY0, y1: doorY1, depth: 0.36, door: true },
    { a: 1.0, hw: 0.42, y0: 1.0, y1: 1.9, depth: 0.42 },
    { a: -1.08, hw: 0.42, y0: 1.0, y1: 1.9, depth: 0.42 },
  ];
  const jit = (a) => 0.022 * Math.sin(a * 7 + 1.3) + 0.014 * Math.sin(a * 17 + 0.4);
  const rad = (a, y) => R0 + BATTER * Math.max(0, 1 - (y - yb) / (WALL_H - yb)) + jit(a);
  const P = (a, y) => { const r = rad(a, y); return [Math.sin(a) * r, y, Math.cos(a) * r]; };
  const NRM = (a) => { const l = Math.hypot(1, 0.05); return [Math.sin(a) / l, 0.05 / l, Math.cos(a) / l]; };
  let cols = []; for (let i = 0; i <= 64; i++) cols.push(-Math.PI + i / 64 * Math.PI * 2);
  for (const o of OPEN) { const h = o.hw / R0; cols.push(o.a - h, o.a + h); }
  cols.sort((x, y) => x - y); cols = cols.filter((v, i) => i === 0 || v - cols[i - 1] > 0.012);
  let rows = [yb, 0.5, WALL_H]; for (const o of OPEN) rows.push(o.y0, o.y1);
  rows.sort((x, y) => x - y); rows = rows.filter((v, i) => i === 0 || v - rows[i - 1] > 0.02);
  const inOpen = (a, y) => OPEN.find(o => Math.abs(a - o.a) < o.hw / R0 && y > o.y0 && y < o.y1);
  const WRAP = Math.round(2 * Math.PI * R0 / STONE_TILE), W = new Soup(), uw = (a, y) => [(a + Math.PI) / (2 * Math.PI) * WRAP, y / STONE_TILE];   // whole tiles round: no seam
  for (let i = 0; i < cols.length - 1; i++) for (let j = 0; j < rows.length - 1; j++) {
    const a0 = cols[i], a1 = cols[i + 1], b0 = rows[j], b1 = rows[j + 1];
    if (inOpen((a0 + a1) / 2, (b0 + b1) / 2)) continue;
    W.quad(P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1), NRM(a0), NRM(a1), NRM(a1), NRM(a0), uw(a0, b0), uw(a1, b0), uw(a1, b1), uw(a0, b1));
  }
  // reveals: jambs, sill and head run straight back (along the opening's normal) to a vertical back plane
  const pj = projOf(STONE_TILE);
  for (const o of OPEN) {
    const h = o.hw / R0, n = [Math.sin(o.a), 0, Math.cos(o.a)], t = [Math.cos(o.a), 0, -Math.sin(o.a)];
    const sb = R0 * Math.cos(h) - o.depth;
    const back = (p) => { const d = p[0] * n[0] + p[2] * n[2] - sb; return [p[0] - n[0] * d, p[1], p[2] - n[2] * d]; };
    const span = cols.filter(a => a >= o.a - h - 1e-6 && a <= o.a + h + 1e-6);
    for (const [ae, s] of [[o.a - h, 1], [o.a + h, -1]]) {     // jambs face the opening centre
      const p0 = P(ae, o.y0), p1 = P(ae, o.y1);
      W.fquad(p0, back(p0), back(p1), p1, [t[0] * s, 0, t[2] * s], pj);
    }
    for (let k = 0; k < span.length - 1; k++) {
      const a0 = span[k], a1 = span[k + 1];
      const s0 = P(a0, o.y0), s1 = P(a1, o.y0); W.fquad(s0, s1, back(s1), back(s0), [0, 1, 0], pj);      // sill / threshold
      const h0 = P(a0, o.y1), h1 = P(a1, o.y1); W.fquad(h0, h1, back(h1), back(h0), [0, -1, 0], pj);     // head
    }
    o.frame = new Matrix4().makeBasis(new Vector3(...t), new Vector3(0, 1, 0), new Vector3(...n)).setPosition(n[0] * sb, 0, n[2] * sb);
    o.sb = sb;
  }
  ST.push(W.geo());
  // ---- door: stone back panel (the arch corners read recessed), the plank leaf, iron straps, voussoirs ----
  const D = OPEN[0], dw = D.hw * 2, dh = D.y1 - D.y0, spring = dh - D.hw;
  {
    const panel = new PlaneGeometry(dw + 0.02, dh + 0.02); xf(panel, 0, D.y0 + dh / 2, 0.003); panel.applyMatrix4(D.frame); ST.push(projUV(panel, STONE_TILE));
    const sh = new Shape(); sh.moveTo(-D.hw + 0.02, 0); sh.lineTo(D.hw - 0.02, 0); sh.lineTo(D.hw - 0.02, spring);
    sh.absarc(0, spring, D.hw - 0.02, 0, Math.PI, false); sh.lineTo(-D.hw + 0.02, 0);
    const leaf = new ExtrudeGeometry(sh, { depth: 0.09, bevelEnabled: false, curveSegments: 14 });
    xf(leaf, 0, D.y0, 0.01); leaf.applyMatrix4(D.frame); WD.push(projUV(leaf, WT / 1.0, true));   // vertical planks
    // plank seams: thin dark battens proud of the leaf
    for (let k = -2; k <= 2; k++) { const x = k * 0.27; if (Math.abs(x) > D.hw - 0.05) continue; const top = spring + Math.sqrt(Math.max(0, (D.hw - 0.02) ** 2 - x * x)) - 0.04; const b = new BoxGeometry(0.018, top, 0.012); xf(b, x + 0.135, D.y0 + top / 2, 0.105); b.applyMatrix4(D.frame); IR.push(b); }
    for (const y of [0.35, 1.0, 1.62]) { const b = new BoxGeometry(dw - 0.12, 0.09, 0.025); xf(b, 0, D.y0 + y, 0.115); b.applyMatrix4(D.frame); IR.push(b);
      for (const s of [-1, 1]) { const st = new CylinderGeometry(0.025, 0.025, 0.03, 6); xf(st, s * 0.25, D.y0 + y, 0.13, 0, Math.PI / 2); st.applyMatrix4(D.frame); IR.push(st); } }
    const ring = new TorusGeometry(0.09, 0.018, 5, 12); xf(ring, 0.42, D.y0 + 1.05, 0.14); ring.applyMatrix4(D.frame); IR.push(ring);
    // voussoirs round the arch, on the curved wall face
    const NV = 11;
    for (let i = 0; i < NV; i++) {
      const a0 = i / NV * Math.PI, a1 = (i + 1) / NV * Math.PI, am = (a0 + a1) / 2, rm = D.hw + 0.17;
      const x = Math.cos(am) * rm, y = D.y0 + spring + Math.sin(am) * rm;
      const len = (a1 - a0) * rm + 0.02;
      const b = new BoxGeometry(len, 0.34 + (i % 3) * 0.04, 0.3);
      const zf = Math.sqrt(rad(x / R0, y) ** 2 - x * x);
      xf(b, x, y, zf - 0.1, Math.asin(x / R0), 0, am - Math.PI / 2);
      ST.push(projUV(b, STONE_TILE));
    }
    // jamb stones below the springing
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const y = D.y0 + 0.28 + k * (spring / 3), x = s * (D.hw + 0.16);
      const b = new BoxGeometry(0.3 + (k % 2) * 0.08, spring / 3 - 0.03, 0.26); const zf = Math.sqrt(rad(x / R0, y) ** 2 - x * x);
      xf(b, x, y, zf - 0.09, Math.asin(x / R0)); ST.push(projUV(b, STONE_TILE));
    }
  }
  // ---- windows: glowing leaded glass at the back of deep reveals, oak frame + mullion, stone sill ----
  const glass = glowMat({ color: 0x241a10, map: paneMap(), emissive: 0xffffff, emissiveMap: paneMap() }, 1.9);
  for (const o of OPEN.slice(1)) {
    const w = o.hw * 2, h = o.y1 - o.y0;
    const g = new PlaneGeometry(w, h); xf(g, 0, o.y0 + h / 2, 0.004); g.applyMatrix4(o.frame); GL.push(g);
    const F = [new BoxGeometry(w, 0.05, 0.05), new BoxGeometry(w, 0.05, 0.05), new BoxGeometry(0.05, h, 0.05), new BoxGeometry(0.05, h, 0.05), new BoxGeometry(0.03, h, 0.03), new BoxGeometry(w, 0.03, 0.03)];
    xf(F[0], 0, o.y0 + 0.03, 0.035); xf(F[1], 0, o.y1 - 0.03, 0.035); xf(F[2], -o.hw + 0.03, o.y0 + h / 2, 0.035); xf(F[3], o.hw - 0.03, o.y0 + h / 2, 0.035);
    xf(F[4], 0, o.y0 + h / 2, 0.03); xf(F[5], 0, o.y0 + h * 0.55, 0.03);
    for (const f of F) { f.applyMatrix4(o.frame); WD.push(projUV(f, WT)); }
    const sill = new BoxGeometry(w + 0.22, 0.09, 0.3); xf(sill, 0, o.y0 - 0.05, o.depth + 0.02); sill.applyMatrix4(o.frame); ST.push(projUV(sill, STONE_TILE));
    const lint = new BoxGeometry(w + 0.34, 0.2, 0.24); xf(lint, 0, o.y1 + 0.1, o.depth - 0.06); lint.applyMatrix4(o.frame); ST.push(projUV(lint, STONE_TILE));
    // shutters hooked open against the wall either side
    for (const s of [-1, 1]) { const sh = new BoxGeometry(o.hw * 0.95, h + 0.04, 0.05); xf(sh, s * (o.hw * 1.5 + 0.06), o.y0 + h / 2, o.depth + 0.07, s * -0.22); sh.applyMatrix4(o.frame); WD.push(projUV(sh, WT, true)); }
  }

  // ---- roof: stepped courses of weathered shingles on a steep cone, eave soffit + fascia, cap ----
  const shm = shingleMaps();
  const roofMat = new MeshStandardMaterial({ map: shm.col, normalMap: shm.nor, color: 0xd8d0c4, roughness: 0.92, side: DoubleSide }); roofMat.name = 'hut-shingles';
  {
    const Hh = APEX - EAVE_Y, L = Math.hypot(EAVE_R, Hh), nr = Hh / L, ny = EAVE_R / L, K = 11, TOP = 0.93;
    const Rf = new Soup();
    for (let k = 0; k < K; k++) {
      const t0 = k / K * TOP, t1 = Math.min(TOP + 0.02, (k + 1) / K * TOP + 0.03), row = k % 4;
      const N = Math.max(14, Math.round(60 * (1 - t0)));
      const reps = Math.max(2, Math.round(2 * Math.PI * EAVE_R * (1 - t0) / 1.5));
      const surf = (a, t, lift, wob) => { const r = EAVE_R * (1 - t) + lift * nr + 0.012 * Math.sin(a * 3 + k * 1.9); return [Math.sin(a) * r, EAVE_Y + Hh * t + lift * ny + wob, Math.cos(a) * r]; };
      const nS = (a) => [Math.sin(a) * nr, ny, Math.cos(a) * nr], nL = (a) => [Math.sin(a) * ny, -nr, Math.cos(a) * ny];
      const lift = (a) => 0.055 + 0.018 * Math.sin(a * 9 + k * 2.3) + 0.01 * Math.sin(a * 23 + k);
      const wob = (a) => 0.022 * Math.sin(a * 5 + k * 1.3) + 0.01 * Math.sin(a * 13 + k * 0.7);
      for (let c = 0; c < N; c++) {
        const a0 = -Math.PI + c / N * Math.PI * 2, a1 = -Math.PI + (c + 1) / N * Math.PI * 2;
        const u0 = c / N * reps, u1 = (c + 1) / N * reps;
        const b0 = surf(a0, t0, lift(a0), wob(a0)), b1 = surf(a1, t0, lift(a1), wob(a1)), q1 = surf(a1, t1, 0.004, 0), q0 = surf(a0, t1, 0.004, 0);
        // canvas rows: v=1 is the canvas top; row band k spans v (3-row)/4..(4-row)/4, its TOP = shadowed end
        const vB = 1 - (row + 1) / 4 + 0.004, vT = 1 - row / 4 - 0.004;
        Rf.quad(b0, b1, q1, q0, nS(a0), nS(a1), nS(a1), nS(a0), [u0, vB], [u1, vB], [u1, vT], [u0, vT]);
        // lip: the butt ends' thickness, from the lifted edge back to the cone
        const ld = k === 0 ? (a) => -0.07 : (a) => wob(a) - 0.01;   // the eave course drops below the soffit: no sky gap
        const l0 = surf(a0, t0, 0, ld(a0)), l1 = surf(a1, t0, 0, ld(a1));
        Rf.quad(l0, l1, b1, b0, nL(a0), nL(a1), nL(a1), nL(a0), [u0, vB - 0.002], [u1, vB - 0.002], [u1, vB + 0.01], [u0, vB + 0.01]);
      }
    }
    // soffit under the eave (faces down) and a fascia board round the eave edge
    const Nn = 48;
    for (let c = 0; c < Nn; c++) {
      const a0 = c / Nn * Math.PI * 2, a1 = (c + 1) / Nn * Math.PI * 2;
      const o0 = [Math.sin(a0) * EAVE_R, EAVE_Y - 0.01, Math.cos(a0) * EAVE_R], o1 = [Math.sin(a1) * EAVE_R, EAVE_Y - 0.01, Math.cos(a1) * EAVE_R];
      const i0 = [Math.sin(a0) * (R0 - 0.1), EAVE_Y - 0.01, Math.cos(a0) * (R0 - 0.1)], i1 = [Math.sin(a1) * (R0 - 0.1), EAVE_Y - 0.01, Math.cos(a1) * (R0 - 0.1)];
      Rf.fquad(o0, o1, i1, i0, [0, -1, 0], (q) => [q[0] * 0.4, 0.62 + q[2] * 0.02]);
      const d0 = [o0[0], o0[1] - 0.1, o0[2]], d1 = [o1[0], o1[1] - 0.1, o1[2]];
      Rf.fquad(d0, d1, o1, o0, [Math.sin((a0 + a1) / 2), 0, Math.cos((a0 + a1) / 2)], (q) => [(q[0] + q[2]) * 0.4, 0.62 + (q[1] - EAVE_Y) * 0.3]);
    }
    RF.push(Rf.geo());
    const cap = new ConeGeometry(0.42, 0.75, 12, 1, true); xf(cap, 0, EAVE_Y + Hh * TOP + 0.3, 0); projUV(cap, 1.5); RF.push(cap);
  }

  // ---- chimney: a stout fieldstone stack on the back-left, through the eave, with a cap and pot ----
  const CHA = 2.35, chR = R0 + 0.3, chx = Math.sin(CHA) * chR, chz = Math.cos(CHA) * chR;
  {
    const low = new BoxGeometry(1.25, WALL_H + 0.4 - yb, 0.95); xf(low, chx, (yb + WALL_H + 0.4) / 2, chz, CHA); ST.push(projUV(low, STONE_TILE));
    const up = new BoxGeometry(0.95, 3.4, 0.78); xf(up, chx * 1.0, WALL_H + 0.4 + 1.7, chz, CHA); ST.push(projUV(up, STONE_TILE));
    const capS = new BoxGeometry(1.15, 0.16, 0.98); xf(capS, chx, WALL_H + 0.4 + 3.45, chz, CHA); ST.push(projUV(capS, STONE_TILE));
    const pot = new CylinderGeometry(0.17, 0.21, 0.42, 10, 1, true); xf(pot, chx, WALL_H + 0.4 + 3.74, chz); IR.push(pot);
    // shoulder: a sloped stone haunch where the wide base steps in
    const hau = new BoxGeometry(1.2, 0.3, 0.9); xf(hau, chx, WALL_H + 0.42, chz, CHA, 0.0); ST.push(projUV(hau, STONE_TILE));
  }
  const smokeTop = [chx, WALL_H + 0.4 + 3.95, chz];

  // ---- door step + flagstone path + lantern ----
  {
    const step = new CylinderGeometry(0.95, 1.0, 0.24, 9, 1); xf(step, 0, gd + 0.03, R0 + 0.55, 0.2, 0, 0, 1, 1, 0.62); ST.push(projUV(step, STONE_TILE));
    const r = rng(5);
    for (let i = 0; i < 7; i++) {
      const z = R0 + 1.55 + i * 0.82, x = Math.sin(i * 1.7) * 0.18 + (r() - 0.5) * 0.12, h = hAt(x, z);
      const f = new CylinderGeometry(0.3 + r() * 0.08, 0.32 + r() * 0.08, 0.07, 6 + (i % 3), 1); xf(f, x, h - 0.02, z, r() * 3, (r() - 0.5) * 0.06, (r() - 0.5) * 0.06, 1, 1, 0.75 + r() * 0.3);
      ST.push(projUV(f, STONE_TILE));
    }
    const LA = 0.42, lr = rad(LA, 2.0), lx = Math.sin(LA) * lr, lz = Math.cos(LA) * lr;
    const arm = new BoxGeometry(0.04, 0.04, 0.42); xf(arm, lx, 2.42, lz, LA); arm.translate(Math.sin(LA) * 0.2, 0, Math.cos(LA) * 0.2); IR.push(arm);
    const cx = lx + Math.sin(LA) * 0.38, cz = lz + Math.cos(LA) * 0.38;
    const top = new ConeGeometry(0.17, 0.16, 4); xf(top, cx, 2.3, cz, Math.PI / 4); IR.push(top);
    const base = new BoxGeometry(0.2, 0.04, 0.2); xf(base, cx, 1.93, cz, LA); IR.push(base);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = new BoxGeometry(0.02, 0.32, 0.02); xf(p, cx + sx * 0.09, 2.08, cz + sz * 0.09); IR.push(p); }
    const flame = new BoxGeometry(0.15, 0.28, 0.15); xf(flame, cx, 2.08, cz, LA); GL.push(flame);
    const hook = new BoxGeometry(0.03, 0.08, 0.03); xf(hook, cx, 2.26, cz); IR.push(hook);
  }

  // ---- woodpile against the wall (left of the door), chopping block + axe; a barrel right of it ----
  {
    const r = rng(23), A = -0.5, base = R0 + BATTER + 0.38, tan = [Math.cos(A), 0, -Math.sin(A)], nrm = [Math.sin(A), 0, Math.cos(A)];
    const gy = hAt(Math.sin(A) * base, Math.cos(A) * base);
    let n = 0;
    for (let row = 0; row < 5; row++) for (let k = 0; k < 7 - row; k++) {
      const rr = 0.09 + r() * 0.035, s = (k - (6 - row) / 2) * 0.22 + (r() - 0.5) * 0.03, y = gy + 0.1 + row * 0.19;
      const log = new CylinderGeometry(rr, rr * 1.04, 0.62 + r() * 0.12, 7, 1); log.rotateX(Math.PI / 2);
      xf(log, Math.sin(A) * base + tan[0] * s + (r() - 0.5) * 0.04, y, Math.cos(A) * base + tan[2] * s, A + (r() - 0.5) * 0.12);
      WD.push(projUV(log, WT * 0.5)); n++;
    }
    const roofP = new BoxGeometry(1.75, 0.05, 0.85); xf(roofP, Math.sin(A) * (base + 0.05), gy + 1.12, Math.cos(A) * (base + 0.05), A, -0.25); WD.push(projUV(roofP, WT));
    for (const s of [-0.85, 0.85]) { const post = new BoxGeometry(0.08, 1.1, 0.08); xf(post, Math.sin(A) * (base + 0.38) + tan[0] * s, gy + 0.55, Math.cos(A) * (base + 0.38) + tan[2] * s, A); WD.push(projUV(post, WT, true)); }
    // chopping block + axe in front of the pile
    const bx = Math.sin(A - 0.2) * (base + 1.15), bz = Math.cos(A - 0.2) * (base + 1.15), by = hAt(bx, bz);
    const blk = new CylinderGeometry(0.3, 0.33, 0.5, 10); xf(blk, bx, by + 0.23, bz); WD.push(projUV(blk, WT * 0.5, true));
    const hnd = new CylinderGeometry(0.025, 0.03, 0.8, 6); xf(hnd, bx + 0.12, by + 0.72, bz, 0.4, 0, -0.5); WD.push(projUV(hnd, WT, true));
    const head = new BoxGeometry(0.2, 0.14, 0.03); xf(head, bx + 0.0, by + 0.5, bz, 0.4, 0, -0.5); IR.push(head);
    // barrel
    const BA = 0.55, br = R0 + BATTER + 0.42, bxx = Math.sin(BA) * br, bzz = Math.cos(BA) * br, byy = hAt(bxx, bzz);
    const prof = []; for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push(new Vector2(0.3 + 0.06 * Math.sin(Math.PI * t), t * 0.92)); }
    const barrel = new LatheGeometry(prof, 14); const uv = barrel.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * 0.92 / WT, uv.getX(i) * 2.2 / WT);
    xf(barrel, bxx, byy - 0.02, bzz); WD.push(barrel);
    const lid = new CylinderGeometry(0.3, 0.3, 0.02, 14); xf(lid, bxx, byy + 0.86, bzz); WD.push(projUV(lid, WT));
    for (const t of [0.12, 0.8]) { const hp = new TorusGeometry(0.31 + 0.06 * Math.sin(Math.PI * t) + 0.005, 0.014, 4, 18); hp.rotateX(Math.PI / 2); xf(hp, bxx, byy + t * 0.92, bzz); IR.push(hp); }
    if (colliders) {
      const [wx, wz] = toWorld(Math.sin(A) * base, Math.cos(A) * base);
      colliders.push({ type: 'box', x: wx, z: wz, hw: 0.95 * S, hd: 0.45 * S, angle: -(th + A), hut: true });
      const [qx, qz] = toWorld(bxx, bzz); colliders.push({ type: 'circle', x: qx, z: qz, r: 0.36 * S, hut: true });
      const [cx2, cz2] = toWorld(bx, bz); colliders.push({ type: 'circle', x: cx2, z: cz2, r: 0.3 * S, hut: true });
    }
  }

  // ---- the pumpkin patch beside the hut ----
  const PATCH = { lx: -5.6, lz: 2.9 };     // local, beside the door on the paddock side (see notes in the report)
  const pumpkins = buildPumpkins(PATCH, hAt, GD, WD, S, toWorld, colliders);

  // ---- assemble: one mesh per material ----
  const add = (list, mat, name, shadow = false) => { if (!list.length) return null; const m = new Mesh(merge(list), mat); m.name = name; m.castShadow = shadow; m.receiveShadow = true; root.add(m); return m; };
  const stoneMesh = add(ST, stone, 'hut-stone', true);
  const roofMesh = add(RF, roofMat, 'hut-roof', true);
  add(WD, wood, 'hut-wood');
  add(IR, ironMaterial(), 'hut-iron');
  add(GL, glass, 'hut-glow');
  const garden = new MeshStandardMaterial({ map: gardenMap(), alphaTest: 0.5, side: DoubleSide, roughness: 0.9 }); garden.name = 'hut-garden';
  add(GD, garden, 'hut-garden');
  root.add(pumpkins);

  // ---- chimney smoke: 9 translucent grey puffs (low-poly balls: a textured soft-sprite version rendered
  // nothing on this renderer) rising, growing, then shrinking away; no per-frame allocation ----
  const NP = 9, smokeMat = new MeshBasicMaterial({ transparent: true, opacity: 0.28, depthWrite: false, fog: true });
  smokeMat.color.copy(SMOKE.color); SMOKE.mats.push(smokeMat);
  const puffs = new InstancedMesh(new IcosahedronGeometry(0.5, 1), smokeMat, NP);
  puffs.name = 'hut-smoke'; puffs.frustumCulled = false; puffs.renderOrder = 2;
  const dum = new Object3D();
  root.add(puffs);
  let t = 0;
  function updateSmoke(dt) {
    t += dt;
    for (let i = 0; i < NP; i++) {
      const ph = (t * 0.075 + i / NP) % 1, rise = ph * 4.2;
      dum.position.set(smokeTop[0] + Math.sin(ph * 5 + i) * 0.18 + ph * 1.4, smokeTop[1] + rise, smokeTop[2] + ph * 0.5);
      dum.rotation.set(ph * 2 + i, ph * 3, 0); dum.scale.setScalar((0.35 + ph * 1.7) * Math.min(1, ph * 8, (1 - ph) * 3.5)); dum.updateMatrix();   // grow, then thin away
      puffs.setMatrixAt(i, dum.matrix);
    }
    puffs.instanceMatrix.needsUpdate = true;
  }

  // ---- colliders: the round wall (+ eave reach for the chimney) ----
  if (colliders) {
    colliders.push({ type: 'circle', x: HUT.x, z: HUT.z, r: (R0 + BATTER) * S, hut: true });
    const [cx, cz] = toWorld(chx, chz); colliders.push({ type: 'box', x: cx, z: cz, hw: 0.65 * S, hd: 0.5 * S, angle: -(th + CHA), hut: true });
  }
  if (obstacles) obstacles.push(stoneMesh, roofMesh);
  scene.add(root);

  let shown = true;
  return {
    group: root,
    update(dt, playerPos, inside) {
      const on = !inside && !!playerPos && Math.hypot(playerPos.x - HUT.x, playerPos.z - HUT.z) < HUT.cull;
      if (on !== shown) { shown = on; root.visible = on; }
      if (on) updateSmoke(dt);
    },
  };
}

// 10 ribbed pumpkins (one instanced mesh, vertex-coloured grooves), leaves + vines + soil in the
// garden atlas (merged into GD), bean-pole wigwam + scarecrow (wood into WD, cloth/straw into GD).
function pumpkinGeo() {
  const g = new SphereGeometry(0.5, 18, 10), p = g.attributes.position, cols = [];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ph = Math.atan2(z, x), rib = 0.5 + 0.5 * Math.cos(ph * 10), s = Math.sqrt(Math.max(0, 1 - (y / 0.5) ** 2));
    const k = 1 - 0.075 * (1 - rib) * s; x *= k; z *= k;
    y *= 0.68; if (y > 0.24) y -= (y - 0.24) * 0.9; if (y < -0.28) y = -0.28 + (y + 0.28) * 0.3;
    p.setXYZ(i, x, y + 0.29, z);
    const c = (0.7 + 0.3 * rib) * (y > 0.22 ? 0.85 : 1); cols.push(c, c, c);
  }
  g.computeVertexNormals(); g.setAttribute('color', new Float32BufferAttribute(cols, 3));
  const st = new CylinderGeometry(0.03, 0.05, 0.17, 6); st.rotateZ(0.35); st.translate(0.02, 0.58, 0);
  const sc = []; for (let i = 0; i < st.attributes.position.count; i++) sc.push(0.42, 0.55, 0.3);
  st.setAttribute('color', new Float32BufferAttribute(sc, 3));
  const a = g.toNonIndexed(), b = st.toNonIndexed(); b.deleteAttribute('uv'); a.deleteAttribute('uv');
  return mergeGeometries([a, b], false);
}
function buildPumpkins(PATCH, hAt, GD, WD, S, toWorld, colliders) {
  const r = rng(77), [u0s, v0s] = GA.soil, [u0l, v0l] = GA.leaf;
  // soil bed: an irregular disc conformed to the terrain (rings x spokes)
  const RX = 3.1, RZ = 2.3, NS = 28, NR = 4, bed = new Soup();
  const bp = (i, j) => { const a = i / NS * Math.PI * 2, f = j / NR; const x = PATCH.lx + Math.cos(a) * RX * f, z = PATCH.lz + Math.sin(a) * RZ * f; return [x, hAt(x, z) + 0.04 + 0.03 * (1 - f), z]; };
  const bu = (i, j) => { const a = i / NS * Math.PI * 2, f = j / NR; return [u0s + 0.25 + Math.cos(a) * f * 0.245, v0s + 0.25 + Math.sin(a) * f * 0.245]; };
  const up = [0, 1, 0];
  for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) bed.quad(bp(i, j), bp(i, j + 1), bp(i + 1, j + 1), bp(i + 1, j), up, up, up, up, bu(i, j), bu(i, j + 1), bu(i + 1, j + 1), bu(i + 1, j));
  // (winding: viewed from above, j outward then i+1 -> clockwise; flip by reversing)
  const bg = bed.geo(); const idx = []; for (let i = 0; i < bg.attributes.position.count; i += 3) idx.push(i, i + 2, i + 1);
  bg.setIndex(idx); GD.push(bg.toNonIndexed());
  // pumpkins: [x, z (relative to patch), diameter]
  const P = [[-1.6, -0.5, 1.05], [0.6, 0.7, 1.15], [1.9, -0.9, 0.95], [-0.4, -1.3, 0.62], [-2.3, 0.9, 0.55], [1.2, -1.5, 0.48],
    [2.4, 0.6, 0.6], [-0.9, 1.3, 0.42], [0.1, -0.2, 0.38], [-2.6, -1.2, 0.36], [1.5, 1.6, 0.4]];
  const im = new InstancedMesh(pumpkinGeo(), new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.45 }), P.length);
  im.name = 'hut-pumpkins'; im.receiveShadow = true;
  const d = new Object3D(), c = new Color(), tints = [0xe2741c, 0xd86814, 0xe8862a, 0xcc6010, 0xe89434];
  P.forEach(([x, z, s], i) => {
    const lx = PATCH.lx + x, lz = PATCH.lz + z; d.position.set(lx, hAt(lx, lz) + 0.02 - s * 0.04, lz);
    d.rotation.set((r() - 0.5) * 0.12, r() * 6.3, (r() - 0.5) * 0.12); d.scale.set(s * (0.95 + r() * 0.15), s * (0.85 + r() * 0.2), s * (0.95 + r() * 0.15)); d.updateMatrix();
    im.setMatrixAt(i, d.matrix); im.setColorAt(i, c.setHex(tints[i % tints.length]));
    if (colliders && s > 0.7) { const [wx, wz] = toWorld(lx, lz); colliders.push({ type: 'circle', x: wx, z: wz, r: s * 0.45 * S, hut: true }); }
  });
  // leaves: folded cards round the pumpkins
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, f = Math.sqrt(r()), x = PATCH.lx + Math.cos(a) * RX * 0.9 * f, z = PATCH.lz + Math.sin(a) * RZ * 0.9 * f;
    const s = 0.5 + r() * 0.4, L = new Soup();
    const hw = s * 0.5, fold = 0.1 * s;
    const A = [-hw, 0, 0], B = [0, -fold, 0], Cc = [0, -fold, s], Dd = [-hw, 0, s], E = [hw, 0, 0], F = [hw, 0, s];
    const uv = (p) => [u0l + 0.25 + p[0] / s * 0.49, v0l + 0.015 + p[2] / s * 0.48];
    L.fquad(A, B, Cc, Dd, [0, 1, 0], uv); L.fquad(B, E, F, Cc, [0, 1, 0], uv);
    const g = L.geo(); xf(g, x, hAt(x, z) + 0.08 + r() * 0.12, z, r() * 6.3, -0.35 - r() * 0.5); GD.push(g);
  }
  // vines: thin curling tubes wandering between the pumpkins
  for (let i = 0; i < 9; i++) {
    const pts = []; let x = PATCH.lx + (r() - 0.5) * 3, z = PATCH.lz + (r() - 0.5) * 2, a = r() * 6.3;
    for (let k = 0; k < 7; k++) { pts.push(new Vector3(x, hAt(x, z) + 0.06 + Math.abs(Math.sin(k * 1.3)) * 0.05, z)); a += (r() - 0.5) * 1.6; x += Math.cos(a) * 0.45; z += Math.sin(a) * 0.45; }
    const tube = new TubeGeometry(new CatmullRomCurve3(pts), 18, 0.018, 4, false); GD.push(flatUV(tube, GA.vine[0], GA.vine[1]));
  }
  // bean-pole wigwam with twine and a climbing vine
  {
    const bx = PATCH.lx - 3.7, bz = PATCH.lz - 0.4, by = hAt(bx, bz);
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2 + 0.3, len = 2.3, tilt = 0.2;
      // the foot stands 0.45 m out and the pole leans in
      const foot = new CylinderGeometry(0.022, 0.028, len, 5); foot.translate(0, len / 2, 0); foot.rotateZ(tilt); foot.translate(0.45, 0, 0); foot.rotateY(a); foot.translate(bx, by, bz);
      WD.push(projUV(foot, 1.6, true));
      const vp = []; for (let j = 0; j <= 10; j++) { const t = j / 10, h = t * len * 0.85, rr = 0.45 - Math.sin(tilt) * h; vp.push(new Vector3(bx + Math.cos(-a) * rr + Math.cos(t * 9 + k) * 0.05, by + h * Math.cos(tilt), bz + Math.sin(-a) * rr + Math.sin(t * 9 + k) * 0.05)); }
      GD.push(flatUV(new TubeGeometry(new CatmullRomCurve3(vp), 14, 0.014, 4, false), GA.vine[0], GA.vine[1]));
    }
    for (let i = 0; i < 10; i++) {   // a few leaves on the wigwam
      const a = r() * 6.3, h = 0.3 + r() * 1.5, rr = 0.45 - Math.sin(0.2) * h + 0.05, s = 0.2 + r() * 0.12, L = new Soup();
      const uv = (p) => [u0l + 0.25 + p[0] / s * 0.49, v0l + 0.015 + p[2] / s * 0.48];
      L.fquad([-s / 2, 0, 0], [s / 2, 0, 0], [s / 2, 0, s], [-s / 2, 0, s], [0, 1, 0], uv);
      const g = L.geo(); xf(g, bx + Math.cos(a) * rr, by + h, bz + Math.sin(a) * rr, -a + Math.PI / 2, -1.0 + r() * 0.4); GD.push(g);
    }
    const tw = new TorusGeometry(0.1, 0.012, 4, 10); tw.rotateX(Math.PI / 2); tw.translate(bx, by + 2.2, bz); GD.push(flatUV(tw, GA.twine[0], GA.twine[1]));
  }
  // a friendly scarecrow at the back of the patch: pole + cross-arm, burlap head, patched coat, hat, straw
  {
    const sx = PATCH.lx - 1.2, sz = PATCH.lz + 1.9, sy = hAt(sx, sz), [bu, bv] = GA.burlap, [su, sv] = GA.straw;
    const pole = new CylinderGeometry(0.045, 0.055, 2.1, 6); xf(pole, sx, sy + 1.05, sz); WD.push(projUV(pole, 1.6, true));
    const arm = new CylinderGeometry(0.035, 0.035, 1.5, 6); xf(arm, sx, sy + 1.55, sz, 0.3, 0, Math.PI / 2); WD.push(projUV(arm, 1.6));
    const head = new SphereGeometry(0.2, 10, 8); head.scale(1, 1.1, 0.95); cellUV(head, bu, bv, 0.5, 0.5); xf(head, sx, sy + 2.0, sz, 0.3); GD.push(head);
    const coat = new CylinderGeometry(0.24, 0.36, 0.85, 8, 1); cellUV(coat, bu, bv, 0.5, 0.5); xf(coat, sx, sy + 1.32, sz, 0.3); GD.push(coat);
    const sleeve = new CylinderGeometry(0.1, 0.12, 1.25, 6, 1, true); cellUV(sleeve, bu, bv, 0.5, 0.25); xf(sleeve, sx, sy + 1.55, sz, 0.3, 0, Math.PI / 2); GD.push(sleeve);
    const brim = new CylinderGeometry(0.34, 0.34, 0.025, 12); cellUV(brim, bu, bv, 0.5, 0.5); xf(brim, sx, sy + 2.2, sz, 0.3, 0.1); GD.push(brim);
    const crown = new ConeGeometry(0.17, 0.34, 9); cellUV(crown, bu, bv, 0.5, 0.5); xf(crown, sx + 0.04, sy + 2.37, sz, 0.3, 0.15, -0.25); GD.push(crown);
    for (let k = 0; k < 6; k++) {   // straw tufts at the cuffs, neck and hem (crossed cards)
      const at = [[0.72, 1.55], [-0.72, 1.55], [0, 1.82], [0.15, 0.9], [-0.15, 0.9], [0, 0.88]][k];
      for (const rot of [0, Math.PI / 2]) {
        const c = new PlaneGeometry(0.22, 0.2); cellUV(c, su, sv, 0.375, 0.5);
        const ax = Math.cos(0.3) * at[0], az = -Math.sin(0.3) * at[0];
        xf(c, sx + ax, sy + at[1] - 0.06, sz + az, rot + 0.3 + k, 0, at[0] ? Math.sign(at[0]) * 1.2 : 0); GD.push(c);
      }
    }
    if (colliders) { const [wx, wz] = toWorld(sx, sz); colliders.push({ type: 'circle', x: wx, z: wz, r: 0.2 * S, hut: true }); }
  }
  return im;
}

// ---------------------------------------------------------------------------------------------
// The Victorian glasshouse (Herbology). Local frame: origin at the floor centre, the double door
// in the front gable toward +z (Sprout's side). Low stone plinth, dark-green painted iron frame
// with thin glazing bars, pitched glass roof with ridge cresting and finials, faintly milky aged
// glass (blotchy, grimy low down), potting benches with terracotta pots and leafy plants inside,
// hanging baskets, one big leafy plant and two lanterns that glow at dusk/night.
// Draw calls: stone | frame | glass | wood | pots (instanced) | plants (instanced) | glow = 7.
export const GLASSHOUSE = { W: 6.6, D: 7.0, EH: 3.1, RH: 5.5, PL: 0.6 };

let _glassTex = null;
function glassMap() {
  if (_glassTex) return _glassTex;
  const [c, g] = canvas(256), r = rng(41);
  const img = g.createImageData(256, 256), d = img.data;
  // soft value noise (two octaves) for milky blotches
  const N = (s) => { const a = []; for (let i = 0; i < s * s; i++) a.push(r()); return (x, y) => { x *= s; y *= s; const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, q = (i, j) => a[((j % s + s) % s) * s + ((i % s + s) % s)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (q(x0, y0) * (1 - sx) + q(x0 + 1, y0) * sx) * (1 - sy) + (q(x0, y0 + 1) * (1 - sx) + q(x0 + 1, y0 + 1) * sx) * sy; }; };
  const n1 = N(5), n2 = N(13);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = x / 256, v = 1 - y / 256;              // v = 0 at the bottom of a wall / the eave of a roof slope
    const m = n1(u, v) * 0.65 + n2(u, v) * 0.35;
    const grime = Math.max(0, 1 - v / 0.16) ** 1.5;  // dirt splashed up the lowest panes
    const streak = Math.max(0, Math.sin(u * 6.283 * 9 + n2(u, 0.3) * 4)) ** 12 * 0.35 * (1 - v);   // dried run-off
    let a = 0.2 + m * 0.2 + grime * 0.36 + streak * 0.2;
    let R = 214 - m * 18 - grime * 90, G = 222 - m * 14 - grime * 82, B = 212 - m * 20 - grime * 110;
    const i = (y * 256 + x) * 4; d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = Math.min(255, a * 255);
  }
  g.putImageData(img, 0, 0);
  const t = ctex(c); t.wrapT = ClampToEdgeWrapping;
  return (_glassTex = t);
}
let _sprig = null;
function sprigMap() {
  if (_sprig) return _sprig;
  const [c, g] = canvas(256), r = rng(64);
  g.strokeStyle = '#3d5a22'; g.lineWidth = 4; g.beginPath(); g.moveTo(128, 256); g.quadraticCurveTo(122, 140, 132, 18); g.stroke();
  for (let i = 0; i < 15; i++) {
    const t = 0.1 + i / 15 * 0.85, y = 256 - t * 236, x = 128 + Math.sin(t * 3) * 4, side = i % 2 ? 1 : -1;
    const L = 70 * (1 - t * 0.55) + r() * 16, ang = side * (0.7 + r() * 0.35) - side * t * 0.3;
    g.save(); g.translate(x, y); g.rotate(ang - Math.PI / 2 * 0); g.rotate(side * 0.0);
    const hue = r(); g.fillStyle = hue < 0.3 ? '#4f7a2e' : hue < 0.7 ? '#3e6a26' : '#5f8a36';
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(side * L * 0.5, -L * 0.42, side * L, -L * 0.25); g.quadraticCurveTo(side * L * 0.5, -L * 0.02, 0, 0); g.fill();
    g.strokeStyle = 'rgba(170,200,120,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(side * L * 0.9, -L * 0.24); g.stroke();
    g.restore();
  }
  return (_sprig = ctex(c, { repeat: false }));
}
function plantClumpGeo() {
  const gs = [];
  for (let k = 0; k < 5; k++) {
    const p = new PlaneGeometry(0.42, 0.5); p.translate(0, 0.25, 0); p.rotateX(-0.25 - (k % 2) * 0.2); p.rotateY(k / 5 * Math.PI * 2 + 0.3); gs.push(p);
  }
  return merge(gs);
}
function potGeo() {
  // (no base: pots stand on benches or soil; ~56 tris each)
  const pr = [[0.088, 0], [0.115, 0.16], [0.13, 0.165], [0.13, 0.2], [0.106, 0.2], [0.1, 0.17], [0, 0.17]].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(pr, 8);
}

export function buildGlasshouse({ heightAt, colliders, x, z, rotY = 0 }) {
  const { W, D, EH, RH, PL } = GLASSHOUSE, hw = W / 2, hd = D / 2, pitch = Math.atan2(RH - EH, hw), slope = Math.hypot(hw, RH - EH);
  const y0 = heightAt(x, z), root = new Group(); root.name = 'greenhouse'; root.position.set(x, y0, z); root.rotation.y = rotY;
  const ST = [], FR = [], GLS = [], WD = [], GW = [];
  const stone = stoneMaterial(new Color(1.3, 1.2, 1.04), 'gh-stone');
  const frame = new MeshStandardMaterial({ color: 0x2c4430, roughness: 0.48, metalness: 0.25 }); frame.name = 'gh-frame';
  const wood = woodMaterial(0xf0e6da, 'gh-wood'), WT = 1.6 * wood.userData.rep;
  const B = (list, w, h, d, px, py, pz, ry = 0, rx = 0, rz = 0) => { const g = new BoxGeometry(w, h, d); xf(g, px, py, pz, ry, rx, rz); list.push(g); return g; };
  const DW = 0.78;                                   // half width of the door opening
  // ---- plinth (stone), with the door gap; coping; floor ----
  const PT = 0.32, pb = -0.45, ph = PL - pb;
  for (const s of [-1, 1]) { const g = new BoxGeometry(PT, ph, D + PT); xf(g, s * hw, pb + ph / 2, 0); ST.push(projUV(g, STONE_TILE)); }
  { const g = new BoxGeometry(W - PT, ph, PT); xf(g, 0, pb + ph / 2, -hd); ST.push(projUV(g, STONE_TILE)); }
  for (const s of [-1, 1]) { const len = hw - DW - 0.08; const g = new BoxGeometry(len, ph, PT); xf(g, s * (DW + 0.08 + len / 2), pb + ph / 2, hd); ST.push(projUV(g, STONE_TILE)); }
  const CW = PT + 0.1, CY = PL + 0.04;
  for (const s of [-1, 1]) { const g = new BoxGeometry(CW, 0.08, D + CW); xf(g, s * hw, CY, 0); ST.push(projUV(g, STONE_TILE)); }
  { const g = new BoxGeometry(W - CW, 0.08, CW); xf(g, 0, CY, -hd); ST.push(projUV(g, STONE_TILE)); }
  for (const s of [-1, 1]) { const len = hw - DW - 0.08; const g = new BoxGeometry(len, 0.08, CW); xf(g, s * (DW + 0.08 + len / 2), CY, hd); ST.push(projUV(g, STONE_TILE)); }
  { const g = new PlaneGeometry(W - 0.1, D - 0.1); g.rotateX(-Math.PI / 2); g.translate(0, 0.07, 0); ST.push(projUV(g, STONE_TILE * 0.5)); }
  { const g = new BoxGeometry(2 * DW + 0.3, 0.16, 0.8); xf(g, 0, 0.0, hd + 0.3); ST.push(projUV(g, STONE_TILE)); }      // the door step
  const GY = CY + 0.04;                              // glass + frame start on the coping
  // ---- frame: sills, posts, bars, transom, eave beams, gutters ----
  const zs = []; for (let i = 0; i <= 6; i++) zs.push(-hd + i * D / 6);
  for (const s of [-1, 1]) {
    B(FR, 0.1, 0.07, D + 0.1, s * hw, GY + 0.035, 0);                                 // sill plate
    for (const zz of zs) B(FR, 0.09, EH - GY, 0.09, s * hw, (GY + EH) / 2, zz);       // posts
    for (let i = 0; i < 6; i++) B(FR, 0.03, EH - GY, 0.035, s * hw, (GY + EH) / 2, (zs[i] + zs[i + 1]) / 2);   // glazing bars
    B(FR, 0.07, 0.06, D, s * hw, 2.05, 0);                                             // transom
    B(FR, 0.12, 0.15, D + 0.16, s * hw, EH, 0);                                        // eave beam
    const gut = new CylinderGeometry(0.075, 0.075, D + 0.3, 8, 1, true, 0, Math.PI); gut.rotateX(Math.PI / 2); gut.rotateZ(Math.PI); xf(gut, s * (hw + 0.13), EH - 0.02, 0); FR.push(gut);
    B(FR, 0.06, EH - 0.1, 0.06, s * (hw + 0.13), (EH - 0.1) / 2, hd + 0.05);          // downpipe
  }
  // gable verticals (front and back) up to the roof line; the front pair frame the door
  const roofY = (xx) => EH + (hw - Math.abs(xx)) * Math.tan(pitch);
  for (const fz of [-hd, hd]) {
    const front = fz > 0;
    B(FR, W + 0.1, 0.07, 0.1, 0, GY + 0.035, fz);
    if (!front) B(FR, 0.07, 0.06, 0.07, 0, 2.05, fz);
    for (const xx of [-2.47, -1.63, 1.63, 2.47, ...(front ? [-DW, DW] : [-0.8, 0, 0.8])]) {
      const top = roofY(xx), bot = front && Math.abs(xx) === DW ? 0.05 : GY;
      B(FR, Math.abs(xx) === DW ? 0.11 : 0.05, top - bot, 0.07, xx, (top + bot) / 2, fz);
    }
    for (const xx of [-2.05, 2.05, -1.2, 1.2]) { const top = roofY(xx); B(FR, 0.03, top - GY, 0.035, xx, (top + GY) / 2, fz); }
    for (const s of [-1, 1]) B(FR, hw - (front ? DW : 0), 0.06, 0.07, s * (hw + (front ? DW : 0)) / 2, 2.05, fz);   // transom
    // barge boards along the gable rake
    for (const s of [-1, 1]) B(FR, slope + 0.12, 0.13, 0.09, s * hw / 2, (EH + RH) / 2 + 0.05, fz + (front ? 0.04 : -0.04), 0, 0, -s * pitch);
    if (front) {
      const DH = 2.45;
      B(FR, 2 * DW + 0.1, 0.12, 0.1, 0, DH, fz);                                      // door head
      { const top = roofY(0); B(FR, 0.05, top - DH, 0.07, 0, (top + DH) / 2, fz); }
      // the two leaves: solid lower panel, glazed upper with bars, a meeting stile, knobs
      for (const s of [-1, 1]) {
        const cx = s * DW / 2, lw = DW - 0.04;
        B(FR, lw, 0.8, 0.05, cx, 0.5, fz + 0.01);                                       // lower panel (painted the frame green)
        B(FR, lw, 0.07, 0.07, cx, 0.92, fz); B(FR, lw, 0.06, 0.07, cx, DH - 0.06, fz); B(FR, lw, 0.05, 0.06, cx, 1.68, fz);
        B(FR, 0.06, DH - 0.1, 0.07, s * 0.035, DH / 2, fz); B(FR, 0.03, DH - 1.0, 0.04, cx, (DH + 0.95) / 2, fz);
        const kn = new SphereGeometry(0.035, 6, 4); xf(kn, s * 0.12, 1.0, fz + 0.07); FR.push(kn);
      }
    }
  }
  // ---- roof: rafters, glazing bars, purlins, ridge beam, cresting, finials ----
  for (const s of [-1, 1]) {
    const mx = s * hw / 2, my = (EH + RH) / 2;
    for (const zz of zs) B(FR, slope, 0.11, 0.08, mx, my + 0.02, zz, 0, 0, -s * pitch);
    for (let i = 0; i < 6; i++) B(FR, slope, 0.035, 0.03, mx, my + 0.01, (zs[i] + zs[i + 1]) / 2, 0, 0, -s * pitch);
    B(FR, 0.07, 0.06, D, mx, my + 0.03, 0, 0, 0, -s * pitch);                          // purlin
  }
  B(FR, 0.14, 0.18, D + 0.24, 0, RH + 0.04, 0);                                        // ridge beam
  B(FR, 0.04, 0.04, D + 0.1, 0, RH + 0.36, 0);                                         // cresting top rail
  for (let zz = -hd; zz <= hd + 1e-6; zz += 0.25) {
    B(FR, 0.025, 0.24, 0.025, 0, RH + 0.24, zz);
    const dmd = new BoxGeometry(0.02, 0.1, 0.1); xf(dmd, 0, RH + 0.24, zz + 0.125, 0, Math.PI / 4); FR.push(dmd);   // little diamonds
  }
  for (const fz of [-hd - 0.08, hd + 0.08]) {
    B(FR, 0.07, 0.5, 0.07, 0, RH + 0.3, fz);
    const ball = new SphereGeometry(0.08, 8, 6); xf(ball, 0, RH + 0.6, fz); FR.push(ball);
    const spike = new ConeGeometry(0.045, 0.32, 6); xf(spike, 0, RH + 0.83, fz); FR.push(spike);
  }
  // ---- glass: walls, gables, roof (uv: metres across / 2.4, 0..1 up each pane run) ----
  const Gs = new Soup(), gu = 1 / 2.4;
  const wallQ = (a, b, c, d, n, ua, ub) => Gs.quad(a, b, c, d, n, n, n, n, [ua, 0], [ub, 0], [ub, 1], [ua, 1]);
  for (const s of [-1, 1]) wallQ([s * hw, GY, s * hd], [s * hw, GY, -s * hd], [s * hw, EH, -s * hd], [s * hw, EH, s * hd], [s, 0, 0], 0, D * gu);
  for (const fz of [-hd, hd]) {
    const n = [0, 0, Math.sign(fz)], f = fz > 0;
    if (f) {
      for (const s of [-1, 1]) wallQ([s * hw, GY, fz], [s * DW, GY, fz], [s * DW, EH, fz], [s * hw, EH, fz], n, 0, (hw - DW) * gu);
      wallQ([-DW, 0.9, fz], [DW, 0.9, fz], [DW, EH, fz], [-DW, EH, fz], n, 0, 2 * DW * gu);
    } else wallQ([hw, GY, fz], [-hw, GY, fz], [-hw, EH, fz], [hw, EH, fz], n, 0, W * gu);
    // gable triangle (degenerate quad)
    Gs.quad([-hw, EH, fz], [hw, EH, fz], [0, RH, fz], [0, RH, fz], n, n, n, n, [0, 0.3], [W * gu, 0.3], [W * gu * 0.5, 1], [W * gu * 0.5, 1]);
  }
  for (const s of [-1, 1]) { const n = [s * Math.sin(pitch), Math.cos(pitch), 0]; wallQ([s * hw, EH, s * hd], [s * hw, EH, -s * hd], [0, RH, -s * hd], [0, RH, s * hd], n, 0, D * gu); }
  GLS.push(Gs.geo());
  // ---- inside: benches (wood), pots (instanced), plants (instanced), baskets, lamps ----
  const BH = 0.85, BD = 0.78, BL = D - 1.4, bz0 = -0.35;
  const pots = [], plants = [], r = rng(29);
  for (const s of [-1, 1]) {
    const bx = s * (hw - 0.16 - BD / 2);
    for (let k = 0; k < 4; k++) B(WD, BD / 4 - 0.02, 0.04, BL, bx - BD / 2 + BD / 8 + k * BD / 4, BH, bz0);   // slatted top
    B(WD, BD, 0.03, BL, bx, 0.28, bz0);                                                // lower shelf
    B(WD, 0.06, 0.12, BL, bx - s * BD / 2, BH - 0.07, bz0);                            // apron
    for (let i = 0; i <= 4; i++) for (const e of [-1, 1]) B(WD, 0.06, BH, 0.06, bx + e * (BD / 2 - 0.05), BH / 2, bz0 - BL / 2 + 0.1 + i * (BL - 0.2) / 4);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) {
      const px = bx + (j ? -0.17 : 0.17), pz = bz0 - BL / 2 + 0.3 + i * (BL - 0.6) / 8 + (r() - 0.5) * 0.06, sc = 0.9 + r() * 0.35;
      pots.push([px, BH + 0.02, pz, sc]); if (r() < 0.88) plants.push([px, BH + 0.02 + 0.16 * sc, pz, sc * (0.55 + r() * 0.5), r() * 6.3, 0]);
    }
    for (let i = 0; i < 4; i++) { const px = bx + (r() - 0.5) * 0.4, pz = bz0 - BL / 2 + 0.5 + i * (BL - 1.0) / 3; pots.push([px, 0.31, pz, 0.8 + r() * 0.3]); }   // spare pots on the shelf
  }
  // tiered staging across the back
  for (let t = 0; t < 3; t++) {
    const ty = 0.45 + t * 0.32, tz = -hd + 0.45 + t * 0.32 * 0 + (2 - t) * 0.3 - 0.25;
    B(WD, 2.6, 0.04, 0.3, 0, ty, tz);
    for (const e of [-1.25, 0, 1.25]) B(WD, 0.05, ty, 0.05, e, ty / 2, tz);
    for (let i = 0; i < 7; i++) { const px = -1.1 + i * 0.37, sc = 0.8 + r() * 0.3; pots.push([px, ty + 0.02, tz, sc]); plants.push([px, ty + 0.02 + 0.16 * sc, tz, sc * (0.5 + r() * 0.45), r() * 6.3, 0]); }
  }
  // one big leafy plant in a large pot by the door, a couple of floor pots
  pots.push([1.25, 0.08, 1.9, 3.2]); for (let k = 0; k < 4; k++) plants.push([1.25, 0.6, 1.9, 2.6 + k * 0.35, k * 1.6, 0]);
  pots.push([-1.3, 0.08, 2.2, 2.2]); plants.push([-1.3, 0.45, 2.2, 1.6, 0.4, 0]);
  // hanging baskets from the roof
  for (const [bx, bz] of [[-0.9, 0.8], [0.9, -1.4]]) {
    const by = 3.25;
    const bas = new SphereGeometry(0.24, 10, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); xf(bas, bx, by, bz); FR.push(bas);
    B(FR, 0.012, roofY(bx) - by, 0.012, bx, (by + roofY(bx)) / 2, bz);
    plants.push([bx, by - 0.02, bz, 1.0, r() * 6, 0]); plants.push([bx, by + 0.02, bz, 1.1, r() * 6, Math.PI]);   // up + trailing down
  }
  // two lanterns hanging from the ridge (glow at dusk/night)
  const lamp = glowMat({ color: 0x2a1c0c, emissive: 0xffb860 }, 2.4);
  for (const lz of [-1.6, 1.4]) {
    const ly = 3.7;
    B(FR, 0.015, RH - ly - 0.15, 0.015, 0, (RH + ly) / 2, lz);
    const cap = new ConeGeometry(0.14, 0.12, 6); xf(cap, 0, ly + 0.02, lz); FR.push(cap);
    B(FR, 0.16, 0.025, 0.16, 0, ly - 0.32, lz);
    const gb = new CylinderGeometry(0.08, 0.08, 0.26, 6); xf(gb, 0, ly - 0.18, lz); GW.push(gb);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B(FR, 0.015, 0.32, 0.015, sx * 0.075, ly - 0.17, lz + sz * 0.075);
  }
  // ---- assemble ----
  const add = (list, mat, name, shadow = false) => { if (!list.length) return null; const m = new Mesh(merge(list), mat); m.name = name; m.castShadow = shadow; m.receiveShadow = true; root.add(m); return m; };
  for (const g of WD) projUV(g, WT);
  add(ST, stone, 'gh-stone', true);
  add(FR, frame, 'gh-frame', true);
  add(WD, wood, 'gh-wood');
  add(GW, lamp, 'gh-lamps');
  const potIM = new InstancedMesh(potGeo(), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 }), pots.length);
  const d = new Object3D(), c = new Color();
  pots.forEach(([px, py, pz, s], i) => { d.position.set(px, py, pz); d.rotation.set(0, r() * 6, 0); d.scale.setScalar(s); d.updateMatrix(); potIM.setMatrixAt(i, d.matrix); potIM.setColorAt(i, c.setRGB(0.4 + r() * 0.08, 0.12 + r() * 0.04, 0.05 + r() * 0.02)); });
  potIM.name = 'gh-pots'; potIM.receiveShadow = true; root.add(potIM);
  const plantIM = new InstancedMesh(plantClumpGeo(), new MeshStandardMaterial({ map: sprigMap(), alphaTest: 0.5, side: DoubleSide, roughness: 0.8 }), plants.length);
  plants.forEach(([px, py, pz, s, ry, flip], i) => { d.position.set(px, py, pz); d.rotation.set(flip, ry, 0); d.scale.setScalar(s); d.updateMatrix(); plantIM.setMatrixAt(i, d.matrix); const k = 0.75 + r() * 0.35; plantIM.setColorAt(i, c.setRGB(k * (0.85 + r() * 0.2), k, k * (0.7 + r() * 0.2))); });
  plantIM.name = 'gh-plants'; root.add(plantIM);
  // the glass last: transparent, double-sided, no depth write; a faint warm lamp glow at night
  const glass = glowMat({ map: glassMap(), color: 0xffffff, transparent: true, depthWrite: false, side: DoubleSide, roughness: 0.1, metalness: 0.0, emissive: 0xffa448 }, 0.2);
  glass.name = 'gh-glass';
  const gm = add(GLS, glass, 'gh-glass'); gm.renderOrder = 1;
  if (colliders) colliders.push({ type: 'box', x, z, hw: hw + 0.18, hd: hd + 0.18, angle: -rotY, greenhouse: true });
  return root;
}
