/** Independent exported-art/collision alignment, not generator-helper equality. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/glb';

const bytes = readFileSync(new URL('../public/assets/world_alpha.glb', import.meta.url));
const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
bakeQuantized(gltf.scene); gltf.scene.updateMatrixWorld(true);
// Independently verified original visible pylon-pair centres, not imported from the new generator.
const pillars = [
  { id: 'west', center: [-310, -30], inward: [1, 0] },
  { id: 'east', center: [318, 30], inward: [-1, 0] },
  { id: 'north', center: [0, -318], inward: [0, 1] },
  { id: 'south', center: [40, 318], inward: [0, -1] },
];

for (const { id, center, inward } of pillars) test(`${id} actual visible field and collision meet at original pylon plane, not old remote airwall`, () => {
  function worldGeometry(name: string) {
    const mesh = gltf.scene.getObjectByName(name) as THREE.Mesh;
    assert.ok(mesh?.isMesh, `actual exported ${name}`);
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    return { mesh, geometry, bvh: new MeshBVH(geometry) };
  }
  const art = worldGeometry(`Seam_${id}_Gate`), collision = worldGeometry(`COL_Seam_${id}_Gate`);
  const box = new THREE.Box3().setFromBufferAttribute(collision.geometry.getAttribute('position') as THREE.BufferAttribute);
  const base = box.min.y + 10;
  const [ix, iz] = inward, [cx, cz] = center, tx = iz, tz = -ix;
  assert.deepEqual(collision.mesh.userData.opensWhen, ['summon_circle']);
  assert.equal(collision.mesh.userData.dynamic, true);
  assert.equal(collision.geometry.index!.count / 3, 60, 'only centre plus two matched returns; no retained remote fourth panel');
  for (const offset of [-8, -4, 0, 4, 8]) for (const height of [1.6, 8, 20]) {
    const start = new THREE.Vector3(cx + ix * 3 + tx * offset, base + height, cz + iz * 3 + tz * offset);
    const ray = new THREE.Ray(start, new THREE.Vector3(-ix, 0, -iz));
    const a = art.bvh.raycastFirst(ray, THREE.DoubleSide), c = collision.bvh.raycastFirst(ray, THREE.DoubleSide);
    assert.ok(a && c, `${offset}/${height}: visible and blocking surfaces present`);
    assert.ok(Math.abs(c.distance - 2.7) < .015, `${offset}/${height}: contact ${c.distance}m, expected 3m minus .3m panel half-thickness`);
    assert.ok(Math.abs(a.distance - c.distance) < .015, `${offset}/${height}: invisible offset ${a.distance - c.distance}m`);
  }
  art.geometry.dispose(); collision.geometry.dispose();
});
