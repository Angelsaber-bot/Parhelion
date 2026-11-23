import { expect, it } from 'vitest';
import { closeContact } from '../scripts/evaluation/evaluate-close-contact.ts';
import { bundledOpponent } from '../shared/learnedOpponent.ts';

import { passesCloseMovingDamage } from '../scripts/evaluation/evaluate-self-play.ts';

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
    expect(row.trials).toBe(row.moving ? 8 : 4);
    if (row.moving) {
      expect(row.directions.map(d => d.mx)).toEqual([-1, 1]);
      for (const d of row.directions) {
        expect(d.trials).toBe(4);
        expect(d.incumbentMargins).toHaveLength(2);
      }
      for (const metric of ['byHalfSecond', 'byTwoSeconds'] as const) {
        expect(row.incumbent[metric]).toBe(row.directions.reduce((sum, d) => sum + d.incumbent[metric], 0));
      }
    }
    expect(baseline[i].incumbentMargins).toEqual([0, 0]);
    expect(row.incumbentMargins.reduce((a, b) => a + b, 0)).toBe(row.incumbent.byTwoSeconds - row.candidate.byTwoSeconds);
    expect(row.incumbent).toEqual(baseline[i].candidate);
    expect(row.candidate).toEqual({ byHalfSecond: 0, byTwoSeconds: 0 });
    expect(row.incumbent.byHalfSecond).toBeLessThanOrEqual(row.incumbent.byTwoSeconds);
  }
  expect(changed.some(r => r.incumbent.byTwoSeconds > 0)).toBe(true);
});

it('detects a consistent loss in either direction even when pooled damage is tied', () => {
  const totals = { byHalfSecond: 0, byTwoSeconds: 0 };
  const passes = (starts: number, margin: number) => passesCloseMovingDamage([{
    map: 'homeward', moving: true, incumbentMargins: Array(starts).fill(0),
    directions: [-1, 1].map(mx => ({ mx, trials: 2 * starts, candidate: totals, incumbent: totals,
      incumbentMargins: Array(starts).fill(mx * margin) })),
  }]);
  expect(passes(8, 0)).toBe(true);
  expect(passes(2, 1)).toBe(true);
  expect(passes(8, 1)).toBe(false);
  expect(passes(8, -1)).toBe(false);
});
