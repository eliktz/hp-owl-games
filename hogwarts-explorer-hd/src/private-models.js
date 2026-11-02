// OPTIONAL private fan models (Sketchfab) — see tools/sketchfab-fetch.mjs & DESIGN.md.
// If private-assets/index.json + the model files exist locally they are loaded and
// placed in the world; otherwise EVERYTHING here is a silent no-op and the game keeps
// its committed CC0 / procedural look. These assets are gitignored and never required.
import { Box3, Vector3, Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SPOTS } from './config.js';

const PRIV = new URL('../private-assets/', import.meta.url).href;

// Where each slot sits in the world + the target footprint/height to auto-fit to.
// upright models (characters/owl) scale by height; buildings scale by footprint.
const PLACEMENT = {
  castle:       { x: 0,  z: -16, height: 46, swapProcedural: true, faceSouth: true },
  'great-hall': { x: 10, z: 6,   height: 12 },
  owl:          { x: SPOTS.gates.x + 3, z: SPOTS.gates.z - 2, height: 0.5, y: 2.4 },
  harry:        { x: -15, z: 4,  height: 1.6, faceSouth: true },
  hermione:     { x: -13, z: 5,  height: 1.65, faceSouth: true },
  ron:          { x: -17, z: 5,  height: 1.7, faceSouth: true },
  hagrid:       { x: SPOTS.hut.x - 4, z: SPOTS.hut.z, height: 2.6, faceSouth: true },
  hut:          { x: SPOTS.hut.x, z: SPOTS.hut.z + 6, footprint: 9 },
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
    const s = p.footprint
      ? p.footprint / Math.max(size.x, size.z)
      : p.height / size.y;
    obj.scale.setScalar(s);
    box.setFromObject(obj); box.getSize(size); box.getCenter(center);
  }
  // feet/base on the ground, centred over (x,z); optional lift for a perched owl.
  obj.position.x += p.x - center.x;
  obj.position.z += p.z - center.z;
  obj.position.y += (p.y || 0) - box.min.y;
  if (p.faceSouth) obj.rotation.y = Math.PI;        // face the arriving player (+Z)
}

// Attempt one slot; returns the added Group or null. Never throws.
async function loadSlot(loader, slot, info, ctx) {
  const p = PLACEMENT[slot]; if (!p || !info?.file) return null;
  try {
    const gltf = await loader.loadAsync(PRIV + info.file);
    const g = new Group(); g.name = 'private-' + slot; g.add(gltf.scene);
    gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    fit(g, p);
    ctx.scene.add(g);
    // If a real castle loaded, retire the procedural silhouette (keep its colliders).
    if (p.swapProcedural && slot === 'castle' && ctx.castleGroup) ctx.castleGroup.visible = false;
    console.info('[private] placed', slot);
    return g;
  } catch (e) {
    console.warn('[private] skipped', slot, '-', e.message);
    return null;
  }
}

// Public entry: load whatever private models exist. No-op when the folder is empty.
export async function loadPrivateModels(ctx) {
  const m = await manifest();
  if (!m || !m.slots) return { loaded: [] };
  const loader = new GLTFLoader();
  const loaded = [];
  for (const [slot, info] of Object.entries(m.slots)) {
    const g = await loadSlot(loader, slot, info, ctx);
    if (g) loaded.push(slot);
  }
  if (loaded.length) console.info('[private] loaded models:', loaded.join(', '));
  return { loaded };
}
