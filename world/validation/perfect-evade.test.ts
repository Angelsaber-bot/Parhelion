import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldCombatState, PERFECT_EVADE, enemyAttackTiming, type CombatTerrain, type Point3 } from '../src/combat.ts';
const terrain: CombatTerrain = { walk: (_p, x, z) => ({ x, y: 0, z }), lineOfSight: () => true };
const flat = (x: number, z: number) => ({ x, y: 0, z });
const step = (s: WorldCombatState, p: Point3) => s.step(.05, p, true, terrain);
/** Drive a lone troop to the moment its windup is about to land on the player at `p`. */
function atContact() {
  const s = new WorldCombatState([{ id: 'troop', kind: 'shade', p: flat(0, 0) }], []), e = s.enemies[0], p = flat(1.2, 0);
  for (let i = 0; i < 40 && e.mode !== 'windup'; i++) step(s, p);
  assert.equal(e.mode, 'windup');
  while (e.timer > .05 + 1e-9) step(s, p);
  s.drainEvents();
  return { s, e, p };
}

test('dodging through a landing attack is a perfect evade: no damage, counter window, longer opening', () => {
  const { s, e, p } = atContact();
  s.setDefense({ guard: 1, invulnerable: true });
  step(s, p);
  const events = s.drainEvents();
  assert.equal(s.hp, 100, 'the evade frames still prevent damage');
  assert.equal(events.filter(ev => ev.type === 'perfectEvade').length, 1);
  assert.ok(!events.some(ev => ev.type === 'hurt'));
  assert.equal(e.mode, 'recover');
  assert.ok(Math.abs(e.timer - (enemyAttackTiming(e).recovery + PERFECT_EVADE.opening)) < 1e-9, 'the attacker is left open longer');
  assert.equal(s.counterFor, PERFECT_EVADE.counter);
  // Every hit in the window lands harder and says so.
  s.setDefense({ guard: 1, invulnerable: false });
  s.hitEnemy('troop', 10, { source: 'ranged' });
  const hit = s.drainEvents().find(ev => ev.type === 'hit') as { damage: number; counter?: boolean };
  assert.equal(hit.counter, true); assert.ok(hit.damage > 10);
  // The window runs out.
  for (let i = 0; i < PERFECT_EVADE.counter / .05 + 2; i++) step(s, flat(30, 30));
  assert.equal(s.counterFor, 0);
  s.hitEnemy('troop', 5, { source: 'ranged' });
  assert.ok(!(s.drainEvents().find(ev => ev.type === 'hit') as { counter?: boolean }).counter);
});

test('no perfect evade without an attack that would land, and reset clears the window', () => {
  // Evading while out of the attack's reach earns nothing.
  const { s, e } = atContact();
  s.setDefense({ guard: 1, invulnerable: true });
  step(s, flat(20, 0));
  assert.ok(!s.drainEvents().some(ev => ev.type === 'perfectEvade'));
  assert.equal(s.counterFor, 0); assert.equal(e.timer, enemyAttackTiming(e).recovery);
  // Taking the hit without evading is a normal hurt.
  const second = atContact();
  second.s.setDefense({ guard: 1, invulnerable: false });
  step(second.s, second.p);
  assert.ok(second.s.hp < 100); assert.ok(!second.s.drainEvents().some(ev => ev.type === 'perfectEvade'));
  // Reset drops any counter window.
  const third = atContact();
  third.s.setDefense({ guard: 1, invulnerable: true }); step(third.s, third.p);
  assert.ok(third.s.counterFor > 0); third.s.resetAll(); assert.equal(third.s.counterFor, 0);
});
