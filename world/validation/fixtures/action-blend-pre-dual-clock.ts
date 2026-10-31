// Historical ordinary blend: exact 6be0f8e world/src/characters/actionBlend.ts (git blob 70a41db). Test-only, never runtime.
import type * as THREE from 'three';

/** Normalized action weights, including when a previous crossfade is interrupted. */
export class ActionBlend {
  constructor(private readonly easing: 'linear' | 'smoothstep' = 'linear') {}
  private weights = new Map<THREE.AnimationAction, number>();
  private target?: THREE.AnimationAction;
  private elapsed = 0;
  private duration = 0;
  start(next: THREE.AnimationAction, duration: number, initialize: () => void) {
    // Three's crossFadeTo restarts fadeOut at 1 even if the old action was only 20%
    // visible. Snapshot all live weights instead, so a quick walk/run/stop cannot pop.
    const from = new Map<THREE.AnimationAction, number>();
    for (const action of this.weights.keys()) {
      const weight = action.enabled && action.isScheduled() ? action.getEffectiveWeight() : 0;
      if (weight > 0) from.set(action, weight);
      action.stopFading();
    }
    initialize(); next.stopFading();
    if (!from.size || duration <= 0) {
      for (const action of from.keys()) if (action !== next) action.stop();
      next.setEffectiveWeight(1); this.weights = new Map([[next, 1]]); this.duration = 0;
    } else {
      if (!from.has(next)) from.set(next, 0);
      const total = [...from.values()].reduce((sum, weight) => sum + weight, 0);
      for (const [action, weight] of from) { from.set(action, weight / total); action.setEffectiveWeight(weight / total); }
      this.weights = from; this.duration = duration;
    }
    this.target = next; this.elapsed = 0;
  }
  update(mixer: THREE.AnimationMixer, dt: number) {
    if (this.duration > 0 && this.target) {
      this.elapsed = Math.min(this.duration, this.elapsed + dt);
      const t = this.elapsed / this.duration;
      const blend = this.easing === 'smoothstep' ? t * t * (3 - 2 * t) : t;
      for (const [action, weight] of this.weights) action.setEffectiveWeight(weight + ((action === this.target ? 1 : 0) - weight) * blend);
      if (blend === 1) {
        for (const action of this.weights.keys()) if (action !== this.target) action.stop();
        this.weights = new Map([[this.target, 1]]); this.duration = 0;
      }
    }
    mixer.update(dt);
  }
  clear() { this.weights.clear(); this.target = undefined; this.duration = 0; }
}
