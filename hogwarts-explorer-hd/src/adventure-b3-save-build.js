// Book 3, adventure 6 "מצילים את בקביק וסיריוס" (the finale): the places, the flight path and the small code-built props
// (adventure-b3-save.js runs it). Buckbeak is the live rigged GLB 'buckbeak'; the dog is 'blackdog' (dog-free.js loadDog).
// Here: the rope post + knot by the paddock (one vertex-coloured mesh) and the rope (one thin mesh stretched each frame),
// and the kind stand-in for Sirius: the game's chibi builder (long dark hair, a warm smile, a worn brown coat) MERGED into
// two meshes (the body, and the right arm on a pivot so he can wave): 2 draw calls.
import { Group, Mesh, CylinderGeometry, TorusGeometry, SphereGeometry, CapsuleGeometry, MeshStandardMaterial, Vector3, CatmullRomCurve3, Matrix4 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildChibi } from './chibi.js';
import { merged, propMat } from './adventure-b3-timeturner-build.js';
import { BB } from './adventure-buckbeak-build.js';

export const POST = { x: 77.0, z: 48.9 };      // the rope post, in front of Buckbeak (he waits at BB facing west), clear of the bow spot
export const KNOT_Y = 1.05;
// the flight: up from the paddock, a wide climb round over the hut lawns, then west to the Astronomy tower top (the east
// tower at (30, 0), 21 m + its cone). [x, z, metres over the terrain]. ~95 m at 6 m/s.
export const FPATH = [[BB.x, BB.z, 0], [80.5, 44, 3], [84, 34, 7], [82, 22, 11], [74, 12, 15], [62, 6, 19], [50, 3, 22], [41, 2, 24], [36.5, 1.5, 24.5]];
export const FSPEED = 6;
export function flightCurve(groundAt) {
  const pts = FPATH.map(([x, z, h]) => new Vector3(x, groundAt(x, z) + h, z));
  const c = new CatmullRomCurve3(pts, false, 'centripetal', 0.5); c.arcLengthDivisions = 300; return c;
}
// the tower interior (room-local; the room is 16 x 16, its south door at z +6.8, the telescope at (4.6, -4.2))
export const T_HARRY = { x: 0.4, z: 3.2, yaw: Math.PI };
export const T_DOG = { x: 3.3, z: -2.9, yaw: -2.5 };
export const T_BB = { x: -3.6, z: 0.2, yaw: Math.PI / 2 };
export const T_SIRIUS = { x: 4.6, z: -1.3, yaw: -2.3 };

export function buildPost() {
  const ROPE = 0xb08a52, WOOD = 0x5e3e24;
  const m = merged([
    [new CylinderGeometry(0.11, 0.13, 1.3, 10).translate(0, 0.65, 0), WOOD], [new CylinderGeometry(0.15, 0.11, 0.08, 10).translate(0, 1.31, 0), WOOD],
    [new TorusGeometry(0.15, 0.045, 6, 14).rotateX(Math.PI / 2).translate(0, KNOT_Y, 0), ROPE], [new TorusGeometry(0.15, 0.045, 6, 14).rotateX(Math.PI / 2).translate(0, KNOT_Y - 0.09, 0), ROPE],
    [new SphereGeometry(0.1, 10, 8).translate(0.13, KNOT_Y - 0.04, 0.0), ROPE],
  ], propMat());
  m.name = 'b3save-post'; m.castShadow = true;
  return m;
}
// a unit rope along +y (stretched / turned each frame between the knot and Buckbeak's neck)
export function buildRope() { const m = new Mesh(new CylinderGeometry(0.035, 0.035, 1, 6).translate(0, 0.5, 0), new MeshStandardMaterial({ color: 0xb08a52, roughness: 0.9 })); m.name = 'b3save-rope'; m.frustumCulled = false; m.raycast = () => {}; return m; }

// Sirius (a kind stand-in): adult chibi, worn coat, long dark hair, a warm smile. 2 meshes.
export function buildSirius() {
  const g = buildChibi({ robe: 0x5a4632, trim: 0x3e3024, skin: 0xe2b48e, hair: 0x1e1612, house: 0x7a6650, scale: 1.0 });
  const rig = g.userData.rig, head = rig.head;
  const hair = new MeshStandardMaterial({ color: 0x1e1612, roughness: 0.95 });
  const add = (parent, geo, mat, x, y, z) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  add(head, new CapsuleGeometry(0.26, 0.42, 4, 10), hair, 0, -0.2, -0.12).scale.set(1.05, 1, 0.7);          // long hair down to the shoulders
  add(head, new CapsuleGeometry(0.07, 0.3, 3, 6), hair, -0.27, -0.16, 0.04); add(head, new CapsuleGeometry(0.07, 0.3, 3, 6), hair, 0.27, -0.16, 0.04);
  const smile = add(head, new TorusGeometry(0.075, 0.016, 6, 12, Math.PI), new MeshStandardMaterial({ color: 0x8a3a2a }), 0, -0.1, 0.285); smile.rotation.z = Math.PI;   // a warm smile
  for (const sx of [-0.1, 0.1]) add(head, new CapsuleGeometry(0.012, 0.05, 2, 4), hair, sx, 0.11, 0.29).rotation.z = Math.PI / 2;   // soft brows (level, friendly)
  add(g, new CylinderGeometry(0.32, 0.56, 0.62, 14), new MeshStandardMaterial({ color: 0x4e3c2a }), 0, 0.62, 0);   // the long worn coat
  g.updateMatrixWorld(true);
  // merge per part, keeping each mesh's colour as a vertex colour
  const inv = new Matrix4();
  const collect = (root, rel) => { const parts = []; inv.copy(rel.matrixWorld).invert();
    root.traverse(o => { if (!o.isMesh) return; const geo = o.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(inv, o.matrixWorld)); parts.push([geo, o.material.color ? o.material.color.getHex() : 0x888888]); });
    return parts; };
  const armR = rig.armR;
  const armParts = collect(armR, armR);
  armR.parent.remove(armR); g.updateMatrixWorld(true);
  const body = merged(collect(g, g), propMat()); body.material.roughness = 0.85; body.material.metalness = 0; body.name = 'b3save-sirius-body';
  const out = new Group(); out.name = 'b3save-sirius'; out.add(body);
  const pivot = new Group(); pivot.position.copy(armR.position); out.add(pivot);
  const arm = merged(armParts, body.material); arm.name = 'b3save-sirius-arm'; pivot.add(arm);
  out.userData.arm = pivot;
  out.scale.setScalar(1.12);
  g.traverse(o => { if (o.isMesh) { try { o.geometry.dispose(); } catch { /* ok */ } } });
  void mergeGeometries;
  return out;
}
