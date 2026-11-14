import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraClearance, blocksView } from '../src/companions/cameraClearance';

test('a companion against the lens or in the sight line leaves the shot; one beside or beyond the player stays', () => {
  const eye = new THREE.Vector3(0, 2, 4), focus = new THREE.Vector3(0, 1.5, 0);
  assert.equal(blocksView({ x: .3, y: 2, z: 3.4 }, eye, focus), true, 'against the lens');
  assert.equal(blocksView({ x: .2, y: 1.7, z: 2 }, eye, focus), true, 'in the sight line');
  assert.equal(blocksView({ x: 1.6, y: 1.7, z: 1 }, eye, focus), false, 'beside the player');
  assert.equal(blocksView({ x: 0, y: 1.5, z: -2 }, eye, focus), false, 'beyond the player');
  assert.equal(blocksView({ x: 0, y: 1.55, z: .2 }, eye, focus), false, 'right at the player is not in front of them');
});

test('clearance only changes render layers and restores them, leaving visibility to its owner', () => {
  const root = new THREE.Group(), mesh = new THREE.Mesh(); root.add(mesh); mesh.layers.enable(3);
  const before = mesh.layers.mask, c = new CameraClearance();
  root.position.set(0, .7, 2.2);
  c.update([root], new THREE.Vector3(0, 2, 4), new THREE.Vector3(0, 1.5, 0), true);
  assert.equal(c.isCleared(root), true); assert.equal(mesh.layers.mask, 0); assert.equal(root.visible, true);
  root.position.set(3, 0, 0);
  c.update([root], new THREE.Vector3(0, 2, 4), new THREE.Vector3(0, 1.5, 0), true);
  assert.equal(c.isCleared(root), false); assert.equal(mesh.layers.mask, before);
  root.position.set(0, .7, 2.2);
  c.update([root], new THREE.Vector3(0, 2, 4), new THREE.Vector3(0, 1.5, 0), false);
  assert.equal(c.isCleared(root), false, 'disabled outside third person');
  c.update([root], new THREE.Vector3(0, 2, 4), new THREE.Vector3(0, 1.5, 0), true); c.update([], new THREE.Vector3(), new THREE.Vector3(), true);
  assert.equal(mesh.layers.mask, before, 'a root that leaves the list is restored');
});
