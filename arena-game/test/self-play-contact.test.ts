import { expect, it } from 'vitest';
import { HUMAN_FEATURES, humanObservation } from '../shared/humanCombat.ts';
import { getMap } from '../shared/arenaMap.ts';
import { navFor } from '../shared/botLocomotion.ts';
import { Match } from '../shared/match.ts';
import { escapeFor, openingDamageCredit, waitingApproach, rivalCourse, scoreContactDrill, sightlineDamageCredit } from '../scripts/self-play-contact.ts';

const steps = (contact: number[]) => contact.map((confidence, index) => ({ obs: [confidence], reset: index === 0, reward: 0 }));

it('scores first confirmed recovery on its preceding action and never credits a silhouette or respawn', () => {
  const trace = steps([1, 1, 0, 0, .5, 1, 1, 0, 0, 1, 1]);
  expect(scoreContactDrill(trace, 'smoke', 180, 12, { start: 2, end: 5 })).toBe(true);
  expect(trace.map(step => step.reward)).toEqual([0, 0, 0, 0, 0, .05, 0, 0, 0, 0, 0]);
  const respawn = steps([1, 1, 0, 0, .5, 1, 1]); respawn[5].reset = true;
  for (const invalid of [respawn, steps([1, 1, 0, 0, .5, .5]), steps([0, 0, 1, 1])]) {
    expect(scoreContactDrill(invalid, 'smoke', 180, 12, { start: 2, end: 5 })).toBe(false);
  }
  expect(scoreContactDrill(steps(Array(16).fill(1)), 'retreat', 300, 12)).toBe(true);
  expect(scoreContactDrill(steps(Array(16).fill(1)), 'retreat', 72, 12)).toBe(false);
});

it('samples both exits, a reversal, and a hold and keeps reversals on traversable links', () => {
  expect([.05, .3, .55, .8].map(v => escapeFor('smoke', () => v))).toEqual(['left', 'right', 'reverse', 'hold']);
  const map = getMap('aster'), nav = navFor({ map });
  for (const b of nav.nodes) {
    const a = nav.nearest(b.x - 7, b.y, b.z);
    if (!a) continue;
    const course = rivalCourse(map, nav, a, b, 'smoke', 'reverse', () => .6);
    if (!course) continue;
    const nodes = [b, ...course.route];
    expect(nodes.at(-1)?.id).toBe(b.id);
    expect(nodes.slice(1).every((n,i) => nodes[i].links.includes(n.id))).toBe(true);
    return;
  }
  throw Error('No traversable return course in the production map');
});

it('credits the rear acquisition action once, only after a turn and confirmation in the same life', () => {
  const trace = (angle: number) => steps([0, 0, .5, 1, 1, 0, 1, 1]).map((step, i) => {
    const yaw = Math.PI - .1 + (i >= 2 ? angle : 0);
    step.obs[HUMAN_FEATURES.length + 3] = Math.sin(yaw);
    step.obs[HUMAN_FEATURES.length + 4] = Math.cos(yaw);
    return step;
  });
  const moving = trace(1.3);
  expect(scoreContactDrill(moving, 'rear', 180, 12)).toBe(true);
  expect(moving.map(s => s.reward)).toEqual([0, 0, .05, 0, 0, 0, 0, 0]);
  const respawn = trace(1.3);
  respawn[4].reset = true;
  for (const invalid of [trace(0), respawn, trace(1.3).slice(0, 4)]) {
    expect(scoreContactDrill(invalid, 'rear', 180, 12)).toBe(false);
  }
});

it('ignores pre-smoke recovery and credits confirmed contact just after clearing', () => {
  const early = steps([1, 1, 0, 0, 1, 1, 1, 1]);
  expect(scoreContactDrill(early, 'smoke', 144, 12, { start: 5, end: 10 })).toBe(false);
  expect(scoreContactDrill(early, 'smoke', 144, 12, { start: 0, end: 2 })).toBe(false);
  const late = steps([1, 1, 1, 0, 0, 0, 0, 0, 1, 1]);
  expect(scoreContactDrill(late, 'smoke', 96, 12, { start: 3, end: 8 })).toBe(false);
  expect(scoreContactDrill(late, 'smoke', 144, 12, { start: 3, end: 8 })).toBe(true);
  expect(late.reduce((sum, action) => sum + action.reward, 0)).toBe(.05);
});

it('places remedial searches on hidden walkable approaches to the actual opposing spawn on both sides', () => {
  for (const id of ['frostcourt', 'homeward', 'blackflag']) {
    const game = new Match(getMap(id), '1v1'), nav = navFor(game);
    for (const team of ['A', 'B'] as const) game.addPlayer(team, { team, name: team, char: 0, skins: [], bot: true });
    game.phase = 'countdown'; game.phaseT = 1; game.step();
    for (const side of ['A', 'B']) {
      const pilot = game.player(side)!, rival = game.player(side === 'A' ? 'B' : 'A')!;
      const path = nav.path(nav.nearest(pilot.x, pilot.y, pilot.z)!, nav.nearest(rival.x, rival.y, rival.z)!)!;
      const confidenceAt = (node: typeof path[number]) => {
        const pose = { ...pilot, x: node.x, y: node.y, z: node.z, yaw: Math.atan2(node.x - rival.x, node.z - rival.z) };
        return humanObservation(game.map, pose, [{ team: rival.team, feet: [rival.x, rival.y, rival.z], crouched: false }],
          (a, b) => game.heroes.visible(a, b), [0, 0])[0];
      };
      for (const nearSightline of [false, true]) {
        const node = waitingApproach(game.map, nav, pilot, rival, () => .5, nearSightline)!;
        expect(node, id + side).toBeDefined();
        expect(confidenceAt(node)).toBe(0);
        const index = path.indexOf(node);
        expect(index).toBeGreaterThanOrEqual(0);
        if (nearSightline) expect(path.slice(index + 1, index + 4).some(n => confidenceAt(n) > 0)).toBe(true);
        else expect(path.length - index - 1).toBeLessThanOrEqual(40);
      }
    }
  }
});

it('uses inclusive first-damage deadlines only for initially visible close-range opponents', () => {
  const close = [1, 0, 0, 12 / 45];
  expect([1, 30, 31, 120, 121].map(tick => openingDamageCredit(close, tick))).toEqual([.08, .08, .04, .04, 0]);
  for (const view of [[0, 0, 0, 0], [.5, 0, 0, .1], [1, 0, 0, 13 / 45]])
    expect(openingDamageCredit(view, 1)).toBe(0);
});

it('gives the distant opener bonus only while the opponent was clear and still at range', () => {
  expect(sightlineDamageCredit([1, 0, 0, 1], 180, 53, 45)).toBe(.08);
  expect(sightlineDamageCredit([1, 0, 0, 1], 181, 53, 45)).toBe(0);
  expect(sightlineDamageCredit([.5, 0, 0, 1], 1, 53, 45)).toBe(0);
  expect(sightlineDamageCredit([1, 0, 0, 1], 1, 44, 45)).toBe(0);
  expect(sightlineDamageCredit([1, 0, 0, .4], 1, 60, 45)).toBe(0);
});
