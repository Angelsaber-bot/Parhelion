import { expect, it } from 'vitest';
import { getMap, MAPS } from '../shared/arenaMap.ts';
import { MATCH_TICKS, SCORE_LIMIT, TICK_HZ } from '../shared/content.ts';
import { Bot, navFor } from '../shared/bot.ts';
import { Match } from '../shared/match.ts';
import { lineOfSight } from '../shared/map.ts';
import { wrapAngle } from '../shared/humanCombat.ts';
import { cameraLimitedScript, clearsWall, evaluationMaps, play, score } from './bench/evaluate-self-play.ts';

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
  expect(score([{ seed: 1, map: 'aster', margin: 4 }, { seed: 1, map: 'aster', margin: -2 }])).toMatchObject(
    { legWins: 1, legLosses: 1, legDraws: 0, meanScoreMargin: 1, blocks: 1 });
});

it('requires physical clearance from the obstructed start even if the bot never attempts a blocked move', () => {
  const reference = { wallTrials: 6, wallClearFraction: .8, meanWallClearSeconds: 2, stallFraction: .03 };
  expect(clearsWall(reference, reference)).toBe(true);
  expect(clearsWall({ ...reference, wallClearFraction: 0, meanWallClearSeconds: 12, stallFraction: 0 }, reference)).toBe(false);
});

it('isolates acquisition trials from the deployed script’s wider vision without changing the game or the original bot', () => {
  const map = getMap('aster'), match = new Match(map, '1v1');
  for (const team of ['A', 'B'] as const) match.addPlayer(team, { name: team, team, char: 0, skins: [], bot: true });
  const nav = navFor(match), me = match.player('A')!, foe = match.player('B')!;
  const u = nav.nodes.find(p => p.links.length)!;
  const v = nav.nodes.find(p => {
    const d = Math.hypot(p.x - u.x, p.z - u.z);
    return d > 4 && d < 12 && Math.abs(p.y - u.y) < .2 &&
      lineOfSight(map, [u.x, u.y + 1.1, u.z], [p.x, p.y + 1.1, p.z]);
  })!;
  match.phase = 'live'; match.tick = 1;
  const bearing = Math.atan2(u.x - v.x, u.z - v.z);
  Object.assign(me, { x: u.x, y: u.y, z: u.z, yaw: wrapAngle(bearing - 65 * Math.PI / 180), pitch: 0 });
  Object.assign(foe, { x: v.x, y: v.y, z: v.z });
  const decide = (limit: boolean, alive: boolean) => {
    foe.alive = alive;
    const script = new Bot(27);
    return (limit ? cameraLimitedScript(script) : script).think(match, 'A');
  };
  // 65° lies between the player's 55.2° half-view and the public script's 74.5° half-view.
  expect(decide(false, true)).not.toEqual(decide(false, false));
  expect(decide(true, true)).toEqual(decide(true, false));
  me.yaw = bearing;
  expect(decide(true, true)).not.toEqual(decide(true, false));
  expect(match.slots.size).toBe(2);
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
    if (scenario === 'smoke') {
      expect(a.candidate.smokeHidden).toBeGreaterThan(0);
      expect(a.candidate.unseen).toBeGreaterThanOrEqual(a.candidate.smokeHidden);
    }
    if (scenario === 'wall') {
      expect(a.candidate.wallTrials).toBe(1);
      expect(b.candidate.wallTrials).toBe(0);
    }
  }
});

it('runs a complete 2v2 to the score limit or the official clock', () => {
  const result = play(getMap('aster'), '2v2', 'round', 89, 'B', MATCH_TICKS);
  expect(result.seconds).toBeLessThanOrEqual(MATCH_TICKS / TICK_HZ);
  expect(Math.abs(result.margin)).toBeLessThanOrEqual(SCORE_LIMIT['2v2']);
  expect(result.seconds).toBeGreaterThan(1);
}, 30000);
