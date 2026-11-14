import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createQinProcessionScene, PROCESSION, terracottaGeometry } from '../src/environment/qinProcessionScene';

test('the Q06 funeral procession marches across the road while it is cut, then moves on', () => {
  const g = terracottaGeometry(); g.computeBoundingBox();
  assert.ok(g.boundingBox!.max.y > 1.7 && g.boundingBox!.max.y < 2, 'a life-size figure'); assert.ok(g.getAttribute('color'));
  const anchor = [100, 5, 200] as const, scene = createQinProcessionScene(() => anchor, () => 5);
  const [cutter, inward] = scene.root.children as THREE.InstancedMesh[];
  assert.equal(cutter.count, PROCESSION.files * PROCESSION.perFile);
  scene.apply('hidden'); assert.equal(scene.root.visible, false);
  scene.apply('cutting'); const near = new THREE.Vector3(100, 5, 210);
  scene.update(.1, near);
  const m = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3();
  cutter.getMatrixAt(0, m); a.setFromMatrixPosition(m);
  assert.ok(Math.abs(a.z - (anchor[2] + 1.5)) < PROCESSION.files * PROCESSION.fileGap, 'the cutting column crosses at the cut point');
  assert.ok(Math.abs(a.x - anchor[0]) <= PROCESSION.lane / 2 + 1e-6);
  scene.update(1, near); cutter.getMatrixAt(0, m); b.setFromMatrixPosition(m);
  assert.ok(Math.abs(b.x - a.x - PROCESSION.speed) < 1e-3 || Math.abs(b.x - a.x) > PROCESSION.lane / 2, 'it marches along the lane (wrapping at the end)');
  inward.getMatrixAt(0, m); a.setFromMatrixPosition(m); assert.ok(Math.abs(a.x - (anchor[0] + PROCESSION.inward * .5)) < 3, 'the inward column files north, off to one side');
  scene.apply('moved'); assert.equal(cutter.visible, false, 'the road clears after the crew rejoins'); assert.equal(inward.visible, true);
  scene.update(.1, new THREE.Vector3(2000, 0, 2000)); assert.equal(scene.root.visible, false, 'not drawn from far away');
  scene.dispose();
});
