// Shared PBR materials. Real CC0 maps (if fetched) are injected by main.js via
// setMaps(); otherwise these start from procedural canvas textures. Albedo stays
// <= 0.84 so only emissive window-glow blooms.
//
// Film stone (art-direction-film.md, integration step 8): 1K Poly Haven colour + GL normal
// maps, KTX2 (ETC1S colour, UASTC normal) with a WebP fallback, listed under "film" in
// assets/manifest.json:
//   wall   castle_wall_slates  exterior castle stone + interior floors (grey coursed rubble)
//   slate  roof_slates_03      spires and roofs (ridge row cropped so it tiles)
//   ashlar sandstone_blocks_05 interior walls, columns, ceilings (the warm honey ashlar)
// Each map is ONE texture object shared by every user (the node renderer uploads one GPU
// texture per Texture object, so no per-surface clones): the castle tiles it through
// world-scaled UVs (castle.js) and interiors through a per-material UV scale node.
import { MeshStandardMaterial, MeshStandardNodeMaterial, Color, RepeatWrapping, Vector2, Vector3 } from 'three';
import { texture, uv, vec2, normalMap, materialColor } from 'three/tsl';
import { stoneTexture, slateTexture, woodTexture } from './textures.js';
import { loadTexture as loadKtx2OrWebp } from './models.js';
import { assetManifest } from './assets.js';

// Metres of surface one film-texture tile covers (castle.js world-scaled UVs use these).
export const FILM_TILE = { wall: 6.0, slate: 5.0 };
// The maps are stored flipY=false (KTX2 cannot be flipped), so the GL normal's green axis
// points down the image: negative Y scale puts the relief the right way up.
const NRM = (k) => new Vector2(k, -k);

let _film = null;
// Load the film colour + normal maps once (KTX2 when the transcoder works, else WebP).
// Resolves to { wall, slate, ashlar } of { col, nor } (any entry may be null) or null.
export function loadFilmMaps() {
  if (_film) return _film;
  _film = (async () => {
    const m = await assetManifest();
    const have = new Set(m.film || []);
    const one = async (stem) => {
      if (!have.has(stem)) return null;
      const [col, nor] = await Promise.all([
        loadKtx2OrWebp('textures/film/' + stem + '_col'),
        loadKtx2OrWebp('textures/film/' + stem + '_nor', { linear: true }),
      ]);
      for (const t of [col, nor]) if (t) { t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true; }
      return col ? { col, nor } : null;
    };
    const [wall, slate, ashlar] = await Promise.all(['castle_wall_slates', 'roof_slates', 'sandstone_blocks'].map(one));
    return wall || slate || ashlar ? { wall, slate, ashlar } : null;
  })().catch(() => null);
  return _film;
}

export function makeMaterials(maps = {}) {
  const film = maps.film || {};
  // Exterior stone: weathered grey-honey rubble. The colour lifts the AO-darkened map back to
  // the pale, warm castle of castle_lake_after.png (mean albedo ~0.45, well under 0.84).
  const stone = film.wall ? new MeshStandardMaterial({
    map: film.wall.col, normalMap: film.wall.nor || null, normalScale: NRM(1.0),
    color: 0xf4ead8, roughness: 0.9, metalness: 0.0,
  }) : new MeshStandardMaterial({
    map: maps.stone || stoneTexture(1, '#6d6a63'),
    color: 0xb9b4a8, roughness: 0.92, metalness: 0.0,
  });
  // Slate: dark blue-grey film roofs (#4a5266 family), a touch of sheen.
  const slate = film.slate ? new MeshStandardMaterial({
    map: film.slate.col, normalMap: film.slate.nor || null, normalScale: NRM(1.1),
    color: 0x6a7590, roughness: 0.76, metalness: 0.0,
  }) : new MeshStandardMaterial({
    map: maps.slate || slateTexture(1),
    color: 0x5a6476, roughness: 0.7, metalness: 0.05,
  });
  // castle.js reads the tile size to lay metric UVs (film maps only).
  if (film.wall) stone.userData.tile = FILM_TILE.wall;
  if (film.slate) slate.userData.tile = FILM_TILE.slate;
  const wood = new MeshStandardMaterial({
    map: maps.wood || woodTexture(1),
    color: 0x7a5636, roughness: 0.85, metalness: 0.0,
  });
  // Warm window glow — emissive so it (and only it) passes the bloom threshold.
  const window = new MeshStandardMaterial({
    color: 0x1a1406, emissive: new Color(0xffcf7a), emissiveIntensity: 1.6,
    roughness: 0.4, metalness: 0.0,
  });
  return { stone, slate, wood, window };
}

// ---- Interiors: swap the kit's castle-wall stone for the film maps ----
// The interior kit tiles the castle-wall jpg onto every wall, floor and ceiling. Right after a
// room is built (before its first frame, so the old tiles never reach the GPU) this swaps each
// such material for a node material on the shared film maps, keeping the room's colour,
// roughness and tiling: walls, columns and ceilings become honey ashlar, floors grey flagstone.
// The swap is cached per (source material, surface kind), so revisits allocate nothing.
const _swap = new Map();
// Warm honey grade on top of each room's own stone colour (rooms tune brightness with it).
// The room colour is first pulled 45% toward its own grey, so a strongly orange wallColor
// (the Great Hall's 0xb88c60) reads as candle-lit sandstone rather than red brick; the tint
// then lifts it to honey (max albedo stays well under 0.84).
const ASHLAR_TINT = new Color(1.22, 1.08, 0.86), ASHLAR_KEEP = 0.55;
const FLOOR_TINT = new Color(0.78, 0.76, 0.74);
const _n = new Vector3();
function surfaceKind(o) {
  if (o.geometry?.type !== 'PlaneGeometry') return 'wall';
  _n.set(0, 0, 1).applyQuaternion(o.quaternion);
  return _n.y > 0.7 ? 'floor' : _n.y < -0.7 ? 'ceil' : 'wall';
}
function filmMaterial(src, kind, film) {
  const key = src.uuid + '|' + kind;
  let m = _swap.get(key);
  if (m) return m;
  const set = kind === 'floor' ? (film.wall || film.ashlar) : (film.ashlar || film.wall);
  const rep = src.map.repeat, off = src.map.offset;
  // Floors: the rubble map at 0.6x the old tiling reads as big hall flagstones.
  const s = kind === 'floor' ? 0.6 : 1.0;
  const st = uv().mul(vec2(rep.x * s, rep.y * s)).add(vec2(off.x, off.y));
  m = new MeshStandardNodeMaterial();
  for (const k of ['roughness', 'metalness', 'side', 'transparent', 'opacity', 'depthWrite', 'envMapIntensity', 'emissiveIntensity', 'fog', 'flatShading'])
    if (src[k] !== undefined) m[k] = src[k];
  if (src.emissive) m.emissive.copy(src.emissive);
  m.color.copy(src.color);
  if (kind !== 'floor') { const c = m.color, y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; c.setRGB(y + (c.r - y) * ASHLAR_KEEP, y + (c.g - y) * ASHLAR_KEEP, y + (c.b - y) * ASHLAR_KEEP); }
  m.color.multiply(kind === 'floor' ? FLOOR_TINT : ASHLAR_TINT);
  m.colorNode = texture(set.col, st).mul(materialColor);
  if (set.nor) m.normalNode = normalMap(texture(set.nor, st), vec2(kind === 'floor' ? 0.7 : 0.95, kind === 'floor' ? -0.7 : -0.95));
  m.name = (src.name || 'kit-stone') + '-film-' + kind;
  m.userData.film = true;
  _swap.set(key, m);
  return m;
}
// group: the freshly built room; kitWall: the kit's castle-wall texture (ensureTex().wall).
export async function filmInterior(group, kitWall) {
  if (!kitWall?.source) return 0;
  const film = await loadFilmMaps();
  if (!film || !(film.ashlar || film.wall)) return 0;
  let n = 0;
  group.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const mat = o.material;
    if (!mat || mat.userData?.film || mat.map?.source !== kitWall.source) return;
    o.material = filmMaterial(mat, surfaceKind(o), film); n++;
  });
  return n;
}
export const filmStats = () => ({ swapped: _swap.size });
