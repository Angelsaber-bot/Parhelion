import { expect, it } from 'vitest';
import { decisionCoach } from '../scripts/self-play-coach.ts';
import { getMap } from '../shared/arenaMap.ts';
import { buildMap, type MapObject } from '../shared/map.ts';
import { newPlayer } from '../shared/sim.ts';

it('labels visible aim and trigger, and withholds fire on smoke glimpses and lost contacts', () => {
  const coach = decisionCoach(), me = newPlayer('pilot', 'A', 0), map = getMap('aster');
  me.grounded = false;
  const obs = Array<number>(30).fill(0);
  obs[0] = 1; obs[3] = .25; obs[8] = 1;
  expect(coach(obs, true, map, me)).toEqual([0, 0, null, null, 1]);
  obs[1] = .45; obs[2] = -.275;
  expect(coach(obs, false, map, me)).toEqual([.5, -.5, null, null, 0]);
  obs[0] = .5; obs[1] = obs[2] = 0;
  expect(coach(obs, false, map, me)[4]).toBe(0);
  obs[0] = 0;
  expect(coach(obs, false, map, me)).toEqual([null, null, null, null, 0]);
});

it('commits to one search direction after inactivity and clears search memory on respawn', () => {
  const coach = decisionCoach(), me = newPlayer('pilot', 'A', 0), map = getMap('aster');
  me.grounded = false;
  const obs = Array<number>(30).fill(0);
  obs[22] = 1; obs[26] = 1;
  const turns = Array.from({ length: 10 }, (_, i) => coach(obs, i === 0, map, me)[0]);
  expect(turns.slice(0, 5)).toEqual(Array(5).fill(null));
  expect(turns.slice(5)).toEqual(Array(5).fill(.52));
  expect(coach(obs, true, map, me)[0]).toBeNull();
  obs[27] = .8; obs[28] = -.8;
  expect(coach(obs, false, map, me)[0]).toBeLessThan(0);
});

it('labels the only supported lateral escape at a corner and respects immobilization', () => {
  const box = (id: string, position: MapObject['position'], size: MapObject['size']): MapObject =>
    ({ id, type: 'box', position, size, material: '', role: '', collision: true });
  const map = buildMap({ ...getMap('aster').data, objects: [
    box('floor', [0, -.5, 0], [10, 1, 10]), box('front', [0, 1, -1], [4, 2, .5]), box('right', [1, 1, 0], [.5, 2, 4]),
  ] });
  const me = newPlayer('pilot', 'A', 0), obs = Array<number>(30).fill(0);
  Object.assign(me, { x: .27, y: 0, z: -.27, yaw: 0, grounded: true });
  const coach = decisionCoach();
  expect(coach(obs, true, map, me).slice(2, 4)).toEqual([-.85, 0]);
  me.rootUntil = me.abilityTick + 10;
  expect(coach(obs, false, map, me).slice(2, 4)).toEqual([null, null]);
});
