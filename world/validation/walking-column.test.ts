import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWalkingColumn, pathLength, pointAlong } from '../src/environment/walkingColumn';

test('a walking column follows its path in a loop, then gathers at the end', () => {
  const path = [[0, 0, 0], [10, 0, 0], [10, 0, 20]] as const;
  assert.equal(pathLength(path), 30);
  assert.deepEqual(pointAlong(path, 15).p, [10, 0, 5]); assert.ok(Math.abs(pointAlong(path, 15).yaw) < 1e-9, 'heading +Z on the second leg');
  assert.deepEqual(pointAlong(path, 99).p, [10, 0, 20], 'clamped at the end');
  const col = createWalkingColumn({ name: 'T', path, people: 6, spacing: 4, speed: 1, tunics: ['#fff', '#c90'] }, () => 0), near = new THREE.Vector3(5, 0, 5);
  col.apply('hidden'); assert.equal(col.root.visible, false);
  col.apply('walking'); col.update(.1, near);
  const [first] = col.root.children as THREE.InstancedMesh[], m = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3();
  first.getMatrixAt(0, m); a.setFromMatrixPosition(m); col.update(2, near); first.getMatrixAt(0, m); b.setFromMatrixPosition(m);
  assert.ok(a.distanceTo(b) > 1.5, 'walkers move along the path');
  col.apply('gathered'); col.update(.1, near); first.getMatrixAt(0, m); a.setFromMatrixPosition(m);
  assert.ok(Math.hypot(a.x - 10, a.z - 20) < 6, 'the crowd gathers at the end of the path');
  col.dispose();
});
