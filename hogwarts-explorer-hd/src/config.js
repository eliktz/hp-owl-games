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
// exposure = renderer.toneMappingExposure outdoors; win = castle window emissiveIntensity
// (day almost off, dusk warm, night glittering). Fog colours sit near each HDRI's horizon.
export const TIMES = {
  day:  { sun: 0xfff0d2, sunI: 2.6, elev: 52, azim: 135, fog: 0xc9d6e2, fogDensity: 0.0030, env: 1.0, amb: 0.5,  exposure: 1.0,  win: 0.25 },
  dusk: { sun: 0xff9448, sunI: 2.4, elev: 9,  azim: 250, fog: 0xd29a74, fogDensity: 0.0040, env: 0.75, amb: 0.36, exposure: 1.05, win: 1.6 },
  night:{ sun: 0x9fb8ff, sunI: 1.0, elev: 24, azim: 300, fog: 0x15283a, fogDensity: 0.0056, env: 0.45, amb: 0.30, exposure: 1.2,  win: 2.6 },
};
// Indoor rooms are tuned at this exposure; the time button never changes it.
export const INDOOR_EXPOSURE = 1.0;

// Landmark spawn points for the (later) map/teleport feature; used now for test hooks.
export const SPOTS = {
  gates:    { x: 0,    y: 0, z: 70,  label: 'השער הראשי' },
  courtyard:{ x: 0,    y: 0, z: 38,  label: 'החצר' },
  lake:     { x: -42,  y: 0, z: -10, label: 'האגם' },
  bridge:   { x: 48,   y: 0, z: -8,  label: 'הגשר' },
  hut:      { x: 86,   y: 0, z: 36,  label: 'הבקתה של האגריד' },
};
// More places you can fast-travel to. Kept OUT of SPOTS (the screenshot harness walks every
// SPOT) but used the same way by the map + lessons.
export const PLACES = {
  greenhouse: { x: -58, y: 0, z: 70, label: 'החממה' },
  paddock:    { x: 74,  y: 0, z: 50, label: 'יצורי הפלא' },
  pitch:      { x: 0,   y: 0, z: 96, label: 'מגרש הקווידיץ׳' },
};

export const WORLD = {
  groundSize: 420,
  waterLevel: -1.2,
  playerHeight: 1.7,
  playerRadius: 0.4,
  walkSpeed: 7.5,
  runSpeed: 12,
};
