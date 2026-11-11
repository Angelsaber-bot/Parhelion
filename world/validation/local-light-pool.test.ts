import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { LocalLightPool, type AuthoredLocalLight } from '../src/rendering/localLightPool';
import { REGIONS, mergeLayouts } from '../src/map/regions';
import { HOME_BUILDINGS, HOME_LIGHTS, HOME_ROUTES, SABER_HOME_WALK, homeWorld } from '../src/map/homePlan';

const source = (x: number, color = '#ffcc88'): AuthoredLocalLight => ({ p: [x, 2, 0], color, intensity: 25, distance: 10, decay: 1.6 });
test('fixed lamp slots retain authored values and identities, while leaving other scene lights untouched', () => {
  const sources = [source(0), source(100, '#88ccff')], pool = new LocalLightPool(sources, 8);
  const scene = new THREE.Scene(), unrelated = new THREE.PointLight(0xff0000, 80); scene.add(unrelated, pool.root);
  pool.update(new THREE.Vector3()); const identities = [...pool.lights];
  assert.equal(pool.root.children.length, 8); assert.equal(pool.lights.filter(l => l.intensity > 0).length, 2);
  for (const lamp of pool.lights.filter(l => l.intensity > 0)) {
    const expected = sources[lamp.userData.authoredSource]; assert.deepEqual(lamp.position.toArray(), expected.p);
    assert.equal(lamp.color.getHex(), new THREE.Color(expected.color).getHex()); assert.equal(lamp.distance, 10); assert.equal(lamp.decay, 1.6); assert.equal(lamp.intensity, 25);
  }
  for (let i = 0; i < 20; i++) pool.update(new THREE.Vector3(i * 10, 0, 0));
  assert.deepEqual(pool.lights, identities); assert.ok(pool.lights.every(l => l.visible));
  pool.dispose(); pool.dispose(); assert.deepEqual(scene.children, [unrelated]); assert.equal(unrelated.intensity, 80);
});
test('selection uses influence radius, stable tie-break and hysteresis rather than swapping at every boundary', () => {
  const pool = new LocalLightPool([source(0), source(100)], 1, 20);
  pool.update(new THREE.Vector3(0, 2, 0)); assert.deepEqual(pool.selectedSources, [0]);
  for (const x of [49, 51, 50, 53, 47, 59]) { pool.update(new THREE.Vector3(x, 2, 0)); assert.deepEqual(pool.selectedSources, [0]); }
  pool.update(new THREE.Vector3(70, 2, 0)); assert.deepEqual(pool.selectedSources, [1]);
  assert.ok(pool.lights[0].intensity > 0 && pool.lights[0].intensity < 25, 'old source fades rather than jumping');
  for (let i = 0; i < 60; i++) pool.update(new THREE.Vector3(70, 2, 0));
  assert.equal(pool.lights[0].position.x, 100); assert.equal(pool.lights[0].intensity, 25);
  for (const x of [49, 51, 45, 41]) { pool.update(new THREE.Vector3(x, 2, 0)); assert.deepEqual(pool.selectedSources, [1]); }
  pool.update(new THREE.Vector3(20, 2, 0)); assert.deepEqual(pool.selectedSources, [0]); pool.dispose();
});
test('selection changes only replaced slots, not retained source identities', () => {
  const pool = new LocalLightPool([source(0), source(100), source(200)], 2, 0);
  pool.update(new THREE.Vector3(0, 2, 0)); const retained = pool.lights.find(l => l.userData.authoredSource === 1)!;
  for (let i = 0; i < 60; i++) pool.update(new THREE.Vector3(200, 2, 0));
  assert.deepEqual(new Set(pool.selectedSources), new Set([1, 2]));
  assert.equal(retained.userData.authoredSource, 1); assert.equal(retained.intensity, 25); pool.dispose();
});
test('original eight-region authored lamps keep every nearby source selected along crossings and return trips', () => {
  const originalRegions = REGIONS.filter(def => def.id !== 'home');
  const layout = mergeLayouts(originalRegions.map(def => ({ def, layout: JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`, import.meta.url), 'utf8')) })));
  const sources: AuthoredLocalLight[] = [{ p: [182, 6, -60], color: '#7ff6ff', intensity: 60, distance: 26 }, ...layout.lights!];
  assert.equal(sources.length, 32);
  const pool = new LocalLightPool(sources);
  for (const region of [...REGIONS, ...[...REGIONS].reverse()]) {
    for (const sign of [1, -1]) for (let step = 0; step <= 36; step++) {
      const x = region.offset[0] + sign * (step * 20 - 360), z = region.offset[1];
      pool.update(new THREE.Vector3(x, 15, z));
      const selected = new Set(pool.selectedSources);
      for (const [id, light] of sources.entries()) if (Math.hypot(x - light.p[0], 15 - light.p[1], z - light.p[2]) < light.distance + 250) assert.ok(selected.has(id), `nearby light ${id} omitted at ${x},${z}`);
      assert.equal(pool.root.children.length, 8); assert.ok(pool.lights.every(light => light.visible));
    }
  }
  pool.dispose();
});
test('nine-region pool keeps town rooms lit while retaining eight fixed slots across dense interiors and return trips', () => {
  const layout = mergeLayouts(REGIONS.map(def => ({ def, layout: JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`, import.meta.url), 'utf8')) })));
  const sources: AuthoredLocalLight[] = [{ p: [182, 6, -60], color: '#7ff6ff', intensity: 60, distance: 26 }, ...layout.lights!];
  assert.equal(sources.length, 32 + HOME_LIGHTS.length);
  const pool = new LocalLightPool(sources), identities = [...pool.lights];
  const points = [...HOME_ROUTES.flatMap(route => route.points), ...HOME_BUILDINGS.map(h => h.p), ...SABER_HOME_WALK, [-175, 21.3, 135] as [number, number, number]];
  const position = new THREE.Vector3(0, 15, 0);
  for (const point of [...points, ...points.toReversed()]) {
    const target = new THREE.Vector3(...homeWorld(point)).add(new THREE.Vector3(0, 1.6, 0));
    const start = position.clone(), steps = Math.max(1, Math.ceil(start.distanceTo(target) / 2));
    for (let step = 1; step <= steps; step++) { position.lerpVectors(start, target, step / steps); pool.update(position, .1); }
    for (let step = 0; step < 6; step++) pool.update(position, .1);
    const influences = (light: AuthoredLocalLight) => position.distanceTo(new THREE.Vector3(...light.p)) < light.distance;
    if (sources.some(influences)) assert.ok(pool.lights.some(light => light.intensity > 0 && position.distanceTo(light.position) < light.distance), `unlit town interior at ${position.toArray()}`);
    assert.deepEqual(pool.lights, identities); assert.equal(pool.root.children.length, 8);
    assert.equal(new Set(pool.selectedSources).size, 8); assert.ok(pool.lights.every(light => light.visible));
  }
  pool.dispose();
});
test('invalid data fails early, invalid updates cannot poison lamps, and repeated dispose is safe', () => {
  for (const count of [0, -1, 1.5, 33, NaN]) assert.throws(() => new LocalLightPool([], count), RangeError);
  assert.throws(() => new LocalLightPool([{ ...source(0), distance: Infinity }]), RangeError);
  const pool = new LocalLightPool([source(0)]); pool.update(new THREE.Vector3());
  pool.update(new THREE.Vector3(NaN, 0, 0), NaN); assert.equal(pool.lights[0].intensity, 25);
  pool.dispose(); pool.update(new THREE.Vector3()); assert.equal(pool.root.children.length, 0);
});
