// Hogsmeade milestone 3 (briefs/2026-11-28-hogsmeade-m3-decisions.md): the far views of the walkable street (street mode only).
//  - Hm_Far_Shack: the Shrieking Shack (הצריף המצווח) alone on its snowy hill beyond the EAST end (+x); front slope towards -x.
//  - Hm_Far_Castle: a faint hazy castle silhouette beyond the WEST end (-x); off on the LOW tier.
// One GLB hm_far_01.glb (models.json `hm_far`; one white material, everything in COLOR_0), drawn UNLIT with the scene fog (so the
// haze is real). Loaded lazily with the street and never fatal: a missing / failed / slow model gets a code-built stand-in with the
// same node names and sizes. Debug: window.__game.hogsmeade.far() -> { loaded, kind, shack: {x, y, z, px, box, inView}, castle, draws, tris }.
import { Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, PlaneGeometry, MeshBasicMaterial, BufferAttribute, Color, Vector3, Box3 } from 'three';
import { loadModel, modelInfo } from './models.js';
import { place, paint, merge, triCount, drawCount } from './adventure-b3-map-build.js';

// placement in the street (room) frame: base centre (x, y, z), turn about +Y, uniform scale (tuned from the brief's first values)
export const FAR = {
  shack: { x: 100, y: -1, z: 4, ry: 0, scale: 0.6 },     // (tuned from the brief's (84, -1, 10) x 1.0: 50-90 px high from street_look on iPad)
  castle: { x: -150, y: 7, z: 22, ry: Math.PI, scale: 0.22 },   // delivered facing -x: turned 180 degrees to face the street (+x)
};
const LOAD_MS = 30000;
const HOUSE_H = 16.8;   // the top of the shack node that is the house (for its screen box): chimney top 27 -> from y 10.2 (house base 9.7)
const FS = { kind: null, failed: null, root: null, shack: null, castle: null, houseBox: null, castleBox: null, low: false };
let _mat = null;
const farMat = () => _mat || (_mat = Object.assign(new MeshBasicMaterial({ vertexColors: true, fog: true }), { name: 'MAT_Hm_Far' }));
const quiet = (o) => { o.raycast = () => {}; return o; };
const _c = new Color(), _v = new Vector3();

// ---------------- the code-built stand-in (same node names, same sizes) ----------------
// a gable box (ridge along z): a box whose top vertices meet at x = 0
function gable(w, h, d) { const g = new BoxGeometry(w, h, d), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, 0); return g; }
function vcol(geo, fn) { const p = geo.attributes.position, a = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { fn(_c, p.getX(i), p.getY(i), p.getZ(i)); a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const SNOW = 0xd2d6e2, SNOW_SH = 0x9ea6be, PLANK = 0x6a5a4e, BOARD = 0x4a3e36, FIR = 0x2e3e3a, WARM = 0xffc870, STONE = 0x8a8478, SLATE = 0x4a5266;
function standinShack() {
  const P = [];
  // the hill: a squashed lumpy dome 60 x 44, 13 high (half buried), snow with blue-grey shadows on the -x / north side
  const hill = new SphereGeometry(1, 20, 10), hp = hill.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i), lump = 1 + 0.07 * Math.sin(x * 7 + z * 5) + 0.05 * Math.cos(z * 9 - x * 3);
    hp.setXYZ(i, x * 30 * lump, Math.max(-0.3, y) * 13 * lump, z * 22 * lump);
  }
  hill.computeVertexNormals();
  P.push(vcol(hill, (c, x, y, z) => c.setHex(SNOW_SH).lerp(new Color(SNOW), Math.min(1, Math.max(0, 0.45 + y / 26 + x / 120 - z / 160)))));
  // a few firs on the slopes (snowy tops) and a zig-zag fence going up the front slope
  for (const [x, z, s] of [[-18, -12, 1], [-22, 8, 0.8], [12, 14, 1.1], [16, -10, 0.9], [-10, 15, 0.7], [20, 4, 1]]) {
    const yb = 13 * Math.sqrt(Math.max(0, 1 - (x / 30) ** 2 - (z / 22) ** 2)) - 0.5;
    P.push(paint(place(new ConeGeometry(1.6 * s, 5 * s, 6), x, yb + 2.5 * s, z), FIR), paint(place(new ConeGeometry(0.8 * s, 1.6 * s, 6), x, yb + 4.4 * s, z), SNOW));
  }
  for (let k = 0; k < 6; k++) { const x = -26 + k * 4, z = (k % 2 ? 3 : -3), yb = 13 * Math.sqrt(Math.max(0, 1 - (x / 30) ** 2 - (z / 22) ** 2)); P.push(paint(place(new BoxGeometry(4.4, 0.25, 0.15), x + 2, yb + 0.9, z * 0.5, 0, (k % 2 ? 1 : -1) * 0.9, -0.5), BOARD)); }
  // the house: 8 x 7 footprint, 12 to the ridge, leaning 4 degrees, steep snowy roof, crooked chimney, a lean-to, boarded windows
  const H = [];
  H.push(paint(place(new BoxGeometry(7, 8, 8), 0, 4, 0), PLANK));
  H.push(paint(place(gable(7.8, 4, 8.6), 0, 10, 0), BOARD));
  H.push(paint(place(gable(7.0, 3.4, 8.8), 0, 10.55, 0), SNOW));
  H.push(paint(place(new BoxGeometry(0.9, 3.4, 0.9), 1.6, 12.2, 2.4, 0, 0, 0.18), BOARD));
  H.push(paint(place(new BoxGeometry(3, 3.4, 4.5), -1, 1.7, -5.6), BOARD), paint(place(new BoxGeometry(3.4, 0.35, 5), -1, 3.55, -5.6, 0.25, 0, 0), SNOW));
  for (const [y, z] of [[2.4, -2], [2.4, 2], [5.8, -2], [5.8, 2]]) {   // the -x face: plank crosses
    H.push(paint(place(new BoxGeometry(0.1, 1.4, 1.1), -3.52, y, z), 0x2a2420));
    for (const r of [0.75, -0.75]) H.push(paint(place(new BoxGeometry(0.12, 1.7, 0.2), -3.58, y, z, r, 0, 0), BOARD));
  }
  H.push(paint(place(new PlaneGeometry(0.9, 1.0), -3.56, 5.8, 0, 0, -Math.PI / 2, 0), WARM));   // the one warm window (somebody left a light on)
  for (const g of P) place(g, 0, 0, 0, 0, 0, 0, 22 / 30, 10 / 13, 17 / 22);   // (the delivered model's hill: 44 x 34 x 10)
  for (const g of H) place(g, -0.5, 9.7, 0, 0, 0, -0.07, 1.25);   // on the hill top (base y 9.7, ridge ~24.7), leaning 4 degrees
  const m = quiet(new Mesh(merge([...P, ...H]), farMat())); m.name = 'Hm_Far_Shack';
  return m;
}
function standinCastle() {
  const P = [];
  P.push(paint(place(new BoxGeometry(90, 10, 40), 0, 3, 0), 0x6e6a64));                       // the rocky base
  P.push(paint(place(new BoxGeometry(44, 16, 14), -4, 16, 0), STONE), paint(place(gable(46, 7, 15), -4, 27.5, 0, 0, Math.PI / 2, 0), SLATE));
  for (const [x, z, r, h] of [[-36, 6, 4, 30], [-22, -10, 3.5, 36], [-8, 10, 3, 26], [14, -6, 5, 46], [26, 8, 3.5, 32], [38, -4, 3, 24]]) {
    P.push(paint(place(new CylinderGeometry(r, r * 1.05, h, 8), x, 8 + h / 2, z), STONE), paint(place(new ConeGeometry(r * 1.3, r * 2.6, 8), x, 8 + h + r * 1.3, z), SLATE));
  }
  P.push(paint(place(new BoxGeometry(30, 3, 4), 40, 7, 14), STONE));                           // a bit of viaduct
  for (let k = 0; k < 14; k++) P.push(paint(place(new PlaneGeometry(0.8, 1.2), -36 + k * 5.5, 14 + (k % 3) * 5, 20.05 - (k % 2 ? 12.9 : 0)), WARM));
  const m = quiet(new Mesh(merge(P).rotateY(-Math.PI / 2), farMat())); m.name = 'Hm_Far_Castle';   // as delivered: the 90 m side along z, facing -x
  return m;
}

// ---------------- load + place ----------------
function withTimeout(p, ms) { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timed out after ' + ms / 1000 + ' s')), ms); })]).finally(() => clearTimeout(t)); }
async function loadFar() {
  let info = null; try { info = await modelInfo('hm_far'); } catch { info = null; }
  if (!info || !info.file) throw new Error('not in models.json');
  const root = await withTimeout(loadModel('hm_far'), LOAD_MS);
  if (!root) throw new Error('the model did not load (see __game.models())');
  const shack = root.getObjectByName('Hm_Far_Shack'), castle = root.getObjectByName('Hm_Far_Castle');
  if (!shack || !castle) throw new Error('nodes Hm_Far_Shack / Hm_Far_Castle missing');
  root.traverse(o => { if (o.isMesh) { o.material = farMat(); o.userData.sharedGeo = true; quiet(o); } });
  return { shack, castle };
}
function put(node, P) { node.position.set(P.x, P.y, P.z); node.rotation.set(0, P.ry, 0); node.scale.setScalar(P.scale); }
// the local box of a node's vertices; with `house`: only those above (top - HOUSE_H) within 7 m (x, z) of the highest vertex
function localBox(node, house = false) {
  const b = new Box3(), pts = []; node.updateMatrixWorld(true);
  const inv = node.matrixWorld.clone().invert();
  node.traverse(o => { if (!o.isMesh) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) pts.push(new Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv)); });
  let top = null; for (const v of pts) if (!top || v.y > top.y) top = v;
  for (const v of pts) if (!house || (v.y > top.y - HOUSE_H && Math.abs(v.x - top.x) < 7 && Math.abs(v.z - top.z) < 7)) b.expandByPoint(v);
  return b;
}
function install(g, kind, shack, castle, low) {
  const root = new Group(); root.name = 'hm-far';
  for (const n of [shack, castle]) { n.removeFromParent(); n.position.set(0, 0, 0); n.rotation.set(0, 0, 0); n.scale.setScalar(1); }
  FS.houseBox = localBox(shack, true); FS.castleBox = localBox(castle);
  put(shack, FAR.shack); put(castle, FAR.castle); castle.visible = !low;
  root.add(shack, castle); g.add(root);
  Object.assign(FS, { kind, root, shack, castle, low });
}
// called by the street (mode 'street' only) with the street group and the tier; never throws, never blocks
export function attachFar(g, tier) {
  const low = tier === 'low';
  FS.kind = null; FS.failed = null; FS.root = null;
  loadFar().then(({ shack, castle }) => install(g, 'glb', shack, castle, low)).catch((e) => {
    FS.failed = String(e && e.message || e); console.warn('[hogsmeade] far model -', FS.failed, '- using the code-built stand-in');
    try { install(g, 'standin', standinShack(), standinCastle(), low); } catch (e2) { FS.failed += '; stand-in: ' + String(e2 && e2.message || e2); }
  });
  return FS;
}

// ---------------- debug ----------------
function screenBox(node, lb, cam) {
  if (!node || !lb) return null;
  node.updateMatrixWorld(true); cam.updateMatrixWorld();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, behind = false;
  for (const x of [lb.min.x, lb.max.x]) for (const y of [lb.min.y, lb.max.y]) for (const z of [lb.min.z, lb.max.z]) {
    _v.set(x, y, z).applyMatrix4(node.matrixWorld).applyMatrix4(cam.matrixWorldInverse); if (_v.z > -cam.near) behind = true;
    _v.applyMatrix4(cam.projectionMatrix);
    const sx = (_v.x * 0.5 + 0.5) * innerWidth, sy = (-_v.y * 0.5 + 0.5) * innerHeight;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  const r = (v) => Math.round(v);
  if (behind) return { box: null, px: 0, inView: false, behind: true };
  return { box: [r(x0), r(y0), r(x1), r(y1)], px: r(y1 - y0), inView: !behind && x0 >= 0 && y0 >= 0 && x1 <= innerWidth && y1 <= innerHeight };
}
export function farState(cam) {
  const p = (n, P, lb) => (n ? { x: P.x, y: P.y, z: P.z, ry: +P.ry.toFixed(3), scale: P.scale, visible: n.visible, ...(cam ? screenBox(n, lb, cam) : {}) } : null);
  return {
    loaded: FS.kind === 'glb', kind: FS.kind, failed: FS.failed, low: FS.low,
    shack: p(FS.shack, FAR.shack, FS.houseBox), castle: p(FS.castle, FAR.castle, FS.castleBox),
    draws: FS.root ? drawCount(FS.root) : 0, tris: FS.root ? triCount(FS.root) : 0,
  };
}
// (look-dev) move a far node live: __game.hogsmeade.farSet('shack', {x: 90})
export function farSet(k, o) { const P = FAR[k], n = FS[k]; if (!P) return null; Object.assign(P, o || {}); if (n) put(n, P); return { ...P }; }
