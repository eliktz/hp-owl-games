// Procedural Hogwarts silhouette from primitives: round towers with conical slate
// spires, crenellated curtain walls, a gabled Great Hall and a tall central keep.
// All static geometry is MERGED per material so the whole castle is ~3 draw calls.
// Returns { group, colliders } — colliders are simple circles/boxes in the XZ plane.
import {
  Group, Mesh, Object3D,
  CylinderGeometry, ConeGeometry, BoxGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Collector: bakes each primitive's transform into its geometry, bucketed by material key.
class Builder {
  constructor() { this.buckets = { stone: [], slate: [], window: [] }; this.colliders = []; this._o = new Object3D(); }
  add(key, geo, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
    const o = this._o;
    o.position.set(...pos); o.rotation.set(...rot); o.scale.set(...scale); o.updateMatrix();
    geo.applyMatrix4(o.matrix);
    this.buckets[key].push(geo);
  }
  collider(c) { this.colliders.push(c); }
  build(group, mats) {
    for (const key of Object.keys(this.buckets)) {
      const list = this.buckets[key];
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      const mesh = new Mesh(merged, mats[key]);
      mesh.castShadow = true; mesh.receiveShadow = (key !== 'window');
      mesh.name = 'castle-' + key;
      group.add(mesh);
    }
  }
}

function tower(b, x, z, r, h, { spire = true } = {}) {
  b.add('stone', new CylinderGeometry(r, r * 1.06, h, 16), { pos: [x, h / 2, z] });
  const crenN = 10;
  for (let i = 0; i < crenN; i++) {
    const a = (i / crenN) * Math.PI * 2;
    b.add('stone', new BoxGeometry(r * 0.32, 1.1, r * 0.32), { pos: [x + Math.cos(a) * r, h + 0.55, z + Math.sin(a) * r] });
  }
  if (spire) b.add('slate', new ConeGeometry(r * 1.15, h * 0.55, 16), { pos: [x, h + h * 0.275, z] });
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1;
    b.add('window', new BoxGeometry(0.6, 1.2, 0.25), {
      pos: [x + Math.cos(a) * (r + 0.02), h * (0.35 + k * 0.18), z + Math.sin(a) * (r + 0.02)],
      rot: [0, -a + Math.PI / 2, 0],
    });
  }
  b.collider({ type: 'circle', x, z, r: r + 0.3 });
}

function wall(b, x1, z1, x2, z2, h = 7, t = 2.2) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, ry = -Math.atan2(dz, dx);
  b.add('stone', new BoxGeometry(len, h, t), { pos: [cx, h / 2, cz], rot: [0, ry, 0] });
  const crenN = Math.max(3, Math.floor(len / 2.2));
  for (let i = 0; i < crenN; i++) {
    const f = -len / 2 + (i + 0.5) * (len / crenN);
    b.add('stone', new BoxGeometry(0.9, 1.0, t), {
      pos: [cx + Math.cos(ry) * f, h + 0.5, cz - Math.sin(ry) * f], rot: [0, ry, 0],
    });
  }
  b.collider({ type: 'box', x: cx, z: cz, hw: len / 2, hd: t / 2, angle: Math.atan2(dz, dx) });
}

function greatHall(b, x, z) {
  const W = 16, L = 34, H = 11;
  b.add('stone', new BoxGeometry(W, H, L), { pos: [x, H / 2, z] });
  b.add('slate', new CylinderGeometry(W * 0.72, W * 0.72, L, 3, 1), {
    pos: [x, H + W * 0.36, z], rot: [Math.PI / 2, Math.PI / 2, 0], scale: [1, 1, 0.62],
  });
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) {
    b.add('window', new BoxGeometry(0.3, 5, 1.6), { pos: [x + sx * (W / 2 + 0.02), 5.5, z - L / 2 + 4 + i * 5.2] });
  }
  b.collider({ type: 'box', x, z, hw: W / 2, hd: L / 2, angle: 0 });
}

export function buildCastle(scene, mats) {
  const group = new Group();
  group.name = 'castle';
  const b = new Builder();

  greatHall(b, 10, 6);
  tower(b, -6, -14, 6, 34);         // central keep
  tower(b, -6, -14, 3.2, 44);       // keep spire
  const ring = [
    [-24, 20, 4.5, 20], [24, 20, 4.5, 22], [-26, -26, 5, 26],
    [26, -24, 4.5, 24], [0, 30, 5.5, 18], [-30, -2, 4, 19], [30, 0, 4, 21],
  ];
  for (const [x, z, r, h] of ring) tower(b, x, z, r, h);
  const pts = [[-24, 20], [24, 20], [26, -24], [-26, -26], [-24, 20]];
  for (let i = 0; i < pts.length - 1; i++) wall(b, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);

  b.build(group, mats);
  scene.add(group);
  return { group, colliders: b.colliders };
}
