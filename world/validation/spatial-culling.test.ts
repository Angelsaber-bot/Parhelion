import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DistanceCuller } from '../src/chunk.ts';

function fixture(count = 900) {
  const culler = new DistanceCuller(160);
  const geometry = new THREE.BoxGeometry(8, 12, 10), material = new THREE.MeshBasicMaterial();
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(((i * 137) % 2160) - 1080, (i * 17) % 180, ((i * 269) % 2160) - 1080);
    mesh.scale.set(1 + i % 3, 1, 1 + i % 5);
    if (i % 3 !== 0) { const outline = new THREE.Object3D(); outline.name = 'art__outline'; mesh.add(outline); }
    culler.add(mesh, i % 4 === 0 ? 1e9 : 180 + (i % 6) * 90);
  }
  return culler;
}
function assertEquivalent(culler: DistanceCuller, eye: THREE.Vector3, scale: number) {
  culler.update(eye, scale);
  for (const item of culler.items) {
    const d2 = item.c.distanceToSquared(eye);
    assert.equal(item.mesh.visible, d2 < (item.max * scale + item.r) ** 2, `mesh ${item.mesh.id}`);
    if (item.outline) assert.equal(item.outline.visible, d2 < (culler.outlineDist * scale + item.r) ** 2, `outline ${item.mesh.id}`);
  }
}
test('spatial culler exactly matches linear culling during travel, flight, teleport and quality changes', () => {
  const culler = fixture(); const eye = new THREE.Vector3();
  for (let i = 0; i < 180; i++) {
    eye.set(Math.sin(i * .19) * 1400, (i % 11) * 75, Math.cos(i * .31) * 1400);
    assertEquivalent(culler, eye, i % 5 === 0 ? .7 : 1);
  }
  for (const scale of [0, .5, 2]) assertEquivalent(culler, eye.set(0, 4000, 0), scale);
});
test('adding a chunk and changing outline range invalidates the broad phase', () => {
  const culler = fixture(40); const eye = new THREE.Vector3(0, 30, 0);
  assertEquivalent(culler, eye, 1);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  mesh.position.copy(eye); culler.add(mesh, 40);
  assertEquivalent(culler, eye, 1); assert.equal(mesh.visible, true);
  culler.outlineDist = 900; assertEquivalent(culler, eye, 1);
  culler.outlineDist = 0; assertEquivalent(culler, eye, 1);
});
test('unchanged distant subtrees do not rewrite mesh or outline visibility', () => {
  const culler = fixture(); const eye = new THREE.Vector3(100000, 200, 100000);
  culler.update(eye); let writes = 0;
  for (const item of culler.items) for (const object of [item.mesh, item.outline]) {
    if (!object) continue; let visible = object.visible;
    Object.defineProperty(object, 'visible', { get: () => visible, set: v => { writes++; visible = v; }, configurable: true });
  }
  culler.update(eye); assert.equal(writes, 0);
});
test('exact threshold remains excluded, including a zero-radius point', () => {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()); const culler = new DistanceCuller(); culler.add(mesh, 20);
  assertEquivalent(culler, new THREE.Vector3(20, 0, 0), 1); assert.equal(mesh.visible, false);
  assertEquivalent(culler, new THREE.Vector3(19.999, 0, 0), 1); assert.equal(mesh.visible, true);
});
