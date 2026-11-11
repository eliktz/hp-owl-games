// Set dressing for the HD interiors — the charm that makes each room feel lived in, kept
// almost free for the iPad: anything repeated is ONE InstancedMesh (a single draw call).
//   Great Hall   a feast laid along the four house tables, grinning jack-o'-lanterns drifting
//                among the floating candles, the headmaster's golden owl lectern
//   Entrance     two suits of armour guarding the great doors
//   Library      green reading lamps and a slowly spinning globe
// decorate(id, group, colliders) returns an optional per-frame tick(dt, t).
import {
  Group, Mesh, InstancedMesh, Object3D, Color, SphereGeometry, CylinderGeometry, BoxGeometry,
  ConeGeometry, TorusGeometry, MeshStandardMaterial, Matrix4,
} from 'three';

const M = (color, o = {}) => new MeshStandardMaterial({ color, roughness: 0.7, ...o });
const mk = (par, geo, mat, x, y, z) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
const d = new Object3D(), c = new Color();

function feast(g) {
  const cols = [0xd9622b, 0xe8c860, 0xb8322e, 0x7cc04a, 0xf2e2b0, 0x8a4a2a, 0xff9a3c, 0xa55ad0];
  const im = new InstancedMesh(new SphereGeometry(0.2, 10, 8), M(0xffffff, { roughness: 0.55 }), 88);
  let n = 0;
  for (const tx of [-5, 5]) for (const tz of [-6, 9]) for (let z = tz - 7.2; z <= tz + 7.2 && n < 88; z += 0.72) {
    const big = n % 5 === 0, s = big ? 1.5 : 0.7 + ((n * 7) % 5) * 0.1;
    d.position.set(tx + (((n * 5) % 7) - 3) * 0.09, 1.0 + 0.2 * s * (big ? 0.6 : 0.85), z);
    d.scale.set(s * (big ? 1.25 : 1), s * (big ? 0.6 : 0.85), s); d.rotation.set(0, n, 0); d.updateMatrix();
    im.setMatrixAt(n, d.matrix); im.setColorAt(n, c.setHex(big ? (n % 2 ? 0x9a5a2a : 0xe0b060) : cols[(n * 3) % cols.length])); n++;
  }
  im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.frustumCulled = false; im.name = 'feast'; g.add(im);
  // wave the wand near a table and the whole feast hops and jiggles for a few seconds
  const base = [], m = new Matrix4(), hop = new Matrix4(), mm = new Matrix4();
  for (let i = 0; i < n; i++) { im.getMatrixAt(i, m); base.push(m.clone()); }
  let dance = 0;
  for (const tx of [-5, 5]) for (const tz of [-6, 9]) { const spot = new Object3D(); spot.position.set(tx, 1, tz); g.add(spot); g.userData.enchant.push({ id: 'feast', obj: spot, cast() { dance = 3.2; try { window.HPFun.sfx.munch(); } catch { /* no audio yet */ } return '🍗'; } }); }
  return (dt, t) => {
    if (dance <= 0) return;
    dance -= dt; const k = dance > 0 ? Math.min(1, dance) : 0;
    for (let i = 0; i < n; i++) { hop.makeTranslation(0, k * Math.abs(Math.sin(t * 9 + i * 1.3)) * 0.4, 0); mm.multiplyMatrices(hop, base[i]); im.setMatrixAt(i, mm); }
    im.instanceMatrix.needsUpdate = true;
  };
}

function pumpkins(g) {
  const N = 7, P = [];
  const body = new InstancedMesh(new SphereGeometry(0.5, 12, 10), M(0xff8a1e, { emissive: new Color(0xc04a00), emissiveIntensity: 0.9, roughness: 0.6 }), N);
  // each face is three dark cones (two eyes + a grin), all faces in one instanced mesh
  const face = new InstancedMesh(new ConeGeometry(0.1, 0.16, 3), M(0x2a1204, { emissive: new Color(0xffd070), emissiveIntensity: 1.6 }), N * 3);
  for (let i = 0; i < N; i++) P.push({ x: -6 + i * 2 + (i % 2) * 0.8, z: -12 + ((i * 11) % 24), y: 5 + (i % 3) * 0.9, ph: i * 1.7 });
  body.frustumCulled = face.frustumCulled = false; body.name = 'pumpkins'; g.add(body, face);
  // wave the wand up the middle of the hall and the jack-o'-lanterns whirl about, cackling
  let spin = 0; const spot = new Object3D(); spot.position.set(0, 5, -3); g.add(spot);
  g.userData.enchant.push({ id: 'pumpkins', obj: spot, cast() { spin = 3.5; try { window.HPFun.sfx.giggle(); setTimeout(() => window.HPFun.sfx.giggle(true), 500); } catch { /* no audio yet */ } return '🎃'; } });
  g.userData.pumpkinSpin = () => spin;
  return (dt, t) => {
    if (spin > 0) spin -= dt;
    const sp = spin > 0 ? Math.min(1, spin) : 0;
    for (let i = 0; i < N; i++) {
      const p = P[i], x = p.x + Math.sin(t * 0.25 + p.ph) * 1.2, y = p.y + Math.sin(t * 0.9 + p.ph) * 0.3 + sp * Math.abs(Math.sin(t * 8 + p.ph)) * 0.7, z = p.z + Math.cos(t * 0.2 + p.ph) * 1.2;
      const tilt = Math.sin(t * 0.7 + p.ph) * 0.12 + sp * Math.sin(t * 14 + p.ph) * 0.5;      // whirling = a mad wobble (faces stay toward the doors)
      d.position.set(x, y, z); d.scale.set(1, 0.82, 1); d.rotation.set(0, 0, tilt); d.updateMatrix(); body.setMatrixAt(i, d.matrix);
      // faces look down the hall toward the doors (+z), where you walk in
      [[-0.17, 0.1, 0], [0.17, 0.1, 0], [0, -0.14, Math.PI]].forEach(([fx, fy, rz], k) => {
        d.position.set(x + fx, y + fy, z + 0.47); d.scale.set(k === 2 ? 2.4 : 1, 1, 0.4); d.rotation.set(0, 0, rz + tilt); d.updateMatrix(); face.setMatrixAt(i * 3 + k, d.matrix);
      });
    }
    body.instanceMatrix.needsUpdate = true; face.instanceMatrix.needsUpdate = true;
  };
}

function lectern(g, x, z) {
  const gold = M(0xe6b422, { metalness: 0.75, roughness: 0.25, emissive: new Color(0x4a3400), emissiveIntensity: 0.5 });
  const L = new Group(); L.position.set(x, 0, z);
  mk(L, new CylinderGeometry(0.4, 0.6, 0.24, 14), gold, 0, 0.12, 0);
  mk(L, new CylinderGeometry(0.1, 0.14, 1.3, 10), gold, 0, 0.9, 0);
  const owl = new Group(), wings = []; L.add(owl);            // the bird is its own group so it can come alive
  mk(owl, new SphereGeometry(0.34, 14, 12), gold, 0, 1.75, 0).scale.set(0.9, 1.15, 0.8);
  mk(owl, new SphereGeometry(0.24, 12, 10), gold, 0, 2.25, 0.05);
  for (const s of [-1, 1]) { const w = mk(owl, new BoxGeometry(0.9, 0.6, 0.07), gold, s * 0.58, 1.9, -0.04); w.rotation.z = s * 0.5; w.rotation.y = s * -0.3; w.userData.s = s; wings.push(w); mk(owl, new ConeGeometry(0.06, 0.13, 6), gold, s * 0.09, 2.45, 0.05); }
  L.userData.light = { k: 'glow', c: 0xffd76a, r: 3, a: 0.32 };
  g.add(L);
  // a wand cast wakes the golden owl: it beats its wings, hops on its perch, looks about and hoots
  let flap = 0;
  g.userData.enchant.push({ id: 'owl', obj: L, cast() { flap = 2.8; try { window.HPFun.sfx.hoot(); setTimeout(() => window.HPFun.sfx.hoot(), 900); } catch { /* no audio yet */ } return '🦉'; } });
  g.userData.owlFlap = () => flap;
  return (dt, t) => {
    if (flap <= 0) return;
    flap -= dt; const k = flap > 0 ? Math.min(1, flap * 2) : 0;
    for (const w of wings) w.rotation.z = w.userData.s * (0.5 + k * (0.35 + Math.sin(t * 17) * 0.6));
    owl.position.y = k * Math.abs(Math.sin(t * 7)) * 0.25; owl.rotation.y = k * Math.sin(t * 4.5) * 0.6;
  };
}

function armour(g, x, z, rotY) {
  const A = new Group(); A.position.set(x, 0, z); A.rotation.y = rotY;
  const steel = M(0x9aa2b0, { metalness: 0.85, roughness: 0.35 });
  mk(A, new CylinderGeometry(0.36, 0.44, 1.05, 14), steel, 0, 1.05, 0);
  mk(A, new SphereGeometry(0.27, 16, 14), steel, 0, 1.75, 0);
  mk(A, new BoxGeometry(0.4, 0.06, 0.08), M(0x0a0a0a), 0, 1.75, 0.24);
  for (const s of [-1, 1]) { mk(A, new SphereGeometry(0.18, 10, 8), steel, s * 0.42, 1.42, 0); mk(A, new CylinderGeometry(0.08, 0.08, 0.8, 8), steel, s * 0.2, 0.42, 0); }
  const arm = new Group(); arm.position.set(0.42, 1.42, 0); A.add(arm);
  mk(arm, new CylinderGeometry(0.1, 0.08, 0.8, 8), steel, 0, -0.4, 0);
  mk(A, new CylinderGeometry(0.03, 0.03, 2.2, 6), M(0x3a2a18), -0.5, 1.1, 0);
  mk(A, new ConeGeometry(0.08, 0.3, 6), steel, -0.5, 2.3, 0);
  A.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(A);
  const st = { wave: 2 + Math.random() * 5, dance: 0, group: A, arm, rotY };
  return st;
}

export function decorate(id, g) {
  const ticks = [];
  g.userData.enchant = g.userData.enchant || [];       // things the wand can wake (delight.js)
  if (id === 'greathall') {
    ticks.push(feast(g)); ticks.push(pumpkins(g)); ticks.push(lectern(g, 0, -12.4));
  } else if (id === 'entrancehall') {
    const suits = [armour(g, -3.4, 9.4, Math.PI), armour(g, 3.4, 9.4, Math.PI)];
    for (const s of suits) g.userData.enchant.push({ id: 'armour', obj: s.group, cast() { s.dance = 3; return '🛡️'; } });
    ticks.push((dt, t) => {
      for (const s of suits) {
        s.wave -= dt;
        // a guard notices you: walk up close and it snaps a clanky salute (once per approach)
        const pl = window.__game && window.__game.player ? window.__game.player.pos : null;
        if (pl) {
          const dd = Math.hypot(pl.x - s.group.position.x, pl.z - s.group.position.z);
          if (dd < 3 && !s.greeted && s.dance <= 0) { s.greeted = true; s.wave = 1.2; g.userData.salutes = (g.userData.salutes || 0) + 1; try { window.HPFun.sfx.clank(); } catch { /* no audio yet */ } }
          else if (dd > 5.5) s.greeted = false;
        }
        const waving = s.wave < 1.2 && s.wave > 0;
        s.arm.rotation.z = waving ? Math.sin((1.2 - s.wave) * 9) * 0.9 : -0.1;
        if (s.wave <= 0) s.wave = 4 + Math.random() * 7;
        if (s.dance > 0) { s.dance -= dt; const k = 3 - s.dance; s.group.rotation.y = s.rotY + Math.sin(k * 7) * 0.7; s.group.position.y = Math.abs(Math.sin(k * 9)) * 0.3; s.arm.rotation.z = 2.2 + Math.sin(k * 14) * 0.6; if (s.dance <= 0) { s.group.rotation.y = s.rotY; s.group.position.y = 0; } }
      }
    });
  } else if (id === 'library') {
    for (const tz of [-4, 4]) {
      const lamp = new Group(); lamp.position.set(0.5, 0.98, tz + 1.6);
      const brass = M(0xb8902a, { metalness: 0.6, roughness: 0.4 });
      mk(lamp, new CylinderGeometry(0.13, 0.16, 0.05, 10), brass, 0, 0.03, 0); mk(lamp, new CylinderGeometry(0.025, 0.025, 0.42, 6), brass, 0, 0.24, 0);
      const sh = mk(lamp, new CylinderGeometry(0.11, 0.17, 0.17, 10), M(0x2fae6a, { emissive: new Color(0x1f8a4a), emissiveIntensity: 1.4, roughness: 0.4 }), 0, 0.48, 0); sh.scale.z = 1.8;
      lamp.userData.light = { k: 'glow', c: 0x9effc0, r: 2.2, a: 0.26 }; g.add(lamp);
    }
    const globe = new Group(); globe.position.set(3.4, 0, 7.6);
    mk(globe, new CylinderGeometry(0.4, 0.52, 0.16, 12), M(0x4a3016), 0, 0.08, 0); mk(globe, new CylinderGeometry(0.06, 0.08, 1.05, 8), M(0x4a3016), 0, 0.65, 0);
    const ball = mk(globe, new SphereGeometry(0.6, 18, 14), M(0x2a6fb0, { roughness: 0.5 }), 0, 1.65, 0); ball.rotation.z = 0.4;
    for (let i = 0; i < 7; i++) { const land = mk(ball, new SphereGeometry(0.2 + (i % 3) * 0.06, 8, 6), M(0x7ab85a), 0, 0, 0); const a = i * 2.4, b = (i % 3 - 1) * 0.6; land.position.set(Math.cos(a) * Math.cos(b) * 0.5, Math.sin(b) * 0.5, Math.sin(a) * Math.cos(b) * 0.5); land.scale.set(1, 1, 0.5); land.lookAt(0, 0, 0); }
    const arc = mk(globe, new TorusGeometry(0.7, 0.035, 6, 20, Math.PI), M(0xb8902a, { metalness: 0.6, roughness: 0.4 }), 0, 1.65, 0); arc.rotation.z = Math.PI / 2 + 0.4;
    g.add(globe);
    let spin = 0;
    g.userData.enchant.push({ id: 'globe', obj: globe, cast() { spin = 2.5; return '🌍'; } });
    ticks.push((dt) => { ball.rotation.y += dt * (spin > 0 ? 9 : 0.4); if (spin > 0) spin -= dt; });
  }
  return ticks.length ? (dt, t) => { for (const f of ticks) f(dt, t); } : null;
}
