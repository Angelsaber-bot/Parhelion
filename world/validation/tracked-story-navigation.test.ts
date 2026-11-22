import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextStoryPass, resolveTrackedStoryPoint, trackedStoryRouteBlocked } from '../src/story/trackedStoryNavigation';
import { GATES } from '../src/map/regions';

test('a local pin transitioning to a remote act falls back to the original story until the actual gate opens', () => {
  const done = new Set<string>(), local = [10, 2, 30] as const;
  assert.deepEqual(resolveTrackedStoryPoint('alpha', 'alpha', done, local), local);
  assert.equal(resolveTrackedStoryPoint('alpha', 'blacksail', done, local), null);
  assert.equal(resolveTrackedStoryPoint('alpha', 'winter', done, local), null);
  done.add('false_dawn_started'); done.add('false_dawn_route_harbor');
  assert.equal(resolveTrackedStoryPoint('alpha', 'blacksail', done, local), null, 'story flags cannot unlock a main-route seam');
  done.add('summon_circle'); assert.deepEqual(resolveTrackedStoryPoint('alpha', 'blacksail', done, local), GATES.winter.p);
  done.delete('summon_circle'); assert.equal(resolveTrackedStoryPoint('alpha', 'blacksail', done, local), null);
});
test('direct-region saves can track local work but cannot be guided across a still-closed return seam', () => {
  const done = new Set<string>();
  assert.equal(trackedStoryRouteBlocked('winter', 'winter', done), false);
  assert.deepEqual(resolveTrackedStoryPoint('winter', 'winter', done, [1, 2, 3]), [1, 2, 3]);
  assert.equal(resolveTrackedStoryPoint('winter', 'alpha', done), null);
  done.add('summon_circle'); assert.deepEqual(resolveTrackedStoryPoint('winter', 'blacksail', done), GATES.blacksail.p);
  assert.equal(resolveTrackedStoryPoint('alpha', 'alpha', done), null);
  const copy = resolveTrackedStoryPoint('winter', 'alpha', done)!; copy[0] = 999;
  assert.notEqual(GATES.winter.p[0], 999);
});

import { gateGuidePoint, GATE_LEAD } from '../src/story/trackedStoryNavigation';
import { readFileSync } from 'node:fs';
test('a reached seam marker leads on into the next region instead of sitting under the player', () => {
  const gate = GATES.britain.p, toward: [number, number] = [-720, 0];
  assert.deepEqual(gateGuidePoint(gate, toward), [...gate], 'no player position: the marker itself');
  assert.deepEqual(gateGuidePoint(gate, toward, [3, 20, 159]), [...gate], 'from across the valley: the marker itself');
  assert.deepEqual(gateGuidePoint(gate, toward, [gate[0] + 60, 4, gate[2]]), [...gate], 'still walking up to it');
  const at = gateGuidePoint(gate, toward, [gate[0], 4, gate[2]]);
  assert.ok(Math.abs(Math.hypot(at[0] - gate[0], at[2] - gate[2]) - GATE_LEAD.ahead) < 1e-6 && at[0] < gate[0], `standing on it: ${GATE_LEAD.ahead} m further west`);
  // Walking on: the guide stays the same stretch ahead (no snapping back behind you), all the way to the border.
  let last = at[0];
  for (let x = gate[0] - 5; x > gate[0] - 60; x -= 5) { const p = gateGuidePoint(gate, toward, [x, 4, gate[2] + 2]); assert.ok(p[0] < last && Math.hypot(p[0] - x, p[2] - gate[2] - 2) > GATE_LEAD.ahead - 3, `ahead of x=${x}`); last = p[0]; }
  // A few strides short of the marker it already leads on, so the beacon never sits within arm's reach.
  const short = gateGuidePoint(gate, toward, [gate[0] + GATE_LEAD.near - 2, 4, gate[2]]); assert.ok(short[0] < gate[0] - GATE_LEAD.ahead + 1);
  // Far off to the side of the route, or with a broken position, the marker stands.
  assert.deepEqual(gateGuidePoint(gate, toward, [gate[0] - 10, 4, gate[2] + GATE_LEAD.corridor + 30]), [...gate]);
  assert.deepEqual(gateGuidePoint(gate, toward, [NaN, 4, 0]), [...gate]);
  assert.deepEqual(gateGuidePoint(gate, [gate[0], gate[2]], [gate[0], 4, gate[2]]), [...gate], 'no direction to lead in');
  const copy = gateGuidePoint(gate, toward); copy[0] = 999; assert.notEqual(GATES.britain.p[0], 999, 'never hands out the shared tuple');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.ok(main.includes('const y = grid.sampleHeight(q[0], q[2]);') && main.includes('return y === null ? q : [q[0], y, q[2]];'), 'shown on the ground, wherever it was authored');
  assert.equal(main.split('resolveTrackedStoryPoint(here').length - 1, 1, 'every tracked story goes through the one seam-aware helper');
  assert.ok(main.includes('seamGuidePoint(gate.p, here, o.region)'), 'legacy objective beacons also lead past a reached crossing');
});

test('all directions along the authored road converge without sending the player back to a previous region', () => {
  const road = ['britain', 'alpha', 'winter', 'blacksail', 'kyoto'];
  for (const start of road) for (const finish of road) {
    let here = start;
    const visited = new Set<string>();
    while (here !== finish) {
      assert.ok(!visited.has(here)); visited.add(here);
      const passage = nextStoryPass(here, finish);
      assert.ok(passage);
      assert.equal(Math.abs(road.indexOf(here) - road.indexOf(passage.toward)), 1);
      here = passage.toward;
    }
  }
  assert.equal(nextStoryPass('kyoto', 'britain')?.toward, 'blacksail');
  assert.equal(nextStoryPass('alpha', 'kyoto')?.toward, 'winter');
});
