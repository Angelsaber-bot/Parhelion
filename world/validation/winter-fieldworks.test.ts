import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { Batch, T } from '../tools/gen/geo.js';
import { resetFieldworkSurfaces, fieldworkSurfacePieces, fieldTent, buildCrossingTimber, imperialPavilion, decorateFieldworks, fieldFrozenSoldier } from '../tools/gen/winter/fieldworks.js';
import { ICE_Y } from '../tools/gen/winter/layout.js';
const flat = () => 6;
test('soldier cloth keeps the original tent ridge orientation and upper silhouette', () => {
  resetFieldworkSurfaces();
  const b = new Batch('tent'); fieldTent(b, 0, 0, 0, 3.2, 4.2, '#e8e0cc', () => 0);
  const original = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI / 2);
  original.applyMatrix4(T(0, 0.8, 0, 0, 1.6, 4.2, 1.6, 0, Math.PI / 2)); original.computeBoundingBox();
  const clothGeo = fieldworkSurfacePieces().find(p => p.material === 'M_WinterCanvas')!.batch.vis[0];
  clothGeo.computeBoundingBox(); const cloth = clothGeo.boundingBox!, old = original.boundingBox!;
  assert.ok(Math.abs(cloth.max.y - old.max.y) < 0.02);
  assert.ok(cloth.min.x >= old.min.x - 0.02 && cloth.max.x <= old.max.x + 0.02);
  assert.ok(cloth.min.z >= old.min.z - 0.02 && cloth.max.z <= old.max.z + 0.02);
});
test('broken trestle remains visibly broken across the original missing spans', () => {
  resetFieldworkSurfaces();
  const b = new Batch('bridges'); buildCrossingTimber(b, flat);
  for (const geo of [b, ...fieldworkSurfacePieces().map(p => p.batch)].flatMap(b => b.vis)) {
    geo.computeBoundingBox(); const box = geo.boundingBox!;
    if (box.min.z > 230.2 || box.max.z < 225.8 || box.max.y < ICE_Y + 0.8) continue;
    assert.ok(box.max.x <= -5.99 || box.min.x >= 1.99, 'no new decking/brace may silently fill the broken bridge');
  }
});
test('imperial entrance remains visibly clear for the unchanged walk-in quest route', () => {
  resetFieldworkSurfaces();
  const b = new Batch('pavilion'); imperialPavilion(b, -176, 6, 132, 12, 9);
  const opening = new THREE.Box3(new THREE.Vector3(-177.7, 6.1, 136.3), new THREE.Vector3(-174.3, 9.7, 136.7));
  for (const geo of [b, ...fieldworkSurfacePieces().map(p => p.batch)].flatMap(b => b.vis)) { geo.computeBoundingBox(); assert.equal(geo.boundingBox!.intersectsBox(opening), false, 'no canvas, ropes or props across entrance'); }
});
test('additive rest stations do not introduce quest markers, heat, emissions or collision', () => {
  for (const piece of decorateFieldworks(flat)) {
    assert.equal(piece.batch.col.length, 0);
    assert.notEqual(piece.material, 'M_Emissive');
    assert.equal(piece.userData, undefined);
  }
});

test('frozen marcher poses contain genuinely different geometry, not just recoloring', () => {
  const shapes = new Set<string>();
  for (let variant = 0; variant < 3; variant++) {
    const b = new Batch('marcher'); fieldFrozenSoldier(b, 0, 0, 0, variant);
    assert.equal(b.col.length, 0); assert.ok(b.vis.length >= 20);
    const hash = createHash('sha256');
    for (const geo of b.vis) {
      const pos = geo.getAttribute('position');
      assert.ok([...pos.array].every(Number.isFinite)); hash.update(Buffer.from(pos.array.buffer));
    }
    shapes.add(hash.digest('hex'));
  }
  assert.equal(shapes.size, 3);
});
