// Floo Network fireplaces (floo.js drives them): one parametric stone hearth for the rooms and a rough
// fieldstone one for the grounds by Hagrid's hut. Built in a local frame with the opening facing +z and the
// back on the wall plane (z 0), then placed at (x, z) turned by rotY (0 = on a north wall facing +z,
// PI = south wall, PI/2 = west wall facing +x, -PI/2 = east wall facing -x).
//
// Split for the draw-call budget: the STATIC parts (stone surround, mantel, logs, the iron powder pot) use the
// shared room materials so mergeStatic folds them into buckets the room already draws; the LIVE parts (the
// flames on one emissive material, the glittering powder heap) stay apart: 2 draw calls per hearth.
// The rooms call flooHearth() before their mergeStatic and add `live` after it.
import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, SphereGeometry, MeshStandardMaterial, Color } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from './interior-kit.js';

const FIRE = 0xff7a1a;
// one geometry for the bed + five tongues, built per size (each hearth owns its fire material so it can turn green alone)
function fireGeo(ow, s = 1) {
  const L = [new BoxGeometry(ow * 0.78, 0.28, 0.42).translate(0, 0.14, 0)];
  for (const [fx, fh, fr] of [[-0.34, 0.9, 0.24], [-0.12, 1.3, 0.3], [0.14, 1.12, 0.28], [0.36, 0.78, 0.22], [0.01, 0.66, 0.4]]) {
    L.push(new ConeGeometry(fr * s, fh * s, 7).translate(fx * ow, fh * s / 2 + 0.12, 0.02));
  }
  return mergeGeometries(L, false);
}

// Returns { group (static, already added to g), live (add after merging), info } where info is what floo.js needs.
export function flooHearth(g, cols, { id, x, z, rotY = 0, ow = 2.2, oh = 2.4, jw = 0.45, jd = 0.8, breast = 4.0, arch = false, stone = null, light = true } = {}) {
  const st = stone || MAT.stone, dark = MAT.dark;
  const grp = new Group(); grp.position.set(x, 0, z); grp.rotation.y = rotY; grp.name = 'floo-hearth-' + id;
  const W = ow + 2 * jw;
  const box = (w, h, d, mat, px, py, pz) => { const m = new Mesh(new BoxGeometry(w, h, d), mat); m.position.set(px, py, pz); m.castShadow = mat === st; grp.add(m); return m; };
  box(W + 0.2, breast, 0.5, st, 0, breast / 2, 0.15);                              // back + chimney breast (10 cm into the wall)
  box(ow, oh, 0.06, dark, 0, oh / 2, 0.43);                                        // sooty fire-back
  for (const sx of [-1, 1]) box(jw, oh, jd, st, sx * (ow / 2 + jw / 2), oh / 2, 0.4 + jd / 2);   // jambs
  if (arch) {                                                                      // a low round arch springing from the jambs (the dungeon grate)
    const r = ow / 2 + jw / 2, a = new Mesh(new TorusGeometry(r, jw / 2, 6, 14, Math.PI), st);
    a.position.set(0, oh, 0.4 + jd / 2); a.scale.z = jd / jw; grp.add(a);
    const fill = box(ow, r, 0.06, dark, 0, oh + r / 2 - 0.05, 0.43); fill.scale.y = 0.9;
    box(W + 0.1, 0.32, jd, st, 0, oh + r + 0.16, 0.4 + jd / 2);                    // the lintel course over the arch
  } else box(W, 0.36, jd, st, 0, oh + 0.18, 0.4 + jd / 2);                        // lintel
  const mantelY = oh + (arch ? ow / 2 + jw / 2 + 0.32 : 0.36);
  box(W + 0.5, 0.16, jd + 0.3, dark, 0, mantelY + 0.08, 0.4 + (jd + 0.3) / 2);     // mantel shelf
  box(W + 0.6, 0.1, 1.15, st, 0, 0.05, 0.4 + jd + 0.5 - 0.02);                     // hearth stone (in front)
  box(ow - 0.05, 0.08, jd + 0.05, st, 0, 0.04, 0.4 + jd / 2);                      // firebox floor
  for (const sx of [-0.18, 0.18]) { const log = new Mesh(new CylinderGeometry(0.13, 0.13, ow * 0.62, 6), dark); log.rotation.z = Math.PI / 2; log.rotation.y = sx; log.position.set(sx * 0.4, 0.22, 0.75); grp.add(log); }
  // the iron pot of Floo powder on the mantel (right as you face it)
  const potX = W / 2 - 0.25, potY = mantelY + 0.16, potZ = 0.4 + (jd + 0.3) - 0.3;
  const pot = new Mesh(new CylinderGeometry(0.15, 0.11, 0.2, 10), dark); pot.position.set(potX, potY + 0.1, potZ); grp.add(pot);
  const rim = new Mesh(new TorusGeometry(0.15, 0.025, 5, 12), dark); rim.rotation.x = Math.PI / 2; rim.position.set(potX, potY + 0.2, potZ); grp.add(rim);
  g.add(grp);

  // live: flames + powder (own materials)
  const live = new Group(); live.position.copy(grp.position); live.rotation.y = rotY; live.name = 'floo-live-' + id;
  const fireMat = new MeshStandardMaterial({ color: FIRE, emissive: new Color(FIRE), emissiveIntensity: 1.8, roughness: 0.4 });
  const fire = new Mesh(fireGeo(ow, Math.min(1.25, oh / 2.4)), fireMat); fire.position.set(0, 0.1, 0.75); fire.name = 'floo-fire'; live.add(fire);
  const dome = new SphereGeometry(0.13, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.55, 1);
  const powder = new Mesh(dome, new MeshStandardMaterial({ color: 0x9ff0c0, emissive: new Color(0x2fe070), emissiveIntensity: 1.6, roughness: 0.3 }));
  powder.position.set(potX, potY + 0.19, potZ); powder.name = 'floo-powder'; live.add(powder);

  // collider + light marker (world = room-local here: the room group only moves in y)
  const fx = Math.sin(rotY), fz = Math.cos(rotY), D = 0.4 + jd;
  if (cols) {
    const hw = (W + 0.3) / 2, hd = D / 2 + 0.05, cx = x + fx * hd, cz = z + fz * hd;
    const axisAligned = Math.abs(Math.sin(rotY * 2)) < 1e-3;
    if (axisAligned && Math.abs(fx) > 0.5) cols.push({ type: 'box', x: cx, z: cz, hw: hd, hd: hw, angle: 0 });
    else if (axisAligned) cols.push({ type: 'box', x: cx, z: cz, hw, hd, angle: 0 });
    else cols.push({ type: 'box', x: cx, z: cz, hw, hd, angle: -rotY });
  }
  if (light) { const o = new Group(); o.position.set(x + fx * (D + 1.2), 0.2, z + fz * (D + 1.2)); o.userData.light = { k: 'glow', c: 0xff8a3a, r: 4.4, a: 0.42 }; g.add(o); }
  const info = {
    id, x, z, rotY, front: [fx, fz], ow, oh, W, depth: D,
    grate: { x: x + fx * 0.85, z: z + fz * 0.85 },                                 // where Harry stands inside the opening
    arrive: { x: x + fx * (D + 1.6), z: z + fz * (D + 1.6), yaw: rotY },          // 1.6 m out in front, facing the room
    pot: { x: x + fx * potZ + Math.cos(rotY) * potX, y: potY + 0.25, z: z + fz * potZ - Math.sin(rotY) * potX },
    fire, powder, fireMat, base: new Color(FIRE),
  };
  return { group: grp, live, info };
}

// Drive one hearth's flames for a frame. k = { green 0..1, roar 0..1 }. Allocation-free.
const _green = new Color(0x2fe070);
export function tickHearth(info, t, k) {
  const m = info.fireMat, gr = k.green, ro = k.roar;
  m.emissive.copy(info.base).lerp(_green, gr); m.color.copy(m.emissive);
  m.emissiveIntensity = 1.8 + Math.sin(t * 7 + info.x) * 0.3 + Math.sin(t * 17.3) * 0.15 + gr * 1.4 + ro * 1.0;
  const f = info.fire;
  f.scale.set(1 + Math.sin(t * 5.1) * 0.03 + ro * 0.25, 1 + Math.sin(t * 6.3 + info.z) * 0.07 + ro * (1.5 + 0.25 * Math.sin(t * 11)), 1);
  info.powder.material.emissiveIntensity = 1.3 + Math.sin(t * 3.1) * 0.5;
}

// The rough fieldstone hearth on the grounds by Hagrid's hut (freestanding: closed on every side, a stone ledge
// instead of an oak mantel, a short chimney). Static stone + pot = one mesh on the given stone material.
export function hutHearth({ x, z, y, rotY, stone }) {
  const root = new Group(); root.position.set(x, y, z); root.rotation.y = rotY; root.name = 'floo-hut-hearth';
  const ow = 2.0, oh = 2.3, jw = 0.5, jd = 0.75, W = ow + 2 * jw;
  const P = [], B = (w, h, d, px, py, pz, ry = 0) => { const b = new BoxGeometry(w, h, d); if (ry) b.rotateY(ry); b.translate(px, py, pz); P.push(b); };
  B(W, 3.5, 0.6, 0, 1.25, -0.3);                                                     // back wall
  for (const sx of [-1, 1]) B(jw, oh + 0.5, jd + 0.1, sx * (ow / 2 + jw / 2), (oh - 0.5) / 2, jd / 2 - 0.05);   // (feet 0.5 m into the ground: never floats on a slope)
  B(W + 0.1, 0.4, jd + 0.15, 0, oh + 0.2, jd / 2 - 0.05);                           // lintel
  B(W + 0.3, 0.14, jd + 0.4, 0, oh + 0.47, jd / 2);                                 // the stone ledge (the powder pot stands on it)
  B(1.0, 1.3, 0.7, 0, 3.0 + 0.65, -0.25);                                           // chimney stub
  B(W + 0.5, 0.5, 1.3, 0, -0.17, jd + 0.55);                                         // hearth slab (sinks into uneven ground)
  for (let i = 0; i < 6; i++) B(0.5 + (i % 3) * 0.12, 0.34, 0.3, (i - 2.5) * 0.55, 3.05 - (i % 2) * 0.05, -0.05, (i % 2 ? 0.08 : -0.06));   // ragged capstones
  const potX = W / 2 - 0.35, potY = oh + 0.54, potZ = jd / 2 + 0.05;
  const pot = new CylinderGeometry(0.15, 0.11, 0.2, 10); pot.translate(potX, potY + 0.1, potZ); P.push(pot);
  const geo = mergeGeometries(P.map(p => p.index ? p.toNonIndexed() : p), false);
  geo.computeVertexNormals();
  const mesh = new Mesh(geo, stone); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'floo-hut-stone'; root.add(mesh);
  const fireMat = new MeshStandardMaterial({ color: FIRE, emissive: new Color(FIRE), emissiveIntensity: 1.8, roughness: 0.4 });
  const fire = new Mesh(fireGeo(ow, 0.95), fireMat); fire.position.set(0, 0.06, jd * 0.45); fire.name = 'floo-fire'; root.add(fire);
  const dome = new SphereGeometry(0.13, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.55, 1);
  const powder = new Mesh(dome, new MeshStandardMaterial({ color: 0x9ff0c0, emissive: new Color(0x2fe070), emissiveIntensity: 1.6, roughness: 0.3 }));
  powder.position.set(potX, potY + 0.19, potZ); powder.name = 'floo-powder'; root.add(powder);
  const fx = Math.sin(rotY), fz = Math.cos(rotY), D = jd;
  const info = {
    id: 'hut', x, z, rotY, front: [fx, fz], ow, oh, W, depth: D, outdoor: true,
    grate: { x: x + fx * 0.3, z: z + fz * 0.3 },
    arrive: { x: x + fx * (D + 1.6), z: z + fz * (D + 1.6), yaw: rotY },
    pot: { x: x + fx * potZ + Math.cos(rotY) * potX, y: y + potY + 0.25, z: z + fz * potZ - Math.sin(rotY) * potX },
    fire, powder, fireMat, base: new Color(FIRE),
    collider: { type: 'box', x: x - fx * 0.05 + fx * (D / 2 - 0.3), z: z - fz * 0.05 + fz * (D / 2 - 0.3), hw: (W + 0.3) / 2, hd: (D + 0.6) / 2 + 0.05, angle: -rotY },
  };
  return { root, info };
}
