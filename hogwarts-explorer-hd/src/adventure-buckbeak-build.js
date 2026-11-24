// Book 1, quest "קידה לאבזם" (Buckbeak): the places, the flight path and the small code-built props
// (adventure-buckbeak.js runs it). Buckbeak himself is the rigged GLB 'buckbeak' (assets/models/, loaded lazily by the
// quest; 6,249 tris, 3 draw calls); everything here is pooled and tiny: the bow spot on the lawn (one quad), the gold
// feathers (one InstancedMesh of 5) and nothing else (sparkles, hearts and the water line use the framework's pool).
// World frame: +x east, +z south; the paddock pen centre is (74, 45), the hut (86, 36), the lake centre (-90, -10).
import {
  Group, Mesh, PlaneGeometry, ShapeGeometry, Shape, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, CanvasTexture,
  InstancedMesh, Vector3, CatmullRomCurve3, AdditiveBlending, SRGBColorSpace, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD } from './config.js';

// Where Buckbeak waits: a free patch of lawn just east of the pen, inside the paddock / hut keep-outs (no trees),
// 7 m from the pen centre (fence r 3.2), 15 m from the hut path, clear of the Creatures course (all west / south of
// x 75 at z < 61) and of the hut hearth (behind the hut). He faces west, toward the pen and Hagrid.
export const BB = { x: 79.5, z: 50.5, yaw: -Math.PI / 2 };
export const BOW = { x: 75.5, z: 50.5 };                  // the glowing spot 4 m in front of him
export const LAND = { x: 77.5, z: 52.5, yaw: Math.PI / 2 }; // he touches down here (heading east), then walks back to BB
export const HOME = { x: 75.0, z: 53.6 };                  // where Harry is put down after a pause / an abort / the landing
export const WATER = WORLD.waterLevel;

// The flight: one smooth on-rails loop, about 420 m at 9 m/s (~47 s). [x, z, height]: a number is metres over the
// terrain, 'w' skims the water (his toes just touch the lake). Up from the paddock heading south-west (so the castle,
// the heaviest thing in the grounds, stays out of the chase camera's view), west over the south lawns between the
// gates and the Quidditch stand, down over the Black Lake's east bay, a wide
// right-hand bank over the far lawns, home along the south lawns, down to the paddock. Low the whole way: the camera
// stays near the ground, so the castle is seen side-on and the far grounds stay small (the triangle budget).
export const PATH = [
  [79.5, 50.5, 0], [71, 55.5, 4.5], [56, 66, 9], [32, 75, 10], [6, 78, 10], [-20, 75, 10], [-37, 60, 9],
  [-46, 39, 7], [-56, 18, 3], [-65, 4, 'w'], [-74, -2, 'w'], [-82, 4, 'w'], [-87, 17, 3.5], [-87, 31, 8], [-76, 48, 9.5],
  [-54, 62, 10], [-26, 65, 10], [4, 64, 10], [32, 61, 10], [54, 58, 7], [68, 54.5, 3.5], [LAND.x, LAND.z, 0],
];
export const SPEED = 9;            // m/s along the path (slow and smooth)
export const LANES = [-2.2, 0, 2.2];

export function flightCurve(groundAt) {
  const pts = PATH.map(([x, z, h]) => new Vector3(x, h === 'w' ? WATER + 0.12 : groundAt(x, z) + h, z));
  const c = new CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  c.arcLengthDivisions = 400;
  return c;
}
// Is the path point at u over the water (for the skim)? The lake is a disc (lake.js: r 60 at -90, -10).
export const overLake = (x, z, ground) => Math.hypot(x + 90, z + 10) < 60 && (ground === undefined || ground < WATER - 0.1);

const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };

// The bow spot: a soft gold ring on the lawn with a little 🙇 in the middle (one additive quad, 128 px)
export function buildBowSpot() {
  const t = canvasTex(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 20, 64, 64, 62); g.addColorStop(0, 'rgba(255,230,140,0)'); g.addColorStop(0.7, 'rgba(255,220,120,.55)'); g.addColorStop(0.86, 'rgba(255,240,170,.95)'); g.addColorStop(1, 'rgba(255,220,120,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.font = '44px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.globalAlpha = 0.9; x.fillText('🙇', 64, 66);
  });
  const m = new Mesh(new PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: AdditiveBlending, color: 0xffe08a }));
  m.name = 'adv-bb-bowspot'; m.renderOrder = 3; m.raycast = () => {}; m.frustumCulled = false;
  return m;
}

// A gold feather (about 0.9 m: big enough to fly through): a curved vane + a quill; emissive (a true light, it blooms)
export function buildFeathers(n = 5) {
  const sh = new Shape();
  sh.moveTo(0, -0.45); sh.bezierCurveTo(0.2, -0.25, 0.2, 0.2, 0.02, 0.48); sh.bezierCurveTo(-0.14, 0.2, -0.16, -0.2, 0, -0.45);
  const vane = new ShapeGeometry(sh, 10);
  const p = vane.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, 0.12 * Math.sin((y + 0.45) / 0.93 * Math.PI) - x * x * 1.2); }
  vane.computeVertexNormals();
  const quill = new CylinderGeometry(0.012, 0.018, 1.1, 5).translate(0, -0.03, 0.02);
  const strip = (g) => { const q = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k); return q; };
  const geo = mergeGeometries([strip(vane), strip(quill)], false).scale(1.6, 1.6, 1.6);
  const mat = new MeshStandardMaterial({ color: 0xffc94a, emissive: 0xffa820, emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.4, side: DoubleSide });
  const im = new InstancedMesh(geo, mat, n); im.count = 0; im.frustumCulled = false; im.name = 'adv-bb-feathers'; im.raycast = () => {};
  return im;
}

// tris of an object tree (visible meshes; instanced counts)
export const triCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); } }); return Math.round(n); };
export { Group };
