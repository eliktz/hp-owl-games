// The Black Lake: a single glassy plane that mirrors the sky via the scene's environment
// map (low roughness + metalness). We deliberately avoid a live reflection pass (WaterMesh/
// Reflector) — that re-renders the whole scene every frame and roughly DOUBLES the draw
// calls, which blows the iPad budget once characters/quests are in the world. A normal map
// gives it gentle ripples; the env reflection keeps it looking wet and magical.
import { CircleGeometry, Mesh, MeshStandardMaterial, Color } from 'three';
import { WORLD } from './config.js';
import { waterRipples } from './textures.js';
import { buildMist } from './mist.js';

export function buildLake(scene) {
  const geo = new CircleGeometry(60, 48);
  geo.rotateX(-Math.PI / 2);
  // Calm, dark, glossy: a dielectric (metalness 0) lets Fresnel mirror the sky at the
  // grazing angles a child sees the lake from, and long gentle swells keep it coherent.
  const normalMap = waterRipples(7);           // ~17 m tile on the 120 m lake
  const mesh = new Mesh(geo, new MeshStandardMaterial({
    color: new Color(0x0a1d26),       // deep blue-teal, low albedo (no bloom)
    roughness: 0.06, metalness: 0.0,
    normalMap, envMapIntensity: 0.6,    // darker than the sky it mirrors
  }));
  mesh.material.normalScale.set(0.09, 0.09);
  // per-time darkness (environment.js setTime -> onTime): cheap uniforms only
  // The node-material renderer honours envMapIntensity only when material.envMap is set (else it
  // uses scene.environmentIntensity), so the lake carries the current sky as its own envMap.
  mesh.userData.setTime = (p, sky) => {
    const m = mesh.material;
    if (sky && m.envMap !== sky) { m.envMap = sky; m.needsUpdate = true; }
    m.envMapIntensity = p.lakeEnv ?? 0.6; m.color.setHex(p.lakeColor ?? 0x0a1d26);
    mesh.userData.mist?.setTime(p);
  };
  mesh.position.set(-90, WORLD.waterLevel, -10);
  mesh.name = 'lake';
  // low mist cards over the water (children: hidden indoors with the lake); never fatal
  try { mesh.userData.mist = buildMist(mesh); } catch (e) { console.warn('[mist] skipped:', e && e.message || e); }
  scene.add(mesh);
  return mesh;
}
