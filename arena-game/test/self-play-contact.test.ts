import { expect, it } from 'vitest';
import { getMap } from '../shared/arenaMap.ts';
import { navFor } from '../shared/botLocomotion.ts';
import { escapeFor, rivalCourse, scoreContactDrill } from '../scripts/self-play-contact.ts';

const steps = (contact: number[]) => contact.map((confidence, index) => ({ obs: [confidence], reset: index === 0, reward: 0 }));

it('scores first confirmed recovery on its preceding action and never credits a silhouette or respawn', () => {
  const trace = steps([1, 1, 0, 0, .5, 1, 1, 0, 0, 1, 1]);
  expect(scoreContactDrill(trace, 'smoke', 180, 12)).toBe(true);
  expect(trace.map(step => step.reward)).toEqual([0, 0, 0, 0, 0, .05, 0, 0, 0, 0, 0]);
  const respawn = steps([1, 1, 0, 0, .5, 1, 1]); respawn[5].reset = true;
  for (const invalid of [respawn, steps([1, 1, 0, 0, .5, .5]), steps([0, 0, 1, 1])]) {
    expect(scoreContactDrill(invalid, 'smoke', 180, 12)).toBe(false);
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
