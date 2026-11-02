// Entry point: builds the scene, wires the HUD/quests/map/interiors, runs the loop, and
// exposes window.__game test hooks.
import { Scene, PerspectiveCamera, Vector3 } from 'three';
import { createRenderer, backendName } from './renderer.js';
import { QualityManager } from './quality.js';
import { Environment } from './environment.js';
import { buildTerrain, heightAt } from './terrain.js';
import { buildLake } from './lake.js';
import { makeMaterials } from './materials.js';
import { buildCastle } from './castle.js';
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
  buildTerrain(scene, { texture: grass });
  buildLake(scene);
  const { colliders } = buildCastle(scene, mats);

  // Published fan scenery (Hagrid's hut, Quidditch props), area-streamed by distance.
  const scenery = await loadScenery({ scene, heightAt }).catch(() => ({ update: () => {} }));

  const input = new Input(document.body);
  const player = new Player(scene, camera, { heightAt, colliders });
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
  wireButtons({ env, map, interiors, audio });
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
  return { greathall: 'האולם הגדול', staircase: 'המדרגות הנעות', library: 'הספרייה', commonroom: 'חדר הטרקלין' }[id] || id;
}
function setExit(on) { const b = document.getElementById('exitBtn'); if (b) b.style.display = on ? 'flex' : 'none'; }

function wireButtons({ env, map, interiors, audio }) {
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
