// Shared mesh factories for the castle interiors (interiors.js). All primitives, merged
// where cheap, with warm emissive accents (candles, torches, fire, the enchanted ceiling)
// so the bloom pass gives them a magical glow without adding runtime lights (iPad rule).
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
  MeshStandardMaterial, Color, DoubleSide,
} from 'three';

export const MAT = {
  stone:  new MeshStandardMaterial({ color: 0x6f6a63, roughness: 0.95 }),
  floor:  new MeshStandardMaterial({ color: 0x4a443d, roughness: 0.9 }),
  wood:   new MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 }),
  dark:   new MeshStandardMaterial({ color: 0x241b14, roughness: 0.9 }),
  rug:    new MeshStandardMaterial({ color: 0x6a1420, roughness: 0.95 }),
  gold:   new MeshStandardMaterial({ color: 0xb98b2e, roughness: 0.5, metalness: 0.4 }),
};
const emissive = (c, i = 1) => new MeshStandardMaterial({ color: c, emissive: new Color(c), emissiveIntensity: i, roughness: 0.4 });

export function floor(group, w, d, mat = MAT.floor) {
  const m = new Mesh(new PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; group.add(m);
  return m;
}

// A solid wall segment (also a collider hint via its box size). Centre at (x,z), facing +/-.
export function wall(group, x, z, w, h, t, rotY = 0, mat = MAT.stone) {
  const m = new Mesh(new BoxGeometry(w, h, t), mat);
  m.position.set(x, h / 2, z); m.rotation.y = rotY; m.receiveShadow = true; group.add(m);
  return m;
}

export function ceiling(group, w, d, y, mat = MAT.stone) {
  const m = new Mesh(new PlaneGeometry(w, d), mat);
  m.rotation.x = Math.PI / 2; m.position.y = y; group.add(m);
  return m;
}

// Floating candle: a slim wax stick topped by a glowing flame (emissive). `userData.flame`
// is returned so interiors.js can bob/flicker it.
export function candle(x, y, z) {
  const g = new Group();
  const wax = new Mesh(new CylinderGeometry(0.04, 0.05, 0.4, 6), new MeshStandardMaterial({ color: 0xf3e6c0, roughness: 0.7 }));
  g.add(wax);
  const flame = new Mesh(new SphereGeometry(0.08, 8, 8), emissive(0xffb34d, 2.2));
  flame.position.y = 0.3; flame.scale.y = 1.6; g.add(flame);
  g.position.set(x, y, z); g.userData.flame = flame; g.userData.baseY = y;
  return g;
}

// Wall torch: bracket + flame.
export function torch(group, x, y, z) {
  const g = new Group();
  const stick = new Mesh(new CylinderGeometry(0.03, 0.03, 0.4, 5), MAT.dark); stick.rotation.z = 0.5; g.add(stick);
  const flame = new Mesh(new ConeGeometry(0.1, 0.3, 8), emissive(0xff8a2a, 2.4)); flame.position.set(0.12, 0.25, 0); g.add(flame);
  g.position.set(x, y, z); g.userData.flame = flame; group.add(g); return g;
}

// Long dining table with two benches (Great Hall). Centred at (x,z), length along Z.
export function longTable(group, x, z, len = 14) {
  const g = new Group();
  const top = new Mesh(new BoxGeometry(1.4, 0.12, len), MAT.wood); top.position.y = 0.9; top.castShadow = true; g.add(top);
  for (const sz of [-len / 2 + 0.5, len / 2 - 0.5]) {
    const leg = new Mesh(new BoxGeometry(1.2, 0.9, 0.2), MAT.dark); leg.position.set(0, 0.45, sz); g.add(leg);
  }
  for (const sx of [-1.1, 1.1]) {
    const bench = new Mesh(new BoxGeometry(0.5, 0.1, len), MAT.wood); bench.position.set(sx, 0.5, 0); g.add(bench);
  }
  g.position.set(x, 0, z); group.add(g); return g;
}

// Tall glowing window (stained-glass feel) on a wall plane.
export function window2(group, x, y, z, rotY = 0) {
  const m = new Mesh(new PlaneGeometry(2.2, 5), emissive(0x9fc6ff, 0.6));
  m.material.side = DoubleSide; m.position.set(x, y, z); m.rotation.y = rotY; group.add(m); return m;
}

// Enchanted ceiling: a dark dome sprinkled with emissive "stars" (Great Hall magic sky).
export function enchantedCeiling(group, w, d, y) {
  const sky = new Mesh(new PlaneGeometry(w, d), new MeshStandardMaterial({ color: 0x0a0f24, emissive: new Color(0x10183a), emissiveIntensity: 0.5, side: DoubleSide }));
  sky.rotation.x = Math.PI / 2; sky.position.y = y; group.add(sky);
  const starMat = emissive(0xfff4c2, 2.0);
  for (let i = 0; i < 60; i++) {
    const s = new Mesh(new SphereGeometry(0.08, 6, 6), starMat);
    s.position.set((Math.sin(i * 12.9) * 0.5) * w, y - 0.2, (Math.cos(i * 7.3) * 0.5) * d);
    group.add(s);
  }
  return sky;
}

export { emissive };
