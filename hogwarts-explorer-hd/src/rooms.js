// The castle interiors, each built from the textured interior-kit + furniture (no exterior
// GLBs are ever placed indoors — that was the old "corrupted tower" bug). Rooms live in a
// hidden pocket far BELOW the grounds (FLOOR_Y); dense warm fog hides the void. Each room
// returns walkable `portals` (doorway zones) so you can stroll between rooms and back out.
import {
  Group, Mesh, BoxGeometry, MeshStandardMaterial, Color, DoubleSide, SphereGeometry, CylinderGeometry, CircleGeometry, TorusGeometry,
  InstancedMesh, Object3D, ConeGeometry, PlaneGeometry,
} from 'three';
import {
  MAT, stoneMat, floor, wall, ceiling, column, candle, torch, longTable, window2, banner,
  enchantedCeiling, emissive, glassGlow, mergeStatic, greatWindow, woodMat,
} from './interior-kit.js';
import { hallRoof, hallBanners, heightShade } from './hall-film.js';
import { timberCeiling, grandDoors, windowLight, propMesh, bookcases, floatingBooks, nightWindows, rug } from './room-film.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { carpet, headTable, bookshelf, armchair, fireplace, archway, chandelier } from './furniture.js';
import { bakeLight } from './atmosphere.js';
import { decorate } from './decor.js';
import { addDumbledore } from './dumbledore.js';
import { showerDoor, showerHall } from './showers.js';
import { secretDoor, secretRoom } from './secret-rooms.js';
import { liftables } from './liftables.js';
import { brokenBooks, brokenSideTable, brokenJar, brokenHourglass, dish, emptyVase } from './real-things-kit.js';

export const FLOOR_Y = -200;
// Gryffindor red, Ravenclaw blue, Hufflepuff gold, Slytherin green.
const HOUSE = [0x7a1020, 0x1a3a6a, 0xb08a1a, 0x1a5a2a];

// Four axis-aligned walls + floor + ceiling; pushes box colliders. `open` lists wall sides
// ('s'|'n'|'e'|'w') to leave as a walkable doorway gap (split into two stubs, no centre block).
function shell(g, cols, W, D, H, { ceil = true, open = [], floorColor = 0x9a8f7e, floorTile = 2.5, ceilColor = 0x3c3850, floorRough = 0.92, wallColor, wallSegs = 1, floorWood } = {}) {
  if (floorWood) {                                          // oak boards instead of flagstones
    const f = new Mesh(new PlaneGeometry(W, D), woodMat(W / 2.2, D / 3.2, floorWood)); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; g.add(f);
  } else floor(g, W, D, floorColor, floorTile, floorRough);
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
    const markers = [];
    const spots = flames.map((c) => { g.remove(c); const o = new Object3D(); o.position.copy(c.position); o.userData.light = c.userData.light; g.add(o); markers.push(o); return { x: c.position.x, y: c.position.y, z: c.position.z }; });
    g.add(wax, fl);
    // freecast-real.js (spells on the real candles): a per-candle flame size (1 lit, 0 out) + each candle's light marker
    const flameK = new Float32Array(n).fill(1);
    fl.userData.real = { flameK, spots, markers };
    candleTick = (t) => {
      for (let i = 0; i < n; i++) {
        const p = spots[i], y = p.y + (p.y > 3 ? Math.sin(t * 3 + p.x) * 0.15 : 0);   // only the floating ones bob
        d.position.set(p.x, y, p.z); d.scale.set(1, 1, 1); d.updateMatrix(); wax.setMatrixAt(i, d.matrix);
        const fk = flameK[i]; d.position.y = y + 0.3; d.scale.set(fk, 1.6 * fk, fk); d.updateMatrix(); fl.setMatrixAt(i, d.matrix);
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
  const showers = showerDoor(g);                            // west wall, z 7: the oak door + towel sign to the shower hall (showers.js)
  const broom = secretDoor(g, 'broomcupboard');             // east wall, z 4.8: the locked door to the broom cupboard (secret-rooms.js)
  // Everything static that shares a material merges (walls, steps, arches, doors' stone, torches,
  // carpet); the chandelier keeps swinging on its own.
  mergeStatic(g, g.children.filter(c => c !== ch));
  g.add(broom.live);                                        // its leaf + padlock + glow move: kept out of the merge
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
    showers.portal,                                          // west wall door -> the shower hall
    broom.portal,                                            // east wall locked door -> the broom cupboard (live once Alohomora opens it)
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
  // batch 8 (freecast-real-objects.js): three goblets and two platters on the house tables near the doors are liftable:
  // their instances are hidden (zero scale) and the same gold cylinders stand in their place, drawn by liftables.js
  const LF = liftables(g, { ceil: H }), LIFT = { '-5,9': { cups: [1, 2], plates: [3] }, '5,9': { cups: [2], plates: [1] } };
  const zero = new Object3D(); zero.scale.set(0, 0, 0); zero.updateMatrix();
  for (const tx of [-5, 5]) for (const tz of [-6, 9]) {
    const tg = longTable(g, tx, tz, 16), pick = LIFT[tx + ',' + tz];
    if (pick) {
      const ats = tg.userData.tableAt, cups = tg.getObjectByName('table-cups'), plates = tg.getObjectByName('table-plates');
      for (const i of pick.cups) { const p = ats[i]; cups.setMatrixAt(i, zero.matrix);
        LF.add('goblet-' + (tx < 0 ? 'w' : 'e') + i, { kind: 'goblet', mat: 'plain', material: MAT.gold, pivot: [tx + 0.5, 0.99, tz + p - 0.4], h: 0.26, size: 0.15,
          parts: [new CylinderGeometry(0.1, 0.13, 0.26, 10).translate(tx + 0.5, 1.12, tz + p - 0.4)] }); }
      for (const i of pick.plates) { const p = ats[i]; plates.setMatrixAt(i, zero.matrix);
        LF.add('platter-' + (tx < 0 ? 'w' : 'e') + i, { kind: 'platter', mat: 'plain', material: MAT.gold, pivot: [tx, 0.995, tz + p], h: 0.05, size: 0.3,
          parts: [new CylinderGeometry(0.28, 0.24, 0.05, 14).translate(tx, 1.02, tz + p)] }); }
      cups.instanceMatrix.needsUpdate = true; plates.instanceMatrix.needsUpdate = true;
    }
    for (let i = -6; i <= 6; i += 4) { const c = candle(tx, 1.45, tz + i); c.userData.light.top = 1.035; g.add(c); flames.push(c); }
  }
  // batch 9 (freecast-real-things.js): six real dishes on the two house tables by the doors (Engorgio / Reducio).
  // decor.js lays the feast as instanced blobs; these six feast instances are hidden (zero scale, g.userData.feastHide)
  // and a roast, a pie, a jelly, a fruit bowl, a pudding and a cake stand in their places (drawn by liftables.js).
  // The same walk computes where the feast's big dishes sit, so Avis' birds perch on table edges clear of food.
  { const DISH = { 24: 'roast', 29: 'jelly', 34: 'fruit', 67: 'pie', 72: 'pudding', 77: 'cake' }, hide = [], food = [];
    let n = 0;
    for (const tx of [-5, 5]) for (const tz of [-6, 9]) for (let z = tz - 7.2; z <= tz + 7.2 && n < 88; z += 0.72) {
      const big = n % 5 === 0, s = big ? 1.5 : 0.7 + ((n * 7) % 5) * 0.1, x = tx + (((n * 5) % 7) - 3) * 0.09;
      if (DISH[n]) { hide.push(n); dish(LF, 'dish-' + DISH[n], DISH[n], x, 0.99, z); food.push({ tx, x, z, r: 0.34 }); }
      else food.push({ tx, x, z, r: 0.2 * s * (big ? 1.25 : 1) });
      n++;
    }
    g.userData.feastHide = hide;
    emptyVase(LF, 'vase-hall', -5.25, 0.99, 1.35, 0x3a5a9a);   // an empty vase at the north end of the Ravenclaw table (Orchideous)
    // perches: seats 0.3 m apart along each long table edge (top 0.99), skipping cups, big dishes, the vase and the ends
    const rows = [];
    for (const tx of [-5, 5]) for (const tz of [-6, 9]) for (const sd of [-1, 1]) {
      const ex = tx + sd * 0.7, seats = [];
      for (let z = tz - 7.4; z <= tz + 7.4; z += 0.3) {
        if (food.some(f => f.tx === tx && Math.abs(f.z - z) < f.r + 0.12 && (f.x - tx) * sd + f.r > 0.44)) continue;
        if (sd > 0 && [-6, -2.5, 1, 4.5].some(p => Math.abs(tz + p - 0.4 - z) < 0.3)) continue;   // the gold cups (x tx + 0.5)
        if (tx === -5 && tz === 9 && Math.abs(z - 1.35) < 0.4) continue;
        seats.push([+ex.toFixed(3), 0.99, +z.toFixed(3)]);
      }
      rows.push({ tx, tz, side: sd, seats });
    }
    g.userData.perchRows = rows; }
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
  LF.finish();
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

// ---- The library: tall oak bookcases, green reading lamps, the Restricted Section ------------
// Film look: honey stone walls lined floor-to-corbel with dark oak bookcases full of leather
// spines (one shared spine canvas), free-standing stacks making aisles from the door, two long
// reading tables under green-shaded lamps with warm pools, a few books drifting in the air,
// daylight shafts from the east windows, a timbered ceiling, and at the far end the barred
// gate of the Restricted Section with a cold glow behind it. Baked height falloff throughout.
function library() {
  const g = new Group(); const cols = []; const W = 22, D = 22, H = 10;
  const WALL = 0xa88a68;
  shell(g, cols, W, D, H, { ceil: false, open: ['w'], wallColor: WALL, wallSegs: 5, floorWood: 0x6a4a30 });   // west doorway -> Entrance Hall
  timberCeiling(g, W - 1, D - 1, H, { along: 'x', at: [-9, -5.4, -1.8, 1.8, 5.4, 9], joist: 1.25, corbel: WALL, brace: 1.3 });
  archway(g, -W / 2 + 0.3, 0, Math.PI / 2);
  const LF = liftables(g, { ceil: H });   // batch 8 (see below)
  // the Restricted Section: a dark arch in the north wall behind an iron gate, a cold glow beyond
  archway(g, 0, -D / 2 + 0.55, 0, { w: 2.6, h: 4.2 });
  const glowR = new Group(); glowR.position.set(0, 0.5, -D / 2 + 1.6); glowR.userData.light = { k: 'glow', c: 0x4fd0c0, r: 2.6, a: 0.28 }; g.add(glowR);
  const veil = new Mesh(new PlaneGeometry(2.6, 4.2), emissive(0x0c3436, 0.45)); veil.position.set(0, 2.1, -D / 2 + 0.67); g.add(veil);   // the glow deep in the doorway
  // bookcases: along the north and south walls, the east wall between the windows, the west wall
  // beside the door, and four free-standing double-sided stacks making aisles from the door
  const IN = W / 2 - 0.5, d = 0.62, c = IN - d / 2;   // wall inner face, case depth, case centre line
  const cases = [
    { x: -6.45, z: -c, w: 7.9, a: 0 }, { x: 6.45, z: -c, w: 7.9, a: 0 },                       // north, either side of the gate
    { x: -5.25, z: c, w: 10.3, a: Math.PI }, { x: 5.25, z: c, w: 10.3, a: Math.PI },           // south
    { x: c, z: 0, w: 3.4, a: -Math.PI / 2 }, { x: c, z: -7.6, w: 4.2, a: -Math.PI / 2 }, { x: c, z: 7.6, w: 4.2, a: -Math.PI / 2 },   // east, between the windows
    { x: -c, z: -6.6, w: 6.4, a: Math.PI / 2 }, { x: -c, z: 6.6, w: 6.4, a: Math.PI / 2 },      // west, beside the door
    { x: -6.2, z: -5.6, w: 5, h: 4.4, d: 0.8, a: Math.PI / 2, both: true }, { x: -6.2, z: 5.6, w: 5, h: 4.4, d: 0.8, a: Math.PI / 2, both: true },   // stacks: aisles from the door
  ];
  bookcases(g, cases, cols, { wood: 0x3a2414 });
  // two shelf books in the south cases (row 2 and row 1, mid-bay): their spines sit 2 cm proud of the shelf's spine row,
  // and Leviosa / Accio slide them out (-z, into the room) first
  for (const [bx, by, hex, n] of [[3.35, 0.24 + 2 * 0.5145 + 0.025, 0x6e2418, 1], [7.15, 0.24 + 0.5145 + 0.025, 0x1c2c48, 2]]) {
    const bz = c - (d / 2 - 0.14) + 0.08;
    LF.add('book-shelf-' + n, { kind: 'book', pivot: [bx, by, bz], h: 0.32, size: 0.3, slide: [0, -1],
      parts: [[new BoxGeometry(0.06, 0.32, 0.2).translate(bx, by + 0.16, bz), hex], [new BoxGeometry(0.062, 0.02, 0.202).translate(bx, by + 0.25, bz), 0xb8903e], [new BoxGeometry(0.062, 0.02, 0.202).translate(bx, by + 0.06, bz), 0xb8903e]] });
  }
  // two long reading tables (oak, the same wood as the cases) with chairs, green lamps and books
  // batch 8 (freecast-real-objects.js): a chair, two table books and two shelf books are liftable (same geometry, drawn by liftables.js)
  let sink = null;
  const P = [], at = (geo, hex, x, y, z, ry = 0) => { if (ry) geo.rotateY(ry); geo.translate(x, y, z); (sink || P).push([geo, hex]); };
  const T = [];
  const TOP = 0.86, lampSpots = [];
  for (const tz of [-4.2, 4.2]) {
    const tw = 1.5, tl = 5.2;
    T.push(new BoxGeometry(tw, 0.1, tl).translate(0, TOP - 0.05, tz));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) T.push(new BoxGeometry(0.12, TOP - 0.1, 0.12).translate(sx * (tw / 2 - 0.15), (TOP - 0.1) / 2, tz + sz * (tl / 2 - 0.2)));
    T.push(new BoxGeometry(0.08, 0.1, tl - 0.6).translate(0, 0.25, tz));                                            // stretcher
    for (const sx of [-1, 1]) for (const k of [-1.6, 0, 1.6]) {                                                     // chairs
      const cx = sx * 1.15, cz = tz + k, lift = tz > 0 && sx > 0 && k > 0, CT = lift ? [] : T;
      CT.push(new BoxGeometry(0.46, 0.06, 0.46).translate(cx, 0.48, cz), new BoxGeometry(0.06, 0.62, 0.42).translate(cx + sx * 0.22, 0.82, cz));
      for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) CT.push(new BoxGeometry(0.05, 0.46, 0.05).translate(cx + lx, 0.23, cz + lz));
      if (lift) LF.add('chair', { kind: 'chair', mat: 'tex', material: woodMat(1, 3, 0x5a3a22), pivot: [cx, 0, cz], parts: CT, h: 1.13, size: 0.5, furniture: true });
    }
    cols.push({ type: 'box', x: 0, z: tz, hw: 1.45, hd: tl / 2, angle: 0 });
    for (const [lx, lz] of [[0.35, -1.3], [-0.35, 1.3]]) lampSpots.push([lx, tz + lz]);
    // open books, a quill and inkpot, a stack on each table
    for (const [bx, bz, ry] of [[-0.3, tz - 0.4, 0.3], [0.32, tz + 0.5, -0.2], [-0.25, tz + 1.9, 0.1]]) {
      const lift = tz > 0 && bz > tz + 1, BP = lift ? [] : null; sink = BP;
      at(new BoxGeometry(0.42, 0.03, 0.3), 0xe8dcb6, bx, TOP + 0.015, bz, ry); at(new BoxGeometry(0.02, 0.035, 0.3), 0x5a1e1a, bx, TOP + 0.017, bz, ry);
      sink = null; if (lift) LF.add('book-open', { kind: 'book', pivot: [bx, TOP, bz], parts: BP, h: 0.04, size: 0.3 });
    }
    let y = TOP; for (let i = 0; i < 4; i++) {
      const h = 0.07 + (i % 2) * 0.03, lift = tz > 0 && i === 3, BP = lift ? [] : null; sink = BP;
      at(new BoxGeometry(0.34, h, 0.25), [0x5a1e1a, 0x1f3b5e, 0x2c4a2a, 0x5a3a1e][i], 0.4, y + h / 2, tz - 2, i * 0.3);
      sink = null; if (lift) LF.add('book-stack', { kind: 'book', pivot: [0.4, y, tz - 2], parts: BP, h, size: 0.3 });
      y += h;
    }
    at(new CylinderGeometry(0.035, 0.04, 0.06, 8), 0x101014, -0.45, TOP + 0.03, tz + 0.9); const q = new ConeGeometry(0.03, 0.34, 5); q.rotateZ(0.5); at(q, 0xf2ece0, -0.4, TOP + 0.2, tz + 0.9);
  }
  const tables = new Mesh(mergeGeometries(T, false), woodMat(1, 3, 0x5a3a22)); tables.castShadow = true; g.add(tables);   // warmer oak than the cases
  // green-shaded brass reading lamps: a warm pool on the table and a soft glow under each shade
  const shades = [];
  for (const [lx, lz] of lampSpots) {
    at(new CylinderGeometry(0.11, 0.13, 0.04, 12), 0xb8902a, lx, TOP + 0.02, lz); at(new CylinderGeometry(0.018, 0.018, 0.36, 6), 0xb8902a, lx, TOP + 0.2, lz);
    at(new CylinderGeometry(0.012, 0.012, 0.3, 5), 0xb8902a, lx, TOP + 0.38, lz, Math.PI / 2);
    const sh = new CylinderGeometry(0.08, 0.13, 0.16, 12, 1, true); sh.scale(1, 1, 1.9); sh.translate(lx, TOP + 0.42, lz); shades.push(sh);
    const o = new Group(); o.position.set(lx, TOP + 0.04, lz); o.userData.light = { k: 'candle', c: 0xffc878, top: TOP + 0.005 }; g.add(o);   // (halo just under the shade)
  }
  const shadeMesh = new Mesh(mergeGeometries(shades, false), emissive(0x14804a, 1.0)); shadeMesh.material.side = DoubleSide; shadeMesh.name = 'lamp-shades'; g.add(shadeMesh);   // deep emerald glass
  // a rug from the door to the tables, a library ladder against the east cases, the gate
  rug(g, -5.4, 0, 6.8, 3.2);
  for (const sy of [-1, 1]) { const rail = new BoxGeometry(0.06, 5.2, 0.06); rail.rotateZ(0.18); at(rail, 0x3a2414, c - 0.95, 2.55, -7.6 + sy * 0.3); }
  for (let k = 0; k < 13; k++) at(new BoxGeometry(0.05, 0.05, 0.6), 0x3a2414, c - 0.47 - k * 0.07 + 0.42, 0.2 + k * 0.38, -7.6);
  for (let k = -6; k <= 6; k++) at(new CylinderGeometry(0.022, 0.022, 4.1, 5), 0x1c1c22, k * 0.2, 2.05, -D / 2 + 0.95);   // the Restricted Section gate
  for (const y of [0.4, 2.2, 4.0]) at(new BoxGeometry(2.7, 0.06, 0.05), 0x1c1c22, 0, y, -D / 2 + 0.95);
  at(new BoxGeometry(0.16, 0.22, 0.08), 0x6a5a3a, 0.2, 1.3, -D / 2 + 1.0);                                                // padlock
  cols.push({ type: 'box', x: 0, z: -D / 2 + 0.95, hw: 1.4, hd: 0.2, angle: 0 });
  propMesh(g, P, 'library-props');
  // batch 9 (freecast-real-things.js): a toppled stack of books with loose pages by the north cases (Reparo), an empty
  // vase on the north reading table (Orchideous)
  brokenBooks(LF, 3.6, -9.0);
  emptyVase(LF, 'vase-lib', -0.42, TOP, -6.3, 0x2a6a4a);
  // east windows (daylight shafts across the floor toward the tables)
  const WS = 0.75, WY = 5.6, sun = [];
  for (const z of [-3.6, 3.6]) { window2(g, W / 2 - 0.54, WY, z, -Math.PI / 2, 0xffc98a, 1.2, 'class').scale.setScalar(WS); sun.push({ x: W / 2 - 0.6, y: WY, z, nx: -1, nz: 0, w: 2.2 * WS, h: 6.1 * WS }); }
  // warm torches at the door and in the reading aisle (low, wide washes)
  for (const z of [-2.5, 2.5]) torch(g, -W / 2 + 0.4, 3.4, z, 0xff8a2a, { shared: true, wash: 3, glowBall: false });
  mergeStatic(g, g.children.slice());
  const stoneHex = [WALL, 0x8f8a80].map(h => new Color(h).getHex());
  heightShade(g.children.filter(m => m.isMesh && !m.isInstancedMesh && m.material.map && m.material.color && stoneHex.includes(m.material.color.getHex()) && m.name !== 'corbels'),
    { y0: 2, y1: H - 0.5, k0: 1.12, k1: 0.34 });
  const oak = woodMat(1, 3, 0x3a2414);   // the cases and tables (merged: one material)
  heightShade(g.children.filter(m => m.isMesh && (m.material === oak || m.material.name === 'book-spines')), { y0: 1.2, y1: 6.4, k0: 1.08, k1: 0.5 });
  const daylight = windowLight(g, sun, { slope: 1.15, strength: 0.75 });
  // a few books drifting over the tables and the stacks
  LF.finish();
  const fly = floatingBooks(g, [[-1.4, 3.1, -5.2], [1.2, 3.6, -3], [0.4, 4.2, 3.4], [-1.1, 3.4, 5.6], [-6.2, 5.6, -3.4], [-6.2, 5.2, 3], [6.4, 5.4, -2.2], [2.8, 4.6, 0.4]].map(([x, y, z]) => ({ x, y, z })));
  return room(g, cols, { x: 4, z: D / 2 - 3.6, yaw: Math.PI }, {      // beside the reading table (the old spawn stood inside it)
    id: 'library',
    portals: [{ x: -W / 2 + 1.2, z: 0, r: 1.5, to: 'entrancehall' }],
    update: (dt, t) => { daylight.update(t); fly.update(t); shadeMesh.material.emissiveIntensity = 1.0 + Math.sin(t * 1.3) * 0.04; },
  });
}

// ---- The Gryffindor common room: firelit crimson and gold --------------------------------
// Film look: the hearth is the light. A great stone fireplace with a chimney breast throws a warm
// pool across a patterned crimson rug and washes the stone around it; deep red wing chairs and a
// sofa face the fire; oak panelling below honey stone, long lion banners, round-headed leaded
// windows onto the night sky, a notice board by the door, a timbered ceiling falling into
// shadow (baked height falloff). Wave the wand at the hearth: the flames roar up emerald green.
function commonRoom() {
  const g = new Group(); const cols = []; const W = 18, D = 18, H = 9.5;
  const WALL = 0xa8805a;
  shell(g, cols, W, D, H, { ceil: false, open: ['s'], wallColor: WALL, wallSegs: 5, floorWood: 0x6e4428 });   // south door -> staircase hall
  timberCeiling(g, W - 1, D - 1, H, { along: 'x', at: [-6.4, -2.2, 2.2, 6.4], joist: 1.2, corbel: WALL, brace: 1.2, wood: 0x3e2616 });
  const hp = fireplace(g, 0, -D / 2 + 0.8);
  // the fire: tongues of flame on the glowing bed (they share its material: they flicker, grow and
  // turn green with it), a chimney breast up to the beams, a hearth stone
  { const f = hp.fire; f.scale.set(1, 1, 1); const L = [];
    for (const [fx, fh, fr] of [[-0.75, 0.9, 0.3], [-0.25, 1.35, 0.36], [0.3, 1.15, 0.34], [0.8, 0.8, 0.28], [0.02, 0.7, 0.5]]) { const cg = new ConeGeometry(fr, fh, 7); cg.translate(fx, fh / 2 - 0.3, 0.02); L.push(cg); }
    const tongues = new Mesh(mergeGeometries(L, false), f.material); tongues.name = 'fire-tongues'; f.add(tongues);
    f.geometry.dispose(); f.geometry = new BoxGeometry(2.4, 0.5, 0.4); }
  const chim = new Mesh(new BoxGeometry(4.6, H - 3.75, 1.1), stoneMat(4.6 / 3, (H - 3.75) / 3, WALL)); chim.position.set(0, 3.75 + (H - 3.75) / 2, -D / 2 + 0.95); g.add(chim);
  const hearthStone = new Mesh(new BoxGeometry(5.6, 0.12, 1.6), MAT.stone); hearthStone.position.set(0, 0.06, -D / 2 + 1.9); g.add(hearthStone);
  cols.push({ type: 'box', x: 0, z: -D / 2 + 1.0, hw: 2.9, hd: 0.9, angle: 0 });
  // firelight: the big floor pool comes from the fireplace's own 'fire' marker; add a warm wash on
  // the chimney wall and the side walls nearest the fire, and a glow on the hearth stone
  for (const [x, z, wr, wa] of [[0, -D / 2 + 1.6, 4.6, 0.3], [-W / 2 + 0.6, -5.6, 4.2, 0.3], [W / 2 - 0.6, -5.6, 4.2, 0.3]]) {
    const o = new Group(); o.position.set(x, 2.0, z); o.userData.light = { k: 'torch', c: 0xff9440, wr, noHalo: true, wa, fr: 4.2, fa: 0.22 }; o.userData.hearthLight = true; g.add(o);
  }
  const ember = new Group(); ember.position.set(0, 0.2, -D / 2 + 2.4); ember.userData.light = { k: 'glow', c: 0xff7a2a, r: 3.4, a: 0.4 }; g.add(ember);
  const spill = new Group(); spill.position.set(0, 0.2, -1); spill.userData.light = { k: 'glow', c: 0xff9a50, r: 7.5, a: 0.13 }; g.add(spill);   // the fire's glow reaches the whole room
  ember.userData.hearthLight = spill.userData.hearthLight = true;   // (freecast-real.js dims these with the fire)
  // freecast-real.js (Aguamenti / Incendio / Engorgio / Reducio on the real hearth): multipliers on the fire's size and glow
  const fc = hp.fire.userData.ctl = { sx: 1, sy: 1, glow: 1 };
  // wave the wand at the hearth: the flames roar up emerald green (Floo powder!), then settle back to orange
  let green = 0, mix = 0; const fireFrom = hp.fire.material.emissive.clone(), fireTo = new Color(0x2fe070);
  (g.userData.enchant = g.userData.enchant || []).push({ id: 'fire', obj: hp.fire, cast() { green = 5; try { window.HPFun.sfx.noise(1.4, 0.22, 0, 600, 0.5); window.HPFun.sfx.poof(); } catch { /* no audio yet */ } return '🔥'; } });
  g.userData.greenFire = () => green;
  // the rug, the wing chairs and a sofa round the fire (one vertex-coloured mesh for the furniture)
  rug(g, 0, -2.6, 8.4, 5.6);
  const P = [], RED = 0x6e161c, DEEP = 0x4a0e12, LEG = 0x2a1a10, GOLD = 0xb8903e;
  // batch 8 (freecast-real-objects.js): a wing chair's cushion, the chessboard and two books in the case are liftable (liftables.js)
  const LF = liftables(g, { ceil: H });
  const piece = (x, z, ry, into = P) => (geo, hex, lx, ly, lz) => { geo.translate(lx, ly, lz); geo.rotateY(ry); geo.translate(x, 0, z); into.push([geo, hex]); };
  const wingChair = (x, z, ry, cushion = false) => {
    const p = piece(x, z, ry);
    if (cushion) { const CP = []; piece(x, z, ry, CP)(new BoxGeometry(0.86, 0.2, 0.8), RED, 0, 0.5, 0.04);
      LF.add('cushion', { kind: 'cushion', pivot: [x + Math.sin(ry) * 0.04, 0.4, z + Math.cos(ry) * 0.04], parts: CP, h: 0.2, size: 0.45, furniture: true, b9: { grow: true, label: 'cushion' } });
    } else p(new BoxGeometry(0.86, 0.2, 0.8), RED, 0, 0.5, 0.04);
    p(new BoxGeometry(0.9, 0.24, 0.86), DEEP, 0, 0.3, 0);               // cushion, base
    const back = new BoxGeometry(0.9, 1.05, 0.2); back.rotateX(-0.12); p(back, RED, 0, 1.08, -0.38);
    for (const s of [-1, 1]) {
      const wing = new BoxGeometry(0.12, 0.62, 0.42); wing.rotateY(s * 0.25); p(wing, RED, s * 0.46, 1.18, -0.2);              // wings
      const arm = new CylinderGeometry(0.1, 0.1, 0.84, 10); arm.rotateX(Math.PI / 2); p(arm, RED, s * 0.47, 0.7, 0.02);        // rolled arms
      p(new BoxGeometry(0.14, 0.32, 0.8), DEEP, s * 0.47, 0.5, 0.02);
      for (const lz of [-0.32, 0.32]) p(new BoxGeometry(0.07, 0.18, 0.07), LEG, s * 0.38, 0.09, lz);                         // legs
    }
    p(new BoxGeometry(0.92, 0.03, 0.03), GOLD, 0, 0.42, 0.44);                                                               // brass piping
    cols.push({ type: 'circle', x, z, r: 0.62 });
  };
  wingChair(-3.4, -5.1, Math.PI - 0.6); wingChair(3.4, -5.1, Math.PI + 0.6); wingChair(-3.9, -1.2, Math.PI - 1.2, true);
  { const p = piece(1.2, -1.5, Math.PI + 0.35);                                                                              // the sofa
    p(new BoxGeometry(2.6, 0.26, 0.9), DEEP, 0, 0.3, 0); for (const sx of [-0.64, 0.64]) p(new BoxGeometry(1.24, 0.2, 0.8), RED, sx, 0.52, 0.05);
    const back = new BoxGeometry(2.6, 0.7, 0.22); back.rotateX(-0.1); p(back, RED, 0, 0.88, -0.36);
    for (const s of [-1, 1]) { const arm = new CylinderGeometry(0.15, 0.15, 0.9, 12); arm.rotateX(Math.PI / 2); p(arm, RED, s * 1.3, 0.62, 0); p(new BoxGeometry(0.22, 0.4, 0.9), DEEP, s * 1.3, 0.42, 0); }
    for (const sx of [-1.2, 1.2]) for (const lz of [-0.36, 0.36]) p(new BoxGeometry(0.08, 0.17, 0.08), LEG, sx, 0.085, lz);
    cols.push({ type: 'box', x: 1.2, z: -1.5, hw: 1.3, hd: 0.75, angle: 0 }); }
  { const p = piece(-1.5, -2.9, 0.2);                                                                                       // a low table with a chessboard
    p(new BoxGeometry(1.1, 0.06, 0.7), LEG, 0, 0.45, 0); for (const lx of [-0.48, 0.48]) for (const lz of [-0.28, 0.28]) p(new BoxGeometry(0.06, 0.42, 0.06), LEG, lx, 0.21, lz);
    const CB = [], pc = piece(-1.5, -2.9, 0.2, CB);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) pc(new BoxGeometry(0.09, 0.012, 0.09), (i + j) % 2 ? 0xd8c8a0 : 0x2a1c14, -0.135 + i * 0.09, 0.485, -0.135 + j * 0.09);
    LF.add('chessboard', { kind: 'chessboard', pivot: [-1.5, 0.479, -2.9], parts: CB, h: 0.012, size: 0.36, rattle: true, b9: { grow: true, label: 'chessboard' } });
    cols.push({ type: 'circle', x: -1.5, z: -2.9, r: 0.5 }); }
  // oak panelling round the lower walls (not across the doorway, the fireplace or the bookcase)
  const PAN = [], ph = 1.5, IN = W / 2 - 0.5;
  const panel = (x0, x1, z, axis) => {   // a run of wainscot along one wall: rail + stiles
    const len = x1 - x0, mid = (x0 + x1) / 2;
    const geo = (w, h, d, a, y, b) => (axis === 'x' ? new BoxGeometry(w, h, d).translate(a, y, b) : new BoxGeometry(d, h, w).translate(b, y, a));
    PAN.push(geo(len, ph, 0.06, mid, ph / 2, z), geo(len, 0.1, 0.12, mid, ph, z + (axis === 'x' ? Math.sign(-z) : Math.sign(-z)) * 0.03));
    for (let a = x0 + 0.05; a <= x1; a += 1.1) PAN.push(geo(0.08, ph - 0.1, 0.1, a, (ph - 0.1) / 2, z));
  };
  panel(-IN, -3.2, -IN + 0.03, 'x'); panel(3.2, IN, -IN + 0.03, 'x');
  panel(-IN, -1.9, IN - 0.03, 'x'); panel(1.9, IN, IN - 0.03, 'x');
  panel(-IN, IN, -IN + 0.03, 'z'); panel(-IN, 1.6, IN - 0.03, 'z');
  const panelling = new Mesh(mergeGeometries(PAN, false), woodMat(1, 1, 0x7a5232)); panelling.name = 'panelling'; g.add(panelling);
  // a bookcase by the door (east wall) and the notice board beside it
  bookcases(g, [{ x: W / 2 - 0.82, z: 4.6, w: 3, h: 4.2, a: -Math.PI / 2 }], cols, { wood: 0x3e2616, seed: 9 });
  for (const [bz, by, hex, n] of [[3.75, 0.24 + 2 * 0.5229 + 0.025, 0x5e3a1c, 1], [5.45, 0.24 + 0.5229 + 0.025, 0x234030, 2]]) {   // spines 2 cm proud of the row
    const bx = W / 2 - 0.82 - 0.16 + 0.08;
    LF.add('book-shelf-' + n, { kind: 'book', pivot: [bx, by, bz], h: 0.32, size: 0.3, slide: [-1, 0],
      parts: [[new BoxGeometry(0.2, 0.32, 0.06).translate(bx, by + 0.16, bz), hex], [new BoxGeometry(0.202, 0.02, 0.062).translate(bx, by + 0.25, bz), 0xb8903e], [new BoxGeometry(0.202, 0.02, 0.062).translate(bx, by + 0.06, bz), 0xb8903e]] });
  }
  { const bx = W / 2 - 0.53, bz = 0.6, B = (w, h, d, hex, y, z, ox = 0) => { const geo = new BoxGeometry(d, h, w); geo.translate(bx - ox, y, z); P.push([geo, hex]); };
    B(2.2, 1.4, 0.06, 0x2a1a10, 2.4, bz); B(2.0, 1.2, 0.04, 0x8a6440, 2.4, bz, 0.03);                                       // frame + cork
    let sd = 4; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let k = 0; k < 9; k++) {                                                                                          // notices, pinned
      const w = 0.24 + r() * 0.16, h = 0.2 + r() * 0.16, y = 1.98 + r() * 0.8, z = bz - 0.8 + r() * 1.6;
      B(w, h, 0.01, [0xe8dcb4, 0xd8c890, 0xf0e6c8, 0xc8d8a0][k % 4], y, z, 0.06);
      const pin = new SphereGeometry(0.025, 6, 4); pin.translate(bx - 0.09, y + h / 2 - 0.04, z); P.push([pin, k % 3 ? 0xa01818 : 0x1838a0]);
    } }
  // mantel candles (instanced in room()), a Gryffindor shield over the chimney is the banner below
  const flames = [];
  for (const x of [-2.2, -1.5, 1.5, 2.2]) { const cd = candle(x, 3.95, -D / 2 + 1.8); cd.userData.light = { k: 'candle', c: 0xffc070 }; g.add(cd); flames.push(cd); }
  propMesh(g, P, 'common-props');
  // batch 9 (freecast-real-things.js): a side table with a snapped leg in the north-east corner (Reparo), an empty vase
  // on the chess table's corner (Orchideous); the chessboard and the cushion also grow / shrink (b9.grow above)
  brokenSideTable(LF, 6.6, -6.9);
  emptyVase(LF, 'vase-common', -1.05, 0.48, -2.77, 0xb8903e);
  LF.finish();
  // round-headed leaded windows onto the night sky (west wall), a torch each side of the door
  nightWindows(g, [{ x: -IN + 0.06, y: 4.4, z: -2.4, a: Math.PI / 2 }, { x: -IN + 0.06, y: 4.4, z: 3.4, a: Math.PI / 2 }], { w: 1.8, h: 3.4 });
  for (const x of [-3, 3]) torch(g, x, 3.2, IN - 0.05, 0xff8a2a, { shared: true, wash: 2.6, glowBall: false });
  mergeStatic(g, g.children.filter(c => c !== hp.group && !flames.includes(c)));
  mergeStatic(hp.group, hp.group.children.filter(c => c !== hp.fire), 'hearth');
  const stoneHex = [WALL, 0x8f8a80].map(h => new Color(h).getHex());
  heightShade(g.children.filter(m => m.isMesh && !m.isInstancedMesh && m.material.map && m.material.color && stoneHex.includes(m.material.color.getHex()) && m.name !== 'corbels'),
    { y0: 1.6, y1: H - 0.5, k0: 1.12, k1: 0.3 });
  // long lion banners: over the mantel and between the windows / on the east wall
  const banners = hallBanners(g, [
    { x: 0, z: -D / 2 + 1.56, top: 8.4, house: 'gryffindor', len: 3.8, amp: 0.25 },
    { x: -IN + 0.12, z: 0.5, top: 7.6, house: 'gryffindor', axis: 'x', len: 4.4, amp: 0.3 },
    { x: IN - 0.12, z: -4.2, top: 7.6, house: 'gryffindor', axis: 'x', len: 4.4, amp: 0.3 },
  ], { w: 1.5, len: 4.4 });
  return room(g, cols, { x: 0, z: D / 2 - 5, yaw: Math.PI }, {
    id: 'commonroom', flames, portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'staircase' }],
    update: (dt, t) => {
      banners.update(t);
      if (green > 0) green -= dt;
      mix = Math.max(0, Math.min(1, mix + (green > 0 ? dt * 4 : -dt * 1.2)));
      const m = hp.fire.material;
      m.emissiveIntensity = (1.9 + Math.sin(t * 7) * 0.3 + Math.sin(t * 17.3) * 0.15 + mix * 1.2) * fc.glow;
      m.emissive.copy(fireFrom).lerp(fireTo, mix); m.color.copy(m.emissive);
      hp.fire.scale.set((1 + Math.sin(t * 5.1) * 0.03) * fc.sx, (1 + Math.sin(t * 6.3) * 0.07 + mix * (0.7 + 0.2 * Math.sin(t * 11))) * fc.sy, fc.sx); hp.fire.position.y = 0.55 + (hp.fire.scale.y - 1) * 0.6;
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
  const trophy = secretDoor(g, 'trophyroom');               // north wall, x 6.6 (mirrors the common room arch): the locked trophy room door
  const swaying = flights.map(f => f.node);
  mergeStatic(g, g.children.filter(c => !swaying.includes(c)));
  g.add(trophy.live);
  return room(g, cols, { x: 0, z: D / 2 - 5, yaw: Math.PI }, {
    id: 'staircase',
    portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'entrancehall' }, { x: -W / 2 + 1.2, z: 0, r: 1.5, to: 'classrooms' },
      { x: W / 2 - 1.2, z: 0, r: 1.5, to: 'tower' }, { x: -6.6, z: -D / 2 + 1.9, r: 1.3, to: 'commonroom' }, trophy.portal],
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
  // batch 9 (freecast-real-things.js): a knocked-over jar with a little spilled glow on a side table (Reparo)
  { const LF = liftables(g, { ceil: H }); brokenJar(LF, 7.0, 7.4); cols.push({ type: 'box', x: 7.0, z: 7.4, hw: 0.5, hd: 0.33, angle: 0 }); LF.finish(); }
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
  // batch 8 (freecast-real-objects.js): two chairs, the Defence stack of tomes and a quill + inkpot are liftable (liftables.js)
  const LF = liftables(g, { ceil: H }); let sink = null;
  const at = (geo, hex, x, y, z, ry = 0, rz = 0, rx = 0) => { if (rx) geo.rotateX(rx); if (rz) geo.rotateZ(rz); if (ry) geo.rotateY(ry); geo.translate(x, y, z); (sink || P).push([geo, hex]); };
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
  { const SP = []; sink = SP; pile(6.9, -6.7, 6, 1.1); sink = null;
    LF.add('book-stack', { kind: 'books', pivot: [6.9, 0, -6.7], parts: SP, h: 0.8, size: 0.45 }); }
  // (new in batch 8) two plain oak chairs behind desks, facing the boards: one at the back of Transfiguration, one tucked
  // beside the Charms pupil at the front left desk (that one is never lifted while the pupil stands there)
  for (const [cx, cz, n] of [[1.6, -0.2, 1], [-10.0, -2.35, 2]]) {
    const CP = [], W0 = 0x5a3a1e;
    CP.push([new BoxGeometry(0.44, 0.05, 0.44).translate(cx, 0.47, cz), W0], [new BoxGeometry(0.42, 0.5, 0.05).translate(cx, 0.76, cz + 0.2), W0]);
    for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) CP.push([new BoxGeometry(0.045, 0.45, 0.045).translate(cx + lx, 0.225, cz + lz), 0x3a2414]);
    LF.add('chair-' + n, { kind: 'chair', pivot: [cx, 0, cz], parts: CP, h: 1.01, size: 0.5, furniture: true });
    cols.push({ type: 'circle', x: cx, z: cz, r: 0.3 });
  }
  { const QP = [], ix = 10.75, iz = -0.6; sink = QP;   // a quill and inkpot on the Defence back desk
    at(new CylinderGeometry(0.035, 0.04, 0.06, 8), 0x101014, ix, TOP + 0.03, iz); const q = new ConeGeometry(0.03, 0.34, 5); q.rotateZ(0.5); at(q, 0xf2ece0, ix + 0.05, TOP + 0.2, iz);
    sink = null; LF.add('quill-ink', { kind: 'quill', pivot: [ix, TOP, iz], parts: QP, h: 0.3, size: 0.2 }); }
  propMesh(g, P, 'class-props');
  // batch 9 (freecast-real-things.js): a knocked-over hourglass on a side table in the south-east corner (Reparo)
  brokenHourglass(LF, 12.3, 7.0); cols.push({ type: 'box', x: 12.3, z: 7.0, hw: 0.45, hd: 0.3, angle: 0 });
  LF.finish();
  const forgotten = secretDoor(g, 'forgottenclass');        // south wall, x -9: the locked door to the forgotten classroom
  // Static pieces that share a material merge (walls, columns, window frames and glass, torches,
  // carpets, the chandelier's iron and its flames); lessons.js adds the boards and desks later.
  mergeStatic(g, g.children.filter(c => !flames.includes(c) && c !== ch));
  g.add(forgotten.live);
  mergeStatic(ch, [ch], 'chandelier');
  const stoneHex = [WALL, 0x7d7870].map(h => new Color(h).getHex());
  heightShade(g.children.filter(m => m.isMesh && !m.isInstancedMesh && m.material.map && m.material.color && stoneHex.includes(m.material.color.getHex()) && m.name !== 'corbels'),
    { y0: 2, y1: H - 0.5, k0: 1.15, k1: 0.36 });
  const daylight = windowLight(g, sun, { slope: 1.15, strength: 0.8 });
  return room(g, cols, { x: 0, z: D / 2 - 4.5, yaw: Math.PI }, {
    id: 'classrooms', flames, portals: [{ x: 0, z: D / 2 - 1.2, r: 1.6, to: 'staircase' }, forgotten.portal],
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

export const BUILDERS = { entrancehall: entranceHall, greathall: greatHall, staircase, library, commonroom: commonRoom, dungeon, classrooms, tower, showers: () => showerHall(room),
  broomcupboard: () => secretRoom(room, 'broomcupboard'), trophyroom: () => secretRoom(room, 'trophyroom'), forgottenclass: () => secretRoom(room, 'forgottenclass') };
