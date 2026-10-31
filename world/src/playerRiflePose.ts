/** Anatomical guard for a fixed-palm rifle elbow-circle adjustment.
 * forearm direction = (axisContribution - radius * poleProjection) / length.
 * Preserve a previously more-bent authored wrist; otherwise stay inside 12.5°,
 * leaving margin under the existing native <13° neutral-wrist regression.
 */
export function limitRifleElbowPole(requested: number, axisContribution: number,
  poleProjection: number, turnProjection: number, radius: number, length: number) {
  if (!Number.isFinite(requested) || !Number.isFinite(axisContribution) || !Number.isFinite(poleProjection)
    || !Number.isFinite(turnProjection) || !Number.isFinite(radius) || !Number.isFinite(length)
    || length <= 0 || radius < 0) return 0;
  const extent = Math.min(1, Math.abs(requested)), direction = Math.sign(requested);
  if (extent < 1e-12 || radius < 1e-10) return 0;
  const baselineCos = Math.max(-1, Math.min(1, (axisContribution - radius * poleProjection) / length));
  const limitCos = Math.min(baselineCos, Math.cos(12.5 * Math.PI / 180));
  const threshold = (axisContribution - length * limitCos) / radius;
  const a = poleProjection, b = turnProjection * direction, amplitude = Math.hypot(a, b);
  if (amplitude < 1e-12 || threshold >= amplitude) return direction * extent;
  if (threshold <= -amplitude || a > threshold + 1e-9) return 0;
  // Starting on the limit while moving farther into flexion cannot be allowed,
  // even if the far endpoint would become valid again after a forbidden arc.
  if (Math.abs(a - threshold) < 1e-10 && b > 0) return 0;
  const phase = Math.atan2(b, a), halfWidth = Math.acos(Math.max(-1, Math.min(1, threshold / amplitude)));
  const tau = Math.PI * 2, firstEntry = ((phase - halfWidth) % tau + tau) % tau;
  return direction * Math.min(extent, Math.max(0, firstEntry - 1e-7));
}
