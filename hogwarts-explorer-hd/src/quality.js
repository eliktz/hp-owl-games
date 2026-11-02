// Quality tiers + automatic FPS downgrade.
// HIGH: full DPR + post-processing + shadows. MEDIUM: bloom only, lower DPR/shadows.
// LOW: no post, no shadows, DPR 1. We only ever downgrade (never thrash upward).
import { BUDGET, TIER } from './config.js';

export class QualityManager {
  constructor(renderer, { onTier } = {}) {
    this.renderer = renderer;
    this.onTier = onTier || (() => {});
    this.tier = TIER.HIGH;
    this.samples = [];
    this.lastT = 0;
    this.settled = false;
    this.warmupMs = 3200;     // ignore the first frames (shader compile spikes)
    this.elapsed = 0;
  }

  applyTier(tier) {
    this.tier = tier;
    const r = this.renderer;
    if (tier === TIER.HIGH) {
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, BUDGET.dprHigh));
      r.shadowMap.enabled = true;
    } else if (tier === TIER.MEDIUM) {
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, BUDGET.dprMedium));
      r.shadowMap.enabled = true;
    } else {
      r.setPixelRatio(BUDGET.dprLow);
      r.shadowMap.enabled = false;
    }
    this.onTier(tier);
  }

  // Called every frame with dtMs. Averages FPS over a window and steps down if poor.
  sample(dtMs) {
    this.elapsed += dtMs;
    if (this.elapsed < this.warmupMs || this.settled) return;
    this.samples.push(1000 / Math.max(dtMs, 1));
    if (this.samples.length < 90) return;        // ~1.5s window at 60fps
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples.length = 0;
    if (avg < 26 && this.tier === TIER.HIGH) {
      this.applyTier(TIER.MEDIUM);
    } else if (avg < 24 && this.tier === TIER.MEDIUM) {
      this.applyTier(TIER.LOW);
      this.settled = true;                        // bottom tier, stop adapting
    } else if (avg >= 50) {
      this.settled = true;                        // comfortably fast, lock in
    }
  }
}
