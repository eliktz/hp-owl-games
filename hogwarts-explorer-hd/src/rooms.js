// The castle interiors, each built from the textured interior-kit + furniture (no exterior
// GLBs are ever placed indoors — that was the old "corrupted tower" bug). Rooms live in a
// hidden pocket far BELOW the grounds (FLOOR_Y); dense warm fog hides the void. Each room
// returns walkable `portals` (doorway zones) so you can stroll between rooms and back out.
import {
  Group, Mesh, BoxGeometry, MeshStandardMaterial, Color,
} from 'three';
import {
  MAT, floor, wall, ceiling, column, candle, torch, longTable, window2, banner,
  enchantedCeiling, emissive,
} from './interior-kit.js';
import { carpet, headTable, bookshelf, armchair, fireplace, archway, chandelier } from './furniture.js';

export const FLOOR_Y = -200;
// Gryffindor red, Ravenclaw blue, Hufflepuff gold, Slytherin green.
const HOUSE = [0x7a1020, 0x1a3a6a, 0xb08a1a, 0x1a5a2a];

// Four axis-aligned walls + floor + ceiling; pushes box colliders. `open` lists wall sides
// ('s'|'n'|'e'|'w') to leave as a walkable doorway gap (split into two stubs, no centre block).
function shell(g, cols, W, D, H, { ceil = true, open = [] } = {}) {
  floor(g, W, D);
  if (ceil) ceiling(g, W, D, H);
  const t = 1, GAP = 3.6;
  const sides = {
    s: { x: 0, z: D / 2, w: W, horizontal: true }, n: { x: 0, z: -D / 2, w: W, horizontal: true },
    e: { x: W / 2, z: 0, w: D, horizontal: false }, w: { x: -W / 2, z: 0, w: D, horizontal: false },
  };
  for (const [key, s] of Object.entries(sides)) {
    if (open.includes(key)) {
      const stub = (s.w - GAP) / 2, off = (GAP + stub) / 2;
      for (const sgn of [-1, 1]) {
        const cx = s.horizontal ? sgn * off : s.x, cz = s.horizontal ? s.z : sgn * off;
        const ww = s.horizontal ? stub : t, dd = s.horizontal ? t : stub;
        wall(g, cx, cz, ww, H, dd, 0); cols.push({ type: 'box', x: cx, z: cz, hw: ww / 2, hd: dd / 2, angle: 0 });
      }
    } else {
      const ww = s.horizontal ? s.w : t, dd = s.horizontal ? t : s.w;
      wall(g, s.x, s.z, ww, H, dd, 0); cols.push({ type: 'box', x: s.x, z: s.z, hw: ww / 2, hd: dd / 2, angle: 0 });
    }
  }
}

// Shared wrapper: parks the room at FLOOR_Y, animates candles/fires, exposes portals.
function room(g, cols, spawn, { flames = [], portals = [], update } = {}) {
  g.position.y = FLOOR_Y;
  for (const p of portals) p.armed = false;
  return {
    group: g, colliders: cols, portals,
    spawn: { x: spawn.x, z: spawn.z, y: FLOOR_Y, yaw: spawn.yaw ?? 0 },
    update(dt, t) {
      for (const c of flames) {
        c.position.y = c.userData.baseY + Math.sin(t * 3 + c.position.x) * 0.15;
        c.userData.flame.material.emissiveIntensity = 2 + Math.sin(t * 9 + c.position.z) * 0.4;
      }
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
  for (const sx of [-W / 2 + 0.4, W / 2 - 0.4]) for (const z of [-5, 3, 9]) torch(g, sx, 4.4, z);
  HOUSE.forEach((c, i) => banner(g, (i < 2 ? -1 : 1) * (W / 2 - 0.5), 7, -4 + (i % 2) * 8, c, (i < 2 ? 1 : -1) * Math.PI / 2));
  const flames = [];
  const portals = [
    { x: 0, z: D / 2 - 1.2, r: 1.6, to: 'out' },            // south doors -> grounds
    { x: -W / 2 + 1.2, z: 2, r: 1.5, to: 'greathall' },
    { x: W / 2 - 1.2, z: 2, r: 1.5, to: 'library' },
  ];
  return room(g, cols, { x: 0, z: D / 2 - 5, yaw: Math.PI }, {
    flames, portals,
    update: (dt, t) => { for (const f of ch.userData.flames) f.material.emissiveIntensity = 2 + Math.sin(t * 8 + f.position.x) * 0.4; },
  });
}

// ---- The Great Hall: four long tables, a head table on a dais, floating candles ---------
function greatHall() {
  const g = new Group(); const cols = []; const W = 20, D = 36, H = 15;
  shell(g, cols, W, D, H, { ceil: false, open: ['s'] });   // south doorway -> Entrance Hall
  enchantedCeiling(g, W, D, H);
  const flames = [];
  for (const tx of [-6, 6]) for (const tz of [-7, 8]) {
    longTable(g, tx, tz, 15);
    for (let i = -6; i <= 6; i += 3) { const c = candle(tx, 7 + Math.sin(i) * 0.4, tz + i); g.add(c); flames.push(c); }
  }
  for (let x = -W / 2 + 4; x <= W / 2 - 4; x += 6) { column(g, x, -D / 2 + 1.2, H); column(g, x, D / 2 - 1.2, H); }
  for (const sx of [-W / 2 + 0.2, W / 2 - 0.2]) for (const z of [-10, 0, 10]) window2(g, sx, 7, z, sx < 0 ? Math.PI / 2 : -Math.PI / 2);
  HOUSE.forEach((c, i) => banner(g, (i < 2 ? -1 : 1) * (W / 2 - 0.6), 10, -6 + (i % 2) * 12, c, (i < 2 ? 1 : -1) * Math.PI / 2));
  headTable(g, -D / 2 + 3.5, 0, W - 6).rotation.y = Math.PI / 2;
  for (const [x, z] of [[-W / 2 + 0.5, 12], [W / 2 - 0.5, 12]]) torch(g, x, 5, z);
  return room(g, cols, { x: 0, z: 9, yaw: Math.PI }, {
    flames, portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'entrancehall' }],
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
  return room(g, cols, { x: 0, z: D / 2 - 5, yaw: Math.PI }, {
    flames, portals: [{ x: -W / 2 + 1.2, z: 0, r: 1.5, to: 'entrancehall' }],
    update: (dt, t) => { for (const f of ch.userData.flames) f.material.emissiveIntensity = 2 + Math.sin(t * 8 + f.position.z) * 0.4; },
  });
}

// ---- A cosy common room: hearth, armchairs, a warm rug ----------------------------------
function commonRoom() {
  const g = new Group(); const cols = []; const W = 16, D = 16, H = 7;
  shell(g, cols, W, D, H);
  carpet(g, 0, 1, 8, 6, 0x6a1420);
  const hp = fireplace(g, 0, -D / 2 + 0.8);
  for (const [sx, rot] of [[-3, 0.5], [3, -0.5], [0, Math.PI]]) armchair(g, sx, sx === 0 ? 4 : 0, rot);
  bookshelf(g, -W / 2 + 0.8, 5, 1); bookshelf(g, W / 2 - 0.8, 5, -1);
  for (const [x, z] of [[-W / 2 + 0.4, 2], [W / 2 - 0.4, 2]]) torch(g, x, 3.4, z);
  banner(g, 0, 4.5, -D / 2 + 0.3, HOUSE[0]);
  return room(g, cols, { x: 0, z: D / 2 - 5, yaw: Math.PI }, {
    update: (dt, t) => { hp.fire.material.emissiveIntensity = 1.7 + Math.sin(t * 7) * 0.35; },
  });
}

// ---- The grand moving staircases --------------------------------------------------------
function staircase() {
  const g = new Group(); const cols = []; const W = 20, D = 20, H = 24;
  shell(g, cols, W, D, H);
  const flights = [];
  for (let f = 0; f < 4; f++) {
    const flight = new Group();
    for (let s = 0; s < 10; s++) {
      const step = new Mesh(new BoxGeometry(3, 0.3, 1), MAT.stone);
      step.position.set(0, s * 0.55, s * 0.9 - 4.5); step.castShadow = true; flight.add(step);
    }
    const a = f * Math.PI / 2;
    flight.position.set(Math.cos(a) * 5, 1 + f * 3.2, Math.sin(a) * 5); flight.rotation.y = a;
    g.add(flight); flights.push({ node: flight, base: a, amp: 0.25 + f * 0.05 });
  }
  for (const [x, z] of [[-W / 2 + 0.3, -6], [-W / 2 + 0.3, 6], [W / 2 - 0.3, 0]]) torch(g, x, 4, z);
  HOUSE.forEach((c, i) => banner(g, (i < 2 ? -1 : 1) * (W / 2 - 0.5), 10, -5 + (i % 2) * 10, c, (i < 2 ? 1 : -1) * Math.PI / 2));
  return room(g, cols, { x: 0, z: D / 2 - 5, yaw: Math.PI }, {
    update: (dt, t) => { for (const fl of flights) fl.node.rotation.y = fl.base + Math.sin(t * 0.3 + fl.base) * fl.amp; },
  });
}

export const BUILDERS = { entrancehall: entranceHall, greathall: greatHall, staircase, library, commonroom: commonRoom };
