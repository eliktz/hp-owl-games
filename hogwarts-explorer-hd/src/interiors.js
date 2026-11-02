// Castle interiors, streamed in on demand (built when you enter, disposed when you leave —
// so only one room's geometry is ever resident, keeping iPad memory low). Rooms live in a
// hidden pocket far BELOW the grounds (FLOOR_Y) so the player's world-bounds clamp still
// applies; dense warm fog + a dark sky hide the void and the world above. Lit by emissive
// candles/torches/fire plus a boosted ambient on entry (no runtime lights — iPad rule).
import { Group, Mesh, BoxGeometry, PlaneGeometry, MeshStandardMaterial, Color } from 'three';
import {
  MAT, floor, wall, ceiling, candle, torch, longTable, window2, enchantedCeiling, emissive,
} from './interior-kit.js';
import { loadModel, fitModel } from './models.js';

const FLOOR_Y = -200;

// Four axis-aligned walls + floor; pushes box colliders so the player stays inside.
function shell(g, cols, W, D, H, { ceil = true } = {}) {
  floor(g, W, D);
  if (ceil) ceiling(g, W, D, H);
  const t = 1;
  const segs = [
    { x: 0, z: -D / 2, w: W, d: t }, { x: 0, z: D / 2, w: W, d: t },
    { x: -W / 2, z: 0, w: t, d: D }, { x: W / 2, z: 0, w: t, d: D },
  ];
  for (const s of segs) {
    wall(g, s.x, s.z, s.w, H, s.d, 0);
    cols.push({ type: 'box', x: s.x, z: s.z, hw: s.w / 2, hd: s.d / 2, angle: 0 });
  }
}

async function tryModel(name, opts) {
  const obj = await loadModel(name);
  if (!obj) return null;
  obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  const g = new Group(); g.add(obj); fitModel(obj, opts); return g;
}

// --- The Great Hall: long tables, floating candles, an enchanted starry ceiling ---------
async function greatHall() {
  const g = new Group(); const cols = []; const W = 18, D = 34, H = 13;
  shell(g, cols, W, D, H, { ceil: false });
  enchantedCeiling(g, W, D, H);
  const flames = [];
  for (const tx of [-5.5, 5.5]) for (const tz of [-7, 7]) {
    longTable(g, tx, tz, 13);
    for (let i = -6; i <= 6; i += 3) { const c = candle(tx, 7 + Math.sin(i) * 0.4, tz + i); g.add(c); flames.push(c); }
  }
  for (const sx of [-W / 2 + 0.1, W / 2 - 0.1]) for (const z of [-10, 0, 10]) window2(g, sx, 6, z, Math.PI / 2);
  longTable(g, 0, -D / 2 + 3, 14);
  const model = await tryModel('castle', { x: 0, z: -D / 2 + 1.5, footprint: 15 });
  if (model) g.add(model);
  return room(g, cols, { x: 0, z: D / 2 - 3 }, flames);
}

// --- The grand moving staircases ---------------------------------------------------------
async function staircase() {
  const g = new Group(); const cols = []; const W = 20, D = 20, H = 22;
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
  const r = room(g, cols, { x: 0, z: D / 2 - 3 }, []);
  r.update = (dt, t) => { for (const fl of flights) fl.node.rotation.y = fl.base + Math.sin(t * 0.3 + fl.base) * fl.amp; };
  return r;
}

// --- The library ------------------------------------------------------------------------
async function library() {
  const g = new Group(); const cols = []; const W = 22, D = 22, H = 10;
  shell(g, cols, W, D, H);
  const bookCols = [0x8a2b2b, 0x2b5a8a, 0x2b8a4a, 0xb98b2e];
  const flames = [];
  for (let r = 0; r < 4; r++) for (const sx of [-7, 7]) {
    const shelf = new Mesh(new BoxGeometry(1, 6, 4), MAT.wood);
    shelf.position.set(sx, 3, -8 + r * 5); shelf.castShadow = true; g.add(shelf);
    for (let b = 0; b < 5; b++) {
      const rows = new Mesh(new BoxGeometry(0.6, 0.7, 3.6), emissive(bookCols[(r + b) % 4], 0.25));
      rows.position.set(sx + (sx > 0 ? -0.5 : 0.5), 1 + b * 1.1, -8 + r * 5); g.add(rows);
    }
  }
  longTable(g, 0, 2, 8);
  for (const z of [-2, 4]) { const c = candle(0, 1.1, z); g.add(c); flames.push(c); }
  const model = await tryModel('harry', { x: 0, z: -6, footprint: 9 });
  if (model) g.add(model);
  return room(g, cols, { x: 0, z: D / 2 - 3 }, flames);
}

// --- A cosy common room -----------------------------------------------------------------
async function commonRoom() {
  const g = new Group(); const cols = []; const W = 16, D = 16, H = 6;
  shell(g, cols, W, D, H);
  const rug = new Mesh(new PlaneGeometry(7, 5), MAT.rug);
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.02; g.add(rug);
  const hearth = new Mesh(new BoxGeometry(4, 3, 1), MAT.stone);
  hearth.position.set(0, 1.5, -W / 2 + 0.8); g.add(hearth);
  const fire = new Mesh(new BoxGeometry(2.6, 1.4, 0.4), emissive(0xff7a1a, 2.0));
  fire.position.set(0, 1.1, -W / 2 + 1.2); g.add(fire);
  for (const sx of [-2.5, 2.5]) {
    const chair = new Mesh(new BoxGeometry(1.6, 1.2, 1.4), new MeshStandardMaterial({ color: 0x6a1420, roughness: 0.95 }));
    chair.position.set(sx, 0.6, -2); chair.castShadow = true; g.add(chair);
  }
  for (const [x, z] of [[-W / 2 + 0.3, 2], [W / 2 - 0.3, 2]]) torch(g, x, 3, z);
  const r = room(g, cols, { x: 0, z: D / 2 - 3 }, []);
  r.update = (dt, t) => { fire.material.emissiveIntensity = 1.7 + Math.sin(t * 7) * 0.3; };
  return r;
}

// Shared room wrapper: parks everything at FLOOR_Y and bobs/flickers any floating candles.
function room(g, cols, spawn, flames) {
  g.position.y = FLOOR_Y;
  return {
    group: g, colliders: cols, spawn: { x: spawn.x, z: spawn.z, y: FLOOR_Y },
    update(dt, t) {
      for (const c of flames) {
        c.position.y = c.userData.baseY + Math.sin(t * 3 + c.position.x) * 0.15;
        c.userData.flame.material.emissiveIntensity = 2 + Math.sin(t * 9 + c.position.z) * 0.4;
      }
    },
  };
}

const BUILDERS = { greathall: greatHall, staircase, library, commonroom: commonRoom };

// Manager: enter(id) streams a room in and moves the player inside; exit() disposes it and
// returns the player to the grounds. One room resident at a time.
export function createInteriors({ scene, env, player, terrainHeightAt, homeSpot, onEnter, onExit }) {
  let active = null, t = 0;
  let savedAmb = 0, savedHemi = 0, savedColliders = null;

  async function enter(id) {
    const build = BUILDERS[id]; if (!build) return;
    if (active) exit();
    const r = await build(); active = r; active.id = id;
    scene.add(r.group);
    if (!savedColliders) savedColliders = player.colliders;
    player.colliders = r.colliders;
    player.heightAt = () => FLOOR_Y;
    player.teleport(r.spawn.x, r.spawn.z);
    player.pos.y = FLOOR_Y; player.yaw = Math.PI; player.camYaw = 0;
    savedAmb = env.amb.intensity; savedHemi = env.hemi.intensity;
    env.amb.intensity = 0.95; env.hemi.intensity = 0.5;
    scene.fog.density = 0.02; scene.fog.color = new Color(0x120a1e);
    scene.background = new Color(0x0a0710);
    onEnter && onEnter(id);
  }

  function exit() {
    if (!active) return;
    scene.remove(active.group);
    active.group.traverse(o => { if (o.isMesh) o.geometry?.dispose?.(); });
    active = null;
    player.colliders = savedColliders || [];
    player.heightAt = terrainHeightAt;
    env.amb.intensity = savedAmb; env.hemi.intensity = savedHemi;
    env.setTime(env.time);      // restores fog + sky for the current time of day
    const h = homeSpot || { x: -18, z: 2 };
    player.teleport(h.x, h.z);
    onExit && onExit();
  }

  return {
    enter, exit,
    get active() { return active ? active.id : null; },
    update(dt) { t += dt; if (active) active.update(dt, t); },
  };
}

export { FLOOR_Y };
