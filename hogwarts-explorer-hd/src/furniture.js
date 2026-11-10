// Reusable castle furniture for the interiors (rooms.js). Built from primitives on top of
// the shared textured materials in interior-kit.js, so rooms stay warm and coherent without
// adding runtime lights (iPad rule) — warm accents come from emissive candles/fires.
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, ConeGeometry,
  TorusGeometry, MeshStandardMaterial, DoubleSide,
} from 'three';
import { MAT, emissive, woodMat } from './interior-kit.js';

// A soft runner carpet (field colour + gold border) laid flat on the floor.
export function carpet(group, x, z, w, d, color = 0x7a1420, border = 0xcf9f3a) {
  const g = new Group(); g.position.set(x, 0, z);
  const edge = new Mesh(new PlaneGeometry(w + 0.5, d + 0.5), new MeshStandardMaterial({ color: border, roughness: 0.7 }));
  edge.rotation.x = -Math.PI / 2; edge.position.y = 0.03; g.add(edge);
  const top = new Mesh(new PlaneGeometry(w, d), new MeshStandardMaterial({ color, roughness: 0.9 }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.04; g.add(top);
  group.add(g); return g;
}

// A raised dais with a long head table and a tall golden chair (Great Hall head end).
export function headTable(group, x, z, span = 24) {
  const g = new Group(); g.position.set(x, 0, z);
  const dais = new Mesh(new BoxGeometry(5, 0.5, span + 2), new MeshStandardMaterial({ color: 0x4a3a5e, roughness: 0.95 }));
  dais.position.y = 0.25; dais.receiveShadow = true; g.add(dais);
  const wood = woodMat(1, span / 3, 0x5a3a1e);
  const top = new Mesh(new BoxGeometry(2.4, 0.18, span), wood); top.position.set(0.2, 1.45, 0); top.castShadow = true; g.add(top);
  const leg = new Mesh(new BoxGeometry(2, 0.9, span), MAT.dark); leg.position.set(0.2, 0.9, 0); g.add(leg);
  const cloth = new Mesh(new BoxGeometry(2.5, 0.5, span), new MeshStandardMaterial({ color: 0x7a1020, roughness: 0.88 }));
  cloth.position.set(0.2, 1.1, 0); g.add(cloth);
  const chair = new Group(); chair.position.set(-0.6, 0.5, 0);
  chair.add(new Mesh(new BoxGeometry(1.3, 0.16, 1.1), MAT.gold)).position.set(0, 1.4, 0);
  const back = new Mesh(new BoxGeometry(1.3, 2.4, 0.16), MAT.gold); back.position.set(0, 2.4, -0.5); chair.add(back);
  g.add(chair); group.add(g); return g;
}

// A tall bookshelf packed with colourful (softly glowing) book rows; faces +faceX.
export function bookshelf(group, x, z, faceX = 1, rows = 5) {
  const g = new Group(); g.position.set(x, 0, z);
  const frame = new Mesh(new BoxGeometry(1, 6.2, 4.4), woodMat(1, 2, 0x3a2412));
  frame.position.y = 3.1; frame.castShadow = true; g.add(frame);
  const cols = [0x8a2b2b, 0x2b5a8a, 0x2b8a4a, 0xb98b2e, 0x6a3b8a];
  for (let r = 0; r < rows; r++) {
    const books = new Mesh(new BoxGeometry(0.6, 0.8, 3.8), emissive(cols[r % cols.length], 0.18));
    books.position.set(-faceX * 0.42, 1 + r * 1.05, 0); g.add(books);
  }
  group.add(g); return g;
}

// A deep wing armchair in a house colour, facing +rotY.
export function armchair(group, x, z, rotY = 0, color = 0x6a1420) {
  const g = new Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  const m = new MeshStandardMaterial({ color, roughness: 0.96 });
  g.add(new Mesh(new BoxGeometry(1.5, 0.6, 1.4), m)).position.set(0, 0.55, 0);      // seat
  g.add(new Mesh(new BoxGeometry(1.5, 1.6, 0.4), m)).position.set(0, 1.1, -0.5);    // back
  for (const sx of [-0.65, 0.65]) g.add(new Mesh(new BoxGeometry(0.3, 1.1, 1.4), m)).position.set(sx, 0.8, 0);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  group.add(g); return g;
}

// A stone hearth with a glowing fire and a mantel; returns { group, fire } so the room can
// flicker fire.material.emissiveIntensity each frame.
export function fireplace(group, x, z, rotY = 0) {
  const g = new Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  const stone = MAT.stone;
  g.add(new Mesh(new BoxGeometry(5, 4, 1), stone)).position.set(0, 2, 0);           // back
  for (const sx of [-2, 2]) g.add(new Mesh(new BoxGeometry(1, 3.4, 1.4), stone)).position.set(sx, 1.7, 0.4);
  g.add(new Mesh(new BoxGeometry(5.6, 0.5, 1.8), MAT.dark)).position.set(0, 3.5, 0.5); // mantel
  const fire = new Mesh(new BoxGeometry(2.4, 1.2, 0.4), emissive(0xff7a1a, 1.8));
  fire.position.set(0, 1.0, 0.55); g.add(fire);
  // a few small ember logs; no big glow ball — the fire box + bloom carry the warmth
  for (const sx of [-0.5, 0.5]) { const log = new Mesh(new CylinderGeometry(0.16, 0.16, 1.6, 6), MAT.dark); log.rotation.z = Math.PI / 2; log.position.set(sx * 0.3, 0.5, 0.5); g.add(log); }
  g.traverse(o => { if (o.isMesh && o.material === stone) o.castShadow = true; });
  g.userData.light = { k: 'fire', dz: 1.2 };
  group.add(g); return { group: g, fire };
}

// An arched opening (stone surround framing a doorway gap) that reads as a walkable door.
export function archway(group, x, z, rotY = 0, { w = 3.4, h = 5 } = {}) {
  const g = new Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  const stone = MAT.stone;
  for (const sx of [-(w / 2 + 0.4), w / 2 + 0.4]) g.add(new Mesh(new BoxGeometry(0.8, h, 1.2), stone)).position.set(sx, h / 2, 0);
  g.add(new Mesh(new BoxGeometry(w + 1.6, 0.8, 1.2), stone)).position.set(0, h + 0.4, 0);
  const arch = new Mesh(new TorusGeometry(w / 2 + 0.4, 0.4, 8, 16, Math.PI), stone);
  arch.position.set(0, h, 0); g.add(arch);
  const dark = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ color: 0x0a0710, side: DoubleSide }));
  dark.position.set(0, h / 2, -0.05); g.add(dark);
  group.add(g); return g;
}

// A wrought-iron ring chandelier dotted with emissive candle flames, hung at height y.
export function chandelier(group, x, y, z, r = 1.6) {
  const g = new Group(); g.position.set(x, y, z);
  const ring = new Mesh(new TorusGeometry(r, 0.07, 8, 20), MAT.dark); ring.rotation.x = Math.PI / 2; g.add(ring);
  g.add(new Mesh(new CylinderGeometry(0.03, 0.03, 2.4, 6), MAT.dark)).position.y = 1.2;
  const flames = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const f = new Mesh(new ConeGeometry(0.1, 0.34, 8), emissive(0xffb34d, 2.2));
    f.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r); g.add(f); flames.push(f);
  }
  g.userData.flames = flames; g.userData.light = { k: 'chandelier', c: 0xffc070 }; group.add(g); return g;
}
