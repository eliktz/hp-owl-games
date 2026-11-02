// Exterior scenery placed on the real terrain from the committed fan models
// (assets/models/, see MODELS-CREDITS.md). Loads with no flags. Fan models render far
// heavier than their face count, so after placing we measure the ACTUAL rendered triangle
// count from the spawn view and drop the lowest-priority extras until the scene is under
// the iPad budget (config.js) — a bloated scene would otherwise crash Safari. Scenery
// doesn't cast shadows (the extra depth pass is the biggest cost); it still receives them.
import { Group } from 'three';
import { loadModel, fitModel } from './models.js';
import { SPOTS, BUDGET } from './config.js';

const CAP = Math.round(BUDGET.maxTriangles * 0.95);   // headroom under the budget gate

// Load order = priority (placed first, trimmed last). Hagrid's hut and the owl are the
// readable landmarks; the Quidditch props fill leftover budget. Interiors use the Great
// Hall / Dumbledore's-office models separately (see interiors.js), not out here.
const PLACEMENT = {
  hut:       { x: SPOTS.hut.x, z: SPOTS.hut.z + 6, footprint: 12 },
  owl:       { x: SPOTS.gates.x + 3, z: SPOTS.gates.z - 2, height: 0.5, y: 2.4 },
  quidditch: { x: -42, z: -34, footprint: 6 },
};

async function loadSlot(slot, ctx) {
  const obj = await loadModel(slot);
  if (!obj) return null;
  obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  const g = new Group(); g.name = 'scenery-' + slot; g.add(obj);
  const p = PLACEMENT[slot];
  fitModel(g, { ...p, groundY: ctx.heightAt ? ctx.heightAt(p.x, p.z) : 0 });
  return g;
}

// Load exterior scenery aside, then (via enforce) add each into the scene greedily in
// priority order, keeping it only while the real rendered triangle count stays under the
// iPad budget. Heavy pieces that don't fit fall back to nothing — graceful degradation.
export async function loadScenery(ctx) {
  const pending = [];
  for (const slot of Object.keys(PLACEMENT)) {
    const g = await loadSlot(slot, ctx);
    if (g) pending.push({ slot, group: g });
  }
  if (pending.length) console.info('[scenery] loaded:', pending.map(p => p.slot).join(', '));

  const result = { loaded: [] };
  // `camera` must already be at the spawn view. We own info.reset() (autoReset off) so each
  // measurement is one frame's true multi-pass count; autoReset is restored afterwards.
  result.enforce = async (renderer, camera) => {
    const prevAuto = renderer.info.autoReset;
    renderer.info.autoReset = false;
    const measure = async () => { renderer.info.reset(); await renderer.renderAsync(ctx.scene, camera); return renderer.info.render.triangles; };
    try {
      for (const { slot, group } of pending) {
        ctx.scene.add(group);
        if (await measure() <= CAP) result.loaded.push(slot);
        else ctx.scene.remove(group);               // over budget → drop it
      }
      const finalTris = await measure();
      console.info('[scenery] within budget:', result.loaded.join(', ') || '(none fit)', '→', finalTris | 0, 'tris');
    } finally {
      renderer.info.autoReset = prevAuto;
    }
    return result.loaded;
  };
  return result;
}
