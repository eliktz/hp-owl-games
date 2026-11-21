// The duelling spot for the free-play spells (freecast.js), a few steps right of the practice corner
// (freecast-corner.js): two friendly straw training dummies on posts at the end of a short striped duelling
// strip, each holding a toy wooden wand, and a tall old wardrobe that rattles now and then.
//   Expelliarmus: the toy wand spins out of the dummy's hand in a high arc, lands in the grass, hops back.
//   Stupefy:      the dummy spins round on its post, wobbles dizzy with stars round its head, rights itself.
//   Protego:      a blue half-dome shield in front of Harry for ~4 s; a dummy "casts" a slow pink puff that
//                 bounces off it with a ping and a ripple (a show only: nothing can hurt Harry).
//   Riddikulus:   the wardrobe doors burst open and something silly comes out (a giant rubber duck, a spider
//                 on roller skates in a party hat, a wobbling jelly with googly eyes, a jack-in-the-box),
//                 bounces about, giggles, pops back in, the doors shut. Never anything scary.
// Draw calls: 1 merged static mesh (posts, strip, rails, start star) + 1 skinned mesh for everything that
// moves (two dummy bodies, two wands, two star rings, the wardrobe and its doors, the four surprises)
// + 1 additive shield mesh (only while Protego is up). Hidden beyond 70 m and indoors. Nothing allocated per frame.
import {
  Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry, CircleGeometry, LatheGeometry,
  ShapeGeometry, Shape, Vector2, Vector3, Quaternion, Euler, Matrix4, CanvasTexture, SRGBColorSpace, RepeatWrapping,
  MeshBasicMaterial, MeshStandardMaterial, AdditiveBlending, DoubleSide, SkinnedMesh, Skeleton, Bone,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plain, bone, paint, place, rod } from './freecast-corner.js';

export const DUEL = { x: 14.5, z: 55.5 };   // world x,z of the spot's centre (the corner is at 7,53)
const DB = { body0: 0, body1: 1, wand0: 2, wand1: 3, stars0: 4, stars1: 5, ward: 6, doorL: 7, doorR: 8, duck: 9, spider: 10, jelly: 11, jackBox: 12, jackSpring: 13, jackHead: 14,
  arm0L: 15, arm0R: 16, arm1L: 17, arm1R: 18 };   // the arms ride the body (posed every frame) so Petrificus can snap them to its sides
const KINDS = ['duck', 'spider', 'jelly', 'jack'];
const SAY = { duck: 'קְוָואק! 🦆', spider: 'וִוּיי! 🛼', jelly: 'בּוֹינְג! 🍮', jack: 'הוֹפְּ-הוֹפְּ! 🎁' };
const WY = -0.6;   // the wardrobe turns to face the strip

const _m4 = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3();
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const backOut = (k) => { k = Math.min(1, Math.max(0, k)); const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
function starShape(r) {
  const s = new Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  return new ShapeGeometry(s);
}
// a friendly face on the +z side: two eyes and a smile (and cheeks)
function face(P, y, z, sc = 1, eye = 0x2a1a12, cheek = 0xff9a9a) {
  for (const sx of [-1, 1]) {
    P.push(paint(place(new SphereGeometry(0.028 * sc, 8, 6), sx * 0.06 * sc, y + 0.03 * sc, z), eye));
    P.push(paint(place(new SphereGeometry(0.03 * sc, 8, 6), sx * 0.1 * sc, y - 0.025 * sc, z - 0.012 * sc, 0, 0, 0, 1, 0.6, 0.4), cheek));
  }
  P.push(paint(place(new TorusGeometry(0.05 * sc, 0.008 * sc, 4, 10, Math.PI), 0, y - 0.02 * sc, z + 0.004, 0, 0, Math.PI), eye));
}
function googly(P, x, y, z, r) {
  P.push(paint(place(new SphereGeometry(r, 12, 9), x, y, z), 0xffffff, 0xe8eef8));
  P.push(paint(place(new SphereGeometry(r * 0.5, 9, 7), x + (x > 0 ? 0.2 : -0.2) * r, y - 0.3 * r, z + r * 0.62), 0x141018));
}
// silly-thing geometry: base at y 0, facing +z
function duckGeo() {
  const P = [], Y = 0xe8b414, Y2 = 0xf2c838;
  P.push(paint(place(new SphereGeometry(0.4, 16, 12), 0, 0.33, -0.05, 0, 0, 0, 1, 0.78, 1.22), 0xd8a010, Y2));
  P.push(paint(place(new ConeGeometry(0.14, 0.3, 10), 0, 0.5, -0.5, -0.9, 0, 0), Y, Y2));
  P.push(paint(place(new SphereGeometry(0.25, 14, 10), 0, 0.8, 0.26), Y, Y2));
  P.push(paint(place(new SphereGeometry(0.12, 12, 8), 0, 0.75, 0.5, 0, 0, 0, 1.3, 0.45, 1.25), 0xff7a10, 0xffa040));
  for (const sx of [-1, 1]) {
    googly(P, sx * 0.1, 0.88, 0.43, 0.06);
    P.push(paint(place(new SphereGeometry(0.2, 10, 8), sx * 0.36, 0.4, -0.02, 0, 0, sx * 0.3, 0.32, 0.62, 1), 0xf0b010, Y));
    P.push(paint(place(new SphereGeometry(0.04, 8, 6), sx * 0.17, 0.76, 0.42, 0, 0, 0, 1, 0.6, 0.5), 0xff8a8a));
  }
  return mergeGeometries(P.map(plain));
}
function spiderGeo() {
  const P = [], PU = 0x7a48c0, PU2 = 0x9a6ae0, LEG = 0x4a2a80;
  P.push(paint(place(new SphereGeometry(0.28, 16, 12), 0, 0.46, -0.04, 0, 0, 0, 1, 0.85, 1.12), PU, PU2));
  P.push(paint(place(new SphereGeometry(0.2, 14, 10), 0, 0.52, 0.2), PU, PU2));
  googly(P, -0.09, 0.6, 0.33, 0.085); googly(P, 0.09, 0.6, 0.33, 0.085);
  P.push(paint(place(new TorusGeometry(0.06, 0.011, 4, 10, Math.PI), 0, 0.48, 0.385, 0, 0, Math.PI), 0x2a1430));
  // party hat with a pom-pom
  const hat = new ConeGeometry(0.11, 0.3, 12); hat.translate(0, 0.15, 0);
  P.push(paint(place(hat, 0.04, 0.68, 0.16, 0.15, 0, -0.3), 0xff5ab0, 0xffe040));
  P.push(paint(place(new SphereGeometry(0.045, 8, 6), 0.125, 0.955, 0.205), 0xffffff));
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
    const zz = -0.2 + i * 0.13, kn = [sx * 0.46, 0.66, zz * 1.5], ft = [sx * 0.6, 0.08, zz * 1.8];
    P.push(paint(rod([sx * 0.2, 0.46, zz], kn, 0.03, 0.026, 5), LEG, PU));
    P.push(paint(rod(kn, ft, 0.026, 0.02, 5), LEG, PU));
    // a roller skate on every foot: a red boot plate + two wheels
    P.push(paint(place(new BoxGeometry(0.09, 0.045, 0.15), ft[0], 0.065, ft[2]), 0xe83a3a, 0xff6a5a));
    for (const wz of [-0.05, 0.05]) P.push(paint(place(new CylinderGeometry(0.025, 0.025, 0.03, 8), ft[0], 0.027, ft[2] + wz, 0, 0, Math.PI / 2), 0xffe040));
  }
  return mergeGeometries(P.map(plain));
}
function jellyGeo() {
  const P = [];
  P.push(paint(place(new CylinderGeometry(0.46, 0.4, 0.04, 20), 0, 0.02, 0), 0xdfe8ff, 0xffffff));
  const prof = [[0.001, 0.04], [0.36, 0.04], [0.38, 0.12], [0.3, 0.2], [0.34, 0.3], [0.26, 0.4], [0.28, 0.5], [0.16, 0.58], [0.001, 0.6]].map(([r, y]) => new Vector2(r, y));
  P.push(paint(new LatheGeometry(prof, 18), 0x2a9a2a, 0x6ad050));
  P.push(paint(place(new SphereGeometry(0.065, 10, 8), 0, 0.66, 0), 0xe8202a, 0xff5050));
  P.push(paint(rod([0, 0.7, 0], [0.04, 0.8, -0.02], 0.008, 0.006, 4), 0x3a6a2a));
  googly(P, -0.11, 0.38, 0.28, 0.08); googly(P, 0.11, 0.38, 0.28, 0.08);
  P.push(paint(place(new TorusGeometry(0.07, 0.012, 4, 10, Math.PI), 0, 0.25, 0.345, 0, 0, Math.PI), 0x1a4a1a));
  return mergeGeometries(P.map(plain));
}
function jackBoxGeo() {
  const P = [];
  P.push(paint(place(new BoxGeometry(0.5, 0.5, 0.5), 0, 0.25, 0), 0xd83030, 0xffd040));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(paint(place(new BoxGeometry(0.06, 0.52, 0.06), sx * 0.24, 0.26, sz * 0.24), 0x2a5ad0));
  P.push(paint(place(starShape(0.1), 0, 0.27, 0.256), 0xffffff, 0xffe8a0));
  P.push(paint(place(new BoxGeometry(0.52, 0.04, 0.52), 0, 0.5 + 0.2, -0.27, -1.3, 0, 0), 0x2a5ad0, 0x5a8af0));   // the lid, flung open
  P.push(paint(rod([0.25, 0.28, 0], [0.38, 0.28, 0], 0.015, 0.015, 5), 0xc0c0c8));
  P.push(paint(rod([0.38, 0.28, 0], [0.38, 0.42, 0], 0.015, 0.015, 5), 0xc0c0c8));
  P.push(paint(place(new SphereGeometry(0.035, 8, 6), 0.38, 0.44, 0), 0xffd040));
  return mergeGeometries(P.map(plain));
}
function jackSpringGeo() {   // base at 0, 0.5 m tall at rest
  const P = [];
  for (let i = 0; i < 7; i++) P.push(paint(place(new TorusGeometry(0.09, 0.018, 5, 12), 0, 0.03 + i * 0.075, 0, Math.PI / 2 + (i % 2 ? 0.15 : -0.15), 0, 0), 0xc8ccd8, 0xf0f2f8));
  return mergeGeometries(P.map(plain));
}
function jackHeadGeo() {     // base (the collar) at 0
  const P = [];
  P.push(paint(place(new TorusGeometry(0.15, 0.05, 6, 14), 0, 0.02, 0, Math.PI / 2), 0xffd040, 0xff5050));
  P.push(paint(place(new SphereGeometry(0.2, 16, 12), 0, 0.22, 0), 0xffd0b0, 0xffe0c8));
  P.push(paint(place(new SphereGeometry(0.045, 8, 6), 0, 0.2, 0.2), 0xff4040));
  face(P, 0.22, 0.19, 1.6);
  for (const sx of [-1, 1]) {   // a jolly two-pointed hat
    const c = new ConeGeometry(0.1, 0.32, 10); c.translate(0, 0.16, 0);
    P.push(paint(place(c, sx * 0.08, 0.34, 0, 0, 0, -sx * 0.9), sx < 0 ? 0xe83a3a : 0x3a6ae8, sx < 0 ? 0xff7a6a : 0x7aa0ff));
    P.push(paint(place(new SphereGeometry(0.04, 8, 6), sx * 0.33, 0.52, 0), 0xffd040));
  }
  return mergeGeometries(P.map(plain));
}

export function createDuel({ scene, camera, player, heightAt, fun, emit, burst, bolt, boltAhead, tip, tipV, best }) {
  const pos = player.pos;
  const Y0 = heightAt(DUEL.x, DUEL.z);
  const gy = (lx, lz) => heightAt(DUEL.x + lx, DUEL.z + lz) - Y0;
  const group = new Group(); group.name = 'freecast-duel'; group.position.set(DUEL.x, Y0, DUEL.z);
  const stat = [], mov = [], bones = [];
  const S = (g) => stat.push(plain(g));
  let vCum = 0;   // running vertex count of the skinned mesh (merge order = push order) for per-dummy tints
  const M = (g, i) => { const gg = bone(g, i), s = vCum; vCum += gg.attributes.position.count; mov.push(gg); return [s, vCum]; };
  const mkBone = (idx, x, y, z) => { const b = new Bone(); b.name = 'fd' + idx; b.position.set(x, y, z); bones[idx] = b; return b; };
  const WOOD = 0x6a4424, DARK = 0x3e2816, IRON = 0x34303a, GOLD = 0xd8b04a, OAK = 0x4a2e1c, OAK2 = 0x6e4a2e;

  // --- the duelling strip: crimson and gold stripes between two dark rails, a gold star where Harry stands ---
  const Z0 = -1.3, Z1 = 3.0, NS = 8, SW = 1.4;
  for (let i = 0; i < NS; i++) {
    const z = Z0 + (i + 0.5) * (Z1 - Z0) / NS, y = gy(0, z);
    S(paint(place(new BoxGeometry(SW, 0.035, (Z1 - Z0) / NS + 0.002), 0, y + 0.012, z), i % 2 ? 0x8a6a28 : 0x5a1016, i % 2 ? 0x9a7a32 : 0x6a161c));
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
    const za = Z0 + i * (Z1 - Z0) / 2, zb = za + (Z1 - Z0) / 2;
    S(paint(place(new BoxGeometry(0.08, 0.07, zb - za), sx * (SW / 2 + 0.04), (gy(0, za) + gy(0, zb)) / 2 + 0.03, (za + zb) / 2), DARK, WOOD));
  }
  S(paint(place(starShape(0.28), 0, gy(0, 2.35) + 0.034, 2.35, -Math.PI / 2, 0, 0), 0xffe27a, 0xffb820));

  // --- two training dummies on posts at the far end, facing the strip (+z) ---
  const DUM = [-0.95, 0.95].map((x, i) => ({ i, x, z: -2.2, y: gy(x, -2.2) }));
  for (const d of DUM) {
    const { x, z, y } = d;
    for (const r of [0.6, -0.97]) S(paint(place(new BoxGeometry(0.9, 0.08, 0.13), x, y + 0.04, z, 0, r, 0), DARK, WOOD));
    S(paint(rod([x, y, z], [x, y + 1.02, z], 0.065, 0.055, 8), DARK, WOOD));
    S(paint(place(new CylinderGeometry(0.08, 0.08, 0.06, 10), x, y + 0.97, z), IRON, 0x5a5560));
    // the body (one bone, pivot on the post top)
    const P = [x, y + 1.0, z], bi = d.i ? DB.body1 : DB.body0;
    mkBone(bi, ...P); d.bone = bi;
    const parts = [];
    const prof = [[0.001, 0], [0.2, 0], [0.25, 0.14], [0.26, 0.32], [0.23, 0.56], [0.12, 0.68], [0.001, 0.7]].map(([r, yy]) => new Vector2(r, yy));
    parts.push(paint(new LatheGeometry(prof, 14), 0x8a6a40, 0xa88a5a));
    parts.push(paint(place(new TorusGeometry(0.205, 0.022, 5, 16), 0, 0.08, 0, Math.PI / 2), 0x7a5430));
    // the painted target on the chest
    [[0.17, 0xfff4e0], [0.13, 0xd8282a], [0.09, 0xfff4e0], [0.05, 0xd8282a]].forEach(([r, c], k) => parts.push(paint(place(new CircleGeometry(r, 20), 0, 0.34, 0.262 + k * 0.004), c)));
    parts.push(paint(rod([0, 0.62, 0], [0, 0.74, 0], 0.07, 0.065, 8), 0x8a6a40));
    parts.push(paint(place(new SphereGeometry(0.17, 14, 10), 0, 0.88, 0), 0xa07c4c, 0xb8946a));
    face(parts, 0.89, 0.165, 1);
    for (let k = 0; k < 6; k++) { const a = k * 1.05; const c = new ConeGeometry(0.03, 0.14, 5); c.translate(0, 0.07, 0); parts.push(paint(place(c, Math.cos(a) * 0.06, 1.02, Math.sin(a) * 0.06, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5), 0xe8c860, 0xfff0a0)); }
    d.ranges = [M(mergeGeometries(parts.map(plain)).translate(P[0], P[1], P[2]), bi)];
    // the two arms: one bone each, pivot at the shoulder (posed with the body every frame)
    d.arms = [];
    for (const sx of [-1, 1]) {
      const ai = d.i ? (sx < 0 ? DB.arm1L : DB.arm1R) : (sx < 0 ? DB.arm0L : DB.arm0R);
      mkBone(ai, P[0] + sx * 0.2, P[1] + 0.55, P[2]);
      const ap = [paint(rod([sx * 0.2, 0.55, 0], [sx * 0.42, 0.38, 0.08], 0.045, 0.04, 6), 0x8a6a40, 0xa07c4c), paint(place(new SphereGeometry(0.055, 8, 6), sx * 0.42, 0.38, 0.08), 0xa07c4c)];
      d.ranges.push(M(mergeGeometries(ap.map(plain)).translate(P[0], P[1], P[2]), ai));
      d.arms.push({ bi: ai, sx });
    }
    // the toy wand in its right hand (one bone, pivot at the hand)
    const wi = d.i ? DB.wand1 : DB.wand0, H = [x - 0.42, y + 1.38, z + 0.1];
    mkBone(wi, ...H); d.wand = wi;
    const wp = [];
    wp.push(paint(rod([0, 0, 0], [-0.08, 0.38, 0.26], 0.022, 0.016, 6), 0xd8b880, 0xf0d8a8));
    wp.push(paint(place(new TorusGeometry(0.024, 0.009, 4, 8), -0.01, 0.05, 0.034, Math.PI / 2 - 0.6, 0, 0), GOLD));
    wp.push(paint(place(new SphereGeometry(0.046, 8, 6), -0.081, 0.39, 0.27), 0xe8473a, 0xff7a6a));
    M(mergeGeometries(wp.map(plain)).translate(H[0], H[1], H[2]), wi);
    // the dizzy stars (hidden until Stupefy)
    const si = d.i ? DB.stars1 : DB.stars0, SP0 = [x, y + 2.12, z];
    mkBone(si, ...SP0); d.stars = si;
    const sp = [];
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; sp.push(paint(place(starShape(0.1), Math.cos(a) * 0.3, Math.sin(k * 2.1) * 0.03, Math.sin(a) * 0.3, 0, -a + Math.PI / 2, 0), 0xffe27a, 0xffb820)); }
    M(mergeGeometries(sp.map(plain)).translate(SP0[0], SP0[1], SP0[2]), si);
  }

  // --- the old wardrobe (body bone, two door bones as its children) ---
  const WX = 3.1, WZ = -1.8, WYG = gy(WX, WZ);
  const wq = new Quaternion().setFromEuler(new Euler(0, WY, 0));
  const wMat = new Matrix4().compose(new Vector3(WX, WYG, WZ), wq, new Vector3(1, 1, 1));
  const wb = mkBone(DB.ward, WX, WYG, WZ); wb.quaternion.copy(wq);
  {
    const P = [];
    P.push(paint(place(new BoxGeometry(1.2, 1.95, 0.05), 0, 1.1, -0.285), 0x2a1838, 0x3a2450));
    P.push(paint(place(new BoxGeometry(1.1, 1.9, 0.02), 0, 1.1, -0.255), 0x1e1028, 0x30204a));
    for (const sx of [-1, 1]) P.push(paint(place(new BoxGeometry(0.06, 1.95, 0.62), sx * 0.57, 1.1, 0.02), OAK, OAK2));
    P.push(paint(place(new BoxGeometry(1.2, 0.08, 0.62), 0, 0.16, 0.02), OAK, OAK2));
    P.push(paint(place(new BoxGeometry(1.2, 0.06, 0.62), 0, 2.05, 0.02), OAK, OAK2));
    P.push(paint(place(new BoxGeometry(1.36, 0.12, 0.74), 0, 2.14, 0.03), OAK2, 0x7e5838));
    P.push(paint(place(new BoxGeometry(0.8, 0.14, 0.06), 0, 2.27, 0.33), OAK2, 0x7e5838));
    P.push(paint(place(new SphereGeometry(0.06, 8, 6), 0, 2.37, 0.33), GOLD));
    P.push(paint(place(new BoxGeometry(1.24, 0.05, 0.66), 0, 0.1, 0.02), GOLD, 0xb08a30));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(paint(place(new SphereGeometry(0.07, 8, 6), sx * 0.5, 0.06, sz * 0.24 + 0.02, 0, 0, 0, 1, 0.8, 1), OAK));
    M(mergeGeometries(P.map(plain)).applyMatrix4(wMat), DB.ward);
  }
  const doors = [];
  for (const sx of [-1, 1]) {
    const di = sx < 0 ? DB.doorL : DB.doorR, hx = sx * 0.6;
    const db = new Bone(); db.name = 'fd' + di; db.position.set(hx, 0, 0.31); bones[di] = db; wb.add(db); doors.push({ bi: di, sx });
    const P = [], cx = hx - sx * 0.3;
    P.push(paint(place(new BoxGeometry(0.59, 1.9, 0.04), cx, 1.1, 0.33), OAK, OAK2));
    P.push(paint(place(new BoxGeometry(0.42, 0.7, 0.02), cx, 1.55, 0.355), 0x5a3a22, 0x7a5232));
    P.push(paint(place(new BoxGeometry(0.42, 0.7, 0.02), cx, 0.68, 0.355), 0x5a3a22, 0x7a5232));
    P.push(paint(place(starShape(0.07), cx, 1.55, 0.368), 0xffe27a, 0xd8a830));
    P.push(paint(place(new SphereGeometry(0.035, 8, 6), hx - sx * 0.52, 1.1, 0.37), GOLD));
    M(mergeGeometries(P.map(plain)).applyMatrix4(wMat), di);
  }
  // --- the silly things, hidden inside the wardrobe (each on its own bone, base at the pivot) ---
  const wLocal = (x, y, z, out) => out.set(x, y, z).applyQuaternion(wq).add(_s.set(WX, WYG, WZ));
  const IN = wLocal(0, 0.22, -0.02, new Vector3());
  const SHOW = wLocal(0, 0, 1.55, new Vector3()); SHOW.y = gy(SHOW.x, SHOW.z) + 0.02;
  const inMat = new Matrix4().compose(IN, wq, new Vector3(1, 1, 1));
  mkBone(DB.duck, IN.x, IN.y, IN.z); M(duckGeo().applyMatrix4(inMat), DB.duck);
  mkBone(DB.spider, IN.x, IN.y, IN.z); M(spiderGeo().applyMatrix4(inMat), DB.spider);
  mkBone(DB.jelly, IN.x, IN.y, IN.z); M(jellyGeo().applyMatrix4(inMat), DB.jelly);
  mkBone(DB.jackBox, IN.x, IN.y, IN.z); M(jackBoxGeo().applyMatrix4(inMat), DB.jackBox);
  mkBone(DB.jackSpring, IN.x, IN.y + 0.5, IN.z); M(jackSpringGeo().applyMatrix4(new Matrix4().compose(_v.set(IN.x, IN.y + 0.5, IN.z), wq, _s.set(1, 1, 1))), DB.jackSpring);
  mkBone(DB.jackHead, IN.x, IN.y + 1.0, IN.z); M(jackHeadGeo().applyMatrix4(new Matrix4().compose(_v.set(IN.x, IN.y + 1.0, IN.z), wq, _s.set(1, 1, 1))), DB.jackHead);

  // --- the meshes ---
  const statMesh = new Mesh(mergeGeometries(stat), new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: DoubleSide }));
  statMesh.name = 'freecast-duel-static'; statMesh.castShadow = true; statMesh.receiveShadow = true; group.add(statMesh);
  const skin = new SkinnedMesh(mergeGeometries(mov), new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: DoubleSide }));
  skin.name = 'freecast-duel-props'; skin.castShadow = true; skin.frustumCulled = false;
  for (const b of bones) if (!b.parent) skin.add(b);
  group.add(skin);
  scene.add(group);
  group.updateMatrixWorld(true);
  skin.bind(new Skeleton(bones));
  const rest = bones.map(b => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }));
  for (const o of [statMesh, skin]) o.raycast = () => {};
  const hideT = (i) => bones[i].scale.setScalar(0.001);
  for (const i of [DB.stars0, DB.stars1, DB.duck, DB.spider, DB.jelly, DB.jackBox, DB.jackSpring, DB.jackHead]) hideT(i);
  // Petrificus tint: lerp a dummy's body + arm vertex colours toward a stony grey-blue (only while it changes)
  const colA = skin.geometry.attributes.color;
  for (const d of DUM) { d.orig = d.ranges.map(([a, b]) => colA.array.slice(a * 3, b * 3)); d.tintK = 0; }
  function setTint(d, k) {
    if (Math.abs(k - d.tintK) < 0.04 && k !== 0 && k !== 1) return;
    if (k === d.tintK) return;
    d.tintK = k; const A = colA.array;
    d.ranges.forEach(([a], r) => { const o = d.orig[r];
      for (let i = 0; i < o.length; i += 3) { const l = o[i] * 0.3 + o[i + 1] * 0.59 + o[i + 2] * 0.11;
        A[a * 3 + i] = o[i] + (l * 0.5 + 0.06 - o[i]) * k; A[a * 3 + i + 1] = o[i + 1] + (l * 0.66 + 0.1 - o[i + 1]) * k; A[a * 3 + i + 2] = o[i + 2] + (l * 0.95 + 0.2 - o[i + 2]) * k; } });
    colA.needsUpdate = true;
  }
  // solid bits
  for (const d of DUM) player.colliders.push({ type: 'circle', x: DUEL.x + d.x, z: DUEL.z + d.z, r: 0.3, freecast: true });
  for (const o of [-0.35, 0.35]) { wLocal(o, 0, 0, _v); player.colliders.push({ type: 'circle', x: DUEL.x + _v.x, z: DUEL.z + _v.z, r: 0.42, freecast: true }); }

  // ================= behaviour =================
  const qa = new Quaternion(), qb = new Quaternion(), qc = new Quaternion(), e1 = new Euler(), v0 = new Vector3(), v1 = new Vector3(), v2 = new Vector3();
  const W = (lv, out) => out.copy(lv).add(group.position);           // group-local -> world (the group never rotates)
  const L = (wv, out) => out.copy(wv).sub(group.position);
  let T = 0;
  const targets = [];
  const near = (m) => Math.hypot(pos.x - DUEL.x, pos.z - DUEL.z) < m;

  // ---- dummies ----
  for (const d of DUM) {
    Object.assign(d, { wandSt: 'in', disT: -1, stunT: -1, leanT: -1, wt: 0, land: new Vector3(), landYaw: 0, from: new Vector3(),
      disarms: 0, wandBacks: 0, maxWandD: 0, stuns: 0, righted: 0, maxSpin: 0, starsMax: 0, hopN: 0, active: false,
      petT: -1, petrifies: 0, fell: 0, poppedUp: 0, maxTip: 0, maxTint: 0, armK: 0, lying: false });
    d.land.set(d.x + (d.i ? 0.95 : -1.35), 0, d.z + (d.i ? 1.55 : 1.0)); d.land.y = gy(d.land.x, d.land.z) + 0.035;
    d.starOff = new Vector3().copy(rest[d.stars].p).sub(rest[d.bone].p);
    for (const a of d.arms) a.off = new Vector3().copy(rest[a.bi].p).sub(rest[d.bone].p);
    d.handArm = d.arms[0];   // the toy wand is in the -x hand
    d.handFromShoulder = new Vector3().copy(rest[d.wand].p).sub(rest[d.handArm.bi].p);
    targets.push({ id: 'dummy' + d.i, grp: group, spells: ['expelliarmus', 'stupefy', 'petrificus', 'episkey'],
      at: (o) => o.set(d.x, d.y + 1.34, d.z + 0.27).add(group.position),
      ok: (k) => (k === 'episkey' ? hurt(d) : d.petT === -1 && (k === 'expelliarmus' ? d.wandSt === 'in' && d.disT === -1 : k === 'stupefy' ? d.stunT === -1 : d.stunT === -1 && d.disT === -1 && d.wandSt === 'in')),
      cast: (k) => { if (k === 'episkey') heal(d); else if (k === 'expelliarmus') { d.disT = -0.3; d.wandSt = 'held'; d.disarms++; } else if (k === 'stupefy') { d.stunT = -0.3; d.stuns++; } else { d.petT = -0.3; d.petrifies++; } } });
  }
  // Episkey (batch 4): a stunned, disarmed or petrified dummy is right again at once (wand back in its hand,
  // its own colours, upright); freecast-yard.js sprinkles the hearts. tickDummy's idle branch resets the bones.
  const hurt = (d) => d.petT !== -1 || d.stunT !== -1 || d.disT !== -1 || d.wandSt !== 'in';
  function heal(d) {
    d.petT = d.stunT = d.disT = -1; d.wandSt = 'in'; d.leanT = -1;
    d.petHit = d.tipSnd = d.upDone = d.lying = d.stunHit = false; d.hopN = 0; d.heals = (d.heals || 0) + 1;
    setTint(d, 0); fun.sfx.chime();
  }
  // Petrificus Totalus timeline (seconds): stiffen 0-0.3, tip over sideways (toward -x, so the whole stiff body
  // lies across the view from the strip) like a plank 0.35-2.1, thud + settle,
  // lie still to 5.3, pop back up on the post 5.3-5.9 (springy), wobble and soften 5.9-7.0
  const PET = { tip0: 0.35, tip1: 2.1, up0: 5.3, up1: 5.9, end: 7.0 };
  function petPose(d, dt) {
    d.petT += dt; const t = d.petT;
    if (t < 0) return { th: 0, py: 0, px: 0, arm: 0, tint: 0, wx: 0, wz: 0 };
    if (!d.petHit) { d.petHit = true; v0.set(d.x, d.y + 1.34, d.z + 0.27).add(group.position); burst(v0.x, v0.y, v0.z, 0xbfd8ff, 24, 2, 0.6, 0.24, -1); fun.sfx.tone(392, 0.35, 'square', 0.08, 0, 196); fun.sfx.tink(2); }
    let u = 0, arm = Math.min(1, backOut(t / 0.22)), tint = Math.min(1, t / 0.3), wx = 0, wz = 0;
    if (t >= PET.tip0 && t < PET.tip1) { const k = (t - PET.tip0) / (PET.tip1 - PET.tip0); u = k * k; if (!d.tipSnd) { d.tipSnd = true; fun.sfx.tone(300, 1.4, 'sine', 0.06, 0, 140); } }
    else if (t >= PET.tip1 && t < PET.up0) {
      u = 1; if (!d.lying) { d.lying = true; d.fell++; v0.set(d.x - 0.9, d.y + 0.15, d.z).add(group.position); burst(v0.x, v0.y, v0.z, 0xc8b08a, 22, 1.8, 0.7, 0.3, -2); fun.sfx.boom(); fun.sfx.boing(); }
      const s = t - PET.tip1; if (s < 0.45) u = 1 - 0.07 * Math.sin(s / 0.45 * Math.PI) * (1 - s / 0.45);   // a little bounce
      if (Math.random() < dt * 4) { v0.set(d.x - 0.4 - Math.random() * 1.0, d.y + 0.5, d.z + (Math.random() - 0.5) * 0.4).add(group.position); emit(v0.x, v0.y, v0.z, 0, 0.3, 0, 0.8, 0.16, 0xbfd8ff); }
    } else if (t >= PET.up0 && t < PET.up1) {
      if (d.lying) { d.lying = false; fun.sfx.boing(); fun.sfx.pop(); }
      u = 1 - backOut((t - PET.up0) / (PET.up1 - PET.up0));
    } else if (t >= PET.up1) {
      const s = t - PET.up1, a = 0.22 * Math.exp(-3 * s);
      wx = Math.sin(s * 13) * a; wz = Math.cos(s * 11) * a * 0.7;
      arm = Math.max(0, 1 - s / 0.3); tint = Math.max(0, 1 - s / 0.5);
      if (!d.upDone) { d.upDone = true; d.poppedUp++; v0.set(d.x, d.y + 2.0, d.z).add(group.position); burst(v0.x, v0.y, v0.z, 0xffe27a, 18, 1.8, 0.6, 0.2, -1); fun.sfx.giggle(true); }
      if (t >= PET.end) { d.petT = -1; d.petHit = d.tipSnd = d.upDone = false; arm = 0; tint = 0; wx = wz = 0; }
    }
    const th = Math.PI / 2 * u;   // about z: +y tips toward -x
    const pd = Math.max(0, Math.min(1, u));
    d.maxTip = Math.max(d.maxTip, th); d.maxTint = Math.max(d.maxTint, tint);
    // it topples like a plank over the -x rim of its base (a hinge 0.24 m left of the post centre), so the
    // base swings up and away from the post top instead of sweeping through it; the hinge drifts a little
    // further left and drops late (pd^3), landing the body flat on the grass clear of the post. (The springy
    // overshoot on the way back up, th < 0, stays on the base centre: a few degrees, nothing to clip.)
    if (th <= 0) return { th, py: 0, px: 0, arm, tint, wx, wz };
    const hx = -0.24 - 0.14 * pd, hy = -0.97 * pd * pd * pd;
    return { th, px: hx + 0.24 * Math.cos(th), py: hy + 0.24 * Math.sin(th), arm, tint, wx, wz };
  }
  function tickDummy(d, dt) {
    if (d.petT === -1 && d.disT === -1 && d.stunT === -1 && d.leanT < 0 && d.wandSt === 'in') { if (d.active) { d.active = false; for (const i of [d.bone, d.wand, ...d.arms.map(a => a.bi)]) { bones[i].position.copy(rest[i].p); bones[i].quaternion.copy(rest[i].q); } hideT(d.stars); setTint(d, 0); } return; }
    d.active = true;
    let spin = 0, wx = 0, wz = 0, recoil = 0, lean = 0, starK = 0;
    let pet = null;
    if (d.petT !== -1) pet = petPose(d, dt);
    // Stupefy: spin round on the post, dizzy wobble with stars, right itself
    if (d.stunT !== -1) {
      d.stunT += dt; const t = d.stunT;
      if (t >= 0) {
        if (!d.stunHit) { d.stunHit = true; d.at = 0; v0.set(d.x, d.y + 1.34, d.z + 0.27).add(group.position); burst(v0.x, v0.y, v0.z, 0xff7a30, 24, 2.4, 0.6, 0.26, -1); fun.sfx.boing(); fun.sfx.whoosh(); }
        if (t < 1.4) { const k = t / 1.4; spin = Math.PI * 6 * (1 - Math.pow(1 - k, 3)); recoil = 0.2 * Math.sin(Math.min(1, t / 0.5) * Math.PI); }
        else spin = 0;
        if (t >= 1.2 && t < 5.0) {
          const a = 0.2 * Math.min(1, (t - 1.2) / 0.4) * (t > 4.2 ? Math.max(0, (4.8 - t) / 0.6) : 1);
          wx = Math.sin(t * 5) * a; wz = Math.cos(t * 5) * a;
          starK = Math.min(1, (t - 1.3) / 0.3) * (t > 4.3 ? Math.max(0, (4.8 - t) / 0.5) : 1);
          if (d.hopN === 0 && t > 1.6) { d.hopN = 1; fun.sfx.tweet(); }
          if (d.hopN === 1 && t > 2.9) { d.hopN = 2; fun.sfx.tweet(); }
        }
        if (t >= 4.6 && t < 5.2) wx += -0.08 * Math.sin((t - 4.6) / 0.6 * Math.PI * 2) * (1 - (t - 4.6) / 0.6);
        d.maxSpin = Math.max(d.maxSpin, spin); d.starsMax = Math.max(d.starsMax, starK);
        if (t >= 5.2) { d.stunT = -1; d.stunHit = false; d.hopN = 0; d.righted++; fun.sfx.pop(); }
      }
    }
    // Expelliarmus: the dummy rocks back as its wand flies
    if (d.disT !== -1) {
      d.disT += dt; const t = d.disT;
      if (t >= 0) recoil += 0.35 * Math.sin(Math.min(1, t / 0.5) * Math.PI);
    }
    if (d.leanT >= 0) { d.leanT += dt; lean = 0.3 * Math.sin(Math.min(1, d.leanT / 0.7) * Math.PI); if (d.leanT > 0.7) d.leanT = -1; }
    // pose the body
    const b = bones[d.bone];
    if (pet) { wx += pet.wx; wz += pet.wz; }
    qa.setFromEuler(e1.set(0, spin, 0)); qb.setFromEuler(e1.set(wx - recoil + lean, 0, wz + (pet ? pet.th : 0))); b.quaternion.copy(qa).multiply(qb);
    b.position.copy(rest[d.bone].p);
    if (pet) { b.position.y += pet.py; b.position.x += pet.px; setTint(d, pet.tint); }
    // the arms follow the body; Petrificus snaps them flat to its sides
    const armK = pet ? pet.arm : 0;
    for (const a of d.arms) {
      const ab = bones[a.bi]; ab.position.copy(a.off).applyQuaternion(b.quaternion).add(b.position);
      qc.setFromEuler(e1.set(0, 0, -a.sx * 0.92 * armK)); ab.quaternion.copy(b.quaternion).multiply(qc);
    }
    // the stars ride round the head
    const sb = bones[d.stars];
    if (starK > 0.001) { sb.position.copy(d.starOff).applyQuaternion(b.quaternion).add(b.position); sb.quaternion.setFromEuler(e1.set(0, T * 4, 0)); sb.scale.setScalar(starK); }
    else hideT(d.stars);
    // the wand
    const wbn = bones[d.wand];
    const hb = bones[d.handArm.bi];
    const handW = (out) => out.copy(d.handFromShoulder).applyQuaternion(hb.quaternion).add(hb.position);
    if (d.wandSt === 'in' || (d.wandSt === 'held' && d.disT < 0)) { handW(wbn.position); wbn.quaternion.copy(hb.quaternion); }
    else {
      const t = d.disT, FLY = 1.1;
      if (d.wandSt === 'held') { d.wandSt = 'fly'; handW(d.from); v0.copy(d.from).add(group.position); burst(v0.x, v0.y, v0.z, 0xff4040, 22, 2.6, 0.6, 0.24, -1.5); fun.sfx.clank(); fun.sfx.whoosh(); d.landYaw = (d.i ? 1 : -1) * 0.9 + Math.random() * 0.6; }
      if (d.wandSt === 'fly') {
        const k = Math.min(1, t / FLY);
        wbn.position.lerpVectors(d.from, d.land, k); wbn.position.y += 2.1 * 4 * k * (1 - k);
        wbn.quaternion.setFromEuler(e1.set(0.98 + Math.PI * 6 * (1 - k) * (1 - k), d.landYaw, 0, 'YXZ'));
        d.maxWandD = Math.max(d.maxWandD, Math.hypot(wbn.position.x - d.from.x, wbn.position.z - d.from.z));
        if (Math.random() < dt * 30) { W(wbn.position, v0); emit(v0.x, v0.y, v0.z, 0, 0, 0, 0.4, 0.14, 0xffa0a0); }
        if (k >= 1) { d.wandSt = 'ground'; W(d.land, v0); burst(v0.x, v0.y, v0.z, 0x9aff7a, 10, 1.2, 0.5, 0.14, -3); fun.sfx.tink(); }
      } else if (d.wandSt === 'ground') {
        wbn.position.copy(d.land);
        if (t < FLY + 0.3) wbn.position.y += 0.15 * Math.sin((t - FLY) / 0.3 * Math.PI);
        const jig = t > 3.9 ? Math.sin(t * 40) * 0.15 : 0;
        wbn.quaternion.setFromEuler(e1.set(0.98, d.landYaw + jig, 0, 'YXZ'));
        if (t > 4.4) { d.wandSt = 'back'; d.from.copy(d.land); fun.sfx.boing(); }
      } else if (d.wandSt === 'back') {
        const k = Math.min(1, (t - 4.4) / 0.9);
        handW(v1); wbn.position.lerpVectors(d.from, v1, ease(k)); wbn.position.y += 1.3 * 4 * k * (1 - k);
        qc.setFromEuler(e1.set(0.98 * (1 - k) - Math.PI * 4 * k * (1 - k), d.landYaw * (1 - k), 0, 'YXZ')); wbn.quaternion.copy(b.quaternion).multiply(qc);
        if (Math.random() < dt * 30) { W(wbn.position, v0); emit(v0.x, v0.y, v0.z, 0, 0, 0, 0.4, 0.14, 0xffe27a); }
        if (k >= 1) { d.wandSt = 'in'; d.disT = -1; d.wandBacks++; handW(v0); W(v0, v0); burst(v0.x, v0.y, v0.z, 0xffe27a, 16, 1.6, 0.6, 0.2, -1); fun.sfx.chime(); }
      }
    }
    // a dummy that "casts" (Protego's show): a pink glint at its wand tip
    if (d.leanT >= 0 && Math.random() < dt * 25) { wandTipW(d, v0); emit(v0.x, v0.y, v0.z, (Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4, 0.5, 0.18, 0xff8ad8); }
  }
  function wandTipW(d, out) { const wbn = bones[d.wand]; return out.set(-0.081, 0.39, 0.27).applyQuaternion(wbn.quaternion).add(wbn.position).add(group.position); }

  function duelCast(key) {
    return {
      noFallback: true,
      cast() {
        const t = best(key);
        if (!t) { boltAhead(BYKEY_COL[key]); this.lastId = null; return false; }
        t.at(v2); bolt(v2, BYKEY_COL[key], 0.3); t.cast(key); this.lastId = t.id; return true;
      },
    };
  }
  const BYKEY_COL = { expelliarmus: 0xff3a3a, stupefy: 0xff6a2a, riddikulus: 0xff9ad8, petrificus: 0x9ab8e8 };
  const SPX = {};
  SPX.expelliarmus = Object.assign(duelCast('expelliarmus'), {
    tick(dt) { for (const d of DUM) tickDummy(d, dt); },
    state: () => DUM.map(d => ({ wand: d.wandSt, disarms: d.disarms, wandBacks: d.wandBacks, maxWandD: +d.maxWandD.toFixed(2), stuns: d.stuns, righted: d.righted, maxSpin: +d.maxSpin.toFixed(2), starsMax: +d.starsMax.toFixed(2), stunned: d.stunT !== -1 })),
  });
  SPX.stupefy = Object.assign(duelCast('stupefy'), { state: () => SPX.expelliarmus.state() });
  // Petrificus Totalus: the dummy goes stiff, tips over like a plank, lies ~3 s, pops back up with a wobble
  SPX.petrificus = Object.assign(duelCast('petrificus'), {
    state: () => DUM.map(d => ({ on: d.petT !== -1, t: +Math.max(0, d.petT).toFixed(2), lying: d.lying, petrifies: d.petrifies, fell: d.fell, poppedUp: d.poppedUp, maxTip: +d.maxTip.toFixed(2), maxTint: +d.maxTint.toFixed(2), heals: d.heals || 0, hurt: hurt(d), tint: +d.tintK.toFixed(2) })),
  });

  // ---- Protego: a shimmering half-dome in front of Harry; a dummy's slow pink puff bounces off it ----
  function hexTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(255,255,255,0.32)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
    const r = 18, h = r * Math.sqrt(3) / 2;
    for (let row = -1; row < 6; row++) for (let col = -1; col < 6; col++) {
      const cx = col * r * 1.5, cy = row * h * 2 + (col % 2 ? h : 0);
      g.beginPath(); for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3; const x = cx + Math.cos(a) * r * 0.92, y = cy + Math.sin(a) * r * 0.92; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    }
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(5, 2); return t;
  }
  const SH = { R: 1.35, H: 2.0, dur: 4.2 };
  const shieldGeo = new SphereGeometry(1, 30, 10, Math.PI / 2 - Math.PI * 0.6, Math.PI * 1.2, 0, Math.PI / 2);
  const shield = new Mesh(shieldGeo, new MeshBasicMaterial({ map: hexTexture(), color: 0x6ab8ff, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false }));
  shield.name = 'freecast-protego'; shield.visible = false; shield.frustumCulled = false; shield.raycast = () => {}; shield.renderOrder = 4;
  scene.add(shield);
  const sh = { t: -1, rip: -1, casts: 0, puffs: 0, bounces: 0, pops: 0, maxScale: 0, maxOp: 0, dummy: null, leaned: false, puffed: false };
  const puff = { on: false, p: new Vector3(), v: new Vector3(), t: 0, bounced: false, acc: 0 };
  SPX.protego = {
    noFallback: true,
    cast() {
      sh.t = 0; sh.rip = -1; sh.casts++; sh.dummy = null; sh.leaned = sh.puffed = false; puff.on = false; puff.bounced = false;
      fun.sfx.chime(); fun.sfx.tone(660, 0.5, 'sine', 0.12, 0, 990);
      // the nearest dummy in sight of the spot (none stunned) will "cast" its puff
      if (group.visible) {
        let bd = 1e9;
        for (const d of DUM) { const dd = Math.hypot(DUEL.x + d.x - pos.x, DUEL.z + d.z - pos.z); if (dd < 14 && dd > 2 && d.stunT === -1 && d.petT === -1 && dd < bd) { bd = dd; sh.dummy = d; } }
      }
      this.lastId = sh.dummy ? 'shield+dummy' + sh.dummy.i : 'shield';
      return true;
    },
    tick(dt, inside, busy) {
      if (sh.t < 0) { if (shield.visible) shield.visible = false; return; }
      sh.t += dt; const t = sh.t;
      if (t >= SH.dur || busy) { sh.t = -1; shield.visible = false; if (puff.on && !puff.bounced) { puff.on = false; burst(puff.p.x, puff.p.y, puff.p.z, 0xff9ad8, 12, 1, 0.5, 0.2, 0); sh.pops++; } return; }
      const grow = backOut(t / 0.35), fade = Math.min(1, (SH.dur - t) / 0.45);
      let ripS = 0, flash = 0;
      if (sh.rip >= 0) { sh.rip += dt; const r = sh.rip; ripS = 0.09 * Math.exp(-5 * r) * Math.sin(r * 28); flash = 0.6 * Math.exp(-6 * r); }
      const s = Math.max(0.01, grow * fade) * (1 + ripS);
      shield.position.set(pos.x, pos.y, pos.z); shield.rotation.set(0, player.yaw, 0);
      shield.scale.set(SH.R * s, SH.H * Math.max(0.01, grow) * (1 + ripS * 0.5), SH.R * s);
      shield.material.opacity = Math.min(1, (0.5 + 0.08 * Math.sin(T * 9)) * Math.min(1, t / 0.2) * fade + flash);
      shield.material.map.offset.x = T * 0.04; shield.material.map.offset.y = Math.sin(T * 1.3) * 0.05;
      shield.visible = true; sh.maxScale = Math.max(sh.maxScale, shield.scale.x); sh.maxOp = Math.max(sh.maxOp, shield.material.opacity);
      if (Math.random() < dt * 10) { const a = player.yaw + (Math.random() - 0.5) * 3, h = Math.random() * 0.9; emit(pos.x + Math.sin(a) * SH.R * Math.cos(h), pos.y + SH.H * Math.sin(h), pos.z + Math.cos(a) * SH.R * Math.cos(h), 0, 0.2, 0, 0.6, 0.16, 0xbfe4ff); }
      // the dummy's puff
      const d = sh.dummy;
      if (d && !sh.leaned && t >= 0.6) {
        sh.leaned = true; d.leanT = 0; fun.sfx.tone(520, 0.25, 'triangle', 0.1, 0.25, 780);
      }
      if (d && !sh.puffed && t >= 0.95) {
        sh.puffed = true; puff.on = true; puff.bounced = false; puff.t = 0; wandTipW(d, puff.p); sh.puffs++;
        const dist = Math.hypot(puff.p.x - pos.x, puff.p.z - pos.z); puff.speed = Math.max(1.6, (dist - 1.2) / 2.0);
        burst(puff.p.x, puff.p.y, puff.p.z, 0xff8ad8, 12, 1.2, 0.5, 0.2, 0); fun.sfx.poof();
      }
      if (puff.on) {
        puff.t += dt;
        if (!puff.bounced) {
          v0.set(pos.x - puff.p.x, pos.y + 1.15 - puff.p.y, pos.z - puff.p.z); const dd = v0.length(); v0.multiplyScalar(1 / Math.max(0.001, dd));
          puff.v.copy(v0).multiplyScalar(puff.speed); puff.p.addScaledVector(puff.v, dt);
          puff.p.y += Math.sin(puff.t * 6) * 0.004;
          const hd = Math.hypot(puff.p.x - pos.x, puff.p.z - pos.z);
          if (hd <= SH.R * 0.86 || puff.t > 2.9) {
            puff.bounced = true; puff.t = 0; sh.bounces++; sh.rip = 0;
            puff.v.set(-v0.x * 2.4, 2.6, -v0.z * 2.4);
            burst(puff.p.x, puff.p.y, puff.p.z, 0xbfe4ff, 20, 2.2, 0.5, 0.2, 0); burst(puff.p.x, puff.p.y, puff.p.z, 0xff9ad8, 10, 1.6, 0.5, 0.2, -1);
            fun.sfx.tone(1760, 0.45, 'sine', 0.16); fun.sfx.tone(2637, 0.3, 'sine', 0.08, 0.03); fun.sfx.tink(4);
          }
        } else {
          puff.v.y -= 2.0 * dt; puff.p.addScaledVector(puff.v, dt);
          if (puff.t > 1.0) { puff.on = false; burst(puff.p.x, puff.p.y, puff.p.z, 0xff9ad8, 14, 1.2, 0.6, 0.2, 0); fun.sfx.pop(); }
        }
        const fadeK = puff.bounced ? 1 - puff.t : 1;
        emit(puff.p.x, puff.p.y, puff.p.z, 0, 0, 0, 0.07, 0.6 * fadeK + 0.1, 0xff7ad0);
        emit(puff.p.x, puff.p.y, puff.p.z, 0, 0, 0, 0.07, 0.3 * fadeK + 0.05, 0xffffff);
        puff.acc += dt; while (puff.acc > 0.03) { puff.acc -= 0.03; emit(puff.p.x + (Math.random() - 0.5) * 0.2, puff.p.y + (Math.random() - 0.5) * 0.2, puff.p.z + (Math.random() - 0.5) * 0.2, 0, 0.2, 0, 0.5, 0.2, 0xffb0e8, 0, 1); }
      }
    },
    state: () => ({ on: sh.t >= 0, t: +Math.max(0, sh.t).toFixed(2), casts: sh.casts, puffs: sh.puffs, bounces: sh.bounces, pops: sh.pops, puffOn: puff.on, visible: shield.visible, maxScale: +sh.maxScale.toFixed(2), maxOp: +sh.maxOp.toFixed(2) }),
  };

  // ---- Riddikulus: the wardrobe ----
  const wr = { state: 'idle', t: 0, rat: -1, rattleIn: 6, rattles: 0, opens: 0, outs: 0, backs: 0, kind: null, shown: [], last: null, say: false, sfxN: 0, from: new Vector3(), maxOut: 0 };
  targets.push({ id: 'wardrobe', grp: group, spells: ['riddikulus'], at: (o) => wLocal(0, 1.1, 0.35, o).add(group.position), ok: () => wr.state === 'idle',
    cast: () => {
      let k; do { k = KINDS[(Math.random() * KINDS.length) | 0]; } while (k === wr.last);
      wr.kind = k; wr.last = k; wr.state = 'open'; wr.t = -0.3; wr.say = false; wr.sfxN = 0; wr.shown.push(k); if (wr.shown.length > 12) wr.shown.shift();
    } });
  const KB = { duck: [DB.duck], spider: [DB.spider], jelly: [DB.jelly], jack: [DB.jackBox, DB.jackSpring, DB.jackHead] };
  const doorAng = (a) => { for (const d of doors) bones[d.bi].quaternion.setFromEuler(e1.set(0, d.sx < 0 ? -a : a, 0)); };
  // place the current thing: base point (group-local) p, extra yaw, roll, scale, squash (y scale factor), spring stretch
  function poseThing(k, p, yaw, roll, sc, squash = 1, spring = 1) {
    sc *= 1.4;   // giant once out of the wardrobe
    qa.setFromEuler(e1.set(0, yaw, roll, 'YXZ'));
    if (k !== 'jack') { const b = bones[KB[k][0]]; b.position.copy(p); b.quaternion.copy(qa); b.scale.set(sc / Math.sqrt(squash), sc * squash, sc / Math.sqrt(squash)); return; }
    const bx = bones[DB.jackBox], sp = bones[DB.jackSpring], hd = bones[DB.jackHead];
    bx.position.copy(p); bx.quaternion.copy(qa); bx.scale.setScalar(sc);
    sp.position.copy(v1.set(0, 0.5 * sc, 0).applyQuaternion(qa).add(p)); sp.quaternion.copy(qa); sp.scale.set(sc, sc * spring, sc);
    hd.position.copy(v1.set(0, (0.5 + 0.5 * spring) * sc, 0).applyQuaternion(qa).add(p)); qb.setFromEuler(e1.set(0, 0, Math.sin(T * 5) * 0.3 * (spring > 0.5 ? 1 : 0))); hd.quaternion.copy(qa).multiply(qb); hd.scale.setScalar(sc);
  }
  const DANCE = 4.2;
  function dance(k, u, out) {   // where the thing is during the show, u seconds in; returns base point + sets pose
    let yaw = 0, roll = 0, squash = 1, spring = 1;
    out.copy(SHOW);
    if (k === 'duck') {
      const a = u * 1.5; out.x += Math.sin(a) * 0.45; out.z += (Math.cos(a) - 1) * 0.3; out.y += Math.abs(Math.sin(u * 6)) * 0.28;
      yaw = Math.sin(u * 6) * 0.35; roll = Math.sin(u * 6) * 0.15;
      const n = Math.floor(u * 6 / Math.PI); if (n > wr.sfxN) { wr.sfxN = n; fun.sfx.squeak(); }
    } else if (k === 'spider') {
      out.x += Math.sin(u * 1.8) * 0.75; out.z += Math.sin(u * 3.6) * 0.35;
      const vx = Math.cos(u * 1.8) * 1.8 * 0.75, vz = Math.cos(u * 3.6) * 3.6 * 0.35;
      yaw = Math.atan2(vx, vz) - WY; roll = -Math.sin(u * 3.6) * 0.2;
      const n = Math.floor(u / 1.3); if (n >= wr.sfxN) { wr.sfxN = n + 1; fun.sfx.tune([784, 988, 1175, 988, 1319], 0.09, 'triangle'); }
    } else if (k === 'jelly') {
      const ph = (u % 1.05) / 1.05, hop = Math.sin(Math.min(1, ph / 0.45) * Math.PI) * (ph < 0.45 ? 1 : 0);
      out.y += hop * 0.35; out.x += Math.sin(u * 1.2) * 0.3;
      squash = 1 + (ph < 0.45 ? 0.12 * hop : -0.22 * Math.exp(-(ph - 0.45) * 7) * Math.cos((ph - 0.45) * 30));
      roll = Math.sin(u * 7) * 0.08;
      const n = Math.floor(u / 1.05); if (n >= wr.sfxN) { wr.sfxN = n + 1; fun.sfx.boing(); }
    } else {
      spring = u < 0.45 ? 0.2 + backOut(u / 0.45) * 0.9 : 1.05 + Math.sin((u - 0.45) * 7) * 0.3;
      out.x += Math.sin(u * 0.9) * 0.2; yaw = Math.sin(u * 2) * 0.3;
      if (wr.sfxN === 0) { wr.sfxN = 1; fun.sfx.tune([523, 0, 523, 587, 587, 659, 784, 659, 523], 0.13, 'triangle'); }
      const n = Math.floor((u - 0.45) * 7 / (Math.PI * 2)); if (u > 0.45 && n + 2 > wr.sfxN) { wr.sfxN = n + 2; fun.sfx.boing(); }
    }
    return { yaw, roll, squash, spring };
  }
  function tickWardrobe(dt) {
    const wbn = bones[DB.ward];
    let shake = 0, door = 0;
    if (wr.state === 'idle') {
      if (group.visible) { wr.rattleIn -= dt; if (wr.rattleIn <= 0) { wr.rattleIn = 7 + Math.random() * 5; wr.rat = 0; wr.rattles++; if (near(12)) for (let i = 0; i < 4; i++) fun.sfx.noise(0.07, 0.1, i * 0.11, 170, 1, 'lowpass'); } }
      if (wr.rat >= 0) { wr.rat += dt; const r = wr.rat; shake = 0.022 * Math.sin(r * 42) * Math.sin(Math.min(1, r / 0.8) * Math.PI); door = 0.07 * Math.abs(Math.sin(r * 26)) * Math.sin(Math.min(1, r / 0.8) * Math.PI); if (r > 0.8) wr.rat = -1; }
      else if (wr.posed) { wr.posed = false; wbn.position.copy(rest[DB.ward].p); wbn.quaternion.copy(rest[DB.ward].q); doorAng(0); return; }
      else return;
    } else {
      wr.t += dt; const t = wr.t, k = wr.kind;
      if (t < 0) return;
      if (t < 0.45) shake = 0.05 * Math.sin(t * 50);
      if (t >= 0.35 && t < 6.0) door = 1.9 * backOut((t - 0.35) / 0.4);
      if (t >= 6.0) door = 1.9 * (1 - ease((t - 6.0) / 0.35));
      if (t >= 6.35 && t < 6.8) shake = 0.03 * Math.sin((t - 6.35) * 40) * (1 - (t - 6.35) / 0.45);
      if (t >= 0.4 && !wr.popped) { wr.popped = true; wr.opens++; wLocal(0, 1.1, 0.5, v0).add(group.position); for (const c of [0xff9ad8, 0xffe27a, 0x9ad8ff]) burst(v0.x, v0.y, v0.z, c, 12, 2.4, 0.8, 0.24, -1.5); fun.sfx.poof(); fun.sfx.whoosh(); }
      const ib = KB[k];
      if (t >= 0.5 && t < 1.2) {
        const kk = (t - 0.5) / 0.7; v0.lerpVectors(IN, SHOW, ease(kk)); v0.y += Math.sin(kk * Math.PI) * 0.9;
        poseThing(k, v0, Math.sin(kk * Math.PI) * 1.2, 0, 0.25 + 0.75 * ease(kk), 1, k === 'jack' ? 0.2 : 1);
      } else if (t >= 1.2 && t < 1.2 + DANCE) {
        const u = t - 1.2;
        if (!wr.say) { wr.say = true; wr.outs++; wr.sfxN = 0; v2.copy(SHOW).add(group.position); v2.y += 1.6; fun.say(v2, SAY[k], 2.6, 'fcBogart'); fun.sfx.giggle(true); wr.g1 = wr.g2 = false; }
        if (u > 1.8 && !wr.g1) { wr.g1 = true; fun.sfx.giggle(false); }
        if (u > 3.0 && !wr.g2) { wr.g2 = true; fun.sfx.giggle(true); }
        const P = dance(k, u, v0); poseThing(k, v0, P.yaw, P.roll, 1, P.squash, P.spring);
        wr.maxOut = Math.max(wr.maxOut, Math.hypot(v0.x - IN.x, v0.z - IN.z));
        if (Math.random() < dt * 6) { v2.copy(v0).add(group.position); emit(v2.x + (Math.random() - 0.5) * 0.6, v2.y + 0.3 + Math.random() * 0.6, v2.z + (Math.random() - 0.5) * 0.6, 0, 0.5, 0, 0.8, 0.18, Math.random() < 0.5 ? 0xffe27a : 0xff9ad8, 0, 0.5); }
        wr.from.copy(v0);
      } else if (t >= 1.2 + DANCE && t < 1.9 + DANCE) {
        const kk = (t - 1.2 - DANCE) / 0.7; v0.lerpVectors(wr.from, IN, ease(kk)); v0.y += Math.sin(kk * Math.PI) * 0.8;
        poseThing(k, v0, -Math.sin(kk * Math.PI) * 1.2, 0, 1 - 0.75 * ease(kk), 1, k === 'jack' ? 1 - 0.8 * kk : 1);
        if (!wr.goBack) { wr.goBack = true; fun.sfx.boing(); }
      } else if (t >= 1.9 + DANCE) { for (const i of ib) { hideT(i); bones[i].position.copy(rest[i].p); bones[i].quaternion.copy(rest[i].q); } }
      if (t >= 6.35 && !wr.slam) { wr.slam = true; fun.sfx.clank(); }
      if (t >= 6.8) { wr.state = 'idle'; wr.backs++; wr.popped = wr.slam = wr.goBack = false; wr.rattleIn = 8 + Math.random() * 4; door = 0; shake = 0; }
    }
    wr.posed = true;
    wbn.position.copy(rest[DB.ward].p); wbn.position.y += Math.abs(shake) * 0.6;
    qa.setFromEuler(e1.set(shake * 0.4, 0, shake)); wbn.quaternion.copy(rest[DB.ward].q).multiply(qa);
    doorAng(door);
  }
  SPX.riddikulus = Object.assign(duelCast('riddikulus'), {
    tick: tickWardrobe,
    state: () => ({ state: wr.state, t: +wr.t.toFixed(2), kind: wr.kind, shown: wr.shown.slice(), opens: wr.opens, outs: wr.outs, backs: wr.backs, rattles: wr.rattles, maxOut: +wr.maxOut.toFixed(2) }),
  });
  // the riddikulus duelCast fizzles a bolt ahead when no wardrobe is near: make that a giggly pink sparkle instead
  { const c0 = SPX.riddikulus.cast; SPX.riddikulus.cast = function () { if (best('riddikulus')) return c0.call(this); tip(); burst(tipV.x, tipV.y, tipV.z, 0xff9ad8, 18, 2, 0.8, 0.22, -1); fun.sfx.giggle(true); this.lastId = null; return false; }; }

  // visibility + the shared clock
  SPX._duel = {
    noFallback: true,
    on: true,
    tick(dt, inside) {
      T += dt;
      const vis = !inside && this.on && Math.hypot(pos.x - DUEL.x, pos.z - DUEL.z) < 70;
      if (group.visible !== vis) group.visible = vis;
    },
  };
  return { group, statMesh, skin, shield, targets, SP: SPX, DUM, Y0, SHOW, IN };
}
