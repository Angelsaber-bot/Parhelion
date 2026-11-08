/** Actual shipped Black Sail core/visual meshes plus the production hold.
 * FrontSide art rays test what the player sees; real BVHs test support/clearance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import { createFlagshipInterior } from '../src/environment/flagshipInterior';
import { flagshipPoint as P } from '../src/map/shipInteriorCut';
import { Player, type Collider } from '../src/player/player';

const roots = await Promise.all(['core', 'visual'].map(async kind => {
  const bytes = await readFile(new URL(`../public/assets/world_blacksail.${kind}.glb`, import.meta.url));
  const { scene } = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(scene); scene.position.x = 720; scene.updateMatrixWorld(true); return scene;
}));
const staticParts: THREE.BufferGeometry[] = [];
roots[0].getObjectByName('COLLISION')!.traverse(object => {
  const mesh = object as THREE.Mesh; if (!mesh.isMesh) return;
  let geometry = new THREE.BufferGeometry().setAttribute('position', mesh.geometry.attributes.position.clone());
  if (mesh.geometry.index) geometry.setIndex(mesh.geometry.index.clone());
  geometry.applyMatrix4(mesh.matrixWorld);
  if (geometry.index) { const indexed = geometry; geometry = indexed.toNonIndexed(); indexed.dispose(); }
  staticParts.push(geometry);
});
const staticGeometry = mergeGeometries(staticParts), staticBvh = new MeshBVH(staticGeometry);
for (const geometry of staticParts) geometry.dispose();
for (const root of roots) for (const name of ['COLLISION', 'MARKERS']) { const hidden = root.getObjectByName(name); if (hidden) hidden.visible = false; }
function fixture() {
  const hold = createFlagshipInterior(); hold.root.updateMatrixWorld(true);
  const art = [...roots, hold.root];
  const colliders: Collider[] = [{ name: 'BlackSail_ProductionCore', bvh: staticBvh, enabled: true }, ...hold.colliders];
  const artRay = (origin: THREE.Vector3, direction: THREE.Vector3, max: number) =>
    new THREE.Raycaster(origin, direction, 0, max).intersectObjects(art, true).filter(hit => {
      let object: THREE.Object3D | null = hit.object;
      while (object) { if (!object.visible) return false; object = object.parent; } return true;
    });
  const physicalRay = (origin: THREE.Vector3, direction: THREE.Vector3, max: number) => colliders.flatMap(c =>
    c.bvh.raycast(new THREE.Ray(origin, direction), THREE.DoubleSide, 0, max)).sort((a, b) => a.distance - b.distance);
  return { hold, colliders, artRay, physicalRay };
}
const up = new THREE.Vector3(0, 1, 0), down = new THREE.Vector3(0, -1, 0);
test('flagship record hold has a visible timber underside wherever the actual deck collision closes overhead', () => {
  const f = fixture();
  try {
    for (const [u, v] of [[3.2, .43], [5.3, -.6], [10.2, .4], [12, 1], [8, 2.5]]) {
      const origin = new THREE.Vector3(...P(u, v, 5));
      const physical = f.physicalRay(origin, up, 2.1)[0], visible = f.artRay(origin, up, 2.1)[0];
      assert.ok(physical && Math.abs(physical.point.y - 6.7) < .02, `original overhead collision ${u},${v}`);
      assert.ok(visible, `the cabin ceiling must not show the sky at ${u},${v}`);
      assert.ok(visible.point.y <= physical.point.y && physical.point.y - visible.point.y < .08, `lining stays directly beneath the deck: ${visible.point.y}`);
    }
  } finally { f.hold.dispose(); }
});
test('both real hatches stay open and their ramps have no decorative beam through the player body', () => {
  const f = fixture();
  try {
    for (const v of [-3.75, 3.75]) {
      const aperture = new THREE.Vector3(...P(-3.5, v, 6.6));
      assert.equal(f.artRay(aperture, up, 1).length, 0, 'upward view stays open inside each hatch');
      assert.equal(f.physicalRay(aperture, up, 1).length, 0, 'matching physical hatch remains open');
      const fromDeck = new THREE.Vector3(...P(-3.5, v, 7.1));
      const visibleRamp = f.artRay(fromDeck, down, 3)[0], physicalRamp = f.physicalRay(fromDeck, down, 3)[0];
      assert.ok(visibleRamp && physicalRamp);
      assert.ok(Math.abs(visibleRamp.point.y - physicalRamp.point.y) < .06, 'looking down reaches the same actual ramp');
      for (const u of [-5.08, -5, -4.92]) {
        const feet = 7 - (u + 8) * 3.55 / 12;
        const origin = new THREE.Vector3(...P(u, v, feet + .15));
        assert.equal(f.physicalRay(origin, up, 1.65).length, 0, 'the existing ramp has body clearance');
        assert.equal(f.artRay(origin, up, 1.65).length, 0, `visible beam must not cross a walkable body at ${u},${v}`);
      }
    }
  } finally { f.hold.dispose(); }
});
test('the two hold entrances and exits remain continuously walkable on shipped collision without jumping', () => {
  const f = fixture(), idle = { x: 0, z: 0, jump: false, sprint: false };
  try {
    for (const route of f.hold.rampRoutes) {
      const player = new Player(f.colliders, 1);
      player.teleport(route[0][0], route[0][1] + .16, route[0][2]);
      for (let i = 0; i < 120; i++) player.step(1 / 120, idle);
      assert.ok(player.onGround);
      for (const point of [...route.slice(1), ...route.slice(0, -1).reverse()]) {
        let ticks = 0;
        while (Math.hypot(player.pos.x - point[0], player.pos.z - point[2]) > .4 && ticks++ < 3000) {
          player.yaw = Math.atan2(player.pos.x - point[0], player.pos.z - point[2]);
          player.step(1 / 120, { ...idle, z: 1 });
          assert.equal(player.swimming, false);
        }
        for (let i = 0; i < 20; i++) player.step(1 / 120, idle);
        assert.ok(Math.hypot(player.pos.x - point[0], player.pos.z - point[2]) < .5, `blocked at ${player.pos.toArray()} toward ${point}`);
        assert.ok(player.onGround && Math.abs(player.pos.y - point[1]) < .2);
      }
    }
  } finally { f.hold.dispose(); }
});

test('full-height capsule sweeps keep both hatch corridors visually clear across their width', () => {
  const f = fixture(), geometries: THREE.BufferGeometry[] = [];
  for (const root of [f.hold.root, ...roots.map(root => root.getObjectByName('Ghost_Fleet_Ship_296_104_Timber')).filter(Boolean)] as THREE.Object3D[]) root.traverse(object => {
    const mesh = object as THREE.Mesh; if (!mesh.isMesh) return;
    let geometry = new THREE.BufferGeometry().setAttribute('position', mesh.geometry.attributes.position.clone());
    if (mesh.geometry.index) geometry.setIndex(mesh.geometry.index.clone());
    geometry.applyMatrix4(mesh.matrixWorld);
    if (geometry.index) { const indexed = geometry; geometry = indexed.toNonIndexed(); indexed.dispose(); }
    geometries.push(geometry);
  });
  const geometry = mergeGeometries(geometries), bvh = new MeshBVH(geometry);
  for (const part of geometries) part.dispose();
  const segment = new THREE.Line3(), bounds = new THREE.Box3(), radius = .32;
  try {
    for (const side of [-3.75, 3.75]) for (const lateral of [-.9, -.45, 0, .45, .9]) for (let step = 0; step <= 124; step++) {
      const u = -8.2 + step * .1, v = side + lateral;
      const feet = (u < -8 ? 7 : u > 4 ? 3.4 : 7 - (u + 8) * 3.55 / 12) + .05;
      segment.start.set(...P(u, v, feet + .35)); segment.end.set(...P(u, v, feet + 1.4));
      bounds.setFromPoints([segment.start, segment.end]).expandByScalar(radius);
      const occupied = bvh.shapecast({ intersectsBounds: box => bounds.intersectsBox(box),
        intersectsTriangle: triangle => triangle.closestPointToSegment(segment) < radius - .004 });
      assert.equal(occupied, false, `art intrudes into the open hatch corridor at local ${u.toFixed(2)},${v.toFixed(2)}`);
    }
  } finally { geometry.dispose(); f.hold.dispose(); }
});

test('the alarm cabinet is supported to the floor without moving its interaction target', () => {
  const f = fixture();
  try {
    assert.deepEqual(f.hold.markers[0].p, P(-10, 0, 4.3));
    for (const v of [1.55, 2.05]) for (const y of [3.43, 3.7, 3.97]) {
      const origin = new THREE.Vector3(...P(-11, v, y)), direction = new THREE.Vector3(...P(-10, v, y)).sub(origin).normalize();
      // Isolate the cabinet's support from old hull-floor triangles at ankle height.
      const physical = f.hold.colliders.flatMap(c => c.bvh.raycast(new THREE.Ray(origin, direction), THREE.DoubleSide, 0, 1.2)).sort((a, b) => a.distance - b.distance)[0];
      const visible = f.artRay(origin, direction, 1.2)[0];
      assert.ok(physical && visible);
      assert.ok(physical.distance > .8 && physical.distance < 1 && Math.abs(physical.distance - visible.distance) < .01, `cabinet supports agree at ${v},${y}: physical ${physical.distance}, art ${visible.distance}`);
    }
  } finally { f.hold.dispose(); }
});

test('a standing player cannot pass under the original cabinet body; its central approach remains clear', () => {
  const f = fixture(), idle = { x: 0, z: 0, jump: false, sprint: false };
  try {
    const player = new Player(f.colliders, 1), start = P(-11.1, 1.8, 3.4), target = P(-8.8, 1.8, 3.4);
    player.teleport(start[0], start[1] + .12, start[2]);
    for (let i = 0; i < 120; i++) player.step(1 / 120, idle);
    for (let i = 0; i < 240; i++) {
      player.yaw = Math.atan2(player.pos.x - target[0], player.pos.z - target[2]); player.step(1 / 120, { ...idle, z: 1 });
    }
    assert.ok(player.onGround && Math.hypot(player.pos.x - target[0], player.pos.z - target[2]) > 1.4, 'cabinet already blocks the standing body');
    const point = P(-10, 0, 3.4); player.teleport(point[0], point[1] + .12, point[2]);
    for (let i = 0; i < 120; i++) player.step(1 / 120, idle);
    assert.ok(player.onGround && Math.hypot(player.pos.x - point[0], player.pos.z - point[2]) < .01);
    const origin = player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), destination = new THREE.Vector3(...f.hold.markers[0].p), delta = destination.sub(origin);
    assert.equal(f.physicalRay(origin, delta.clone().normalize(), Math.max(0, delta.length() - .08)).length, 0, 'the actual alarm interaction keeps its original unobstructed reach');
  } finally { f.hold.dispose(); }
});
