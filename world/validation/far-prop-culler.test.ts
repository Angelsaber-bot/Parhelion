import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { FarPropCuller, FAR_PROP_LAYER, farPropDistance } from '../src/rendering/farPropCuller.ts';

const prop = (x: number, radius: number) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius), new THREE.MeshBasicMaterial());
  mesh.position.x = x; mesh.updateMatrixWorld(true); return mesh;
};

test('small props stop drawing far away, landmarks stay, and visibility is never touched', () => {
  const root = new THREE.Group(), small = prop(300, 2), landmark = prop(300, 30), near = prop(40, 2);
  small.visible = false; // game logic owns visibility; the culler must not flip it
  root.add(small, landmark, near);
  const culler = new FarPropCuller(); culler.add(root);
  assert.equal(culler.items.length, 3);
  const camera = new THREE.PerspectiveCamera();
  culler.update(new THREE.Vector3(), 1, 1);
  assert.equal(small.layers.test(camera.layers), false, 'a 2 m prop 298 m away is culled');
  assert.equal(landmark.layers.test(camera.layers), true, 'a 30 m landmark is kept');
  assert.equal(near.layers.test(camera.layers), true);
  assert.equal(small.visible, false, 'visibility untouched');
  assert.ok(small.layers.isEnabled(FAR_PROP_LAYER));
  culler.update(new THREE.Vector3(290, 0, 0), 1, 1);
  assert.equal(small.layers.test(camera.layers), true, 'walking up brings it back');
  assert.ok(farPropDistance(2) < farPropDistance(30));
});

test('work is spread over slices and detached props leave the list', () => {
  const root = new THREE.Group(); const props = Array.from({ length: 16 }, (_, i) => prop(400 + i, 1)); root.add(...props);
  const culler = new FarPropCuller(); culler.add(root);
  const camera = new THREE.PerspectiveCamera();
  culler.update(new THREE.Vector3(), 1, 8);
  assert.equal(props.filter(p => !p.layers.test(camera.layers)).length, 2, 'one slice of 16/8');
  root.remove(props[5]);
  for (let i = 0; i < 10; i++) culler.update(new THREE.Vector3(), 1, 8);
  assert.equal(culler.items.length, 15);
  culler.reset(); assert.ok(props.every(p => p.layers.test(camera.layers)));
});

test('instanced props are culled by where their instances are, not where the template sits', async () => {
  const THREE = await import('three');
  const { FarPropCuller, FAR_PROP_LAYER } = await import('../src/rendering/farPropCuller');
  const flock = new THREE.InstancedMesh(new THREE.SphereGeometry(.2), new THREE.MeshBasicMaterial(), 3);
  const m = new THREE.Matrix4(); for (let i = 0; i < 3; i++) flock.setMatrixAt(i, m.makeTranslation(900 + i, 5, 900));
  const root = new THREE.Group(); root.add(flock); root.updateMatrixWorld(true);
  const culler = new FarPropCuller(); culler.add(root);
  culler.update(new THREE.Vector3(905, 5, 905), 1, 1);
  assert.equal(flock.layers.mask, 1, 'a flock around the player stays drawn although its template is at the origin');
  culler.update(new THREE.Vector3(0, 5, 0), 1, 1);
  assert.equal(flock.layers.isEnabled(FAR_PROP_LAYER), true, 'and is culled once the player is far from the instances');
});
