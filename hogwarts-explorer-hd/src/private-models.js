// OPTIONAL private fan models (Sketchfab) — see tools/sketchfab-fetch.mjs & DESIGN.md.
// If private-assets/index.json + the model files exist locally they are loaded and
// placed in the world; otherwise EVERYTHING here is a silent no-op and the game keeps
// its committed CC0 / procedural look. These assets are gitignored and never required.
//
// Fan models render far heavier than their listed faceCount (instancing, dense meshes),
// so after loading we measure the ACTUAL rendered triangle count from the spawn view and
// trim the lowest-priority models until the scene is under the iPad budget (config.js) —
// a bloated scene would otherwise crash Safari. Private models don't cast shadows (the
// extra depth pass is the single biggest cost); they still receive the world's shadows.
import { Box3, Vector3, Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SPOTS, BUDGET } from './config.js';

const PRIV = new URL('../private-assets/', import.meta.url).href;
const CAP = Math.round(BUDGET.maxTriangles * 0.95);   // leave headroom under the gate

// Load order = priority: the core set (castle exterior, owl, characters) is placed
// first and trimmed last; scenery extras fill any leftover budget. Fit by height
// (upright figures) or footprint (buildings); y lifts a perched owl off the ground.
const PLACEMENT = {
  castle:       { x: 0,  z: -16, height: 46, swapProcedural: true, faceSouth: true },
  owl:          { x: SPOTS.gates.x + 3, z: SPOTS.gates.z - 2, height: 0.5, y: 2.4 },
  harry:        { x: -15, z: 4,  height: 1.6,  faceSouth: true },
  hermione:     { x: -13, z: 5,  height: 1.65, faceSouth: true },
  ron:          { x: -17, z: 5,  height: 1.7,  faceSouth: true },
  hagrid:       { x: SPOTS.hut.x - 4, z: SPOTS.hut.z, height: 2.6, faceSouth: true },
  hut:          { x: SPOTS.hut.x, z: SPOTS.hut.z + 6, footprint: 9 },
  'great-hall': { x: 10, z: 6,  height: 12 },
  quidditch:    { x: -42, z: -34, footprint: 6 },
};

async function manifest() {
  try {
    const r = await fetch(PRIV + 'index.json', { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// Uniformly scale + ground + position a loaded scene by its bounding box.
function fit(obj, p) {
  const box = new Box3().setFromObject(obj);
  const size = new Vector3(); box.getSize(size);
  const center = new Vector3(); box.getCenter(center);
  if (size.x && size.y && size.z) {
    const s = p.footprint ? p.footprint / Math.max(size.x, size.z) : p.height / size.y;
    obj.scale.setScalar(s);
    box.setFromObject(obj); box.getSize(size); box.getCenter(center);
  }
  obj.position.x += p.x - center.x;              // centre over the world spot
  obj.position.z += p.z - center.z;
  obj.position.y += (p.y || 0) - box.min.y;      // base on the ground (owl lifts via y)
  if (p.faceSouth) obj.rotation.y = Math.PI;     // face the arriving player (+Z)
}

async function loadSlot(loader, slot, info) {
  try {
    const gltf = await loader.loadAsync(PRIV + info.file);
    const g = new Group(); g.name = 'private-' + slot; g.add(gltf.scene);
    gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    fit(g, PLACEMENT[slot]);
    return g;
  } catch (e) {
    console.warn('[private] skipped', slot, '-', e.message);
    return null;
  }
}

// Public entry: load every present private model aside, then (via enforce) add them
// into the scene greedily in priority order, keeping each only while the real rendered
// triangle count from the spawn view stays under the iPad budget. No-op when the folder
// is empty. Heavy models (e.g. a dense fan castle) simply don't fit and fall back to the
// procedural look — exactly the per-model graceful degradation we want.
export async function loadPrivateModels(ctx) {
  const m = await manifest();
  if (!m || !m.slots) return { loaded: [] };
  const loader = new GLTFLoader();
  const pending = [];
  for (const slot of Object.keys(PLACEMENT)) {
    const info = m.slots[slot];
    if (!info?.file) continue;
    const g = await loadSlot(loader, slot, info);
    if (g) pending.push({ slot, group: g });
  }
  if (pending.length) console.info('[private] available:', pending.map(p => p.slot).join(', '));

  const result = { loaded: [] };
  // `camera` must already be at the spawn view. We own info.reset() (autoReset off) so
  // each measurement is one frame's true multi-pass count; autoReset is restored after.
  result.enforce = async (renderer, camera) => {
    const prevAuto = renderer.info.autoReset;
    renderer.info.autoReset = false;
    const measure = async () => { renderer.info.reset(); await renderer.renderAsync(ctx.scene, camera); return renderer.info.render.triangles; };
    try {
      for (const { slot, group } of pending) {
        const swap = PLACEMENT[slot].swapProcedural && slot === 'castle' && ctx.castleGroup;
        if (swap) ctx.castleGroup.visible = false;      // try the real castle in its place
        ctx.scene.add(group);
        if (await measure() <= CAP) {
          result.loaded.push(slot);
        } else {
          ctx.scene.remove(group);                       // over budget → fall back
          if (swap) ctx.castleGroup.visible = true;
        }
      }
      const finalTris = await measure();   // re-render the settled scene for an honest count
      console.info('[private] within budget:', result.loaded.join(', ') || '(none fit)', '→', finalTris | 0, 'tris');
    } finally {
      renderer.info.autoReset = prevAuto;
    }
    return result.loaded;
  };
  return result;
}
