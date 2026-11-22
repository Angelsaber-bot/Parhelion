export interface EvaluationReport {
  rearSeconds: number;
  referenceRearSeconds: number;
  perceptionMatchedReference?: true;
  humanCamera?: { captures: number; windows: number; turn: [number, number]; quiet: [number, number] };
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
  const { rearSeconds, referenceRearSeconds, perceptionMatchedReference, humanCamera,
    smokeBlindFire, wallEscape, roundSet, opponent, duel, team } = raw as Record<string, unknown>;
  const bounded = (n: unknown, max: number): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const tally = (v: unknown): v is EvaluationReport['duel'] => Array.isArray(v) && v.length === 3 &&
    v.every(n => bounded(n, 10000) && Number.isInteger(n)) && v.some(n => n > 0);
  if (!bounded(rearSeconds, 60) || !bounded(referenceRearSeconds, 60) || !bounded(smokeBlindFire, 1) ||
      !bounded(wallEscape, 1) || (roundSet !== 'diagnostic' && roundSet !== 'tournament') ||
      (opponent !== 'baseline' && opponent !== 'incumbent' && opponent !== 'public-scripted' && opponent !== 'public-exploration') ||
      !tally(duel) || !tally(team)) return;
  if (perceptionMatchedReference !== undefined && perceptionMatchedReference !== true) return;
  const report: EvaluationReport = { rearSeconds, referenceRearSeconds, smokeBlindFire, wallEscape, roundSet, opponent, duel, team };
  if (perceptionMatchedReference) report.perceptionMatchedReference = true;
  if (humanCamera !== undefined) {
    if (!humanCamera || typeof humanCamera !== 'object') return;
    const { captures, windows, turn, quiet } = humanCamera as Record<string, unknown>;
    const errors = (points: unknown): points is [number, number] => Array.isArray(points) &&
      points.length === 2 && points.every(n => bounded(n, 2 * Math.PI));
    if (!bounded(windows, Number.MAX_SAFE_INTEGER) || !Number.isInteger(windows) ||
        !bounded(captures, windows) || !Number.isInteger(captures) || captures < 1 || !errors(turn) || !errors(quiet)) return;
    report.humanCamera = { captures, windows, turn, quiet };
  }
  return report;
}
