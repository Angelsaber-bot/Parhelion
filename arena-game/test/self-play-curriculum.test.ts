import { expect, it } from 'vitest';
import { getMap, MAPS } from '../shared/arenaMap.ts';
import { humanObservation } from '../shared/humanCombat.ts';
import { Match } from '../shared/match.ts';
import { curriculum, placeEncounter } from '../scripts/self-play-rollout.ts';
import { rng } from '../scripts/evaluation/evaluate-spawn-search.ts';

it('gives each scheduled duel-only focus a credited practice opportunity within the existing batch', () => {
  const focus = ['rear', 'waiting', 'encounter', 'wall', 'smoke', 'sightline'] as const;
  for (const size of [4, 8, 9, 12, 32]) {
    for (let seed = 0; seed < 50; seed++) {
      const schedule = curriculum(size, [...focus], rng(seed));
      expect(schedule).toHaveLength(size);
      const drills = schedule.filter(e => e.focused);
      expect(drills.length).toBe(Math.min(Math.floor(size / 2), Math.max(0, size - 9)));
      for (const { scenario } of drills) {
        if (scenario === 'wall') continue;
        expect(schedule.some((e, i) => (i % 4 === 0 || i % 4 === 3) && e.focused && e.scenario === scenario)).toBe(true);
      }
    }
  }
});

it('starts distant practice from clear walkable lanes without aiming either player at the opponent', () => {
  const distances: number[] = [];
  for (const { id } of MAPS) for (const side of ['A', 'B'] as const) {
    const game = new Match(getMap(id), '1v1');
    game.addPlayer('pilot', { team: side, name: 'pilot', char: 0, skins: [], bot: true });
    game.addPlayer('rival', { team: side === 'A' ? 'B' : 'A', name: 'rival', char: 1, skins: [], bot: true });
    game.phase = 'countdown'; game.phaseT = 1; game.step();
    const start = placeEncounter(game, 'sightline', true, rng(side === 'A' ? 17 : 1000));
    const range = start.openingRange;
    expect(start.scenario, id + side).toBe('sightline');
    expect(range?.distance, id + side).toBeGreaterThanOrEqual(28);
    distances.push(range!.distance);
    for (const [id, other] of [['pilot', 'rival'], ['rival', 'pilot']]) {
      const viewer = game.player(id)!, rival = game.player(other)!;
      const [contact, yaw] = humanObservation(game.map, viewer,
        [{ team: rival.team, feet: [rival.x, rival.y, rival.z], crouched: false }],
        (from, to) => game.heroes.visible(from, to), [0, 0]);
      expect(contact).toBe(1);
      expect(Math.abs(yaw)).toBeGreaterThan(.14);
      expect(Math.abs(yaw)).toBeLessThan(.56);
    }
  }
  expect(distances.some(distance => distance >= 45)).toBe(true);
});

it('varies the pilot heading at full-spawn remedial starts on either seat', () => {
  for (const side of ['A', 'B'] as const) {
    const game = new Match(getMap('frostcourt'), '1v1');
    game.addPlayer('pilot', { team: side, name: 'pilot', char: 0, skins: [], bot: true });
    game.addPlayer('rival', { team: side === 'A' ? 'B' : 'A', name: 'rival', char: 1, skins: [], bot: true });
    game.phase = 'countdown'; game.phaseT = 1; game.step();
    const pilot = game.player('pilot')!, rival = game.player('rival')!;
    const { x, z, yaw } = pilot, targetYaw = rival.yaw;
    placeEncounter(game, 'waiting', true, () => .75);
    expect(pilot.yaw).toBe(yaw);
    const draws = [.75, .25, .8];
    placeEncounter(game, 'waiting', true, () => draws.shift()!);
    expect(pilot.yaw - yaw).toBeCloseTo(.54 * Math.PI);
    expect([pilot.x, pilot.z, rival.yaw]).toEqual([x, z, targetYaw]);
  }
});
