// Loader for the committed fan models in assets/models/ (optimised to Meshopt+WebP).
// These are PUBLIC now (see MODELS-CREDITS.md) and load with no special flags: a single
// shared GLTFLoader wired with the Meshopt decoder, plus a tiny cache so each file is
// fetched once and cloned per use. If a file is missing the game still runs — callers
// get null and fall back to the procedural look.
import { Box3, Vector3, TextureLoader, SRGBColorSpace, NoColorSpace } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const BASE = new URL('../assets/models/', import.meta.url).href;

let _manifest = null;
let _loader = null;
const _cache = new Map();   // name -> Promise<{scene, animations} | null>
let _renderer = null;
let _ktx2 = null;                // the KTX2Loader wired into the GLTFLoader (shared with loadTexture)
const _texCache = new Map();     // texture url stem -> Promise<Texture | null>
// Why each requested model did or did not load: name -> 'ok' | reason. Shown by ?debug=1
// (window.__game.models()) so a silent fallback to the code-drawn look can be diagnosed
// on a phone without a console.
const _status = new Map();
const LOAD_TIMEOUT_MS = 15000;
// GLTFLoader swallows a texture that fails to decode (e.g. no KTX2 transcoder) and hands
// back an untextured model. Treat that as a failed load so the fallback file is tried.
function assertTextured(gltf) {
  const want = new Set((gltf.parser?.json?.materials || []).filter(m => m.pbrMetallicRoughness?.baseColorTexture).map(m => m.name));
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) if (want.has(m.name) && !m.map) throw new Error('texture failed to decode (' + m.name + ')');
  });
}
function withTimeout(p, ms, msg) {
  let t; const guard = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(msg)), ms); });
  return Promise.race([p, guard]).finally(() => clearTimeout(t));
}
export function modelStatus() { return Object.fromEntries(_status); }

// main.js hands us the (already init()-ed) renderer so KTX2 textures can pick the best GPU
// format per backend (ASTC/ETC2/BC, or plain RGBA). Call before the first loadModel.
export function setRenderer(r) { _renderer = r; }

async function manifest() {
  if (_manifest) return _manifest;
  try {
    // 'no-cache' = always revalidate (a cheap 304). The old 'force-cache' made returning
    // players keep a stale manifest forever, so newly published models never appeared.
    const r = await fetch(BASE + 'models.json', { cache: 'no-cache' });
    _manifest = r.ok ? await r.json() : { models: {} };
    if (!r.ok) console.warn('[models] models.json HTTP', r.status);
  } catch (e) { console.warn('[models] models.json failed -', e.message); _manifest = { models: {} }; }
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
        _loader.setKTX2Loader(ktx2); _ktx2 = ktx2;
        _status.set('ktx2', 'ok');
      } catch (e) { _status.set('ktx2', 'unavailable: ' + e.message); console.warn('[models] KTX2 unavailable -', e.message); }
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
    if (!info?.file) {
      _status.set(name, 'not in models.json');
      console.warn('[models] not in models.json:', name, '- using the fallback look');
      return null;
    }
    // Try the main file (KTX2 textures), then the optional `fallback` file (same model with a
    // plain WebP texture, the format the other fan models already use). A KTX2 file can fail
    // on some devices (transcoder/worker/GPU format) or simply never settle, hence the timeout.
    const v = info.v || (await manifest()).v;
    const q = v ? '?v=' + encodeURIComponent(v) : '';
    loader();                                   // make sure the KTX2 probe has run
    const tries = [info.file];
    if (info.fallback) { if (_status.get('ktx2') === 'ok') tries.push(info.fallback); else tries[0] = info.fallback; }
    const why = [];
    for (const file of tries) {
      try {
        const gltf = await withTimeout(loader().loadAsync(BASE + file + q), LOAD_TIMEOUT_MS, 'timed out after ' + LOAD_TIMEOUT_MS / 1000 + ' s');
        assertTextured(gltf);
        gltf.scene.updateMatrixWorld(true);
        _status.set(name, why.length ? 'ok via ' + file + ' (' + why.join('; ') + ')' : 'ok');
        if (why.length) console.warn('[models]', name, 'loaded via fallback', file, '-', why.join('; '));
        return { scene: gltf.scene, animations: gltf.animations || [] };
      } catch (e) {
        why.push(file + ': ' + String(e && e.message || e));
        console.warn('[models] failed:', name, file, '-', String(e && e.message || e));
      }
    }
    _status.set(name, 'failed: ' + why.join('; '));
    return null;
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
// `alive` (optional): checked after the load; if it says no, skip the skeleton clone.
export async function loadAnimated(name, alive) {
  const src = await loadSource(name);
  if (!src || (alive && !alive())) return null;
  return { obj: cloneSkeleton(src.scene), clips: src.animations };
}

// Load a stand-alone colour texture (e.g. a student's house/hair atlas) once, cached by its
// path stem: `stem` is relative to assets/ without the extension. Same rule as the GLB
// fallback: the .ktx2 through the game's KTX2 loader when it is available, else (or when it
// fails or never settles) the .webp. Set up for glTF UVs (flipY false, sRGB). Null on failure.
// `preferWebp` skips the KTX2 try (e.g. the model itself already had to fall back to WebP).
// `linear` is for data maps (normal maps): no sRGB decode, and its own cache entry.
export function loadTexture(stem, { preferWebp = false, linear = false } = {}) {
  const key = stem + (preferWebp ? '#webp' : '') + (linear ? '#lin' : '');
  if (_texCache.has(key)) return _texCache.get(key);
  const p = (async () => {
    const v = (await manifest()).v, q = v ? '?v=' + encodeURIComponent(v) : '';
    const url = new URL('../assets/' + stem, import.meta.url).href;
    loader();                                   // make sure the KTX2 probe has run
    const why = [];
    const tries = [];
    if (_ktx2 && _status.get('ktx2') === 'ok' && !preferWebp) tries.push(() => _ktx2.loadAsync(url + '.ktx2' + q));
    tries.push(() => new TextureLoader().loadAsync(url + '.webp' + q));
    for (const t of tries) {
      try {
        const tex = await withTimeout(t(), LOAD_TIMEOUT_MS, 'timed out after ' + LOAD_TIMEOUT_MS / 1000 + ' s');
        tex.flipY = false; tex.colorSpace = linear ? NoColorSpace : SRGBColorSpace; tex.needsUpdate = true;
        if (why.length) { _status.set('tex:' + stem, 'ok via webp (' + why.join('; ') + ')'); console.warn('[models] texture', stem, 'via WebP -', why.join('; ')); }
        return tex;
      } catch (e) { why.push(String(e && e.message || e)); }
    }
    _status.set('tex:' + stem, 'failed: ' + why.join('; '));
    console.warn('[models] texture failed:', stem, '-', why.join('; '));
    _texCache.delete(key);                      // a transient failure: let the next room entry try again
    return null;
  })();
  _texCache.set(key, p);
  return p;
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
