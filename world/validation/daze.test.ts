import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldCombatState, DAZE, dazeCapable, dazeThreshold, dazeRatio, type CombatTerrain } from '../src/combat.ts';
import { makeMinibossSpawns } from '../src/minibosses.ts';
const terrain: CombatTerrain = { walk: (_p, x, z) => ({ x, y: 0, z }), lineOfSight: () => true };
const flat = (x: number, z: number) => ({ x, y: 0, z });
function elite() {
  const spawn = { ...makeMinibossSpawns(flat)[1], p: flat(0, 0) };
  const s = new WorldCombatState([spawn], []), e = s.enemies[0];
  s.step(.05, flat(1.5, 0), true, terrain); s.drainEvents();
  return { s, e };
}

test('only elites and chapter bosses carry a toughness gauge', () => {
  const s = new WorldCombatState([{ id: 'troop', kind: 'shade', p: flat(0, 0) }], []);
  assert.equal(dazeCapable(s.enemies[0]), false);
  assert.equal(dazeCapable(elite().e), true);
  assert.equal(dazeCapable({ kind: 'king' }), true);
  assert.equal(dazeCapable({ kind: 'king', storyPattern: 'echo-warden' }), false);
});

test('the blade breaks an elite far sooner than the rifle; a break staggers and amplifies damage', () => {
  const { s, e } = elite(), threshold = dazeThreshold(e);
  // Rifle: same raw damage builds less than a third of the gauge melee would.
  s.hitEnemy(e.id, 10, { source: 'ranged' });
  assert.ok(Math.abs((e.daze ?? 0) - 10 * DAZE.source.ranged) < 1e-9);
  // Melee pressure fills the rest and breaks the stance before the elite dies.
  let hits = 0;
  while ((e.dazedFor ?? 0) === 0 && hits < 100) { s.hitEnemy(e.id, 9, { source: 'melee' }); hits++; }
  assert.ok(e.hp > 0, 'break arrives before the kill');
  assert.ok(hits * 9 < threshold + 9, 'melee daze tracks damage dealt');
  const events = s.drainEvents();
  assert.equal(events.filter(ev => ev.type === 'dazed').length, 1);
  assert.equal(e.mode, 'stagger'); assert.equal(e.timer, DAZE.stun); assert.equal(dazeRatio(e), 1);
  assert.equal(e.daze, 0, 'gauge restarts');
  // While broken, damage is amplified and the gauge does not build.
  s.hitEnemy(e.id, 10, { source: 'ranged' });
  const hit = s.drainEvents().find(ev => ev.type === 'hit') as { damage: number };
  assert.ok(hit.damage > 10); assert.equal(e.daze, 0);
  // The break runs out on its own.
  for (let i = 0; i < DAZE.stun / .05 + 2; i++) s.step(.05, flat(30, 30), true, terrain);
  assert.equal(e.dazedFor, 0); assert.notEqual(e.mode, 'stagger');
});

test('the gauge drains when pressure stops, and resets with the enemy', () => {
  const { s, e } = elite();
  s.hitEnemy(e.id, 20, { source: 'melee' });
  const built = e.daze!;
  for (let i = 0; i < DAZE.drainAfter / .05 - 2; i++) s.step(.05, flat(1.5, 0), true, terrain);
  assert.equal(e.daze, built, 'no drain inside the grace period');
  for (let i = 0; i < 40; i++) s.step(.05, flat(1.5, 0), true, terrain);
  assert.ok(e.daze! < built, 'drains after it');
  s.hitEnemy(e.id, 20, { source: 'melee' }); s.resetAll();
  assert.equal(s.enemies[0].daze, 0); assert.equal(s.enemies[0].dazedFor, 0);
});
