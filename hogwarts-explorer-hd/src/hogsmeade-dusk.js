// Hogsmeade milestone 3 (briefs/2026-11-28-hogsmeade-m3-decisions.md): the softer distance round the street, code-built:
//  - hills: two rolling ridge rings (vertex colours: snowy crests, dark fir bands, blue-grey haze lower down), ONE mesh `hm-hills`
//    (<= 1,200 triangles), with a low saddle towards +x (the Shrieking Shack stands free against the sky) and -x (the castle)
//  - the sky dome's colours with a warm afterglow low in the west (-x)
//  - `hm-stars`: 60 to 90 tiny faint stars above 35 degrees (one additive mesh; still, never more than a faint twinkle); off on LOW
//  - `hm-mist`: 8 big soft cards low over the road beyond x +-24 and behind the far roofs (one mesh, vertex alpha <= 0.35, no depth
//    write); a card fades out within 6 m of the camera (tickMist, per frame); off on LOW
// All in the street (Honeydukes room) frame; the street runs along x, centre line z ~ 8.5. No textures beyond two tiny canvases.
import { Mesh, BufferGeometry, BufferAttribute, PlaneGeometry, MeshBasicMaterial, Color, Vector3, Matrix4, Quaternion, CanvasTexture, SRGBColorSpace, AdditiveBlending, DoubleSide } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CZ = 8;   // the ring / dome centre (x 0, z 8), as the milestone 1 sky
const quiet = (o) => { o.frustumCulled = false; o.raycast = () => {}; return o; };
const _c = new Color(), _d = new Color(), _m = new Matrix4(), _q = new Quaternion(), _v = new Vector3(), _s = new Vector3(1, 1, 1);
// a low saddle (0..1 dip) towards +x (a = pi/2) and -x (a = 3 pi/2)
const dip = (a, w) => { const d1 = Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)), d2 = Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)); return Math.max(Math.exp(-((d1 / w) ** 2)), Math.exp(-((d2 / w) ** 2))); };
const noise = (a, s) => 0.5 + 0.22 * Math.sin(a * 3 + s) + 0.16 * Math.sin(a * 7.3 + s * 2.1) + 0.12 * Math.sin(a * 13.1 + s * 0.7);

// ---------------- hills ----------------
// one ring: N segments; rows (bottom -> crest): base, haze top, fir-band top (jagged), snowy crest. 3 quad rows = 6 tris / segment
function ring(r, N, hMin, hMax, seed, cols) {
  const rows = 4, pos = new Float32Array(N * rows * 3), col = new Float32Array(N * rows * 3), idx = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, n = noise(a, seed), sd = dip(a, 0.32), h = (hMin + (hMax - hMin) * n) * (1 - 0.82 * sd) + 1.5;
    const rr = r + 6 * Math.sin(a * 5 + seed), x = Math.sin(a) * rr, z = CZ + Math.cos(a) * rr;
    const fir = h * (0.55 + 0.12 * Math.sin(a * 29 + seed * 3)) * (1 - 0.6 * sd), ys = [-3, h * 0.3, fir, h];
    for (let k = 0; k < rows; k++) {
      const o = (i * rows + k) * 3; pos[o] = x; pos[o + 1] = ys[k]; pos[o + 2] = z;
      _c.setHex(cols[k]); col[o] = _c.r; col[o + 1] = _c.g; col[o + 2] = _c.b;
    }
    const j = (i + 1) % N;
    for (let k = 0; k < rows - 1; k++) { const a0 = i * rows + k, a1 = j * rows + k; idx.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1); }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('color', new BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}
// near ring: lower, a little warmer haze, clear fir bands; far ring: taller, bluer, paler (more air in front of it)
export function buildHills() {
  const near = ring(104, 72, 7, 17, 1.3, [0x8a90ac, 0x8f96b2, 0x4a5868, 0xc6ccdc]);
  const far = ring(132, 72, 12, 30, 4.1, [0x9aa0bc, 0x9ea4c0, 0x6a7690, 0xccd0e0]);
  const geo = mergeGeometries([far, near], false);
  const hills = quiet(new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, fog: false, side: DoubleSide })));
  hills.name = 'hm-hills';
  return hills;
}
export const hillTris = (m) => m.geometry.index.count / 3;

// ---------------- the dome's colours: the M1 gradient + a warm afterglow low in the west ----------------
export function skyColours(geo, stops) {
  const p = geo.attributes.position, n = p.count, a = new Float32Array(n * 3), r = geo.parameters.radius;
  for (let i = 0; i < n; i++) {
    const t = Math.max(-1, Math.min(1, p.getY(i) / r)); let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k], [t1, c1] = stops[k + 1], u = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
    _c.setHex(c0).lerp(_d.setHex(c1), u);
    const west = Math.max(0, -p.getX(i) / r), glow = west ** 2.2 * Math.exp(-(((t - 0.04) / 0.11) ** 2));   // low in the west, strongest just above the horizon
    _c.lerp(_d.setHex(0xf0b890), Math.min(0.75, glow * 0.9));
    a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new BufferAttribute(a, 3)); return geo;
}

// ---------------- stars ----------------
function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }
let _starTex = null;
const starTex = () => _starTex || (_starTex = canvasTex(16, 16, (x) => { const g = x.createRadialGradient(8, 8, 0, 8, 8, 8); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 16, 16); }));
export function buildStars(n = 76, R = 140) {
  let s = 7; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const parts = [];
  for (let i = 0; i < n; i++) {
    const az = rnd() * Math.PI * 2, el = (35 + 50 * Math.sqrt(rnd())) * Math.PI / 180, k = 0.5 + rnd() * 0.7;
    _v.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    _q.setFromUnitVectors(new Vector3(0, 0, 1), _v.clone().negate());   // the quad faces the centre
    const g = new PlaneGeometry(0.9 * k, 0.9 * k); const c = new Float32Array(4 * 3); _c.setHex(0xfff4e0).multiplyScalar(0.35 + 0.4 * rnd()); for (let j = 0; j < 4; j++) { c[j * 3] = _c.r; c[j * 3 + 1] = _c.g; c[j * 3 + 2] = _c.b; }
    g.setAttribute('color', new BufferAttribute(c, 3));
    parts.push(g.applyMatrix4(_m.compose(_v.multiplyScalar(R).add(new Vector3(0, 0, CZ)), _q, _s)));
  }
  const stars = quiet(new Mesh(mergeGeometries(parts, false), new MeshBasicMaterial({ map: starTex(), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false })));
  stars.name = 'hm-stars'; stars.renderOrder = -1; stars.userData.n = n;
  return stars;
}

// ---------------- mist ----------------
let _mistTex = null;
const mistTex = () => _mistTex || (_mistTex = canvasTex(64, 32, (x, w, h) => {
  const gx = x.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.25, 'rgba(255,255,255,1)'); gx.addColorStop(0.75, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gx; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'destination-in';
  const gy = x.createLinearGradient(0, 0, 0, h); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.55, 'rgba(0,0,0,.8)'); gy.addColorStop(0.85, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,.6)');
  x.fillStyle = gy; x.fillRect(0, 0, w, h);
}));
// cards: centre (x, y, z), size (w, h), ry (0 = facing +z); street ends face along x (towards the street centre)
const MIST = [
  [26.5, 1.8, 8.6, 13, 3.6, -Math.PI / 2], [31.5, 2.4, 8.6, 18, 5.0, -Math.PI / 2],
  [-26.5, 1.8, 8.6, 13, 3.6, Math.PI / 2], [-31.5, 2.4, 8.6, 18, 5.0, Math.PI / 2],
  [-14, 5.5, 20, 30, 6, Math.PI], [14, 5.5, 20, 30, 6, Math.PI], [0, 5.5, -6, 34, 6, 0], [40, 4, 14, 26, 7, -Math.PI / 2],
];
export const MIST_A = 0.32;
export function buildMist() {
  const parts = [];
  for (const [x, y, z, w, h, ry] of MIST) {
    const g = new PlaneGeometry(w, h); g.setAttribute('color', new BufferAttribute(new Float32Array(16).fill(1), 4));
    _q.setFromAxisAngle(new Vector3(0, 1, 0), ry); parts.push(g.applyMatrix4(_m.compose(_v.set(x, y, z), _q, _s)));
  }
  const mat = new MeshBasicMaterial({ map: mistTex(), color: 0xc8c8de, vertexColors: true, transparent: true, depthWrite: false, fog: false, side: DoubleSide });
  const mist = quiet(new Mesh(mergeGeometries(parts, false), mat)); mist.name = 'hm-mist'; mist.renderOrder = 2;
  mist.userData.cards = MIST.map(([x, y, z, w, h, ry]) => ({ x, y, z, w, h, nx: Math.sin(ry), nz: Math.cos(ry) }));
  tickMist(mist, 0, 1e4, 0);
  return mist;
}
// per frame: each card's alpha from the camera's distance to it (room frame); 0 within 1.5 m, full (MIST_A) from 6 m
export function tickMist(mist, cx, cy, cz) {
  const col = mist.geometry.attributes.color, C = mist.userData.cards;
  for (let i = 0; i < C.length; i++) {
    const c = C[i], dx = cx - c.x, dz = cz - c.z, dn = Math.abs(dx * c.nx + dz * c.nz), along = Math.abs(dx * c.nz - dz * c.nx) - c.w / 2, dy = Math.abs(cy - c.y) - c.h / 2;
    const d = Math.hypot(dn, Math.max(0, along), Math.max(0, dy)), u = Math.min(1, Math.max(0, (d - 1.5) / 4.5)), a = MIST_A * u * u * (3 - 2 * u);
    for (let j = 0; j < 4; j++) col.setW(i * 4 + j, a);
  }
  col.needsUpdate = true;
}
