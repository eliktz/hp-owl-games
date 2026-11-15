// Film look for the smaller rooms (Entrance Hall, classrooms), after hall-film.js:
//   timberCeiling  dark oak beams + joists + plank soffit with braces on stone corbels, all ONE
//                  merged wood mesh + one plank plane (replaces the flat stone ceiling plane)
//   grandDoors     the castle's tall pointed oak double doors with iron straps and a stone
//                  surround (the surround uses the wall stone so it merges with the walls)
//   windowLight    warm daylight through the windows: slanted soft shaft cards + long floor
//                  pools in ONE additive mesh that fades with the outdoor time of day
//   propMesh       small props as ONE vertex-coloured mesh (books, feathers, cages, goblets)
// Budgets: +2..4 draw calls per room, one 64x64 and one 32x128 canvas (~25 KB).
import {
  Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, BufferGeometry, Float32BufferAttribute,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, AdditiveBlending, DoubleSide, Color,
  Shape, ExtrudeGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { woodMat, stoneMat, MAT } from './interior-kit.js';

const box = (L, w, h, d, x, y, z, rz = 0, ry = 0) => { const g = new BoxGeometry(w, h, d); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); L.push(g); return g; };

// A timbered ceiling over a W x D room at height H. `along` = the axis the main beams SPAN
// ('x': beams run across the room in x, repeated along z). `at` = beam positions along the other
// axis; joists run the other way every `joist` m between them. Returns { beams, planks }.
export function timberCeiling(group, W, D, H, { along = 'x', at = [], joist = 1.2, beamH = 0.6, beamW = 0.42,
  wood = 0x4a2f1c, plank = 0x2e1d12, corbel = 0x8f8a80, brace = 1.5 } = {}) {
  const L = [], C = [];
  const span = along === 'x' ? W : D, other = along === 'x' ? D : W;
  const yb = H - 0.12 - beamH / 2;                                 // beam centre (planks 0.12 thick above)
  const P = (a, b) => (along === 'x' ? [a, b] : [b, a]);           // (span coord, other coord) -> (x, z)
  for (const c of at) {
    const [x, z] = P(0, c);
    box(L, along === 'x' ? span : beamW, beamH, along === 'x' ? beamW : span, x, yb, z);
    for (const s of [-1, 1]) {                                     // braces from a stone corbel up to the beam
      const e = s * (span / 2), y0 = yb - beamH / 2 - brace;
      const a0 = e - s * 0.2, a1 = e - s * (brace + 0.2), y1 = yb - beamH / 2 + 0.05;   // wall foot -> under the beam
      const g = new BoxGeometry(Math.hypot(a1 - a0, y1 - y0) + 0.1, 0.26, 0.26);
      g.rotateZ(Math.atan2(y1 - y0, a1 - a0)); if (along === 'z') g.rotateY(-Math.PI / 2);
      const [bx, bz] = P((a0 + a1) / 2, c); g.translate(bx, (y0 + y1) / 2, bz); L.push(g);
      const [cx, cz] = P(e - s * 0.2, c);                          // corbel block under the brace foot
      box(C, along === 'x' ? 0.5 : 0.5, 0.45, 0.5, cx, y0 - 0.1, cz);
      const [px, pz] = P(e - s * 0.12, c);                         // wall post from corbel to beam
      box(L, along === 'x' ? 0.24 : 0.3, brace + beamH * 0.5, along === 'x' ? 0.3 : 0.24, px, y0 + (brace + beamH * 0.5) / 2, pz);
    }
  }
  // joists between the beams, running the other way, sitting on top of the beams
  const yj = H - 0.12 - 0.11;
  for (let a = -span / 2 + joist / 2; a < span / 2; a += joist) {
    const [x, z] = P(a, 0);
    box(L, along === 'x' ? 0.16 : other, 0.22, along === 'x' ? other : 0.16, x, yj, z);
  }
  for (const s of [-1, 1]) {                                       // wall plates along the two long walls
    const [x, z] = P(s * (span / 2 - 0.15), 0);
    box(L, along === 'x' ? 0.3 : other, 0.34, along === 'x' ? other : 0.3, x, H - 0.3, z);
  }
  const beams = new Mesh(mergeGeometries(L, false), woodMat(1, 4, wood));
  beams.name = 'timber-ceiling'; beams.raycast = () => {}; group.add(beams);
  const corbels = new Mesh(mergeGeometries(C, false), stoneMat(1.5, 1.5, corbel)); corbels.name = 'corbels'; group.add(corbels);
  const planks = new Mesh(new PlaneGeometry(W, D), woodMat(W / 2.4, D / 2.4, plank));
  planks.rotation.x = Math.PI / 2; planks.position.y = H; planks.name = 'ceiling-planks'; planks.raycast = () => {}; group.add(planks);
  return { beams, planks, corbels };
}

// Pointed (equilateral) oak double doors on a wall: centre (x, z), facing +z (rotY turns it).
// w = opening width, hs = springing height (apex at hs + w * 0.866). Light marker in front.
export function grandDoors(group, x, z, rotY = 0, { w = 4.2, hs = 3.8, wallColor = 0x8f8a80 } = {}) {
  const top = hs + w * Math.sqrt(3) / 2, hw = w / 2;
  // the leaves: one pointed shape split down the middle, extruded 0.22 m
  const leaf = (s) => {
    const sh = new Shape(); sh.moveTo(0, 0); sh.lineTo(s * hw, 0); sh.lineTo(s * hw, hs);
    const N = 10;
    for (let i = 1; i <= N; i++) {      // arc centred at the far springing point (-s*hw, hs), radius w
      const a = (i / N) * (Math.PI / 3), px = -s * hw + s * w * Math.cos(a), py = hs + w * Math.sin(a);
      sh.lineTo(px, py);
    }
    sh.lineTo(0, 0);
    const g = new ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, 0.06);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.35);   // vertical planks
    return g;
  };
  const wood = new Mesh(mergeGeometries([leaf(-1), leaf(1)].map(g => g.toNonIndexed()), false), woodMat(1, 1, 0x8a5a34));   // lighter oak: the leaves read as wood, not a black void
  wood.castShadow = true;
  const I = [];
  for (const s of [-1, 1]) {
    for (const y of [0.7, hs * 0.55, hs - 0.2]) box(I, hw - 0.25, 0.14, 0.06, s * (hw / 2 + 0.05), y, 0.31);   // iron straps
    for (let k = 0; k < 7; k++) box(I, 0.08, 0.08, 0.05, s * (0.25 + (k % 2) * 0.35), 0.5 + k * 0.85, 0.3);    // studs
  }
  box(I, 0.1, top - 0.1, 0.07, 0, (top - 0.1) / 2, 0.3);                                                   // meeting stile
  for (const s of [-1, 1]) { const r = new CylinderGeometry(0.2, 0.2, 0.06, 14); r.rotateX(Math.PI / 2); r.translate(s * 0.45, hs * 0.48, 0.34); I.push(r); }   // ring pulls
  const iron = new Mesh(mergeGeometries(I.map(g => g.index ? g.toNonIndexed() : g), false), MAT.dark);
  // the stone surround: jambs + voussoirs along both arcs (wall stone: merges with the walls)
  const S = [];
  for (const s of [-1, 1]) box(S, 0.7, hs, 0.7, s * (hw + 0.35), hs / 2, 0.05);
  const R = w + 0.35, N = 9;
  for (const s of [-1, 1]) for (let i = 0; i < N; i++) {
    const a0 = (i / N) * (Math.PI / 3), a1 = ((i + 1) / N) * (Math.PI / 3);
    const p = (a) => [-s * hw + s * R * Math.cos(a), hs + R * Math.sin(a)];
    const [ax, ay] = p(a0), [bx, by] = p(a1), len = Math.hypot(bx - ax, by - ay) + 0.06;
    const g = new BoxGeometry(len, 0.7, 0.7); g.rotateZ(Math.atan2(by - ay, bx - ax)); g.translate((ax + bx) / 2, (ay + by) / 2, 0.05); S.push(g);
  }
  const stone = new Mesh(mergeGeometries(S, false), stoneMat(1, 1, wallColor));
  for (const m of [wood, iron, stone]) { m.position.set(x, 0, z); m.rotation.y = rotY; group.add(m); }
  return { wood, iron, stone, top };
}

// ---- daylight through windows ----
let _shaftTex = null, _poolTex = null;
function shaftTex() {
  if (_shaftTex) return _shaftTex;
  const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d');
  const gv = x.createLinearGradient(0, 0, 0, 128); gv.addColorStop(0, 'rgba(255,255,255,0.9)'); gv.addColorStop(0.6, 'rgba(255,255,255,0.35)'); gv.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gv; x.fillRect(0, 0, 32, 128);
  x.globalCompositeOperation = 'destination-in';
  const gh = x.createLinearGradient(0, 0, 32, 0); gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.25, 'rgba(0,0,0,1)'); gh.addColorStop(0.75, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gh; x.fillRect(0, 0, 32, 128);
  _shaftTex = new CanvasTexture(c); _shaftTex.colorSpace = SRGBColorSpace; return _shaftTex;
}
function poolTex() {
  if (_poolTex) return _poolTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _poolTex = new CanvasTexture(c); _poolTex.colorSpace = SRGBColorSpace; return _poolTex;
}
const TIME_K = { day: 1, dusk: 0.55, night: 0.12 };
// specs: [{ x, y, z, nx, nz, w, h, c }]: a window centred (x, y, z) facing (nx, nz) into the room,
// opening w x h. The sun comes down at ~50 degrees: a slanted shaft card from the glass to the
// floor and an elongated pool where it lands. Two meshes (the cards and the pools need different
// textures), each one draw call.
export function windowLight(group, specs, { slope = 1.15, strength = 1 } = {}) {
  const mk = (tex, name) => ({ pos: [], uv: [], col: [], idx: [], tex, name });
  const cards = mk(shaftTex(), 'sun-shafts'), pools = mk(poolTex(), 'sun-pools'), tc = new Color();
  const quad = (M, p, u, c, a) => { const n = M.pos.length / 3; for (const q of p) M.pos.push(...q); M.uv.push(...u); tc.setHex(c); for (let i = 0; i < 4; i++) M.col.push(tc.r * a, tc.g * a, tc.b * a); M.idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  for (const s of specs) {
    const tx = -s.nz, tz = s.nx, hw = s.w / 2;                    // along the window
    const yTop = s.y + s.h * 0.35, yBot = s.y - s.h * 0.5;
    const reachTop = yTop * slope, reachBot = yBot * slope;      // where each edge of the light lands
    // shaft card: from the glass down to the floor patch (a vertical-ish slanted ribbon)
    for (const [o, a] of [[-0.25, 0.16], [0.25, 0.16]]) {
      const bx = s.x + tx * o * s.w, bz = s.z + tz * o * s.w;
      quad(cards, [
        [bx - tx * hw, yTop, bz - tz * hw], [bx + tx * hw, yTop, bz + tz * hw],
        [bx + tx * hw + s.nx * reachTop, 0.1, bz + tz * hw + s.nz * reachTop], [bx - tx * hw + s.nx * reachTop, 0.1, bz - tz * hw + s.nz * reachTop],
      ], [0, 1, 1, 1, 1, 0, 0, 0], s.c || 0xffe0a8, a * strength);
    }
    // floor pool: the window's footprint stretched along the sun direction
    const r0 = Math.max(0.6, reachBot), r1 = reachTop + 0.6, cx = s.x + s.nx * (r0 + r1) / 2, cz = s.z + s.nz * (r0 + r1) / 2, hl = (r1 - r0) / 2 + 0.8, hwp = hw + 0.7;
    quad(pools, [
      [cx - tx * hwp - s.nx * hl, 0.075, cz - tz * hwp - s.nz * hl], [cx + tx * hwp - s.nx * hl, 0.075, cz + tz * hwp - s.nz * hl],
      [cx + tx * hwp + s.nx * hl, 0.075, cz + tz * hwp + s.nz * hl], [cx - tx * hwp + s.nx * hl, 0.075, cz - tz * hwp + s.nz * hl],
    ], [0, 0, 1, 0, 1, 1, 0, 1], s.c || 0xffd9a0, 0.26 * strength);   // gentle: brighter pools bleached the house carpets
  }
  const meshes = [cards, pools].map((M) => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(M.pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(M.uv, 2)); g.setAttribute('color', new Float32BufferAttribute(M.col, 3)); g.setIndex(M.idx);
    const mat = new MeshBasicMaterial({ map: M.tex, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false, side: DoubleSide });
    const m = new Mesh(g, mat); m.name = M.name; m.renderOrder = 2; m.raycast = () => {}; group.add(m); return m;
  });
  return {
    meshes,
    update(t) {
      const k = (TIME_K[globalThis.window?.__game?.env?.time] ?? 1) * (1 + Math.sin(t * 0.4) * 0.05);
      for (const m of meshes) m.material.color.setScalar(k);
    },
  };
}

// Small props as ONE vertex-coloured mesh. parts: [[geometry, hex], ...] already placed.
export function propMesh(group, parts, name = 'props') {
  const c = new Color();
  const geos = parts.map(([g, hex]) => {
    const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv');
    const col = new Float32Array(n.attributes.position.count * 3); c.setHex(hex);
    for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
    n.setAttribute('color', new Float32BufferAttribute(col, 3)); return n;
  });
  const m = new Mesh(mergeGeometries(geos, false), new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  m.name = name; m.castShadow = true; group.add(m); return m;
}
