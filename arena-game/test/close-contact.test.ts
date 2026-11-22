import { expect, it } from 'vitest';
import { closeContact } from '../scripts/evaluation/evaluate-close-contact.ts';
import { bundledOpponent } from '../shared/learnedOpponent.ts';

it('counts actual damage and keeps identical fixtures for both actors and target motions', () => {
  const idle = structuredClone(bundledOpponent);
  for (const w of idle.out.weight) w.fill(0);
  idle.out.bias.fill(0);
  idle.out.bias.fill(-20, 4, 11);
  const seed = 1045372;
  const baseline = closeContact(bundledOpponent, bundledOpponent, seed, 2);
  const changed = closeContact(idle, bundledOpponent, seed, 2);
  expect(baseline).toHaveLength(6);
  for (const [i, row] of changed.entries()) {
    expect(row.trials).toBe(4);
    expect(row.incumbent).toEqual(baseline[i].candidate);
    expect(row.candidate).toEqual({ byHalfSecond: 0, byTwoSeconds: 0 });
    expect(row.incumbent.byHalfSecond).toBeLessThanOrEqual(row.incumbent.byTwoSeconds);
  }
  expect(changed.some(r => r.incumbent.byTwoSeconds > 0)).toBe(true);
});
