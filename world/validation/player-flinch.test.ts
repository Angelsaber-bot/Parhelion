import test from 'node:test';
import assert from 'node:assert/strict';
import { FLINCH, flinchWeight } from '../src/player/skinnedCharacter';

test('a hit flinch snaps in quickly, settles smoothly and is gone within ~0.4 s', () => {
  assert.equal(flinchWeight(0), 0);
  assert.ok(Math.abs(flinchWeight(FLINCH.attack) - 1) < 1e-9, 'full at the end of the snap');
  assert.ok(flinchWeight(FLINCH.attack / 2) > .6, 'the snap is fast');
  let last = 1; for (let t = FLINCH.attack; t < FLINCH.attack + FLINCH.settle; t += .01) { const w = flinchWeight(t); assert.ok(w <= last + 1e-9); last = w; }
  assert.equal(flinchWeight(FLINCH.attack + FLINCH.settle), 0); assert.equal(flinchWeight(Infinity), 0); assert.equal(flinchWeight(NaN), 0);
});
