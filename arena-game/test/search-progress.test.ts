import { describe, expect, it } from 'vitest';
import { scoreSearchProgress } from '../scripts/search-progress.ts';
import { HUMAN_FEATURES } from '../shared/humanCombat.ts';
import type { MapData } from '../shared/map.ts';
import { bundledOpponent } from '../shared/learnedOpponent.ts';
import { assess, fixtures, passesSpawnSearch } from '../scripts/evaluation/evaluate-spawn-search.ts';
const bounds: MapData['bounds'] = { min: [-20, 0, -20], max: [20, 6, 20] };
function measuredTrial(path: (i: number) => [number, number, number], length = 16, resetAt = -1, forward: number | ((i: number) => number) = 0) {
  const rows = Array.from({ length }, (_, i) => {
    const [x, yaw, seen] = path(i);
    const obs = Array(HUMAN_FEATURES.length + 12).fill(0); obs[0] = seen;
    obs[HUMAN_FEATURES.length] = x / 20; obs[HUMAN_FEATURES.length + 3] = Math.sin(yaw); obs[HUMAN_FEATURES.length + 4] = Math.cos(yaw);
    return { obs, axes: [0, 0, 0, typeof forward === 'number' ? forward : forward(i)], reset: i === 0 || i === resetAt, reward: 0 };
  });
  const outcome = scoreSearchProgress(rows, bounds, 12, 60);
  return { ...outcome, rewards: rows.map(s => s.reward), reward: rows.reduce((sum, s) => sum + s.reward, 0) };
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
    expect(before.backwardMetersPerSecond + before.lateralMetersPerSecond).toBeCloseTo(0);
    const reversing = structuredClone(still), strafing = structuredClone(still);
    reversing.out.bias[3] = -2;
    strafing.out.bias[2] = 2;
    const reverse = assess(reversing, still, trials, 4), strafe = assess(strafing, still, trials, 4);
    expect(reverse.backwardMetersPerSecond).toBeGreaterThan(.2);
    expect(reverse.forwardMetersPerSecond).toBeLessThan(-.2);
    expect(strafe.lateralMetersPerSecond).toBeGreaterThan(.2);
    const reference = { ...after, waitingAcquired: .5, forwardMetersPerSecond: 2 };
    expect(passesSpawnSearch(reference, reference)).toBe(true);
    const twelveTrials = { ...reference, waitingTrials: 12, waitingAcquired: 3 / 12 };
    expect(passesSpawnSearch({ ...twelveTrials, waitingAcquired: 2 / 12 }, twelveTrials)).toBe(true);
    expect(passesSpawnSearch({ ...twelveTrials, waitingAcquired: 1 / 12 }, twelveTrials)).toBe(false);
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
  it('keeps wall pressure debit off a lateral or forward step that gained ground', () => {
    const x = (i: number) => Math.max(0, i - 12) * .3;
    const trace = measuredTrial(i => [x(i), 0, 0], 15, -1, i => Number(i !== 13));
    expect(trace.reward).toBeCloseTo(-.015);
    for (const r of trace.rewards.slice(0, 12)) expect(r).toBeCloseTo(-.015 / 12);
    expect(trace.rewards.slice(12)).toEqual([0, 0, 0]);
    const timeout = measuredTrial(i => [i === 29 ? .4 : 0, 0, 0], 30, -1, i => Number(i !== 28));
    expect(timeout.stayedBlocked).toBe(1);
    expect(timeout.rewards[28]).toBe(0);
    expect(timeout.reward).toBeCloseTo(-.045);
  });
  it('rewards facing newly covered ground and excludes motion through respawns', () => {
    const forward = trial(i => [i * .7, -Math.PI / 2, 0], 15);
    const backward = trial(i => [i * .7, Math.PI / 2, 0], 15);
    expect(forward).toBeGreaterThan(backward);
    expect(backward).toBeGreaterThan(0);
    expect(trial(i => [i >= 7 ? 10 : 0, -Math.PI / 2, 0], 15, 7)).toBe(0);
  });
  it('withholds novelty for a sustained retreat on an empty clear lane and preserves escape and sighting credit', () => {
    function route(yaw: number, depth = 1, recent = 0, rim = 1, seesRival = false) {
      const rows = Array.from({ length: seesRival ? 16 : 15 }, (_, i) => {
        const obs = Array(HUMAN_FEATURES.length + 12).fill(0);
        obs[0] = Number(i === 15);
        obs.splice(HUMAN_FEATURES.length, 10, i * .6 / 20, 0, 0, Math.sin(yaw), Math.cos(yaw), 0, rim, depth, 1, recent);
        return { obs, axes: [0, 0, 0, -1], reset: i === 0, reward: 0 };
      });
      scoreSearchProgress(rows, bounds, 12, 60);
      return rows.reduce((sum, row) => sum + row.reward, 0);
    }
    const backing = Math.PI / 2;
    expect(route(backing)).toBe(0);
    expect(route(backing, .1)).toBeCloseTo(.01);
    expect(route(backing, 1, .2)).toBeCloseTo(.01);
    expect(route(backing, 1, 0, -.25)).toBeCloseTo(.01);
    expect(route(0)).toBeCloseTo(.01);
    expect(route(-backing)).toBeCloseTo(.02);
    expect(route(backing, 1, 0, 1, true)).toBeCloseTo(.02);
  });
  it('debits measured backward inputs only after an unsuccessful clear-lane retreat', () => {
    function route(change?: (rows: ReturnType<typeof decision>[]) => void) {
      const rows = Array.from({ length: 30 }, (_, i) => decision(i));
      change?.(rows);
      scoreSearchProgress(rows, bounds, 12, 60);
      return rows.slice(0, 14).map(s => s.reward);
    }
    function decision(i: number) {
      const obs = Array(HUMAN_FEATURES.length + 12).fill(0);
      obs[5] = 1;
      obs.splice(HUMAN_FEATURES.length, 10, Math.min(i, 14) * .5 / 20, 0, 0, 1, 0, 0, 1, 1, 1, 0);
      return { obs, axes: [0, 0, 0, i === 8 ? 1 : -1], reset: i === 0, reward: 0 };
    }
    const rewards = route();
    expect(rewards.reduce((a, b) => a + b)).toBeCloseTo(-.01);
    expect(rewards[8]).toBe(0);
    for (const preserved of [
      route(rows => { rows[29].obs[0] = .5; }), route(rows => { rows[16].reset = true; }),
      route(rows => { rows[5].obs[5] = .8; }), route(rows => { rows.length = 29; }),
      route(rows => { rows[1].obs[HUMAN_FEATURES.length + 8] = .06; }),
    ]) expect(preserved.every(value => value === 0)).toBe(true);
  });
  it('keeps the scan penalty on idle decisions when the last step starts an escape', () => {
    const scan = (i: number) => Math.min(i, 12) * .23;
    const trace = measuredTrial(i => [i === 14 ? .8 : 0, scan(i), 0], 15);
    expect(trace.reward).toBeCloseTo(-.015);
    expect(trace.rewards[13]).toBe(0);
    for (const reward of trace.rewards.slice(0, 13)) expect(reward).toBeCloseTo(-.015 / 13);
  });
  it('shares route and forward credit across the actions that produced each gain', () => {
    // The route ends with a backward step and a blocked forward input.
    const x = [0, 4, 12, 10, 10];
    const run = (yaw: number) => measuredTrial(i => [x[Math.min(i, 4)], yaw, 0], 15, -1, 1);
    const forward = run(-Math.PI / 2), backing = run(Math.PI / 2);
    expect(forward.reward).toBeCloseTo(.02);
    expect(backing.reward).toBeCloseTo(.01);
    for (const result of [forward, backing]) {
      expect(result.rewards[0]).toBeCloseTo(result.reward / 3);
      expect(result.rewards[1]).toBeCloseTo(2 * result.reward / 3);
      expect(result.rewards.slice(2).every(reward => reward === 0)).toBe(true);
    }
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
  it('attributes novel-ground escape reward to measured movement and skips blocked inputs', () => {
    const result = measuredTrial(i => [3.5 + Math.max(0, i - 16) * .5, 0, 0], 21, -1, 1);
    expect(result.recovered).toBe(1);
    expect(result.rewards.slice(14, 16)).toEqual([0, 0]);
    for (const r of result.rewards.slice(16, 20)) expect(r).toBeCloseTo(.005);
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
