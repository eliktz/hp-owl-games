// The Black Lake: a single glassy plane that mirrors the sky via the scene's environment
// map (low roughness + metalness). We deliberately avoid a live reflection pass (WaterMesh/
// Reflector) — that re-renders the whole scene every frame and roughly DOUBLES the draw
// calls, which blows the iPad budget once characters/quests are in the world. A normal map
// gives it gentle ripples; the env reflection keeps it looking wet and magical.
import { CircleGeometry, Mesh, MeshStandardMaterial, Color } from 'three';
import { WORLD } from './config.js';
import { waterNormal } from './textures.js';

export function buildLake(scene) {
  const geo = new CircleGeometry(60, 48);
  geo.rotateX(-Math.PI / 2);
  const normalMap = waterNormal(10);
  const mesh = new Mesh(geo, new MeshStandardMaterial({
    color: new Color(0x16343f),       // deep teal, low albedo (no bloom)
    roughness: 0.12, metalness: 0.6,
    normalMap, envMapIntensity: 1.1,
  }));
  mesh.position.set(-90, WORLD.waterLevel, -10);
  mesh.name = 'lake';
  scene.add(mesh);
  return mesh;
}
