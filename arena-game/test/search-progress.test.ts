import { describe, expect, it } from 'vitest';
import { scoreSearchProgress } from '../scripts/search-progress.ts';
import { HUMAN_FEATURES } from '../shared/humanCombat.ts';
import type { MapData } from '../shared/map.ts';
const bounds: MapData['bounds'] = { min: [-20, 0, -20], max: [20, 6, 20] };
function trial(path: (i: number) => [number, number, number], length = 16, resetAt = -1) {
  const rows = Array.from({ length }, (_, i) => {
    const [x, yaw, seen] = path(i);
    const obs = Array(HUMAN_FEATURES.length + 12).fill(0); obs[0] = seen;
    obs[HUMAN_FEATURES.length] = x / 20; obs[HUMAN_FEATURES.length + 3] = Math.sin(yaw); obs[HUMAN_FEATURES.length + 4] = Math.cos(yaw);
    return { obs, reset: i === 0 || i === resetAt, reward: 0 };
  });
  scoreSearchProgress(rows, bounds, 12, 60);
  return rows.reduce((sum, s) => sum + s.reward, 0);
}
describe('self-play search outcomes', () => {
  it('penalizes repeated unproductive turning and preserves deliberate aim and stillness', () => {
    expect(trial(i => [0, i * .23, 0])).toBeLessThan(0);
    expect(trial(i => [0, i * .23, 1])).toBe(0);
    expect(trial(() => [0, 0, 0])).toBe(0);
    expect(trial(i => [0, i * .23, 0], 16, 8)).toBe(0);
  });
  it('reduces credit for repeatedly following the same unsuccessful path', () => {
    const lap = (i: number): [number, number, number] => [(i % 15) * .72, 0, 0];
    expect(trial(lap, 60)).toBeLessThan(trial(lap, 30));
    expect(trial(i => [(i % 16) * .72, 0, Number(i % 16 === 15)], 64)).toBeGreaterThan(0);
  });
  it('credits unfamiliar ground and actual sightings after movement without repeating credit forever', () => {
    expect(trial(i => [i * .7, 0, 0])).toBeGreaterThan(0);
    expect(trial(i => [i * .7, 0, i >= 8 ? 1 : 0], 12)).toBeCloseTo(.02);
    expect(trial(i => [i % 2 ? 1 : -1, 0, 0], 60)).toBe(0);
    expect(trial(i => [i * .7, 0, 0], 400)).toBeCloseTo(.12);
  });
});
