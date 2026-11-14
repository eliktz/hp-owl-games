// Shared mesh factories for the castle interiors (interiors.js). Textured stone + wood
// (the same committed CC0 maps the exterior uses) give the rooms real surfaces; warm
// emissive accents (candles, torches, fire, stained glass, the enchanted ceiling) bloom
// without adding runtime lights (iPad rule). Call `await ensureTex()` before building a room.
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
  CircleGeometry, MeshStandardMaterial, Color, DoubleSide, RepeatWrapping, InstancedMesh, Object3D, SRGBColorSpace, CanvasTexture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadTexture } from './assets.js';

let _tex = null;
// Load the stone/wood maps once; rooms share them (cloned per-mesh for independent tiling).
export async function ensureTex() {
  if (_tex) return _tex;
  const [wall, floorT, wood] = await Promise.all([
    loadTexture('castle_wall_1k.jpg', { repeat: 1 }),
    loadTexture('slate_roof_1k.jpg', { repeat: 1 }),
    loadTexture('wood_1k.jpg', { repeat: 1 }),
  ]);
  _tex = { wall, floor: floorT, wood };
  return _tex;
}

// A cloned, independently-tiled copy of a source map (shares the image, cheap).
// Tiled copies and the materials that use them are CACHED by (map, repeat, colour): rooms are
// rebuilt every time you walk in, and uncached clones used to pile up (56 → 139 textures after
// five rooms). Now a revisit allocates nothing new, and equal surfaces share one material.
const _tiles = new Map(), _mats = new Map();
const q = (v) => Math.round(v * 4) / 4;
function tile(src, rx, ry) {
  if (!src) return null;
  rx = q(rx) || 0.25; ry = q(ry) || 0.25;
  const key = src.uuid + '|' + rx + '|' + ry;
  let t = _tiles.get(key);
  if (!t) { t = src.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(rx, ry); _tiles.set(key, t); }
  return t;
}
function cached(kind, rx, ry, color, make) {
  const key = kind + '|' + q(rx) + '|' + q(ry) + '|' + color;
  let m = _mats.get(key);
  if (!m) { m = make(); _mats.set(key, m); }
  return m;
}
export const stoneMat = (rx, ry, color = 0x8f8a80) => cached('stone', rx, ry, color, () => new MeshStandardMaterial({ color, map: tile(_tex?.wall, rx, ry), roughness: 0.96 }));
const woodMat = (rx = 1, ry = 1, color = 0x6a4428) => cached('wood', rx, ry, color, () => new MeshStandardMaterial({ color, map: tile(_tex?.wood, rx, ry), roughness: 0.85 }));
export const kitStats = () => ({ tiles: _tiles.size, mats: _mats.size });

export const MAT = {
  get stone() { return stoneMat(1.5, 1.5); },
  get wood() { return woodMat(1, 1); },
  dark: new MeshStandardMaterial({ color: 0x241b14, roughness: 0.9 }),
  rug:  new MeshStandardMaterial({ color: 0x6a1420, roughness: 0.95 }),
  gold: new MeshStandardMaterial({ color: 0xb98b2e, roughness: 0.45, metalness: 0.5 }),
};
const emissive = (c, i = 1) => new MeshStandardMaterial({ color: c, emissive: new Color(c), emissiveIntensity: i, roughness: 0.4 });

export function floor(group, w, d, color = 0x9a8f7e, tileM = 2.5, rough = 0.92) {
  // Warm flagstone: the castle-wall map (not the near-black slate) tiled per ~tileM metres so
  // the floor reads as lit stone, not a flat dark void. Bigger tiles (larger tileM) read as a
  // grand hall's flagstones rather than a busy outdoor cobble yard.
  const m = new Mesh(new PlaneGeometry(w, d), cached('floor' + rough, w / tileM, d / tileM, color, () => new MeshStandardMaterial({ color, map: tile(_tex?.wall, w / tileM, d / tileM), roughness: rough })));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; group.add(m); return m;
}

// A textured stone wall segment centred at (x,z); tiles the map to its size.
export function wall(group, x, z, w, h, t, rotY = 0, color = 0x8f8a80) {
  const long = Math.max(w, t);
  const m = new Mesh(new BoxGeometry(w, h, t), stoneMat(long / 3, h / 3, color));
  m.position.set(x, h / 2, z); m.rotation.y = rotY; m.receiveShadow = true; group.add(m); return m;
}

export function ceiling(group, w, d, y, color = 0x3c3850) {
  const m = new Mesh(new PlaneGeometry(w, d), cached('ceil', w / 5, d / 5, color, () => new MeshStandardMaterial({ color, map: tile(_tex?.wall, w / 5, d / 5), roughness: 0.97 })));
  m.rotation.x = Math.PI / 2; m.position.y = y; group.add(m); return m;
}

// A stone column with flared base + capital (gives rooms vertical rhythm).
// Pass the room's collider array as `cols` to make it solid: one circle at the plinth's
// radius (r * 1.6, between the plinth top 1.5 r and foot 1.7 r), so the hero stops with her
// feet at the plinth instead of walking into it. The indoor camera arm already raycasts it.
export function column(group, x, z, h, r = 0.5, cols = null) {
  if (cols) cols.push({ type: 'circle', x, z, r: r * 1.6, column: true });
  const g = new Group(); g.position.set(x, 0, z);
  const m = stoneMat(0.6, h / 3, 0x7d7870);
  // Shaft + base + capital share one material, so they are ONE merged mesh (one draw call per
  // column). (This used to be `g.add(base).position.y = ...`: add() returns the GROUP, which
  // lifted every column up to the ceiling with its base and capital stacked at the shaft foot.)
  const geo = mergeGeometries([
    new CylinderGeometry(r, r * 1.1, h, 12).translate(0, h / 2, 0),
    new CylinderGeometry(r * 1.5, r * 1.7, 0.5, 12).translate(0, 0.25, 0),
    new CylinderGeometry(r * 1.6, r * 1.2, 0.5, 12).translate(0, h - 0.25, 0),
  ]);
  const shaft = new Mesh(geo, m); shaft.castShadow = true; shaft.receiveShadow = true; g.add(shaft);
  group.add(g); return g;
}

// An arched oak door against a wall, with a stone surround. Visual only (door triggers in
// interiors.js fire by proximity). Centre at (x,z); rotY orients it along the wall.
export function doorLeaf(group, x, z, rotY = 0, { w = 2.6, h = 4, color = 0x5a3a1e } = {}) {
  const g = new Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  const frame = new Mesh(new BoxGeometry(w + 0.7, h + 0.5, 0.5), stoneMat((w + 0.7) / 3, (h + 0.5) / 3, 0x9a948a));
  frame.position.set(0, (h + 0.5) / 2, -0.12); g.add(frame);
  const leaf = new Mesh(new BoxGeometry(w, h, 0.22), woodMat(1, 2, color));
  leaf.position.set(0, h / 2, 0.08); leaf.castShadow = true; g.add(leaf);
  for (const sx of [-w / 4, w / 4]) {                       // iron bands + a knocker ring
    const band = new Mesh(new BoxGeometry(0.12, h - 0.4, 0.26), MAT.dark); band.position.set(sx, h / 2, 0.08); g.add(band);
  }
  const ring = new Mesh(new SphereGeometry(0.12, 10, 8), MAT.gold); ring.position.set(0, h * 0.5, 0.22); g.add(ring);
  const arch = new Mesh(new ConeGeometry(w * 0.7, 1.1, 20, 1, false, 0, Math.PI), emissive(0xffcf7a, 0.25));
  arch.position.set(0, h + 0.1, 0.12); g.add(arch);
  group.add(g); return g;
}

// Floating candle (wax stick + glowing flame). userData.flame bobs/flickers in interiors.js.
export function candle(x, y, z) {
  const g = new Group();
  g.add(new Mesh(new CylinderGeometry(0.04, 0.05, 0.4, 6), new MeshStandardMaterial({ color: 0xf3e6c0, roughness: 0.7 })));
  const flame = new Mesh(new SphereGeometry(0.08, 8, 8), emissive(0xffb34d, 2.2));
  flame.position.y = 0.3; flame.scale.y = 1.6; g.add(flame);
  g.position.set(x, y, z); g.userData.flame = flame; g.userData.baseY = y; g.userData.light = { k: 'candle', c: 0xffc070 }; return g;
}

// Wall torch (bracket + flame) with a warm emissive back-glow so walls read as lit.
export function torch(group, x, y, z, color = 0xff8a2a) {
  const g = new Group();
  const stick = new Mesh(new CylinderGeometry(0.03, 0.03, 0.4, 5), MAT.dark); stick.rotation.z = 0.5; g.add(stick);
  const flame = new Mesh(new ConeGeometry(0.11, 0.34, 8), emissive(color, 2.4)); flame.position.set(0.12, 0.28, 0); g.add(flame);
  const glow = new Mesh(new SphereGeometry(0.5, 8, 8), emissive(color, 0.18)); glow.position.set(0.12, 0.28, 0.1); g.add(glow);
  g.position.set(x, y, z); g.userData.flame = flame; g.userData.light = { k: 'torch', c: color === 0xff8a2a ? 0xffa040 : color }; group.add(g); return g;
}

// Long dining table with two benches, a house-colour runner and golden plates.
export const BENCH_TOP = 0.39;
export function longTable(group, x, z, len = 14, runner = 0x7a1020) {
  const g = new Group();
  const top = new Mesh(new BoxGeometry(1.5, 0.14, len), woodMat(1, len / 3)); top.position.y = 0.92; top.castShadow = true; top.receiveShadow = true; g.add(top);
  const run = new Mesh(new BoxGeometry(0.7, 0.02, len - 0.4), new MeshStandardMaterial({ color: runner, roughness: 0.85 }));
  run.position.y = 1.0; g.add(run);
  // The dark end supports + bench legs are one instanced unit box, the gold plates and cups one
  // instanced mesh each: 3 draw calls instead of 14 per Great Hall table (same look).
  const d = new Object3D(), dark = [];
  for (const sz of [-len / 2 + 0.6, len / 2 - 0.6]) dark.push([0, 0.45, sz, 1.3, 0.9, 0.22]);
  // Benches are sitting height (top BENCH_TOP = 0.39): a seated student's (Sit clip) thighs
  // rest on the top with the shoes on the floor (students.js reads the same constant).
  for (const sx of [-1.15, 1.15]) {
    const bench = new Mesh(new BoxGeometry(0.5, 0.12, len), woodMat(1, len / 3)); bench.position.set(sx, BENCH_TOP - 0.06, 0); bench.castShadow = true; g.add(bench);
    for (const sz of [-len / 2 + 0.6, len / 2 - 0.6]) dark.push([sx, (BENCH_TOP - 0.12) / 2, sz, 0.45, BENCH_TOP - 0.12, 0.18]);
  }
  const legs = new InstancedMesh(new BoxGeometry(1, 1, 1), MAT.dark, dark.length);
  dark.forEach(([x, y, z, w, h, l], i) => { d.position.set(x, y, z); d.scale.set(w, h, l); d.updateMatrix(); legs.setMatrixAt(i, d.matrix); });
  legs.computeBoundingSphere(); g.add(legs);
  const at = [];
  for (let p = -len / 2 + 2; p < len / 2 - 1; p += 3.5) at.push(p);
  const plates = new InstancedMesh(new CylinderGeometry(0.28, 0.24, 0.05, 14), MAT.gold, at.length);
  const cups = new InstancedMesh(new CylinderGeometry(0.1, 0.13, 0.26, 10), MAT.gold, at.length);
  d.scale.set(1, 1, 1);
  at.forEach((p, i) => {
    d.position.set(0, 1.02, p); d.updateMatrix(); plates.setMatrixAt(i, d.matrix);
    d.position.set(0.5, 1.12, p - 0.4); d.updateMatrix(); cups.setMatrixAt(i, d.matrix);
  });
  plates.computeBoundingSphere(); cups.computeBoundingSphere(); g.add(plates, cups);
  g.position.set(x, 0, z); group.add(g); return g;
}

// ---- Stained glass: one procedural 256 x 704 CanvasTexture per window style, shared ----
// The canvas covers the whole window, pane (2.2 x 5 m, y -2.5..2.5) plus the half-disc arch
// (radius 1.1 above y 2.5): 6.1 m tall, ~116 px per metre (lead came ~3.5 px). It is the
// EMISSIVE map (black lead emits nothing, the jewel panes glow); albedo stays near-black so
// the glass never reads as lit paint. 'hall' = Great Hall: amber quarries, a jewel border,
// eight medallions (two lancets x four mullion panels) and a quartered house crest in the
// arch. 'class' = classrooms: quarries, border, one medallion per lancet, a small roundel.
const GW = 2.2, GH = 6.1, GTOP = 3.6, GPX = 256, GPY = 704;
const LEAD = '#0b0806';
const JEWEL = { red: '#b3162a', ruby: '#7e0d1c', blue: '#1d4fbf', navy: '#14307e', gold: '#eab234', amber: '#d6861a',
  green: '#1e8c3d', emerald: '#0f6a2c', violet: '#5b2a8f', white: '#cfc3a0' };
const _glassTex = new Map(), _glassMats = new Set();
function glassTex(style) {
  let t = _glassTex.get(style);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = GPX; c.height = GPY;
  const x = c.getContext('2d');
  let seed = style === 'hall' ? 7 : 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const sx = GPX / GW, sy = GPY / GH;
  x.fillStyle = LEAD; x.fillRect(0, 0, GPX, GPY);
  x.setTransform(sx, 0, 0, -sy, (GW / 2) * sx, GTOP * sy);   // draw in window metres, y up
  const lw = 0.032;
  const shape = () => { x.beginPath(); x.moveTo(-1.1, -2.5); x.lineTo(1.1, -2.5); x.lineTo(1.1, 2.5); x.arc(0, 2.5, 1.1, 0, Math.PI); x.closePath(); };
  const vary = (hex, k = 0.1) => { const col = new Color(hex); const h = {}; col.getHSL(h); col.setHSL(h.h, h.s, Math.max(0, Math.min(1, h.l + (rnd() - 0.5) * k))); return '#' + col.getHexString(); };
  const lead = (w = lw) => { x.strokeStyle = LEAD; x.lineWidth = w; x.stroke(); };
  x.save(); shape(); x.clip();
  // 1. diamond quarries: muted amber-cream (linear ~0.4: they glow but never bloom)
  const qw = style === 'hall' ? 0.28 : 0.34, qh = qw * 1.45;
  for (let j = -1; j < GH / (qh / 2) + 2; j++) for (let i = -5; i <= 5; i++) {
    const cx = i * qw + (j % 2 ? qw / 2 : 0), cy = -2.5 + j * qh / 2;
    x.beginPath(); x.moveTo(cx, cy - qh / 2); x.lineTo(cx + qw / 2, cy); x.lineTo(cx, cy + qh / 2); x.lineTo(cx - qw / 2, cy); x.closePath();
    x.fillStyle = vary(rnd() < 0.08 ? '#8aa0b0' : '#a68e5e', 0.12); x.fill(); lead(lw * 0.8);
  }
  // 2. jewel border band round the pane and the arch
  const bw = 0.13, blues = [JEWEL.red, JEWEL.blue, JEWEL.gold, JEWEL.blue];
  for (const side of [-1, 1]) for (let k = 0, yy = -2.5; yy < 2.5; yy += 0.26, k++) {
    x.beginPath(); x.rect(side < 0 ? -1.1 : 1.1 - bw, yy, bw, Math.min(0.26, 2.5 - yy)); x.fillStyle = vary(blues[k % 4], 0.08); x.fill(); lead();
  }
  for (let k = 0, yy = -1.1; yy < 1.1; yy += 0.26, k++) { x.beginPath(); x.rect(yy, -2.5, Math.min(0.26, 1.1 - yy), bw); x.fillStyle = vary(blues[(k + 1) % 4], 0.08); x.fill(); lead(); }
  const nArc = 9;
  for (let k = 0; k < nArc; k++) {
    const a0 = (k / nArc) * Math.PI, a1 = ((k + 1) / nArc) * Math.PI;
    x.beginPath(); x.arc(0, 2.5, 1.1, a0, a1); x.arc(0, 2.5, 1.1 - bw, a1, a0, true); x.closePath();
    x.fillStyle = vary(blues[k % 4], 0.08); x.fill(); lead();
  }
  // 3. medallions: a ring of alternating jewel segments round a jewel disc with a gold boss
  const schemes = [[JEWEL.red, JEWEL.gold, JEWEL.blue], [JEWEL.blue, JEWEL.red, JEWEL.gold], [JEWEL.green, JEWEL.gold, JEWEL.ruby],
    [JEWEL.violet, JEWEL.gold, JEWEL.green], [JEWEL.navy, JEWEL.amber, JEWEL.red], [JEWEL.emerald, JEWEL.red, JEWEL.gold]];
  const medal = (cx, cy, r, sc) => {
    const n = 8;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      x.beginPath(); x.arc(cx, cy, r, a0, a1); x.arc(cx, cy, r * 0.66, a1, a0, true); x.closePath();
      x.fillStyle = vary(k % 2 ? sc[1] : sc[0], 0.06); x.fill(); lead();
    }
    x.beginPath(); x.arc(cx, cy, r * 0.66, 0, Math.PI * 2); x.fillStyle = vary(sc[2], 0.06); x.fill(); lead();
    for (let k = 0; k < 4; k++) {                                 // a four-petal flower in the disc
      const a = k * Math.PI / 2 + Math.PI / 4;
      x.beginPath(); x.ellipse(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3, r * 0.22, r * 0.12, a, 0, Math.PI * 2);
      x.fillStyle = vary(sc[1], 0.05); x.fill(); lead(lw * 0.8);
    }
    x.beginPath(); x.arc(cx, cy, r * 0.13, 0, Math.PI * 2); x.fillStyle = JEWEL.gold; x.fill(); lead(lw * 0.8);
  };
  // panels between the stone mullion bars (pane-local y -2.5 | -1.5 | 0 | 1.5 | 2.5), two lancets
  const panels = style === 'hall' ? [[-2.0, 0.33], [-0.75, 0.43], [0.75, 0.43], [2.0, 0.33]] : [[0.75, 0.43], [-0.75, 0.3]];
  let si = 0;
  for (const [cy, r] of panels) for (const cx of [-0.53, 0.53]) medal(cx, cy, r, schemes[si++ % schemes.length]);
  // 4. the arch: deep-blue field with gold stars, a quartered house crest (hall) or a roundel
  x.beginPath(); x.arc(0, 2.5, 1.1 - bw, 0, Math.PI); x.closePath(); x.fillStyle = JEWEL.navy; x.fill(); lead();
  for (let k = 0; k < 14; k++) {
    const a = rnd() * Math.PI, rr = 0.35 + rnd() * 0.55, px = Math.cos(a) * rr, py = 2.5 + Math.sin(a) * rr;
    x.beginPath(); x.arc(px, py, 0.035, 0, Math.PI * 2); x.fillStyle = JEWEL.gold; x.fill();
  }
  if (style === 'hall') {
    const top = 3.33, mid = 2.98, bot = 2.56, hw = 0.3;
    const shield = () => { x.beginPath(); x.moveTo(-hw, top); x.lineTo(hw, top); x.lineTo(hw, mid); x.quadraticCurveTo(hw, bot + 0.12, 0, bot); x.quadraticCurveTo(-hw, bot + 0.12, -hw, mid); x.closePath(); };
    x.beginPath(); x.arc(0, 2.93, 0.47, 0, Math.PI * 2); x.fillStyle = JEWEL.gold; x.fill(); lead();      // gold glory
    x.save(); shield(); x.clip();
    const yc = 2.98;
    [[JEWEL.red, -1, 1], [JEWEL.green, 1, 1], [JEWEL.blue, -1, -1], [JEWEL.gold, 1, -1]].forEach(([col, qx, qy]) => {
      x.beginPath(); x.rect(qx < 0 ? -hw : 0, qy > 0 ? yc : bot - 0.05, hw, qy > 0 ? top - yc : yc - bot + 0.05);
      x.fillStyle = col === JEWEL.gold ? '#f0c040' : col; x.fill();
    });
    x.restore();
    shield(); lead(lw * 1.4);
    x.beginPath(); x.moveTo(0, top); x.lineTo(0, bot); x.moveTo(-hw, yc); x.lineTo(hw, yc); lead();
  } else {
    medal(0, 2.95, 0.3, [JEWEL.gold, JEWEL.red, JEWEL.blue]);
  }
  x.restore();
  shape(); lead(lw * 1.5);                                       // outer came
  t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  _glassTex.set(style, t);
  return t;
}
// One material per (style, tint): albedo near-black, emissive = the glass texture x tint.
// Its intensity follows the outdoor time (glassGlow, called by every room's update).
function glassMat(style, hue, glow) {
  const key = style + '|' + hue + '|' + glow;
  let m = _mats.get('glass|' + key);
  if (!m) {
    const tint = new Color(0xffffff).lerp(new Color(hue), style === 'hall' ? 0.18 : 0.3);
    m = new MeshStandardMaterial({ color: 0x0d0b09, roughness: 0.35, emissive: tint, emissiveMap: glassTex(style), emissiveIntensity: glow, side: DoubleSide });
    m.userData.glassBase = glow; m.name = 'stained-glass-' + style;
    _mats.set('glass|' + key, m); _glassMats.add(m);
  }
  return m;
}
const GLASS_TIME = { night: 1.3, dusk: 1.1, day: 0.85 };
// Stronger at night, softer by day (the room reads the outdoor time; constant if unknown),
// with a slow faint shimmer so the glass feels alive.
export function glassGlow(t = 0) {
  const k = (GLASS_TIME[globalThis.window?.__game?.env?.time] ?? 1) * (1 + Math.sin(t * 0.7) * 0.04);
  for (const m of _glassMats) m.emissiveIntensity = m.userData.glassBase * k;
}

// Tall stained-glass window: a glowing leaded pane behind a dark stone mullion cross.
// style 'hall' (Great Hall) or 'class' (classrooms); `hue` lightly tints the glass.
export function window2(group, x, y, z, rotY = 0, hue = 0x7fb0ff, glow = 1.25, style = 'hall') {
  const g = new Group(); g.position.set(x, y, z); g.rotation.y = rotY;
  // The surround sits wholly BEHIND the pane (its front face used to be 3 cm in front of the
  // glass, which hid the pane completely); the mullion bars sit just in front of it.
  const surround = new Mesh(new BoxGeometry(2.9, 7.4, 0.3), MAT.dark); surround.position.set(0, 0.2, -0.17); g.add(surround);
  const mat = glassMat(style, hue, glow);
  // pane UVs sample the lower 5 / 6.1 of the window texture, the arch disc the top
  const paneGeo = new PlaneGeometry(GW, 5), pu = paneGeo.attributes.uv;
  for (let i = 0; i < pu.count; i++) pu.setY(i, pu.getY(i) * (5 / GH));
  const pane = new Mesh(paneGeo, mat); g.add(pane);
  const mullion = new Mesh(new BoxGeometry(0.16, 5, 0.1), MAT.dark); mullion.position.z = 0.05; g.add(mullion);
  // (set each bar's transform, then add: `g.add(bar).position.y = yy` moved the whole window)
  for (const yy of [-1.5, 0, 1.5]) { const bar = new Mesh(new BoxGeometry(2.2, 0.14, 0.1), MAT.dark); bar.position.set(0, yy, 0.05); g.add(bar); }
  // Arched top as a flat half-disc coplanar with the pane (a 3D cone read as a torn triangle
  // at grazing angles). The dark surround behind it frames the arch.
  const topGeo = new CircleGeometry(1.1, 18, 0, Math.PI), tp = topGeo.attributes.position, tu = topGeo.attributes.uv;
  for (let i = 0; i < tu.count; i++) tu.setXY(i, (tp.getX(i) + GW / 2) / GW, (5 + tp.getY(i)) / GH);
  const top = new Mesh(topGeo, mat);
  top.position.y = 2.5; g.add(top);
  g.userData.light = { k: 'window', c: hue };            // the glass throws a patch of its colour on the floor
  group.add(g); return g;
}

// A hanging house banner (coloured cloth + crest bar + pole) against a wall.
// opts.lift: cloth lightened + a faint self-glow so it reads in candle light; opts.crest: crest glow.
export function banner(group, x, y, z, color, rotY = 0, { lift = 0, crestGlow = 0.22 } = {}) {
  const g = new Group(); g.position.set(x, y, z); g.rotation.y = rotY;
  const cc = new Color(color);
  if (lift) {                                  // lift in sRGB, then keep albedo <= 0.84 (no bloom)
    const h = {}; cc.getHSL(h, SRGBColorSpace); cc.setHSL(h.h, Math.min(1, h.s + 0.04), h.l + lift, SRGBColorSpace);
    const rgb = {}; cc.getRGB(rgb, SRGBColorSpace); const mx = Math.max(rgb.r, rgb.g, rgb.b);
    if (mx > 0.84) cc.setRGB(rgb.r * 0.84 / mx, rgb.g * 0.84 / mx, rgb.b * 0.84 / mx, SRGBColorSpace);
  }
  const cloth = new Mesh(new PlaneGeometry(2.4, 5.5), new MeshStandardMaterial({ color: cc, roughness: 0.85, side: DoubleSide,
    emissive: cc.clone(), emissiveIntensity: lift ? 0.22 : 0 })); g.add(cloth);
  const crest = new Mesh(new PlaneGeometry(1.4, 1.4), emissive(0xd9b24a, crestGlow)); crest.material.side = DoubleSide; crest.position.z = 0.02; g.add(crest);
  // the gold hanging rod across the top of the cloth (`g.add(rod).rotation.z = ...` used to turn
  // the whole banner on its side)
  const rod = new Mesh(new CylinderGeometry(0.07, 0.07, 2.8, 6), MAT.gold); rod.rotation.z = Math.PI / 2; rod.position.set(0, 2.75, 0.03); g.add(rod);
  group.add(g); return g;
}

// Enchanted ceiling: a dark night-sky dome sprinkled with emissive stars (Great Hall magic).
export function enchantedCeiling(group, w, d, y, { color = 0x0a0f24, glow = 0x141c44, glowI = 0.6 } = {}) {
  const sky = new Mesh(new PlaneGeometry(w, d), new MeshStandardMaterial({ color, emissive: new Color(glow), emissiveIntensity: glowI, side: DoubleSide }));
  sky.rotation.x = Math.PI / 2; sky.position.y = y; group.add(sky);
  // the 70 stars are one instanced mesh (they used to be 70 draw calls)
  const stars = new InstancedMesh(new SphereGeometry(0.07, 6, 6), emissive(0xfff4c2, 2.0), 70), o = new Object3D();
  for (let i = 0; i < 70; i++) { o.position.set(Math.sin(i * 12.9) * 0.46 * w, y - 0.3, Math.cos(i * 7.3) * 0.46 * d); o.updateMatrix(); stars.setMatrixAt(i, o.matrix); }
  stars.frustumCulled = false; stars.name = 'ceiling-stars'; group.add(stars);
  return sky;
}

export { emissive, woodMat };
