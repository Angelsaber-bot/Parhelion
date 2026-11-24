import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateGuidePoint, GATE_LEAD, nextStoryPass, roadGuidePoint, trackedStoryRouteBlocked } from '../src/story/trackedStoryNavigation';
import { GATES, regionAt } from '../src/map/regions';
import { WORLD_REGION_IDS } from '../src/core/regionIdentity';
import { EXPANSION_CONNECTIONS } from '../src/map/worldPlan';

test('a local pin transitioning to a remote act falls back to the original story until the actual gate opens', () => {
  const done = new Set<string>();
  assert.equal(trackedStoryRouteBlocked('alpha', 'alpha', done), false);
  assert.equal(nextStoryPass('alpha', 'blacksail', done), null);
  assert.equal(nextStoryPass('alpha', 'winter', done), null);
  done.add('false_dawn_started'); done.add('false_dawn_route_harbor');
  assert.equal(trackedStoryRouteBlocked('alpha', 'blacksail', done), true, 'story flags cannot unlock a main-route seam');
  done.add('summon_circle');
  const pass = nextStoryPass('alpha', 'blacksail', done);
  assert.ok(pass?.kind === 'gate'); assert.equal(pass.gate, GATES.winter);
  done.delete('summon_circle'); assert.equal(nextStoryPass('alpha', 'blacksail', done), null);
});
test('direct-region saves can track local work but cannot be guided across a still-closed return seam', () => {
  const done = new Set<string>();
  assert.equal(trackedStoryRouteBlocked('winter', 'winter', done), false);
  assert.equal(trackedStoryRouteBlocked('winter', 'alpha', done), true);
  assert.equal(trackedStoryRouteBlocked('home', 'alpha', done), false);
  assert.equal(trackedStoryRouteBlocked('orleans', 'kyoto', done), false);
  assert.equal(trackedStoryRouteBlocked('home', 'egypt', done), true, 'an open first road cannot bypass a closed later gate');
  done.add('summon_circle');
  assert.equal(nextStoryPass('winter', 'blacksail', done)?.toward, 'blacksail');
  assert.equal(nextStoryPass('alpha', 'alpha', done), null);
  assert.equal(nextStoryPass('sky', 'alpha', done), null, 'Sky Crown uses its authored launch and return markers');
});

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
});

test('all directions along the authored road converge without sending the player back to a previous region', () => {
  for (const start of WORLD_REGION_IDS) for (const finish of WORLD_REGION_IDS) {
    let here = start;
    const visited = new Set<string>();
    while (here !== finish) {
      assert.ok(!visited.has(here)); visited.add(here);
      const passage = nextStoryPass(here, finish);
      assert.ok(passage);
      if (passage.kind === 'road') {
        assert.deepEqual([here, passage.toward].sort(), [passage.road.from, passage.road.to].sort());
      }
      here = passage.toward;
    }
  }
  assert.equal(nextStoryPass('kyoto', 'britain')?.toward, 'blacksail');
  assert.equal(nextStoryPass('alpha', 'kyoto')?.toward, 'winter');
  assert.equal(nextStoryPass('orleans', 'qin')?.toward, 'egypt');
});

test('the guide advances through each authored road in both directions and turns at bends', () => {
  for (const road of EXPANSION_CONNECTIONS) for (const [from, to] of [[road.from, road.to], [road.to, road.from]]) {
    const pass = nextStoryPass(from, to);
    assert.ok(pass?.kind === 'road');
    const [start, turn] = pass.points, end = pass.points.at(-1)!;
    assert.equal(regionAt(...start).id, from);
    assert.equal(regionAt(...end).id, to);
    assert.deepEqual(roadGuidePoint(pass, 1060, 310), { point: start, onRoad: false, atEnd: false });
    const ahead = roadGuidePoint(pass, ...start);
    assert.ok(ahead.onRoad && !ahead.atEnd);
    assert.equal(Math.round(Math.hypot(ahead.point[0] - start[0], ahead.point[1] - start[1])), 32);
    const offset = 15 / Math.hypot(turn[0] - start[0], turn[1] - start[1]);
    const beforeTurn = [turn[0] + (start[0] - turn[0]) * offset, turn[1] + (start[1] - turn[1]) * offset] as const;
    assert.deepEqual(roadGuidePoint(pass, ...beforeTurn).point, turn, road.id);
    assert.notDeepEqual(roadGuidePoint(pass, ...turn).point, turn, road.id);
    assert.ok(roadGuidePoint(pass, ...end).atEnd);
  }
});
