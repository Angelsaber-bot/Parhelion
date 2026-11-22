import { expect, it } from 'vitest';
import { seedVersion, tournamentSeeds, trainingSeed, trialSeed } from '../scripts/self-play-seeds.ts';
import { evaluationMaps, tournamentLegs } from './bench/evaluate-self-play.ts';

it('reserves disjoint episode-seed ranges for training, screening and promotion', () => {
  expect(trainingSeed(0, 2)).toBe(0);
  expect(trainingSeed(1 - 2 ** -33, 2)).toBe(0x7fffffff);
  for (const campaign of [0, 1231644795, 2 ** 31 - 1]) {
    for (const stage of ['wall', 'smoke', 'rear-search', 'diagnostic', 'occlusion']) {
      const seed = trialSeed(campaign, stage, 'homeward', 0, 2);
      expect(seed).toBeGreaterThanOrEqual(0x80000000);
      expect(seed).toBeLessThan(0xc0000000);
    }
    const seeds = tournamentSeeds(campaign, 'homeward', 100, 2);
    expect(new Set(seeds).size).toBe(100);
    expect(seeds.every(seed => seed >= 0xc0000000 && seed <= 0xffffffff)).toBe(true);
  }
});

it('replays 12 held-out blocks with both modes and sides, using a six-block subset for the baseline', () => {
  const campaign = 1231644795;
  const { tournament } = evaluationMaps(campaign);
  const incumbent = tournamentLegs(campaign, tournament, 4, 2);
  const baseline = tournamentLegs(campaign, tournament, 2, 2);
  expect(tournamentLegs(campaign, tournament, 4, 2)).toEqual(incumbent);
  expect(incumbent).toHaveLength(48);
  expect(baseline).toHaveLength(24);
  expect(incumbent).toEqual(expect.arrayContaining(baseline));
  for (const [legs, count] of [[incumbent, 12], [baseline, 6]] as const) {
    const blocks = new Map<string, string[]>();
    for (const { map, seed, mode, side } of legs) {
      const key = map + '/' + seed;
      blocks.set(key, [...(blocks.get(key) ?? []), mode + side]);
    }
    expect(blocks.size).toBe(count);
    for (const assignments of blocks.values()) expect(assignments).toEqual(['1v1A', '1v1B', '2v2A', '2v2B']);
  }
});

it('advances the hash sequence if two indices produce the same tournament seed', () => {
  const seedAt = (index: number) => trialSeed(2515, 'round', 'camlann', index, 2);
  expect(seedAt(895)).toBe(seedAt(302));
  const seeds = tournamentSeeds(2515, 'camlann', 896, 2);
  expect(new Set(seeds).size).toBe(896);
  expect(seeds[895]).toBe(seedAt(896));
});

it('replays the original full-width campaign seed sequence when version 1 is requested', () => {
  expect(seedVersion()).toBe(2);
  expect(seedVersion('1')).toBe(1);
  expect(() => seedVersion('3')).toThrow('seed-version');
  expect(trainingSeed(1 - 2 ** -33, 1)).toBe(0xffffffff);
  expect(trialSeed(1231644795, 'wall', 'frostcourt', 0, 1)).toBe(762503834);
  expect(tournamentSeeds(1231644795, 'frostcourt', 4, 1)).toEqual([2602946617, 1168542393, 3119511072, 2483634263]);
  expect(trialSeed(1231644795, 'maps', 'frostcourt')).toBe(3240600299);
});
