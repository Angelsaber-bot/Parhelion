import { createHash } from 'node:crypto';

export function seedVersion(value?: string): 1 | 2 {
  if (value === '1') return 1;
  if (value === undefined || value === '2') return 2;
  throw Error('Expected --seed-version 1 or 2');
}

// Version 1 replays campaigns recorded before training and evaluation had separate seed ranges.
export function trainingSeed(draw: number, version: 1 | 2): number {
  return Math.floor(draw * (version === 1 ? 2 ** 32 : 2 ** 31));
}

export function trialSeed(campaign: number, stage: string, map: string, index = 0, version: 1 | 2 = 2): number {
  const raw = createHash('sha256').update(JSON.stringify([campaign, stage, map, index])).digest().readUInt32LE();
  // Map selection is not a simulation seed. Preserve the existing rotation for every campaign.
  if (version === 1 || stage === 'maps' || stage === 'diagnostic-map') return raw;
  return (stage === 'round' ? 0xc0000000 : 0x80000000) + (raw >>> 2);
}

export function tournamentSeeds(campaign: number, map: string, count: number, version: 1 | 2): number[] {
  const seeds: number[] = [];
  const used = new Set<number>();
  for (let index = 0; seeds.length < count; index++) {
    const seed = trialSeed(campaign, 'round', map, index, version);
    if (version === 2 && used.has(seed)) continue;
    used.add(seed);
    seeds.push(seed);
  }
  return seeds;
}
