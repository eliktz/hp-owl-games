// Third-person player: a little stylised wizard walking the grounds. Camera orbits
// behind, follows terrain height, resolves collision against castle colliders, and
// pulls in toward the player when a wall would block the view.
import {
  Group, Mesh, CapsuleGeometry, SphereGeometry, ConeGeometry, MeshStandardMaterial,
  Vector3, Color, MathUtils,
} from 'three';
import { WORLD } from './config.js';

export class Player {
  constructor(scene, camera, { heightAt, colliders }) {
    this.camera = camera;
    this.heightAt = heightAt || (() => 0);
    this.colliders = colliders || [];
    this.pos = new Vector3(0, 0, 60);
    this.yaw = Math.PI;         // facing -z (toward the castle)
    this.camYaw = Math.PI; this.camPitch = 0.32; this.camDist = 9;

    const g = new Group();
    const robe = new Mesh(new ConeGeometry(0.55, 1.5, 12), new MeshStandardMaterial({ color: 0x2a2140, roughness: 0.9 }));
    robe.position.y = 0.75; robe.castShadow = true; g.add(robe);
    const body = new Mesh(new CapsuleGeometry(0.28, 0.5, 4, 8), new MeshStandardMaterial({ color: 0x3a2d55, roughness: 0.85 }));
    body.position.y = 1.35; body.castShadow = true; g.add(body);
    const head = new Mesh(new SphereGeometry(0.26, 16, 12), new MeshStandardMaterial({ color: 0xd9ad86, roughness: 0.7 }));
    head.position.y = 1.9; head.castShadow = true; g.add(head);
    const scarf = new Mesh(new CapsuleGeometry(0.1, 0.5, 3, 6), new MeshStandardMaterial({ color: 0x7a1020, emissive: new Color(0x300008), roughness: 0.8 }));
    scarf.position.set(0, 1.25, 0.18); g.add(scarf);
    this.model = g; scene.add(g);
    this.bob = 0;
  }

  teleport(x, z) { this.pos.set(x, 0, z); }

  // Push the player position out of any collider it overlaps (XZ only).
  _resolve(p) {
    const R = WORLD.playerRadius;
    for (const c of this.colliders) {
      if (c.type === 'circle') {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + R;
        if (d < min && d > 1e-4) { p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; }
      } else { // oriented box: work in the box's local frame
        const ca = Math.cos(-c.angle), sa = Math.sin(-c.angle);
        let lx = (p.x - c.x) * ca - (p.z - c.z) * sa;
        let lz = (p.x - c.x) * sa + (p.z - c.z) * ca;
        const ex = c.hw + R, ez = c.hd + R;
        if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
          if (ex - Math.abs(lx) < ez - Math.abs(lz)) lx = Math.sign(lx) * ex;
          else lz = Math.sign(lz) * ez;
          p.x = c.x + lx * Math.cos(c.angle) - lz * Math.sin(c.angle);
          p.z = c.z + lx * Math.sin(c.angle) + lz * Math.cos(c.angle);
        }
      }
    }
  }

  update(dt, input) {
    const look = input.consumeLook();
    this.camYaw -= look.x * 0.005;
    this.camPitch = MathUtils.clamp(this.camPitch + look.y * 0.004, -0.2, 0.9);
    const ax = input.axis();
    const speed = (ax.running ? WORLD.runSpeed : WORLD.walkSpeed);
    const moving = Math.hypot(ax.x, ax.y) > 0.05;
    if (moving) {
      // movement relative to camera facing
      const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
      const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
      const dx = fx * ax.y + rx * ax.x, dz = fz * ax.y + rz * ax.x;
      const next = this.pos.clone();
      next.x += dx * speed * dt; next.z += dz * speed * dt;
      this._resolve(next);
      this.pos.x = next.x; this.pos.z = next.z;
      this.yaw = Math.atan2(dx, dz);
      this.bob += dt * speed * 1.2;
    }
    // keep inside the grounds
    const lim = WORLD.groundSize / 2 - 6;
    this.pos.x = MathUtils.clamp(this.pos.x, -lim, lim);
    this.pos.z = MathUtils.clamp(this.pos.z, -lim, lim);
    this.pos.y = this.heightAt(this.pos.x, this.pos.z);

    this.model.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.model.rotation.y = this.yaw;
    this.model.position.y += moving ? Math.abs(Math.sin(this.bob)) * 0.08 : 0;

    this._updateCamera();
  }

  _updateCamera() {
    const cp = Math.cos(this.camPitch);
    const want = new Vector3(
      this.pos.x + Math.sin(this.camYaw) * this.camDist * cp,
      this.pos.y + 2.4 + Math.sin(this.camPitch) * this.camDist,
      this.pos.z + Math.cos(this.camYaw) * this.camDist * cp,
    );
    // pull camera in if it would sit inside a tower/wall collider
    let dist = this.camDist;
    for (const c of this.colliders) {
      if (c.type !== 'circle') continue;
      const d = Math.hypot(want.x - c.x, want.z - c.z);
      if (d < c.r + 1) dist = Math.min(dist, Math.max(3, this.camDist - (c.r + 1 - d)));
    }
    const cp2 = Math.cos(this.camPitch);
    this.camera.position.set(
      this.pos.x + Math.sin(this.camYaw) * dist * cp2,
      this.pos.y + 2.4 + Math.sin(this.camPitch) * dist,
      this.pos.z + Math.cos(this.camYaw) * dist * cp2,
    );
    this.camera.lookAt(this.pos.x, this.pos.y + 1.6, this.pos.z);
  }
}
