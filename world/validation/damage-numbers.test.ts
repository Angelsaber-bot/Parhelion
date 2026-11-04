import assert from 'node:assert/strict';
import { test } from 'node:test';
import { damageKind } from '../src/damageNumbers.ts';

test('a damage number says how the hit landed, most important first', () => {
  assert.equal(damageKind({ source: 'ranged' }), 'ranged');
  assert.equal(damageKind({ source: 'melee', counter: true }), 'counter');
  assert.equal(damageKind({ source: 'melee', counter: true, punish: true }), 'punish');
  assert.equal(damageKind({ source: 'ranged', punish: true, blocked: true }), 'blocked');
  assert.equal(damageKind({ source: 'skill' }), 'skill');
  assert.equal(damageKind({}), 'melee');
});
