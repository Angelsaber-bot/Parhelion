import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { POND } from '../tools/gen/kyoto/layout.ts';

// Exercise exported geometry, including compression/quantization, rather than source strings.
const bytes = readFileSync(new URL('../public/assets/world_kyoto.glb', import.meta.url));
const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
bakeQuantized(gltf.scene);
gltf.scene.updateMatrixWorld(true);
function geometry(name: string) {
  const mesh = gltf.scene.getObjectByName(name) as THREE.Mesh;
  assert.ok(mesh?.isMesh, `exported ${name}`);
  return mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
}
const terrain = new MeshBVH(geometry('Terrain'));
const pavilion = geometry('Kinkaku');
const gold = geometry('Kinkaku_Gold');
const goldBVH = new MeshBVH(gold);
const hall = new MeshBVH(geometry('Higashiyama'));
const down = new THREE.Vector3(0, -1, 0);

test('Kyoto exported Kinkaku hillside bamboo posts meet the terrain, not a floating balcony', () => {
  const p = pavilion.attributes.position;
  const x = -202, startZ = -229.5, endZ = POND.c[1] - POND.rz * .92 + 4;
  const n = Math.ceil(Math.abs(endZ - startZ) / 1.5);
  for (let k = 0; k <= n; k++) {
    const z = startZ + (endZ - startZ) * k / n;
    let base = Infinity;
    for (let i = 0; i < p.count; i++) {
      if (Math.hypot(p.getX(i) - x, p.getZ(i) - z) < .075) base = Math.min(base, p.getY(i));
    }
    assert.ok(Number.isFinite(base), `fence post ${k} exists`);
    const ground = terrain.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), down), THREE.DoubleSide);
    assert.ok(ground, `terrain below post ${k}`);
    assert.ok(Math.abs(base - ground.point.y) < .03, `post ${k} meets exported terrain within 3cm; gap ${base - ground.point.y}m`);
  }
});

test('Kyoto exported Kinkaku balcony is connected on all four sides and has no remote gold rails', () => {
  const p = gold.attributes.position;
  let count = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 6.5 || p.getY(i) > 7.9) continue;
    count++;
    assert.ok(Math.abs(p.getX(i) + 215) < 7.8, 'gold lower gallery stays within actual east/west deck extent');
    assert.ok(Math.abs(p.getZ(i) + 218) < 6.3, 'gold lower gallery stays within actual north/south deck extent');
  }
  assert.ok(count > 100, 'lower gallery has actual exported detail');
  // Between posts, each narrow deck connects the facade to its outer rail.
  for (const [dx, dz] of [[7.3, .47], [-7.3, .47], [.47, 5.8], [.47, -5.8]]) {
    const hit = goldBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(-215 + dx, 6.9, -218 + dz), down), THREE.DoubleSide);
    assert.ok(hit && Math.abs(hit.point.y - 6.86) < .025, `supported gallery deck on side ${dx},${dz}; hit ${hit?.point.y}`);
  }
});

test('Kyoto exported Kiyomizu upper gables have opaque infill under both curved roof ends', () => {
  for (const side of [-1, 1]) for (const dz of [-6, -3, 0, 3, 6]) {
    const t = Math.abs(dz) / 7.75;
    const y = 44 + 4.2 * Math.pow(1 - t, 1.45) + .3 * Math.pow(t, 8) - .5;
    const origin = new THREE.Vector3(298 + side * 18, y, 50 + dz);
    const hit = hall.raycastFirst(new THREE.Ray(origin, new THREE.Vector3(-side, 0, 0)), THREE.DoubleSide);
    assert.ok(hit, `solid upper gable at side ${side}, z offset ${dz}, not sky through open truss`);
    assert.ok(Math.abs(hit.point.x - (298 + side * 9.55)) < .15, `hit actual upper gable face, not opposite wall: ${hit.point.x}`);
  }
});
