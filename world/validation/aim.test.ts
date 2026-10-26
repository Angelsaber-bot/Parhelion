import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShoulderAim, shoulderArmLength } from '../src/aim.ts';
test('World remains TPS: shoulder aim shortens arm, never substitutes an FPS camera', () => {
  assert.equal(shoulderArmLength(0, false), 3.6);
  assert.equal(shoulderArmLength(1, false), 1.5);
  assert.equal(shoulderArmLength(1, true), 5.2);
  assert.equal(shoulderArmLength(1, false, .4), .10000000000000003);
  assert.equal(shoulderArmLength(1, false, .1), .08);
});
test('shoulder ADS interpolates both ways and clears on blocked gameplay', () => {
  const aim = new ShoulderAim(); aim.held = true;
  for (let i = 0; i < 60; i++) aim.step(1/60, true);
  assert.equal(aim.value, 1); aim.held = false; aim.step(.1, true);
  assert.ok(aim.value > 0 && aim.value < 1); aim.step(.1, false);
  assert.equal(aim.value, 0); assert.equal(aim.held, false);
});
