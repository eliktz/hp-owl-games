// Shared mesh factories for the castle interiors (interiors.js). Textured stone + wood
// (the same committed CC0 maps the exterior uses) give the rooms real surfaces; warm
// emissive accents (candles, torches, fire, stained glass, the enchanted ceiling) bloom
// without adding runtime lights (iPad rule). Call `await ensureTex()` before building a room.
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
  MeshStandardMaterial, Color, DoubleSide, RepeatWrapping,
} from 'three';
import { loadTexture } from './assets.js';

let _tex = null;
// Load the stone/wood maps once; rooms share them (cloned per-mesh for independent tiling).
export async function ensureTex() {
  if (_tex) return _tex;
  const [wall, floorT, wood] = await Promise.all([
    loadTexture('castle_wall_1k.jpg', { repeat: 1 }),
    loadTexture('slate_roof_1k.jpg', { repeat: 1 }),
    loadTexture('wood_1k.jpg', { repeat: 1 }),
  ]);
  _tex = { wall, floor: floorT, wood };
  return _tex;
}

// A cloned, independently-tiled copy of a source map (shares the image, cheap).
function tile(src, rx, ry) {
  if (!src) return null;
  const t = src.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(rx, ry); return t;
}
const stoneMat = (rx, ry, color = 0x8f8a80) => new MeshStandardMaterial({ color, map: tile(_tex?.wall, rx, ry), roughness: 0.96 });
const woodMat = (rx = 1, ry = 1, color = 0x6a4428) => new MeshStandardMaterial({ color, map: tile(_tex?.wood, rx, ry), roughness: 0.85 });

export const MAT = {
  get stone() { return stoneMat(1.5, 1.5); },
  get wood() { return woodMat(1, 1); },
  dark: new MeshStandardMaterial({ color: 0x241b14, roughness: 0.9 }),
  rug:  new MeshStandardMaterial({ color: 0x6a1420, roughness: 0.95 }),
  gold: new MeshStandardMaterial({ color: 0xb98b2e, roughness: 0.45, metalness: 0.5 }),
};
const emissive = (c, i = 1) => new MeshStandardMaterial({ color: c, emissive: new Color(c), emissiveIntensity: i, roughness: 0.4 });

export function floor(group, w, d, color = 0x6b655c) {
  const m = new Mesh(new PlaneGeometry(w, d), new MeshStandardMaterial({ color, map: tile(_tex?.floor, w / 4, d / 4), roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; group.add(m); return m;
}

// A textured stone wall segment centred at (x,z); tiles the map to its size.
export function wall(group, x, z, w, h, t, rotY = 0, color = 0x8f8a80) {
  const long = Math.max(w, t);
  const m = new Mesh(new BoxGeometry(w, h, t), stoneMat(long / 3, h / 3, color));
  m.position.set(x, h / 2, z); m.rotation.y = rotY; m.receiveShadow = true; group.add(m); return m;
}

export function ceiling(group, w, d, y, color = 0x3c3850) {
  const m = new Mesh(new PlaneGeometry(w, d), new MeshStandardMaterial({ color, map: tile(_tex?.wall, w / 5, d / 5), roughness: 0.97 }));
  m.rotation.x = Math.PI / 2; m.position.y = y; group.add(m); return m;
}

// A stone column with flared base + capital (gives rooms vertical rhythm).
export function column(group, x, z, h, r = 0.5) {
  const g = new Group(); g.position.set(x, 0, z);
  const m = stoneMat(0.6, h / 3, 0x7d7870);
  const shaft = new Mesh(new CylinderGeometry(r, r * 1.1, h, 12), m); shaft.position.y = h / 2; shaft.castShadow = true; g.add(shaft);
  g.add(new Mesh(new CylinderGeometry(r * 1.5, r * 1.7, 0.5, 12), m)).position.y = 0.25;
  g.add(new Mesh(new CylinderGeometry(r * 1.6, r * 1.2, 0.5, 12), m)).position.y = h - 0.25;
  group.add(g); return g;
}

// An arched oak door against a wall, with a stone surround. Visual only (door triggers in
// interiors.js fire by proximity). Centre at (x,z); rotY orients it along the wall.
export function doorLeaf(group, x, z, rotY = 0, { w = 2.6, h = 4, color = 0x5a3a1e } = {}) {
  const g = new Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  const frame = new Mesh(new BoxGeometry(w + 0.7, h + 0.5, 0.5), stoneMat((w + 0.7) / 3, (h + 0.5) / 3, 0x9a948a));
  frame.position.set(0, (h + 0.5) / 2, -0.12); g.add(frame);
  const leaf = new Mesh(new BoxGeometry(w, h, 0.22), woodMat(1, 2, color));
  leaf.position.set(0, h / 2, 0.08); leaf.castShadow = true; g.add(leaf);
  for (const sx of [-w / 4, w / 4]) {                       // iron bands + a knocker ring
    const band = new Mesh(new BoxGeometry(0.12, h - 0.4, 0.26), MAT.dark); band.position.set(sx, h / 2, 0.08); g.add(band);
  }
  const ring = new Mesh(new SphereGeometry(0.12, 10, 8), MAT.gold); ring.position.set(0, h * 0.5, 0.22); g.add(ring);
  const arch = new Mesh(new ConeGeometry(w * 0.7, 1.1, 20, 1, false, 0, Math.PI), emissive(0xffcf7a, 0.25));
  arch.position.set(0, h + 0.1, 0.12); g.add(arch);
  group.add(g); return g;
}

// Floating candle (wax stick + glowing flame). userData.flame bobs/flickers in interiors.js.
export function candle(x, y, z) {
  const g = new Group();
  g.add(new Mesh(new CylinderGeometry(0.04, 0.05, 0.4, 6), new MeshStandardMaterial({ color: 0xf3e6c0, roughness: 0.7 })));
  const flame = new Mesh(new SphereGeometry(0.08, 8, 8), emissive(0xffb34d, 2.2));
  flame.position.y = 0.3; flame.scale.y = 1.6; g.add(flame);
  g.position.set(x, y, z); g.userData.flame = flame; g.userData.baseY = y; return g;
}

// Wall torch (bracket + flame) with a warm emissive back-glow so walls read as lit.
export function torch(group, x, y, z) {
  const g = new Group();
  const stick = new Mesh(new CylinderGeometry(0.03, 0.03, 0.4, 5), MAT.dark); stick.rotation.z = 0.5; g.add(stick);
  const flame = new Mesh(new ConeGeometry(0.11, 0.34, 8), emissive(0xff8a2a, 2.4)); flame.position.set(0.12, 0.28, 0); g.add(flame);
  const glow = new Mesh(new SphereGeometry(0.5, 8, 8), emissive(0xff8a2a, 0.18)); glow.position.set(0.12, 0.28, 0.1); g.add(glow);
  g.position.set(x, y, z); g.userData.flame = flame; group.add(g); return g;
}

// Long dining table with two benches, a house-colour runner and golden plates.
export function longTable(group, x, z, len = 14, runner = 0x7a1020) {
  const g = new Group();
  const top = new Mesh(new BoxGeometry(1.5, 0.14, len), woodMat(1, len / 3)); top.position.y = 0.92; top.castShadow = true; top.receiveShadow = true; g.add(top);
  const run = new Mesh(new BoxGeometry(0.7, 0.02, len - 0.4), new MeshStandardMaterial({ color: runner, roughness: 0.85 }));
  run.position.y = 1.0; g.add(run);
  for (const sz of [-len / 2 + 0.6, len / 2 - 0.6]) g.add(new Mesh(new BoxGeometry(1.3, 0.9, 0.22), MAT.dark)).position.set(0, 0.45, sz);
  for (const sx of [-1.15, 1.15]) {
    const bench = new Mesh(new BoxGeometry(0.5, 0.12, len), woodMat(1, len / 3)); bench.position.set(sx, 0.5, 0); bench.castShadow = true; g.add(bench);
    g.add(new Mesh(new BoxGeometry(0.45, 0.5, 0.18), MAT.dark)).position.set(sx, 0.25, -len / 2 + 0.6);
    g.add(new Mesh(new BoxGeometry(0.45, 0.5, 0.18), MAT.dark)).position.set(sx, 0.25, len / 2 - 0.6);
  }
  for (let p = -len / 2 + 2; p < len / 2 - 1; p += 3.5) {
    const plate = new Mesh(new CylinderGeometry(0.28, 0.24, 0.05, 14), MAT.gold); plate.position.set(0, 1.02, p); g.add(plate);
    const cup = new Mesh(new CylinderGeometry(0.1, 0.13, 0.26, 10), MAT.gold); cup.position.set(0.5, 1.12, p - 0.4); g.add(cup);
  }
  g.position.set(x, 0, z); group.add(g); return g;
}

// Tall stained-glass window: a glowing coloured pane behind a dark stone mullion cross.
export function window2(group, x, y, z, rotY = 0, hue = 0x9fc6ff) {
  const g = new Group(); g.position.set(x, y, z); g.rotation.y = rotY;
  const pane = new Mesh(new PlaneGeometry(2.2, 5), emissive(hue, 0.75)); pane.material.side = DoubleSide; g.add(pane);
  g.add(new Mesh(new BoxGeometry(0.16, 5, 0.1), MAT.dark));
  for (const yy of [-1.5, 0, 1.5]) g.add(new Mesh(new BoxGeometry(2.2, 0.14, 0.1), MAT.dark)).position.y = yy;
  const top = new Mesh(new ConeGeometry(1.1, 1.2, 16, 1, false, 0, Math.PI), emissive(hue, 0.75)); top.material.side = DoubleSide;
  top.position.y = 2.9; g.add(top); group.add(g); return g;
}

// A hanging house banner (coloured cloth + crest bar + pole) against a wall.
export function banner(group, x, y, z, color, rotY = 0) {
  const g = new Group(); g.position.set(x, y, z); g.rotation.y = rotY;
  const cloth = new Mesh(new PlaneGeometry(2.4, 5.5), new MeshStandardMaterial({ color, roughness: 0.9, side: DoubleSide })); g.add(cloth);
  const crest = new Mesh(new PlaneGeometry(1.4, 1.4), emissive(0xd9b24a, 0.5)); crest.material.side = DoubleSide; crest.position.z = 0.02; g.add(crest);
  g.add(new Mesh(new CylinderGeometry(0.07, 0.07, 2.8, 6), MAT.gold)).rotation.z = Math.PI / 2;
  group.add(g); return g;
}

// Enchanted ceiling: a dark night-sky dome sprinkled with emissive stars (Great Hall magic).
export function enchantedCeiling(group, w, d, y) {
  const sky = new Mesh(new PlaneGeometry(w, d), new MeshStandardMaterial({ color: 0x0a0f24, emissive: new Color(0x141c44), emissiveIntensity: 0.6, side: DoubleSide }));
  sky.rotation.x = Math.PI / 2; sky.position.y = y; group.add(sky);
  const starMat = emissive(0xfff4c2, 2.0);
  for (let i = 0; i < 70; i++) {
    const s = new Mesh(new SphereGeometry(0.07, 6, 6), starMat);
    s.position.set(Math.sin(i * 12.9) * 0.46 * w, y - 0.3, Math.cos(i * 7.3) * 0.46 * d); group.add(s);
  }
  return sky;
}

export { emissive, woodMat };
