import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import { Player } from '../src/player/player';

const bytes = readFileSync(new URL('../public/assets/world_britain.glb', import.meta.url));
const { scene } = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
bakeQuantized(scene); scene.updateMatrixWorld(true);
const solids: THREE.BufferGeometry[] = [];
scene.getObjectByName('COLLISION')!.traverse(o => {
  const m = o as THREE.Mesh; if (!m.isMesh || m.userData.dynamic) return;
  let g = new THREE.BufferGeometry().setAttribute('position', m.geometry.attributes.position.clone());
  if (m.geometry.index) g.setIndex(m.geometry.index.clone());
  g.applyMatrix4(m.matrixWorld);
  if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); }
  solids.push(g);
});
const geometry = mergeGeometries(solids), bvh = new MeshBVH(geometry); solids.forEach(g => g.dispose());
const make = () => new Player([{ name: 'Britain', bvh, enabled: true }], 1);
const idle = { x: 0, z: 0, jump: false, sprint: false };
const hall = scene.getObjectByName('ART')!;

test('Britain paving edit changes only 122 slab vertex heights and reverses to the frozen original POSITION hash', async () => {
  const change = JSON.parse(readFileSync(new URL('./britain-floor-contact.edits.json', import.meta.url), 'utf8')) as {
    node: string; beforePositionSha256: string; afterPositionSha256: string; edits: { vertex: number; before: number; after: number }[];
  };
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(bytes), node = doc.getRoot().listNodes().find(n => n.getName() === change.node)!;
  const attribute = node.getMesh()!.listPrimitives()[0].getAttribute('POSITION')!;
  assert.equal(attribute.getNormalized(), true); assert.equal(attribute.getComponentType(), 5122);
  const positions = attribute.getArray()!.slice() as Int16Array;
  const hash = () => createHash('sha256').update(Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength)).digest('hex');
  assert.equal(hash(), change.afterPositionSha256);
  assert.equal(change.edits.length, 122); assert.equal(new Set(change.edits.map(e => e.vertex)).size, 122);
  const [tx, ty, tz] = node.getTranslation(), [sx, sy, sz] = node.getScale();
  for (const edit of change.edits) {
    const index = edit.vertex * 3;
    assert.equal(positions[index + 1], edit.after);
    const x = positions[index] / 32767 * sx + tx, z = positions[index + 2] / 32767 * sz + tz;
    const oldY = edit.before / 32767 * sy + ty, newY = edit.after / 32767 * sy + ty;
    assert.ok(Math.hypot(x + 215, z + 165) <= 12.62, 'only the authored Round Hall slab footprint');
    assert.ok(oldY >= 33.98 && oldY <= 34.18 && newY >= 33.83 && newY <= 34.04);
    assert.ok(oldY - newY >= .13 && oldY - newY <= .16, 'only the 0.145m downward correction, allowing quantization');
    positions[index + 1] = edit.before;
  }
  assert.equal(change.beforePositionSha256, '787350870acd84055523bb8d9a538d2039662b7513885091f4c7e16b22042251');
  assert.equal(hash(), change.beforePositionSha256, 'reversing ONLY the authorized Y components restores every original position byte');
});

test('Britain actual Round Hall paving meets grounded feet around the inhabited aisle', () => {
  for (const a of [.25, 1.1, 2.2, 3.2, 4.3, 5.2]) {
    const x = -215 + Math.cos(a) * 9, z = -165 + Math.sin(a) * 9;
    const player = make(); player.teleport(x, 34.5, z);
    for (let i = 0; i < 180; i++) player.step(1 / 120, idle);
    assert.equal(player.onGround, true);
    const hit = new THREE.Raycaster(new THREE.Vector3(x, player.pos.y + .5, z), new THREE.Vector3(0, -1, 0), 0, 1).intersectObject(hall, true)[0];
    assert.ok(hit, 'a visible paved surface must exist below the feet');
    assert.ok(Math.abs(hit.point.y - player.pos.y) < .04,
      `paving intersects the player by ${(hit.point.y - player.pos.y).toFixed(3)}m at ${x.toFixed(2)},${z.toFixed(2)}`);
  }
});

test('Britain Round Hall table legs, all thirteen seats and three brazier posts stay supported at the corrected paving', () => {
  const furniture: THREE.Object3D[] = [], paving: THREE.Object3D[] = [];
  hall.traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const material = m.material as THREE.Material;
    if (['M_BritainOak', 'M_BritainIron', 'M_BritainWool'].includes(material.name)) furniture.push(m);
    if (material.name === 'M_BritainLimestone') paving.push(m);
  });
  const points: { name: string; x: number; z: number }[] = [];
  for (const [name, count, radius] of [['table leg', 6, 5], ['seat', 13, 6.7]] as const) {
    for (let i = 0; i < count; i++) { const a = i * 2 * Math.PI / count; points.push({ name: `${name} ${i + 1}`, x: -215 + Math.cos(a) * radius, z: -165 + Math.sin(a) * radius }); }
  }
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 4 + Math.PI + (i - 1) * 1.6; points.push({ name: `brazier ${i + 1}`, x: -215 + Math.cos(a) * 10.6, z: -165 + Math.sin(a) * 10.6 }); }
  for (const p of points) {
    const base = new THREE.Raycaster(new THREE.Vector3(p.x, 33.7, p.z), new THREE.Vector3(0, 1, 0), 0, .6).intersectObjects(furniture, false)[0];
    const floor = new THREE.Raycaster(new THREE.Vector3(p.x, 34.3, p.z), new THREE.Vector3(0, -1, 0), 0, .6).intersectObjects(paving, false)[0];
    assert.ok(base && floor, `${p.name}: real underside and paving exist`);
    assert.ok(Math.abs(base.point.y - 34) < .025, `${p.name}: base at ${base.point.y}`);
    assert.ok(base.point.y <= floor.point.y + .025, `${p.name}: unsupported above ${floor.point.y}`);
  }
});

test('Britain Round Hall doorway and full brazier aisle remain walkable without jumping', () => {
  const player = make(), a0 = -Math.PI / 4;
  player.teleport(-215 + Math.cos(a0) * 16, 34.5, -165 + Math.sin(a0) * 16);
  for (let i = 0; i < 180; i++) player.step(1 / 120, idle);
  const route = [[-215 + Math.cos(a0) * 9, -165 + Math.sin(a0) * 9]];
  for (let i = 1; i <= 32; i++) { const a = a0 + i * Math.PI / 16; route.push([-215 + Math.cos(a) * 9, -165 + Math.sin(a) * 9]); }
  route.push([-215 + Math.cos(a0) * 16, -165 + Math.sin(a0) * 16]);
  for (const [x, z] of route) {
    let frames = 0;
    while (Math.hypot(player.pos.x - x, player.pos.z - z) > .3 && frames++ < 120 * 12) {
      player.yaw = Math.atan2(player.pos.x - x, player.pos.z - z); player.step(1 / 120, { ...idle, z: 1 });
    }
    assert.ok(Math.hypot(player.pos.x - x, player.pos.z - z) < .35, `stalled at ${player.pos.toArray()} toward ${x},${z}`);
    assert.ok(Math.abs(player.pos.y - 34) < .05 && !player.swimming);
  }
});
