export interface EvaluationReport {
  rearSeconds: number;
  referenceRearSeconds: number;
  smokeBlindFire: number;
  wallEscape: number;
  roundSet: 'diagnostic' | 'tournament';
  opponent: 'baseline' | 'incumbent' | 'public-scripted' | 'public-exploration';
  duel: [wins: number, draws: number, losses: number];
  team: [wins: number, draws: number, losses: number];
}

/** Only these aggregate results leave the trainer. Older evaluations have no report. */
export function parseEvaluationReport(raw: unknown): EvaluationReport | undefined {
  if (!raw || typeof raw !== 'object') return;
  const { rearSeconds, referenceRearSeconds, smokeBlindFire, wallEscape, roundSet, opponent, duel, team } = raw as Record<string, unknown>;
  const bounded = (n: unknown, max: number): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const tally = (v: unknown): v is EvaluationReport['duel'] => Array.isArray(v) && v.length === 3 &&
    v.every(n => bounded(n, 10000) && Number.isInteger(n)) && v.some(n => n > 0);
  if (!bounded(rearSeconds, 60) || !bounded(referenceRearSeconds, 60) || !bounded(smokeBlindFire, 1) ||
      !bounded(wallEscape, 1) || (roundSet !== 'diagnostic' && roundSet !== 'tournament') ||
      (opponent !== 'baseline' && opponent !== 'incumbent' && opponent !== 'public-scripted' && opponent !== 'public-exploration') ||
      !tally(duel) || !tally(team)) return;
  return { rearSeconds, referenceRearSeconds, smokeBlindFire, wallEscape, roundSet, opponent, duel, team };
}
