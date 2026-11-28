// Hogsmeade milestone 4: the Three Broomsticks' code-built parts ('b3broom'; briefs/2026-11-28-hogsmeade-m4-decisions.md).
// Room frame x -6..6, z -4.5..4.5, ceiling 3.8, the street door at x 3.4 in the wall z -4.5. buildRoom: the fallback inn (one
// merged vertex-colour mesh + one glow mesh; hidden once hm_broom_int_01.glb is in); buildExtras: the tray of mugs (both states);
// buildFire: 3 flame cards (one instanced mesh), a glow card and a hearth-light card on the floor; buildRosmerta; buildMug; buildFoam.
import { Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry, PlaneGeometry, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial,
  AdditiveBlending, DoubleSide, Matrix4 } from 'three';
import { place, paint, merge, softTex } from './adventure-b3-map-build.js';
import { canvasTex } from './hogsmeade-shop.js';
import { buildChibi } from './chibi.js';

export const F = { x0: -6, x1: 6, z0: -4.5, z1: 4.5, h: 3.8 };
export const DOOR = { x: 3.4, w: 1.3, h: 2.3 };
export const FIRE = { x: -5.6, z: 0.5 };
const OAK = 0x5a3a22, OAK_L = 0x7a5434, PLASTER = 0xd8ccb0, STONE = 0x8a8070, STONE_D = 0x6a6258, SOOT = 0x2a2018, PEWTER = 0x9a9aa0, CREAM = 0xe6dcc4;
const box = (P, w, h, d, x, y, z, c) => P.push(paint(place(new BoxGeometry(w, h, d), x, y, z), c));
const cyl = (P, r0, r1, h, x, y, z, c, seg = 12, rx = 0, rz = 0) => P.push(paint(place(new CylinderGeometry(r0, r1, h, seg), x, y, z, rx, 0, rz), c));
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const mugAt = (P, x, y, z) => { cyl(P, 0.06, 0.055, 0.14, x, y + 0.07, z, PEWTER, 10); P.push(paint(place(new TorusGeometry(0.035, 0.01, 4, 8), x + 0.065, y + 0.075, z), PEWTER)); };

export function buildRoom(g) {
  const P = [], E = [], R = rnd(11);
  for (let i = 0; i < 24; i++) box(P, 0.5, 0.04, 9, F.x0 + 0.25 + i * 0.5, -0.02, 0, [OAK_L, 0x6e4a2e, 0x82603e][i % 3]);   // worn planks
  // walls: plaster with an oak skirting; the door wall has the door and two small-paned frosted windows
  const wins = [{ x0: -4.4, x1: -2.8 }, { x0: -1.4, x1: 0.2 }], WY0 = 1.0, WY1 = 2.3;
  const holes = [{ x0: DOOR.x - DOOR.w / 2, x1: DOOR.x + DOOR.w / 2, y0: 0, y1: DOOR.h }, ...wins.map(w => ({ ...w, y0: WY0, y1: WY1 }))].sort((a, b) => a.x0 - b.x0);
  let x = F.x0; for (const h of holes) { box(P, h.x0 - x, F.h, 0.12, (x + h.x0) / 2, F.h / 2, F.z0 - 0.06, PLASTER); if (h.y0 > 0) box(P, h.x1 - h.x0, h.y0, 0.12, (h.x0 + h.x1) / 2, h.y0 / 2, F.z0 - 0.06, PLASTER); box(P, h.x1 - h.x0, F.h - h.y1, 0.12, (h.x0 + h.x1) / 2, (h.y1 + F.h) / 2, F.z0 - 0.06, PLASTER); x = h.x1; }
  box(P, F.x1 - x, F.h, 0.12, (x + F.x1) / 2, F.h / 2, F.z0 - 0.06, PLASTER);
  box(P, 12, F.h, 0.12, 0, F.h / 2, F.z1 + 0.06, PLASTER); for (const sx of [F.x0 - 0.06, F.x1 + 0.06]) box(P, 0.12, F.h, 9, sx, F.h / 2, 0, PLASTER);
  box(P, 12, 0.18, 0.04, 0, 0.09, F.z1 - 0.02, OAK); box(P, 0.04, 0.18, 9, F.x1 - 0.02, 0.09, 0, OAK);
  for (const w of wins) { E.push(paint(place(new BoxGeometry(w.x1 - w.x0, WY1 - WY0, 0.02), (w.x0 + w.x1) / 2, (WY0 + WY1) / 2, F.z0 - 0.03), 0xe8b880));
    for (let k = 0; k <= 4; k++) box(P, 0.04, WY1 - WY0, 0.08, w.x0 + k * (w.x1 - w.x0) / 4, (WY0 + WY1) / 2, F.z0 + 0.01, OAK);
    for (let k = 0; k <= 3; k++) box(P, w.x1 - w.x0, 0.04, 0.08, (w.x0 + w.x1) / 2, WY0 + k * (WY1 - WY0) / 3, F.z0 + 0.01, OAK);
    box(P, w.x1 - w.x0 + 0.1, 0.06, 0.2, (w.x0 + w.x1) / 2, WY0 - 0.03, F.z0 + 0.08, OAK); }
  box(P, DOOR.w, DOOR.h, 0.06, DOOR.x, DOOR.h / 2, F.z0, 0x6a4228); box(P, DOOR.w + 0.2, 0.14, 0.14, DOOR.x, DOOR.h + 0.07, F.z0, OAK);
  // dark oak posts and beams, the ceiling
  for (let px = -6; px <= 6.01; px += 3) for (const pz of [F.z0 + 0.1, F.z1 - 0.1]) box(P, 0.22, F.h, 0.22, Math.max(-5.89, Math.min(5.89, px)), F.h / 2, pz, OAK);
  box(P, 12, 0.06, 9, 0, F.h + 0.03, 0, 0xcabca0); for (let bz = -3; bz <= 3.01; bz += 1.5) box(P, 12, 0.24, 0.22, 0, F.h - 0.12, bz, OAK);
  // the stone fireplace (west wall, centre z 0.5, 2.6 wide, opening 1.4 x 1.1), logs, the mantel, pewter mugs, three crossed brooms
  const fz = FIRE.z; box(P, 0.6, 1.1, 0.6, -5.7, 0.55, fz - 1.0, STONE); box(P, 0.6, 1.1, 0.6, -5.7, 0.55, fz + 1.0, STONE);
  box(P, 0.6, 0.5, 2.6, -5.7, 1.35, fz, STONE_D); box(P, 0.1, 1.1, 1.4, -5.97, 0.55, fz, SOOT); box(P, 0.7, 0.06, 2.4, -5.65, 0.03, fz, STONE_D);
  box(P, 0.4, F.h - 1.6, 2.0, -5.8, (F.h + 1.6) / 2, fz, STONE); box(P, 0.78, 0.1, 2.9, -5.62, 1.65, fz, OAK);
  for (let i = 0; i < 4; i++) mugAt(P, -5.5, 1.7, fz - 0.9 + i * 0.6);
  cyl(P, 0.08, 0.08, 0.8, -5.62, 0.12, fz - 0.05, 0x5a3a20, 8, 0.15, Math.PI / 2); cyl(P, 0.07, 0.07, 0.7, -5.66, 0.24, fz + 0.12, 0x4a3018, 8, -0.3, Math.PI / 2);
  for (const a of [-0.6, 0, 0.6]) { const r = new Matrix4().makeRotationX(a), mk = (geo, c) => { geo.applyMatrix4(r); geo.translate(-5.56, 2.6, fz); P.push(paint(geo, c)); };
    mk(new CylinderGeometry(0.02, 0.02, 1.3, 6), 0xa2744a); mk(new ConeGeometry(0.09, 0.32, 8).translate(0, -0.76, 0).rotateX(Math.PI), 0xc4a058); }
  // the bar (front z 2.6, x -2..5.2, top 1.1), back shelves at z 4.2, barrels
  box(P, 7.2, 1.05, 0.7, 1.6, 0.525, 2.95, OAK); box(P, 7.4, 0.06, 0.82, 1.6, 1.08, 2.95, OAK_L);
  for (let px = -1.6; px < 5.1; px += 0.6) box(P, 0.46, 0.7, 0.02, px + 0.3, 0.5, 2.595, 0x6a4628);
  box(P, 7.2, 2.6, 0.4, 1.6, 1.3, 4.3, OAK); for (const y of [1.2, 1.7, 2.2]) box(P, 7.2, 0.04, 0.45, 1.6, y, 4.08, OAK_L);
  for (const y of [1.22, 1.72, 2.22]) for (let px = -1.8; px < 5.0; px += 0.32 + R() * 0.12) { if (R() < 0.55) mugAt(P, px, y, 4.05); else { const c = [0x3a6a3a, 0xa8742a, 0x6a3a6a, 0x2a4a7a][(R() * 4) | 0]; cyl(P, 0.045, 0.045, 0.2, px, y + 0.1, 4.05, c, 8); cyl(P, 0.015, 0.02, 0.08, px, y + 0.24, 4.05, c, 6); } }
  for (const [bx, bz] of [[-1.55, 3.85], [4.85, 3.85], [4.85, 3.35]]) { cyl(P, 0.3, 0.3, 0.75, bx, 0.375, bz, 0x7a5434, 14); for (const y of [0.15, 0.6]) cyl(P, 0.31, 0.31, 0.04, bx, y, bz, 0x3a3030, 14); }
  // round tables with three stools each
  for (const [tx, tz] of [[-2.6, -1.6], [0.4, -2.4], [-3.2, 2.4], [1.6, 0.0]]) { cyl(P, 0.55, 0.55, 0.05, tx, 0.735, tz, OAK_L, 18); cyl(P, 0.06, 0.08, 0.72, tx, 0.36, tz, OAK, 8); cyl(P, 0.28, 0.32, 0.04, tx, 0.02, tz, OAK, 12);
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + tx, sx = tx + Math.cos(a) * 0.78, sz = tz + Math.sin(a) * 0.78; cyl(P, 0.17, 0.17, 0.05, sx, 0.45, sz, OAK_L, 10); cyl(P, 0.04, 0.05, 0.43, sx, 0.215, sz, OAK, 6); } }
  // the settle facing the fire, the rug, coat pegs, a notice board without writing, a broom rack
  box(P, 0.5, 0.08, 1.9, -5.45, 0.45, -2.7, OAK_L); box(P, 0.1, 1.45, 2.0, -5.83, 0.73, -2.7, OAK); for (const sz of [-3.65, -1.75]) box(P, 0.6, 0.95, 0.08, -5.55, 0.47, sz, OAK);   // (art director, 28 Nov) the settle by the west wall, south of the fire
  box(P, 1.7, 0.012, 3.2, -4.3, 0.006, 0.5, 0x8a2a22); box(P, 1.45, 0.014, 2.95, -4.3, 0.007, 0.5, 0xa8483a);
  for (let i = 0; i < 5; i++) { box(P, 0.03, 0.03, 0.14, 0.8 + i * 0.3, 1.7, F.z0 + 0.07, OAK); if (i % 2) box(P, 0.24, 0.6, 0.05, 0.8 + i * 0.3, 1.38, F.z0 + 0.1, [0x3a4a6a, 0x6a2a2a][i % 3 === 0 ? 1 : 0]); }
  box(P, 0.05, 0.9, 1.3, F.x1 - 0.03, 1.6, -1.5, 0x8a6a40); box(P, 0.02, 0.8, 1.2, F.x1 - 0.06, 1.6, -1.5, 0xb89a6a);
  for (let i = 0; i < 4; i++) box(P, 0.01, 0.2, 0.16, F.x1 - 0.075, 1.4 + (i % 2) * 0.35, -1.95 + i * 0.3, CREAM);
  box(P, 0.08, 0.06, 1.4, F.x1 - 0.06, 1.5, 1.4, OAK); for (let i = 0; i < 3; i++) { cyl(P, 0.018, 0.018, 1.4, F.x1 - 0.12, 0.9, 0.9 + i * 0.5, 0xa2744a, 6); P.push(paint(place(new ConeGeometry(0.08, 0.3, 8), F.x1 - 0.12, 0.14, 0.9 + i * 0.5), 0xc4a058)); }
  // iron ring chandeliers with candles (flames glow)
  for (const [cx, cy, cz] of [[-2.5, 3.0, 0.5], [2.5, 3.0, 0.5]]) { P.push(paint(place(new TorusGeometry(0.45, 0.025, 6, 20), cx, cy, cz, Math.PI / 2, 0, 0), 0x2e2b30)); cyl(P, 0.01, 0.01, F.h - cy, cx, (F.h + cy) / 2, cz, 0x2e2b30, 4);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, x1 = cx + Math.cos(a) * 0.45, z1 = cz + Math.sin(a) * 0.45; cyl(P, 0.025, 0.025, 0.14, x1, cy + 0.08, z1, CREAM, 6); E.push(paint(place(new ConeGeometry(0.022, 0.07, 6), x1, cy + 0.19, z1), 0xffc060)); } }
  const m = new Mesh(merge(P), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); m.name = 'broom-room'; m.raycast = () => {};
  const e = new Mesh(merge(E), new MeshBasicMaterial({ vertexColors: true })); e.name = 'broom-glow'; e.raycast = () => {};
  g.add(m, e);
}
// in both states: the tray of mugs on the bar (x 3.6..4.6)
export function buildExtras() {
  const P = []; cyl(P, 0.42, 0.42, 0.02, 4.1, 1.12, 2.95, 0x8a8a90, 18);
  for (const [dx, dz] of [[-0.18, -0.12], [0.16, -0.14], [0, 0.16], [0.24, 0.14]]) { mugAt(P, 4.1 + dx, 1.13, 2.95 + dz); P.push(paint(place(new SphereGeometry(0.058, 8, 5), 4.1 + dx, 1.28, 2.95 + dz, 0, 0, 0, 1, 0.45, 1), 0xf4ead4)); }
  const m = new Mesh(merge(P), new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 })); m.name = 'broom-tray'; m.raycast = () => {}; return m;
}
const flameTex = () => canvasTex(64, 128, (x) => { const g = x.createRadialGradient(32, 92, 2, 32, 80, 60); g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.3, 'rgba(255,190,70,.95)'); g.addColorStop(0.65, 'rgba(240,100,30,.5)'); g.addColorStop(1, 'rgba(200,60,20,0)');
  x.fillStyle = g; x.beginPath(); x.moveTo(32, 2); x.bezierCurveTo(54, 50, 62, 90, 32, 126); x.bezierCurveTo(2, 90, 10, 50, 32, 2); x.fill(); });
export function buildFire() {
  const g = new Group(); g.name = 'broom-fire';
  const add = { transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false, side: DoubleSide };
  const flames = new InstancedMesh(new PlaneGeometry(0.42, 0.8).translate(0, 0.4, 0), new MeshBasicMaterial({ map: flameTex(), ...add }), 3); flames.name = 'broom-flames'; flames.frustumCulled = false;
  const glow = new Mesh(new PlaneGeometry(1.8, 1.4), new MeshBasicMaterial({ map: softTex(), color: 0xff9a40, opacity: 0.55, ...add })); glow.name = 'broom-fire-glow'; glow.position.set(-5.5, 0.6, FIRE.z); glow.rotation.y = Math.PI / 2;
  const floor = new Mesh(new PlaneGeometry(2.6, 3.0), new MeshBasicMaterial({ map: softTex(), color: 0xffa050, opacity: 0.35, ...add })); floor.name = 'broom-hearth-light'; floor.rotation.x = -Math.PI / 2; floor.position.set(-4.75, 0.015, FIRE.z);
  for (const o of [flames, glow, floor]) { o.raycast = () => {}; o.frustumCulled = false; g.add(o); }
  return { g, flames, glow, floor };
}
// Madam Rosmerta: the chibi figure (the roaming teachers' builder) in a green dress, a cream apron, warm curly hair, a smile;
// its parts merged per rig node (6 draws instead of ~25)
export function buildRosmerta() {
  const fig = buildChibi({ robe: 0x2f6a3e, trim: 0x24502e, skin: 0xeec4a0, hair: 0xa4562a, house: 0xe8dcc0, scale: 1.12 });
  const rig = fig.userData.rig, hair = 0xa4562a;
  const curls = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; curls.push(paint(place(new SphereGeometry(0.085, 8, 6), Math.sin(a) * 0.31, -0.05 + Math.abs(Math.cos(a)) * 0.12 + (i % 2) * 0.05, Math.cos(a) * 0.28 - 0.06), hair)); }
  curls.push(paint(place(new TorusGeometry(0.06, 0.012, 5, 10, Math.PI), 0, -0.12, 0.285, 0, 0, Math.PI), 0xa83a3a));   // the smile
  for (const sx of [-1, 1]) curls.push(paint(place(new SphereGeometry(0.05, 8, 6), sx * 0.17, -0.07, 0.24, 0, 0, 0, 1, 0.6, 0.4), 0xe8a090));   // rosy cheeks
  const apron = [paint(place(new CylinderGeometry(0.31, 0.47, 0.5, 16, 1, true, -0.9, 1.8), 0, 0.81, 0.012), CREAM), paint(place(new BoxGeometry(0.34, 0.3, 0.04), 0, 1.12, 0.24), CREAM)];
  const node = (parent, extra) => {
    const list = parent.children.filter(o => o.isMesh), P = [];
    for (const o of list) { o.updateMatrix(); const geo = o.geometry.clone().applyMatrix4(o.matrix); P.push(paint(geo, o.material.color.getHex())); parent.remove(o); }
    for (const e of extra || []) P.push(e);
    if (P.length) { const m = new Mesh(merge(P), new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })); m.raycast = () => {}; m.frustumCulled = false; parent.add(m); }
  };
  node(rig.head, curls); node(fig, apron); for (const k of ['armL', 'armR', 'legL', 'legR']) node(rig[k]);
  fig.name = 'broom-rosmerta'; return fig;
}
export function buildMug() {
  const g = new Group(); g.name = 'broom-mug'; g.rotation.order = 'YXZ';
  const glass = []; glass.push(paint(new CylinderGeometry(0.075, 0.068, 0.19, 16, 1, true).translate(0, 0.095, 0), 0xeaf0f0), paint(new CylinderGeometry(0.068, 0.068, 0.012, 16).translate(0, 0.006, 0), 0xeaf0f0), paint(place(new TorusGeometry(0.05, 0.013, 6, 12), 0.085, 0.1, 0), 0xd0d8d8));
  const gm = new Mesh(merge(glass), new MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.45, roughness: 0.15, depthWrite: false })); gm.raycast = () => {};
  const liq = new Group(); liq.position.y = 0.01;
  const L = [paint(new CylinderGeometry(0.066, 0.062, 0.15, 14).translate(0, 0.075, 0), 0xc88a2a), paint(place(new SphereGeometry(0.078, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.15, 0, 0, 0, 0, 1, 0.55, 1), 0xf6eedc)];
  for (let i = 0; i < 4; i++) L.push(paint(place(new SphereGeometry(0.025, 6, 4), Math.cos(i * 1.6) * 0.07, 0.15 - i * 0.012, Math.sin(i * 1.6) * 0.07), 0xf6eedc));   // a little foam over the rim
  const lm = new Mesh(merge(L), new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })); lm.raycast = () => {}; liq.add(lm);
  g.add(liq, gm); g.visible = false;
  return { g, liq };
}
export function buildFoam() {
  const P = []; for (const sx of [-1, 1]) { P.push(paint(place(new SphereGeometry(0.05, 10, 6), sx * 0.045, 0, 0, 0, 0, sx * 0.35, 1, 0.42, 0.55), 0xfaf6ec)); P.push(paint(place(new SphereGeometry(0.03, 8, 5), sx * 0.09, -0.012, -0.005, 0, 0, 0, 1, 0.6, 0.7), 0xfaf6ec)); }
  const m = new Mesh(merge(P), new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })); m.name = 'broom-foam'; m.raycast = () => {}; m.frustumCulled = false; m.visible = false; return m;
}
