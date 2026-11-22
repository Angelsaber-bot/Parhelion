import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createKingdomRoadLandscape } from '../src/environment/kingdomRoadLandscape';
import { createWinterMillArchitecture } from '../src/environment/winterMillArchitecture';
import { createWinterCivilLandscape } from '../src/environment/winterCivilLandscape';
import { WINTER_SCHOOL } from '../src/map/winterCivilPlan';
import { buildBritainSettlement } from '../src/settlements/britain';
import { buildWinterSettlement } from '../src/settlements/winter';
import { gatePoint } from '../src/story/kingdomGate';
import { KINGDOM_ROAD as K } from '../src/story/kingdomRoad';

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
