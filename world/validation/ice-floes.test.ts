import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { planIceFloes, createIceFloes, ICE_FLOES } from '../src/environment/iceFloes';

const extent = { x0: -100, z0: -100, span: 200, spanZ: 200 };
// Frozen tile north of z = 0: a flat shelf at the waterline between x = −12 and 12, land elsewhere.
// South of the border: a lake under the shelf, land either side.
const height = (x: number, z: number) => Math.abs(x) > 100 || Math.abs(z) > 100 ? null : z < 0 ? (Math.abs(x) <= 12 ? 1.1 : 5) : (Math.abs(x) <= 30 && z < 40 ? -1.5 : 4);
const frozen = (_x: number, z: number) => z < 0;

test('floes gather where a frozen shelf at the waterline faces open water, and nowhere else', () => {
  const plan = planIceFloes({ xs: [], zs: [0] }, extent, height, frozen, 1);
  assert.ok(plan.length > 15 && plan.length <= ICE_FLOES.max, String(plan.length));
  for (const f of plan) {
    assert.ok(f.z > 0 && f.z <= 1 + ICE_FLOES.reach + .01, 'on the water side, within reach of the shelf');
    assert.ok(height(f.x, f.z)! < 1, 'floating on water, never on land');
    assert.ok(Math.abs(f.x) <= 12 + 3, 'only off the shelf, not along the dry banks');
  }
  const near = plan.filter(f => f.z < 8), far = plan.filter(f => f.z > 16);
  assert.ok(near.length > far.length, 'crowded at the edge, thinning out');
  const mean = (a: typeof plan) => a.reduce((s, f) => s + f.size, 0) / Math.max(1, a.length);
  assert.ok(mean(near) > mean(far), 'big plates by the shelf, small ones adrift');
  assert.deepEqual(planIceFloes({ xs: [], zs: [0] }, extent, height, frozen, 1), plan, 'same every visit');
});

test('no shelf, no water or no frozen side: no floes', () => {
  assert.equal(planIceFloes({ xs: [], zs: [0] }, extent, () => 5, frozen, 1).length, 0, 'dry land both sides');
  assert.equal(planIceFloes({ xs: [], zs: [0] }, extent, height, () => false, 1).length, 0, 'an ordinary beach is not an ice shelf');
  assert.equal(planIceFloes({ xs: [], zs: [0] }, extent, (x, z) => z < 0 ? 6 : -2, frozen, 1).length, 0, 'a cliff over water is not a shelf');
  assert.equal(planIceFloes({ xs: [], zs: [] }, extent, height, frozen, 1).length, 0);
});

test('the plates ride the waterline as one instanced draw and bob without drifting away', () => {
  const plan = planIceFloes({ xs: [], zs: [0] }, extent, height, frozen, 1), floes = createIceFloes(plan, 1);
  assert.equal(floes.mesh.count, plan.length); assert.equal(floes.mesh.name, 'IceFloes');
  const m = new THREE.Matrix4(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  floes.mesh.getMatrixAt(0, m); p0.setFromMatrixPosition(m);
  floes.update(1.7, new THREE.Vector3(0, 2, 10)); floes.mesh.getMatrixAt(0, m); p1.setFromMatrixPosition(m);
  assert.ok(Math.abs(p1.y - 1) < .1 && p1.y !== p0.y, 'bobbing at the waterline'); assert.equal(p1.x, p0.x); assert.equal(p1.z, p0.z);
  floes.update(.1, new THREE.Vector3(5000, 0, 5000)); assert.equal(floes.mesh.visible, false, 'not animated from across the map');
  const empty = createIceFloes([], 1); empty.update(.1, new THREE.Vector3()); assert.equal(empty.mesh.visible, false);
  floes.dispose(); empty.dispose();
});
