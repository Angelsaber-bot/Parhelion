import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { Player } from '../src/player.ts';
import { boundaryWalls, REGIONS, regionAt } from '../src/regions.ts';
import { TORII_PATH, STONE_ROUTE, SANNEN, KIYOMIZU, BANNERS, AKECHI, TOBI_Z, HONNOJI } from '../tools/gen/kyoto/layout.ts';
import type { Layout } from '../src/types.ts';

// World 04 业火京都: reached on foot from 幻日谷 through the torii tunnel of the southern seam (once the
// summoning circle is stable); every quest stop can be walked, waded or climbed to.
const loadRegion = async (file: string, offset: [number, number]) => {
  const buf = readFileSync(new URL(`../public/assets/${file}.glb`, import.meta.url));
  const gltf = await regionLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  bakeQuantized(gltf.scene);
  gltf.scene.position.set(offset[0], 0, offset[1]);
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
};
const def = (id: string) => REGIONS.find(r => r.id === id)!;
const roots = [await loadRegion('world_alpha', def('alpha').offset), await loadRegion('world_kyoto', def('kyoto').offset)];
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
const layout: Layout = JSON.parse(readFileSync(new URL('../public/assets/world_kyoto.layout.json', import.meta.url), 'utf8'));
const [OX, OZ] = def('kyoto').offset;
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

test('kyoto: the southern torii seam gate holds until the summoning circle is stable', () => {
  assert.ok(dynamic.has('COL_Seam_south_Gate'), 'gate collider exported');
  const { p } = walk([40, 290], [[40, 330], [40, 380]], ['COL_Seam_south_Gate']);
  assert.ok(p.pos.z < 343, `blocked at the seam (${where(p)})`);
});

test('kyoto: walk from the valley through the thousand torii, down into the city and on to the Sanjō bridge', () => {
  const route: [number, number][] = [[40, 300], [40, 330], ...TORII_PATH.slice(1).map(([x, z]) => W(x, z)), ...layout.paths[0].map(([x, z]) => W(x, z))];
  const { p, k } = walk([40, 290], route, [], { jump: false });
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
  assert.equal(regionAt(p.pos.x, p.pos.z).id, 'kyoto');
  assert.ok(!p.swimming, 'stayed dry');
});

test('kyoto: every teleport destination and the spawn settle', () => {
  const spots = [...layout.areas.map(a => W(a.tp[0], a.tp[1])), at('spawn_p1')];
  for (const [x, z] of spots) {
    const p = make();
    p.teleport(x, ground(x, z) + 0.5, z);
    run(p, 5);
    assert.ok(p.onGround && !p.swimming, `settled on dry ground at ${x},${z}: ${where(p)}`);
  }
});

test('kyoto: Musashi waits on the Sanjō bridge, and the bridge crosses the Kamo dry', () => {
  const { p, k } = walk(W(110, -75), [W(130, -75), at('musashi_meet'), W(178, -75), W(196, -75)], [], { jump: false });
  assert.equal(k, 4, `stuck at ${where(p)}`);
  assert.ok(!p.swimming, 'dry');
  const q = walk(W(110, -75), [W(130, -75), at('musashi_meet')], [], { jump: false });
  nudge(q.p, 'musashi_meet');
  assert.ok(reach(q.p, 'musashi_meet'), `in reach of Musashi (${where(q.p)})`);
});

test('kyoto: the turtle stones cross the Kamo without swimming', () => {
  const { p, k } = walk(W(120, TOBI_Z), [W(128, TOBI_Z), W(150, TOBI_Z), W(174, TOBI_Z), W(182, TOBI_Z)], [], { jump: false, sprint: false, tol: 0.8 });
  assert.equal(k, 4, `stuck at ${where(p)}`);
  assert.ok(!p.swimming, 'dry');
});

test("kyoto: Sanjō avenue leads to Honnō-ji's gate, over the moat and to the core in the courtyard", () => {
  const route: [number, number][] = [...layout.paths[1].map(([x, z]) => W(x, z)), W(HONNOJI.c[0] + HONNOJI.half + 2, HONNOJI.c[1]), at('fire_core')];
  const { p, k } = walk(W(45, -75), route);
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
  nudge(p, 'fire_core');
  assert.ok(reach(p, 'fire_core'), `at the core (${where(p)})`);
  assert.ok(!p.swimming, 'did not fall into the moat');
});

test('kyoto: the stepping stones cross the pond to the Golden Pavilion', () => {
  const stones: [number, number][] = [];
  for (let i = 0; i < STONE_ROUTE.length - 1; i++) {
    const [ax, az] = STONE_ROUTE[i], [bx, bz] = STONE_ROUTE[i + 1], L = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s < L; s += 1.6) stones.push(W(ax + ((bx - ax) * s) / L, az + ((bz - az) * s) / L));
  }
  const route: [number, number][] = [...layout.paths[3].map(([x, z]) => W(x, z)), ...stones, at('shard_kinkaku')];
  const { p, k } = walk(W(-15, -75), route, [], { jump: false, sprint: false, tol: 0.7 });
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]} (step ${k})`);
  assert.ok(!p.swimming, 'stayed out of the pond');
  assert.ok(reach(p, 'shard_kinkaku'), `on the pavilion deck (${where(p)})`);
});

test('kyoto: up Sannenzaka through the Niōmon to the Kiyomizu stage', () => {
  const [x0] = KIYOMIZU.terrace;
  const route: [number, number][] = [...layout.paths[2].map(([x, z]) => W(x, z)), ...SANNEN.map(([x, z]) => W(x, z)), W(x0 + 4, KIYOMIZU.stage.c[1]), at('shard_kiyomizu')];
  const { p, k } = walk(W(186, -75), route);
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
  nudge(p, 'shard_kiyomizu');
  assert.ok(reach(p, 'shard_kiyomizu'), `on the stage (${where(p)})`);
});

test('kyoto: the Akechi banners are in sight from the camp; the shard waits inside the curtain', () => {
  const { p, k } = walk(W(-15, 45), [...layout.paths[4].slice(1).map(([x, z]) => W(x, z)), W(AKECHI.c[0] + 24, AKECHI.c[1])]);
  assert.ok(k >= 3, `stuck at ${where(p)}`);
  const eye = new THREE.Vector3(p.pos.x, p.pos.y + 1.4, p.pos.z);
  for (const [i] of BANNERS.entries()) {
    const c = dynamic.get(`COL_TGT_kikyo_banner_${i + 1}`)!.getBoundingBox(new THREE.Box3()).getCenter(new THREE.Vector3());
    const dir = c.clone().sub(eye), d = dir.length();
    const wall = bvh.raycastFirst(new THREE.Ray(eye, dir.clone().normalize()), THREE.DoubleSide);
    assert.ok(!wall || wall.distance > d - 2.5, `banner ${i + 1} visible (wall at ${wall?.distance.toFixed(1)} / ${d.toFixed(1)})`);
    assert.ok(d < 100, `banner ${i + 1} in range (${d.toFixed(0)} m)`);
  }
  follow(p, [W(AKECHI.c[0] + 10, AKECHI.c[1]), at('shard_kikyo')]);
  nudge(p, 'shard_kikyo');
  assert.ok(reach(p, 'shard_kikyo'), `inside the curtain (${where(p)})`);
});
