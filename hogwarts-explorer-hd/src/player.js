// Third-person player: a stylised wizard walking the grounds. Capsule-vs-collider movement
// with wall sliding (no corner/doorway sticking), smooth ground snapping, anti-stuck
// recovery, and always-safe teleport. Owns a SpringCamera that keeps walls out of view.
import { Vector3, MathUtils } from 'three';
import { WORLD } from './config.js';
import { SpringCamera } from './camera.js';
import { buildChibi, animateChibi } from './chibi.js';

const STEP = 0.45;   // max height change absorbed per frame without a jolt (stairs/kerbs)

export class Player {
  constructor(scene, camera, { heightAt, colliders }) {
    this.camera = camera;
    this.heightAt = heightAt || (() => 0);
    this.colliders = colliders || [];
    this.pos = new Vector3(0, 0, 60);
    this.yaw = Math.PI;         // model faces -z (toward the castle)
    this.smoothY = 0;

    // anti-stuck bookkeeping
    this._lastPos = new Vector3(0, 0, 60);
    this._stuckT = 0;

    // The hero: a charming chibi wizard-kid (robe + scarf + hat + wand), from chibi.js.
    const g = buildChibi({ robe: 0x3a2d55, trim: 0x2a2140, house: 0x7a1020, hair: 0x2a1a12, hat: 0x241a33, wand: true });
    this._rig = g.userData.rig;
    // Collect materials so the camera can fade us when it's forced in close.
    this._mats = [];
    g.traverse(o => { if (o.isMesh) this._mats.push(o.material); });
    this.model = g; scene.add(g);
    this.bob = 0;

    this.cam = new SpringCamera(camera);
    this.cam.onFade = (a) => this._applyFade(a);
    this.cam.reset(this.yaw);
  }

  _applyFade(a) {
    for (const m of this._mats) { m.transparent = a < 0.999; m.opacity = a; m.depthWrite = a > 0.5; }
    this.model.visible = a > 0.02;
  }

  // Is (x,z) inside any collider (optionally inflated by `pad`)?
  _blocked(x, z, pad = 0) {
    const R = WORLD.playerRadius + pad;
    for (const c of this.colliders) {
      if (c.type === 'circle') {
        if (Math.hypot(x - c.x, z - c.z) < c.r + R) return true;
      } else {
        const ca = Math.cos(-c.angle), sa = Math.sin(-c.angle);
        const lx = (x - c.x) * ca - (z - c.z) * sa, lz = (x - c.x) * sa + (z - c.z) * ca;
        if (Math.abs(lx) < c.hw + R && Math.abs(lz) < c.hd + R) return true;
      }
    }
    return false;
  }

  // Push a point out of every collider it overlaps (XZ). Iterated so corners converge
  // instead of oscillating — this is what gives smooth sliding along walls/doorways.
  _resolve(p) {
    const R = WORLD.playerRadius;
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (const c of this.colliders) {
        if (c.type === 'circle') {
          const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + R;
          if (d < min) { const nd = d > 1e-4 ? d : 1e-4; p.x = c.x + dx / nd * min; p.z = c.z + dz / nd * min; moved = true; }
        } else {
          const ca = Math.cos(-c.angle), sa = Math.sin(-c.angle);
          let lx = (p.x - c.x) * ca - (p.z - c.z) * sa;
          let lz = (p.x - c.x) * sa + (p.z - c.z) * ca;
          const ex = c.hw + R, ez = c.hd + R;
          if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
            if (ex - Math.abs(lx) < ez - Math.abs(lz)) lx = (lx < 0 ? -1 : 1) * ex;
            else lz = (lz < 0 ? -1 : 1) * ez;
            p.x = c.x + lx * Math.cos(c.angle) - lz * Math.sin(c.angle);
            p.z = c.z + lx * Math.sin(c.angle) + lz * Math.cos(c.angle);
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
  }

  // Spiral outward from (x,z) for the nearest spot clear of every collider & in-bounds.
  _findFree(x, z) {
    const lim = WORLD.groundSize / 2 - 6;
    const cl = v => MathUtils.clamp(v, -lim, lim);
    if (!this._blocked(x, z, 0.15)) return { x: cl(x), z: cl(z) };
    for (let r = 1; r <= 40; r += 1) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const nx = cl(x + Math.cos(ang) * r), nz = cl(z + Math.sin(ang) * r);
        if (!this._blocked(nx, nz, 0.15)) return { x: nx, z: nz };
      }
    }
    return { x: cl(x), z: cl(z) };
  }

  // Safe teleport: resolve to a free spot, snap to the ground, recentre the camera.
  teleport(x, z) {
    const f = this._findFree(x, z);
    this.pos.set(f.x, this.heightAt(f.x, f.z), f.z);
    this.smoothY = this.pos.y;
    this._lastPos.copy(this.pos); this._stuckT = 0;
    // snap the lens to the new spot right now (no frame where the camera still looks at the old place)
    if (this.cam) { this.cam.reset(this.yaw); this.cam.curDist = this.cam.dist; this.cam.update(0.016, this.pos, this.yaw, false); this.camera.updateMatrixWorld(true); }
    if (this.model) this.model.position.copy(this.pos);
  }

  // Try the full move, then X-only and Z-only, keeping whichever makes the most progress.
  // This slides cleanly along walls and never jams in a doorway.
  _slideMove(dx, dz) {
    const start = this.pos;
    const full = { x: start.x + dx, z: start.z + dz };
    this._resolve(full);
    if (Math.hypot(full.x - start.x, full.z - start.z) > Math.hypot(dx, dz) * 0.35) { start.x = full.x; start.z = full.z; return; }
    // Blocked: slide on each axis independently and take the better one.
    const ax = { x: start.x + dx, z: start.z }; this._resolve(ax);
    const az = { x: start.x, z: start.z + dz }; this._resolve(az);
    const gx = Math.hypot(ax.x - start.x, ax.z - start.z);
    const gz = Math.hypot(az.x - start.x, az.z - start.z);
    const best = gx >= gz ? ax : az;
    start.x = best.x; start.z = best.z;
  }

  update(dt, input) {
    // ---- camera look input (drag / keys / buttons / wheel-pinch) ----
    const look = input.consumeLook();
    if (look.x || look.y) this.cam.orbit(look.x, look.y);
    const zoom = input.consumeZoom ? input.consumeZoom() : 0;
    if (zoom) this.cam.zoom(zoom);

    const ax = input.axis();
    const speed = (ax.running ? WORLD.runSpeed : WORLD.walkSpeed) * (this.speedMul || 1);   // speedMul: silly bean spells
    const moving = Math.hypot(ax.x, ax.y) > 0.05;
    if (moving) {
      // movement relative to the camera's current yaw
      const cy = this.cam.yaw;
      const fx = -Math.sin(cy), fz = -Math.cos(cy);
      const rx = Math.cos(cy), rz = -Math.sin(cy);
      const dx = (fx * ax.y + rx * ax.x) * speed * dt;
      const dz = (fz * ax.y + rz * ax.x) * speed * dt;
      this._slideMove(dx, dz);
      this.yaw = Math.atan2(this.pos.x - this._lastPos.x || dx, this.pos.z - this._lastPos.z || dz);
      this.bob += dt * speed * 1.2;
    }

    // keep inside the grounds
    const lim = WORLD.groundSize / 2 - 6;
    this.pos.x = MathUtils.clamp(this.pos.x, -lim, lim);
    this.pos.z = MathUtils.clamp(this.pos.z, -lim, lim);

    // ---- anti-stuck recovery: input held but no real progress for ~1.5s ----
    if (moving) {
      const prog = Math.hypot(this.pos.x - this._lastPos.x, this.pos.z - this._lastPos.z);
      if (prog < speed * dt * 0.25) this._stuckT += dt; else this._stuckT = 0;
      if (this._stuckT > 1.5) { const f = this._findFree(this.pos.x, this.pos.z); this.pos.x = f.x; this.pos.z = f.z; this._stuckT = 0; }
    } else this._stuckT = 0;
    this._lastPos.copy(this.pos);

    // ---- ground snap with a small step tolerance (stairs/kerbs, never through floor) ----
    const gy = this.heightAt(this.pos.x, this.pos.z);
    if (Math.abs(gy - this.smoothY) > STEP) this.smoothY += MathUtils.clamp(gy - this.smoothY, -STEP, STEP);
    else this.smoothY += (gy - this.smoothY) * (1 - Math.pow(0.001, dt));
    this.pos.y = this.smoothY;

    animateChibi(this._rig, dt, { moving, running: ax.running });
    this.model.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.model.rotation.y = this.yaw;
    this.model.position.y += moving ? Math.abs(Math.sin(this.bob)) * 0.06 : 0;

    this.cam.update(dt, this.pos, this.yaw, moving);
  }
}
