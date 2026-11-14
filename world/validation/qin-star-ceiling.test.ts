import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createQinStarCeiling, STAR_CEILING } from '../src/environment/qinStarCeiling';

test('the star-official dome carries a twinkling sky, constellation lines and the 28 mansions', () => {
  const c = createQinStarCeiling([0, 39, 0], [26, 36]);
  const stars = c.root.children.find(o => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
  assert.equal(stars.count, STAR_CEILING.stars);
  const lines = c.root.children.find(o => (o as THREE.LineSegments).isLineSegments) as THREE.LineSegments;
  assert.ok(lines.geometry.getAttribute('position').count >= STAR_CEILING.constellations * 6, 'constellations are joined');
  const m = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
  stars.getMatrixAt(3, m); m.decompose(p, q, s); const before = s.x;
  c.update(.7, new THREE.Vector3(0, 30, 0)); stars.getMatrixAt(3, m); m.decompose(p, q, s);
  assert.notEqual(s.x, before, 'stars twinkle');
  // Everything hangs below the roof plane (local y ≤ 0) and inside the panel.
  c.root.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(c.root);
  assert.ok(box.max.y <= 39 + 1e-6 && box.max.x <= 14 && box.max.z <= 19.5);
  c.update(.1, new THREE.Vector3(500, 0, 500)); assert.equal(c.root.visible, false);
  c.dispose();
});
