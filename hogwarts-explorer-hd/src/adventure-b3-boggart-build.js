// Book 3, quest 2 geometry (adventure-b3-boggart.js runs it): the friendly old wardrobe for the Defence corner of
// `classrooms` and the five silly "boggart" shapes, all code-built (vertex colours, no textures). Kid-safe by design:
// every shape is round and bright with big cartoon eyes and a little "ooh" mouth; after Riddikulus it gets something
// ridiculous (a curly moustache, a pink tutu, a flowered bonnet, clown shoes, a party hat) and a big grin.
// Room-local frame: the wardrobe stands at WARD, turned toward the class (yaw toward SPOT, where Harry stands);
// its doors open toward +z (local). A shape lives in the wardrobe's local frame: base at y 0, facing +z.
// Draw calls: wardrobe body + two doors (3) + one shape (body, silly item: 2). Each shape < 1.2k triangles.
import {
  Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, LatheGeometry, CapsuleGeometry,
  Vector2, Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute, MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SPOT = { x: 7.2, z: 3.6 };                 // where Harry stands for the lesson (room-local): Tonks to the left, the wardrobe ahead
export const WARD = { x: 13.0, z: 1.5 };                 // against the east wall, south of the Defence desks (nothing stands in front of it)
WARD.yaw = Math.atan2(SPOT.x - WARD.x, SPOT.z - WARD.z);  // the doors face Harry's spot
export const STAGE_D = 1.35;                             // the shapes stand this far in front of the doors
export const STAGE = { x: WARD.x + Math.sin(WARD.yaw) * STAGE_D, z: WARD.z + Math.cos(WARD.yaw) * STAGE_D };
export const TONKS = { x: 9, z: -6.2 };                  // lessons.js STATIONS.spells (read-only there)
export const KINDS = ['hat', 'pumpkin', 'ghost', 'cupboard', 'sock'];

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); }
function paint(geo, hex) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k); return n; };
const merge = (list) => mergeGeometries(list.map(strip), false);
export const triCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return Math.round(n); };
let MAT = null, MAT_W = null;
const mat = () => (MAT || (MAT = new MeshStandardMaterial({ vertexColors: true, roughness: 0.62 })));
const matW = () => (MAT_W || (MAT_W = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })));
const mesh = (parts, name, m = mat()) => { const o = new Mesh(merge(parts), m); o.name = name; o.frustumCulled = false; o.raycast = () => {}; return o; };
const S = (r, w = 8, h = 6) => new SphereGeometry(r, w, h);

// ---------------- the wardrobe (about 1.3 m wide, 2.3 m tall) ----------------
export function buildWardrobe() {
  const WOOD = 0x8a5a34, DARK = 0x5a3a22, GOLD = 0xc8a040, IN = 0x4a3a5a;
  const g = new Group(); g.name = 'b3-wardrobe'; g.position.set(WARD.x, 0, WARD.z); g.rotation.y = WARD.yaw;
  const B = [];
  B.push(paint(place(new BoxGeometry(1.3, 2.05, 0.06), 0, 1.17, -0.32), DARK));                       // back
  for (const sx of [-1, 1]) B.push(paint(place(new BoxGeometry(0.07, 2.05, 0.7), sx * 0.62, 1.17, 0), WOOD));   // sides
  B.push(paint(place(new BoxGeometry(1.2, 1.95, 0.02), 0, 1.17, -0.28), IN));                          // the cosy purple inside
  B.push(paint(place(new BoxGeometry(1.3, 0.1, 0.7), 0, 0.17, 0), WOOD));                              // floor
  B.push(paint(place(new BoxGeometry(1.44, 0.14, 0.82), 0, 2.24, 0.02), DARK));                        // the cornice
  B.push(paint(place(new CylinderGeometry(0.34, 0.34, 0.08, 12, 1, false, -Math.PI / 2, Math.PI), 0, 2.33, 0.2, Math.PI / 2, 0, 0, 1, 1, 1), WOOD));   // a rounded crest
  B.push(paint(place(S(0.07, 8, 6), 0, 2.62, 0.22), GOLD));
  B.push(paint(place(new BoxGeometry(1.34, 0.08, 0.74), 0, 0.1, 0.02), GOLD));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.push(paint(place(S(0.08, 8, 6), sx * 0.52, 0.07, sz * 0.26, 0, 0, 0, 1, 0.8, 1), DARK));   // round feet
  const body = mesh(B, 'b3-wardrobe-body', matW());
  g.add(body);
  const doors = [];
  for (const sx of [-1, 1]) {   // a door pivot on each hinge; the door panel spans toward the middle
    const piv = new Group(); piv.position.set(sx * 0.62, 0, 0.35); g.add(piv);
    const P = [], cx = -sx * 0.31;
    P.push(paint(place(new BoxGeometry(0.6, 1.95, 0.05), cx, 1.17, 0.02), WOOD));
    P.push(paint(place(new BoxGeometry(0.42, 0.72, 0.03), cx, 1.62, 0.055), 0x9a6a40));
    P.push(paint(place(new BoxGeometry(0.42, 0.72, 0.03), cx, 0.7, 0.055), 0x9a6a40));
    P.push(paint(place(new CylinderGeometry(0.08, 0.08, 0.02, 5), cx, 1.62, 0.075, Math.PI / 2, 0, 0), 0xd8b04a));   // a little gold star-ish rosette
    P.push(paint(place(S(0.04, 8, 6), -sx * 0.55, 1.17, 0.08), GOLD));                                // knob
    const d = mesh(P, 'b3-wardrobe-door', matW()); piv.add(d); doors.push(piv);
  }
  const holder = new Group(); holder.name = 'b3-shape-holder'; g.add(holder);
  return { g, body, doorL: doors[0], doorR: doors[1], holder };
}

// ---------------- the five silly shapes ----------------
// eyes: big white googly eyes with dark pupils and a white glint
function eyes(P, y, z, gap, r, ink = 0x2a2030) {
  for (const sx of [-1, 1]) {
    P.push(paint(place(S(r, 9, 6), sx * gap, y, z), 0xd4d0c8));
    P.push(paint(place(S(r * 0.5, 6, 4), sx * gap + sx * 0.12 * r, y - 0.15 * r, z + r * 0.62), ink));
    P.push(paint(place(S(r * 0.16, 4, 3), sx * gap + sx * 0.05 * r, y + 0.12 * r, z + r * 0.98), 0xd4d0c8));
  }
}
const ooh = (y, z, r = 0.055) => paint(place(new TorusGeometry(r, r * 0.4, 4, 8), 0, y, z), 0x5a2020);            // a round "ooh" mouth
const grin = (y, z, r = 0.11) => paint(place(new TorusGeometry(r, r * 0.22, 4, 9, Math.PI), 0, y, z, 0, 0, Math.PI), 0x5a2020);
const cover = (y, z, hex) => paint(place(new CylinderGeometry(0.09, 0.09, 0.012, 8), 0, y, z + 0.03, Math.PI / 2, 0, 0), hex);   // hides the "ooh" mouth under the grin
const cheeks = (P, y, z, gap) => { for (const sx of [-1, 1]) P.push(paint(place(S(0.05, 6, 4), sx * gap, y, z, 0, 0, 0, 1, 0.6, 0.4), 0xe88a8a)); };
function flower(P, x, y, z, petal = 0xe86aa0) { for (let k = 0; k < 5; k++) { const a = k * 1.2566; P.push(paint(place(S(0.045, 5, 3), x + Math.cos(a) * 0.05, y + Math.sin(a) * 0.05, z), petal)); } P.push(paint(place(S(0.035, 5, 3), x, y, z + 0.01), 0xe8c84a)); }

function hat() {   // a giant grumpy wizard hat with bushy eyebrows
  const B = [], F = [], X = [], PU = 0x6a4a9a, PU2 = 0x7a5aaa;
  B.push(paint(place(new CylinderGeometry(0.78, 0.8, 0.07, 22), 0, 0.04, 0), PU));
  B.push(paint(place(new CylinderGeometry(0.34, 0.46, 0.55, 12), 0, 0.34, 0), PU2));
  B.push(paint(place(new CylinderGeometry(0.47, 0.47, 0.12, 12), 0, 0.14, 0), 0xc89a3a));            // gold band
  B.push(paint(place(new BoxGeometry(0.16, 0.13, 0.04), 0, 0.14, 0.47), 0xe0c060));
  B.push(paint(place(new CylinderGeometry(0.2, 0.34, 0.42, 14), 0.04, 0.8, -0.02, -0.12, 0, -0.12), PU));
  B.push(paint(place(new ConeGeometry(0.2, 0.5, 12), 0.2, 1.18, -0.1, -0.3, 0, -0.65), PU2));          // the floppy tip
  B.push(paint(place(S(0.06, 8, 5), 0.42, 1.36, -0.2), 0xe0c060));
  eyes(B, 0.42, 0.38, 0.14, 0.11);
  for (const sx of [-1, 1]) B.push(paint(place(new BoxGeometry(0.2, 0.05, 0.05), sx * 0.15, 0.58, 0.4, 0, 0, sx * 0.28), 0x3a2418));   // grumpy brows
  B.push(ooh(0.25, 0.43));
  // silly: a big curly moustache + a pink flower on the brim + a grin
  for (const sx of [-1, 1]) { X.push(paint(place(new TorusGeometry(0.09, 0.03, 4, 8, Math.PI * 1.4), sx * 0.11, 0.3, 0.47, 0, sx < 0 ? Math.PI : 0, -0.6), 0x3a2418)); }
  X.push(cover(0.25, 0.43, 0x7a5aaa), grin(0.25, 0.48, 0.08));
  flower(X, -0.5, 0.11, 0.5); flower(X, 0.52, 0.11, 0.45, 0xe8c84a);
  return { B, F, X, h: 1.4 };
}
function pumpkin() {   // a wobbly pumpkin on little feet
  const B = [], F = [], X = [], OR = 0xd87a1a;
  const body = new SphereGeometry(0.5, 14, 9), p = body.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.07 * Math.cos(a * 8); p.setXYZ(i, x * k, p.getY(i) * 0.8, z * k); }
  body.computeVertexNormals(); B.push(paint(place(body, 0, 0.56, 0), OR));
  B.push(paint(place(new CylinderGeometry(0.05, 0.07, 0.2, 7), 0.02, 1.0, 0, 0, 0, -0.25), 0x5a6a2a));
  B.push(paint(place(S(0.12, 8, 5), 0.16, 0.98, 0.02, 0, 0, 0.5, 1, 0.3, 0.6), 0x5a8a3a));
  for (const sx of [-1, 1]) B.push(paint(place(S(0.12, 8, 6), sx * 0.2, 0.08, 0.12, 0, 0, 0, 1, 0.7, 1.4), 0x3a6a3a));   // little green boots
  eyes(B, 0.68, 0.4, 0.15, 0.12); cheeks(B, 0.52, 0.45, 0.27);
  B.push(ooh(0.46, 0.46));
  // silly: a pink tutu + a bow + a grin
  X.push(paint(place(new CylinderGeometry(0.62, 0.78, 0.18, 16, 1, true), 0, 0.3, 0), 0xe87ab0));
  X.push(paint(place(new CylinderGeometry(0.5, 0.62, 0.1, 16, 1, true), 0, 0.42, 0), 0xf09ac8));
  X.push(cover(0.46, 0.46, 0xd87a1a), grin(0.47, 0.5, 0.1));
  for (const sx of [-1, 1]) X.push(paint(place(S(0.07, 8, 5), sx * 0.08, 1.06, 0.06, 0, 0, 0, 1.2, 0.7, 0.6), 0xe87ab0));
  return { B, F, X, h: 1.15 };
}
function ghost() {   // a friendly bedsheet with a hiccup: soft lavender-white, big blue cartoon eyes, rosy cheeks
  const B = [], F = [], X = [], SH = 0xccc8dc;
  const prof = [[0.001, 1.25], [0.2, 1.22], [0.36, 1.1], [0.44, 0.9], [0.46, 0.55], [0.5, 0.2], [0.56, 0.06]].map(([r, y]) => new Vector2(r, y));
  const sheet = new LatheGeometry(prof, 14), p = sheet.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 0.1) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + 0.05 * Math.sin(a * 6)); } }
  sheet.computeVertexNormals(); B.push(paint(sheet, SH));
  for (const sx of [-1, 1]) { B.push(paint(place(S(0.1, 8, 6), sx * 0.15, 0.94, 0.4, 0, 0, 0, 0.9, 1.25, 0.5), 0x3a5aa8)); B.push(paint(place(S(0.032, 6, 4), sx * 0.15 + 0.02, 0.99, 0.46), 0xd4d0c8)); }
  cheeks(B, 0.82, 0.44, 0.27);
  B.push(ooh(0.74, 0.45, 0.045));
  // silly: a yellow flowered bonnet with a ribbon bow + a grin
  X.push(paint(place(new SphereGeometry(0.4, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 1.02, -0.06, -0.5, 0, 0), 0xe8c84a));
  X.push(paint(place(new TorusGeometry(0.38, 0.05, 4, 14), 0, 1.07, 0.1, -0.5, 0, 0), 0xf0d870));
  flower(X, -0.2, 1.33, 0.17); flower(X, 0.2, 1.33, 0.17, 0x9a7ae0);
  for (const sx of [-1, 1]) X.push(paint(place(S(0.07, 6, 4), sx * 0.08, 0.66, 0.44, 0, 0, 0, 1.3, 0.7, 0.5), 0xe87ab0));
  X.push(cover(0.74, 0.45, 0xccc8dc), grin(0.75, 0.5, 0.08));
  return { B, F, X, h: 1.3 };
}
function cupboard() {   // a little round-footed cupboard with bushy eyebrows
  const B = [], F = [], X = [], TEAL = 0x5a9a96, TEAL2 = 0x7ab8b0;
  B.push(paint(place(new BoxGeometry(0.84, 1.0, 0.5), 0, 0.62, 0), TEAL));
  B.push(paint(place(new BoxGeometry(0.94, 0.08, 0.58), 0, 1.16, 0), 0x4a7a76));
  for (const sx of [-1, 1]) { B.push(paint(place(new BoxGeometry(0.36, 0.42, 0.03), sx * 0.2, 0.42, 0.26), TEAL2)); B.push(paint(place(S(0.035, 6, 4), sx * 0.05, 0.42, 0.29), 0xc8a040)); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.push(paint(place(S(0.07, 8, 5), sx * 0.34, 0.07, sz * 0.18), 0x3a5a56));
  eyes(B, 0.92, 0.27, 0.17, 0.1);
  for (const sx of [-1, 1]) B.push(paint(place(new CapsuleGeometry(0.035, 0.18, 3, 6), sx * 0.18, 1.06, 0.3, 0, 0, Math.PI / 2 + sx * 0.25), 0x4a2a18));   // bushy brows
  B.push(ooh(0.73, 0.27));
  // silly: big red clown shoes + a round red nose + a grin
  for (const sx of [-1, 1]) X.push(paint(place(S(0.16, 8, 5), sx * 0.3, 0.09, 0.2, 0, 0, 0, 1, 0.6, 1.7), 0xd83a3a));
  X.push(paint(place(S(0.07, 8, 5), 0, 0.82, 0.3), 0xe03030));
  X.push(cover(0.73, 0.27, 0x5a9a96), grin(0.72, 0.31, 0.09));
  return { B, F, X, h: 1.2 };
}
function sock() {   // a huge red-and-cream striped sock standing on its foot
  const B = [], F = [], X = [];
  for (let i = 0; i < 6; i++) B.push(paint(place(new CylinderGeometry(0.28, 0.28, 0.15, 12, 1, true), 0, 0.42 + i * 0.15, 0), i % 2 ? 0xd8d0c0 : 0xc83a3a));
  B.push(paint(place(new CylinderGeometry(0.3, 0.3, 0.1, 14), 0, 1.3, 0), 0xd8d0c0));                    // the cuff
  B.push(paint(place(S(0.3, 10, 6), 0, 0.26, 0.14, 0, 0, 0, 0.95, 0.75, 1.5), 0xc83a3a));                 // the foot
  B.push(paint(place(S(0.16, 8, 6), 0, 0.22, 0.52), 0xd8d0c0));                                          // the toe
  eyes(B, 1.0, 0.27, 0.12, 0.1);
  B.push(ooh(0.8, 0.29));
  // silly: a party hat with a pom-pom + a big polka bow + a grin
  X.push(paint(place(new ConeGeometry(0.17, 0.42, 12), 0.05, 1.56, 0, 0, 0, -0.22), 0x3a8ad8));
  X.push(paint(place(S(0.06, 8, 5), 0.1, 1.78, 0), 0xe8c84a));
  for (const sx of [-1, 1]) X.push(paint(place(S(0.1, 8, 5), sx * 0.12, 0.62, 0.28, 0, 0, 0, 1.2, 0.75, 0.5), 0xe8c84a));
  X.push(paint(place(S(0.05, 6, 4), 0, 0.62, 0.32), 0xe87ab0));
  X.push(cover(0.8, 0.29, 0xc83a3a), grin(0.8, 0.335, 0.08));
  return { B, F, X, h: 1.45 };
}
const MAKERS = { hat, pumpkin, ghost, cupboard, sock };
export const NAMES = { hat: 'כובע ענק ועצבני', pumpkin: 'דלעת מתנדנדת', ghost: 'סדין עם שיהוק', cupboard: 'ארונית עם גבות', sock: 'גרב ענקית' };

// one shape: { g, body, face, silly, h }; dispose with disposeShape
export function buildShape(kind) {
  const d = (MAKERS[kind] || hat)();
  const g = new Group(); g.name = 'b3-shape-' + kind;
  const body = mesh(d.B, 'b3-shape-body'), silly = mesh(d.X, 'b3-shape-silly');
  silly.visible = false; g.add(body, silly);
  return { g, body, silly, kind, h: d.h };
}
export function disposeShape(s) {
  if (!s) return;
  if (s.g.parent) s.g.parent.remove(s.g);
  for (const m of [s.body, s.silly]) { try { m.geometry.dispose(); } catch { /* backend quirk */ } }
}
export function disposeWardrobe(W) {
  if (!W) return;
  if (W.g.parent) W.g.parent.remove(W.g);
  W.g.traverse(o => { if (o.isMesh) { try { o.geometry.dispose(); } catch { /* backend quirk */ } } });
}
