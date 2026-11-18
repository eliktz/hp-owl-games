// The practice corner for the free-play spells (freecast.js): a little open-air "spell yard" on the
// lawn a few steps ahead-right of where free play starts (spawn 0,60 facing the castle), clear of the
// approach to the front doors, the courtyard friends, the quest stars, the hut, the glasshouse and the
// two outdoor course areas. All in code, in the spell courses' toy style.
// Draw calls: 1 merged static mesh (torch posts, chest body, pedestal, table, flower-bed frame, edge
// stones, pennant) + 1 skinned mesh holding EVERY prop that moves (one bone per prop: feather, book,
// crate, broom, chest lid, lock, reward star, six vase shards, pumpkin, five flowers) + 1 instanced
// additive mesh for the three torch flames and their glows (hidden while none is lit).
import {
  Group, Mesh, InstancedMesh, PlaneGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry,
  LatheGeometry, ShapeGeometry, Shape, Vector2, Vector3, Quaternion, Euler, Matrix4, Color, BufferAttribute, Uint16BufferAttribute,
  MeshBasicMaterial, MeshStandardMaterial, AdditiveBlending, DoubleSide, SkinnedMesh, Skeleton, Bone,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CORNER = { x: 7, z: 53 };   // world x,z of the corner's centre
export const B = { feather: 0, book: 1, crate: 2, broom: 3, lid: 4, lock: 5, reward: 6, shard0: 7, pumpkin: 13, flower0: 14 };
const NSHARD = 6, NFLOWER = 5;

const _m4 = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function paint(geo, hex, hex2 = null, axis = 'y') {
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), a = new Color(hex), b = new Color(hex2 ?? hex);
  geo.computeBoundingBox(); const bb = geo.boundingBox, lo = bb.min[axis], span = (bb.max[axis] - lo) || 1, ax = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  for (let i = 0; i < n; i++) { const k = (geo.attributes.position.getComponent(i, ax) - lo) / span; _c.copy(a).lerp(b, k); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  return geo;
}
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return geo.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
}
function rod(a, b, r0, r1 = r0, seg = 6) {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  const g = new CylinderGeometry(r1, r0, len, seg); g.translate(0, len / 2, 0);
  _q.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  return g.applyMatrix4(_m4.compose(new Vector3(a[0], a[1], a[2]), _q, _s.set(1, 1, 1)));
}
export function plain(g) { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; }
export function bone(geo, idx) {
  const g = plain(geo), n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = idx; sw[i * 4] = 1; }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new BufferAttribute(sw, 4));
  return g;
}
export { paint, place, rod };

function featherGeo() {
  const s = new Shape(); s.moveTo(0, 0);
  s.quadraticCurveTo(0.16, 0.075, 0.44, 0.02); s.quadraticCurveTo(0.49, 0, 0.44, -0.015); s.quadraticCurveTo(0.17, -0.08, 0.04, -0.02); s.lineTo(0, 0);
  const vane = paint(new ShapeGeometry(s, 8), 0xf6f1e6, 0xd8ccff, 'x'); vane.rotateX(-Math.PI / 2);
  const quill = paint(place(new CylinderGeometry(0.006, 0.004, 0.54, 4), 0.22, 0.004, 0, 0, 0, Math.PI / 2), 0xd8c9a0);
  return mergeGeometries([plain(vane), plain(quill)]).translate(-0.22, 0, 0);
}
function starGeo(r = 0.2) {
  const s = new Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  return paint(new ShapeGeometry(s), 0xffe27a, 0xffb820);
}

export function buildCorner({ scene, heightAt, colliders }) {
  const Y0 = heightAt(CORNER.x, CORNER.z);
  const gy = (lx, lz) => heightAt(CORNER.x + lx, CORNER.z + lz) - Y0;   // ground height under a local point
  const group = new Group(); group.name = 'freecast-corner'; group.position.set(CORNER.x, Y0, CORNER.z);
  const stat = [], mov = [], bones = [];
  const S = (g) => stat.push(plain(g));
  const mkBone = (idx, x, y, z) => { const b = new Bone(); b.name = 'fc' + idx; b.position.set(x, y, z); bones[idx] = b; return b; };
  const WOOD = 0x6a4424, DARK = 0x3e2816, IRON = 0x34303a, STONE = 0x8a7f72, STONE2 = 0xb9ab93, GOLD = 0xd8b04a;

  // --- three standing torches in an arc at the back (unlit: charred logs in an iron bowl) ---
  const TORCH = [[-2.4, -2.3], [0, -2.9], [2.4, -2.3]].map(([x, z]) => ({ x, z, y: gy(x, z) }));
  for (const t of TORCH) {
    S(paint(place(new CylinderGeometry(0.16, 0.24, 0.16, 8), t.x, t.y + 0.06, t.z), STONE, STONE2));
    S(paint(rod([t.x, t.y + 0.1, t.z], [t.x, t.y + 1.25, t.z], 0.055, 0.045, 7), DARK, WOOD));
    S(paint(place(new TorusGeometry(0.06, 0.018, 5, 10), t.x, t.y + 0.9, t.z, Math.PI / 2), GOLD));
    S(paint(place(new CylinderGeometry(0.19, 0.08, 0.17, 10), t.x, t.y + 1.32, t.z), IRON, 0x5a5560));
    for (const r of [0.5, -0.6]) S(paint(place(new BoxGeometry(0.26, 0.05, 0.05), t.x, t.y + 1.42, t.z, 0, r, 0.15), 0x2a1a10, 0x4a3018));
    t.flameY = t.y + 1.62;
  }
  // --- the locked chest (body static; lid + lock + reward are bones) ---
  const CH = { x: 0, z: -1.2 }; CH.y = gy(CH.x, CH.z);
  S(paint(place(new BoxGeometry(0.8, 0.42, 0.5), CH.x, CH.y + 0.23, CH.z), 0x5a361a, 0x7a5028));
  for (const dx of [-0.3, 0.3]) S(paint(place(new BoxGeometry(0.07, 0.43, 0.51), CH.x + dx, CH.y + 0.235, CH.z), GOLD));
  S(paint(place(new BoxGeometry(0.62, 0.04, 0.36), CH.x, CH.y + 0.43, CH.z), 0xffd23f));          // the gold inside
  for (const dx of [-0.34, 0.34]) for (const dz of [-0.19, 0.19]) S(paint(place(new BoxGeometry(0.08, 0.05, 0.08), CH.x + dx, CH.y + 0.025, CH.z + dz), DARK));
  const hinge = [CH.x, CH.y + 0.44, CH.z - 0.25];
  mkBone(B.lid, ...hinge);
  mov.push(bone(paint(place(new BoxGeometry(0.82, 0.13, 0.52), hinge[0], hinge[1] + 0.065, hinge[2] + 0.26), 0x7a5028, 0x8a5a2e), B.lid));
  for (const dx of [-0.3, 0.3]) mov.push(bone(paint(place(new BoxGeometry(0.075, 0.14, 0.53), hinge[0] + dx, hinge[1] + 0.07, hinge[2] + 0.26), GOLD), B.lid));
  const LK = [CH.x, CH.y + 0.38, CH.z + 0.27];
  mkBone(B.lock, ...LK);
  mov.push(bone(paint(place(new BoxGeometry(0.13, 0.14, 0.05), LK[0], LK[1], LK[2]), 0xffd86a, 0xc8962a), B.lock));
  mov.push(bone(paint(place(new TorusGeometry(0.045, 0.014, 6, 12, Math.PI), LK[0], LK[1] + 0.07, LK[2]), 0xe8c050), B.lock));
  mov.push(bone(paint(place(new BoxGeometry(0.025, 0.05, 0.02), LK[0], LK[1] - 0.01, LK[2] + 0.03), 0x2a1a10), B.lock));
  const RW = [CH.x, CH.y + 0.4, CH.z];
  mkBone(B.reward, ...RW);
  mov.push(bone(place(starGeo(0.2), RW[0], RW[1], RW[2]), B.reward));
  mov.push(bone(paint(place(new SphereGeometry(0.06, 8, 6), RW[0], RW[1], RW[2]), 0xfff2b0), B.reward));
  // --- the pedestal with the vase (six shards, each a bone; whole = all at rest) ---
  const PD = { x: 2.7, z: -0.3 }; PD.y = gy(PD.x, PD.z); PD.top = PD.y + 0.78;
  S(paint(place(new CylinderGeometry(0.2, 0.27, 0.72, 10), PD.x, PD.y + 0.36, PD.z), STONE, STONE2));
  S(paint(place(new BoxGeometry(0.46, 0.06, 0.46), PD.x, PD.y + 0.75, PD.z), STONE2));
  S(paint(place(new BoxGeometry(0.5, 0.08, 0.5), PD.x, PD.y + 0.04, PD.z), STONE));
  const prof = [[0.001, 0], [0.11, 0], [0.17, 0.07], [0.21, 0.2], [0.18, 0.34], [0.1, 0.44], [0.085, 0.5], [0.13, 0.57]].map(([r, y]) => new Vector2(r, y));
  for (let i = 0; i < NSHARD; i++) {
    const idx = B.shard0 + i; mkBone(idx, PD.x, PD.top, PD.z);
    const g = new LatheGeometry(prof, 3, i * Math.PI * 2 / NSHARD, Math.PI * 2 / NSHARD);
    mov.push(bone(paint(place(g, PD.x, PD.top, PD.z), i % 2 ? 0x2f5fb8 : 0x3a70c8, 0xf2ecdc), idx));
  }
  // where the shards lie when the vase is broken: around the pedestal foot, face down, scattered
  const shardsBroken = [];
  for (let i = 0; i < NSHARD; i++) {
    const a = i * 1.07 + 0.4, r = 0.5 + (i % 3) * 0.13, x = PD.x + Math.cos(a) * r, z = PD.z + Math.sin(a) * r;
    shardsBroken.push({ p: new Vector3(x - Math.cos(a) * 0.12, gy(x, z) + 0.02, z - Math.sin(a) * 0.12), q: new Quaternion().setFromEuler(new Euler(i % 2 ? 1.45 : -1.45, a * 2.3, (i % 3) * 0.6)) });
  }
  // --- a little table with the feather and the book ---
  const TB = { x: -2.6, z: 0.1 }; TB.y = gy(TB.x, TB.z); TB.top = TB.y + 0.74;
  S(paint(place(new BoxGeometry(1.25, 0.06, 0.62), TB.x, TB.top - 0.03, TB.z), WOOD, 0x8a5a2e));
  for (const dx of [-0.55, 0.55]) for (const dz of [-0.24, 0.24]) S(paint(place(new BoxGeometry(0.07, 0.72, 0.07), TB.x + dx, TB.y + 0.36, TB.z + dz), DARK));
  const FE = [TB.x - 0.3, TB.top + 0.012, TB.z + 0.05];
  mkBone(B.feather, ...FE);
  mov.push(bone(place(featherGeo(), FE[0], FE[1], FE[2], 0, 0.5, 0, 1.6), B.feather));
  const BK = [TB.x + 0.3, TB.top + 0.045, TB.z];
  mkBone(B.book, ...BK);
  mov.push(bone(paint(place(new BoxGeometry(0.36, 0.085, 0.27), BK[0], BK[1], BK[2], 0, -0.25, 0), 0x8a1e24, 0xb3262a), B.book));
  mov.push(bone(paint(place(new BoxGeometry(0.34, 0.065, 0.275), BK[0] + 0.012, BK[1], BK[2] + 0.004, 0, -0.25, 0), 0xf0e4c0), B.book));
  mov.push(bone(paint(place(new BoxGeometry(0.02, 0.09, 0.28), BK[0] - 0.17, BK[1], BK[2] - 0.045, 0, -0.25, 0), 0xd8a940), B.book));
  // --- a wooden crate on the grass ---
  const CR = { x: -1.1, z: 1.3 }; CR.y = gy(CR.x, CR.z);
  const CRC = [CR.x, CR.y + 0.27, CR.z];
  mkBone(B.crate, ...CRC);
  mov.push(bone(paint(place(new BoxGeometry(0.52, 0.52, 0.52), CRC[0], CRC[1], CRC[2], 0, 0.3, 0), 0xa87a44, 0xc89a5a), B.crate));
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const ox = 0.25 * sx, oz = 0.25 * sz, c = Math.cos(0.3), s = Math.sin(0.3);
    mov.push(bone(paint(place(new BoxGeometry(0.06, 0.54, 0.06), CRC[0] + ox * c + oz * s, CRC[1], CRC[2] - ox * s + oz * c, 0, 0.3, 0), 0x6a4424), B.crate));
  }
  mov.push(bone(paint(place(new BoxGeometry(0.54, 0.06, 0.53), CRC[0], CRC[1], CRC[2], 0.78, 0.3, 0), 0x7a5028), B.crate));
  // --- a toy broom lying on two stones (Accio) ---
  const BR = { x: 0.9, z: 1.7 }; BR.y = gy(BR.x, BR.z);
  for (const dx of [-0.35, 0.3]) S(paint(place(new SphereGeometry(0.12, 7, 5), BR.x + dx, BR.y + 0.04, BR.z, 0, 0, 0, 1, 0.55, 1), 0x8a8478, 0xa8a094));
  const BRC = [BR.x, BR.y + 0.14, BR.z];
  mkBone(B.broom, ...BRC);
  mov.push(bone(paint(rod([BRC[0] - 0.62, BRC[1], BRC[2]], [BRC[0] + 0.36, BRC[1], BRC[2]], 0.024, 0.02, 6), 0x8a5a2e, 0x6a4424, 'x'), B.broom));
  mov.push(bone(paint(rod([BRC[0] + 0.3, BRC[1], BRC[2]], [BRC[0] + 0.72, BRC[1], BRC[2]], 0.035, 0.11, 9), 0xd8b060, 0xb88a3a, 'x'), B.broom));
  mov.push(bone(paint(place(new TorusGeometry(0.04, 0.012, 5, 10), BRC[0] + 0.33, BRC[1], BRC[2], 0, Math.PI / 2), 0xb8262a), B.broom));
  // --- the flower bed (five wilted flowers) with a small pumpkin ---
  const BD = { x: 2.5, z: 1.8 }; BD.y = gy(BD.x, BD.z);
  for (const dz of [-0.36, 0.36]) S(paint(place(new BoxGeometry(1.8, 0.2, 0.07), BD.x, BD.y + 0.1, BD.z + dz), WOOD, 0x8a5a2e));
  for (const dx of [-0.88, 0.88]) S(paint(place(new BoxGeometry(0.07, 0.2, 0.78), BD.x + dx, BD.y + 0.1, BD.z), WOOD, 0x8a5a2e));
  S(paint(place(new BoxGeometry(1.72, 0.16, 0.66), BD.x, BD.y + 0.08, BD.z), 0x2e2014, 0x4a3420));
  const PK = [BD.x + 0.5, BD.y + 0.16, BD.z];
  mkBone(B.pumpkin, ...PK);
  mov.push(bone(paint(place(new SphereGeometry(0.17, 14, 9), PK[0], PK[1] + 0.12, PK[2], 0, 0, 0, 1, 0.72, 1), 0xd8701a, 0xf09a3a), B.pumpkin));
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; mov.push(bone(paint(place(new SphereGeometry(0.06, 6, 5), PK[0] + Math.cos(a) * 0.13, PK[1] + 0.12, PK[2] + Math.sin(a) * 0.13, 0, -a, 0, 0.7, 1.9, 1.1), 0xc8601a, 0xe88a30), B.pumpkin)); }
  mov.push(bone(paint(rod([PK[0], PK[1] + 0.22, PK[2]], [PK[0] + 0.03, PK[1] + 0.31, PK[2]], 0.022, 0.014, 5), 0x4a6a2a), B.pumpkin));
  mov.push(bone(paint(place(new SphereGeometry(0.07, 6, 4), PK[0] - 0.08, PK[1] + 0.24, PK[2] + 0.04, 0, 0.6, 0, 1, 0.2, 0.6), 0x3a8a2a), B.pumpkin));
  const PETAL = [0xe8473a, 0xff7ab8, 0xf2c230, 0xa86adf, 0xfff4e0];
  const flowers = [];
  for (let i = 0; i < NFLOWER; i++) {
    const idx = B.flower0 + i, fx = BD.x - 0.7 + i * 0.22, fz = BD.z + (i % 2 ? 0.14 : -0.12), fy = BD.y + 0.16;
    mkBone(idx, fx, fy, fz); flowers.push(idx);
    const h = 0.34 + (i % 3) * 0.05;
    mov.push(bone(paint(rod([fx, fy, fz], [fx, fy + h, fz], 0.014, 0.011, 5), 0x3a7a2a, 0x5aa83a), idx));
    mov.push(bone(paint(place(new SphereGeometry(0.05, 6, 4), fx + 0.04, fy + 0.12, fz, 0, 0, -0.6, 1, 0.25, 0.6), 0x4a9a34), idx));
    mov.push(bone(paint(place(new SphereGeometry(0.035, 7, 5), fx, fy + h + 0.01, fz), 0xffd23f), idx));
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; mov.push(bone(paint(place(new SphereGeometry(0.045, 6, 4), fx + Math.cos(a) * 0.05, fy + h, fz + Math.sin(a) * 0.05, 0, -a, 0, 1.25, 0.35, 0.8), PETAL[i]), idx)); }
  }
  // --- a ring of edge stones (open at the front, toward the spawn) and a little pennant ---
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI * 0.95 + i * (Math.PI * 1.55 / 12) - Math.PI * 0.05, x = Math.cos(a) * 4.1, z = Math.sin(a) * 3.7;
    if (z > 2.8 && Math.abs(x) < 1.6) continue;
    S(paint(place(new SphereGeometry(0.22, 7, 5), x, gy(x, z) + 0.05, z, 0, a, 0, 1 + (i % 3) * 0.2, 0.5, 0.8), 0x8a8478, 0xaaa294));
  }
  const PN = { x: -3.6, z: -1.6 }; PN.y = gy(PN.x, PN.z);
  S(paint(rod([PN.x, PN.y, PN.z], [PN.x, PN.y + 2.3, PN.z], 0.04, 0.03, 6), DARK, WOOD));
  S(paint(place(new SphereGeometry(0.06, 8, 6), PN.x, PN.y + 2.33, PN.z), GOLD));
  { const s = new Shape(); s.moveTo(0, 0); s.lineTo(0.75, -0.2); s.lineTo(0, -0.42); s.lineTo(0, 0);
    S(paint(place(new ShapeGeometry(s), PN.x + 0.03, PN.y + 2.25, PN.z, 0, -0.5, 0), 0x6a3aa8, 0x8a5ad0, 'x'));
    S(paint(place(new ShapeGeometry(s), PN.x + 0.03, PN.y + 2.25, PN.z - 0.005, 0, Math.PI - 0.5, 0, -1, 1, 1), 0x6a3aa8, 0x8a5ad0, 'x')); }
  S(paint(place(starGeoFlat(), PN.x + 0.24, PN.y + 2.04, PN.z + 0.13, 0, -0.5, 0), 0xffd76a));

  // --- the meshes ---
  const statMesh = new Mesh(mergeGeometries(stat), new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: DoubleSide }));
  statMesh.name = 'freecast-corner-static'; statMesh.castShadow = true; statMesh.receiveShadow = true; group.add(statMesh);
  const skin = new SkinnedMesh(mergeGeometries(mov), new MeshStandardMaterial({ vertexColors: true, roughness: 0.65, side: DoubleSide }));
  skin.name = 'freecast-corner-props'; skin.castShadow = true; skin.frustumCulled = false;
  for (const b of bones) skin.add(b);
  group.add(skin);
  scene.add(group);
  group.updateMatrixWorld(true);
  skin.bind(new Skeleton(bones));
  const rest = bones.map(b => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }));
  // flames: 3 cores + 3 glows, additive, camera-facing (posed by freecast.js)
  const flames = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending }), 6);
  flames.name = 'freecast-flames'; flames.frustumCulled = false; flames.visible = false; flames.renderOrder = 3;
  for (let i = 0; i < 6; i++) { flames.setMatrixAt(i, _m4.makeScale(0, 0, 0)); flames.setColorAt(i, _c.setHex(i < 3 ? 0xffb040 : 0xff7a20)); }
  group.add(flames);
  for (const o of [statMesh, skin, flames]) o.raycast = () => {};

  // solid bits (circles in the outdoor colliders, world coords)
  const W = (lx, lz) => ({ x: CORNER.x + lx, z: CORNER.z + lz });
  const col = (lx, lz, r) => { const w = W(lx, lz); colliders.push({ type: 'circle', x: w.x, z: w.z, r, freecast: true }); };
  for (const t of TORCH) col(t.x, t.z, 0.25);
  col(CH.x, CH.z, 0.48); col(PD.x, PD.z, 0.32); col(TB.x - 0.35, TB.z, 0.42); col(TB.x + 0.35, TB.z, 0.42); col(BD.x - 0.5, BD.z, 0.42); col(BD.x + 0.45, BD.z, 0.42); col(PN.x, PN.z, 0.12);

  return { group, statMesh, skin, bones, rest, flames, Y0, TORCH, CH, PD, TB, CR, BR, BD, shardsBroken, flowers, NSHARD, NFLOWER, setFlameMaterialMap: (tex) => { flames.material.map = tex; flames.material.needsUpdate = true; } };
}
function starGeoFlat() {
  const s = new Shape(), r = 0.09;
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  return new ShapeGeometry(s);
}
