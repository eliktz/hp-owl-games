// Entry point: builds the scene, wires the HUD/quests/map/interiors, runs the loop, and
// exposes window.__game test hooks.
import { Scene, PerspectiveCamera, Vector3, Raycaster, Frustum, Matrix4, Sphere } from 'three';
import { createRenderer, backendName } from './renderer.js';
import { setRenderer as setModelRenderer, modelStatus } from './models.js';
import { QualityManager } from './quality.js';
import { Environment } from './environment.js';
import { buildTerrain, heightAt } from './terrain.js';
import { buildLake } from './lake.js';
import { makeMaterials, loadFilmMaps } from './materials.js';
import { buildCastle, DOOR } from './castle.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { loadTexture } from './assets.js';
import { loadScenery } from './scenery.js';
import { createCharacters } from './characters.js';
import { createQuests } from './quests.js';
import { createMap } from './map.js';
import { createInteriors } from './interiors.js';
import { createAudio } from './audio.js';
import { SPOTS, PLACES, TIER, TIMES } from './config.js';
import { blobShadow } from './atmosphere.js';
import * as fun from './fun.js';
import { createLessons } from './lessons.js';
import { createStudents } from './students.js';
import { createQuidditch } from './quidditch.js';
import { createDelight } from './delight.js';
import { kitStats } from './interior-kit.js';
import { FLOOR_Y } from './rooms.js';

const hud = { set(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; } };

// Transient toast for quest progress.
let toastT = null;
function toast(msg) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2200);
}

async function boot() {
  const canvas = document.getElementById('view');
  const renderer = await createRenderer(canvas);
  setModelRenderer(renderer);                 // KTX2 format detection for the GLB loader
  const scene = new Scene();
  const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);

  // Film stone + slate (colour + normal, KTX2/WebP, materials.js); the old jpgs are only
  // fetched for whichever film set is missing, so the castle never loses its texture.
  const [film, wood] = await Promise.all([loadFilmMaps().catch(() => null), loadTexture('wood_1k.jpg', { repeat: 2 })]);
  const [stone, slate] = await Promise.all([
    film?.wall ? null : loadTexture('castle_wall_1k.jpg', { repeat: 2 }),
    film?.slate ? null : loadTexture('slate_roof_1k.jpg', { repeat: 3 }),
  ]);
  const grass = await loadTexture('grass_1k.jpg', { repeat: 120 });
  const mats = makeMaterials({ stone, slate, wood, film });

  const env = new Environment(scene, { renderer, windowMat: mats.window });
  await env.setTime('day');
  const terrain = buildTerrain(scene, { texture: grass });
  const lake = buildLake(scene);
  env.onTime = (k, p, sky) => lake.userData.setTime(p, sky); lake.userData.setTime(TIMES[env.time] || TIMES.day, scene.environment);
  const { group: castleGroup, colliders } = buildCastle(scene, mats);

  // Published fan scenery (Hagrid's hut, Quidditch props), area-streamed by distance.
  const scenery = await loadScenery({ scene, heightAt }).catch(() => ({ update: () => {} }));

  const input = new Input(document.body);
  const player = new Player(scene, camera, { heightAt, colliders });
  // The spring-arm raycasts against the castle shell + terrain so it never clips walls.
  player.cam.obstacles = [castleGroup, terrain];
  const audio = createAudio();

  // Friendly characters (Ron/Hermione/Hedwig models + code-drawn Harry/Hagrid).
  const characters = await createCharacters({ scene, heightAt }).catch(() => ({ update: () => null }));
  // Ron, Hermione and Hagrid are solid: a circle each in the outdoor colliders (they never move).
  for (const c of characters.characters || []) if (c.kind === 'person') colliders.push({ type: 'circle', x: c.x, z: c.z, r: c.name === 'hagrid' ? 0.6 : 0.35, npc: c.name });

  // Gentle quests: collect stars, deliver letters.
  const quests = createQuests({
    scene, heightAt, hud, onToast: toast,
    onAll: () => setTimeout(() => { fun.toast('🌟', 'כָּל הַכּוֹכָבִים שֶׁלְּךָ!', 3000); fun.confetti(['⭐', '🌟', '✨', '💛'], 34); fun.sfx.tada(); }, 600),
    sfx: { chime: () => { audio.chime(); player.play('Cheer'); }, letter: () => audio.letter() },   // chime = a star found / a letter delivered: Harry cheers
  });

  player.update(0, input);
  scenery.update(player.pos);

  // Interiors (streamed) + the Hebrew map / fast-travel screen.
  const interiors = createInteriors({
    scene, env, player, terrainHeightAt: heightAt, homeSpot: SPOTS.courtyard,
    onEnter: (id) => { setExit(true); toast('✨ נכנסת ל' + labelOf(id)); if (lessons) lessons.roomEntered(id, interiors.room.group); if (students) students.roomEntered(id, interiors.room.group); if (delight) delight.roomEntered(id, interiors.room.group); },
    onExit: () => setExit(false),
  });
  // A full-screen overlay (lesson, picker, ceremony) owns the screen: the hero + camera freeze.
  let modal = false, lessons = null, delight = null, students = null;
  function setModal(v) { modal = !!v; input.setEnabled(!modal); document.body.classList.toggle('modalOn', modal); }
  fun.bindMute(() => audio.muted);
  const map = createMap({
    onTravel: (id, kind) => {
      audio.resume();
      if (kind === 'interior') interiors.enter(id);
      else { if (interiors.active) interiors.exit(); const sp = SPOTS[id] || PLACES[id]; if (sp) player.teleport(sp.x, sp.z); }
    },
  });

  // Bloom post pipeline (step 6): HIGH and MEDIUM only. Loaded dynamically so a missing or
  // broken post module can never stop the game from booting; null = render direct.
  // ?post=0 disables it, ?post=1 forces it. Default: ON for WebGL2 (verified), OFF for
  // WebGPU until it has been checked on a real iPad (WebGPU shader/validation errors are
  // asynchronous, so a bad pipeline there could not be caught and would blank the game).
  let post = null;
  const postParam = new URLSearchParams(location.search).get('post');
  const isWebGPU = !!(renderer.backend && renderer.backend.isWebGPUBackend);
  const baseState = { toneMapping: renderer.toneMapping, outputColorSpace: renderer.outputColorSpace, autoClear: renderer.autoClear };
  if (postParam === '1' || (postParam !== '0' && !isWebGPU)) {
    try { post = (await import('./post.js')).createPost(renderer, scene, camera); }
    catch (e) { console.warn('[post] disabled:', e && e.message || e); post = null; }
  }
  // Drop the pipeline for good and put the renderer back exactly as renderer.render expects
  // (RenderPipeline.render changes tone mapping / colour space / targets without try-finally).
  function dropPost(why) {
    if (why) console.warn('[post] ' + why);
    try { post && post.dispose(); } catch (e) { /* ignore */ }
    post = null; usePost = false;
    try {
      renderer.toneMapping = baseState.toneMapping; renderer.outputColorSpace = baseState.outputColorSpace; renderer.autoClear = baseState.autoClear;
      renderer.setRenderTarget(null); if (renderer.setMRT) renderer.setMRT(null);
    } catch (e) { /* ignore */ }
  }
  let usePost = false;
  const quality = new QualityManager(renderer, {
    onTier: (t) => {
      if (t === TIER.LOW && post) dropPost();          // free the bloom render targets on struggling devices
      usePost = !!post && t !== TIER.LOW;
      lake.userData.mist?.setEnabled(t !== TIER.LOW);
      hud.set('tier', { high: 'איכות גבוהה', medium: 'איכות בינונית', low: 'איכות חסכונית' }[t] || t);
    },
  });
  quality.applyTier(quality.tier);                 // HIGH unless ?q= pins a tier
  // One frame through the pipeline; on any throw, fall back to renderer.render for good.
  function renderFrame() {
    if (usePost) {
      try { post.render(); return; }
      catch (e) { dropPost('render failed, falling back: ' + (e && e.message || e)); }
    }
    renderer.render(scene, camera);
  }

  // The post pipeline needs no resize call: PassNode and BloomNode read the renderer's
  // drawing-buffer size every frame (also after quality.js changes the pixel ratio).
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  wireButtons({ env, map, interiors, audio, player });
  // resume the audio context on the first user gesture (autoplay policy)
  const kick = () => { audio.resume(); removeEventListener('pointerdown', kick); removeEventListener('keydown', kick); };
  addEventListener('pointerdown', kick); addEventListener('keydown', kick);

  // ---- dialogue bubble ----------------------------------------------------
  const bubbleEl = document.getElementById('bubble');
  let bubbleChar = null, bubbleLine = 0, bubbleT = 0;
  function showBubble(c) {
    if (!bubbleEl) return;
    if (!c) { bubbleEl.style.display = 'none'; bubbleChar = null; return; }
    if (c !== bubbleChar) { bubbleChar = c; bubbleLine = 0; bubbleT = 0; audio.resume(); if (c.kind === 'owl') audio.hoot(); }
    bubbleEl.innerHTML = '<b>' + c.heb + '</b>' + c.lines[bubbleLine % c.lines.length];
    bubbleEl.style.display = 'block';
  }

  // ---- physical castle entrance -------------------------------------------
  // Outside, near the front oak doors: show a big "enter" prompt; walking right into the
  // doorway auto-enters the Entrance Hall. `doorArmed` stops re-triggering after exiting
  // (you leave onto the approach path, clear of the trigger, which re-arms it).
  const enterBtn = document.getElementById('enterBtn');
  let doorArmed = true;
  if (enterBtn) enterBtn.addEventListener('click', () => { if (!interiors.active) interiors.enter('entrancehall'); });
  function updateDoor(inside) {
    if (inside) { if (enterBtn) enterBtn.style.display = 'none'; return; }
    const d = Math.hypot(player.pos.x - DOOR.x, player.pos.z - DOOR.enterZ);
    if (enterBtn) enterBtn.style.display = d < DOOR.enterR ? 'flex' : 'none';
    if (d > DOOR.enterR + 1.5) doorArmed = true;
    else if (doorArmed && d < DOOR.autoR) { doorArmed = false; interiors.enter('entrancehall'); }
  }

  // Indoors, hide the whole outdoor world (castle shell, terrain, lake, friends). The rooms
  // live 200m below the grounds, but relying on distance+fog+ceiling to occlude the exterior
  // is fragile — the Great Hall has no solid ceiling, so on WebGPU the real castle bled
  // through as a pale pixelated "tower" behind the tables. Toggling visibility is the robust
  // fix (and reclaims the exterior's draw calls / shadow pass while you're inside).
  const outdoorRoots = [castleGroup, terrain, lake, ...(quests.roots || [])];
  lessons = createLessons({ scene, player, interiors, heightAt, registerOutdoor: (o) => outdoorRoots.push(o), setModal });
  // A mini-game may take over the hero + camera for a while (the Quidditch match).
  let takeover = null;
  const quidditch = createQuidditch({ scene, camera, player, heightAt, interiors, colliders, registerOutdoor: (o) => outdoorRoots.push(o),
    setTakeover: (o) => { takeover = o || null; input.releaseAll(); }, isModal: () => modal, setModal, timeOfDay: () => env.time });
  // Background students (decoration only: any failure -> simply none). Created after `quality`
  // so LOW can thin them out; the courtyard group is an outdoor root (hidden indoors).
  try { students = createStudents({ scene, camera, player, heightAt, tier: () => quality.tier, registerOutdoor: (o) => outdoorRoots.push(o), colliders }); }
  catch (e) { console.warn('[students] disabled -', e && e.message || e); students = null; }
  delight = createDelight({ scene, camera, player, interiors, heightAt, setModal, isModal: () => modal });
  lessons.addPickerButton('🧹 קְוִוידִיץ׳ — מִשְׂחָק!', () => quidditch.start());
  // Friends are never frustum-culled per mesh (odd bounds), so cull each whole figure by one
  // sphere test instead: an off-screen friend costs no draw calls (and no shadow draws).
  const frustum = new Frustum(), pm = new Matrix4(), sph = new Sphere(new Vector3(), 3.2);
  function cullFriends() {
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pm, camera.coordinateSystem);
    for (const c of characters.characters || []) { sph.center.set(c.group.position.x, c.group.position.y + 1.2, c.group.position.z); c.group.visible = Math.hypot(c.group.position.x - player.pos.x, c.group.position.z - player.pos.z) < 85 && frustum.intersectsSphere(sph); }
  }
  let worldShown = true;
  function setWorldVisible(on) {
    if (on === worldShown) return;
    worldShown = on;
    for (const o of outdoorRoots) o.visible = on;
    if (!on) for (const c of characters.characters || []) c.group.visible = false;
    for (const pc of scenery.pieces || []) if (!on) pc.group.visible = false;
  }

  const hooks = [];                      // extra per-frame systems (delight, quidditch): fn(dt, inside)
  if (students) hooks.push((dt, inside) => students.update(dt, inside));
  const shadow = blobShadow(scene);
  let wasInside = null;
  let last = performance.now(), frames = 0, facc = 0, fps = 0;
  function loop() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    const dtMs = now - last; last = now;
    frames++; facc += dtMs;
    if (facc >= 500) { fps = Math.round(frames * 1000 / facc); frames = 0; facc = 0; hud.set('fps', fps + ' FPS'); }

    if (takeover) { input.consumeLook(); input.consumeZoom(); takeover.update(dt, input.axis()); }
    else {
      player.update(dt, input);
      const ax = input.axis();
      if (Math.hypot(ax.x, ax.y) > 0.05) audio.step(dt);
    }
    interiors.update(dt);
    const inside = !!interiors.active;
    setWorldVisible(!inside);
    if (!inside) { cullFriends(); lake.userData.mist?.update(dt, camera); }
    if (inside !== wasInside) { wasInside = inside; document.body.classList.toggle('inside', inside); }
    shadow.visible = inside;
    if (inside) shadow.position.set(player.pos.x, FLOOR_Y + 0.05, player.pos.z);
    if (!takeover) updateDoor(inside);
    scenery.update(inside ? null : player.pos);
    const near = inside || takeover ? null : characters.update(dt, player.pos);
    quests.update(dt, inside ? null : player.pos, near);
    // cycle the dialogue line every few seconds while standing by a friend
    if (near) { bubbleT += dt; if (bubbleT > 3.2) { bubbleT = 0; bubbleLine++; } showBubble(near); } else showBubble(null);

    if (!modal && !takeover) { lessons.update(dt); quidditch.idle(dt, inside); }
    else if (!takeover) lessons.anim(dt);   // GLB professors keep animating behind a lesson overlay
    if (!takeover) delight.update(dt, inside);
    else lessons.cull();                // a match is on: far lesson spots must not cost draw calls
    fun.tick(dt, camera);
    for (const h of hooks) h(dt, inside);

    quality.sample(dtMs);
    renderFrame();
  }
  renderer.setAnimationLoop(loop);

  // ---- test / debug hooks -------------------------------------------------
  window.__game = {
    ready: true,
    backend: backendName(renderer),
    teleport(id) { if (interiors.active) interiors.exit(); const s = SPOTS[id]; if (s) { player.teleport(s.x, s.z); return true; } return false; },
    enterInterior: (id) => interiors.enter(id),
    exitInterior: () => interiors.exit(),
    setTime: (k) => env.setTime(k),
    setQuality: (t) => quality.applyTier(t),
    get post() { return post; },
    postActive: () => usePost,
    spots: () => Object.keys(SPOTS),
    questState: () => quests.state,
    // Gameplay-test probe: player/camera world pos, whether a wall sits between the player
    // and the lens (camera "inside" geometry), and where the player projects on screen.
    probe() {
      const head = new Vector3(player.pos.x, player.pos.y + player.cam.headY, player.pos.z);
      const toCam = new Vector3().subVectors(camera.position, head);
      const dist = toCam.length();
      const rc = new Raycaster(head, toCam.clone().normalize(), 0.1, Math.max(0.01, dist - 0.3));
      rc.camera = camera;
      const hits = rc.intersectObjects((player.cam.obstacles || []).filter(o => o && o.parent), true).filter(h => h.object && h.object.isMesh);
      const camBehindWall = hits.length > 0 && hits[0].distance < dist - 0.35;
      camera.updateMatrixWorld(true);   // judge against where the lens is NOW, not the last drawn frame
      const sp = head.clone().project(camera);
      const onScreen = sp.z < 1 && Math.abs(sp.x) <= 1 && Math.abs(sp.y) <= 1;
      return {
        player: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
        camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        camDist: dist, camBehindWall,
        playerVisible: player.model.visible, onScreen,
        screen: { x: (sp.x * 0.5 + 0.5) * innerWidth, y: (-sp.y * 0.5 + 0.5) * innerHeight },
        interior: interiors.active,
      };
    },
    walk(x, y) { input.target.x = x; input.target.y = y; },   // drive movement from tests
    input, player, scene, camera, renderer, audio, env, interiors, toast, heightAt, kitStats, lessons, hooks, quests, fun,
    get modal() { return modal; }, setModal, quidditch, delight, students, get takeover() { return takeover; },
    give(type, n) { quests.bonus(n || 1); }, cheer() {},
    registerOutdoor: (o) => outdoorRoots.push(o),
    // Steer toward a world point (x,z): sets the joystick to head there given the camera's
    // current yaw. Returns the remaining distance so tests can walk until they arrive.
    steer(x, z) {
      const cy = player.cam.yaw, dx = x - player.pos.x, dz = z - player.pos.z;
      const d = Math.hypot(dx, dz) || 1e-3, nx = dx / d, nz = dz / d;
      const fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
      input.target.y = nx * fx + nz * fz;   // forward component
      input.target.x = nx * rx + nz * rz;   // strafe component
      return d;
    },
    orbit(dx, dy) { player.cam.orbit(dx, dy); },
    // Corruption probe: any non-finite world positions or geometry bounds across the scene
    // (NaN/Infinity from a bad merge/UV/scale would show up here before it reaches a pixel).
    health() {
      let nan = 0, meshes = 0;
      const p = new Vector3();
      scene.traverse(o => {
        if (!o.isMesh || !o.visible) return;
        meshes++;
        o.getWorldPosition(p);
        if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) nan++;
        const bs = o.geometry && o.geometry.boundingSphere;
        if (bs && !isFinite(bs.radius)) nan++;
      });
      return { nan, meshes };
    },
    // Emissive meshes that project near the top of the frame — for tracking down stray glows.
    scan() {
      const out = []; const p = new Vector3();
      scene.traverse(o => {
        if (!o.isMesh || !o.visible) return;
        const m = o.material; if (!m || !m.emissiveIntensity) return;
        o.getWorldPosition(p); const s = p.clone().project(camera);
        if (s.z < 1 && s.y > 0.3) out.push({ y: +p.y.toFixed(1), z: +p.z.toFixed(1), sy: +s.y.toFixed(2), ei: m.emissiveIntensity, geo: o.geometry.type });
      });
      return out.sort((a, b) => b.sy - a.sy).slice(0, 8);
    },
    debug() {
      let meshes = 0, casters = 0, visible = 0;
      scene.traverse(o => { if (o.isMesh) { meshes++; if (o.castShadow) casters++; if (o.visible) visible++; } });
      return { meshes, casters, visible };
    },
    // Per-model load result ('ok' or the reason it fell back), for diagnosing on a phone.
    models() { return modelStatus(); },
    stats() {
      const info = renderer.info || {}; const r = info.render || {}; const mem = info.memory || {};
      return {
        fps, backend: backendName(renderer), tier: quality.tier,
        drawCalls: r.drawCalls ?? r.calls ?? 0, triangles: r.triangles ?? 0,
        textures: mem.textures ?? 0, geometries: mem.geometries ?? 0,
        interior: interiors.active,
      };
    },
  };
  hud.set('backend', backendName(renderer).toUpperCase());
  // ?debug=1: append any model that fell back (and why) to the backend pill, so a silent
  // fallback is visible on an iPhone/iPad without a console.
  if (document.body.classList.contains('debug')) {
    setInterval(() => {
      const bad = Object.entries(modelStatus()).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ': ' + v);
      hud.set('backend', backendName(renderer).toUpperCase() + (bad.length ? ' | ' + bad.join(' | ') : ''));
    }, 2000);
  }
}

function labelOf(id) {
  return { entrancehall: 'אולם הכניסה', greathall: 'האולם הגדול', staircase: 'המדרגות הנעות', library: 'הספרייה', commonroom: 'חדר הטרקלין',
    dungeon: 'מרתף השיקויים', classrooms: 'כיתות הלימוד', tower: 'מגדל הכוכבים' }[id] || id;
}
function setExit(on) { const b = document.getElementById('exitBtn'); if (b) b.style.display = on ? 'flex' : 'none'; }

// A button that fires `fn` once on tap and then repeatedly while held (for rotate/zoom).
function holdBtn(id, fn) {
  const el = document.getElementById(id); if (!el) return;
  let timer = null;
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const start = e => { e.preventDefault(); e.stopPropagation(); fn(); stop(); timer = setInterval(fn, 40); };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointerleave', stop);
  el.addEventListener('pointercancel', stop);
}

function wireButtons({ env, map, interiors, audio, player }) {
  // Camera controls: orbit left/right, zoom in/out (held = continuous), reset behind player.
  const cam = player.cam;
  holdBtn('camL', () => cam.orbit(-9, 0));
  holdBtn('camR', () => cam.orbit(9, 0));
  holdBtn('camIn', () => cam.zoom(0.35));
  holdBtn('camOut', () => cam.zoom(-0.35));
  const cr = document.getElementById('camReset');
  if (cr) cr.addEventListener('click', e => { e.stopPropagation(); cam.reset(player.yaw); });
  const t = document.getElementById('timeBtn');
  if (t) t.addEventListener('click', async () => {
    const k = await env.cycle();
    hud.set('time', { day: '☀️ יום', dusk: '🌅 דמדומים', night: '🌙 לילה' }[k]);
  });
  hud.set('time', '☀️ יום');
  const m = document.getElementById('mapBtn');
  if (m) m.addEventListener('click', () => { audio.resume(); map.toggle(); });
  const x = document.getElementById('exitBtn');
  if (x) x.addEventListener('click', () => interiors.exit());
  const mute = document.getElementById('muteBtn');
  if (mute) mute.addEventListener('click', () => { audio.resume(); mute.textContent = audio.toggleMute() ? '🔇' : '🔊'; });
}

boot().catch(err => {
  console.error('[boot] fatal', err);
  const o = document.getElementById('err');
  if (o) { o.style.display = 'block'; o.textContent = 'שגיאה בטעינה: ' + err.message; }
  window.__game = { ready: false, error: String(err && err.message || err) };
});
