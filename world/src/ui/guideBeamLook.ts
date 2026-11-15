/**
 * The quest beacon is a 70 m pillar of light meant to be found from across a valley. Standing next to it,
 * the same pillar was a translucent drum swallowing the desk or door it marked. Its look now follows the
 * distance to the player: full at range, slimmer and fainter on approach, gone within a few steps (the
 * waypoint and the interaction prompt take over there).
 */
export const GUIDE_BEAM = Object.freeze({ hideWithin: 4, fullBeyond: 18, slimWithin: 6, wideBeyond: 40, slim: .3, base: .16, pulse: .06 });
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Opacity and horizontal scale for the beacon `distance` metres away (horizontal), at clock `seconds`. */
export function guideBeamLook(distance: number, seconds: number) {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : Infinity;
  const fade = smooth(GUIDE_BEAM.hideWithin, GUIDE_BEAM.fullBeyond, d);
  return {
    opacity: (GUIDE_BEAM.base + GUIDE_BEAM.pulse * Math.sin(seconds / .3)) * fade,
    width: GUIDE_BEAM.slim + (1 - GUIDE_BEAM.slim) * smooth(GUIDE_BEAM.slimWithin, GUIDE_BEAM.wideBeyond, d),
    visible: fade > .01,
  };
}
