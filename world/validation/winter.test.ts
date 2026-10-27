import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { Player } from '../src/player.ts';
import { boundaryWalls, REGIONS, regionAt } from '../src/regions.ts';
import { BELL, BEACONS, RIVER, GORGE } from '../tools/gen/winter/layout.ts';
import type { Layout } from '../src/types.ts';

// World 03 永冬之城: reached on foot from 幻日谷 along the frozen channel through the northern ice seam
// (once the summoning circle is stable); every quest stop can be walked or climbed to.
const loadRegion = async (file: string, offset: [number, number]) => {
  const buf = readFileSync(new URL(`../public/assets/${file}.glb`, import.meta.url));
  const gltf = await regionLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  bakeQuantized(gltf.scene);
  gltf.scene.position.set(offset[0], 0, offset[1]);
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
};
const def = (id: string) => REGIONS.find(r => r.id === id)!;
const roots = [await loadRegion('world_alpha', def('alpha').offset), await loadRegion('world_winter', def('winter').offset)];
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
const layout: Layout = JSON.parse(readFileSync(new URL('../public/assets/world_winter.layout.json', import.meta.url), 'utf8'));
const [OX, OZ] = def('winter').offset;
const W = (x: number, z: number): [number, number] => [x + OX, z + OZ];
const marker = (id: string) => {
  const m = layout.markers.find(m => m.id === id)!;
  assert.ok(m, `marker ${id}`);
  return { ...m, p: [m.p[0] + OX, m.p[1], m.p[2] + OZ] as [number, number, number] };
};
const at = (id: string): [number, number] => [marker(id).p[0], marker(id).p[2]];
const ground = (x: number, z: number) => bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)!.point.y;
const idle = { x: 0, z: 0, jump: false, sprint: false };

const make = (extra: string[] = []) => new Player([{ name: 'static', bvh, enabled: true }, ...extra.map(n => ({ name: n, bvh: dynamic.get(n)!, enabled: true }))], layout.world.waterLevel);
const face = (p: Player, x: number, z: number) => { p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); };
const run = (p: Player, s: number, input = idle) => { for (let i = 0; i < s * 120; i++) p.step(1 / 120, input); };
function follow(p: Player, route: [number, number][], opts: { jump?: boolean; sprint?: boolean; tol?: number } = {}) {
  let k = 0, stuck = 0, last = p.pos.clone();
  for (let i = 0; i < 120 * 300 && k < route.length; i++) {
    const [x, z] = route[k];
    if (Math.hypot(p.pos.x - x, p.pos.z - z) < (opts.tol ?? 1.5)) { k++; continue; }
    face(p, x, z);
    if (i % 120 === 0) { stuck = p.pos.distanceTo(last) < 1 ? stuck + 1 : 0; last = p.pos.clone(); }
    p.step(1 / 120, { x: 0, z: 1, jump: (opts.jump ?? true) && stuck > 0 && i % 60 < 5, sprint: opts.sprint ?? true });
  }
  return k;
}
function walk(from: [number, number], route: [number, number][], extra: string[] = [], opts = {}) {
  const p = make(extra);
  p.teleport(from[0], ground(from[0], from[1]) + 0.5, from[1]);
  return { p, k: follow(p, route, opts) };
}
const where = (p: Player) => p.pos.toArray().map(v => v.toFixed(1)).join(', ');
const reach = (p: Player, id: string) => {
  const m = marker(id);
  return Math.hypot(p.pos.x - m.p[0], p.pos.y - m.p[1], p.pos.z - m.p[2]) < (m.radius ?? 3);
};
const nudge = (p: Player, id: string) => { for (let i = 0; i < 360 && !reach(p, id); i++) { face(p, ...at(id)); p.step(1 / 120, { ...idle, z: 1 }); } };
const SEALS = ['COL_TGT_frost_seal_1', 'COL_TGT_frost_seal_2', 'COL_TGT_frost_seal_3'];

test('winter: the northern ice seam gate holds until the summoning circle is stable', () => {
  assert.ok(dynamic.has('COL_Seam_north_Gate'), 'gate collider exported');
  const { p } = walk([0, -300], [[0, -360], [0, -420]], ['COL_Seam_north_Gate']);
  assert.ok(p.pos.z > -343, `blocked at the seam (${where(p)})`);
});

test('winter: walk from the valley along the frozen channel to the Berezina crossing and on to the bivouac', () => {
  const route: [number, number][] = [[0, -330], [0, -370], W(0, 330), ...layout.paths[0].map(([x, z]) => W(x, z))];
  const { p, k } = walk([0, -300], route);
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
  assert.equal(regionAt(p.pos.x, p.pos.z).id, 'winter');
  assert.ok(!p.swimming, 'stayed dry on the ice');
});

test('winter: every teleport destination and the spawn settle', () => {
  const spots = [...layout.areas.map(a => W(a.tp[0], a.tp[1])), at('spawn_p1')];
  for (const [x, z] of spots) {
    const p = make();
    p.teleport(x, ground(x, z) + 0.5, z);
    run(p, 5);
    assert.ok(p.onGround && !p.swimming, `settled on dry ground at ${x},${z}: ${where(p)}`);
  }
});

test('winter: the upstream pontoon bridge carries the player across the river (the downstream one is broken)', () => {
  for (const bz of [262]) {
    const { p, k } = walk(W(-40, bz), [W(-20, bz), W(10, bz), W(34, bz)], [], { jump: false });
    assert.equal(k, 3, `bridge at z ${bz}: stuck at ${where(p)}`);
    assert.ok(!p.swimming, 'dry');
  }
});

test("winter: Napoleon waits inside the emperor's tent", () => {
  const { p } = walk(W(-140, 186), [W(-160, 150), W(-176, 142), at('napoleon_meet')]);
  nudge(p, 'napoleon_meet');
  assert.ok(reach(p, 'napoleon_meet'), `in reach of Napoleon (${where(p)})`);
  assert.ok(reach(p, 'warm_tent') || Math.hypot(p.pos.x - marker('warm_tent').p[0], p.pos.z - marker('warm_tent').p[2]) < 9, 'the tent is warm');
});

test('winter: the bivouac road leads to all three beacons and the cairn of eagles', () => {
  for (const [i, [bx, bz]] of BEACONS.entries()) {
    const route: [number, number][] = [...layout.paths[1].map(([x, z]) => W(x, z)), W(bx, bz)];
    const { p } = walk(W(-160, 74), route);
    nudge(p, `beacon_${i + 1}`);
    assert.ok(reach(p, `beacon_${i + 1}`), `beacon ${i + 1} reached (${where(p)})`);
  }
  const { p } = walk(W(-160, 74), [W(-200, 50), at('shard_eagle')]);
  nudge(p, 'shard_eagle');
  assert.ok(reach(p, 'shard_eagle'), `cairn reached (${where(p)})`);
});

test('winter: the Smolensk road climbs to Moscow, the Kremlin south gate and Red Square', () => {
  const route: [number, number][] = [...layout.paths[2].map(([x, z]) => W(x, z)), ...layout.paths[3].map(([x, z]) => W(x, z)), W(-6, -170)];
  const { p, k } = walk(W(30, 262), route);
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
  const r = walk(W(40, -100), [...layout.paths[4].map(([x, z]) => W(x, z)), at('winter_core')]);
  nudge(r.p, 'winter_core');
  assert.ok(reach(r.p, 'winter_core'), `at the winter core (${where(r.p)})`);
});

test('winter: through the Kremlin gate and up the bell tower scaffold to the Bell shard', () => {
  const [bx, bz] = BELL.c, zs = bz + 8, L = 10;
  const lane = (k: number) => zs + (k % 2) * 2.6;
  const route: [number, number][] = [W(-6, -150), W(-6, -170), W(-14, -186), W(bx - L / 2 - 1.2, zs - 0.5 + 1.3)];
  for (let k = 0; k < 10; k++) {
    const dir = k % 2 === 0 ? 1 : -1;
    route.push(W(bx - dir * (L / 2 + 0.6), lane(k)), W(bx + dir * (L / 2 + 0.8), lane(k)));
  }
  route.push(at('shard_bell'));
  const { p, k } = walk(W(-6, -168), route, [], { jump: false, sprint: false, tol: 0.7 });
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]} (step ${k})`);
  assert.ok(reach(p, 'shard_bell'), `on the belfry (${where(p)})`);
});

test('winter: the frost seals are in sight from the river; the ice wall falls once they break, opening the cavern', () => {
  const line = RIVER.slice(GORGE.from - 1, GORGE.to + 1).map(([x, z]) => W(x, z));
  // walk up the river towards the ice wall
  const a = walk(W(214, 76), [line[1], W(262, 2)], ['COL_Ice_Gate']);
  assert.ok(a.k === 2, `river walk stuck at ${where(a.p)}`);
  const eye = new THREE.Vector3(a.p.pos.x, a.p.pos.y + 1.4, a.p.pos.z);
  for (const name of SEALS) {
    const c = dynamic.get(name)!.getBoundingBox(new THREE.Box3()).getCenter(new THREE.Vector3());
    const dir = c.clone().sub(eye), d = dir.length();
    const wall = bvh.raycastFirst(new THREE.Ray(eye, dir.clone().normalize()), THREE.DoubleSide);
    assert.ok(!wall || wall.distance > d - 2.5, `${name} visible (wall at ${wall?.distance.toFixed(1)} / ${d.toFixed(1)})`);
    assert.ok(d < 90, `${name} in range (${d.toFixed(0)} m)`);
  }
  const route: [number, number][] = [W(262, 2), ...line.slice(3), at('shard_frost')];
  const shut = walk(W(262, 2), route, ['COL_Ice_Gate']);
  assert.ok(shut.k < route.length && Math.hypot(shut.p.pos.x - at('shard_frost')[0], shut.p.pos.z - at('shard_frost')[1]) > 40, `the wall blocks the gorge (${where(shut.p)})`);
  const open = walk(W(262, 2), route);
  nudge(open.p, 'shard_frost');
  assert.ok(reach(open.p, 'shard_frost'), `in the cavern (${where(open.p)})`);
});
