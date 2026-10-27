import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { makeSky, SUN_DIR } from '../src/look.ts';
import { KingdomTwilight, twilightWeight } from '../src/twilight.ts';
test('twilight is bounded to the western region and victory restores a warmer dawn', () => {
  assert.equal(twilightWeight(0), 0); assert.equal(twilightWeight(720), 0);
  assert.equal(twilightWeight(-720), 1); assert.equal(twilightWeight(-720, true), .45);
  assert.ok(twilightWeight(-380) > 0 && twilightWeight(-380) < 1);
});
test('twilight reuses lights and does not mutate the global daytime sun or lose visibility', () => {
  const original = SUN_DIR.clone(), scene = new THREE.Scene(); scene.fog = new THREE.Fog('#ffffff',120,720);
  const sky = makeSky(), sun = new THREE.DirectionalLight(), hemi = new THREE.HemisphereLight();
  const dusk = new KingdomTwilight(sky,sun,hemi,scene);
  for (let i=0;i<120;i++) dusk.update(1/60,-720,false);
  assert.ok(dusk.direction.y < original.y); assert.ok(hemi.intensity >= 1.15); assert.ok(sun.intensity >= 2);
  assert.ok(SUN_DIR.equals(original)); assert.equal(scene.children.length,0);
  scene.fog = null; assert.doesNotThrow(() => dusk.update(.1,0,false));
  sky.geometry.dispose(); (sky.material as THREE.Material).dispose();
});
