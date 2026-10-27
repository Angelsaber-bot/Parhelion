import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { Player } from '../src/player.ts';
import { boundaryWalls, REGIONS, regionAt } from '../src/regions.ts';
import { FLEET, WRECKS, UPDRAFTS, LIGHTHOUSE, CANNON, GHOST_BOATS, SANDBAR, REEF, WRECK_SPIT } from '../tools/gen/blacksail/layout.ts';
import type { Layout } from '../src/types.ts';

// World 02 黑帆尽头: reached on foot from 幻日谷 through the east pass (once the summoning circle is
// stable), and every quest stop can be walked, glided or bridged to. Coordinates are world coordinates.
const loadRegion = async (file: string, offset: [number, number]) => {
  const buf = readFileSync(new URL(`../public/assets/${file}.glb`, import.meta.url));
  const gltf = await regionLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  bakeQuantized(gltf.scene);
  gltf.scene.position.set(offset[0], 0, offset[1]);
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
};
const def = (id: string) => REGIONS.find(r => r.id === id)!;
const roots = [await loadRegion('world_alpha', def('alpha').offset), await loadRegion('world_blacksail', def('blacksail').offset)];
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
const layout: Layout = JSON.parse(readFileSync(new URL('../public/assets/world_blacksail.layout.json', import.meta.url), 'utf8'));
const [OX, OZ] = def('blacksail').offset;
const W = (x: number, z: number): [number, number] => [x + OX, z + OZ];
const marker = (id: string) => {
  const m = layout.markers.find(m => m.id === id)!;
  return { ...m, p: [m.p[0] + OX, m.p[1], m.p[2] + OZ] as [number, number, number] };
};
const at = (id: string): [number, number] => [marker(id).p[0], marker(id).p[2]];
const ground = (x: number, z: number) => bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)!.point.y;
const idle = { x: 0, z: 0, jump: false, sprint: false };

function make(extra: string[] = []) {
  const p = new Player([{ name: 'static', bvh, enabled: true }, ...extra.map(n => ({ name: n, bvh: dynamic.get(n)!, enabled: true }))], layout.world.waterLevel);
  p.updrafts = UPDRAFTS.map(u => ({ ...u, x: u.x + OX, z: u.z + OZ }));
  return p;
}
const face = (p: Player, x: number, z: number) => { p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); };
const run = (p: Player, s: number, input = idle) => { for (let i = 0; i < s * 120; i++) p.step(1 / 120, input); };
/** Walk (sprinting, with a jump when stuck) along waypoints from the player's position. */
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
/** Deck point u along / v across a ship (same frame as the generator's ship()). */
const shipAt = (c: [number, number], ry: number, u: number, v = 0): [number, number] =>
  W(c[0] + Math.sin(ry) * u + Math.cos(ry) * v, c[1] + Math.cos(ry) * u - Math.sin(ry) * v);

test('blacksail: the east pass gate holds until the summoning circle is stable', () => {
  assert.ok(dynamic.has('COL_Seam_east_Gate'), 'gate collider exported');
  const { p } = walk([300, 30], [[360, 30], [420, 30]], ['COL_Seam_east_Gate']);
  assert.ok(p.pos.x < 343, `blocked at the pass (${where(p)})`);
});

test('blacksail: walk from the valley through the pass trail down to Nassau', () => {
  const route: [number, number][] = [[330, 30], [360, 30], ...layout.paths[0].map(([x, z]) => W(x, z))];
  const { p, k } = walk([300, 30], route);
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
  assert.equal(regionAt(p.pos.x, p.pos.z).id, 'blacksail');
  assert.ok(!p.swimming, 'stayed dry');
});

test('blacksail: every teleport destination and the spawn settle', () => {
  const spots = [...layout.areas.map(a => W(a.tp[0], a.tp[1])), at('spawn_p1')];
  for (const [x, z] of spots) {
    const p = make();
    p.teleport(x, ground(x, z) + 0.5, z);
    run(p, 5);
    assert.ok(p.onGround && !p.swimming, `settled on dry ground at ${x},${z}: ${where(p)}`);
  }
});

test('blacksail: Nassau — the tavern, the shipyard chart piece and a pier gangway onto a moored ship', () => {
  const t = walk(W(-110, 138), [W(-128, 138), W(-128, 131), at('blackbeard_meet')]);
  assert.ok(reach(t.p, 'blackbeard_meet'), `in reach of Blackbeard (${where(t.p)})`);
  const y = walk(W(-150, 120), [W(-180, 140), W(-196, 150), at('map_piece_1')]);
  for (let i = 0; i < 240 && !reach(y.p, 'map_piece_1'); i++) { face(y.p, ...at('map_piece_1')); y.p.step(1 / 120, { ...idle, z: 1 }); }
  assert.ok(reach(y.p, 'map_piece_1'), `in reach of the first chart piece (${where(y.p)})`);
  // every pier is walkable to its end and higher than the sea
  for (const x of [-170, -120, -70]) {
    const { p, k } = walk(W(x, 160), [W(x, 190), W(x, 230)], [], { jump: false });
    assert.equal(k, 2, `pier at x ${x}: stuck at ${where(p)}`);
    assert.ok(!p.swimming && p.pos.y > layout.world.waterLevel + 1, `pier at x ${x} stays dry (${where(p)})`);
  }
});

test('blacksail: the downs windmill holds the second chart piece', () => {
  const { p } = walk(W(-60, 40), [W(-40, 10), W(-24, -12), at('map_piece_2')]);
  for (let i = 0; i < 240 && !reach(p, 'map_piece_2'); i++) { face(p, ...at('map_piece_2')); p.step(1 / 120, { ...idle, z: 1 }); }
  assert.ok(reach(p, 'map_piece_2'), `in reach of the second chart piece (${where(p)})`);
});

test('blacksail: fort road → gate → gun deck; the battery has a clear shot at every ghost boat', () => {
  const route: [number, number][] = [...layout.paths[2].map(([x, z]) => W(x, z)), W(150, -176), W(176, -180), W(CANNON.c[0] - 19, CANNON.c[1] - 10), W(CANNON.c[0] - 6, CANNON.c[1] - 10), at('fort_cannon')];
  const { p, k } = walk(W(-40, 0), route);
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
  assert.ok(reach(p, 'fort_cannon'), `on the gun deck (${where(p)})`);
  for (const [i, [x, z]] of GHOST_BOATS.entries()) {
    const boat = dynamic.get(`COL_TGT_ghost_boat_${i + 1}`)!;
    const c = boat.getBoundingBox(new THREE.Box3()).getCenter(new THREE.Vector3());
    const flat = new THREE.Vector3(c.x - p.pos.x, 0, c.z - p.pos.z).normalize();
    // the rifle muzzle, and the shoulder camera 3.6 m behind and above it: both need a clear line
    for (const [what, eye] of [['muzzle', new THREE.Vector3(p.pos.x, p.pos.y + 1.3, p.pos.z)], ['camera', new THREE.Vector3(p.pos.x, p.pos.y + 1.55, p.pos.z).addScaledVector(flat, -3.4).add(new THREE.Vector3(0, 1.2, 0))]] as const) {
      const dir = c.clone().sub(eye), d = dir.length();
      const wall = bvh.raycastFirst(new THREE.Ray(eye, dir.clone().normalize()), THREE.DoubleSide);
      assert.ok(!wall || wall.distance > d - 3, `boat ${i + 1} at ${x},${z} visible from the ${what} (wall at ${wall?.distance.toFixed(1)} / ${d.toFixed(1)})`);
      assert.ok(d < 140, `boat ${i + 1} within range (${d.toFixed(0)} m)`);
    }
  }
  const shard = walk([p.pos.x, p.pos.z], [W(CANNON.c[0] - 6, CANNON.c[1] - 10), W(192, -182), W(184, -181), at('shard_powder')]);
  assert.ok(reach(shard.p, 'shard_powder'), `in reach of the powder shard (${where(shard.p)})`);
});

test('blacksail: the vortex updrafts lift the player from wreck to wreck up to the compass shard', () => {
  const p = make();
  const u0 = UPDRAFTS[0];
  p.teleport(u0.x + OX, ground(u0.x + OX, u0.z + OZ) + 0.2, u0.z + OZ);
  run(p, 0.5);
  const chain = ['w1', 'w2', 'w3', 'w4'];
  for (const [i, id] of chain.entries()) {
    const u = UPDRAFTS[i];
    for (let s = 0; s < 6 * 120 && Math.hypot(p.pos.x - u.x - OX, p.pos.z - u.z - OZ) > 0.8; s++) { face(p, u.x + OX, u.z + OZ); p.step(1 / 120, { ...idle, z: 1 }); }
    run(p, 0.1, { ...idle, jump: true });
    run(p, 9);
    assert.ok(p.pos.y > u.y1 - 10, `vent ${i} lifted to ${p.pos.y.toFixed(1)} (want ~${u.y1})`);
    const w = WRECKS.find(w => w.id === id)!;
    const t = W(w.c[0], w.c[1]);
    for (let s = 0; s < 25 * 120 && !(p.onGround && !p.inUpdraft && Math.hypot(p.pos.x - t[0], p.pos.z - t[1]) < 6); s++) {
      face(p, t[0], t[1]);
      p.step(1 / 120, { ...idle, z: Math.hypot(p.pos.x - t[0], p.pos.z - t[1]) > 1.5 ? 1 : 0 });
    }
    assert.ok(Math.abs(p.pos.y - w.y) < 1.6, `landed on ${id} at ${where(p)} (deck ${w.y})`);
  }
  for (let i = 0; i < 360 && !reach(p, 'shard_compass'); i++) { face(p, ...at('shard_compass')); p.step(1 / 120, { ...idle, z: 1 }); }
  assert.ok(reach(p, 'shard_compass'), `in reach of the compass shard (${where(p)})`);
});

test('blacksail: the sandbar reaches Skull Reef dry, the X and the half-sunk wreck', () => {
  const route: [number, number][] = [...layout.paths[4].map(([x, z]) => W(x, z)), ...SANDBAR.map(([x, z]) => W(x, z)), W(REEF.c[0] - 14, REEF.c[1] - 10), at('shard_treasure')];
  const { p, k } = walk(W(-70, 150), route);
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
  assert.ok(!p.swimming, 'stayed out of the water');
  assert.ok(reach(p, 'shard_treasure'), `at the X (${where(p)})`);
  // the sand spit from the middle of the sandbar, then stepping stones up onto the half wreck's stern
  const [sx, sz] = W(...WRECK_SPIT[WRECK_SPIT.length - 1]), [ex, ez] = at('map_piece_3');
  const stones: [number, number][] = [1, 2, 3, 4].map(k => [sx + (ex - sx) * k / 5, sz + (ez - sz) * k / 5]);
  const q = walk(W(...SANDBAR[1]), [[sx, sz], ...stones, [ex, ez]], [], { jump: true, sprint: false, tol: 0.8 });
  for (let i = 0; i < 240 && !reach(q.p, 'map_piece_3'); i++) { face(q.p, ex, ez); q.p.step(1 / 120, { ...idle, z: 1, jump: i % 40 === 0 }); }
  assert.ok(reach(q.p, 'map_piece_3'), `on the half wreck (${where(q.p)})`);
});

test('blacksail: the lighthouse spiral ramp reaches the cold lamp gallery', () => {
  const top = marker('disc_lighthouse_top');
  const [cx, cz] = W(LIGHTHOUSE.c[0], LIGHTHOUSE.c[1]), R = 5.65;
  const p = make();
  const a0 = 0.15;
  p.teleport(cx + Math.cos(a0) * R, ground(cx + Math.cos(a0) * R, cz + Math.sin(a0) * R) + 0.3, cz + Math.sin(a0) * R);
  run(p, 1);
  for (let i = 0; i < 120 * 120 && p.pos.y < top.p[1] - 0.3; i++) {
    const a = Math.atan2(p.pos.z - cz, p.pos.x - cx) + 0.4;
    face(p, cx + Math.cos(a) * R, cz + Math.sin(a) * R);
    p.step(1 / 120, { ...idle, z: 1 });
  }
  assert.ok(p.pos.y > top.p[1] - 0.5, `reached the top (${p.pos.y.toFixed(1)} / ${top.p[1].toFixed(1)})`);
});

test('blacksail: the ghost bridge carries the player from the dock across the fleet to the sea core', () => {
  const [g1, g2, flag] = FLEET;
  const Wd = (len: number) => Math.max(6, len * 0.27);
  const bow = (g: typeof g1) => shipAt(g.c, g.ry, -g.len * 0.33 - Wd(g.len) * 0.5 + 1.2);
  const stern = (g: typeof g1) => shipAt(g.c, g.ry, g.len * 0.45 - 1.0);
  const side = (g: typeof g1, u: number) => shipAt(g.c, g.ry, u, 1.6);
  const dock = W(LIGHTHOUSE.c[0] + 24, LIGHTHOUSE.c[1] + 10);
  const route: [number, number][] = [W(240, -4), W(272, -4), dock,
    bow(g1), side(g1, -g1.len * 0.2), side(g1, g1.len * 0.3), stern(g1),
    bow(g2), side(g2, -g2.len * 0.2), side(g2, g2.len * 0.3), stern(g2),
    bow(flag), side(flag, -flag.len * 0.25), side(flag, -10)];
  // without the three shards the bridge is not there: the player ends up in the sea
  const off = walk(W(214, -14), route, [], { jump: false });
  assert.ok(off.k < route.length, 'no bridge before the shards');
  const { p, k } = walk(W(214, -14), route, ['COL_Ghost_Bridge'], { jump: false });
  assert.equal(k, route.length, `stuck at ${where(p)} heading for ${route[k]}`);
  assert.ok(!p.swimming, 'stayed out of the water');
  for (let i = 0; i < 240 && !reach(p, 'sea_core'); i++) { face(p, ...at('sea_core')); p.step(1 / 120, { ...idle, z: 1 }); }
  assert.ok(reach(p, 'sea_core'), `in reach of the sea core (${where(p)})`);
  assert.ok(Math.hypot(...([0, 2].map(i => marker('boss_drowned_admiral').p[i] - marker('sea_core').p[i]) as [number, number])) < 20, 'boss stands on the same deck');
});
