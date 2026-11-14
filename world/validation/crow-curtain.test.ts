import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldCombatState, CROW_CURTAIN, inCrowCurtain } from '../src/combat/combat';

test('the Crow Seal burning curtain hurts only while bright and only inside its band', () => {
  const s = new WorldCombatState([], { id: 'boss_hellfire_lord', kind: 'king', p: { x: 0, y: 0, z: 0 }, requires: [] });
  assert.equal(s.beginBoss(new Set(), 'boss_hellfire_lord'), true);
  const b = s.boss, step = (dt: number, p: { x: number; y: number; z: number }) => (s as unknown as { stepCrowCurtain(dt: number, p: unknown): void }).stepCrowCurtain(dt, p);
  b.active = true; b.squareYaw = 0; b.mode = 'windup'; b.attackCount = 1;
  b.hp = b.maxHp * .5; step(.05, { x: 9, y: 0, z: 9 }); assert.equal(s.crowCurtain, null, 'not above 30 %');
  b.hp = b.maxHp * .25; step(.05, { x: 9, y: 0, z: 9 });
  const c = s.crowCurtain!; assert.ok(c && c.burn > 2);
  // Facing +Z (yaw 0), the curtain hangs 2.2 m behind him and runs across his line of retreat.
  assert.ok(Math.abs(c.z + CROW_CURTAIN.behind) < 1e-9 && Math.abs(c.x) < 1e-9);
  assert.equal(inCrowCurtain(c, { x: 1.5, y: 0, z: -2.2 }), true); assert.equal(inCrowCurtain(c, { x: 0, y: 0, z: 1 }), false, 'a player in front of him is clear');
  s.drainEvents(); const hp = s.hp;
  step(.05, { x: .5, y: 0, z: -2.1 }); assert.equal(hp - s.hp, CROW_CURTAIN.damage, 'crossing the bright curtain burns');
  assert.ok(s.drainEvents().some(e => e.type === 'hurt' && 'from' in e && e.from));
  (s as unknown as { hurtCooldown: number }).hurtCooldown = 0;
  step(2, { x: .5, y: 0, z: -2.1 }); const after = s.hp;
  (s as unknown as { hurtCooldown: number }).hurtCooldown = 0;
  step(.05, { x: .5, y: 0, z: -2.1 }); assert.equal(s.hp, after, 'smouldering embers are safe');
  step(2, { x: 0, y: 0, z: 0 }); assert.equal(s.crowCurtain!.burn, 0, 'burns out');
  // The same attack never relights it; the next one does.
  step(.05, { x: 9, y: 0, z: 9 }); assert.equal(s.crowCurtain!.burn, 0);
  b.attackCount = 2; step(.05, { x: 9, y: 0, z: 9 }); assert.ok(s.crowCurtain!.burn > 2);
  s.resetBoss(); assert.equal(s.crowCurtain, null);
});
