import { expect, it } from 'vitest';
import { getMap, MAPS } from '../shared/arenaMap.ts';
import { MATCH_TICKS, SCORE_LIMIT, TICK_HZ } from '../shared/content.ts';
import { evaluationMaps, play, score } from './bench/evaluate-self-play.ts';

it('holds separate rotation maps for the tournament and can replay a campaign by seed', () => {
  const screened = new Set<string>(), heldBack = new Set<string>();
  for (let seed = 1; seed <= 32; seed++) {
    const { screen, tournament } = evaluationMaps(seed);
    expect(evaluationMaps(seed)).toEqual({ screen, tournament });
    expect(new Set([...screen, ...tournament]).size).toBe(6);
    screen.forEach(id => screened.add(id));
    tournament.forEach(id => heldBack.add(id));
  }
  const shipped = new Set(MAPS.map(map => map.id));
  expect(screened).toEqual(shipped);
  expect(heldBack).toEqual(shipped);
  expect(evaluationMaps(18, 'sakura, aster,sakura')).toEqual({ screen: ['sakura', 'aster'], tournament: ['sakura', 'aster'] });
  expect(() => evaluationMaps(18, 'missing')).toThrow('Unknown evaluation map');
});

it('compares independent map/seeds rather than treating swapped sides or game modes as independent wins', () => {
  const sameBlock = Array.from({ length: 100 }, () => ({ seed: 1, map: 'aster', margin: 1 }));
  expect(score(sameBlock)).toMatchObject({ blocks: 1, wins: 1, oneSidedP: .5 });
  expect(score([...sameBlock, ...sameBlock.map(leg => ({ ...leg, margin: -1 }))])).toMatchObject({ wins: 0, losses: 0, tied: 1, oneSidedP: 1 });
  expect(score(Array.from({ length: 6 }, (_, seed) => ({ seed, map: 'aster', margin: 1 }))).oneSidedP).toBeCloseTo(1 / 64);
});

it('swaps identical pilots and keeps smoke, search and wall trials reproducible', () => {
  const map = getMap('aster');
  for (const scenario of ['smoke', 'rear-search', 'wall'] as const) {
    const a = play(map, '1v1', scenario, 42, 'A', TICK_HZ * 4);
    const b = play(map, '1v1', scenario, 42, 'B', TICK_HZ * 4);
    expect(a.candidate).toEqual(b.opponent);
    expect(a.opponent).toEqual(b.candidate);
    expect(a.margin + b.margin).toBe(0);
    expect(a.candidate.live).toBeGreaterThan(0);
    if (scenario === 'smoke') expect(a.candidate.unseen).toBeGreaterThan(0);
  }
});

it('runs a complete 2v2 to the score limit or the official clock', () => {
  const result = play(getMap('aster'), '2v2', 'round', 89, 'B', MATCH_TICKS);
  expect(result.seconds).toBeLessThanOrEqual(MATCH_TICKS / TICK_HZ);
  expect(Math.abs(result.margin)).toBeLessThanOrEqual(SCORE_LIMIT['2v2']);
  expect(result.seconds).toBeGreaterThan(1);
}, 30000);
