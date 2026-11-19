import { expect, it } from 'vitest';
import { Bot, BOT_SKILL } from '../shared/bot.ts';
import { tacticScore, TACTIC_FEATURES } from '../shared/botTactics.ts';
import tacticsModel from '../shared/botTacticsModel.json';
import { buildMap, lineOfSight, type MapObject } from '../shared/map.ts';
import { Match } from '../shared/match.ts';

const box = (id: string, position: MapObject['position'], size: MapObject['size']): MapObject =>
  ({ id, type: 'box', position, size, material: '', role: '', collision: true });
const map = buildMap({
  mapId: 'tactic-visibility', version: '1', bounds: { min: [-12, -1, -12], max: [12, 7, 12] },
  player: { radius: .35, height: 1.8, eyeHeight: 1.6, walkSpeed: 5, stepHeight: .3 },
  objects: [box('floor', [0, -.5, 0], [24, 1, 24]), box('wall', [0, 2, -4], [8, 4, 1])],
  anchors: [
    { id: 'west', kind: 'spawn', team: 'west', position: [-6, 0, 4] },
    { id: 'east', kind: 'spawn', team: 'east', position: [6, 0, 4] },
    { id: 'center', kind: 'objective', position: [0, 0, 4] },
  ], routes: [],
});

it('loads fitted weights against the same feature order the bot produces', () => {
  const { weights } = tacticsModel;
  expect(tacticsModel.features).toEqual(TACTIC_FEATURES);
  expect(weights.hidden.length).toBeGreaterThan(1);
  expect(weights.bias).toHaveLength(weights.hidden.length);
  expect(weights.output).toHaveLength(weights.hidden.length);
  expect(weights.hidden.every(row => row.length === TACTIC_FEATURES.length && row.every(Number.isFinite))).toBe(true);
  const empty = TACTIC_FEATURES.map(() => 0);
  expect(tacticScore(weights, empty)).not.toBe(tacticScore(weights, empty.map(() => 1)));
});

it('scores reachable routes using the last sighting when a fighter moves behind a wall', () => {
  function observe(hiddenX: number) {
    const match = new Match(map, '1v1');
    const records: { features: readonly number[]; route: number[] }[][] = [];
    const bot = new Bot(42, BOT_SKILL.hard, options => {
      records.push(options.map(c => ({ features: c.features, route: c.path.map(p => p.id) })));
      return 0;
    });
    match.addPlayer('a', { name: 'a', team: 'A', char: 0, skins: [], bot: true });
    match.addPlayer('b', { name: 'b', team: 'B', char: 0, skins: [], bot: false });
    Object.assign(match.player('a')!, { x: 0, y: 0, z: 4, yaw: 0 });
    Object.assign(match.player('b')!, { x: 0, y: 0, z: 0 });
    match.phase = 'live';
    for (match.tick = 1; match.tick <= 17; match.tick++) bot.think(match, 'a');
    expect(lineOfSight(map, [0, 1.6, 4], [hiddenX, 1.6, -9])).toBe(false);
    Object.assign(match.player('b')!, { x: hiddenX, z: -9 });
    for (; match.tick <= 48; match.tick++) bot.think(match, 'a');
    expect(records.length).toBeGreaterThanOrEqual(2);
    const recent = records[1];
    expect(recent.length).toBeGreaterThan(1);
    expect(recent.every(c => c.features[TACTIC_FEATURES.indexOf('visible')] === 0)).toBe(true);
    expect(recent.slice(1).every(c => c.route.length > 0 && c.features.every(Number.isFinite))).toBe(true);
    return recent;
  }

  expect(observe(-.75)).toEqual(observe(.75));
});
