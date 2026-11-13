import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import { components } from '../tools/reground-scatter-parts';

// Detached birch branches and segmented palm trunks are legitimate. A raised
// component must touch a lower trunk; a whole tree floating over terrain is not.
for (const region of ['alpha','britain','blacksail','winter','kyoto','orleans','egypt','qin','home']) {
  test(`${region}: substantial tree stems meet terrain or a lower connected trunk`, async () => {
    const bytes = readFileSync(new URL(`../public/assets/world_${region}.glb`, import.meta.url));
    const {scene} = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    bakeQuantized(scene); scene.updateMatrixWorld(true);
    const terrain = scene.getObjectByName('Terrain') as THREE.Mesh;
    const geometry = terrain.geometry.clone().applyMatrix4(terrain.matrixWorld), ground = new MeshBVH(geometry);
    let checked = 0;
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !/(Trees_Trunks|Trunks|Trees$)/.test(m.name)) return;
      const pos = m.geometry.attributes.position;
      const parts = components(m.geometry).map(vertices => {
        const box = new THREE.Box3();
        for (const i of vertices) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld));
        return box;
      });
      for (const box of parts) {
        const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
        if (size.y < 2.5 || size.x > 2 || size.z > 2) continue;
        checked++;
        const hit = ground.raycastFirst(new THREE.Ray(new THREE.Vector3(center.x,500,center.z),new THREE.Vector3(0,-1,0)),THREE.DoubleSide);
        assert.ok(hit,`${m.name}: terrain below ${center.toArray()}`);
        if (box.min.y <= hit.point.y + 1) continue;
        const joined = parts.some(other => other !== box && other.min.y < box.min.y-.3 && other.max.y >= box.min.y-.2 && other.clone().expandByScalar(.35).intersectsBox(box));
        assert.ok(joined,`${m.name}: unsupported stem at ${center.x},${box.min.y},${center.z}, ground ${hit.point.y}`);
      }
    });
    assert.ok(checked > 0,'actual exported stems were checked');
    geometry.dispose();
  });
}
