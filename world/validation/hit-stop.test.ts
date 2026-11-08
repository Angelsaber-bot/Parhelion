import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HIT_STOP, hitStopSeconds } from '../src/combat/hitStop.ts';

test('hit-stop: blades and skills only, heavier blows and kills hold longer, never past the cap', () => {
  assert.equal(hitStopSeconds('ranged', [{ damage: 99 }], 1), 0, 'the rifle stays fluid');
  assert.equal(hitStopSeconds('ultimate', [{ damage: 99 }], 1), 0, 'ultimates have their own director');
  assert.equal(hitStopSeconds('melee', [], 0), 0, 'a whiff never stops');
  const light = hitStopSeconds('melee', [{ damage: 12 }], 0), heavy = hitStopSeconds('melee', [{ damage: 40 }], 0);
  assert.ok(light > 0 && heavy > light);
  assert.ok(hitStopSeconds('melee', [{ damage: 12 }, { damage: 12 }], 0) > light, 'cleaving two reads heavier');
  assert.ok(hitStopSeconds('melee', [{ damage: 12 }], 1) > light, 'a finishing blow lands harder');
  assert.ok(hitStopSeconds('skill', [{ damage: 12 }], 0) < light);
  assert.ok(hitStopSeconds('melee', [{ damage: 99 }, { damage: 99 }, { damage: 99 }], 3) <= HIT_STOP.max);
  assert.ok(HIT_STOP.max * (1 - HIT_STOP.scale) < .11, 'the stop never costs the player more than a tenth of a second');
});
