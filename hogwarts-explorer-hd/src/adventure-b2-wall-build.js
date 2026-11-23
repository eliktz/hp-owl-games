// Book 2, quest 3 geometry (adventure-b2-wall.js runs it): the dim stretch of wall with the puddle and the little
// window (one atlas mesh), the glowing writing, Mrs Norris (frozen = frosty and sparkly, eyes shut as if asleep), the
// bottle of mandrake tonic, the tiny round spiders (one InstancedMesh) and the big old books on a library shelf.
// All code-built, vertex colours + canvas textures <= 512 px, nothing scary: soft gold writing, sleepy cat, cute spiders.
// Budgets: Mrs Norris <= 1.5k tris; everything in the staircase hall <= 6k tris and 6 draw calls.
import {
  Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, ConeGeometry, CapsuleGeometry, LatheGeometry,
  PlaneGeometry, Vector2, Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute, MeshStandardMaterial, MeshBasicMaterial,
  CanvasTexture, InstancedMesh, SRGBColorSpace, DoubleSide, AdditiveBlending,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew','Heebo',Arial,sans-serif";
const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); }
function paint(geo, hex) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const merge = (list) => mergeGeometries(list.map(strip), false);
const vc = (opts = {}) => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...opts });
const S = (w, h) => new SphereGeometry(1, w, h);
const noRay = (o) => { o.traverse(m => { if (m.isMesh) m.raycast = () => {}; }); return o; };
export const triCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); } }); return Math.round(n); };
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }
// remap a geometry's uvs (0..1) into the atlas rect [u0, v0, u1, v1]
function uvRect(geo, u0, v0, u1, v1) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); return geo; }

// ---------------- the staircase hall (room-local; the east wall's inner face is x 9.5, the west wall's x -9.5) ----------------
export const WALL = { x: 9.47, z: 4.25, y: 2.25 };           // the writing's centre
export const PUDDLE = { x: 8.55, z: 4.2 };
export const NORRIS = { x: 8.75, z: 6.15, ry: -Math.PI / 2 - 0.5 };   // under the east wall torch (z 6), looking into the hall
export const TONIC = { x: 6.9, z: 7.9 };
export const WINDOW = { x: -9.47, y: 2.5, z: 3.7 };          // the little window the spiders leave by
// the spiders' trail: from the puddle along the floor to three waypoints, then up the west wall and out of the window
export const TRAIL = [[8.2, 3.6], [4.6, 7.2], [-0.6, 8.3], [-7.6, 5.0]];

// the wall dressing: one atlas (dim stain | puddle | window), one transparent mesh
export function buildWallDressing() {
  const tex = canvasTex(512, 256, (x) => {
    // [0, 256): a soft dark stain (the dim stretch of wall)
    const g = x.createRadialGradient(128, 128, 10, 128, 128, 128); g.addColorStop(0, 'rgba(12,8,16,0.78)'); g.addColorStop(0.6, 'rgba(12,8,16,0.5)'); g.addColorStop(1, 'rgba(12,8,16,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    // [256, 384): the puddle (bluish, a few glints)
    x.save(); x.translate(320, 128); const p = x.createRadialGradient(0, 0, 4, 0, 0, 60); p.addColorStop(0, 'rgba(120,150,180,0.75)'); p.addColorStop(0.8, 'rgba(70,90,120,0.55)'); p.addColorStop(1, 'rgba(70,90,120,0)');
    x.fillStyle = p; x.beginPath(); x.ellipse(0, 0, 60, 56, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(230,240,255,0.65)'; x.beginPath(); x.ellipse(-16, -14, 16, 4, -0.4, 0, 7); x.fill(); x.beginPath(); x.ellipse(18, 12, 9, 3, -0.4, 0, 7); x.fill(); x.restore();
    // [384, 512): a small arched window onto the night (moon + stars), stone frame
    x.save(); x.translate(384, 0);
    x.fillStyle = '#6e6458'; x.beginPath(); x.moveTo(8, 252); x.lineTo(8, 70); x.arc(64, 70, 56, Math.PI, 0); x.lineTo(120, 252); x.closePath(); x.fill();
    const s = x.createLinearGradient(0, 30, 0, 240); s.addColorStop(0, '#22345e'); s.addColorStop(1, '#4a6aa0');
    x.fillStyle = s; x.beginPath(); x.moveTo(20, 240); x.lineTo(20, 72); x.arc(64, 72, 44, Math.PI, 0); x.lineTo(108, 240); x.closePath(); x.fill();
    x.fillStyle = '#fff2c8'; x.beginPath(); x.arc(82, 80, 12, 0, 7); x.fill(); x.fillStyle = '#ffffff'; for (const [a, b] of [[36, 110], [58, 150], [90, 180], [44, 200]]) { x.fillRect(a, b, 3, 3); }
    x.fillStyle = '#3a3028'; x.fillRect(61, 30, 6, 210); x.fillRect(20, 150, 88, 6); x.restore();
  });
  const L = [];
  L.push(uvRect(new PlaneGeometry(3.8, 3.2).rotateY(-Math.PI / 2).translate(9.485, 2.1, WALL.z), 0, 0, 0.5, 1));                       // the stain, behind the writing
  L.push(uvRect(new PlaneGeometry(1.5, 1.3).rotateX(-Math.PI / 2).translate(PUDDLE.x, 0.025, PUDDLE.z), 0.5, 0, 0.75, 1));              // the puddle on the floor
  L.push(uvRect(new PlaneGeometry(0.9, 1.75).rotateY(Math.PI / 2).translate(WINDOW.x + 0.005, WINDOW.y, WINDOW.z), 0.75, 0, 1, 1));    // the window on the west wall
  const m = new Mesh(merge(L), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.name = 'adv-wall-dressing'; m.renderOrder = 2; m.raycast = () => {};
  return m;
}

// the writing: only "חדר הסודות נפתח!", soft warm gold, a gentle glow (opacity driven by the quest)
export function buildWriting() {
  const tex = canvasTex(512, 128, (x, w, h) => {
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold 62px ${FONT}`;
    const tw = x.measureText('חדר הסודות נפתח!').width; if (tw > 460) { x.translate(w / 2, 0); x.scale(460 / tw, 1); x.translate(-w / 2, 0); }
    x.shadowColor = 'rgba(255,214,120,0.95)'; x.shadowBlur = 22; x.fillStyle = '#ffe9a8'; x.fillText('חדר הסודות נפתח!', w / 2, h / 2 + 4);
    x.shadowBlur = 8; x.fillStyle = '#fff6da'; x.fillText('חדר הסודות נפתח!', w / 2, h / 2 + 4);
  });
  const m = new Mesh(new PlaneGeometry(3.0, 0.75).rotateY(-Math.PI / 2).translate(WALL.x, WALL.y, WALL.z), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.15, toneMapped: false, blending: AdditiveBlending }));
  m.name = 'adv-writing'; m.renderOrder = 3; m.raycast = () => {};
  return m;
}

// ---------------- Mrs Norris (sits facing +z, feet at y 0, about 0.5 m; the tail on its own pivot) ----------------
// Frozen: a frosty pale-blue multiplier + a soft icy emissive on the material; thawed: plain dusty grey tabby.
export function buildNorris() {
  const FUR = 0x7e7468, FUR2 = 0x6a6056, CREAM = 0xb8ac98, PINK = 0xc88a8a, DARK = 0x2a2420;
  const mat = vc({ roughness: 0.9 });
  const root = new Group(); root.name = 'adv-norris';
  const body = new Group(); root.add(body);
  const L = [];
  L.push(paint(place(S(10, 7), 0, 0.15, -0.04, 0, 0, 0, 0.15, 0.15, 0.19), FUR));                  // haunches
  L.push(paint(place(S(10, 7), 0, 0.27, 0.06, -0.35, 0, 0, 0.11, 0.17, 0.11), FUR));                // chest, upright
  L.push(paint(place(S(8, 5), 0, 0.27, 0.13, -0.35, 0, 0, 0.07, 0.11, 0.05), CREAM));             // cream bib
  for (const sx of [-1, 1]) {
    L.push(paint(place(new CapsuleGeometry(0.028, 0.16, 2, 6), sx * 0.05, 0.1, 0.12), FUR2));      // front legs
    L.push(paint(place(S(8, 5), sx * 0.05, 0.02, 0.15, 0, 0, 0, 0.04, 0.025, 0.05), CREAM));      // paws
    L.push(paint(place(S(8, 6), sx * 0.11, 0.07, 0.0, 0, 0, 0, 0.06, 0.06, 0.1), FUR2));          // back feet
  }
  // head: round, ears, a little muzzle, eyes CLOSED (two soft arcs), pink nose
  L.push(paint(place(S(12, 8), 0, 0.47, 0.1, 0, 0, 0, 0.11, 0.1, 0.1), FUR));
  L.push(paint(place(S(10, 6), 0, 0.43, 0.18, 0, 0, 0, 0.055, 0.04, 0.04), CREAM));
  L.push(paint(place(S(6, 4), 0, 0.455, 0.215, 0, 0, 0, 0.016, 0.012, 0.01), PINK));
  for (const sx of [-1, 1]) {
    L.push(paint(place(new ConeGeometry(0.045, 0.09, 4), sx * 0.065, 0.57, 0.08, -0.1, 0, sx * -0.35), FUR2));
    L.push(paint(place(new ConeGeometry(0.025, 0.05, 4), sx * 0.064, 0.565, 0.095, -0.1, 0, sx * -0.35), PINK));
    L.push(paint(place(new TorusGeometry(0.024, 0.006, 3, 8, Math.PI), sx * 0.045, 0.485, 0.188, 0, 0, Math.PI), DARK));   // a shut, sleepy eye (an upside-down arc)
    for (let k = -1; k <= 1; k += 2) L.push(paint(place(new BoxGeometry(0.09, 0.004, 0.004), sx * 0.09, 0.43 + k * 0.01, 0.17, 0, sx * 0.3, k * 0.12 * sx), 0xd8d0c0));   // whiskers
  }
  // a few darker tabby stripes over the back
  for (let k = 0; k < 2; k++) L.push(paint(place(new TorusGeometry(0.15, 0.012, 3, 8, Math.PI), 0, 0.17, -0.12 + k * 0.08, 0, Math.PI / 2, 0, 1, 1.0, 1.25), FUR2));
  const bodyMesh = new Mesh(merge(L), mat); bodyMesh.name = 'norris-body'; body.add(bodyMesh);
  // the tail: curled round the feet (its own pivot so it can swish once she thaws)
  const tail = new Group(); tail.position.set(0, 0.05, -0.2); body.add(tail);
  const tg = paint(place(new TorusGeometry(0.17, 0.028, 5, 12, Math.PI * 1.1), 0.0, 0.0, 0.12, Math.PI / 2, 0, -0.3), FUR2);
  const tailMesh = new Mesh(merge([tg]), mat); tailMesh.name = 'norris-tail'; tail.add(tailMesh);
  noRay(root);
  return { root, body, tail, mat };
}

// the bottle of mandrake tonic: a round green bottle with a cork and a leafy label (one small mesh)
export function buildTonic() {
  const L = [];
  L.push(paint(new LatheGeometry([[0, 0], [0.07, 0], [0.09, 0.05], [0.09, 0.13], [0.05, 0.19], [0.03, 0.22], [0.03, 0.26], [0, 0.26]].map(([r, y]) => new Vector2(r, y)), 12), 0x4a9a5a));
  L.push(paint(place(new CylinderGeometry(0.034, 0.03, 0.05, 8), 0, 0.28, 0), 0x8a6a42));
  L.push(paint(place(new CylinderGeometry(0.093, 0.093, 0.06, 12, 1, true), 0, 0.09, 0), 0xd8cca8));
  for (let k = 0; k < 3; k++) L.push(paint(place(new ConeGeometry(0.02, 0.07, 4), Math.cos(k * 2.1) * 0.012, 0.33, Math.sin(k * 2.1) * 0.012, Math.cos(k * 2.1) * 0.5, 0, Math.sin(k * 2.1) * 0.5), 0x4a8a3a));
  const m = new Mesh(merge(L), vc({ roughness: 0.3, emissive: new Color(0x3aa060), emissiveIntensity: 0.25 }));
  m.name = 'adv-tonic'; m.scale.setScalar(1.6); m.raycast = () => {};
  return m;
}

// ---------------- the spiders: tiny, round, friendly (two big dot eyes); one InstancedMesh ----------------
export function buildSpiders(n) {
  const BODY = 0x4a3a30, BODY2 = 0x5e4a3c, LEG = 0x3a2e26;
  const L = [];
  L.push(paint(place(S(10, 6), 0, 0.07, -0.03, 0, 0, 0, 0.065, 0.055, 0.075), BODY2));          // round body
  L.push(paint(place(S(8, 6), 0, 0.07, 0.055, 0, 0, 0, 0.045, 0.04, 0.04), BODY));             // head
  for (const sx of [-1, 1]) {
    L.push(paint(place(S(8, 6), sx * 0.02, 0.085, 0.088, 0, 0, 0, 0.018), 0xf4f0e8));            // big white eyes
    L.push(paint(place(S(6, 4), sx * 0.02, 0.087, 0.104, 0, 0, 0, 0.009), 0x141210));            // dark dots
  }
  for (let k = 0; k < 4; k++) L.push(paint(place(new BoxGeometry(0.24, 0.012, 0.012), 0, 0.045, 0.04 - k * 0.03, 0, (k - 1.5) * 0.18, 0), LEG));   // 4 bars = 8 little legs
  const mesh = new InstancedMesh(merge(L), vc({ roughness: 0.7 }), n);
  mesh.name = 'adv-spiders'; mesh.frustumCulled = false; mesh.count = 0; mesh.raycast = () => {};
  return mesh;
}

// ---------------- the library: big old books on the east wall's middle bookcase (face x 9.88, looking -x) ----------------
export const SHELF = { x: 9.74, y: 0.24 + 2 * 0.5145 + 0.0 };   // pulled 12 cm proud of the case: big old books
export const ICONS = ['cauldron', 'star', 'moon', 'leaf'];
const LEATHER = ['#8a3424', '#2e4a78', '#3a6234', '#7a5228'];
export function buildBooks(n) {
  // one 512 x 256 atlas: four 128 px spine panels (leather, gold bands, a gold icon), shared by every book
  const tex = canvasTex(512, 256, (x) => {
    ICONS.forEach((ic, k) => {
      const ox = k * 128; x.fillStyle = LEATHER[k]; x.fillRect(ox, 0, 128, 256);
      for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(0,0,0,' + (0.05 + (i % 2) * 0.05) + ')'; x.fillRect(ox + 10 + i * 18, 0, 8, 256); }
      x.fillStyle = '#c8a040'; for (const y of [18, 30, 226, 238]) x.fillRect(ox + 8, y, 112, 5);
      x.save(); x.translate(ox + 64, 128); x.fillStyle = '#e0bc5a'; x.strokeStyle = '#e0bc5a'; x.lineWidth = 5;
      if (ic === 'cauldron') {
        x.beginPath(); x.arc(0, 8, 34, 0, Math.PI); x.lineTo(-34, 8); x.closePath(); x.fill(); x.fillRect(-40, 0, 80, 10);
        x.fillRect(-26, 40, 8, 12); x.fillRect(18, 40, 8, 12);
        x.beginPath(); x.arc(-10, -14, 8, 0, 7); x.arc(8, -26, 6, 0, 7); x.arc(14, -8, 5, 0, 7); x.fill();
      } else if (ic === 'star') {
        x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 16 : 38; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill();
      } else if (ic === 'moon') {
        x.beginPath(); x.arc(0, 0, 36, 0, 7); x.fill(); x.fillStyle = LEATHER[k]; x.beginPath(); x.arc(16, -10, 32, 0, 7); x.fill();
      } else {
        x.beginPath(); x.ellipse(0, 0, 18, 40, 0.4, 0, 7); x.fill(); x.strokeStyle = LEATHER[k]; x.lineWidth = 3; x.beginPath(); x.moveTo(-14, 34); x.lineTo(14, -34); x.stroke();
      }
      x.restore();
    });
  });
  const mat = new MeshStandardMaterial({ map: tex, roughness: 0.7, emissiveMap: tex, emissive: new Color(0xffffff), emissiveIntensity: 0.22 });   // a faint self-glow: the spines read in the dim library
  const books = [];
  for (let i = 0; i < n; i++) {
    const k = i % ICONS.length;
    const geo = new BoxGeometry(0.3, 0.5, 0.2).translate(0, 0.25, 0);   // pivot at the bottom; the spine is the -x face
    const uv = geo.attributes.uv, u0 = k / 4, u1 = (k + 1) / 4;
    for (let v = 0; v < uv.count; v++) {
      const face = Math.floor(v / 4);
      if (face === 1) uv.setXY(v, u0 + uv.getX(v) * (u1 - u0), uv.getY(v));   // -x: the spine panel
      else uv.setXY(v, u0 + 0.01, 0.5);                                       // the other faces: plain leather
    }
    const m = new Mesh(geo, mat); m.name = 'adv-book-' + ICONS[k]; m.raycast = () => {};
    books.push({ m, icon: ICONS[k] });
  }
  return { books, mat };
}
export { FONT, DoubleSide };
