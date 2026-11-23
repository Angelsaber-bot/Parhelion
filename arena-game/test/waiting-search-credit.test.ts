import { describe, expect, it } from 'vitest';
import { creditWaitingSearch } from '../scripts/waiting-search-credit.ts';
import { HUMAN_FEATURES } from '../shared/humanCombat.ts';
import type { MapData } from '../shared/map.ts';

const bounds: MapData['bounds'] = { min: [0, 0, 0], max: [40, 10, 40] };
function view(x: number, contact = 0, reset = false) {
  const obs = new Array<number>(HUMAN_FEATURES.length + 12).fill(0);
  obs[0] = contact;
  obs[HUMAN_FEATURES.length] = (x - 20) / 20;
  return { obs, reset, reward: 0 };
}

describe('stationary opponent search credit', () => {
  it('pays once for the observed discovery and removes revisited detours from approach credit', () => {
    const trail = [view(2), view(6), view(10), view(6), view(6), view(6), view(6, 1), view(10, 1)];
    expect(creditWaitingSearch(trail, bounds)).toBe(true);
    expect(trail.map(x => x.reward)).toEqual([.08, 0, 0, 0, 0, .04, 0, 0]);
  });
  it('excludes pre-visible opponents, silhouettes, respawns and observations after the wait', () => {
    const hidden = [view(2), view(6, .35), view(10, 1)];
    for (const trail of [[view(2, 1), view(8, 1)], [view(2), view(6, 0, true), view(10, 1)], hidden.slice(0, 2)]) {
      expect(creditWaitingSearch(trail, bounds)).toBe(false);
      expect(trail.every(x => x.reward === 0)).toBe(true);
    }
  });
  it('credits turning to see a waiting opponent without inventing route progress', () => {
    const turn = [view(2), view(2, 1)];
    expect(creditWaitingSearch(turn, bounds)).toBe(true);
    expect(turn.map(x => x.reward)).toEqual([.04, 0]);
  });
});
