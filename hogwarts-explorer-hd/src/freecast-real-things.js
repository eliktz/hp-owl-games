// Batch 9: Reparo, Engorgio / Reducio, Orchideous and Avis on the castle's REAL things.
//   Reparo      one gently broken thing per room (real-things-kit.js): library books toppled with loose pages, the
//               common room's side table on a snapped leg, a knocked-over jar with spilled glow in the dungeon, an
//               hourglass in the classrooms, a sheeted desk in the forgotten classroom, a cracked glasshouse pane
//               (outdoors). The pieces fly back together with gold sparkles and a chime; 40 s later it wobbles and
//               gently breaks again ("oops", a small puff), ready to be mended again.
//   Engorgio / Reducio   six dishes on the Great Hall house tables by the doors, the common room chessboard and cushion,
//               the broom cupboard bucket: three sizes (0.6x, 1x, 1.6x) with a wobble (the jelly wobbles extra);
//               back to normal by itself after 30 s.
//   Orchideous  the real empty vases (Great Hall, library, common room) and a trough by the glasshouse fill with
//               flowers that stay until the room is left (outdoors: until Harry walks away or goes in).
//   Avis        in the Great Hall the flock perches on the nearest house-table edge (clear of food and people); by
//               the glasshouse on its eave beam (freecast-castle.js asks perch()).
// Rooms are rebuilt on every visit, so nothing is ever left changed and nothing is saved. Targets register when a
// room streams in and drop when it goes. Duelling spells never take these (their spell lists). Nothing is allocated
// per frame; the pieces are bones of the room's liftables SkinnedMesh (no new draw call where one exists).
import { Vector3, Quaternion, Euler, Group } from 'three';
import { liftables } from './liftables.js';
import { brokenPane, emptyTrough } from './real-things-kit.js';

const MEND_T = 1.1, MENDED_FOR = 40, WOB_T = 0.8, FALL_T = 0.45, SIZE_BACK = 30, SIZES = [0.6, 1, 1.6], TWINKLE_R = 5;
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const bouncy = (k) => (k >= 1 ? 1 : 1 - Math.exp(-5 * k) * Math.cos(k * 11));
const backOut = (k) => { k = Math.min(1, Math.max(0, k)); const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

import { frameShot } from './liftables.js';
export function createRealThings({ scene, player, interiors, fun, emit, burst, TARGETS, getSel, isBusy }) {
  const pos = player.pos;
  let R = null, seen = null, T = 0, builds = 0, twT = 0, OUT = null, outTried = 0;
  const log = { mends: 0, breaks: 0, grows: 0, shrinks: 0, backs: 0, blooms: 0, perches: 0, twinkles: 0, lastId: null };
  const v0 = new Vector3(), v1 = new Vector3(), e0 = new Euler(), q0 = new Quaternion(), q1 = new Quaternion();
  const seats = Array.from({ length: 6 }, () => new Vector3());
  const perchOut = { x: 0, y: 0, z: 0, r: 0, full: false, seats, real: null };

  // ---------------- a scene (a room, or the glasshouse outdoors) ----------------
  function scanGroup(g, id, outdoor) {
    const L = g.userData.lift; if (!L) return null;
    const S = { id, g, outdoor, sets: [], sizes: [], blooms: [], targets: [] };
    const sets = new Map();
    for (const it of L.items) {
      const b = it.b9; if (!b) continue;
      if (b.fix) {
        let F = sets.get(b.fix);
        if (!F) { sets.set(b.fix, F = { id: b.fix, label: null, pieces: [], state: 'broken', t: 0, mends: 0, breaks: 0, at: null, glow: null }); S.sets.push(F); }
        if (b.at) F.at = b.at; if (b.glow) F.glow = b.glow; if (b.label) F.label = b.label;
        const p = { it, bp: new Vector3(...b.bp).add(it.rest.p), bq: new Quaternion().setFromEuler(e0.set(b.br[0], b.br[1], b.br[2])).multiply(it.rest.q), ms: b.ms, bs: b.bs };
        F.pieces.push(p);
      }
      if (b.grow) S.sizes.push({ it, id: it.id, label: b.label, jelly: !!b.jelly, level: 0, f: 1, from: 1, to: 1, k: 1, back: 0, wob: 0, grows: 0, shrinks: 0, maxF: 1, minF: 1 });
      if (b.bloom) S.blooms.push({ it, id: it.id, label: b.label, bloomed: false, pend: 0, k: 0 });
    }
    for (const F of S.sets) { poseSet(F, 0); if (!F.at) F.at = F.pieces[0].it.pivot; }
    for (const B of S.blooms) B.it.bone.scale.setScalar(0.001);
    for (const F of S.sets) addT(S, { id: 'real-fix-' + id + '-' + F.id, spells: ['reparo'], at: (o) => o.set(F.at[0], F.at[1], F.at[2]).applyMatrix4(S.g.matrixWorld),
      ok: () => okScene(S) && F.state === 'broken', cast: () => { F.state = 'mending'; F.t = -0.35; log.lastId = F.id; }, set: F });
    for (const Z of S.sizes) addT(S, { id: 'real-size-' + id + '-' + Z.id, spells: ['engorgio', 'reducio'],
      at: (o) => o.copy(Z.it.bone.position).setY(Z.it.bone.position.y + 0.12 * Z.f).applyMatrix4(S.g.matrixWorld),
      ok: (k) => okScene(S) && (Z.it.mode === undefined || Z.it.mode === 'home') && Z.k >= 1 && (k === 'engorgio' ? Z.level < 1 : Z.level > -1),
      cast: (k) => stepSize(Z, k === 'engorgio' ? 1 : -1), size: Z });
    for (const B of S.blooms) addT(S, { id: 'real-bloom-' + id + '-' + B.id, spells: ['orchideous'], at: (o) => o.set(B.it.pivot[0], B.it.pivot[1] + 0.05, B.it.pivot[2]).applyMatrix4(S.g.matrixWorld),
      ok: () => okScene(S) && !B.bloomed && !B.pend, cast: () => { B.pend = 0.75; log.lastId = B.id; }, bloom: B });
    return S;
  }
  // a spell course / modal owns the screen: nothing here reacts (and the glasshouse belongs to Herbology)
  const quiet = () => isBusy() || document.body.classList.contains('inSpell') || document.body.classList.contains('inMatch');
  function okScene(S) {
    if (quiet()) return false;
    if (S.outdoor) return !interiors.active && S.g.visible !== false && Math.hypot(pos.x - S.wx, pos.z - S.wz) < 30;
    return R === S && interiors.room && interiors.room.group === S.g;
  }
  function addT(S, t) { t.real = true; t.indoor = S.outdoor ? null : S.id; S.targets.push(t); TARGETS.push(t); }
  function dropTargets(S) { for (const t of S.targets) { const i = TARGETS.indexOf(t); if (i >= 0) TARGETS.splice(i, 1); } S.targets.length = 0; }

  // ---------------- Reparo ----------------
  function poseSet(F, k, arc = 0, stagger = 0) {   // k 0 broken .. 1 mended
    const n = F.pieces.length;
    for (let i = 0; i < n; i++) {
      const p = F.pieces[i], b = p.it.bone, kk = stagger ? ease((k * (1 + stagger * (n - 1)) - i * stagger)) : k;
      b.position.lerpVectors(p.bp, p.it.rest.p, kk); b.position.y += Math.sin(kk * Math.PI) * arc;
      b.quaternion.slerpQuaternions(p.bq, p.it.rest.q, kk);
      b.scale.setScalar(Math.max(0.001, p.bs + (p.ms - p.bs) * kk));
    }
  }
  const worldAt = (S, F, out) => out.set(F.at[0], F.at[1], F.at[2]).applyMatrix4(S.g.matrixWorld);
  function tickSet(S, F, dt) {
    if (F.state === 'broken') {
      if (F.glow && Math.random() < dt * 2.5) { const p = F.pieces[F.pieces.length - 2] || F.pieces[0]; v0.copy(p.it.bone.position).applyMatrix4(S.g.matrixWorld); emit(v0.x + (Math.random() - 0.5) * 0.3, v0.y + 0.03, v0.z + (Math.random() - 0.5) * 0.3, 0, 0.12, 0, 1.4, 0.12, F.glow); }
      return;
    }
    F.t += dt; const t = F.t;
    if (F.state === 'mending') {
      if (t < 0) return;
      const k = Math.min(1, t / MEND_T);
      poseSet(F, k, 0.35, 0.06);
      if (Math.random() < dt * 22) { const p = F.pieces[(Math.random() * F.pieces.length) | 0]; v0.copy(p.it.bone.position).applyMatrix4(S.g.matrixWorld); emit(v0.x, v0.y + 0.05, v0.z, (Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4, 0.7, 0.16, Math.random() < 0.3 ? 0xffffff : 0xffd76a); }
      if (k >= 1) {
        poseSet(F, 1); F.state = 'mended'; F.t = 0; F.mends++; log.mends++;
        worldAt(S, F, v0); burst(v0.x, v0.y + 0.15, v0.z, 0xffe27a, 26, 2.2, 0.9, 0.22, -0.8); burst(v0.x, v0.y + 0.15, v0.z, 0xffffff, 10, 1.4, 0.6, 0.16, -0.4);
        fun.sfx.tink(0); fun.sfx.tink(4); fun.sfx.chime(); try { fun.sfx.sparkle(); } catch { /* ignore */ }
      }
    } else if (F.state === 'mended') {
      if (t > MENDED_FOR) { F.state = 'wobble'; F.t = 0; }
    } else if (F.state === 'wobble') {
      const a = Math.sin(t * 18) * 0.05 * Math.min(1, t / 0.3);
      for (const p of F.pieces) { const b = p.it.bone; b.quaternion.setFromEuler(e0.set(a * 0.6, 0, a)).multiply(p.it.rest.q); }
      if (t > WOB_T) { F.state = 'falling'; F.t = 0; }
    } else if (F.state === 'falling') {
      poseSet(F, 1 - ease(t / FALL_T), 0.1);
      if (t >= FALL_T) {
        poseSet(F, 0); F.state = 'broken'; F.breaks++; log.breaks++;
        worldAt(S, F, v0);
        for (let n = 0; n < 14; n++) emit(v0.x + (Math.random() - 0.5) * 0.4, v0.y - 0.1, v0.z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6, 1.0, 0.3, 0xd8d0c4, 0.1, 1.2);
        fun.sfx.poof();
        if (Math.hypot(v0.x - pos.x, v0.z - pos.z) < 9) fun.say(v1.set(v0.x, v0.y + 0.8, v0.z), 'אוּפְּס! 😅', 1.8, 'freecast-oops');
      }
    }
  }

  // ---------------- Engorgio / Reducio ----------------
  function stepSize(Z, dir) {
    const n = Z.level + dir; if (n < -1 || n > 1) return false;
    Z.level = n; Z.from = Z.f; Z.to = SIZES[n + 1]; Z.k = -0.35 / 0.8; Z.back = n ? SIZE_BACK : 0; Z.wob = Z.jelly ? 2.6 : 0.9;
    if (dir > 0) { Z.grows++; log.grows++; } else { Z.shrinks++; log.shrinks++; }
    log.lastId = Z.id; return true;
  }
  function tickSize(S, Z, dt) {
    let ch = false;
    if (Z.back > 0) { Z.back -= dt; if (Z.back <= 0 && Z.k >= 1) { Z.back = 0; Z.level = 0; Z.from = Z.f; Z.to = 1; Z.k = 0; Z.wob = Z.jelly ? 2.6 : 0.9; log.backs++; v0.copy(Z.it.bone.position).applyMatrix4(S.g.matrixWorld); burst(v0.x, v0.y + 0.15, v0.z, 0xfff2c8, 10, 1, 0.6, 0.14, -0.4); fun.sfx.pop(); } }
    if (Z.k < 1) { Z.k += dt / 0.8; if (Z.k >= 0) { Z.f = Z.from + (Z.to - Z.from) * bouncy(Math.min(1, Z.k)); if (Z.k >= 1) Z.f = Z.to; Z.maxF = Math.max(Z.maxF, Z.f); Z.minF = Math.min(Z.minF, Z.f); } ch = true; }
    if (Z.wob > 0) { Z.wob = Math.max(0, Z.wob - dt); ch = true; }
    if (!ch) return;
    const w = Z.wob, amp = Z.jelly ? 0.16 : 0.05, sq = Math.sin(T * (Z.jelly ? 19 : 14)) * amp * Math.min(1, w);
    Z.it.bone.scale.set(Z.f * (1 + sq), Z.f * (1 - sq * 1.2), Z.f * (1 + sq));
  }

  // ---------------- Orchideous ----------------
  function tickBloom(S, B, dt) {
    if (B.pend > 0) {
      B.pend -= dt;
      if (B.pend <= 0) {
        B.pend = 0; B.bloomed = true; B.k = 0; log.blooms++;
        v0.set(B.it.pivot[0], B.it.pivot[1] + 0.2, B.it.pivot[2]).applyMatrix4(S.g.matrixWorld);
        for (const c of [0xff8ac0, 0xffe27a, 0xa88aff]) burst(v0.x, v0.y, v0.z, c, 10, 1.6, 0.8, 0.18, -1);
        fun.sfx.sparkle(); fun.sfx.giggle(true);
      }
    }
    if (B.bloomed && B.k < 1) { B.k = Math.min(1, B.k + dt / 0.7); B.it.bone.scale.setScalar(Math.max(0.001, backOut(B.k))); }
  }

  // ---------------- Avis perches ----------------
  function perch() {
    if (quiet()) return null;
    if (R && interiors.active === 'greathall' && okScene(R)) {
      const rows = R.g.userData.perchRows; if (!rows) return null;
      v0.set(pos.x, pos.y, pos.z); R.g.worldToLocal(v0);
      let bestRow = null, bz = 0, bd = 1e9;
      for (const r of rows) for (const s of r.seats) { const d = Math.hypot(s[0] - v0.x, s[2] - v0.z); if (d < bd) { bd = d; bestRow = r; bz = s[2]; } }
      if (!bestRow || bd > 9 || bestRow.seats.length < 6) return null;
      const near = bestRow.seats.slice().sort((a, b) => Math.abs(a[2] - bz) - Math.abs(b[2] - bz)).slice(0, 6);   // (once per cast: not per frame)
      near.forEach((s, i) => seats[i].set(s[0], s[1] + 0.07, s[2]).applyMatrix4(R.g.matrixWorld));
      v1.set(bestRow.tx + bestRow.side * 4, 1, bz).applyMatrix4(R.g.matrixWorld);   // they face out, away from the dishes
      perchOut.x = v1.x; perchOut.y = seats[0].y; perchOut.z = v1.z; perchOut.real = 'greathall-table'; log.perches++;
      return perchOut;
    }
    if (OUT && !interiors.active && okScene(OUT) && Math.hypot(pos.x - OUT.wx, pos.z - OUT.wz) < 12) {
      const G = OUT.g; v0.set(pos.x, pos.y, pos.z); G.worldToLocal(v0);
      const sd = v0.x >= 0 ? 1 : -1, zc = Math.max(-2.6, Math.min(2.6, v0.z));
      for (let i = 0; i < 6; i++) seats[i].set(sd * 3.32, 3.08 + 0.07 + 0.075, zc + (i - 2.5) * 0.28).applyMatrix4(G.matrixWorld);   // on the eave beam (EH 3.1 + half its height)
      v1.set(sd * 8, 3, zc).applyMatrix4(G.matrixWorld);
      perchOut.x = v1.x; perchOut.y = seats[0].y; perchOut.z = v1.z; perchOut.real = 'glasshouse-eave'; log.perches++;
      return perchOut;
    }
    return null;
  }

  // ---------------- the glasshouse (outdoors): built once, the first time it exists ----------------
  function buildOut() {
    const gh = scene.getObjectByName('greenhouse'); if (!gh) return false;
    const g = new Group(); g.name = 'greenhouse-real'; gh.add(g);
    const LF = liftables(g, { ceil: 5 });
    brokenPane(LF, 3.37, 0.29, 1.35, 1, -0.05);
    emptyTrough(LF, 'trough-gh', 2.1, -0.02, 4.25, 'x');   // an empty planter by the door (Orchideous)
    LF.finish();
    gh.updateMatrixWorld(true);
    const S = scanGroup(g, 'glasshouse', true); if (!S) return false;
    v0.set(0, 0, 0).applyMatrix4(gh.matrixWorld); S.wx = v0.x; S.wz = v0.z;
    OUT = S; return true;
  }
  function resetOut() {   // Harry walked away / went in: the trough empties, sizes are none, a mended pane stays until its timer
    for (const B of OUT.blooms) if (B.bloomed || B.pend) { B.bloomed = false; B.pend = 0; B.k = 0; B.it.bone.scale.setScalar(0.001); }
  }

  // ---------------- per-frame ----------------
  function tickScene(S, dt) {
    for (const F of S.sets) tickSet(S, F, dt);
    for (const Z of S.sizes) tickSize(S, Z, dt);
    for (const B of S.blooms) tickBloom(S, B, dt);
    twT -= dt;
    if (twT <= 0) {
      twT = 0.55;
      const k = getSel();
      if ((k === 'reparo' || k === 'engorgio' || k === 'reducio' || k === 'orchideous') && !quiet()) {
        let n = 0;
        for (const t of S.targets) {
          if (n >= 3) break;
          if (!t.spells.includes(k) || !t.ok(k)) continue;
          t.at(v0); if (Math.hypot(v0.x - pos.x, v0.z - pos.z) > TWINKLE_R || Math.abs(v0.y - pos.y) > 4) continue;
          emit(v0.x + (Math.random() - 0.5) * 0.3, v0.y + Math.random() * 0.15, v0.z + (Math.random() - 0.5) * 0.3, 0, 0.18, 0, 0.7, 0.14, 0xfff2c8);
          n++; log.twinkles++;
        }
      }
    }
  }
  let outAway = true;
  function tick(dt) {
    T += dt;
    const r = interiors.room;
    if (r !== seen) {
      seen = r;
      if (R) { dropTargets(R); R = null; }
      if (r && r.group && interiors.active) {
        try { r.group.updateMatrixWorld(true); R = scanGroup(r.group, interiors.active, false); if (R && !R.targets.length) R = null; if (R) builds++; }
        catch (e) { console.warn('[freecast] real things skipped -', e && e.message || e); if (R) dropTargets(R); R = null; }
      }
    }
    if (R && okScene(R)) tickScene(R, dt);
    if (!OUT && outTried < 120 && T > 1 + outTried) { outTried++; try { buildOut(); } catch (e) { console.warn('[freecast] glasshouse things skipped -', e && e.message || e); OUT = null; outTried = 99; } }
    if (OUT) {
      const away = !!interiors.active || Math.hypot(pos.x - OUT.wx, pos.z - OUT.wz) > 40;
      if (away && !outAway) resetOut();
      outAway = away;
      if (!away) tickScene(OUT, dt); else for (const F of OUT.sets) if (F.state !== 'broken') tickSet(OUT, F, dt);
    }
  }

  // ---------------- debug (window.__game.freecast.real.things) ----------------
  const scenes = () => [R, OUT].filter(Boolean);
  const findT = (id) => { for (const S of scenes()) { const t = S.targets.find(x => x.id === id || x.id.endsWith('-' + id)); if (t) return t; } return null; };
  const api = {
    ids: () => scenes().flatMap(S => S.targets.map(t => t.id)),
    state: () => ({
      room: R ? R.id : null, builds, glasshouse: !!OUT, ...log,
      broken: scenes().flatMap(S => S.sets.map(F => ({ id: 'real-fix-' + S.id + '-' + F.id, label: F.label, state: F.state, mends: F.mends, breaks: F.breaks, t: +F.t.toFixed(1) }))),
      sizes: scenes().flatMap(S => S.sizes.map(Z => ({ id: 'real-size-' + S.id + '-' + Z.id, label: Z.label, level: Z.level, f: +Z.f.toFixed(2), scale: +Z.it.bone.scale.y.toFixed(2), maxF: +Z.maxF.toFixed(2), minF: +Z.minF.toFixed(2), back: +Z.back.toFixed(1), grows: Z.grows, shrinks: Z.shrinks }))),
      flowers: scenes().flatMap(S => S.blooms.map(B => ({ id: 'real-bloom-' + S.id + '-' + B.id, label: B.label, bloomed: B.bloomed, scale: +B.it.bone.scale.x.toFixed(2) }))),
      perch: perchOut.real, perches: log.perches,
    }),
    // stand Harry d metres from a target (on the side toward the room's middle / away from the wall), facing it
    aim(id, d = 2.4) {
      const t = findT(id); if (!t) return null;
      t.at(v0); const S = scenes().find(s => s.targets.includes(t));
      let fx, fz;
      if (S.outdoor) { v1.set(0, 0, 0).applyMatrix4(S.g.matrixWorld); fx = v0.x - v1.x; fz = v0.z - v1.z; }
      else { v1.setFromMatrixPosition(S.g.matrixWorld); fx = v1.x - v0.x; fz = v1.z - v0.z; }
      const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
      const x = v0.x + fx * d, z = v0.z + fz * d;
      player.yaw = Math.atan2(v0.x - x, v0.z - z);
      try { player.teleport(x, z); } catch { /* plain move */ }
      pos.x = x; pos.z = z;
      const cam = frameShot(player, interiors, v0);
      return { cam, id: t.id, x: +x.toFixed(2), z: +z.toFixed(2), tx: +v0.x.toFixed(2), ty: +v0.y.toFixed(2), tz: +v0.z.toFixed(2) };
    },
    world: (id) => { const t = findT(id); if (!t) return null; t.at(v0); return { x: +v0.x.toFixed(3), y: +v0.y.toFixed(3), z: +v0.z.toFixed(3) }; },
    // test helper: make every mended thing break again now
    breakAll() { for (const S of scenes()) for (const F of S.sets) if (F.state === 'mended') F.t = MENDED_FOR + 1; },
    perch,
  };
  return { tick, api, perch };
}
