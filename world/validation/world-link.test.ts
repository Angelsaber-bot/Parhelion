import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { Player } from '../src/player.ts';
import { REGIONS, boundaryWalls, regionAt } from '../src/regions.ts';

// 幻日谷 and 星落海岸 load side by side; walking east through the mountain pass reaches the coast.
const geos: THREE.BufferGeometry[] = [boundaryWalls()];
for (const def of REGIONS) {
  const buf = readFileSync(new URL(`../public/assets/${def.file}.glb`, import.meta.url));
  const gltf = await regionLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  bakeQuantized(gltf.scene);
  gltf.scene.position.set(def.offset[0], 0, def.offset[1]);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.getObjectByName('COLLISION')!.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.dynamic) return;
    let g = new THREE.BufferGeometry().setAttribute('position', m.geometry.attributes.position.clone());
    if (m.geometry.index) g.setIndex(m.geometry.index.clone());
    g.applyMatrix4(m.matrixWorld);
    geos.push(g.index ? g.toNonIndexed() : g);
  });
}
const bvh = new MeshBVH(mergeGeometries(geos));
const ground = (x: number, z: number) => bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)!.point.y;

test('walking east through the pass crosses from 幻日谷 onto the lighthouse ridge', () => {
  const p = new Player([{ name: 'static', bvh, enabled: true }], 1);
  p.teleport(280, ground(280, 30) + 0.5, 30);
  const route: [number, number][] = [[320, 30], [360, 30], [400, 30], [436, 30]];
  let k = 0, minY = Infinity;
  for (let i = 0; i < 120 * 120 && k < route.length; i++) {
    const [x, z] = route[k];
    if (Math.hypot(p.pos.x - x, p.pos.z - z) < 1) { k++; continue; }
    p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z));
    p.step(1 / 120, { x: 0, z: 1, jump: false, sprint: true });
    if (p.pos.x > 320) minY = Math.min(minY, p.pos.y);
  }
  assert.equal(k, route.length, `walked the pass (stuck at ${p.pos.toArray().map(v => v.toFixed(1))})`);
  assert.equal(regionAt(p.pos.x).id, 'coast');
  assert.ok(!p.swimming && minY > 8, `stayed on the ridge (lowest y ${minY.toFixed(1)})`);
});

test('boundary walls still close the world outside the pass', () => {
  const p = new Player([{ name: 'static', bvh, enabled: true }], 1);
  p.flying = true;
  p.teleport(325, 90, -100); // on alpha's east mountains, north of the pass
  p.flying = false;
  for (let i = 0; i < 20 * 120; i++) { p.yaw = -Math.PI / 2; p.step(1 / 120, { x: 0, z: 1, jump: false, sprint: true }); }
  assert.ok(p.pos.x < 335, `blocked at x=${p.pos.x.toFixed(1)}`);
});
