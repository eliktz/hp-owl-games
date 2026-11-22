// Grounds film look, pass 2 (briefs/2026-11-22-grounds-film-look-2.md): the land between the castle,
// the hut, the glasshouse, the pitch and the lake. Everything is built in code from small canvases
// (5 of them, <= 512 px) and the shared grey wood map; no downloaded assets.
//   paths     worn earth-and-gravel footpaths: ONE merged ribbon mesh (curves sampled every 1.2 m on the
//             terrain mesh's own triangles), ragged soft edges from the texture's alpha
//   trees     3 instanced kinds sharing one atlas material (leaves | needles | bark | rock), vertex-coloured
//             darker undersides, 3 greens per kind through instance colours:
//               broadleaf  lumpy merged crown blobs on a clear 4.5 m trunk (parkland + forest edge)
//               fir        6 layered drooping tiers with ragged needle edges (forest edge)
//               far fir    a cheap 3-tier fir for the deep forest and the ring round the world
//             no real shadows: one instanced soft blob under every tree
//   lake      a wet mud-and-pebble shore band that follows the real waterline (where the terrain mesh
//             crosses WORLD.waterLevel), instanced reed clumps in the shallows, instanced boulders
//             (sharing the tree atlas), a plank jetty (walkable: groundAt) and a moored rowing boat
// Draw calls added: trees 3 + blobs 1 + paths 1 (always) + shore 1, reeds 1, boulders 1, jetty 1, boat 1
// (only within LAKE_CULL m of the lake) = 10 max, 9 on LOW (no reeds). LOW also halves the trees.
// The plan (positions, routes, the shore contour, keep-outs) is pure maths (planNature) so it can be
// checked in node; buildNature adds the canvases, materials and meshes. Nothing allocates per frame.
import {
  Group, Mesh, InstancedMesh, Object3D, BufferGeometry, Float32BufferAttribute, CylinderGeometry, IcosahedronGeometry,
  PlaneGeometry, BoxGeometry, LatheGeometry, Vector2, Vector3, Color, Matrix4, Quaternion, Euler, CatmullRomCurve3,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, RepeatWrapping, ClampToEdgeWrapping, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD, SPOTS, PLACES } from './config.js';
import { woodMaterial } from './grounds-film.js';

// ---------------------------------------------------------------------------------------------
// small helpers
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const noRaycast = () => {};

// The terrain mesh is a 96 x 96 PlaneGeometry (terrain.js buildTerrain), linear between its vertices: ground
// decals (paths, shore, blobs) sample ITS triangles, not the smooth heightAt, so they never sink or float.
const TSEG = 96;
export function meshHeight(heightAt, x, z) {
  const S = WORLD.groundSize, c = S / TSEG, h = S / 2;
  const fx = (x + h) / c, fz = (z + h) / c;
  const ix = clamp(Math.floor(fx), 0, TSEG - 1), iz = clamp(Math.floor(fz), 0, TSEG - 1);
  const u = clamp(fx - ix, 0, 1), w = clamp(fz - iz, 0, 1);
  const x0 = -h + ix * c, z0 = -h + iz * c;
  // PlaneGeometry quad (a=(ix,iz) b=(ix,iz+1) c=(ix+1,iz+1) d=(ix+1,iz)), triangles abd + bcd
  const hA = heightAt(x0, z0), hB = heightAt(x0, z0 + c), hC = heightAt(x0 + c, z0 + c), hD = heightAt(x0 + c, z0);
  if (u + w <= 1) return hA + u * (hD - hA) + w * (hB - hA);
  return hC + (1 - u) * (hB - hC) + (1 - w) * (hD - hC);
}

// ---------------------------------------------------------------------------------------------
// layout constants (world metres; +x east, +z south: the pitch is south of the gates, the castle north)
export const LAKE = { x: -90, z: -10 };                 // lake.js centre
const LAKE_CULL = 175;                                  // the lake set (shore, reeds, boulders, jetty, boat) hides beyond this
const WALK = WORLD.groundSize / 2 - 6;                  // player.js keeps Harry inside |x|,|z| < WALK
const PATH_W = 3.8;                                     // ribbon width; the texture's opaque core is ~2.4 m, the rest a ragged fade
const TREE_PATH_CLEAR = 6.5;                            // brief: trees >= 6 m from any path centre

// Footpath routes, as gentle curves through these points (centripetal Catmull-Rom).
export const ROUTES = {
  approach: [[0.4, 70.5], [1.8, 63], [-0.9, 54], [0.7, 46], [0, 40.2]],                          // gates -> the foot of the flagstone approach
  pitch:    [[0, 69.5], [-1.7, 78], [1.3, 88], [0, 98.5]],                                       // gates -> the Quidditch stand
  hut:      [[3.2, 40.6], [12, 42.6], [22, 43.4], [36, 44.6], [50, 43.6], [62, 41.2], [70.5, 37.4], [76.8, 34.4]],   // courtyard -> past the paddock -> hut flagstones
  glass:    [[-3.2, 40.6], [-12, 45], [-22, 50.5], [-33, 57.5], [-44, 64.6], [-53.5, 69.6]],     // courtyard -> glasshouse / Herbology
  lake:     [[-12, 45], [-24, 45.5], [-34, 38.5], [-40.5, 26], [-43.5, 12], [-43, 0], [-47, -8.6], [-54.4, -10]],   // round the castle's west flank -> lake spot -> jetty
  bridge:   [[22, 43.4], [29, 35], [37, 23], [42.5, 10], [46, 0], [48, -5.5]],                   // spur to the bridge
};

// Keep-out circles: nothing tall (trees, boulders, reeds) inside these. Sources noted per line.
const STARS = [[6, 40], [-20, 30], [-44, -6], [40, -4], [12, -22], [-8, 48], [64, 20], [84, 30], [-30, -30], [26, 34], [-50, 18], [0, -36]];   // quests.js STAR_SPOTS
const LETTERS = [[-14, 12], [30, 18], [-38, 2], [58, 8], [4, 24]];                                // quests.js LETTER_SPOTS
export const KEEP = [
  { id: 'castle', x: 0, z: -2, r: 46 },                  // castle shell (towers to r~31), plateau, flagstone approach, the fireworks sky over the courtyard
  { id: 'courtyard', x: SPOTS.courtyard.x, z: SPOTS.courtyard.z, r: 10 },
  { id: 'gates', x: SPOTS.gates.x, z: SPOTS.gates.z, r: 10 },
  { id: 'corner', x: 7, z: 53, r: 9 },                   // freecast-corner.js CORNER
  { id: 'duel', x: 14.5, z: 55.5, r: 10 },               // freecast-duel.js DUEL
  { id: 'yard', x: 14, z: 31, r: 8 },                    // freecast-yard.js YARD
  { id: 'hut', x: 86, z: 42, r: 16 },                    // grounds-film.js HUT (wall r~4, woodpile, flagstones ~12 m to the door side)
  { id: 'hut-spot', x: SPOTS.hut.x, z: SPOTS.hut.z, r: 7 },
  { id: 'pumpkins', x: 87.6, z: 34, r: 8 },              // grounds-film.js PATCH (local -5.6, 2.9) in world
  { id: 'paddock', x: PLACES.paddock.x, z: PLACES.paddock.z - 5, r: 10 },   // lessons.js pen (r 3.2) + Hagrid teaching spot
  { id: 'paddock-spot', x: PLACES.paddock.x, z: PLACES.paddock.z, r: 7 },
  { id: 'glasshouse', x: PLACES.greenhouse.x, z: PLACES.greenhouse.z - 8, r: 11 },   // lessons.js buildGlasshouse (6.6 x 7 m)
  { id: 'herbology', x: PLACES.greenhouse.x, z: PLACES.greenhouse.z, r: 8 },        // station + map arrival
  { id: 'pitch', x: 0, z: 128, r: 44 },                  // quidditch.js stadium (centre 0,130, towers to ~29 m out)
  { id: 'pitch-stand', x: 0, z: 98, r: 9 },              // quidditch.js STAND + map arrival
  { id: 'bridge', x: SPOTS.bridge.x, z: SPOTS.bridge.z, r: 12 },
  { id: 'lake-spot', x: SPOTS.lake.x, z: SPOTS.lake.z, r: 9 },
  { id: 'lake-splash', x: -52, z: -10, r: 6 },           // delight.js lake target
  { id: 'jetty', x: -62, z: -10, r: 11 },
  { id: 'quidditch-props', x: -42, z: -34, r: 9 },       // scenery.js quidditch props
  ...STARS.map(([x, z], i) => ({ id: 'star' + i, x, z, r: 4 })),
  ...LETTERS.map(([x, z], i) => ({ id: 'letter' + i, x, z, r: 4 })),
];

// Forbidden Forest: east of x = edgeX(z) (beyond the hut and the paddock), sweeping west as it runs north,
// so it also covers the north-east. depth = x - edgeX(z).
export const forestEdge = (z) => 104 + 5 * Math.sin(z * 0.045 + 1) + 3 * Math.sin(z * 0.11) - Math.max(0, -z - 30) * 0.42;

// Parkland clumps: [x, z, trees, radius]
const CLUMPS = [[-28, 82, 5, 9], [32, 74, 4, 8], [-60, 34, 5, 9], [70, -4, 4, 8], [-22, -58, 5, 9], [26, -62, 4, 8],
  [42, 96, 4, 8], [-38, 104, 4, 8], [-136, -52, 4, 9], [-140, 26, 4, 9], [-112, 70, 3, 7], [-90, -95, 4, 9]];

// Jetty (walkable deck) + boat: placed on the shore due west of the lake spot.
const DECK_Y = WORLD.waterLevel + 0.58, DECK_L = 12.5, DECK_HW = 1.0, JETTY_Z = -10;

// Tree kinds: trunk radius (collider), blob radius, three greens (instance colours, x the atlas + vertex colour)
const KINDS = {
  broadleaf: { trunk: 0.42, blob: 4.4, greens: [0xc4cca0, 0xa8b888, 0xcfc494] },
  fir:       { trunk: 0.32, blob: 3.6, greens: [0x9aa88c, 0x8a9a82, 0xa4ac90] },
  far:       { trunk: 0.28, blob: 3.2, greens: [0x7e8c78, 0x707e6c, 0x86907a] },
};
const CAP = { broadleaf: 100, fir: 120, far: 480 };

// ---------------------------------------------------------------------------------------------
// The plan: pure data (no canvas, no materials). Deterministic.
export function planNature(heightAt) {
  const W = WORLD.waterLevel, mh = (x, z) => meshHeight(heightAt, x, z);

  // ---- paths: sampled curves ----
  const paths = [];
  for (const [id, pts] of Object.entries(ROUTES)) {
    const curve = new CatmullRomCurve3(pts.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal');
    const L = curve.getLength(), n = Math.max(4, Math.ceil(L / 1.2));
    paths.push({ id, L, pts: curve.getSpacedPoints(n).map(p => [p.x, p.z]) });
  }
  const pathPts = paths.flatMap(p => p.pts);
  // spatial hash for "distance to the nearest path centre"
  const PC = 8, pgrid = new Map(), key = (i, j) => i * 10007 + j;
  for (const [x, z] of pathPts) { const k = key(Math.floor(x / PC), Math.floor(z / PC)); if (!pgrid.has(k)) pgrid.set(k, []); pgrid.get(k).push(x, z); }
  function pathDist(x, z, max = 16) {
    let best = max; const i0 = Math.floor(x / PC), j0 = Math.floor(z / PC), R = Math.ceil(max / PC);
    for (let i = i0 - R; i <= i0 + R; i++) for (let j = j0 - R; j <= j0 + R; j++) {
      const a = pgrid.get(key(i, j)); if (!a) continue;
      for (let q = 0; q < a.length; q += 2) { const d = Math.hypot(a[q] - x, a[q + 1] - z); if (d < best) best = d; }
    }
    return best;
  }

  // ---- the shore: the outermost radius (per angle) where the terrain mesh is under the water ----
  const NA = 180, shoreR = new Float32Array(NA + 1);
  for (let i = 0; i < NA; i++) {
    const a = i / NA * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    let r0 = 0; for (let r = 58; r >= 0; r -= 0.5) if (mh(LAKE.x + c * r, LAKE.z + s * r) < W) { r0 = r; break; }
    let lo = r0, hi = r0 + 0.5;                       // refine the crossing
    for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; if (mh(LAKE.x + c * m, LAKE.z + s * m) < W) lo = m; else hi = m; }
    shoreR[i] = (lo + hi) / 2;
  }
  shoreR[NA] = shoreR[0];
  const shoreAt = (a) => { let t = (a / (Math.PI * 2)) % 1; if (t < 0) t += 1; const f = t * NA, i = Math.floor(f); return shoreR[i] + (shoreR[i + 1] - shoreR[i]) * (f - i); };
  const lakeClear = (x, z, pad) => { const dx = x - LAKE.x, dz = z - LAKE.z; return Math.hypot(dx, dz) > shoreAt(Math.atan2(dz, dx)) + pad; };

  const kept = (x, z, pad = 0) => { for (const k of KEEP) if (Math.hypot(x - k.x, z - k.z) < k.r + pad) return false; return true; };

  // ---- jetty: the deck starts where the shore drops to deck height, on the line west from the lake spot ----
  let xL = -50; while (xL > -80 && mh(xL, JETTY_Z) > DECK_Y + 0.04) xL -= 0.25;
  const jetty = { x0: xL + 0.3, x1: xL + 0.3 - DECK_L, z: JETTY_Z, hw: DECK_HW, y: DECK_Y };
  const boat = { x: jetty.x1 + 2.4, z: JETTY_Z - DECK_HW - 1.2, yaw: 0.06, len: 3.9, beam: 1.3 };

  // ---- trees: dart throwing with a spatial hash ----
  const trees = [], TC = 6, tgrid = new Map();
  const near = (x, z, d) => { const i0 = Math.floor(x / TC), j0 = Math.floor(z / TC), R = Math.ceil(d / TC);
    for (let i = i0 - R; i <= i0 + R; i++) for (let j = j0 - R; j <= j0 + R; j++) { const a = tgrid.get(key(i, j)); if (a) for (const t of a) if (Math.hypot(t.x - x, t.z - z) < d) return true; }
    return false; };
  const count = { broadleaf: 0, fir: 0, far: 0 };
  function addTree(kind, x, z, s, shade = 1, zone = '') {
    if (count[kind] >= CAP[kind]) return false;
    const t = { kind, x, z, s, shade, zone }; trees.push(t); count[kind]++;
    const k = key(Math.floor(x / TC), Math.floor(z / TC)); if (!tgrid.has(k)) tgrid.set(k, []); tgrid.get(k).push(t); return true;
  }
  const okSite = (x, z, pad = 0) => kept(x, z, pad) && lakeClear(x, z, 5) && pathDist(x, z) >= TREE_PATH_CLEAR && Math.abs(x) < 208 && Math.abs(z) < 208;

  // parkland clumps (mostly broadleaf, the odd fir)
  let r = rng(4242);
  for (const [cx, cz, n, rad] of CLUMPS) {
    let placed = 0;
    for (let a = 0; a < 60 && placed < n; a++) {
      const ang = r() * Math.PI * 2, d = Math.sqrt(r()) * rad, x = cx + Math.cos(ang) * d, z = cz + Math.sin(ang) * d;
      if (!okSite(x, z) || near(x, z, 5.2)) continue;
      if (addTree(r() < 0.82 ? 'broadleaf' : 'fir', x, z, 0.95 + r() * 0.45, 1, 'park')) placed++;
    }
  }
  // the forest: edge band (fir + broadleaf), mid band (far firs, close), deep (far firs, sparse)
  r = rng(777);
  const zones = [
    { d0: 0, d1: 20, gap: 7.2, tries: 9000, kind: () => (r() < 0.7 ? 'fir' : 'broadleaf') },
    { d0: 20, d1: 44, gap: 5.6, tries: 14000, max: 230, kind: () => 'far' },
    { d0: 44, d1: 400, gap: 12, tries: 9000, max: 105, kind: () => 'far' },   // the rest of the far budget is the world ring
  ];
  for (const zn of zones) for (let a = 0, got = 0; a < zn.tries && got < (zn.max || 1e9); a++) {
    const z = -206 + r() * 412, e = forestEdge(z), x = e + zn.d0 + r() * Math.min(zn.d1 - zn.d0, 206 - e - zn.d0);
    if (x > 206) continue;
    const depth = x - e - (r() - 0.5) * 3;
    if (depth < zn.d0 || depth > zn.d1 || !okSite(x, z) || near(x, z, zn.gap * (0.85 + r() * 0.3))) continue;
    if (addTree(zn.kind(), x, z, 0.85 + r() * 0.5, 1 - 0.38 * smooth(10, 60, depth), 'forest')) got++;
  }
  // the far ring round the edge of the world (where the forest is not)
  r = rng(9001);
  for (let a = 0; a < 6000; a++) {
    const side = Math.floor(r() * 4), t = -207 + r() * 414, inset = 192 + r() * 15;
    const x = side === 0 ? t : side === 1 ? t : side === 2 ? inset : -inset, z = side === 0 ? inset : side === 1 ? -inset : t;
    if (x > forestEdge(z) - 4 || !okSite(x, z) || near(x, z, 7.5)) continue;
    addTree('far', x, z, 0.95 + r() * 0.5, 0.82 + r() * 0.12, 'ring');
  }
  // per-tree look: rotation, lean, green; LOW keeps a deterministic half (every other tree of a kind)
  r = rng(31337);
  const byKind = { broadleaf: [], fir: [], far: [] };
  for (const t of trees) { t.rot = r() * Math.PI * 2; t.lx = (r() - 0.5) * 0.06; t.lz = (r() - 0.5) * 0.06; t.green = Math.floor(r() * 3); byKind[t.kind].push(t); }
  for (const k of Object.keys(byKind)) {
    const a = byKind[k]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    a.forEach((t, i) => { t.low = i % 2 === 0; });
    a.sort((p, q) => (q.low ? 1 : 0) - (p.low ? 1 : 0));          // the LOW half first: LOW draws count = half
  }
  for (const t of trees) t.reach = Math.abs(t.x) < WALK + 0.5 && Math.abs(t.z) < WALK + 0.5;

  // ---- reeds (shallows) and boulders (along the waterline) ----
  r = rng(555);
  const jettyA = Math.atan2(JETTY_Z - LAKE.z, jetty.x0 - LAKE.x);   // ~0 rad (east)
  const angGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const reeds = [];
  for (const pa of [0.42, 0.95, 1.55, 2.25, 2.85, 3.5, 4.2, 4.85, 5.45, 5.95]) {
    const n = 4 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const a = pa + (r() - 0.5) * 0.16, R = shoreAt(a) - 0.4 - r() * 2.8, x = LAKE.x + Math.cos(a) * R, z = LAKE.z + Math.sin(a) * R;
      if (angGap(a, jettyA) < 0.3) continue;
      reeds.push({ x, z, y: mh(x, z), s: 0.8 + r() * 0.5, rot: r() * Math.PI });
    }
  }
  const boulders = [];
  const jettyClear = (x, z, pad) => !(x < jetty.x0 + pad && x > jetty.x1 - pad && Math.abs(z - JETTY_Z) < DECK_HW + pad) && Math.hypot(x - boat.x, z - boat.z) > 3 + pad;
  for (const ga of [0.25, 0.7, 1.3, 2.0, 2.6, 3.2, 3.85, 4.5, 5.2, 5.75]) {
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const a = ga + (r() - 0.5) * 0.12, R = shoreAt(a) - 1.2 + r() * 3.6, x = LAKE.x + Math.cos(a) * R, z = LAKE.z + Math.sin(a) * R;
      if (!jettyClear(x, z, 1.2) || pathDist(x, z) < 3) continue;
      const s = 0.45 + r() * r() * 1.3;
      boulders.push({ x, z, y: mh(x, z), s, rot: r() * Math.PI * 2, sq: 0.55 + r() * 0.25, tilt: (r() - 0.5) * 0.3 });
    }
  }
  // two rocks at the jetty's landward end
  for (const [dx, dz, s] of [[0.5, 3.3, 0.75], [1.0, -3.2, 0.6]]) { const x = jetty.x0 + dx, z = JETTY_Z + dz; boulders.push({ x, z, y: mh(x, z), s, rot: dx * 2, sq: 0.62, tilt: 0.1 }); }
  for (const b of boulders) b.wet = b.y < W + 0.05;

  // ---- colliders (data; buildNature pushes the active ones into the outdoor list) ----
  const treeCol = trees.filter(t => t.reach).map(t => ({ type: 'circle', x: t.x, z: t.z, r: KINDS[t.kind].trunk * t.s + 0.05, nature: 'tree', low: t.low }));
  const rockCol = boulders.filter(b => !b.wet && b.s > 0.85).map(b => ({ type: 'circle', x: b.x, z: b.z, r: 0.85 * b.s, nature: 'rock', low: true }));
  const boatCol = { type: 'box', x: boat.x, z: boat.z, hw: boat.len / 2, hd: boat.beam / 2 - 0.05, angle: boat.yaw, nature: 'boat', low: true };

  return { paths, pathDist, shoreR, shoreAt, NA, trees, byKind, count, reeds, boulders, jetty, boat, colliders: [...treeCol, ...rockCol, boatCol], kept, mh };
}

// ---------------------------------------------------------------------------------------------
// geometry (three.js only; no canvas)
// Atlas cells: [u0, v0] of a 0.5 x 0.5 cell, inset so mips do not bleed across cells.
const CELL = { leaf: [0, 0.5], needle: [0.5, 0.5], bark: [0, 0], rock: [0.5, 0] }, INSET = 0.014;
const cu = (cell, u, v) => [CELL[cell][0] + INSET + clamp(u, 0, 1) * (0.5 - 2 * INSET), CELL[cell][1] + INSET + clamp(v, 0, 1) * (0.5 - 2 * INSET)];

class Soup {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; }
  v(p, n, u, c) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.u.push(u[0], u[1]); this.c.push(c[0], c[1], c[2]); }
  tri(a, b, c) { this.v(...a); this.v(...b); this.v(...c); }
  geo() { const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new Float32BufferAttribute(this.c, 3)); return g; }
}
const nrm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };

// three primitive -> non-indexed, coloured, atlas-UV'd (uvf(x,y,z) -> [u,v] in the cell), colour cf(x,y,z,nx,ny,nz)
function prim(g, cell, uvf, cf) {
  g = g.index ? g.toNonIndexed() : g;
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const [u, v] = uvf(x, y, z, uv.getX(i), uv.getY(i)); const [U, V] = cu(cell, u, v); uv.setXY(i, U, V);
    const c = cf(x, y, z, n.getX(i), n.getY(i), n.getZ(i)); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}
function mergeC(list) {
  const gs = list.map(g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); g.clearGroups(); return g; });
  return mergeGeometries(gs, false);
}
const grey = (k) => [k, k, k];

// Broadleaf: a clear 7 m trunk (crown from ~4.7 m), two branch stubs, a crown of 3 lumpy merged blobs.
// Blob normals point out from each blob's centre (tilted up): a soft rounded canopy, darker underneath.
function broadleafGeo() {
  const parts = [], bark = (x, y, z, u, v) => [u, y / 7.5], barkC = (x, y) => grey(0.62 + 0.3 * Math.min(1, y / 5));
  const trunk = new CylinderGeometry(0.26, 0.44, 7.2, 6, 2, true); trunk.translate(0, 3.6, 0);
  { const p = trunk.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.012 * y * y * 0.4); } }   // a slight lean-bend
  parts.push(prim(trunk, 'bark', bark, barkC));
  for (const [ry, rz, y] of [[0.3, 0.75, 4.6], [2.6, 0.85, 5.2]]) {
    const b = new CylinderGeometry(0.09, 0.19, 3.0, 5, 1, true); b.translate(0, 1.5, 0); b.rotateZ(rz); b.rotateY(ry); b.translate(0.1, y, 0);
    parts.push(prim(b, 'bark', bark, () => grey(0.8)));
  }
  const BLOBS = [[0, 9.2, 0, 3.9], [2.2, 7.5, 0.9, 2.8], [-1.9, 7.8, -1.2, 2.9]];   // 3 x 80 tris: the main dome + two side lumps
  for (const [bx, by, bz, br] of BLOBS) {
    const g = new IcosahedronGeometry(1, 1), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const lump = 1 + 0.13 * Math.sin(x * 4.1 + bx) * Math.sin(y * 3.7 + 1.3) + 0.08 * Math.sin(z * 5.3 + by) - (y < -0.35 ? 0.18 * (-0.35 - y) : 0);
      const sy = y < 0 ? 0.78 : 1;                                     // flatter underside
      p.setXYZ(i, bx + x * br * lump, by + y * br * lump * sy, bz + z * br * lump);
      const [nx, ny, nz] = nrm(x, y + 0.35, z); n.setXYZ(i, nx, ny, nz);
    }
    parts.push(prim(g, 'leaf',
      (x, y, z) => [0.5 + ((x - bx) * 0.8 + (z - bz) * 0.6) / (2.6 * br), 0.5 + ((y - by) + (z - bz) * 0.3) / (2.6 * br)],
      (x, y, z) => { const up = clamp(0.5 + 0.5 * (y - by) / br, 0, 1), h = clamp((y - 5.2) / 7, 0, 1); return grey(0.36 + 0.5 * up * (0.55 + 0.45 * h) + 0.12 * h); }));
  }
  return mergeC(parts);
}

// A fir: trunk + K drooping tiers (apex fan + a steeper lower band ending in a ragged needle edge).
function firGeo(K, N, H, R0, trunkH, tone) {
  const S = new Soup(), r = rng(K * 31 + N);
  for (let k = 0; k < K; k++) {
    const t = k / K, yb = trunkH + t * (H - trunkH - 2.2), R = R0 * (1 - t * 0.82), h = 2.4 + R * 0.55;
    const A = [0, yb + h, 0], sh = [], ed = [];
    for (let j = 0; j <= N; j++) {
      const a = (j % N) / N * Math.PI * 2 + k * 0.7, c = Math.cos(a), s = Math.sin(a), jr = j === N ? ed[0].jr : 1 + (r() - 0.5) * 0.24, jy = j === N ? ed[0].jy : (r() - 0.5) * 0.35;
      sh.push({ p: [c * R * 0.68, yb + h * 0.4, s * R * 0.68], n: nrm(c, 1.1, s), u: j / N });
      ed.push({ p: [c * R * jr, yb + jy, s * R * jr], n: nrm(c, 0.45, s), u: j / N, jr, jy });
    }
    const top = tone * (0.86 + 0.14 * t), mid = tone * (0.7 + 0.12 * t), low = tone * (0.5 + 0.1 * t);
    const V = (q, v, c) => [q.p, q.n, cu('needle', q.u, v), grey(c)];
    for (let j = 0; j < N; j++) {
      const um = (sh[j].u + sh[j + 1].u) / 2;
      S.tri([A, nrm(0, 1, 0), cu('needle', um, 0.98), grey(top)], V(sh[j + 1], 0.42, mid), V(sh[j], 0.42, mid));
      S.tri(V(sh[j], 0.42, mid), V(sh[j + 1], 0.42, mid), V(ed[j + 1], 0.0, low));
      S.tri(V(sh[j], 0.42, mid), V(ed[j + 1], 0.0, low), V(ed[j], 0.0, low));
    }
  }
  const trunk = new CylinderGeometry(0.1, 0.32, H * 0.75, 5, 1, true); trunk.translate(0, H * 0.375, 0);
  return mergeC([S.geo(), prim(trunk, 'bark', (x, y, z, u) => [u, y / 6], (x, y) => grey(0.5 + 0.3 * Math.min(1, y / 3)))]);
}
// Far fir: 3 tiers, apex fans only, short trunk.
function farGeo() {
  const S = new Soup(), N = 7, H = 15;
  for (let k = 0; k < 3; k++) {
    const yb = 1.6 + k * 3.9, R = 3.4 * (1 - k * 0.3), h = 4.4 + R * 0.4, A = [0, yb + h, 0];
    const ring = []; for (let j = 0; j <= N; j++) { const a = (j % N) / N * Math.PI * 2 + k; ring.push({ p: [Math.cos(a) * R, yb, Math.sin(a) * R], n: nrm(Math.cos(a), 0.7, Math.sin(a)), u: j / N }); }
    const tone = 0.62 + k * 0.1;
    for (let j = 0; j < N; j++) S.tri([A, nrm(0, 1, 0), cu('needle', (ring[j].u + ring[j + 1].u) / 2, 0.98), grey(tone + 0.2)], [ring[j + 1].p, ring[j + 1].n, cu('needle', ring[j + 1].u, 0.0), grey(tone * 0.7)], [ring[j].p, ring[j].n, cu('needle', ring[j].u, 0.0), grey(tone * 0.7)]);
  }
  const trunk = new CylinderGeometry(0.1, 0.28, 3.2, 4, 1, true); trunk.translate(0, 1.6, 0);
  return mergeC([S.geo(), prim(trunk, 'bark', (x, y, z, u) => [u, y / 4], () => grey(0.5))]);
}
// Boulder: a displaced, squashed icosahedron (80 tris), mossy on top, dark and wet at the base.
function boulderGeo() {
  const g = new IcosahedronGeometry(1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.16 * Math.sin(x * 3.1 + 0.5) * Math.cos(z * 2.7) + 0.1 * Math.sin(y * 4.3 + x * 2); p.setXYZ(i, x * k, y * k, z * k); }
  g.computeVertexNormals();                                     // faceted: rock planes catch the light
  return prim(g, 'rock', (x, y, z) => [0.5 + (x + z * 0.5) * 0.3, 0.5 + (y + z * 0.4) * 0.3],
    (x, y, z, nx, ny) => { const top = clamp(ny, 0, 1), base = clamp(0.5 + y, 0, 1); return [0.55 + 0.35 * base - 0.06 * top, 0.55 + 0.35 * base + 0.05 * top, 0.55 + 0.32 * base - 0.1 * top]; });
}
// Reed clump: 3 crossed vertical cards, 1.5 m wide, 1.9 m tall (alpha-cut blades).
function reedGeo() {
  const parts = [];
  for (let i = 0; i < 3; i++) { const q = new PlaneGeometry(1.5, 1.9); q.translate(0, 0.95, 0); q.rotateY(i * Math.PI / 3); parts.push(q); }
  const g = mergeGeometries(parts.map(q => { q.deleteAttribute('normal'); return q.toNonIndexed(); }), false);
  const n = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < n.length; i += 3) n[i + 1] = 1;   // up normals: lit like the grass
  g.setAttribute('normal', new Float32BufferAttribute(n, 3));
  return g;
}
// Ground ribbons (paths, shore) on the terrain mesh, +lift.
function pathGeo(plan, heightAt) {
  const P = [], N = [], U = [], ACROSS = [0, 0.14, 0.32, 0.5, 0.68, 0.86, 1];
  const quad = (a, b, c, d) => { for (const v of [a, b, c, a, c, d]) { P.push(v[0], v[1], v[2]); N.push(v[3], v[4], v[5]); U.push(v[6], v[7]); } };
  for (const path of plan.paths) {
    const pts = path.pts, n = pts.length; let s = 0, prev = null;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const taper = Math.min(smooth(0, 3.2, s), smooth(0, 3.2, path.L - s)) * 0.75 + 0.25;
      const wj = 1 + 0.1 * Math.sin(s * 0.21 + path.L) + 0.06 * Math.sin(s * 0.67);
      const hw = PATH_W / 2 * wj * taper, sway = 0.25 * Math.sin(s * 0.13 + 1.7);
      const row = ACROSS.map(f => {
        const o = (f - 0.5) * 2 * hw + sway, x = pts[i][0] - tz * o, z = pts[i][1] + tx * o;
        const y = meshHeight(heightAt, x, z) + 0.035;
        const gx = heightAt(x + 0.5, z) - heightAt(x - 0.5, z), gz = heightAt(x, z + 0.5) - heightAt(x, z - 0.5);
        const [nx, ny, nz] = nrm(-gx, 1, -gz);
        return [x, y, z, nx, ny, nz, f, s / 4];
      });
      if (prev) for (let k = 0; k < ACROSS.length - 1; k++) quad(prev[k], prev[k + 1], row[k + 1], row[k]);   // faces +y
      prev = row;
    }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(P, 3)); g.setAttribute('normal', new Float32BufferAttribute(N, 3)); g.setAttribute('uv', new Float32BufferAttribute(U, 2));
  return g;
}
const SHORE_O = [-3.5, -1.6, -0.5, 0.5, 1.6, 2.8, 4.2];                                 // metres from the waterline (- = under water)
function shoreGeo(plan, heightAt) {
  const P = [], N = [], U = [], NA = plan.NA, o0 = SHORE_O[0], o1 = SHORE_O[SHORE_O.length - 1];
  let L = 0; for (let i = 0; i < NA; i++) { const a0 = i / NA * Math.PI * 2, a1 = (i + 1) / NA * Math.PI * 2; L += Math.hypot(Math.cos(a1) * plan.shoreR[i + 1] - Math.cos(a0) * plan.shoreR[i], Math.sin(a1) * plan.shoreR[i + 1] - Math.sin(a0) * plan.shoreR[i]); }
  const uS = Math.max(1, Math.round(L / 5.5)) / L;                                     // whole tiles round: no seam
  let s = 0, prev = null;
  for (let i = 0; i <= NA; i++) {
    const a = i / NA * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), R = plan.shoreR[i];
    if (i > 0) { const pa = (i - 1) / NA * Math.PI * 2; s += Math.hypot(c * R - Math.cos(pa) * plan.shoreR[i - 1], sn * R - Math.sin(pa) * plan.shoreR[i - 1]); }
    const row = SHORE_O.map(o => {
      const rr = R + o + (o > 0 ? 0.5 * Math.sin(a * 7 + o) : 0), x = LAKE.x + c * rr, z = LAKE.z + sn * rr;
      return [x, meshHeight(heightAt, x, z) + 0.04, z, 0, 1, 0, s * uS, (o - o0) / (o1 - o0)];
    });
    if (prev) for (let k = 0; k < SHORE_O.length - 1; k++) {
      const A = prev[k], B = row[k], C = row[k + 1], D = prev[k + 1];
      for (const v of [A, B, C, A, C, D]) { P.push(v[0], v[1], v[2]); N.push(v[3], v[4], v[5]); U.push(v[6], v[7]); }   // faces +y
    }
    prev = row;
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(P, 3)); g.setAttribute('normal', new Float32BufferAttribute(N, 3)); g.setAttribute('uv', new Float32BufferAttribute(U, 2));
  return g;
}
// Jetty in world space (planks across, two stringers, cross-bearers, post pairs, taller mooring posts at the end).
function jettyGeo(plan, heightAt, WT) {
  const J = plan.jetty, parts = [], r = rng(808), W = WORLD.waterLevel;
  const uv = (g, rot) => { const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); let u, v; if (ay >= ax && ay >= Math.abs(n.getZ(i))) { u = p.getZ(i); v = p.getX(i); } else if (ax >= Math.abs(n.getZ(i))) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); } if (rot) [u, v] = [v, u]; t.setXY(i, u / WT, v / WT); } return g; };
  const box = (w, h, d, x, y, z, ry = 0, rz = 0, rot = false) => { const b = new BoxGeometry(w, h, d); b.rotateZ(rz); b.rotateY(ry); b.translate(x, y, z); parts.push(uv(b, rot)); };
  const len = J.x0 - J.x1, np = Math.floor(len / 0.29);
  for (let i = 0; i < np; i++) { const x = J.x0 - 0.15 - i * (len - 0.3) / (np - 1); box(0.26, 0.06, J.hw * 2 + (r() - 0.5) * 0.08, x, J.y - 0.03 + (r() - 0.5) * 0.015, J.z + (r() - 0.5) * 0.04, (r() - 0.5) * 0.03, (r() - 0.5) * 0.02, true); }
  for (const s of [-0.72, 0.72]) box(len, 0.2, 0.14, (J.x0 + J.x1) / 2, J.y - 0.16, J.z + s, 0, 0, false);
  const posts = []; for (let x = J.x0 - 1.2; x > J.x1 + 0.2; x -= 2.6) posts.push(x); posts.push(J.x1 + 0.12);
  posts.forEach((x, k) => {
    const end = k === posts.length - 1;
    box(0.16, 0.16, J.hw * 2 + 0.3, x, J.y - 0.3, J.z, 0, 0, true);                    // cross-bearer
    for (const s of [-1, 1]) {
      const zb = J.z + s * (J.hw + 0.1), yb = meshHeight(heightAt, x, zb) - 0.4, yt = J.y + (end ? 0.62 : -0.04);
      const c = new CylinderGeometry(0.11, 0.13, yt - yb, 7, 1); c.translate(x, (yt + yb) / 2, zb); parts.push(uv(c, true));
    }
  });
  // a stone-and-earth step at the landward end so the deck meets the bank
  box(1.0, 0.4, J.hw * 2 + 0.4, J.x0 + 0.35, J.y - 0.22, J.z, 0, 0, true);
  // mooring rope from the end post to the boat's bow
  const B = plan.boat, ex = J.x1 + 0.12, ez = J.z - (J.hw + 0.1), bx = B.x - B.len / 2 * 0.92, bz = B.z, ey = J.y + 0.45, by = W + 0.45;
  const rl = Math.hypot(bx - ex, bz - ez, by - ey), rope = new CylinderGeometry(0.025, 0.025, rl, 4, 1, true);
  rope.rotateX(Math.PI / 2); rope.lookAt(new Vector3(bx - ex, by - ey, bz - ez)); rope.translate((ex + bx) / 2, (ey + by) / 2, (ez + bz) / 2); parts.push(uv(rope, false));   // +z (the rope) toward the bow
  return mergeGeoms(parts);
}
function mergeGeoms(list) {
  const gs = list.map(g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); g.clearGroups(); return g; });
  return mergeGeometries(gs, false);
}
// Rowing boat in its own frame (length along x, origin at the waterline), a pinched lathe bowl + seats + oars.
function boatGeo(plan, WT) {
  const B = plan.boat, parts = [], L = B.len, Bm = B.beam, D = 0.55;
  const prof = [[1, 0.0], [0.97, -0.2], [0.88, -0.38], [0.66, -0.52], [0.36, -0.6], [0.001, -0.62]].map(([x, y]) => new Vector2(x, y));
  const hull = new LatheGeometry(prof, 18), p = hull.attributes.position, t = hull.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const pinch = x > 0 ? 1 - 0.86 * Math.pow(x, 2.2) : 1 - 0.38 * x * x;      // pointed bow (+x), fuller stern
    p.setXYZ(i, x * L / 2, y * D / 0.62 + 0.13 * x * x + 0.32, z * Bm / 2 * pinch);
    t.setXY(i, x * L / 2 / WT, (t.getY(i) * 1.6) / WT);
  }
  hull.computeVertexNormals(); parts.push(hull);
  for (const [x, w] of [[-0.55, 0.9], [0.55, 0.78]]) { const s = new BoxGeometry(0.26, 0.05, w * Bm); s.translate(x, 0.12, 0); parts.push(s); }
  for (const sd of [-1, 1]) { const o = new CylinderGeometry(0.03, 0.03, 2.4, 5, 1); o.rotateZ(Math.PI / 2); o.rotateY(sd * 0.12); o.translate(0.1, 0.05, sd * 0.32); parts.push(o); const bl = new BoxGeometry(0.5, 0.02, 0.15); bl.translate(1.25, 0.06, sd * 0.32 + sd * 0.15); parts.push(bl); }
  return mergeGeoms(parts);
}

// ---------------------------------------------------------------------------------------------
// canvases (browser only): 5 textures, <= 512 px
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
function ctex(c, ws, wt) { const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = ws; t.wrapT = wt; t.anisotropy = 4; return t; }
const pn = (x, k, ph) => Math.sin(x * Math.PI * 2 * k + ph);       // periodic over [0,1) for integer k

// Atlas 512: TL leaves | TR fir needles (ragged alpha at the bottom = the tier edge) | BL bark | BR rock.
function atlasTexture() {
  const [c, g] = canvas(512), r = rng(64);
  // leaves (canvas 0..256 x 0..256 = u 0..0.5, v 0.5..1)
  g.fillStyle = '#2c4624'; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 150; k++) {
    const cx = r() * 256, cy = r() * 256, sh = r();
    for (let i = 0; i < 22; i++) {
      const a = r() * 6.28, d = r() * 13, v = r();
      g.fillStyle = v < 0.25 ? '#203a1c' : v < 0.55 ? (sh < 0.5 ? '#3c5a2a' : '#46602c') : v < 0.85 ? (sh < 0.5 ? '#557034' : '#5e7234') : '#728a42';
      g.beginPath(); g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2 + r() * 3.5, 1.2 + r() * 2, r() * 3, 0, 7); g.fill();
    }
  }
  // needles (256..512 x 0..256): opaque body down to a ragged edge, tileable across the cell
  g.save(); g.beginPath(); g.rect(256, 0, 256, 256); g.clip();
  g.fillStyle = '#22381f'; g.beginPath(); g.moveTo(256, 0); g.lineTo(512, 0);
  for (let i = 64; i >= 0; i--) { const u = i / 64; g.lineTo(256 + u * 256, 206 + 10 * pn(u, 3, 0.4) + 7 * pn(u, 7, 1.1) + 4 * pn(u, 13, 2.0)); }
  g.closePath(); g.fill();
  for (let i = 0; i < 1500; i++) {
    const u = r(), y = r() * 240, L = 8 + r() * 16, a = 0.5 + r() * 0.9 * (r() < 0.5 ? -1 : 1), v = r();
    g.strokeStyle = v < 0.35 ? '#182c18' : v < 0.7 ? '#2e4a2a' : v < 0.92 ? '#3e5e34' : '#52703e'; g.lineWidth = 1 + r() * 1.2;
    for (const off of [-256, 0, 256]) { const x = 256 + u * 256 + off; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * L, y + Math.cos(Math.abs(a)) * L); g.stroke(); }
  }
  g.restore();
  // bark (0..256 x 256..512)
  g.fillStyle = '#4a3e33'; g.fillRect(0, 256, 256, 256);
  for (let i = 0; i < 70; i++) { let x = r() * 256; g.strokeStyle = r() < 0.6 ? '#2a221c' : '#66584a'; g.lineWidth = 1.5 + r() * 3; g.beginPath(); g.moveTo(x, 256); for (let y = 256; y <= 512; y += 16) { x += (r() - 0.5) * 5; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 50; i++) { g.fillStyle = r() < 0.5 ? 'rgba(120,128,96,0.5)' : 'rgba(150,150,130,0.35)'; g.beginPath(); g.ellipse(r() * 256, 256 + r() * 256, 3 + r() * 9, 2 + r() * 6, 0, 0, 7); g.fill(); }
  // rock (256..512 x 256..512)
  g.fillStyle = '#6a665e'; g.fillRect(256, 256, 256, 256);
  for (let i = 0; i < 260; i++) { const v = r(); g.fillStyle = v < 0.4 ? 'rgba(80,76,70,0.55)' : v < 0.8 ? 'rgba(132,126,116,0.5)' : 'rgba(104,116,76,0.55)'; g.beginPath(); g.ellipse(256 + r() * 256, 256 + r() * 256, 4 + r() * 18, 3 + r() * 12, r() * 3, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(40,38,34,0.6)'; g.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) { let x = 256 + r() * 256, y = 256 + r() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  return ctex(c, ClampToEdgeWrapping, ClampToEdgeWrapping);
}
// Path: 256 across (u, clamped) x 512 along (v, 4 m, repeats). Earth + gravel, two worn tracks, ragged alpha.
function pathTexture() {
  const W = 256, H = 512, [c, g] = canvas(W, H), r = rng(19);
  const img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const eL = 0.19 + 0.045 * pn(v, 2, 0.3) + 0.03 * pn(v, 5, 1.7) + 0.02 * pn(v, 11, 0.2);
    const eR = 0.81 + 0.045 * pn(v, 3, 2.1) + 0.03 * pn(v, 7, 0.9) + 0.02 * pn(v, 13, 1.4);
    for (let x = 0; x < W; x++) {
      const u = x / W, i = (y * W + x) * 4, n = r();
      let a = smooth(eL - 0.07, eL + 0.07, u) * (1 - smooth(eR - 0.07, eR + 0.07, u));
      if (a < 0.95 && n < 0.18) a *= 0.4;                                          // grass blades breaking the edge
      const track = Math.exp(-(((u - 0.4) / 0.06) ** 2)) + Math.exp(-(((u - 0.6) / 0.06) ** 2));
      const k = 0.92 + (n - 0.5) * 0.22 - track * 0.08 + (1 - a) * 0.06;
      d[i] = 118 * k; d[i + 1] = 100 * k; d[i + 2] = 76 * k; d[i + 3] = 255 * a;
    }
  }
  g.putImageData(img, 0, 0);
  // gravel + pebbles (core only, wrapped along v)
  for (let i = 0; i < 900; i++) {
    const x = W * (0.3 + r() * 0.4), y = r() * H, s = 0.8 + r() * (r() < 0.1 ? 3.2 : 1.4), v = r();
    g.fillStyle = v < 0.4 ? '#857c6e' : v < 0.75 ? '#6a6156' : v < 0.9 ? '#9a9080' : '#4e463c';
    for (const off of [-H, 0, H]) { g.beginPath(); g.ellipse(x, y + off, s, s * 0.75, r() * 3, 0, 7); g.fill(); }
  }
  return ctex(c, ClampToEdgeWrapping, RepeatWrapping);
}
// Shore: 512 along (u, repeats every 5.5 m) x 256 across (v: 0 = 3.5 m under water, 1 = 4.2 m inland; clamped).
function shoreTexture() {
  const W = 512, H = 256, [c, g] = canvas(W, H), r = rng(73);
  const vy = (o) => H * (1 - (o - SHORE_O[0]) / (SHORE_O[SHORE_O.length - 1] - SHORE_O[0]));   // canvas y of a shore offset
  const yWet = vy(0.35), yDry = vy(1.7), yFade0 = vy(2.4), yFade1 = vy(3.9);
  const grd = g.createLinearGradient(0, H, 0, 0);
  grd.addColorStop(0, '#221e18'); grd.addColorStop(1 - yWet / H, '#2c271f'); grd.addColorStop(1 - yDry / H, '#5a5244'); grd.addColorStop(1, '#5e5546');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    const x = r() * W, y = yFade0 - 30 + r() * (H - yFade0 + 30), wet = y > yWet, s = 1 + r() * (r() < 0.15 ? 5 : 2.4), v = r();
    if (y < yDry && r() < 0.5) continue;                                             // sparser up the bank
    g.fillStyle = wet ? (v < 0.5 ? '#3a352c' : v < 0.85 ? '#4a443a' : '#5e574a') : (v < 0.4 ? '#7a7264' : v < 0.8 ? '#8e8676' : '#655d50');
    for (const off of [-W, 0, W]) { g.beginPath(); g.ellipse(x + off, y, s * 1.3, s, r() * 3, 0, 7); g.fill(); }
    if (wet && s > 2.2) { g.fillStyle = 'rgba(200,210,220,0.18)'; g.beginPath(); g.ellipse(x - s * 0.3, y - s * 0.3, s * 0.4, s * 0.25, 0, 0, 7); g.fill(); }   // wet glint
  }
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let x = 0; x < W; x++) {
    const u = x / W, e0 = yFade0 + 8 * pn(u, 4, 0.5) + 5 * pn(u, 9, 2.2), e1 = yFade1 + 6 * pn(u, 5, 1.2) + 4 * pn(u, 12, 0.7);
    for (let y = 0; y < H; y++) { const i = (y * W + x) * 4; d[i + 3] = 255 * (y >= e0 ? 1 : y <= e1 ? 0 : (y - e1) / (e0 - e1)) * (r() < 0.12 && y < e0 + 6 ? 0.5 : 1); }
  }
  g.putImageData(img, 0, 0);
  return ctex(c, RepeatWrapping, ClampToEdgeWrapping);
}
// Reeds 256: tapered blades (dark green to straw tips) and a few bulrush heads, alpha-cut.
function reedTexture() {
  const [c, g] = canvas(256), r = rng(88);
  for (let i = 0; i < 46; i++) {
    const x0 = 40 + r() * 176, lean = (r() - 0.5) * 60, top = 10 + r() * 80, w = 2 + r() * 3.5, v = r();
    const grd = g.createLinearGradient(0, 256, 0, top); grd.addColorStop(0, '#2a3a1e'); grd.addColorStop(0.6, v < 0.5 ? '#4e6a30' : '#5a6e36'); grd.addColorStop(1, v < 0.3 ? '#9a8a54' : '#6e7a40');
    g.fillStyle = grd; g.beginPath(); g.moveTo(x0 - w, 256); g.quadraticCurveTo(x0 + lean * 0.3, (256 + top) / 2, x0 + lean, top); g.quadraticCurveTo(x0 + lean * 0.3 + w * 0.6, (256 + top) / 2, x0 + w, 256); g.fill();
  }
  for (let i = 0; i < 6; i++) {
    const x = 60 + r() * 136, y = 20 + r() * 50;
    g.strokeStyle = '#4a5a2c'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 256); g.lineTo(x + (r() - 0.5) * 10, y); g.stroke();
    g.fillStyle = '#4a3020'; g.beginPath(); g.ellipse(x, y + 12, 4.5, 14, 0, 0, 7); g.fill();
  }
  return ctex(c, ClampToEdgeWrapping, ClampToEdgeWrapping);
}
function blobTexture() {
  const [c, g] = canvas(64), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return ctex(c, ClampToEdgeWrapping, ClampToEdgeWrapping);
}

// ---------------------------------------------------------------------------------------------
// triangle counts of the shared geometries (for the debug handle and the report)
const trisOf = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
export function natureGeometries(plan, heightAt, WT = 1.6) {
  return {
    broadleaf: broadleafGeo(), fir: firGeo(6, 9, 16, 3.4, 2.9, 1), far: farGeo(), boulder: boulderGeo(), reed: reedGeo(),
    blob: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), path: pathGeo(plan, heightAt), shore: shoreGeo(plan, heightAt),
    jetty: jettyGeo(plan, heightAt, WT), boat: boatGeo(plan, WT),
  };
}
export function natureBudget(plan, G) {
  const nT = (k, low) => plan.byKind[k].filter(t => !low || t.low).length;
  const out = { low: {}, high: {} };
  for (const low of [false, true]) {
    const o = low ? out.low : out.high;
    o.broadleaf = nT('broadleaf', low) * trisOf(G.broadleaf); o.fir = nT('fir', low) * trisOf(G.fir); o.far = nT('far', low) * trisOf(G.far);
    o.blobs = (nT('broadleaf', low) + nT('fir', low) + nT('far', low)) * trisOf(G.blob);
    o.path = trisOf(G.path); o.shore = trisOf(G.shore); o.reeds = low ? 0 : plan.reeds.length * trisOf(G.reed);
    o.boulders = plan.boulders.length * trisOf(G.boulder); o.jetty = trisOf(G.jetty); o.boat = trisOf(G.boat);
    o.total = Object.values(o).reduce((a, b) => a + b, 0);
    o.drawCalls = low ? 9 : 10;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Build it all. Returns { group, groundAt, update, setTier, setTime, stats, ... }.
export function buildNature({ scene, heightAt, colliders }) {
  const plan = planNature(heightAt), W = WORLD.waterLevel;
  const root = new Group(); root.name = 'grounds-nature';
  const lakeSet = new Group(); lakeSet.name = 'nature-lake'; root.add(lakeSet);
  const wood = woodMaterial(0xd8ccc0, 'nature-jetty'), WT = 1.6 * (wood.userData.rep || 1);
  const G = natureGeometries(plan, heightAt, WT);

  // ---- materials ----
  const atlas = atlasTexture();
  const treeMat = new MeshStandardMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5, side: DoubleSide, roughness: 0.92 }); treeMat.name = 'nature-trees';
  const pathMat = new MeshStandardMaterial({ map: pathTexture(), transparent: true, depthWrite: false, roughness: 0.97, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); pathMat.name = 'nature-path';
  const shoreMat = new MeshStandardMaterial({ map: shoreTexture(), transparent: true, depthWrite: false, roughness: 0.62, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); shoreMat.name = 'nature-shore';
  const reedMat = new MeshStandardMaterial({ map: reedTexture(), alphaTest: 0.5, side: DoubleSide, roughness: 0.9 }); reedMat.name = 'nature-reeds';
  const blobMat = new MeshBasicMaterial({ map: blobTexture(), color: 0x0c140a, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }); blobMat.name = 'nature-blob';
  const boatMat = woodMaterial(0xc4b4a0, 'nature-boat'); boatMat.side = DoubleSide;

  const mesh = (geo, mat, name, parent = root, order = 0) => { const m = new Mesh(geo, mat); m.name = name; m.receiveShadow = true; m.castShadow = false; m.renderOrder = order; m.raycast = noRaycast; parent.add(m); return m; };
  mesh(G.path, pathMat, 'nature-paths', root, 1);
  mesh(G.shore, shoreMat, 'nature-shore', lakeSet, 1);
  mesh(G.jetty, wood, 'nature-jetty', lakeSet);
  const boat = mesh(G.boat, boatMat, 'nature-boat', lakeSet);
  boat.position.set(plan.boat.x, W, plan.boat.z); boat.rotation.y = -plan.boat.yaw;

  // ---- instanced sets ----
  const dum = new Object3D(), col = new Color(), up = new Vector3(0, 1, 0), nv = new Vector3(), q = new Quaternion(), e = new Euler();
  const inst = (geo, mat, n, name, parent = root, order = 0) => { const m = new InstancedMesh(geo, mat, Math.max(1, n)); m.name = name; m.count = n; m.castShadow = false; m.receiveShadow = true; m.renderOrder = order; m.raycast = noRaycast; parent.add(m); return m; };
  const trees = {}, lowCount = {};
  for (const k of ['broadleaf', 'fir', 'far']) {
    const list = plan.byKind[k], m = inst(G[k], treeMat, list.length, 'nature-' + k);
    list.forEach((t, i) => {
      dum.position.set(t.x, meshHeight(heightAt, t.x, t.z) - 0.18, t.z); dum.rotation.set(t.lx, t.rot, t.lz, 'YXZ'); dum.scale.setScalar(t.s); dum.updateMatrix(); m.setMatrixAt(i, dum.matrix);
      col.setHex(KINDS[k].greens[t.green]).multiplyScalar(t.shade); m.setColorAt(i, col);
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere();
    trees[k] = m; lowCount[k] = list.filter(t => t.low).length;
  }
  // blobs: the LOW half of every kind first, then the rest (so LOW = a prefix)
  const allT = [...['broadleaf', 'fir', 'far'].flatMap(k => plan.byKind[k].filter(t => t.low)), ...['broadleaf', 'fir', 'far'].flatMap(k => plan.byKind[k].filter(t => !t.low))];
  const blobs = inst(G.blob, blobMat, allT.length, 'nature-blobs', root, 2), blobLow = allT.filter(t => t.low).length;
  allT.forEach((t, i) => {
    const y = meshHeight(heightAt, t.x, t.z) + 0.06, gx = heightAt(t.x + 1, t.z) - heightAt(t.x - 1, t.z), gz = heightAt(t.x, t.z + 1) - heightAt(t.x, t.z - 1);
    nv.set(-gx / 2, 1, -gz / 2).normalize(); q.setFromUnitVectors(up, nv);
    dum.position.set(t.x + 0.6, y, t.z + 0.4); dum.quaternion.copy(q).multiply(new Quaternion().setFromEuler(e.set(0, t.rot, 0))); const R = KINDS[t.kind].blob * t.s * 2; dum.scale.set(R, 1, R * 0.9); dum.updateMatrix();
    blobs.setMatrixAt(i, dum.matrix);
  });
  blobs.instanceMatrix.needsUpdate = true; blobs.computeBoundingSphere();
  // reeds + boulders (lake set)
  const reeds = inst(G.reed, reedMat, plan.reeds.length, 'nature-reeds', lakeSet);
  plan.reeds.forEach((rd, i) => { dum.position.set(rd.x, rd.y - 0.1, rd.z); dum.rotation.set(0, rd.rot, 0); dum.scale.set(rd.s, rd.s * (0.9 + (i % 3) * 0.1), rd.s); dum.updateMatrix(); reeds.setMatrixAt(i, dum.matrix); });
  reeds.instanceMatrix.needsUpdate = true; reeds.computeBoundingSphere();
  const rocks = inst(G.boulder, treeMat, plan.boulders.length, 'nature-boulders', lakeSet);
  plan.boulders.forEach((b, i) => {
    dum.position.set(b.x, b.y + b.s * (b.sq * 0.35), b.z); dum.rotation.set(b.tilt, b.rot, b.tilt * 0.5, 'YXZ'); dum.scale.set(b.s * 1.2, b.s * b.sq, b.s); dum.updateMatrix(); rocks.setMatrixAt(i, dum.matrix);
    col.setHex(b.wet ? 0x8a8a86 : i % 3 ? 0xd2cdc2 : 0xc4ccb4); rocks.setColorAt(i, col);
  });
  rocks.instanceMatrix.needsUpdate = true; if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true; rocks.computeBoundingSphere();

  // ---- colliders: trunks a child can reach, big dry boulders, the boat. LOW drops the hidden trees' ones. ----
  const mine = plan.colliders;
  let lowTier = false;
  function syncColliders() {
    if (!colliders) return;
    for (let i = colliders.length - 1; i >= 0; i--) if (colliders[i] && colliders[i].nature) colliders.splice(i, 1);
    for (const c of mine) if (!lowTier || c.low) colliders.push(c);
  }
  syncColliders();

  // ---- walkable jetty: the player's ground height (main.js hands this to the player + interiors) ----
  const J = plan.jetty;
  const groundAt = (x, z) => { const h = heightAt(x, z); return (x <= J.x0 + 0.2 && x >= J.x1 && Math.abs(z - J.z) <= J.hw + 0.05) ? Math.max(h, J.y) : h; };

  scene.add(root);
  const budget = natureBudget(plan, G);
  let t = 0, lakeOn = true;
  const counts = { broadleaf: plan.byKind.broadleaf.length, fir: plan.byKind.fir.length, far: plan.byKind.far.length, reeds: plan.reeds.length, boulders: plan.boulders.length };
  const api = {
    group: root, plan, groundAt, counts, budget, keepOuts: KEEP, jetty: J, boatSpot: plan.boat,
    get colliders() { return colliders ? colliders.filter(c => c && c.nature).length : 0; },
    get drawCalls() { let n = 0; root.traverse(o => { if (o.isMesh && o.visible && o.count !== 0) { let p = o, vis = true; while (p && p !== root) { if (!p.visible) vis = false; p = p.parent; } if (vis) n++; } }); return n; },
    update(dt, pos, inside) {
      if (inside || !pos) return;
      const d = Math.hypot(pos.x - LAKE.x, pos.z - LAKE.z), on = lakeOn ? d < LAKE_CULL + 10 : d < LAKE_CULL;
      if (on !== lakeOn) { lakeOn = on; lakeSet.visible = on; }
      if (on) { t += dt; boat.position.y = W + 0.025 * Math.sin(t * 1.1); boat.rotation.x = 0.02 * Math.sin(t * 0.9 + 0.6); boat.rotation.z = 0.012 * Math.sin(t * 0.7); }
    },
    setTier(tier) {
      lowTier = tier === 'low';
      for (const k of Object.keys(trees)) trees[k].count = lowTier ? lowCount[k] : plan.byKind[k].length;
      blobs.count = lowTier ? blobLow : allT.length;
      reeds.visible = !lowTier;
      syncColliders();
    },
    setTime(p, key) { blobMat.opacity = key === 'night' ? 0.26 : key === 'dusk' ? 0.34 : 0.5; },
    stats() { return { counts, tier: lowTier ? 'low' : 'high', drawCalls: api.drawCalls, colliders: api.colliders, budget, lakeSet: lakeOn, keepOuts: KEEP.length }; },
  };
  return api;
}
