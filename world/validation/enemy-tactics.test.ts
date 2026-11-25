import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldCombatState, COMBAT, distanceXZ, type CombatTerrain } from '../src/combat/combat.ts';
import { enemyAttackPose } from '../src/combat/enemyAttackPresentation.ts';
import { ENEMY_ROLES } from '../src/combat/enemyRoles.ts';
import { ENEMY_TACTICS, enemyDetourTurns, enemyWalkTurns } from '../src/combat/enemyTactics.ts';
const p = (x = 0, z = 0) => ({ x, y: 0, z });
const ground: CombatTerrain = { walk: (_from, x, z) => p(x, z), lineOfSight: () => true };
const make = (role: 'musketeer' | 'jaeger' | 'bombardier' | 'stalker' = 'stalker') => new WorldCombatState([{ id: 'actor', kind: 'shade', p: p(), role }], []);
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
test('local obstacle sidestep uses stable handedness and bounds terrain queries', () => {
  const s = make(), e = s.enemies[0]; let calls = 0;
  const obstacle: CombatTerrain = { ...ground, walk: (_from, x, z) => { calls++; return Math.abs(z) > .02 ? p(x, z) : null; } };
  s.step(.05, p(10), true, obstacle);
  assert.ok(e.p.x > 0 && Math.abs(e.p.z) > 0); assert.equal(calls, 2);
  assert.deepEqual(enemyWalkTurns(e), enemyWalkTurns(e));
  calls = 0; const held = { ...e.p };
  s.step(.05, p(10), true, { ...ground, walk: () => { calls++; return null; } });
  assert.equal(calls, ENEMY_TACTICS.maxWalkCandidates + enemyDetourTurns(e).length); assert.deepEqual(e.p, held);
  assert.equal(enemyAttackPose(e, 'samurai').clip, 'Idle', 'blocked feet stop the walk cycle');
});
test('ranged patrols hold their firing distance when other enemies fill both attack slots', () => {
  const s = new WorldCombatState([
    { id: 'watch_a', kind: 'shade', p: p(12), role: 'stalker' },
    { id: 'watch_b', kind: 'shade', p: p(12), role: 'stalker' },
    { id: 'marksman', kind: 'shade', p: p(), role: 'musketeer' },
  ], []);
  const player = p(12), gunner = s.enemies[2];
  for (const blocker of s.enemies.slice(0, 2)) {
    blocker.mode = 'windup'; blocker.timer = .3; blocker.active = true; blocker.target = { ...player };
  }
  s.step(.05, player, true, ground);
  assert.equal(gunner.mode, 'chase');
  assert.deepEqual(gunner.p, p(), 'a waiting marksman holds the line');
  assert.equal(gunner.walking, false);
  for (let i = 0; i < 7; i++) s.step(.05, player, true, ground);
  assert.equal(gunner.mode, 'windup');
  assert.deepEqual(gunner.p, p(), 'the next available tell starts from its firing position');
});
test('a ranged patrol with a blocked retreat uses a lateral step without lunging toward the player', () => {
  const s = make('musketeer'), e = s.enemies[0], player = p(4);
  e.mode = 'chase'; e.timer = ENEMY_TACTICS.rangedReset;
  const narrowLane = { ...ground, walk: (from: ReturnType<typeof p>, x: number, z: number) => Math.abs(x - from.x) < 1e-6 ? p(x, z) : null };
  s.step(.1, player, true, narrowLane);
  assert.ok(Math.abs(e.p.z) > .2);
  assert.ok(distanceXZ(e.p, player) >= 4);
  assert.equal(e.walking, true);
  for (let i = 0; i < 8; i++) s.step(.1, player, true, narrowLane);
  assert.equal(e.mode, 'windup');
  assert.deepEqual(e.target, player);
});
test('breaking sight investigates only the last sighting, releases combat pressure and walks home', () => {
  const s = make(), e = s.enemies[0], player = p(5);
  const cover = { ...ground, lineOfSight: () => false };
  s.step(.1, player, true, ground);
  player.x = -5; player.z = 10;
  const lastSeen = p(5);
  let outward = e.p.x;
  for (let i = 0; i < 29; i++) {
    s.step(.1, player, true, cover);
    assert.deepEqual(e.chaseTarget, lastSeen);
    assert.ok(e.p.x >= outward && e.p.x <= lastSeen.x);
    assert.equal(e.p.z, 0);
    outward = e.p.x;
  }
  assert.equal(e.attackCount, 0);
  assert.equal(s.quietFor, 0);
  assert.equal(enemyAttackPose(e, 'samurai').clip, 'Idle', 'waiting at the sighting is stationary');
  s.hp -= 20;
  for (let i = 0; i < 80; i++) {
    const before = e.p;
    s.step(.1, player, true, cover);
    assert.ok(distanceXZ(e.p, before) <= ENEMY_ROLES.stalker.speed * .1 + 1e-6);
  }
  assert.equal(e.mode, 'idle');
  assert.ok(distanceXZ(e.p, e.home) <= ENEMY_TACTICS.arrivalRadius + 1e-6);
  assert.equal(s.hp, s.maxHp);
  assert.equal(s.drainEvents().filter(event => event.type === 'attackContact').length, 0);
});
test('patrol boundary triggers gradual return, retaining damage and allowing a new visible contact', () => {
  const s = make(), e = s.enemies[0];
  for (let i = 0; i < 12; i++) s.step(.1, p(10), true, ground);
  s.hitEnemy(e.id, 5);
  const before = e.p, hp = e.hp;
  s.step(.1, p(COMBAT.leash + 1), true, ground);
  assert.deepEqual(e.chaseTarget, e.home);
  assert.ok(e.p.x > 0 && e.p.x < before.x);
  assert.equal(e.hp, hp);
  assert.ok(s.quietFor > 0);
  s.step(.1, p(12), true, ground);
  assert.deepEqual(e.chaseTarget, p(12));
  assert.equal(s.quietFor, 0);
});
test('a return blocked by terrain stops moving and drops pressure', () => {
  const s = make(), e = s.enemies[0];
  for (let i = 0; i < 10; i++) s.step(.1, p(10), true, ground);
  const held = e.p;
  const wall = { ...ground, walk: () => null };
  for (let i = 0; i < 25; i++) s.step(.1, p(COMBAT.leash + 1), true, wall);
  assert.equal(e.mode, 'idle');
  assert.deepEqual(e.p, held);
  assert.ok(s.quietFor >= 2);
});
for (const role of ['musketeer', 'jaeger'] as const) test(`${role} acquires visible targets at its effective range and commits to the original tell`, () => {
  const s = make(role), e = s.enemies[0], player = p(ENEMY_ROLES[role].range - .5);
  s.step(.1, player, true, { ...ground, lineOfSight: () => false });
  assert.equal(e.mode, 'idle');
  s.step(.1, player, true, ground);
  assert.equal(e.mode, 'windup');
  const target = { ...player }, start = e.p;
  player.z = 8;
  for (let i = 0; i < 21; i++) s.step(.1, player, true, { ...ground, lineOfSight: () => false });
  assert.equal(e.mode, 'recover');
  assert.deepEqual(e.target, target);
  assert.deepEqual(e.p, start);
  assert.equal(s.hp, s.maxHp);
  assert.equal(s.drainEvents().filter(event => event.type === 'attackContact').length, 1);
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
