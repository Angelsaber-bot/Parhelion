import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LocalLightPool } from '../src/rendering/localLightPool';
import { PointLightCensus } from '../src/rendering/pointLightCensus';

test('the scene keeps one point-light count while settlement and cinematic lights come and go', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const pool = new LocalLightPool([{ p: [0, 2, 0], color: '#fff', intensity: 5, distance: 10 }, { p: [3, 2, 0], color: '#fff', intensity: 2, distance: 10 }], 4);
  scene.add(pool.root); pool.update(new THREE.Vector3());
  const hub = new THREE.Group(), fill = new THREE.PointLight(0xffffff, 3); hub.add(fill); scene.add(hub);
  const census = new PointLightCensus(scene, new Set(pool.lights), 0);
  const shown = () => { let n = 0; scene.traverseVisible(o => { if ((o as THREE.PointLight).isPointLight) n++; }); return n; };
  pool.yieldSlots(census.active(camera)); assert.equal(shown(), 4);
  hub.visible = false; pool.yieldSlots(census.active(camera)); assert.equal(shown(), 4, 'a hidden hub hands its slot back to the lamps');
  const stage = new THREE.PointLight(0xffaa00, 1); scene.add(stage); hub.visible = true;
  pool.yieldSlots(census.active(camera)); assert.equal(shown(), 4, 'a cinematic light takes a pool slot instead of adding one');
  assert.ok(pool.lights.filter(l => l.visible).every(l => l.intensity >= 2), 'the dimmest slots are the ones handed over');
  stage.layers.set(5); pool.yieldSlots(census.active(camera)); assert.equal(pool.lights.filter(l => l.visible).length, 3, 'lights off the camera layers do not count');
  stage.removeFromParent(); hub.removeFromParent(); pool.yieldSlots(census.active(camera)); assert.equal(pool.lights.filter(l => l.visible).length, 4);
});
