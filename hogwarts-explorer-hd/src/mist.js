// Lake mist (film look step 7): three big soft-gradient cards hugging the water between the
// far shore and the castle crag. Unlit, transparent, no depth write, fogged like the world.
// Each card turns about Y to face the camera, fades out when you walk close to it, and
// sways very slowly. Per-time colour/opacity come from TIMES[*].mist via setTime().
// Draw cost: <= 3 calls (one per visible card); nothing on the LOW tier (detached).
// Mist colours stay <= 0.84 linear, so the unlit cards never pass the bloom threshold.
import { Mesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, Color, SRGBColorSpace } from 'three';

// Card layout in the lake's local frame (lake centre (-90, water, -10), radius 60; the
// castle crag lies east, +x). w/h in metres; ph = sway phase.
const CARDS = [
  { x: 16, z: -6, w: 78, h: 7.5, ph: 0.0 },
  { x: 34, z: 12, w: 92, h: 9.0, ph: 2.1 },
  { x: 48, z: -18, w: 70, h: 6.5, ph: 4.2 },
];

// 128x64 alpha gradient: rises fast from the waterline (no hard seam on the water), dense in
// the lower third, thins out upward; soft left/right ends so no card edge ever reads.
function mistTexture() {
  const W = 128, H = 64, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < H; y++) {
    const v = 1 - y / (H - 1);                                   // 0 = bottom (water), 1 = top
    const vert = ss(0.0, 0.14, v) * (1 - ss(0.22, 1.0, v));
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1), horiz = ss(0.0, 0.3, u) * ss(0.0, 0.3, 1 - u);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * vert * horiz);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function buildMist(lake) {
  const map = mistTexture();
  const geo = new PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);                                      // pivot at the waterline
  const cards = CARDS.map((d) => {
    const mat = new MeshBasicMaterial({ map, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: true });
    const m = new Mesh(geo, mat);
    m.name = 'lake_mist'; m.scale.set(d.w, d.h, 1);
    m.position.set(d.x, 0.02, d.z);
    m.castShadow = m.receiveShadow = false; m.matrixAutoUpdate = true;
    m.userData.d = d;
    lake.add(m);
    return m;
  });
  let base = 0, t = 0, attached = true;
  const tint = new Color();
  const api = {
    cards,
    setTime(p) {
      const mp = p.mist || { o: 0, c: 0xffffff };
      base = mp.o; tint.setHex(mp.c);
      for (const m of cards) m.material.color.copy(tint);
    },
    // LOW tier: detach (no draw calls, no updates); HIGH/MEDIUM: attach again.
    setEnabled(on) {
      if (on === attached) return;
      attached = on;
      for (const m of cards) { if (on) lake.add(m); else lake.remove(m); }
    },
    update(dt, camera) {
      if (!attached || !lake.visible) return;
      t += dt;
      const cx = camera.position.x, cz = camera.position.z, lx = lake.position.x, lz = lake.position.z;
      for (const m of cards) {
        const d = m.userData.d;
        m.position.x = d.x + Math.sin(t * 0.021 + d.ph) * 4.0;  // a few metres over minutes
        m.position.z = d.z + Math.sin(t * 0.013 + d.ph * 1.7) * 3.0;
        const wx = lx + m.position.x, wz = lz + m.position.z;
        m.rotation.y = Math.atan2(cx - wx, cz - wz);
        const dist = Math.hypot(cx - wx, cz - wz);
        const near = Math.min(1, Math.max(0, (dist - 14) / 30));  // fade when walking into it
        // a vertical card seen from high above reads as a wall: fade with the view elevation
        const elev = (camera.position.y - lake.position.y) / Math.max(dist, 1);
        const low = 1 - Math.min(1, Math.max(0, (elev - 0.14) / 0.28));
        const o = base * near * low * (0.9 + 0.1 * Math.sin(t * 0.11 + d.ph));
        m.material.opacity = o;
        m.visible = o > 0.004;
      }
    },
  };
  return api;
}
