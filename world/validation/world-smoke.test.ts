import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { Player, type Collider } from '../src/player.ts';
import type { Layout } from '../src/types.ts';

const buffer = readFileSync(new URL('../public/assets/world_alpha.glb', import.meta.url));
const gltf = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
gltf.scene.updateMatrixWorld(true);
const dynamic: Collider[] = [], staticGeos: THREE.BufferGeometry[] = [];
gltf.scene.getObjectByName('COLLISION')!.traverse(o => {
  const m = o as THREE.Mesh;
  if (!m.isMesh) return;
  let g = new THREE.BufferGeometry().setAttribute('position', m.geometry.attributes.position.clone());
  if (m.geometry.index) g.setIndex(m.geometry.index.clone());
  g.applyMatrix4(m.matrixWorld);
  if (g.index) g = g.toNonIndexed();
  if (m.userData.dynamic) dynamic.push({ name: m.name, bvh: new MeshBVH(g), enabled: true });
  else staticGeos.push(g);
});
const bvh = new MeshBVH(mergeGeometries(staticGeos));
const colliders = [{ name: 'static', bvh, enabled: true }, ...dynamic];
const layout: Layout = JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json', import.meta.url), 'utf8'));
const idle = { x: 0, z: 0, jump: false, sprint: false, up: 0 };

test('all seven real-world teleport destinations settle on collision or water', () => {
  for (const area of layout.areas) {
    const [x, z] = area.tp;
    const hit = bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide);
    assert.ok(hit, `${area.id}: ground ray`);
    const p = new Player(colliders, layout.world.waterLevel);
    p.teleport(x, hit.point.y + 0.5, z);
    for (let i = 0; i < 600; i++) p.step(1 / 120, idle);
    assert.ok(p.pos.toArray().every(Number.isFinite), `${area.id}: finite position`);
    assert.ok(p.onGround || p.swimming, `${area.id}: settled contact at ${p.pos.toArray()}`);
    assert.ok(Math.hypot(p.pos.x - x, p.pos.z - z) < 0.5, `${area.id}: stationary drift`);
  }
});
test('actual camp spawn settles and normal walking changes position without falling through', () => {
  const spawn = layout.markers.find(m => m.id === 'spawn_p1')!;
  const p = new Player(colliders, layout.world.waterLevel);
  p.teleport(spawn.p[0], spawn.p[1] + 1, spawn.p[2]);
  for (let i = 0; i < 240; i++) p.step(1 / 120, idle);
  assert.equal(p.onGround, true);
  const z = p.pos.z;
  for (let i = 0; i < 120; i++) p.step(1 / 120, { ...idle, z: 1 });
  assert.ok(p.pos.z < z - 1);
  assert.ok(p.pos.y > 15, 'camp plateau floor should remain under the player');
});
