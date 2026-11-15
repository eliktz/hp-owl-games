// Renderer: WebGPURenderer with automatic WebGL2 fallback.
// Add ?webgl=1 to the URL to force the WebGL2 backend (used by the test harness).
import { WebGPURenderer, ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import { BUDGET } from './config.js';

// ?tmx=<k> scales every exposure environment.js sets (to compare tone curves at equal brightness).
export const EXPOSURE_SCALE = (() => { try { const k = parseFloat(new URLSearchParams(location.search).get('tmx')); return k > 0 && k < 4 ? k : 1; } catch { return 1; } })();

export async function createRenderer(canvas) {
  const params = new URLSearchParams(location.search);
  const forceWebGL = params.get('webgl') === '1' || params.get('webgpu') === '0';

  const renderer = new WebGPURenderer({
    canvas,
    antialias: false,            // FXAA/TRAA handled in post instead (cheaper on mobile)
    forceWebGL,
    powerPreference: 'high-performance',
    alpha: false,
  });

  // init() resolves once a backend (WebGPU or WebGL2) is actually ready.
  await renderer.init();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, BUDGET.dprHigh));
  renderer.setSize(window.innerWidth, window.innerHeight);
  // ?tm=agx | aces | neutral tries another filmic curve (look-dev, integration step 9). It is
  // set here once; post.js's RenderPipeline and the direct renderer.render path both apply
  // renderer.toneMapping, so bloom and the no-post fallback stay consistent. Default: ACES.
  const TM = { aces: ACESFilmicToneMapping, agx: AgXToneMapping, neutral: NeutralToneMapping };
  renderer.toneMapping = TM[params.get('tm')] ?? ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  return renderer;
}

// Report which backend actually initialised, for the FPS badge / test hooks.
export function backendName(renderer) {
  try {
    if (renderer.backend && renderer.backend.isWebGPUBackend) return 'webgpu';
    if (renderer.backend && renderer.backend.isWebGLBackend) return 'webgl2';
  } catch (e) { /* ignore */ }
  return renderer.backend ? (renderer.backend.constructor.name || 'unknown') : 'unknown';
}
