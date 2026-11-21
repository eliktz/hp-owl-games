// Batch 7: the free-play wheel works on the castle's REAL fire and light, not only on the spell-spot props.
//   * every interior wall torch: Aguamenti / Glacius put the aimed torch out (steam hiss / frost puff, the flame
//     shrinks away, its baked light pool and wall wash dim); Incendio relights it (the flame pops back with sparks);
//     Lumos Maxima relights every torch in the room at once.
//   * the common-room hearth: Aguamenti / Glacius put it out (steam, a faint ember bed), Incendio lights it with a
//     roar of sparks, Engorgio makes it big for ~8 s, Reducio small for ~8 s.
//   * the real candles (the Great Hall's floating drift + table candles, mantel / desk candles, chandeliers) as a
//     GROUP per room: Aguamenti / Glacius aimed up put out the nearest cluster of ~12, which relight by themselves
//     after 30 s one by one with a twinkle; Incendio relights them all at once; Nox dims every candle to half for 10 s.
//     (This replaces batch 4's all-or-nothing Great Hall candle switch in freecast-yard.js.)
//   * dark rooms (dungeon, grand staircase, the library when it is not day outside): with Lumos on the ambient lifts
//     clearly and the wand's warm floor pool grows; Lumos Maxima lifts it more while it shines (freecast.js applies it).
// Targets register themselves when a room streams in and are dropped when it goes (rooms are rebuilt on every visit,
// so a room that is left and re-entered is all lit again). They never take duelling spells (their spell lists), and
// a real target only wins when no spell-spot prop is closer (freecast.js best()); the overhead candle group always
// gives way to a spot prop in reach.
// Techniques (no new draw calls, no lights, no textures):
//   flames  - merged torch flames (shared material, mergeStatic): that torch's vertices in the merged mesh are scaled
//             toward the flame's foot (recorded once per visit); unmerged flames (staircase / dungeon / tower torches,
//             chandelier cones): the mesh's own scale / visibility; the instanced candles: a per-instance size array
//             that rooms.js' candle tick multiplies in (fl.userData.real.flameK).
//   light   - bakeLight() records each light marker's vertex range in the room's ONE 'lightPools' mesh
//             (userData.lightVerts, Great Hall candle cells in group.userData.candleCells); dimming scales those
//             vertex colours from a copy taken on the first change. Nothing is touched until a spell lands.
// Nothing is allocated per frame (the per-visit arrays are built once when the room streams in).
import { Vector3 } from 'three';

const REACH = 8;
const DARK_ROOMS = { dungeon: 1, staircase: 1 };
const LIFT = 0.75, MAX_LIFT = 0.55;     // extra ambient: Lumos on in a dark room / Lumos Maxima at full strength
const CLUSTER = 12, RELIGHT = 30, NOX_T = 10;

export function createReal({ player, interiors, env, fun, emit, burst, tip, tipV, TARGETS, SP, scene }) {
  const pos = player.pos;
  let T = 0, R = null, seen = null, builds = 0;
  const v0 = new Vector3(), v1 = new Vector3();
  const log = { douses: 0, lights: 0, candleOuts: 0, candleLights: 0, autoLights: 0, fireOuts: 0, fireLights: 0, big: 0, small: 0, nox: 0, maxima: 0 };
  let maxLight = null;   // freecast-castle's Lumos Maxima point light (read, never changed)

  // ---------------- the room's baked light mesh ----------------
  function poolsOf(group) {
    const m = group.getObjectByName('lightPools');
    const ca = m && m.geometry.attributes.color;
    return ca ? { ca, orig: null, dirty: false } : null;
  }
  // owner: { v: [a, b] vertex range, units: [...] | null, min, k (written), fn: () => wanted k }
  function writeOwner(o) {
    const P = R.pools; if (!P || !o.v) return;
    const want = o.fn();
    if (Math.abs(want - o.k) < 0.004) return;
    if (!P.orig) P.orig = Float32Array.from(P.ca.array);   // first change this visit: keep the baked colours
    o.k = want;
    const a = P.ca.array, src = P.orig;
    for (let i = o.v[0] * 3, e = o.v[1] * 3; i < e; i++) a[i] = src[i] * want;
    P.dirty = true;
  }
  const meanK = (units) => { let s = 0; for (const u of units) s += Math.min(1, u.shown); return units.length ? s / units.length : 1; };
  function owner(v, units, min) { const o = { v, units, min, k: 1, fn: null }; o.fn = () => min + (1 - min) * meanK(units); return o; }

  // ---------------- flame units ----------------
  // u: { kind: 'inst'|'mesh'|'vis'|'merged', k, kTo, rate, shown, delay, pop, owners: [], world: Vector3 (flame position), ... }
  function applyFlame(u) {
    const dim = u.candle && R ? R.dimF : 1;
    const popK = u.pop > 0 ? 1 + 0.45 * Math.sin((1 - u.pop / 0.35) * Math.PI) : 1;
    const s = Math.max(0, u.k) * dim * popK;
    u.shown = Math.max(0, u.k) * dim;
    if (u.kind === 'inst') u.arr[u.i] = s;
    else if (u.kind === 'mesh') { const q = Math.max(s, 0.001); u.mesh.scale.setScalar(q); u.mesh.visible = s > 0.01; if (u.glow) { u.glow.scale.setScalar(q); u.glow.visible = s > 0.01; } }
    else if (u.kind === 'vis') u.mesh.visible = s > 0.5;
    else if (u.kind === 'merged') {
      const pa = u.attr.array, o = u.orig, px = u.pivot.x, py = u.pivot.y, pz = u.pivot.z;
      for (let j = 0; j < u.idx.length; j++) { const i = u.idx[j] * 3; pa[i] = px + (o[j * 3] - px) * s; pa[i + 1] = py + (o[j * 3 + 1] - py) * s; pa[i + 2] = pz + (o[j * 3 + 2] - pz) * s; }
      u.attr.needsUpdate = true;
    }
    for (const ow of u.owners) ow.dirty = true;
  }
  // the vertices of one flame inside a merged mesh (built once per visit)
  function mergedUnits(mesh, list) {   // list: [{ c: local centre, pivot: local foot, u }]
    const pa = mesh.geometry.attributes.position, buckets = list.map(() => []);
    for (let i = 0; i < pa.count; i++) {
      let bi = -1, bd = 0.36 * 0.36;
      for (let j = 0; j < list.length; j++) { const c = list[j].c, dx = pa.getX(i) - c.x, dy = pa.getY(i) - c.y, dz = pa.getZ(i) - c.z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bi = j; } }
      if (bi >= 0) buckets[bi].push(i);
    }
    list.forEach((it, j) => {
      const idx = Uint32Array.from(buckets[j]), orig = new Float32Array(idx.length * 3);
      idx.forEach((vi, n) => { orig[n * 3] = pa.getX(vi); orig[n * 3 + 1] = pa.getY(vi); orig[n * 3 + 2] = pa.getZ(vi); });
      Object.assign(it.u, { kind: 'merged', attr: pa, idx, orig, pivot: it.pivot.clone() });
    });
  }
  const newUnit = (extra) => Object.assign({ k: 1, kTo: 1, rate: 6, shown: 1, delay: 0, pop: 0, owners: [], world: new Vector3(), candle: false, outAt: 0, relightAt: 0 }, extra);

  // ---------------- per-visit scan of the room ----------------
  function scan(room, id) {
    const g = room.group; g.updateMatrixWorld(true);
    const S = { id, room, group: g, origin: g.position, pools: poolsOf(g), torches: [], candles: [], owners: [], fire: null, targets: [], dimF: 1, dimTo: 1, dimUntil: 0, dirtyAll: false };
    R = S;
    const L = (o) => o.userData.lightVerts || null;
    // --- torches ---
    const merged = new Map();   // material -> [{ c, pivot, u }]
    const tgs = []; g.traverse(o => { if (o.userData && o.userData.torch) tgs.push(o); });
    tgs.forEach((tg, i) => {
      const { flame, glow } = tg.userData.torch;
      const u = newUnit({ i, rate: 7, tg });
      tg.localToWorld(u.world.copy(flame.position));
      if (flame.parent) Object.assign(u, { kind: 'mesh', mesh: flame, glow: glow && glow.parent ? glow : null });
      else {
        const c = g.worldToLocal(u.world.clone());
        let l = merged.get(flame.material); if (!l) merged.set(flame.material, l = []);
        l.push({ c, pivot: c.clone().setY(c.y - 0.17), u });
      }
      // wall normal (toward the room's middle along the nearer axis) for aim()
      const lx = tg.position.x, lz = tg.position.z; u.front = Math.abs(lx) / 1 > Math.abs(lz) * 0.6 && Math.abs(lx) > 3 ? [-Math.sign(lx), 0] : [0, -Math.sign(lz)];
      const v = L(tg); if (v) { const ow = owner(v, [u], 0.08); u.owners.push(ow); S.owners.push(ow); }
      u.lit = true; u.pend = 0; u.pendK = null;
      S.torches.push(u);
    });
    for (const [mat, list] of merged) { const mesh = g.children.find(m => m.isMesh && !m.isInstancedMesh && m.material === mat); if (mesh) mergedUnits(mesh, list); else list.forEach(it => { it.u.kind = 'none'; }); }
    S.torches = S.torches.filter(u => u.kind !== 'none');
    // --- candles: the instanced drift / table / mantel / desk candles ---
    const fl = g.getObjectByName('candle-flames');
    const cellOf = new Map();
    if (fl && fl.userData.real) {
      const { flameK, spots, markers } = fl.userData.real;
      spots.forEach((p, i) => {
        const u = newUnit({ kind: 'inst', arr: flameK, i, candle: true, rate: 5 });
        u.world.set(p.x, p.y + 0.3, p.z).add(g.position);
        const v = L(markers[i]); if (v) { const ow = owner(v, [u], 0); u.owners.push(ow); S.owners.push(ow); }
        if (p.y >= 3) { const key = Math.floor(p.x / 4) + ',' + Math.floor(p.z / 4); let a = cellOf.get(key); if (!a) cellOf.set(key, a = []); a.push(u); }
        S.candles.push(u);
      });
    }
    for (const c of g.userData.candleCells || []) { const us = cellOf.get(c.i + ',' + c.j); if (!us) continue; const ow = owner(c.v, us, 0.15); S.owners.push(ow); for (const u of us) u.owners.push(ow); }
    // --- chandeliers (their cones count as candles of the group) ---
    const chs = []; g.traverse(o => { if (o.userData && o.userData.flames && o.userData.light && o.userData.light.k === 'chandelier') chs.push(o); });
    for (const ch of chs) {
      const us = [], ml = [];
      for (const f of ch.userData.flames) {
        const u = newUnit({ candle: true, rate: 5 }); ch.localToWorld(u.world.copy(f.position));
        if (f.parent) Object.assign(u, { kind: 'vis', mesh: f });   // (the rooms' own updates may scale these: visibility only)
        else ml.push({ c: f.position.clone(), pivot: f.position.clone().setY(f.position.y - 0.17), u });
        us.push(u);
      }
      if (ml.length) { const mesh = ch.children.find(m => m.isMesh && m.material === ch.userData.flames[0].material); if (mesh) mergedUnits(mesh, ml); else ml.forEach(it => { it.u.kind = 'none'; }); }
      const live = us.filter(u => u.kind !== 'none');
      const v = L(ch); if (v && live.length) { const ow = owner(v, live, 0.1); S.owners.push(ow); for (const u of live) u.owners.push(ow); }
      S.candles.push(...live);
    }
    // --- the hearth ---
    const fire = (() => { let f = null; g.traverse(o => { if (!f && o.userData && o.userData.ctl && o.isMesh) f = o; }); return f; })();
    if (fire) {
      const F = S.fire = { mesh: fire, ctl: fire.userData.ctl, lit: true, level: 0, sizeT: 0, roar: 0, pend: 0, pendK: null, light: 1, ember: 0, world: new Vector3() };
      fire.getWorldPosition(F.world); F.world.y = g.position.y + 1.0;
      const marks = [fire.parent]; g.traverse(o => { if (o.userData && o.userData.hearthLight) marks.push(o); });
      for (const m of marks) { const v = L(m); if (v) { const ow = { v, k: 1, min: 0, fn: () => F.light }; S.owners.push(ow); } }
    }
    registerTargets(S);
    return S;
  }

  // ---------------- targets ----------------
  const cand = new Float32Array(512), pick = new Int16Array(CLUSTER);
  const ahead = (out, d) => { const f = player.yaw; return out.set(pos.x + Math.sin(f) * d, pos.y, pos.z + Math.cos(f) * d); };
  // the up-to-12 candles nearest the point ~4 m ahead of Harry that are lit (want = 1) or out (want = 0)
  function cluster(want) {
    const C = R.candles; ahead(v1, 4);
    let n = 0;
    for (let i = 0; i < C.length && i < 512; i++) { const u = C[i], lit = u.kTo > 0.5; cand[i] = (lit === (want === 1)) ? Math.hypot(u.world.x - v1.x, u.world.z - v1.z) : 1e9; }
    for (let k = 0; k < CLUSTER; k++) {
      let bi = -1, bd = 1e8;
      for (let i = 0; i < C.length && i < 512; i++) if (cand[i] < bd) { bd = cand[i]; bi = i; }
      if (bi < 0) break; pick[n++] = bi; cand[bi] = 1e9;
    }
    return n;
  }
  function clusterCentre(want, out) {
    const n = cluster(want); if (!n) return null;
    out.set(0, 0, 0); for (let k = 0; k < n; k++) out.add(R.candles[pick[k]].world);
    return out.multiplyScalar(1 / n);
  }
  const live = (S) => R === S && interiors.room === S.room;
  function anyCandle(S, want) { for (const u of S.candles) if ((u.kTo > 0.5) === (want === 1)) return true; return false; }
  function registerTargets(S) {
    const add = (t) => { t.real = true; t.indoor = S.id; S.targets.push(t); TARGETS.push(t); };
    S.torches.forEach((u, i) => add({
      id: 'real-torch-' + S.id + '-' + i, spells: ['incendio', 'aguamenti', 'glacius'], front: u.front, unit: u,
      at: (o) => o.copy(u.world),
      ok: (k) => live(S) && !u.pend && (k === 'incendio' ? !u.lit : u.lit),
      cast: (k) => { u.pend = k === 'incendio' ? 0.4 : 0.55; u.pendK = k; },
    }));
    if (S.fire) {
      const F = S.fire;
      add({ id: 'real-fire-' + S.id, spells: ['incendio', 'aguamenti', 'glacius', 'engorgio', 'reducio'], front: [0, 1],
        at: (o) => o.copy(F.world),
        ok: (k) => live(S) && !F.pend && (k === 'incendio' ? !F.lit : F.lit),
        cast: (k) => { F.pend = k === 'incendio' ? 0.4 : k === 'engorgio' || k === 'reducio' ? 0.35 : 0.55; F.pendK = k; } });
    }
    if (S.candles.length) {
      add({ id: 'real-candles-' + S.id, spells: ['incendio', 'aguamenti', 'glacius'], overhead: true,
        at: (o) => clusterCentre(1, o) || clusterCentre(0, o) || o.set(pos.x, pos.y + 3, pos.z),
        ok: (k) => live(S) && !S.cPend && anyCandle(S, k === 'incendio' ? 0 : 1),
        cast: (k) => { S.cPend = k === 'incendio' ? 0.4 : 0.6; S.cPendK = k; } });
    }
  }
  function dropTargets(S) {
    for (const t of S.targets) { const i = TARGETS.indexOf(t); if (i >= 0) TARGETS.splice(i, 1); }
    S.targets.length = 0;
  }

  // ---------------- effects ----------------
  function steam(p, n = 16, spread = 0.3) {
    for (let i = 0; i < n; i++) emit(p.x + (Math.random() - 0.5) * spread, p.y, p.z + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 0.35, 0.6 + Math.random() * 0.7, (Math.random() - 0.5) * 0.35, 1.3 + Math.random() * 0.5, 0.36 + Math.random() * 0.2, Math.random() < 0.5 ? 0x8a949e : 0x6a727a, 0.25, 0.6);
    fun.sfx.noise(0.8, 0.14, 0, 3200, 0.8, 'highpass');   // the hiss
  }
  function frost(p, n = 18) {
    burst(p.x, p.y, p.z, 0xdff4ff, n, 1.4, 0.8, 0.2, -0.4);
    for (let i = 0; i < 8; i++) emit(p.x + (Math.random() - 0.5) * 0.3, p.y, p.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3, 1.2, 0.34, 0x9ab8d0, 0.1, 0.6);
    fun.sfx.noise(0.5, 0.1, 0, 5200, 0.7, 'highpass'); fun.sfx.tink(4);
  }
  const sparks = (p, n = 20, spd = 2.2) => burst(p.x, p.y, p.z, 0xff9a30, n, spd, 0.7, 0.22, 1);

  // ---------------- per-frame ----------------
  function stepUnit(u, dt) {
    if (u.delay > 0) { u.delay -= dt; return; }
    let ch = false;
    if (u.k !== u.kTo) { const d = u.kTo - u.k, s = u.rate * dt; u.k = Math.abs(d) <= s ? u.kTo : u.k + Math.sign(d) * s; ch = true; }
    if (u.pop > 0) { u.pop = Math.max(0, u.pop - dt); ch = true; }
    if (ch || R.dimMoving) applyFlame(u);
  }
  function tickRoom(dt) {
    const S = R;
    // Nox dim (candles only)
    if (S.dimUntil && T > S.dimUntil) { S.dimUntil = 0; S.dimTo = 1; }
    S.dimMoving = false;
    if (S.dimF !== S.dimTo) { const d = S.dimTo - S.dimF, s = dt * 1.5; S.dimF = Math.abs(d) <= s ? S.dimTo : S.dimF + Math.sign(d) * s; S.dimMoving = true; }
    // torches
    for (const u of S.torches) {
      if (u.pend > 0) {
        u.pend -= dt;
        if (u.pend <= 0) {
          u.pend = 0;
          if (u.pendK === 'incendio') { if (!u.lit) { u.lit = true; u.k = 0.15; u.kTo = 1; u.pop = 0.35; u.rate = 5; sparks(u.world); fun.sfx.whoosh(); fun.sfx.pop(); log.lights++; } }
          else if (u.lit) { u.lit = false; u.kTo = 0; u.rate = 4; if (u.pendK === 'glacius') frost(u.world); else steam(u.world); log.douses++; }
        }
      }
      stepUnit(u, dt);
    }
    // candles: a pending cast, then the auto-relight twinkle
    if (S.cPend > 0) {
      S.cPend -= dt;
      if (S.cPend <= 0) {
        S.cPend = 0;
        if (S.cPendK === 'incendio') {
          let n = 0;
          for (const u of S.candles) if (u.kTo < 0.5) { u.kTo = 1; u.rate = 6; u.delay = Math.random() * 0.3; u.pop = 0.35; u.relightAt = 0; if (n++ < 40) burst(u.world.x, u.world.y, u.world.z, 0xffb040, 3, 1, 0.5, 0.16, 0); }
          log.candleLights++; fun.sfx.whoosh(); fun.sfx.chime();
        } else {
          const n = cluster(1);
          for (let k = 0; k < n; k++) {
            const u = S.candles[pick[k]]; u.kTo = 0; u.rate = 5; u.delay = Math.random() * 0.25; u.relightAt = T + RELIGHT + k * 0.45;
            const p = u.world;
            if (S.cPendK === 'glacius') burst(p.x, p.y, p.z, 0xdff4ff, 3, 0.8, 0.6, 0.14, -0.3);
            else emit(p.x, p.y, p.z, (Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.2, 1.4, 0.3, 0x8a929c, 0.1, 0.5);
          }
          if (n) { log.candleOuts++; if (S.cPendK === 'glacius') { fun.sfx.noise(0.5, 0.08, 0, 5200, 0.7, 'highpass'); fun.sfx.tink(4); } else fun.sfx.noise(0.7, 0.1, 0, 3000, 0.8, 'highpass'); }
        }
      }
    }
    for (const u of S.candles) {
      if (u.relightAt && u.kTo < 0.5 && T >= u.relightAt) {
        u.relightAt = 0; u.kTo = 1; u.rate = 4; u.pop = 0.35; log.autoLights++;
        burst(u.world.x, u.world.y, u.world.z, 0xffe08a, 3, 0.7, 0.5, 0.14, 0);
        if (Math.random() < 0.3) fun.sfx.tink((Math.random() * 6) | 0);
      }
      stepUnit(u, dt);
    }
    // the hearth
    const F = S.fire;
    if (F) {
      if (F.pend > 0) {
        F.pend -= dt;
        if (F.pend <= 0) {
          F.pend = 0; const k = F.pendK, p = v0.copy(F.world);
          if (k === 'incendio') { if (!F.lit) { F.lit = true; F.level = 0; F.roar = 0.9; burst(p.x, p.y - 0.3, p.z, 0xff9a30, 46, 3.2, 1.0, 0.26, 1.5); burst(p.x, p.y, p.z, 0xffe08a, 16, 2, 0.6, 0.3, 0); fun.sfx.boom(); fun.sfx.whoosh(); fun.sfx.chime(); log.fireLights++; } }
          else if (k === 'aguamenti' || k === 'glacius') { if (F.lit) { F.lit = false; F.level = 0; F.sizeT = 0; F.roar = 0; if (k === 'glacius') { frost(p, 30); steam(p.setY(p.y - 0.4), 14, 1.6); } else { steam(p.setY(p.y - 0.4), 30, 1.8); fun.sfx.noise(1.4, 0.16, 0.2, 2400, 0.6, 'highpass'); } log.fireOuts++; } }
          else if (F.lit) {   // Engorgio / Reducio
            F.level = k === 'engorgio' ? 1 : -1; F.sizeT = 8;
            if (k === 'engorgio') { burst(p.x, p.y, p.z, 0xff9a30, 30, 2.8, 0.9, 0.26, 1); fun.sfx.boom(); log.big++; } else { burst(p.x, p.y - 0.3, p.z, 0xffc070, 10, 0.8, 0.5, 0.14, 0); fun.sfx.tink(5); log.small++; }
          }
        }
      }
      if (F.sizeT > 0) { F.sizeT -= dt; if (F.sizeT <= 0) { F.sizeT = 0; F.level = 0; fun.sfx.soft(); } }
      if (F.roar > 0) F.roar = Math.max(0, F.roar - dt);
      // targets for the hearth's size and glow (rooms.js multiplies them into its own flicker)
      let sx = 1, sy = 1, gl = 1, li = 1;
      if (!F.lit) { sx = 0.92; sy = 0.3; gl = 0.5; li = 0.12; }   // a low ember bed (sy 0.3 keeps it above the hearth stone)
      else if (F.level > 0) { sx = 1.45; sy = 1.9; gl = 1.55; li = 1.45; }
      else if (F.level < 0) { sx = 0.62; sy = 0.48; gl = 0.7; li = 0.55; }
      if (F.roar > 0) { const r = Math.sin((F.roar / 0.9) * Math.PI); sx += 0.3 * r; sy += 0.7 * r; gl += 0.6 * r; li += 0.3 * r; }
      const c = F.ctl, a = Math.min(1, dt * (F.lit ? 4 : 2.5));
      if (Math.abs(c.sx - sx) + Math.abs(c.sy - sy) + Math.abs(c.glow - gl) > 0.002) { c.sx += (sx - c.sx) * a; c.sy += (sy - c.sy) * a; c.glow += (gl - c.glow) * a; }
      if (Math.abs(F.light - li) > 0.003) F.light += (li - F.light) * a;
      if (!F.lit && Math.random() < dt * 1.5) emit(F.world.x + (Math.random() - 0.5) * 1.6, F.world.y - 0.85, F.world.z, (Math.random() - 0.5) * 0.2, 0.4 + Math.random() * 0.3, 0, 1.0, 0.07, 0xff7a2a, 0.2);   // a few embers
    }
    // write changed light owners
    for (const o of S.owners) { if (o.dirty || o.units === undefined || S.dimMoving) { o.dirty = false; writeOwner(o); } }
    if (S.pools && S.pools.dirty) { S.pools.ca.needsUpdate = true; S.pools.dirty = false; }
  }

  // ---------------- outdoors: Hagrid's door lantern (the only real flame near the doors at walking height) ----------------
  let OUT = null, outTried = false;
  function buildOut() {
    outTried = true;
    const hut = scene.getObjectByName('hagrid-hut'), Lp = hut && hut.userData.lantern;
    const mesh = hut && hut.getObjectByName('hut-glow');
    if (!Lp || !mesh) return;
    hut.updateMatrixWorld(true);
    const u = newUnit({ rate: 6, lit: true, pend: 0, pendK: null });
    const c = new Vector3(Lp.x, Lp.y, Lp.z);
    mergedUnits(mesh, [{ c, pivot: c.clone().setY(c.y - 0.14), u }]);
    if (!u.idx || !u.idx.length) return;
    hut.localToWorld(u.world.copy(c));
    const fx = u.world.x - hut.position.x, fz = u.world.z - hut.position.z, fl = Math.hypot(fx, fz) || 1;
    const t = { id: 'real-lantern-hut', real: true, spells: ['incendio', 'aguamenti', 'glacius'], unit: u, front: [fx / fl, fz / fl],
      at: (o) => o.copy(u.world), ok: (k) => !interiors.active && !u.pend && (k === 'incendio' ? !u.lit : u.lit),
      cast: (k) => { u.pend = k === 'incendio' ? 0.4 : 0.55; u.pendK = k; } };
    TARGETS.push(t);
    OUT = { u, t };
  }
  function tickOut(dt) {
    const u = OUT.u;
    if (u.pend > 0) {
      u.pend -= dt;
      if (u.pend <= 0) {
        u.pend = 0;
        if (u.pendK === 'incendio') { if (!u.lit) { u.lit = true; u.k = 0.15; u.kTo = 1; u.pop = 0.35; sparks(u.world, 14, 1.6); fun.sfx.whoosh(); fun.sfx.pop(); log.lights++; } }
        else if (u.lit) { u.lit = false; u.kTo = 0; if (u.pendK === 'glacius') frost(u.world, 12); else steam(u.world, 12, 0.2); log.douses++; }
      }
    }
    if (u.delay > 0) { u.delay -= dt; return; }
    let ch = false;
    if (u.k !== u.kTo) { const d = u.kTo - u.k, s = u.rate * dt; u.k = Math.abs(d) <= s ? u.kTo : u.k + Math.sign(d) * s; ch = true; }
    if (u.pop > 0) { u.pop = Math.max(0, u.pop - dt); ch = true; }
    if (ch) applyFlame(u);
  }

  function tick(dt, inside) {
    T += dt;
    if (!outTried && T > 1) { try { buildOut(); } catch (e) { console.warn('[freecast] hut lantern skipped -', e && e.message || e); OUT = null; } }
    if (OUT && !interiors.active) tickOut(dt);
    const r = interiors.room;
    if (r !== seen) {
      seen = r;
      if (R) { dropTargets(R); R = null; }
      if (r && r.group && interiors.active) { try { scan(r, interiors.active); builds++; } catch (e) { console.warn('[freecast] real fire and light skipped -', e && e.message || e); if (R) dropTargets(R); R = null; } }
    }
    if (R && live(R)) { const t0 = performance.now(); tickRoom(dt); const ms = performance.now() - t0; perf.n++; perf.ms += ms; if (ms > perf.max) perf.max = ms; }
  }
  const perf = { n: 0, ms: 0, max: 0 };   // (debug: the cost of the room tick)

  // ---------------- hooks for freecast.js ----------------
  const darkRoom = () => { const a = interiors.active; return !!a && (!!DARK_ROOMS[a] || (a === 'library' && !!env && env.time !== 'day')); };
  // extra ambient while Lumos is on (freecast.js multiplies it by the Lumos fade)
  function darkLift() { return darkRoom() ? LIFT : 0; }
  // extra ambient from Lumos Maxima in a dark room (its own light's intensity is the fade: 60 at full indoors)
  function maximaLift() {
    if (!darkRoom()) return 0;
    if (!maxLight) maxLight = scene.getObjectByName('freecast-maxima-light');
    return maxLight ? MAX_LIFT * Math.min(1, maxLight.intensity / 60) : 0;
  }
  function onLumos(on) {   // the Lumos toggle: Nox dims the room's candles to half for 10 s; Lumos brings them back
    if (!R || !live(R) || !R.candles.length) return;
    if (!on) { R.dimTo = 0.5; R.dimUntil = T + NOX_T; log.nox++; } else { R.dimTo = 1; R.dimUntil = 0; }
  }
  function onMaxima() {    // Lumos Maxima relights every torch of the room (staggered pops)
    if (!R || !live(R)) return 0;
    let n = 0;
    for (const u of R.torches) if (!u.lit && !u.pend) { u.pend = 0.5 + n * 0.12; u.pendK = 'incendio'; n++; }
    if (n) log.maxima++;
    return n;
  }

  // ---------------- debug (window.__game.freecast.real) ----------------
  const api = {
    state: () => {
      const S = R && live(R) ? R : null;
      return {
        room: S ? S.id : null, builds, T: +T.toFixed(2), ...log,
        torches: S ? { n: S.torches.length, lit: S.torches.filter(u => u.lit).length, out: S.torches.filter(u => !u.lit).length, kinds: S.torches.map(u => u.kind[0]).join('') } : null,
        fire: S && S.fire ? { lit: S.fire.lit, level: S.fire.level, sizeT: +S.fire.sizeT.toFixed(1), sy: +S.fire.ctl.sy.toFixed(2), light: +S.fire.light.toFixed(2) } : null,
        candles: S ? { n: S.candles.length, out: S.candles.filter(u => u.kTo < 0.5).length, shownOut: S.candles.filter(u => u.shown < 0.05).length, dim: +S.dimF.toFixed(2) } : null,
        lumosLift: darkRoom() ? LIFT : 0, dark: darkRoom(), owners: S ? S.owners.length : 0,
        poolsChanged: !!(S && S.pools && S.pools.orig), perf: { frames: perf.n, avgMs: +(perf.ms / Math.max(1, perf.n)).toFixed(3), maxMs: +perf.max.toFixed(2) },
      };
    },
    ids: () => (R ? R.targets.map(t => t.id) : []),
    lantern: () => (OUT ? { lit: OUT.u.lit, k: +OUT.u.k.toFixed(2), verts: OUT.u.idx.length, x: +OUT.u.world.x.toFixed(2), y: +OUT.u.world.y.toFixed(2), z: +OUT.u.world.z.toFixed(2) } : null),
    // stand Harry d metres in front of a real target, facing it
    aim(id, d = 3) {
      const t = (R && R.targets.find(x => x.id === id)) || (OUT && OUT.t.id === id ? OUT.t : null); if (!t) return null;
      t.at(v0); let fx = 0, fz = 1;
      if (t.front) { fx = t.front[0]; fz = t.front[1]; } else { const dx = pos.x - v0.x, dz = pos.z - v0.z, l = Math.hypot(dx, dz) || 1; fx = dx / l; fz = dz / l; }
      const x = v0.x + fx * d, z = v0.z + fz * d;
      player.yaw = Math.atan2(v0.x - x, v0.z - z);
      try { player.teleport(x, z); } catch { /* plain move */ }
      pos.x = x; pos.z = z;
      return { x: +x.toFixed(2), z: +z.toFixed(2), tx: +v0.x.toFixed(2), ty: +v0.y.toFixed(2), tz: +v0.z.toFixed(2) };
    },
    // the light-pool colour of one target's light (for tests): mean of its first owner's range, 0..1 of baked
    poolK: (id) => { const t = R && R.targets.find(x => x.id === id); if (!t) return null; if (t.unit && t.unit.owners[0]) return +t.unit.owners[0].k.toFixed(2); if (/fire/.test(id) && R.fire) return +R.fire.light.toFixed(2); return null; },
  };
  return { tick, darkLift, maximaLift, onLumos, onMaxima, api, REACH };
}
