// Hogsmeade High Street (milestone 1) geometry for hogsmeade-street.js: the code-built FALLBACK street (used when the GLB
// hm_street_01.glb is missing or fails to load) and the code-built DRESSING that goes with either street: a dusk sky dome,
// a soft ring of snowy far hills, lantern / window glow cards, warm light pools on the snow, chimney smoke puffs, light falling
// snow (one pooled InstancedMesh), and the Hebrew Honeydukes signs (canvas). All in the Honeydukes room frame of
// briefs/2026-11-27-hogsmeade-m1-decisions.md (three.js, +Y up, metres; the shop front is the plane z = 4.8, the street runs
// along x, the far-side house fronts at z 12.2..12.8). The fallback is plain on purpose (boxes, steep prism roofs with snow
// caps, warm windows, lantern posts): 2 draw calls, < 8k triangles.
import {
  Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, PlaneGeometry, InstancedMesh, Object3D,
  Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace,
  AdditiveBlending, BackSide, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { place, paint, merge, softTex, FONT } from './adventure-b3-map-build.js';

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
const quiet = (o) => { o.frustumCulled = false; o.raycast = () => {}; return o; };
function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }

// ---------------- the fallback street (same node names and the same sidecar shape as the GLB) ----------------
// a steep prism roof along x (ridge along x), width w (x), depth d (z), its eaves at y0, ridge height rh above the eaves
function roof(w, d, x, y0, z, rh, hex, ry = 0) {
  const g = new BoxGeometry(w, Math.SQRT1_2 * d, Math.SQRT1_2 * d).rotateX(Math.PI / 4);
  g.scale(1, (2 * rh) / d, 1); g.translate(0, y0, 0); g.rotateY(ry); g.translate(x, 0, z);
  return paint(g, hex);
}
// the milestone 1 sidecar's reserved plots (hm_street_01.json signs.plots), the same for the fallback street
export const PLOTS = { hogshead: { x: -21.4, y: 3.2, z: 12.4, w: 2.4, h: 0.6, ry: Math.PI }, broomsticks: { x: 18.0, y: 3.2, z: 12.5, w: 2.4, h: 0.6, ry: Math.PI }, zonko: { x: 10.8, y: 3.2, z: 4.85, w: 2.4, h: 0.6, ry: 0 } };
const WALLS = [0x9a8a78, 0x8a7a6a, 0xb0a08a, 0x7a6e66, 0xa89a86, 0x8e8070];
export function fallbackStreet() {
  const S = [], E = [], H = [], HE = [], B = [], BE = [];   // street solid / emissive, Honeydukes body solid / emissive, bow solid / emissive
  const SLATE = 0x4a5266, SNOW = 0xd2d6e2, OAK = 0x5a3b25, IRON = 0x2e2b30, COB = 0x77787f;
  const cols = [], lanterns = [], windows = [], chimneys = [];
  // ground: the near pavement, the cobbled road with a trodden strip, the far pavement, snow beyond, kerbs
  S.push(paint(place(new BoxGeometry(72, 0.1, 1.6), 0, -0.05, 5.6), SNOW));
  S.push(paint(place(new BoxGeometry(72, 0.1, 4.2), 0, -0.06, 8.5), COB));
  S.push(paint(place(new BoxGeometry(72, 0.02, 1.4), 0, 0.0, 8.5), 0x8a8a92));
  for (const z of [6.9, 10.1]) S.push(paint(place(new BoxGeometry(72, 0.05, 0.8), 0, -0.01, z), 0xbcc0cc));   // soft drifts along the kerbs
  S.push(paint(place(new BoxGeometry(72, 0.1, 1.6), 0, -0.05, 11.4), SNOW));
  S.push(paint(place(new BoxGeometry(72, 0.1, 30), 0, -0.07, 27), SNOW));
  S.push(paint(place(new BoxGeometry(72, 0.1, 30), 0, -0.07, -10.2), SNOW));
  for (const z of [6.4, 10.6]) S.push(paint(place(new BoxGeometry(72, 0.03, 0.14), 0, 0.0, z), 0x9a9aa2));
  // one house: body box, a steep roof with a snow cap, warm windows, a door, a chimney. front: +1 faces +z (near side faces -z... see side)
  const house = (x, w, d, h, side, i) => {   // side -1: far side (front faces -z at z = 12.2); +1: near side (front faces +z at z = 4.8)
    const zf = side < 0 ? 12.2 : 4.8, zc = zf - side * d / 2, lean = ((i * 37) % 5 - 2) * 0.012, col = WALLS[i % WALLS.length];
    const body = new BoxGeometry(w, h, d); body.translate(0, h / 2, 0); body.rotateZ(lean); body.translate(x, 0, zc); S.push(paint(body, col));
    S.push(paint(place(new BoxGeometry(w + 0.12, 0.35, d + 0.12), x, 0.17, zc), 0x6a625a));                    // a stone footing
    const rh = 2.2 + (i % 3) * 0.5;
    S.push(roof(w + 0.5, d + 0.7, x, h, zc, rh, SLATE));
    S.push(roof(w + 0.2, d + 0.78, x, h + 0.12, zc, rh, SNOW));                                                   // the snow cap (gables stay slate)
    const cx = x + (i % 2 ? 0.28 : -0.28) * w;
    S.push(paint(place(new BoxGeometry(0.6, 1.8, 0.6), cx, h + rh * 0.55 + 0.5, zc + side * 0.6), 0x6a5e56));
    S.push(paint(place(new BoxGeometry(0.66, 0.1, 0.66), cx, h + rh * 0.55 + 1.42, zc + side * 0.6), SNOW));
    chimneys.push([cx, h + rh * 0.55 + 1.5, zc + side * 0.6]);
    const fz = zf + side * 0.03;   // windows / door just proud of the front
    const nwin = Math.max(2, Math.round(w / 2.4));
    for (let k = 0; k < nwin; k++) {
      const wx = x - w / 2 + (k + 0.5) * (w / nwin);
      for (const wy of [1.5, h - 1.0]) {
        if (wy === 1.5 && k === Math.floor(nwin / 2)) continue;   // the door goes there
        E.push(paint(place(new PlaneGeometry(0.8, 1.0), wx, wy, fz, 0, side < 0 ? Math.PI : 0, 0), 0xffffff));
        S.push(paint(place(new BoxGeometry(1.0, 0.1, 0.22), wx, wy - 0.55, fz + side * 0.05), SNOW));            // a snowy sill
        S.push(paint(place(new BoxGeometry(0.06, 1.0, 0.06), wx, wy, fz + side * 0.02), 0x3a2a20));
        if (k % 2 === 0) windows.push([wx, wy, fz + side * 0.3]);
      }
    }
    const dx = x - w / 2 + (Math.floor(nwin / 2) + 0.5) * (w / nwin);
    S.push(paint(place(new BoxGeometry(1.1, 2.1, 0.12), dx, 1.05, fz), OAK));
    cols.push({ x, z: zc, hw: w / 2 + 0.1, hd: d / 2 + 0.1 });
  };
  // far side (the window looks at these), then the near-side neighbours left and right of Honeydukes
  const far = [[-22, 7], [-14.5, 6.5], [-7.8, 6], [-1.8, 5.4], [3.8, 5.2], [9.6, 6], [16, 6.4], [23, 7]];
  far.forEach(([x, w], i) => house(x, w, 6.5, 4.6 + (i % 3) * 1.1, -1, i));
  const near = [[-21, 6.5], [-13.8, 6.8], [-8.6, 4.4], [8.6, 4.4], [13.8, 6.8], [21, 6.5]];
  near.forEach(([x, w], i) => house(x, w, 6.5, 4.8 + (i % 2) * 1.2, 1, i + 3));
  // lantern posts along both kerbs
  for (const [x, z] of [[-3.5, 10.4], [4.5, 10.4], [-12, 10.4], [12.5, 10.4], [-8, 6.6], [8.2, 6.6], [-17, 6.6], [17.5, 6.6]]) {
    S.push(paint(place(new CylinderGeometry(0.06, 0.08, 2.8, 6), x, 1.4, z), IRON));
    S.push(paint(place(new BoxGeometry(0.34, 0.06, 0.34), x, 2.82, z), IRON));
    S.push(paint(place(new ConeGeometry(0.28, 0.24, 4), x, 3.25, z, 0, Math.PI / 4, 0), IRON));
    S.push(paint(place(new ConeGeometry(0.24, 0.12, 4), x, 3.4, z, 0, Math.PI / 4, 0), SNOW));
    E.push(paint(place(new BoxGeometry(0.24, 0.3, 0.24), x, 3.0, z), 0xffffff));
    lanterns.push([x, 3.0, z]);
  }
  // street ends: a snow bank and a low wall
  for (const sx of [-1, 1]) { S.push(paint(place(new BoxGeometry(1.0, 1.0, 8.2), sx * 31, 0.5, 8.5), 0x6a625a)); S.push(paint(place(new SphereGeometry(1.6, 8, 5), sx * 30, 0, 8.5, 0, 0, 0, 1.2, 0.6, 3), SNOW)); }
  cols.push({ x: -31, z: 8.5, hw: 0.6, hd: 4.2 }, { x: 31, z: 8.5, hw: 0.6, hd: 4.2 });
  // Honeydukes: an 11 m raspberry shop front (front z = 4.8), a big window, the door at x 3.6, a blank fascia (the game paints it)
  const HW = 11.2, HD = 9.6, HH = 4.4, RASP = 0x9a3a5a;
  H.push(paint(place(new BoxGeometry(HW, HH, 0.3), 0, HH / 2, 4.65), RASP));
  H.push(paint(place(new BoxGeometry(HW, HH, HD), 0, HH / 2 + 0.001, 0, 0, 0, 0, 1, 1, 0.97), 0x8a7a6a));
  H.push(roof(HW + 0.6, HD + 0.8, 0, HH, 0, 3.0, SLATE)); H.push(roof(HW + 0.3, HD + 0.9, 0, HH + 0.12, 0, 3.0, SNOW));
  H.push(paint(place(new BoxGeometry(6.4, 0.9, 0.16), 0, 3.35, 4.88), 0x5a2a3a));    // the fascia board (the sign is painted on top)
  H.push(paint(place(new BoxGeometry(1.3, 2.3, 0.14), 3.6, 1.15, 4.86), OAK));
  HE.push(paint(place(new PlaneGeometry(4.2, 1.7), 0, 1.8, 4.83), 0xffffff));   // the lit shop behind the bow
  H.push(paint(place(new BoxGeometry(0.06, 0.06, 1.2), -3.4, 3.62, 5.2), IRON));   // the hanging sign's bracket
  for (const wx of [-4.4, 4.9]) { HE.push(paint(place(new PlaneGeometry(0.8, 1.0), wx, 2.2, 4.84), 0xffffff)); }
  // the bow window (both scenes): frame, sill, glazing bars, sweets in the display
  B.push(paint(place(new BoxGeometry(4.6, 0.25, 0.6), 0, 0.85, 5.0), 0xe8dcc4));
  B.push(paint(place(new BoxGeometry(4.6, 0.2, 0.6), 0, 2.75, 5.0), 0xe8dcc4));
  for (const bx of [-2.2, -0.75, 0.75, 2.2]) B.push(paint(place(new BoxGeometry(0.08, 1.8, 0.08), bx, 1.8, 5.22), 0xe8dcc4));
  for (let k = 0; k < 9; k++) { const c = [0xe87aa8, 0x7ad8b8, 0xe8d06a, 0x7ab0e8, 0xb88ae0][k % 5]; B.push(paint(place(new BoxGeometry(0.34, 0.24, 0.26), -1.8 + k * 0.45, 1.1, 5.0, 0, k * 0.4, 0), c)); }
  cols.push({ x: 0, z: 0, hw: HW / 2 + 0.1, hd: 4.95 });
  const solid = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }); solid.name = 'MAT_Hm_Fallback';
  const glow = new MeshStandardMaterial({ vertexColors: true, color: 0x000000, emissive: 0xffc870, emissiveIntensity: 1.4 }); glow.name = 'EMI_Hm_Window_Warm';
  const node = (name, solidList, emiList) => { const g = new Group(); g.name = name; if (solidList.length) g.add(quiet(new Mesh(merge(solidList), solid))); if (emiList.length) g.add(quiet(new Mesh(merge(emiList), glow))); return g; };
  const root = new Group(); root.name = 'hm-fallback';
  root.add(node('Hm_Street', S, E), node('Hm_Honeydukes_Body', H, HE), node('Hm_Honeydukes_Bow', B, BE));
  const side = {
    colliders: cols, lanterns, windows, chimneys,
    signs: {
      honeydukes_fascia: { x: 0, y: 3.35, z: 4.98, w: 6.0, h: 0.8, ry: 0 }, honeydukes_hanging: { x: -3.4, y: 3.0, z: 5.6, w: 0.9, h: 0.9, ry: Math.PI / 2 },
      plots: { ...PLOTS },
      // (M2) the three named shops' signs at the milestone 1 plots (x, and the house front), low enough to clear the upper windows
      broomsticks_fascia: { x: PLOTS.broomsticks.x, y: 2.55, z: 12.15, w: 2.6, h: 0.42, ry: Math.PI },
      zonko_fascia: { x: PLOTS.zonko.x, y: 2.55, z: 4.86, w: 2.6, h: 0.46, ry: 0 },
      hogshead_hanging: { x: PLOTS.hogshead.x, y: 2.7, z: 12.1, w: 0.9, h: 0.9, ry: Math.PI },
    },
    doors: { broomsticks: { x: PLOTS.broomsticks.x, z: 11.5 }, zonko: { x: PLOTS.zonko.x, z: 5.6 }, hogshead: { x: PLOTS.hogshead.x, z: 11.5 } },
    door: { x: 3.6, z: 4.8 }, walk: { x0: -30, x1: 30, z0: 4.8, z1: 12.2 }, fallback: true,
  };
  return { root, side };
}

// ---------------- dressing (either street) ----------------
function gradSky(geo, stops) {
  const p = geo.attributes.position, n = p.count, a = new Float32Array(n * 3), r = geo.parameters.radius, A = new Color(), Bc = new Color();
  for (let i = 0; i < n; i++) { const t = Math.max(-1, Math.min(1, p.getY(i) / r)); let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++; const [t0, c0] = stops[k], [t1, c1] = stops[k + 1], u = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
    A.setHex(c0); Bc.setHex(c1); a[i * 3] = A.r + (Bc.r - A.r) * u; a[i * 3 + 1] = A.g + (Bc.g - A.g) * u; a[i * 3 + 2] = A.b + (Bc.b - A.b) * u; }
  geo.setAttribute('color', new BufferAttribute(a, 3)); return geo;
}
const SNOWTOP = new Color(0xc8cede);
// a dusk sky: pale rose-lilac at the horizon, soft periwinkle, a deeper (never dark) blue overhead; snowy far hills all round
export function buildSky() {
  const g = new Group(); g.name = 'hm-sky';
  const sky = quiet(new Mesh(gradSky(new SphereGeometry(150, 24, 12), [[-1, 0x8a90b0], [0.0, 0xd4bccc], [0.08, 0xb8b4d4], [0.3, 0x8a9acc], [1, 0x5a6aa8]]), new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false })));
  sky.name = 'hm-sky-dome'; sky.renderOrder = -2; sky.position.set(0, 0, 8); g.add(sky);
  const HP = [];
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2, r = 78 + (i % 3) * 9, hgt = 14 + ((i * 7) % 5) * 4;
    const c = new ConeGeometry(20 + (i % 4) * 5, hgt, 7); const p = c.attributes.position, col = new Float32Array(p.count * 3);
    for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + hgt / 2) / hgt; _c.setHex(i % 2 ? 0x6e7898 : 0x7a84a2).lerp(SNOWTOP, Math.max(0, (t - 0.55) / 0.45)); col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b; }
    c.setAttribute('color', new BufferAttribute(col, 3)); HP.push(place(c, Math.sin(a) * r, hgt / 2 - 2, 8 + Math.cos(a) * r));
  }
  const hills = quiet(new Mesh(merge(HP), new MeshBasicMaterial({ vertexColors: true, fog: false }))); hills.name = 'hm-hills'; g.add(hills);
  return { g, sky, hills };
}
// glow cards (lanterns + a few windows: one InstancedMesh, faced to the camera each frame) and light pools on the snow (one)
export function buildGlows(side, mode = 'street') {
  const soft = softTex(), pts = [];
  for (const p of side.lanterns || []) pts.push({ p, s: 1.5, c: 0xffc870 });
  for (const p of side.windows || []) pts.push({ p, s: 1.1, c: 0xffb860 });
  const n = Math.max(1, pts.length);
  const glows = quiet(new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: soft, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }), n));
  glows.name = 'hm-glows'; glows.count = pts.length;
  pts.forEach((o, i) => glows.setColorAt(i, _c.setHex(o.c).multiplyScalar(0.75)));
  const pools = buildPools(side, mode, soft);
  return { glows, pools, pts };
}
// (M2) the warm light pools: one soft round ground card (radius POOL_R) under every lantern, all merged into ONE additive mesh
// (1 draw). Lifted 5 cm with a polygon offset and no depth write, so it never fights the road, the pavement or the kerbs; a drift
// or a step higher than that simply covers it. A little stronger in the walkable dusk street than behind the shop window.
export const POOL_R = 2.2;
export function buildPools(side, mode = 'street', soft = softTex()) {
  const L = side.lanterns || [], parts = [];
  for (const p of L) parts.push(new PlaneGeometry(POOL_R * 2, POOL_R * 2).rotateX(-Math.PI / 2).translate(p[0], 0.05, p[2]));
  const geo = parts.length ? mergeGeometries(parts, false) : new PlaneGeometry(0.01, 0.01).rotateX(-Math.PI / 2).translate(0, -50, 0);
  const mat = new MeshBasicMaterial({ map: soft, color: 0xffbe6a, transparent: true, opacity: mode === 'street' ? 0.72 : 0.5, depthWrite: false, blending: AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const pools = quiet(new Mesh(geo, mat)); pools.name = 'hm-light-pools'; pools.visible = parts.length > 0; pools.renderOrder = 1; pools.userData.n = parts.length;
  return pools;
}
// chimney smoke: 3 soft puffs per chimney rising, growing and thinning out (one InstancedMesh)
export const PUFFS = 3;
export function buildSmoke(side, max = 10) {
  const list = (side.chimneys || []).slice(0, max);
  const tex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.6, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  const mesh = quiet(new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: tex, color: 0xb4bcd0, transparent: true, depthWrite: false }), Math.max(1, list.length * PUFFS)));
  mesh.name = 'hm-smoke'; mesh.count = list.length * PUFFS; mesh.renderOrder = 3;
  return { mesh, list };
}
// light falling snow: n small soft flakes (one InstancedMesh), placed by the caller each frame
export function buildSnow(n) {
  const tex = canvasTex(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); });
  const mesh = quiet(new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: tex, color: 0xeef2ff, transparent: true, depthWrite: false, fog: false }), Math.max(1, n)));
  mesh.name = 'hm-snow'; mesh.count = n; mesh.renderOrder = 5;
  const flakes = []; for (let i = 0; i < n; i++) flakes.push({ x: Math.random(), y: Math.random(), z: Math.random(), ph: Math.random() * 6.3, s: 0.045 + Math.random() * 0.04, v: 0.55 + Math.random() * 0.35 });
  return { mesh, flakes, n };
}
// the Hebrew signs: the fascia board "הדובשנרייה" with a sweet emblem, and a round hanging sign with a lollipop
export function buildSigns(side) {
  const g = new Group(); g.name = 'hm-signs'; const S = side.signs || {}, out = {};
  const fascia = canvasTex(512, 96, (x, w, h) => {
    x.fillStyle = '#5a1e36'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d8b050'; x.lineWidth = 6; x.strokeRect(5, 5, w - 10, h - 10);
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 54px ' + FONT; x.fillStyle = '#ffe2a0'; x.fillText('הדובשנרייה', w / 2, h / 2 + 3);
    for (const sx of [42, w - 42]) { x.fillStyle = '#f08ab8'; x.beginPath(); x.arc(sx, h / 2, 20, 0, 7); x.fill(); x.strokeStyle = '#fff4f0'; x.lineWidth = 4; x.beginPath(); x.arc(sx, h / 2, 11, 0, 5.2); x.stroke(); }
  });
  const hang = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#5a1e36'; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill(); x.strokeStyle = '#d8b050'; x.lineWidth = 5; x.stroke();
    x.fillStyle = '#f6e8e0'; x.fillRect(61, 70, 6, 46); x.fillStyle = '#f08ab8'; x.beginPath(); x.arc(64, 52, 30, 0, 7); x.fill();
    x.strokeStyle = '#fff4f0'; x.lineWidth = 6; x.beginPath(); for (let a = 0; a < 12; a += 0.25) { const r = a * 2.2; x.lineTo(64 + Math.cos(a) * r, 52 + Math.sin(a) * r); } x.stroke();
  });
  const add = (key, tex, two) => {
    const s = S[key]; if (!s) return;
    const m = quiet(new Mesh(new PlaneGeometry(s.w, s.h), new MeshBasicMaterial({ map: tex, side: two ? DoubleSide : undefined, transparent: !!two, alphaTest: two ? 0.5 : 0 })));
    m.name = 'hm-sign-' + key; m.position.set(s.x, s.y, s.z); m.rotation.y = s.ry || 0; g.add(m); out[key] = m;
  };
  add('honeydukes_fascia', fascia, false);
  // the hanging sign: one face on each side of the board (a plane in its middle would hide inside the board's thickness)
  const hs = S.honeydukes_hanging;
  if (hs) {
    const hg = new Group(); hg.name = 'hm-sign-honeydukes_hanging'; hg.position.set(hs.x, hs.y, hs.z); hg.rotation.y = hs.ry || 0;
    const mat = new MeshBasicMaterial({ map: hang, transparent: true, alphaTest: 0.5 });
    for (const sd of [1, -1]) { const m = quiet(new Mesh(new PlaneGeometry(Math.min(hs.w, hs.h) * 0.92, Math.min(hs.w, hs.h) * 0.92), mat)); m.position.z = sd > 0 ? 0.02 : -0.072; /* (M2) the v2 board spans -0.061..+0.009 from the sidecar point: the back face sat inside it */ m.rotation.y = sd > 0 ? 0 : Math.PI; hg.add(m); }
    g.add(hg); out.honeydukes_hanging = hg;
  }
  return { g, out };
}
export { canvasTex, quiet };
