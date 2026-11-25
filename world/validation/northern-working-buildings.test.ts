import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createKingdomRoadLandscape } from '../src/environment/kingdomRoadLandscape';
import { createWinterMillArchitecture } from '../src/environment/winterMillArchitecture';
import { createWinterMillBridge } from '../src/environment/winterMillBridge';
import { createWinterCivilLandscape } from '../src/environment/winterCivilLandscape';
import { WINTER_CUSTOMS, WINTER_FLAG_RAIL, WINTER_SCHOOL } from '../src/map/winterCivilPlan';
import { buildBritainSettlement } from '../src/settlements/britain';
import { buildWinterSettlement } from '../src/settlements/winter';
import { gatePoint } from '../src/story/kingdomGate';
import { KINGDOM_ROAD as K } from '../src/story/kingdomRoad';
import { WINTER_MILL_BRIDGE as B, WINTER_WITHDRAWAL as W } from '../src/story/winterWithdrawal';

type Point = [number, number, number];
const down: Point = [0, -1, 0];
function first(root: THREE.Object3D, origin: Point, direction: Point) {
  root.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction)).intersectObject(root, true)[0];
}

test('the outer gate folds on its local axle and settles against the playable cart deck', () => {
  const road = createKingdomRoadLandscape(() => 31);
  try {
    const shutter = road.root.getObjectByName('KingdomOuterGateShutter')!;
    const built = new Set([K.front, K.finish]);
    road.apply(new Set()); road.apply(built, 1.4);
    shutter.updateMatrixWorld(true);
    const left = shutter.localToWorld(new THREE.Vector3(-3, 6, 0));
    const right = shutter.localToWorld(new THREE.Vector3(3, 6, 0));
    assert.ok(Math.abs(left.y - right.y) < 1e-5, 'both ends stay level mid-travel');
    road.apply(built, 1.4);
    const deck = road.colliders.find(c => c.name === 'COL_KingdomPermanentCartBridge')!;
    assert.ok(deck.enabled);
    assert.ok(shutter.children.length <= 2);
    for (const s of [-3, -.9, 1.1, 3.1]) for (const along of [16.3, 18.5, 22]) {
      const origin = gatePoint(s, along, 2);
      const visible = first(shutter, origin, down);
      const physical = deck.bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(...origin),new THREE.Vector3(...down)), THREE.DoubleSide);
      assert.ok(visible && physical, 'shutter covers the width of the marked bridge');
      assert.ok(Math.abs(visible.point.y - physical.point.y) < .025, 'boards land against the collision ribbon');
    }
  } finally { road.dispose(); }
});

test('forge shutters open through the facade and the stable water is visible below its stone rim', () => {
  const forge = buildBritainSettlement().group;
  for (const x of [-14.2, -5.8]) for (const offset of [-.4, 0, .4]) {
    assert.ok((first(forge, [x + offset, 2.55, 6.8], [0,0,-1])?.distance ?? Infinity) > 1.4);
    assert.ok((first(forge, [x + offset, 2.55, 5.25], [0,0,1])?.distance ?? Infinity) > 1.4);
  }
  const water = first(forge, [12.8, 2, 10], down)!;
  const rim = first(forge, [12.8, 2, 10.52], down)!;
  assert.equal((water.object as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.color.getHexString(), '829b9b');
  assert.ok(rim.point.y - water.point.y > .10);
});

test('Everwinter canvas sits on its bearers and both mill doorways remain visually open', () => {
  const shelter = buildWinterSettlement().group;
  for (const x of [4,14]) for(const z of [-12,-7,-2,3]) {
    const canvas = 3.7 - Math.tan(.095) * (z + 4.5);
    const top = first(shelter, [x, 6, z], down)!;
    assert.ok(Math.abs(top.point.y - canvas) < .2, 'posts do not pierce the canvas');
    const bearing = first(shelter, [x-.5,canvas-.42,z], [1,0,0])!;
    assert.ok(bearing.distance < .4, 'post reaches the cross bearer at each height');
  }
  const mill = createWinterMillArchitecture([32,0,9], () => 0);
  try {
    for (const h of [.6,1.55,3.59]) {
      assert.ok((first(mill.root, [0,h,8], [0,0,-1])?.distance ?? Infinity) > 1.7, 'front threshold');
      assert.ok((first(mill.root, [6.6,h,0], [-1,0,0])?.distance ?? Infinity) > 1.7, 'river threshold');
    }
    for (const sign of [-1,1]) for (const x of [-2,2]) {
      const face = first(mill.root, [x,6,sign*9], [0,0,-sign]);
      assert.ok(face && face.distance < 2.1, 'both loft ends are closed against snow');
    }
  } finally { mill.dispose(); }
});

test('the school awning has a roof over each post, and the stove pipe reaches daylight', () => {
  const school = createWinterCivilLandscape(() => WINTER_SCHOOL.ground);
  try {
    const y = WINTER_SCHOOL.floor, worldZ = (z: number) => z - 720;
    for (const x of [21.6,28.75]) for (const z of [-84.15,-78.85]) {
      assert.ok((first(school.root,[x,y+6,worldZ(z)],down)?.distance ?? Infinity) < 3);
      assert.ok((first(school.root,[x-.5,y+1.8,worldZ(z)],[1,0,0])?.distance ?? Infinity) < .45);
    }
    const chimney = first(school.root,[9,y+8,worldZ(-87.3)],down);
    assert.ok(chimney && chimney.point.y > y+6.15);
  } finally { school.dispose(); }
});

test('the mill race carries the mill axle while both door ramps stay usable on sloping terrain', () => {
  const ground = (x: number, z: number) => .04 * z + .012 * x;
  const mill = createWinterMillArchitecture([32, 0, 9], ground);
  try {
    const ice = first(mill.root, [-7.4, .82, 1.79], down);
    assert.ok(ice && Math.abs(ice.point.y - .4485) < .005, 'ice is contained within the channel');
    const outer = first(mill.root, [-10, 2.69, -1.5], [1, 0, 0]);
    assert.ok(outer && Math.abs(outer.point.x + 8.94) < .02, 'the outer bearing surrounds the axle');
    const shaft = first(mill.root, [-8.34, 3, -1.5], down);
    assert.ok(shaft && Math.abs(shaft.point.y - 2.86) < .01, 'the axle spans the gap between the rotor and its bearing');
    for (const dx of [-8.79, -5.91]) {
      const probe: Point = [dx, 2.1, -1.5];
      const bearing = mill.collider.bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(...probe), new THREE.Vector3(0, 1, 0)), THREE.DoubleSide);
      assert.ok(bearing && bearing.point.y < 2.5, 'both bearings are supported by posts');
    }
    for (const [x, z] of [[0, 12.7], [0, 16.5], [7.45, 0]]) {
      const origin = new THREE.Vector3(x, 2, z);
      const walking = mill.collider.bvh.raycastFirst(new THREE.Ray(origin, new THREE.Vector3(...down)), THREE.DoubleSide);
      const drawn = first(mill.root, [x, 2, z], down);
      assert.ok(walking && drawn && walking.point.y > ground(x, z));
      assert.ok(Math.abs(walking.point.y - drawn.point.y) < .026, 'wooden approach covers its collision ramp');
    }
  } finally { mill.dispose(); }
});

test('withdrawal bridge trestles seat on uneven ice and the unlocked cart deck remains flush', () => {
  const bed = (x: number) => x < 64 ? 1.18 : 1.65;
  const bridge = createWinterMillBridge([90, 3, -580], bed);
  try {
    const deck = bridge.root.getObjectByName('WinterMillWithdrawalBridge')!;
    bridge.apply(new Set(), 0);
    assert.equal(deck.visible, false);
    assert.equal(bridge.collider.enabled, false);
    bridge.apply(new Set([W.mill]), 0);
    assert.equal(deck.visible, true);
    assert.equal(bridge.collider.enabled, true);
    const forward = new THREE.Vector3(...B.south).sub(new THREE.Vector3(...B.north)).normalize();
    const side = new THREE.Vector3(forward.z, 0, -forward.x);
    const center = new THREE.Vector3(...B.north).addScaledVector(forward, 20);
    for (const sign of [-1, 1]) {
      const foot = center.clone().addScaledVector(side, sign * 2.48);
      const height = bed(foot.x);
      const contact = first(deck, [foot.x, height - .2, foot.z], [0, 1, 0]);
      assert.ok(contact && contact.point.y >= height - .10 && contact.point.y <= height, 'each pier reaches its own bed');
    }
    const origin = center.clone().add(new THREE.Vector3(0, 1, 0));
    const visible = first(deck, origin.toArray(), down);
    const level = bridge.collider.bvh.raycastFirst(new THREE.Ray(origin, new THREE.Vector3(...down)), THREE.DoubleSide);
    assert.ok(visible && level && Math.abs(visible.point.y - level.point.y) < .01, 'the played deck matches the timber planks');
  } finally { bridge.dispose(); }
});

test('winter civic models sit on the existing routes: roof snow, dressed pavement and bridge bents', () => {
  const bed = (z: number) => z < -492 ? 1.09 : 1.25;
  const scene = createWinterCivilLandscape((_x, z, ceiling) => z > -494 && z < -490 && ceiling < 3 ? bed(z) : WINTER_SCHOOL.ground);
  const ray = (origin: Point, direction: Point, far = Infinity) =>
    scene.collider.bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(...origin), new THREE.Vector3(...direction)), THREE.DoubleSide, 0, far);
  try {
    const roof = (x: number, z: number) => {
      const origin: Point = [x, 20, z - 720];
      const snow = first(scene.root, origin, down)!;
      const boards = ray(origin, down)!;
      assert.ok(snow && boards);
      return snow.point.y - boards.point.y;
    };
    assert.ok(roof(10.1, -98.7) > .014, 'the snow lies on the intact roof slope');
    assert.ok(Math.abs(roof(17.35, -98.7)) < .005, 'the torn ridge exposes the original roof boards');
    assert.ok(ray([25.4, 20, -812], down)!.point.y < WINTER_SCHOOL.floor + 2.5, 'the burnt bay stays open to the sky');
    const paving: Point = [-77.4, WINTER_CUSTOMS.floor + .8, 229.2 - 720];
    assert.ok(Math.abs(first(scene.root, paving, down)!.point.y - WINTER_CUSTOMS.floor - .037) < .003);
    assert.ok(Math.abs(ray(paving, down)!.point.y - WINTER_CUSTOMS.floor) < .003);
    // The shutters belong to the side walls, and both shop doors still open at floor level.
    assert.equal(ray([-98, WINTER_CUSTOMS.floor + 1.4, 230 - 720], [0, 0, 1], 3.4), null);
    assert.equal(ray([-98, WINTER_CUSTOMS.floor + 1.4, 260 - 720], [0, 0, -1], 3.4), null);
    const gallery = WINTER_CUSTOMS.floor + 4.4;
    for (const x of [-104.23, -91.79]) for (const z of [233.1, 244.1, 257.02]) {
      assert.ok(Math.abs(ray([x, gallery + .5, z - 720], down)!.point.y - gallery) < .002, 'the snowed roof edges have a continuous solid deck');
    }
    for (const z of [226.84 - 720, 229.16 - 720]) {
      const ground = bed(z);
      const foot = ray([-4.7, ground - .18, z], [0, 1, 0], .34);
      assert.ok(foot && Math.abs(foot.point.y - ground + .075) < .002, 'each post seats on its own ice height');
    }
    const deck = ray([-4.7, WINTER_FLAG_RAIL.deck + .5, -492], down);
    assert.ok(deck && Math.abs(deck.point.y - WINTER_FLAG_RAIL.deck) < .002, 'the supported crown remains the walking height');
  } finally { scene.dispose(); }
});
