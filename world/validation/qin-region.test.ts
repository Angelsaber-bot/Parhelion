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
bakeQuantized(scene); scene.position.set(OX, 0, OZ); scene.updateMatrixWorld(true);
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
const W = (x: number, y: number, z: number) => [x + OX, y, z + OZ] as const;

/** Walk through local waypoints; returns false (instead of throwing) when blocked. */
function walk(colliders: Collider[], start: readonly [number, number, number], path: readonly (readonly [number, number])[], tolerance = .6) {
  const p = new Player(colliders, 0), [sx, sy, sz] = W(...start);
  p.teleport(sx, sy + .5, sz); for (let i = 0; i < 90; i++) p.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false });
  for (const [lx, lz] of path) {
    const x = lx + OX, z = lz + OZ;
    for (let i = 0; i < 6000 && Math.hypot(p.pos.x - x, p.pos.z - z) > tolerance; i++) {
      p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); p.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false });
    }
    if (Math.hypot(p.pos.x - x, p.pos.z - z) > tolerance) return { ok: false, at: p.pos.toArray().map((v, i) => +(v - (i === 0 ? OX : i === 2 ? OZ : 0)).toFixed(1)) };
    assert.equal(p.swimming, false);
  }
  return { ok: true, at: [p.pos.x - OX, p.pos.y, p.pos.z - OZ] };
}

test('every underground room and corridor stays inside Mount Li except its two portals', () => {
  for (const r of QIN_ROOMS) for (let x = r.x0; x <= r.x1; x += 4) for (let z = r.z0; z <= r.z1; z += 4) {
    const ground = grid.sampleHeight(x + OX, z + OZ)!;
    assert.ok(ground > r.floor + r.height + 1.2, `${r.id} is covered by the mountain at ${x},${z}: ${ground.toFixed(1)}`);
    const roof = bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(...W(x, r.floor + 1.5, z)), new THREE.Vector3(0, 1, 0)), THREE.DoubleSide);
    assert.ok(roof && roof.point.y <= r.floor + r.height + .1, `${r.id} has its own ceiling at ${x},${z}`);
  }
  for (const c of QIN_CORRIDORS.filter(c => !c.portal)) for (let t = 0; t <= 1; t += .1) {
    const x = c.a[0] + (c.b[0] - c.a[0]) * t, z = c.a[2] + (c.b[2] - c.a[2]) * t, y = c.a[1] + (c.b[1] - c.a[1]) * t;
    assert.ok(grid.sampleHeight(x + OX, z + OZ)! > y + c.height + 1.2, `${c.id} is buried at ${x},${z}`);
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
    const bed = grid.sampleHeight(x + OX, z + OZ)!, bank = Math.max(grid.sampleHeight(x + OX + 7, z + OZ)!, grid.sampleHeight(x + OX, z + OZ + 7)!);
    assert.ok(bed > .5 && bank - bed > .8, `stream bed is cut but dry-land at ${x},${z}`);
  }
  const steps = new Set<number>(); for (let z = 125; z < 175; z += 1) steps.add(Math.round(grid.sampleHeight(-60 + OX, z + OZ)! * 2) / 2);
  assert.ok(steps.size >= 6, 'terraced fields step down the southern hills');
  const road = grid.sampleHeight(-70 + OX, 82 + OZ)!;
  assert.ok(grid.sampleHeight(-70 + OX, 52 + OZ)! - road > 10 && grid.sampleHeight(-70 + OX, 108 + OZ)! - road > 10, 'the pass gate sits in a real gorge');
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
  for (const l of QIN_ARMY.levers) assert.equal(qinTurnBlocked({ x: l.p[0] + OX, y: 28, z: l.p[2] + OZ }), false, `${l.id} is clear of turntables`);
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
  assert.equal(qinTurnBlocked({ x: OX, y: 28, z: -122.5 + OZ }), true);
  assert.equal(qinTurnBlocked({ x: -17 + OX, y: 28, z: -159 + OZ }), true);
  assert.equal(qinTurnBlocked({ x: OX, y: 70, z: -122.5 + OZ }), false, 'the surface above is unaffected');
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
