import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldCombatState, COMBAT, type CombatTerrain } from '../src/combat.ts';
import { ENEMY_TACTICS, enemyWalkTurns } from '../src/enemyTactics.ts';
const p = (x = 0, z = 0) => ({ x, y: 0, z });
const ground: CombatTerrain = { walk: (_from, x, z) => p(x, z), lineOfSight: () => true };
const make = (role: 'musketeer' | 'bombardier' | 'stalker' = 'stalker') => new WorldCombatState([{ id: 'actor', kind: 'shade', p: p(), role }], []);
for (const role of ['musketeer', 'bombardier'] as const) test(`${role}: bounded reposition after recovery, no sliding tells or endless retreat`, () => {
  const s = make(role), e = s.enemies[0], player = p(2);
  e.active = true; e.mode = 'recover'; e.timer = .01;
  s.step(.05, player, true, ground); assert.equal(e.mode, 'chase');
  assert.equal(e.timer, ENEMY_TACTICS.rangedReset);
  const start = { ...e.p }; s.step(.05, player, true, ground);
  assert.ok(e.p.x < start.x, 'backs away from close player during reset only');
  for (let i = 0; i < 20 && e.mode === 'chase'; i++) s.step(.05, player, true, ground);
  assert.equal(e.mode, 'windup', 'retreat cannot indefinitely deny close engagement');
  assert.ok(Math.hypot(e.p.x, e.p.z) < 2.1);
  const locked = { ...e.p }; for (let i = 0; i < 8; i++) s.step(.05, player, true, ground);
  assert.deepEqual(e.p, locked, 'actor is planted during its locked windup');
  e.mode = 'recover'; e.timer = .5; s.step(.05, player, true, ground);
  assert.deepEqual(e.p, locked, 'punish windows remain physically stationary');
});
test('local obstacle sidestep uses stable handedness and at most three terrain-authorized candidates', () => {
  const s = make(), e = s.enemies[0]; let calls = 0;
  const obstacle: CombatTerrain = { ...ground, walk: (_from, x, z) => { calls++; return Math.abs(z) > .02 ? p(x, z) : null; } };
  s.step(.05, p(10), true, obstacle);
  assert.ok(e.p.x > 0 && Math.abs(e.p.z) > 0); assert.equal(calls, 2);
  assert.deepEqual(enemyWalkTurns(e), enemyWalkTurns(e));
  calls = 0; const held = { ...e.p };
  s.step(.05, p(10), true, { ...ground, walk: () => { calls++; return null; } });
  assert.equal(calls, ENEMY_TACTICS.maxWalkCandidates); assert.deepEqual(e.p, held);
  calls = 0; s.step(.05, p(10), true, { ...obstacle, lineOfSight: () => false });
  assert.equal(calls, 0, 'no chasing hidden player through cover');
});
test('local movement cannot push an actor beyond its patrol leash', () => {
  const s = make('musketeer'), e = s.enemies[0]; e.p = p(COMBAT.leash - .01); e.mode = 'chase'; e.timer = .5;
  s.step(.1, p(COMBAT.leash - 2), true, ground);
  assert.ok(Math.hypot(e.p.x, e.p.z) <= COMBAT.leash);
});
test('pack pressure slots bound overlapping tells without starving the later roster or inflating damage', () => {
  const s = new WorldCombatState(Array.from({ length: 6 }, (_, i) => ({ id: `pack_${i}`, kind: 'shade' as const, p: p(Math.cos(i) * 1.5, Math.sin(i) * 1.5), role: 'stalker' as const })), []);
  s.setDefense({ guard: 1, invulnerable: true });
  let most = 0;
  for (let tick = 0; tick < 300; tick++) {
    s.step(.05, p(), true, ground);
    const tells = s.enemies.filter(e => e.mode === 'windup').length;
    most = Math.max(most, tells); assert.ok(tells <= ENEMY_TACTICS.closePressureLimit);
  }
  assert.equal(most, 2); assert.equal(s.hp, 100);
  for (const e of s.enemies) assert.ok(e.attackCount >= 3, `${e.id}: has repeated fair attack opportunities`);
});
test('pause, stagger, dead and pacified enemies never reposition or reserve a new pressure slot', () => {
  for (const mode of ['stagger', 'dead', 'pacified'] as const) {
    const s = make('musketeer'), e = s.enemies[0]; e.mode = mode; e.timer = 10; e.pacified = mode === 'pacified';
    s.step(.1, p(2), true, ground); assert.deepEqual(e.p, p()); assert.equal(e.attackCount, 0);
  }
  const s = make('musketeer'), e = s.enemies[0]; e.mode = 'chase'; e.timer = .5;
  s.step(.1, p(2), false, ground); assert.deepEqual(e.p, p()); assert.equal(e.timer, .5);
});
