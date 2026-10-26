import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { Player, type Collider } from '../src/player.ts';
import type { Layout } from '../src/types.ts';

// Region 2 (星落海岸): spawn/teleports settle, and the updraft + glider route reaches the floating isles.
const buffer = readFileSync(new URL('../public/assets/world_coast.glb', import.meta.url));
const gltf = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
gltf.scene.updateMatrixWorld(true);
const geos: THREE.BufferGeometry[] = [];
gltf.scene.getObjectByName('COLLISION')!.traverse(o => {
  const m = o as THREE.Mesh;
  if (!m.isMesh) return;
  let g = new THREE.BufferGeometry().setAttribute('position', m.geometry.attributes.position.clone());
  if (m.geometry.index) g.setIndex(m.geometry.index.clone());
  g.applyMatrix4(m.matrixWorld);
  if (g.index) g = g.toNonIndexed();
  geos.push(g);
});
const bvh = new MeshBVH(mergeGeometries(geos));
const colliders: Collider[] = [{ name: 'static', bvh, enabled: true }];
const layout: Layout = JSON.parse(readFileSync(new URL('../public/assets/world_coast.layout.json', import.meta.url), 'utf8'));
const idle = { x: 0, z: 0, jump: false, sprint: false, up: 0 };
const ground = (x: number, z: number) => bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)!.point.y;
const make = () => { const p = new Player(colliders, layout.world.waterLevel); p.updrafts = layout.updrafts ?? []; return p; };
const run = (p: Player, s: number, input = idle) => { for (let i = 0; i < s * 120; i++) p.step(1 / 120, input); };
const face = (p: Player, x: number, z: number) => { p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); };

test('coast: every teleport destination and the spawn settle', () => {
  const spots = [...layout.areas.map(a => a.tp), [layout.markers.find(m => m.id === 'spawn_p1')!.p[0], layout.markers.find(m => m.id === 'spawn_p1')!.p[2]]] as [number, number][];
  for (const [x, z] of spots) {
    const p = make();
    p.teleport(x, ground(x, z) + 0.5, z);
    run(p, 5);
    assert.ok(p.onGround || p.swimming, `settled at ${x},${z}: ${p.pos.toArray()}`);
    assert.ok(Math.hypot(p.pos.x - x, p.pos.z - z) < 0.5, `no drift at ${x},${z}`);
  }
});

test('coast: crater updraft lifts the player and the glider reaches isle i1', () => {
  const u = layout.updrafts![0];
  const p = make();
  p.teleport(u.x, ground(u.x, u.z) + 0.2, u.z);
  run(p, 0.5);
  run(p, 0.1, { ...idle, jump: true });
  run(p, 8);
  assert.ok(p.gliding, 'glider opens in the updraft');
  assert.ok(p.pos.y > u.y1 - 8, `lifted to ${p.pos.y.toFixed(1)}`);
  // glide to i1 (40, -112, top 30)
  for (let i = 0; i < 20 * 120 && !p.onGround; i++) { face(p, 40, -112); p.step(1 / 120, { ...idle, z: 1 }); }
  assert.ok(p.onGround, `landed (${p.pos.toArray().map(v => v.toFixed(1))})`);
  assert.ok(Math.abs(p.pos.y - 30) < 1.5 && Math.hypot(p.pos.x - 40, p.pos.z + 112) < 9, `landed on i1 at ${p.pos.toArray().map(v => v.toFixed(1))}`);
});

test('coast: glider chain i1 → i2 → i3 → i4 (shard isle)', () => {
  const isles = Object.fromEntries((JSON.parse(readFileSync(new URL('../public/assets/world_coast.layout.json', import.meta.url), 'utf8')).isles as { id: string; c: [number, number]; y: number }[]).map(i => [i.id, i]));
  const hops: [number, string][] = [[1, 'i2'], [2, 'i3'], [3, 'i4']];
  const p = make();
  const u1 = layout.updrafts![1];
  p.teleport(u1.x, ground(u1.x, u1.z) + 0.2, u1.z);
  for (const [ui, target] of hops) {
    const u = layout.updrafts![ui];
    assert.ok(Math.hypot(p.pos.x - u.x, p.pos.z - u.z) < 12, `near vent ${ui}`);
    for (let i = 0; i < 6 * 120 && Math.hypot(p.pos.x - u.x, p.pos.z - u.z) > 1; i++) { face(p, u.x, u.z); p.step(1 / 120, { ...idle, z: 1 }); }
    run(p, 0.1, { ...idle, jump: true });
    run(p, 9);
    const t = isles[target];
    for (let i = 0; i < 25 * 120 && !(p.onGround && !p.inUpdraft); i++) {
      const d = Math.hypot(p.pos.x - t.c[0], p.pos.z - t.c[1]);
      face(p, t.c[0], t.c[1]);
      p.step(1 / 120, { ...idle, z: d > 2 ? 1 : 0 });
    }
    assert.ok(Math.abs(p.pos.y - t.y) < 1.6, `reached ${target} at ${p.pos.toArray().map(v => v.toFixed(1))}`);
  }
});

const walkPath = (p: Player, pts: [number, number][], maxS = 60) => {
  let k = 0;
  for (let i = 0; i < maxS * 120 && k < pts.length; i++) {
    const [x, z] = pts[k];
    if (Math.hypot(p.pos.x - x, p.pos.z - z) < 0.6) { k++; continue; }
    face(p, x, z);
    p.step(1 / 120, { ...idle, z: 1 });
  }
  return k === pts.length;
};

test('coast: the switchback stairs climb the cliff onto the temple plateau', () => {
  const p = make();
  p.teleport(110, ground(110, 49) + 0.3, 49);
  run(p, 1);
  const ok = walkPath(p, [[110, 15.5], [114.5, 15.5], [114.5, 44.5], [110, 44.5], [110, 15.5], [114.5, 15.5], [114.5, 44.5], [132, 44.5]]);
  assert.ok(ok, `followed the stairs (stuck at ${p.pos.toArray().map(v => v.toFixed(1))})`);
  run(p, 1);
  assert.ok(p.onGround && p.pos.y > 30, `on the plateau at ${p.pos.toArray().map(v => v.toFixed(1))}`);
});

test('coast: the lighthouse spiral ramp reaches the lamp gallery', () => {
  const lamp = layout.markers.find(m => m.id === 'lighthouse_lamp')!;
  const [cx, cz] = [-150, -20];
  const p = make();
  const a0 = 0.15;
  p.teleport(cx + Math.cos(a0) * 5.65, ground(cx + Math.cos(a0) * 5.65, cz + Math.sin(a0) * 5.65) + 0.3, cz + Math.sin(a0) * 5.65);
  run(p, 1);
  for (let i = 0; i < 90 * 120 && p.pos.y < lamp.p[1] - 0.3; i++) {
    const a = Math.atan2(p.pos.z - cz, p.pos.x - cx) + 0.4;
    face(p, cx + Math.cos(a) * 5.65, cz + Math.sin(a) * 5.65);
    p.step(1 / 120, { ...idle, z: 1 });
  }
  assert.ok(p.pos.y > lamp.p[1] - 0.5, `reached gallery height (${p.pos.y.toFixed(1)} / ${lamp.p[1].toFixed(1)})`);
});
