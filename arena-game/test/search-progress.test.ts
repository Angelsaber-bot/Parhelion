import { describe, expect, it } from 'vitest';
import { scoreSearchProgress } from '../scripts/search-progress.ts';
import { HUMAN_FEATURES } from '../shared/humanCombat.ts';
import type { MapData } from '../shared/map.ts';
import { bundledOpponent } from '../shared/learnedOpponent.ts';
import { assess, fixtures, passesSpawnSearch } from '../scripts/evaluation/evaluate-spawn-search.ts';
const bounds: MapData['bounds'] = { min: [-20, 0, -20], max: [20, 6, 20] };
function measuredTrial(path: (i: number) => [number, number, number], length = 16, resetAt = -1, forward = 0) {
  const rows = Array.from({ length }, (_, i) => {
    const [x, yaw, seen] = path(i);
    const obs = Array(HUMAN_FEATURES.length + 12).fill(0); obs[0] = seen;
    obs[HUMAN_FEATURES.length] = x / 20; obs[HUMAN_FEATURES.length + 3] = Math.sin(yaw); obs[HUMAN_FEATURES.length + 4] = Math.cos(yaw);
    return { obs, axes: [0, 0, 0, forward], reset: i === 0 || i === resetAt, reward: 0 };
  });
  const outcome = scoreSearchProgress(rows, bounds, 12, 60);
  return { ...outcome, reward: rows.reduce((sum, s) => sum + s.reward, 0) };
}
function trial(...args: Parameters<typeof measuredTrial>) {
  return measuredTrial(...args).reward;
}
describe('self-play search outcomes', () => {
  it('measures world displacement while a rival waits at its spawn', () => {
    const still = structuredClone(bundledOpponent);
    for (const row of still.out.weight) row.fill(0);
    still.out.bias.fill(-10, 4, 11);
    still.out.bias.fill(0, 0, 4);
    const moving = structuredClone(still);
    moving.out.bias[3] = 2;
    const trials = fixtures(['camlann', 'frostcourt'], 91624, 2).filter(t => t.waiting);
    for (let i = 0; i < trials.length; i += 2)
      expect(trials[i + 1]).toEqual({ ...trials[i], side: 'B' });
    const before = assess(still, still, trials, 4);
    const after = assess(moving, still, trials, 4);
    expect(before.waitingTrials).toBeGreaterThan(0);
    expect(before.forwardMetersPerSecond).toBeCloseTo(0);
    expect(after.forwardMetersPerSecond).toBeGreaterThan(.2);
    expect(after.reach).toBeGreaterThan(before.reach);
    const reference = { ...after, waitingAcquired: .5, forwardMetersPerSecond: 2 };
    expect(passesSpawnSearch(reference, reference)).toBe(true);
    expect(passesSpawnSearch({ ...reference, forwardMetersPerSecond: .8 }, reference)).toBe(false);
    expect(passesSpawnSearch({ ...reference, waitingAcquired: 0 }, { ...reference, waitingAcquired: 0 })).toBe(false);
  });
  it('penalizes repeated unproductive turning and preserves deliberate aim and stillness', () => {
    expect(trial(i => [0, i * .23, 0])).toBeLessThan(0);
    expect(trial(i => [0, i * .23, 1])).toBe(0);
    expect(trial(() => [0, 0, 0])).toBe(0);
    expect(trial(i => [0, i * .23, 0], 16, 8)).toBe(0);
  });
  it('penalizes blocked forward movement on the first unseen window', () => {
    expect(trial(() => [0, 0, 0], 15, -1, 1)).toBeLessThan(0);
    expect(trial(() => [0, 0, 1], 15, -1, 1)).toBe(0);
    expect(trial(i => [i * .7, 0, 0], 15, -1, 1)).toBeGreaterThan(0);
  });
  it('rewards facing newly covered ground and excludes motion through respawns', () => {
    const forward = trial(i => [i * .7, -Math.PI / 2, 0], 15);
    const backward = trial(i => [i * .7, Math.PI / 2, 0], 15);
    expect(forward).toBeGreaterThan(backward);
    expect(backward).toBeGreaterThan(0);
    expect(trial(i => [i >= 7 ? 10 : 0, -Math.PI / 2, 0], 15, 7)).toBe(0);
  });
  it('credits discovery across a completed movement window within one life', () => {
    const approach = (i: number): [number, number, number] => [i * .7, 0, Number(i === 15)];
    expect(trial(approach)).toBeCloseTo(trial(approach, 15) + .02);
    expect(trial(approach, 16, 15)).toBeCloseTo(trial(approach, 15));
    expect(trial(i => [i * .7, -Math.PI / 2, Number(i === 180)], 181)).toBeCloseTo(.14);
  });
  it('measures a single recovery opportunity and censors unfinished searches', () => {
    const path = (i: number): [number, number, number] => [0, Math.min(i, 14) * .25, 0];
    expect(measuredTrial(path, 75).stayedBlocked).toBe(1);
    expect(measuredTrial(path, 22).stayedBlocked).toBe(0);
    expect(measuredTrial(path, 30, 20).stayedBlocked).toBe(0);
    expect(measuredTrial(i => [0, path(i)[1], Number(i >= 20)], 35).stayedBlocked).toBe(0);
    const escaped = measuredTrial(i => [Math.max(0, i - 14) * .5, path(i)[1], 0], 35);
    expect(escaped.recovered).toBe(1);
    expect(escaped.stayedBlocked).toBe(0);
  });
  it('reduces credit for repeatedly following the same unsuccessful path', () => {
    const lap = (i: number): [number, number, number] => [(i % 15) * .72, 0, 0];
    expect(trial(lap, 60)).toBeLessThan(trial(lap, 30));
    expect(trial(i => [(i % 16) * .72, 0, Number(i % 16 === 15)], 64)).toBeGreaterThan(0);
  });
  it('scores a scan even if it returns to its initial heading and rewards leaving afterwards', () => {
    const scan = (i: number) => Math.min(i, 14 - i) * .4;
    expect(trial(i => [0, scan(i), 0], 15)).toBeLessThan(0);
    expect(trial(i => [Math.max(0, i - 15) * .8, i < 15 ? scan(i) : 0, 0], 30))
      .toBeGreaterThan(trial(i => [0, i < 15 ? scan(i) : 0, 0], 30));
    expect(trial(() => [0, 0, 0], 30, 15)).toBe(0);
    expect(trial(() => [0, 0, 0], 30)).toBeLessThan(0);
  });
  it('credits unfamiliar ground and actual sightings after movement without repeating credit forever', () => {
    expect(trial(i => [i * .7, 0, 0])).toBeGreaterThan(0);
    expect(trial(i => [i * .7, 0, i >= 8 ? 1 : 0], 12)).toBeCloseTo(.02);
    expect(trial(i => [i % 2 ? 1 : -1, 0, 0], 60)).toBe(0);
    expect(trial(i => [i * .7, 0, 0], 400)).toBeCloseTo(.12);
  });
});
