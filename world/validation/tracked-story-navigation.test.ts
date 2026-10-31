import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveTrackedStoryPoint, trackedStoryRouteBlocked } from '../src/trackedStoryNavigation';
import { GATES } from '../src/regions';

test('a local pin transitioning to a remote act falls back to the original story until the actual gate opens', () => {
  const done = new Set<string>(), local = [10, 2, 30] as const;
  assert.deepEqual(resolveTrackedStoryPoint('alpha', 'alpha', done, local), local);
  assert.equal(resolveTrackedStoryPoint('alpha', 'blacksail', done, local), null);
  assert.equal(resolveTrackedStoryPoint('alpha', 'winter', done, local), null);
  done.add('false_dawn_started'); done.add('false_dawn_route_harbor');
  assert.equal(resolveTrackedStoryPoint('alpha', 'blacksail', done, local), null, 'story flags cannot unlock a main-route seam');
  done.add('summon_circle'); assert.deepEqual(resolveTrackedStoryPoint('alpha', 'blacksail', done, local), GATES.blacksail.p);
  done.delete('summon_circle'); assert.equal(resolveTrackedStoryPoint('alpha', 'blacksail', done, local), null);
});
test('direct-region saves can track local work but cannot be guided across a still-closed return seam', () => {
  const done = new Set<string>();
  assert.equal(trackedStoryRouteBlocked('winter', 'winter', done), false);
  assert.deepEqual(resolveTrackedStoryPoint('winter', 'winter', done, [1, 2, 3]), [1, 2, 3]);
  assert.equal(resolveTrackedStoryPoint('winter', 'alpha', done), null);
  done.add('summon_circle'); assert.deepEqual(resolveTrackedStoryPoint('winter', 'blacksail', done), GATES.winter.p);
  assert.equal(resolveTrackedStoryPoint('alpha', 'alpha', done), null);
  const copy = resolveTrackedStoryPoint('winter', 'alpha', done)!; copy[0] = 999;
  assert.notEqual(GATES.winter.p[0], 999);
});
