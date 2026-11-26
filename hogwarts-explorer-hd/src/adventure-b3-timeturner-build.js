// Book 3, adventure 5 "מחזיר הזמן" (the Time-Turner): the code-built props and the shared REWIND effect.
// Used by the quest (adventure-b3-timeturner.js), the free ⏳ toy (timeturner-free.js) and the finale's "late" retry
// (adventure-b3-save.js). Kid-safe and warm: the rewind is gold / sepia with sparkles that run backwards and a soft chime
// run; the "other Harry" is a translucent GOLD copy of the hero model (the same GLB clone, glowing, smiling) that walks his
// last seconds backwards and then waves. Never dark, never eerie.
// Props (one shared vertex-coloured material, so each prop is ONE draw call): the Time-Turner (a small gold hourglass in two
// rings on a chain), the quest door (a free-standing oak door in a stone frame, the leaf on a hinge pivot with a gold
// handle), the runaway golden ball (a snitch-like ball with two little white wings) and the lever (levels 2-3).
// Budgets: Time-Turner ~600 tris, door ~400, ball ~300, lever ~150, the gold Harry 3,616 (1 draw call, no shadow); canvas
// textures none; the path ring buffer is preallocated (nothing allocated per frame).
import { Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, ConeGeometry, PlaneGeometry, MeshStandardMaterial,
  Color, Float32BufferAttribute, Vector3, AnimationMixer, LoopOnce, LoopRepeat, DoubleSide } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadAnimated } from './models.js';

// ---------------- vertex-coloured merging: one mesh per prop ----------------
const _c = new Color();
function tint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  _c.setHex(hex); const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new Float32BufferAttribute(a, 3)); return g;
}
const at = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => { if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz); return geo.translate(x, y, z); };
export function merged(parts, mat) { const g = mergeGeometries(parts.map(([geo, hex]) => tint(geo, hex)), false); g.computeBoundingSphere(); const m = new Mesh(g, mat); m.frustumCulled = false; m.raycast = () => {}; return m; }
// Colours: bright non-emissive albedo <= 0.84; the gold glows a little (a true magic object)
const GOLD = 0xd8a840, GOLD2 = 0xb98a2a, GLASS = 0xf2e6c0, SAND = 0xe8b860, OAK = 0x6a4428, OAK2 = 0x553620, STONE = 0x9a8c78, IRON = 0x3a3634, WHITE = 0xe8e4dc;
export const propMat = () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
export const goldMat = () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5, emissive: 0x6a4a10, emissiveIntensity: 0.6 });

// The Time-Turner: ~0.32 m tall (shown at hand size, floating and spinning above Harry's hand)
export function buildTimeTurner() {
  const g = new Group(); g.name = 'b3tt-turner';
  // ONE draw call: everything merged; the rings spin by rebuilding nothing (the whole prop spins, the rings are tilted)
  const all = merged([
    ...[[new ConeGeometry(0.055, 0.09, 12), 0.045, Math.PI, GLASS], [new ConeGeometry(0.055, 0.09, 12), -0.045, 0, GLASS]].map(([geo, y, rx, c]) => [at(geo, 0, y, 0, rx), c]),
    [at(new ConeGeometry(0.04, 0.05, 10), 0, -0.065, 0), SAND],
    [at(new CylinderGeometry(0.066, 0.066, 0.012, 14), 0, 0.096, 0), GOLD], [at(new CylinderGeometry(0.066, 0.066, 0.012, 14), 0, -0.096, 0), GOLD],
    [at(new CylinderGeometry(0.006, 0.006, 0.19, 4), 0.058, 0, 0), GOLD2], [at(new CylinderGeometry(0.006, 0.006, 0.19, 4), -0.058, 0, 0), GOLD2],
    [at(new TorusGeometry(0.13, 0.009, 6, 32), 0, 0, 0, 0, 0, 0.5), GOLD], [at(new TorusGeometry(0.155, 0.009, 6, 32), 0, 0, 0, 0, Math.PI / 2, -0.4), GOLD2],
    [at(new CylinderGeometry(0.004, 0.004, 0.22, 4), 0, 0.27, 0), GOLD2], [at(new TorusGeometry(0.014, 0.004, 4, 10), 0, 0.165, 0), GOLD],
  ], goldMat());
  all.name = 'b3tt-turner-mesh'; g.add(all);
  g.scale.setScalar(1.6);
  return g;
}

// ---------------- the quest door (staircase hall, west side), the ball, the lever ----------------
// Room-local (staircase hall, W 20 x D 22, the west arch at x -10, z 0): the door stands free at DOOR, facing +x (east);
// the ball bounces in the nook behind it (between the door and the west wall). Harry holds the handle from STAND.
export const DOOR = { x: -6.4, z: 6.4, w: 1.5, h: 2.6 };          // the doorway centre (the leaf hinges on its south post)
export const STAND = { x: -5.55, z: 6.0, yaw: -Math.PI / 2 };      // where a Harry stands to hold the handle (facing west)
export const FREE = { x: -2.6, z: 5.2, yaw: -Math.PI / 2 - 0.25 }; // where the real Harry waits for the ball (step 4)
export const NOOK = { x: -8.6, z: 6.4 };                           // the ball's bouncing spot behind the door
export const LEVER = { x: -5.9, z: 8.15 };                         // levels 2-3: the lever post just north of the door
export function buildDoor() {
  const mat = propMat(), g = new Group(); g.name = 'b3tt-door';
  const W = DOOR.w, H = DOOR.h;
  const frame = merged([
    [at(new BoxGeometry(0.34, H + 0.3, 0.42), 0, (H + 0.3) / 2, -W / 2 - 0.17), STONE], [at(new BoxGeometry(0.34, H + 0.3, 0.42), 0, (H + 0.3) / 2, W / 2 + 0.17), STONE],
    [at(new BoxGeometry(0.4, 0.36, W + 0.76), 0, H + 0.48, 0), STONE], [at(new BoxGeometry(0.46, 0.12, W + 0.9), 0, 0.06, 0), STONE],
    [at(new ConeGeometry(0.16, 0.3, 4), 0, H + 0.81, 0, 0, Math.PI / 4), GOLD2],
  ], mat);
  frame.name = 'b3tt-frame'; g.add(frame);
  // the leaf: a pivot on the south post (z = -W/2); closed it spans +z; it swings open toward +x (toward Harry)
  const pivot = new Group(); pivot.position.set(0, 0, -W / 2); g.add(pivot);
  const leaf = merged([
    [at(new BoxGeometry(0.1, H - 0.04, W - 0.04), 0, H / 2, W / 2), OAK], [at(new BoxGeometry(0.12, 0.12, W - 0.1), 0, H * 0.25, W / 2), OAK2], [at(new BoxGeometry(0.12, 0.12, W - 0.1), 0, H * 0.75, W / 2), OAK2],
    [at(new BoxGeometry(0.13, 0.08, 0.3), 0, H * 0.25, 0.18), IRON], [at(new BoxGeometry(0.13, 0.08, 0.3), 0, H * 0.75, 0.18), IRON],
    [at(new SphereGeometry(0.085, 12, 8), 0.12, 1.05, W - 0.22), GOLD], [at(new CylinderGeometry(0.03, 0.03, 0.12, 8), 0.07, 1.05, W - 0.22, 0, 0, Math.PI / 2), GOLD2],
    [at(new SphereGeometry(0.085, 12, 8), -0.12, 1.05, W - 0.22), GOLD],
  ], mat);
  leaf.name = 'b3tt-leaf'; pivot.add(leaf);
  g.userData.pivot = pivot; g.userData.handleLocal = new Vector3(0.12, 1.05, W - 0.22 - W / 2);   // in the pivot's frame -> see handleW
  return g;
}
export function buildBall() {
  const mat = goldMat();
  const m = merged([
    [new SphereGeometry(0.14, 16, 12), GOLD], [at(new TorusGeometry(0.142, 0.012, 4, 20), 0, 0, 0, Math.PI / 2), GOLD2],
    [at(new PlaneGeometry(0.34, 0.16), 0.24, 0.06, 0, 0, 0, 0.3), WHITE], [at(new PlaneGeometry(0.34, 0.16), -0.24, 0.06, 0, 0, 0, -0.3), WHITE],
  ], mat);
  m.material.side = DoubleSide; m.name = 'b3tt-ball'; m.castShadow = false;
  return m;
}
export function buildLever() {
  const mat = propMat(), g = new Group(); g.name = 'b3tt-lever';
  const base = merged([[at(new BoxGeometry(0.34, 0.9, 0.34), 0, 0.45, 0), STONE], [at(new BoxGeometry(0.4, 0.08, 0.4), 0, 0.92, 0), GOLD2]], mat); g.add(base);
  const arm = new Group(); arm.position.y = 0.95; g.add(arm);
  const stick = merged([[at(new CylinderGeometry(0.03, 0.03, 0.6, 6), 0, 0.3, 0), IRON], [at(new SphereGeometry(0.07, 10, 8), 0, 0.62, 0), 0xc83030]], mat); arm.add(stick);
  arm.rotation.z = 0.6; g.userData.arm = arm;
  return g;
}

// ---------------- the REWIND (shared) ----------------
// createRewind({ scene, camera, player, fun, emit }) -> { record(dt), start(opts), update(dt), state(), ghost helpers }
// start({ secs: 3, back: 6, mode: 'free'|'hold', to: {x, z, yaw}?, parent?: Object3D, sepiaOnly?: true, onEnd })
//  * free: the gold Harry retraces the recorded path (the last `back` seconds) backwards over `secs`, then fades out
//  * hold: same, but from Harry straight back to `to` and he STAYS there (holding the door) until fadeOut()
//  * sepiaOnly: only the screen effect + sparkles (the finale's "late" retry: Hermione spins it, no other Harry)
const NREC = 256, REC_DT = 0.05;   // 12.8 s of path
const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew',Arial,sans-serif";
let cssDone = false;
function rewindCss() {
  if (cssDone) return; cssDone = true;
  const css = document.createElement('style'); css.id = 'ttRewindCss';
  css.textContent = `#ttSepia{position:fixed;inset:0;z-index:11;pointer-events:none;opacity:0;transition:opacity .35s;
    background:radial-gradient(ellipse at 50% 45%,rgba(255,226,150,.10) 0%,rgba(214,160,70,.28) 60%,rgba(150,96,30,.5) 100%)}
  #ttSepia.on{opacity:1}
  #ttSepia .clock{position:absolute;left:50%;top:calc(132px + env(safe-area-inset-top));width:120px;height:120px;margin-left:-60px;border-radius:50%;
    border:6px solid rgba(255,236,170,.95);background:radial-gradient(circle,rgba(255,246,214,.55),rgba(220,170,80,.25));box-shadow:0 0 30px rgba(255,214,120,.9)}
  #ttSepia .h{position:absolute;left:50%;bottom:50%;width:6px;margin-left:-3px;background:#fff4c8;border-radius:3px;transform-origin:50% 100%;box-shadow:0 0 8px #ffd77a}
  #ttSepia .h1{height:40px;animation:ttBack .55s linear infinite} #ttSepia .h2{height:28px;width:8px;margin-left:-4px;animation:ttBack 2.2s linear infinite}
  #ttSepia .lab{position:absolute;left:0;right:0;top:128px;text-align:center;font:bold 26px ${FONT};color:#fff6d0;text-shadow:0 2px 0 #6a3a00,0 0 12px #ffcf60;direction:rtl}
  @keyframes ttBack{from{transform:rotate(360deg)}to{transform:rotate(0deg)}}
  body.ttRewind #view{filter:sepia(.75) saturate(1.25) brightness(1.06)}
  @media (max-width:700px){#ttSepia .clock{top:calc(150px + env(safe-area-inset-top));width:96px;height:96px;margin-left:-48px} #ttSepia .lab{top:102px;font-size:22px} #ttSepia .h1{height:32px} #ttSepia .h2{height:22px}}`;
  document.head.appendChild(css);
}
export function createRewind({ scene, camera, player, fun, emit }) {
  rewindCss();
  const rec = new Float32Array(NREC * 4); let head = 0, count = 0, acc = 0;
  const R = { on: false, t: 0, secs: 3, mode: 'free', seg: 0, from: 0, n: 0, to: null, ghost: null, gmix: null, gacts: {}, gcur: null, loading: false, failed: false, hold: false, fade: 0, fadeOut: 0, onEnd: null,
    gx: 0, gy: 0, gz: 0, gyaw: 0, mat: null, sepiaOnly: false, parent: null, uses: 0, waveT: 0, lastLen: 0 };
  const v1 = new Vector3(), v2 = new Vector3();
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w, type = 'sine', v = 0.08, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  // the overlay (sepia wash + a clock running backwards)
  let ov = document.getElementById('ttSepia');
  if (!ov) { ov = document.createElement('div'); ov.id = 'ttSepia'; ov.innerHTML = '<div class="clock"><div class="h h1"></div><div class="h h2"></div><div class="lab">⏪ ⏳</div></div>'; document.body.appendChild(ov); }
  function overlay(on) { ov.classList.toggle('on', !!on); document.body.classList.toggle('ttRewind', !!on); }
  // the path: Harry's feet + yaw every REC_DT (game time)
  function record(dt) {
    if (R.on) return;
    acc += dt; if (acc < REC_DT) return; acc = 0;
    const i = head * 4; rec[i] = player.pos.x; rec[i + 1] = player.pos.y; rec[i + 2] = player.pos.z; rec[i + 3] = player.yaw;
    head = (head + 1) % NREC; count = Math.min(NREC, count + 1);
  }
  const sample = (k, out) => { const j = ((head - 1 - k) % NREC + NREC) % NREC * 4; out.set(rec[j], rec[j + 1], rec[j + 2]); return rec[j + 3]; };   // k = 0: the newest
  function clearPath() { head = 0; count = 0; }
  // the gold Harry: a clone of the hero GLB with one translucent warm-gold material (made once, reused)
  function ensureGhost() {
    if (R.ghost || R.loading || R.failed) return;
    R.loading = true;
    loadAnimated('harry').then((r) => {
      R.loading = false;
      if (!r || !r.obj) { R.failed = true; return; }
      const o = r.obj; o.name = 'b3tt-gold-harry';
      R.mat = new MeshStandardMaterial({ color: 0xf2c868, emissive: 0xa06a18, emissiveIntensity: 0.85, roughness: 0.45, metalness: 0.2, transparent: true, opacity: 0.68 });
      o.traverse(m => { if (m.isMesh) { m.material = R.mat; m.frustumCulled = false; m.castShadow = false; m.raycast = () => {}; m.userData.sharedGeo = true; } });
      const s = player.model ? player.model.scale.x : 1; o.scale.setScalar(s * (player.hero && player.hero.obj ? player.hero.obj.scale.x : 1));
      R.gscale = o.scale.x;
      const mixer = new AnimationMixer(o), acts = {};
      for (const c of r.clips) acts[c.name] = mixer.clipAction(c);
      for (const n of ['Wave', 'Cheer']) if (acts[n]) { acts[n].setLoop(LoopOnce, 1); acts[n].clampWhenFinished = true; }
      for (const n of ['Idle', 'Walk']) if (acts[n]) acts[n].setLoop(LoopRepeat, Infinity);
      mixer.addEventListener('finished', () => { gplay('Idle', 0.4); });
      R.ghost = o; R.gmix = mixer; R.gacts = acts; R.gcur = null; o.visible = false;
    }).catch(() => { R.loading = false; R.failed = true; });
  }
  function gplay(name, fade = 0.3, ts = 1) {
    const a = R.gacts[name]; if (!a) return; a.timeScale = ts;
    if (R.gcur === name) return; const prev = R.gcur ? R.gacts[R.gcur] : null;
    a.reset(); a.setEffectiveWeight(1); a.play(); if (prev && fade > 0) prev.crossFadeTo(a, fade, false); else if (prev) prev.stop(); R.gcur = name;
  }
  // the hero's world scale: player.model is the root the hero GLB sits in
  function ghostScale() { try { const h = player.hero && player.hero.obj; if (h) { h.getWorldScale(v2); return v2.x; } } catch { /* ok */ } return R.gscale || 1; }
  function attachGhost(parent) {
    if (!R.ghost) return false;
    const p = parent || scene; if (R.ghost.parent !== p) { if (R.ghost.parent) R.ghost.parent.remove(R.ghost); p.add(R.ghost); }
    R.ghost.scale.setScalar(ghostScale()); return true;
  }
  function placeGhost() {
    if (!R.ghost) return;
    const p = R.ghost.parent; v1.set(R.gx, R.gy, R.gz);
    if (p && p !== scene) { p.updateWorldMatrix(true, false); p.worldToLocal(v1); }
    R.ghost.position.copy(v1); R.ghost.rotation.set(0, R.gyaw, 0);
  }
  function start(o = {}) {
    if (R.on) return false;
    R.on = true; R.t = 0; R.secs = o.secs || 3; R.mode = o.mode || 'free'; R.to = o.to || null; R.onEnd = o.onEnd || null; R.sepiaOnly = !!o.sepiaOnly; R.parent = o.parent || null; R.uses++;
    R.hold = false; R.fadeOut = 0; R.waveT = 0;
    // the path to walk back: free = the recorded samples within `back` s; hold = straight from Harry to `to`
    const back = Math.min(count, Math.round((o.back || 6) / REC_DT));
    R.n = back; R.lastLen = back;
    R.gx = player.pos.x; R.gy = player.pos.y; R.gz = player.pos.z; R.gyaw = player.yaw;
    if (!R.sepiaOnly) { ensureGhost(); if (attachGhost(R.parent)) { R.ghost.visible = true; R.mat.opacity = 0; placeGhost(); gplay('Walk', 0.1, -1); } }
    overlay(true);
    // a soft chime run, falling (the time runs back), then a rising sparkle
    [1568, 1319, 1175, 988, 880, 784, 659].forEach((f, i) => tone(f, 0.22, i * 0.12, 'sine', 0.07));
    setTimeout(() => sfx('sparkle'), R.secs * 1000 - 300);
    return true;
  }
  function end() {
    R.on = false; overlay(false);
    if (R.sepiaOnly || !R.ghost) { const f = R.onEnd; R.onEnd = null; if (f) { try { f(); } catch (e) { console.warn('[rewind] end -', e && e.message || e); } } return; }
    if (R.mode === 'hold') { R.hold = true; gplay('Idle', 0.3); if (R.to) R.gyaw = R.to.faceYaw !== undefined ? R.to.faceYaw : R.gyaw; placeGhost(); }
    else { R.fadeOut = 0.7; gplay('Wave', 0.2); }
    const f = R.onEnd; R.onEnd = null; if (f) { try { f(); } catch (e) { console.warn('[rewind] end -', e && e.message || e); } }
  }
  function fadeOut(sec = 0.9) { if (!R.ghost || !R.ghost.visible) return; R.hold = false; R.fadeOut = sec; R.fadeT = sec; burstAt(R.gx, R.gy + 1, R.gz, 26); }
  function wave() { if (R.ghost && R.ghost.visible) { R.gyaw = Math.atan2(player.pos.x - R.gx, player.pos.z - R.gz); placeGhost(); R.gcur = 'Idle'; gplay('Wave', 0.2); R.waveT = 2.4; } }   // (he turns to the real Harry and waves)
  function drop() { R.on = false; R.hold = false; R.fadeOut = 0; overlay(false); if (R.ghost) { R.ghost.visible = false; if (R.ghost.parent) R.ghost.parent.remove(R.ghost); } }
  function burstAt(x, y, z, n = 18) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = 1.2 + Math.random() * 1.4; emit(x, y, z, Math.cos(a) * s * 0.7, u * s * 0.6 + 0.6, Math.sin(a) * s * 0.7, 0.9 + Math.random() * 0.5, 0.22, Math.random() < 0.6 ? 0xffd76a : 0xfff4c8, -0.4); } }
  // sparkles that run BACKWARDS: born on a ring round Harry, they fly inward (an un-burst) and up
  function backSparks(dt) {
    const n = Math.random() < dt * 60 ? 2 : 1;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, r = 1.6 + Math.random() * 1.4, y = player.pos.y + 0.3 + Math.random() * 1.8, life = 0.7;
      emit(player.pos.x + Math.cos(a) * r, y, player.pos.z + Math.sin(a) * r, -Math.cos(a) * r / life, (player.pos.y + 1.2 - y) / life * 0.6, -Math.sin(a) * r / life, life, 0.2, Math.random() < 0.5 ? 0xffd76a : 0xfff0c0, 0); }
    if (R.ghost && R.ghost.visible) emit(R.gx + (Math.random() - 0.5) * 0.5, R.gy + 0.2 + Math.random() * 1.6, R.gz + (Math.random() - 0.5) * 0.5, 0, 0.4, 0, 0.8, 0.2, 0xffe08a, 0);
  }
  function update(dt) {
    if (R.ghost && R.gmix && R.ghost.visible) { try { R.gmix.update(dt); } catch { /* ok */ } }
    if (R.on) {
      R.t += dt; const k = Math.min(1, R.t / R.secs);
      if (!R.sepiaOnly && R.ghost && !R.ghost.visible && R.t < R.secs * 0.6 && attachGhost(R.parent)) { R.ghost.visible = true; R.mat.opacity = 0; gplay('Walk', 0.1, -1); }   // (loaded just now)
      backSparks(dt);
      if (!R.sepiaOnly && R.ghost && R.ghost.visible) {
        if (R.mat.opacity < 0.68) R.mat.opacity = Math.min(0.68, R.mat.opacity + dt * 2);
        if (R.mode === 'hold' && R.to) {   // straight back to the handle, facing where he came from (walking backwards)
          const e = k * k * (3 - 2 * k), x0 = player.pos.x, z0 = player.pos.z;
          const ox = R.gx, oz = R.gz; R.gx = x0 + (R.to.x - x0) * e; R.gz = z0 + (R.to.z - z0) * e; R.gy = player.pos.y;
          const mv = Math.hypot(R.gx - ox, R.gz - oz); if (mv > 1e-4) R.gyaw = Math.atan2(ox - R.gx, oz - R.gz);
          if (k >= 0.999) gplay('Idle', 0.3);
        } else if (R.n > 1) {   // along the recorded path, newest -> oldest
          const f = k * (R.n - 1), i = Math.floor(f), w = f - i;
          const ya = sample(i, v1), yb = sample(Math.min(R.n - 1, i + 1), v2);
          if (v1.distanceTo(v2) < 3) { R.gx = v1.x + (v2.x - v1.x) * w; R.gy = v1.y + (v2.y - v1.y) * w; R.gz = v1.z + (v2.z - v1.z) * w; } else { R.gx = v1.x; R.gy = v1.y; R.gz = v1.z; }   // (a teleport in the record: no streak)
          R.gyaw = ya + Math.atan2(Math.sin(yb - ya), Math.cos(yb - ya)) * w;
        }
        placeGhost();
      }
      if (R.t >= R.secs) end();
      return;
    }
    if (R.waveT > 0) R.waveT -= dt;
    if (R.fadeOut > 0 && R.ghost) {
      R.fadeOut -= dt; R.mat.opacity = Math.max(0, 0.68 * R.fadeOut / (R.fadeT || 0.7));
      if (Math.random() < dt * 30) emit(R.gx + (Math.random() - 0.5) * 0.6, R.gy + Math.random() * 1.8, R.gz + (Math.random() - 0.5) * 0.6, 0, 0.8, 0, 0.8, 0.22, 0xffe08a, -0.2);
      if (R.fadeOut <= 0) { R.ghost.visible = false; R.fadeT = 0; }
    }
  }
  function ghostW(out) { return out.set(R.gx, R.gy + 1.2, R.gz); }
  function state() {
    const g = R.ghost;
    return { on: R.on, t: +R.t.toFixed(2), mode: R.mode, hold: R.hold, uses: R.uses, recorded: count, pathN: R.lastLen, ghostLoaded: !!g, ghostVisible: !!(g && g.visible && g.parent), ghostClip: R.gcur,
      opacity: R.mat ? +R.mat.opacity.toFixed(2) : 0, ghost: g ? { x: +R.gx.toFixed(2), y: +R.gy.toFixed(2), z: +R.gz.toFixed(2), yaw: +R.gyaw.toFixed(2) } : null, sepia: document.body.classList.contains('ttRewind'), failed: R.failed };
  }
  return { record, start, update, state, fadeOut, wave, drop, ensureGhost, ghostW, clearPath, gplay, get ghost() { return R.ghost; }, get on() { return R.on; }, get holding() { return R.hold; }, setGhost: (x, y, z, yaw, parent) => { ensureGhost(); if (!attachGhost(parent)) return false; R.gx = x; R.gy = y; R.gz = z; R.gyaw = yaw; R.ghost.visible = true; R.mat.opacity = 0.68; R.hold = true; R.fadeOut = 0; placeGhost(); gplay('Idle', 0); return true; } };
}
// ONE shared rewind (one gold Harry, one overlay) for the toy, the quest and the finale: the first caller's particle pool is used
let _shared = null;
export function getRewind(deps) { if (!_shared) _shared = createRewind(deps); return _shared; }
