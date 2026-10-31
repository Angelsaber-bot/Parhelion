import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldCombatState, type CombatTerrain } from '../src/combat.ts';
const p = (x = 0, z = 0) => ({ x, y: 0, z });
const terrain: CombatTerrain = { walk: (_p, x, z) => p(x, z), lineOfSight: () => true };
function ready() {
  const state = new WorldCombatState([{ id: 'first', kind: 'shade', p: p() }, { id: 'second', kind: 'shade', p: p(1) }], []);
  for (const e of state.enemies) { e.active = true; e.mode = 'windup'; e.timer = .01; e.attack = 'sweep'; e.attackCount = 1; e.role = 'stalker'; }
  return state;
}
test('lethal contact cannot restore a recovery attack after the defeat reset or tick later actors', () => {
  const state = ready(); state.hp = 1;
  state.step(.05, p(.5), true, terrain);
  assert.equal(state.defeated, true);
  for (const enemy of state.enemies) {
    assert.equal(enemy.mode, 'idle', 'defeat reset is terminal for this simulation tick');
    assert.equal(enemy.active, false); assert.equal(enemy.attackCount, 0);
  }
  assert.equal(state.drainEvents().filter(e => e.type === 'death').length, 1);
});
test('only completed attacks emit one contact cue; interruptions and phase breaks do not', () => {
  const state = ready(); state.enemies[1].mode = 'idle'; state.enemies[1].p = p(100);
  state.step(.05, p(1), true, terrain);
  const contacts = state.drainEvents().filter(e => e.type === 'attackContact');
  assert.equal(contacts.length, 1);
  assert.deepEqual(contacts[0], { type: 'attackContact', id: 'first', attack: 'sweep', sequence: 1, origin: p(), target: p(), radius: 2.4 });
  for (let i = 0; i < 10; i++) state.step(.05, p(1), true, terrain);
  assert.equal(state.drainEvents().filter(e => e.type === 'attackContact').length, 0);
  state.enemies[0].mode = 'windup'; state.enemies[0].timer = .1;
  state.hitEnemy('first', 1, { source: 'melee' });
  for (let i = 0; i < 5; i++) state.step(.05, p(1), true, terrain);
  assert.equal(state.drainEvents().filter(e => e.type === 'attackContact').length, 0);
});
test('contact snapshots do not track later target changes and pause cannot emit contact', () => {
  const state = ready(); const e = state.enemies[0]; state.enemies[1].mode = 'dead';
  e.attack = 'shot'; e.target = p(4);
  state.step(.1, p(4), false, terrain);
  assert.deepEqual(state.drainEvents(), []);
  state.step(.05, p(4), true, terrain);
  const contact = state.drainEvents().find(e => e.type === 'attackContact');
  assert.ok(contact?.type === 'attackContact');
  e.target.x = 100; e.p.x = 50;
  assert.equal(contact.target.x, 4); assert.equal(contact.origin.x, 0);
});
