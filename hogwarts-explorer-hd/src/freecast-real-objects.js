// Batch 8: Wingardium Leviosa and Accio on the castle's REAL objects (not only the spell-spot props).
//   Library: a chair, two table books, two shelf books (they slide out of the shelf first).
//   Great Hall: three goblets and two platters on the house tables by the doors.
//   Common room: a wing chair's cushion, the chessboard (it rattles), two books from the case.
//   Classrooms: two chairs, the Defence stack of tomes, a quill and inkpot.
//   Broom cupboard: each broom on the rack (Accio: a happy loop first), a bucket.
//   Trophy room: the big house cup refuses ("too heavy!"): it wobbles and rings with sparkles.
// Leviosa: up ~1.5 m (capped below the ceiling), bob and a slow turn for ~6 s with sparkles, then down EXACTLY to its
// place and orientation; a second cast while it floats lifts it higher (max 3 m). Accio: an arc to Harry, once round
// him at hand height, ~2 s hovering in front of him, then home. Furniture (chairs, the cushion) is never picked while a
// student, teacher or creature stands or sits within 0.8 m. Duelling spells never take these (their spell lists).
// The rooms (liftables.js) draw these objects as one SkinnedMesh per material with one bone each; this module only
// poses the bones. Targets register when a room streams in and drop when it goes (rooms are rebuilt on every visit,
// so nothing is ever left displaced and nothing is saved). Nothing is allocated per frame.
import { Vector3, Quaternion, Euler } from 'three';

const LIFT = 1.5, MAX_LIFT = 3, HOLD = 4.4, SLIDE = 0.28, SLIDE_T = 0.45;
const AA = 1.1, CIRC = 1.8, HOV = 2.0, AR = 1.3, LOOP_T = 1.4, WOB_T = 1.5;
const SEAT_R = 0.8, TWINKLE_R = 5;
const TAU = Math.PI * 2;
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const PERSON = /^(prof-|char-|dumbledore|student)/;

export function createRealObjects({ player, interiors, fun, emit, burst, TARGETS, getSel, isBusy }) {
  const pos = player.pos;
  let R = null, seen = null, T = 0, builds = 0, twT = 0, peopleT = 0;
  const log = { floats: 0, higher: 0, accios: 0, returned: 0, refused: 0, loops: 0, rattles: 0, maxRise: 0, reachD: null, circled: 0, lastId: null, twinkles: 0, blockedSeen: 0 };
  const v0 = new Vector3(), v1 = new Vector3(), v2 = new Vector3(), e0 = new Euler(), q0 = new Quaternion(), q1 = new Quaternion(), xAx = new Vector3();
  const people = []; for (let i = 0; i < 64; i++) people.push(new Vector3());
  let nPeople = 0;

  // ---------------- per-visit ----------------
  function scan(room, id) {
    const g = room.group, L = g.userData.lift;
    if (!L || !L.items.length) return null;
    const S = { id, g, items: [], targets: [], ceil: L.ceil, meshes: L.meshes };
    for (const it of L.items) {
      S.items.push(Object.assign(Object.create(null), it, {
        mode: 'home', t: 0, rise: 0, lift: 0, holdEnd: 0, ang: 0, ang0: 0, angT: 0, r0: 0, slideK: 0, phase: null, blocked: false,
        rattle: 0, from: new Vector3(), maxLift: Math.max(0.3, Math.min(MAX_LIFT, L.ceil - 0.35 - (it.rest.p.y + it.h))),
      }));
    }
    R = S; peopleT = 0; refreshPeople();
    for (const o of S.items) register(S, o);
    return S;
  }
  const live = (S) => R === S && interiors.room && interiors.room.group === S.g;
  // the object's world position (its pivot: the base centre) + half its height
  const worldOf = (o, out) => out.copy(o.bone.position).add(R.g.position).setY(R.g.position.y + o.bone.position.y + Math.min(0.5, o.h * 0.5));
  function register(S, o) {
    const t = {
      id: 'real-obj-' + S.id + '-' + o.id, spells: ['leviosa', 'accio'], real: true, indoor: S.id, obj: o,
      at: (out) => worldOf(o, out),
      ok: (k) => live(S) && !o.blocked && (o.mode === 'home' || (k === 'leviosa' && o.mode === 'floating' && !o.heavy && o.lift < o.maxLift - 0.05)),
      cast: (k) => start(o, k),
    };
    S.targets.push(t); TARGETS.push(t);
  }
  function dropTargets(S) {
    for (const t of S.targets) { const i = TARGETS.indexOf(t); if (i >= 0) TARGETS.splice(i, 1); }
    S.targets.length = 0;
  }

  // ---------------- who is in the room (students, teachers, Dumbledore, creatures): refreshed once a second ----------------
  function walk(o) {
    if (nPeople >= people.length) return;
    if (R.meshes.includes(o)) return;
    if (o !== R.g && (o.isSkinnedMesh || (o.userData && o.userData.onTeardown) || PERSON.test(o.name || ''))) { o.getWorldPosition(people[nPeople++]); return; }
    const ch = o.children; for (let i = 0; i < ch.length; i++) walk(ch[i]);
  }
  function refreshPeople() {
    nPeople = 0; walk(R.g);
    for (const o of R.items) {
      if (!o.furniture) { o.blocked = false; continue; }
      v0.copy(o.rest.p).add(R.g.position);
      let b = false; for (let i = 0; i < nPeople; i++) if (Math.hypot(people[i].x - v0.x, people[i].z - v0.z) < SEAT_R) { b = true; break; }
      if (b && !o.blocked) log.blockedSeen++;
      o.blocked = b;
    }
  }

  // ---------------- casting ----------------
  function start(o, k) {
    log.lastId = o.id;
    if (o.heavy) { o.mode = 'wobble'; o.t = -0.35; o.said = false; log.refused++; return; }
    if (k === 'leviosa' && o.mode === 'floating') {   // a second Leviosa: higher (max 3 m, below the ceiling)
      o.lift = Math.min(o.maxLift, o.lift + LIFT); o.holdEnd = o.t + HOLD; o.phase = 'up'; log.higher++;
      return;
    }
    o.t = -0.35; o.slideK = 0; o.ang = 0; o.rise = 0;
    if (k === 'accio') { o.mode = 'flying'; o.phase = o.slide ? 'slideOut' : o.loop ? 'loop' : 'fly'; o.t0 = 0; o.reachedNow = false; log.accios++; }
    else { o.mode = 'floating'; o.phase = o.slide ? 'slideOut' : 'up'; o.lift = Math.min(LIFT, o.maxLift); o.holdEnd = HOLD + 0.6; log.floats++; }
    if (o.rattle) o.rattle = 0.6;
  }
  function home(o) {
    o.bone.position.copy(o.rest.p); o.bone.quaternion.copy(o.rest.q);
    o.mode = 'home'; o.phase = null; o.rise = 0; o.slideK = 0; o.ang = 0; log.returned++;
    if (o.rattle !== false && o.kind === 'chessboard') { o.rattle = 0.45; log.rattles++; }
    fun.sfx.soft();
  }
  // the point in front of Harry at hand height, in room coordinates (the pivot sits a little below the hand for tall things)
  function hoverPoint(o, out, back = 0) {
    const f = player.yaw, d = 0.75 + o.size + back, s = player.model.scale.y;
    return out.set(pos.x + Math.sin(f) * d, pos.y + 1.15 * s - Math.min(0.5, o.h * 0.5), pos.z + Math.cos(f) * d).sub(R.g.position);
  }
  function sparkle(o, hex, p = 8) {
    if (Math.random() > p * 0.016) return;
    worldOf(o, v2);
    emit(v2.x + (Math.random() - 0.5) * o.size * 1.6, v2.y + (Math.random() - 0.5) * 0.3, v2.z + (Math.random() - 0.5) * o.size * 1.6, (Math.random() - 0.5) * 0.3, -0.15, (Math.random() - 0.5) * 0.3, 0.8, 0.16, hex);
  }

  // ---------------- per-frame ----------------
  function pose(o, x, y, z, ang, tx = 0, tz = 0) {
    o.bone.position.set(x, y, z);
    o.bone.quaternion.setFromEuler(e0.set(tx, ang, tz)).multiply(o.rest.q);
  }
  function tickFloat(o, dt) {
    const r = o.rest.p, t = o.t;
    const sx = o.slide ? o.slide[0] * SLIDE : 0, sz = o.slide ? o.slide[1] * SLIDE : 0;
    if (o.phase === 'slideOut') { o.slideK = Math.min(1, o.slideK + dt / SLIDE_T); if (o.slideK >= 1) o.phase = 'up'; }
    else if (o.phase === 'up' || o.phase === 'hold') {
      o.rise = Math.min(o.lift, o.rise + Math.max(0.25 * dt, (o.lift - o.rise) * Math.min(1, dt * 2.6)));
      if (Math.abs(o.rise - o.lift) < 0.01) { o.rise = o.lift; o.phase = 'hold'; }
      o.ang += dt * 0.75;
      if (t >= o.holdEnd) { o.phase = 'down'; o.r0 = Math.max(0.001, o.rise); o.ang0 = o.ang; o.angT = Math.ceil(o.ang / TAU) * TAU; }
    } else if (o.phase === 'down') {
      o.rise = Math.max(0, o.rise - dt * Math.max(0.35, o.rise * 1.5));
      o.ang = o.angT + (o.ang0 - o.angT) * (o.rise / o.r0);
      if (o.rise <= 0) { if (o.slide) o.phase = 'slideIn'; else { home(o); return; } }
    } else if (o.phase === 'slideIn') { o.slideK = Math.max(0, o.slideK - dt / SLIDE_T); if (o.slideK <= 0) { home(o); return; } }
    log.maxRise = Math.max(log.maxRise, o.rise);
    const k = o.lift > 0 ? Math.min(1, o.rise / Math.max(0.3, Math.min(o.lift, 1))) : 0, sk = ease(o.slideK);
    const bob = Math.sin(t * 3) * 0.1 * k;
    pose(o, r.x + sx * sk, r.y + o.rise + bob, r.z + sz * sk, o.ang, Math.sin(t * 2.3) * 0.12 * k, Math.cos(t * 1.7) * 0.1 * k);
    if (o.rise > 0.05) sparkle(o, 0xd8c8ff);
  }
  function tickAccio(o, dt) {
    const r = o.rest.p, sx = o.slide ? o.slide[0] * SLIDE : 0, sz = o.slide ? o.slide[1] * SLIDE : 0;
    o.t0 += dt; const t = o.t0;
    if (o.phase === 'slideOut') {
      o.slideK = Math.min(1, o.slideK + dt / SLIDE_T);
      pose(o, r.x + sx * ease(o.slideK), r.y, r.z + sz * ease(o.slideK), 0);
      if (o.slideK >= 1) { o.phase = 'fly'; o.t0 = 0; }
      return;
    }
    if (o.phase === 'loop') {   // a broom's happy loop: up out of the rack, one loop over toward the room
      const k = Math.min(1, t / LOOP_T), a = ease(k) * TAU, up = ease(Math.min(1, t / 0.4)) * 0.45, Rl = 0.45;
      pose(o, r.x + o.loop[0] * (0.35 * up / 0.45 + Math.sin(a) * Rl), r.y + up + Rl * (1 - Math.cos(a)), r.z + o.loop[1] * (0.35 * up / 0.45 + Math.sin(a) * Rl), 0, o.loop[1] * a, -o.loop[0] * a);
      sparkle(o, 0xffe27a, 14);
      if (k >= 1) { o.phase = 'fly'; o.t0 = 0; log.loops++; o.from.copy(o.bone.position); fun.sfx.giggle(true); }
      return;
    }
    if (o.phase === 'fly') {
      if (t === dt || o.t0 <= dt) o.from.copy(o.bone.position);
      const k = ease(Math.min(1, t / AA)); hoverPoint(o, v1);
      v0.lerpVectors(o.from, v1, k); v0.y += Math.sin(k * Math.PI) * 0.9;
      pose(o, v0.x, v0.y, v0.z, k * TAU);
      if (t >= AA) { o.phase = 'circle'; o.t0 = 0; o.phi0 = player.yaw; fun.sfx.pop(); worldOf(o, v2); burst(v2.x, v2.y, v2.z, 0x9ad8ff, 10, 1.2, 0.5, 0.18, 0); }
    } else if (o.phase === 'circle') {   // once round Harry at hand height
      const k = Math.min(1, t / CIRC), phi = o.phi0 + ease(k) * TAU, d = 0.75 + o.size, s = player.model.scale.y;
      v0.set(pos.x + Math.sin(phi) * d, pos.y + 1.15 * s - Math.min(0.5, o.h * 0.5) + Math.sin(k * Math.PI) * 0.15, pos.z + Math.cos(phi) * d).sub(R.g.position);
      pose(o, v0.x, v0.y, v0.z, phi - o.phi0);
      if (k >= 1) { o.phase = 'hover'; o.t0 = 0; log.circled++; }
    } else if (o.phase === 'hover') {
      hoverPoint(o, v0); v0.y += Math.sin(t * 3.2) * 0.07;
      pose(o, v0.x, v0.y, v0.z, Math.sin(t * 1.4) * 0.3);
      if (!o.reachedNow) { o.reachedNow = true; worldOf(o, v2); log.reachD = +Math.hypot(v2.x - pos.x, v2.z - pos.z).toFixed(2); }
      o.from.copy(o.bone.position); o.ang0 = Math.sin(t * 1.4) * 0.3;
      if (t >= HOV) { o.phase = 'back'; o.t0 = 0; }
    } else if (o.phase === 'back') {
      const k = ease(Math.min(1, t / AR));
      v0.set(r.x + sx, r.y, r.z + sz); v1.lerpVectors(o.from, v0, k); v1.y += Math.sin(k * Math.PI) * 0.8;
      pose(o, v1.x, v1.y, v1.z, o.ang0 * (1 - k) + k * TAU);
      if (t >= AR) { if (o.slide) { o.phase = 'slideIn'; o.slideK = 1; } else { home(o); return; } }
    } else if (o.phase === 'slideIn') {
      o.slideK = Math.max(0, o.slideK - dt / SLIDE_T);
      pose(o, r.x + sx * ease(o.slideK), r.y, r.z + sz * ease(o.slideK), 0);
      if (o.slideK <= 0) { home(o); return; }
    }
    sparkle(o, 0x9ad8ff, 10);
  }
  function tickWobble(o, dt) {   // the house cup: "too heavy!"
    const t = o.t, k = Math.max(0, 1 - t / WOB_T), r = o.rest.p;
    if (!o.said) {
      o.said = true; worldOf(o, v2);
      fun.say(v2.set(v2.x, v2.y + 1.0, v2.z), 'כָּבֵד מִדַּי! 😄', 2.4, 'freecast-heavy');
      burst(v2.x, v2.y - 0.6, v2.z, 0xffe27a, 22, 1.6, 0.8, 0.2, -0.6); fun.sfx.tink(0); fun.sfx.tink(4); fun.sfx.chime();
    }
    pose(o, r.x, r.y + Math.abs(Math.sin(t * 9)) * 0.03 * k, r.z, 0, Math.sin(t * 17) * 0.07 * k, Math.cos(t * 13) * 0.07 * k);
    sparkle(o, 0xffe27a, 12);
    if (t >= WOB_T) { o.bone.position.copy(o.rest.p); o.bone.quaternion.copy(o.rest.q); o.mode = 'home'; }
  }
  function tickRattle(o, dt) {   // the chessboard's squares jitter with a few tinks (lift-off and landing)
    o.rattle -= dt;
    if (o.mode === 'home') {
      if (o.rattle > 0) { o.bone.position.set(o.rest.p.x + (Math.random() - 0.5) * 0.012, o.rest.p.y + Math.random() * 0.01, o.rest.p.z + (Math.random() - 0.5) * 0.012); }
      else o.bone.position.copy(o.rest.p);
    } else o.bone.position.x += (Math.random() - 0.5) * 0.012;
    if (Math.random() < dt * 14) fun.sfx.tink((Math.random() * 6) | 0);
    if (o.rattle <= 0) { o.rattle = 0; if (o.mode === 'home') o.bone.position.copy(o.rest.p); }
  }

  function tickRoom(dt) {
    const S = R;
    peopleT -= dt; if (peopleT <= 0) { peopleT = 1; refreshPeople(); }
    for (const o of S.items) {
      if (o.mode !== 'home') {
        o.t += dt;
        if (o.t >= 0) { if (o.mode === 'floating') tickFloat(o, dt); else if (o.mode === 'flying') tickAccio(o, dt); else if (o.mode === 'wobble') tickWobble(o, dt); }
      }
      if (o.rattle > 0) tickRattle(o, dt);
    }
    // the discoverability twinkle: Leviosa / Accio selected, Harry within 5 m: a soft sparkle on up to 3 objects
    twT -= dt;
    if (twT <= 0) {
      twT = 0.55;
      const k = getSel();
      if ((k === 'leviosa' || k === 'accio') && !isBusy()) {
        let n = 0;
        for (const o of S.items) {
          if (n >= 3) break;
          if (o.mode !== 'home' || o.blocked) continue;
          worldOf(o, v2); if (Math.hypot(v2.x - pos.x, v2.z - pos.z) > TWINKLE_R || Math.abs(v2.y - pos.y) > 4) continue;
          emit(v2.x + (Math.random() - 0.5) * o.size, v2.y + Math.random() * 0.2, v2.z + (Math.random() - 0.5) * o.size, 0, 0.18, 0, 0.7, 0.14, 0xfff2c8);
          n++; log.twinkles++;
        }
      }
    }
  }
  function tick(dt) {
    T += dt;
    const r = interiors.room;
    if (r !== seen) {
      seen = r;
      if (R) { dropTargets(R); R = null; }
      if (r && r.group && interiors.active) { try { if (scan(r, interiors.active)) builds++; } catch (e) { console.warn('[freecast] real objects skipped -', e && e.message || e); if (R) dropTargets(R); R = null; } }
    }
    if (R && live(R)) tickRoom(dt);
  }

  // ---------------- debug (window.__game.freecast.real.objects) ----------------
  const find = (id) => R && R.items.find(o => o.id === id || 'real-obj-' + R.id + '-' + o.id === id);
  const api = {
    ids: () => (R ? R.items.map(o => o.id) : []),
    state: () => ({
      room: R && live(R) ? R.id : null, builds, ...log,
      objects: R ? R.items.map(o => {
        const dx = o.bone.position.x - o.rest.p.x, dy = o.bone.position.y - o.rest.p.y, dz = o.bone.position.z - o.rest.p.z;
        return { id: o.id, kind: o.kind, state: o.mode === 'home' ? 'home' : o.mode, phase: o.phase, blocked: o.blocked, heavy: o.heavy,
          rise: +o.rise.toFixed(2), lift: +o.lift.toFixed(2), maxLift: +o.maxLift.toFixed(2), off: +Math.hypot(dx, dy, dz).toFixed(4), turn: +(2 * Math.acos(Math.min(1, Math.abs(o.bone.quaternion.dot(o.rest.q))))).toFixed(4) };
      }) : [],
      people: nPeople,
    }),
    // stand Harry d metres from an object (on the side away from the wall it sits against), facing it
    aim(id, d = 2.2) {
      const o = find(id); if (!o) return null;
      worldOf(o, v0);
      let fx, fz;
      if (o.slide) { fx = o.slide[0]; fz = o.slide[1]; }
      else if (o.loop) { fx = o.loop[0]; fz = o.loop[1]; }
      else { const cx = R.g.position.x - v0.x, cz = R.g.position.z - v0.z, l = Math.hypot(cx, cz) || 1; fx = cx / l; fz = cz / l; }
      const x = v0.x + fx * d, z = v0.z + fz * d;
      player.yaw = Math.atan2(v0.x - x, v0.z - z);
      try { player.teleport(x, z); } catch { /* plain move */ }
      pos.x = x; pos.z = z;
      return { x: +x.toFixed(2), z: +z.toFixed(2), tx: +v0.x.toFixed(2), ty: +v0.y.toFixed(2), tz: +v0.z.toFixed(2) };
    },
    world: (id) => { const o = find(id); if (!o) return null; worldOf(o, v0); return { x: +v0.x.toFixed(3), y: +v0.y.toFixed(3), z: +v0.z.toFixed(3) }; },
    people: () => { const out = []; for (let i = 0; i < nPeople; i++) out.push({ x: +people[i].x.toFixed(2), z: +people[i].z.toFixed(2) }); return out; },
  };
  return { tick, api };
}
