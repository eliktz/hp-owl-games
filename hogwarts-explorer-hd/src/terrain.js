// Grounds terrain: a gently rolling heightfield with a flat castle plateau and a
// lake basin. Exposes heightAt(x,z) so the player controller can walk the surface.
import { PlaneGeometry, Mesh, MeshStandardMaterial } from 'three';
import { WORLD } from './config.js';
import { grassTexture } from './textures.js';

// Smooth, deterministic hills (sum of sines) + a carved-out lake basin to the west.
export function heightAt(x, z) {
  let h = 0;
  h += 1.6 * Math.sin(x * 0.012 + 1.3) * Math.cos(z * 0.010 - 0.4);
  h += 0.9 * Math.sin(x * 0.03 - z * 0.02);
  h += 0.5 * Math.cos(z * 0.05 + x * 0.01);
  // flatten the central castle plateau (radius ~34 around origin)
  const dCastle = Math.hypot(x, z - 2);
  if (dCastle < 40) {
    const t = Math.max(0, 1 - dCastle / 40);
    h = h * (1 - t * t) + 2.0 * (t * t);
  }
  // carve the lake basin to the west
  const dLake = Math.hypot(x + 90, z + 10);
  if (dLake < 55) {
    const t = Math.max(0, 1 - dLake / 55);
    h -= 6.5 * t * t;
  }
  return h;
}

export function buildTerrain(scene, { texture } = {}) {
  const size = WORLD.groundSize;
  const seg = 180;
  const geo = new PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  geo.computeVertexNormals();

  const map = texture || grassTexture(120);
  const mat = new MeshStandardMaterial({
    map,
    color: 0x8a9a78,       // kept < 0.84 albedo so grass never blooms
    roughness: 0.96,
    metalness: 0.0,
  });
  const mesh = new Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);
  return mesh;
}
