import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { regionBorders, blendGridBorders, applyBorderBlend, BORDER_BLEND } from '../src/map/regionBorderBlend';
import { REGIONS } from '../src/map/regions';

/** Two tiles side by side along x: green on the left of x = 0, white on the right. */
function twoTiles(nx = 81, nz = 5, cell = 2) {
  const N = nx * nz, h = new Float32Array(N).fill(3), col = new Float32Array(N * 3), x0 = -(nx - 1) * cell / 2;
  for (let q = 0; q < N; q++) { const x = x0 + (q % nx) * cell, left = x < 0; col[q * 3] = left ? .2 : 1; col[q * 3 + 1] = left ? .7 : 1; col[q * 3 + 2] = left ? .2 : 1; }
  return { nx, nz, x0, z0: 0, cell, h, col };
}

test('the world has four interior tile borders, halfway between neighbouring region centres', () => {
  const b = regionBorders(REGIONS);
  assert.deepEqual(b.xs, [-360, 360]); assert.deepEqual(b.zs, [-1080, -360]);
  assert.deepEqual(regionBorders([{ offset: [0, 0] }]), { xs: [], zs: [] }, 'one tile has no borders');
});

test('colours meet in the middle on the line and return to each tile\'s own palette by the edge of the band', () => {
  const g = twoTiles(), mask = blendGridBorders(g, { xs: [0], zs: [] }, 30);
  const red = (x: number) => g.col[(2 * g.nx + Math.round((x - g.x0) / g.cell)) * 3];
  assert.ok(Math.abs(red(0) - .6) < .06, `midpoint on the line: ${red(0)}`);
  assert.equal(red(-40), Math.fround(.2)); assert.equal(red(40), 1, 'outside the band nothing changes');
  for (let x = -30; x < 30; x += 2) assert.ok(red(x + 2) >= red(x) - 1e-6, 'monotonic ramp, no banding');
  let step = 0; for (let x = -32; x < 32; x += 2) step = Math.max(step, red(x + 2) - red(x));
  assert.ok(step < .12, `no straight-line jump left (was 0.8): largest step ${step}`);
  assert.equal(mask[2 * g.nx + Math.round((0 - g.x0) / g.cell)], 1); assert.equal(mask[2 * g.nx], 0);
});

test('cells no terrain reached are neither blended nor averaged in', () => {
  const g = twoTiles(), hole = 2 * g.nx + Math.round((4 - g.x0) / g.cell);
  g.h[hole] = -12; g.col[hole * 3] = 9;
  const mask = blendGridBorders(g, { xs: [0], zs: [] }, 30);
  assert.equal(mask[hole], 0); assert.equal(g.col[hole * 3], 9);
  assert.ok(g.col[(hole - 1) * 3] < 1.01, 'the sea-default colour never bleeds into the land beside it');
});

test('terrain vertices in the band take the blended colour; heights and far vertices are untouched', () => {
  const g = twoTiles(), mask = blendGridBorders(g, { xs: [0], zs: [] }, 30);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 5, 4, -60, 7, 4, 10, 6, 4], 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  const mesh = new THREE.Mesh(geo); mesh.updateMatrixWorld();
  assert.equal(applyBorderBlend([mesh], g, mask), 2);
  const c = geo.getAttribute('color');
  assert.ok(Math.abs(c.getX(0) - .6) < .06); assert.equal(c.getX(1), 0, 'outside the band keeps its painted colour');
  assert.ok(c.getX(2) > c.getX(0)); assert.equal(geo.getAttribute('position').getY(0), 5);
  assert.ok(BORDER_BLEND.band >= 20 && BORDER_BLEND.band <= 40);
});

test('ground under water is never averaged onto the shore (a dark lake bed must not stain the ice beside it)', () => {
  const g = twoTiles();
  // East of x = 6 the white tile drops under a lake and its bed is painted near black.
  for (let q = 0; q < g.nx * g.nz; q++) { const x = g.x0 + (q % g.nx) * g.cell; if (x >= 6) { g.h[q] = -2; g.col[q * 3] = g.col[q * 3 + 1] = g.col[q * 3 + 2] = .02; } }
  const mask = blendGridBorders(g, { xs: [0], zs: [] }, 30, 1);
  const q = (x: number) => 2 * g.nx + Math.round((x - g.x0) / g.cell);
  // A mix of the two land palettes (0.2 and 1), never pulled below them towards the 0.02 bed.
  for (const x of [-10, -2, 0, 2, 4]) assert.ok(g.col[q(x) * 3] >= .2 - 1e-6, `the shore keeps a land colour at x=${x}: ${g.col[q(x) * 3]}`);
  assert.equal(mask[q(20)], 0, 'the bed itself is not repainted'); assert.equal(g.col[q(20) * 3], Math.fround(.02));
});
