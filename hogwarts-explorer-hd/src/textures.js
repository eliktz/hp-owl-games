// Procedural canvas textures — the guaranteed fallback look when no CC0 files are
// present. Kept albedo <= 0.84 (bloom rule). Everything is tileable (RepeatWrapping).
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace } from 'three';

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, g: c.getContext('2d') };
}

function finish(c, { srgb = true, repeat = 1 } = {}) {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// deterministic pseudo-random so textures look the same every run (no Math.random reliance)
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function stoneTexture(repeat = 6, tint = '#6d6a63') {
  const { c, g } = makeCanvas(256);
  const r = rng(7);
  g.fillStyle = tint; g.fillRect(0, 0, 256, 256);
  // mortar grid of rough blocks
  for (let y = 0; y < 256; y += 32) {
    const off = (y / 32) % 2 ? 24 : 0;
    for (let x = -24; x < 256; x += 48) {
      const b = 120 + r() * 40;
      g.fillStyle = `rgb(${b * .62 | 0},${b * .6 | 0},${b * .56 | 0})`;
      g.fillRect(x + off + 2, y + 2, 44, 28);
    }
  }
  // speckle grain
  for (let i = 0; i < 2600; i++) {
    const v = r() * 60 | 0;
    g.fillStyle = `rgba(${v},${v},${v},0.08)`;
    g.fillRect(r() * 256, r() * 256, 2, 2);
  }
  return finish(c, { repeat });
}

export function slateTexture(repeat = 10) {
  const { c, g } = makeCanvas(256);
  const r = rng(19);
  g.fillStyle = '#3b4250'; g.fillRect(0, 0, 256, 256);
  // overlapping roof tiles, rows of scallops
  for (let y = 0; y < 256; y += 20) {
    for (let x = 0; x < 256; x += 22) {
      const off = (y / 20) % 2 ? 11 : 0;
      const b = 52 + r() * 28;
      g.fillStyle = `rgb(${b * .8 | 0},${b * .88 | 0},${b | 0})`;
      g.beginPath();
      g.ellipse(x + off, y + 14, 12, 12, 0, Math.PI, 0, true);
      g.fill();
    }
  }
  return finish(c, { repeat });
}

export function woodTexture(repeat = 4) {
  const { c, g } = makeCanvas(256);
  const r = rng(31);
  g.fillStyle = '#5a3d22'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 1) {
    const grain = 40 + 28 * Math.sin(y * 0.12 + Math.sin(y * 0.03) * 3) + r() * 10;
    g.fillStyle = `rgba(${grain + 30 | 0},${grain * .7 | 0},${grain * .4 | 0},0.5)`;
    g.fillRect(0, y, 256, 1);
  }
  return finish(c, { repeat });
}

export function grassTexture(repeat = 90) {
  const { c, g } = makeCanvas(128);
  const r = rng(53);
  g.fillStyle = '#3d5a2a'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4200; i++) {
    const v = r();
    const col = v < .5 ? '#35531f' : v < .85 ? '#4a6b30' : '#2d4420';
    g.fillStyle = col;
    g.fillRect(r() * 128, r() * 128, 2, 3);
  }
  return finish(c, { repeat });
}

// Normal-ish map for the lake surface (cheap wavelets).
// Calm lake ripples: a tileable sum of long, low sine swells encoded as a proper tangent-
// space normal map (z always up). Smooth slopes keep the env reflection coherent instead of
// the per-pixel sparkle of waterNormal() below.
export function waterRipples(repeat = 6, strength = 1.0) {
  const N = 256, { c, g } = makeCanvas(N), img = g.createImageData(N, N), r = rng(19);
  const waves = [];                                     // integer frequencies => seamless tiling
  for (let i = 0; i < 7; i++) waves.push({ fx: Math.round((r() - 0.5) * 10), fy: 1 + Math.round(r() * 6 + i), a: 1 / (1 + i * 0.6), p: r() * 6.283 });
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let dx = 0, dy = 0;
    for (const w of waves) {
      const k = 6.283 / N, ph = (w.fx * x + w.fy * y) * k + w.p, cs = Math.cos(ph) * w.a;
      dx += cs * w.fx * k; dy += cs * w.fy * k;
    }
    let nx = -dx * strength * 3, ny = -dy * strength * 3, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * N + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return finish(c, { srgb: false, repeat });
}

export function waterNormal(repeat = 8) {
  const { c, g } = makeCanvas(256);
  const r = rng(71);
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 128 + (r() - 0.5) * 36;
    img.data[i] = 128; img.data[i + 1] = 128; img.data[i + 2] = n; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return finish(c, { srgb: false, repeat });
}
