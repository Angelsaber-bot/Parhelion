import { expect, it } from 'vitest';
import { opponentLeague } from '../scripts/self-play-league.ts';

function random(seed: number) {
  let state = seed;
  return () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) + .5) / 4294967296;
}

it('prioritizes losses observed in the same generation while retaining every rival', () => {
  const ids = ['self-play', 'scripted', 'frozen'];
  const league = opponentLeague(ids, 256, {}, random(7579));
  const counts = { 'self-play': 0, scripted: 0, frozen: 0 };
  for (let i = 0; i < 256; i++) {
    const id = league.select(i) as keyof typeof counts;
    counts[id]++;
    league.observe(id, id === 'scripted' ? -1 : id === 'frozen' ? 1 : 0);
  }
  expect(Math.min(...Object.values(counts))).toBeGreaterThan(0);
  expect(counts.scripted).toBeGreaterThan(2 * counts['self-play']);
  expect(counts['self-play']).toBeGreaterThan(counts.frozen);
  expect(league.payoffs['self-play'].points).toBe(counts['self-play'] / 2);
});

it('restores discounted results only for opponents present this generation', () => {
  const old = { anchor: { games: 20, points: 4 }, obsolete: { games: 1, points: 1 } };
  const ids = ['anchor', 'replacement', 'self-play'];
  const league = opponentLeague(ids, 3, old, random(811));
  expect(league.payoffs).toEqual({ anchor: { games: 17, points: 3.4 }, replacement: { games: 0, points: 0 }, 'self-play': { games: 0, points: 0 } });
  expect(new Set([league.select(0), league.select(1), league.select(2)])).toEqual(new Set(ids));
  league.observe('anchor', 0);
  expect(old.anchor).toEqual({ games: 20, points: 4 });
});

it('covers distinct opponents when the rollout budget is smaller than the pool', () => {
  const league = opponentLeague(['a', 'b', 'c', 'd'], 2, {}, random(101));
  expect(league.select(0)).not.toBe(league.select(1));
});
