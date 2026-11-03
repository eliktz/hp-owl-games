// Interiors manager: streams one room in at a time (built on enter, disposed on leave — so
// only one room's geometry is ever resident, keeping iPad memory low). Rooms are built by
// rooms.js from textured primitives; this file wires them to the player/camera/lighting and
// drives the walkable doorway "portals" (stroll room->room, or back out to the grounds).
import { Color } from 'three';
import { ensureTex } from './interior-kit.js';
import { BUILDERS, FLOOR_Y } from './rooms.js';

export function createInteriors({ scene, env, player, terrainHeightAt, homeSpot, onEnter, onExit }) {
  let active = null, t = 0, cooldown = 0;
  let savedAmb = 0, savedHemi = 0, savedColliders = null, savedObstacles = null;

  async function enter(id) {
    const build = BUILDERS[id]; if (!build) return;
    const wasInside = !!active;
    if (active) teardown();
    await ensureTex();                        // load stone/wood maps so rooms aren't flat grey
    const r = await build(); active = r; active.id = id;
    scene.add(r.group);
    if (!savedColliders) savedColliders = player.colliders;
    if (!savedObstacles) savedObstacles = player.cam.obstacles;
    player.colliders = r.colliders;
    player.heightAt = () => FLOOR_Y;
    // Indoors: raycast the spring-arm only against this room so the lens never slips outside.
    player.cam.obstacles = [r.group];
    player.cam.setIndoor(true);
    player.yaw = r.spawn.yaw ?? 0;
    player.teleport(r.spawn.x, r.spawn.z);
    player.pos.y = FLOOR_Y; player.smoothY = FLOOR_Y;
    cooldown = 0.6;                            // ignore portals briefly after arriving
    if (!wasInside) {
      savedAmb = env.amb.intensity; savedHemi = env.hemi.intensity;
      env.amb.intensity = 1.15; env.hemi.intensity = 0.6;
      scene.fog.density = 0.012; scene.fog.color = new Color(0x1a1230);
      scene.background = new Color(0x0a0710);
    }
    onEnter && onEnter(id);
  }

  // Remove+dispose the current room's geometry (used when switching rooms or leaving).
  function teardown() {
    if (!active) return;
    scene.remove(active.group);
    active.group.traverse(o => { if (o.isMesh) o.geometry?.dispose?.(); });
    active = null;
  }

  function exit() {
    if (!active) return;
    teardown();
    player.colliders = savedColliders || [];
    player.cam.obstacles = savedObstacles || [];
    player.cam.setIndoor(false);
    player.heightAt = terrainHeightAt;
    env.amb.intensity = savedAmb; env.hemi.intensity = savedHemi;
    env.setTime(env.time);                    // restores fog + sky for the current time of day
    const h = homeSpot || { x: 0, z: 26 };
    player.teleport(h.x, h.z);
    onExit && onExit();
  }

  // Walkable doorways: a portal fires only after the player has first stepped clear of it
  // (so spawning on a doorway never instantly re-triggers it).
  function checkPortals() {
    if (!active) return;
    for (const p of active.portals || []) {
      const d = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
      // Arm as soon as the player is clear — even during the entry cooldown — so walking
      // straight into a doorway after spawning (e.g. the exit, ~3.8m away) still triggers.
      // The cooldown only gates the actual fire, which is what stops an instant re-bounce.
      if (d > p.r + 1.2) p.armed = true;
      else if (p.armed && d < p.r && cooldown <= 0) { p.armed = false; if (p.to === 'out') exit(); else enter(p.to); return; }
    }
  }

  return {
    enter, exit,
    get active() { return active ? active.id : null; },
    update(dt) { t += dt; if (cooldown > 0) cooldown -= dt; if (active) { active.update(dt, t); checkPortals(); } },
  };
}

export { FLOOR_Y };
