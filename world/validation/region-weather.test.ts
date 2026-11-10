/** The air differs by era, changes without popping, and costs one draw call. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { makeRegionWeather, REGION_WEATHER } from '../src/map/regionWeather.ts';

test('every era has its own air', () => {
  const looks = new Set(Object.values(REGION_WEATHER).map(w => JSON.stringify([w.a.shape, w.b.shape, w.a.color, w.b.color])));
  assert.equal(looks.size, 9, "eight eras and the home town");
  assert.ok(REGION_WEATHER.winter.a.fall < 0 && REGION_WEATHER.winter.b.fall < 0 && REGION_WEATHER.winter.density === 1, 'it snows on the winter road');
  assert.equal(REGION_WEATHER.britain.b.shape, 'leaf');
  assert.equal(REGION_WEATHER.blacksail.b.shape, 'streak');
  assert.ok(REGION_WEATHER.kyoto.a.shape === 'ember' && REGION_WEATHER.kyoto.a.fall > 0, 'Kyoto embers rise');
  for (const w of Object.values(REGION_WEATHER)) { assert.ok(w.density > 0 && w.density <= 1); assert.ok(w.split > 0 && w.split < 1); }
});

test('crossing into another era fades the air out and in; drift never jumps', () => {
  const weather = makeRegionWeather(64, 70), cam = new THREE.Vector3();
  assert.equal(weather.points.frustumCulled, false);
  for (let i = 0; i < 120; i++) weather.update(cam, 'alpha', 1 / 60, 1080);
  assert.equal(weather.region, 'alpha'); assert.ok(weather.alpha > .99);
  assert.equal(weather.uniforms.uScale.value, 540, 'motes scale with the drawing buffer');
  let last = weather.uniforms.uDrift.value.clone(), maxStep = 0, sawDark = false;
  for (let i = 0; i < 240; i++) {
    weather.update(cam, 'winter', 1 / 60);
    const now = weather.uniforms.uDrift.value; maxStep = Math.max(maxStep, now.clone().sub(last).length()); last = now.clone();
    if (weather.alpha < .05) sawDark = true;
  }
  assert.ok(sawDark, 'faded out before swapping'); assert.equal(weather.region, 'winter'); assert.ok(weather.alpha > .99, 'faded back in');
  assert.ok(maxStep < .2, `drift stepped ${maxStep}`);
  assert.deepEqual(weather.uniforms.uShape.value.toArray(), [2, 2]);
  weather.update(cam, 'winter', NaN); weather.update(cam, 'winter', -5);
  assert.ok(Object.values(weather.uniforms.uDrift.value).every(Number.isFinite));
  weather.dispose();
});


test('returning to the current region during fade-out cancels the stale destination', () => {
  const weather = makeRegionWeather(16), camera = new THREE.Vector3();
  try {
    weather.update(camera, 'alpha', .1);
    for (let i = 0; i < 4; i++) weather.update(camera, 'winter', .1);
    assert.equal(weather.region, 'alpha');
    const faded = weather.alpha;
    weather.update(camera, 'alpha', .1);
    assert.ok(weather.alpha > faded, 'returning restores the current air immediately');
    for (let i = 0; i < 20; i++) {
      weather.update(camera, 'alpha', .1);
      assert.equal(weather.region, 'alpha', 'the departed destination never appears');
    }
    assert.ok(weather.alpha > .99);
  } finally { weather.dispose(); }
});
