import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { isSeamVeil, seamVeilMaterial, seamVeilRise, SEAM_VEIL } from '../src/rendering/seamVeil';
import { timeUniform } from '../src/rendering/look';

test('only the four region gate veils are restyled', () => {
  for (const name of ['Seam_west_Gate', 'Seam_north_Gate', 'Seam_east_Gate', 'Seam_south_Gate']) assert.equal(isSeamVeil(name), true, name);
  for (const name of ['Seams', 'Ice_Gate', 'Sun_Core_Beam', 'Lighthouse_Beam', 'COL_Seam_south_Gate', 'Seam_south_Veil']) assert.equal(isSeamVeil(name), false, name);
});

test('the curtain is brightest at the ground and gone before the top', () => {
  assert.equal(seamVeilRise(0), 1); assert.equal(seamVeilRise(1), 0); assert.equal(seamVeilRise(2), 0);
  assert.ok(seamVeilRise(.5) < .2, 'half way up it is already faint: no flat 80 m wall');
  assert.ok(seamVeilRise(.1) > seamVeilRise(.3));
});

test('material: additive, never writes depth, measured from the mesh\'s own base and height', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(25, 80, 34)); mesh.position.set(-322, 34, -30);
  const m = seamVeilMaterial(mesh);
  assert.equal(m.blending, THREE.AdditiveBlending); assert.equal(m.depthWrite, false); assert.equal(m.transparent, true); assert.equal(m.fog, false);
  assert.ok(Math.abs(m.uniforms.uBase.value - 3.6) < 1e-6, 'starts near the ground, not at the sunk box floor'); assert.equal(m.uniforms.uHeight.value, SEAM_VEIL.reach, 'faded out far below the 80 m box top'); assert.equal(m.uniforms.uTime, timeUniform);
  assert.equal(m.vertexColors, false, 'no colour attribute: falls back to a pale tint');
  for (const need of ['facing', 'near', 'bands', 'streak', 'pow(1.0 - t']) assert.ok(m.fragmentShader.includes(need), need);
  assert.ok(SEAM_VEIL.opacity < .5);
  m.dispose(); mesh.geometry.dispose();
});

test('foliage is inked in leaf green, everything else keeps the default ink', async () => {
  const { outlineColorFor, OUTLINE_INK, addOutline } = await import('../src/rendering/look');
  for (const name of ['Trees_Leaves', 'Leaves', 'Bushes', 'Trees', 'Kyoto_Foliage']) assert.equal(outlineColorFor(name), OUTLINE_INK.foliage, name);
  for (const name of ['Trees_Trunks', 'Rocks', 'Houses', 'Terrain', 'Seams']) assert.equal(outlineColorFor(name), OUTLINE_INK.default, name);
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 6)); mesh.name = 'Trees_Leaves';
  addOutline(mesh, undefined, outlineColorFor(mesh.name));
  const hull = mesh.children[0] as THREE.Mesh, ink = hull.material as THREE.MeshBasicMaterial;
  assert.equal(`#${ink.color.getHexString()}`, OUTLINE_INK.foliage); assert.equal(ink.side, THREE.BackSide); assert.equal(ink.polygonOffset, true, 'still pushed behind the model');
  const g = new THREE.Color(OUTLINE_INK.foliage); assert.ok(g.g > g.r && g.g > g.b, 'a green, and darker than any leaf');
  mesh.geometry.dispose();
});
