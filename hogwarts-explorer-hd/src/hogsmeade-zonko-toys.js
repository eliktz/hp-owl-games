// Hogsmeade milestone 4: the five Zonko's toys (code-built, bright, each tappable: Harry walks next to it, then it plays 2 to 4 s,
// a short kind bubble; no faces, nothing jumps at the child). Trying all five in one visit: a happy bubble and the small
// free-play reward (once per session). The confetti popper also puts a pointed party hat on Harry for 12 s.
import { Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry, LatheGeometry, ExtrudeGeometry, Shape, PlaneGeometry,
  InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, DoubleSide, Vector2, Vector3, Object3D, Color, BufferAttribute } from 'three';
import { place, paint, merge } from './adventure-b3-map-build.js';
import { say, sayHarry, fx, sfx, reward, roomY, headAt } from './hogsmeade-shop.js';

const TOYS = {
  box: { name: 'קופסת הפתעות', p: [-1.9, 0.75, 1.3], spot: { x: -1.9, z: 0.15, yaw: 0 }, say: 'בּוֹינְג! כוכב קופץ!', dur: 3.2, h: 0.35 },
  ball: { name: 'כדור קופצני', p: [0.4, 0, -0.2], spot: { x: 0.4, z: -1.55, yaw: 0 }, say: 'הכדור קופץ עד התקרה!', dur: 4.4, h: 0.2 },
  top: { name: 'סביבון קסום', p: [3.3, 1.05, 0.4], spot: { x: 2.05, z: 0.4, yaw: Math.PI / 2 }, say: 'סביבון, סוב סוב סוב!', dur: 4.0, h: 0.15 },
  popper: { name: 'זיקוק קונפטי', p: [-0.3, 0.9, -0.9], spot: { x: -0.3, z: -1.9, yaw: 0 }, say: 'הידד! מסיבה!', dur: 3.6, h: 0.2 },
  wand: { name: 'שרביט תעלולים', p: [1.0, 0.75, 1.6], spot: { x: 1.0, z: 0.45, yaw: 0 }, say: 'פּוּף! השרביט הפך לפרחים!', dur: 3.6, h: 0.12 },
};
export const ALL_FIVE = 'ניסית את כל התעלולים!';
const HAT_S = 12, CONF_N = 80, CEIL = 3.4, BALL_R = 0.17;
const COLS = [0xd8402a, 0x2a7ad8, 0xe0b830, 0x3aa84a, 0xd84a9a, 0x8a4ad8, 0xe07a2a, 0xece0c8];
const _v = new Vector3(), _o = new Object3D(), _c = new Color();
let _mat = null;
const mat = () => _mat || (_mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: DoubleSide }));
const mesh = (parts, name) => { const m = new Mesh(merge(parts), mat()); m.name = name; m.raycast = () => {}; m.frustumCulled = false; return m; };
function starShape(r) { const s = new Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return s; }
const starGeo = (r, d = 0.03) => new ExtrudeGeometry(starShape(r), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
// stripes by a function of the vertex position
function stripe(geo, fn) { const p = geo.attributes.position, a = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { _c.setHex(fn(p.getX(i), p.getY(i), p.getZ(i))); a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } geo.setAttribute('color', new BufferAttribute(a, 3)); return geo; }

function buildBox() {
  const g = new Group();
  const body = mesh([paint(place(new BoxGeometry(0.3, 0.28, 0.3), 0, 0.14, 0), 0x7a3ac8), paint(place(new BoxGeometry(0.31, 0.04, 0.31), 0, 0.2, 0), 0xe0b830),
    paint(place(starGeo(0.05, 0.01), 0, 0.1, 0.152), 0xe0b830), paint(place(starGeo(0.05, 0.01), 0.152, 0.1, 0, 0, Math.PI / 2, 0), 0xe0b830)], 'zt-box');
  const lid = new Group(); lid.position.set(0, 0.28, -0.15);
  lid.add(mesh([paint(place(new BoxGeometry(0.33, 0.045, 0.33), 0, 0.022, 0.15), 0xd8402a), paint(place(new SphereGeometry(0.03, 8, 6), 0, 0.06, 0.15), 0xe0b830)], 'zt-box-lid'));
  const spring = new Group(); spring.position.set(0, 0.12, 0); spring.visible = false;
  const coil = []; for (let i = 0; i < 7; i++) coil.push(paint(place(new TorusGeometry(0.05, 0.01, 5, 14), 0, i * 0.05, 0, Math.PI / 2, 0, 0), 0xc0c4cc));
  coil.push(paint(place(starGeo(0.12, 0.04), 0, 0.42, 0), 0xf0c820));
  spring.add(mesh(coil, 'zt-box-star'));
  g.add(body, lid, spring); return { g, lid, spring };
}
function buildBall() {
  const g = new Group(), geo = stripe(new SphereGeometry(BALL_R, 24, 14), (x, y, z) => [0xd8402a, 0xece0c8, 0x2a7ad8, 0xe0b830][((Math.atan2(x, z) / Math.PI + 1) * 3 | 0) % 4]);
  const ball = new Mesh(geo, mat()); ball.name = 'zt-ball'; ball.raycast = () => {}; ball.position.y = BALL_R; g.add(ball); return { g, ball };
}
function buildTop() {
  const pts = [[0, 0], [0.02, 0.01], [0.12, 0.08], [0.13, 0.1], [0.08, 0.14], [0.02, 0.15], [0.015, 0.22], [0, 0.23]].map(([x, y]) => new Vector2(x, y));
  const geo = stripe(new LatheGeometry(pts, 20), (x, y) => (y < 0.05 ? 0x8a4ad8 : y < 0.09 ? 0xe0b830 : y < 0.12 ? 0xd84a9a : y < 0.16 ? 0x2ab8b0 : 0xd8402a));
  const g = new Group(), spin = new Group(); const m = new Mesh(geo, mat()); m.name = 'zt-top'; m.raycast = () => {}; spin.add(m); g.add(spin); return { g, spin };
}
function buildPopper() {
  const g = new Group();
  const tube = stripe(new CylinderGeometry(0.06, 0.05, 0.22, 16).translate(0, 0.11, 0), (x, y) => ((y * 30 | 0) % 2 ? 0xd84a9a : 0xe0b830));
  g.add(mesh([tube, paint(place(new ConeGeometry(0.075, 0.08, 16), 0, 0.26, 0), 0x2a7ad8), paint(place(new TorusGeometry(0.03, 0.008, 5, 10), 0, 0.31, 0), 0xe0b830)], 'zt-popper'));
  const conf = new InstancedMesh(new PlaneGeometry(0.045, 0.03), new MeshBasicMaterial({ side: DoubleSide }), CONF_N); conf.name = 'zt-confetti'; conf.raycast = () => {}; conf.frustumCulled = false; conf.count = 0;
  for (let i = 0; i < CONF_N; i++) conf.setColorAt(i, _c.setHex(COLS[i % COLS.length]));
  return { g, conf, parts: Array.from({ length: CONF_N }, () => ({ p: new Vector3(), v: new Vector3(), r: new Vector3(), w: 0 })) };
}
function buildWand() {
  const g = new Group(), wand = new Group();
  wand.add(mesh([paint(place(new CylinderGeometry(0.011, 0.016, 0.36, 8), 0, 0, 0), 0x3a2416), paint(place(new CylinderGeometry(0.012, 0.012, 0.05, 8), 0, 0.17, 0), 0xf4f0e8)], 'zt-wand'));
  wand.rotation.z = Math.PI / 2; wand.position.y = 0.02;
  const fl = new Group(); fl.visible = false; const F = [];
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.32, L = 0.3 + (i % 2) * 0.06, tx = Math.sin(a) * L, ty = Math.cos(a) * L;
    F.push(paint(place(new CylinderGeometry(0.007, 0.007, L, 5), tx / 2, ty / 2, 0, 0, 0, -a), 0x3a8a3a));
    for (let k = 0; k < 5; k++) { const b = k * Math.PI * 2 / 5; F.push(paint(place(new SphereGeometry(0.035, 6, 5), tx + Math.cos(b) * 0.04, ty + Math.sin(b) * 0.04, 0, 0, 0, 0, 1, 1, 0.5), [0xe85a9a, 0xf0c820, 0xd84a2a, 0xf4f0e8, 0xa86ad8][i])); }
    F.push(paint(place(new SphereGeometry(0.025, 6, 5), tx, ty, 0.01), 0xf0c820));
  }
  F.push(paint(place(new CylinderGeometry(0.03, 0.02, 0.08, 8), 0, -0.02, 0), 0xd8402a));
  fl.add(mesh(F, 'zt-flowers'));
  const pop = mesh([paint(starGeo(0.1, 0.02), 0xfff080)], 'zt-pop'); pop.visible = false;
  g.add(wand, fl, pop); return { g, wand, fl, pop };
}
function buildHat() {
  const geo = stripe(new ConeGeometry(0.14, 0.34, 16).translate(0, 0.17, 0), (x, y) => ((y * 14 | 0) % 2 ? 0x2a7ad8 : 0xe0b830));
  const m = mesh([geo, paint(place(new SphereGeometry(0.035, 8, 6), 0, 0.35, 0), 0xd84a9a), paint(place(new TorusGeometry(0.135, 0.016, 5, 16), 0, 0.01, 0, Math.PI / 2, 0, 0), 0xd84a9a)], 'zt-hat');
  m.visible = false; return m;
}

export function attachToys(R) {
  const T = R.toys = { list: {}, tried: new Set(), allSaid: false, hatT: 0, hat: buildHat(), confT: -1 };
  const B = { box: buildBox(), ball: buildBall(), top: buildTop(), popper: buildPopper(), wand: buildWand() };
  for (const k of Object.keys(TOYS)) { const t = TOYS[k], b = B[k]; b.g.position.set(t.p[0], t.p[1], t.p[2]); b.g.name = 'zonko-toy-' + k; R.g.add(b.g); T.list[k] = { ...b, k, t: 0, playing: false, tries: 0 }; }
  T.conf = B.popper.conf; T.parts = B.popper.parts; R.g.add(T.conf, T.hat);
  R.cols.push({ type: 'circle', x: TOYS.ball.p[0], z: TOYS.ball.p[2], r: 0.25 });
}
export function dropToys(R) { if (R.toys) R.toys.hatT = 0; }
export function toyTaps(R) {
  const T = R.toys; if (!T) return [];
  return Object.keys(TOYS).map(k => ({ id: k, on: () => !T.list[k].playing, w: (o) => o.set(TOYS[k].p[0], roomY() + TOYS[k].p[1] + TOYS[k].h, TOYS[k].p[2]), spot: TOYS[k].spot, fn: () => play(R, k) }));
}
export function play(R, k) {
  const T = R.toys, o = T.list[k]; if (!o || o.playing) return false;
  o.playing = true; o.t = 0; o.tries++; T.tried.add(k); sfx('tink', 2);
  const t = TOYS[k]; setTimeout(() => { if (!R.torn) say(_v.set(t.p[0], roomY() + t.p[1] + 1.0, t.p[2]), t.say, 3.2); }, k === 'wand' ? 700 : 350);
  if (k === 'popper') popConfetti(R);
  if (T.tried.size === 5 && !T.allSaid) { T.allSaid = true; setTimeout(() => { if (R.torn) return; sayHarry(ALL_FIVE, 3.6); T.paid = reward('zonko'); try { window.HPFun.confetti(['⭐', '🎉', '✨'], 14); } catch { /* ok */ } }, 3600); }
  return true;
}
function popConfetti(R) {
  const T = R.toys, p = TOYS.popper.p; T.confT = 0; T.conf.count = CONF_N; T.hatT = HAT_S; T.hat.visible = true;
  for (const q of T.parts) { const a = Math.random() * Math.PI * 2, s = 0.3 + Math.random() * 0.9; q.p.set(p[0], p[1] + 0.32, p[2]); q.v.set(Math.cos(a) * s, 2.2 + Math.random() * 1.4, Math.sin(a) * s); q.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); q.w = 2 + Math.random() * 4; }
  fx('burst', p[0], roomY() + p[1] + 0.35, p[2], 0xffe07a, 12, 1.4, 0.7, 0.16, -0.5);
}
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
export function tickToys(R, dt) {
  const T = R.toys; if (!T) return;
  for (const k of Object.keys(T.list)) { const o = T.list[k]; if (!o.playing) continue; o.t += dt; ANIM[k](o, o.t, dt); if (o.t >= TOYS[k].dur) { o.playing = false; ANIM[k](o, -1, dt); } }
  if (T.confT >= 0) {
    T.confT += dt; const y0 = 0.02;
    for (let i = 0; i < CONF_N; i++) { const q = T.parts[i]; q.v.y -= 3.2 * dt; if (q.v.y < -0.45) q.v.y = -0.45; q.v.x *= 1 - 1.6 * dt; q.v.z *= 1 - 1.6 * dt; q.p.addScaledVector(q.v, dt); if (q.p.y < y0) q.p.y = y0;
      _o.position.set(q.p.x + Math.sin(T.confT * q.w + i) * 0.03, q.p.y, q.p.z); _o.rotation.set(q.r.x + T.confT * q.w, q.r.y, q.r.z + T.confT * 2); _o.updateMatrix(); T.conf.setMatrixAt(i, _o.matrix); }
    T.conf.instanceMatrix.needsUpdate = true; if (T.confT > 4.5) { T.confT = -1; T.conf.count = 0; }
  }
  if (T.hatT > 0) {
    T.hatT -= dt; headAt(_v); const P = window.__game.player;
    T.hat.position.set(_v.x, _v.y - roomY() + 0.27, _v.z); T.hat.rotation.set(0, P.yaw, 0.15);
    if (T.hatT <= 0) T.hat.visible = false;
  }
}
const ANIM = {
  box: (o, t) => {
    if (t < 0) { o.lid.rotation.x = 0; o.spring.visible = false; return; }
    const open = t < 2.5 ? ease(t / 0.25) : 1 - ease((t - 2.5) / 0.5), up = t < 2.2 ? ease((t - 0.15) / 0.35) : 1 - ease((t - 2.2) / 0.35);
    o.lid.rotation.x = -1.9 * open; o.spring.visible = up > 0.02;
    o.spring.scale.set(1, Math.max(0.02, up * (1 + Math.sin(t * 14) * 0.12 * Math.exp(-t * 1.2))), 1);
    o.spring.rotation.z = Math.sin(t * 9) * 0.18 * Math.exp(-t * 0.8); o.spring.rotation.y = t * 1.5;
  },
  ball: (o, t) => {
    if (t < 0) { o.ball.position.y = BALL_R; o.ball.scale.set(1, 1, 1); return; }
    const H = [0.45, 0.9, 1.5, 2.2, CEIL - 2 * BALL_R - 0.05], D = H.map(h => 0.35 + Math.sqrt(h) * 0.42);
    let s = t, i = 0; while (i < H.length && s > D[i]) { s -= D[i]; i++; }
    if (i >= H.length) { o.ball.position.y = BALL_R; o.ball.scale.set(1, 1, 1); return; }
    const u = s / D[i], y = 4 * H[i] * u * (1 - u), sq = u < 0.08 || u > 0.92 ? 0.72 : 1;
    o.ball.position.y = BALL_R + y; o.ball.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); o.ball.rotation.x += 0.08;
  },
  top: (o, t, dt) => {
    if (t < 0) { o.spin.position.set(0, 0, 0); o.spin.rotation.set(0, 0, 0); return; }
    const w = t < 0.6 ? t / 0.6 : t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) / 1.4), r = 0.16 * Math.min(1, t / 0.8) * (t < 2.8 ? 1 : Math.max(0, 1 - (t - 2.8)));
    o.ang = (o.ang || 0) + dt * 26 * w; o.spin.rotation.y = o.ang;
    o.spin.position.set(Math.cos(t * 2.2) * r, 0, Math.sin(t * 2.2) * r); o.spin.rotation.z = (1 - w) * 0.35 * Math.sin(t * 7);
    if (w > 0.5 && Math.random() < 0.5) { const p = TOYS.top.p; fx('emit', p[0] + o.spin.position.x, roomY() + p[1] + 0.2, p[2] + o.spin.position.z, (Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 1.6, 0.7, 0.14, COLS[(Math.random() * 6) | 0], -0.6); }
  },
  popper: (o, t) => { const g = o.g.children[0]; if (t < 0) { g.scale.set(1, 1, 1); return; } const k = t < 0.25 ? 1 + Math.sin(t / 0.25 * Math.PI) * 0.3 : 1; g.scale.set(1 / k, k, 1 / k); },
  wand: (o, t) => {
    if (t < 0) { o.wand.visible = true; o.wand.position.y = 0.02; o.wand.rotation.set(0, 0, Math.PI / 2); o.fl.visible = false; o.pop.visible = false; return; }
    const lift = ease(t / 0.4); o.wand.position.y = 0.02 + lift * 0.25; o.wand.rotation.set(0, t * 6, Math.PI / 2 * (1 - lift));
    const pw = t > 0.55 && t < 0.95; o.pop.visible = pw; if (pw) { const s = Math.sin((t - 0.55) / 0.4 * Math.PI) * 2.2 + 0.1; o.pop.scale.set(s, s, s); o.pop.position.y = 0.3; o.pop.rotation.y = t * 3; }
    if (t > 0.6 && !o.popped) { o.popped = true; const p = TOYS.wand.p; fx('burst', p[0], roomY() + p[1] + 0.3, p[2], 0xfff080, 16, 1.6, 0.6, 0.16, -0.4); }
    const fl = t > 0.7 && t < 3.0; o.wand.visible = !fl; o.fl.visible = fl; if (fl) { const s = ease((t - 0.7) / 0.3) * (t > 2.7 ? 1 - ease((t - 2.7) / 0.3) : 1); o.fl.scale.set(s, s, s); o.fl.rotation.y = Math.sin(t * 2) * 0.3; }
    if (t > 3.0) { o.popped = false; o.wand.rotation.z = Math.PI / 2 * ease((t - 3) / 0.5); o.wand.position.y = 0.02 + 0.25 * (1 - ease((t - 3) / 0.5)); }
  },
};
export function toyState(R) {
  const T = R.toys; if (!T) return {};
  const toys = {}; for (const k of Object.keys(T.list)) toys[k] = { tries: T.list[k].tries, playing: T.list[k].playing };
  return { toys, tried: T.tried.size, allFive: T.allSaid, hat: T.hat.visible, confetti: T.conf.count };
}
export { TOYS };
