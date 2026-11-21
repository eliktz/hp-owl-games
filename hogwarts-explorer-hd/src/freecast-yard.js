// Free-play spells, batch 4 (freecast.js / freecast-castle.js): Episkey, the 19th spell, and two new spots.
//   Episkey:    anywhere, soft pink-gold sparkles and a few little hearts and plus signs rise round Harry; aimed at
//               something poorly it makes it well: a stunned, disarmed or petrified duelling dummy (freecast-duel.js),
//               the poorly toy dragon on the courtyard bench, the drooping courtyard plant, the drooping library flowers
//               (freecast-castle.js). The hearts are castle's pooled hearts() (2 instanced meshes, only while floating).
//   Courtyard   (outdoors on the lawn east of the front-door approach; YARD below, a rotated group, world x,z):
//               a stone bench with the poorly toy dragon (a big white plaster, droopy; Episkey: the plaster pops off,
//               it perks up and hops twice with hearts; sleepy-poorly again after ~40 s), a birdbath (Aguamenti fills
//               it; Avis birds within ~12 m fly over and perch on its rim, see castle's PCH), a lantern post
//               (Incendio / Aguamenti; Lumos Maxima within ~12 m lights it), a planter with a drooping plant
//               (Episkey or Aguamenti perk it up, it droops again after ~45 s; Orchideous plants flowers, Aguamenti
//               then makes them grow; Engorgio / Reducio size steps), a cracked stone urn (Reparo; it falls apart
//               again after ~25 s, like the helmet).   3 draw calls, hidden indoors and beyond 70 m.
//   Great Hall  (room-local, built each time the hall streams in; GH below): a side table against the east wall
//               with a wobbly pudding (Engorgio / Reducio, three sizes), a fruit platter and a goblet (Leviosa /
//               Accio), a cracked plate (Reparo, breaks again after ~25 s), and a tall candle stand beside it
//               (Incendio / Aguamenti; Lumos Maxima lights it).   3 draw calls.
//               (batch 7: the hall's own floating candles are now handled with every room's real candles in
//               freecast-real.js: clusters of ~12 go out and relight, Nox dims them.)
// Nothing is allocated per frame; the courtyard is built once, the hall spot once per visit.
import {
  Group, InstancedMesh, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry, LatheGeometry,
  ShapeGeometry, Shape, Vector2, Vector3, Quaternion, Euler, Matrix4, Color,
} from 'three';
import { paint, place, rod } from './freecast-corner.js';

// ---- where (world x,z + the yaw the courtyard faces; room-local x,z in the Great Hall) ----
// The courtyard: open lawn east of the door approach (x 0), 11 m from the front wall (z 20), 7.8 m from Hedwig (8,35)
// and the student pair (6.3,31.3), 12.8 m from the quest stars (6,40) and (26,34); it faces the approach path.
export const YARD = { x: 14, z: 31, yaw: -1.04 };
// local layout (x right, z toward the viewer who comes from the path)
const YL = { bench: [0, -1.2], toy: [0.32, -1.2], lantern: [-1.15, -1.5], bath: [-1.9, 0.4], planter: [1.8, 0.5], urn: [2.6, -1.1] };
// The Great Hall: along the east wall between the windows (columns at z 4.5 / 13.5), 2.3 m clear of the outer bench
// (x 6.4) and 10 m from the doors (0, 16.8); the dungeon arch is on the west wall.
export const GH = { table: { x: 9.0, z: 9.0 }, stand: { x: 9.05, z: 11.15 } };
const GHI = { plate: 7.95, platter: 8.62, pudding: 9.38, goblet: 10.02 };   // z of the things on the table (x 8.95)

const _m4 = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _s = new Vector3(), _c = new Color();
const STONE = 0x6a6254, STONE2 = 0x8e8472, IRON = 0x2e2b30, IRON2 = 0x4a4550, GOLD = 0xd8b04a, GOLD2 = 0xf0d070, WOOD = 0x5a3a22, DARK = 0x3a2416;
const MINT = 0x3fa872, MINT2 = 0x74d49c, CREAM = 0xfff2d0, LAV = 0xb89af0, LAV2 = 0xe0d0ff;
const PAL_YARD = [0xff6a9a, 0xffd040, 0xff8a3a, 0xfff4e0, 0xc87ae8, 0xff5a5a, 0xffe27a];

export function createYard({ scene, camera, player, interiors, fun, emit, burst, stream, tip, tipV, glowTex, best, BYKEY, targets, hearts, heightAt, lib }) {
  const { spotKit, flameMesh, bouquetGeo, ease, backOut, bouncy, M, newScal, stepScal, tickScal, newMover, startMover, tickMover, newFire, fireCast, tickFireState, fireOk } = lib;
  const pos = player.pos;
  let T = 0;
  const SP = {};
  const v0 = new Vector3(), v1 = new Vector3(), v2 = new Vector3(), tv = new Vector3(), _rw = new Vector3();
  const qa = new Quaternion();
  const col = (k) => BYKEY[k].col;

  // ======================= shared: things that break and mend (the urn, the plate) =======================
  // m.broken[i] = { p, q } the piece's pose in pieces (kit-local); the whole pose is the bone's rest pose
  const newMend = (broken) => ({ state: 'broken', t: 0, mends: 0, breaks: 0, broken });
  function poseMend(kit, i0, m, k, arc = 0) {
    for (let i = 0; i < m.broken.length; i++) {
      const b = kit.bones[i0 + i], r = kit.rest[i0 + i], br = m.broken[i], kk = typeof k === 'function' ? k(i) : k;
      b.position.lerpVectors(br.p, r.p, kk); b.position.y += Math.sin(kk * Math.PI) * arc; b.quaternion.slerpQuaternions(br.q, r.q, kk);
    }
  }
  // toWorld(kitLocal, out): for the sparkles
  function tickMend(m, kit, i0, dt, toWorld, top) {
    if (m.state === 'broken') { poseMend(kit, i0, m, 0); return; }
    m.t += dt; const t = m.t, n = m.broken.length;
    if (m.state === 'mending') {
      if (t < 0) { poseMend(kit, i0, m, 0); return; }
      poseMend(kit, i0, m, (i) => ease((t - i * 0.12) / 0.9), 0.5);
      if (Math.random() < dt * 20) { toWorld(kit.bones[i0 + ((Math.random() * n) | 0)].position, v0); emit(v0.x, v0.y + 0.1, v0.z, 0, 0.4, 0, 0.6, 0.16, 0x9affc8); }
      if (t >= 0.95 + n * 0.12) { poseMend(kit, i0, m, 1); m.state = 'whole'; m.t = 0; m.mends++; toWorld(top, v0); burst(v0.x, v0.y, v0.z, 0x9affc8, 22, 2, 0.8, 0.22, -1); fun.sfx.tink(0); fun.sfx.tink(3); fun.sfx.chime(); }
    } else if (m.state === 'whole') {
      poseMend(kit, i0, m, 1);
      if (t > 25) { m.state = 'wobble'; m.t = 0; }
    } else if (m.state === 'wobble') {
      const a = Math.sin(t * 16) * 0.12 * Math.min(1, t / 0.8);
      qa.setFromEuler(_e.set(a * 0.5, 0, a));
      for (let i = 0; i < n; i++) { const b = kit.bones[i0 + i], r = kit.rest[i0 + i]; b.position.copy(r.p); b.quaternion.copy(qa).multiply(r.q); }
      if (t > 1.0) { m.state = 'falling'; m.t = 0; }
    } else if (m.state === 'falling') {
      poseMend(kit, i0, m, 1 - ease(t / 0.45), 0.2);
      if (t >= 0.45) { poseMend(kit, i0, m, 0); m.state = 'broken'; m.breaks++; fun.sfx.clank(); }
    }
  }
  const mendCast = (m) => { m.state = 'mending'; m.t = -0.35; };

  // ======================= the courtyard =======================
  const Y0 = heightAt(YARD.x, YARD.z);
  const yardRoot = new Group(); yardRoot.name = 'freecast-yard';
  yardRoot.position.set(YARD.x, Y0, YARD.z); yardRoot.rotation.y = YARD.yaw; yardRoot.updateMatrixWorld(true);
  const RM = yardRoot.matrixWorld.clone();
  const yW = (x, y, z, o) => o.set(x, y, z).applyMatrix4(RM);                 // kit-local -> world
  const yWv = (v, o) => o.copy(v).applyMatrix4(RM);
  const gy = (lx, lz) => { v0.set(lx, 0, lz).applyMatrix4(RM); return heightAt(v0.x, v0.z) - Y0; };
  const YB = { toy: 0, head: 1, lids: 2, plaster: 3, wingL: 4, wingR: 5, water: 6, plantRoot: 7, sprout: 8, flowers: 9, urn0: 10 };
  const NURN = 4;
  const SEAT = 0.47;
  const yard = { kit: null, flames: null, sproutRange: null, sproutOrig: null, tintK: -1 };
  const YS = {   // session state
    toy: { state: 'poorly', t: 0, heals: 0, hops: 0, hopN: 0, k: 0, since: 0 },
    bath: { full: false, k: 0, pend: 0, fills: 0, since: 0, frozen: false, freezePend: 0, meltPend: 0, freezes: 0, melts: 0, iceK: 0 },
    fire: newFire(),
    plant: { wilt: 1, wiltTo: 1, last: -1e9, pend: 0, pendK: null, heals: 0, bloomed: false, bk: 0, blooms: 0, grow: 1, growTo: 1, waters: 0, sc: newScal([0.6, 1, 1.8]) },
    urn: null,
    maximaLit: 0,
  };
  {
    // pieces lie on the grass, each turned so its curved shell faces up (the quarter's middle at phi = i*pi/2 + pi/4)
    const [ux, uz] = YL.urn, bro = [], ug = gy(ux, uz);
    for (let i = 0; i < NURN; i++) {
      const a = i * 1.57 + 0.6, r = 0.45 + (i % 2) * 0.14, mid = i * Math.PI / 2 + Math.PI / 4;
      bro.push({ p: new Vector3(ux + Math.cos(a) * r, ug + 0.05, uz + Math.sin(a) * r), q: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), a * 0.7).multiply(new Quaternion().setFromEuler(new Euler(Math.cos(mid) > 0 ? -1.5 : 1.5, 0, 0))) });
    }
    YS.urn = newMend(bro);
  }
  function buildYard() {
    const K = spotKit('freecast-yard');
    const { S, B, P } = K;
    // --- the stone bench ---
    const [bx, bz] = YL.bench, by = gy(bx, bz);
    for (const dx of [-0.56, 0.56]) {
      S(paint(place(new BoxGeometry(0.18, 0.4, 0.44), bx + dx, by + 0.2, bz), STONE, STONE2));
      S(paint(place(new BoxGeometry(0.24, 0.06, 0.5), bx + dx, by + 0.03, bz), 0x5a5246, STONE));
    }
    S(paint(place(new BoxGeometry(1.5, 0.09, 0.5), bx, by + SEAT - 0.045, bz), 0x7c7262, 0x988d7a));
    S(paint(place(new BoxGeometry(1.52, 0.025, 0.06), bx, by + SEAT - 0.07, bz + 0.24), 0x645a4e));
    // --- the toy dragon on the seat (body bone; head, lids, plaster, wings ride it) ---
    const [tx, tz] = YL.toy, ty = by + SEAT;
    const at = (g) => g.translate(tx, ty, tz);
    B(YB.toy, tx, ty, tz);
    {
      const p = [];
      p.push(paint(place(new SphereGeometry(0.2, 16, 12), 0, 0.2, 0, 0, 0, 0, 1.05, 1.1, 0.95), MINT, MINT2));
      p.push(paint(place(new SphereGeometry(0.15, 14, 10), 0, 0.19, 0.12, 0, 0, 0, 0.9, 1.05, 0.5), 0xffe8b8, CREAM));
      for (const sx of [-1, 1]) {
        p.push(paint(place(new SphereGeometry(0.075, 10, 8), sx * 0.11, 0.045, 0.14, 0, 0, 0, 1, 0.6, 1.35), 0x4aa878, MINT));
        for (let k = -1; k <= 1; k++) p.push(paint(place(new SphereGeometry(0.018, 6, 4), sx * 0.11 + k * 0.03, 0.03, 0.235), CREAM));
        p.push(paint(place(new SphereGeometry(0.055, 8, 6), sx * 0.18, 0.24, 0.09, 0, 0, sx * 0.5, 0.8, 1.3, 0.8), MINT, MINT2));
      }
      p.push(paint(rod([0, 0.08, -0.16], [0.17, 0.04, -0.32], 0.07, 0.045, 8), MINT, MINT2));
      p.push(paint(rod([0.17, 0.04, -0.32], [0.3, 0.1, -0.38], 0.045, 0.025, 7), MINT, MINT2));
      p.push(paint(place(new ConeGeometry(0.06, 0.13, 4), 0.33, 0.14, -0.39, 0, 0.5, -0.5, 1, 1, 0.4), LAV, LAV2));
      for (const [y, z] of [[0.38, -0.12], [0.28, -0.19], [0.16, -0.21]]) p.push(paint(place(new ConeGeometry(0.035, 0.085, 6), 0, y, z, -0.9, 0, 0), 0xffc84a, 0xffe89a));
      P(at(M(p)), YB.toy);
    }
    B(YB.head, tx, ty + 0.36, tz + 0.02, YB.toy);
    {
      const p = [];
      p.push(paint(place(new SphereGeometry(0.16, 16, 12), 0, 0.52, 0.03, 0, 0, 0, 1.1, 0.95, 1.0), MINT, MINT2));
      p.push(paint(place(new SphereGeometry(0.1, 14, 10), 0, 0.47, 0.16, 0, 0, 0, 1.15, 0.78, 0.95), 0x8ad8b0, 0xb0f0d0));
      for (const sx of [-1, 1]) {
        p.push(paint(place(new SphereGeometry(0.012, 6, 4), sx * 0.035, 0.5, 0.25), 0x2a6a48));
        p.push(paint(place(new SphereGeometry(0.035, 8, 6), sx * 0.115, 0.465, 0.13, 0, 0, 0, 1, 0.6, 0.4), 0xff9ab0));
        p.push(paint(place(new SphereGeometry(0.042, 10, 8), sx * 0.07, 0.57, 0.15), 0xffffff, 0xf0f4ff));
        p.push(paint(place(new SphereGeometry(0.028, 8, 6), sx * 0.072, 0.565, 0.178), 0x1a1420));
        p.push(paint(place(new SphereGeometry(0.009, 5, 4), sx * 0.062, 0.582, 0.205), 0xffffff));
        p.push(paint(place(new ConeGeometry(0.03, 0.1, 8), sx * 0.07, 0.665, -0.01, -0.5, 0, -sx * 0.3), 0xffe8b0, CREAM));
        p.push(paint(place(new ConeGeometry(0.045, 0.1, 4), sx * 0.155, 0.58, -0.02, 0, 0, -sx * 1.1, 1, 1, 0.35), LAV, LAV2));
      }
      p.push(paint(place(new TorusGeometry(0.03, 0.007, 4, 10, Math.PI), 0, 0.445, 0.245, 0, 0, Math.PI), 0x2a6a48));
      P(at(M(p)), YB.head);
    }
    // sleepy eyelids (scale 1 while poorly, gone once well) and the plaster (pops off)
    B(YB.lids, tx, ty + 0.575, tz + 0.15, YB.head);
    P(at(M([-1, 1].map(sx => paint(place(new SphereGeometry(0.047, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), sx * 0.07, 0.57, 0.152, 0.45, 0, 0), 0x4aa878, MINT))), YB.lids));
    B(YB.plaster, tx + 0.08, ty + 0.64, tz + 0.09, YB.head);
    {
      const p = [];
      for (const r of [0.785, -0.785]) p.push(paint(place(new BoxGeometry(0.17, 0.048, 0.016), 0, 0, 0, 0, 0, r), 0xf4f0ea, 0xffffff));
      p.push(paint(place(new BoxGeometry(0.05, 0.05, 0.02), 0, 0, 0.002, 0, 0, 0.785), 0xffd8e2));
      for (const r of [0.785, -0.785]) for (const s of [-1, 1]) p.push(paint(place(new SphereGeometry(0.004, 4, 3), s * 0.06 * Math.cos(r), s * 0.06 * Math.sin(r), 0.009), 0xd8d0c8));
      P(M(p).applyMatrix4(_m4.compose(v0.set(tx + 0.08, ty + 0.64, tz + 0.09), _q.setFromEuler(_e.set(-1.0, 0.45, 0)), _s.set(1, 1, 1))), YB.plaster);
    }
    // little wings (pivot at the shoulder; the right one mirrored)
    for (const sx of [-1, 1]) {
      const wi = sx < 0 ? YB.wingL : YB.wingR, W = [tx + sx * 0.1, ty + 0.33, tz - 0.13];
      B(wi, ...W, YB.toy);
      const sh = new Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.1, 0.16, 0.24, 0.15); sh.quadraticCurveTo(0.2, 0.1, 0.21, 0.06); sh.quadraticCurveTo(0.16, 0.06, 0.15, 0.01); sh.quadraticCurveTo(0.1, 0.02, 0.08, -0.04); sh.quadraticCurveTo(0.04, -0.01, 0, 0);
      const g = paint(new ShapeGeometry(sh, 6), LAV, LAV2, 'x');
      g.scale(sx, 1, 1); g.rotateY(sx * 0.7);
      P(g.translate(...W), wi);
    }
    // --- the lantern post (Incendio / Aguamenti / Lumos Maxima): an open iron cage with a candle ---
    const [lx, lz] = YL.lantern, ly = gy(lx, lz);
    S(paint(place(new BoxGeometry(0.32, 0.12, 0.32), lx, ly + 0.06, lz), STONE, STONE2));
    S(paint(rod([lx, ly + 0.1, lz], [lx, ly + 2.02, lz], 0.05, 0.04, 8), IRON, IRON2));
    for (const y of [0.3, 1.9]) S(paint(place(new TorusGeometry(0.055, 0.015, 5, 10), lx, ly + y, lz, Math.PI / 2), GOLD));
    S(paint(place(new BoxGeometry(0.26, 0.03, 0.26), lx, ly + 2.03, lz), IRON, IRON2));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) S(paint(rod([lx + sx * 0.11, ly + 2.04, lz + sz * 0.11], [lx + sx * 0.12, ly + 2.38, lz + sz * 0.12], 0.012, 0.012, 4), IRON, IRON2));
    S(paint(place(new BoxGeometry(0.28, 0.03, 0.28), lx, ly + 2.39, lz), IRON, IRON2));
    S(paint(place(new ConeGeometry(0.22, 0.2, 4), lx, ly + 2.5, lz, 0, Math.PI / 4, 0), IRON, IRON2));
    S(paint(place(new SphereGeometry(0.04, 8, 6), lx, ly + 2.62, lz), GOLD, GOLD2));
    S(paint(place(new CylinderGeometry(0.035, 0.038, 0.14, 8), lx, ly + 2.12, lz), 0xf3e6c0, 0xfff8e4));
    // --- the birdbath (Aguamenti fills it; the water is a bone that swells up) ---
    const [wx, wz] = YL.bath, wy = gy(wx, wz);
    S(paint(place(new CylinderGeometry(0.3, 0.34, 0.08, 14), wx, wy + 0.04, wz), 0x5a5246, STONE));
    S(paint(place(new LatheGeometry([[0.15, 0.08], [0.11, 0.3], [0.095, 0.5], [0.12, 0.68], [0.17, 0.75]].map(([r, y]) => new Vector2(r, y)), 14), wx, wy, wz), STONE, STONE2));
    S(paint(place(new LatheGeometry([[0.16, 0.73], [0.36, 0.8], [0.5, 0.9], [0.53, 0.94], [0.47, 0.955], [0.39, 0.89], [0.2, 0.855], [0.001, 0.85]].map(([r, y]) => new Vector2(r, y)), 20), wx, wy, wz), 0x6e675a, 0x9a8f7c));
    B(YB.water, wx, wy + 0.85, wz);
    yard.waterRange = P(paint(place(new CylinderGeometry(0.44, 0.36, 0.07, 20), wx, wy + 0.885, wz), 0x2a7ad0, 0x8ad0ff), YB.water);
    // --- the planter: a stone trough, a drooping plant (a bone that flops and stands), flowers that bloom ---
    const [px, pz] = YL.planter, py = gy(px, pz);
    S(paint(place(new BoxGeometry(1.0, 0.4, 0.56), px, py + 0.22, pz), 0x655b4f, 0x83786a));
    S(paint(place(new BoxGeometry(1.06, 0.05, 0.62), px, py + 0.43, pz), 0x7e7466, 0x9a8e7c));
    for (const sx of [-0.4, 0.4]) S(paint(place(new BoxGeometry(0.16, 0.04, 0.5), px + sx, py + 0.02, pz), 0x4e463c));
    S(paint(place(new BoxGeometry(0.92, 0.03, 0.48), px, py + 0.445, pz), 0x3a2414, 0x4a3020));
    B(YB.plantRoot, px, py + 0.45, pz);
    B(YB.sprout, px, py + 0.45, pz, YB.plantRoot);
    {
      const p = [];
      for (const [dx, dz, h, a] of [[0, 0, 0.44, 0], [-0.13, 0.04, 0.32, 0.25], [0.13, -0.03, 0.34, -0.25]]) {
        p.push(paint(rod([dx, 0, dz], [dx + Math.sin(a) * 0.08, h, dz], 0.016, 0.012, 5), 0x2e6a22, 0x4a9a34));
        for (let k = 0; k < 3; k++) { const b = k * 2.1 + a * 4, hh = h * (0.3 + k * 0.22); p.push(paint(place(new SphereGeometry(0.075, 7, 5), dx + Math.cos(b) * 0.07, hh, dz + Math.sin(b) * 0.07, 0, -b, -0.5, 1.1, 0.14, 0.5), 0x3a9a2a, 0x6ac84a)); }
        p.push(paint(place(new SphereGeometry(0.04, 8, 6), dx + Math.sin(a) * 0.08, h + 0.02, dz, 0, 0, 0, 0.9, 1.3, 0.9), 0x6ab83a, 0xff9ab8));
      }
      yard.sproutRange = P(M(p).translate(px, py + 0.45, pz), YB.sprout);
    }
    B(YB.flowers, px, py + 0.45, pz, YB.plantRoot);
    P(bouquetGeo(PAL_YARD).scale(2.6, 1.9, 1.5).translate(px, py + 0.45, pz), YB.flowers);
    // --- the cracked urn on a little stone block (four pieces; whole = the bone rest poses) ---
    const [ux, uz] = YL.urn, uy = gy(ux, uz);
    S(paint(place(new BoxGeometry(0.46, 0.2, 0.46), ux, uy + 0.1, uz), STONE, STONE2));
    S(paint(place(new BoxGeometry(0.5, 0.03, 0.5), ux, uy + 0.2, uz), 0x7e7466, 0x9a8e7c));
    const UC = [ux, uy + 0.55, uz];
    const prof = [[0.001, 0], [0.12, 0], [0.16, 0.08], [0.22, 0.24], [0.2, 0.4], [0.13, 0.5], [0.115, 0.56], [0.18, 0.62], [0.17, 0.66], [0.13, 0.64]].map(([r, y]) => new Vector2(r, y));
    for (let i = 0; i < NURN; i++) {
      B(YB.urn0 + i, ...UC);
      const pp = [paint(new LatheGeometry(prof, 6, i * Math.PI / 2, Math.PI / 2), 0x665848, 0x8c7c68)];
      const mid = i * Math.PI / 2 + Math.PI / 4;
      pp.push(paint(place(new TorusGeometry(0.205, 0.012, 4, 6, Math.PI / 2), 0, 0.32, 0, Math.PI / 2, 0, -i * Math.PI / 2), 0x6a8a5a));   // a mossy band
      if (i % 2 === 0) pp.push(paint(place(new TorusGeometry(0.06, 0.016, 5, 8, Math.PI), Math.sin(mid) * 0.2, 0.5, Math.cos(mid) * 0.2, 0, mid + Math.PI / 2, 0), 0x7a6c5a, 0x9e907c));
      P(M(pp).translate(ux, uy + 0.2, uz), YB.urn0 + i);
    }
    const flames = flameMesh(3, glowTex, 'freecast-yard-flames');
    flames.setColorAt(0, _c.setHex(0xffb040)); flames.setColorAt(1, _c.setHex(0xff8a30)); flames.setColorAt(2, _c.setHex(0x6a3a10));
    const k = K.finish(yardRoot, [flames]);
    yard.kit = k; yard.flames = flames; yard.flameY = ly + 2.24; yard.lanternGY = ly;
    k.bones[YB.flowers].scale.setScalar(0.001);
    k.bones[YB.water].scale.setScalar(0.001);
    for (let i = 0; i < NURN; i++) { const b = k.bones[YB.urn0 + i]; b.position.copy(YS.urn.broken[i].p); b.quaternion.copy(YS.urn.broken[i].q); }
    // the sprout's own vertex colours (fresh) for the droop tint
    const ca = k.skin.geometry.attributes.color, [a0, a1] = yard.sproutRange;
    yard.sproutOrig = ca.array.slice(a0 * 3, a1 * 3);
    yard.waterOrig = ca.array.slice(yard.waterRange[0] * 3, yard.waterRange[1] * 3);
    // solid bits (world circles)
    for (const [key, r] of [['bench', 0.8], ['bath', 0.42], ['lantern', 0.2], ['planter', 0.62], ['urn', 0.32]]) { yW(YL[key][0], 0, YL[key][1], v0); player.colliders.push({ type: 'circle', x: v0.x, z: v0.z, r, freecast: true }); }
    scene.add(yardRoot);
  }
  buildYard();
  function tintSprout(k) {   // 0 fresh green .. 1 tired olive
    if (Math.abs(k - yard.tintK) < 0.03 && k !== 0 && k !== 1) return;
    if (k === yard.tintK) return;
    yard.tintK = k; const ca = yard.kit.skin.geometry.attributes.color, A = ca.array, o = yard.sproutOrig, a0 = yard.sproutRange[0] * 3;
    for (let i = 0; i < o.length; i += 3) { const l = o[i] * 0.3 + o[i + 1] * 0.59 + o[i + 2] * 0.11; A[a0 + i] = o[i] + (l * 0.9 + 0.12 - o[i]) * k; A[a0 + i + 1] = o[i + 1] + (l * 0.85 + 0.06 - o[i + 1]) * k; A[a0 + i + 2] = o[i + 2] + (l * 0.3 - o[i + 2]) * k; }
    ca.needsUpdate = true;
  }
  const yardOn = () => yardRoot.visible;
  const yBone = (i, o) => yard.kit.bones[i].getWorldPosition(o);
  const yFront = (lx, lz) => { v1.set(lx, 0, lz).normalize().applyAxisAngle(v2.set(0, 1, 0), YARD.yaw); return [v1.x, v1.z]; };
  const yTarget = (t) => { t.grp = yardRoot; targets.push(t); return t; };
  const L = (key, y, o) => yW(YL[key][0], gy(YL[key][0], YL[key][1]) + y, YL[key][1], o);
  yTarget({ id: 'yard-toy', spells: ['episkey'], front: yFront(0, 1), selfHearts: true, at: (o) => L('toy', SEAT + 0.55, o), ok: () => YS.toy.state === 'poorly', cast: () => { const s = YS.toy; s.state = 'healing'; s.t = -0.4; } });
  // batch 5: Glacius freezes a full birdbath (white-blue ice); Incendio melts it back to water
  const bathOk = (k) => { const b = YS.bath; if (b.pend || b.freezePend || b.meltPend) return false; return k === 'glacius' ? b.full && !b.frozen : k === 'incendio' ? b.frozen : !b.full; };
  yTarget({ id: 'yard-birdbath', spells: ['aguamenti', 'glacius', 'incendio'], front: yFront(0, 1), at: (o) => L('bath', 0.95, o), ok: bathOk,
    cast: (k) => { if (k === 'glacius') YS.bath.freezePend = 0.6; else if (k === 'incendio') YS.bath.meltPend = 0.5; else YS.bath.pend = 1.0; } });
  yTarget({ id: 'yard-lantern', spells: ['incendio', 'aguamenti', 'glacius'], front: yFront(0.3, 1), at: (o) => L('lantern', 2.2, o), ok: (k) => fireOk(YS.fire, k), cast: (k) => fireCast(YS.fire, k) });
  const PLs = YS.plant;
  yTarget({ id: 'yard-planter', spells: ['episkey', 'aguamenti', 'orchideous', 'engorgio', 'reducio'], front: yFront(0, 1), selfHearts: true, at: (o) => L('planter', 0.75, o),
    ok: (k) => !PLs.pend && PLs.sc.t >= 1 && (k === 'episkey' ? PLs.wiltTo > 0.5 : k === 'aguamenti' ? PLs.wiltTo > 0.5 || (PLs.bloomed && PLs.growTo < 1.3) : k === 'orchideous' ? !PLs.bloomed : k === 'engorgio' ? PLs.sc.level < 1 : PLs.sc.level > -1),
    cast: (k) => { if (k === 'engorgio' || k === 'reducio') stepScal(PLs.sc, k === 'engorgio' ? 1 : -1); else { PLs.pend = k === 'aguamenti' ? 0.9 : k === 'orchideous' ? 0.75 : 0.6; PLs.pendK = k; } } });
  yTarget({ id: 'yard-urn', spells: ['reparo'], front: yFront(0.5, 1), at: (o) => L('urn', 0.45, o), ok: () => YS.urn.state === 'broken', cast: () => mendCast(YS.urn) });

  // ---- the toy dragon: poorly (droopy, sleepy eyes, plaster) -> healed (plaster pops, perks up, two hops) -> happy -> tired again ----
  const TOYP = { poorly: { bx: 0.14, bz: -0.1, hx: 0.5, hz: 0.16, w: -0.75 }, well: { bx: 0, bz: 0, hx: -0.1, hz: 0, w: 0.3 } };
  function tickToy(dt) {
    const s = YS.toy, k = yard.kit, B = k.bones, R = k.rest;
    if (s.state !== 'poorly') s.t += dt;
    const t = s.t;
    let perk = 0, hop = 0, plasterK = 1, lids = 1, flap = 0, squash = 1;
    if (s.state === 'poorly') { perk = 0; }
    else if (s.state === 'healing') {
      if (t >= 0) {
        if (!s.popped) { s.popped = true; yBone(YB.plaster, v0); burst(v0.x, v0.y, v0.z, 0xffffff, 14, 1.6, 0.6, 0.16, -1); burst(v0.x, v0.y, v0.z, 0xffb0d8, 10, 1.2, 0.6, 0.18, -0.5); fun.sfx.pop(); fun.sfx.sparkle(); }
        plasterK = 1 - Math.min(1, t / 0.6);
        perk = ease((t - 0.2) / 0.7); lids = 1 - ease((t - 0.25) / 0.35);
        for (const [h0, n] of [[1.0, 1], [1.6, 2]]) {
          const u = (t - h0) / 0.45;
          if (u > -0.18 && u < 0) squash = 1 - 0.12 * Math.sin((u + 0.18) / 0.18 * Math.PI);
          if (u >= 0 && u < 1) { hop = Math.sin(u * Math.PI) * 0.2; if (s.hopN < n) { s.hopN = n; s.hops++; yBone(YB.head, v0); hearts(v0.x, v0.y + 0.3, v0.z, 7, 0.3, 0.9); fun.sfx.boing(); if (n === 1) fun.sfx.giggle(true); } }
        }
        flap = t > 0.8 ? Math.sin(t * 18) * 0.5 : 0;
        if (t >= 2.4) { s.state = 'happy'; s.t = 0; s.heals++; fun.sfx.tune([659, 784, 988, 1319], 0.11, 'triangle'); }
      }
    } else if (s.state === 'happy') {
      perk = 1; plasterK = 0; lids = 0;
      hop = Math.max(0, Math.sin(t * 2.2)) * 0.015; flap = Math.max(0, Math.sin(t * 1.3)) ** 6 * Math.sin(t * 20) * 0.5;
      if (t > 40) { s.state = 'tired'; s.t = 0; }
    } else if (s.state === 'tired') {
      perk = 1 - ease(t / 1.5); plasterK = backOut(Math.max(0, (t - 0.8) / 0.5)); lids = ease((t - 0.6) / 0.8);
      if (t > 0.8 && !s.puffed) { s.puffed = true; yBone(YB.plaster, v0); burst(v0.x, v0.y, v0.z, 0xffffff, 10, 0.8, 0.6, 0.14, 0); fun.sfx.soft(); }
      if (t >= 1.6) { s.state = 'poorly'; s.t = 0; s.popped = s.puffed = false; s.hopN = 0; }
    }
    s.k = perk;
    const P0 = TOYP.poorly, P1 = TOYP.well, lerp = (a, b) => a + (b - a) * perk;
    const breathe = Math.sin(T * (perk > 0.5 ? 2.4 : 1.2)) * (perk > 0.5 ? 0.02 : 0.035);
    B[YB.toy].position.copy(R[YB.toy].p); B[YB.toy].position.y += hop;
    B[YB.toy].quaternion.setFromEuler(_e.set(lerp(P0.bx, P1.bx), 0, lerp(P0.bz, P1.bz)));
    B[YB.toy].scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    B[YB.head].quaternion.setFromEuler(_e.set(lerp(P0.hx, P1.hx) + breathe, Math.sin(T * 0.9) * 0.12 * perk, lerp(P0.hz, P1.hz)));
    for (const [wi, sx] of [[YB.wingL, -1], [YB.wingR, 1]]) B[wi].quaternion.setFromEuler(_e.set(0, 0, sx * (lerp(P0.w, P1.w) + flap)));
    B[YB.lids].scale.set(1, Math.max(0.001, lids), 1);
    const pb = B[YB.plaster], pr = R[YB.plaster];
    pb.position.copy(pr.p);
    if (s.state === 'healing' && t >= 0) { const u = Math.min(1, t / 0.6); pb.position.y += Math.sin(u * Math.PI * 0.7) * 0.35; pb.position.z += u * 0.15; pb.quaternion.setFromEuler(_e.set(u * 5, u * 3, 0)); }
    else pb.quaternion.copy(pr.q);
    pb.scale.setScalar(Math.max(0.001, plasterK));
  }
  // ---- the birdbath ----
  function tickBath(dt) {
    const b = YS.bath;
    if (b.pend > 0) { b.pend -= dt; if (b.pend <= 0) { b.pend = 0; b.full = true; b.fills++; b.since = T; L('bath', 0.95, v0); burst(v0.x, v0.y, v0.z, 0x9ad8ff, 18, 1.6, 0.7, 0.18, -4); fun.sfx.sparkle(); } }
    if (b.freezePend > 0) { b.freezePend -= dt; if (b.freezePend <= 0) { b.freezePend = 0; b.frozen = true; b.freezes++; b.since = T; L('bath', 0.95, v0); burst(v0.x, v0.y, v0.z, 0xe8f6ff, 22, 1.4, 0.8, 0.22, -0.5); burst(v0.x, v0.y, v0.z, 0x8ad0ff, 10, 0.8, 1.0, 0.3, 0); fun.sfx.tink(2); fun.sfx.tink(5); fun.sfx.sparkle(); } }
    if (b.meltPend > 0) { b.meltPend -= dt; if (b.meltPend <= 0) { b.meltPend = 0; b.frozen = false; b.melts++; b.since = T; L('bath', 0.95, v0); for (let n = 0; n < 12; n++) emit(v0.x + (Math.random() - 0.5) * 0.6, v0.y, v0.z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2, 1.3, 0.36, 0xc8d0d8, 0.1, 0.5); fun.sfx.noise(0.6, 0.1, 0, 2500, 0.8, 'highpass'); } }
    if (b.frozen && T - b.since > 45) { b.frozen = false; b.since = T; }   // it thaws by itself after a while (water again)
    if (b.full && !b.frozen && T - b.since > 60) b.full = false;   // it dries up after a while (so it can be filled again)
    b.iceK += ((b.frozen ? 1 : 0) - b.iceK) * Math.min(1, dt * (b.frozen ? 5 : 1.5)); if (Math.abs(b.iceK - (b.frozen ? 1 : 0)) < 0.02) b.iceK = b.frozen ? 1 : 0;
    tintWater(b.iceK);
    b.k += ((b.full ? 1 : 0) - b.k) * Math.min(1, dt * (b.full ? 3 : 0.4));
    const w = yard.kit.bones[YB.water];
    if (b.k < 0.01) w.scale.setScalar(0.001);
    else { const ripple = 1 + Math.sin(T * 3) * 0.01 * (1 - b.iceK); w.scale.set(Math.max(0.3, b.k) * ripple, b.k * (1 + 0.5 * b.iceK), Math.max(0.3, b.k) * ripple); }
  }
  function tintWater(k) {   // 0 blue water .. 1 white-blue ice
    if (k === yard.waterK) return; yard.waterK = k;
    const ca = yard.kit.skin.geometry.attributes.color, A = ca.array, o = yard.waterOrig, a0 = yard.waterRange[0] * 3;
    for (let i = 0; i < o.length; i += 3) { const hi = (i / 3) % 2 ? 0.1 : 0; A[a0 + i] = o[i] + (0.72 + hi - o[i]) * k; A[a0 + i + 1] = o[i + 1] + (0.84 + hi - o[i + 1]) * k; A[a0 + i + 2] = o[i + 2] + (0.92 - o[i + 2]) * k; }
    ca.needsUpdate = true;
  }
  // ---- the lantern ----
  function tickLantern(dt) {
    const [lx, lz] = YL.lantern;
    yW(lx, yard.flameY, lz, v1);
    tickFireState(YS.fire, dt, [v1]);
    const F = yard.flames, f = YS.fire;
    if (f.k > 0.01) {
      F.visible = true; const fl = 1 + Math.sin(T * 17) * 0.08 + Math.sin(T * 29) * 0.05, kk = f.k, y = yard.flameY;
      F.setMatrixAt(0, _m4.compose(v0.set(lx, y + 0.04 * fl, lz), _q.copy(camera.quaternion).premultiply(qa.copy(yardRoot.quaternion).invert()), _s.set(0.12 * kk, 0.22 * kk * fl, 1)));
      F.setMatrixAt(1, _m4.compose(v0.set(lx, y, lz), _q, _s.set(1.3 * kk * fl, 1.3 * kk * fl, 1)));
      F.setMatrixAt(2, _m4.compose(v0.set(lx, yard.lanternGY + 0.04, lz), _q.setFromEuler(_e.set(-Math.PI / 2, 0, 0)), _s.set(3.2 * kk, 3.2 * kk, 1)));
      F.instanceMatrix.needsUpdate = true;
      if (f.lit && Math.random() < dt * 4) emit(v1.x, v1.y + 0.1, v1.z, (Math.random() - 0.5) * 0.1, 0.5, (Math.random() - 0.5) * 0.1, 0.7, 0.06, 0xffa040, 0.2);
    } else if (F.visible) F.visible = false;
  }
  // ---- the planter ----
  function tickPlant(dt) {
    const p = PLs, B = yard.kit.bones;
    if (p.pend > 0) {
      p.pend -= dt;
      if (p.pend <= 0) {
        p.pend = 0; L('planter', 0.8, v0);
        if (p.pendK === 'orchideous') { p.bloomed = true; p.blooms++; for (const cc of [0xff6a9a, 0xffe27a, 0xffffff]) burst(v0.x, v0.y, v0.z, cc, 12, 1.8, 0.8, 0.2, -1); fun.sfx.sparkle(); fun.sfx.giggle(true); }
        else {
          if (p.pendK === 'episkey' || p.wiltTo > 0.5) { if (p.wiltTo > 0.5) p.heals++; p.wiltTo = 0; hearts(v0.x, v0.y, v0.z, 8, 0.4, 0.8); fun.sfx.giggle(true); }
          if (p.pendK === 'aguamenti') { if (p.bloomed) p.growTo = 1.4; p.waters++; burst(v0.x, v0.y, v0.z, 0x9aff7a, 16, 1.6, 0.9, 0.22, -0.5); fun.sfx.sparkle(); }
          if (p.pendK === 'episkey') fun.sfx.chime();
        }
        p.last = T;
      }
    }
    if (T - p.last > 45) p.wiltTo = 1;
    p.wilt += (p.wiltTo - p.wilt) * Math.min(1, dt * (p.wiltTo > p.wilt ? 0.5 : 3.5));
    tickScal(p.sc, dt);
    const w = p.wilt, sb = B[YB.sprout];
    sb.quaternion.setFromEuler(_e.set(0.35 * w, 0, 0.95 * w + Math.sin(T * 1.7) * 0.03 * (1 - w)));
    sb.scale.set(1, 1 - 0.25 * w, 1);
    tintSprout(Math.round(w * 50) / 50);
    B[YB.plantRoot].scale.setScalar(p.sc.f);
    p.bk = p.bloomed ? Math.min(1, p.bk + dt / 0.7) : 0;
    p.grow += (p.growTo - p.grow) * Math.min(1, dt * 2.5);
    const fb = B[YB.flowers];
    if (p.bloomed) { const s = backOut(p.bk); fb.scale.set(s, s * p.grow, s); } else fb.scale.setScalar(0.001);
  }

  // ======================= the Great Hall spot =======================
  const GB = { pudding: 0, platter: 1, goblet: 2, plate0: 3 };
  const NPL = 4;
  const GS = {
    pudding: newScal([0.5, 1, 2.4]), wob: 0, platter: newMover(), goblet: newMover(), fire: newFire(),
    plate: null,   // (batch 7: the hall's floating candles moved to freecast-real.js)
  };
  const TOP = 0.86, TX = 8.95;
  {
    const bro = [];
    for (let i = 0; i < NPL; i++) {
      const a = i * 1.57 + 0.4;
      // lying flat: undo the stand's lean (z +1.25), then a random turn on the cloth
      bro.push({ p: new Vector3(TX + Math.cos(a) * 0.12 - 0.05, TOP + 0.014, GHI.plate + Math.sin(a) * 0.16), q: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), a * 1.3 + 0.5).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -1.25)) });
    }
    GS.plate = newMend(bro);
  }
  let gh = null;
  function buildGH(room) {
    const K = spotKit('freecast-gh');
    const { S, B, P } = K;
    // the side table (oak, a crimson cloth along it) against the east wall
    const { x: gx, z: gz } = GH.table, L2 = 1.3;
    S(paint(place(new BoxGeometry(0.8, 0.06, L2 * 2), gx, TOP - 0.03, gz), WOOD, 0x7a5232));
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) S(paint(place(new BoxGeometry(0.07, TOP - 0.06, 0.07), gx + sx * 0.33, (TOP - 0.06) / 2, gz + sz * (L2 - 0.08)), DARK, WOOD));
    S(paint(place(new BoxGeometry(0.06, 0.06, L2 * 2 - 0.2), gx, 0.16, gz), DARK));
    S(paint(place(new BoxGeometry(0.5, 0.012, L2 * 2 + 0.02), gx - 0.05, TOP + 0.006, gz), 0x8a1420, 0xa82030));
    S(paint(place(new BoxGeometry(0.012, 0.3, L2 * 2 + 0.02), gx - 0.405, TOP - 0.14, gz), 0x6a0e18, 0x8a1420));
    S(paint(place(new BoxGeometry(0.014, 0.03, L2 * 2 + 0.03), gx - 0.405, TOP - 0.29, gz), GOLD, GOLD2));
    // the pudding stand (static) and the wobbly pudding (bone at the stand's plate)
    const PZ = GHI.pudding;
    S(paint(place(new CylinderGeometry(0.1, 0.13, 0.03, 14), TX, TOP + 0.015, PZ), GOLD, GOLD2));
    S(paint(rod([TX, TOP + 0.03, PZ], [TX, TOP + 0.12, PZ], 0.025, 0.02, 8), GOLD, GOLD2));
    S(paint(place(new CylinderGeometry(0.22, 0.2, 0.025, 18), TX, TOP + 0.13, PZ), GOLD2, 0xfff0b0));
    B(GB.pudding, TX, TOP + 0.143, PZ);
    {
      const p = [];
      p.push(paint(new LatheGeometry([[0.001, 0], [0.17, 0], [0.18, 0.05], [0.155, 0.09], [0.165, 0.13], [0.135, 0.18], [0.145, 0.21], [0.09, 0.26], [0.001, 0.275]].map(([r, y]) => new Vector2(r, y)), 18), 0xe85a8a, 0xffa8c8));
      p.push(paint(place(new SphereGeometry(0.105, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.2), 0, 0.225, 0, 0, 0, 0, 1, 0.55, 1), 0xfff4e8, 0xffffff));
      for (let k = 0; k < 7; k++) { const a = k * 0.9; p.push(paint(place(new SphereGeometry(0.03, 7, 5), Math.cos(a) * 0.095, 0.22 - (k % 3) * 0.03, Math.sin(a) * 0.095, 0, 0, 0, 0.8, 1.4, 0.8), 0xfff4e8)); }
      p.push(paint(place(new SphereGeometry(0.035, 10, 8), 0, 0.3, 0), 0xd81a2a, 0xff4a4a));
      p.push(paint(rod([0, 0.33, 0], [0.025, 0.38, -0.01], 0.004, 0.003, 4), 0x3a6a2a));
      p.push(paint(place(new SphereGeometry(0.03, 6, 4), 0.035, 0.37, -0.01, 0, 0, 0.6, 1, 0.25, 0.55), 0x3a9a2a));
      P(M(p).translate(TX, TOP + 0.143, PZ), GB.pudding);
    }
    // the fruit platter (Leviosa / Accio)
    const FZ = GHI.platter;
    B(GB.platter, TX, TOP + 0.02, FZ);
    {
      const p = [paint(place(new CylinderGeometry(0.22, 0.17, 0.03, 20), 0, 0, 0, 0, 0, 0, 1, 1, 0.8), GOLD, GOLD2), paint(place(new TorusGeometry(0.215, 0.012, 5, 20), 0, 0.016, 0, Math.PI / 2, 0, 0, 1, 0.8, 1), GOLD2)];
      for (const [x, z, c] of [[-0.07, -0.04, 0xd8202a], [0.07, -0.05, 0x7ac83a], [0, 0.07, 0xe0302a], [0.1, 0.06, 0xf2c230]]) {
        p.push(paint(place(new SphereGeometry(0.055, 10, 8), x, 0.065, z), c, c));
        p.push(paint(rod([x, 0.11, z], [x + 0.01, 0.14, z], 0.005, 0.004, 4), 0x5a3a1a));
      }
      for (let k = 0; k < 9; k++) p.push(paint(place(new SphereGeometry(0.022, 6, 5), -0.1 + (k % 3) * 0.035, 0.04 + Math.floor(k / 3) * 0.03, 0.08 + (k % 2) * 0.01), 0x7a3aa8, 0xa86ad8));
      P(M(p).translate(TX, TOP + 0.02, FZ), GB.platter);
    }
    // the goblet (Leviosa / Accio)
    const GZ = GHI.goblet;
    B(GB.goblet, TX, TOP, GZ);
    {
      const p = [paint(new LatheGeometry([[0.001, 0], [0.06, 0], [0.065, 0.012], [0.015, 0.03], [0.012, 0.11], [0.03, 0.13], [0.065, 0.2], [0.07, 0.25], [0.062, 0.25], [0.055, 0.2], [0.001, 0.15]].map(([r, y]) => new Vector2(r, y)), 14), GOLD, GOLD2)];
      p.push(paint(place(new CylinderGeometry(0.058, 0.04, 0.01, 12), 0, 0.225, 0), 0x8a1020, 0xc02030));
      for (let k = 0; k < 3; k++) { const a = k * 2.1; p.push(paint(place(new SphereGeometry(0.012, 6, 4), Math.cos(a) * 0.066, 0.2, Math.sin(a) * 0.066), [0xe8204a, 0x2a8ae8, 0x2ac86a][k])); }
      P(M(p).translate(TX, TOP, GZ), GB.goblet);
    }
    // the cracked plate: whole it stands on a little gold stand facing the hall; broken, four wedges on the cloth
    const LZ = GHI.plate;
    S(paint(place(new BoxGeometry(0.1, 0.02, 0.14), TX + 0.05, TOP + 0.01, LZ), GOLD, GOLD2));
    S(paint(rod([TX + 0.06, TOP + 0.02, LZ], [TX + 0.03, TOP + 0.15, LZ], 0.008, 0.006, 4), GOLD, GOLD2));
    const PC = [TX, TOP + 0.17, LZ];
    for (let i = 0; i < NPL; i++) {
      B(GB.plate0 + i, ...PC);
      const pp = [paint(new CylinderGeometry(0.16, 0.13, 0.016, 5, 1, false, i * Math.PI / 2, Math.PI / 2), 0xf4f0ff, 0xffffff)];
      pp.push(paint(place(new TorusGeometry(0.14, 0.008, 4, 5, Math.PI / 2), 0, 0.009, 0, Math.PI / 2, 0, -i * Math.PI / 2 + Math.PI / 2), 0x2a5ad0));
      const mid = i * Math.PI / 2 + Math.PI / 4;
      pp.push(paint(place(new SphereGeometry(0.018, 6, 4), Math.sin(mid) * 0.08, 0.01, Math.cos(mid) * 0.08, 0, 0, 0, 1, 0.3, 1), [0xff5a8a, 0xffd040, 0x5ab8ff, 0x7ad050][i]));
      // stood up: the plate's face turns to -x (the hall); built flat then turned on the stand
      P(M(pp).applyMatrix4(_m4.compose(v0.set(...PC), _q.setFromEuler(_e.set(0, 0, 1.25)), _s.set(1, 1, 1))), GB.plate0 + i);
    }
    // the tall candle stand
    const { x: sx0, z: sz0 } = GH.stand;
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.5; S(paint(rod([sx0 + Math.cos(a) * 0.28, 0.02, sz0 + Math.sin(a) * 0.28], [sx0, 0.22, sz0], 0.03, 0.025, 6), IRON, IRON2)); S(paint(place(new SphereGeometry(0.045, 8, 6), sx0 + Math.cos(a) * 0.28, 0.03, sz0 + Math.sin(a) * 0.28), GOLD, GOLD2)); }
    S(paint(rod([sx0, 0.2, sz0], [sx0, 1.78, sz0], 0.04, 0.03, 8), IRON, IRON2));
    for (const y of [0.25, 0.95, 1.6]) S(paint(place(new TorusGeometry(0.045, 0.014, 5, 10), sx0, y, sz0, Math.PI / 2), GOLD, GOLD2));
    S(paint(place(new CylinderGeometry(0.22, 0.08, 0.06, 14), sx0, 1.8, sz0), GOLD, GOLD2));
    const SC = [[0, 0], [0, -0.14], [0, 0.14]].map(([dx, dz], i) => ({ x: sx0 + dx, z: sz0 + dz, y: 1.83 + (i ? 0.2 : 0.26) }));
    for (const c of SC) { S(paint(place(new CylinderGeometry(0.03, 0.032, c.y - 1.83, 8), c.x, (c.y + 1.83) / 2, c.z), 0xf3e6c0, 0xfff8e4)); S(paint(place(new CylinderGeometry(0.003, 0.003, 0.03, 4), c.x, c.y + 0.01, c.z), 0x1a1a1a)); }
    const flames = flameMesh(6, glowTex, 'freecast-gh-flames');
    for (let i = 0; i < 6; i++) flames.setColorAt(i, _c.setHex(i < 3 ? 0xffb040 : 0xff8a30));
    const k = K.finish(room.group, [flames]);
    for (const [x, z, r] of [[gx, gz - 0.7, 0.55], [gx, gz + 0.7, 0.55], [sx0, sz0, 0.32]]) room.colliders.push({ type: 'circle', x, z, r, freecast: true });
    const g = Object.assign(k, { room, flames, SC, origin: room.group.position.clone() });
    for (let i = 0; i < NPL; i++) { const b = g.bones[GB.plate0 + i], br = GS.plate.broken[i]; b.position.copy(br.p); b.quaternion.copy(br.q); }
    return g;
  }
  const ghLive = () => !!gh && interiors.room === gh.room && interiors.active === 'greathall';
  const GO = () => (gh ? gh.origin : v0.set(0, -200, 0));
  const gW = (x, y, z, o) => o.set(x, y, z).add(GO());
  const gTarget = (t) => { t.indoor = 'greathall'; targets.push(t); return t; };
  gTarget({ id: 'gh-stand', spells: ['incendio', 'aguamenti'], front: [-1, 0], at: (o) => gW(GH.stand.x, 1.95, GH.stand.z, o), ok: (k) => ghLive() && fireOk(GS.fire, k), cast: (k) => fireCast(GS.fire, k) });
  gTarget({ id: 'gh-pudding', spells: ['engorgio', 'reducio'], front: [-1, 0], at: (o) => gW(TX, TOP + 0.14 + 0.14 * GS.pudding.f, GHI.pudding, o),
    ok: (k) => ghLive() && GS.pudding.t >= 1 && (k === 'engorgio' ? GS.pudding.level < 1 : GS.pudding.level > -1), cast: (k) => { stepScal(GS.pudding, k === 'engorgio' ? 1 : -1); GS.wob = 1; } });
  gTarget({ id: 'gh-platter', spells: ['leviosa', 'accio'], front: [-1, 0], at: (o) => (gh ? o.copy(gh.bones[GB.platter].position).add(gh.origin) : gW(TX, TOP + 0.05, GHI.platter, o)), ok: () => ghLive() && !GS.platter.mode, cast: (k) => startMover(GS.platter, k) });
  gTarget({ id: 'gh-goblet', spells: ['leviosa', 'accio'], front: [-1, 0], at: (o) => { if (gh) o.copy(gh.bones[GB.goblet].position).add(gh.origin); else gW(TX, TOP, GHI.goblet, o); o.y += 0.12; return o; }, ok: () => ghLive() && !GS.goblet.mode, cast: (k) => startMover(GS.goblet, k) });
  gTarget({ id: 'gh-plate', spells: ['reparo'], front: [-1, 0], at: (o) => gW(TX, TOP + 0.08, GHI.plate, o), ok: () => ghLive() && GS.plate.state === 'broken', cast: () => mendCast(GS.plate) });
  // (batch 7: the floating candles as a target, Nox on them and their baked halos live in freecast-real.js)

  function tickGH(dt) {
    if (!ghLive()) return;
    const B = gh.bones, R = gh.rest;
    // candle stand
    const spotsW = gh.SC.map((c, i) => gW(c.x, c.y, c.z, [v0, v1, v2][i]));
    tickFireState(GS.fire, dt, spotsW);
    const F = gh.flames, f = GS.fire;
    if (f.k > 0.01) {
      F.visible = true;
      gh.SC.forEach((c, i) => {
        const fl = 1 + Math.sin(T * 17 + i * 2.1) * 0.08 + Math.sin(T * 29 + i) * 0.05;
        F.setMatrixAt(i, _m4.compose(tv.set(c.x, c.y + 0.04 * fl, c.z), camera.quaternion, _s.set(0.11 * f.k, 0.21 * f.k * fl, 1)));
        F.setMatrixAt(3 + i, _m4.compose(tv.set(c.x, c.y, c.z), camera.quaternion, _s.set(0.9 * f.k * fl, 0.9 * f.k * fl, 1)));
      });
      F.instanceMatrix.needsUpdate = true;
    } else if (F.visible) F.visible = false;
    // pudding: bouncy size steps + a jelly wobble (squash and stretch) after each change and now and then
    tickScal(GS.pudding, dt);
    GS.wob = Math.max(0, GS.wob - dt * 0.6); if (Math.random() < dt * 0.08) GS.wob = Math.max(GS.wob, 0.35);
    const wob = Math.sin(T * 14) * 0.09 * GS.wob, fs = GS.pudding.f;
    B[GB.pudding].scale.set(fs * (1 - wob * 0.5), fs * (1 + wob), fs * (1 - wob * 0.5));
    // platter + goblet
    for (const [bi, m] of [[GB.platter, GS.platter], [GB.goblet, GS.goblet]]) {
      const bb = B[bi], br = R[bi];
      if (tickMover(m, dt, _rw.copy(br.p).add(gh.origin), 0xd8c8ff) || m.was) { m.was = !!m.mode; bb.position.copy(br.p).add(m.off); bb.quaternion.setFromEuler(_e.set(m.tilt, m.ang, m.tilt * 0.6)); }
    }
    // plate
    tickMend(GS.plate, gh, GB.plate0, dt, (p, o) => o.copy(p).add(gh.origin), v2.set(TX, TOP + 0.3, GHI.plate));
  }

  // ======================= Episkey =======================
  const pendH = [];   // hearts that wait for the sparks to land: { x, y, z, t }
  SP.episkey = {
    noFallback: true, casts: 0, anywhere: 0, hits: 0,
    cast() {
      this.casts++;
      const t = best('episkey');
      if (t) {
        t.at(tv); stream(tv, col('episkey'), 0.5); t.cast('episkey'); this.lastId = t.id; this.hits++;
        if (!t.selfHearts) pendH.push({ x: tv.x, y: tv.y, z: tv.z, t: 0.45 });
        fun.sfx.tune([784, 988, 1175], 0.1, 'sine');
        return true;
      }
      // anywhere: a soft pink-gold shimmer and a ring of little hearts rising round Harry
      this.anywhere++; this.lastId = null;
      hearts(pos.x, pos.y + 1.0 * player.model.scale.y, pos.z, 12, 0.85, 0.75);
      for (let i = 0; i < 26; i++) { const a = Math.random() * 6.283, r = 0.4 + Math.random() * 0.6; emit(pos.x + Math.cos(a) * r, pos.y + 0.2 + Math.random() * 1.4, pos.z + Math.sin(a) * r, 0, 0.35 + Math.random() * 0.4, 0, 1.2 + Math.random() * 0.6, 0.16 + Math.random() * 0.1, i % 3 ? 0xffa8d0 : 0xffe08a, 0, 0.4); }
      fun.sfx.chime(); fun.sfx.tune([659, 784, 988, 1319], 0.12, 'sine');
      return false;
    },
    state: () => ({ casts: SP.episkey.casts, anywhere: SP.episkey.anywhere, hits: SP.episkey.hits }),
  };

  // ======================= per-frame + hooks =======================
  let seenRoom = null, ghBuilds = 0;
  function tick(dt, inside) {
    T += dt;
    for (let i = pendH.length - 1; i >= 0; i--) { const h = pendH[i]; h.t -= dt; if (h.t <= 0) { hearts(h.x, h.y, h.z, 9, 0.4, 0.9); pendH.splice(i, 1); } }
    // the courtyard: visible outdoors within 70 m
    const vis = !inside && Math.hypot(pos.x - YARD.x, pos.z - YARD.z) < 70;
    if (yardRoot.visible !== vis) yardRoot.visible = vis;
    if (vis) { tickToy(dt); tickBath(dt); tickLantern(dt); tickPlant(dt); tickMend(YS.urn, yard.kit, YB.urn0, dt, yWv, v2.set(YL.urn[0], 0.9, YL.urn[1])); }
    // the Great Hall: build the spot when the hall streams in
    const r = interiors.room;
    if (r !== seenRoom) {
      seenRoom = r; gh = null;
      if (r && r.group && interiors.active === 'greathall') { try { gh = buildGH(r); ghBuilds++; } catch (e) { console.warn('[freecast] great hall spot skipped -', e && e.message || e); gh = null; } }
    }
    tickGH(dt);
  }
  const near12 = (x, z) => Math.hypot(pos.x - x, pos.z - z) < 12;
  function maxima() {   // Lumos Maxima lights the lantern / the candle stand within ~12 m (after the ball has risen)
    if (yardOn()) { L('lantern', 0, v0); if (near12(v0.x, v0.z) && fireOk(YS.fire, 'incendio')) { fireCast(YS.fire, 'incendio'); YS.fire.pend = 0.9; YS.maximaLit++; } }
    if (ghLive()) { gW(GH.stand.x, 0, GH.stand.z, v0); if (near12(v0.x, v0.z) && fireOk(GS.fire, 'incendio')) { fireCast(GS.fire, 'incendio'); GS.fire.pend = 0.9; YS.maximaLit++; } }
  }
  function perch() {    // the birdbath rim, for Avis (castle.js), when it is within ~12 m of Harry
    if (!yardOn()) return null;
    L('bath', 0, v0); if (!near12(v0.x, v0.z)) return null;
    return { x: v0.x, y: v0.y + 1.03, z: v0.z, r: 0.49, full: YS.bath.full };
  }
  function onLumos() { /* batch 7: Nox on the Great Hall candles moved to freecast-real.js */ }
  const meshCount = (g) => { let n = 0; if (g) g.traverse(o => { if (o.isMesh) n++; }); return n; };
  return {
    SP, tick, maxima, perch, onLumos,
    wilt() { PLs.last = -1e9; },
    spots: () => ({
      courtyard: { x: YARD.x, z: YARD.z, yaw: YARD.yaw, y: +Y0.toFixed(2), visible: yardRoot.visible, meshes: meshCount(yardRoot),
        ...Object.fromEntries(Object.keys(YL).map(k => { yW(YL[k][0], 0, YL[k][1], v0); return [k, { x: +v0.x.toFixed(2), z: +v0.z.toFixed(2) }]; })) },
      greathall: { room: 'greathall', table: GH.table, stand: GH.stand, meshes: gh ? meshCount(gh.group) : null },
    }),
    state: () => ({
      toy: { state: YS.toy.state, heals: YS.toy.heals, hops: YS.toy.hops, perk: +YS.toy.k.toFixed(2) },
      bath: { full: YS.bath.full, fills: YS.bath.fills, k: +YS.bath.k.toFixed(2), frozen: YS.bath.frozen, freezes: YS.bath.freezes, melts: YS.bath.melts, ice: +YS.bath.iceK.toFixed(2) },
      lantern: { lit: YS.fire.lit, lights: YS.fire.lights, douses: YS.fire.douses, frosts: YS.fire.frosts || 0 }, maximaLit: YS.maximaLit,
      plant: { wilt: +PLs.wilt.toFixed(2), heals: PLs.heals, bloomed: PLs.bloomed, grow: +PLs.grow.toFixed(2), waters: PLs.waters, level: PLs.sc.level, f: +PLs.sc.f.toFixed(2) },
      urn: { state: YS.urn.state, mends: YS.urn.mends, breaks: YS.urn.breaks },
      gh: { live: ghLive(), builds: ghBuilds, stand: { lit: GS.fire.lit, lights: GS.fire.lights, douses: GS.fire.douses }, pudding: { level: GS.pudding.level, f: +GS.pudding.f.toFixed(2), maxF: +GS.pudding.maxF.toFixed(2), minF: +GS.pudding.minF.toFixed(2) },
        platter: { mode: GS.platter.mode, floats: GS.platter.floats, accios: GS.platter.accios, reached: GS.platter.reached, maxRise: +GS.platter.maxRise.toFixed(2) },
        goblet: { mode: GS.goblet.mode, floats: GS.goblet.floats, accios: GS.goblet.accios, reached: GS.goblet.reached },
        plate: { state: GS.plate.state, mends: GS.plate.mends, breaks: GS.plate.breaks } },
    }),
    api: { YARD, GH, YL },
  };
}
