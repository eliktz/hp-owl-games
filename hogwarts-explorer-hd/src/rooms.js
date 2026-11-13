// The castle interiors, each built from the textured interior-kit + furniture (no exterior
// GLBs are ever placed indoors — that was the old "corrupted tower" bug). Rooms live in a
// hidden pocket far BELOW the grounds (FLOOR_Y); dense warm fog hides the void. Each room
// returns walkable `portals` (doorway zones) so you can stroll between rooms and back out.
import {
  Group, Mesh, BoxGeometry, MeshStandardMaterial, Color, SphereGeometry, CylinderGeometry, CircleGeometry, TorusGeometry,
  InstancedMesh, Object3D,
} from 'three';
import {
  MAT, stoneMat, floor, wall, ceiling, column, candle, torch, longTable, window2, banner,
  enchantedCeiling, emissive,
} from './interior-kit.js';
import { carpet, headTable, bookshelf, armchair, fireplace, archway, chandelier } from './furniture.js';
import { bakeLight } from './atmosphere.js';
import { decorate } from './decor.js';
import { addDumbledore } from './dumbledore.js';

export const FLOOR_Y = -200;
// Gryffindor red, Ravenclaw blue, Hufflepuff gold, Slytherin green.
const HOUSE = [0x7a1020, 0x1a3a6a, 0xb08a1a, 0x1a5a2a];

// Four axis-aligned walls + floor + ceiling; pushes box colliders. `open` lists wall sides
// ('s'|'n'|'e'|'w') to leave as a walkable doorway gap (split into two stubs, no centre block).
function shell(g, cols, W, D, H, { ceil = true, open = [], floorColor = 0x9a8f7e, floorTile = 2.5, ceilColor = 0x3c3850, floorRough = 0.92, wallColor } = {}) {
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
        wall(g, cx, cz, ww, H, dd, 0, wallColor); cols.push({ type: 'box', x: cx, z: cz, hw: ww / 2, hd: dd / 2, angle: 0 });
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
      wall(g, s.x, s.z, ww, H, dd, 0, wallColor); cols.push({ type: 'box', x: s.x, z: s.z, hw: ww / 2, hd: dd / 2, angle: 0 });
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
    const fl = new InstancedMesh(new SphereGeometry(0.08, 8, 8), emissive(0xffb34d, 2.2), n);
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
      light.update(t); if (extra) extra(dt, t);
      if (candleTick) candleTick(t);
      update && update(dt, t);
    },
  };
}

// ---- Entrance Hall: the room you reach through the castle's front oak doors -------------
function entranceHall() {
  const g = new Group(); const cols = []; const W = 16, D = 24, H = 11;
  shell(g, cols, W, D, H, { open: ['w', 'e'] });            // west->Great Hall, east->Library
  carpet(g, 0, 2, 4.4, D - 4);                              // welcome runner toward the stairs
  archway(g, -W / 2 + 0.3, 2, Math.PI / 2);                 // to Great Hall
  archway(g, W / 2 - 0.3, 2, -Math.PI / 2);                 // to Library
  // a short grand staircase at the north end (climb toward the gallery)
  for (let s = 0; s < 6; s++) {
    const step = new Mesh(new BoxGeometry(8, 0.4, 1.2), MAT.stone);
    step.position.set(0, 0.2 + s * 0.4, -D / 2 + 1 + s * 1.1); step.castShadow = true; g.add(step);
  }
  const ch = chandelier(g, 0, H - 0.6, -2);
  // stand under the chandelier and wave the wand: it rocks and jingles and its candles flare
  let swing = 0;
  (g.userData.enchant = g.userData.enchant || []).push({ id: 'chandelier', obj: ch, r: 4.5, cast() { swing = 4; try { window.HPFun.sfx.tune([1568, 1319, 1568, 1047, 1319, 1568, 2093], 0.11, 'sine'); } catch { /* no audio yet */ } return '🕯️'; } });
  g.userData.chandelierSwing = () => swing;
  for (const sx of [-W / 2 + 0.4, W / 2 - 0.4]) for (const z of [-5, 3, 9]) torch(g, sx, 4.4, z);
  HOUSE.forEach((c, i) => banner(g, (i < 2 ? -1 : 1) * (W / 2 - 0.5), 7, -4 + (i % 2) * 8, c, (i < 2 ? 1 : -1) * Math.PI / 2));
  const flames = [];
  const portals = [
    { x: 0, z: D / 2 - 1.2, r: 1.6, to: 'out' },            // south doors -> grounds
    { x: -W / 2 + 1.2, z: 2, r: 1.5, to: 'greathall' },
    { x: W / 2 - 1.2, z: 2, r: 1.5, to: 'library' },
    { x: 0, z: -D / 2 + 3.4, r: 1.7, to: 'staircase' },      // up the steps -> the grand staircase hall
  ];
  return room(g, cols, { x: 0, z: D / 2 - 5, yaw: Math.PI }, {
    id: 'entrancehall',
    flames, portals,
    update: (dt, t) => {
      if (swing > 0) swing -= dt;
      const k = swing > 0 ? Math.min(1, swing / 1.5) : 0;        // rocks hard, then settles
      ch.rotation.z = k * Math.sin(t * 2.7) * 0.2; ch.rotation.x = k * Math.cos(t * 2.2) * 0.12;
      for (const f of ch.userData.flames) { f.material.emissiveIntensity = 2 + Math.sin(t * 8 + f.position.x) * 0.4 + k * 2.5; f.scale.setScalar(1 + k * (0.5 + 0.4 * Math.sin(t * 13 + f.position.x * 3))); }
    },
  });
}

// ---- The Great Hall: four long tables, a head table on a dais, floating candles ---------
function greatHall() {
  const g = new Group(); const cols = []; const W = 20, D = 36, H = 15;
  shell(g, cols, W, D, H, { ceil: false, open: ['s'], floorColor: 0xb6a284, floorTile: 4, floorRough: 0.6,   // polished flags: candle sheen
    wallColor: 0xb88c60 });   // warm honey stone: reads candle-lit at any outdoor time (fixed indoor IBL)
  enchantedCeiling(g, W, D, H, { color: 0x141d3e, glow: 0x24315e, glowI: 0.7 });   // starry dusk blue
  carpet(g, 0, 0, 6, D - 5, 0x6e1420);                     // long crimson aisle runner
  const flames = [];
  // Four house tables framing the central aisle: benches, plates, and low candelabra.
  for (const tx of [-5, 5]) for (const tz of [-6, 9]) {
    longTable(g, tx, tz, 16);
    for (let i = -6; i <= 6; i += 4) { const c = candle(tx, 1.45, tz + i); g.add(c); flames.push(c); }
  }
  // The Great Hall's floating candles: two drifting rows high over the aisle.
  for (let z = -11; z <= 13; z += 3) for (const ax of [-2.2, 2.2]) {
    const c = candle(ax, 7.2 + Math.sin(z * 0.6) * 0.5, z); g.add(c); flames.push(c);
  }
  for (let z = -D / 2 + 4; z <= D / 2 - 4; z += 7) { column(g, -W / 2 + 0.9, z, H); column(g, W / 2 - 0.9, z, H); }
  for (const sx of [-W / 2 + 0.2, W / 2 - 0.2]) for (const z of [-9, 0, 9])
    window2(g, sx, 7, z, sx < 0 ? Math.PI / 2 : -Math.PI / 2, sx < 0 ? 0x7fb0ff : 0xffc98a, 0.8);
  HOUSE.forEach((c, i) => banner(g, (i < 2 ? -1 : 1) * (W / 2 - 0.6), 10.5, -7 + (i % 2) * 14, c, (i < 2 ? 1 : -1) * Math.PI / 2, { lift: 0.12, crestGlow: 0.7 }));
  headTable(g, 0, -D / 2 + 3.2, W - 7).rotation.y = Math.PI / 2;   // head table + dais at the north end
  for (const [x, z] of [[-W / 2 + 0.5, 13], [W / 2 - 0.5, 13]]) torch(g, x, 5, z);
  archway(g, -W / 2 + 0.55, 3.5, Math.PI / 2, { w: 2.6, h: 4.2 });   // a low arch in the west wall: down to the dungeon
  // Dumbledore stands centred on the dais (top y 0.5) behind the head table (its cloth ends at
  // z -16.25), facing the hall doors; his robe train tucks against the north wall (z -17.5).
  const dumbledore = addDumbledore(g, 2.2, 0.5, -D / 2 + 1.15);   // off-centre so the owl lectern in the aisle does not hide him from the door
  return room(g, cols, { x: 0, z: 11, yaw: Math.PI }, {
    id: 'greathall',
    flames, portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'entrancehall' }, { x: -W / 2 + 1.7, z: 3.5, r: 1.3, to: 'dungeon' }],
    update: (dt) => dumbledore(dt),
  });
}

// ---- The library: warm reading room walled with glowing bookshelves ---------------------
function library() {
  const g = new Group(); const cols = []; const W = 22, D = 22, H = 10;
  shell(g, cols, W, D, H, { open: ['w'] });                // west doorway -> Entrance Hall
  archway(g, -W / 2 + 0.3, 0, Math.PI / 2);
  for (let r = 0; r < 4; r++) for (const sx of [-8, 8]) bookshelf(g, sx, -8 + r * 5.2, sx > 0 ? 1 : -1);
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
  banner(g, 0, 3.6, -D / 2 + 0.3, HOUSE[0]);   // kept clear of the low (H=7) ceiling
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
  // Two animated 'moving' flights that sway, flanking the grand stair.
  const flights = [];
  for (const sx of [-1, 1]) {
    const flight = new Group();
    for (let s = 0; s < 8; s++) {
      const step = new Mesh(new BoxGeometry(2.4, 0.3, 1), MAT.stone);
      step.position.set(0, s * 0.5, s * 0.9 - 3); step.castShadow = true; flight.add(step);
    }
    flight.position.set(sx * 7, 2.6, -1); flight.rotation.y = sx * 0.55;
    g.add(flight); flights.push({ node: flight, base: sx * 0.55, amp: 0.22 });
  }
  const ch = chandelier(g, 0, H - 5, 1);
  for (const [x, z] of [[-W / 2 + 0.3, -6], [-W / 2 + 0.3, 6], [W / 2 - 0.3, -6], [W / 2 - 0.3, 6]]) torch(g, x, 4, z);
  HOUSE.forEach((c, i) => banner(g, (i < 2 ? -1 : 1) * (W / 2 - 0.5), 10, -5 + (i % 2) * 10, c, (i < 2 ? 1 : -1) * Math.PI / 2));
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
function classrooms() {
  const g = new Group(); const cols = []; const W = 28, D = 18, H = 9;
  shell(g, cols, W, D, H, { open: ['s'], floorColor: 0xa39884, floorTile: 3 });
  [[-9, 0x223a6a], [0, 0x6a1f2c], [9, 0x2a4a3a]].forEach(([x, c]) => carpet(g, x, -2.5, 7, 7, c));
  for (const x of [-4.5, 4.5]) { column(g, x, -D / 2 + 1.2, H, 0.4); column(g, x, 3, H, 0.4); }
  for (const x of [-9, 0, 9]) window2(g, x, 5.4, -D / 2 + 0.25, 0, x < 0 ? 0x9fc0ff : x > 0 ? 0x9fe8b0 : 0xffc98a).scale.setScalar(0.62);
  for (const [x, z] of [[-W / 2 + 0.4, -3], [W / 2 - 0.4, -3], [-W / 2 + 0.4, 5], [W / 2 - 0.4, 5]]) torch(g, x, 3.6, z);
  const ch = chandelier(g, 0, H - 1.4, 1.5);
  return room(g, cols, { x: 0, z: D / 2 - 4.5, yaw: Math.PI }, {
    id: 'classrooms', portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'staircase' }],
    update: (dt, t) => { for (const f of ch.userData.flames) f.material.emissiveIntensity = 2 + Math.sin(t * 8 + f.position.x) * 0.4; },
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
