// Shared PBR materials. Real CC0 maps (if fetched) are injected by main.js via
// setMaps(); otherwise these start from procedural canvas textures. Albedo stays
// <= 0.84 so only emissive window-glow blooms.
import { MeshStandardMaterial, Color } from 'three';
import { stoneTexture, slateTexture, woodTexture } from './textures.js';

export function makeMaterials(maps = {}) {
  const stone = new MeshStandardMaterial({
    map: maps.stone || stoneTexture(1, '#6d6a63'),
    color: 0xb9b4a8, roughness: 0.92, metalness: 0.0,
  });
  const slate = new MeshStandardMaterial({
    map: maps.slate || slateTexture(1),
    color: 0x5a6476, roughness: 0.7, metalness: 0.05,
  });
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
