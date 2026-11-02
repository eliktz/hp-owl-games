// The Black Lake: a reflective TSL WaterMesh (works on WebGPU and the WebGL2
// fallback). If water-node construction ever fails, we drop to a cheap glassy plane.
import { CircleGeometry, Mesh, MeshStandardMaterial, Vector3, Color } from 'three';
import { WaterMesh } from 'three/addons/objects/WaterMesh.js';
import { WORLD } from './config.js';
import { waterNormal } from './textures.js';

export function buildLake(scene, { sunDir } = {}) {
  const geo = new CircleGeometry(60, 64);
  geo.rotateX(-Math.PI / 2);
  const normals = waterNormal(10);
  let mesh;
  try {
    mesh = new WaterMesh(geo, {
      waterNormals: normals,
      resolutionScale: 0.4,          // half-res reflection, kinder to the iPad
      sunDirection: sunDir || new Vector3(0.4, 0.7, 0.2).normalize(),
      sunColor: 0xfff1d0,
      waterColor: 0x14323f,          // deep teal, low albedo
      distortionScale: 6.0,
      size: 3.0,
      alpha: 0.96,
    });
  } catch (e) {
    console.warn('[lake] WaterMesh failed, using simple water:', e.message);
    mesh = new Mesh(geo, new MeshStandardMaterial({
      color: new Color(0x16343f), roughness: 0.08, metalness: 0.65,
    }));
  }
  mesh.position.set(-90, WORLD.waterLevel, -10);
  mesh.name = 'lake';
  scene.add(mesh);
  return mesh;
}
