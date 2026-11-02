// Asset loading with graceful fallback. Real CC0 files live in ./assets/ (committed).
// Optional non-CC0 fan models live in ./private-assets/ (gitignored) and are loaded
// only if present; any failure silently falls back to the CC0 / procedural look.
import { RepeatWrapping, SRGBColorSpace } from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextureLoader } from 'three';

const BASE = new URL('../assets/', import.meta.url).href;
const PRIV = new URL('../private-assets/', import.meta.url).href;

function exists(url) {
  // HEAD check; resolves false on any network/404 error (so fallback kicks in).
  return fetch(url, { method: 'GET', cache: 'force-cache' })
    .then(r => (r.ok ? r : Promise.reject(new Error('missing'))))
    .catch(() => null);
}

// Load an equirectangular HDRI; returns a three Texture (equirect) or null.
export async function loadHDRI(file) {
  const url = BASE + 'hdri/' + file;
  if (!(await exists(url))) return null;
  try {
    const tex = await new RGBELoader().loadAsync(url);
    return tex;
  } catch (e) {
    console.warn('[assets] HDRI failed, using procedural sky:', file);
    return null;
  }
}

// Load a committed PBR colour map, or null -> caller uses procedural texture.
export async function loadTexture(file, { srgb = true, repeat = 1 } = {}) {
  const url = BASE + 'textures/' + file;
  if (!(await exists(url))) return null;
  try {
    const t = await new TextureLoader().loadAsync(url);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(repeat, repeat);
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  } catch (e) { return null; }
}

// Optionally load a private fan-made glTF. Returns the loaded scene or null.
// NEVER required: the castle & grounds render fully without it.
export async function loadPrivateModel(file) {
  const url = PRIV + file;
  if (!(await exists(url))) return null;
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    console.info('[assets] loaded private model:', file);
    return gltf.scene;
  } catch (e) {
    console.warn('[assets] private model failed, ignoring:', file);
    return null;
  }
}

export { BASE as ASSET_BASE, PRIV as PRIVATE_BASE };
