/* Third-person engine (global THREE): a spring-arm camera that raycasts its arm against
 * world geometry so it never clips into / sticks on walls, plus a raycast slide-move helper
 * for the player and a free-spot finder. Shared by the outdoor + interior worlds. Mirrors
 * the HD game's src/camera.js algorithm, kept dependency-free for the <script>-tag game. */
window.HPX = (function () {
  const THREE = window.THREE;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const PI = Math.PI;

  class SpringArm {
    constructor(camera) {
      this.camera = camera;
      this.yaw = 0; this.pitch = 0.42;
      this.dist = 10; this.curDist = 10;
      this.minDist = 2.4; this.maxDist = 14;
      this.minPitch = 0.08; this.maxPitch = 1.15;
      this.indoor = false;
      this.obstacles = [];   // mesh list (no sprites/points) the arm raycasts against
      this.ray = new THREE.Raycaster(); this.ray.near = 0.05; this.ray.camera = camera;
      this.idle = 0; this.recenterAfter = 2.4; this.userControlled = false;
      this._target = new THREE.Vector3();
      this._dir = new THREE.Vector3();
      this._want = new THREE.Vector3();
      this._fade = 1; this.onFade = null;
      camera.near = Math.min(camera.near, 0.1); camera.updateProjectionMatrix();
    }
    orbit(dx, dy) {
      this.yaw -= dx * 0.005;
      this.pitch = clamp(this.pitch + dy * 0.005, this.minPitch, this.maxPitch);
      this.idle = 0; this.userControlled = true;
    }
    zoom(a) { this.dist = clamp(this.dist - a, this.minDist, this.indoor ? 9 : this.maxDist); this.idle = 0; }
    reset(behindYaw) {
      this.yaw = behindYaw; this.pitch = this.indoor ? 0.2 : 0.42;
      this.dist = this.indoor ? 7.5 : 10; this.userControlled = false; this.idle = this.recenterAfter;
    }
    setIndoor(on) { this.indoor = on; this.maxDist = on ? 9 : 14; this.dist = clamp(this.dist, this.minDist, on ? 8 : 14); }

    // target: THREE.Vector3 look-at point (head). behindYaw: yaw that sits behind the player.
    update(dt, target, behindYaw, moving) {
      this.idle += dt;
      if (!this.userControlled && moving && this.idle > this.recenterAfter) {
        let d = ((behindYaw - this.yaw + PI) % (2 * PI)) - PI; if (d < -PI) d += 2 * PI;
        this.yaw += d * (1 - Math.pow(0.05, dt));
      }
      if (this.userControlled && this.idle > this.recenterAfter) this.userControlled = false;

      this._target.copy(target);
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      this._dir.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp).normalize();

      let allowed = this.dist;
      const hit = this._castArm(this._target, this._dir, this.dist);
      if (hit < allowed) allowed = hit;
      if (allowed < this.curDist) this.curDist = allowed;
      else this.curDist += (allowed - this.curDist) * (1 - Math.pow(0.0008, dt));
      this.curDist = clamp(this.curDist, this.minDist, this.maxDist);

      this._want.copy(this._target).addScaledVector(this._dir, this.curDist);
      this.camera.position.copy(this._want);
      this.camera.lookAt(this._target);

      const fadeStart = this.minDist + 1.1;
      const want = this.curDist >= fadeStart ? 1 : clamp((this.curDist - this.minDist) / (fadeStart - this.minDist), 0, 1);
      if (Math.abs(want - this._fade) > 0.02) { this._fade = want; this.onFade && this.onFade(want); }
    }

    _castArm(origin, dir, maxLen) {
      if (!this.obstacles.length) return maxLen;
      const pad = 0.5;
      this.ray.set(origin, dir); this.ray.far = maxLen + pad;
      const hits = this.ray.intersectObjects(this.obstacles, true);
      for (const h of hits) { if (h.distance <= 0.02) continue; return clamp(h.distance - pad, this.minDist, maxLen); }
      return maxLen;
    }
  }

  // Raycast slide: advance (dx,dz) from pos, stopping at walls and sliding along them.
  // probeY lifts the ray to body height; returns the resolved {x,z}. Never tunnels at
  // walking speed against the chunky castle/courtyard solids.
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3();
  const _ray = new THREE.Raycaster(); _ray.near = 0;
  function slideMove(pos, dx, dz, radius, solids, probeY) {
    if (!solids || !solids.length) return { x: pos.x + dx, z: pos.z + dz };
    let mx = dx, mz = dz;
    _o.set(pos.x, pos.y + (probeY || 1), pos.z);
    for (let i = 0; i < 3; i++) {
      const len = Math.hypot(mx, mz); if (len < 1e-5) break;
      _d.set(mx / len, 0, mz / len);
      _ray.set(_o, _d); _ray.far = len + radius;
      const hits = _ray.intersectObjects(solids, true);
      let h = null; for (const x of hits) { if (x.distance > 1e-3) { h = x; break; } }
      if (!h || h.distance >= len + radius) break;        // path clear
      if (h.face) _n.copy(h.face.normal).transformDirection(h.object.matrixWorld); else _n.set(-mx, 0, -mz);
      _n.y = 0; if (_n.lengthSq() < 1e-6) { mx = mz = 0; break; } _n.normalize();
      const into = mx * _n.x + mz * _n.z;
      if (into < 0) { mx -= _n.x * into; mz -= _n.z * into; } else { mx = mz = 0; break; }
    }
    return { x: pos.x + mx, z: pos.z + mz };
  }

  // Is (x,z) within `radius` of any solid (short down-free horizontal probe ring)?
  function blocked(x, z, y, radius, solids) {
    if (!solids || !solids.length) return false;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      _ray.set(_o.set(x, y + 1, z), _d.set(Math.cos(ang), 0, Math.sin(ang)));
      _ray.far = radius;
      const hits = _ray.intersectObjects(solids, true);
      if (hits.some(h => h.distance > 1e-3 && h.distance < radius)) return true;
    }
    return false;
  }

  // Spiral outward from (x,z) to the nearest spot clear of all solids.
  function findFree(x, z, y, radius, solids, groundH) {
    if (!blocked(x, z, y, radius, solids)) return { x, z };
    for (let r = 1.5; r <= 30; r += 1.5) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const nx = x + Math.cos(ang) * r, nz = z + Math.sin(ang) * r;
        const ny = groundH ? groundH(nx, nz) : y;
        if (!blocked(nx, nz, ny, radius, solids)) return { x: nx, z: nz };
      }
    }
    return { x, z };
  }

  return { SpringArm, slideMove, blocked, findFree };
})();
