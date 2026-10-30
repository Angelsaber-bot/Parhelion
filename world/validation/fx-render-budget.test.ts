import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { MeshBVH } from 'three-mesh-bvh';
import { makeSunShafts, makeGrassField } from '../src/fx.ts';
import { WorldGrid } from '../src/grid.ts';

test('sun shafts bypass the fullscreen pass only where the existing shader was an exact copy', () => {
  const camera = new THREE.PerspectiveCamera(65, 1.5, .1, 2000);
  camera.position.set(2, 4, 6); camera.lookAt(2, 4, 5); camera.updateMatrixWorld(true);
  const shafts = makeSunShafts();
  const sun = new THREE.Vector3();
  for (let facing = -1; facing <= 1; facing += .01) {
    sun.set(Math.sqrt(Math.max(0, 1 - facing * facing)), 0, -facing);
    shafts.update(camera, sun);
    const expected = THREE.MathUtils.smoothstep(facing, .1, .6) * 1.1;
    assert.ok(Math.abs(shafts.pass.uniforms.strength.value - expected) < 1e-12);
    assert.equal(shafts.pass.enabled, expected > .001);
    assert.equal(shafts.pass.uniforms.aspect.value, 1.5);
  }
  shafts.pass.dispose();
});
test('sun shaft update reuses its camera-direction scratch vector', () => {
  const camera = new THREE.PerspectiveCamera();
  const original = camera.getWorldDirection.bind(camera); let target: THREE.Vector3 | undefined;
  camera.getWorldDirection = vector => { if (target) assert.equal(vector, target); target = vector; return original(vector); };
  const shafts = makeSunShafts();
  for (let i = 0; i < 100; i++) shafts.update(camera, new THREE.Vector3(0, 0, -1));
  shafts.pass.dispose();
});
test('grass retains blade density, silhouette, colours and seeded randomness while rejecting invisible vertices before height/wind work', () => {
  const grid = new WorldGrid([], -2, -2, 4, 2);
  grid.h.fill(4); for (let i = 0; i < grid.nx * grid.nz; i++) grid.col.set([.2, .5, .15], i * 3);
  const bvh = { raycastFirst: () => null } as unknown as MeshBVH;
  const grass = makeGrassField(grid, bvh, 0, { count: 80000, size: 68 });
  const geometry = grass.mesh.geometry as THREE.InstancedBufferGeometry;
  const material = grass.mesh.material as THREE.ShaderMaterial;
  assert.equal(geometry.instanceCount, 80000);
  assert.equal(geometry.getAttribute('position').count, 5);
  assert.equal(geometry.index?.count, 9);
  assert.equal(material.side, THREE.DoubleSide); assert.equal(material.fog, true);
  assert.equal(material.uniforms.uSize.value, 68);
  const shader = material.vertexShader;
  const rejection = shader.indexOf('if (keep < 0.5)');
  assert.ok(rejection > shader.indexOf('float keep = step(aRand.w, cm.a * fade)'));
  assert.ok(rejection < shader.indexOf('float h = texture2D(tH, tuv).r'));
  assert.ok(rejection < shader.indexOf('float gust = sin('));
  // step produces only 0/1: previously invisible blades collapsed to a point;
  // kept blades used multiplier 1, so the retained transform is identical.
  for (const mask of [0, .2, .5, 1]) for (const fade of [0, .1, .5, 1]) for (const random of [.01, .2, .5, .99]) {
    const keep = random <= mask * fade ? 1 : 0;
    const scale = THREE.MathUtils.lerp(.55, 1.25, .37);
    if (keep >= .5) assert.equal(scale * keep, scale);
    else assert.equal(scale * keep, 0);
  }
  const eye = new THREE.Vector3(45, 9, 130); grass.update(eye);
  assert.deepEqual(material.uniforms.uCam.value, eye);
  geometry.dispose(); material.dispose();
  material.uniforms.tH.value.dispose(); material.uniforms.tC.value.dispose();
});
