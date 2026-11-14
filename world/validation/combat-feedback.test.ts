import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldCombatState, PRECISION } from '../src/combat/combat';
import { KillChain, KILL_CHAIN, hurtArcAngle } from '../src/combat/combatFeedback';
import { damageKind } from '../src/combat/damageNumbers';

test('upper-body rounds are weak-spot hits worth more; the body and shields are not', () => {
  const s = new WorldCombatState([{ id: 'dummy', kind: 'shade', p: { x: 0, y: 0, z: 0 } }], []), e = s.enemies[0];
  e.active = true; e.mode = 'chase';
  const origin = { x: 0, z: 10 };
  const head = s.raycast({ ...origin, y: 1.65 }, { x: 0, y: 0, z: -1 }, 40)!, body = s.raycast({ ...origin, y: .9 }, { x: 0, y: 0, z: -1 }, 40)!;
  assert.equal(head.precise, true); assert.equal(body.precise, false);
  const at = { x: 0, y: 0, z: 2 };
  e.hp = e.maxHp; s.hitEnemy(e.id, 10, { source: 'ranged', origin: at }); const plain = e.maxHp - e.hp;
  e.hp = e.maxHp; s.hitEnemy(e.id, 10, { source: 'ranged', origin: at, precise: true }); const weak = e.maxHp - e.hp;
  assert.ok(Math.abs(weak - plain * PRECISION.multiplier) < .02, `${weak} vs ${plain}`);
  const events = s.drainEvents().filter(v => v.type === 'hit');
  assert.equal((events.at(-1) as { precise?: boolean }).precise, true);
  assert.equal(damageKind({ source: 'ranged', precise: true }), 'precise');
  assert.equal(damageKind({ source: 'ranged', precise: true, punish: true }), 'punish');
  // Melee never counts as a weak-spot hit even if a caller passes the flag.
  e.hp = e.maxHp; s.hitEnemy(e.id, 10, { source: 'melee', precise: true }); assert.equal(e.maxHp - e.hp, 10);
});

test('kills chain inside the window; from the third link each kill pays health and ammo', () => {
  const c = new KillChain();
  assert.equal(c.kill(), 1); assert.equal(KillChain.reward(1), null);
  c.step(KILL_CHAIN.window - .1); assert.equal(c.kill(), 2); assert.equal(KillChain.reward(2), null);
  assert.equal(c.kill(), 3); assert.deepEqual(KillChain.reward(3), { heal: KILL_CHAIN.heal, rounds: KILL_CHAIN.rounds });
  c.step(KILL_CHAIN.window + .01); assert.equal(c.count, 0); assert.equal(c.kill(), 1);
});

test('hit-direction arcs point at the attacker relative to where the camera looks', () => {
  const player = { x: 0, y: 0, z: 0 }, look = { x: 0, z: -1 };
  assert.ok(Math.abs(hurtArcAngle({ x: 0, y: 0, z: -5 }, player, look)) < 1e-9, 'ahead → top');
  assert.ok(Math.abs(hurtArcAngle({ x: 5, y: 0, z: 0 }, player, look) - Math.PI / 2) < 1e-9, 'right → right');
  assert.ok(Math.abs(hurtArcAngle({ x: -5, y: 0, z: 0 }, player, look) + Math.PI / 2) < 1e-9, 'left → left');
  assert.ok(Math.abs(Math.abs(hurtArcAngle({ x: 0, y: 0, z: 5 }, player, look)) - Math.PI) < 1e-9, 'behind → bottom');
});

test('enemy blows carry their origin so the HUD can point at them', () => {
  const s = new WorldCombatState([], []);
  (s as unknown as { hurt(a: number, f: boolean, from: { x: number; y: number; z: number }): void }).hurt(5, false, { x: 3, y: 0, z: 4 });
  const hurt = s.drainEvents().find(v => v.type === 'hurt') as { from?: { x: number } } | undefined;
  assert.equal(hurt?.from?.x, 3);
});

test('finishing slow motion: bosses always, elites when they are the last fighter, troops never', async () => {
  const { finisherSeconds, FINISHER } = await import('../src/combat/combatFeedback');
  assert.equal(finisherSeconds({ kind: 'king' }, 3), FINISHER.boss);
  assert.equal(finisherSeconds({ kind: 'shade', miniboss: 'x' }, 0), FINISHER.elite);
  assert.equal(finisherSeconds({ kind: 'shade', miniboss: 'x' }, 2), 0, 'not while others still fight');
  assert.equal(finisherSeconds({ kind: 'shade' }, 0), 0, 'ordinary troops keep the pace');
});
