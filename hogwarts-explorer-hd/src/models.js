// Loader for the committed fan models in assets/models/ (optimised to Meshopt+WebP).
// These are PUBLIC now (see MODELS-CREDITS.md) and load with no special flags: a single
// shared GLTFLoader wired with the Meshopt decoder, plus a tiny cache so each file is
// fetched once and cloned per use. If a file is missing the game still runs — callers
// get null and fall back to the procedural look.
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const BASE = new URL('../assets/models/', import.meta.url).href;

let _manifest = null;
let _loader = null;
const _cache = new Map();   // name -> Promise<{scene, animations} | null>
let _renderer = null;

// main.js hands us the (already init()-ed) renderer so KTX2 textures can pick the best GPU
// format per backend (ASTC/ETC2/BC, or plain RGBA). Call before the first loadModel.
export function setRenderer(r) { _renderer = r; }

async function manifest() {
  if (_manifest) return _manifest;
  try {
    const r = await fetch(BASE + 'models.json', { cache: 'force-cache' });
    _manifest = r.ok ? await r.json() : { models: {} };
  } catch { _manifest = { models: {} }; }
  return _manifest;
}

function loader() {
  if (!_loader) {
    _loader = new GLTFLoader(); _loader.setMeshoptDecoder(MeshoptDecoder);
    // KTX2 (KHR_texture_basisu) for the film-look characters. If anything here fails the
    // loader still works for the Meshopt+WebP models; a KTX2 model then fails -> null -> fallback.
    if (_renderer) {
      try {
        const ktx2 = new KTX2Loader().setTranscoderPath(new URL('../lib/addons/libs/basis/', import.meta.url).href);
        ktx2.detectSupport(_renderer);
        _loader.setKTX2Loader(ktx2);
      } catch (e) { console.warn('[models] KTX2 unavailable -', e.message); }
    }
  }
  return _loader;
}

// Resolve the manifest entry for a model name (owl, ron, ...), or null.
export async function modelInfo(name) {
  const m = await manifest();
  return m.models?.[name] || null;
}

// List of all available model names.
export async function modelNames() {
  const m = await manifest();
  return Object.keys(m.models || {});
}

// Load a model's scene once (cached). Returns the shared source scene or null.
async function loadSource(name) {
  if (_cache.has(name)) return _cache.get(name);
  const p = (async () => {
    const info = await modelInfo(name);
    if (!info?.file) return null;
    try {
      const gltf = await loader().loadAsync(BASE + info.file);
      gltf.scene.updateMatrixWorld(true);
      return { scene: gltf.scene, animations: gltf.animations || [] };
    } catch (e) {
      console.warn('[models] failed:', name, '-', e.message);
      return null;
    }
  })();
  _cache.set(name, p);
  return p;
}

// Load a ready-to-place CLONE of a model (safe to transform independently). Clones
// skinned meshes correctly even though our current models are static. Null on miss.
export async function loadModel(name) {
  const src = await loadSource(name);
  if (!src) return null;
  return cloneSkeleton(src.scene);
}

// Like loadModel but also hands back the animation clips (shared, read-only) for an
// AnimationMixer. The clone SHARES geometry + materials with the cache: never dispose them.
export async function loadAnimated(name) {
  const src = await loadSource(name);
  if (!src) return null;
  return { obj: cloneSkeleton(src.scene), clips: src.animations };
}

// Uniformly scale an object to a target `height` (metres) OR `footprint` (max XZ span),
// then plant its base at (x, groundY, z). `y` lifts it extra (e.g. a perched owl);
// `faceSouth` turns it to face an arriving player (+Z). Mutates and returns obj.
export function fitModel(obj, { x = 0, z = 0, height, footprint, y = 0, faceSouth, groundY = 0 } = {}) {
  // Recompute bounds and disable frustum culling so a stale/merged bounding sphere can
  // never leave the mesh half-rendered or popped out at the edge of the view.
  obj.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.geometry?.computeBoundingSphere?.(); } });
  const box = new Box3().setFromObject(obj);
  const size = new Vector3(); box.getSize(size);
  const center = new Vector3(); box.getCenter(center);
  if (size.x && size.y && size.z) {
    const s = footprint ? footprint / Math.max(size.x, size.z) : height / size.y;
    obj.scale.multiplyScalar(s);
    box.setFromObject(obj); box.getSize(size); box.getCenter(center);
  }
  obj.position.x += x - center.x;
  obj.position.z += z - center.z;
  obj.position.y += groundY + y - box.min.y;
  if (faceSouth) obj.rotation.y = Math.PI;
  return obj;
}

export { BASE as MODELS_BASE };
