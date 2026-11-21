// Free-play spells batch 5 (freecast.js): Tarantallegra, Rictusempra, Glacius, Periculum, Ascendio.
//   Tarantallegra 💃  anywhere: musical notes fly from the wand; at a duelling dummy: a silly ~5 s jig (freecast-duel.js).
//   Rictusempra   🤣  anywhere: a puff of silver feathers; at a dummy: it shakes with giggles ~4 s, "חה" bubbles pop;
//                     the old wardrobe shakes and giggles too (freecast-duel.js).
//   Glacius       ❄️  an icy-blue jet with snowflakes; freezes the full courtyard birdbath (Incendio melts it), puts out
//                     the Entrance Hall brazier and the courtyard lantern with a frost puff, frosts Hagrid's pumpkins ~20 s
//                     (freecast-castle.js / freecast-yard.js hold those targets).
//   Periculum     🎆  outdoors: 4 house-coloured firework bursts high in front of the camera over ~4 s; indoors: a small
//                     shower of red and gold sparks under the ceiling.
//   Ascendio      🚀  Harry springs up (~3 m outdoors, ~1.5 m indoors) with a sparkle trail and lands softly where he was.
//                     Only the model's drawn height is offset (pos, colliders, camera untouched) and it is put back exactly;
//                     the cast is ignored during a course, a lesson, a match, a room change or while already in the air.
// Cost: the glyph sprites (notes, feathers, snowflakes, "חה", firework sparks) are pooled InstancedMeshes, one per kind,
// visible only while one is alive (0 draw calls idle); no lights; textures are 64 px canvases.
import { InstancedMesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, DoubleSide, Matrix4, Vector3, Quaternion, Color } from 'three';

const _m4 = new Matrix4(), _q = new Quaternion(), _q2 = new Quaternion(), _v = new Vector3(), _s = new Vector3(), _c = new Color(), _z = new Vector3(0, 0, 1);

// ---- glyph textures (64 px, white on transparent: the instance colour tints them) ----
function glyphTex(kind, glowTex) {
  if (kind === 'spark') return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'note') {   // a beamed pair of quavers
    g.lineWidth = 5; g.beginPath(); g.moveTo(22, 46); g.lineTo(22, 12); g.lineTo(50, 6); g.lineTo(50, 40); g.stroke();
    g.lineWidth = 7; g.beginPath(); g.moveTo(22, 14); g.lineTo(50, 8); g.stroke();
    for (const [x, y] of [[15, 47], [43, 41]]) { g.beginPath(); g.ellipse(x, y, 9, 7, -0.4, 0, Math.PI * 2); g.fill(); }
  } else if (kind === 'flake') {   // a six-armed snowflake
    g.lineWidth = 4; g.translate(32, 32);
    for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -27); g.moveTo(0, -15); g.lineTo(-8, -23); g.moveTo(0, -15); g.lineTo(8, -23); g.stroke(); }
  } else if (kind === 'feather') {   // a soft curved feather
    g.translate(32, 32); g.rotate(-0.6);
    g.beginPath(); g.moveTo(0, -29); g.bezierCurveTo(14, -18, 13, 12, 2, 24); g.lineTo(-2, 24); g.bezierCurveTo(-13, 12, -14, -18, 0, -29); g.globalAlpha = 0.85; g.fill();
    g.globalAlpha = 1; g.strokeStyle = 'rgba(120,130,150,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -26); g.lineTo(0, 30); g.stroke();
    g.lineWidth = 1; for (let y = -18; y < 20; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(9, y - 5); g.moveTo(0, y); g.lineTo(-9, y - 5); g.stroke(); }
  } else if (kind === 'haha') {   // a round speech bubble with "חה"
    g.beginPath(); g.arc(32, 30, 27, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(16, 50); g.lineTo(10, 62); g.lineTo(28, 54); g.fill();
    g.fillStyle = '#5a2a10'; g.font = 'bold 30px Rubik, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('חה', 32, 32);
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

// pooled glyph sprites: glyph(kind, x, y, z, vx, vy, vz, life, size, hex, pop = false) — camera-facing, spinning a little
export function createGlyphs({ scene, camera, glowTex }) {
  const KINDS = { note: 40, flake: 70, feather: 40, haha: 16, spark: 200 };
  const pools = {};
  let alive = 0;
  for (const [kind, n] of Object.entries(KINDS)) {
    const mat = new MeshBasicMaterial({ map: glyphTex(kind, glowTex), transparent: true, depthWrite: false, side: DoubleSide, fog: false });
    const m = new InstancedMesh(new PlaneGeometry(1, 1), mat, n);
    m.name = 'freecast-glyph-' + kind; m.frustumCulled = false; m.visible = false; m.raycast = () => {}; m.renderOrder = 6; m.count = 0;
    for (let i = 0; i < n; i++) m.setColorAt(i, _c.setRGB(1, 1, 1));
    scene.add(m);
    pools[kind] = { m, P: Array.from({ length: n }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.2, r: 1, g: 1, b: 1, rot: 0, spin: 0, pop: false, grav: 0, drag: 0 })), n: 0 };
  }
  function glyph(kind, x, y, z, vx, vy, vz, life, size, hex, pop = false, grav = 0, drag = 0) {
    const pl = pools[kind]; if (!pl) return;
    const p = pl.P.find(q => q.life <= 0); if (!p) return;
    Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, size, pop, grav, drag, rot: (Math.random() - 0.5) * 0.8, spin: (Math.random() - 0.5) * (kind === 'feather' ? 4 : 2) });
    _c.setHex(hex); p.r = _c.r; p.g = _c.g; p.b = _c.b; alive++;
  }
  function tick(dt, T) {
    if (alive <= 0) { for (const k in pools) if (pools[k].m.visible) { pools[k].m.visible = false; pools[k].m.count = 0; } return; }
    let total = 0;
    for (const k in pools) {
      const pl = pools[k], m = pl.m; let n = 0;
      for (const p of pl.P) {
        if (p.life <= 0) continue;
        p.life -= dt; if (p.life <= 0) continue;
        const kk = Math.exp(-p.drag * dt); p.vx *= kk; p.vz *= kk; p.vy = p.vy * kk + p.grav * dt;
        if (k === 'feather') { p.vx += Math.sin(T * 3 + p.rot * 9) * dt * 0.8; p.vy = Math.max(p.vy, -0.45); }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.spin * dt;
        const f = p.life / p.max, age = p.max - p.life;
        // (normal blending, no per-instance alpha: things fade out by shrinking)
        let s = p.size * (f < 0.25 ? f / 0.25 : 1);
        if (p.pop) s *= age < 0.18 ? 0.4 + 0.8 * (age / 0.18) : 1.2 - 0.2 * Math.min(1, (age - 0.18) / 0.2);
        else if (k === 'spark') s *= 0.5 + 0.5 * f;
        _q.copy(camera.quaternion).multiply(_q2.setFromAxisAngle(_z, p.rot));
        m.setMatrixAt(n, _m4.compose(_v.set(p.x, p.y, p.z), _q, _s.set(s, s, s)));
        m.setColorAt(n, _c.setRGB(p.r, p.g, p.b));
        n++;
      }
      m.count = n; m.visible = n > 0; total += n;
      if (n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    }
    alive = total;
  }
  return { glyph, tick, alive: () => alive, pools };
}

export function createFun({ scene, camera, player, interiors, env, fun, emit, burst, stream, tip, tipV, best, BYKEY, glyphs, SP: SP0, isBusy }) {
  const pos = player.pos;
  const SP = {};
  const { glyph } = glyphs;
  let T = 0, inside = false;
  const v0 = new Vector3(), v1 = new Vector3(), tv = new Vector3(), fwd = new Vector3();
  const ahead = (d, out, up = 0.2) => { const f = player.yaw; tip(); return out.set(tipV.x + Math.sin(f) * d, tipV.y + up, tipV.z + Math.cos(f) * d); };
  const st = { tar: { anywhere: 0 }, ric: { anywhere: 0 }, gla: { anywhere: 0, jets: 0, last: null }, per: { casts: 0, bursts: 0, rockets: 0, indoor: 0, on: false, maxY: 0 }, asc: { casts: 0, ignored: 0, on: false, t: 0, H: 0, maxOff: 0, off: 0, lands: 0, aborted: 0 } };

  // ---------------- Tarantallegra / Rictusempra: "anywhere" effects around the duel module's casts ----------------
  function notesFromWand() {
    tip(); const f = player.yaw; fwd.set(Math.sin(f), 0, Math.cos(f));
    const cols = [0xff7ad0, 0xffe27a, 0x9ad8ff, 0x9aff9a, 0xd8a8ff];
    for (let i = 0; i < 12; i++) { const s = 0.8 + Math.random() * 1.4; glyph('note', tipV.x, tipV.y, tipV.z, fwd.x * s + (Math.random() - 0.5) * 1.2, 0.9 + Math.random() * 1.2, fwd.z * s + (Math.random() - 0.5) * 1.2, 1.4 + Math.random() * 0.8, 0.22 + Math.random() * 0.12, cols[i % cols.length], false, -0.3, 0.8); }
    burst(tipV.x, tipV.y, tipV.z, 0xff9ad8, 12, 1.4, 0.6, 0.18, -0.5);
    fun.sfx.tune([784, 988, 1175, 1319, 1175, 988], 0.11, 'triangle');
  }
  function feathersFromWand() {
    tip(); const f = player.yaw; fwd.set(Math.sin(f), 0, Math.cos(f));
    for (let i = 0; i < 14; i++) { const a = Math.random() * 6.283, s = 0.6 + Math.random() * 1.2; glyph('feather', tipV.x + fwd.x * 0.3, tipV.y, tipV.z + fwd.z * 0.3, Math.cos(a) * s + fwd.x, 0.6 + Math.random() * 1.4, Math.sin(a) * s + fwd.z, 2.2 + Math.random() * 1.0, 0.2 + Math.random() * 0.1, i % 3 ? 0xe8eef8 : 0xc8d8f0, false, -1.2, 1.6); }
    burst(tipV.x, tipV.y, tipV.z, 0xe8eef8, 14, 1.6, 0.7, 0.2, -0.4);
    fun.sfx.giggle(true);
  }
  function wrapAnywhere(key, fx, rec) {
    const h = SP0[key]; if (!h) return null;
    const c0 = h.cast;
    h.cast = function () {
      if (best(key)) { const r = c0.call(this); if (r) { tip(); burst(tipV.x, tipV.y, tipV.z, BYKEY[key].col, 10, 1.2, 0.5, 0.18, -0.5); } return r; }
      fx(); rec.anywhere++; this.lastId = null; return false;
    };
    h.noFallback = true;
    return h;
  }
  wrapAnywhere('tarantallegra', notesFromWand, st.tar);
  wrapAnywhere('rictusempra', feathersFromWand, st.ric);
  if (!SP0.tarantallegra) SP.tarantallegra = { noFallback: true, cast() { notesFromWand(); st.tar.anywhere++; return false; } };
  if (!SP0.rictusempra) SP.rictusempra = { noFallback: true, cast() { feathersFromWand(); st.ric.anywhere++; return false; } };

  // ---------------- Glacius: an icy jet with snowflakes ----------------
  const jets = [];
  function iceJet(to, dur = 0.6) { tip(); jets.push({ x: to.x, y: to.y, z: to.z, t: 0, dur, acc: 0, fa: 0 }); st.gla.jets++; fun.sfx.noise(dur, 0.1, 0, 4200, 0.6, 'highpass'); fun.sfx.tone(1800, dur, 'sine', 0.05, 0, 900); }
  function tickJets(dt) {
    for (let i = jets.length - 1; i >= 0; i--) {
      const j = jets[i]; j.t += dt; j.acc += dt; j.fa += dt; tip();
      while (j.acc > 0.012) {
        j.acc -= 0.012; const k = Math.min(1, j.t / j.dur) * Math.random();
        emit(tipV.x + (j.x - tipV.x) * k, tipV.y + (j.y - tipV.y) * k, tipV.z + (j.z - tipV.z) * k, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 0.4, 0.18, Math.random() < 0.35 ? 0xffffff : 0x7ac8ff);
      }
      while (j.fa > 0.05) { j.fa -= 0.05; const k = Math.min(1, j.t / j.dur) * Math.random(); glyph('flake', tipV.x + (j.x - tipV.x) * k, tipV.y + (j.y - tipV.y) * k, tipV.z + (j.z - tipV.z) * k, (Math.random() - 0.5) * 0.5, -0.1 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5, 1.0 + Math.random() * 0.6, 0.12 + Math.random() * 0.1, Math.random() < 0.5 ? 0xffffff : 0xbfe8ff, false, -0.4, 1); }
      if (j.t >= j.dur) {
        jets.splice(i, 1);
        burst(j.x, j.y, j.z, 0xdff4ff, 16, 1.4, 0.7, 0.2, -0.6);
        for (let n = 0; n < 10; n++) glyph('flake', j.x, j.y, j.z, (Math.random() - 0.5) * 1.6, Math.random() * 1.2, (Math.random() - 0.5) * 1.6, 1.4 + Math.random() * 0.8, 0.14 + Math.random() * 0.1, 0xe8f6ff, false, -0.6, 1.2);
      }
    }
  }
  SP.glacius = {
    noFallback: true,
    cast() {
      const t = best('glacius');
      if (!t) { ahead(6, v0); iceJet(v0, 0.55); st.gla.anywhere++; this.lastId = null; st.gla.last = null; return false; }
      t.at(tv); iceJet(tv, 0.5); t.cast('glacius'); this.lastId = t.id; st.gla.last = t.id; return true;
    },
    tick: tickJets,
    state: () => ({ anywhere: st.gla.anywhere, jets: st.gla.jets, last: st.gla.last, flying: jets.length }),
  };

  // ---------------- Periculum: fireworks (outdoors) / a shower of sparks under the ceiling (indoors) ----------------
  const HOUSES = [[0xe8283a, 0xffc83a], [0x2ad86a, 0xd8e0e8], [0x3a7aff, 0xd8a050], [0xffe03a, 0xff8a2a], [0xff5ad8, 0x9ad8ff]];
  const rockets = [];   // { t, delay, from, to, cols, done }
  let perT = -1, shower = null;
  const camDir = new Vector3();
  function perStart() {
    st.per.casts++; perT = 0; st.per.on = true; st.per.maxY = 0;
    if (inside) {
      st.per.indoor++;
      tip(); const f = player.yaw;
      shower = { t: 0, x: pos.x + Math.sin(f) * 1.6, y: pos.y + 3.1, z: pos.z + Math.cos(f) * 1.6, acc: 0 };
      // a little rocket of sparks from the wand up to the ceiling
      for (let i = 0; i < 14; i++) emit(tipV.x, tipV.y, tipV.z, (shower.x - tipV.x) * 2.2 + (Math.random() - 0.5) * 0.4, (shower.y - tipV.y) * 2.2, (shower.z - tipV.z) * 2.2 + (Math.random() - 0.5) * 0.4, 0.45, 0.16, i % 2 ? 0xffc83a : 0xff4a3a, 0, 0);
      fun.sfx.whoosh();
      return;
    }
    // aim: through the upper part of the camera's own view (the third-person camera looks down a little, so a
    // burst "straight up" would be off screen), 20-25 m out, and never lower than 3.5 m above Harry
    const n = 4, order = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
    tip(); camera.updateMatrixWorld();
    for (let i = 0; i < n; i++) {
      const nx = (i - (n - 1) / 2) * 0.36 + (Math.random() - 0.5) * 0.12, ny = 0.42 + Math.random() * 0.28, dist = 20 + Math.random() * 5;
      camDir.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
      const tx = camera.position.x + camDir.x * dist, tz = camera.position.z + camDir.z * dist;
      const ty = Math.max(camera.position.y + camDir.y * dist, pos.y + 3.5);
      rockets.push({ t: -i * 0.85, rise: 0.85, fx: tipV.x, fy: tipV.y, fz: tipV.z, x: tx, y: ty, z: tz, cols: HOUSES[order[i]], done: false, acc: 0 });
    }
    fun.sfx.whoosh();
  }
  function bang(r) {
    st.per.bursts++; st.per.maxY = Math.max(st.per.maxY, r.y - pos.y);
    const N = 40;
    for (let i = 0; i < N; i++) {
      const a = Math.random() * 6.283, u = Math.random() * 2 - 1, h = Math.sqrt(1 - u * u), s = 6.5 + Math.random() * 1.5, col = i % 3 ? r.cols[0] : r.cols[1];
      glyph('spark', r.x, r.y, r.z, Math.cos(a) * h * s, u * s + 0.6, Math.sin(a) * h * s, 1.5 + Math.random() * 0.5, 1.0 + Math.random() * 0.4, col, false, -2.2, 1.7);
      if (i % 2 === 0) emit(r.x, r.y, r.z, Math.cos(a) * h * s, u * s + 0.6, Math.sin(a) * h * s, 1.3 + Math.random() * 0.4, 1.3, col, -2.2, 1.7);
    }
    emit(r.x, r.y, r.z, 0, 0, 0, 0.35, 5.0, 0xffffff);   // the flash
    fun.sfx.boom(); fun.sfx.sparkle();
  }
  function tickPericulum(dt, busy) {
    if (perT < 0) return;
    perT += dt;
    if (busy) { rockets.length = 0; shower = null; perT = -1; st.per.on = false; return; }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]; r.t += dt; if (r.t < 0) continue;
      if (!r.launched) { r.launched = true; st.per.rockets++; tip(); r.fx = tipV.x; r.fy = tipV.y; r.fz = tipV.z; fun.sfx.tone(500, 0.7, 'sine', 0.06, 0, 1600); }
      const k = Math.min(1, r.t / r.rise), e = 1 - (1 - k) * (1 - k);
      const x = r.fx + (r.x - r.fx) * e, y = r.fy + (r.y - r.fy) * e, z = r.fz + (r.z - r.fz) * e;
      r.acc += dt; while (r.acc > 0.02) { r.acc -= 0.02; emit(x + (Math.random() - 0.5) * 0.1, y, z + (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.3, -0.5, (Math.random() - 0.5) * 0.3, 0.5, 0.3, 0xffe8a0, -1, 0.5); }
      glyph('spark', x, y, z, 0, 0, 0, 0.06, 0.45, 0xfff0c0);
      if (k >= 1) { bang(r); rockets.splice(i, 1); }
    }
    if (shower) {
      const s = shower; s.t += dt; s.acc += dt;
      if (s.t > 0.4) while (s.acc > 0.025) { s.acc -= 0.025; const a = Math.random() * 6.283, rr = Math.random() * 1.1, col = Math.random() < 0.5 ? 0xff3a2a : 0xffc83a;
        glyph('spark', s.x + Math.cos(a) * rr, s.y, s.z + Math.sin(a) * rr, (Math.random() - 0.5) * 0.6, -0.3 - Math.random() * 0.4, (Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 0.6, 0.16 + Math.random() * 0.08, col, false, -1.4, 0.8);
        if (Math.random() < 0.4) emit(s.x + Math.cos(a) * rr, s.y, s.z + Math.sin(a) * rr, 0, -0.6, 0, 1.2, 0.2, col, -1.2, 0.6); }
      else s.acc = 0;
      if (s.t > 0.4 && !s.popped) { s.popped = true; st.per.bursts++; st.per.maxY = s.y - pos.y; burst(s.x, s.y, s.z, 0xffc83a, 24, 2.2, 0.8, 0.22, -1.5); burst(s.x, s.y, s.z, 0xff3a2a, 16, 1.8, 0.8, 0.22, -1.5); fun.sfx.pop(); fun.sfx.sparkle(); }
      if (s.t > 3.0) shower = null;
    }
    if (!rockets.length && !shower && perT > 1.0) { perT = -1; st.per.on = false; }
  }
  SP.periculum = {
    noFallback: true,
    cast() { perStart(); this.lastId = inside ? 'sparks' : 'fireworks'; return true; },
    tick: (dt, ins, busy) => tickPericulum(dt, busy),
    state: () => ({ ...st.per, rocketsLeft: rockets.length }),
  };

  // ---------------- Ascendio: a high soft jump; only the drawn height of the model moves ----------------
  const A = st.asc;
  let applied = 0, lastSet = null, room0 = null, trailAcc = 0;
  const bodyBusy = () => { const c = document.body.classList; return c.contains('inSpell') || c.contains('modalOn') || c.contains('inMatch'); };
  function ascBlocked() { return A.on || isBusy() || bodyBusy(); }
  function ascStart() {
    A.casts++; A.on = true; A.t = 0; A.H = inside ? 1.5 : 3.0; A.dur = inside ? 1.6 : 2.2; A.maxOff = 0; room0 = interiors.active; trailAcc = 0;
    burst(pos.x, pos.y + 0.1, pos.z, 0xffe27a, 18, 1.8, 0.6, 0.2, -0.5);
    fun.sfx.tone(300, 0.6, 'sine', 0.12, 0, 900); fun.sfx.whoosh();
  }
  function restore() { const m = player.model; if (m && lastSet !== null && m.position.y === lastSet) m.position.y -= applied; applied = 0; lastSet = null; A.off = 0; }
  function tickAscendio(dt, busy) {
    if (!A.on) return;
    const m = player.model;
    if (busy || bodyBusy() || interiors.active !== room0 || !m) { restore(); A.on = false; A.aborted++; return; }
    A.t += dt; const k = Math.min(1, A.t / A.dur);
    const off = A.H * Math.pow(Math.sin(Math.PI * k), 1.35);
    // player.update() rewrites model.position from pos every frame; if it did not (it skipped a frame), take our old offset off first
    const base = (lastSet !== null && m.position.y === lastSet) ? m.position.y - applied : m.position.y;
    m.position.y = base + off; applied = off; lastSet = m.position.y; A.off = off; A.maxOff = Math.max(A.maxOff, off);
    trailAcc += dt;
    while (trailAcc > 0.03) { trailAcc -= 0.03; emit(pos.x + (Math.random() - 0.5) * 0.4, base + off + Math.random() * 0.4, pos.z + (Math.random() - 0.5) * 0.4, 0, -0.3, 0, 0.8, 0.18, Math.random() < 0.5 ? 0xffe27a : 0xbfe4ff, -0.5, 0.5); }
    if (k >= 1) { restore(); A.on = false; A.lands++; burst(pos.x, pos.y + 0.05, pos.z, 0xfff2b0, 16, 1.4, 0.5, 0.18, -1); fun.sfx.pop(); }
  }
  SP.ascendio = {
    noFallback: true,
    blocked: ascBlocked,
    cast() { if (ascBlocked()) { A.ignored++; this.lastId = null; return false; } ascStart(); this.lastId = 'ascendio'; return true; },
    tick: (dt, ins, busy) => tickAscendio(dt, busy),
    state: () => ({ on: A.on, t: +A.t.toFixed(2), H: A.H, off: +A.off.toFixed(2), maxOff: +A.maxOff.toFixed(2), casts: A.casts, ignored: A.ignored, lands: A.lands, aborted: A.aborted,
      modelDy: player.model ? +(player.model.position.y - pos.y).toFixed(3) : null }),
  };

  // the shared clock + glyph pool + the indoor flag (ticks before the other batch-5 spells: key order in SP)
  SP._fun = {
    noFallback: true,
    tick(dt, ins) { T += dt; inside = !!ins; glyphs.tick(dt, T); },
    state: () => ({ glyphs: glyphs.alive(), anyVisible: Object.values(glyphs.pools).filter(p => p.m.visible).length }),
  };
  return { SP };
}
