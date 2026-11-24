import { expect, it } from 'vitest';
import { curriculum } from '../scripts/self-play-rollout.ts';
import { rng } from '../scripts/evaluation/evaluate-spawn-search.ts';

it('gives each scheduled duel-only focus a credited practice opportunity within the existing batch', () => {
  const focus = ['rear', 'waiting', 'encounter', 'wall', 'smoke'] as const;
  for (const size of [4, 8, 9, 12, 32]) {
    for (let seed = 0; seed < 50; seed++) {
      const schedule = curriculum(size, [...focus], rng(seed));
      expect(schedule).toHaveLength(size);
      const drills = schedule.filter(e => e.focused);
      expect(drills.length).toBe(Math.min(Math.floor(size / 2), Math.max(0, size - 8)));
      for (const { scenario } of drills) {
        if (scenario === 'wall') continue;
        expect(schedule.some((e, i) => (i % 4 === 0 || i % 4 === 3) && e.focused && e.scenario === scenario)).toBe(true);
      }
    }
  }
});
