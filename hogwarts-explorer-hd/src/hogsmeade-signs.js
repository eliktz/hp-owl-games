// Hogsmeade milestone 2 (briefs/2026-11-27-hogsmeade-m2-decisions.md): the Hebrew signs of the three named shops, painted in
// the game on the model's blank boards. ONE canvas atlas (1024 x 704) and ONE merged mesh (1 draw) for every board the sidecar
// lists under `signs` (a missing key is skipped):
//   broomsticks_fascia  "שלושת המטאטאים" between two little fans of three brooms
//   broomsticks_hanging three brooms in a fan over "שלושת המטאטאים" (both faces)
//   zonko_fascia        "חנות התעלולים של זונקו" between yellow stars
//   zonko_hanging       a striped ball, stars, "זונקו" (both faces)
//   hogshead_hanging    a friendly round smiling boar face over "ראש החזיר" (both faces)
// Each board: {x, y, z, w, h, ry} in the street (room) frame; ry = rotation about +Y of the board normal (0 = facing +z).
// A fascia is one quad 1 cm in front of the board; a hanging board gets a quad on each face (a back face shows the same art,
// not mirrored). Painted-wood look: a dark board with a faint grain, a thin gold border, cream / gold lettering; every colour
// <= 0.84 (sRGB 214), so only real light sources bloom. Unlit MeshBasicMaterial with the default tone mapping, exactly like the
// Honeydukes street signs (hogsmeade-street-build.js buildSigns).
import { Mesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, Matrix4, Vector3, Quaternion, Euler } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FONT } from './adventure-b3-map-build.js';

export const SHOP_SIGN_KEYS = ['broomsticks_hanging', 'broomsticks_fascia', 'zonko_fascia', 'zonko_hanging', 'hogshead_hanging'];
const AW = 1024, AH = 704;
const RECT = {
  broomsticks_fascia: { x: 0, y: 0, w: 1024, h: 160 },
  zonko_fascia: { x: 0, y: 168, w: 1024, h: 180 },
  broomsticks_hanging: { x: 0, y: 356, w: 340, h: 340 },
  zonko_hanging: { x: 342, y: 356, w: 340, h: 340 },
  hogshead_hanging: { x: 684, y: 356, w: 340, h: 340 },
};
const HANGING = (k) => /_hanging$/.test(k);
export const HANG_FRONT = 0.02, HANG_BACK = 0.072;   // hanging-board faces: in front of / behind the sidecar point (metres)
const CREAM = '#d4c69e', GOLD = '#c8a04e', GOLD_D = '#8a6a36', INK = '#1a0e08';

// ---------------- painting ----------------
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function board(x, r, base = '#3e2818', dark = '#2c1a10', seed = 1) {
  x.save(); x.beginPath(); x.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 14); x.clip();
  const g = x.createLinearGradient(r.x, r.y, r.x, r.y + r.h); g.addColorStop(0, base); g.addColorStop(1, dark); x.fillStyle = g; x.fillRect(r.x, r.y, r.w, r.h);
  const R = rnd(seed); x.lineWidth = 2;   // a faint grain along the board
  for (let i = 0; i < r.h / 5; i++) { const yy = r.y + R() * r.h; x.strokeStyle = R() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(150,110,70,.10)'; x.beginPath(); x.moveTo(r.x, yy); for (let k = 0; k <= 8; k++) x.lineTo(r.x + k * r.w / 8, yy + Math.sin(k * 1.3 + i) * 2.5); x.stroke(); }
  x.restore();
  x.strokeStyle = GOLD; x.lineWidth = 6; x.beginPath(); x.roundRect(r.x + 9, r.y + 9, r.w - 18, r.h - 18, 10); x.stroke();
  x.strokeStyle = GOLD_D; x.lineWidth = 2; x.beginPath(); x.roundRect(r.x + 17, r.y + 17, r.w - 34, r.h - 34, 7); x.stroke();
}
function text(x, str, cx, cy, maxW, px, fill = CREAM) {
  x.save(); x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = px; do { x.font = 'bold ' + size + 'px ' + FONT; if (x.measureText(str).width <= maxW) break; size -= 2; } while (size > 12);
  x.fillStyle = INK; x.globalAlpha = 0.7; x.fillText(str, cx + 2, cy + 3); x.globalAlpha = 1; x.fillStyle = fill; x.fillText(str, cx, cy);
  x.restore();
}
function star(x, cx, cy, r, fill) {
  x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath();
  x.fillStyle = fill; x.fill(); x.strokeStyle = 'rgba(40,20,10,.5)'; x.lineWidth = 2; x.stroke();
}
// a little broom: pivot at the handle's end, bristles at the far end (length L, angle a from straight up)
function broom(x, px, py, L, a) {
  x.save(); x.translate(px, py); x.rotate(a); x.lineCap = 'round';
  x.strokeStyle = '#a2744a'; x.lineWidth = Math.max(3, L * 0.055); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -L * 0.64); x.stroke();
  x.fillStyle = '#c4a058'; x.beginPath(); x.moveTo(-L * 0.06, -L * 0.62); x.lineTo(L * 0.06, -L * 0.62); x.lineTo(L * 0.15, -L); x.quadraticCurveTo(0, -L * 1.04, -L * 0.15, -L); x.closePath(); x.fill();
  x.strokeStyle = '#8e6c34'; x.lineWidth = Math.max(1, L * 0.012); for (let k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(k * L * 0.02, -L * 0.65); x.lineTo(k * L * 0.05, -L * 0.98); x.stroke(); }
  x.fillStyle = '#6a4626'; x.fillRect(-L * 0.075, -L * 0.66, L * 0.15, L * 0.05);
  x.restore();
}
const fan = (x, px, py, L) => { for (const a of [-0.48, 0, 0.48]) broom(x, px, py, L, a); };
function stripedBall(x, cx, cy, r) {
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
  const cols = ['#d4782a', '#d4c69e', '#8a4aa8', '#d4b42e', '#3a9a8a'];
  x.translate(cx, cy); x.rotate(-0.5);
  for (let i = -5; i <= 5; i++) { x.fillStyle = cols[(i + 10) % cols.length]; x.fillRect(i * r * 0.34 - r * 0.17, -r * 1.2, r * 0.34 + 1, r * 2.4); }
  x.restore();
  const hl = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 0.7); hl.addColorStop(0, 'rgba(255,250,235,.45)'); hl.addColorStop(1, 'rgba(255,250,235,0)');
  x.fillStyle = hl; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(30,16,10,.7)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
}
// a kind cartoon boar: round face, round ears, a big snout, small happy eyes, rosy cheeks, a smile, two tiny tusks
function boar(x, cx, cy, r) {
  const SKIN = '#a8745a', SKIN_D = '#7e5440', PINK = '#cc8e7e', LINE = '#3a2014';
  for (const sd of [-1, 1]) {   // ears
    x.fillStyle = SKIN; x.beginPath(); x.ellipse(cx + sd * r * 0.68, cy - r * 0.72, r * 0.3, r * 0.4, sd * 0.5, 0, Math.PI * 2); x.fill();
    x.fillStyle = PINK; x.beginPath(); x.ellipse(cx + sd * r * 0.68, cy - r * 0.7, r * 0.15, r * 0.24, sd * 0.5, 0, Math.PI * 2); x.fill();
  }
  const g = x.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.2, cx, cy, r); g.addColorStop(0, '#b8846a'); g.addColorStop(1, SKIN_D);
  x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, r, r * 0.92, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = LINE; x.lineWidth = 3; x.stroke();
  x.fillStyle = SKIN_D; x.beginPath(); x.moveTo(cx - r * 0.12, cy - r * 0.9); x.quadraticCurveTo(cx, cy - r * 1.12, cx + r * 0.1, cy - r * 0.9); x.fill();   // a little tuft
  for (const sd of [-1, 1]) {
    x.fillStyle = 'rgba(214,120,120,.45)'; x.beginPath(); x.arc(cx + sd * r * 0.55, cy + r * 0.2, r * 0.17, 0, Math.PI * 2); x.fill();   // rosy cheeks
    x.fillStyle = '#24140c'; x.beginPath(); x.arc(cx + sd * r * 0.34, cy - r * 0.2, r * 0.1, 0, Math.PI * 2); x.fill();                   // eyes
    x.fillStyle = '#d4ccc0'; x.beginPath(); x.arc(cx + sd * r * 0.34 - r * 0.03, cy - r * 0.24, r * 0.035, 0, Math.PI * 2); x.fill();     // a sparkle in each
  }
  x.fillStyle = PINK; x.beginPath(); x.ellipse(cx, cy + r * 0.2, r * 0.42, r * 0.3, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = SKIN_D; x.lineWidth = 3; x.stroke();   // the snout
  x.fillStyle = '#6a3a2a'; for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(cx + sd * r * 0.15, cy + r * 0.2, r * 0.06, r * 0.1, 0, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = LINE; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.arc(cx, cy + r * 0.36, r * 0.32, 0.25 * Math.PI, 0.75 * Math.PI); x.stroke();   // a smile
  x.fillStyle = '#d4c8a8'; for (const sd of [-1, 1]) { const tx = cx + sd * r * 0.3, ty = cy + r * 0.6; x.beginPath(); x.moveTo(tx - r * 0.05, ty); x.lineTo(tx + r * 0.05, ty); x.lineTo(tx + sd * r * 0.03, ty - r * 0.16); x.closePath(); x.fill(); }   // tiny tusks
}

let _atlas = null;
export function signAtlas() {
  if (_atlas) return _atlas;
  const c = document.createElement('canvas'); c.width = AW; c.height = AH; const x = c.getContext('2d');
  x.fillStyle = '#2c1a10'; x.fillRect(0, 0, AW, AH);
  let r = RECT.broomsticks_fascia; board(x, r, '#40281a', '#2e1c10', 3);
  fan(x, r.x + 86, r.y + r.h - 26, 112); fan(x, r.x + r.w - 86, r.y + r.h - 26, 112);
  text(x, 'שלושת המטאטאים', r.x + r.w / 2, r.y + r.h / 2 + 4, r.w - 330, 96);
  r = RECT.zonko_fascia; board(x, r, '#40284a', '#2a1a32', 5);
  for (const [sx, sy, sr, col] of [[64, 58, 30, '#d4b42e'], [118, 120, 18, '#d4782a'], [r.w - 64, 58, 30, '#d4b42e'], [r.w - 118, 120, 18, '#d4782a'], [40, 140, 10, '#c8a04e'], [r.w - 40, 140, 10, '#c8a04e']]) star(x, r.x + sx, r.y + sy, sr, col);
  text(x, 'חנות התעלולים של זונקו', r.x + r.w / 2, r.y + r.h / 2 + 4, r.w - 300, 84);
  r = RECT.broomsticks_hanging; board(x, r, '#40281a', '#2e1c10', 7);
  fan(x, r.x + r.w / 2, r.y + 206, 150);
  text(x, 'שלושת', r.x + r.w / 2, r.y + 240, r.w - 60, 46); text(x, 'המטאטאים', r.x + r.w / 2, r.y + 290, r.w - 60, 46);
  r = RECT.zonko_hanging; board(x, r, '#40284a', '#2a1a32', 9);
  stripedBall(x, r.x + r.w / 2, r.y + 138, 74);
  for (const [sx, sy, sr, col] of [[56, 60, 22, '#d4b42e'], [r.w - 56, 64, 18, '#d4782a'], [62, 196, 14, '#d4782a'], [r.w - 60, 200, 22, '#d4b42e']]) star(x, r.x + sx, r.y + sy, sr, col);
  text(x, 'זונקו', r.x + r.w / 2, r.y + 276, r.w - 70, 74, GOLD);
  r = RECT.hogshead_hanging; board(x, r, '#36241a', '#24160e', 11);
  boar(x, r.x + r.w / 2, r.y + 142, 84);
  text(x, 'ראש החזיר', r.x + r.w / 2, r.y + 288, r.w - 60, 52);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  _atlas = t; return t;
}

// ---------------- the merged mesh ----------------
const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _o = new Vector3(), _s = new Vector3(1, 1, 1);
function quad(key, w, h, cx, cy, cz, ry, off) {
  const r = RECT[key], g = new PlaneGeometry(w, h), uv = g.attributes.uv, pad = 3;
  const u0 = (r.x + pad) / AW, u1 = (r.x + r.w - pad) / AW, v0 = 1 - (r.y + r.h - pad) / AH, v1 = 1 - (r.y + pad) / AH;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  _q.setFromEuler(_e.set(0, ry, 0)); _o.set(0, 0, off).applyQuaternion(_q);
  return g.applyMatrix4(_m.compose(_v.set(cx + _o.x, cy, cz + _o.z), _q, _s));
}
// side.signs -> { mesh (or null), keys }
export function buildShopSigns(side) {
  const S = (side && side.signs) || {}, parts = [], keys = [];
  for (const k of SHOP_SIGN_KEYS) {
    const s = S[k]; if (!s || ![s.x, s.y, s.z, s.w, s.h].every(Number.isFinite)) continue;
    const ry = s.ry || 0;
    if (HANGING(k)) {
      // square art, a little inset so the model's board edge frames it. The sidecar point is the board's FRONT face, not its centre:
      // the v2 boards span -0.061..+0.009 m along the normal from it, so the faces go 1 cm outside each side (never inside the board)
      const sz = Math.min(s.w, s.h) * 0.94, tf = s.tf ?? HANG_FRONT, tb = s.tb ?? HANG_BACK;
      parts.push(quad(k, sz, sz, s.x, s.y, s.z, ry, tf), quad(k, sz, sz, s.x, s.y, s.z, ry + Math.PI, tb));
    } else parts.push(quad(k, s.w * 0.98, s.h * 0.94, s.x, s.y, s.z, ry, 0.012));
    keys.push(k);
  }
  if (!parts.length) return { mesh: null, keys };
  const mesh = new Mesh(mergeGeometries(parts, false), new MeshBasicMaterial({ map: signAtlas() }));
  mesh.name = 'hm-shop-signs'; mesh.frustumCulled = false; mesh.raycast = () => {};
  return { mesh, keys };
}
