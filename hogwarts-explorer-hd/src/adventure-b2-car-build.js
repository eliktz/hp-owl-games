// Book 2, quest 1 geometry (adventure-b2-car.js runs it): the on-rails sky scene 'b2sky'. All built in code, no disk
// textures (canvas <= 512 px), warm and friendly. Local frame: the car flies toward -z at local y 0 (the room group sits
// at FLOOR_Y); three lanes at x -2.6 / 0 / +2.6. The world scrolls past (a treadmill): the fields' texture offset, the
// viaduct's arches, clouds, stars and rings move toward +z.
// Parts: sky dome (follows the camera) | ground group (patchwork fields, the start pad at King's Cross, viaduct + red
// train) | clouds (one instanced mesh) | the turquoise Ford Anglia stand-in (< 3k tris, headlights like eyes, Ron and
// Harry inside under tinted glass) | two little standing kids for the hop-in | stars (instanced) | one smoke ring |
// the lawn + Whomping Willow (trunk, canopy, one slamming branch arm with a twig bundle per lane) + castle card |
// safe-lane hoop, branch shadows, the landing spot.
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, ConeGeometry, CapsuleGeometry,
  LatheGeometry, TubeGeometry, CircleGeometry, IcosahedronGeometry, ExtrudeGeometry, Shape, CatmullRomCurve3,
  Vector2, Vector3, Matrix4, Quaternion, Euler, Color, BufferAttribute, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture,
  InstancedMesh, DoubleSide, BackSide, SRGBColorSpace, RepeatWrapping, AdditiveBlending,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LANES = [-2.6, 0, 2.6];
export const FLY_GROUND = -28;     // the fields under the flight
export const LAWN_Y = -5;          // the Hogwarts lawn by the willow
export const WILLOW = { x: 0, z: -13, pivotY: 11 };
export const LAND = { x: 3.4, z: -3.2 };
const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew',Arial,sans-serif";

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); }
function paint(geo, hex) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(hex); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const merge = (list) => mergeGeometries(list.map(strip), false);
const vc = (opts = {}) => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...opts });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }
const S = (w, h) => new SphereGeometry(1, w, h);
const Cap = (w, h) => new SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI * 0.55);   // hair: a cap tilted back off the face
const noRay = (o) => { o.traverse(m => { if (m.isMesh) m.raycast = () => {}; }); return o; };
export const triCount = (o) => { let n = 0; o.traverse(m => { if (m.isMesh && m.visible !== false) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); } }); return Math.round(n); };
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// ---------------- the Ford Anglia (faces -z, wheels on y 0, about 3.9 m long) ----------------
export function buildCar() {
  const TURQ = 0x4aa8a4, TURQ2 = 0x3a8a88, ROOF = 0xd6d0c2, CHROME = 0xbcbcc0, TYRE = 0x26242a, DARK = 0x1a1a22, SKIN = 0xe8c49a;
  const root = new Group(); root.name = 'b2-car';
  const body = new Group(); root.add(body);   // body bobs / banks; wheels stay on it
  const B = [];
  B.push(paint(place(new CapsuleGeometry(0.42, 3.0, 4, 12).rotateX(Math.PI / 2), 0, 0.64, 0, 0, 0, 0, 1.9, 0.82, 1), TURQ));      // the round lower body
  B.push(paint(place(new BoxGeometry(1.5, 0.08, 3.2), 0, 0.98, 0), TURQ2));                                                          // the belt line
  B.push(paint(place(new BoxGeometry(1.36, 0.1, 1.62), 0, 1.47, 0.2), ROOF));                                                         // the white roof
  B.push(paint(place(S(12, 6), 0, 1.5, 0.2, 0, 0, 0, 0.7, 0.1, 0.84), ROOF));                                     // its rounded top
  for (const [x, z] of [[-0.64, -0.58], [0.64, -0.58], [-0.64, 0.98], [0.64, 0.98], [-0.66, 0.2], [0.66, 0.2]]) B.push(paint(place(new BoxGeometry(0.07, 0.5, 0.07), x, 1.2, z), ROOF));   // pillars
  for (const sx of [-1, 1]) {                                                                                                          // tail fins + chrome strip
    B.push(paint(place(new BoxGeometry(0.1, 0.26, 0.7), sx * 0.7, 1.02, 1.55, -0.25, 0, 0), TURQ));
    B.push(paint(place(new BoxGeometry(0.03, 0.04, 3.2), sx * 0.81, 0.72, 0), CHROME));
  }
  B.push(paint(place(new BoxGeometry(1.66, 0.14, 0.14), 0, 0.42, -1.92), CHROME));                                                     // bumpers
  B.push(paint(place(new BoxGeometry(1.66, 0.14, 0.14), 0, 0.42, 1.92), CHROME));
  B.push(paint(place(new TorusGeometry(0.34, 0.045, 6, 14, Math.PI), 0, 0.66, -1.88, 0, 0, Math.PI), CHROME));                          // the grille: a big smile
  for (const sx of [-1, 1]) {                                                                                                          // headlight rims + pupils (eyes)
    B.push(paint(place(new TorusGeometry(0.19, 0.035, 5, 10), sx * 0.48, 0.8, -1.84), CHROME));
    B.push(paint(place(S(10, 6), sx * 0.45, 0.82, -2.0, 0, 0, 0, 0.075, 0.085, 0.03), DARK));
    B.push(paint(place(S(6, 4), sx * 0.42, 0.86, -2.02, 0, 0, 0, 0.025, 0.025, 0.01), 0xffffff));
    B.push(paint(place(new BoxGeometry(0.16, 0.12, 0.05), sx * 0.58, 0.82, 1.97), 0xc0302a));                                          // tail lights
  }
  const W = [];
  for (const [x, z] of [[-0.74, -1.2], [0.74, -1.2], [-0.74, 1.15], [0.74, 1.15]]) {
    W.push(paint(place(new CylinderGeometry(0.3, 0.3, 0.22, 10), x, 0.3, z, 0, 0, Math.PI / 2), TYRE));
    W.push(paint(place(new CylinderGeometry(0.16, 0.16, 0.24, 8, 1), x, 0.3, z, 0, 0, Math.PI / 2), CHROME));
  }
  const mat = vc({ roughness: 0.45, metalness: 0.15 });
  const bodyMesh = new Mesh(merge([...B, ...W]), mat); bodyMesh.name = 'car-body'; body.add(bodyMesh);
  // Ron (left, red hair) and Harry (right, black hair + round glasses) inside: heads and shoulders, under the glass
  const P = [];
  for (const [x, hair, glasses] of [[-0.34, 0xc0521c, false], [0.34, 0x2a1a14, true]]) {
    P.push(paint(place(S(8, 5), x, 0.98, 0.25, 0, 0, 0, 0.26, 0.2, 0.22), 0x2a2030));                                                 // robe shoulders
    P.push(paint(place(S(10, 7), x, 1.22, 0.22, 0, 0, 0, 0.17, 0.18, 0.17), SKIN));                                                    // head
    P.push(paint(place(Cap(10, 4), x, 1.24, 0.25, 0.45, 0, 0, 0.185, 0.19, 0.19), hair));                                                  // hair cap
    if (glasses) for (const sx of [-1, 1]) P.push(paint(place(new TorusGeometry(0.045, 0.01, 3, 8), x + sx * 0.06, 1.24, 0.05), DARK));
    for (const sx of [-1, 1]) P.push(paint(place(S(6, 4), x + sx * 0.06, 1.24, 0.06, 0, 0, 0, 0.02), DARK));                            // eyes
  }
  const kids = new Mesh(merge(P), mat); kids.name = 'car-kids'; body.add(kids);
  const glass = new Mesh(merge([place(new BoxGeometry(1.3, 0.46, 1.58), 0, 1.2, 0.2)]), new MeshStandardMaterial({ color: 0x7aaec8, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.5, depthWrite: false }));
  glass.name = 'car-glass'; glass.renderOrder = 3; body.add(glass);
  const lamps = new Mesh(merge([0, 1].map(i => place(new SphereGeometry(0.17, 10, 8), (i ? 1 : -1) * 0.48, 0.8, -1.84, 0, 0, 0, 1, 1, 0.5))), new MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe6a0, emissiveIntensity: 0.9, roughness: 0.3 }));
  lamps.name = 'car-eyes'; body.add(lamps);
  noRay(root);
  return { root, body, kids, glass, lamps, mats: [mat] };
}

// a little standing kid (Ron or Harry) for the hop-in: one merged mesh, about 1.3 m
export function buildKid(hair, glasses = false, scarf = 0x8a1a1a) {
  const L = [], SKIN = 0xe8c49a, ROBE = 0x2a2030;
  L.push(paint(place(new ConeGeometry(0.34, 0.9, 12, 1, true), 0, 0.5, 0), ROBE));
  L.push(paint(place(new CircleGeometry(0.34, 12).rotateX(Math.PI / 2), 0, 0.05, 0), ROBE));
  L.push(paint(place(new TorusGeometry(0.15, 0.06, 6, 12), 0, 0.92, 0, Math.PI / 2, 0, 0), scarf));
  L.push(paint(place(S(14, 10), 0, 1.16, 0, 0, 0, 0, 0.27, 0.28, 0.26), SKIN));
  L.push(paint(place(Cap(14, 6), 0, 1.18, -0.03, -0.5, 0, 0, 0.29, 0.3, 0.29), hair));
  for (const sx of [-1, 1]) {
    L.push(paint(place(S(8, 6), sx * 0.09, 1.17, 0.24, 0, 0, 0, 0.035, 0.045, 0.02), 0x1a1a22));
    L.push(paint(place(S(6, 4), sx * 0.16, 1.08, 0.22, 0, 0, 0, 0.05, 0.035, 0.02), 0xe89a8a));
    if (glasses) L.push(paint(place(new TorusGeometry(0.065, 0.012, 4, 12), sx * 0.09, 1.17, 0.26), 0x1a1a22));
    L.push(paint(place(new CapsuleGeometry(0.06, 0.34, 3, 6), sx * 0.3, 0.68, 0.02, 0, 0, sx * 0.35), ROBE));
    L.push(paint(place(S(6, 4), sx * 0.38, 0.5, 0.04, 0, 0, 0, 0.065), SKIN));
  }
  L.push(paint(place(new TorusGeometry(0.06, 0.015, 4, 8, Math.PI), 0, 1.06, 0.245, 0, 0, Math.PI), 0x8a3a2a));   // a smile
  const m = new Mesh(merge(L), vc()); m.name = 'b2-kid'; noRay(m); return m;
}

// ---------------- the sky scene ----------------
function fieldsTex() {
  const t = canvasTex(512, 512, (x, w, h) => {
    const r = rng(7), cols = ['#7fa857', '#93b862', '#a8b86a', '#c8b866', '#6e9a4e', '#b8a05a', '#88ac5c', '#9cbc72', '#a89a62', '#7a9c58'];
    x.fillStyle = '#7a9a52'; x.fillRect(0, 0, w, h);
    // a grid of fields, jittered, each with faint plough stripes
    const N = 6, s = w / N;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const c = cols[Math.floor(r() * cols.length)]; x.fillStyle = c; x.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      x.strokeStyle = 'rgba(60,70,30,.18)'; x.lineWidth = 2; const vert = r() < 0.5;
      for (let k = 6; k < s - 6; k += 7) { x.beginPath(); if (vert) { x.moveTo(i * s + k, j * s + 4); x.lineTo(i * s + k, j * s + s - 4); } else { x.moveTo(i * s + 4, j * s + k); x.lineTo(i * s + s - 4, j * s + k); } x.stroke(); }
    }
    // hedges + little trees along the field edges
    x.strokeStyle = '#3e5a2a'; x.lineWidth = 5;
    for (let i = 0; i <= N; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, h); x.stroke(); x.beginPath(); x.moveTo(0, i * s); x.lineTo(w, i * s); x.stroke(); }
    for (let k = 0; k < 140; k++) { const px = Math.round(r() * N) * s + (r() - 0.5) * 6, py = r() * h, f = r() < 0.5; x.fillStyle = r() < 0.5 ? '#34502a' : '#46663a'; x.beginPath(); x.arc(f ? px : py, f ? py : px, 4 + r() * 4, 0, 7); x.fill(); }
    // a winding river and a lane
    x.strokeStyle = '#6a9ac0'; x.lineWidth = 9; x.beginPath(); x.moveTo(w * 0.72, 0); x.bezierCurveTo(w * 0.55, h * 0.3, w * 0.9, h * 0.6, w * 0.7, h); x.stroke();
    x.strokeStyle = '#d8cca4'; x.lineWidth = 5; x.beginPath(); x.moveTo(w * 0.2, 0); x.bezierCurveTo(w * 0.35, h * 0.4, w * 0.1, h * 0.7, w * 0.25, h); x.stroke();
    // sheep (tiny white dots) and a few cottages
    for (let k = 0; k < 40; k++) { x.fillStyle = '#f0ece0'; x.beginPath(); x.arc(r() * w, r() * h, 1.8, 0, 7); x.fill(); }
    for (let k = 0; k < 6; k++) { const px = r() * w, py = r() * h; x.fillStyle = '#e0d4b8'; x.fillRect(px, py, 9, 7); x.fillStyle = '#8a3a2a'; x.fillRect(px - 1, py - 3, 11, 4); }
  });
  t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 4; return t;
}
function cloudTex() {
  return canvasTex(256, 128, (x, w, h) => {
    const r = rng(3);
    for (let k = 0; k < 16; k++) {
      const cx = 40 + r() * 176, cy = 64 + (r() - 0.3) * 30, rr = 20 + r() * 26;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(250,250,255,0.7)'); g.addColorStop(1, 'rgba(240,244,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.fill();
    }
  });
}
function castleTex() {
  return canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#4a5068';
    const tower = (cx, tw, th, roof = 1.0) => { x.fillRect(cx - tw / 2, h - th, tw, th); x.beginPath(); x.moveTo(cx - tw / 2 - 4, h - th); x.lineTo(cx, h - th - tw * 1.6 * roof); x.lineTo(cx + tw / 2 + 4, h - th); x.fill(); };
    x.fillRect(60, h - 90, 400, 90);
    for (const [cx, tw, th] of [[90, 26, 130], [150, 34, 170], [215, 22, 120], [260, 44, 205], [320, 26, 150], [370, 36, 180], [430, 24, 125], [470, 18, 100]]) tower(cx, tw, th);
    x.fillStyle = '#ffd88a'; const r = rng(11);
    for (let k = 0; k < 40; k++) { x.fillRect(70 + r() * 380, h - 20 - r() * 150, 3, 5); }
  });
}
function archTex() {
  const t = canvasTex(128, 64, (x, w, h) => {
    x.fillStyle = '#a87a5a'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(70,40,30,.25)'; for (let i = 0; i < 8; i++) x.fillRect(0, i * 8, w, 1);
    x.fillStyle = '#3a4a3a'; x.beginPath(); x.moveTo(16, h); x.lineTo(16, 30); x.arc(64, 30, 48, Math.PI, 0); x.lineTo(112, h); x.fill();
  });
  t.wrapS = t.wrapT = RepeatWrapping; return t;
}

export function buildSky() {
  const g = new Group(); g.name = 'adv-b2sky';
  // the sky dome (follows the camera; no fog): warm blue, hazy toward the horizon
  const skyT = canvasTex(4, 256, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a72bc'); gr.addColorStop(0.3, '#5e96d4'); gr.addColorStop(0.44, '#94bce4'); gr.addColorStop(0.5, '#c4d8e8'); gr.addColorStop(0.56, '#c8d8e2'); gr.addColorStop(1, '#b8ccd8'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  const dome = new Mesh(new SphereGeometry(420, 24, 14), new MeshBasicMaterial({ map: skyT, side: BackSide, fog: false, depthWrite: false }));
  dome.name = 'sky-dome'; dome.renderOrder = -5; dome.frustumCulled = false; g.add(dome);
  const sun = new Mesh(new PlaneGeometry(46, 46), new MeshBasicMaterial({ map: canvasTex(128, 128, (x) => { const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,220,.95)'); gr.addColorStop(0.2, 'rgba(255,240,190,.55)'); gr.addColorStop(1, 'rgba(255,230,170,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); }), transparent: true, fog: false, depthWrite: false, blending: AdditiveBlending }));
  sun.position.set(-120, 150, -330); sun.lookAt(0, 0, 0); sun.name = 'sun'; sun.renderOrder = -4; g.add(sun);

  // ground group: the fields, the start pad, the viaduct + train
  const ground = new Group(); ground.name = 'ground'; g.add(ground);
  const fT = fieldsTex(); fT.repeat.set(6, 6);
  const fields = new Mesh(new PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2), new MeshStandardMaterial({ map: fT, roughness: 1 })); fields.name = 'fields'; ground.add(fields);
  // the start pad: a quiet lane by King's Cross (a grass verge, the road, a brick wall with a sign, a lamp post)
  const pad = new Group(); pad.name = 'pad'; ground.add(pad);
  const PD = [];
  PD.push(paint(place(new CircleGeometry(16, 24).rotateX(-Math.PI / 2), 0, 0.03, 0), 0x6e9a4e));
  PD.push(paint(place(new PlaneGeometry(5, 32).rotateX(-Math.PI / 2), 0, 0.05, 0), 0x6a6460));
  for (let k = -6; k <= 6; k++) PD.push(paint(place(new PlaneGeometry(0.18, 1.2).rotateX(-Math.PI / 2), 0, 0.06, k * 2.4), 0xd8d0b0));
  PD.push(paint(place(new BoxGeometry(0.5, 2.4, 18), 5.4, 1.2, 2), 0x9a5a3e));
  PD.push(paint(place(new BoxGeometry(0.6, 0.16, 18.2), 5.4, 2.46, 2), 0x7a7068));
  PD.push(paint(place(new CylinderGeometry(0.07, 0.09, 3.6, 8), -3.4, 1.8, 3), 0x2e2b30));
  PD.push(paint(place(new BoxGeometry(0.4, 0.45, 0.4), -3.4, 3.75, 3), 0x2e2b30));
  for (const z of [-6, 6]) PD.push(paint(place(IcoS(1.3), -6.2, 1.0, z, 0, 0, 0, 1.3, 1, 1.3), 0x4e7a3a));
  pad.add(new Mesh(merge(PD), vc({ roughness: 0.95 })));
  const lampGlow = new Mesh(new BoxGeometry(0.3, 0.32, 0.3), new MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffd080, emissiveIntensity: 0.8 })); lampGlow.position.set(-3.4, 3.7, 3); pad.add(lampGlow);
  const sign = new Mesh(new PlaneGeometry(4.2, 1.3), new MeshBasicMaterial({ map: canvasTex(384, 120, (x, w, h) => {
    x.fillStyle = '#1a3a6a'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 14); x.fill(); x.strokeStyle = '#f0e8d0'; x.lineWidth = 6; x.stroke();
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#f4ecd8'; x.font = 'bold 44px ' + FONT; x.fillText('קינגס קרוס 🚂', w / 2, h / 2 + 2); }) }));
  sign.position.set(5.1, 1.6, 1.0); sign.rotation.y = -Math.PI / 2; sign.name = 'kings-cross-sign'; pad.add(sign);
  // the viaduct (one long box, arches scroll) and the little red steam train on it
  const aT = archTex(); aT.repeat.set(1200 / 14, 1);
  const viaduct = new Group(); viaduct.name = 'viaduct'; viaduct.position.set(-24, 0, 0); ground.add(viaduct);
  const vside = new MeshStandardMaterial({ map: aT, roughness: 0.95 });
  for (const sx of [-1, 1]) { const p = new Mesh(new PlaneGeometry(1200, 10).rotateY(sx * Math.PI / 2), vside); p.position.set(sx * 2.2, 5, 0); viaduct.add(p); }
  const top = new Mesh(new BoxGeometry(4.6, 0.5, 1200), new MeshStandardMaterial({ color: 0x8a6a52, roughness: 0.95 })); top.position.y = 10; viaduct.add(top);
  const TR = [], RED = 0xb0282a, BLACK = 0x26222a, GOLD = 0xc8a040;
  TR.push(paint(place(new CylinderGeometry(0.7, 0.7, 4.2, 14), 0, 1.3, -2.4, Math.PI / 2, 0, 0), RED));          // boiler
  TR.push(paint(place(new BoxGeometry(1.9, 2.0, 1.8), 0, 1.6, 0.2), RED));                                       // cab
  TR.push(paint(place(new BoxGeometry(2.1, 0.18, 2.0), 0, 2.66, 0.2), BLACK));
  TR.push(paint(place(new CylinderGeometry(0.28, 0.2, 1.0, 10), 0, 2.4, -3.8), BLACK));                           // chimney
  TR.push(paint(place(new CylinderGeometry(0.74, 0.74, 0.12, 14), 0, 1.3, -4.5, Math.PI / 2, 0, 0), BLACK));
  TR.push(paint(place(new BoxGeometry(1.9, 0.5, 6.4), 0, 0.35, -1.6), BLACK));
  for (let k = 0; k < 3; k++) { const z = 4.6 + k * 5.6; TR.push(paint(place(new BoxGeometry(2.0, 2.1, 5.0), 0, 1.45, z), RED)); TR.push(paint(place(new BoxGeometry(2.2, 0.16, 5.1), 0, 2.56, z), BLACK)); for (const sx of [-1, 1]) TR.push(paint(place(new BoxGeometry(0.04, 0.6, 3.8), sx * 1.01, 1.8, z), 0xf0d890)); TR.push(paint(place(new BoxGeometry(2.02, 0.1, 5.0), 0, 1.05, z), GOLD)); }
  for (let k = 0; k < 8; k++) for (const sx of [-1, 1]) TR.push(paint(place(new CylinderGeometry(0.34, 0.34, 0.14, 10), sx * 0.9, 0.34, -3.6 + k * 2.6, 0, 0, Math.PI / 2), BLACK));
  const train = new Mesh(merge(TR), vc({ roughness: 0.55 })); train.name = 'train'; train.position.set(0, 10.25, -40); viaduct.add(train);

  // clouds: one instanced mesh of soft cards
  const NC = 16;
  const clouds = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: cloudTex(), transparent: true, depthWrite: false, fog: true }), NC);
  clouds.name = 'clouds'; clouds.frustumCulled = false; clouds.renderOrder = 1; g.add(clouds);
  // the car + the hop-in kids
  const car = buildCar(); car.root.scale.setScalar(1.2); g.add(car.root);
  const ron = buildKid(0xc0521c), harry = buildKid(0x2a1a14, true);
  ron.position.set(-1.5, 0, 0.3); harry.position.set(1.5, 0, 0.6); g.add(ron, harry);
  // stars (instanced, gold, they glow: a true light) and one smoke ring
  const sh = new Shape(); for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 0.26 : 0.6; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starGeo = new ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 }).translate(0, 0, -0.08);
  const stars = new InstancedMesh(starGeo, new MeshStandardMaterial({ color: 0xffcc40, emissive: 0xffb020, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.3 }), 4);
  stars.name = 'stars'; stars.count = 0; stars.frustumCulled = false; g.add(stars);
  const ring = new Mesh(new TorusGeometry(1.5, 0.3, 10, 28), new MeshStandardMaterial({ color: 0xf2f0ec, roughness: 1, transparent: true, opacity: 0.88, depthWrite: false }));
  ring.name = 'smoke-ring'; ring.visible = false; g.add(ring);

  // the lawn, the castle on the horizon and the Whomping Willow (a group that slides in for step 4)
  const lawnG = new Group(); lawnG.name = 'lawn'; lawnG.visible = false; g.add(lawnG);
  const LW = [];
  LW.push(paint(place(new CircleGeometry(90, 40).rotateX(-Math.PI / 2), 0, LAWN_Y, -20), 0x6a9a48));
  LW.push(paint(place(new CircleGeometry(9, 24).rotateX(-Math.PI / 2), WILLOW.x, LAWN_Y + 0.04, WILLOW.z), 0x5a7a3a));
  for (const [x, z, s] of [[-14, -30, 3], [16, -36, 3.6], [-22, -8, 2.6], [20, -6, 2.4], [-9, -50, 3.2]]) LW.push(paint(place(IcoS(1), x, LAWN_Y + s * 0.9, z, 0, 0, 0, s, s * 1.1, s), 0x4a7238));
  lawnG.add(new Mesh(merge(LW), vc({ roughness: 1 })));
  const castle = new Mesh(new PlaneGeometry(170, 85), new MeshBasicMaterial({ map: castleTex(), transparent: true, depthWrite: false }));
  castle.position.set(-10, LAWN_Y + 36, -190); castle.name = 'castle-card'; lawnG.add(castle);
  const willow = buildWillow(); willow.root.position.set(WILLOW.x, LAWN_Y, WILLOW.z); lawnG.add(willow.root);
  // the safe-lane hoop (glows green-gold), the branch shadows on the lawn (one per lane), the landing spot
  const hoop = new Mesh(new TorusGeometry(1.45, 0.12, 8, 30), new MeshBasicMaterial({ color: 0x9cffa0, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }));
  hoop.name = 'safe-hoop'; hoop.visible = false; g.add(hoop);
  const shadowT = canvasTex(64, 64, (x) => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(0.7, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); });
  const shadows = LANES.map((lx) => { const m = new Mesh(new PlaneGeometry(2.6, 5).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: shadowT, transparent: true, depthWrite: false, opacity: 0 })); m.position.set(lx, LAWN_Y + 0.08, -2.2); m.scale.set(1, 1, 1.3); m.visible = false; m.renderOrder = 2; g.add(m); return m; });
  const landT = canvasTex(128, 128, (x) => { x.strokeStyle = '#fff2a0'; x.lineWidth = 10; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.stroke(); x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 32, 0, 7); x.stroke(); x.font = 'bold 44px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff2a0'; x.fillText('H', 64, 66); });
  const land = new Mesh(new PlaneGeometry(4.4, 4.4).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: landT, transparent: true, depthWrite: false, blending: AdditiveBlending, color: 0xffe070 }));
  land.position.set(LAND.x, LAWN_Y + 0.1, LAND.z); land.visible = false; land.name = 'land-spot'; land.renderOrder = 3; g.add(land);
  noRay(g);
  return { g, P: { dome, ground, fields, fT, aT, pad, viaduct, train, clouds, NC, car, ron, harry, stars, ring, lawnG, willow, hoop, shadows, land } };
}
function IcoS(r) { return new IcosahedronGeometry(r, 1); }

// ---------------- the Whomping Willow: a gnarled trunk, a droopy canopy, ONE slamming branch arm ----------------
// The arm hangs from the trunk (pivot WILLOW.pivotY over the lawn) and points toward +z; rotation.x ~ -1.2 is raised,
// SLAM_RX brings its tip down to the car's height at z 0. Each lane has its own twig bundle at the tip (shown for the
// lanes this sweep hits), so a sweep can leave any one lane safe.
export function buildWillow() {
  const root = new Group(); root.name = 'b2-willow';
  const BARK = 0x5a4632, BARK2 = 0x4a3a2a, LEAF = 0x5a8a3e, LEAF2 = 0x6e9e48;
  const T = [];
  const prof = [[2.0, 0], [1.5, 0.6], [1.15, 1.8], [1.25, 3.4], [1.0, 5.2], [1.15, 6.6], [0.8, 8.4], [0.4, 10]].map(([r, y]) => new Vector2(r, y));
  const trunk = new LatheGeometry(prof, 12); const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = 0.35 * Math.sin(y * 0.7); const x = p.getX(i), z = p.getZ(i); p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a) + Math.sin(y * 0.5) * 0.3, y, x * Math.sin(a) + z * Math.cos(a)); }
  trunk.computeVertexNormals(); T.push(paint(trunk, BARK));
  for (let k = 0; k < 5; k++) { const a = k * 1.26; T.push(paint(place(new ConeGeometry(0.5, 3.2, 6), Math.cos(a) * 1.8, 0.3, Math.sin(a) * 1.8, Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2), BARK2)); }   // roots
  // gnarly side limbs up top (static) + the canopy of droopy clumps
  const limb = (pts, r) => new TubeGeometry(new CatmullRomCurve3(pts.map(([x, y, z]) => new Vector3(x, y, z))), 10, r, 6, false);
  T.push(paint(limb([[0, 8, 0], [-2.5, 10, -0.5], [-4.6, 10.4, -1.2], [-6, 9, -1]], 0.32), BARK));
  T.push(paint(limb([[0, 8.6, 0], [2.4, 10.6, -1], [4.8, 11, -0.6], [6.2, 9.6, 0]], 0.3), BARK));
  T.push(paint(limb([[0, 9.5, 0], [0.4, 12, -1.6], [-0.6, 13.2, -3]], 0.28), BARK));
  const C = [];
  for (const [x, y, z, s] of [[-5.6, 9.6, -1, 2.0], [5.8, 10.2, 0, 2.1], [0, 12.6, -2.4, 2.4], [-2.6, 11.4, -2, 2.0], [2.8, 11.6, -2.2, 2.1], [-1.4, 10.8, 1.0, 1.6], [1.8, 10.4, 1.2, 1.5]]) {
    C.push(paint(place(IcoS(1), x, y, z, 0, 0, 0, s, s * 0.9, s), (x > 0) ? LEAF : LEAF2));
    for (let k = 0; k < 3; k++) C.push(paint(place(new ConeGeometry(0.5, 2.6, 5), x + (k - 1) * s * 0.55, y - s * 0.9 - 0.8, z + (k % 2) * 0.4, Math.PI, 0, 0), LEAF2));   // droopy fronds
  }
  const face = [];   // a friendly knot "face" on the trunk: two knot eyes and a curved crack smile
  for (const sx of [-1, 1]) face.push(paint(place(S(8, 6), sx * 0.45, 4.3, 1.08, 0, 0, 0, 0.2, 0.26, 0.1), 0x2a1e14));
  face.push(paint(place(new TorusGeometry(0.42, 0.06, 4, 10, Math.PI), 0, 3.6, 1.12, 0, 0, Math.PI), 0x2a1e14));
  const mat = vc({ roughness: 0.95 });
  const tree = new Mesh(merge([...T, ...C, ...face]), mat); tree.name = 'willow-tree'; root.add(tree);
  // the slamming arm
  const arm = new Group(); arm.name = 'willow-arm'; arm.position.set(0, WILLOW.pivotY, 0.6); root.add(arm);
  const L = Math.hypot(WILLOW.pivotY - (0.7 - LAWN_Y), -WILLOW.z - 0.6);   // pivot -> the car (y 0.7, z 0)
  const am = new Mesh(merge([paint(limb([[0, 0, 0], [0, 0.6, L * 0.3], [0, 0.4, L * 0.65], [0, 0, L]], 0.34), BARK)]), mat); arm.add(am);
  const bundles = LANES.map((lx) => {
    const b = []; b.push(paint(limb([[0, 0, L - 0.4], [lx * 0.5, 0.3, L], [lx, 0, L + 0.2]], 0.15), BARK2));
    for (let k = 0; k < 4; k++) b.push(paint(place(new ConeGeometry(0.4, 1.8, 5), lx + (k - 1.5) * 0.55, -0.6, L + 0.2 + (k % 2) * 0.3, Math.PI + (k - 1.5) * 0.15, 0, 0), LEAF));
    b.push(paint(place(IcoS(1), lx, 0.1, L + 0.2, 0, 0, 0, 0.9, 0.55, 0.7), LEAF2));
    const m = new Mesh(merge(b), mat); m.name = 'willow-bundle'; arm.add(m); return m;
  });
  const SLAM_RX = Math.atan2(WILLOW.pivotY - (0.7 - LAWN_Y), -WILLOW.z - 0.6);
  noRay(root);
  return { root, tree, arm, bundles, SLAM_RX, REST_RX: -0.12 };   // at rest the arm hangs over the lanes, high and in view
}
export { FONT };
