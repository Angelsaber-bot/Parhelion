/**
 * Runs a post-processing pass's internal buffers at a fraction of the composer's
 * resolution. EffectComposer calls `pass.setSize(width × dpr, height × dpr)` on every
 * resize and DPR change; this keeps that contract and only shrinks what the pass
 * allocates. Use it for blurry, low-frequency effects (bloom, ambient occlusion)
 * whose output is sampled back up with linear filtering.
 *
 * No `three` import: shared-client is consumed by both games, which each own their
 * own copy of three.
 */
export interface ResizablePass { setSize(width: number, height: number): void }

export function scalePassResolution<T extends ResizablePass>(pass: T, scale: number): T {
  const factor = Number.isFinite(scale) && scale > 0 ? Math.min(1, scale) : 1;
  if (factor === 1) return pass;
  const setSize = pass.setSize.bind(pass);
  pass.setSize = (width: number, height: number) =>
    setSize(Math.max(1, Math.round(width * factor)), Math.max(1, Math.round(height * factor)));
  return pass;
}
