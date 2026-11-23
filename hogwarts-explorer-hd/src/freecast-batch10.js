// Free-play spells batch 10 (freecast.js): the wheel goes from 24 to 30. Each acts by its meaning on REAL castle things,
// never on people or creatures; each says a kind hint when nothing is in reach; +5 house points once per object per
// session (nothing saved but freecast.js' 'discovered' flag).
//   Finite Incantatem 🔄  undoes what other wheel spells left on things within reach: Engorgio / Reducio sizes go back,
//                        dancing / giggling dummies stop, cast fires go back to normal (the castle's own torches and
//                        hearths relit, the spell-spot torches / braziers / lanterns out), Glacius ice melts, Orchideous /
//                        Herbivicus flowers fade, Avis birds fly off, Lumos (Maxima) goes out. A soft silver ring.
//   Point Me 🧭          a glowing gold arrow lies over Harry's hand and swings to the goal: the running adventure step's
//                        goal, else the Great Hall (indoors: the door that leads towards it; outdoors: the oak doors).
//                        One pooled mesh, ~8 s; the bubble names the place.
//   Herbivicus 🌱        plants bloom fast: the glasshouse pots, the courtyard planter, the leaves of Hagrid's pumpkin
//                        patch burst into flowers (ONE InstancedMesh, 56 flowers x 26 tris = 1,456 tris at most, one
//                        spot at a time; they stay until Harry walks away, goes in, or Finite); in the corridor's
//                        Devil's Snare room (free play only, never while quest 1 runs) the Snare turns into blossoms
//                        and clears the way (corridor-free.js target 'free-snare-bloom').
//   Diffindo ✂️          cuts real ribbons and cords: the ribboned gift box in the common room pops open (sparkles, a gold
//                        star, +5), the rolled banner tied with a cord in the Great Hall unrolls, the curtain tie in the
//                        library lets the curtain fall shut. Objects only. Built into the room on every visit (a room is
//                        rebuilt when re-entered), so they are tied again next time. 2-3 draw calls per room, one material.
//   Sonorus 📢           Harry's voice booms: pooled sound rings + a deep WebAudio boom; in the Entrance Hall the chandelier
//                        rocks and the banners shake, in the Great Hall the banners shake, in the staircase hall the two
//                        side flights rumble and sway; at the Quidditch stands (no match) the crowd jumps and cheers.
//                        Never during a match or a course. Every shake is an offset put back exactly afterwards.
//   Glisseo 🛝           the game's one real staircase you can stand at, the staircase hall's central flight (rooms.js; the
//                        steps are drawn, the floor stays flat for walking): a smooth ice-blue slide fades in over the
//                        steps, Harry floats up to the landing and slides down to the bottom (controls locked through
//                        main.js' takeover, camera follows, a soft landing, "ויייי!"); ~5 s. Any failure or a room change
//                        ends it at once and gives the controls back at a free spot (player.teleport).
// Cost: one pooled ring InstancedMesh (6 quads, a 128 px canvas ring), drawn only while a ring is alive.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Group, BoxGeometry, CylinderGeometry, TorusGeometry, InstancedMesh, Mesh, Shape, ShapeGeometry, CircleGeometry, PlaneGeometry, MeshBasicMaterial, MeshStandardMaterial, BufferAttribute, CanvasTexture, SRGBColorSpace, AdditiveBlending, DoubleSide, Matrix4, Vector3, Quaternion, Euler, Color } from 'three';

const _m4 = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _s = new Vector3(), _c = new Color();
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const POINTS = 5;

function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 40, 64, 64, 63);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.55, 'rgba(255,255,255,.95)'); r.addColorStop(0.7, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

export function createBatch10(ctx) {
  const { scene, camera, player, interiors, fun, emit, burst, stream, tip, tipV, TARGETS, SP: SP0, REACH, parts, lumos, isBusy } = ctx;
  const pos = player.pos;
  const SP = {};
  let T = 0, inside = false;
  const v0 = new Vector3(), v1 = new Vector3(), tv = new Vector3();
  const log = { hints: 0, points: 0, lastHint: null };
  const paid = new Set();     // '<spell>:<object id>' paid this session
  const quiet = () => { const c = document.body.classList; return isBusy() || c.contains('inSpell') || c.contains('inMatch'); };

  // ---------------- shared: hint bubble, points ----------------
  const bubAt = new Vector3();
  function hint(text) {
    log.hints++; log.lastHint = text;
    setTimeout(() => { try { fun.say(bubAt.set(pos.x, pos.y + 2.5 * player.model.scale.y, pos.z), text, 2.8, 'freecast'); } catch { /* ignore */ } }, 1100);
  }
  function reward(spell, id) {
    const k = spell + ':' + id; if (paid.has(k)) return false;
    paid.add(k); log.points += POINTS;
    try { window.HPLessons.progress.bonus(POINTS); } catch { /* lessons not loaded */ }
    setTimeout(() => { try { fun.toast('⭐', '+5 נְקֻדּוֹת לַבַּיִת!', 2000); } catch { /* ignore */ } }, 700);
    return true;
  }

  // ---------------- pooled rings (Finite's shimmer, Sonorus' sound rings) ----------------
  const NR = 6;
  const rings = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false }), NR);
  rings.name = 'freecast-b10-rings'; rings.frustumCulled = false; rings.visible = false; rings.raycast = () => {}; rings.renderOrder = 6; rings.count = 0;
  for (let i = 0; i < NR; i++) rings.setColorAt(i, _c.setRGB(0, 0, 0));
  scene.add(rings);
  const RG = Array.from({ length: NR }, () => ({ on: false, t: 0, dur: 1, r0: 0.3, r1: 4, x: 0, y: 0, z: 0, flat: true, hex: 0xffffff, delay: 0 }));
  function ring(x, y, z, r1, dur, hex, flat = true, delay = 0, r0 = 0.3) {
    const g = RG.find(q => !q.on) || RG[0];
    Object.assign(g, { on: true, t: -delay, dur, r0, r1, x, y, z, flat, hex });
  }
  const qFlat = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0));
  function tickRings(dt) {
    let n = 0;
    for (const g of RG) {
      if (!g.on) continue;
      g.t += dt; if (g.t < 0) continue;
      if (g.t >= g.dur) { g.on = false; continue; }
      const k = g.t / g.dur, r = g.r0 + (g.r1 - g.r0) * (1 - (1 - k) * (1 - k)), a = (k < 0.15 ? k / 0.15 : 1) * (1 - k);
      rings.setMatrixAt(n, _m4.compose(v0.set(g.x, g.y, g.z), g.flat ? qFlat : camera.quaternion, _s.set(r * 2, r * 2, r * 2)));
      _c.setHex(g.hex); rings.setColorAt(n, _c.multiplyScalar(a));
      n++;
    }
    rings.count = n; rings.visible = n > 0;
    if (n) { rings.instanceMatrix.needsUpdate = true; rings.instanceColor.needsUpdate = true; }
  }

  // ================= Finite Incantatem =================
  // The castle's own fires are lit when nothing was cast on them; the spell spots' torches / braziers / lanterns start out.
  const NORMAL_LIT = /^real-(torch|fire|candles|lantern)/;
  const NORMAL_OUT = /^(torch\d|hall-brazier|lib-candles|gh-stand|yard-lantern)$/;
  const FIN = { casts: 0, undone: 0, last: [], fading: [] };
  const near = (p) => Math.hypot(p.x - pos.x, p.z - pos.z) < REACH && Math.abs(p.y - pos.y) < 5;
  const tryOk = (t, k) => { try { return t.spells.includes(k) && !!t.ok(k); } catch { return false; } };
  // what Finite would do to this target now (null: nothing of a spell is running on it)
  function undoOf(t) {
    if ((t.grp && !t.grp.visible) || t.b10) return null;
    if (NORMAL_LIT.test(t.id)) return tryOk(t, 'incendio') ? 'incendio' : null;
    if (NORMAL_OUT.test(t.id)) return tryOk(t, 'aguamenti') ? 'aguamenti' : (tryOk(t, 'glacius') ? 'glacius' : null);
    if (t.bloom) return t.bloom.bloomed && t.bloom.k > 0.3 ? 'unbloom' : null;   // freecast-real-things.js vases / troughs
    if (t.spells.includes('engorgio') && t.spells.includes('reducio')) {
      const e = tryOk(t, 'engorgio'), r = tryOk(t, 'reducio');
      if (e && !r) return 'engorgio';
      if (r && !e) return 'reducio';
    }
    if (t.spells.includes('glacius') && t.spells.includes('incendio') && tryOk(t, 'incendio')) return 'incendio';   // ice melts (birdbath, frosted pumpkins)
    return null;
  }
  function finiteTargets() {
    const out = [];
    for (const t of TARGETS) {
      const u = undoOf(t); if (!u) continue;
      try { t.at(tv); } catch { continue; }
      if (near(tv)) out.push({ t, u, x: tv.x, y: tv.y, z: tv.z });
    }
    return out;
  }
  function petals(x, y, z) { for (const c of [0xff8ac0, 0xffe27a, 0xd8c8ff]) burst(x, y, z, c, 6, 1.0, 0.9, 0.16, -0.6); }
  function finiteCast() {
    if (quiet()) return { ids: [] };
    FIN.casts++;
    const ids = [];
    // things in reach (through each target's own spell: the right effect, the right state machine)
    for (const f of finiteTargets()) {
      try {
        if (f.u === 'unbloom') { const B = f.t.bloom; B.bloomed = false; B.pend = 0; FIN.fading.push({ bone: B.it.bone, k: 1 }); petals(f.x, f.y + 0.1, f.z); }
        else f.t.cast(f.u);
        ids.push(f.t.id); burst(f.x, f.y, f.z, 0xeef4ff, 14, 1.4, 0.8, 0.2, -0.3);
      } catch (e) { console.warn('[freecast] finite', f.t.id, e && e.message || e); }
    }
    // running things the spell spots keep to themselves (dances, giggles, flowers, Lumos Maxima, the Avis flock)
    for (const P of [parts.D, parts.K]) {
      if (!P || !P.finite) continue;
      try { for (const id of P.finite(near)) { ids.push(id); const t = TARGETS.find(q => q.id === id); if (t) { t.at(tv); petals(tv.x, tv.y, tv.z); } } } catch (e) { console.warn('[freecast] finite hook', e && e.message || e); }
    }
    // batch 10's own: Herbivicus flowers, the Point Me arrow
    for (const fn of FIN_HOOKS) { try { ids.push(...fn()); } catch (e) { console.warn('[freecast] finite b10', e && e.message || e); } }
    // Lumos on: it goes out (Nox)
    try { if (lumos.isOn() && SP0.lumos) { SP0.lumos.cast(); ids.push('lumos'); } } catch { /* ignore */ }
    FIN.last = ids.slice(); FIN.undone += ids.length;
    // the silver shimmer: two flat rings from Harry's feet, one upright through his chest
    ring(pos.x, pos.y + 0.08, pos.z, REACH * 0.75, 1.4, 0xdfe8ff, true); ring(pos.x, pos.y + 0.12, pos.z, REACH * 0.5, 1.2, 0xffffff, true, 0.25);
    ring(pos.x, pos.y + 1.1, pos.z, 2.4, 0.9, 0xc8d8ff, false, 0.1);
    for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; emit(pos.x + Math.cos(a) * 0.6, pos.y + 0.3, pos.z + Math.sin(a) * 0.6, Math.cos(a) * 3.2, 0.5, Math.sin(a) * 3.2, 1.0, 0.2, i % 3 ? 0xdfe8ff : 0xffffff, -0.2, 1.4); }
    fun.sfx.tune([1047, 880, 784, 659], 0.11, 'sine'); try { fun.sfx.sparkle(); } catch { /* ignore */ }
    return { ids };
  }
  const FIN_HOOKS = [];
  function tickFinite(dt) {
    for (let i = FIN.fading.length - 1; i >= 0; i--) {
      const f = FIN.fading[i]; f.k -= dt / 0.6;
      if (f.k <= 0) { f.bone.scale.setScalar(0.001); FIN.fading.splice(i, 1); } else f.bone.scale.setScalar(Math.max(0.001, ease(f.k)));
    }
  }
  SP.finite = {
    noFallback: true,
    cast() {
      const r = finiteCast();
      if (!r.ids.length) { this.lastId = null; hint('אֵין כָּאן כִּשּׁוּף לְבַטֵּל. נַסֶּה אַחֲרֵי לַחַשׁ אַחֵר!'); return false; }
      this.lastId = r.ids[0];
      for (const id of r.ids) reward('finite', id);
      return true;
    },
    tick: (dt) => tickFinite(dt),
    state: () => ({ casts: FIN.casts, undone: FIN.undone, last: FIN.last.slice(), fading: FIN.fading.length, pending: finiteTargets().map(f => f.t.id + ':' + f.u) }),
  };

  // ================= Point Me =================
  const PLACE = { greathall: 'הָאוּלָם הַגָּדוֹל', entrancehall: 'אוּלַם הַכְּנִיסָה', staircase: 'אוּלַם הַמַּדְרֵגוֹת', out: 'הַחוּצָה', doors: 'הַדְּלָתוֹת הַגְּדוֹלוֹת שֶׁל הַטִּירָה' };
  const DOOR = { x: 0, z: 21 };   // castle.js DOOR (the oak doors; Harry walks in at z 22)
  const PM = { on: false, t: 0, dur: 8, casts: 0, goal: new Vector3(), id: null, place: null, a: 0, a0: 0, err: 0, settled: false };
  let arrow = null;
  function arrowMesh() {
    const sh = new Shape();   // a flat arrow pointing +z (0.8 m), drawn in x/z after the rotation
    sh.moveTo(-0.06, -0.38); sh.lineTo(0.06, -0.38); sh.lineTo(0.06, 0.12); sh.lineTo(0.17, 0.12); sh.lineTo(0, 0.42); sh.lineTo(-0.17, 0.12); sh.lineTo(-0.06, 0.12); sh.lineTo(-0.06, -0.38);
    const g = new ShapeGeometry(sh); g.rotateX(Math.PI / 2);   // shape +y -> world +z
    g.scale(1.5, 1, 1.5);
    const m = new Mesh(g, new MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, side: DoubleSide, depthWrite: false, fog: false, toneMapped: false }));
    m.name = 'freecast-pointme'; m.frustumCulled = false; m.visible = false; m.raycast = () => {}; m.renderOrder = 6;
    // a soft gold glow under it (child: same visibility, no extra pool)
    const halo = new Mesh(new PlaneGeometry(1.7, 1.7).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: ctx.glowTex, color: 0xffc040, transparent: true, opacity: 0.7, depthWrite: false, blending: AdditiveBlending, fog: false }));
    halo.position.y = -0.02; halo.raycast = () => {}; halo.renderOrder = 5; m.add(halo);
    scene.add(m); return m;
  }
  // the goal now: { x, z, id, place } (world x/z), or null
  function pointGoal(out) {
    try {
      const A = window.__game && window.__game.adventures, s = A && A.state ? A.state() : null;
      if (s && s.quest && s.arrow && (s.intro == null || s.intro < 0)) { out.set(s.arrow.x, 0, s.arrow.z); return { id: 'quest-' + s.quest + '-' + s.step, place: 'הַמַּטָּרָה שֶׁל הַהַרְפַּתְקָה' }; }
    } catch { /* no adventures */ }
    const room = interiors.active;
    if (!room) { out.set(DOOR.x, 0, DOOR.z); return { id: 'doors', place: PLACE.doors }; }
    const r = interiors.room;
    if (room === 'greathall') { out.set(0, 0, -12); return { id: 'greathall', place: PLACE.greathall, here: true }; }
    const ps = (r && r.portals) || [];
    const pk = ps.find(p => p.to === 'greathall') || ps.find(p => p.to === 'entrancehall') || ps.find(p => p.to === 'staircase') || ps.find(p => p.to === 'out');
    if (!pk) return null;
    out.set(pk.x, 0, pk.z);   // rooms sit at x/z 0: room-local = world
    return { id: room + '>' + pk.to, place: PLACE[pk.to] || PLACE.greathall, door: pk.to !== 'greathall' };
  }
  const handAt = (out) => { const f = player.yaw, s = player.model.scale.y; return out.set(pos.x + Math.sin(f) * 0.75, pos.y + 1.7 * s, pos.z + Math.cos(f) * 0.75); };   // over his held-out hand, clear of his head in the follow camera
  function pointStart() {
    const g = pointGoal(PM.goal); if (!g) return null;
    if (!arrow) arrow = arrowMesh();
    PM.on = true; PM.t = 0; PM.casts++; PM.id = g.id; PM.place = g.place; PM.settled = false;
    PM.a0 = player.yaw + (Math.random() < 0.5 ? 1 : -1) * (1.6 + Math.random());   // it starts off to one side and swings round
    handAt(v0); burst(v0.x, v0.y, v0.z, 0xffd76a, 16, 1.2, 0.6, 0.18, -0.4);
    fun.sfx.chime(); fun.sfx.tone(660, 0.5, 'sine', 0.08, 0.1, 990);
    const text = g.here ? '🧭 אַתָּה כְּבָר בָּאוּלָם הַגָּדוֹל!' : '🧭 לְשָׁם! ' + (g.door ? 'בַּדֶּלֶת, בַּדֶּרֶךְ אֶל ' : 'אֶל ') + g.place;
    setTimeout(() => { try { fun.say(bubAt.set(pos.x, pos.y + 2.5 * player.model.scale.y, pos.z), text, 3.2, 'freecast'); } catch { /* ignore */ } }, 1300);
    log.lastPoint = text;
    return g;
  }
  function tickPoint(dt, busy) {
    if (!PM.on) return;
    PM.t += dt; const t = PM.t;
    if (t >= PM.dur || busy) { PM.on = false; arrow.visible = false; return; }
    handAt(v0);
    const want = Math.atan2(PM.goal.x - v0.x, PM.goal.z - v0.z);
    let d = PM.a0 - want; d = Math.atan2(Math.sin(d), Math.cos(d));
    PM.a = want + d * Math.exp(-1.6 * t) * Math.cos(6.5 * t);   // a compass needle: swings past, settles on the goal
    PM.err = Math.abs(Math.atan2(Math.sin(PM.a - want), Math.cos(PM.a - want)));
    if (!PM.settled && t > 1.5 && PM.err < 0.15) { PM.settled = true; fun.sfx.tink(2); }
    const k = Math.min(1, t / 0.35), out = Math.min(1, (PM.dur - t) / 0.6), s = (0.3 + 0.7 * ease(k)) * out * (1 + Math.sin(t * 5) * 0.03);
    arrow.position.set(v0.x, v0.y + Math.sin(t * 2.4) * 0.03, v0.z); arrow.rotation.set(0, PM.a, 0); arrow.scale.setScalar(Math.max(0.01, s));
    arrow.material.opacity = 0.95 * out; arrow.children[0].material.opacity = 0.7 * out; arrow.visible = true;
    if (Math.random() < dt * 18) { const tipx = v0.x + Math.sin(PM.a) * 0.4 * s, tipz = v0.z + Math.cos(PM.a) * 0.4 * s; emit(tipx, v0.y, tipz, (Math.random() - 0.5) * 0.2, 0.2, (Math.random() - 0.5) * 0.2, 0.6, 0.14, 0xffe8a0, -0.2, 1); }
  }
  FIN_HOOKS.push(() => { if (!PM.on || PM.t > PM.dur - 0.6) return []; PM.t = PM.dur - 0.6; return ['pointme']; });
  SP.pointme = {
    noFallback: true,
    cast() {
      if (quiet()) { this.lastId = null; return false; }
      const g = pointStart();
      if (!g) { this.lastId = null; hint('הַחֵץ לֹא מוֹצֵא דֶּרֶךְ מִכָּאן. נַסֶּה בְּמָקוֹם אַחֵר!'); return false; }
      this.lastId = 'pointme-' + g.id; reward('pointme', g.id); return true;
    },
    tick: (dt, ins, busy) => tickPoint(dt, busy),
    state: () => ({ on: PM.on, t: +PM.t.toFixed(2), casts: PM.casts, id: PM.id, place: PM.place, err: +PM.err.toFixed(3), settled: PM.settled, visible: !!(arrow && arrow.visible),
      goal: { x: +PM.goal.x.toFixed(2), z: +PM.goal.z.toFixed(2) }, arrow: arrow ? { x: +arrow.position.x.toFixed(2), y: +arrow.position.y.toFixed(2), z: +arrow.position.z.toFixed(2), yaw: +PM.a.toFixed(3) } : null }),
  };

  // ================= Herbivicus =================
  const NF = 56, FCOL = [0xd84a7a, 0xd8b030, 0x9a62c8, 0xd86a3a, 0xd8d0c0, 0x5a8ad8, 0xd88ac0];
  let flw = null;
  function flowerGeo() {
    const sh = new Shape(), N = 20;
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, r = 0.07 * (0.55 + 0.45 * Math.abs(Math.cos(a * 2.5))); const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
    const pet = new ShapeGeometry(sh), mid = new CircleGeometry(0.024, 6); mid.translate(0, 0, 0.006);
    const col = (g, r, gg, b) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } g.setAttribute('color', new BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; };
    const g = mergeGeometries([col(pet, 1, 1, 1), col(mid, 1, 0.82, 0.3)].map(x => { for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'color'].includes(k)) x.deleteAttribute(k); return x; }));
    g.rotateX(-Math.PI / 2);   // facing up
    return g;
  }
  function makeFlowers() {
    flw = new InstancedMesh(flowerGeo(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: DoubleSide }), NF);
    flw.name = 'freecast-herbivicus'; flw.frustumCulled = false; flw.visible = false; flw.raycast = () => {}; flw.castShadow = false; flw.count = 0;
    for (let i = 0; i < NF; i++) flw.setColorAt(i, _c.setHex(FCOL[i % FCOL.length]));
    scene.add(flw);
  }
  const HB = { casts: 0, spot: null, n: 0, t: 0, fade: -1, blooms: 0, snare: 0, F: Array.from({ length: NF }, () => ({ p: new Vector3(), d: 0, s: 1, rx: 0, rz: 0, ry: 0, fall: 0, y0: 0 })), at: new Vector3() };
  const _om = new Matrix4(), _p = new Vector3();
  // where flowers go: { id, list: [[x, y, z, scale]] (world) } for the outdoor spot in reach, or null
  function bloomSpot() {
    if (interiors.active) return null;
    const out = [];
    const gh = scene.getObjectByName('greenhouse'), pots = gh && gh.getObjectByName('gh-pots');
    if (pots && gh.visible !== false) {
      pots.updateMatrixWorld(); _p.setFromMatrixPosition(pots.matrixWorld);
      if (Math.hypot(_p.x - pos.x, _p.z - pos.z) < 9) {
        const L = [];
        for (let i = 0; i < pots.count; i++) { pots.getMatrixAt(i, _om); _om.premultiply(pots.matrixWorld); _p.setFromMatrixPosition(_om); const sc = new Vector3().setFromMatrixScale(_om).y; L.push([_p.x, _p.y + 0.2 * sc + 0.1 * Math.min(sc, 1.5), _p.z, sc, Math.hypot(_p.x - pos.x, _p.z - pos.z)]); }
        L.sort((a, b) => a[4] - b[4]);
        for (const q of L) { if (out.length >= NF) break; const k = q[3] > 2 ? 5 : 1; for (let j = 0; j < k && out.length < NF; j++) { const a = j * 2.4, r = j ? 0.18 * q[3] / 2 : 0; out.push([q[0] + Math.cos(a) * r, q[1] + (q[3] > 2 ? 0.25 : 0.04), q[2] + Math.sin(a) * r, q[3] > 2 ? 1.5 : 1.9 + Math.random() * 0.4]); } }
        return { id: 'glasshouse', place: 'הַחֲמָמָה', list: out };
      }
    }
    const pl = TARGETS.find(t => t.id === 'yard-planter');
    if (pl && (!pl.grp || pl.grp.visible)) {
      pl.at(_p);
      if (Math.hypot(_p.x - pos.x, _p.z - pos.z) < 8) {
        for (let i = 0; i < 22; i++) { const a = i * 2.39996, r = 0.12 + Math.sqrt(i / 22) * 0.55; out.push([_p.x + Math.cos(a) * r, _p.y - 0.12 + Math.random() * 0.12, _p.z + Math.sin(a) * r, 1.1 + Math.random() * 0.4]); }
        return { id: 'courtyard-planter', place: 'הָאַדְנִית בֶּחָצֵר', list: out };
      }
    }
    const pk = scene.getObjectByName('hut-pumpkins');
    if (pk) {
      pk.updateMatrixWorld();
      const L = [];
      for (let i = 0; i < pk.count; i++) { pk.getMatrixAt(i, _om); _om.premultiply(pk.matrixWorld); _p.setFromMatrixPosition(_om); L.push([_p.x, _p.y, _p.z, new Vector3().setFromMatrixScale(_om).x]); }
      if (L.some(q => Math.hypot(q[0] - pos.x, q[2] - pos.z) < 8)) {
        for (const q of L) for (let j = 0; j < 4 && out.length < 44; j++) { const a = j * 1.57 + q[0], r = 0.35 * q[3] + 0.15; out.push([q[0] + Math.cos(a) * r, q[1] + 0.12, q[2] + Math.sin(a) * r, 1.2 + Math.random() * 0.4]); }
        return { id: 'hut-pumpkins', place: 'הַדְּלָעוֹת שֶׁל הָאגְרִיד', list: out };
      }
    }
    return null;
  }
  function fill(list, fall = false) {
    if (!flw) makeFlowers();
    HB.n = Math.min(NF, list.length); HB.t = 0; HB.fade = -1;
    for (let i = 0; i < HB.n; i++) { const f = HB.F[i], q = list[i]; f.p.set(q[0], q[1], q[2]); f.s = q[3]; f.d = i * (1.4 / HB.n) + Math.random() * 0.15; f.ry = Math.random() * 6.28; f.rx = (Math.random() - 0.5) * 0.5; f.rz = (Math.random() - 0.5) * 0.5; f.fall = fall ? q[4] : 0; f.y0 = q[1]; }
  }
  function herbCast() {
    // the corridor's Devil's Snare (free play only: the target says no while quest 1 runs)
    const sn = TARGETS.find(t => t.id === 'free-snare-bloom');
    if (sn && tryOk(sn, 'herbivicus')) {
      sn.at(tv);
      if (near(tv)) {
        sn.cast('herbivicus'); HB.snare++;
        const L = []; for (let i = 0; i < NF; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 1.9; L.push([tv.x + Math.cos(a) * r, tv.y - 1.0 + Math.random() * 2.4, tv.z + (Math.random() - 0.5) * 0.6, 1.3 + Math.random() * 0.6, 1]); }
        fill(L, true); HB.spot = 'snare'; HB.at.copy(tv);
        for (const c of [0xff8ac0, 0xffe27a, 0x9aff7a]) burst(tv.x, tv.y, tv.z, c, 16, 2.2, 1.0, 0.24, -0.6);
        stream(tv, 0x8ae07a, 0.6); fun.sfx.sparkle(); fun.sfx.giggle(true);
        setTimeout(() => { try { fun.say(bubAt.set(pos.x, pos.y + 2.5 * player.model.scale.y, pos.z), 'הַצֶּמַח הַמְּסֻבָּךְ פָּרַח! הַדֶּרֶךְ פְּתוּחָה 🌸', 3, 'freecast'); } catch { /* ignore */ } }, 1100);
        return 'free-snare-bloom';
      }
    }
    const sp = bloomSpot(); if (!sp || !sp.list.length) return null;
    fill(sp.list); HB.spot = sp.id; HB.at.set(pos.x, pos.y, pos.z);
    const c0 = sp.list[0]; stream(_p.set(c0[0], c0[1], c0[2]), 0x8ae07a, 0.6);
    fun.sfx.sparkle(); fun.sfx.tune([523, 659, 784, 988, 1175], 0.09, 'triangle');
    return sp.id;
  }
  function tickHerb(dt) {
    if (!flw || !HB.spot) return;
    HB.t += dt;
    const away = HB.spot === 'snare' ? interiors.active !== 'chambers' : (!!interiors.active || Math.hypot(pos.x - HB.at.x, pos.z - HB.at.z) > 40);
    if (away && HB.fade < 0) HB.fade = HB.spot === 'snare' ? 0.01 : 0;
    if (HB.fade >= 0) { HB.fade += dt / (away ? 0.01 : 0.8); if (HB.fade >= 1) { HB.spot = null; HB.n = 0; flw.count = 0; flw.visible = false; return; } }
    const out = HB.fade >= 0 ? 1 - HB.fade : 1;
    for (let i = 0; i < HB.n; i++) {
      const f = HB.F[i], k = Math.max(0, Math.min(1, (HB.t - f.d) / 0.45));
      const pop = k <= 0 ? 0.001 : (1 + 1.6 * Math.pow(k - 1, 3) + 0.6 * Math.pow(k - 1, 2)) * f.s * out;
      if (k > 0 && k < 0.15 && Math.random() < 0.3) emit(f.p.x, f.p.y + 0.05, f.p.z, 0, 0.5, 0, 0.5, 0.12, 0xc8ffb0);
      let y = f.p.y;
      if (f.fall) { const u = Math.min(1, Math.max(0, HB.t - 0.6) / 2.6); y = f.y0 + (pos.y + 0.03 - f.y0) * u * u; f.p.y = f.y0; }
      _q.setFromEuler(_e.set(f.rx + (f.fall ? Math.sin(HB.t * 3 + i) * 0.6 : 0), f.ry + (f.fall ? HB.t : 0), f.rz));
      flw.setMatrixAt(i, _m4.compose(v1.set(f.p.x, y, f.p.z), _q, _s.set(Math.max(0.001, pop), Math.max(0.001, pop), Math.max(0.001, pop))));
    }
    flw.count = HB.n; flw.visible = HB.n > 0; flw.instanceMatrix.needsUpdate = true;
    if (flw.instanceColor) flw.instanceColor.needsUpdate = true;
  }
  FIN_HOOKS.push(() => { if (!HB.spot || HB.fade >= 0) return []; HB.fade = 0; const ids = ['herbivicus-' + HB.spot]; for (let i = 0; i < HB.n; i += 6) { const f = HB.F[i]; burst(f.p.x, f.p.y + 0.05, f.p.z, FCOL[i % FCOL.length], 4, 0.8, 0.8, 0.14, -0.5); } return ids; });
  SP.herbivicus = {
    noFallback: true,
    cast() {
      if (quiet()) { this.lastId = null; return false; }
      const id = herbCast();
      if (!id) { this.lastId = null; hint('אֵין כָּאן צְמָחִים. נַסֶּה בַּחֲמָמָה, בָּאַדְנִית בֶּחָצֵר אוֹ לְיַד הַדְּלָעוֹת שֶׁל הָאגְרִיד!'); return false; }
      HB.casts++; HB.blooms++; this.lastId = id; reward('herbivicus', id); return true;
    },
    tick: (dt) => tickHerb(dt),
    state: () => ({ casts: HB.casts, spot: HB.spot, n: HB.n, visible: !!(flw && flw.visible), tris: flw && flw.visible ? flw.count * (flw.geometry.attributes.position.count / 3) : 0, snare: HB.snare, fading: HB.fade >= 0,
      maxScale: HB.n ? +Math.max(...HB.F.slice(0, HB.n).map(f => f.s)).toFixed(2) : 0, first: HB.n ? { x: +HB.F[0].p.x.toFixed(2), y: +HB.F[0].p.y.toFixed(2), z: +HB.F[0].p.z.toFixed(2) } : null }),
  };

  // ================= Diffindo =================
  // room-local places (rooms sit at x/z 0, y -200: room-local x/z = world x/z)
  const DIF = { gift: { room: 'commonroom', x: -2.7, z: 2.3 }, banner: { room: 'greathall', x: -5.2, z: 17.72, h: 6.4 }, curtain: { room: 'library', x: 10.86, z: -6.4, h: 4.6 } };
  const DF = { casts: 0, cuts: 0, builds: 0, room: null, seen: null, items: [] };
  let difMat = null;
  const vc = (g, hex) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } g.setAttribute('color', new BufferAttribute(a, 3)); const o = g.index ? g.toNonIndexed() : g; if (o.attributes.uv) o.deleteAttribute('uv'); return o; };
  const M = (list) => mergeGeometries(list);
  function dMesh(list, name, grp) { const m = new Mesh(M(list), difMat); m.name = name; m.raycast = () => {}; grp.add(m); return m; }
  function buildGift(g, P) {
    // a 0.5 m parcel in Gryffindor red with a gold ribbon and bow; base, lid (+bow) and ribbon are three meshes
    const S = 0.5, H = 0.4, grp = new Group(); grp.position.set(P.x, 0, P.z); grp.rotation.y = 0.5; grp.name = 'diffindo-gift'; g.add(grp);
    const base = dMesh([vc(new BoxGeometry(S, H, S).translate(0, H / 2, 0), 0x8a1a22)], 'diffindo-gift-box', grp);
    const lid = dMesh([vc(new BoxGeometry(S + 0.04, 0.09, S + 0.04).translate(0, 0.045, 0), 0x9a2028), vc(new BoxGeometry(0.08, 0.1, S + 0.05).translate(0, 0.05, 0), 0xc8a040), vc(new BoxGeometry(S + 0.05, 0.1, 0.08).translate(0, 0.05, 0), 0xc8a040),
      vc(new TorusGeometry(0.07, 0.022, 5, 10).rotateY(0.8).translate(-0.06, 0.15, 0), 0xd8b04a), vc(new TorusGeometry(0.07, 0.022, 5, 10).rotateY(0.8).translate(0.06, 0.15, 0), 0xd8b04a)], 'diffindo-gift-lid', grp);
    lid.position.y = H;
    const rib = dMesh([vc(new BoxGeometry(0.08, H, S + 0.012).translate(0, H / 2, 0), 0xc8a040), vc(new BoxGeometry(S + 0.012, H, 0.08).translate(0, H / 2, 0), 0xc8a040)], 'diffindo-gift-ribbon', grp);
    return { id: 'gift', label: 'הַמַּתָּנָה', grp, base, lid, rib, state: 'tied', t: 0, at: (o) => o.set(0, H + 0.12, 0).applyMatrix4(grp.matrixWorld) };
  }
  function buildBanner(g, P) {
    // a house banner rolled up under its rod, tied with a cord; cut: it unrolls down the wall. cloth (top anchored) + roll + cord
    const W = 1.5, L = 3.6, grp = new Group(); grp.position.set(P.x, P.h, P.z); grp.rotation.y = Math.PI; grp.name = 'diffindo-banner'; g.add(grp);   // faces -z (into the hall)
    const rod = [vc(new CylinderGeometry(0.035, 0.035, W + 0.3, 8).rotateZ(Math.PI / 2), 0xb8903e)];
    for (const sx of [-1, 1]) rod.push(vc(new CylinderGeometry(0.06, 0.06, 0.06, 8).rotateZ(Math.PI / 2).translate(sx * (W / 2 + 0.17), 0, 0), 0xd8b04a));
    const cl = [vc(new PlaneGeometry(W, L, 1, 1).translate(0, -L / 2, 0.02), 0x7a1a20), vc(new PlaneGeometry(W * 0.82, L * 0.9, 1, 1).translate(0, -L * 0.48, 0.025), 0x8a2228)];
    const lion = new Shape(); lion.moveTo(0, 0.42); lion.lineTo(0.36, 0.2); lion.lineTo(0.3, -0.3); lion.lineTo(0, -0.48); lion.lineTo(-0.3, -0.3); lion.lineTo(-0.36, 0.2); lion.lineTo(0, 0.42);   // a gold crest shield
    cl.push(vc(new ShapeGeometry(lion).translate(0, -L * 0.45, 0.03), 0xc8a040));
    cl.push(vc(new PlaneGeometry(W, 0.12).translate(0, -L + 0.06, 0.03), 0xc8a040));
    const cloth = dMesh([...rod, ...cl], 'diffindo-banner-cloth', grp);
    const rodN = M(rod).attributes.position.count;   // the rod's vertices never move (the cloth below them scales)
    const roll = dMesh([vc(new CylinderGeometry(0.13, 0.13, W, 12).rotateZ(Math.PI / 2).translate(0, -0.2, 0.06), 0x7a1a20), vc(new CylinderGeometry(0.135, 0.135, 0.04, 12).rotateZ(Math.PI / 2).translate(-W / 2 + 0.03, -0.2, 0.06), 0xc8a040), vc(new CylinderGeometry(0.135, 0.135, 0.04, 12).rotateZ(Math.PI / 2).translate(W / 2 - 0.03, -0.2, 0.06), 0xc8a040)], 'diffindo-banner-roll', grp);
    const cord = dMesh([vc(new TorusGeometry(0.15, 0.018, 5, 12).translate(-0.35, -0.12, 0.06), 0xe8d8a0), vc(new TorusGeometry(0.15, 0.018, 5, 12).translate(0.35, -0.12, 0.06), 0xe8d8a0)], 'diffindo-banner-cord', grp);
    const pa = cloth.geometry.attributes.position, orig = Float32Array.from(pa.array);
    const B = { id: 'banner', label: 'הַדֶּגֶל', grp, cloth, roll, cord, pa, orig, rodN, L, state: 'tied', t: 0, k: 0, at: (o) => o.set(0, -0.15, 0.1).applyMatrix4(grp.matrixWorld) };
    setUnroll(B, 0);
    return B;
  }
  function setUnroll(B, k) {   // the cloth's height: 0.06 rolled .. 1 full; the roll rides the bottom edge
    const a = B.pa.array, o = B.orig, f = 0.06 + 0.94 * k;
    for (let i = B.rodN; i < B.pa.count; i++) a[i * 3 + 1] = o[i * 3 + 1] * f;
    B.pa.needsUpdate = true; B.cloth.geometry.computeBoundingSphere();
    B.roll.position.y = -(B.L * f) + 0.2 - 0.05 * (1 - k); B.roll.scale.setScalar(Math.max(0.01, 1 - k)); B.roll.visible = k < 0.99;
  }
  function buildCurtain(g, P) {
    // a long velvet curtain on a rod, tied back with a gold cord; cut: it falls straight and swings shut. cloth (+rod) + tie
    const W = 1.6, Hh = P.h, grp = new Group(); grp.position.set(P.x, 0, P.z); grp.rotation.y = -Math.PI / 2; grp.name = 'diffindo-curtain'; g.add(grp);   // against the east wall, facing -x
    const rod = [vc(new CylinderGeometry(0.03, 0.03, W + 0.5, 8).rotateZ(Math.PI / 2).translate(0, Hh + 0.08, 0.12), 0xb8903e)];
    for (const sx of [-1, 1]) rod.push(vc(new SphereLike(sx * (W / 2 + 0.25), Hh + 0.08, 0.12), 0xd8b04a));
    const clothG = new PlaneGeometry(W, Hh - 0.1, 8, 14).translate(0, (Hh - 0.1) / 2 + 0.1, 0.1);
    const cpos = clothG.attributes.position; for (let i = 0; i < cpos.count; i++) cpos.setZ(i, 0.1 + Math.sin(cpos.getX(i) * 9) * 0.04);   // folds
    const cloth = dMesh([...rod, vc(clothG, 0x2a4a3a)], 'diffindo-curtain-cloth', grp);   // library green
    const rodN = M(rod).attributes.position.count;
    const tieY = 1.25, tieX = -W / 2 - 0.05;
    const tie = dMesh([vc(new TorusGeometry(0.16, 0.025, 5, 12).rotateY(Math.PI / 2).scale(1, 1, 0.6).translate(tieX + 0.22, tieY, 0.14), 0xd8b04a), vc(new CylinderGeometry(0.03, 0.04, 0.22, 6).translate(tieX + 0.2, tieY - 0.2, 0.18), 0xd8b04a)], 'diffindo-curtain-tie', grp);
    const pa = cloth.geometry.attributes.position, orig = Float32Array.from(pa.array);
    const C = { id: 'curtain', label: 'הַוִּילוֹן', grp, cloth, tie, pa, orig, rodN, tieY, tieX, Hh, state: 'tied', t: 0, at: (o) => o.set(tieX + 0.22, tieY, 0.2).applyMatrix4(grp.matrixWorld) };
    setDrape(C, 1, 0);
    return C;
  }
  function SphereLike(x, y, z) { return new CylinderGeometry(0.05, 0.05, 0.1, 8).rotateZ(Math.PI / 2).translate(x, y, z); }
  function setDrape(C, k, swing) {   // k 1 tied back (gathered to the tie, the window open) .. 0 hanging straight (shut); swing = a sway
    const a = C.pa.array, o = C.orig, top = C.Hh;
    for (let i = C.rodN; i < C.pa.count; i++) {
      const x = o[i * 3], y = o[i * 3 + 1], u = Math.max(0, 1 - Math.abs(y - C.tieY) / (top - C.tieY + 0.3));   // pulled most at the tie height
      const gx = C.tieX + 0.25 + (x - C.tieX) * 0.18;   // gathered into a narrow bunch by the tie
      a[i * 3] = x + (gx - x) * k * (0.25 + 0.75 * u) + swing * (1 - y / top) * 0.25;
    }
    C.pa.needsUpdate = true; C.cloth.geometry.computeBoundingSphere();
  }
  function difBuild() {
    const r = interiors.room, id = interiors.active;
    if (r === DF.seen) return;
    DF.seen = r; DF.room = null;
    for (const it of DF.items) { const i = TARGETS.indexOf(it.target); if (i >= 0) TARGETS.splice(i, 1); }
    DF.items = [];
    if (!r || !r.group || !id) return;
    try {
      if (!difMat) difMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: DoubleSide });
      const g = r.group, made = [];
      if (id === DIF.gift.room) made.push(buildGift(g, DIF.gift));
      if (id === DIF.banner.room) made.push(buildBanner(g, DIF.banner));
      if (id === DIF.curtain.room) made.push(buildCurtain(g, DIF.curtain));
      if (!made.length) return;
      g.updateMatrixWorld(true);
      DF.room = id; DF.builds++;
      for (const it of made) {
        it.target = { id: 'diffindo-' + it.id, spells: ['diffindo'], real: true, b10: true, indoor: id, at: it.at, ok: () => !quiet() && interiors.room === r && it.state === 'tied', cast: () => { it.state = 'cut'; it.t = -0.3; } };
        TARGETS.push(it.target); DF.items.push(it);
      }
    } catch (e) { console.warn('[freecast] diffindo props skipped -', e && e.message || e); DF.items = []; }
  }
  function snip(p) { for (let i = 0; i < 10; i++) emit(p.x, p.y, p.z, (Math.random() - 0.5) * 1.6, Math.random() * 1.2, (Math.random() - 0.5) * 1.6, 0.6, 0.14, i % 2 ? 0xffb0d0 : 0xffffff, -2, 1); fun.sfx.tone(2400, 0.06, 'square', 0.05, 0, 1800); fun.sfx.tone(2600, 0.06, 'square', 0.05, 0.08, 1900); }
  function tickDif(dt) {
    difBuild();
    for (const it of DF.items) {
      if (it.state !== 'cut') continue;
      it.t += dt; const t = it.t; if (t < 0) continue;
      if (!it.snipped) { it.snipped = true; it.at(v0); snip(v0); }
      if (it.id === 'gift') {
        const k = Math.min(1, t / 0.9);
        it.rib.scale.set(1, Math.max(0.001, 1 - ease(t / 0.25)), 1);
        it.lid.position.set(Math.sin(k * Math.PI) * 0 + k * 0.45, 0.4 + Math.sin(k * Math.PI) * 0.7 - k * 0.38, k * 0.15); it.lid.rotation.set(k * 0.6, 0, -k * 1.4);
        if (k >= 1 && !it.popped) {
          it.popped = true; it.at(v0); for (const c of [0xffe27a, 0xff8ac0, 0x9ad8ff, 0xffffff]) burst(v0.x, v0.y, v0.z, c, 14, 2.4, 1.0, 0.22, -1.2);
          for (let i = 0; i < 6; i++) ctx.glyph('spark', v0.x, v0.y, v0.z, (Math.random() - 0.5) * 0.6, 1.6 + Math.random(), (Math.random() - 0.5) * 0.6, 1.4, 0.5, 0xffd76a, false, -1, 0.8);
          fun.sfx.tada(); try { fun.confetti(['⭐', '✨', '🎁', '💛'], 14); } catch { /* ignore */ }
        }
        if (k >= 1) it.state = 'open';
      } else if (it.id === 'banner') {
        it.cord.position.y = -t * t * 4.9; it.cord.visible = t < 1.2;
        const k = Math.min(1, t / 1.4); setUnroll(it, 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.03);
        if (k >= 1) { it.state = 'open'; setUnroll(it, 1); it.at(v0); burst(v0.x, v0.y - 1.5, v0.z, 0xffd76a, 18, 1.8, 0.8, 0.2, -0.8); fun.sfx.whoosh(); fun.sfx.chime(); }
      } else {
        it.tie.position.y = -Math.min(1.1, t * t * 4.9); it.tie.visible = t < 0.8;
        const k = Math.min(1, t / 1.6), sw = Math.sin(t * 5) * Math.exp(-2.2 * t);
        setDrape(it, 1 - ease(k * 1.3), sw);
        if (k >= 1) { it.state = 'open'; setDrape(it, 0, 0); fun.sfx.soft(); }
      }
    }
  }
  SP.diffindo = {
    noFallback: true,
    cast() {
      difBuild();
      const t = quiet() ? null : ctx.best('diffindo');
      if (!t || !t.b10) { this.lastId = null; hint('אֵין כָּאן סֶרֶט אוֹ חֶבֶל לַחְתֹּךְ. נַסֶּה בַּחֲדַר הַמּוֹעֲדוֹן, בָּאוּלָם הַגָּדוֹל אוֹ בַּסִּפְרִיָּה!'); return false; }
      t.at(tv); stream(tv, 0xffb0d0, 0.35); t.cast('diffindo'); DF.casts++; DF.cuts++;
      this.lastId = t.id; reward('diffindo', t.id); return true;
    },
    tick: (dt) => tickDif(dt),
    state: () => ({ room: DF.room, builds: DF.builds, casts: DF.casts, cuts: DF.cuts, items: DF.items.map(it => ({ id: it.target.id, state: it.state })) }),
    aim(id, d = 2.4) {   // test helper: stand Harry d m in front of an item, facing it
      const it = DF.items.find(x => x.target.id === id || x.id === id); if (!it) return null;
      it.at(v0); v1.set(0, 0, 1).applyQuaternion(it.grp.getWorldQuaternion(new Quaternion())); if (it.id === 'banner' || it.id === 'curtain') v1.set(v1.x, 0, v1.z).normalize(); else v1.set(1, 0, 1).normalize();
      const x = v0.x + v1.x * d, z = v0.z + v1.z * d; player.yaw = Math.atan2(v0.x - x, v0.z - z); try { player.teleport(x, z); } catch { /* plain */ } pos.x = x; pos.z = z;
      return { x: +x.toFixed(2), z: +z.toFixed(2), tx: +v0.x.toFixed(2), ty: +v0.y.toFixed(2), tz: +v0.z.toFixed(2) };
    },
  };

  // ================= Sonorus =================
  const SN = { casts: 0, t: -1, dur: 2.6, shakes: [], crowd: null, crowdBase: null, place: null, maxOff: 0 };
  const PITCH = { x: 0, z: 130, r: 48 };   // quidditch.js C (the pitch centre); the stands are ~24 m either side
  function shakeObj(o, amp, rot = 0) { SN.shakes.push({ o, p: o.position.clone(), rz: o.rotation.z, rx: o.rotation.x, amp, rot, ph: Math.random() * 6 }); }
  function sonorusTargets() {
    const out = [];
    const id = interiors.active, r = interiors.room;
    if (id && r && r.group) {
      const g = r.group;
      if (id === 'entrancehall' || id === 'greathall') {
        g.traverse(o => { if (o.name === 'hall-banners' || o.name === 'banner-rods') out.push(['shake', o, 0.05, 0.012]); });
        for (const e of g.userData.enchant || []) if (e.id === 'chandelier') out.push(['enchant', e]);
      } else if (id === 'staircase') {
        for (const c of g.children) if (c.isGroup && Math.abs(Math.abs(c.position.x) - 4.1) < 0.3 && Math.abs(c.position.y - 6.15) < 0.3) out.push(['shake', c, 0.06, 0.035]);   // rooms.js: the two side flights
      }
      return out.length ? { id, list: out } : null;
    }
    if (!id && Math.hypot(pos.x - PITCH.x, pos.z - PITCH.z) < PITCH.r) {
      const pg = scene.getObjectByName('quidditch-pitch');
      const cr = pg && pg.children.find(c => c.isInstancedMesh && c.count === 192);
      if (cr && cr.visible !== false) return { id: 'stands', list: [['crowd', cr]] };
    }
    return null;
  }
  function endSonorus() {
    for (const s of SN.shakes) { s.o.position.copy(s.p); s.o.rotation.z = s.rz; }
    SN.shakes.length = 0;
    if (SN.crowd && SN.crowdBase) { for (let i = 0; i < SN.crowd.count; i++) SN.crowd.setMatrixAt(i, _m4.fromArray(SN.crowdBase, i * 16)); SN.crowd.instanceMatrix.needsUpdate = true; }
    SN.crowd = null; SN.t = -1;
  }
  function sonorusCast() {
    if (SN.t >= 0) endSonorus();
    SN.casts++; SN.t = 0; SN.place = null; SN.maxOff = 0;
    // the boom: a low drop + a rumble (WebAudio synth, fun.sfx)
    fun.sfx.boom(); fun.sfx.tone(95, 1.1, 'sine', 0.3, 0, 48); fun.sfx.tone(140, 0.6, 'triangle', 0.12, 0.05, 70);
    for (let i = 0; i < 4; i++) ring(pos.x, pos.y + 1.4, pos.z, 3.5 + i * 1.2, 1.0, 0xffd890, false, i * 0.22, 0.4);
    ring(pos.x, pos.y + 0.1, pos.z, 7, 1.3, 0xffc860, true, 0.1);
    const T0 = sonorusTargets(); if (!T0) return null;
    SN.place = T0.id;
    for (const it of T0.list) {
      if (it[0] === 'shake') shakeObj(it[1], it[2], it[3]);
      else if (it[0] === 'enchant') { try { it[1].cast(); } catch { /* ignore */ } }
      else if (it[0] === 'crowd') { SN.crowd = it[1]; SN.crowdBase = Float32Array.from(it[1].instanceMatrix.array); }
    }
    if (T0.id === 'staircase') fun.sfx.noise(2.0, 0.2, 0.1, 200, 0.7, 'lowpass');
    if (T0.id === 'stands') { fun.sfx.noise(2.2, 0.16, 0.2, 1800, 0.4); fun.sfx.fanfare(); }
    return T0.id;
  }
  function tickSonorus(dt, busy) {
    if (SN.t < 0) return;
    SN.t += dt; const t = SN.t;
    if (t >= SN.dur || busy) { endSonorus(); return; }
    const env = Math.min(1, t / 0.15) * Math.max(0, 1 - t / SN.dur);
    for (const s of SN.shakes) {
      const a = s.amp * env, ox = Math.sin(t * 37 + s.ph) * a, oy = Math.sin(t * 29 + s.ph * 2) * a * 0.5;
      s.o.position.set(s.p.x + ox, s.p.y + oy, s.p.z + Math.cos(t * 31 + s.ph) * a);
      s.o.rotation.z = s.rz + Math.sin(t * 6 + s.ph) * s.rot * env;
      SN.maxOff = Math.max(SN.maxOff, Math.abs(ox));
    }
    if (SN.crowd) {
      const C = SN.crowd, B = SN.crowdBase;
      for (let i = 0; i < C.count; i++) { _m4.fromArray(B, i * 16); const h = Math.abs(Math.sin(t * 9 + i * 0.7)) * 0.45 * env; _m4.elements[13] += h; C.setMatrixAt(i, _m4); if (h > SN.maxOff) SN.maxOff = h; }
      C.instanceMatrix.needsUpdate = true;
      if (Math.random() < dt * 10 * env) { const side = Math.random() < 0.5 ? -1 : 1; ctx.glyph('spark', PITCH.x + (Math.random() - 0.5) * 40, pos.y + 6 + Math.random() * 3, PITCH.z + side * 25, 0, 1.5, 0, 1.2, 0.7, side < 0 ? 0xe8283a : 0x2ad86a, false, -1.5, 0.6); }
    }
  }
  SP.sonorus = {
    noFallback: true,
    blocked: () => { const c = document.body.classList; return c.contains('inMatch') || c.contains('inSpell'); },
    cast() {
      if (quiet()) { this.lastId = null; return false; }
      const id = sonorusCast();
      if (!id) { this.lastId = null; hint('בּוּם! נַסֶּה סוֹנוֹרוּס בְּאוּלַם הַכְּנִיסָה, בְּאוּלַם הַמַּדְרֵגוֹת אוֹ לְיַד יְצִיעֵי הַקְּוִידִּיץ׳!'); return false; }
      this.lastId = 'sonorus-' + id; reward('sonorus', id); return true;
    },
    tick: (dt, ins, busy) => tickSonorus(dt, busy || quiet()),
    state: () => ({ casts: SN.casts, on: SN.t >= 0, t: +Math.max(0, SN.t).toFixed(2), place: SN.place, shakes: SN.shakes.length, crowd: !!SN.crowd, maxOff: +SN.maxOff.toFixed(3) }),
  };

  // ================= Glisseo =================
  // the staircase hall's central flight (rooms.js): 12 steps rising toward -z from z -2 (top ~5.5 m at z -10.8), landing top 6.0 m
  const GS = { z0: -11.6, zTop: -11.2, zBot: -1.6, zEnd: 1.2, yTop: 6.0, W: 3.2 };
  const rampY = (z) => (z <= GS.zTop ? GS.yTop : z <= GS.zBot ? 0.5 + (GS.yTop - 0.5) * (GS.zBot - z) / (GS.zBot - GS.zTop) : 0.05 + 0.45 * Math.pow(1 - Math.min(1, (z - GS.zBot) / (GS.zEnd - GS.zBot)), 2));
  const GL = { casts: 0, rides: 0, aborted: 0, on: false, t: 0, k: 0, kTo: 0, hold: 0, maxY: 0, said: false, from: new Vector3(), last: null, ended: null };
  let ramp = null;
  function rampMesh(Y) {
    const N = 28, z0 = GS.zTop - 0.2, z1 = GS.zEnd, pts = [];
    const g = new PlaneGeometry(GS.W, 1, 2, N); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = (p.getY(i) + 0.5), z = z0 + (z1 - z0) * (1 - v); p.setXYZ(i, p.getX(i), rampY(z) + 0.06, z); }
    g.computeVertexNormals();
    const m = new Mesh(g, new MeshStandardMaterial({ color: 0x9ad0e8, emissive: 0x2a6a8a, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false }));
    m.name = 'freecast-glisseo-slide'; m.frustumCulled = false; m.raycast = () => {}; m.visible = false; m.renderOrder = 2;
    scene.add(m); return m;
  }
  const glCan = () => interiors.active === 'staircase' && interiors.room && Math.abs(pos.x) < 6 && pos.z > -13 && pos.z < 4;
  function glEnd(ok) {
    GL.on = false; GL.hold = ok ? 1.2 : 0; GL.kTo = 0; GL.ended = ok ? 'landed' : 'aborted';
    try { const m = player.model; if (m) m.rotation.x = 0; } catch { /* ignore */ }
    try { player.teleport(pos.x, Math.min(pos.z, GS.zEnd + 1)); } catch { /* ignore */ }
    try { ctx.setTakeover(null); } catch { /* ignore */ }
    if (ok) GL.rides++; else GL.aborted++;
  }
  function glStart() {
    if (!ramp) ramp = rampMesh();
    const r = interiors.room, Y = r.group.position.y;
    GL.on = true; GL.t = 0; GL.kTo = 1; GL.maxY = 0; GL.said = false; GL.from.set(pos.x, pos.y, pos.z); GL.casts++; GL.room = r; GL.Y = Y; GL.ended = null;
    ramp.position.set(0, Y, 0);
    fun.sfx.tone(500, 0.8, 'sine', 0.1, 0, 1200); fun.sfx.sparkle();
    const cam = new Vector3();
    ctx.setTakeover({ spell: true, update(dt) {
      try {
        if (!GL.on) { ctx.setTakeover(null); return; }
        if (interiors.room !== GL.room || GL.t > 7) { glEnd(false); return; }
        GL.t += dt; const t = GL.t;
        let x, y, z, yaw = 0, lean = 0;
        if (t < 1.3) {   // float up to the landing, sparkles
          const k = ease(t / 1.3); x = GL.from.x + (0 - GL.from.x) * k; z = GL.from.z + (GS.z0 - GL.from.z) * k; y = GS.yTop * k + Math.sin(k * Math.PI) * 0.8;
          yaw = Math.atan2(0 - GL.from.x, GS.z0 - GL.from.z) * (1 - k);
          if (Math.random() < dt * 30) emit(x + (Math.random() - 0.5) * 0.5, GL.Y + y + Math.random(), z, 0, -0.4, 0, 0.7, 0.16, 0x9ae0ff, -0.3);
        } else if (t < 4.1) {   // the slide: speeds up, the kick-out at the bottom slows it
          if (!GL.said) { GL.said = true; fun.sfx.whoosh(); fun.sfx.tone(900, 1.6, 'sine', 0.08, 0, 300); try { fun.say(bubAt.set(0, GL.Y + 8, GS.z0), 'וִיייי! 🛝', 2.4, 'freecast'); } catch { /* ignore */ } }
          const u = (t - 1.3) / 2.8, s = u < 0.75 ? 0.75 * (u / 0.75) * (u / 0.75) : 0.75 + (1 - Math.pow(1 - (u - 0.75) / 0.25, 2)) * 0.25;
          x = 0; z = GS.z0 + (GS.zEnd + 1 - GS.z0) * s; y = rampY(z) + 0.06; lean = z < GS.zBot ? -0.35 : -0.35 * (1 - (z - GS.zBot) / (GS.zEnd + 1 - GS.zBot));
          if (Math.random() < dt * 40) emit(x + (Math.random() - 0.5) * 0.8, GL.Y + y + 0.1, z - 0.3, (Math.random() - 0.5) * 0.6, 0.5, -0.8, 0.5, 0.18, Math.random() < 0.5 ? 0xffffff : 0x9ae0ff, -1);
        } else {
          x = 0; z = GS.zEnd + 1; y = 0;
          burst(x, GL.Y + 0.2, z, 0x9ae0ff, 20, 1.8, 0.7, 0.2, -1); fun.sfx.pop(); fun.sfx.giggle(true);
          pos.x = x; pos.z = z; glEnd(true); return;
        }
        GL.maxY = Math.max(GL.maxY, y);
        pos.set(x, GL.Y + y, z); player.yaw = yaw;
        const m = player.model; m.position.copy(pos); m.rotation.y = yaw; m.rotation.x = lean;
        player.animate(dt, { moving: false }, 0);
        player.cam.update(dt, cam.copy(pos), yaw, true);
      } catch (e) { console.warn('[freecast] glisseo -', e && e.message || e); glEnd(false); }
    } });
  }
  function tickGlisseo(dt) {
    if (!ramp) return;
    if (GL.hold > 0) GL.hold -= dt;
    const want = GL.on || GL.hold > 0 ? 1 : 0;
    GL.k += (want - GL.k) * Math.min(1, dt * (want ? 3 : 1.5));
    if (interiors.active !== 'staircase') GL.k = 0;
    ramp.material.opacity = 0.75 * GL.k; ramp.visible = GL.k > 0.02;
  }
  SP.glisseo = {
    noFallback: true,
    blocked: () => GL.on,
    cast() {
      if (quiet() || GL.on) { this.lastId = null; return false; }
      if (!glCan() || !ctx.setTakeover) { this.lastId = null; hint('גְּלִיסֵאוֹ הוֹפֵךְ מַדְרֵגוֹת לִמְגְלֵשָׁה. נַסֶּה לְיַד הַמַּדְרֵגוֹת בְּאוּלַם הַמַּדְרֵגוֹת!'); return false; }
      tip(); stream(v0.set(0, interiors.room.group.position.y + 3, -6), 0x9ae0ff, 0.6);
      glStart(); this.lastId = 'glisseo-staircase'; reward('glisseo', 'staircase'); return true;
    },
    tick: (dt) => tickGlisseo(dt),
    state: () => ({ casts: GL.casts, on: GL.on, t: +GL.t.toFixed(2), rides: GL.rides, aborted: GL.aborted, maxY: +GL.maxY.toFixed(2), ended: GL.ended, ramp: ramp ? +ramp.material.opacity.toFixed(2) : 0, takeover: !!(window.__game && window.__game.takeover) }),
    _abort: () => { if (GL.on) glEnd(false); },
  };

  // ================= per-frame (the shared clock) =================
  SP._b10 = {
    noFallback: true,
    tick(dt, ins) { T += dt; inside = !!ins; tickRings(dt); },
    state: () => ({ rings: rings.count, ...log }),
  };

  const api = {
    diffindoAim: (id, d) => SP.diffindo.aim(id, d),
    glisseoAbort: () => SP.glisseo._abort(),
    state: () => { const o = { ...log, paid: [...paid] }; for (const k of ['finite', 'pointme', 'herbivicus', 'diffindo', 'sonorus', 'glisseo']) if (SP[k] && SP[k].state) o[k] = SP[k].state(); return o; },
  };
  return { SP, api };
}
