import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { Player } from '../src/player.ts';
import { boundaryWalls, REGIONS } from '../src/regions.ts';
import type { Layout } from '../src/types.ts';

// World 01 落日王国: reached on foot from 幻日谷 through the west seam (once the summoning circle is
// stable), and every quest stop can be walked to. Coordinates below are world coordinates.
const loadRegion = async (file: string, offset: [number, number]) => {
  const buf = readFileSync(new URL(`../public/assets/${file}.glb`, import.meta.url));
  const gltf = await regionLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  bakeQuantized(gltf.scene);
  gltf.scene.position.set(offset[0], 0, offset[1]);
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
};
const def = (id: string) => REGIONS.find(r => r.id === id)!;
const roots = [await loadRegion('world_alpha', def('alpha').offset), await loadRegion('world_britain', def('britain').offset)];
const geos: THREE.BufferGeometry[] = [boundaryWalls()];
const dynamic = new Map<string, MeshBVH>();
for (const r of roots) r.getObjectByName('COLLISION')!.traverse(o => {
  const m = o as THREE.Mesh;
  if (!m.isMesh) return;
  let g = new THREE.BufferGeometry().setAttribute('position', m.geometry.attributes.position.clone());
  if (m.geometry.index) g.setIndex(m.geometry.index.clone());
  g.applyMatrix4(m.matrixWorld);
  g = g.index ? g.toNonIndexed() : g;
  if (m.userData.dynamic) dynamic.set(m.name, new MeshBVH(g));
  else geos.push(g);
});
const bvh = new MeshBVH(mergeGeometries(geos));
const layout: Layout = JSON.parse(readFileSync(new URL('../public/assets/world_britain.layout.json', import.meta.url), 'utf8'));
const [OX, OZ] = def('britain').offset;
const W = (x: number, z: number): [number, number] => [x + OX, z + OZ];
const marker = (id: string) => {
  const m = layout.markers.find(m => m.id === id)!;
  return { ...m, p: [m.p[0] + OX, m.p[1], m.p[2] + OZ] as [number, number, number] };
};
const at = (id: string): [number, number] => [marker(id).p[0], marker(id).p[2]];
const ground = (x: number, z: number) => bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)!.point.y;

function make(extra: string[] = []) {
  return new Player([{ name: 'static', bvh, enabled: true }, ...extra.map(n => ({ name: n, bvh: dynamic.get(n)!, enabled: true }))], layout.world.waterLevel);
}
/** Walk (sprinting, with a jump when stuck) along waypoints; returns the player and how far it got. */
function walk(from: [number, number], route: [number, number][], extra: string[] = []) {
  const p = make(extra);
  p.teleport(from[0], ground(from[0], from[1]) + 0.5, from[1]);
  let k = 0, stuck = 0, last = p.pos.clone();
  for (let i = 0; i < 120 * 300 && k < route.length; i++) {
    const [x, z] = route[k];
    if (Math.hypot(p.pos.x - x, p.pos.z - z) < 1.5) { k++; continue; }
    p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z));
    if (i % 120 === 0) { stuck = p.pos.distanceTo(last) < 1 ? stuck + 1 : 0; last = p.pos.clone(); }
    p.step(1 / 120, { x: 0, z: 1, jump: stuck > 0 && i % 60 < 5, sprint: true, up: 0 });
  }
  return { p, k };
}
const where = (p: Player) => p.pos.toArray().map(v => v.toFixed(1)).join(', ');

test('britain: the west seam gate holds until the summoning circle is stable', () => {
  assert.ok(dynamic.has('COL_Seam_west_Gate'), 'gate collider exported');
  const { p } = walk([-300, -30], [[-360, -30], [-420, -30]], ['COL_Seam_west_Gate']);
  assert.ok(p.pos.x > -336, `blocked at the seam (${where(p)})`);
});

test('britain: walk from the valley seam through the gorge to the Lake of the Sword', () => {
  const route: [number, number][] = [[-330, -30], [-360, -30], ...layout.paths[0].map(([x, z]) => W(x, z))];
  const { p, k } = walk([-300, -30], route);
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
});

test('britain: every teleport destination and the spawn settle', () => {
  const spots = [...layout.areas.map(a => W(a.tp[0], a.tp[1])), at('spawn_p1')];
  for (const [x, z] of spots) {
    const p = make();
    p.teleport(x, ground(x, z) + 0.5, z);
    for (let i = 0; i < 600; i++) p.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false, up: 0 });
    assert.ok(p.onGround && !p.swimming, `settled on dry ground at ${x},${z}: ${where(p)}`);
  }
});

test('britain: the causeway reaches the sword on the islet without swimming', () => {
  const [sx, sz] = at('saber_contract');
  const route: [number, number][] = [[sx, sz - 40], [sx, sz - 20], [sx, sz]];
  const { p: q, k } = walk([sx, sz - 60], route);
  assert.equal(k, route.length, `stuck at ${where(q)}`);
  assert.ok(!q.swimming, 'stayed dry');
  assert.ok(Math.abs(q.pos.y - marker('saber_contract').p[1]) < 1.5, `on the islet (${where(q)})`);
});

test('britain: forest road → knights camp gate → war table shard', () => {
  const route: [number, number][] = [...layout.paths[1].map(([x, z]) => W(x, z)), W(170, -166), W(170, -190), at('shard_camp')];
  const { p, k } = walk(W(204, -26), route);
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
});

test('britain: lake road climbs to the Camelot gate, through the town to the round table', () => {
  const route: [number, number][] = [...layout.paths[2].map(([x, z]) => W(x, z)), W(-166, -166), W(-180, -182), W(-203, -177), W(-208, -172), W(-210.5, -169.5)];
  const { p, k } = walk(W(2, 58), route);
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
  // keep walking toward the table until the seats stop us, then check the interact radius
  for (let i = 0; i < 240; i++) { p.yaw = Math.atan2(-(at('shard_table')[0] - p.pos.x), -(at('shard_table')[1] - p.pos.z)); p.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false, up: 0 }); }
  const m = marker('shard_table');
  const d = Math.hypot(p.pos.x - m.p[0], p.pos.y - m.p[1], p.pos.z - m.p[2]);
  assert.ok(d < m.radius!, `in reach of the table shard (${d.toFixed(1)} / ${m.radius})`);
});

test('britain: the keep spiral ramp reaches the shard at the top', () => {
  const shard = marker('shard_tower');
  const [cx, cz] = W(-160, -214), R = 7.65;
  const p = make();
  const a0 = 0.15;
  p.teleport(cx + Math.cos(a0) * R, ground(cx + Math.cos(a0) * R, cz + Math.sin(a0) * R) + 0.3, cz + Math.sin(a0) * R);
  for (let i = 0; i < 120 * 120 && p.pos.y < shard.p[1] - 0.3; i++) {
    const a = Math.atan2(p.pos.z - cz, p.pos.x - cx) + 0.4;
    p.yaw = Math.atan2(-(cx + Math.cos(a) * R - p.pos.x), -(cz + Math.sin(a) * R - p.pos.z));
    p.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false, up: 0 });
  }
  assert.ok(p.pos.y > shard.p[1] - 0.5, `reached the top (${p.pos.y.toFixed(1)} / ${shard.p[1].toFixed(1)})`);
});

test('britain: lake → Camlann → the sun core mound', () => {
  const route: [number, number][] = [...layout.paths[3].map(([x, z]) => W(x, z)), W(-170, 200), at('sun_core')];
  const { p, k } = walk(W(-4, 128), route);
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
  assert.ok(Math.hypot(p.pos.x - at('sun_core')[0], p.pos.y - marker('sun_core').p[1], p.pos.z - at('sun_core')[1]) < 3.6, `in reach of the core (${where(p)})`);
});
