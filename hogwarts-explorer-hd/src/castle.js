// Procedural Hogwarts silhouette from primitives: round towers with conical slate
// spires, crenellated curtain walls, a gabled Great Hall and a tall central keep.
// Returns { group, colliders } — colliders are simple circles/boxes in the XZ plane.
import {
  Group, Mesh, CylinderGeometry, ConeGeometry, BoxGeometry, Vector3,
} from 'three';

function tower(mats, x, z, r, h, { spire = true, roof = 0x5a6476 } = {}) {
  const g = new Group();
  const body = new Mesh(new CylinderGeometry(r, r * 1.06, h, 16), mats.stone);
  body.position.y = h / 2; body.castShadow = body.receiveShadow = true;
  g.add(body);
  // crenellation ring
  const crenN = 10;
  for (let i = 0; i < crenN; i++) {
    const a = (i / crenN) * Math.PI * 2;
    const m = new Mesh(new BoxGeometry(r * 0.32, 1.1, r * 0.32), mats.stone);
    m.position.set(Math.cos(a) * r, h + 0.55, Math.sin(a) * r);
    m.castShadow = true; g.add(m);
  }
  if (spire) {
    const cone = new Mesh(new ConeGeometry(r * 1.15, h * 0.55, 16), mats.slate);
    cone.position.y = h + h * 0.275; cone.castShadow = true;
    g.add(cone);
  }
  // a couple of glowing windows
  for (let k = 0; k < 3; k++) {
    const w = new Mesh(new BoxGeometry(0.6, 1.2, 0.2), mats.window);
    const a = k * 2.1;
    w.position.set(Math.cos(a) * (r + 0.01), h * (0.35 + k * 0.18), Math.sin(a) * (r + 0.01));
    w.lookAt(w.position.x * 2, w.position.y, w.position.z * 2);
    g.add(w);
  }
  g.position.set(x, 0, z);
  return { group: g, collider: { type: 'circle', x, z, r: r + 0.3 } };
}

function wall(mats, x1, z1, x2, z2, h = 7, t = 2.2) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const g = new Group();
  const body = new Mesh(new BoxGeometry(len, h, t), mats.stone);
  body.position.y = h / 2; body.castShadow = body.receiveShadow = true;
  g.add(body);
  const crenN = Math.max(3, Math.floor(len / 2.2));
  for (let i = 0; i < crenN; i++) {
    const m = new Mesh(new BoxGeometry(0.9, 1.0, t), mats.stone);
    m.position.set(-len / 2 + (i + 0.5) * (len / crenN), h + 0.5, 0);
    m.castShadow = true; g.add(m);
  }
  g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
  g.rotation.y = -Math.atan2(dz, dx);
  return {
    group: g,
    collider: { type: 'box', x: (x1 + x2) / 2, z: (z1 + z2) / 2, hw: len / 2, hd: t / 2, angle: Math.atan2(dz, dx) },
  };
}

function greatHall(mats, x, z) {
  const g = new Group();
  const W = 16, L = 34, H = 11;
  const body = new Mesh(new BoxGeometry(W, H, L), mats.stone);
  body.position.y = H / 2; body.castShadow = body.receiveShadow = true;
  g.add(body);
  // gabled slate roof (triangular prism via a rotated 3-sided cylinder)
  const roof = new Mesh(new CylinderGeometry(W * 0.72, W * 0.72, L, 3, 1), mats.slate);
  roof.rotation.x = Math.PI / 2; roof.rotation.y = Math.PI / 2;
  roof.position.y = H + W * 0.36; roof.scale.set(1, 1, 0.62); roof.castShadow = true;
  g.add(roof);
  // tall arched glowing windows down the long sides
  for (let i = 0; i < 6; i++) {
    for (const sx of [-1, 1]) {
      const w = new Mesh(new BoxGeometry(0.3, 5, 1.6), mats.window);
      w.position.set(sx * (W / 2 + 0.01), 5.5, -L / 2 + 4 + i * 5.2);
      g.add(w);
    }
  }
  g.position.set(x, 0, z);
  return { group: g, collider: { type: 'box', x, z, hw: W / 2, hd: L / 2, angle: 0 } };
}

export function buildCastle(scene, mats) {
  const group = new Group();
  group.name = 'castle';
  const colliders = [];
  const add = (r) => { group.add(r.group); colliders.push(r.collider); };

  // Great Hall (south wing) + central keep
  add(greatHall(mats, 10, 6));
  add(tower(mats, -6, -14, 6, 34, { roof: 0x4a5566 }));      // central keep
  add(tower(mats, -6, -14, 3.2, 44, { spire: true }));       // keep spire tower

  // ring of corner/feature towers
  const ring = [
    [-24, 20, 4.5, 20], [24, 20, 4.5, 22], [-26, -26, 5, 26],
    [26, -24, 4.5, 24], [0, 30, 5.5, 18], [-30, -2, 4, 19], [30, 0, 4, 21],
  ];
  for (const [x, z, r, h] of ring) add(tower(mats, x, z, r, h));

  // curtain walls connecting the ring
  const pts = [[-24, 20], [24, 20], [26, -24], [-26, -26], [-24, 20]];
  for (let i = 0; i < pts.length - 1; i++) {
    add(wall(mats, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }

  scene.add(group);
  return { group, colliders };
}
