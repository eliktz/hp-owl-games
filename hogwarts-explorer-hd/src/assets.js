// Asset loading with graceful fallback. Committed CC0 textures/HDRIs live in ./assets/;
// the fan glTF models live in ./assets/models/ and are loaded via models.js. Any missing
// file silently falls back to the procedural look.
import { RepeatWrapping, SRGBColorSpace } from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { TextureLoader } from 'three';

const BASE = new URL('../assets/', import.meta.url).href;

// Manifest of committed CC0 files. Consulted before any fetch so missing assets
// never spam 404s in the console — we just fall back to the procedural look.
let _manifest = null;
async function manifest() {
  if (_manifest) return _manifest;
  try {
    // 'no-cache' = always revalidate; 'force-cache' kept returning players on a stale manifest.
    const r = await fetch(BASE + 'manifest.json', { cache: 'no-cache' });
    _manifest = r.ok ? await r.json() : { textures: [], hdri: [] };
  } catch { _manifest = { textures: [], hdri: [] }; }
  return _manifest;
}

// The asset manifest (textures, hdri, film): lets other modules skip files that are not there.
export async function assetManifest() { return manifest(); }

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

export { BASE as ASSET_BASE };
