// Interiors manager: streams one room in at a time (built on enter, disposed on leave — so
// only one room's geometry is ever resident, keeping iPad memory low). Rooms are built by
// rooms.js from textured primitives; this file wires them to the player/camera/lighting and
// drives the walkable doorway "portals" (stroll room->room, or back out to the grounds).
import { Color } from 'three';
import { ensureTex } from './interior-kit.js';
import { filmInterior } from './materials.js';
import { BUILDERS, FLOOR_Y } from './rooms.js';

export function createInteriors({ scene, env, player, terrainHeightAt, homeSpot, onEnter, onExit }) {
  let active = null, t = 0, cooldown = 0, inside = false;
  // Generation token: every enter()/exit() bumps it, so an older enter() still awaiting its
  // textures/build sees it is stale and disposes the room it built instead of adding it.
  let gen = 0;
  let savedAmb = 0, savedHemi = 0, savedColliders = null, savedObstacles = null;
  let savedAmbC = 0xffffff, savedHemiC = 0xbcd2ec, savedHemiG = 0x56503f;

  async function enter(id) {
    const build = BUILDERS[id]; if (!build) return;
    const my = ++gen;
    const tex = await ensureTex();            // load stone/wood maps so rooms aren't flat grey
    if (my !== gen) return;                   // superseded before we built anything
    const r = await build();
    if (my !== gen) { disposeRoom(r); return; } // a newer enter()/exit() won: drop this room
    // Film stone: honey ashlar walls + flagstone floors, swapped in before the first frame.
    try { await filmInterior(r.group, tex?.wall); } catch (e) { console.warn('[interiors] film stone skipped -', e && e.message || e); }
    if (my !== gen) { disposeRoom(r); return; }
    if (active) teardown();
    active = r; active.id = id;
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
    if (!inside) {
      inside = true;
      env.setIndoor?.(true);                  // the time button must not repaint the room
      savedAmb = env.amb.intensity; savedHemi = env.hemi.intensity;
      // candle-lit, not floodlit: a lower warm ambient so the baked flame pools + washes read
      savedAmbC = env.amb.color.getHex(); savedHemiC = env.hemi.color.getHex(); savedHemiG = env.hemi.groundColor.getHex();
      env.amb.intensity = 0.78; env.amb.color.setHex(0xffe6cc);
      env.hemi.intensity = 0.62; env.hemi.color.setHex(0x9a90c8); env.hemi.groundColor.setHex(0x4a3628);
      scene.fog.density = 0.012; scene.fog.color = new Color(0x1a1230);
      scene.background = new Color(0x0a0710);
    }
    onEnter && onEnter(id);
  }

  // Dispose one room's geometry. Guarded: the WebGPU backend throws ("Invalid unregisterToken")
  // when a geometry's attributes were never GPU-registered, which must never break walking out.
  // Animated GLB figures stop their mixers first; their geometry is shared with the models.js
  // cache (userData.sharedGeo) and must survive for the next visit.
  function disposeRoom(room) {
    if (!room || !room.group) return;
    if (room.group.parent) room.group.parent.remove(room.group);
    room.group.traverse(o => { if (o.userData.onTeardown) { try { o.userData.onTeardown(); } catch { /* keep going */ } } });
    room.group.traverse(o => { if (o.isMesh && !o.userData.sharedGeo) { try { o.geometry?.dispose?.(); } catch { /* backend quirk */ } } });
  }

  // Remove+dispose the current room (used when switching rooms or leaving).
  function teardown() {
    if (!active) return;
    disposeRoom(active);
    active = null;
  }

  function exit() {
    gen++;                                    // cancels any enter() still loading
    if (!active) return;
    teardown();
    inside = false;
    player.colliders = savedColliders || [];
    player.cam.obstacles = savedObstacles || [];
    player.cam.setIndoor(false);
    player.heightAt = terrainHeightAt;
    env.amb.intensity = savedAmb; env.hemi.intensity = savedHemi;
    env.amb.color.setHex(savedAmbC); env.hemi.color.setHex(savedHemiC); env.hemi.groundColor.setHex(savedHemiG);
    env.setIndoor?.(false);
    env.setTime(env.time);                    // restores fog + sky + exposure for the current time of day
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
    get room() { return active; },
    update(dt) { t += dt; if (cooldown > 0) cooldown -= dt; if (active) { active.update(dt, t); checkPortals(); } },
  };
}

export { FLOOR_Y };
