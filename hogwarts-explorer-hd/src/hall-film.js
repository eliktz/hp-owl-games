// Film look for the Great Hall (look-dev target: art previews/film/greathall_after.png):
//   hallRoof     dark oak hammerbeam trusses (one merged mesh) under a pitched enchanted sky
//                (one mesh, a painted dusk canvas) with stone gables at both ends
//   hallBanners  long swallow-tailed house banners hanging over each table, all in ONE mesh
//                (one 512 px canvas atlas), swaying gently on the CPU (~600 vertices)
//   heightShade  baked "candle light falls off with height": vertex colours on the merged wall
//                and column meshes so the lower walls read as honey stone, the tops in shadow
// Budgets: +2 draw calls (roof, banners; the sky replaces the old flat sky + star mesh), about
// 2.7 MB of canvas textures (1024x256 sky + 512x512 banner atlas, mipmapped), ~3k triangles.
import {
  Mesh, BoxGeometry, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, CanvasTexture,
  SRGBColorSpace, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { woodMat, stoneMat } from './interior-kit.js';

// ---- the enchanted sky: a dusk gradient with soft clouds and stars, painted once ----
let _skyMat = null;
function skyMat() {
  if (_skyMat) return _skyMat;
  const W = 1024, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // v = 0 (canvas bottom) at the eaves, v = 1 (top) at the ridge: hazy dusk blue low, deep night high
  const gr = x.createLinearGradient(0, H, 0, 0);
  gr.addColorStop(0, '#5b6f9e'); gr.addColorStop(0.35, '#3a4f86'); gr.addColorStop(0.75, '#1f2c5e'); gr.addColorStop(1, '#141c44');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 55; k++) {                     // soft drifting cloud wisps, denser toward the eaves
    const px = rnd() * W, py = H * (0.35 + rnd() * 0.65), rx = 30 + rnd() * 60, ry = rx * (0.55 + rnd() * 0.35);   // roundish: long ones streak toward the vanishing point
    const b = x.createRadialGradient(px, py, 0, px, py, rx);
    b.addColorStop(0, `rgba(170,180,215,${0.08 + rnd() * 0.1})`); b.addColorStop(1, 'rgba(170,180,215,0)');
    x.save(); x.translate(px, py); x.scale(1, ry / rx); x.translate(-px, -py); x.fillStyle = b; x.fillRect(px - rx, py - rx, rx * 2, rx * 2); x.restore();
  }
  for (let k = 0; k < 420; k++) {                    // stars: more and brighter toward the ridge
    const v = Math.sqrt(rnd()), px = rnd() * W, py = H * (1 - v), r = rnd() < 0.08 ? 1.6 : 0.8;
    x.fillStyle = `rgba(255,246,214,${0.35 + 0.6 * v * rnd()})`; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  _skyMat = new MeshStandardMaterial({ color: 0x000000, roughness: 1, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.95, side: DoubleSide });
  _skyMat.name = 'enchanted-sky';
  return _skyMat;
}

// A beam between two points (a, b in the truss plane x/y) at depth z, cross-section w x h.
function beam(list, ax, ay, bx, by, z, w = 0.36, h = 0.4) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
  const g = new BoxGeometry(len, h, w);
  g.rotateZ(Math.atan2(dy, dx)); g.translate((ax + bx) / 2, (ay + by) / 2, z); list.push(g);
}
// A long timber along the hall (z), at x/y.
function runner(list, x, y, len, w = 0.32, h = 0.36) { const g = new BoxGeometry(w, h, len); g.translate(x, y, 0); list.push(g); }
// A curve of beam segments along points p(θ), θ from a0 to a1.
function curve(list, f, a0, a1, n, z, w, h) {
  for (let i = 0; i < n; i++) { const [ax, ay] = f(a0 + (a1 - a0) * i / n), [bx, by] = f(a0 + (a1 - a0) * (i + 1) / n); beam(list, ax, ay, bx, by, z, w, h); }
}

// The roof over a W x D hall whose walls stop at height H: a pitched sky (ridge `rise` above
// the wall plate), stone gables at both ends (same material as the end walls so they merge with
// them), and hammerbeam trusses at `trussZ`. Returns { sky, roof, gables }.
export function hallRoof(group, W, D, H, { rise = 5, trussZ = [], wallColor = 0x8f8a80 } = {}) {
  const hw = W / 2, Ya = H + rise, ext = D / 2 + 0.6;
  // sky: two slopes from the wall tops to the ridge; u runs down the hall, v eave -> ridge
  const sp = [], su = [], si = [];
  for (const s of [-1, 1]) {
    const n = sp.length / 3;
    sp.push(s * hw, H, -ext, s * hw, H, ext, 0, Ya, ext, 0, Ya, -ext);
    su.push(0, 0, 1, 0, 1, 1, 0, 1);
    si.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const sg = new BufferGeometry();
  sg.setAttribute('position', new Float32BufferAttribute(sp, 3)); sg.setAttribute('uv', new Float32BufferAttribute(su, 2)); sg.setIndex(si); sg.computeVertexNormals();
  const sky = new Mesh(sg, skyMat()); sky.name = 'enchanted-sky'; sky.raycast = () => {}; group.add(sky);
  // gables: stone triangles on the inner faces of the end walls (UVs continue the wall's tiling)
  const gables = [];
  const gm = stoneMat(W / 3, H / 3, wallColor);
  for (const s of [-1, 1]) {
    const z = s * (D / 2 - 0.5), gx = hw + 0.5;
    const pos = [-gx, H, z, gx, H, z, 0, Ya + 0.3, z];
    const uv = [0, 1, 1, 1, 0.5, (Ya + 0.3) / H];
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setIndex(s < 0 ? [0, 1, 2] : [0, 2, 1]); g.computeVertexNormals();
    const m = new Mesh(g, gm); m.name = 'gable'; group.add(m); gables.push(m);
  }
  // trusses: wall post on a stone corbel, curved brace, hammer beam with a carved drop,
  // hammer post, arch braces meeting under the collar, king post; principal rafters under the sky
  const L = [];
  const slopeY = (x) => H + rise * (1 - Math.abs(x) / hw) - 0.32;   // a rafter's centre line, just under the sky
  for (const z of trussZ) {
    for (const s of [-1, 1]) {
      beam(L, s * hw, slopeY(hw), 0, slopeY(0), z, 0.34, 0.44);                       // principal rafter
      beam(L, s * (hw - 0.2), H - 3.7, s * (hw - 0.2), H - 1.45, z, 0.34, 0.36);       // wall post
      beam(L, s * (hw + 0.1), H - 1.45, s * (hw - 2.6), H - 1.45, z, 0.4, 0.46);       // hammer beam
      beam(L, s * (hw - 2.6), H - 1.2, s * (hw - 2.6), H - 2.25, z, 0.3, 0.3);         // carved drop
      beam(L, s * (hw - 2.6), H - 1.45, s * (hw - 2.6), slopeY(hw - 2.6), z, 0.3, 0.32);   // hammer post
      const bx = hw - 2.4, by = H - 3.6;                                               // brace: post foot -> hammer end
      curve(L, (a) => [s * (bx + 2.2 * Math.cos(a)), by + 1.95 * Math.sin(a)], 0, Math.PI / 2, 4, z, 0.3, 0.3);
      const ax = hw - 2.6, ay = H - 1.2, ar = Ya - 2.6 - ay;                           // arch brace: hammer post -> collar
      curve(L, (a) => [s * ax * Math.cos(a), ay + ar * Math.sin(a)], 0, Math.PI / 2, 6, z, 0.3, 0.32);
    }
    const cy = Ya - 2.4, cx = hw * (2.4 - 0.32) / rise;   // collar ends meet the rafters
    beam(L, -Math.min(cx, hw - 1), cy, Math.min(cx, hw - 1), cy, z, 0.34, 0.4);       // collar
    beam(L, 0, cy, 0, slopeY(0), z, 0.3, 0.3);                                          // king post
  }
  const len = D;
  for (const s of [-1, 1]) {
    runner(L, s * (hw - 0.15), H + 0.05, len, 0.4, 0.4);                                // wall plate
    runner(L, s * (hw * 0.66), slopeY(hw * 0.66) - 0.36, len);                          // purlins
    runner(L, s * (hw * 0.33), slopeY(hw * 0.33) - 0.36, len);
  }
  runner(L, 0, slopeY(0) - 0.3, len, 0.34, 0.4);                                        // ridge
  const roof = new Mesh(mergeGeometries(L, false), woodMat(1, 4, 0x4a2f1c));
  roof.name = 'hall-roof'; roof.raycast = () => {}; group.add(roof);
  return { sky, roof, gables };
}

// ---- house banners ----
// Atlas: four 128 x 512 columns, one per house, painted once: field, metal border, a darker
// sleeve band, soft vertical fold shading, a simple heraldic charge (shapes only) and a
// transparent swallow-tail notch (alphaTest cuts it).
export const BANNER_HOUSES = {
  gryffindor: { i: 0, field: '#7c1420', metal: '#c9a03c' },
  ravenclaw: { i: 1, field: '#1d3a72', metal: '#a8743c' },
  hufflepuff: { i: 2, field: '#c4962a', metal: '#1e1a16' },
  slytherin: { i: 3, field: '#1c5a2e', metal: '#b8bcc4' },
};
let _bannerMat = null;
function bannerMat() {
  if (_bannerMat) return _bannerMat;
  const CW = 128, CH = 512, c = document.createElement('canvas'); c.width = CW * 4; c.height = CH;
  const x = c.getContext('2d');
  for (const [house, { i, field, metal }] of Object.entries(BANNER_HOUSES)) {
    x.save(); x.translate(i * CW, 0);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(CW, 0); x.lineTo(CW, CH); x.lineTo(CW / 2, CH - 70); x.lineTo(0, CH); x.closePath(); x.clip();
    x.fillStyle = field; x.fillRect(0, 0, CW, CH);
    x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(0, 0, CW, 34);                       // sleeve round the rod
    x.strokeStyle = metal; x.lineWidth = 7;                                            // border, following the tails
    x.beginPath(); x.moveTo(5, 34); x.lineTo(CW - 5, 34); x.lineTo(CW - 5, CH - 8); x.lineTo(CW / 2, CH - 78); x.lineTo(5, CH - 8); x.closePath(); x.stroke();
    for (let k = 0; k < 6; k++) {                                                      // cloth folds: soft vertical shading
      const fx = (k + 0.5) * CW / 6, gr = x.createLinearGradient(fx - CW / 12, 0, fx + CW / 12, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0.16)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0.16)');
      x.fillStyle = gr; x.fillRect(fx - CW / 12, 34, CW / 6, CH);
    }
    // charge, centred at 40% height
    x.translate(CW / 2, CH * 0.4); x.fillStyle = metal; x.strokeStyle = metal;
    if (house === 'gryffindor') {                       // a lion-sun: maned disc with rays
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; x.beginPath(); x.moveTo(Math.cos(a - 0.12) * 22, Math.sin(a - 0.12) * 22); x.lineTo(Math.cos(a) * 42, Math.sin(a) * 42); x.lineTo(Math.cos(a + 0.12) * 22, Math.sin(a + 0.12) * 22); x.fill(); }
      x.beginPath(); x.arc(0, 0, 23, 0, Math.PI * 2); x.fill();
      x.fillStyle = field; x.beginPath(); x.arc(-8, -4, 3.5, 0, Math.PI * 2); x.arc(8, -4, 3.5, 0, Math.PI * 2); x.fill();
    } else if (house === 'ravenclaw') {                 // a bird with spread wings
      x.beginPath(); x.moveTo(0, -18); x.quadraticCurveTo(-26, -34, -50, -16); x.quadraticCurveTo(-28, -12, -12, 4);
      x.lineTo(-10, 30); x.lineTo(0, 22); x.lineTo(10, 30); x.lineTo(12, 4); x.quadraticCurveTo(28, -12, 50, -16); x.quadraticCurveTo(26, -34, 0, -18); x.fill();
      x.beginPath(); x.arc(0, -24, 8, 0, Math.PI * 2); x.fill();
    } else if (house === 'hufflepuff') {                // a paw: pad and four toes
      x.beginPath(); x.ellipse(0, 12, 22, 18, 0, 0, Math.PI * 2); x.fill();
      for (const [px, py] of [[-24, -14], [-9, -26], [9, -26], [24, -14]]) { x.beginPath(); x.ellipse(px, py, 8, 11, px * 0.02, 0, Math.PI * 2); x.fill(); }
    } else {                                            // a serpent rising in three bends, head up
      x.lineCap = 'round';
      const pts = []; for (let k = 0; k <= 40; k++) { const v = k / 40; pts.push([Math.sin(v * Math.PI * 3) * 20 * (0.5 + v * 0.5), 48 - v * 88]); }
      for (let k = 0; k < 40; k++) { x.lineWidth = 3 + 8 * (k / 40); x.beginPath(); x.moveTo(...pts[k]); x.lineTo(...pts[k + 1]); x.stroke(); }
      x.beginPath(); x.ellipse(pts[40][0] + 4, pts[40][1] - 4, 11, 7, -0.4, 0, Math.PI * 2); x.fill();
      x.lineWidth = 2; x.beginPath(); x.moveTo(pts[40][0] + 14, pts[40][1] - 9); x.lineTo(pts[40][0] + 22, pts[40][1] - 14); x.moveTo(pts[40][0] + 18, pts[40][1] - 11); x.lineTo(pts[40][0] + 22, pts[40][1] - 7); x.stroke();
      x.fillStyle = field; x.beginPath(); x.arc(pts[40][0] + 6, pts[40][1] - 6, 2, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  _bannerMat = new MeshStandardMaterial({ map: t, alphaTest: 0.5, side: DoubleSide, roughness: 0.9,
    emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.14 });   // a whisper of self-light so they read under the roof
  _bannerMat.name = 'hall-banners';
  return _bannerMat;
}

// specs: [{ x, z, top, house, axis?, len? }]: a banner faces down the hall (normal +z), or with
// axis 'x' hangs flat against a side wall (normal along x); w x len metres. Returns { mesh, update(t) }.
export function hallBanners(group, specs, { w = 1.6, len = 5.6 } = {}) {
  const NX = 4, NY = 14, pos = [], uv = [], idx = [], rest = [];
  specs.forEach((s, b) => {
    const col = BANNER_HOUSES[s.house].i, n0 = pos.length / 3, L = s.len || len, ax = s.axis === 'x';
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const u = i / NX, v = j / NY, a = (u - 0.5) * w, py = s.top - v * L;
      const fold = Math.sin(u * Math.PI * 3) * 0.05;                       // static cloth folds
      if (ax) pos.push(s.x + fold, py, s.z + a * Math.sign(s.x || 1)); else pos.push(s.x + a, py, s.z + fold);
      uv.push((col + u) / 4, 1 - v);
      rest.push({ b, z: (ax ? s.x : s.z) + fold, ax, amp: s.amp ?? 1, drop: v, ph: b * 1.7 + u * 0.6 });
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = n0 + j * (NX + 1) + i, c = a + NX + 1;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.boundingSphere.radius += 1;
  const mesh = new Mesh(geo, bannerMat()); mesh.name = 'hall-banners'; mesh.raycast = () => {}; group.add(mesh);
  const P = geo.attributes.position;
  return {
    mesh,
    update(t) {                                        // a slow draught: the tails move most
      for (let k = 0; k < rest.length; k++) {
        const r = rest[k], a = Math.pow(r.drop, 1.6) * r.amp;
        const d = r.z + Math.sin(t * 0.8 + r.ph + r.drop * 2.2) * 0.16 * a + Math.sin(t * 1.9 + r.b) * 0.03 * a;
        if (r.ax) P.setX(k, d); else P.setZ(k, d);
      }
      P.needsUpdate = true;
    },
  };
}

// Baked height falloff: multiply each vertex of the given meshes by a factor that eases
// (smoothstep) from k0 at y0 to k1 at y1, via a vertex-colour copy of the material (cached, so
// rebuilding the room every visit allocates nothing new). Meshes must own their geometry
// (e.g. mergeStatic output). Heights are measured in the PARENT's (room's) space: a piece that
// mergeStatic left on its own still carries its position (a lone wall at y H/2, a lintel over a
// door), and shading its geometry-local y made it brighter than the merged walls beside it.
const _shaded = new Map();
export function heightShade(meshes, { y0 = 3, y1 = 16, k0 = 1.1, k1 = 0.35 } = {}) {
  for (const m of meshes) {
    const P = m.geometry.attributes.position, col = new Float32Array(P.count * 3);
    m.updateMatrix(); const e = m.matrix.elements;            // local -> room: y' = e1 x + e5 y + e9 z + e13
    for (let i = 0; i < P.count; i++) {
      const y = e[1] * P.getX(i) + e[5] * P.getY(i) + e[9] * P.getZ(i) + e[13];
      const u = Math.min(1, Math.max(0, (y - y0) / (y1 - y0))), f = u * u * (3 - 2 * u), k = k0 + (k1 - k0) * f;
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
    }
    m.geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
    let mat = _shaded.get(m.material.uuid);
    if (!mat) { mat = m.material.clone(); mat.vertexColors = true; mat.name = (m.material.name || 'stone') + '-shaded'; _shaded.set(m.material.uuid, mat); }
    m.material = mat;
  }
}
