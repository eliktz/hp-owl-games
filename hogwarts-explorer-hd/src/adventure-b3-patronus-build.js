// Book 3, quest 4 geometry (adventure-b3-patronus.js runs it): the dusk lakeside 'b3lake' (an interior-style scene in the
// rooms pocket, so it adds no outdoor triangles) and the pooled grey shadows. All code-built: vertex colours + small canvas
// textures (<= 256 px), no disk textures.
// The lake: a gold-and-lavender dusk sky dome (never dark), soft far hills, a calm water plane with a shimmering sun path
// (it turns silver at the finale), a sandy shore, reeds, a wooden jetty with two warm lanterns. About 12 draw calls, < 12k tris.
// The grey shadows (kid-safe): small soft faceless smoke wisps, pale grey with a faint silver edge: each is a few round
// puffs stacked into a soft teardrop (no face, no hood, no hands), one InstancedMesh for all of them (1 draw call).
import {
  Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, PlaneGeometry, CircleGeometry, InstancedMesh, Object3D,
  Vector3, Matrix4, Color, BufferAttribute, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, AdditiveBlending, BackSide, RepeatWrapping,
} from 'three';
import { place, paint, merge, triCount, drawCount, softTex } from './adventure-b3-map-build.js';

export { triCount, drawCount };
export const LAKE = { water: -0.35, jettyEnd: -8.2 };
export const LSPAWN = { x: 0, z: -6.6, yaw: Math.PI };          // the jetty's end, facing the water (-z)
const _m = new Matrix4(), _c = new Color();
const quiet = (o) => { o.frustumCulled = false; o.raycast = () => {}; return o; };
function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }
function gradSky(geo, stops) {   // vertex colours by height (y normalised -1..1 on the sphere)
  const p = geo.attributes.position, n = p.count, a = new Float32Array(n * 3), r = geo.parameters.radius;
  for (let i = 0; i < n; i++) { const t = Math.max(-1, Math.min(1, p.getY(i) / r)); let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++; const [t0, c0] = stops[k], [t1, c1] = stops[k + 1], u = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
    const A = new Color(c0), B = new Color(c1); a[i * 3] = A.r + (B.r - A.r) * u; a[i * 3 + 1] = A.g + (B.g - A.g) * u; a[i * 3 + 2] = A.b + (B.b - A.b) * u; }
  geo.setAttribute('color', new BufferAttribute(a, 3)); return geo;
}
export function buildLake() {
  const g = new Group(); g.name = 'b3lake'; const cols = [];
  // the sky: gold at the horizon, rose, then a soft lavender-blue overhead
  const sky = quiet(new Mesh(gradSky(new SphereGeometry(160, 24, 14), [[-1, 0xb89a8a], [0.0, 0xf0c890], [0.12, 0xe8a8a0], [0.4, 0xa8a0d0], [1, 0x7a88c8]]), new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false })));
  sky.name = 'lake-sky'; sky.renderOrder = -2; g.add(sky);
  // a low warm sun glow and a pale early moon (light sources: these may glow)
  const soft = softTex();
  const sun = quiet(new Mesh(new PlaneGeometry(60, 34).translate(-30, 6, -150), new MeshBasicMaterial({ map: soft, color: 0xffd890, transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending })));
  sun.name = 'lake-sun'; g.add(sun);
  const moon = quiet(new Mesh(new CircleGeometry(4, 20).translate(40, 46, -140), new MeshBasicMaterial({ color: 0xf6f2e6, fog: false })));
  moon.name = 'lake-moon'; g.add(moon);
  // far hills all round (soft dusk violet, a little lighter far away) + a few dark-green pine silhouettes on the shores
  const HP = [];
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, r = 92 + (i % 3) * 8, hgt = 9 + ((i * 7) % 5) * 3.2; HP.push(paint(place(new ConeGeometry(18 + (i % 4) * 4, hgt, 7), Math.sin(a) * r, hgt / 2 - 1.2, Math.cos(a) * r), i % 2 ? 0x7a6a9a : 0x8a7aa4)); }
  for (const [x, z, s] of [[-26, -18, 1.2], [-30, -10, 1.0], [-22, 4, 0.9], [24, -16, 1.1], [30, -6, 1.3], [21, 6, 0.8], [-34, -30, 1.4], [36, -28, 1.2]]) {
    HP.push(paint(place(new ConeGeometry(1.6 * s, 4.6 * s, 7), x, 2.6 * s, z), 0x3a5a44)); HP.push(paint(place(new ConeGeometry(1.2 * s, 3.4 * s, 7), x, 4.4 * s, z), 0x4a6a4e)); HP.push(paint(place(new CylinderGeometry(0.2 * s, 0.25 * s, 1, 5), x, 0.4, z), 0x5a3e2a));
  }
  const hills = quiet(new Mesh(merge(HP), new MeshStandardMaterial({ vertexColors: true, roughness: 1 }))); hills.name = 'lake-hills'; g.add(hills);
  // the water: a calm plane, deeper blue near, gold-rose far (vertex colours), never black
  const wg = new PlaneGeometry(220, 150, 1, 12).rotateX(-Math.PI / 2).translate(0, LAKE.water, -70), wp = wg.attributes.position, wa = new Float32Array(wp.count * 3);
  const NEAR = new Color(0x4a6aa0), FAR = new Color(0xd8a890);
  for (let i = 0; i < wp.count; i++) { const k = Math.max(0, Math.min(1, (-wp.getZ(i) - 4) / 120)); _c.copy(NEAR).lerp(FAR, Math.pow(k, 0.7)); wa[i * 3] = _c.r; wa[i * 3 + 1] = _c.g; wa[i * 3 + 2] = _c.b; }
  wg.setAttribute('color', new BufferAttribute(wa, 3));
  const waterMat = new MeshBasicMaterial({ vertexColors: true, color: 0xffffff });
  const water = quiet(new Mesh(wg, waterMat)); water.name = 'lake-water'; g.add(water);
  // the shimmering path on the water (additive streaks that slide slowly; silver at the finale)
  const st = canvasTex(64, 256, (x, w, h) => { x.clearRect(0, 0, w, h); for (let i = 0; i < 46; i++) { const y = (i * 37) % h, ww = 10 + (i * 13) % 30; x.fillStyle = `rgba(255,255,255,${0.25 + (i % 5) * 0.12})`; x.fillRect((w - ww) / 2 + ((i * 11) % 14) - 7, y, ww, 2); } });
  st.wrapS = st.wrapT = RepeatWrapping; st.repeat.set(1, 3);
  const shimMat = new MeshBasicMaterial({ map: st, color: 0xffd8a0, transparent: true, opacity: 0.7, depthWrite: false, blending: AdditiveBlending, fog: false });
  const shim = quiet(new Mesh(new PlaneGeometry(16, 130).rotateX(-Math.PI / 2).translate(-8, LAKE.water + 0.02, -75), shimMat)); shim.name = 'lake-shimmer'; g.add(shim);
  // the shore (sand + grass) and the reeds
  const SP = [];
  SP.push(paint(place(new BoxGeometry(220, 0.4, 40), 0, -0.2, 24), 0x7a9a5a));
  SP.push(paint(place(new BoxGeometry(220, 0.42, 3.2), 0, -0.2, 3.4), 0xd8c08a));
  for (let i = 0; i < 70; i++) { const side = i % 2 ? 1 : -1, x = side * (2.2 + (i * 1.7) % 24), z = 1.6 + ((i * 0.37) % 1.6), h = 0.9 + (i % 4) * 0.25; SP.push(paint(place(new ConeGeometry(0.05, h, 4), x, h / 2 - 0.1, z, 0, 0, ((i % 5) - 2) * 0.06), i % 3 ? 0x6a8a4a : 0x8a9a5a)); if (i % 4 === 0) SP.push(paint(place(new CylinderGeometry(0.05, 0.05, 0.18, 5), x, h - 0.05, z), 0x6a4a2a)); }
  for (let i = 0; i < 12; i++) SP.push(paint(place(new SphereGeometry(0.5 + (i % 3) * 0.2, 7, 5), ((i * 9) % 40) - 20 + (i % 2 ? 6 : -6), 0.05, 6 + (i % 4) * 2.5, 0, 0, 0, 1, 0.5, 1), 0x8a8478));   // a few round stones
  const shore = quiet(new Mesh(merge(SP), new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }))); shore.name = 'lake-shore'; g.add(shore);
  // the jetty: planks on posts out over the water, a rail, two lantern posts
  const JP = [], WOOD = 0x8a6040, DARK = 0x5a3e2a;
  for (let i = 0; i < 16; i++) JP.push(paint(place(new BoxGeometry(2.4, 0.08, 0.68), 0, -0.04, 4.6 - i * 0.8), i % 2 ? WOOD : 0x9a6e48));
  for (const z of [4.2, 0.6, -3.0, -6.6]) for (const sx of [-1, 1]) JP.push(paint(place(new CylinderGeometry(0.1, 0.12, 1.4, 6), sx * 1.1, -0.6, z), DARK));
  for (const sx of [-1, 1]) { JP.push(paint(place(new BoxGeometry(0.08, 0.08, 9.6), sx * 1.15, 0.75, -1.6), DARK)); for (const z of [3.2, -0.4, -4.0]) JP.push(paint(place(new BoxGeometry(0.08, 0.8, 0.08), sx * 1.15, 0.38, z), DARK)); }
  for (const sx of [-1, 1]) { JP.push(paint(place(new CylinderGeometry(0.06, 0.07, 2.0, 6), sx * 1.15, 1.0, -7.4), DARK)); JP.push(paint(place(new BoxGeometry(0.26, 0.32, 0.26), sx * 1.15, 2.1, -7.4), 0x3a3028)); }
  const jetty = quiet(new Mesh(merge(JP), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }))); jetty.name = 'lake-jetty'; g.add(jetty);
  const lampL = quiet(new Mesh(merge([-1, 1].map(sx => paint(new BoxGeometry(0.18, 0.22, 0.18).translate(sx * 1.15, 2.1, -7.4), 0xffffff))), new MeshStandardMaterial({ vertexColors: true, emissive: 0xffc870, emissiveIntensity: 1.8 })));
  lampL.name = 'lake-lanterns'; g.add(lampL);
  const glows = quiet(new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: soft, color: 0xffc070, transparent: true, depthWrite: false, blending: AdditiveBlending }), 2)); glows.name = 'lake-lantern-glow'; g.add(glows);
  // colliders: Harry stays on the jetty and the near shore
  cols.push({ type: 'box', x: -60, z: 2.6, hw: 58.7, hd: 0.5, angle: 0 }, { type: 'box', x: 60, z: 2.6, hw: 58.7, hd: 0.5, angle: 0 });
  cols.push({ type: 'box', x: -1.55, z: -2.6, hw: 0.25, hd: 5.6, angle: 0 }, { type: 'box', x: 1.55, z: -2.6, hw: 0.25, hd: 5.6, angle: 0 }, { type: 'box', x: 0, z: -8.55, hw: 1.6, hd: 0.25, angle: 0 });
  cols.push({ type: 'box', x: 0, z: 16, hw: 30, hd: 0.5, angle: 0 }, { type: 'box', x: -16, z: 9, hw: 0.5, hd: 8, angle: 0 }, { type: 'box', x: 16, z: 9, hw: 0.5, hd: 8, angle: 0 });
  // the grey shadows (pooled: 6 wisps x 5 puffs)
  const W = buildWisps(6); g.add(W.mesh);
  return { g, cols, sky, water, waterMat, shim, shimMat, glows, W };
}

// ---------------- the grey shadows ----------------
export function wispTex() {   // a soft round puff: pale grey, a little lighter silver rim, fading out (never dark)
  return canvasTex(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(198,202,214,0.62)'); g.addColorStop(0.55, 'rgba(206,210,222,0.5)'); g.addColorStop(0.8, 'rgba(236,240,250,0.42)'); g.addColorStop(0.92, 'rgba(240,244,255,0.18)'); g.addColorStop(1, 'rgba(240,244,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  });
}
export const PUFFS = 5;
// puff layout of one wisp (local x, y, size): a soft teardrop, widest a little above the middle, a thin trailing tail
const LAYOUT = [[0, 0.95, 1.05], [0.12, 0.45, 0.85], [-0.14, 1.35, 0.8], [0.05, 0.05, 0.55], [-0.06, -0.32, 0.36]];
export function buildWisps(n) {
  const mat = new MeshBasicMaterial({ map: wispTex(), transparent: true, depthWrite: false, fog: false });
  const mesh = quiet(new InstancedMesh(new PlaneGeometry(1, 1), mat, n * PUFFS)); mesh.name = 'b3-wisps'; mesh.count = 0; mesh.renderOrder = 4;
  for (let i = 0; i < n * PUFFS; i++) mesh.setColorAt(i, _c.setRGB(1, 1, 1));
  return { mesh, n, LAYOUT };
}
// place the puffs of all live wisps (list of { x, y, z, s, melt, ph }) facing the camera; nothing allocated
const _p = new Vector3(), _s = new Vector3(), _w = new Vector3();
export function drawWisps(W, list, camera, base, T) {
  const M = W.mesh; let k = 0;
  for (const w of list) {
    if (!w.alive) continue;
    const melt = w.melt || 0, grow = Math.min(1, (w.age || 0) / 1.2), sc = w.s * grow * (1 + melt * 0.5) * (1 - melt * melt);
    for (let j = 0; j < PUFFS; j++) {
      const L = LAYOUT[j], sway = Math.sin(T * 0.9 + w.ph + j * 0.8) * 0.08;
      _p.set(base.x + w.x + (L[0] + sway) * w.s, base.y + w.y + L[1] * w.s + Math.sin(T * 0.7 + w.ph) * 0.12, base.z + w.z);
      const ps = L[2] * sc * (1 + Math.sin(T * 1.3 + j + w.ph) * 0.05);
      _m.compose(_p, camera.quaternion, _s.set(ps, ps, ps)); M.setMatrixAt(k, _m);
      const b = 1 + melt * 0.25; M.setColorAt(k, _c.setRGB(Math.min(1, b), Math.min(1, b), Math.min(1, b * 1.02))); k++;
    }
  }
  M.count = k; M.visible = k > 0; M.instanceMatrix.needsUpdate = true; if (M.instanceColor) M.instanceColor.needsUpdate = true;
  void _w;
}

// the three happy-memory cards (canvas, 240 x 200): flying, friends, a birthday cake
export function drawMemory(x, kind, w = 240, h = 200) {
  const g = x.createLinearGradient(0, 0, 0, h);
  const sky = { fly: ['#8ac8f0', '#e8f4ff'], friends: ['#f0c870', '#fff0d0'], cake: ['#e8a0c8', '#fff0f6'] }[kind] || ['#ccc', '#fff'];
  g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const E = (px, py, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, 0, 0, 7); x.fill(); };
  if (kind === 'fly') {
    E(60, 50, 30, 12, '#fff'); E(180, 70, 36, 14, '#fff'); x.fillStyle = '#6a8a4a'; x.fillRect(0, h - 30, w, 30);
    x.save(); x.translate(120, 110); x.rotate(-0.2); x.fillStyle = '#8a5a2a'; x.fillRect(-70, -3, 140, 6); x.fillStyle = '#c8a050'; x.beginPath(); x.moveTo(-70, 0); x.lineTo(-100, -14); x.lineTo(-100, 14); x.fill();
    E(0, -26, 14, 20, '#a8202a'); E(0, -54, 12, 12, '#f0c8a0'); x.fillStyle = '#2a1a10'; x.beginPath(); x.arc(0, -60, 12, Math.PI, 0); x.fill(); x.restore();
  } else if (kind === 'friends') {
    x.fillStyle = '#8a6a4a'; x.fillRect(0, h - 34, w, 34);
    for (const [px, hair, robe] of [[70, '#c8541a', '#2a2a3a'], [120, '#2a1a10', '#a8202a'], [170, '#7a4a2a', '#2a2a3a']]) { E(px, 140, 20, 34, robe); E(px, 92, 15, 15, '#f0c8a0'); x.fillStyle = hair; x.beginPath(); x.arc(px, 86, 15, Math.PI, 0); x.fill(); x.strokeStyle = '#5a2020'; x.lineWidth = 2; x.beginPath(); x.arc(px, 96, 6, 0.2, Math.PI - 0.2); x.stroke(); }
    x.font = '28px serif'; x.textAlign = 'center'; x.fillText('💛', 120, 40);
  } else {
    x.fillStyle = '#a87a5a'; x.fillRect(0, h - 30, w, 30);
    x.fillStyle = '#f6e8f0'; x.fillRect(60, 100, 120, 60); x.fillStyle = '#e87aa8'; x.fillRect(60, 96, 120, 14); x.fillStyle = '#f6e8f0'; x.fillRect(80, 66, 80, 34); x.fillStyle = '#e87aa8'; x.fillRect(80, 62, 80, 10);
    for (const cx2 of [95, 120, 145]) { x.fillStyle = '#7ab0e8'; x.fillRect(cx2 - 3, 40, 6, 22); E(cx2, 34, 4, 7, '#ffcc40'); }
    x.font = '26px serif'; x.textAlign = 'center'; x.fillText('🎉', 40, 50); x.fillText('🎈', 205, 60);
  }
}
