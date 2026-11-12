// The Black Lake: a single glassy plane that mirrors the sky via the scene's environment
// map (low roughness + metalness). We deliberately avoid a live reflection pass (WaterMesh/
// Reflector) — that re-renders the whole scene every frame and roughly DOUBLES the draw
// calls, which blows the iPad budget once characters/quests are in the world. A normal map
// gives it gentle ripples; the env reflection keeps it looking wet and magical.
import { CircleGeometry, Mesh, MeshStandardMaterial, Color } from 'three';
import { WORLD } from './config.js';
import { waterRipples } from './textures.js';

export function buildLake(scene) {
  const geo = new CircleGeometry(60, 48);
  geo.rotateX(-Math.PI / 2);
  // Calm, dark, glossy: a dielectric (metalness 0) lets Fresnel mirror the sky at the
  // grazing angles a child sees the lake from, and long gentle swells keep it coherent.
  const normalMap = waterRipples(18);
  const mesh = new Mesh(geo, new MeshStandardMaterial({
    color: new Color(0x0a1d26),       // deep blue-teal, low albedo (no bloom)
    roughness: 0.06, metalness: 0.0,
    normalMap, envMapIntensity: 1.0,
  }));
  mesh.material.normalScale.set(0.1, 0.1);
  mesh.position.set(-90, WORLD.waterLevel, -10);
  mesh.name = 'lake';
  scene.add(mesh);
  return mesh;
}
