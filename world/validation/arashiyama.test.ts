import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { buildArashiyama, isArashiyamaReserved } from '../tools/gen/kyoto/arashiyama.ts';
import { buildKyotoTerrain, heightFn } from '../tools/gen/kyoto/terrain.ts';
import { ARASHIYAMA, AREAS, PATHS } from '../tools/gen/kyoto/layout.ts';
import { Player } from '../src/player.ts';

const terrain = buildKyotoTerrain();
const district = buildArashiyama(terrain.heightAt);
const built = district.pieces.map(piece => ({ piece, ...piece.batch.build() }));
const collision = mergeGeometries([terrain.col.toNonIndexed(), ...built.flatMap(b => b.col ? [b.col] : [])]);
const bvh = new MeshBVH(collision);
const ground = (x: number, z: number) => bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 150, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)!.point.y;
function walk(route: [number, number][], collider = bvh) {
  const p = new Player([{ name: 'Arashiyama test terrain and architecture', bvh: collider, enabled: true }], 1);
  const startGround = collider.raycastFirst(new THREE.Ray(new THREE.Vector3(route[0][0], 150, route[0][1]), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)!.point.y;
  p.teleport(route[0][0], startGround + 0.1, route[0][1]);
  let index = 1, wet = false;
  for (let i = 0; i < 120 * 180 && index < route.length; i++) {
    const [x, z] = route[index];
    if (Math.hypot(x - p.pos.x, z - p.pos.z) < 0.9) { index++; continue; }
    p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z));
    p.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false });
    wet ||= p.swimming;
  }
  assert.equal(index, route.length, `stuck at ${p.pos.toArray().map(n => n.toFixed(2))}, heading for ${route[index]}`);
  assert.equal(wet, false, 'the designed dry route should not force swimming');
  return p;
}

test('Arashiyama: composed geometry stays finite and in the reserved western district', () => {
  let vertices = 0;
  for (const { vis } of built) {
    assert.ok(vis);
    const p = vis.attributes.position;
    vertices += p.count;
    for (let i = 0; i < p.count; i++) {
      assert.ok(Number.isFinite(p.getX(i)) && Number.isFinite(p.getY(i)) && Number.isFinite(p.getZ(i)));
      assert.ok(p.getX(i) > -334 && p.getX(i) < -190 && p.getZ(i) > -114 && p.getZ(i) < 104, `geometry outside reserved region at ${p.getX(i)},${p.getZ(i)}`);
    }
  }
  assert.ok(vertices > 30000, 'authored architecture, bridge and foliage are substantive geometry');
  assert.equal(district.markers.length, 4);
  assert.equal(new Set(district.markers.map(m => m.id)).size, 4);
  assert.ok(AREAS.some(a => a.id === 'arashiyama'));
  assert.ok(!isArashiyamaReserved(-215, -218) && !isArashiyamaReserved(-232, 168), 'Kinkaku and Akechi remain outside the new reserved area');
});

test('Arashiyama: city approach, timber bridge and south riverfront are walkable without jumps', () => {
  walk(PATHS[6]);
  walk([[-267, 76], [-238, 76], [-218, 65]]);
  walk([[-267, 76], [-267, 58], [-267, 35], [-267, 12], [-267, 3]]);
});

test('Arashiyama: bamboo lane has clear continuous circulation back to the river', () => {
  walk(PATHS[7]);
  walk([[-267, -10], [-267, -47], [-267, -74], [-267, -100]]);
});

test('Arashiyama: bridge clears the river and all discoveries can stand on dry surfaces', () => {
  assert.ok(heightFn(-267, 35) < 1, 'river is carved below the shared water plane');
  assert.ok(ground(-267, 35) > ARASHIYAMA.bridge.deckY, 'arched deck is physical geometry');
  for (const m of district.markers) {
    const y = ground(m.p[0], m.p[2]);
    assert.ok(y > 1.7, `${m.id} has dry ground`);
    assert.ok(Math.abs(y - m.p[1]) < 0.6, `${m.id} marker lies on its intended walking surface`);
  }
});


test('Arashiyama: exported GLB retains dry routes through full-map vegetation and quantized collisions', async () => {
  const bytes = readFileSync(new URL('../public/assets/world_kyoto.glb', import.meta.url));
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  gltf.scene.getObjectByName('COLLISION')!.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.dynamic) return;
    let g = new THREE.BufferGeometry().setAttribute('position', m.geometry.attributes.position.clone());
    if (m.geometry.index) g.setIndex(m.geometry.index.clone());
    g.applyMatrix4(m.matrixWorld);
    parts.push(g.index ? g.toNonIndexed() : g);
  });
  const exported = new MeshBVH(mergeGeometries(parts));
  assert.ok(gltf.scene.getObjectByName('Arashiyama_Timber'), 'new district exists in the delivered GLB');
  walk(PATHS[6], exported);
  walk(PATHS[7], exported);
  walk(PATHS[8], exported);
});
