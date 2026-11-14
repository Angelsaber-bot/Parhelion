import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { makeGrassField, GRASS_BLADE } from '../src/rendering/fx';
import { cloudShadowUniform, timeUniform } from '../src/rendering/look';

function field(count = 4) {
  const built = new MeshBVH(new THREE.BoxGeometry(1, .1, 1).translate(50, 50, 50));
  const height = new THREE.DataTexture(new Float32Array(9).fill(2), 3, 3, THREE.RedFormat, THREE.FloatType);
  const grid = { nx: 3, nz: 3, x0: 0, z0: 0, cell: 2, span: 4, spanZ: 4, h: new Float32Array(9).fill(2), ny: new Float32Array(9).fill(1), col: new Float32Array(Array.from({ length: 9 }, () => [.3, .7, .2]).flat()), heightTexture: () => height };
  const f = makeGrassField(grid as never, built, 0, { count, size: 8 });
  return { f, mat: f.mesh.material as THREE.ShaderMaterial, dispose() { f.mesh.geometry.dispose(); (f.mesh.material as THREE.ShaderMaterial).uniforms.tC.value.dispose(); (f.mesh.material as THREE.ShaderMaterial).dispose(); height.dispose(); built.geometry.dispose(); } };
}

test('a blade is three tapering segments to a point: seven vertices, five triangles, one draw for the field', () => {
  const { f, dispose } = field(4);
  const g = f.mesh.geometry as THREE.InstancedBufferGeometry, pos = g.getAttribute('position');
  assert.equal(pos.count, 7); assert.equal(g.index!.count, 15); assert.equal(g.instanceCount, 4);
  assert.equal(pos.getY(6), 1, 'unit height: the shader sets the length'); assert.equal(pos.getX(6), 0, 'a point at the tip');
  assert.ok(Math.abs(pos.getX(0)) > Math.abs(pos.getX(2)) && Math.abs(pos.getX(2)) > Math.abs(pos.getX(4)), 'tapers');
  assert.ok(GRASS_BLADE.halfWidths[0] * 2 <= .1 && GRASS_BLADE.length <= .7, 'slender blades about knee high, not spikes');
  assert.equal(f.mesh.name, 'GrassField'); assert.equal(f.mesh.frustumCulled, false);
  dispose();
});

test('the field shares the world clock and cloud shadows, and bends, clumps, sheens and parts', () => {
  const { mat, dispose } = field();
  assert.equal(mat.uniforms.uTime, timeUniform); assert.equal(mat.uniforms.uCloud, cloudShadowUniform, 'dims with the land under it');
  const v = mat.vertexShader, fr = mat.fragmentShader;
  for (const need of ['patchTall', 'patchDry', 'seed', 'bend * t2', 'gust', 'uPlayer', '#include <fog_vertex>']) assert.ok(v.includes(need), need);
  for (const need of ['Wind sheen', 'vCloud', 'vLook.z', '#include <fog_fragment>']) assert.ok(fr.includes(need), need);
  assert.ok(!fr.includes('fbm(') && !fr.includes('vnoise('), 'no noise per pixel: the cloud shadow is taken once per blade in the vertex stage');
  assert.ok(v.includes('vCloud = smoothstep(0.5, 0.68, fbm(') && v.indexOf('float fbm') < v.indexOf('vCloud ='), 'same cloud field as the land, declared before use');
  assert.ok(!/patch(Tall|Dry) = vnoise/.test(v), 'patches use cheap sine fields');
  assert.equal(mat.fog, true); assert.equal(mat.side, THREE.DoubleSide);
  dispose();
});

test('update follows the camera; the player parts the grass only when on foot', () => {
  const { f, mat, dispose } = field();
  f.update(new THREE.Vector3(3, 9, 4), new THREE.Vector3(5, 2, 6));
  assert.deepEqual((mat.uniforms.uCam.value as THREE.Vector3).toArray(), [3, 9, 4]);
  assert.deepEqual((mat.uniforms.uPlayer.value as THREE.Vector3).toArray(), [5, 2, 6]);
  f.update(new THREE.Vector3(3, 9, 4));
  assert.ok((mat.uniforms.uPlayer.value as THREE.Vector3).y < -1000, 'gliding or flying overhead leaves the grass alone');
  assert.ok(GRASS_BLADE.pushOuter > GRASS_BLADE.pushInner && GRASS_BLADE.pushOuter <= 2);
  dispose();
});

test('snow glitter: small round grains on cool white terrain only, close by and on the lit side', async () => {
  const { toonMaterial, SNOW_GLITTER } = await import('../src/rendering/look');
  const terrain = toonMaterial(new THREE.MeshStandardMaterial({ name: 'M_Terrain' })), wall = toonMaterial(new THREE.MeshStandardMaterial({ name: 'M_Toon' }));
  const compile = (m: THREE.Material) => { const sh = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <project_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <opaque_fragment>' }; m.onBeforeCompile(sh as never, {} as never); return sh.fragmentShader; };
  const t = compile(terrain), w = compile(wall);
  assert.ok(t.includes('Snow glitter') && !w.includes('Snow glitter'), 'terrain only');
  for (const need of ['step(base.r * 0.97, base.b)', '(1.0 - sh)', 'length(fract(grain) - 0.5)', 'length(vViewPosition)']) assert.ok(t.includes(need), need);
  assert.ok(1 / SNOW_GLITTER.cellsPerMetre < .05, 'grains of a few centimetres, not floor tiles');
  assert.ok(SNOW_GLITTER.far <= 20 && SNOW_GLITTER.share < .05, 'sparse and near: no shimmering noise at range');
  terrain.dispose(); wall.dispose();
});
