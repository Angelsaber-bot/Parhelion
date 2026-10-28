/** Resolution policy is separate from effect quality: no hidden degradation of the default image. */
export type ResolutionMode = 'crisp' | 'balanced' | 'adaptive';
export function resolutionMode(value: unknown): ResolutionMode {
  return value === 'crisp' || value === 'adaptive' ? value : 'balanced';
}
export function targetDpr(deviceDpr: number, mode: ResolutionMode, lowQuality = false): number {
  const native = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  return Math.min(native, lowQuality ? 1 : mode === 'balanced' ? 1.25 : 2);
}
/** Opt-in adaptive mode: 2 second observations, slow recovery, never below 1 CSS pixel.
 * Ignore background/resume gaps rather than treating them as GPU load. */
export class AdaptiveResolution {
  private elapsed = 0;
  private frames = 0;
  private healthyWindows = 0;
  reset() { this.elapsed = this.frames = this.healthyWindows = 0; }
  sample(seconds: number, current: number, maximum: number, active: boolean): number {
    if (!active || seconds <= 0 || seconds > .25 || !Number.isFinite(seconds)) { this.reset(); return current; }
    this.elapsed += seconds; this.frames++;
    if (this.elapsed < 2) return current;
    const fps = this.frames / this.elapsed;
    this.elapsed = this.frames = 0;
    if (fps < 48) {
      this.healthyWindows = 0;
      return Math.max(Math.min(1, maximum), Math.round((current - .1) * 100) / 100);
    }
    if (fps > 58) {
      if (++this.healthyWindows >= 3) { this.healthyWindows = 0; return Math.min(maximum, Math.round((current + .05) * 100) / 100); }
    } else this.healthyWindows = 0;
    return current;
  }
}
