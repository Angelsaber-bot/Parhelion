import test from 'node:test';
import assert from 'node:assert/strict';
import { createFloodTrial, floodStage } from '../src/environment/egyptFloodTrial';
import { EGYPT_CAMPAIGN as E } from '../src/story/egyptCampaign';

test('E06 flood trial: closed, then a flow that backs up at the plate, then runs past once solved', () => {
  assert.equal(floodStage(new Set(), E), 'idle');
  assert.equal(floodStage(new Set([E.trial]), E), 'blocked');
  for (const solution of [E.side, E.armor, E.steady]) assert.equal(floodStage(new Set([E.trial, solution]), E), 'flowing', solution);
  const f = createFloodTrial({ gate: [0, 5, 0], outlet: [30, 4, 10], basin: [50, 8, 40] }, () => 5);
  const stream = f.root.getObjectByName('FloodTrialStream')! as import('three').Mesh, pool = f.root.getObjectByName('FloodTrialPool')!, basin = f.root.getObjectByName('FloodTrialBasinWater')!;
  f.apply('idle', 'dry'); assert.equal(stream.visible, false); assert.equal(pool.visible, false); assert.equal(basin.visible, false);
  f.apply('blocked', 'dry'); assert.equal(stream.visible, true); assert.equal(pool.visible, true);
  const blocked = stream.geometry.drawRange.count;
  f.apply('flowing', 'tested'); assert.equal(pool.visible, false); assert.ok(stream.geometry.drawRange.count > blocked, 'the flow continues past the outlet');
  assert.equal(basin.visible, true);
  const tex = (stream.material as import('three').MeshStandardMaterial).map!, before = tex.offset.y;
  f.update(.5); assert.notEqual(tex.offset.y, before, 'the water surface moves');
  f.dispose();
});
