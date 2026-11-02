// Spring-arm third-person camera. Orbits a head target behind the player, raycasts the
// arm against world geometry so it never clips into or sticks on walls (pulls in fast,
// pushes out slowly), fades the player when the lens gets very close, keeps a tighter arm
// indoors, and auto-recenters behind the player after the user stops dragging while moving.
import { Vector3, Raycaster } from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const PI = Math.PI;

export class SpringCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;            // 0 = looking toward -? ; we derive from player
    this.pitch = 0.30;
    this.dist = 9;           // target arm length (user/zoom controlled)
    this.curDist = 9;        // smoothed, collision-clamped actual length
    this.minDist = 2.2; this.maxDist = 14;
    this.minPitch = -0.15; this.maxPitch = 1.05;
    this.headY = 1.6;        // look-at height above feet
    this.eyeLift = 2.0;      // extra rise baked into the arm height
    this.indoor = false;

    this.obstacles = [];     // meshes/groups the arm raycasts against
    this.ray = new Raycaster();
    this.ray.near = 0.05;
    this.ray.firstHitOnly = false;

    this.idle = 0;           // seconds since last manual camera input
    this.recenterAfter = 2.2;
    this.userControlled = false;

    this._target = new Vector3();
    this._dir = new Vector3();
    this._want = new Vector3();
    this._fade = 1;          // player visibility amount (1 visible, 0 hidden)
    this.onFade = null;      // callback(amount 0..1)
    camera.near = 0.08; camera.updateProjectionMatrix?.();
  }

  // Mouse/touch drag or buttons: orbit by screen-pixel-ish deltas.
  orbit(dx, dy) {
    this.yaw -= dx * 0.005;
    this.pitch = clamp(this.pitch + dy * 0.004, this.minPitch, this.maxPitch);
    this.idle = 0; this.userControlled = true;
  }

  // Pinch / wheel / buttons: positive = zoom in.
  zoom(amount) {
    this.dist = clamp(this.dist - amount, this.minDist, this.indoor ? 8 : this.maxDist);
    this.idle = 0;
  }

  // Snap the orbit directly behind the player and re-enable auto-follow.
  reset(playerYaw) {
    this.yaw = this._behind(playerYaw);
    this.pitch = this.indoor ? 0.14 : 0.30;
    this.dist = this.indoor ? 5 : 9;
    this.userControlled = false; this.idle = this.recenterAfter;
  }

  setIndoor(on) {
    this.indoor = on;
    this.maxDist = on ? 8 : 14;
    this.dist = clamp(this.dist, this.minDist, on ? 6 : this.maxDist);
    this.eyeLift = on ? 1.2 : 2.0;
  }

  // Yaw that places the camera behind a player facing `playerYaw` (model faces +dx,+dz).
  _behind(playerYaw) { return playerYaw + PI; }

  update(dt, playerPos, playerYaw, moving) {
    this.idle += dt;
    // Auto-recenter: ease the orbit behind the player once the user has let go and is moving.
    if (!this.userControlled && moving && this.idle > this.recenterAfter) {
      const goal = this._behind(playerYaw);
      let d = ((goal - this.yaw + PI) % (2 * PI)) - PI;
      if (d < -PI) d += 2 * PI;
      this.yaw += d * (1 - Math.pow(0.04, dt));
    }
    if (this.userControlled && this.idle > this.recenterAfter) this.userControlled = false;

    const t = this._target.set(playerPos.x, playerPos.y + this.headY, playerPos.z);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    // Arm direction from target out to where the camera wants to sit.
    this._dir.set(Math.sin(this.yaw) * cp, sp + this.eyeLift / Math.max(this.dist, 1), Math.cos(this.yaw) * cp).normalize();

    let allowed = this.dist;
    const hit = this._castArm(t, this._dir, this.dist);
    if (hit < allowed) allowed = hit;

    // Pull in instantly (don't let a wall swallow the player), push out gently.
    if (allowed < this.curDist) this.curDist = allowed;
    else this.curDist += (allowed - this.curDist) * (1 - Math.pow(0.0008, dt));
    this.curDist = clamp(this.curDist, this.minDist, this.maxDist);

    this._want.copy(t).addScaledVector(this._dir, this.curDist);
    this.camera.position.copy(this._want);
    this.camera.lookAt(t);

    // Fade the player out when the lens is nearly inside them.
    const fadeStart = this.minDist + 1.2;
    const want = this.curDist >= fadeStart ? 1 : clamp((this.curDist - this.minDist) / (fadeStart - this.minDist), 0, 1);
    if (Math.abs(want - this._fade) > 0.01) { this._fade = want; this.onFade && this.onFade(want); }
  }

  // Sphere-ish cast of the arm: raycast from target outward and keep a padding so the
  // near plane never pokes through the surface. Returns a safe distance.
  _castArm(origin, dir, maxLen) {
    if (!this.obstacles.length) return maxLen;
    const pad = 0.45;
    this.ray.set(origin, dir);
    this.ray.far = maxLen + pad;
    const hits = this.ray.intersectObjects(this.obstacles, true);
    for (const h of hits) {
      if (h.distance <= 0.01) continue;
      return clamp(h.distance - pad, this.minDist, maxLen);
    }
    return maxLen;
  }
}
