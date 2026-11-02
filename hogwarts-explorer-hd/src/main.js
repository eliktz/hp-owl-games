// Entry point: builds the scene, runs the loop, exposes window.__game test hooks.
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
import { SPOTS, TIER } from './config.js';

const hud = {
  set(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; },
};

async function boot() {
  const canvas = document.getElementById('view');
  const renderer = await createRenderer(canvas);
  const scene = new Scene();
  const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);

  // Real CC0 maps if fetched; otherwise procedural (returns null -> fallback).
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
  buildLake(scene, { sunDir: env.sun.position.clone().normalize() });
  const { group: castleGroup, colliders } = buildCastle(scene, mats);

  // Published fan scenery (Hagrid's hut, Hedwig, Quidditch props) on the real terrain.
  const scenery = await loadScenery({ scene, heightAt }).catch(() => ({}));

  const input = new Input(document.body);
  const player = new Player(scene, camera, { heightAt, colliders });

  // Settle the camera at the spawn view, then trim any scenery that pushes the scene over
  // the iPad triangle budget from that view.
  player.update(0, input);
  if (scenery.enforce) await scenery.enforce(renderer, camera).catch(() => {});

  const quality = new QualityManager(renderer, {
    onTier: (t) => hud.set('tier', { high: 'איכות גבוהה', medium: 'איכות בינונית', low: 'איכות חסכונית' }[t] || t),
  });
  quality.applyTier(TIER.HIGH);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // day/dusk/night button
  const tBtn = document.getElementById('timeBtn');
  if (tBtn) tBtn.addEventListener('click', async () => {
    const k = await env.cycle();
    hud.set('time', { day: '☀️ יום', dusk: '🌅 דמדומים', night: '🌙 לילה' }[k]);
  });
  hud.set('time', '☀️ יום');

  let last = performance.now(), frames = 0, facc = 0, fps = 0;
  function loop() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    const dtMs = now - last; last = now;
    frames++; facc += dtMs;
    if (facc >= 500) { fps = Math.round(frames * 1000 / facc); frames = 0; facc = 0; hud.set('fps', fps + ' FPS'); }

    player.update(dt, input);
    quality.sample(dtMs);
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(loop);

  // ---- test / debug hooks -------------------------------------------------
  window.__game = {
    ready: true,
    backend: backendName(renderer),
    teleport(id) { const s = SPOTS[id]; if (s) { player.teleport(s.x, s.z); return true; } return false; },
    setTime: (k) => env.setTime(k),
    setQuality: (t) => quality.applyTier(t),
    spots: () => Object.keys(SPOTS),
    stats() {
      const info = renderer.info || {};
      const r = info.render || {};
      const mem = info.memory || {};
      return {
        fps,
        backend: backendName(renderer),
        tier: quality.tier,
        drawCalls: r.drawCalls ?? r.calls ?? 0,
        triangles: r.triangles ?? 0,
        textures: mem.textures ?? 0,
        geometries: mem.geometries ?? 0,
      };
    },
  };
  hud.set('backend', backendName(renderer).toUpperCase());
}

boot().catch(err => {
  console.error('[boot] fatal', err);
  const o = document.getElementById('err');
  if (o) { o.style.display = 'block'; o.textContent = 'שגיאה בטעינה: ' + err.message; }
  window.__game = { ready: false, error: String(err && err.message || err) };
});
