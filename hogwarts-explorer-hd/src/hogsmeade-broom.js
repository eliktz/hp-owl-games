// Hogsmeade milestone 4: the Three Broomsticks inside ('b3broom'; briefs/2026-11-28-hogsmeade-m4-decisions.md): the cosy inn,
// the fire (code-built cards, no light, no sound; tapping the fireplace: Harry warms himself), Madam Rosmerta behind the bar,
// ordering a warm sweet butterbeer (tap her or the bar -> she greets, a foamy mug slides along the bar -> tap the mug: Harry
// drinks, a foam moustache for 10 s; again after 20 s; the first drink of a session gives the small free-play reward).
import { Vector3, Object3D } from 'three';
import { registerShop, say, sayLow, sfx, fx, reward, roomY, headAt } from './hogsmeade-shop.js';
import { animateChibi } from './chibi.js';
import { frameThing } from './hogsmeade-shop-frame.js';
import { F, DOOR, FIRE, buildRoom, buildExtras, buildFire, buildRosmerta, buildMug, buildFoam } from './hogsmeade-broom-build.js';

export const BROOM_NAME = 'שלושת המטאטאים';
export const BUTTERBEER = 'בירה חמאה';          // (not in the glossary: Elik's own wording until confirmed; one constant, easy to swap)
export const ROSMERTA = 'מדאם רוזמרטה';         // (a plain transliteration, not in the glossary)
export const LINES = { greet: 'שלום! רוצה ' + BUTTERBEER + ' חמה?', drink: 'מממ, טעים וחם!', enjoy: 'בתיאבון!', fire: 'כמה נעים וחם ליד האש!' };
const ROS = { x: 1.4, z: 3.75, yaw: Math.PI };
const ORDER_SPOT = { x: 1.4, z: 2.0, yaw: 0 }, FIRE_SPOT = { x: -4.4, z: 0.5, yaw: -Math.PI / 2 };
const MUG = { x0: 2.2, x1: 1.4, y: 1.11, z: 2.9 };
const AGAIN_S = 20, FOAM_S = 10;
const _v = new Vector3(), _w = new Vector3(), _o = new Object3D();

function attach(R) {
  R.g.add(buildExtras());
  R.fire = buildFire(); R.g.add(R.fire.g);
  R.ros = buildRosmerta(); R.ros.position.set(ROS.x, 0, ROS.z); R.ros.rotation.y = ROS.yaw; R.g.add(R.ros);
  R.mug = buildMug(); R.g.add(R.mug.g);
  R.foam = buildFoam(); R.g.add(R.foam);
  R.flameY = 0.1; R.bar = { st: 'idle', t: 0, again: 0, orders: 0, drinks: 0, foamT: 0, fireTaps: 0, paid: false };
}
const rosHead = (o) => o.set(ROS.x, roomY() + 2.75, ROS.z);
function order(R) {
  const B = R.bar; if (B.st !== 'idle' || B.again > 0) return false;
  B.st = 'greet'; B.t = 0; B.orders++;
  say(rosHead(_v), LINES.greet, 3.4); sfx('tink', 1);
  return true;
}
function drink(R) {
  const B = R.bar; if (B.st !== 'ready') return false;
  B.st = 'drink'; B.t = 0; B.drinks++;
  return true;
}
function warm(R) { R.bar.fireTaps++; sayLow(LINES.fire, 3.4); }

function tick(R, dt) {
  const B = R.bar, P = window.__game.player, p = P.pos, T = R.T;
  // the fire: three flickering flames, the glow and the hearth light breathing (no real light)
  const fl = R.fire.flames;
  for (let i = 0; i < 3; i++) { const k = 0.85 + Math.sin(T * (7 + i * 2.3) + i) * 0.12 + Math.sin(T * 13.1 + i * 4) * 0.06; _o.position.set(FIRE.x - 0.08 + i * 0.01, R.flameY, FIRE.z - 0.3 + i * 0.3); _o.rotation.set(0, Math.PI / 2 + (i - 1) * 0.25, Math.sin(T * 3 + i) * 0.06); _o.scale.set(0.9 + 0.1 * Math.sin(T * 5 + i), k * (i === 1 ? 1.15 : 0.9), 1); _o.updateMatrix(); fl.setMatrixAt(i, _o.matrix); }
  fl.instanceMatrix.needsUpdate = true;
  const fk = 0.5 + 0.5 * Math.sin(T * 6.3) * Math.sin(T * 2.9 + 1); R.fire.glow.material.opacity = 0.42 + 0.16 * fk; R.fire.floor.material.opacity = 0.26 + 0.12 * fk;
  // Madam Rosmerta: an idle sway, turning towards Harry when he is near
  const rig = R.ros.userData.rig; animateChibi(rig, dt, { moving: false });
  const dx = p.x - ROS.x, dz = p.z - ROS.z, want = Math.hypot(dx, dz) < 4.5 ? Math.atan2(dx, dz) : ROS.yaw;
  let dy = want - R.ros.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); R.ros.rotation.y += dy * Math.min(1, dt * 3);
  R.ros.rotation.z = Math.sin(T * 1.3) * 0.025;
  if (B.again > 0) B.again -= dt;
  B.t += dt; const M = R.mug, g = M.g;
  if (B.st === 'greet' && B.t > 1.3) { B.st = 'slide'; B.t = 0; g.visible = true; g.rotation.set(0, 0, 0); M.liq.scale.set(1, 1, 1); g.position.set(MUG.x0, MUG.y, MUG.z); }
  if (B.st === 'slide') { const u = Math.min(1, B.t / 1.1), e = 1 - Math.pow(1 - u, 3); g.position.set(MUG.x0 + (MUG.x1 - MUG.x0) * e, MUG.y, MUG.z); g.rotation.z = Math.sin(u * Math.PI) * 0.06; if (u >= 1) { B.st = 'ready'; B.t = 0; try { frameThing(new Vector3(MUG.x1, roomY() + MUG.y + 0.1, MUG.z)); } catch { /* ok */ } } }
  if (B.st === 'ready' && Math.random() < dt * 2) fx('emit', MUG.x1 + (Math.random() - 0.5) * 0.06, roomY() + MUG.y + 0.24, MUG.z, 0, 0.25, 0, 1.0, 0.07, 0xfff4e0, 0);   // a little warm steam
  if (B.st === 'drink') {
    const t = B.t; headAt(_w); const fx0 = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    _v.set(_w.x + fx0 * 0.2, _w.y - roomY() - 0.12, _w.z + fz * 0.2);   // in front of his mouth
    const bar = new Vector3(MUG.x1, MUG.y, MUG.z);
    if (t < 0.6) { const e = t / 0.6; g.position.lerpVectors(bar, _v, e * e * (3 - 2 * e)); g.rotation.set(0, P.yaw + Math.PI / 2, 0); }
    else if (t < 2.0) { const e = Math.min(1, (t - 0.6) / 0.5); g.position.copy(_v); g.rotation.set(-1.1 * e, P.yaw, 0); M.liq.scale.y = Math.max(0.04, 1 - (t - 0.6) / 1.3); }
    else if (t < 2.6) { const e = (t - 2.0) / 0.6; g.position.lerpVectors(_v, bar, e * e * (3 - 2 * e)); g.rotation.set(-1.1 * (1 - e), P.yaw, 0); }
    if (t >= 0.9 && !B.mo) { B.mo = true; B.foamT = FOAM_S; sayLow(LINES.drink, 3.2); sfx('munch'); }
    if (t >= 2.6) { B.st = 'enjoy'; B.t = 0; B.mo = false; say(rosHead(_v), LINES.enjoy, 2.6); if (B.drinks === 1) B.paid = reward('broom'); }
  }
  if (B.st === 'enjoy' && B.t > 1.6) { g.visible = false; B.st = 'idle'; B.again = AGAIN_S; }
  // the foam moustache under his nose
  if (B.foamT > 0) {
    B.foamT -= dt; headAt(_w); const fx0 = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    R.foam.visible = B.foamT > 0; R.foam.position.set(_w.x + fx0 * R.mo.f, _w.y - roomY() + R.mo.y, _w.z + fz * R.mo.f); R.foam.rotation.set(0, P.yaw, 0);
  }
}
const taps = (R) => [
  { id: 'rosmerta', on: () => R.bar.st === 'idle' && R.bar.again <= 0, w: (o) => o.set(ROS.x, roomY() + 1.9, ROS.z), spot: ORDER_SPOT, fn: () => order(R) },
  { id: 'bar', r: 0.8, on: () => R.bar.st === 'idle' && R.bar.again <= 0, w: (o) => o.set(-0.6, roomY() + 1.0, 2.6), spot: ORDER_SPOT, fn: () => order(R) },
  { id: 'mug', r: 1.4, on: () => R.bar.st === 'ready', w: (o) => o.set(MUG.x1, roomY() + MUG.y + 0.12, MUG.z), spot: ORDER_SPOT, fn: () => drink(R) },
  { id: 'fire', w: (o) => o.set(FIRE.x + 0.1, roomY() + 0.75, FIRE.z), spot: FIRE_SPOT, fn: () => warm(R) },
];
const state = (R) => { const B = R.bar; return { drink: { st: B.st, orders: B.orders, drinks: B.drinks, again: Math.max(0, +B.again.toFixed(1)), foam: R.foam.visible, mug: R.mug.g.visible, paid: B.paid, fireTaps: B.fireTaps },
  rosmerta: { x: ROS.x, z: ROS.z, yaw: +R.ros.rotation.y.toFixed(2) } }; };

registerShop({
  id: 'b3broom', key: 'broomsticks', model: 'hm_broom_int', node: 'Broom_Interior', frame: F, door: DOOR,
  light: { amb: 1.0, ambC: 0xffe0bc, hemi: 0.92, sky: 0xffe8cc, ground: 0xa07a58, fogC: 0xe8d0b0, fogD: 0.003, bg: 0xe2c8a4 },   // amber; lifted (art director, 28 Nov: the dark oak model must not look gloomy; lift the light, not the model)
  cols: [{ type: 'box', x: -5.6, z: 0.5, hw: 0.4, hd: 1.4 }, { type: 'box', x: 1.6, z: 3.55, hw: 3.6, hd: 0.95 },
    ...[[-2.6, -1.95], [0.4, -2.4], [-3.2, 2.4], [1.6, 0.0]].map(([x, z]) => ({ type: 'circle', x, z, r: 0.95 })), { type: 'box', x: -5.575, z: -2.7, hw: 0.325, hd: 1.0 }],
  cam: { yaw: -1.9, pitch: 0.3, dist: 3.0 },
  codeBuilt: ['broom-room', 'broom-glow'],
  fallback: (g) => buildRoom(g),
  signs: [{ text: BROOM_NAME, w: 2.8, h: 0.6, x: 1.6, y: 3.22, z: F.z1 - 0.06,   // (on the back wall above the shelves, y 2.92..3.52: seen from the room the flags over the bar at z 2.95 stay below it)
       ry: Math.PI, px: 90, pad: 120 },
    { text: BUTTERBEER + ' חמה', kind: 'chalk', w: 0.62, h: 0.38, x: -0.9, y: 1.32, z: 2.62, ry: Math.PI, px: 96 }],
  attach: (R) => { attach(R); R.mo = { f: 0.17, y: -0.02 }; },
  onModel: (R) => { R.flameY = 0.38; R.fire.glow.position.y = 0.85; },   // (the model's hearth floor is raised: flames from y 0.38, its flame box)
  tick: (R, dt) => tick(R, dt),
  taps, state,
});
