// Hogsmeade milestone 4: Zonko's Joke Shop inside ('b3zonko'; briefs/2026-11-28-hogsmeade-m4-decisions.md). Room frame:
// x -4.5..4.5, z -3.5..3.5, ceiling 3.4, the street door at x -2.6 in the wall z -3.5. The code-built room (one merged
// vertex-colour mesh + one glow mesh) is the fallback and stays until hm_zonko_int_01.glb has loaded. The toys: hogsmeade-zonko-toys.js.
import { Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, ShapeGeometry, Shape, MeshStandardMaterial, MeshBasicMaterial } from 'three';
import { place, paint, merge } from './adventure-b3-map-build.js';
import { registerShop } from './hogsmeade-shop.js';
import { signStar } from './hogsmeade-signs.js';
import { attachToys, tickToys, toyTaps, toyState, dropToys } from './hogsmeade-zonko-toys.js';

export const ZONKO_NAME = 'חנות התעלולים של זונקו';
const F = { x0: -4.5, x1: 4.5, z0: -3.5, z1: 3.5, h: 3.4 };
const DOOR = { x: -2.6, w: 1.1, h: 2.2 };
const WIN = { x0: 0.2, x1: 3.6, y0: 0.9, y1: 2.6 };
const ORANGE = 0xd8743a, PURPLE = 0x6a3a8a, CREAM = 0xd8c8a0, OAK = 0x6a4228, OAK_D = 0x4a2e1a, YEL = 0xe0b830, BRASS = 0xc8a04e;
const TOYC = [0xd8402a, 0x2a7ad8, 0xe0b830, 0x3aa84a, 0xd84a9a, 0x8a4ad8, 0xe07a2a, 0x2ab8b0];
const LANTERNS = [[-2, 3.0, 0], [2, 3.0, 0], [0, 3.0, 2.2]];

function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const box = (P, w, h, d, x, y, z, c, ry = 0) => P.push(paint(place(new BoxGeometry(w, h, d), x, y, z, 0, ry, 0), c));
const cyl = (P, r0, r1, h, x, y, z, c, seg = 16) => P.push(paint(place(new CylinderGeometry(r0, r1, h, seg), x, y, z), c));
function starGeo(r) { const s = new Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return new ShapeGeometry(s); }
// a wall with holes: the wall along x (z fixed) built from boxes round the openings [{x0, x1, y0, y1}]
function wallX(P, z, holes, d, colLow, colHigh) {
  const xs = [F.x0, ...holes.flatMap(h => [h.x0, h.x1]), F.x1];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], w = b - a; if (w <= 0.01) continue;
    const hole = i % 2 === 1 ? holes[(i - 1) / 2] : null, mx = (a + b) / 2;
    const seg = hole ? [[0, hole.y0], [hole.y1, F.h]] : [[0, F.h]];
    for (const [y0, y1] of seg) {
      if (y1 - y0 < 0.01) continue;
      const lo = Math.min(y1, 1.0); if (lo > y0) box(P, w, lo - y0, d, mx, (y0 + lo) / 2, z, colLow);
      const hi0 = Math.max(y0, 1.0); if (y1 > hi0) box(P, w, y1 - hi0, d, mx, (hi0 + y1) / 2, z, colHigh);
    }
  }
}
function fallback(g) {
  const P = [], E = [], R = rnd(7);
  // the floor: orange / cream planks along z
  for (let i = 0; i < 18; i++) box(P, 0.5, 0.04, 7, F.x0 + 0.25 + i * 0.5, -0.02, 0, i % 2 ? CREAM : 0xc8783a);
  // walls: purple wainscot to 1.0, orange above; the door wall has the door and the big window
  wallX(P, F.z0 - 0.05, [{ x0: DOOR.x - DOOR.w / 2, x1: DOOR.x + DOOR.w / 2, y0: 0, y1: DOOR.h }, { x0: WIN.x0, x1: WIN.x1, y0: WIN.y0, y1: WIN.y1 }], 0.1, PURPLE, ORANGE);
  wallX(P, F.z1 + 0.05, [], 0.1, PURPLE, ORANGE);
  for (const x of [F.x0 - 0.05, F.x1 + 0.05]) { box(P, 0.1, 1.0, 7, x, 0.5, 0, PURPLE); box(P, 0.1, F.h - 1, 7, x, 1 + (F.h - 1) / 2, 0, ORANGE); }
  box(P, 9, 0.06, 7, 0, F.h + 0.03, 0, 0xc89a6a);   // the ceiling
  for (const z of [-2.2, 0, 2.2]) box(P, 9, 0.2, 0.18, 0, F.h - 0.1, z, OAK_D);   // beams
  box(P, 9, 0.06, 0.04, 0, 1.02, F.z1 - 0.02, YEL); box(P, 0.04, 0.06, 7, F.x1 - 0.02, 1.02, 0, YEL);   // a yellow rail on the wainscot
  // yellow star stencils on the orange walls
  for (let i = 0; i < 9; i++) { P.push(paint(place(starGeo(0.12 + R() * 0.06), -3.6 + i * 0.9, 1.5 + R() * 1.4, F.z1 - 0.005, 0, Math.PI, 0), YEL)); }
  for (let i = 0; i < 6; i++) P.push(paint(place(starGeo(0.13), F.x1 - 0.005, 1.4 + R() * 1.6, -3.0 + i * 1.1, 0, -Math.PI / 2, 0), YEL));
  // the door (oak, a little window) and the window frame with a display shelf
  box(P, DOOR.w, DOOR.h, 0.06, DOOR.x, DOOR.h / 2, F.z0 + 0.0, OAK); box(P, DOOR.w + 0.16, 0.12, 0.12, DOOR.x, DOOR.h + 0.06, F.z0, OAK_D);
  box(P, 0.08, 0.08, 0.06, DOOR.x + 0.4, 1.0, F.z0 + 0.06, BRASS);
  for (const x of [WIN.x0, (WIN.x0 + WIN.x1) / 2, WIN.x1]) box(P, 0.08, WIN.y1 - WIN.y0, 0.12, x, (WIN.y0 + WIN.y1) / 2, F.z0, OAK_D);
  for (const y of [WIN.y0, (WIN.y0 + WIN.y1) / 2, WIN.y1]) box(P, WIN.x1 - WIN.x0, 0.08, 0.12, (WIN.x0 + WIN.x1) / 2, y, F.z0, OAK_D);
  box(P, WIN.x1 - WIN.x0, 0.06, 0.4, (WIN.x0 + WIN.x1) / 2, WIN.y0 - 0.03, F.z0 + 0.2, OAK);
  for (let i = 0; i < 5; i++) box(P, 0.22, 0.22, 0.22, WIN.x0 + 0.4 + i * 0.65, WIN.y0 + 0.11, F.z0 + 0.2, TOYC[i], R());
  E.push(paint(place(new BoxGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0, 0.02), (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, F.z0 - 0.02), 0xf0c890));   // frosted warm panes
  // shelves full of toys: west wall (x -4.25, z -2.2..3.2) and north wall (z 3.25, x -4.2..4.2)
  const shelf = (alongZ, a0, a1, c) => {
    const L = a1 - a0, m = (a0 + a1) / 2;
    const at = (u, y, w, h, d, col, ry = 0) => alongZ ? box(P, d, h, w, c, y, u, col, ry) : box(P, w, h, d, u, y, c, col, ry);
    for (const y of [0.9, 1.5, 2.1]) at(m, y - 0.02, L, 0.04, 0.5, OAK);
    at(m, 0.45, L, 0.9, 0.46, PURPLE); at(m, 2.5, L, 0.04, 0.5, OAK);
    for (let u = a0; u <= a1 + 0.01; u += L / Math.round(L / 1.4)) at(u, 1.25, 0.05, 2.5, 0.5, OAK_D);
    for (const y of [0.9, 1.5, 2.1]) for (let u = a0 + 0.2; u < a1 - 0.15; u += 0.28 + R() * 0.18) {
      const k = R(), col = TOYC[(R() * TOYC.length) | 0], s = 0.14 + R() * 0.12;
      if (k < 0.5) at(u, y + s / 2, s, s, s * 0.9, col, R() * 0.4);
      else { const o = alongZ ? [c, y + s / 2, u] : [u, y + s / 2, c]; P.push(paint(place(new SphereGeometry(s / 2, 8, 6), ...o), col)); }
    }
  };
  shelf(true, -2.2, 3.2, -4.25); shelf(false, -4.2, 4.2, 3.25);
  // the counter: purple with yellow stars, an oak top at 1.05, a brass bell (the top at z 0.4 stays free for the spinning top)
  box(P, 1.1, 1.0, 3.0, 3.3, 0.5, -0.6, PURPLE); box(P, 1.2, 0.05, 3.1, 3.3, 1.025, -0.6, OAK);
  for (let i = 0; i < 4; i++) P.push(paint(place(starGeo(0.12), 2.745, 0.55, -1.7 + i * 0.75, 0, -Math.PI / 2, 0), YEL));
  cyl(P, 0.06, 0.09, 0.1, 3.5, 1.1, -1.6, BRASS, 10); P.push(paint(place(new SphereGeometry(0.02, 6, 4), 3.5, 1.17, -1.6), BRASS));
  // display tables A, B and the pedestal (their tops stay free: the toys go there)
  for (const [x, z] of [[-1.9, 1.3], [1.0, 1.6]]) { cyl(P, 0.6, 0.6, 0.05, x, 0.725, z, OAK, 20); cyl(P, 0.07, 0.09, 0.7, x, 0.35, z, OAK_D, 8); cyl(P, 0.35, 0.4, 0.04, x, 0.02, z, OAK_D, 14); cyl(P, 0.61, 0.61, 0.03, x, 0.69, z, PURPLE, 20); }
  box(P, 0.5, 0.86, 0.5, -0.3, 0.43, -0.9, PURPLE); box(P, 0.56, 0.04, 0.56, -0.3, 0.88, -0.9, YEL);
  // bunting across the beams + paper lanterns (glow)
  for (const z of [-2.2, 0, 2.2]) for (let i = 0; i < 16; i++) { const x = F.x0 + 0.4 + i * 0.52, sag = Math.sin(Math.PI * i / 15) * 0.25; P.push(paint(place(new CylinderGeometry(0.12, 0.001, 0.22, 3), x, F.h - 0.38 - sag, z + 0.1, 0, 0.5, 0), TOYC[i % TOYC.length])); }
  for (const [x, y, z] of LANTERNS) { E.push(paint(place(new SphereGeometry(0.22, 12, 9), x, y, z, 0, 0, 0, 1, 1.25, 1), 0xffb060)); P.push(paint(place(new CylinderGeometry(0.008, 0.008, F.h - y - 0.2), x, (F.h + y) / 2 + 0.05, z), OAK_D)); }
  const m = new Mesh(merge(P), new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); m.name = 'zonko-room'; m.raycast = () => {};
  const e = new Mesh(merge(E), new MeshBasicMaterial({ vertexColors: true })); e.name = 'zonko-glow'; e.raycast = () => {};
  g.add(m, e);
}
const decoStars = (x, r) => { for (const [sx, sy, sr, col] of [[60, 50, 26, '#d4b42e'], [110, 112, 16, '#d4782a'], [r.w - 60, 50, 26, '#d4b42e'], [r.w - 110, 112, 16, '#d4782a']]) signStar(x, r.x + sx, r.y + sy, sr, col); };

registerShop({
  id: 'b3zonko', key: 'zonko', model: 'hm_zonko_int', node: 'Zonko_Interior', frame: F, door: DOOR,
  light: { amb: 0.92, ambC: 0xfff0dc, hemi: 0.8, sky: 0xfff4e8, ground: 0xa07a6a, fogC: 0xf6e4d0, fogD: 0.004, bg: 0xf0dcc4 },   // brighter and more colourful than Honeydukes
  cols: [{ type: 'box', x: -4.25, z: 0.5, hw: 0.25, hd: 2.7 }, { type: 'box', x: 0, z: 3.25, hw: 4.2, hd: 0.25 }, { type: 'box', x: 3.3, z: -0.6, hw: 0.55, hd: 1.5 },
    { type: 'circle', x: -1.9, z: 1.3, r: 0.65 }, { type: 'circle', x: 1.0, z: 1.6, r: 0.65 }, { type: 'circle', x: -0.3, z: -0.9, r: 0.4 }],
  cam: { yaw: 1.81, pitch: 0.32, dist: 3.0 },
  codeBuilt: ['zonko-room', 'zonko-glow'],
  fallback,
  signs: [{ text: ZONKO_NAME, w: 2.7, h: 0.62, x: F.x1 - 0.04, y: 2.62, z: -0.6, ry: -Math.PI / 2, base: '#40284a', dark: '#2a1a32', deco: decoStars, px: 84, pad: 250 }],
  attach: (R) => attachToys(R),
  tick: (R, dt, busy) => tickToys(R, dt, busy),
  taps: (R) => toyTaps(R),
  state: (R) => toyState(R),
  teardown: (R) => dropToys(R),
});
