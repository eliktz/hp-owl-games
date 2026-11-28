// Hogsmeade milestone 4 (art director's look note, 28 Nov): while a shop thing plays (a Zonko's toy, the mug, the fire), the lens
// swings so the thing sits in the upper middle of the screen, clear of Harry and left of the iPhone's right-hand button column
// (portrait: x < 270 of 390, y 150..450; landscape: the middle band). A small search over yaw / pitch / distance round Harry's head,
// each candidate's arm shortened by the walls exactly as camera.js does, the thing projected with a copy of the game camera.
import { Vector3, PerspectiveCamera } from 'three';

const _h = new Vector3(), _d = new Vector3(), _p = new Vector3(), _t = new Vector3(), _f = new Vector3();
let _cam = null;
// the wanted screen box for a thing (fractions of the viewport)
export function thingBox() {
  const W = innerWidth, H = innerHeight, phone = W / H < 0.8;
  return phone ? { x0: 56, x1: Math.min(270, W - 120), y0: 150, y1: 450, ix: 0.42 * W, iy: 0.3 * H } : { x0: 0.18 * W, x1: 0.8 * W, y0: 0.14 * H, y1: 0.55 * H, ix: 0.5 * W, iy: 0.33 * H };
}
function project(cam, v) { _t.copy(v).project(cam); return { x: (_t.x * 0.5 + 0.5) * innerWidth, y: (-_t.y * 0.5 + 0.5) * innerHeight, on: _t.z > -1 && _t.z < 1 }; }
// thing: world point; returns the chosen { yaw, pitch, dist, x, y } (also applied to the lens) or null
export function frameThing(thing) {
  const g = window.__game, P = g.player, C = P.cam, gc = g.camera; if (!C || !gc) return null;
  if (!_cam) _cam = new PerspectiveCamera(); _cam.fov = gc.fov; _cam.aspect = gc.aspect; _cam.near = gc.near; _cam.far = gc.far; _cam.updateProjectionMatrix();
  const head = _h.set(P.pos.x, P.pos.y + C.headY, P.pos.z), B = thingBox(), base = Math.atan2(thing.x - P.pos.x, thing.z - P.pos.z) + Math.PI;
  let best = null;
  for (let k = 0; k < 24; k++) for (const pitch of [0.22, 0.34, 0.46]) for (const dist of [2.4, 2.9, 3.4]) {
    const yaw = base + (k - 12) * (Math.PI / 12), cp = Math.cos(pitch);
    _d.set(Math.sin(yaw) * cp, Math.sin(pitch) + C.eyeLift / Math.max(dist, 1), Math.cos(yaw) * cp).normalize();
    const L = Math.min(dist, C._castArm(head, _d, dist));
    _cam.position.copy(head).addScaledVector(_d, L); _cam.lookAt(head); _cam.updateMatrixWorld();
    const s = project(_cam, thing); if (!s.on) continue;
    const inBox = s.x >= B.x0 && s.x <= B.x1 && s.y >= B.y0 && s.y <= B.y1;
    // Harry's screen footprint: his head point and his feet, +- half a body width
    const hs = project(_cam, _p.set(P.pos.x, P.pos.y + C.headY + 0.35, P.pos.z)), fs = project(_cam, _f.set(P.pos.x, P.pos.y, P.pos.z));
    const half = Math.abs(fs.y - hs.y) * 0.13 + 10, dx = Math.max(0, Math.abs(s.x - hs.x) - half), dy = Math.max(0, hs.y - s.y);
    const clear = Math.max(dx, dy);
    const score = (inBox ? 1000 : 0) + Math.min(clear, 60) * 4 - Math.hypot(s.x - B.ix, s.y - B.iy) * 0.6 - Math.abs(L - 2.9) * 30 + (L >= dist - 0.01 ? 20 : 0);
    if (!best || score > best.score) best = { yaw, pitch, dist: L, x: s.x, y: s.y, inBox, clear, score };
  }
  if (!best) return null;
  C.yaw = best.yaw; C.pitch = best.pitch; C.dist = best.dist; C.curDist = Math.min(C.curDist, best.dist); C.userControlled = true; C.idle = 0;
  return best;
}
