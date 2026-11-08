import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HIT_REACTION, enemyHitReaction } from '../src/combat/enemyHitReaction.ts';

const at = (hitTime: number, extra: Partial<{ kind: 'king' | 'grunt'; mode: string; pacified: boolean }> = {}) =>
  enemyHitReaction({ hitTime, kind: 'grunt', mode: 'chase', pacified: false, ...extra } as never);

test('a hit flashes white for its first frames, then the flinch eases out to nothing', () => {
  const start = at(HIT_REACTION.window), late = at(HIT_REACTION.window - HIT_REACTION.flash - .01), done = at(0);
  assert.equal(start.flash, true);
  assert.ok(start.lean < 0 && start.push < 0, 'leans and steps away from the blow');
  assert.equal(late.flash, false);
  assert.ok(Math.abs(late.lean) < Math.abs(start.lean));
  assert.deepEqual(done, { flash: false, lean: 0, push: 0 });
  assert.ok(Math.abs(start.lean) <= HIT_REACTION.lean && Math.abs(start.push) <= HIT_REACTION.push);
});

test('bosses barely rock, a windup keeps its tell readable, and calm or dead enemies never react', () => {
  const grunt = at(HIT_REACTION.window), king = at(HIT_REACTION.window, { kind: 'king' }), windup = at(HIT_REACTION.window, { mode: 'windup' });
  assert.ok(Math.abs(king.lean) < Math.abs(grunt.lean) / 2);
  assert.ok(Math.abs(windup.lean) < Math.abs(grunt.lean));
  assert.equal(at(.1, { pacified: true }).lean, 0);
  assert.equal(at(.1, { mode: 'dead' }).flash, false);
  assert.equal(at(Number.NaN).flash, false);
});
