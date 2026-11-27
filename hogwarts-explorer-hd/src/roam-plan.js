// Teachers roam the castle: the PURE half (no three.js, no window), importable from node tests.
// Each teacher has a LOGICAL position advanced by a cheap schedule whether or not the room exists
// (rooms stream one at a time); roam.js materialises the figure only where the player is.
// Coordinates: room-local x,z indoors (as rooms.js / lessons.js STATIONS), world x,z outdoors.

// ---- seeded random (one stream per teacher per day) ----
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---- room geometry used by the schedule (static copy of what matters for walking) ----
// doors[to] = { x, z } the doorway point (where a figure appears / vanishes), in = a step inside it.
// obs = obstacles a teacher must walk around (room colliders that are not walls + furniture with no
// collider: house tables, the stair flight). keep = keep-out circles (portals, hearths, ...) where a
// teacher never stops or pauses. nodes = waypoints for the visibility-graph router.
const B = (x, z, hw, hd) => ({ type: 'box', x, z, hw, hd, angle: 0 });
const C = (x, z, r) => ({ type: 'circle', x, z, r });
export const ROOMS = {
  entrancehall: {
    half: [8, 12],
    doors: { courtyard: { x: 0, z: 11.3, ix: 0, iz: 8.2 }, greathall: { x: -7.6, z: 1, ix: -5.2, iz: 1 }, library: { x: 7.6, z: 1, ix: 5.2, iz: 1 }, staircase: { x: 0, z: -9.6, ix: 0, iz: -6.2 } },
    obs: [B(-5.95, 10.85, 1.55, 0.65), C(6.3, -4.2, 0.72), C(6.3, -6.5, 0.85), C(6.5, -8.8, 0.65), C(-6.3, -4.3, 0.85), C(-6.4, -6.6, 0.55), C(-6.4, -8.9, 0.75),
      B(0, -10.6, 3.2, 1.6)],                                  // the steps up to the staircase hall
    keep: [C(0, 10.8, 2.0), C(-6.8, 1, 2.6), C(6.8, 1, 2.6), C(0, -8.6, 2.0), C(-6.65, 7, 1.4), C(6.65, 4.8, 1.4), C(-5.95, 9.6, 2.2), C(0, 7, 1.2)],
    nodes: [[0, 0], [0, 5], [0, -5], [-3, 1], [3, 1], [-3, 5], [3, 5], [-3, -3], [3, -3]],
    stops: [{ x: -3.2, z: -2.6, yaw: 0.6, act: 'talk' }, { x: 3.4, z: 4.6, yaw: -2.4, act: 'idle' }],
  },
  greathall: {                                                  // the central aisle (from the Entrance Hall doors)
    half: [10, 18],
    doors: { entrancehall: { x: 0, z: 17.7, ix: 0, iz: 14.6 } },
    // the house tables + benches (x +-5, z -14..17: each side is one continuous 31 m run), the dais (z < -12.3, 0.5 m up:
    // teachers never climb it), the owl lectern, the columns, the hearth and the liftable goblets corner
    obs: [B(-5, -6, 1.4, 8.0), B(-5, 9, 1.4, 8.0), B(5, -6, 1.4, 8.0), B(5, 9, 1.4, 8.0), B(0, -14.8, 7.5, 2.5), C(0, -12.4, 0.6),
      C(-9.1, -13.5, 0.8), C(9.1, -13.5, 0.8), C(-9.1, -4.5, 0.8), C(9.1, -4.5, 0.8), C(9.1, 4.5, 0.8), C(-9.1, 13.5, 0.8), C(9.1, 13.5, 0.8),
      B(-8.85, 15.9, 0.65, 1.57), C(9, 8.3, 0.55), C(9, 9.7, 0.55), C(9.05, 11.15, 0.32)],
    keep: [C(0, 16.8, 2.0), C(-8.3, 3.5, 1.8), C(-7.6, 15.9, 2.2), C(0, -12.4, 1.4)],
    nodes: [[0, 12], [0, 4], [0, -4], [-1.2, -9.5]],
    stops: [{ x: -1.6, z: -10.6, yaw: Math.PI, act: 'talk' }, { x: 1.4, z: 2.4, yaw: -1.4, act: 'idle' }],
  },
  greathall_w: {                                                // the west side aisle by the dungeon door (the tables wall it off)
    room: 'greathall', half: [10, 18],
    doors: { dungeon: { x: -9.4, z: 3.5, ix: -7.5, iz: 3.5 } },
    obs: [B(-5, -6, 1.4, 8.0), B(-5, 9, 1.4, 8.0), B(0, -14.8, 7.5, 2.5), C(-9.1, -13.5, 0.8), C(-9.1, -4.5, 0.8), C(-9.1, 13.5, 0.8), B(-8.85, 15.9, 0.65, 1.57)],
    keep: [C(-8.3, 3.5, 1.8), C(-7.6, 15.9, 2.2)],
    nodes: [[-7.55, 0], [-7.55, 7]],
    stops: [{ x: -7.55, z: 9.2, yaw: 1.57, act: 'fold' }, { x: -7.55, z: -2.2, yaw: 1.57, act: 'fold' }],
  },
  staircase: {
    half: [10, 11],
    doors: { entrancehall: { x: 0, z: 10.6, ix: 0, iz: 7.2 }, classrooms: { x: -9.6, z: 0, ix: -6.6, iz: 0.4 }, tower: { x: 9.6, z: 0, ix: 6.6, iz: 0.4 } },
    obs: [B(0, -6.6, 3.3, 5.0)],                               // the grand flight (no collider: the hero walks under it)
    keep: [C(0, 9.8, 2.0), C(-8.8, 0, 2.0), C(8.8, 0, 2.0), C(-6.6, -9.1, 1.8), C(6.6, -9.65, 1.5), C(-6, 9.55, 1.4)],
    nodes: [[0, 3], [-4.5, 2], [4.5, 2], [0, 6], [-4.5, 6], [4.5, 6]],
    stops: [{ x: -4.6, z: 4.2, yaw: 2.4, act: 'look' }, { x: 4.4, z: 3.6, yaw: -2.2, act: 'talk' }],
  },
  library: {
    half: [11, 11],
    doors: { entrancehall: { x: -10.6, z: 0, ix: -8.2, iz: 0 } },
    obs: [B(-6.2, -5.6, 0.4, 2.5), B(-6.2, 5.6, 0.4, 2.5), B(0, -4.2, 1.45, 2.6), B(0, 4.2, 1.45, 2.6), B(0, -10.05, 1.4, 0.2),
      C(9.7, -3.6, 0.36), C(9.8, 3.6, 0.32), C(7.2, 0, 0.36), B(0, 10.19, 11, 0.3), B(0, -10.19, 11, 0.3), B(10.19, 0, 0.3, 11), B(-10.19, -6.6, 0.3, 3.2), B(-10.19, 6.6, 0.3, 3.2)],
    keep: [C(-9.8, 0, 2.0), C(4, 7.4, 1.2)],
    nodes: [[-4, 0], [3.5, 0], [3.5, -4], [3.5, 4], [-3.4, -8.4], [3.3, -8.4]],
    stops: [{ x: 3.4, z: -4.2, yaw: -1.57, act: 'look' }, { x: -3.6, z: -8.3, yaw: Math.PI, act: 'look' }],
  },
  courtyard: {                                                  // outdoors (world x,z); the castle door is the doorway
    outdoor: true,
    doors: { entrancehall: { x: 0, z: 21.4, ix: 0, iz: 25.5 } },
    obs: [C(-4, 32, 0.35), C(0, 30, 0.35), C(-19, 34, 5.3), C(15.03, 30.39, 0.8), C(12.69, 29.56, 0.42), C(14.48, 32.81, 0.62), C(16.26, 32.69, 0.32)],
    keep: [C(0, 22, 3.0)],
    nodes: [[0, 26], [5, 28], [-6, 27]],
    stops: [{ x: 6.2, z: 30.5, yaw: -1.9, act: 'idle' }, { x: -7.5, z: 28.5, yaw: 1.6, act: 'talk' }],
  },
};
// home rooms (the teacher's own classroom: never materialised by roam.js; the lesson figure is there)
export const HOME_DOORS = { classrooms: { staircase: { x: 0, z: 8.6 } }, dungeon: { greathall: { x: 0, z: 9.6 } }, tower: { staircase: { x: 0, z: 7.6 } } };

// ---- the cast (phase 1: the indoor four + Sinistra) ----
// loop: places in order (each consecutive pair joined by a doorway); stop: true = pause at one of the
// room's stops, false = walk straight through door to door. The loop starts and ends at home.
export const TEACHERS = {
  mcgon:    { lesson: 'transfiguration', home: 'classrooms', model: 'mcgonagall', badge: '🐱', speed: 1.0, phase: 0.0, off: [0, 0],
    loop: [['staircase', 1], ['entrancehall', 0], ['greathall', 1], ['entrancehall', 1], ['courtyard', 1], ['entrancehall', 0], ['staircase', 0]] },
  flitwick: { lesson: 'charms', home: 'classrooms', model: 'flitwick', badge: '🪶', speed: 0.65, phase: 0.3, preset: 'flitwick', off: [1.0, 0.6],
    loop: [['staircase', 1], ['entrancehall', 0], ['library', 1], ['entrancehall', 0], ['greathall', 1], ['entrancehall', 0], ['staircase', 0]] },
  snape:    { lesson: 'potions', home: 'dungeon', model: 'snape', badge: '🧪', speed: 1.1, phase: 0.55, idle: 'FoldArms', off: [0, 0],
    loop: [['greathall_w', 1]] },   // the tables wall the dungeon door off from the aisle: he keeps to the west side
  defence:  { lesson: 'spells', home: 'classrooms', model: 'tonks', badge: '🛡️', speed: 1.15, phase: 0.8, off: [-1.0, 0.6],
    loop: [['staircase', 1], ['entrancehall', 0], ['courtyard', 1], ['entrancehall', 1], ['staircase', 0]] },
  sinistra: { lesson: 'astronomy', home: 'tower', model: null, badge: '🔭', speed: 0.9, phase: 0.15, chibi: true, off: [-1.0, -0.6],
    loop: [['staircase', 1], ['entrancehall', 0], ['library', 1], ['entrancehall', 0], ['staircase', 0]] },
};
export const ORDER = ['mcgon', 'flitwick', 'snape', 'defence', 'sinistra'];
export const NAMES = { mcgon: 'פְּרוֹפֶסוֹר מֶקְגוֹנָגֶל', flitwick: 'פְּרוֹפֶסוֹר פְלִיטִיק', snape: 'פְּרוֹפֶסוֹר סְנֵייפּ', defence: 'טוֹנְקְס', sinistra: 'פְּרוֹפֶסוֹר סִינִיסְטְרָה' };
// kind greetings with niqqud; every line names the teacher
export const LINES = {
  mcgon: ['שָׁלוֹם הָארִי! אֲנִי פְּרוֹפֶסוֹר מֶקְגוֹנָגֶל. אַל תְּאַחֵר לַשִּׁעוּר! 🐱', 'פְּרוֹפֶסוֹר מֶקְגוֹנָגֶל כָּאן. אֵיזֶה יֹפִי לִרְאוֹת אוֹתְךָ! 🐱', 'שָׁלוֹם הָארִי! מֶקְגוֹנָגֶל גֵּאָה בְּךָ. ✨'],
  flitwick: ['שָׁלוֹם הָארִי! אֲנִי פְּרוֹפֶסוֹר פְלִיטִיק! 🪶', 'פְלִיטִיק כָּאן! נְנַפְנֵף בַּשַּׁרְבִיט בְּיַחַד? 🪶', 'הוֹ, הָארִי! פְּרוֹפֶסוֹר פְלִיטִיק שָׂמֵחַ לִרְאוֹת אוֹתְךָ! ✨'],
  snape: ['שָׁלוֹם, פּוֹטֶר. פְּרוֹפֶסוֹר סְנֵייפּ בַּדֶּרֶךְ לַמַּרְתֵּף. 🧪', 'הִמְם... פּוֹטֶר. אֲנִי פְּרוֹפֶסוֹר סְנֵייפּ, וְהַשִּׁקּוּיִים מְחַכִּים. 🧪', 'פְּרוֹפֶסוֹר סְנֵייפּ אוֹמֵר: עֲבוֹדָה לֹא רָעָה, פּוֹטֶר. 🧪'],
  defence: ['הֵי הָארִי! אֲנִי טוֹנְקְס! 🛡️', 'טוֹנְקְס כָּאן! הַשֵּׂעָר שֶׁלִּי מַחְלִיף צְבָעִים! 🛡️', 'הָארִי! טוֹנְקְס אוֹמֶרֶת: אַתָּה אַמִּיץ מְאוֹד! ✨'],
  sinistra: ['שָׁלוֹם הָארִי! אֲנִי פְּרוֹפֶסוֹר סִינִיסְטְרָה. 🔭', 'פְּרוֹפֶסוֹר סִינִיסְטְרָה כָּאן. בַּלַּיְלָה נִרְאֶה כּוֹכָבִים! 🔭', 'שָׁלוֹם! סִינִיסְטְרָה מְחַפֶּשֶׂת אֶת הַיָּרֵחַ. 🌙'],
};
// which map card shows a teacher in a place (the entrance hall has no card: it is the Great Hall's lobby)
export const CARD_OF = (place) => (place === 'entrancehall' || place === 'greathall_w' ? 'greathall' : place);
export const roomOf = (place) => (ROOMS[place] && ROOMS[place].room) || place;

// ---- geometry helpers ----
export function pointFree(x, z, obs, rad = 0.35) {
  for (const c of obs) {
    if (c.type === 'circle') { if (c.r > 0 && Math.hypot(x - c.x, z - c.z) < c.r + rad) return false; }
    else if (c.type === 'box') {
      const ca = Math.cos(c.angle || 0), sa = Math.sin(c.angle || 0), dx = x - c.x, dz = z - c.z;
      const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
      if (Math.abs(lx) < c.hw + rad && Math.abs(lz) < c.hd + rad) return false;
    }
  }
  return true;
}
export function inKeep(x, z, keep) { for (const k of keep) if (Math.hypot(x - k.x, z - k.z) < k.r) return true; return false; }
export function segClear(a, b, obs, rad = 0.35) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / 0.2));
  for (let i = 0; i <= n; i++) { const k = i / n; if (!pointFree(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, obs, rad)) return false; }
  return true;
}
// shortest route a -> b through the room's waypoints (visibility graph, Dijkstra). Falls back to a straight line.
export function route(room, a, b, rad = 0.35) {
  const obs = room.obs || [];
  if (segClear(a, b, obs, rad)) return [a, b];
  const P = [a, b, ...(room.nodes || [])], n = P.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === 1) break; done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v] || v === u) continue;
      const w = Math.hypot(P[v][0] - P[u][0], P[v][1] - P[u][1]);
      if (dist[u] + w < dist[v] && segClear(P[u], P[v], obs, rad)) { dist[v] = dist[u] + w; prev[v] = u; }
    }
  }
  if (prev[1] < 0) return [a, b];
  const out = []; for (let i = 1; i >= 0; i = prev[i]) out.unshift(P[i]);
  return out;
}
export const pathLen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
export function pathAt(p, s) {
  for (let i = 1; i < p.length; i++) {
    const L = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (s <= L || i === p.length - 1) { const k = L > 0 ? Math.min(1, Math.max(0, s / L)) : 1; return { x: p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, z: p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k, yaw: Math.atan2(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) }; }
    s -= L;
  }
  return { x: p[0][0], z: p[0][1], yaw: 0 };
}

// a teacher's own spot at a shared stop: the stop moved by the teacher's `off` (metres), unless that lands in an
// obstacle or a keep-out (then the stop itself); so two teachers pausing at one stop stand side by side
export function stopFor(id, R, st) {
  const o = (TEACHERS[id] && TEACHERS[id].off) || [0, 0];
  if (!o[0] && !o[1]) return st;
  const x = +(st.x + o[0]).toFixed(2), z = +(st.z + o[1]).toFixed(2);
  if (!pointFree(x, z, R.obs || [], 0.5) || inKeep(x, z, R.keep || [])) return st;
  return { ...st, x, z };
}

// ---- the schedule ----
// A teacher's day is a list of SEGMENTS: { place, kind: 'walk'|'pause'|'gap'|'home', path?, dur, stop? }.
// 'gap' = the few seconds between two doorways (no figure anywhere). Built once per seed.
export const GAP = 2.5;
export function buildDay(id, seed) {
  const T = TEACHERS[id], r = rng(seed ^ hashStr(id)), segs = [];
  const pause = () => 8 + r() * 17;
  segs.push({ place: T.home, kind: 'home', dur: pause() + T.phase * 30 });
  let prev = T.home;
  const seq = [...T.loop, [T.home, 0]];
  for (let i = 0; i < seq.length; i++) {
    const [place, stopHere] = seq[i], next = i + 1 < seq.length ? seq[i + 1][0] : null;
    segs.push({ place: prev, kind: 'gap', dur: GAP, to: place });
    if (place === T.home) break;
    const R = ROOMS[place], din = R.doors[prev], dout = next ? R.doors[next] : null;
    if (!din || !dout) throw new Error('roam: no door ' + place + ' <-> ' + prev + '/' + next);
    const rad = T.chibi ? 0.3 : 0.35;
    if (stopHere) {
      const st = stopFor(id, R, R.stops[(r() * R.stops.length) | 0]);
      const p1 = [[din.x, din.z], ...route(R, [din.ix, din.iz], [st.x, st.z], rad)];
      segs.push({ place, kind: 'walk', path: p1, dur: pathLen(p1) / T.speed });
      segs.push({ place, kind: 'pause', at: st, dur: pause() });
      const p2 = [...route(R, [st.x, st.z], [dout.ix, dout.iz], rad), [dout.x, dout.z]];
      segs.push({ place, kind: 'walk', path: p2, dur: pathLen(p2) / T.speed });
    } else {
      const p = [[din.x, din.z], ...route(R, [din.ix, din.iz], [dout.ix, dout.iz], rad), [dout.x, dout.z]];
      segs.push({ place, kind: 'walk', path: p, dur: pathLen(p) / T.speed });
    }
    prev = place;
  }
  let t = 0; for (const s of segs) { s.t0 = t; t += s.dur; }
  return { segs, total: t };
}
// where a teacher is at clock time `t` (seconds since the loop started at home), looping the day
export function sampleDay(day, t) {
  const tt = ((t % day.total) + day.total) % day.total;
  let i = 0; while (i < day.segs.length - 1 && day.segs[i].t0 + day.segs[i].dur <= tt) i++;
  const s = day.segs[i], u = tt - s.t0;
  if (s.kind === 'walk') { const p = pathAt(s.path, u * (pathLen(s.path) / s.dur)); return { seg: i, place: s.place, phase: 'walk', x: p.x, z: p.z, yaw: p.yaw, u }; }
  if (s.kind === 'pause') return { seg: i, place: s.place, phase: 'pause', x: s.at.x, z: s.at.z, yaw: s.at.yaw, act: s.at.act, u };
  if (s.kind === 'gap') return { seg: i, place: null, from: s.place, to: s.to, phase: 'between', u };
  return { seg: i, place: s.place, phase: 'home', u };
}
