// Exterior scenery placed on the real terrain from the committed fan models
// (assets/models/, see MODELS-CREDITS.md). Loads with no flags. These fan models are dense
// (Hagrid's hut alone is a triangle soup that won't decimate), so we AREA-STREAM them: each
// piece is only shown while the player is within its radius. Since the landmarks sit far
// apart, at most one heavy model renders at a time, keeping the scene under the iPad
// triangle budget from every viewpoint. Scenery doesn't cast shadows (the depth pass is the
// biggest cost); it still receives them.
import { Group } from 'three';
import { loadModel, fitModel } from './models.js';
import { SPOTS } from './config.js';

// radius = how close you must be for the piece to stream in.
const PLACEMENT = {
  hut:       { x: SPOTS.hut.x, z: SPOTS.hut.z + 6, footprint: 12, radius: 75 },
  quidditch: { x: -42, z: -34, footprint: 6, radius: 70 },
};

async function loadSlot(slot, ctx) {
  const obj = await loadModel(slot);
  if (!obj) return null;
  obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  const g = new Group(); g.name = 'scenery-' + slot; g.visible = false;
  g.add(obj);
  const p = PLACEMENT[slot];
  fitModel(g, { ...p, groundY: ctx.heightAt ? ctx.heightAt(p.x, p.z) : 0 });
  ctx.scene.add(g);
  return { slot, group: g, p };
}

// Load all scenery (hidden), then stream by distance each frame via update(playerPos).
export async function loadScenery(ctx) {
  const pieces = [];
  for (const slot of Object.keys(PLACEMENT)) {
    const s = await loadSlot(slot, ctx);
    if (s) pieces.push(s);
  }
  if (pieces.length) console.info('[scenery] streaming:', pieces.map(p => p.slot).join(', '));
  return {
    pieces,
    update(playerPos) {
      if (!playerPos) return;
      for (const { group, p } of pieces) {
        group.visible = Math.hypot(playerPos.x - p.x, playerPos.z - p.z) < p.radius;
      }
    },
  };
}
