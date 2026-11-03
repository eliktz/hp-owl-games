// Central constants & iPad budgets for Hogwarts Explorer HD (v2).
// 1 world unit = 1 metre. Origin of characters at the feet. See DESIGN.md (art bible).

export const BUDGET = {
  maxTriangles: 300_000,   // visible triangles cap (iPad)
  maxDrawCalls: 150,
  maxTextureMB: 150,       // GPU texture memory target
  maxGpuMB: 300,           // Safari kills the tab near this for WebGPU pages
  dprHigh: 2,
  dprMedium: 1.5,
  dprLow: 1,
  shadowMapHigh: 2048,
  shadowMapMedium: 1024,
  shadowMapLow: 0,         // no shadows on low tier
};

// Bloom "albedo rule": keep bright, non-emissive albedo <= 0.84 so only true
// light sources (emissive) bloom. Threshold kept high so the world doesn't wash out.
export const BLOOM = {
  threshold: 0.9,
  strength: 0.42,
  radius: 0.5,
  maxAlbedo: 0.84,
};

// Quality tiers chosen by FPS sampling over the first few seconds.
export const TIER = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

// Time-of-day presets: sun elevation/colour, fog, ambient. Drives the day/dusk/night toggle.
export const TIMES = {
  day:  { sun: 0xfff2d6, sunI: 2.6, elev: 52, azim: 135, fog: 0xbfd4e8, fogDensity: 0.0036, env: 1.0, amb: 0.5 },
  dusk: { sun: 0xff9a4d, sunI: 2.2, elev: 9,  azim: 250, fog: 0xd8956a, fogDensity: 0.0052, env: 0.7, amb: 0.35 },
  night:{ sun: 0x9db4ff, sunI: 0.9, elev: 24, azim: 300, fog: 0x1a2340, fogDensity: 0.0060, env: 0.35, amb: 0.22 },
};

// Landmark spawn points for the (later) map/teleport feature; used now for test hooks.
export const SPOTS = {
  gates:    { x: 0,    y: 0, z: 70,  label: 'השער הראשי' },
  courtyard:{ x: 0,    y: 0, z: 38,  label: 'החצר' },
  lake:     { x: -42,  y: 0, z: -10, label: 'האגם' },
  bridge:   { x: 48,   y: 0, z: -8,  label: 'הגשר' },
  hut:      { x: 86,   y: 0, z: 36,  label: 'הבקתה של האגריד' },
};

export const WORLD = {
  groundSize: 420,
  waterLevel: -1.2,
  playerHeight: 1.7,
  playerRadius: 0.4,
  walkSpeed: 7.5,
  runSpeed: 12,
};
