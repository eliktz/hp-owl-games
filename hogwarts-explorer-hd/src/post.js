// Post-processing (HIGH and MEDIUM tiers): scene pass -> NaN guard -> bloom -> tone map.
// three r187 node path: RenderPipeline + pass() + the BloomNode addon (vendored from
// three@0.187.0, examples/jsm/tsl/display/BloomNode.js). The scene pass renders linear HDR
// into a half-float target; RenderPipeline then applies renderer.toneMapping,
// toneMappingExposure (live) and outputColorSpace once, exactly like renderer.render does.
// Bloom thresholds the linear, pre-exposure radiance, so with non-emissive albedo <= 0.84
// only emissive light sources (windows, candles, flames, lamps, quest stars) pass it.
// The sky is excluded by a depth mask (see below).
// Any failure here must never blank the game: createPost() returns null on error and
// main.js falls back to renderer.render().
import { RenderPipeline } from 'three';
import { pass, vec3, vec4, float, dot, min, max, select, Fn } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { BLOOM } from './config.js';

// Comparisons with NaN/Inf are false, so a pixel whose channel sum is not a sane finite
// value becomes black instead of being smeared by the blur into big dark squares.
const sanitize = Fn(([c]) => {
  const s = dot(c.rgb, vec3(1.0));
  const ok = s.greaterThanEqual(0.0).and(s.lessThan(float(6.0e4)));
  const rgb = select(ok, c.rgb, vec3(0.0));
  return vec4(max(min(rgb, vec3(BLOOM.clampMax ?? 64.0)), vec3(0.0)), 1.0);
});

export function createPost(renderer, scene, camera) {
  try {
    const scenePass = pass(scene, camera);
    const color = sanitize(scenePass.getTextureNode('output'));
    // The HDRI sky (clouds, the bright horizon) is far above any albedo-capped surface, so
    // it is masked out of the bloom input: the background never writes depth (cleared 1.0).
    const depth = scenePass.getTextureNode('depth');
    const bloomIn = select(depth.r.lessThan(1.0), color, vec4(0.0, 0.0, 0.0, 1.0));
    const glow = bloom(bloomIn, BLOOM.strength, BLOOM.radius, BLOOM.threshold);
    const pipeline = new RenderPipeline(renderer);
    pipeline.outputNode = color.add(glow);
    return {
      pipeline, scenePass, glow,
      enabled: true,
      render() { pipeline.render(); },
      // live-tunable from the console: __game.post.set({ strength: 0.5 })
      set({ strength, radius, threshold } = {}) {
        if (strength != null) glow.strength.value = strength;
        if (radius != null) glow.radius.value = radius;
        if (threshold != null) glow.threshold.value = threshold;
      },
      dispose() { try { pipeline.dispose(); glow.dispose(); scenePass.dispose(); } catch (e) { /* ignore */ } },
    };
  } catch (e) {
    console.warn('[post] bloom pipeline unavailable, rendering direct:', e && e.message || e);
    return null;
  }
}
