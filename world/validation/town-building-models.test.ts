import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { createHomeTownDistricts } from '../src/environment/homeTownDistricts';
import { createValleyTownArchitecture } from '../src/environment/valleyTownArchitecture';
import { HOME_BUILDINGS } from '../src/map/homePlan';
import { bakeQuantized, regionLoader } from '../src/rendering/glb';

test('the shipped town facades contain forty-two transparent windows, solid piers and twenty clear thresholds', async () => {
  const bytes = readFileSync(new URL('../public/assets/world_home.visual.glb', import.meta.url));
  const { scene } = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(scene);
  scene.updateMatrixWorld(true);
  const mesh = (name: string) => scene.getObjectByName(name) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const glazing = mesh('home_Glazing'), masonry = mesh('home_Buildings');
  assert.ok(glazing.material.transparent && glazing.material.opacity < .5);
  const worldMesh = (object: THREE.Mesh) => new MeshBVH(object.geometry.clone().applyMatrix4(object.matrixWorld));
  const wall = worldMesh(masonry), glass = worldMesh(glazing);
  let windows = 0;
  for (const building of HOME_BUILDINGS) {
    const [bx, by, bz] = building.p, cos = Math.cos(building.yaw), sin = Math.sin(building.yaw);
    const depth = building.d / 2 + .65;
    function scan(bvh: MeshBVH, x: number, y: number) {
      const origin = new THREE.Vector3(bx + cos * x + sin * depth, by + y, bz - sin * x + cos * depth);
      return bvh.raycastFirst(new THREE.Ray(origin, new THREE.Vector3(-sin, 0, -cos)), THREE.DoubleSide, 0, 1);
    }
    for (const y of building.kind === 'home' ? [2.64, 6.54] : [2.64]) {
      for (const side of [-1, 1]) {
        const x = side * building.w * .3 + .4;
        assert.ok(scan(glass, x, y), building.id + ' has an actual pane');
        assert.equal(scan(wall, x, y), null, building.id + ' admits light through the wall');
        windows++;
      }
    }
    assert.equal(scan(wall, 0, .33), null, building.id + ' door ramp is open through the stone skirt');
    assert.ok(scan(wall, 1.98, 1.42), building.id + ' door pier remains solid');
  }
  assert.equal(windows, 42);
  wall.geometry.dispose();
  glass.geometry.dispose();
});

test('the quay wheel turns as one mesh around its stationary axle and freezes outside the town or on pause', () => {
  const town = createHomeTownDistricts(() => 6, () => 24);
  try {
    const wheel = town.root.getObjectByName('HomeLeveePaddleWheel')!;
    assert.equal(wheel.children.length, 1);
    const geometry = (wheel.children[0] as THREE.Mesh).geometry;
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    assert.ok(bounds.min.y < -2.1 && bounds.max.y > 2.1 && bounds.min.z < -2.1 && bounds.max.z > 2.1);
    const axle = wheel.position.clone();
    town.update(axle, 1 / 60);
    assert.ok(wheel.rotation.x > 0);
    const running = wheel.rotation.x;
    town.update(axle, 0);
    town.update(new THREE.Vector3(), .2);
    assert.equal(wheel.rotation.x, running);
    assert.deepEqual(wheel.position, axle);
  } finally { town.dispose(); }
});

test('both valley annex windows admit light between collision mullions, with complete roof slopes and side walls', () => {
  const ground = 10, valley = createValleyTownArchitecture(() => ground);
  try {
    const bvh = valley.colliders.find(c => c.name === 'COL_ValleyCanteenAnnex')!.bvh;
    const acrossWall = (z: number, y: number) => bvh.raycastFirst(
      new THREE.Ray(new THREE.Vector3(-183.6, ground + y, z), new THREE.Vector3(1, 0, 0)), THREE.DoubleSide, 0, 1);
    for (const z of [186.3, 190.9]) {
      assert.equal(acrossWall(z, 1.97), null);
      assert.ok(acrossWall(z + .265, 1.97));
      assert.ok(acrossWall(z, 1.32));
    }
    assert.ok(acrossWall(188.4, 1.97));
    const annex = valley.root.getObjectByName('ValleyCanteenAnnex')!;
    const raycaster = new THREE.Raycaster();
    const roofHeight = (x: number) => {
      raycaster.set(new THREE.Vector3(x, ground + 6, 189), new THREE.Vector3(0, -1, 0));
      return raycaster.intersectObject(annex, true)[0].point.y;
    };
    const ridge = roofHeight(-179.5), west = roofHeight(-182.6), east = roofHeight(-176.4);
    assert.ok(ridge > west + .9 && Math.abs(west - east) < .05);
  } finally { valley.dispose(); }
});
