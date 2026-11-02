// Renderer: WebGPURenderer with automatic WebGL2 fallback.
// Add ?webgl=1 to the URL to force the WebGL2 backend (used by the test harness).
import { WebGPURenderer, ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import { BUDGET } from './config.js';

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
  renderer.toneMapping = ACESFilmicToneMapping;
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
