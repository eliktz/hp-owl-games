// Teachers roam the castle (24 Nov 2026, the request of the family's 7-year-old). The schedule is
// pure (roam-plan.js): each teacher has a LOGICAL place on a seeded daily loop; this module only
// materialises the teacher where the player is (rooms stream one at a time), walks the figure,
// greets Harry kindly, keeps everyone home while anything important runs, and puts chips on the map.
// Safety rules (art direction, phase 1):
//  - the same figure roams and teaches: a teacher's OWN room is never roamed into (the lesson's figure
//    stands at its station there), and while Harry is in that room the teacher is held at home;
//  - the 🔔 picker / the ▶ prompt call lessons' roam hook first: that teacher is home before the lesson shows;
//  - during any adventure, lesson, course, Quidditch, Floo trip or takeover ALL teachers hold home;
//  - spells never target teachers (nothing here registers with freecast);
//  - any failure is non-fatal: roaming switches itself off and the teachers stand as before.
import { Group, AnimationMixer, Frustum, Matrix4, Sphere, Vector3, Mesh, SphereGeometry, ConeGeometry, OctahedronGeometry, InstancedMesh, Object3D, MeshStandardMaterial, MeshBasicMaterial } from 'three';
import { buildChibi, animateChibi } from './chibi.js';
import { loadAnimated } from './models.js';
import { LOOK, GLB_PROF } from './lessons.js';
import { speak } from './voice.js';
import * as P from './roam-plan.js';

export const ROAM_ON = true;            // the single switch: false = every teacher stands at the station as before
const GREET_R = 4, COOL = 60, SAY_S = 3.4, AFTER_S = 2.0, FADE = 0.3, ANIM_R = 60, OUT_R = 32, WAIT_R = 1.6, VANISH = 0.6, APPEAR = 0.5;
// Walk clip ground speed (m/s) at timeScale 1 at the cast's 1.3 world scale: measured in the game (25 Nov 2026) from
// the foot bones' backward travel during stance (1.333 s cycles, no root motion). The walk timeScale = speed / NAT.
const NAT = { mcgonagall: 0.98, flitwick: 0.47, snape: 1.09, tonks: 1.0 };

export function createRoam({ scene, camera, player, interiors, lessons, map, env, fun, colliders, groundAt, isModal, isTakeover, adventures, floo }) {
  const off = { tick() {}, api: { state: () => ({ on: false }), fast() {}, where: () => null, hold() {}, seed() {} } };
  if (!ROAM_ON) return off;
  const lessonOf = {}, idOfLesson = {};
  for (const id of P.ORDER) { lessonOf[id] = P.TEACHERS[id].lesson; idOfLesson[P.TEACHERS[id].lesson] = id; }
  let seed = P.hashStr(fun.today ? fun.today() : 'day'), fast = 1, debugHold = false, failed = 0;
  const S = {};
  function reset() {
    for (const id of P.ORDER) {
      const prev = S[id];
      S[id] = { id, T: P.TEACHERS[id], day: P.buildDay(id, seed), clock: 0, held: null, fig: prev ? prev.fig : null, cool: -1e9, greet: null, line: 0, wait: 0, off: { x: 0, z: 0 }, stuck: 0, yieldT: 0, moving: false, visits: new Set() };
    }
  }
  reset();
  const log = { greets: [], holds: 0, built: 0, dropped: 0, spoke: [] };
  let now = 0, lastGreet = -1e9, slow = 0, chipKey = '', busyT = 1, busy = null;
  let bub = null, bubOf = null;   // the greeting bubble (fun.say's handle) and whose it is: it ends when her figure leaves the stage
  const endBub = (id) => { if (bub && bubOf === id) { bub.t = Math.min(bub.t, 0); bub = null; bubOf = null; } };

  // ---- hold rules ----
  function busyWhy() {
    try {
      if (isTakeover()) return 'takeover';
      if (lessons.openKey && lessons.openKey()) return 'lesson';
      const bc = document.body.classList;
      if (bc.contains('inSpell')) return 'course';
      if (bc.contains('inMatch')) return 'match';
      if (bc.contains('inFloo')) return 'floo';
      const fl = floo(); if (fl) { const f = fl.state(); if (f.phase !== 'idle' || f.pickOpen) return 'floo'; }
      const ad = adventures(); if (ad) { const a = ad.state(); if (a.quest) return 'adventure'; }
    } catch { /* an api missing: not busy */ }
    if (debugHold) return 'debug';
    return null;
  }
  function holdWhy(st, busy) {
    if (busy) return busy;
    if (interiors.active === st.T.home) return 'own-room';
    if (st.id === 'sinistra' && env && env.time === 'night') return 'night';
    return null;
  }
  function home(id) { const st = S[id]; if (!st) return; st.clock = 0; st.greet = null; st.wait = 0; vanish(st, true); }

  // ---- figures ----
  function roomGroup() { return interiors.active && interiors.room ? interiors.room.group : null; }
  function buildFig(st, parent, outdoor) {
    const holder = new Group(); holder.name = 'roam-' + st.id; holder.visible = false;
    const fig = { holder, parent, outdoor, roomObj: interiors.room, appear: 0, mixer: null, acts: null, cur: null, rig: null, ready: false, yaw: 0, col: null, place: null };
    const look = LOOK[st.id];
    const chibi = look ? buildChibi(look) : null;
    if (chibi) { holder.add(chibi); fig.chibi = chibi; chibi.visible = false; }
    const spec = GLB_PROF[st.id];
    const useChibi = () => { if (fig.dead || fig.ready) return; if (chibi) { chibi.visible = true; fig.rig = chibi.userData.rig; } fig.ready = true; };
    if (spec && !st.T.chibi) {
      const alive = () => !fig.dead;
      loadAnimated(spec.model, alive).then(r => {
        if (fig.dead || fig.ready) return;
        if (!r) { useChibi(); return; }
        const clip = n => r.clips.find(a => a.name === n);
        if (!clip('Idle') || !clip('Walk')) { useChibi(); return; }
        const obj = r.obj; obj.name = 'roam-glb-' + spec.model;
        obj.scale.setScalar(spec.scale);
        obj.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = outdoor; o.receiveShadow = false; o.userData.sharedGeo = true; } });
        const mixer = new AnimationMixer(obj), acts = {};
        for (const [k, n] of [['idle', 'Idle'], ['walk', 'Walk'], ['talk', 'Talk'], ['fold', 'FoldArms']]) { const a = clip(n); if (a) acts[k] = mixer.clipAction(a); }
        acts.idle.play(); fig.cur = 'idle';
        if (acts.walk) acts.walk.timeScale = Math.min(1.4, Math.max(0.6, st.T.speed / (NAT[spec.model] || 1.5)));
        holder.add(obj); fig.glb = obj; fig.mixer = mixer; fig.acts = acts; fig.ready = true;
      }).catch(() => useChibi());
      setTimeout(useChibi, 9000);                    // a slow load: the chibi stands in rather than nobody
    } else useChibi();
    holder.userData.onTeardown = () => { killFig(fig); if (st.fig === fig) st.fig = null; };
    parent.add(holder);
    log.built++;
    return fig;
  }
  function killFig(fig) {
    if (fig.dead) return; fig.dead = true;
    try { if (fig.mixer) { fig.mixer.stopAllAction(); fig.mixer.uncacheRoot(fig.glb); } } catch { /* ignore */ }
    try { if (fig.glb) fig.glb.traverse(o => { if (o.isSkinnedMesh) { try { o.skeleton.dispose(); } catch { /* backend quirk */ } } }); } catch { /* ignore */ }
    if (fig.col) { const arr = fig.colArr, i = arr ? arr.indexOf(fig.col) : -1; if (i >= 0) arr.splice(i, 1); fig.col = null; }
  }
  function dropFig(st) {
    endBub(st.id); st.cat = null;
    const fig = st.fig; if (!fig) return;
    st.fig = null; finishFig(fig);
  }
  function fadeTo(fig, name) {
    if (!fig.mixer || fig.cur === name) return;
    const next = fig.acts[name] || fig.acts.idle; if (!next || next === fig.acts[fig.cur]) { fig.cur = name; return; }
    const prev = fig.acts[fig.cur]; next.reset().play(); if (prev) prev.crossFadeTo(next, FADE, false); fig.cur = name;
  }

  // ---- appear / vanish (never an instant pop in view): per-figure material clones fade the opacity ----
  // The GLB materials are shared with the models.js cache (the lesson figure uses them too), so a fading
  // figure gets its own transparent clones and gives the shared ones back when it is fully visible again.
  function setAlpha(fig, a) {
    fig.holder.traverse(o => {
      if (!o.isMesh || o.userData.roamSpark) return;
      if (!o.userData.mat0) {
        o.userData.mat0 = o.material;
        const mk = (m) => { const c = m.clone(); c.transparent = true; c.userData.op0 = m.opacity; return c; };
        o.material = Array.isArray(o.material) ? o.material.map(mk) : mk(o.material);
      }
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.opacity = (m.userData.op0 ?? 1) * a;
    });
  }
  function solidMats(fig) {
    fig.holder.traverse(o => {
      if (!o.isMesh || !o.userData.mat0) return;
      const cl = o.material; o.material = o.userData.mat0; o.userData.mat0 = null;
      for (const m of Array.isArray(cl) ? cl : [cl]) { try { m.dispose(); } catch { /* backend quirk */ } }
    });
  }
  // a small sparkle puff: one InstancedMesh of tiny gold diamonds rising and shrinking (1 draw call, ~0.9 s)
  const sparkGeo = new OctahedronGeometry(0.07, 0), sparks = [], dummy = new Object3D();
  function sparkle(parent, x, y, z, h = 1.6) {
    if (!parent) return;
    const N = 20, mat = new MeshBasicMaterial({ color: 0xfff0b8, transparent: true, depthWrite: false });
    const m = new InstancedMesh(sparkGeo, mat, N); m.userData.roamSpark = true; m.frustumCulled = false; m.name = 'roam-sparkle';
    const pts = [];
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * 0.35; pts.push({ x: Math.cos(a) * r, y: 0.2 + Math.random() * h, z: Math.sin(a) * r, v: 0.5 + Math.random() * 0.8, s: 0.6 + Math.random() * 0.8, a }); }
    m.position.set(x, y, z); parent.add(m);
    sparks.push({ m, mat, pts, t: 0 });
  }
  function sparkTick(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i]; sp.t += dt; const k = sp.t / 0.9;
      if (k >= 1 || !sp.m.parent) { if (sp.m.parent) sp.m.parent.remove(sp.m); try { sp.mat.dispose(); } catch { /* backend quirk */ } sparks.splice(i, 1); continue; }
      sp.pts.forEach((p, j) => {
        dummy.position.set(p.x * (1 + k * 0.6), p.y + p.v * sp.t, p.z * (1 + k * 0.6)); dummy.rotation.set(0, p.a + sp.t * 6, sp.t * 4);
        dummy.scale.setScalar(p.s * Math.sin(Math.PI * Math.min(1, k * 1.3 + 0.05))); dummy.updateMatrix(); sp.m.setMatrixAt(j, dummy.matrix);
      });
      sp.m.instanceMatrix.needsUpdate = true; sp.mat.opacity = 1 - k * k;
    }
  }
  // take a figure off the stage: in view -> fade over VANISH s (+ sparkles when `magic`); off view -> at once
  const fading = [];
  function vanish(st, magic) {
    endBub(st.id); st.cat = null;
    const fig = st.fig; if (!fig) return;
    if (!fig.ready || !fig.holder.visible || fig.dead || !fig.holder.parent) { dropFig(st); return; }
    st.fig = null;
    if (fig.col) { const i = fig.colArr ? fig.colArr.indexOf(fig.col) : -1; if (i >= 0) fig.colArr.splice(i, 1); fig.col = null; }
    if (magic) { const p = fig.holder.position; sparkle(fig.holder.parent, p.x, p.y, p.z, fig.glb && st.id === 'flitwick' ? 1.1 : 1.8); }
    fading.push({ st, fig, t: 0 });
  }
  function fadeTick(dt) {
    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i]; f.t += dt;
      if (f.fig.dead || !f.fig.holder.parent || f.t >= VANISH) { fading.splice(i, 1); finishFig(f.fig); continue; }
      const k = f.t / VANISH; setAlpha(f.fig, 1 - k); f.fig.holder.scale.setScalar(1 - 0.12 * k);
      if (f.fig.mixer) f.fig.mixer.update(dt);
    }
  }
  function finishFig(fig) {
    killFig(fig);
    if (fig.holder.parent) fig.holder.parent.remove(fig.holder);
    solidMats(fig);
    if (fig.chibi) fig.chibi.traverse(o => { if (o.isMesh) { try { o.geometry.dispose(); } catch { /* backend quirk */ } } });
    if (fig.cat) fig.cat.traverse(o => { if (o.isMesh) { try { o.geometry.dispose(); } catch { /* backend quirk */ } } });
    log.dropped++;
  }

  // ---- the McGonagall cat (one fun touch): at a stop, a little tabby for ~6 s in a puff of sparkles ----
  function buildCat() {
    const g = new Group(), fur = new MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9 }), dark = new MeshStandardMaterial({ color: 0x4a3828, roughness: 0.9 });
    const body = new Mesh(new SphereGeometry(0.22, 12, 10), fur); body.scale.set(0.8, 0.75, 1.3); body.position.set(0, 0.24, 0); g.add(body);
    const head = new Mesh(new SphereGeometry(0.14, 12, 10), fur); head.position.set(0, 0.42, 0.26); g.add(head);
    for (const sx of [-1, 1]) { const ear = new Mesh(new ConeGeometry(0.05, 0.1, 6), dark); ear.position.set(sx * 0.07, 0.56, 0.25); g.add(ear); }
    for (const sx of [-1, 1]) { const eye = new Mesh(new SphereGeometry(0.022, 6, 5), new MeshBasicMaterial({ color: 0x2a3a12 })); eye.position.set(sx * 0.05, 0.45, 0.385); g.add(eye); }
    for (const [x, z] of [[-0.09, 0.15], [0.09, 0.15], [-0.09, -0.15], [0.09, -0.15]]) { const leg = new Mesh(new SphereGeometry(0.05, 6, 5), dark); leg.scale.set(1, 1.6, 1); leg.position.set(x, 0.06, z); g.add(leg); }
    const tail = new Mesh(new ConeGeometry(0.035, 0.42, 6), dark); tail.position.set(0, 0.42, -0.32); tail.rotation.x = -0.5; g.add(tail);
    for (let i = 0; i < 3; i++) { const s = new Mesh(new SphereGeometry(0.08, 6, 4), dark); s.scale.set(1.05, 0.25, 1); s.position.set(0, 0.36, 0.1 - i * 0.14); g.add(s); }   // tabby stripes
    g.userData.tail = tail; g.visible = false; return g;
  }
  function puff(fig) { try { const p = fig.holder.position; sparkle(fig.holder.parent, p.x, p.y, p.z, 1.0); } catch { /* ignore */ } }

  // ---- per-frame ----
  const frustum = new Frustum(), pm = new Matrix4(), sph = new Sphere(new Vector3(), 1.6), head = new Vector3(), wp = new Vector3();
  function speaking() { try { return !!(window.speechSynthesis && window.speechSynthesis.speaking); } catch { return false; } }
  function canGreet(st) {
    if (now - st.cool < COOL || now - lastGreet < SAY_S + AFTER_S + 0.5) return false;
    if (isModal() || isTakeover() || (map.isOpen && map.isOpen())) return false;
    if (speaking()) return false;
    return true;
  }
  function tick(dt) {
    if (failed > 3) return;
    try { step(dt); } catch (e) { failed++; console.warn('[roam] tick failed -', e && e.message || e); if (failed > 3) { console.warn('[roam] switched off: teachers stand at their stations'); for (const id of P.ORDER) dropFig(S[id]); } }
  }
  function step(dt) {
    now += dt; slow += dt; busyT += dt;
    sparkTick(dt); fadeTick(dt);
    if (busyT > 0.25) { busyT = 0; busy = busyWhy(); }   // the hold rules are checked 4x a second (lessons' hook is instant)
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm, camera.coordinateSystem);
    const room = interiors.active, rg = roomGroup();
    for (const id of P.ORDER) {
      const st = S[id];
      const why = holdWhy(st, busy);
      if (why) { if (st.held !== why) { st.held = why; log.holds++; } st.clock = 0; st.greet = null; st.cat = null; if (st.fig) vanish(st, true); continue; }
      if (st.held) { st.held = null; st.clock = 0; }
      // this teacher's figure lives where the player is
      let q = P.sampleDay(st.day, st.clock);
      if (q.place && q.phase !== 'home') st.visits.add(q.place);
      const where = q.place ? P.roomOf(q.place) : null, outdoor = q.place && P.ROOMS[q.place] && P.ROOMS[q.place].outdoor;
      let want = false;
      if (q.phase === 'walk' || q.phase === 'pause') {
        // outdoors only near Harry (32 m, dropped at 36): the main-gates view (~295.6k tris, 40+ m away) never carries a teacher
        if (outdoor) want = !room && Math.hypot(q.x - player.pos.x, q.z - player.pos.z) < (st.fig ? OUT_R + 4 : OUT_R);
        else want = !!room && where === room;
      }
      if (st.fig && (st.fig.dead || st.fig.roomObj !== interiors.room || st.fig.outdoor !== !!outdoor)) dropFig(st);
      else if (st.fig && !want) vanish(st, false);   // out through a doorway (or out of range): a soft fade, no sparkles
      if (want && !st.fig) { st.fig = buildFig(st, outdoor ? scene : rg, !!outdoor); st.fig.holder.rotation.y = q.yaw || 0; st.off.x = st.off.z = 0; st.stuck = 0; }
      const fig = st.fig;
      let advance = true;
      if (fig && fig.ready) {
        if (fig.appear < APPEAR) { fig.appear += dt; if (fig.appear >= APPEAR) solidMats(fig); else setAlpha(fig, fig.appear / APPEAR); }   // fade in (a doorway, a finished load)
        const by = outdoor ? (groundAt ? groundAt(q.x, q.z) : 0) : 0;
        const px = player.pos.x, pz = player.pos.z, dP = Math.hypot(px - q.x, pz - q.z);
        // greeting: stop, turn to Harry, Talk, one kind line (bubble + voice), then carry on
        sph.center.set(q.x, (outdoor ? by : player.pos.y) + 1.2, q.z);
        const seen = frustum.intersectsSphere(sph);
        const R = P.ROOMS[q.place];
        if (!st.greet && !st.cat && dP < GREET_R && seen && !P.inKeep(q.x, q.z, R.keep) && canGreet(st)) {
          const line = P.LINES[id][st.line++ % P.LINES[id].length];
          st.greet = { t: 0, line }; st.cool = now; lastGreet = now;
          head.set(q.x, by + (id === 'flitwick' ? 1.9 : 2.85) + (outdoor ? 0 : interiors.room.group.position.y), q.z);
          bub = fun.say(head, line, SAY_S, 'roam'); bubOf = id;
          let spoke = false; try { spoke = speak(line, { preset: st.T.preset }); } catch { spoke = false; }
          log.greets.push({ id, line, at: +now.toFixed(1), place: q.place, spoke }); if (log.greets.length > 20) log.greets.shift();
        }
        if (st.greet) { st.greet.t += dt; advance = false; if (st.greet.t > SAY_S + AFTER_S || dP > GREET_R + 3) st.greet = null; }
        // step aside: wait when Harry is in the walk path just ahead
        if (q.phase === 'walk' && !st.greet) {
          const ax = Math.sin(q.yaw), az = Math.cos(q.yaw), ahead = (px - q.x) * ax + (pz - q.z) * az;
          if (dP < WAIT_R && ahead > -0.2) { advance = false; st.wait += dt; } else st.wait = 0;
          // another teacher just ahead (standing, or walking with the right of way): wait up to 4 s, then carry on
          let blocked = false;
          for (const oid of P.ORDER) {
            const o = S[oid]; if (oid === id || !o.fig || !o.fig.ready || o.fig.parent !== fig.parent) continue;
            const ox = o.fig.holder.position.x - q.x, oz = o.fig.holder.position.z - q.z, d = Math.hypot(ox, oz);
            if (d < 1.1 && ox * ax + oz * az > 0.1 && (!o.moving || P.ORDER.indexOf(oid) < P.ORDER.indexOf(id))) blocked = true;
          }
          if (blocked && st.yieldT < 4) { advance = false; st.yieldT += dt; } else if (!blocked) st.yieldT = 0;
        }
        // Harry pressed against a standing teacher for > 1 s: slide aside (an offset clear of the room's colliders)
        if (dP < 0.95) st.stuck += dt; else st.stuck = Math.max(0, st.stuck - dt);
        let ox = 0, oz = 0;
        if (st.stuck > 1 && dP > 1e-3) { ox = (q.x - px) / dP * 0.9; oz = (q.z - pz) / dP * 0.9; const cols = outdoor ? colliders : interiors.room.colliders; const others = cols.filter(c => c !== fig.col); if (!P.pointFree(q.x + ox, q.z + oz, others, 0.35)) { const tx = -oz, tz = ox; ox = tx; oz = tz; if (!P.pointFree(q.x + ox, q.z + oz, others, 0.35)) { ox = 0; oz = 0; } } }
        st.off.x += (ox - st.off.x) * Math.min(1, dt * 3); st.off.z += (oz - st.off.z) * Math.min(1, dt * 3);
        const x = q.x + st.off.x, z = q.z + st.off.z;
        fig.holder.position.set(x, by, z);
        // facing: Harry while greeting, the walk direction while walking, the stop's yaw while pausing
        const wantYaw = st.greet ? Math.atan2(px - x, pz - z) : q.yaw;
        let dy = wantYaw - fig.holder.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); fig.holder.rotation.y += dy * Math.min(1, dt * 5);
        const moving = advance && q.phase === 'walk'; st.moving = moving;
        // the cat (McGonagall only, at a stop, never while greeting): 6 s once per stop visit, seeded
        if (id === 'mcgon') catTick(st, fig, q, dt);
        // solid while standing (never pops on top of Harry), off while walking (she waits for him instead)
        const solid = !moving && !st.cat;
        if (solid && !fig.col && dP > 0.9) { fig.col = { type: 'circle', x, z, r: 0.35, npc: 'roam-' + id }; fig.colArr = outdoor ? colliders : interiors.room.colliders; fig.colArr.push(fig.col); }
        if (fig.col) { fig.col.x = x; fig.col.z = z; if (!solid) { const i = fig.colArr.indexOf(fig.col); if (i >= 0) fig.colArr.splice(i, 1); fig.col = null; } }
        // visibility + animation: only what is in view and near
        fig.holder.visible = seen && (!outdoor || dP < OUT_R + 4);
        if (fig.holder.visible && dP < ANIM_R) {
          if (fig.mixer) { fadeTo(fig, st.greet ? 'talk' : moving ? 'walk' : (q.act === 'fold' && fig.acts.fold ? 'fold' : q.act === 'talk' && fig.acts.talk ? 'talk' : 'idle')); fig.mixer.update(dt); }
          else if (fig.rig) { animateChibi(fig.rig, dt, { moving }); if (fig.chibi) fig.chibi.position.y = moving ? Math.abs(Math.sin(now * 9)) * 0.04 : 0; }
        }
      } else if (fig && !fig.ready && q.phase === 'walk') {
        advance = true;                                // still loading: keep the schedule honest
      }
      if (advance) st.clock += dt * fast;
    }
    if (slow > 0.25) { slow = 0; chips(); }
  }
  function catTick(st, fig, q, dt) {
    if (st.cat) {
      st.cat.t += dt;
      const cat = fig.cat; if (cat && cat.userData.tail) cat.userData.tail.rotation.z = Math.sin(now * 3) * 0.4;
      if (st.cat.t > 6 || q.phase !== 'pause' || st.greet) {
        puff(fig); if (cat) cat.visible = false; if (fig.glb) fig.glb.visible = true; else if (fig.chibi && fig.rig) fig.chibi.visible = true;
        st.cat = null; st.catDone = q.seg;
      }
      return;
    }
    if (q.phase !== 'pause' || st.greet || st.catDone === q.seg || q.u < 2.5) return;
    if (((seed + q.seg * 7) % 3) !== 0 && !st.catForce) return;   // about one stop in three
    st.catForce = false;
    if (!fig.cat) { fig.cat = buildCat(); fig.holder.add(fig.cat); }
    puff(fig); fig.cat.visible = true; if (fig.glb) fig.glb.visible = false; if (fig.chibi) fig.chibi.visible = false;
    st.cat = { t: 0 };
  }
  function placeOf(st) {
    if (st.held) return st.T.home;
    const q = P.sampleDay(st.day, st.clock);
    return q.place || q.to || st.T.home;
  }
  function chips() {
    const by = {};
    for (const id of P.ORDER) { const c = P.CARD_OF(placeOf(S[id])); (by[c] = by[c] || []).push(P.TEACHERS[id].badge); }
    const k = JSON.stringify(by); if (k === chipKey) return; chipKey = k;
    try { map.setChips && map.setChips(by); } catch { /* map without chips */ }
  }

  lessons.setRoamHook && lessons.setRoamHook((lessonKey) => { const id = idOfLesson[lessonKey]; if (id) home(id); });

  const api = {
    state: () => Object.fromEntries(P.ORDER.map(id => { const st = S[id], q = P.sampleDay(st.day, st.clock); return [id, {
      place: placeOf(st), card: P.CARD_OF(placeOf(st)), stop: q.phase === 'pause' ? [q.x, q.z] : null, phase: st.held ? 'home' : q.phase, held: st.held,
      x: q.x != null ? +q.x.toFixed(2) : null, z: q.z != null ? +q.z.toFixed(2) : null, clock: +st.clock.toFixed(1), day: +st.day.total.toFixed(0),
      fig: st.fig ? { ready: st.fig.ready, glb: !!st.fig.glb, visible: st.fig.holder.visible, x: +st.fig.holder.position.x.toFixed(2), z: +st.fig.holder.position.z.toFixed(2), yaw: +st.fig.holder.rotation.y.toFixed(2), anim: st.fig.cur, solid: !!st.fig.col, ts: st.fig.acts && st.fig.acts.walk ? +st.fig.acts.walk.timeScale.toFixed(2) : null } : null,
      greeting: !!st.greet, cat: !!st.cat, visits: [...st.visits] }]; })),
    fast: (k) => { fast = Math.max(0, +k || 1); return fast; },
    where: (id) => (S[id] ? placeOf(S[id]) : null),
    hold: (on = true) => { debugHold = !!on; return debugHold; },
    seed: (n) => { seed = (n >>> 0) || seed; for (const id of P.ORDER) vanish(S[id], true); reset(); return seed; },
    clock: (id, t) => { if (S[id] && t != null) { S[id].clock = t; } return S[id] ? S[id].clock : null; },
    plan: (id) => S[id] ? S[id].day.segs.map(s => ({ place: s.place, kind: s.kind, t0: +s.t0.toFixed(1), dur: +s.dur.toFixed(1), to: s.to || null, at: s.at ? [s.at.x, s.at.z] : null, path: s.path || null })) : null,
    cooldown: (id, t = -1e9) => { if (S[id]) S[id].cool = t; lastGreet = -1e9; return true; },
    cat: (on = true) => { S.mcgon.catForce = !!on; return true; },
    home, log, on: true, get failed() { return failed; }, get fading() { return fading.length; },
  };
  return { tick, api };
}
