// The castle interiors, each built from the textured interior-kit + furniture (no exterior
// GLBs are ever placed indoors — that was the old "corrupted tower" bug). Rooms live in a
// hidden pocket far BELOW the grounds (FLOOR_Y); dense warm fog hides the void. Each room
// returns walkable `portals` (doorway zones) so you can stroll between rooms and back out.
import {
  Group, Mesh, BoxGeometry, MeshStandardMaterial, Color, SphereGeometry, CylinderGeometry, CircleGeometry, TorusGeometry,
  InstancedMesh, Object3D, ConeGeometry,
} from 'three';
import {
  MAT, stoneMat, floor, wall, ceiling, column, candle, torch, longTable, window2, banner,
  enchantedCeiling, emissive, glassGlow, mergeStatic, greatWindow,
} from './interior-kit.js';
import { hallRoof, hallBanners, heightShade } from './hall-film.js';
import { timberCeiling, grandDoors, windowLight, propMesh } from './room-film.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { carpet, headTable, bookshelf, armchair, fireplace, archway, chandelier } from './furniture.js';
import { bakeLight } from './atmosphere.js';
import { decorate } from './decor.js';
import { addDumbledore } from './dumbledore.js';

export const FLOOR_Y = -200;
// Gryffindor red, Ravenclaw blue, Hufflepuff gold, Slytherin green.
const HOUSE = [0x7a1020, 0x1a3a6a, 0xb08a1a, 0x1a5a2a];

// Four axis-aligned walls + floor + ceiling; pushes box colliders. `open` lists wall sides
// ('s'|'n'|'e'|'w') to leave as a walkable doorway gap (split into two stubs, no centre block).
function shell(g, cols, W, D, H, { ceil = true, open = [], floorColor = 0x9a8f7e, floorTile = 2.5, ceilColor = 0x3c3850, floorRough = 0.92, wallColor, wallSegs = 1 } = {}) {
  floor(g, W, D, floorColor, floorTile, floorRough);
  if (ceil) ceiling(g, W, D, H, ceilColor);
  const t = 1, GAP = 3.6;
  const sides = {
    s: { x: 0, z: D / 2, w: W, horizontal: true }, n: { x: 0, z: -D / 2, w: W, horizontal: true },
    e: { x: W / 2, z: 0, w: D, horizontal: false }, w: { x: -W / 2, z: 0, w: D, horizontal: false },
  };
  const DH = Math.min(5.6, H - 1);                          // doorway opening height
  for (const [key, s] of Object.entries(sides)) {
    if (open.includes(key)) {
      const stub = (s.w - GAP) / 2, off = (GAP + stub) / 2;
      for (const sgn of [-1, 1]) {
        const cx = s.horizontal ? sgn * off : s.x, cz = s.horizontal ? s.z : sgn * off;
        const ww = s.horizontal ? stub : t, dd = s.horizontal ? t : stub;
        wall(g, cx, cz, ww, H, dd, 0, wallColor, wallSegs); cols.push({ type: 'box', x: cx, z: cz, hw: ww / 2, hd: dd / 2, angle: 0 });
      }
      // Lintel over the gap so the doorway is door-height, not a full-height slot to the void.
      const lh = H - DH;
      if (lh > 0.2) {
        const lw = s.horizontal ? GAP : t, ld = s.horizontal ? t : GAP;
        const lintel = new Mesh(new BoxGeometry(lw, lh, ld), wallColor ? stoneMat(lw / 3, lh / 3, wallColor) : MAT.stone);
        lintel.position.set(s.horizontal ? 0 : s.x, DH + lh / 2, s.horizontal ? s.z : 0); g.add(lintel);
      }
    } else {
      const ww = s.horizontal ? s.w : t, dd = s.horizontal ? t : s.w;
      wall(g, s.x, s.z, ww, H, dd, 0, wallColor, wallSegs); cols.push({ type: 'box', x: s.x, z: s.z, hw: ww / 2, hd: dd / 2, angle: 0 });
    }
  }
}

// Shared wrapper: parks the room at FLOOR_Y, animates candles/fires, exposes portals.
function room(g, cols, spawn, { flames = [], portals = [], update, id } = {}) {
  g.position.y = FLOOR_Y;
  for (const p of portals) p.armed = false;
  const extra = id ? decorate(id, g, cols) : null;          // feast, pumpkins, armour, lamps… (decor.js)
  // All the candles of a room become TWO instanced meshes (wax + flame) instead of two draw
  // calls each — the Great Hall alone drops ~66 calls. A bare marker stays at each spot so the
  // baked light pools/halos still find it.
  let candleTick = null;
  if (flames.length) {
    const n = flames.length, d = new Object3D();
    const wax = new InstancedMesh(new CylinderGeometry(0.04, 0.05, 0.4, 6), new MeshStandardMaterial({ color: 0xf3e6c0, roughness: 0.7 }), n);
    const fl = new InstancedMesh(new SphereGeometry(0.08, 6, 4), emissive(0xffb34d, 2.2), n);   // low-poly flames: ~120 of them in the hall
    wax.frustumCulled = fl.frustumCulled = false; wax.name = 'candles'; fl.name = 'candle-flames';
    const spots = flames.map((c) => { g.remove(c); const o = new Object3D(); o.position.copy(c.position); o.userData.light = c.userData.light; g.add(o); return { x: c.position.x, y: c.position.y, z: c.position.z }; });
    g.add(wax, fl);
    candleTick = (t) => {
      for (let i = 0; i < n; i++) {
        const p = spots[i], y = p.y + (p.y > 3 ? Math.sin(t * 3 + p.x) * 0.15 : 0);   // only the floating ones bob
        d.position.set(p.x, y, p.z); d.scale.set(1, 1, 1); d.updateMatrix(); wax.setMatrixAt(i, d.matrix);
        d.position.y = y + 0.3; d.scale.set(1, 1.6, 1); d.updateMatrix(); fl.setMatrixAt(i, d.matrix);
      }
      wax.instanceMatrix.needsUpdate = true; fl.instanceMatrix.needsUpdate = true;
      fl.material.emissiveIntensity = 2 + Math.sin(t * 9) * 0.4;
    };
    candleTick(0);
  }
  const light = bakeLight(g, cols);                          // flame pools + wall washes, one draw call
  return {
    group: g, colliders: cols, portals,
    spawn: { x: spawn.x, z: spawn.z, y: FLOOR_Y, yaw: spawn.yaw ?? 0 },
    update(dt, t) {
      light.update(t); glassGlow(t); if (extra) extra(dt, t);
      if (candleTick) candleTick(t);
      update && update(dt, t);
    },
  };
}

// ---- Entrance Hall: the room you reach through the castle's front oak doors -------------
// Film look: a timbered oak ceiling with depth (beams, joists, braces on stone corbels), warm
// low torches washing honey stone that falls into shadow toward the beams (baked height shade),
// the tall pointed front doors lit as a focal point, long house banners on the side walls and
// one over each house hourglass by the stairs (lit by a warm wash on the north wall).
function entranceHall() {
  const g = new Group(); const cols = []; const W = 16, D = 24, H = 11;
  const WALL = 0xb09068;                                    // honey-grey ashlar
  shell(g, cols, W, D, H, { ceil: false, open: ['w', 'e'], wallColor: WALL, wallSegs: 6, floorColor: 0xa89a82, floorTile: 3, floorRough: 0.7 });   // west->Great Hall, east->Library
  // beams span the hall (x) between the doorway walls, clear of the chandelier ring (z -2)
  timberCeiling(g, W - 1, D - 1, H, { along: 'x', at: [-10.4, -7.6, -4.8, 0.8, 3.6, 6.4, 9.2], joist: 1.25, corbel: WALL, brace: 1.4 });
  carpet(g, 0, 2, 4.4, D - 4);                              // welcome runner toward the stairs
  // the arches frame the shell's real doorway gaps (centred on z 0, like their portals)
  archway(g, -W / 2 + 0.3, 0, Math.PI / 2);                 // to Great Hall
  archway(g, W / 2 - 0.3, 0, -Math.PI / 2);                 // to Library
  // a short grand staircase at the north end (climb toward the gallery)
  for (let s = 0; s < 6; s++) {
    const step = new Mesh(new BoxGeometry(8, 0.4, 1.2), MAT.stone);
    step.position.set(0, 0.2 + s * 0.4, -D / 2 + 1 + s * 1.1); step.castShadow = true; g.add(step);
  }
  // the castle's front doors on the south wall (the 'out' portal stands in front of them),
  // lit from both sides and washed warm from above so they read from the stairs
  grandDoors(g, 0, D / 2 - 0.5, Math.PI, { w: 4.2, hs: 3.8, wallColor: WALL });
  for (const sx of [-3.9, 3.9]) torch(g, sx, 3.4, D / 2 - 0.6, 0xff8a2a, { shared: true, wash: 3.4, glowBall: false });
  const doorWash = new Group(); doorWash.position.set(0, 4.6, D / 2 - 0.9);
  doorWash.userData.light = { k: 'torch', c: 0xffb060, wr: 4.2, noHalo: true, off: 0.42, wa: 0.2, fr: 3.6, fa: 0.3 }; g.add(doorWash);
  // the house hourglasses (delight.js, x +-4.6 / +-6.6, z -10.6): a warm wash behind each pair
  // and a gem-coloured pool at each glass (delight adds them after the light is baked)
  for (const sx of [-5.6, 5.6]) { const o = new Group(); o.position.set(sx, 2.8, -D / 2 + 0.9); o.userData.light = { k: 'torch', c: 0xffc070, wr: 3.2, noHalo: true, wa: 0.4, fr: 3, fa: 0.3 }; g.add(o); }
  [[-6.6, 0xff3b4e], [-4.6, 0x2fe08a], [4.6, 0x4d8dff], [6.6, 0xffd23f]].forEach(([x, c]) => { const o = new Group(); o.position.set(x, 0.5, -10.6); o.userData.light = { k: 'glow', c, r: 1.4, a: 0.22 }; g.add(o); });
  const ch = chandelier(g, 0, H - 1.5, -2);                  // hung below the beams
  // stand under the chandelier and wave the wand: it rocks and jingles and its candles flare
  let swing = 0;
  (g.userData.enchant = g.userData.enchant || []).push({ id: 'chandelier', obj: ch, r: 4.5, cast() { swing = 4; try { window.HPFun.sfx.tune([1568, 1319, 1568, 1047, 1319, 1568, 2093], 0.11, 'sine'); } catch { /* no audio yet */ } return '🕯️'; } });
  g.userData.chandelierSwing = () => swing;
  // low torches (3.8 m) with wide washes so the lower walls glow and the tops fall into shadow
  for (const sx of [-W / 2 + 0.4, W / 2 - 0.4]) for (const z of [-5, 3, 9]) torch(g, sx, 3.8, z, 0xff8a2a, { shared: true, wash: 3.6, glowBall: false });
  // Everything static that shares a material merges (walls, steps, arches, doors' stone, torches,
  // carpet); the chandelier keeps swinging on its own.
  mergeStatic(g, g.children.filter(c => c !== ch));
  const stoneHex = [WALL, 0x8f8a80].map(h => new Color(h).getHex());
  heightShade(g.children.filter(m => m.isMesh && !m.isInstancedMesh && m.material.map && m.material.color && stoneHex.includes(m.material.color.getHex()) && m.name !== 'corbels'),
    { y0: 2.2, y1: H - 1, k0: 1.18, k1: 0.3 });
  // long house banners: two per side wall (between the beams, clear of the torches) and one over
  // each hourglass on the north wall; one mesh, gently stirring
  const banners = hallBanners(g, [
    { x: -W / 2 + 0.75, z: -6.2, top: 9.4, house: 'gryffindor', axis: 'x', amp: 0.35 },
    { x: -W / 2 + 0.75, z: 5, top: 9.4, house: 'ravenclaw', axis: 'x', amp: 0.35 },
    { x: W / 2 - 0.75, z: -6.2, top: 9.4, house: 'hufflepuff', axis: 'x', amp: 0.35 },
    { x: W / 2 - 0.75, z: 5, top: 9.4, house: 'slytherin', axis: 'x', amp: 0.35 },
    { x: -6.6, z: -D / 2 + 0.75, top: 9.6, house: 'gryffindor', len: 3.6, amp: 0.3 },
    { x: -4.6, z: -D / 2 + 0.75, top: 9.6, house: 'slytherin', len: 3.6, amp: 0.3 },
    { x: 4.6, z: -D / 2 + 0.75, top: 9.6, house: 'ravenclaw', len: 3.6, amp: 0.3 },
    { x: 6.6, z: -D / 2 + 0.75, top: 9.6, house: 'hufflepuff', len: 3.6, amp: 0.3 },
  ], { w: 1.5, len: 5.2 });
  const rods = [];
  for (const [x, z, ax] of [[-W / 2 + 0.8, -6.2, 1], [-W / 2 + 0.8, 5, 1], [W / 2 - 0.8, -6.2, 1], [W / 2 - 0.8, 5, 1], [-6.6, -D / 2 + 0.8, 0], [-4.6, -D / 2 + 0.8, 0], [4.6, -D / 2 + 0.8, 0], [6.6, -D / 2 + 0.8, 0]]) {
    const r = new CylinderGeometry(0.045, 0.045, 1.75, 6); r.rotateZ(Math.PI / 2); if (ax) r.rotateY(Math.PI / 2);
    r.translate(x, ax ? 9.42 : 9.62, z); rods.push(r);
  }
  const rodMesh = new Mesh(mergeGeometries(rods, false), MAT.gold); rodMesh.name = 'banner-rods'; g.add(rodMesh);
  const flames = [];
  const portals = [
    { x: 0, z: D / 2 - 1.2, r: 1.6, to: 'out' },            // south doors -> grounds
    // wide enough for the whole doorway gap + arch (z -1.3..3.3): at z 2 / r 1.5 a child walking
    // through the middle of the arch (z 0) missed the portal and strolled out into the void, and at
    // z 0 / r 1.5 the old approach line at z 2 (gameplay test journey) missed it
    { x: -W / 2 + 1.2, z: 1, r: 2.3, to: 'greathall' },
    { x: W / 2 - 1.2, z: 1, r: 2.3, to: 'library' },
    { x: 0, z: -D / 2 + 3.4, r: 1.7, to: 'staircase' },      // up the steps -> the grand staircase hall
  ];
  return room(g, cols, { x: 0, z: D / 2 - 5, yaw: Math.PI }, {
    id: 'entrancehall',
    flames, portals,
    update: (dt, t) => {
      banners.update(t);
      if (swing > 0) swing -= dt;
      const k = swing > 0 ? Math.min(1, swing / 1.5) : 0;        // rocks hard, then settles
      ch.rotation.z = k * Math.sin(t * 2.7) * 0.2; ch.rotation.x = k * Math.cos(t * 2.2) * 0.12;
      for (const f of ch.userData.flames) { f.material.emissiveIntensity = 2 + Math.sin(t * 8 + f.position.x) * 0.4 + k * 2.5; f.scale.setScalar(1 + k * (0.5 + 0.4 * Math.sin(t * 13 + f.position.x * 3))); }
    },
  });
}

// ---- The Great Hall: four long tables, a head table on a dais, floating candles ---------
// Film look (art previews/film/greathall_after.png): a hammerbeam oak roof under a pitched
// enchanted sky, a drift of floating candles, long house banners over the tables, a great
// window behind the dais, torches on every bay, and baked height falloff on the stone.
function greatHall() {
  const g = new Group(); const cols = []; const W = 20, D = 36, H = 15;
  const WALL = 0xb88c60;   // warm honey stone: reads candle-lit at any outdoor time (fixed indoor IBL)
  shell(g, cols, W, D, H, { ceil: false, open: ['s'], floorColor: 0xb6a284, floorTile: 4, floorRough: 0.6,   // polished flags: candle sheen
    wallColor: WALL, wallSegs: 6 });
  // trusses on every column and between them (z +-13.5 / +-4.5 are the columns, which carry them)
  hallRoof(g, W, D, H, { rise: 5, trussZ: [-13.5, -9, -4.5, 0, 4.5, 9, 13.5], wallColor: WALL });
  carpet(g, 0, 0, 6, D - 5, 0x6e1420);                     // long crimson aisle runner
  const flames = [];
  // Four house tables framing the central aisle: benches, plates, and low candelabra.
  for (const tx of [-5, 5]) for (const tz of [-6, 9]) {
    longTable(g, tx, tz, 16);
    for (let i = -6; i <= 6; i += 4) { const c = candle(tx, 1.45, tz + i); c.userData.light.top = 1.035; g.add(c); flames.push(c); }
  }
  // House banners hang over each table from the roof, two per table (students.js HOUSE seats:
  // Gryffindor x -5 / z -6, Ravenclaw x -5 / z 9, Hufflepuff x 5 / z -6, Slytherin x 5 / z 9),
  // in the middle of the roof bays; they face the doors.
  const BANNERS = [];
  for (const [x, zs, house] of [[-5, [-11.25, -6.75], 'gryffindor'], [5, [-11.25, -6.75], 'hufflepuff'], [-5, [6.75, 11.25], 'ravenclaw'], [5, [6.75, 11.25], 'slytherin']])
    for (const z of zs) BANNERS.push({ x, z, top: 15.6, house });
  for (const b of BANNERS) for (const dx of [-0.75, 0.75]) {   // iron hangers up to the purlins
    const ch = new Mesh(new BoxGeometry(0.04, 1.2, 0.04), MAT.dark); ch.position.set(b.x + dx, 16.1, b.z); g.add(ch);
  }
  for (const b of BANNERS) { const rod = new Mesh(new CylinderGeometry(0.05, 0.05, 1.9, 6), MAT.gold); rod.rotation.z = Math.PI / 2; rod.position.set(b.x, b.top + 0.02, b.z + 0.02); g.add(rod); }
  // The floating candles: a drift of ~120 over the tables and the aisle (not over the dais), in a
  // slab 6.5 .. 10.5 m up, kept clear of the banners. Instanced in room(): still 2 draw calls.
  let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let n = 0, tries = 0; n < 120 && tries < 2000; tries++) {
    const x = (rnd() - 0.5) * 16, z = -12 + rnd() * 27, y = 6.5 + rnd() * 4;
    if (BANNERS.some(b => Math.abs(x - b.x) < 1.1 && Math.abs(z - b.z) < 0.6 && y > 9.4)) continue;
    const c = candle(x, y, z); g.add(c); flames.push(c); n++;
  }
  // Columns stand between the windows and clear of the west dungeon arch (z 3.5), which takes
  // the west column's place at z 4.5.
  // Solid (circle colliders at the plinth): all sit 8+ m from the aisle, 1.9 m beyond the wall
  // benches' seated students, clear of the doors, the dungeon arch and Trevor's corner spot.
  for (const z of [-13.5, -4.5, 4.5, 13.5]) { if (z !== 4.5) column(g, -W / 2 + 0.9, z, H, 0.5, cols); column(g, W / 2 - 0.9, z, H, 0.5, cols); }
  // windows hang 6 cm proud of the wall face (they used to be buried 30 cm inside the wall)
  for (const sx of [-W / 2 + 0.56, W / 2 - 0.56]) for (const z of [-10, 0, 10])
    window2(g, sx, 7, z, sx < 0 ? Math.PI / 2 : -Math.PI / 2, sx < 0 ? 0x7fb0ff : 0xffc98a, 1.3, 'hall');
  // the great window behind the dais (same glass as the east windows: merges with their panes)
  greatWindow(g, 0, -D / 2 + 0.56, { y0: 4.2, rose: 17.3, hue: 0xffc98a, glow: 1.3 });
  headTable(g, 0, -D / 2 + 3.2, W - 7).rotation.y = Math.PI / 2;   // head table + dais at the north end
  // torches on every bay, low (3.6 m) so their baked wash climbs the lower walls; shared
  // materials let all eight merge into a couple of draw calls
  for (const sx of [-1, 1]) for (const z of [-15.6, -7, 7, 11.8]) torch(g, sx * (W / 2 - 0.5), 3.6, z, 0xff8a2a, { shared: true, wash: 3.6, glowBall: false });
  archway(g, -W / 2 + 0.55, 3.5, Math.PI / 2, { w: 2.6, h: 4.2 });   // a low arch in the west wall: down to the dungeon
  // Static pieces sharing a material (walls, gables, window surrounds and mullions, stained-glass
  // panes, columns, table tops and benches, torches, iron) merge into one mesh per material.
  // The candles (instanced and bobbing in room()) are left alone.
  mergeStatic(g, g.children.filter(c => !flames.includes(c)));
  // baked height falloff on the merged stone: honey-bright low, shadowed under the roof
  const stoneHex = [WALL, 0x7d7870].map(h => new Color(h).getHex());   // (colour-managed round trip, as the materials store it)
  heightShade(g.children.filter(m => m.isMesh && !m.isInstancedMesh && m.material.map && m.material.color && stoneHex.includes(m.material.color.getHex())),
    { y0: 2.5, y1: H - 2, k0: 1.2, k1: 0.22 });
  const banners = hallBanners(g, BANNERS, { w: 1.6, len: 5.6 });
  // Dumbledore stands centred on the dais (top y 0.5) behind the head table (its cloth ends at
  // z -16.25), facing the hall doors; his robe train tucks against the north wall (z -17.5).
  const dumbledore = addDumbledore(g, 2.2, 0.5, -D / 2 + 1.15);   // off-centre so the owl lectern in the aisle does not hide him from the door
  return room(g, cols, { x: 0, z: 11, yaw: Math.PI }, {
    id: 'greathall',
    flames, portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'entrancehall' }, { x: -W / 2 + 1.7, z: 3.5, r: 1.3, to: 'dungeon' }],
    update: (dt, t) => { dumbledore(dt); banners.update(t); },
  });
}

// ---- The library: warm reading room walled with glowing bookshelves ---------------------
function library() {
  const g = new Group(); const cols = []; const W = 22, D = 22, H = 10;
  shell(g, cols, W, D, H, { open: ['w'] });                // west doorway -> Entrance Hall
  archway(g, -W / 2 + 0.3, 0, Math.PI / 2);
  // east wall: four shelves; west wall: the same four pushed apart so the doorway arch (z 0)
  // stays visible between them
  for (let r = 0; r < 4; r++) bookshelf(g, 8, -8 + r * 5.2, 1);
  for (const z of [-8.2, -3.8, 3.8, 8.2]) bookshelf(g, -8, z, -1);
  const flames = [];
  for (const [tx, tz] of [[0, -4], [0, 4]]) {
    longTable(g, tx, tz, 7, 0x2b5a8a);
    const c = candle(tx, 1.1, tz); g.add(c); flames.push(c);
  }
  for (const [x, z] of [[-W / 2 + 0.5, 8], [W / 2 - 0.5, -8], [W / 2 - 0.5, 8]]) torch(g, x, 4, z);
  const ch = chandelier(g, 0, H - 1.5, 0);
  return room(g, cols, { x: 4, z: D / 2 - 3.6, yaw: Math.PI }, {      // beside the reading table (the old spawn stood inside it)
    id: 'library',
    flames, portals: [{ x: -W / 2 + 1.2, z: 0, r: 1.5, to: 'entrancehall' }],
    update: (dt, t) => { for (const f of ch.userData.flames) f.material.emissiveIntensity = 2 + Math.sin(t * 8 + f.position.z) * 0.4; },
  });
}

// ---- A cosy common room: hearth, armchairs, a warm rug ----------------------------------
function commonRoom() {
  const g = new Group(); const cols = []; const W = 18, D = 18, H = 9.5;
  shell(g, cols, W, D, H, { ceilColor: 0x47372a, open: ['s'] });   // warm timber ceiling; south door -> staircase hall
  for (let x = -W / 2 + 3; x <= W / 2 - 3; x += 4) {        // exposed oak beams across the ceiling
    const beam = new Mesh(new BoxGeometry(0.5, 0.5, D - 1), MAT.wood); beam.position.set(x, H - 0.4, 0); g.add(beam);
  }
  carpet(g, 0, 1, 8, 6, 0x6a1420);
  const hp = fireplace(g, 0, -D / 2 + 0.8);
  // wave the wand at the hearth: the flames roar up emerald green (Floo powder!), then settle back to orange
  let green = 0, mix = 0; const fireFrom = hp.fire.material.emissive.clone(), fireTo = new Color(0x2fe070);
  (g.userData.enchant = g.userData.enchant || []).push({ id: 'fire', obj: hp.fire, cast() { green = 5; try { window.HPFun.sfx.noise(1.4, 0.22, 0, 600, 0.5); window.HPFun.sfx.poof(); } catch { /* no audio yet */ } return '🔥'; } });
  g.userData.greenFire = () => green;
  // Three wing chairs in a loose arc facing the hearth (seen on entry, fire glowing beyond).
  armchair(g, -3.6, -2.4, Math.PI - 0.35); armchair(g, 3.6, -2.4, Math.PI + 0.35); armchair(g, 0, -3.4, Math.PI);
  bookshelf(g, -W / 2 + 0.8, 5, 1); bookshelf(g, W / 2 - 0.8, 5, -1);
  for (const [x, z] of [[-W / 2 + 0.4, 2], [W / 2 - 0.4, 2]]) torch(g, x, 3.4, z);
  // over the mantel, just proud of the wall (it used to hang inside the wall behind the hearth)
  banner(g, 0, 6.5, -D / 2 + 0.56, HOUSE[0]).scale.setScalar(0.8);
  return room(g, cols, { x: 0, z: D / 2 - 5, yaw: Math.PI }, {
    id: 'commonroom', portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'staircase' }],
    update: (dt, t) => {
      if (green > 0) green -= dt;
      mix = Math.max(0, Math.min(1, mix + (green > 0 ? dt * 4 : -dt * 1.2)));
      const m = hp.fire.material;
      m.emissiveIntensity = 1.7 + Math.sin(t * 7) * 0.35 + mix * 1.2;
      m.emissive.copy(fireFrom).lerp(fireTo, mix); m.color.copy(m.emissive);
      hp.fire.scale.set(1, 1 + mix * (0.7 + 0.2 * Math.sin(t * 11)), 1); hp.fire.position.y = 1.0 + (hp.fire.scale.y - 1) * 0.6;
    },
  });
}

// ---- The grand moving staircases --------------------------------------------------------
function staircase() {
  const g = new Group(); const cols = []; const W = 20, D = 22, H = 22;
  shell(g, cols, W, D, H, { floorColor: 0xa89a82, floorTile: 4, open: ['s', 'w', 'e'] });   // a hub: south->Entrance Hall, west->classrooms, east->Astronomy tower
  archway(g, -W / 2 + 0.3, 0, Math.PI / 2); archway(g, W / 2 - 0.3, 0, -Math.PI / 2);
  archway(g, -6.6, -D / 2 + 0.55, 0, { w: 2.6, h: 4.2 });   // north-west arch: the common room
  carpet(g, 0, 1, 5, 9, 0x6e1420);                         // runner up to the foot of the stairs
  // A grand central flight straight ahead, up to a landing with an archway to the floors above.
  for (let s = 0; s < 12; s++) {
    const step = new Mesh(new BoxGeometry(6, 0.42, 0.9), MAT.stone);
    step.position.set(0, 0.21 + s * 0.46, -2 - s * 0.8); step.castShadow = true; step.receiveShadow = true; g.add(step);
  }
  const landing = new Mesh(new BoxGeometry(8, 0.5, 4), MAT.stone);
  landing.position.set(0, 5.75, -11); landing.castShadow = true; g.add(landing);
  archway(g, 0, -D / 2 + 0.5, 0, { w: 3.4, h: 5.5 }).position.y = 6;
  // Two 'moving' flights swing from the landing's outer corners up into the stairwell, like the
  // film's staircases. The foot step rests on the landing (top y 6) outboard of the north arch;
  // the flights climb south-outward and their swinging ends stay 2.5 m+ above the side arches'
  // rings, clear of the walls and banners (they used to hang at y 2.6..6 across the side
  // arches). Overhead scenery: nothing to walk on, so no colliders, like the landing itself.
  const flights = [];
  for (const sx of [-1, 1]) {
    const flight = new Group();
    for (let s = 0; s < 9; s++) {
      const step = new Mesh(new BoxGeometry(2.2, 0.3, 1), MAT.stone);
      step.position.set(0, s * 0.5, s * 0.9); step.castShadow = true; flight.add(step);
    }
    mergeStatic(flight, [flight]);                          // the 9 steps: one mesh under the swaying pivot
    flight.position.set(sx * 4.1, 6.15, -9.35); flight.rotation.y = sx * 0.36;
    g.add(flight); flights.push({ node: flight, base: sx * 0.36, amp: 0.025 });   // a slow creak, not a swing: the top now meets a fixed landing
    // Somewhere to go: the flight's top step (about x +-6.8, y 10.4, z -2.2) meets a stone gallery
    // landing on the side wall, with a balustrade and a dark doorway to the floors above.
    // Overhead scenery only (nothing at walking height), so no colliders.
    const lx = sx * 8.25, ly = 10.45, lz = -2.2;
    const slab = new Mesh(new BoxGeometry(3.3, 0.4, 3.4), MAT.stone); slab.position.set(lx, ly, lz); slab.castShadow = true; g.add(slab);
    for (const dz of [-1.6, 1.6]) { const rail = new Mesh(new BoxGeometry(3.3, 0.9, 0.18), MAT.stone); rail.position.set(lx, ly + 0.65, lz + dz); g.add(rail); }
    archway(g, sx * (W / 2 - 0.3), lz, -sx * Math.PI / 2, { w: 2.2, h: 3.4 }).position.y = ly + 0.2;
  }
  const ch = chandelier(g, 0, H - 5, 1);
  for (const [x, z] of [[-W / 2 + 0.3, -6], [-W / 2 + 0.3, 6], [W / 2 - 0.3, -6], [W / 2 - 0.3, 6]]) torch(g, x, 4, z);
  HOUSE.forEach((c, i) => banner(g, (i < 2 ? -1 : 1) * (W / 2 - 0.58), 10, i % 2 ? 5.5 : -7.6, c, (i < 2 ? 1 : -1) * Math.PI / 2));   // clear of the gallery landings at z -2.2
  // Everything static that shares a material (walls, steps, landings, rails, archways, iron)
  // becomes one mesh per material: same look, ~20 fewer draw calls. The flights keep swaying.
  const swaying = flights.map(f => f.node);
  mergeStatic(g, g.children.filter(c => !swaying.includes(c)));
  return room(g, cols, { x: 0, z: D / 2 - 5, yaw: Math.PI }, {
    id: 'staircase',
    portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'entrancehall' }, { x: -W / 2 + 1.2, z: 0, r: 1.5, to: 'classrooms' },
      { x: W / 2 - 1.2, z: 0, r: 1.5, to: 'tower' }, { x: -6.6, z: -D / 2 + 1.9, r: 1.3, to: 'commonroom' }],
    update: (dt, t) => {
      for (const fl of flights) fl.node.rotation.y = fl.base + Math.sin(t * 0.4 + fl.base) * fl.amp;
      for (const f of ch.userData.flames) f.material.emissiveIntensity = 2 + Math.sin(t * 8 + f.position.x) * 0.4;
    },
  });
}

// ---- The Potions dungeon: a low cool cellar of bubbling cauldrons (down from the Great Hall) ----
function dungeon() {
  const g = new Group(); const cols = []; const W = 18, D = 20, H = 7.5;
  shell(g, cols, W, D, H, { open: ['s'], floorColor: 0x6f7f78, floorTile: 3, ceilColor: 0x2c3a38 });
  const iron = new MeshStandardMaterial({ color: 0x1b1b20, roughness: 0.7, metalness: 0.5 });
  const brews = [0x7ef0a0, 0xa98aff, 0x8ad0ff, 0xffd86a, 0xff8ad0, 0x7ef0a0];
  const pots = [];
  [[-5, 3], [0, 3], [5, 3], [-5, -2], [0, -2], [5, -2], [0, -7]].forEach(([x, z], i) => {
    const s = i === 6 ? 1.5 : 1, c = brews[i % brews.length];
    const pot = new Mesh(new SphereGeometry(0.6 * s, 14, 10, 0, 6.3, 0, 2.1), iron); pot.scale.y = 0.85; pot.position.set(x, 0.62 * s, z); pot.castShadow = true; g.add(pot);
    const brew = new Mesh(new CircleGeometry(0.5 * s, 16), emissive(c, 1.6)); brew.rotation.x = -Math.PI / 2; brew.position.set(x, 0.98 * s, z); g.add(brew);
    brew.userData.light = { k: 'glow', c, r: 2.2 * s, a: 0.3 };
    pots.push({ brew, x, z, s, c, burp: 0 });
  });
  g.userData.enchant = pots.map(p => ({ id: 'cauldron', obj: p.brew, cast() { p.burp = 2.2; return '🫧'; } }));
  for (const sx of [-W / 2 + 0.8, W / 2 - 0.8]) bookshelf(g, sx, -3, sx > 0 ? 1 : -1, 4);       // shelves of ingredient jars
  for (const [x, z] of [[-W / 2 + 0.4, 5], [-W / 2 + 0.4, -6], [W / 2 - 0.4, 5], [W / 2 - 0.4, -6]]) torch(g, x, 3.2, z, 0x6affb0);
  return room(g, cols, { x: 0, z: D / 2 - 4.5, yaw: Math.PI }, {
    id: 'dungeon', portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'greathall' }],
    update: (dt, t) => { for (const p of pots) { if (p.burp > 0) p.burp -= dt; p.brew.material.emissiveIntensity = 1.4 + Math.sin(t * 4 + p.x) * 0.4 + (p.burp > 0 ? 2.5 : 0); p.brew.scale.setScalar(p.burp > 0 ? 1 + Math.sin(p.burp * 14) * 0.25 : 1); } },
  });
}

// ---- The classroom wing: one airy hall with three teaching corners (Charms, Transfiguration,
//      Defence). The professors, boards and desks are placed by lessons.js. ----
// Film look: tall leaded windows throw warm daylight shafts and long pools across the desks
// (fading toward night), honey stone falling into shadow under a timbered ceiling, and a few
// props at each corner: Charms (feathers, a feather stand, Flitwick's book pile), Transfiguration
// (goblets and mice to transfigure, a birdcage), Defence (desk candles, a pixie cage, old tomes).
function classrooms() {
  const g = new Group(); const cols = []; const W = 28, D = 18, H = 9;
  const WALL = 0xae9070;
  shell(g, cols, W, D, H, { ceil: false, open: ['s'], floorColor: 0xa39884, floorTile: 3, wallColor: WALL, wallSegs: 5 });
  timberCeiling(g, W - 1, D - 1, H, { along: 'z', at: [-11.25, -6.75, -2.25, 2.25, 6.75, 11.25], joist: 1.25, corbel: WALL, brace: 1.3 });
  [[-9, 0x223a6a], [0, 0x6a1f2c], [9, 0x2a4a3a]].forEach(([x, c]) => carpet(g, x, -2.5, 7, 7, c));
  // solid columns: 4.8 m from every teaching station, 1.8 m+ from the desks, 4.5 m from the spawn
  for (const x of [-4.5, 4.5]) { column(g, x, -D / 2 + 1.2, H, 0.4, cols); column(g, x, 3, H, 0.4, cols); }
  // taller windows behind each station + one in each side wall (between the torches)
  const WS = 0.75, WY = 5.6, sun = [];
  for (const x of [-9, 0, 9]) { window2(g, x, WY, -D / 2 + 0.54, 0, x < 0 ? 0x9fc0ff : x > 0 ? 0x9fe8b0 : 0xffc98a, 1.2, 'class').scale.setScalar(WS); sun.push({ x, y: WY, z: -D / 2 + 0.6, nx: 0, nz: 1, w: 2.2 * WS, h: 6.1 * WS }); }
  for (const s of [-1, 1]) { window2(g, s * (W / 2 - 0.54), WY, 1, -s * Math.PI / 2, 0xffc98a, 1.2, 'class').scale.setScalar(WS); sun.push({ x: s * (W / 2 - 0.6), y: WY, z: 1, nx: -s, nz: 0, w: 2.2 * WS, h: 6.1 * WS }); }
  for (const [x, z] of [[-W / 2 + 0.4, -3], [W / 2 - 0.4, -3], [-W / 2 + 0.4, 5], [W / 2 - 0.4, 5]]) torch(g, x, 3.6, z, 0xff8a2a, { shared: true, wash: 3.2, glowBall: false });
  const ch = chandelier(g, 0, H - 1.4, 1.5, 1.6, { shared: true });
  // ---- props: ONE vertex-coloured mesh for all three corners (+ instanced desk candles) ----
  const P = [], flames = [];
  const at = (geo, hex, x, y, z, ry = 0, rz = 0, rx = 0) => { if (rx) geo.rotateX(rx); if (rz) geo.rotateZ(rz); if (ry) geo.rotateY(ry); geo.translate(x, y, z); P.push([geo, hex]); };
  const BOOK = [0x6a1e1e, 0x1f3b5e, 0x2c4a2a, 0x5a3a1e, 0x4a2a52, 0x7a5a1e];
  const TOP = 0.85;                                           // desk top (lessons.js desks)
  let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const book = (x, y, z, ry, i, w = 0.34, d = 0.24, h = 0.06) => { at(new BoxGeometry(w, h, d), BOOK[i % BOOK.length], x, y + h / 2, z, ry); at(new BoxGeometry(w - 0.02, h - 0.016, d - 0.03), 0xe9dcb8, x + 0.012, y + h / 2, z, ry); };
  const pile = (x, z, n, big = 1) => { let y = 0; for (let i = 0; i < n; i++) { const h = (0.09 + rnd() * 0.06) * big; book(x + (rnd() - 0.5) * 0.06, y, z + (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.5, i + n, 0.55 * big, 0.4 * big, h); y += h; } cols.push({ type: 'circle', x, z, r: 0.45 * big }); };
  const feather = (x, y, z, ry, rz = 0.08) => { const f = new ConeGeometry(0.05, 0.42, 6); f.scale(1, 1, 0.25); at(f, 0xf2ece0, x, y, z, ry, Math.PI / 2 + rz); at(new CylinderGeometry(0.004, 0.004, 0.16, 3), 0xd8c9a0, x - 0.26 * Math.cos(ry), y, z + 0.26 * Math.sin(ry), ry, Math.PI / 2); };
  const goblet = (x, z) => { at(new CylinderGeometry(0.06, 0.07, 0.02, 10), 0xb98b2e, x, TOP + 0.01, z); at(new CylinderGeometry(0.012, 0.012, 0.09, 6), 0xb98b2e, x, TOP + 0.06, z); at(new CylinderGeometry(0.06, 0.035, 0.09, 10, 1, true), 0xb98b2e, x, TOP + 0.15, z); };
  const mouse = (x, z, ry) => { const b = new SphereGeometry(0.055, 8, 6); b.scale(1.5, 0.8, 1); at(b, 0x8a8078, x, TOP + 0.045, z, ry); at(new SphereGeometry(0.018, 5, 4), 0xd8a0a0, x + 0.08 * Math.cos(ry), TOP + 0.06, z - 0.08 * Math.sin(ry)); const t = new CylinderGeometry(0.006, 0.004, 0.16, 3); at(t, 0xc89090, x - 0.13 * Math.cos(ry), TOP + 0.02, z + 0.13 * Math.sin(ry), ry, Math.PI / 2 - 0.2); };
  const stand = (x, z, h, hex = 0x3a2614) => { at(new CylinderGeometry(0.28, 0.32, 0.06, 12), hex, x, 0.03, z); at(new CylinderGeometry(0.035, 0.035, h, 6), hex, x, h / 2, z); at(new CylinderGeometry(0.2, 0.14, 0.05, 12), hex, x, h, z); cols.push({ type: 'circle', x, z, r: 0.4 }); };
  const cage = (x, y, z, r, h, bars, hex) => { for (let k = 0; k < bars; k++) { const a = k / bars * Math.PI * 2; at(new CylinderGeometry(0.008, 0.008, h, 3), hex, x + Math.cos(a) * r, y + h / 2, z + Math.sin(a) * r); } for (const yy of [y, y + h]) { const ring = new TorusGeometry(r, 0.012, 4, 16); at(ring, hex, x, yy, z, 0, 0, Math.PI / 2); } const dome = new SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); at(dome, hex, x, y + h, z); at(new TorusGeometry(0.05, 0.01, 4, 8), hex, x, y + h + r + 0.04, z); };
  const DESKS = [[-1.6, 3.2], [1.6, 3.2], [-1.6, 5.4], [1.6, 5.4]];
  // Charms (x -9): a feather on every desk ready for the levitation charm, a brass feather stand
  // with one feather already floating, and the pile of books Professor Flitwick stands on
  for (const [dx, dz] of DESKS) { feather(-9 + dx + 0.15, TOP + 0.02, -6.2 + dz - 0.05, 0.4 + rnd()); book(-9 + dx - 0.35, TOP, -6.2 + dz + 0.1, 0.2, (dx + dz) | 0); }
  stand(-11.2, -6.4, 1.05, 0xb98b2e); feather(-11.2, 1.45, -6.4, 0.6, 0.35);
  pile(-6.9, -6.7, 7);
  // Transfiguration (x 0): a goblet and a little mouse on each desk, a birdcage on a stand
  for (const [dx, dz] of DESKS) { goblet(dx - 0.3, -6.2 + dz); mouse(dx + 0.25, -6.2 + dz + 0.05, rnd() * 6); }
  stand(2.4, -6.8, 1.3); cage(2.4, 1.33, -6.8, 0.28, 0.5, 14, 0xb98b2e);
  { const b = new SphereGeometry(0.08, 8, 6); b.scale(1, 1.2, 1); at(b, 0x7a9ab0, 2.4, 1.48, -6.8); }      // a small blue bird
  pile(-2.4, -6.9, 5);
  // Defence (x 9): a candle and a heavy tome on every desk, a pixie cage, a stack of old tomes
  // (the tome's colour index must be an integer: a fractional one read BOOK[undefined] and came out black)
  DESKS.forEach(([dx, dz], k) => { book(9 + dx - 0.25, TOP, -6.2 + dz, -0.15, [0, 3, 0, 3][k], 0.4, 0.3, 0.09); const c = candle(9 + dx + 0.4, TOP + 0.2, -6.2 + dz - 0.1); c.userData.light = { k: 'glow', c: 0xffc070, r: 1.3, a: 0.14 }; g.add(c); flames.push(c); });   // small pools: four full candle pools bleached the green carpet
  stand(11.2, -6.4, 1.2, 0x241b14); cage(11.2, 1.23, -6.4, 0.32, 0.6, 16, 0x2e2b30);
  for (let k = 0; k < 4; k++) { const a = k * 1.7; at(new SphereGeometry(0.05, 6, 5), 0x3f7fe0, 11.2 + Math.cos(a) * 0.15, 1.4 + k * 0.1, -6.4 + Math.sin(a) * 0.15); }   // Cornish pixies
  pile(6.9, -6.7, 6, 1.1);
  propMesh(g, P, 'class-props');
  // Static pieces that share a material merge (walls, columns, window frames and glass, torches,
  // carpets, the chandelier's iron and its flames); lessons.js adds the boards and desks later.
  mergeStatic(g, g.children.filter(c => !flames.includes(c) && c !== ch));
  mergeStatic(ch, [ch], 'chandelier');
  const stoneHex = [WALL, 0x7d7870].map(h => new Color(h).getHex());
  heightShade(g.children.filter(m => m.isMesh && !m.isInstancedMesh && m.material.map && m.material.color && stoneHex.includes(m.material.color.getHex()) && m.name !== 'corbels'),
    { y0: 2, y1: H - 0.5, k0: 1.15, k1: 0.36 });
  const daylight = windowLight(g, sun, { slope: 1.15, strength: 0.8 });
  return room(g, cols, { x: 0, z: D / 2 - 4.5, yaw: Math.PI }, {
    id: 'classrooms', flames, portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'staircase' }],
    update: (dt, t) => { daylight.update(t); ch.userData.flames[0].material.emissiveIntensity = 2 + Math.sin(t * 8) * 0.4; },
  });
}

// ---- The Astronomy tower: a round-feeling room open to the enchanted night sky ----
function tower() {
  const g = new Group(); const cols = []; const W = 16, D = 16, H = 13;
  shell(g, cols, W, D, H, { ceil: false, open: ['s'], floorColor: 0x7c7a92, floorTile: 3 });
  enchantedCeiling(g, W, D, H);
  carpet(g, 0, -1, 8, 8, 0x1b2456, 0xd9b24a);
  // a brass telescope on a tripod, aimed at the stars
  const brass = MAT.gold, tele = new Group(); tele.position.set(4.6, 0, -4.2);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, leg = new Mesh(new CylinderGeometry(0.05, 0.05, 1.9, 6), MAT.dark); leg.position.set(Math.cos(a) * 0.45, 0.9, Math.sin(a) * 0.45); leg.rotation.z = Math.cos(a) * 0.3; leg.rotation.x = -Math.sin(a) * 0.3; tele.add(leg); }
  const tube = new Mesh(new CylinderGeometry(0.16, 0.24, 2.4, 14), brass); tube.position.y = 2.2; tube.rotation.z = -0.9; tube.castShadow = true; tele.add(tube);
  const lens = new Mesh(new TorusGeometry(0.26, 0.05, 8, 16), brass); lens.position.set(0.95, 2.95, 0); lens.rotation.y = Math.PI / 2; lens.rotation.z = -0.9; tele.add(lens);
  g.add(tele);
  for (const [x, z] of [[-W / 2 + 0.4, -4], [W / 2 - 0.4, 4], [-W / 2 + 0.4, 4]]) torch(g, x, 3.6, z, 0x9fb0ff);
  return room(g, cols, { x: 0, z: D / 2 - 4.5, yaw: Math.PI }, { id: 'tower', portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'staircase' }] });
}

export const BUILDERS = { entrancehall: entranceHall, greathall: greatHall, staircase, library, commonroom: commonRoom, dungeon, classrooms, tower };
