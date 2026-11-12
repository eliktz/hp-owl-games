// Sky / lighting / time-of-day. Lights are pre-created ONCE (never added at runtime,
// per the iPad shader-recompile rule) and only their params change on toggle.
import {
  DirectionalLight, HemisphereLight, AmbientLight, FogExp2, Color,
  CanvasTexture, EquirectangularReflectionMapping, MathUtils, SRGBColorSpace,
} from 'three';
import { TIMES, INDOOR_EXPOSURE } from './config.js';
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
    this.hdriCache = {};
    this.time = 'day';
  }

  // Interiors flip this on enter/exit. While indoors the time button only records the
  // choice (and the window glow); fog, sky, lights and IBL stay the room's until exit.
  setIndoor(v) {
    this.indoor = !!v;
    if (this.indoor && this.renderer) this.renderer.toneMappingExposure = INDOOR_EXPOSURE;
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
    this.scene.background = new Color(p.fog);

    // Try a real HDRI first; otherwise procedural gradient. Both drive IBL.
    const hdriFile = { day: 'kloofendal_day_1k.hdr', dusk: 'dusk_1k.hdr', night: 'night_1k.hdr' }[key];
    let env = this.hdriCache[key];
    if (env === undefined) {
      env = await loadHDRI(hdriFile);
      if (env) env.mapping = EquirectangularReflectionMapping;
      this.hdriCache[key] = env || null;
      // The player may have gone indoors or picked another time while the file loaded.
      if (this.indoor || this.time !== key) return;
    }
    const sky = SKY_COLORS[key] || SKY_COLORS.day;
    const tex = env || proceduralSky(sky[0], sky[1], sky[2]);
    tex.mapping = EquirectangularReflectionMapping;
    this.scene.environment = tex;
    this.scene.environmentIntensity = p.env;
    if (env) this.scene.background = tex;   // real HDRI doubles as the sky dome
  }

  cycle() {
    const order = ['day', 'dusk', 'night'];
    const next = order[(order.indexOf(this.time) + 1) % order.length];
    return this.setTime(next).then(() => next);
  }
}
