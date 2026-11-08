/**
 * Halo Resonance: what the Halo Crystals are for. Every chest, elite bounty and challenge reward
 * adds to the crystals a traveller has gathered; at any Halo statue, reaching the next threshold
 * deepens the resonance one level, and each level raises maximum health. Thresholds count the
 * crystals gathered in total (nothing is spent), so exploring every era is the way to grow sturdier.
 * Six levels over the ~670 crystals the world holds; the last needs most of four eras explored.
 */
export const RESONANCE = Object.freeze({
  thresholds: Object.freeze([40, 100, 180, 280, 400, 540]) as readonly number[],
  hpPerLevel: 10,
  baseHp: 100,
});
export const flagResonance = (level: number) => `xp_resonance_${level}`;
/** Levels already awakened at a statue (contiguous from 1). */
export function resonanceLevel(done: ReadonlySet<string>) {
  let level = 0;
  while (level < RESONANCE.thresholds.length && done.has(flagResonance(level + 1))) level++;
  return level;
}
export function resonanceMaxHp(level: number) {
  const l = Math.max(0, Math.min(RESONANCE.thresholds.length, Math.floor(Number.isFinite(level) ? level : 0)));
  return RESONANCE.baseHp + l * RESONANCE.hpPerLevel;
}
/** Crystals needed for the next level, or null when maxed. */
export function nextResonanceCost(level: number): number | null {
  return level < RESONANCE.thresholds.length ? RESONANCE.thresholds[level] : null;
}
/** Can the next level be awakened with this many crystals gathered? */
export function resonanceReady(level: number, crystals: number) {
  const cost = nextResonanceCost(level);
  return cost !== null && crystals >= cost;
}
