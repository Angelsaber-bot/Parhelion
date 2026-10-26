import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { Player } from '../src/player.ts';
import { boundaryWalls } from '../src/regions.ts';
import type { Layout } from '../src/types.ts';

// The 2026 hub (World Architecture v1.0): every quest stop can be walked to from the camp.
const buf = readFileSync(new URL('../public/assets/world_alpha.glb', import.meta.url));
const gltf = await regionLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
bakeQuantized(gltf.scene);
gltf.scene.updateMatrixWorld(true);
const geos: THREE.BufferGeometry[] = [boundaryWalls()];
gltf.scene.getObjectByName('COLLISION')!.traverse(o => {
  const m = o as THREE.Mesh;
  if (!m.isMesh || m.userData.dynamic) return;
  let g = new THREE.BufferGeometry().setAttribute('position', m.geometry.attributes.position.clone());
  if (m.geometry.index) g.setIndex(m.geometry.index.clone());
  g.applyMatrix4(m.matrixWorld);
  geos.push(g.index ? g.toNonIndexed() : g);
});
const bvh = new MeshBVH(mergeGeometries(geos));
const layout: Layout = JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json', import.meta.url), 'utf8'));
const marker = (id: string) => layout.markers.find(m => m.id === id)!;
const ground = (x: number, z: number) => bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)!.point.y;

/** Walk (sprinting, with a jump when stuck) along waypoints; returns the player. */
function walk(from: [number, number], route: [number, number][]) {
  const p = new Player([{ name: 'static', bvh, enabled: true }], layout.world.waterLevel);
  p.teleport(from[0], ground(from[0], from[1]) + 0.5, from[1]);
  let k = 0, stuck = 0, last = p.pos.clone();
  for (let i = 0; i < 120 * 240 && k < route.length; i++) {
    const [x, z] = route[k];
    if (Math.hypot(p.pos.x - x, p.pos.z - z) < 1.5) { k++; continue; }
    p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z));
    if (i % 120 === 0) { stuck = p.pos.distanceTo(last) < 1 ? stuck + 1 : 0; last = p.pos.clone(); }
    p.step(1 / 120, { x: 0, z: 1, jump: stuck > 0 && i % 60 < 5, sprint: true });
  }
  return { p, k };
}
const at = (id: string): [number, number] => [marker(id).p[0], marker(id).p[2]];

test('camp → observatory terminal → armory rack → range line', () => {
  const route: [number, number][] = [[-6, 146], [-34, 152], [-62, 182], [-90, 212], [-112, 236], at('hq_terminal'), [-100, 248], [-80, 250], at('armory_rack'), [-80, 250], [-92, 262], at('range_line')];
  const { p, k } = walk([3, 159], route);
  assert.equal(k, route.length, `stuck at ${p.pos.toArray().map(v => v.toFixed(1))} heading for ${route[k]}`);
});
test('plaza → summoning circle', () => {
  const route: [number, number][] = [[-130, 256], [-150, 256], at('summon_circle')];
  const { p, k } = walk([-118, 246], route);
  assert.equal(k, route.length, `stuck at ${p.pos.toArray().map(v => v.toFixed(1))}`);
});
test('tower → northern ice seam (walks onto the ice, does not swim)', () => {
  const route: [number, number][] = [[16, -170], [10, -190], [8, -212], [0, -244], at('seam_north')];
  const { p, k } = walk([14, -150], route);
  assert.equal(k, route.length, `stuck at ${p.pos.toArray().map(v => v.toFixed(1))}`);
  assert.ok(!p.swimming && p.onGround, 'standing on the ice');
});
test('outpost → western seam, forest → eastern seam', () => {
  for (const [from, route] of [
    [[-176, -36], [[-230, -34], [-280, -30], at('seam_west')]],
    [[132, 40], [[170, 32], [210, 30], [260, 30], at('seam_east')]],
  ] as [[number, number], [number, number][]][]) {
    const { p, k } = walk(from, route);
    assert.equal(k, route.length, `stuck at ${p.pos.toArray().map(v => v.toFixed(1))}`);
  }
});
