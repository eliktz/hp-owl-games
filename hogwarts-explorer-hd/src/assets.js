// Asset loading with graceful fallback. Real CC0 files live in ./assets/ (committed).
// Optional non-CC0 fan models live in ./private-assets/ (gitignored) and are loaded
// only if present; any failure silently falls back to the CC0 / procedural look.
import { RepeatWrapping, SRGBColorSpace } from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextureLoader } from 'three';

const BASE = new URL('../assets/', import.meta.url).href;
const PRIV = new URL('../private-assets/', import.meta.url).href;

// Manifest of committed CC0 files. Consulted before any fetch so missing assets
// never spam 404s in the console — we just fall back to the procedural look.
let _manifest = null;
async function manifest() {
  if (_manifest) return _manifest;
  try {
    const r = await fetch(BASE + 'manifest.json', { cache: 'force-cache' });
    _manifest = r.ok ? await r.json() : { textures: [], hdri: [] };
  } catch { _manifest = { textures: [], hdri: [] }; }
  return _manifest;
}

// Load an equirectangular HDRI; returns a three Texture (equirect) or null.
export async function loadHDRI(file) {
  const m = await manifest();
  if (!m.hdri.includes(file)) return null;
  const url = BASE + 'hdri/' + file;
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
  const m = await manifest();
  if (!m.textures.includes(file)) return null;
  const url = BASE + 'textures/' + file;
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
  // probe quietly first; a miss is expected (private-assets is gitignored & optional)
  try { const r = await fetch(url, { method: 'GET' }); if (!r.ok) return null; } catch { return null; }
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
