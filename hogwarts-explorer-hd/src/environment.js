// Sky / lighting / time-of-day. Lights are pre-created ONCE (never added at runtime,
// per the iPad shader-recompile rule) and only their params change on toggle.
import {
  DirectionalLight, HemisphereLight, AmbientLight, FogExp2, Color,
  CanvasTexture, EquirectangularReflectionMapping, MathUtils, SRGBColorSpace,
} from 'three';
import { TIMES, INDOOR_EXPOSURE, INDOOR_ENV, INDOOR_SUN, HDRI_SKIES, PROCEDURAL_SKY } from './config.js';
import { loadHDRI } from './assets.js';

// Procedural equirect gradient sky used when no HDRI file is present.
function proceduralSky(top, horizon, ground) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, top);
  grd.addColorStop(0.48, horizon);
  grd.addColorStop(0.52, horizon);
  grd.addColorStop(1, ground);
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  const t = new CanvasTexture(c);
  t.mapping = EquirectangularReflectionMapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

const SKY_COLORS = {
  day:  ['#5a86c4', '#bcd2ec', '#6a7a66'],
  dusk: ['#2a3566', '#e08a4a', '#43303a'],
  night:['#070b1c', '#1b244a', '#0a0f1e'],
};

export class Environment {
  // opts.renderer: tone-mapping exposure per time; opts.windowMat: shared lit-window material.
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.renderer = opts.renderer || null;
    this.windowMat = opts.windowMat || null;
    this.indoor = false;
    this.sun = new DirectionalLight(0xffffff, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.near = 1; s.far = 260; s.left = -120; s.right = 120; s.top = 120; s.bottom = -120;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new HemisphereLight(0xbcd2ec, 0x56503f, 0.6);
    scene.add(this.hemi);
    this.amb = new AmbientLight(0xffffff, 0.4);
    scene.add(this.amb);

    this.fog = new FogExp2(0xbfd4e8, 0.004);
    scene.fog = this.fog;
    this.hdriCache = {};     // time key -> Promise<{ tex, spec } | null> (the promise, so one load per key)
    this.savedEnv = null;
    this.skyDone = {};       // time key -> resolved value, for synchronous picks (indoor IBL)
    this.procSky = {};       // time key -> procedural gradient texture (built once)
    this.time = 'day';
  }

  // Interiors flip this on enter/exit. While indoors the time button only records the
  // choice (and the window glow); fog, sky, lights and IBL stay the room's until exit.
  setIndoor(v) {
    const was = this.indoor;
    this.indoor = !!v;
    if (this.indoor) {
      if (this.renderer) this.renderer.toneMappingExposure = INDOOR_EXPOSURE;
      this.scene.backgroundIntensity = 1;
      if (!was) this.savedEnv = [this.scene.environment, this.scene.environmentIntensity];
      // the sun is never re-added, only re-aimed: one fixed warm key so every visit looks alike
      const u = INDOOR_SUN, el = MathUtils.degToRad(u.elev), az = MathUtils.degToRad(u.azim);
      this.sun.position.set(150 * Math.cos(el) * Math.cos(az), 150 * Math.sin(el), 150 * Math.cos(el) * Math.sin(az));
      this.sun.color.set(u.color); this.sun.intensity = u.intensity;
      this.applyIndoorEnv();
    } else if (was && this.savedEnv) {
      // put the outdoor pair straight back; exit() then calls setTime() for the current time
      [this.scene.environment, this.scene.environmentIntensity] = this.savedEnv;
      this.savedEnv = null;
    }
  }

  // One fixed indoor IBL: the day sky if loaded (it is, from boot), else any loaded sky,
  // else the procedural day gradient; if the day file is still loading, swap it in on arrival.
  applyIndoorEnv() {
    const pick = this.skyDone.day || this.skyDone.dusk || this.skyDone.night;
    this.scene.environment = pick ? pick.tex : this.proceduralFor('day');
    this.scene.environmentIntensity = INDOOR_ENV;
    if (!this.skyDone.day) this.loadSky('day').then(s => { if (this.indoor && s) this.scene.environment = s.tex; });
  }

  proceduralFor(key) {
    if (!this.procSky[key]) { const c = SKY_COLORS[key] || SKY_COLORS.day; this.procSky[key] = proceduralSky(c[0], c[1], c[2]); }
    return this.procSky[key];
  }

  // Film skies first (Poly Haven CC0 pure skies); the older 1K files stay as a fallback.
  // The promise is cached, so quick time cycling never starts a second load of the same sky.
  loadSky(key) {
    if (!this.hdriCache[key]) {
      this.hdriCache[key] = (async () => {
        for (const spec of HDRI_SKIES[key] || HDRI_SKIES.day) {
          let tex = null;
          try { tex = await loadHDRI(spec.file); } catch { tex = null; }
          if (tex) { tex.mapping = EquirectangularReflectionMapping; return { tex, spec }; }
        }
        return null;
      })().then(v => { this.skyDone[key] = v; return v; });
    }
    return this.hdriCache[key];
  }

  async setTime(key) {
    const p = TIMES[key] || TIMES.day;
    this.time = key;
    if (this.windowMat) this.windowMat.emissiveIntensity = p.win ?? 1.6;
    if (this.indoor) return;
    if (this.renderer) this.renderer.toneMappingExposure = p.exposure ?? 1.0;
    // Sun placement from elevation/azimuth.
    const el = MathUtils.degToRad(p.elev), az = MathUtils.degToRad(p.azim);
    const d = 150;
    this.sun.position.set(
      d * Math.cos(el) * Math.cos(az),
      d * Math.sin(el),
      d * Math.cos(el) * Math.sin(az),
    );
    this.sun.target.position.set(0, 0, 0);
    this.sun.color.set(p.sun);
    this.sun.intensity = p.sunI;
    this.amb.intensity = p.amb;
    this.hemi.intensity = p.amb + 0.2;
    this.fog.color.set(p.fog);
    this.fog.density = p.fogDensity;

    // A real HDRI drives IBL and doubles as the sky dome; otherwise the procedural gradient
    // lights the world and the fog colour is the sky.
    const sky = await this.loadSky(key);
    // The player may have gone indoors or picked another time while the file loaded.
    if (this.indoor || this.time !== key) return;
    const spec = sky ? sky.spec : (PROCEDURAL_SKY[key] || PROCEDURAL_SKY.day);
    this.scene.environment = sky ? sky.tex : this.proceduralFor(key);
    this.scene.environmentIntensity = spec.env ?? p.env;
    this.scene.background = sky ? sky.tex : new Color(p.fog);
    this.scene.backgroundIntensity = sky ? (spec.bg ?? p.bg ?? 1) : 1;
    this.onTime?.(key, p, this.scene.environment);   // cheap per-time uniforms elsewhere (the lake)
  }

  cycle() {
    const order = ['day', 'dusk', 'night'];
    const next = order[(order.indexOf(this.time) + 1) % order.length];
    return this.setTime(next).then(() => next);
  }
}
