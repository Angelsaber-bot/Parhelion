import { expect, it } from 'vitest';
import { parseEvaluationReport } from '../shared/evaluationReport.ts';

it('retains measured game scores and rejects incomplete or impossible evaluation summaries', () => {
  const report = { rearSeconds: 1.78, referenceRearSeconds: 7.21, smokeBlindFire: 0, wallEscape: 1,
    roundSet: 'diagnostic', opponent: 'public-scripted', duel: [0, 1, 1], team: [2, 0, 0] };
  expect(parseEvaluationReport({ ...report, privateTrace: [1, 2, 3] })).toEqual(report);
  for (const raw of [undefined, { ...report, roundSet: 'partial' }, { ...report, wallEscape: 2 },
    { ...report, smokeBlindFire: NaN }, { ...report, team: [0, 0, 0] }, { ...report, duel: [0, -1, 3] }]) {
    expect(parseEvaluationReport(raw)).toBeUndefined();
  }
});
