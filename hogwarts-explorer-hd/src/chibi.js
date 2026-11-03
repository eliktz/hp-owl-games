// A charming low-poly chibi wizard-kid, built from primitives so it costs ~nothing on an
// iPad yet reads as a real little person: big head with hair + a face, neck, shoulders,
// swinging arms with hands, legs + feet that step, a flowing collared robe, a house scarf
// and an optional pointed hat and wand. Origin at the feet, facing +Z (eyes on +Z).
//
// buildChibi(opts) -> Group with group.userData.rig. animateChibi(rig, t, state) drives the
// idle / walk / run cycle (arm swing, leg step, head bob) — call it every frame.
import {
  Group, Mesh, SphereGeometry, CapsuleGeometry, CylinderGeometry, ConeGeometry,
  BoxGeometry, TorusGeometry, MeshStandardMaterial, Color,
} from 'three';

const mat = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const add = (parent, geo, m, x, y, z) => { const mesh = new Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };

// A limb that swings from a pivot: a capsule hanging below the pivot, optional foot/hand.
function limb(px, py, pz, { len, r, limbMat, tipMat, tipR, foot }) {
  const pivot = new Group(); pivot.position.set(px, py, pz);
  const seg = new Mesh(new CapsuleGeometry(r, len, 4, 8), limbMat);
  seg.position.y = -len / 2 - r; seg.castShadow = true; pivot.add(seg);
  if (tipMat) {
    if (foot) {                                   // a little shoe poking forward
      const shoe = new Mesh(new BoxGeometry(r * 2.2, r * 1.4, r * 3.2), tipMat);
      shoe.position.set(0, -len - r * 1.4, r * 0.9); shoe.castShadow = true; pivot.add(shoe);
    } else {                                       // a rounded hand
      const hand = new Mesh(new SphereGeometry(tipR, 10, 8), tipMat);
      hand.position.y = -len - r; hand.castShadow = true; pivot.add(hand);
    }
  }
  return pivot;
}

export function buildChibi(opts = {}) {
  const {
    robe = 0x3a2d55, trim = 0x2a2140, skin = 0xe8c49a, hair = 0x3a2416,
    house = 0x7a1020, hat = null, wand = false, scale = 1, glasses = false,
  } = opts;
  const g = new Group();
  const robeMat = mat(robe, { roughness: 0.92 });
  const trimMat = mat(trim, { roughness: 0.9 });
  const skinMat = mat(skin, { roughness: 0.7 });
  const houseMat = mat(house, { emissive: new Color(house).multiplyScalar(0.18) });

  // ---- legs + feet (pivot at the hips so they step) ----
  const legOpts = { len: 0.34, r: 0.1, limbMat: trimMat, tipMat: mat(0x241a12), foot: true };
  const legL = limb(-0.13, 0.62, 0, legOpts); const legR = limb(0.13, 0.62, 0, legOpts);
  g.add(legL, legR);

  // ---- flowing robe (flared skirt + torso) with a trimmed collar ----
  add(g, new CylinderGeometry(0.3, 0.5, 0.5, 16), robeMat, 0, 0.82, 0);          // skirt
  add(g, new CapsuleGeometry(0.26, 0.28, 4, 10), robeMat, 0, 1.12, 0);           // torso
  const collar = add(g, new CylinderGeometry(0.2, 0.3, 0.12, 14, 1, true), trimMat, 0, 1.3, 0);
  collar.material.side = 2;

  // ---- arms + hands (pivot at the shoulders so they swing) ----
  const armOpts = { len: 0.3, r: 0.08, limbMat: robeMat, tipMat: skinMat, tipR: 0.08 };
  const armL = limb(-0.3, 1.26, 0, armOpts); const armR = limb(0.3, 1.26, 0, armOpts);
  g.add(armL, armR);

  // ---- neck + big friendly head ----
  add(g, new CylinderGeometry(0.08, 0.1, 0.12, 10), skinMat, 0, 1.36, 0);
  const headGrp = new Group(); headGrp.position.y = 1.5; g.add(headGrp);
  add(headGrp, new SphereGeometry(0.3, 20, 16), skinMat, 0, 0, 0);
  for (const sx of [-0.1, 0.1]) {                                                // eyes (white + pupil)
    add(headGrp, new SphereGeometry(0.055, 10, 8), mat(0xfbfbff, { roughness: 0.4 }), sx, 0.02, 0.27);
    add(headGrp, new SphereGeometry(0.03, 8, 8), mat(0x241a14), sx, 0.02, 0.31);
  }
  add(headGrp, new SphereGeometry(0.035, 8, 6), skinMat, 0, -0.05, 0.3).scale.set(1, 0.7, 1); // nose
  // hair: a cap over the crown pushed back, plus a little fringe at the brow
  const hairMat = mat(hair, { roughness: 0.95 });
  add(headGrp, new SphereGeometry(0.32, 16, 12), hairMat, 0, 0.06, -0.02).scale.set(1, 0.92, 1);
  add(headGrp, new BoxGeometry(0.5, 0.12, 0.08), hairMat, 0, 0.2, 0.24).rotation.x = 0.3;

  // ---- house scarf around the neck with two hanging ends ----
  add(g, new TorusGeometry(0.16, 0.055, 8, 16), houseMat, 0, 1.33, 0).rotation.x = Math.PI / 2;
  add(g, new BoxGeometry(0.12, 0.42, 0.05), houseMat, 0.08, 1.12, 0.18);
  add(g, new BoxGeometry(0.12, 0.3, 0.05), houseMat, -0.08, 1.16, 0.18);

  if (glasses) for (const sx of [-0.1, 0.1]) {
    const ring = new Mesh(new TorusGeometry(0.07, 0.016, 8, 16), mat(0x101010, { metalness: 0.3 }));
    ring.position.set(sx, 0.02, 0.29); headGrp.add(ring);
  }
  if (hat) {                                                                     // pointed wizard hat
    add(headGrp, new CylinderGeometry(0.4, 0.42, 0.04, 16), mat(hat, { roughness: 0.95 }), 0, 0.28, -0.02);
    add(headGrp, new ConeGeometry(0.26, 0.6, 16), mat(hat, { roughness: 0.95 }), 0.04, 0.6, -0.04).rotation.z = -0.18;
  }
  if (wand) {                                                                    // a wand in the right hand
    const w = add(armR, new CylinderGeometry(0.012, 0.02, 0.34, 6), mat(0x2a1a10), 0, -0.46, 0.14);
    w.rotation.x = -0.9;
  }

  g.scale.setScalar(scale);
  g.userData.rig = { armL, armR, legL, legR, head: headGrp, t: 0 };
  // Cheap figures with merged/odd bounds shouldn't be frustum-culled at screen edges.
  g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  return g;
}

// Drive the idle / walk / run cycle. state: { moving, running }. Advance with dt.
export function animateChibi(rig, dt, { moving = false, running = false } = {}) {
  if (!rig) return;
  rig.t += dt;
  const t = rig.t;
  if (moving) {
    const freq = running ? 13 : 9, amp = running ? 0.95 : 0.6;
    const s = Math.sin(t * freq) * amp;
    rig.armL.rotation.x = s; rig.armR.rotation.x = -s;
    rig.legL.rotation.x = -s; rig.legR.rotation.x = s;
    rig.head.rotation.x = Math.sin(t * freq * 2) * 0.03;
    rig.head.rotation.z = 0;
  } else {                                           // gentle breathing + a little head tilt
    const s = Math.sin(t * 1.6);
    rig.armL.rotation.x = 0.06 + s * 0.05; rig.armR.rotation.x = 0.06 - s * 0.05;
    rig.legL.rotation.x = 0; rig.legR.rotation.x = 0;
    rig.head.rotation.x = s * 0.04; rig.head.rotation.z = Math.sin(t * 0.8) * 0.03;
  }
}
