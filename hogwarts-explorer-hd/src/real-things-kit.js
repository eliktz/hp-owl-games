// Batch 9 (spells on the castle's REAL things): build-time pieces for freecast-real-things.js.
// Everything goes into a room's liftables (liftables.js: one SkinnedMesh per material, one bone per piece) as
// noLift items, so a room pays nothing extra when it already has vertex-coloured liftables (+1 draw call when not).
//   Reparo:   a gently broken thing = a SET of pieces. Each piece is built where it sits MENDED; b9.fix carries
//             its broken offset (bp, room metres), broken rotation (br, euler) and scales (ms mended, bs broken:
//             0.001 = hidden, e.g. spilled sand vanishes when mended, loose pages fly back into the books).
//   Engorgio / Reducio: a dish on the Great Hall house tables (b9.grow; the bone scales about the plate's base).
//   Orchideous: an empty vase / trough (static) + its flowers (b9.bloom, hidden until the spell).
// All coordinates are room coordinates, axis aligned. No textures, no lights, nothing per frame here.
import { BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry, PlaneGeometry } from 'three';

const box = (w, h, d, x, y, z) => new BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (r0, r1, h, x, y, z, seg = 10) => new CylinderGeometry(r0, r1, h, seg).translate(x, y, z);

// one piece of a broken set
function piece(LF, set, pid, parts, pivot, fix, o = {}) {
  return LF.add(set + '-' + pid, { kind: 'broken', noLift: true, pivot, parts, h: o.h || 0.2, size: o.size || 0.3,
    b9: { fix: set, bp: fix.bp || [0, 0, 0], br: fix.br || [0, 0, 0], ms: fix.ms ?? 1, bs: fix.bs ?? 1, at: o.at || null, glow: o.glow || null, label: o.label || null } });
}
// a small static table (drawn with the pieces: no extra draw call)
function smallTable(LF, id, x, z, w = 0.8, d = 0.5, h = 0.78, hex = 0x4a2e1a) {
  const P = [[box(w, 0.05, d, x, h - 0.025, z), hex]];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push([box(0.05, h - 0.05, 0.05, x + sx * (w / 2 - 0.06), (h - 0.05) / 2, z + sz * (d / 2 - 0.06)), 0x3a2414]);
  LF.add(id, { kind: 'static', noLift: true, pivot: [x, 0, z], parts: P, h });
}

// ---- library: a toppled stack of books on the floor with loose pages ----
export function brokenBooks(LF, x, z) {
  const S = 'books', COL = [0x6a1e1e, 0x1f3b5e, 0x2c4a2a, 0x5a3a1e, 0x4a2a52], at = [x, 0.35, z];
  const scatter = [[0.42, 0.25, 0.4, 0], [-0.38, 0.32, -0.6, 0], [0.12, -0.42, 1.1, 0], [-0.1, 0.05, 0.25, 0.32], [0.55, -0.2, 2.0, 0]];
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const h = 0.07 + (i % 2) * 0.025, cy = y + h / 2;
    const parts = [[box(0.36, h, 0.26, x, cy, z), COL[i]], [box(0.34, h - 0.016, 0.235, x + 0.012, cy, z), 0xe9dcb8]];
    const [dx, dz, ry, tilt] = scatter[i];
    piece(LF, S, 'book' + i, parts, [x, cy, z], { bp: [dx, h / 2 + (tilt ? 0.05 : 0) - cy, dz], br: [0, ry, tilt] }, { at: i === 0 ? at : null, h: 0.4, size: 0.4, label: 'books' });
    y += h;
  }
  for (let k = 0; k < 5; k++) {   // loose pages: tucked inside the stack when mended (hidden), fanned on the floor when toppled
    const a = k * 1.3 + 0.4, r = 0.5 + (k % 3) * 0.18;
    piece(LF, S, 'page' + k, [[box(0.2, 0.004, 0.26, x, 0.2, z), k % 2 ? 0xf4ecd4 : 0xece2c4]], [x, 0.2, z], { bp: [Math.cos(a) * r, -0.196, Math.sin(a) * r], br: [0, a, 0], ms: 0.001 });
  }
}
// ---- common room: a small side table with a snapped leg, tilted onto its stump; its book slid off ----
export function brokenSideTable(LF, x, z) {
  const S = 'sidetable', W0 = 0x5a3820, h = 0.62, e = 0.22;
  const T = [[box(0.56, 0.04, 0.56, x, h - 0.02, z), W0], [box(0.5, 0.06, 0.5, x, h - 0.07, z), 0x4a2e18]];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1]]) T.push([box(0.045, h - 0.04, 0.045, x + sx * e, (h - 0.04) / 2, z + sz * e), 0x3a2414]);
  T.push([box(0.045, 0.3, 0.045, x + e, h - 0.04 - 0.15, z + e), 0x3a2414]);   // the upper half of the snapped leg stays on
  piece(LF, S, 'top', T, [x - e, 0, z - e], { bp: [0, 0, 0], br: [0.2, 0, -0.2] }, { at: [x, 0.5, z], h: 0.7, size: 0.5, label: 'table' });
  piece(LF, S, 'leg', [[box(0.045, 0.28, 0.045, x + e, 0.14, z + e), 0x3a2414]], [x + e, 0.14, z + e], { bp: [0.3, -0.117, 0.16], br: [0, 0.7, Math.PI / 2] });
  piece(LF, S, 'book', [[box(0.22, 0.045, 0.16, x - 0.05, h + 0.0225, z + 0.04), 0x7a1e22], [box(0.205, 0.03, 0.145, x - 0.04, h + 0.0225, z + 0.04), 0xe9dcb8]], [x - 0.05, h + 0.0225, z + 0.04],
    { bp: [0.42, -h, 0.42], br: [0, 0.9, 0] });
}
// ---- dungeon: a glass jar knocked over on a table, a few shards, a little spilled glow ----
export function brokenJar(LF, x, z) {
  const S = 'jar', H = 0.78;
  smallTable(LF, 'jar-table', x, z, 0.9, 0.55, H);
  for (const [dx, hex] of [[-0.3, 0x8a6aff], [0.28, 0xffd86a]]) LF.add('jar-side-' + dx, { kind: 'static', noLift: true, pivot: [x + dx, H, z - 0.1], parts: [[cyl(0.05, 0.05, 0.16, x + dx, H + 0.08, z - 0.1, 8), hex], [cyl(0.03, 0.03, 0.04, x + dx, H + 0.18, z - 0.1, 6), 0x8a6a40]] });
  piece(LF, S, 'jar', [[cyl(0.09, 0.08, 0.2, x, H + 0.1, z + 0.05, 12), 0xa8e0d0], [cyl(0.06, 0.06, 0.05, x, H + 0.225, z + 0.05, 10), 0x8a6a40], [cyl(0.091, 0.081, 0.07, x, H + 0.09, z + 0.05, 12), 0xe8dcb4]],
    [x, H, z + 0.05], { bp: [0.12, 0.085, 0.02], br: [0, 0.5, Math.PI / 2] }, { at: [x, H + 0.15, z + 0.05], h: 0.3, size: 0.3, glow: 0x7ef0a0, label: 'jar' });
  for (let k = 0; k < 3; k++) {
    const a = 0.6 + k * 1.6;
    piece(LF, S, 'shard' + k, [[new ConeGeometry(0.035, 0.07, 3).translate(x, H + 0.12, z + 0.05), 0xc8f0e4]], [x, H + 0.12, z + 0.05], { bp: [Math.cos(a) * 0.2 - 0.05, -0.1, Math.sin(a) * 0.14], br: [Math.PI / 2, a, 0], ms: 0.001 });
  }
  piece(LF, S, 'spill', [[cyl(0.2, 0.2, 0.006, x - 0.1, H + 0.004, z + 0.08, 14), 0x8af5b0]], [x - 0.1, H, z + 0.08], { ms: 0.001 });   // the glowing spill (+ drifting glow motes while broken)
  piece(LF, S, 'drip', [[cyl(0.14, 0.14, 0.004, x - 0.38, 0.003, z + 0.2, 12), 0x7ee8a4]], [x - 0.38, 0, z + 0.2], { ms: 0.001 });
}
// ---- classrooms: an hourglass knocked over, its top bulb off, sand spilled ----
export function brokenHourglass(LF, x, z) {
  const S = 'hourglass', H = 0.78, GOLD = 0xb98b2e, GL = 0xd8eef0;
  smallTable(LF, 'hourglass-table', x, z, 0.8, 0.5, H, 0x5a3a20);
  const F = [[cyl(0.13, 0.13, 0.03, x, H + 0.015, z, 12), GOLD], [cyl(0.13, 0.13, 0.03, x, H + 0.415, z, 12), GOLD]];
  for (let k = 0; k < 3; k++) { const a = k * 2.094; F.push([cyl(0.012, 0.012, 0.37, x + Math.cos(a) * 0.105, H + 0.215, z + Math.sin(a) * 0.105, 5), GOLD]); }
  F.push([new ConeGeometry(0.085, 0.18, 10).translate(x, H + 0.12, z), GL], [new ConeGeometry(0.06, 0.06, 10).translate(x, H + 0.06, z), 0xe8c878]);
  piece(LF, S, 'frame', F, [x, H, z], { bp: [0.05, 0.13, 0], br: [0, 0.4, Math.PI / 2] }, { at: [x, H + 0.25, z], h: 0.45, size: 0.3, label: 'hourglass' });
  piece(LF, S, 'bulb', [[new ConeGeometry(0.085, 0.18, 10).rotateX(Math.PI).translate(x, H + 0.3, z), GL], [new ConeGeometry(0.05, 0.05, 10).rotateX(Math.PI).translate(x, H + 0.37, z), 0xe8c878]],
    [x, H + 0.3, z], { bp: [-0.26, -0.215, 0.1], br: [1.4, 0, 0.3] });
  piece(LF, S, 'sand', [[cyl(0.16, 0.18, 0.012, x - 0.12, H + 0.006, z + 0.06, 12), 0xe8c878]], [x - 0.12, H, z + 0.06], { ms: 0.001 });
  for (let k = 0; k < 2; k++) piece(LF, S, 'shard' + k, [[new ConeGeometry(0.03, 0.06, 3).translate(x, H + 0.21, z), 0xe8f6f8]], [x, H + 0.21, z], { bp: [0.15 - k * 0.32, -0.2, 0.15], br: [Math.PI / 2, k * 2, 0], ms: 0.001 });
}
// ---- the forgotten classroom: a desk under its dust sheet, slumped on a broken leg ----
export function brokenSheetDesk(LF, x, z, w, d, h, SHEET, SHEET2) {
  const S = 'desk', P = [[box(w + 0.08, 0.05, d + 0.08, x, h, z), SHEET]];
  for (const sz of [-1, 1]) P.push([box(w + 0.1, h - 0.15, 0.02, x, (h + 0.15) / 2 - 0.02, z + sz * (d / 2 + 0.05)), SHEET2]);
  for (const sx of [-1, 1]) P.push([box(0.02, h - 0.2, d + 0.1, x + sx * (w / 2 + 0.05), (h + 0.2) / 2 - 0.02, z), SHEET2]);
  for (let k = 0; k < 3; k++) P.push([cyl(0.025, 0.04, h - 0.2, x - w / 2 + 0.2 + k * (w - 0.4) / 2, (h - 0.2) / 2 + 0.06, z + d / 2 + 0.06, 5), SHEET]);
  piece(LF, S, 'desk', P, [x - w / 2, 0, z - d / 2], { br: [0.13, 0, -0.1] }, { at: [x, 0.6, z], h: 0.8, size: 0.6, label: 'desk' });
  piece(LF, S, 'leg', [[box(0.05, 0.42, 0.05, x + w / 2 - 0.1, 0.21, z + d / 2 - 0.1), 0x4a2e18]], [x + w / 2 - 0.1, 0.21, z + d / 2 - 0.1], { bp: [0.42, -0.185, 0.36], br: [0, 0.5, Math.PI / 2] });
}
// ---- the glasshouse: one cracked pane (three panes of glass in the side wall) + shards on the ground ----
// lx = the wall plane (local x, outside face), z0 / y0 = the pane centre, side = +1 / -1 (outward along x)
export function brokenPane(LF, lx, z0, y0, side, ground = 0) {
  const S = 'pane', GL = 0xcfe8e0, w = 0.5, h = 0.62;
  const tri = (pts) => { const g = new PlaneGeometry(1, 1, 1, 1); const p = g.attributes.position;   // a flat triangle (degenerate quad) in the wall plane
    p.setXYZ(0, lx, pts[0][1], pts[0][0]); p.setXYZ(1, lx, pts[1][1], pts[1][0]); p.setXYZ(2, lx, pts[2][1], pts[2][0]); p.setXYZ(3, lx, pts[2][1], pts[2][0]); g.computeVertexNormals(); return g; };
  const c = [[z0 - w / 2, y0 - h / 2], [z0 + w / 2, y0 - h / 2], [z0 + w / 2, y0 + h / 2], [z0 - w / 2, y0 + h / 2], [z0 + 0.04, y0 + 0.02]];
  const shards = [[c[0], c[1], c[4]], [c[1], c[2], c[4]], [c[2], c[3], c[4]], [c[3], c[0], c[4]]];
  shards.forEach((t, k) => {
    const cz = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    const g0 = tri(t), g1 = tri([t[0], t[2], t[1]]);   // both faces
    const fall = k !== 2;   // one shard stays in the frame, a little askew
    piece(LF, S, 'glass' + k, [[g0, GL], [g1, GL]], [lx, cy, cz],
      fall ? { bp: [side * (0.35 + k * 0.18), ground + 0.03 - cy, (k - 1.5) * 0.3], br: [0, 0, side * (Math.PI / 2 - 0.15)] } : { bp: [side * 0.03, -0.02, 0], br: [0.12, 0, side * 0.1] },
      { at: k === 0 ? [lx + side * 0.3, y0, z0] : null, h: 0.6, size: 0.4, label: 'pane' });
  });
  for (let k = 0; k < 3; k++) piece(LF, S, 'bit' + k, [[new ConeGeometry(0.03, 0.05, 3).translate(lx, y0, z0), 0xe0f4ee]], [lx, y0, z0], { bp: [side * (0.25 + k * 0.2), ground + 0.02 - y0, 0.25 - k * 0.22], br: [Math.PI / 2, k, 0], ms: 0.001 });
}

// ---- Great Hall house-table dishes (Engorgio / Reducio): each on its own little gold plate ----
export function dish(LF, id, kind, x, y, z) {
  const P = [[cyl(0.2, 0.17, 0.025, x, y + 0.0125, z, 14), 0xd8b04a]];
  if (kind === 'roast') {
    P.push([new SphereGeometry(0.15, 10, 7).scale(1.25, 0.62, 0.9).translate(x, y + 0.1, z), 0x8a4a22], [new SphereGeometry(0.1, 8, 6).scale(1.2, 0.5, 0.9).translate(x - 0.02, y + 0.16, z), 0xa85a2a]);
    for (const s of [-1, 1]) P.push([cyl(0.015, 0.015, 0.1, x + s * 0.2, y + 0.1, z, 5).rotateZ(0), 0xf2ead8]);
    for (const [dx, dz, hex] of [[0.12, 0.12, 0x6ab04a], [-0.13, -0.12, 0xe0802a], [0.14, -0.1, 0x6ab04a]]) P.push([new SphereGeometry(0.035, 6, 4).translate(x + dx, y + 0.045, z + dz), hex]);
  } else if (kind === 'pie') {
    P.push([cyl(0.16, 0.14, 0.08, x, y + 0.065, z, 14), 0xc88a3a], [cyl(0.155, 0.16, 0.025, x, y + 0.115, z, 14), 0xe0aa52]);
    for (let k = -1; k <= 1; k++) { P.push([box(0.3, 0.012, 0.025, x, y + 0.132, z + k * 0.07), 0xb87a2e], [box(0.025, 0.012, 0.3, x + k * 0.07, y + 0.134, z), 0xb87a2e]); }
  } else if (kind === 'jelly') {
    P.push([cyl(0.13, 0.15, 0.1, x, y + 0.075, z, 14), 0xd8304a], [cyl(0.09, 0.13, 0.08, x, y + 0.165, z, 14), 0xe84a62], [new SphereGeometry(0.09, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y + 0.205, z), 0xf06a7a], [new SphereGeometry(0.03, 6, 4).translate(x, y + 0.3, z), 0xc8102a]);
  } else if (kind === 'fruit') {
    P.push([new SphereGeometry(0.17, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(x, y + 0.16, z), 0xd8b04a]);
    for (const [dx, dy, dz, hex] of [[0, 0.17, 0, 0xd83a2a], [0.08, 0.15, 0.05, 0xf0c030], [-0.08, 0.15, 0.04, 0x7ab83a], [0.02, 0.15, -0.09, 0xe8802a], [-0.04, 0.24, -0.02, 0x8a3ab0], [0.06, 0.23, -0.03, 0xd83a2a]]) P.push([new SphereGeometry(0.055, 8, 6).translate(x + dx, y + dy, z + dz), hex]);
  } else if (kind === 'pudding') {
    P.push([new SphereGeometry(0.14, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.1, 1).translate(x, y + 0.025, z), 0x5a2a18], [new SphereGeometry(0.1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 3).translate(x, y + 0.075, z), 0xf4ecd8], [new SphereGeometry(0.025, 6, 4).translate(x, y + 0.18, z), 0xc8102a]);
  } else {   // cake
    P.push([cyl(0.14, 0.14, 0.09, x, y + 0.07, z, 14), 0xf0b8c8], [cyl(0.1, 0.1, 0.07, x, y + 0.15, z, 14), 0xf8e0e8], [cyl(0.142, 0.142, 0.015, x, y + 0.1, z, 14), 0xfff4e0]);
    for (let k = 0; k < 6; k++) { const a = k * 1.047; P.push([new SphereGeometry(0.018, 5, 3).translate(x + Math.cos(a) * 0.08, y + 0.195, z + Math.sin(a) * 0.08), 0xd8304a]); }
  }
  return LF.add(id, { kind: 'dish-' + kind, noLift: true, pivot: [x, y, z], parts: P, h: 0.3, size: 0.25, b9: { grow: true, jelly: kind === 'jelly', label: kind } });
}

// ---- Orchideous: an empty vase (static) and its flowers (hidden until the spell) ----
const FLOWERS = [0xff5a8a, 0xffd040, 0xa86adf, 0xff7a3a, 0xfff4e0, 0x5aa8ff, 0xff9ad8];
function flowerParts(x, y, z, n = 7, spread = 0.06, tall = 0.3) {
  const P = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, r = i === 0 ? 0 : spread * (0.7 + (i % 2) * 0.5), hh = tall + ((i * 7) % 5) * 0.02, tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r;
    const st = new CylinderGeometry(0.006, 0.008, hh, 4); st.translate(0, hh / 2, 0); st.rotateZ(-Math.cos(a) * r * 1.5); st.rotateX(Math.sin(a) * r * 1.5); st.translate(x, y, z); P.push([st, 0x3a8a2a]);
    const fx = x + Math.cos(a) * r * 1.6, fz = z + Math.sin(a) * r * 1.6, fy = y + hh;
    for (let k = 0; k < 5; k++) { const b = k * 1.2566 + a; P.push([new SphereGeometry(0.03, 5, 3).scale(1.3, 0.4, 0.8).rotateY(-b).translate(fx + Math.cos(b) * 0.032, fy, fz + Math.sin(b) * 0.032), FLOWERS[i % FLOWERS.length]]); }
    P.push([new SphereGeometry(0.022, 5, 4).translate(fx, fy + 0.005, fz), 0xffd23f]);
    if (i % 2) P.push([new SphereGeometry(0.035, 5, 3).scale(1, 0.25, 0.5).rotateY(a).translate((x + tx) / 2 + 0.02, y + hh * 0.45, (z + tz) / 2), 0x4a9a34]);
  }
  return P;
}
export function emptyVase(LF, id, x, y, z, hex = 0x4a6ab0) {
  LF.add(id + '-vase', { kind: 'vase', noLift: true, pivot: [x, y, z], h: 0.26, parts: [[cyl(0.06, 0.05, 0.03, x, y + 0.015, z, 10), 0xd8b04a], [new SphereGeometry(0.085, 10, 8).scale(1, 1.1, 1).translate(x, y + 0.11, z), hex], [cyl(0.04, 0.055, 0.1, x, y + 0.22, z, 10), hex], [cyl(0.055, 0.055, 0.015, x, y + 0.27, z, 10), 0xd8b04a]] });
  return LF.add(id, { kind: 'flowers', noLift: true, pivot: [x, y + 0.24, z], parts: flowerParts(x, y + 0.24, z), h: 0.4, size: 0.3, b9: { bloom: true, label: 'vase' } });
}
export function emptyTrough(LF, id, x, y, z, along = 'z') {
  const L = 0.95, Wd = 0.34, H = 0.32, bx = (w, h, d, px, py, pz) => (along === 'z' ? box(w, h, d, px, py, pz) : box(d, h, w, pz - z + x, py, px - x + z));
  LF.add(id + '-trough', { kind: 'trough', noLift: true, pivot: [x, y, z], h: H, parts: [[bx(Wd, H, L, x, y + H / 2, z), 0x6a4426], [bx(Wd - 0.06, 0.02, L - 0.06, x, y + H - 0.03, z), 0x3a2414], [bx(Wd + 0.03, 0.04, L + 0.03, x, y + H, z), 0x5a3a20]] });
  const P = [];
  for (const k of [-0.3, 0, 0.3]) P.push(...flowerParts(along === 'z' ? x : x + k, y + H - 0.03, along === 'z' ? z + k : z, 5, 0.05, 0.26));
  return LF.add(id, { kind: 'flowers', noLift: true, pivot: [x, y + H - 0.03, z], parts: P, h: 0.35, size: 0.5, b9: { bloom: true, label: 'trough' } });
}
