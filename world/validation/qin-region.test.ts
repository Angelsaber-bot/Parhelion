import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import { Player, type Collider } from '../src/player/player';
import { WorldGrid } from '../src/map/grid';
import { EXPANSION_PLANS } from '../src/map/worldPlan';
import { QIN_ARMY, QIN_OFFSET, QIN_ROOMS, QIN_CORRIDORS, QIN_STREAM } from '../src/map/qinPlan';
import { createQinArmyOrder, qinOrderPhase, qinTurnBlocked, toggleQinOrder, QIN_RANK_SWEEP } from '../src/environment/qinArmyOrder';

const [OX, OZ] = QIN_OFFSET;
const bytes = readFileSync(new URL('../public/assets/world_qin.core.glb', import.meta.url));
const { scene } = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
bakeQuantized(scene); scene.position.set(OX, 0, OZ); scene.rotation.y = Math.PI; scene.updateMatrixWorld(true); // the region stands turned half a circle
const geos: THREE.BufferGeometry[] = [];
scene.getObjectByName('COLLISION')!.traverse(o => {
  const m = o as THREE.Mesh; if (!m.isMesh) return;
  let g = new THREE.BufferGeometry().setAttribute('position', m.geometry.attributes.position.clone());
  if (m.geometry.index) g.setIndex(m.geometry.index.clone()); g.applyMatrix4(m.matrixWorld); if (g.index) g = g.toNonIndexed(); geos.push(g);
});
const bvh = new MeshBVH(mergeGeometries(geos));
const staticCollider: Collider = { name: 'qin', bvh, enabled: true };
const terrain = scene.getObjectByName('Terrain') as THREE.Mesh;
const grid = new WorldGrid([terrain], OX - 360, OZ - 360, 720, 2);
const layout = JSON.parse(readFileSync(new URL('../public/assets/world_qin.layout.json', import.meta.url), 'utf8'));
const W = (x: number, y: number, z: number) => [OX - x, y, OZ - z] as const;

/** Walk through local waypoints; returns false (instead of throwing) when blocked. */
function walk(colliders: Collider[], start: readonly [number, number, number], path: readonly (readonly [number, number])[], tolerance = .6) {
  const p = new Player(colliders, 0), [sx, sy, sz] = W(...start);
  p.teleport(sx, sy + .5, sz); for (let i = 0; i < 90; i++) p.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false });
  for (const [lx, lz] of path) {
    const x = OX - lx, z = OZ - lz;
    for (let i = 0; i < 6000 && Math.hypot(p.pos.x - x, p.pos.z - z) > tolerance; i++) {
      p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); p.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false });
    }
    if (Math.hypot(p.pos.x - x, p.pos.z - z) > tolerance) return { ok: false, at: p.pos.toArray().map((v, i) => +(i === 0 ? OX - v : i === 2 ? OZ - v : v).toFixed(1)) };
    assert.equal(p.swimming, false);
  }
  return { ok: true, at: [OX - p.pos.x, p.pos.y, OZ - p.pos.z] };
}

test('every underground room and corridor stays inside Mount Li except its two portals', () => {
  for (const r of QIN_ROOMS) for (let x = r.x0; x <= r.x1; x += 4) for (let z = r.z0; z <= r.z1; z += 4) {
    if (r.id === 'army' && Math.abs(x - QIN_LIFT.x) < QIN_LIFT.half + 1 && Math.abs(z - QIN_LIFT.z) < QIN_LIFT.half + 1) continue; // the lift shaft opens the roof here
    const ground = grid.sampleHeight(OX - x, OZ - z)!;
    assert.ok(ground > r.floor + r.height + 1.2, `${r.id} is covered by the mountain at ${x},${z}: ${ground.toFixed(1)}`);
    const roof = bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(...W(x, r.floor + 1.5, z)), new THREE.Vector3(0, 1, 0)), THREE.DoubleSide);
    assert.ok(roof && roof.point.y <= r.floor + r.height + .1, `${r.id} has its own ceiling at ${x},${z}`);
  }
  for (const c of QIN_CORRIDORS.filter(c => !c.portal)) for (let t = 0; t <= 1; t += .1) {
    const x = c.a[0] + (c.b[0] - c.a[0]) * t, z = c.a[2] + (c.b[2] - c.a[2]) * t, y = c.a[1] + (c.b[1] - c.a[1]) * t;
    assert.ok(grid.sampleHeight(OX - x, OZ - z)! > y + c.height + 1.2, `${c.id} is buried at ${x},${z}`);
  }
  assert.equal(QIN_CORRIDORS.filter(c => c.portal).length, 2, 'palace incline and quarry maintenance tunnel are the daylight entrances');
  const portals = QIN_CORRIDORS.filter(c => c.portal).map(c => c.portal === 'a' ? c.a[1] : c.b[1]);
  assert.ok(Math.max(...portals) - Math.min(...portals) > 30, 'entrances lie at very different heights on the mountain');
  const floors = QIN_ROOMS.filter(r => ['foundry', 'army', 'royal'].includes(r.id));
  const centres = floors.map(r => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]);
  for (let i = 0; i < centres.length; i++) for (let j = i + 1; j < centres.length; j++) assert.ok(Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]) > 60, 'the three layers are staggered, not stacked');
});

test('surface: stream, terraces, pass gorge and palace platforms read in the terrain', () => {
  for (const [x, , z] of QIN_STREAM.slice(1, -1)) {
    const bed = grid.sampleHeight(OX - x, OZ - z)!, bank = Math.max(grid.sampleHeight(OX - x - 7, OZ - z)!, grid.sampleHeight(OX - x, OZ - z - 7)!);
    assert.ok(bed > .5 && bank - bed > .8, `stream bed is cut but dry-land at ${x},${z}`);
  }
  const steps = new Set<number>(); for (let z = 125; z < 175; z += 1) steps.add(Math.round(grid.sampleHeight(OX - -60, OZ - z)! * 2) / 2);
  assert.ok(steps.size >= 6, 'terraced fields step down the southern hills');
  const road = grid.sampleHeight(OX - -70, OZ - 82)!;
  assert.ok(grid.sampleHeight(OX - -70, OZ - 52)! - road > 10 && grid.sampleHeight(OX - -70, OZ - 108)! - road > 10, 'the pass gate sits in a real gorge');
  for (const [x, z, y] of [[40, 60, 58], [40, -30, 70], [90, -32, 82]] as const) {
    const hit = bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(...W(x, y + 1, z)), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide);
    assert.ok(hit && Math.abs(hit.point.y - y) < .3, `platform floor at ${x},${z}`);
  }
  const roof = bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(...W(40, 72, -2)), new THREE.Vector3(0, 1, 0)), THREE.DoubleSide);
  assert.ok(roof && roof.point.y > 78, 'the front hall is roofed');
});

test('artisan town: houses, kilns, foundry shed, archive and quarry are walkable from the street', () => {
  const houses = layout.development.houses as { position: [number, number, number]; width: number; depth: number; rotation: number; approach: [number, number, number] }[];
  assert.ok(houses.length >= 12, `${houses.length} houses`);
  for (const [i, h] of houses.entries()) {
    const [x, , z] = h.position, inside = h.depth / 2 - 1.2, dx = Math.sin(h.rotation), dz = Math.cos(h.rotation);
    const r = walk([staticCollider], h.approach, [[x + dx * inside, z + dz * inside], [x, z], [h.approach[0], h.approach[2]]], .35);
    assert.ok(r.ok, `house ${i} at ${h.position}: blocked at ${r.at}`);
  }
  for (const site of ['kilns', 'archive', 'quarry']) {
    const s = EXPANSION_PLANS.find(p => p.id === 'qin')!.sites.find(x => x.id === site)!;
    // The archive is entered through its door, which faces the town square.
    const a = Math.atan2(-185 - s.position[0], 100 - s.position[2]), door = (r: number) => [s.position[0] + Math.sin(a) * r, s.position[2] + Math.cos(a) * r] as const;
    const path = site === 'archive' ? [door(9), door(1)] : site === 'quarry' ? [[-150, 96], [-140, 60], [-122, 26], [-125, -8], [-128, -42]] as const : [[s.position[0], s.position[2]] as const];
    const r1 = walk([staticCollider], [-185, 22, 100], path, 1.2);
    assert.ok(r1.ok || walk([staticCollider], [-185, 22, 100], [[-195, 70], ...path], 1.2).ok, `${site} reachable: ${r1.at}`);
  }
});

test('army order: turning the command posts swaps which file of ranks is open and lifts the shaft gate', () => {
  const order = createQinArmyOrder(), done = new Set<string>();
  const colliders = [staticCollider, ...order.colliders];
  order.apply(done);
  assert.equal(qinOrderPhase(done), 'a');
  const east: [number, number, number] = [20, 28, -115], west: [number, number, number] = [-50, 28, -115], middle: [number, number] = [-17, -126];
  // Crossing a row means walking the 10 m aisle at z=-115 between rank centres.
  const crossEast = [[-17, -115], middle] as const, crossWest = [[-17, -115], middle] as const;
  // Phase A (守陵阵): east row closed, west row open, shaft gate down.
  assert.equal(walk(colliders, east, crossEast).ok, false, 'phase A seals the east row');
  assert.equal(walk(colliders, west, crossWest).ok, true, 'phase A opens the west row');
  assert.equal(walk(colliders, [-17, 28, -130], [[-17, -170]]).ok, false, 'phase A keeps the shaft gate down');
  // Every lever stays usable: none lies in a turntable sweep, and each is reachable in both phases from its zone.
  for (const l of QIN_ARMY.levers) assert.equal(qinTurnBlocked({ x: OX - l.p[0], y: 28, z: OZ - l.p[2] }), false, `${l.id} is clear of turntables`);
  const approach = { east: [east, [[27, -118], [27, -148], [17.8, -150.2]]], west: [west, [[-51.8, -150.2]]], middle: [[-17, 28, -126], [[-17, -105.8]]] } as const;
  for (const phase of ['a', 'b'] as const) {
    if (qinOrderPhase(done) !== phase) toggleQinOrder(done); order.apply(done, true);
    for (const l of QIN_ARMY.levers) { const [start, path] = approach[l.zone]; const r = walk(colliders, start, path, 1); assert.ok(r.ok, `${l.id} reachable in phase ${phase}: ${r.at}`); }
  }
  // Phase B (让道阵): east row open, west row closed, shaft open down to the royal city.
  if (qinOrderPhase(done) !== 'a') toggleQinOrder(done); order.apply(done, true);
  toggleQinOrder(done); order.apply(done);
  assert.equal(qinOrderPhase(done), 'b');
  assert.equal(order.turning, true, 'the ranks visibly turn instead of snapping');
  for (let i = 0; i < 400; i++) order.update(1 / 60);
  assert.equal(order.turning, false);
  assert.equal(walk(colliders, east, crossEast).ok, true, 'phase B opens the east row');
  assert.equal(walk(colliders, west, crossWest).ok, false, 'phase B seals the west row behind');
  const deep = walk(colliders, [-17, 28, -130], [[-17, -160], [-17, -188], [-10, -190], [31, -190], [38, -190]]);
  assert.ok(deep.ok && Math.abs(deep.at[1] - 10) < .6, `phase B opens the way to the buried royal city: ${deep.at}`);
  // A player standing on a turntable or under the gate prevents the turn.
  assert.equal(qinTurnBlocked({ x: OX, y: 28, z: OZ - -122.5 }), true);
  assert.equal(qinTurnBlocked({ x: OX - -17, y: 28, z: OZ - -159 }), true);
  assert.equal(qinTurnBlocked({ x: OX, y: 70, z: OZ - -122.5 }), false, 'the surface above is unaffected');
  assert.ok(QIN_RANK_SWEEP > QIN_ARMY.rankLength / 2);
  order.dispose();
});

test('sneaking route: quarry tunnel → garrison → foundry → palace works only by turning the order', () => {
  const order = createQinArmyOrder(), done = new Set<string>(), colliders = [staticCollider, ...order.colliders];
  order.apply(done, true);
  const toMiddle = walk(colliders, [-128, 28, -42], [[-125, -56], [-125, -113], [-60, -115], [-50, -115], [-17, -115], [-17, -126]]);
  assert.ok(toMiddle.ok, `quarry tunnel into the garrison's middle file: ${toMiddle.at}`);
  assert.equal(walk(colliders, [-17, 28, -126], [[-17, -115], [20, -115]]).ok, false, 'cannot cross the east row yet');
  toggleQinOrder(done); order.apply(done, true);
  const up = walk(colliders, [-17, 28, -126], [[-17, -115], [20, -115], [30, -115], [100, -115], [106, -115], [106, -72.5], [100, -72.5], [44.5, -72.5], [40, -72.5], [40, -68], [40, -44], [40, -30]]);
  assert.ok(up.ok && Math.abs(up.at[1] - 70) < .6, `rail incline, foundry and palace incline lead up to the rear court: ${up.at}`);
  order.dispose();
});

import { qinResidentSockets, createQinResidentLife } from '../src/map/qinResidents';
import { createSettlementNpcs } from '../src/settlements/npcs';
test('Lishan residents give their own directions, stand grounded with body clearance, and the courier walks the post road', () => {
  const sockets = qinResidentSockets(), original = JSON.stringify(sockets), system = createSettlementNpcs(sockets);
  const ground = (x: number, z: number, ceiling: number) => bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, ceiling, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)?.point.y ?? null;
  const life = createQinResidentLife(system, ground);
  assert.ok(sockets.length >= 8 && sockets.every(s => s.worldRegion === 'qin'));
  assert.equal(new Set(sockets.map(s => s.lines[0][0])).size, sockets.length, 'no two residents repeat each other');
  for (const s of sockets) {
    const line = system.interact(s.id)!; assert.ok(line[0].length > 10 && line[1].length > 20);
    const p = system.getPosition(s.id)!, floor = ground(p[0], p[2], p[1] + 1); assert.ok(floor !== null && Math.abs(floor - p[1]) < .18, `${s.id} is grounded at ${p}`);
    const visitor = new Player([staticCollider], 0); visitor.teleport(p[0], p[1] + .6, p[2]);
    for (let j = 0; j < 120; j++) visitor.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false });
    assert.ok(Math.hypot(visitor.pos.x - p[0], visitor.pos.z - p[2]) < .25 && Math.abs(visitor.pos.y - floor!) < .25, `${s.id} has full body clearance`);
  }
  const start = system.getPosition('qin_courier')!, viewer = new THREE.Vector3(start[0] + 8, start[1], start[2] + 5);
  for (let i = 0; i < 900; i++) { system.update(1 / 60, viewer); life.update(1 / 60, viewer, null, true); }
  const end = system.getPosition('qin_courier')!; assert.ok(Math.hypot(end[0] - start[0], end[2] - start[2]) > 5, 'the courier visibly walks');
  for (let i = 0; i < 120; i++) life.update(1 / 60, viewer, 'qin_courier', true); assert.deepEqual(system.getPosition('qin_courier'), end, 'conversation pauses the courier');
  assert.equal(JSON.stringify(sockets), original); life.dispose(); system.dispose();
});

import { createQinLift } from '../src/environment/qinLift';
import { QIN_LIFT } from '../src/map/qinPlan';
test('lift: ride from the ridge headframe down the shaft into the garrison avenue and back up', () => {
  const lift = createQinLift(), colliders = [staticCollider, ...lift.colliders];
  const p = new Player(colliders, 0), go = (x: number, z: number) => {
    for (let i = 0; i < 4000 && Math.hypot(p.pos.x - (OX - x), p.pos.z - (OZ - z)) > .4; i++) { p.yaw = Math.atan2(-(OX - x - p.pos.x), -(OZ - z - p.pos.z)); p.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false }); lift.update(1 / 120, p.pos); }
    return Math.hypot(p.pos.x - (OX - x), p.pos.z - (OZ - z)) <= .4;
  };
  const settle = (frames: number) => { for (let i = 0; i < frames; i++) { lift.update(1 / 120, p.pos); p.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false }); } };
  p.teleport(OX - -17, 95.6, OZ - -141); settle(90);
  assert.ok(go(-17, -135) && go(-17, -130), `walk from the ridge path onto the cage: ${p.pos.toArray()}`);
  assert.ok(Math.abs(p.pos.y - QIN_LIFT.top) < .4, 'the cage waits flush with the deck');
  assert.equal(lift.operate(), 'bottom');
  settle(120 * 30);
  assert.equal(lift.moving, false); assert.ok(Math.abs(p.pos.y - QIN_LIFT.bottom) < .4, `carried down to the garrison floor: ${p.pos.y}`); assert.equal(p.swimming, false);
  assert.ok(go(-17, -124), 'step off into the central avenue');
  // The shaft mouth is barred while the cage is below: nobody walks into the hole.
  const q = new Player(colliders, 0); q.teleport(OX - -17, QIN_LIFT.top + .6, OZ - -139);
  for (let i = 0; i < 600; i++) { q.yaw = 0 /* authored south, turned half a circle */; q.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false }); }
  assert.ok(q.pos.y > QIN_LIFT.top - .5, `the bar holds at the mouth: ${q.pos.toArray()}`);
  assert.ok(go(-17, -130)); assert.equal(lift.operate(), 'top'); settle(120 * 30);
  assert.ok(Math.abs(p.pos.y - QIN_LIFT.top) < .4, `carried back up: ${p.pos.y}`);
  assert.ok(go(-17, -135) && go(-17, -140), 'step back across the deck onto the ridge path');
  lift.dispose();
});

import { createQinSentinels, qinSentinelFlag } from '../src/environment/qinSentinels';
test('tomb guardians patrol, chase and evict an intruder, and are ground down when lured beside a turning rank', () => {
  const s = createQinSentinels(), done = new Set<string>(), east = s.guards.find(g => g.def.id === 'east')!;
  s.apply(done);
  const far = { x: OX - 200, y: 70, z: OZ }, start = [east.x, east.z];
  for (let i = 0; i < 300; i++) s.update(1 / 60, far, done);
  assert.ok(Math.hypot(east.x - start[0], east.z - start[1]) > 3, 'the guardian walks its beat');
  // Spotted in the open east zone: it gives chase and sends the intruder back to the entrance.
  east.x = 20; east.z = -130; east.yaw = -Math.PI / 2; east.mode = 'patrol';
  let back: [number, number, number] | null = null; const intruder = { x: OX - 14, y: 28, z: OZ - -130 };
  for (let i = 0; i < 600 && !back; i++) back = s.update(1 / 60, intruder, done);
  assert.ok(back && Math.abs(back[0] - (OX - 27)) < .01, 'caught and returned to the east entrance');
  // Lure: phase A seals the east file; the guardian presses against it chasing someone beyond.
  east.x = 6; east.z = -130; east.yaw = -Math.PI / 2; east.mode = 'patrol';
  const beyond = { x: OX - -2.5, y: 28, z: OZ - -130 };
  for (let i = 0; i < 400; i++) assert.equal(s.update(1 / 60, beyond, done), null, 'a closed file stops the chase');
  assert.ok(east.x >= 2.99 && east.x < 4, `pressed against the file at ${east.x}`);
  toggleQinOrder(done); const crushed = s.orderTurned(done);
  assert.deepEqual(crushed, ['east']); assert.ok(done.has(qinSentinelFlag('east')));
  for (let i = 0; i < 200; i++) s.update(1 / 60, { x: OX - east.x, y: 28, z: OZ - east.z }, done);
  assert.equal(east.mode, 'broken'); assert.equal(east.group.visible, false);
  s.dispose();
});
