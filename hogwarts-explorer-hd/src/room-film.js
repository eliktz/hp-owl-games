// Film look for the smaller rooms (Entrance Hall, classrooms), after hall-film.js:
//   timberCeiling  dark oak beams + joists + plank soffit with braces on stone corbels, all ONE
//                  merged wood mesh + one plank plane (replaces the flat stone ceiling plane)
//   grandDoors     the castle's tall pointed oak double doors with iron straps and a stone
//                  surround (the surround uses the wall stone so it merges with the walls)
//   windowLight    warm daylight through the windows: slanted soft shaft cards + long floor
//                  pools in ONE additive mesh that fades with the outdoor time of day
//   propMesh       small props as ONE vertex-coloured mesh (books, feathers, cages, goblets)
// Library + common room (film6):
//   bookcases      oak cases (one merged wood mesh) filled with book spines (one mesh, one shared
//                  256 px canvas of leather spines with gilt bands), box colliders included
//   floatingBooks  a few books drifting in the air: two instanced meshes (covers, pages)
//   nightWindows   round-headed leaded windows onto a moonlit night sky (one 128x256 canvas)
//   rug            a patterned crimson-and-gold rug (one 256x128 canvas)
// Budgets: +2..4 draw calls per room, one 64x64 and one 32x128 canvas (~25 KB); film6 adds
// ~0.75 MB of canvases (spines 256x256, night glass 128x256, rug 256x128, all mipmapped).
import {
  Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, BufferGeometry, Float32BufferAttribute,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, AdditiveBlending, DoubleSide, Color,
  Shape, ExtrudeGeometry, RepeatWrapping, ClampToEdgeWrapping, InstancedMesh, Object3D, CircleGeometry,
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
  const wood = new Mesh(mergeGeometries([leaf(-1), leaf(1)].map(g => (g.index ? g.toNonIndexed() : g)), false), woodMat(1, 1, 0x8a5a34));   // lighter oak: the leaves read as wood, not a black void
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

// ---- books ----
// The spine canvas: four shelf rows (64 px each, 1.6 m of books across the 256 px width), each
// a run of leather spines of varied width, height and colour, rounded by a soft side shade,
// with gilt bands and the odd label; dark gaps where a book is missing. u repeats.
let _spineMat = null;
export function spineMat() {
  if (_spineMat) return _spineMat;
  const S = 256, R = 64, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  let seed = 23; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const LEATHER = ['#5a1a16', '#6e2418', '#3b2a1a', '#4a3020', '#1f3a2c', '#234030', '#1c2c48', '#2a2440', '#6a4a26', '#7a5a30', '#40201c', '#2e2a26', '#5e3a1c', '#16302a'];
  x.fillStyle = '#0d0907'; x.fillRect(0, 0, S, S);
  for (let r = 0; r < 4; r++) {
    const base = r * R + R - 1;
    for (let px = 0; px < S;) {
      if (rnd() < 0.05) { px += 4 + rnd() * 8; continue; }                     // a missing book
      const bw = Math.round(4 + rnd() * rnd() * 12), bh = Math.round(R * (0.6 + rnd() * 0.36));
      const col = new Color(LEATHER[(rnd() * LEATHER.length) | 0]); const h = {}; col.getHSL(h); col.setHSL(h.h, h.s, Math.max(0.04, h.l * (0.75 + rnd() * 0.55)));
      const lean = rnd() < 0.06 ? 3 : 0;                                       // a leaning one
      x.save(); x.translate(px + bw / 2, base); if (lean) x.rotate(-0.12);
      const g = x.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.3, 'rgba(255,255,255,0.08)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
      x.fillStyle = '#' + col.getHexString(); x.fillRect(-bw / 2, -bh, bw, bh);
      if (rnd() < 0.7) {                                                        // gilt bands
        x.fillStyle = rnd() < 0.8 ? '#b8903e' : '#d8c08a';
        for (const f of [0.1, 0.16, 0.84, 0.9]) x.fillRect(-bw / 2, -bh * f - 1, bw, 1);
      }
      if (bw > 6 && rnd() < 0.35) { x.fillStyle = rnd() < 0.5 ? '#cbb27a' : '#1a1410'; x.fillRect(-bw / 2 + 1.5, -bh * 0.62, bw - 3, bh * 0.14); }   // label patch
      x.fillStyle = g; x.fillRect(-bw / 2, -bh, bw, bh);
      x.restore();
      px += bw + (rnd() < 0.3 ? 1 : 0);
    }
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, r * R, S, 4);              // shadow under the shelf above
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = RepeatWrapping; t.wrapT = ClampToEdgeWrapping; t.anisotropy = 4;
  _spineMat = new MeshStandardMaterial({ map: t, roughness: 0.82, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.1 });   // a whisper of self-light: spines still read in the shadowed upper shelves
  _spineMat.name = 'book-spines';
  return _spineMat;
}

// Bookcases. specs: [{ x, z, w, h = 6.2, d = 0.6, a = 0, both = false, rows }]: a case w wide
// centred (x, z) with its front facing angle a (0: +z, PI: -z, PI/2: +x, -PI/2: -x); `both`
// = a free-standing stack with books on both faces. Pushes one box collider per case.
// Returns { frame, books } (one wood mesh + one book mesh for all of them).
export function bookcases(group, specs, cols, { wood = 0x3a2414, seed = 3 } = {}) {
  const F = [], B = [];
  let sd = seed; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (const sp of specs) {
    const { x, z, w, h = 6.2, d = 0.6, a = 0, both = false } = sp;
    const t = 0.08, plinth = 0.24, corn = 0.3, rows = sp.rows || Math.max(3, Math.round((h - plinth - corn) / 0.52)), oh = (h - plinth - corn) / rows;
    const L = [], K = [];
    box(L, t, h - corn, d, -w / 2 + t / 2, (h - corn) / 2, 0); box(L, t, h - corn, d, w / 2 - t / 2, (h - corn) / 2, 0);   // sides
    box(L, w, plinth, d + 0.04, 0, plinth / 2, 0);                                                               // plinth
    box(L, w + 0.16, corn * 0.6, d + 0.14, 0, h - corn * 0.3, 0); box(L, w + 0.06, corn * 0.4, d + 0.06, 0, h - corn * 0.8, 0);   // moulded cornice
    for (let r = 1; r < rows; r++) box(L, w - 2 * t, 0.05, d, 0, plinth + r * oh, 0);                             // shelves
    const nb = Math.max(1, Math.round((w - 2 * t) / 1.35)), bw = (w - 2 * t) / nb;
    for (let k = 1; k < nb; k++) box(L, 0.06, h - plinth - corn, d, -w / 2 + t + k * bw, plinth + (h - plinth - corn) / 2, 0);   // uprights
    box(L, w - 2 * t, h - plinth - corn, 0.03, 0, plinth + (h - plinth - corn) / 2, both ? 0 : -d / 2 + 0.03);  // back / divider
    for (const f of both ? [1, -1] : [1]) for (let r = 0; r < rows; r++) for (let k = 0; k < nb; k++) {
      const pw = bw - 0.07, ph = oh - 0.06, q = new PlaneGeometry(pw, ph), uv = q.attributes.uv;
      const tr = (r * 3 + k + (f < 0 ? 2 : 0) + ((rnd() * 4) | 0)) % 4, u0 = rnd(), v0 = 1 - (tr + 1) / 4;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * pw / 1.6, v0 + uv.getY(i) * 0.25);
      if (f < 0) q.rotateY(Math.PI);
      q.translate(-w / 2 + t + (k + 0.5) * bw, plinth + r * oh + 0.03 + ph / 2, f * (d / 2 - 0.14)); K.push(q);   // 14 cm behind the shelf fronts
    }
    for (const g of [...L, ...K]) { g.rotateY(a); g.translate(x, 0, z); }
    F.push(...L); B.push(...K);
    const side = Math.abs(Math.sin(a)) > 0.5;
    if (cols) cols.push({ type: 'box', x, z, hw: side ? d / 2 : w / 2, hd: side ? w / 2 : d / 2, angle: 0, shelf: true });
  }
  const frame = new Mesh(mergeGeometries(F, false), woodMat(1, 3, wood)); frame.name = 'bookcases'; frame.castShadow = true; group.add(frame);
  const books = new Mesh(mergeGeometries(B, false), spineMat()); books.name = 'book-spines'; group.add(books);
  return { frame, books };
}

// A few books drifting in the air (spots: [{ x, y, z }]). Two instanced meshes (covers, pages);
// returns { update(t) } that bobs, tilts and slowly turns them.
export function floatingBooks(group, spots) {
  const n = spots.length, d = new Object3D(), col = new Color();
  const covers = new InstancedMesh(new BoxGeometry(0.26, 0.05, 0.36), new MeshStandardMaterial({ roughness: 0.7 }), n);
  const pages = new InstancedMesh(new BoxGeometry(0.24, 0.036, 0.33).translate(0.012, 0, 0), new MeshStandardMaterial({ color: 0xe6d8b0, roughness: 0.9, emissive: 0xe6d8b0, emissiveIntensity: 0.12 }), n);
  const TINT = [0x6a1e1a, 0x1f3b5e, 0x2c4a2a, 0x5a3a1e, 0x4a2a52];
  spots.forEach((s, i) => covers.setColorAt(i, col.setHex(TINT[i % TINT.length])));
  covers.name = 'floating-books'; pages.name = 'floating-pages';
  covers.frustumCulled = pages.frustumCulled = false; group.add(covers, pages);
  const update = (t) => {
    spots.forEach((s, i) => {
      d.position.set(s.x + Math.sin(t * 0.3 + i) * 0.25, s.y + Math.sin(t * 0.9 + i * 1.7) * 0.18, s.z + Math.cos(t * 0.25 + i * 2) * 0.25);
      d.rotation.set(Math.sin(t * 0.7 + i) * 0.25, t * 0.15 + i * 1.3, 0.35 + Math.sin(t * 0.5 + i * 0.6) * 0.2); d.updateMatrix();
      covers.setMatrixAt(i, d.matrix); pages.setMatrixAt(i, d.matrix);
    });
    covers.instanceMatrix.needsUpdate = pages.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { covers, pages, update };
}

// ---- night windows ----
// A round-headed leaded window looking onto a moonlit sky: dark-blue sky gradient, a soft moon,
// stars, diamond quarries of old glass (each pane faintly different) and lead cames.
let _nightMat = null;
function nightMat() {
  if (_nightMat) return _nightMat;
  const W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  let seed = 31; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a1230'); g.addColorStop(0.55, '#16245a'); g.addColorStop(1, '#2a3c6e');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 70; k++) { x.fillStyle = `rgba(255,244,214,${0.3 + rnd() * 0.6})`; x.beginPath(); x.arc(rnd() * W, rnd() * H * 0.8, rnd() < 0.1 ? 1.3 : 0.7, 0, 7); x.fill(); }
  const mg = x.createRadialGradient(84, 58, 0, 84, 58, 34); mg.addColorStop(0, 'rgba(255,248,224,1)'); mg.addColorStop(0.3, 'rgba(255,240,200,0.95)'); mg.addColorStop(0.36, 'rgba(200,210,255,0.35)'); mg.addColorStop(1, 'rgba(120,140,220,0)');
  x.fillStyle = mg; x.fillRect(40, 14, 88, 88);
  const qw = 21, qh = 30;                                          // diamond quarries + lead
  for (let j = -1; j < H / (qh / 2) + 1; j++) for (let i = -1; i <= W / qw + 1; i++) {
    const cx = i * qw + (j % 2 ? qw / 2 : 0), cy = j * qh / 2;
    x.beginPath(); x.moveTo(cx, cy - qh / 2); x.lineTo(cx + qw / 2, cy); x.lineTo(cx, cy + qh / 2); x.lineTo(cx - qw / 2, cy); x.closePath();
    x.fillStyle = `rgba(${rnd() < 0.5 ? '40,70,60' : '70,60,40'},${0.06 + rnd() * 0.12})`; x.fill();
    x.strokeStyle = '#07080c'; x.lineWidth = 1.6; x.stroke();
  }
  x.strokeStyle = '#07080c'; x.lineWidth = 5; x.strokeRect(0, 0, W, H);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  _nightMat = new MeshStandardMaterial({ color: 0x050608, roughness: 0.3, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.0, side: DoubleSide });
  _nightMat.name = 'night-glass';
  return _nightMat;
}
// specs: [{ x, y, z, a }]: window centre (x, y, z) on a wall, facing angle a (0: +z). w x h is the
// rectangular part; a half-disc head sits on top. Stone-dark surround, mullion and transoms
// (MAT.dark, so they merge with other iron/dark pieces), glass in one mesh. A cool moonlight
// pool lands on the floor in front.
export function nightWindows(group, specs, { w = 1.8, h = 3.6 } = {}) {
  const G = [], D = [], th = h + w / 2;
  for (const s of specs) {
    const pane = new PlaneGeometry(w, h), pu = pane.attributes.uv;
    for (let i = 0; i < pu.count; i++) pu.setY(i, pu.getY(i) * h / th);
    const head = new CircleGeometry(w / 2, 16, 0, Math.PI), hp = head.attributes.position, hu = head.attributes.uv;
    for (let i = 0; i < hu.count; i++) hu.setXY(i, hp.getX(i) / w + 0.5, (h + hp.getY(i)) / th);
    head.translate(0, h / 2, 0); pane.deleteAttribute('normal'); head.deleteAttribute('normal');
    const parts = [pane, head];
    for (const g of parts) { g.translate(0, s.y, 0); g.rotateY(s.a || 0); g.translate(s.x, 0, s.z); }
    G.push(...parts);
    const sur = [];
    box(sur, w + 0.5, h + 0.3, 0.2, 0, s.y - 0.1, -0.12);
    const ring = new CylinderGeometry(w / 2 + 0.25, w / 2 + 0.25, 0.2, 18, 1, false, -Math.PI / 2, Math.PI); ring.rotateX(-Math.PI / 2); ring.translate(0, s.y + h / 2, -0.12); sur.push(ring.toNonIndexed());
    box(sur, 0.09, h, 0.08, 0, s.y, 0.03);                                       // mullion
    for (const f of [-0.2, 0.18]) box(sur, w, 0.08, 0.08, 0, s.y + f * h, 0.03);   // transoms
    box(sur, w + 0.7, 0.16, 0.42, 0, s.y - h / 2 - 0.08, 0.06);                  // sill
    for (const g of sur) { g.rotateY(s.a || 0); g.translate(s.x, 0, s.z); D.push(g.index ? g.toNonIndexed() : g); }
    const o = new Object3D(); o.position.set(s.x + Math.sin(s.a || 0) * 2.2, 0.5, s.z + Math.cos(s.a || 0) * 2.2);
    o.userData.light = { k: 'glow', c: 0x6a86d0, r: 2, a: 0.08 }; group.add(o);
  }
  const glass = new Mesh(mergeGeometries(G.map(g => { g.computeVertexNormals(); return g.index ? g.toNonIndexed() : g; }), false), nightMat()); glass.name = 'night-windows'; group.add(glass);
  for (const g of D) if (g.attributes.uv) g.deleteAttribute('uv');
  const frame = new Mesh(mergeGeometries(D, false), MAT.dark); frame.name = 'night-window-frames'; group.add(frame);
  return { glass, frame };
}

// ---- rug ----
let _rugMat = null;
function rugMat() {
  if (_rugMat) return _rugMat;
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  let seed = 17; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  x.fillStyle = '#5e1016'; x.fillRect(0, 0, W, H);                                          // crimson field
  for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '150,40,40'},${rnd() * 0.12})`; x.fillRect(rnd() * W, rnd() * H, 2, 2); }   // wool mottling
  const band = (i, col, wpx) => { x.strokeStyle = col; x.lineWidth = wpx; x.strokeRect(i, i, W - 2 * i, H - 2 * i); };
  band(4, '#2a0a0c', 8); band(11, '#9a7232', 4); band(17, '#3a0c10', 6);
  for (let i = 24; i < W - 24; i += 10) for (const y of [6, H - 6]) { x.fillStyle = '#a88038'; x.beginPath(); x.moveTo(i, y - 3); x.lineTo(i + 3, y); x.lineTo(i, y + 3); x.lineTo(i - 3, y); x.fill(); }
  for (let j = 24; j < H - 20; j += 10) for (const xx of [6, W - 6]) { x.fillStyle = '#a88038'; x.beginPath(); x.moveTo(xx, j - 3); x.lineTo(xx + 3, j); x.lineTo(xx, j + 3); x.lineTo(xx - 3, j); x.fill(); }
  band(22, '#a88038', 2);
  x.save(); x.translate(W / 2, H / 2);                                                      // central medallion
  x.fillStyle = '#2a0a0c'; x.beginPath(); x.ellipse(0, 0, 54, 34, 0, 0, 7); x.fill();
  x.fillStyle = '#9a7232'; x.beginPath(); x.ellipse(0, 0, 48, 29, 0, 0, 7); x.fill();
  x.fillStyle = '#7a1a1e'; x.beginPath(); x.ellipse(0, 0, 42, 24, 0, 0, 7); x.fill();
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; x.fillStyle = k % 2 ? '#b8913f' : '#24344a'; x.beginPath(); x.ellipse(Math.cos(a) * 26, Math.sin(a) * 14, 7, 4, a, 0, 7); x.fill(); }
  x.fillStyle = '#b8913f'; x.beginPath(); x.arc(0, 0, 8, 0, 7); x.fill();
  x.restore();
  for (const [cx, cy] of [[48, 36], [W - 48, 36], [48, H - 36], [W - 48, H - 36]]) { x.fillStyle = '#9a7232'; x.beginPath(); x.moveTo(cx, cy - 10); x.lineTo(cx + 10, cy); x.lineTo(cx, cy + 10); x.lineTo(cx - 10, cy); x.fill(); x.fillStyle = '#2a0a0c'; x.fillRect(cx - 3, cy - 3, 6, 6); }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  _rugMat = new MeshStandardMaterial({ map: t, roughness: 0.96 }); _rugMat.name = 'rug';
  return _rugMat;
}
export function rug(group, x, z, w, d, rotY = 0) {
  const m = new Mesh(new PlaneGeometry(w, d), rugMat()); m.rotation.set(-Math.PI / 2, 0, rotY); m.position.set(x, 0.035, z); m.receiveShadow = true; m.name = 'rug'; group.add(m); return m;
}
