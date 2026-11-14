import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSplashWave, SPLASH } from '../src/environment/splashWave';

test('a hull splash spreads a wave ring out, throws spray, then clears itself', () => {
  const s = createSplashWave(); assert.equal(s.root.visible, false);
  s.trigger(new THREE.Vector3(10, 1, 10), 9); assert.equal(s.active, true);
  s.update(.3); const ring = s.root.children[0], early = ring.scale.x;
  s.update(1); assert.ok(ring.scale.x > early, 'the wave ring runs outward');
  for (let t = 0; t < SPLASH.life; t += .1) s.update(.1);
  assert.equal(s.active, false); assert.equal(s.root.visible, false, 'gone after its life');
  s.dispose();
});
