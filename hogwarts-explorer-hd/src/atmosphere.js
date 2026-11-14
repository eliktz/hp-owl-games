// Interior atmosphere without a single extra light (iPad rule: never add lights at runtime).
// Every flame in a room "bakes" a warm pool on the floor, torches wash the wall behind them,
// stained glass throws a coloured patch, and each flame gets a soft crossed-quad halo. All of
// it lives in ONE additive mesh per room (a single draw call), clipped against the room's wall
// colliders so light never leaks through stone. Also: the hero's soft blob shadow indoors.
import {
  Mesh, BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, AdditiveBlending, DoubleSide,
  CanvasTexture, Color, Vector3, PlaneGeometry, SRGBColorSpace,
} from 'three';

function radial(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
let _pool = null, _shadow = null;
const poolTex = () => _pool || (_pool = radial([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.55)'], [0.7, 'rgba(255,255,255,.16)'], [1, 'rgba(255,255,255,0)']]));

// Scan a built room for tagged light sources (userData.light) and bake their glow.
// Returns { mesh, update(t) } — update gives the whole room a gentle shared flicker.
export function bakeLight(group, colliders) {
  group.updateMatrixWorld(true);
  const pos = [], uv = [], col = [], idx = [];
  const tc = new Color(), v = new Vector3();
  function quad(p0, p1, p2, p3, u0, v0, u1, v1, color, a) {
    const n = pos.length / 3;
    pos.push(...p0, ...p1, ...p2, ...p3); uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    tc.setHex(color); for (let i = 0; i < 4; i++) col.push(tc.r * a, tc.g * a, tc.b * a);
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const boxes = (colliders || []).filter(c => c.type === 'box' && !c.angle);
  // a floor pool centred (x,z), clipped so it never crosses a wall box from where (sx,sz) stands
  function floorPool(x, z, r, color, a, sx = x, sz = z) {
    let x0 = x - r, x1 = x + r, z0 = z - r, z1 = z + r;
    for (const c of boxes) {
      const bx0 = c.x - c.hw, bx1 = c.x + c.hw, bz0 = c.z - c.hd, bz1 = c.z + c.hd;
      if (sz > bz0 - 0.2 && sz < bz1 + 0.2) { if (bx1 <= sx + 0.05 && bx1 > x0) x0 = bx1 + 0.04; if (bx0 >= sx - 0.05 && bx0 < x1) x1 = bx0 - 0.04; }
      if (sx > bx0 - 0.2 && sx < bx1 + 0.2) { if (bz1 <= sz + 0.05 && bz1 > z0) z0 = bz1 + 0.04; if (bz0 >= sz - 0.05 && bz0 < z1) z1 = bz0 - 0.04; }
    }
    if (x1 - x0 < 0.4 || z1 - z0 < 0.4) return;
    const U = q => (q - (x - r)) / (2 * r), V = q => (q - (z - r)) / (2 * r);
    quad([x0, 0.07, z1], [x1, 0.07, z1], [x1, 0.07, z0], [x0, 0.07, z0], U(x0), V(z1), U(x1), V(z0), color, a);
  }
  // nearest wall face to a point → { axis, c (face coordinate), n (room-side normal sign) }
  function wallNear(x, z, reach = 1.3) {
    let best = null, bd = reach;
    for (const c of boxes) {
      const bx0 = c.x - c.hw, bx1 = c.x + c.hw, bz0 = c.z - c.hd, bz1 = c.z + c.hd;
      if (z > bz0 - 0.3 && z < bz1 + 0.3) for (const [f, n] of [[bx1, 1], [bx0, -1]]) { const d = (x - f) * n; if (d > -0.2 && d < bd) { bd = d; best = { axis: 'x', c: f, n }; } }
      if (x > bx0 - 0.3 && x < bx1 + 0.3) for (const [f, n] of [[bz1, 1], [bz0, -1]]) { const d = (z - f) * n; if (d > -0.2 && d < bd) { bd = d; best = { axis: 'z', c: f, n }; } }
    }
    return best;
  }
  // a soft halo: two crossed upright quads (reads as a glow from any side, zero sprites)
  function halo(x, y, z, s, color, a) {
    quad([x - s, y - s, z], [x + s, y - s, z], [x + s, y + s, z], [x - s, y + s, z], 0, 0, 1, 1, color, a);
    quad([x, y - s, z - s], [x, y - s, z + s], [x, y + s, z + s], [x, y + s, z - s], 0, 0, 1, 1, color, a);
  }
  // a horizontal soft disc (one quad; the radial texture makes it round)
  function disc(x, y, z, r, color, a) {
    quad([x - r, y, z + r], [x + r, y, z + r], [x + r, y, z - r], [x - r, y, z - r], 0, 0, 1, 1, color, a);
  }
  let high = 0, hx = 0, hz = 0;
  group.traverse(o => {
    const L = o.userData && o.userData.light; if (!L) return;
    o.getWorldPosition(v); group.worldToLocal(v);
    const x = v.x, y = v.y, z = v.z, c = L.c || 0xffa848;
    if (L.k === 'torch') {
      const w = wallNear(x, z);
      const sx = w && w.axis === 'x' ? w.c + w.n * 0.8 : x, sz = w && w.axis === 'z' ? w.c + w.n * 0.8 : z;
      floorPool(x, z, 4.4, c, 0.5, sx, sz);
      if (w) {
        const r = 2.8, y0 = Math.max(0.05, y - r), y1 = y + r, off = w.c + w.n * 0.04, V0 = (y0 - (y - r)) / (2 * r);
        if (w.axis === 'x') quad([off, y0, z - r], [off, y0, z + r], [off, y1, z + r], [off, y1, z - r], 0, V0, 1, 1, c, 0.42);
        else quad([x - r, y0, off], [x + r, y0, off], [x + r, y1, off], [x - r, y1, off], 0, V0, 1, 1, c, 0.42);
      }
      halo(x + (w ? (w.axis === 'x' ? w.n * 0.25 : 0) : 0), y + 0.3, z + (w && w.axis === 'z' ? w.n * 0.25 : 0), 0.85, c, 0.55);
    } else if (L.k === 'candle') {
      if (y < 3) { floorPool(x, z, 2.4, c, 0.22); halo(x, y + 0.3, z, 0.42, c, 0.5); }
      else { high++; hx += x; hz += z; halo(x, y + 0.3, z, 0.5, c, 0.6); }
    } else if (L.k === 'chandelier') {
      floorPool(x, z, 7.5, c, 0.42);
      // hung high (rooms hang them ~0.6 m under the ceiling): upright crossed quads would pierce
      // the ceiling and show a hard-edged bow-tie from below, so a high chandelier gets ONE
      // horizontal soft disc at its candle line — a round warm glow from below, an ellipse from
      // the side, never touching stone. Low ones keep the crossed halo.
      if (y > 4) disc(x, y + 0.12, z, 2.3, c, 0.5);
      else halo(x, y, z, 2.2, c, 0.3);
    }
    else if (L.k === 'fire') { floorPool(x, z + (L.dz || 0), 7, 0xff8030, 0.7, x, z + (L.dz || 1.5)); halo(x, y + 0.8, z + (L.dz ? 0.6 : 0), 1.8, 0xff8a3a, 0.45); }
    else if (L.k === 'window') { const fx = Math.sin(o.rotation.y), fz = Math.cos(o.rotation.y); floorPool(x + fx * 4.2, z + fz * 4.2, 3.4, c, 0.34); }
    else if (L.k === 'glow') { floorPool(x, z, L.r || 3, c, L.a || 0.3); }
  });
  if (high > 6) floorPool(hx / high, hz / high, 11, 0xffc878, 0.2);      // the drift of floating candles warms the aisle
  if (!pos.length) return { mesh: null, update() {} };
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mat = new MeshBasicMaterial({ map: poolTex(), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false, side: DoubleSide });
  const mesh = new Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.raycast = () => {};
  mesh.name = 'lightPools'; group.add(mesh);
  return { mesh, update(t) { mat.color.setScalar(0.92 + 0.06 * Math.sin(t * 7.3) + 0.035 * Math.sin(t * 17.1)); } };
}

// The hero's soft contact shadow for indoors (outdoors the sun casts a real one).
export function blobShadow(scene, r = 0.75) {
  if (!_shadow) _shadow = radial([[0, 'rgba(0,0,0,.62)'], [0.55, 'rgba(0,0,0,.28)'], [1, 'rgba(0,0,0,0)']]);
  const m = new Mesh(new PlaneGeometry(2 * r, 2 * r), new MeshBasicMaterial({ map: _shadow, transparent: true, depthWrite: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 3; m.raycast = () => {}; m.visible = false; m.name = 'blobShadow';
  scene.add(m); return m;
}
