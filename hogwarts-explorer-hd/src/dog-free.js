// Sirius the big friendly black dog in FREE PLAY (book 3 piece C, briefs/2026-11-26-book3-piece-c.md). From a fresh save he
// lives outdoors by Hagrid's hut: a tiny schedule (like roam.js, but his own): he sits and wags at one of three spots, now
// and then trots on to the next. When Harry comes within ~6 m he trots up, sits in front of him and wags. A tap on him = a
// soft happy WebAudio "woof", hearts, a nod and the bubble "הכלב השחור הגדול שמח לראות אותך 🐾". The 🎾 prompt: Harry throws a
// ball in a small arc, the dog runs, brings it back and drops it at Harry's feet (three throws, then he lies down for a rest;
// +5 house points for the first fetch, once per session). Spells never act on him (a kind bubble). Never a growl, never a fail.
// The model is "Dog from Lamps" by Flightyfelon (CC-BY-4.0, models.json 'blackdog': 6,009 tris, 2 materials, clips Idle /
// Sit_Wag / Run; no walk clip: Run at a slow time scale is his trot), shown at 1.4x: a BIG dog. Loaded lazily (first time
// Harry comes within LOAD_R of his spots outdoors), never at game start; a load failure is silent (simply no dog).
// Holds: while ANY adventure runs he is out of the world at once (the finale 'b3-save' has its own dog on the tower: never
// two; adventure-b3-save.js calls dogHandOver() synchronously when its scene is created). A lesson, a course, Quidditch, a
// Floo trip, a modal, a free ride / flight or another takeover: a short fade, then not drawn; he comes back afterwards.
// Visibility: a distance rule only (drawn when Harry or the camera is within SHOW_R of him; never frustum-culled by hand).
// All his spots are >= 60 m from the gates view position (0, 74), whose budget has no room for him.
// Budget: + 6,009 tris and 2 draw calls (+2 in the shadow pass) where he is drawn; the ball is one tiny mesh; hearts use the
// shared freecast particle pool; nothing is allocated per frame.
// Debug / tests: window.__game.dog  state() hold(on) tap() ball() come() spots() headScreen() fast(k) goSpot(i)
import { Vector3, AnimationMixer, LoopRepeat, Mesh, SphereGeometry, MeshStandardMaterial, Quaternion } from 'three';
import { loadAnimated } from './models.js';
import { speak as voiceSpeak } from './voice.js';

export const DOG_FREE_ON = true;   // the single switch: false = no free-play dog at all (the finale is unaffected)
export const DOG_SCALE = 1.4;      // the GLB is ~0.95 m to the top of the head; 1.4x (~1.3 m) = a big, soft dog beside Harry (1.82 m)
// three spots by the hut, clear of the Creatures course (x < 75 at z < 61), the paddock / Buckbeak (79.5, 50.5), the hut
// path (ends at 76.8, 34.4), the Floo hearth behind the hut and the trees; [x, z, yaw]
export const DOG_SPOTS = [[93.5, 49.5, -2.2], [96.0, 37.5, -1.9], [88.0, 30.5, -2.6]];
const LOAD_R = 62, SHOW_R = 45, COME_R = 9, LEAVE_R = 14, PROMPT_R = 6.5, FADE = 0.45, TROT = 1.7, RUN = 4.6, THROWS = 3;
const GATES = { x: 0, z: 74 };
const ROUTE = [0, 1, 2, 1];   // there and back (the 2 -> 0 leg would brush the hut's eaves and the hearth behind it)
let PAID = false;              // +5 for the first fetch: once per session (memory only)
let handOver = null;           // set by createDogFree: drops the free dog at once (the finale calls it)
export function dogHandOver() { try { if (handOver) handOver(); } catch (e) { console.warn('[dog-free] hand-over -', e && e.message || e); } }

// The rigged dog, ready to place: { obj, mixer, acts, bones, tris } (shared by free play and the finale). `alive()` is
// checked after the load. Meshes: never frustum-culled, no raycast, shadows on.
export const DOG_FREE_SCALE = 1.65; // free play: he is met from the default camera distance on open grass, so a little bigger still
const FUR_LIFT = 1.8;                // the coat texture is near-black: lifted so his shape, face and shaggy fur read in daylight
export async function loadDog(name, alive, scale = DOG_SCALE) {
  const r = await loadAnimated('blackdog', alive);
  if (!r || !r.obj || !r.clips || !r.clips.find(c => c.name === 'Sit_Wag')) return null;
  const obj = r.obj; obj.name = name; obj.scale.setScalar(scale);
  const bones = {}; let tris = 0;
  obj.traverse(o => {
    if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false; o.raycast = () => {}; for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m && m.color && !m.userData.furLift) { m.userData.furLift = true; m.color.multiplyScalar(FUR_LIFT); if (m.roughness !== undefined) m.roughness = Math.max(m.roughness, 0.85); } const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; }
    if (o.isBone) { if (/^Head/i.test(o.name)) bones.head = o; else if (/^Neck/i.test(o.name)) bones.neck = o; }
  });
  const mixer = new AnimationMixer(obj), acts = {};
  for (const c of r.clips) { acts[c.name] = mixer.clipAction(c); acts[c.name].setLoop(LoopRepeat, Infinity); }
  return { obj, mixer, acts, bones, tris: Math.round(tris) };
}
// a soft happy "woof" (two little round notes, never a growl)
export function woof(fun, n = 1) { const t = (f, d, w, to, v = 0.14, ty = 'sine') => { try { fun.sfx.tone(f, d, ty, v, w, to); } catch { /* no audio */ } };
  for (let i = 0; i < n; i++) { const w = i * 0.32; t(300, 0.1, w, 210); t(420, 0.09, w + 0.005, 300, 0.07, 'triangle'); t(330, 0.13, w + 0.13, 230, 0.12); } }

export function createDogFree({ scene, camera, player, interiors, fun, freecast, lessons, isModal, isTakeover, adventures, floo }) {
  const off = { tick() {}, api: { state: () => ({ on: false }), hold: () => false } };
  if (!DOG_FREE_ON) return off;
  const FI = freecast && freecast._internal;
  const emit = (...a) => { try { FI.emit(...a); } catch { /* no particles */ } };
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const muted = () => { try { return !!(window.HP && window.HP.sfx && window.HP.sfx.isMuted && window.HP.sfx.isMuted()); } catch { return false; } };
  const outdoors = () => !interiors.active;
  const groundAt = (x, z) => (player.heightAt ? player.heightAt(x, z) : 0);
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  const v1 = new Vector3(), v2 = new Vector3(), _p = new Vector3(), q1 = new Quaternion(), qa = new Quaternion(), qi = new Quaternion(), ax = new Vector3();
  const log = { builds: 0, drops: 0, holds: 0, held: null, taps: 0, barks: 0, comes: 0, throws: 0, fetches: 0, rests: 0, paid: 0, spellSays: 0, says: 0, lastSay: null, spoken: [], errors: 0, failed: false, trots: 0 };
  const D = { dog: null, loading: false, x: DOG_SPOTS[0][0], z: DOG_SPOTS[0][1], yaw: DOG_SPOTS[0][2], spot: 0, mode: 'sit', t: 0, wait: 22, tx: 0, tz: 0, cur: null,
    fade: 1, hidden: false, nod: 0, throwsLeft: THROWS, rest: 0, ball: null, bx: 0, by: 0, bz: 0, bvx: 0, bvy: 0, bvz: 0, ballOn: false, ballFly: false, carry: false,
    casts0: 0, clk: 1, mats: null, bub: null, lastWhy: null, nearT: 0, gen: 0, seq: 0 };
  let busy = null, busyT = 1, busyN = 0, debugHold = false;

  // ---- the bubble: a world bubble over his head (no helper box in free play) ----
  function headW(out) { const h = D.dog && D.dog.bones.head; if (h) { h.getWorldPosition(out); return out; } return out.set(D.x + Math.sin(D.yaw) * 0.7, groundAt(D.x, D.z) + 1.1, D.z + Math.cos(D.yaw) * 0.7); }
  function say(text, sec = 3.6) {
    log.says++; log.lastSay = text; log.spoken.push(text); if (log.spoken.length > 10) log.spoken.shift();
    try { headW(v1); v1.y += 0.9; D.bub = fun.say(v1, text, sec, 'dogfree'); } catch { /* no bubble */ }
    try { if (!muted()) voiceSpeak(text, { preset: 'narrator' }); } catch { /* no speech */ }
  }
  const screen = (v, out = { x: 0, y: 0, on: false }) => { _p.copy(v).project(camera); out.x = (_p.x * 0.5 + 0.5) * innerWidth; out.y = (-_p.y * 0.5 + 0.5) * innerHeight; out.on = _p.z < 1 && Math.abs(_p.x) <= 1.05 && Math.abs(_p.y) <= 1.05; return out; };

  // ---- the ball: one tiny mesh, only in the world while a throw is on ----
  function ensureBall() {
    if (D.ball) return D.ball;
    const m = new Mesh(new SphereGeometry(0.11, 12, 8), new MeshStandardMaterial({ color: 0xc8d838, roughness: 0.75 }));
    m.name = 'dog-ball'; m.frustumCulled = false; m.raycast = () => {}; m.castShadow = true; D.ball = m; return m;
  }
  function ballShow(on) { if (on && !D.ballOn) { scene.add(ensureBall()); D.ballOn = true; } else if (!on && D.ballOn) { if (D.ball.parent) D.ball.parent.remove(D.ball); D.ballOn = false; D.ballFly = false; D.carry = false; } }

  // ---- hold rules (as buckbeak-free.js); an adventure is checked every frame ----
  function busyWhy() {
    try {
      if (isTakeover()) return 'takeover';
      if (isModal()) return 'modal';
      if (lessons && lessons.openKey && lessons.openKey()) return 'lesson';
      const bc = document.body.classList;
      if (bc.contains('inSpell')) return 'course';
      if (bc.contains('inMatch')) return 'match';
      if (bc.contains('inFloo')) return 'floo';
      if (bc.contains('advBB')) return 'ride';
      const fl = floo && floo(); if (fl) { const f = fl.state(); if (f.phase !== 'idle' || f.pickOpen) return 'floo'; }
    } catch { /* an api missing: not busy */ }
    if (debugHold) return 'debug';
    return null;
  }
  function adventureOn() {
    if (document.body.classList.contains('inAdv')) return true;
    try { const ad = adventures && adventures(); return !!(ad && ad.state().quest); } catch { return false; }
  }

  // ---- build / drop ----
  function build() {
    if (D.dog || D.loading || log.failed) return;
    D.loading = true; const gen = ++D.gen;
    loadDog('dogfree-blackdog', () => D.gen === gen && !adventureOn(), DOG_FREE_SCALE).then((r) => {
      D.loading = false;
      if (D.gen !== gen || adventureOn()) return;
      if (!r) { log.failed = true; return; }
      D.dog = r; D.cur = null; D.mats = null; log.builds++; D.fade = 0; D.hidden = false;
      scene.add(r.obj); play('Sit_Wag', 0); place(); D.casts0 = casts();
    }).catch((e) => { D.loading = false; log.failed = true; console.warn('[dog-free] model failed -', e && e.message || e); });
  }
  function drop() {
    D.gen++; D.loading = false;
    if (D.dog) { const o = D.dog.obj; if (o.parent) o.parent.remove(o); try { D.dog.mixer.stopAllAction(); D.dog.mixer.uncacheRoot(o); } catch { /* ok */ } log.drops++; }
    if (D.mats) for (const m of D.mats) { try { m.dispose(); } catch { /* ok */ } }
    D.dog = null; D.mats = null; D.cur = null; ballShow(false);
    if (D.mode !== 'sit' && D.mode !== 'trot') { D.mode = 'sit'; nearestSpot(); D.x = DOG_SPOTS[D.spot][0]; D.z = DOG_SPOTS[D.spot][1]; D.yaw = DOG_SPOTS[D.spot][2]; D.t = 0; }
    if (D.bub) { D.bub.t = Math.min(D.bub.t, 0); D.bub = null; }
  }
  handOver = () => drop();
  function play(name, fade = 0.35, ts = 1) {
    const d = D.dog; if (!d) return; const a = d.acts[name]; if (!a) return;
    a.timeScale = ts;
    if (D.cur === name) return;
    const prev = D.cur ? d.acts[D.cur] : null;
    a.reset(); a.setEffectiveWeight(1); a.play();
    if (prev && fade > 0) prev.crossFadeTo(a, fade, false); else if (prev) prev.stop();
    D.cur = name;
  }
  // feet on the lawn: the average of the ground under his front and back paws
  function place() {
    if (!D.dog) return;
    const fx = Math.sin(D.yaw) * 0.5, fz = Math.cos(D.yaw) * 0.5, yf = groundAt(D.x + fx, D.z + fz), yb = groundAt(D.x - fx, D.z - fz);
    D.dog.obj.position.set(D.x, Math.min(yf, yb) + Math.abs(yf - yb) * 0.5 - 0.02, D.z); D.dog.obj.rotation.set(0, D.yaw, 0);
  }
  function ownMats() {
    if (D.mats) return D.mats; if (!D.dog) return null;
    D.mats = [];
    D.dog.obj.traverse(o => { if (!o.isMesh) return; const one = (m) => { const c = m.clone(); c.userData.dfT = m.transparent; c.userData.dfO = m.opacity; D.mats.push(c); return c; };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material); });
    return D.mats;
  }
  function setFade(k) {
    const ms = ownMats(); if (!ms) return;
    const solid = k >= 0.999;
    for (const m of ms) { const t = solid ? m.userData.dfT : true; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } m.opacity = m.userData.dfO * (solid ? 1 : k); }
  }
  function nearestSpot() { let b = 0, bd = 1e9; for (let i = 0; i < DOG_SPOTS.length; i++) { const d = Math.hypot(D.x - DOG_SPOTS[i][0], D.z - DOG_SPOTS[i][1]); if (d < bd) { bd = d; b = i; } } D.spot = b; D.seq = ROUTE.indexOf(b); return b; }
  const dHarry = () => Math.hypot(player.pos.x - D.x, player.pos.z - D.z);
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // move toward (tx, tz) at speed v; true on arrival
  function moveTo(tx, tz, v, dt, stopAt = 0.15) {
    const dx = tx - D.x, dz = tz - D.z, d = Math.hypot(dx, dz);
    if (d <= stopAt) return true;
    const yaw = Math.atan2(dx, dz); D.yaw = wrapA(D.yaw + wrapA(yaw - D.yaw) * Math.min(1, dt * 6));
    const s = Math.min(d - stopAt, v * dt); D.x += dx / d * s; D.z += dz / d * s;
    return d - s <= stopAt + 1e-3;
  }
  function faceHarry(dt) { const yaw = Math.atan2(player.pos.x - D.x, player.pos.z - D.z); D.yaw = wrapA(D.yaw + wrapA(yaw - D.yaw) * Math.min(1, dt * 4)); }
  // where he sits for Harry: 1.7 m in front of Harry, on the side the dog came from
  // (in front of Harry as the lens sees him, a little to one side, so Harry never hides him: the side nearer the dog)
  function besideHarry(out) {
    const c = Math.atan2(player.pos.x - camera.position.x, player.pos.z - camera.position.z), d = Math.atan2(D.x - player.pos.x, D.z - player.pos.z);
    const side = wrapA(d - c) >= 0 ? 1 : -1, a = c + side * 0.95;
    return out.set(player.pos.x + Math.sin(a) * 1.9, 0, player.pos.z + Math.cos(a) * 1.9);
  }

  // ---- actions ----
  function ready() { return !!(D.dog && outdoors() && !D.hidden && !busy && !adventureOn() && D.dog.obj.visible); }
  function tapDog() {
    if (!ready()) return false;
    log.taps++;
    if (dHarry() > 9) { say('בוא קרוב יותר לכלב 🐾'); return true; }
    log.barks++; woof(fun, 2); D.nod = 1.0;
    headW(v1); for (let i = 0; i < 12; i++) emit(v1.x + (Math.random() - 0.5) * 0.5, v1.y + 0.25 + Math.random() * 0.3, v1.z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6, 1.3, 0.24, Math.random() < 0.5 ? 0xff7aa8 : 0xffb0cc, 0.1);
    say('הכלב השחור הגדול שמח לראות אותך 🐾');
    if (D.mode === 'sit' || D.mode === 'trot') come();
    return true;
  }
  function come() { if (!D.dog || D.mode === 'come' || D.mode === 'withHarry' || D.mode === 'fetch' || D.mode === 'return') return false; D.mode = 'come'; D.t = 0; log.comes++; return true; }
  function throwBall() {
    if (!ready() || D.mode !== 'withHarry' || D.ballOn) return false;
    if (D.throwsLeft <= 0) { say('הכלב נח עכשיו... עוד מעט נשחק שוב 🐾'); return true; }
    // a small arc in front of Harry, 7-9 m, shortened if it would land in a wall / the hut
    const f = player.yaw; let dist = 8.5;
    for (; dist > 3; dist -= 1) { const x = player.pos.x + Math.sin(f) * dist, z = player.pos.z + Math.cos(f) * dist; if (!player._blocked || !player._blocked(x, z, 0.6)) break; }
    const T = 1.1, x0 = player.pos.x + Math.sin(f) * 0.4, z0 = player.pos.z + Math.cos(f) * 0.4, y0 = player.pos.y + 1.4, xe = player.pos.x + Math.sin(f) * dist, ze = player.pos.z + Math.cos(f) * dist, ye = groundAt(xe, ze) + 0.11;
    D.bx = x0; D.by = y0; D.bz = z0; D.bvx = (xe - x0) / T; D.bvz = (ze - z0) / T; D.bvy = (ye - y0) / T + 4.9 * T; D.ballFly = true; D.carry = false; ballShow(true); D.ball.position.set(D.bx, D.by, D.bz);
    D.tx = xe; D.tz = ze; D.throwsLeft--; log.throws++; D.mode = 'fetch'; D.t = 0;
    try { player.play('Wave'); } catch { /* ok */ }
    sfx('whoosh'); woof(fun, 1);
    return true;
  }
  function tap(x, y) {
    if (!ready()) return false;
    const R = Math.max(46, Math.min(innerWidth, innerHeight) * 0.08), s = { x: 0, y: 0, on: false };
    const near = (v) => { screen(v, s); return s.on ? Math.hypot(s.x - x, s.y - y) : 1e9; };
    headW(v1); let d = near(v1);
    v1.set(D.x, groundAt(D.x, D.z) + 0.6 * DOG_SCALE, D.z); d = Math.min(d, near(v1) * 0.85);
    if (d < R * 2.0) { tapDog(); return true; }
    return false;
  }
  const view = document.getElementById('view');
  let down = null;
  if (view) {
    view.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; }, { passive: true });
    view.addEventListener('pointerup', (e) => {
      const d0 = down; down = null;
      if (!d0 || d0.id !== e.pointerId || !D.dog || isModal() || isTakeover()) return;
      if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 18 || performance.now() - d0.t > 900) return;
      try { tap(e.clientX, e.clientY); } catch (er) { log.errors++; console.warn('[dog-free] tap failed -', er && er.message || er); }
    }, { passive: true });
  }

  // ---- per frame ----
  function tick(dt0) {
    if (adventureOn()) { if (D.dog || D.loading) drop(); if (D.lastWhy !== 'adventure') { D.lastWhy = 'adventure'; log.holds++; } log.held = 'adventure'; return; }
    const dt = dt0 * D.clk;
    busyN++; busyT += dt0;
    if (busyT > 0.25 || busyN >= 3) { busyT = 0; busyN = 0; busy = busyWhy(); }
    const why = busy;
    if (why !== D.lastWhy) { if (why) log.holds++; D.lastWhy = why; }
    log.held = why;
    if (!D.dog) {
      if (why || log.failed || D.loading || !outdoors()) return;
      let near = 1e9; for (const s of DOG_SPOTS) near = Math.min(near, Math.hypot(player.pos.x - s[0], player.pos.z - s[1]));
      if (near < LOAD_R) build();
      return;
    }
    const o = D.dog.obj;
    // the distance rule (Harry or the lens within SHOW_R; no frustum test)
    const dp = dHarry(), dc = Math.hypot(camera.position.x - D.x, camera.position.z - D.z);
    const inRange = outdoors() && Math.min(dp, dc) < SHOW_R;
    if (why) {
      if (!D.hidden) { D.hidden = true; if (!o.visible) D.fade = 0; ballShow(false); if (D.mode === 'fetch' || D.mode === 'return') { D.mode = 'withHarry'; } }
      if (D.fade > 0) { D.fade = Math.max(0, D.fade - dt0 / FADE); setFade(D.fade); try { D.dog.mixer.update(dt0); } catch { /* ok */ } }
      o.visible = inRange && D.fade > 0;
      return;
    }
    if (D.hidden) { D.hidden = false; D.fade = 0; D.casts0 = casts(); }
    if (D.fade < 1) { D.fade = Math.min(1, D.fade + dt0 / FADE); setFade(D.fade); }
    o.visible = inRange;
    D.t += dt;
    // a spell near him: a kind word (he is patted and played with, never charmed)
    const n = casts();
    if (n !== D.casts0) { D.casts0 = n; if (o.visible && dp < 14) { log.spellSays++; say('לא מטילים לחשים על הכלב 🐾 אפשר ללטף אותו ולשחק איתו בכדור!'); } }
    // the schedule
    if (D.mode === 'sit') {
      play('Sit_Wag', 0.4);
      if (dp < COME_R && o.visible) come();
      else if (D.t > D.wait) { D.mode = 'trot'; D.seq = (D.seq + 1) % ROUTE.length; D.spot = ROUTE[D.seq]; D.t = 0; log.trots++; }
    } else if (D.mode === 'trot') {
      play('Run', 0.4, 0.5);
      const s = DOG_SPOTS[D.spot];
      if (dp < COME_R && o.visible) come();
      else if (moveTo(s[0], s[1], TROT, dt)) { D.mode = 'sit'; D.t = 0; D.wait = 20 + Math.random() * 16; }
    } else if (D.mode === 'come') {
      besideHarry(v2);
      if (dp > LEAVE_R + 4) { D.mode = 'trot'; nearestSpot(); D.t = 0; }
      else if (moveTo(v2.x, v2.z, dp > 5 ? 3.0 : TROT, dt, 0.25)) { D.mode = 'withHarry'; D.t = 0; woof(fun, 1); }
      else play('Run', 0.3, dp > 5 ? 0.85 : 0.55);
    } else if (D.mode === 'withHarry') {
      play('Sit_Wag', 0.4, D.rest > 0 ? 0.45 : 1);
      faceHarry(dt);
      if (D.rest > 0) { D.rest -= dt; if (D.rest <= 0) D.throwsLeft = THROWS; }
      if (dp > LEAVE_R) { D.nearT += dt; if (D.nearT > 3) { D.nearT = 0; D.mode = 'trot'; nearestSpot(); D.t = 0; } }
      else { D.nearT = 0; if (dp > 3.2 && D.t > 1.5) { D.mode = 'come'; D.t = 0; } }
    } else if (D.mode === 'fetch') {
      play('Run', 0.25, 1);
      if (D.ballFly) { D.bvy -= 9.8 * dt; D.bx += D.bvx * dt; D.by += D.bvy * dt; D.bz += D.bvz * dt; const g = groundAt(D.bx, D.bz) + 0.11; if (D.by <= g && D.bvy < 0) { D.by = g; D.ballFly = false; sfx('boing'); } D.ball.position.set(D.bx, D.by, D.bz); }
      if (D.t > 0.35 && moveTo(D.bx, D.bz, RUN, dt, 0.55) && !D.ballFly) { D.carry = true; D.mode = 'return'; D.t = 0; }
      if (D.t > 14) { D.ballFly = false; D.carry = true; D.mode = 'return'; D.t = 0; }   // never stuck: he simply has it
    } else if (D.mode === 'return') {
      besideHarry(v2);
      play('Run', 0.25, 0.8);
      if (moveTo(v2.x, v2.z, 3.4, dt, 0.25) || D.t > 14) {
        ballShow(false); D.mode = 'withHarry'; D.t = 0; log.fetches++; woof(fun, 1); D.nod = 0.8;
        headW(v1); for (let i = 0; i < 8; i++) emit(v1.x, v1.y + 0.3, v1.z, (Math.random() - 0.5) * 0.7, 1 + Math.random() * 0.5, (Math.random() - 0.5) * 0.7, 1.1, 0.22, 0xffb0cc, 0.1);
        if (!PAID) { PAID = true; log.paid++; try { window.HPLessons.progress.bonus(5); } catch { /* lessons not loaded */ } try { fun.toast('🎾⭐', '+5 נקודות לבית!', 1600); } catch { /* ok */ } }
        if (D.throwsLeft <= 0) { D.rest = 25; log.rests++; say('הכלב קצת עייף, הוא נח עכשיו 💤🐾'); }
        else say(D.throwsLeft === THROWS - 1 ? 'הוא הביא את הכדור! 🎾 עוד פעם?' : 'כל הכבוד, כלבלב! 🎾');
      }
    }
    if (D.carry && D.ballOn) { headW(v1); v1.x += Math.sin(D.yaw) * 0.25; v1.z += Math.cos(D.yaw) * 0.25; v1.y -= 0.12; D.ball.position.copy(v1); }
    place();
    try { D.dog.mixer.update(dt); } catch { /* ok */ }
    // the nod (a tap, a fetch): the head dips and comes back, after the mixer ran
    if (D.nod > 0) { D.nod -= dt; const h = D.dog.bones.head; if (h && h.parent) { const k = Math.sin(Math.max(0, D.nod) / 1.0 * Math.PI * 2) * 0.28; const y = D.yaw; ax.set(Math.cos(y), 0, -Math.sin(y)); h.parent.updateWorldMatrix(true, false); h.parent.getWorldQuaternion(q1); qa.setFromAxisAngle(ax, k); qi.copy(q1).invert(); qa.premultiply(qi).multiply(q1); h.quaternion.premultiply(qa); h.updateMatrixWorld(true); } }
    if (D.bub && D.bub.t > 0) { headW(D.bub.pos); D.bub.pos.y += 0.9; }
    // the 🎾 prompt while he sits by Harry
    if (D.mode === 'withHarry' && o.visible && dp < PROMPT_R && D.rest <= 0 && !player.riding) { try { fun.offer('dog-ball', '🎾', 0.07, () => throwBall()); } catch { /* ok */ } }
  }

  function state() {
    const o = D.dog && D.dog.obj;
    let onScreen = false; if (o) { try { headW(v1); onScreen = !!screen(v1).on; } catch { /* no lens yet */ } }
    let skinned = 0; try { scene.traverse(m => { if (m.isSkinnedMesh) { for (let p = m; p; p = p.parent) if (/blackdog$/.test(p.name || '')) { skinned++; break; } } }); } catch { /* ok */ }
    let gate = 1e9; for (const s of DOG_SPOTS) gate = Math.min(gate, Math.hypot(s[0] - GATES.x, s[1] - GATES.z));
    return { on: true, built: !!o, loading: D.loading, failed: log.failed, visible: !!(o && o.visible), onScreen, mode: !o ? (log.held === 'adventure' ? 'adventure' : 'none') : D.hidden || log.held ? 'held' : D.mode,
      held: log.held, hidden: D.hidden, fade: +D.fade.toFixed(2), clip: D.cur, pos: o ? { x: +D.x.toFixed(2), y: +o.position.y.toFixed(2), z: +D.z.toFixed(2), yaw: +D.yaw.toFixed(2) } : null,
      ground: o ? +groundAt(D.x, D.z).toFixed(2) : null, dist: o ? +dHarry().toFixed(1) : null, spot: D.spot, throwsLeft: D.throwsLeft, rest: +Math.max(0, D.rest).toFixed(1), ball: D.ballOn ? { fly: D.ballFly, carry: D.carry, x: +D.bx.toFixed(2), z: +D.bz.toFixed(2) } : null,
      prompt: (() => { try { return fun.promptId ? fun.promptId() === 'dog-ball' : null; } catch { return null; } })(), tris: D.dog ? D.dog.tris : null, scale: DOG_FREE_SCALE, paid: PAID, skinnedInScene: skinned, minGateDist: +gate.toFixed(1),
      log: { ...log, spoken: log.spoken.slice() } };
  }
  const api = {
    state, tap: () => tapDog(), ball: () => throwBall(), come: () => come(),
    hold: (on = true) => { debugHold = !!on; return debugHold; },
    spots: () => DOG_SPOTS.map(s => ({ x: s[0], z: s[1], yaw: s[2] })),
    headScreen: () => { if (!D.dog) return null; headW(v1); const s = screen(v1); return { x: Math.round(s.x), y: Math.round(s.y), on: s.on }; },
    bodyScreen: () => { if (!D.dog) return null; v1.set(D.x, groundAt(D.x, D.z) + 0.6 * DOG_SCALE, D.z); const s = screen(v1); return { x: Math.round(s.x), y: Math.round(s.y), on: s.on }; },
    fast: (k) => { D.clk = Math.max(0.1, Math.min(20, +k || 1)); return D.clk; },
    goSpot: (i) => { D.spot = ((i | 0) % DOG_SPOTS.length + DOG_SPOTS.length) % DOG_SPOTS.length; D.seq = ROUTE.indexOf(D.spot); const s = DOG_SPOTS[D.spot]; D.x = s[0]; D.z = s[1]; D.yaw = s[2]; D.mode = 'sit'; D.t = 0; D.wait = 1e9; ballShow(false); place(); return D.spot; },
    resetPaid: () => { PAID = false; },
  };
  return { tick: (dt) => { try { tick(dt); } catch (e) { log.errors++; if (log.errors < 4) console.warn('[dog-free] tick failed -', e && e.message || e); } }, api };
}
