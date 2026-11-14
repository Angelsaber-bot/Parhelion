import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { planBorderStitch, BORDER_STITCH } from '../src/map/regionBorderStitch';

/** A flat strip of terrain on a 2 m grid from x0 to x1 (z 0..40) at height `y(x, z)`. */
function tile(x0: number, x1: number, y: (x: number, z: number) => number, center: [number, number]) {
  const pts: number[] = [];
  for (let x = x0; x <= x1; x += 2) for (let z = 0; z <= 40; z += 2) pts.push(x, y(x, z), z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const terrain = new THREE.Mesh(g); terrain.updateMatrixWorld();
  return { terrain, center };
}
const extent = { x0: -60, z0: 0, span: 120, spanZ: 40 };
const id = (x: number, z: number) => [x, z] as const;

test('two tiles whose edges disagree meet on one line; the correction is gone by the edge of the band', () => {
  // West tile sits at 4 m, east tile at 12 m between z = 10 and 30: an 8 m cliff on x = 0.
  const west = tile(-60, 0, () => 4, [-30, 20]), east = tile(0, 60, (_x, z) => z >= 10 && z <= 30 ? 12 : 4, [30, 20]);
  const s = planBorderStitch([west, east], { xs: [0], zs: [] }, extent);
  assert.equal(s.worst, 8); assert.ok(s.samples >= 10);
  const moved = s.apply(west.terrain.geometry, id, west.center) + s.apply(east.terrain.geometry, id, east.center);
  assert.ok(moved > 0);
  const edge = (t: typeof west, z: number) => { const p = t.terrain.geometry.getAttribute('position'); for (let k = 0; k < p.count; k++) if (p.getX(k) === 0 && p.getZ(k) === z) return p.getY(k); throw new Error('no edge vertex'); };
  for (let z = 0; z <= 40; z += 2) assert.ok(Math.abs(edge(west, z) - edge(east, z)) < 1e-5, `edges meet at z=${z}`);
  assert.ok(Math.abs(edge(west, 20) - 8) < .01, 'half way between the two original heights in the middle of the run');
  // Fades out: a point a full band away keeps its authored height, nearer points move less and less.
  assert.equal(s.offsetAt(-BORDER_STITCH.band, 20, west.center), 0); assert.equal(s.offsetAt(-40, 20, west.center), 0);
  const near = s.offsetAt(-4, 20, west.center), mid = s.offsetAt(-12, 20, west.center);
  assert.ok(near > mid && mid > 0 && near < 4);
  assert.ok(s.offsetAt(4, 20, east.center) < 0, 'the high side comes down');
  // Slope added by the stitch stays walkable.
  let steepest = 0; for (let x = -24; x < 0; x += 2) steepest = Math.max(steepest, Math.abs(s.offsetAt(x + 2, 20, west.center) - s.offsetAt(x, 20, west.center)) / 2);
  assert.ok(steepest < .4, `added grade ${steepest}`);
});

test('matching edges are left exactly alone, and a prop in the band rides with the ground under it', () => {
  const west = tile(-60, 0, x => 5 + x * .01, [-30, 20]), east = tile(0, 60, x => 5 + x * .01, [30, 20]);
  const flat = planBorderStitch([west, east], { xs: [0], zs: [] }, extent);
  assert.equal(flat.samples, 0); assert.equal(flat.apply(west.terrain.geometry, id, west.center), 0);
  const a = tile(-60, 0, () => 0, [-30, 20]), b = tile(0, 60, () => 6, [30, 20]), s = planBorderStitch([a, b], { xs: [0], zs: [] }, extent);
  const prop = new THREE.BufferGeometry(); prop.setAttribute('position', new THREE.Float32BufferAttribute([-6, 0, 20, -6, 3, 20, -50, 0, 20], 3)); prop.computeBoundingBox();
  assert.equal(s.apply(prop, id, a.center), 2, 'only the vertices inside the band');
  const p = prop.getAttribute('position'), lift = s.offsetAt(-6, 20, a.center);
  assert.ok(lift > 0 && Math.abs(p.getY(0) - lift) < 1e-5 && Math.abs(p.getY(1) - 3 - lift) < 1e-5, 'base and top move together');
  assert.equal(p.getY(2), 0); assert.ok(prop.boundingBox && Math.abs(prop.boundingBox.max.y - 3 - lift) < 1e-5, 'bounds are refreshed in place, never left null for a culler');
  assert.equal(prop.boundingSphere, null, 'a bound that was never computed is not invented');
});

test('borders along z work the same way, and a point on the line takes its own tile\'s side', () => {
  const pts = (z0: number, z1: number, y: number) => { const a: number[] = []; for (let z = z0; z <= z1; z += 2) for (let x = -60; x <= 60; x += 2) a.push(x, y, z); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); const m = new THREE.Mesh(g); m.updateMatrixWorld(); return m; };
  const south = { terrain: pts(0, 20, 2), center: [0, 30] as [number, number] }, north = { terrain: pts(-20, 0, 10), center: [0, -30] as [number, number] };
  const s = planBorderStitch([south, north], { xs: [], zs: [0] }, { x0: -60, z0: -20, span: 120, spanZ: 40 });
  assert.equal(s.worst, 8);
  assert.ok(Math.abs(s.offsetAt(10, 0, south.center) - 4) < 1e-5); assert.ok(Math.abs(s.offsetAt(10, 0, north.center) + 4) < 1e-5);
});
