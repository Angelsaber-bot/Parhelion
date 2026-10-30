import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { LocalPointLightPool, StabilizedSunShadow, type LocalLightDefinition } from '../src/renderLighting.ts';
import { REGIONS } from '../src/regions.ts';

function cameraAt(x = 0, y = 2, z = 0) {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, .1, 1300);
  camera.position.set(x, y, z); camera.updateMatrixWorld(); return camera;
}
function sun() {
  const light = new THREE.DirectionalLight();
  Object.assign(light.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
  light.shadow.mapSize.set(2048, 2048); return light;
}
test('shadow stabilization snaps only light-space translation while preserving range and direction', () => {
  const stable = new StabilizedSunShadow(), light = sun();
  const direction = new THREE.Vector3(-.45, .62, .64).normalize();
  const right = new THREE.Vector3().crossVectors(light.shadow.camera.up, direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  for (const focus of [new THREE.Vector3(), new THREE.Vector3(-720.154, 11.25, 130.017), new THREE.Vector3(88.3, 100, -720)]) {
    stable.update(light, focus, direction);
    assert.ok(light.position.clone().sub(light.target.position).normalize().distanceTo(direction) < 1e-12);
    assert.ok(Math.abs(light.position.distanceTo(light.target.position) - 200) < 1e-10);
    const correction = light.target.position.clone().sub(focus), texel = 140 / 2048;
    assert.ok(Math.abs(correction.dot(right)) <= texel / 2 + 1e-10);
    assert.ok(Math.abs(correction.dot(up)) <= texel / 2 + 1e-10);
    assert.ok(Math.abs(correction.dot(direction)) < 1e-10);
    for (const axis of [right, up]) assert.ok(Math.abs(light.target.position.dot(axis) / texel - Math.round(light.target.position.dot(axis) / texel)) < 1e-8);
    assert.equal(light.shadow.camera.right - light.shadow.camera.left, 140);
    assert.equal(light.shadow.mapSize.x, 2048);
  }
});
test('sub-texel translation is stable, zoom/non-square maps and vertical light remain finite', () => {
  const stable = new StabilizedSunShadow(), light = sun(), direction = new THREE.Vector3(0, 0, 1);
  stable.update(light, new THREE.Vector3(0, 0, 0), direction);
  const before = light.target.position.clone();
  stable.update(light, new THREE.Vector3(.01, .01, 0), direction);
  assert.deepEqual(light.target.position, before);
  light.shadow.camera.zoom = 2; light.shadow.mapSize.set(1024, 2048);
  stable.update(light, new THREE.Vector3(.04, .02, 0), direction);
  assert.ok(Math.abs(light.target.position.x - 140 / 2048) < 1e-12);
  assert.ok(Math.abs(light.target.position.y - 140 / 4096) < 1e-12);
  stable.update(light, new THREE.Vector3(17, 32, -21), new THREE.Vector3(0, 1, 0));
  assert.ok(light.position.toArray().every(Number.isFinite));
});
test('light pool keeps object count, identity and shader count fixed across teleport and empty slots', () => {
  const pool = new LocalPointLightPool([{ p: [0, 2, 0], color: '#ff5533', intensity: 60, distance: 30 }]);
  const identities = pool.lights.map(light => light.uuid);
  for (const position of [0, 1000, -1000, 0]) {
    pool.update(cameraAt(position));
    assert.equal(pool.root.children.length, 8);
    assert.deepEqual(pool.lights.map(light => light.uuid), identities);
    assert.ok(pool.lights.every(light => light.visible && !light.castShadow));
    assert.equal(pool.lights.filter(light => light.intensity > 0).length, 1);
    assert.equal(pool.lights[0].intensity, 60); assert.equal(pool.lights[0].distance, 30);
    assert.equal(pool.lights[0].decay, 1.6);
  }
});
test('nearby light influence is protected even behind view, then visible distant sources win', () => {
  const pool = new LocalPointLightPool([
    { p: [0, 2, 10], color: 'white', intensity: 10, distance: 20 },
    { p: [0, 2, -500], color: 'white', intensity: 20, distance: 40 },
    { p: [0, 2, 250], color: 'white', intensity: 30, distance: 40 },
  ], { capacity: 2, nearRadius: 40 });
  pool.update(cameraAt());
  assert.deepEqual(pool.selected, [0, 1]); assert.equal(pool.nearbyOverflow, 0);
  const empty = new LocalPointLightPool([]); empty.update(cameraAt());
  assert.ok(empty.lights.every(light => light.intensity === 0 && light.visible));
});
test('real five-region lamps: every nearby influence preserved across world grid, paths and markers', () => {
  const definitions: LocalLightDefinition[] = [{ p: [182, 6, -60], color: '#7ff6ff', intensity: 60, distance: 26 }];
  const points: number[][] = [];
  for (const region of REGIONS) {
    const layout = JSON.parse(readFileSync(new URL(`../public/assets/${region.file}.layout.json`, import.meta.url), 'utf8'));
    const [ox, oz] = region.offset;
    definitions.push(...(layout.lights ?? []).map((l: LocalLightDefinition) => ({ ...l, p: [l.p[0] + ox, l.p[1], l.p[2] + oz] as const })));
    for (const path of layout.paths) for (const [x, z] of path) points.push([x + ox, 2, z + oz]);
    for (const marker of layout.markers) points.push([marker.p[0] + ox, marker.p[1] + 2, marker.p[2] + oz]);
    for (let x = -334; x <= 334; x += 24) for (let z = -334; z <= 334; z += 24) for (const y of [2, 30, 80]) points.push([x + ox, y, z + oz]);
  }
  assert.equal(definitions.length, 14);
  const pool = new LocalPointLightPool(definitions), camera = cameraAt(); let maxNearby = 0;
  for (const point of points) {
    camera.position.fromArray(point); camera.rotation.y = point[0] * .01; pool.update(camera);
    maxNearby = Math.max(maxNearby, pool.nearbyCount);
    assert.equal(pool.nearbyOverflow, 0, `Nearby light overflow at ${point}`);
    definitions.forEach((definition, index) => {
      if (new THREE.Vector3(...definition.p).distanceTo(camera.position) <= definition.distance + 160) assert.ok(pool.selected.includes(index), `Lost nearby source ${index} at ${point}`);
    });
  }
  console.log(`Local light audit: ${points.length} world/route samples; ${definitions.length} authored lights -> ${pool.lights.length} fixed shader slots; max nearby ${maxNearby}, none dropped.`);
});

test('installed Three light-state counts zero-intensity slots and keeps program light version stable', async () => {
  const { WebGLLights } = await import('three/src/renderers/webgl/WebGLLights.js');
  const state = WebGLLights({ has: () => false });
  const pool = new LocalPointLightPool([{ p: [0, 2, 0], color: '#ffffff', intensity: 60, distance: 30 }]);
  pool.update(cameraAt()); state.setup([...pool.lights]);
  const version = state.state.version;
  assert.equal(state.state.point.length, 8);
  for (const position of [1000, -1000, 10]) {
    pool.update(cameraAt(position)); state.setup([...pool.lights]);
    assert.equal(state.state.point.length, 8); assert.equal(state.state.version, version);
  }
});
test('selection uses camera world transform and reports capacity overflow explicitly', () => {
  const pool = new LocalPointLightPool([
    { p: [1000, 2, 0], color: 'white', intensity: 1, distance: 20 },
    { p: [0, 2, 0], color: 'white', intensity: 1, distance: 20 },
  ], { capacity: 1 });
  const camera = cameraAt(), parent = new THREE.Group(); parent.position.x = 1000; parent.add(camera);
  pool.update(camera); assert.deepEqual(pool.selected, [0]); assert.equal(pool.nearbyCount, 1);
  const over = new LocalPointLightPool(Array.from({ length: 10 }, () => ({ p: [0, 2, 0] as const, color: 'white', intensity: 1, distance: 20 })));
  over.update(cameraAt()); assert.equal(over.nearbyOverflow, 2);
  assert.deepEqual(over.selected, [0, 1, 2, 3, 4, 5, 6, 7]);
});
test('reject unbounded or invalid point-light data instead of silently losing global illumination', () => {
  const good = { p: [0, 2, 0] as const, color: 'white', intensity: 1, distance: 20 };
  for (const distance of [0, -1, Infinity, NaN]) assert.throws(() => new LocalPointLightPool([{ ...good, distance }]));
  assert.throws(() => new LocalPointLightPool([good], { capacity: 0 }));
  assert.throws(() => new LocalPointLightPool([good], { nearRadius: -1 }));
});
