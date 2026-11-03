// Entry point: builds the scene, wires the HUD/quests/map/interiors, runs the loop, and
// exposes window.__game test hooks.
import { Scene, PerspectiveCamera, Vector3, Raycaster } from 'three';
import { createRenderer, backendName } from './renderer.js';
import { QualityManager } from './quality.js';
import { Environment } from './environment.js';
import { buildTerrain, heightAt } from './terrain.js';
import { buildLake } from './lake.js';
import { makeMaterials } from './materials.js';
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
import { SPOTS, TIER } from './config.js';

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
  const scene = new Scene();
  const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);

  const [stone, slate, wood] = await Promise.all([
    loadTexture('castle_wall_1k.jpg', { repeat: 2 }),
    loadTexture('slate_roof_1k.jpg', { repeat: 3 }),
    loadTexture('wood_1k.jpg', { repeat: 2 }),
  ]);
  const grass = await loadTexture('grass_1k.jpg', { repeat: 120 });
  const mats = makeMaterials({ stone, slate, wood });

  const env = new Environment(scene);
  await env.setTime('day');
  const terrain = buildTerrain(scene, { texture: grass });
  buildLake(scene);
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

  // Gentle quests: collect stars, deliver letters.
  const quests = createQuests({
    scene, heightAt, hud, onToast: toast,
    sfx: { chime: () => audio.chime(), letter: () => audio.letter() },
  });

  player.update(0, input);
  scenery.update(player.pos);

  // Interiors (streamed) + the Hebrew map / fast-travel screen.
  const interiors = createInteriors({
    scene, env, player, terrainHeightAt: heightAt, homeSpot: SPOTS.courtyard,
    onEnter: (id) => { setExit(true); toast('✨ נכנסת ל' + labelOf(id)); },
    onExit: () => setExit(false),
  });
  const map = createMap({
    onTravel: (id, kind) => {
      audio.resume();
      if (kind === 'interior') interiors.enter(id);
      else { if (interiors.active) interiors.exit(); if (SPOTS[id]) player.teleport(SPOTS[id].x, SPOTS[id].z); }
    },
  });

  const quality = new QualityManager(renderer, {
    onTier: (t) => hud.set('tier', { high: 'איכות גבוהה', medium: 'איכות בינונית', low: 'איכות חסכונית' }[t] || t),
  });
  quality.applyTier(TIER.HIGH);

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

  let last = performance.now(), frames = 0, facc = 0, fps = 0;
  function loop() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    const dtMs = now - last; last = now;
    frames++; facc += dtMs;
    if (facc >= 500) { fps = Math.round(frames * 1000 / facc); frames = 0; facc = 0; hud.set('fps', fps + ' FPS'); }

    player.update(dt, input);
    const ax = input.axis();
    if (Math.hypot(ax.x, ax.y) > 0.05) audio.step(dt);
    interiors.update(dt);
    const inside = !!interiors.active;
    updateDoor(inside);
    scenery.update(inside ? null : player.pos);
    if (inside) for (const pc of scenery.pieces || []) pc.group.visible = false;
    const near = inside ? null : characters.update(dt, player.pos);
    quests.update(dt, inside ? null : player.pos, near);
    // cycle the dialogue line every few seconds while standing by a friend
    if (near) { bubbleT += dt; if (bubbleT > 3.2) { bubbleT = 0; bubbleLine++; } showBubble(near); } else showBubble(null);

    quality.sample(dtMs);
    renderer.render(scene, camera);
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
    spots: () => Object.keys(SPOTS),
    questState: () => quests.state,
    // Gameplay-test probe: player/camera world pos, whether a wall sits between the player
    // and the lens (camera "inside" geometry), and where the player projects on screen.
    probe() {
      const head = new Vector3(player.pos.x, player.pos.y + player.cam.headY, player.pos.z);
      const toCam = new Vector3().subVectors(camera.position, head);
      const dist = toCam.length();
      const rc = new Raycaster(head, toCam.clone().normalize(), 0.1, dist - 0.3);
      const hits = rc.intersectObjects(player.cam.obstacles, true);
      const camBehindWall = hits.length > 0 && hits[0].distance < dist - 0.35;
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
    debug() {
      let meshes = 0, casters = 0, visible = 0;
      scene.traverse(o => { if (o.isMesh) { meshes++; if (o.castShadow) casters++; if (o.visible) visible++; } });
      return { meshes, casters, visible };
    },
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
}

function labelOf(id) {
  return { entrancehall: 'אולם הכניסה', greathall: 'האולם הגדול', staircase: 'המדרגות הנעות', library: 'הספרייה', commonroom: 'חדר הטרקלין' }[id] || id;
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
