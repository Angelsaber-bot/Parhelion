import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldCombatState, COMBAT, BOSS_REQUIREMENTS, WILDERNESS_ZONES, makeWildernessSpawns, type CombatTerrain, type Point3 } from '../src/combat.ts';

const ground: CombatTerrain = { walk: (_p, x, z) => ({ x, y: 0, z }), lineOfSight: () => true };
const wall: CombatTerrain = { ...ground, lineOfSight: () => false };
const boss = { id: 'boss', kind: 'king' as const, p: { x: 0, y: 0, z: 0 } };
const ready = new Set<string>(BOSS_REQUIREMENTS);
const make = () => new WorldCombatState([{ id: 'wild', kind: 'shade', p: { x: 20, y: 0, z: 0 } }], boss);
const advance = (s: WorldCombatState, seconds: number, p: Point3, terrain = ground) => {
  for (let i = 0; i < Math.round(seconds / 0.05); i++) s.step(0.05, p, true, terrain);
};

test('wilderness placement is seeded, bounded, and rejects unsafe candidates', () => {
  const place = (x: number, z: number) => ({ x, y: 2, z });
  const a = makeWildernessSpawns(537, place), b = makeWildernessSpawns(537, place);
  const perZone = WILDERNESS_ZONES.reduce((n, z) => n + ((z as { pack?: number }).pack ?? 2), 0);
  assert.deepEqual(a, b); assert.equal(a.length, Math.min(COMBAT.wildernessCap, perZone));
  assert.notDeepEqual(a, makeWildernessSpawns(538, place));
  let calls = 0;
  assert.equal(makeWildernessSpawns(537, () => { calls++; return null; }).length, 0);
  assert.equal(calls, perZone * 32, 'no unbounded spawn retries (pair or pack per zone)');
});

test('shots are rate limited, nearest-enemy hits respect supplied occlusion and dead enemies cannot be hit', () => {
  const s = make(); s.step(0.05, { x: 20, y: 0, z: 9 }, true, ground);
  const origin = { x: 20, y: 1.05, z: 9 }, dir = { x: 0, y: 0, z: -1 };
  assert.equal(s.raycast(origin, dir, 3), null, 'wall prevents hits');
  assert.equal(s.raycast(origin, dir, 150)?.id, 'wild');
  assert.equal(s.canShoot(), true); assert.equal(s.canShoot(), false);
  advance(s, 0.2, origin); assert.equal(s.canShoot(), true);
  s.hitEnemy('wild', 100); assert.equal(s.raycast(origin, dir), null);
  assert.equal(s.hitEnemy('wild', 100), false);
});

test('wilderness aggro requires line of sight, leashes and only respawns away from the player', () => {
  const s = make(), p = { x: 20, y: 0, z: 5 };
  advance(s, 2, p, wall); assert.equal(s.enemies[0].mode, 'idle'); assert.equal(s.hp, 100);
  advance(s, 1, p); assert.notEqual(s.enemies[0].mode, 'idle');
  advance(s, 0.1, { x: 70, y: 0, z: 0 }); assert.equal(s.enemies[0].mode, 'idle'); assert.deepEqual(s.enemies[0].p, s.enemies[0].home);
  advance(s, 0.1, p); s.hitEnemy('wild', 100);
  advance(s, 50, p); assert.equal(s.enemies[0].mode, 'dead', 'never respawn beside player');
  advance(s, 0.1, { x: 80, y: 0, z: 0 }); assert.equal(s.enemies[0].hp, s.enemies[0].maxHp);
});

test('boss is gated, damageable only during its encounter, and transitions once at half HP', () => {
  const s = make();
  assert.equal(s.beginBoss(new Set()), false); assert.equal(s.hitEnemy('boss', 20), false);
  assert.equal(s.beginBoss(ready), true); assert.equal(s.beginBoss(ready), false);
  s.hitEnemy('boss', 950); assert.equal(s.boss.phase, 2); assert.equal(s.boss.mode, 'recover');
  assert.equal(s.drainEvents().filter(e => e.type === 'phase').length, 1);
  s.hitEnemy('boss', 1); assert.equal(s.drainEvents().filter(e => e.type === 'phase').length, 0);
  s.hitEnemy('boss', 10000); assert.equal(s.bossCleared, true); assert.equal(s.bossStarted, false);
  assert.equal(s.drainEvents().filter(e => e.type === 'victory').length, 1);
  assert.equal(s.beginBoss(ready), false, 'victory cannot be farmed');
});

test('boss tells lock impact location, allow dodging, and cannot damage through a wall', () => {
  const s = new WorldCombatState([], boss); s.beginBoss(ready);
  const p = { x: 12, y: 0, z: 0 };
  advance(s, 1.5, p); assert.equal(s.boss.mode, 'windup');
  assert.equal(s.boss.attack, 'burst'); assert.deepEqual(s.boss.target, p);
  advance(s, 1.5, { x: 12, y: 0, z: 12 }); assert.equal(s.hp, 100, 'walk out of the fixed red tell');
  const t = new WorldCombatState([], boss); t.beginBoss(ready);
  advance(t, 1.5, p); advance(t, 1.5, p, wall); assert.equal(t.hp, 100);
});

test('leaving boss arena resets its full health; pause/debug flight does not tick combat', () => {
  const s = make(); s.beginBoss(ready); s.hitEnemy('boss', 400);
  s.step(0.1, { x: 3, y: 0, z: 0 }, false, ground);
  assert.equal(s.boss.hp, 1400); assert.equal(s.boss.mode, 'chase');
  advance(s, 0.1, { x: 200, y: 0, z: 0 });
  assert.equal(s.bossStarted, false); assert.equal(s.boss.hp, COMBAT.bossHp);
  assert.equal(s.boss.active, false);
});

test('player defeat ends encounter, recovery emits one respawn and keeps cleared-save compatibility', () => {
  const s = new WorldCombatState([], boss); s.beginBoss(ready);
  advance(s, 25, { x: 0, y: 0, z: 0 });
  assert.equal(s.bossStarted, false);
  const events = s.drainEvents(); assert.equal(events.filter(e => e.type === 'death').length, 1);
  assert.equal(events.filter(e => e.type === 'revive').length, 1); assert.equal(s.hp, 100);
  const old = new WorldCombatState([], boss, true);
  assert.equal(old.bossCleared, true); assert.equal(old.beginBoss(ready), false);
  old.resetAll(false); assert.equal(old.beginBoss(ready), true);
});

test('invalid damage, time, ray and oversized spawn input are bounded', () => {
  const wild = Array.from({ length: 999 }, (_, i) => ({ id: `${i}`, kind: 'shade' as const, p: { x: 1, y: 0, z: i } }));
  const s = new WorldCombatState(wild, boss); assert.equal(s.enemies.length, COMBAT.wildernessCap + 1);
  s.beginBoss(ready); assert.equal(s.hitEnemy('boss', NaN), false); assert.equal(s.hitEnemy('boss', -20), false);
  const hp = s.hp; s.step(NaN, { x: 0, y: 0, z: 0 }, true, ground); assert.equal(s.hp, hp);
  assert.equal(s.raycast({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), null);
});

test('each era boss has its own core requirements and cleared state; only one fight runs at a time', () => {
  const sea = { id: 'admiral', kind: 'king' as const, p: { x: 200, y: 0, z: 0 }, requires: ['shard_a'] };
  const s = new WorldCombatState([], [{ ...boss, requires: BOSS_REQUIREMENTS }, { ...sea, cleared: false }]);
  assert.equal(s.beginBoss(new Set(), 'admiral'), false, 'admiral needs its own shard');
  assert.equal(s.beginBoss(new Set(['shard_a']), 'admiral'), true);
  assert.equal(s.boss.id, 'admiral');
  assert.equal(s.beginBoss(ready, 'boss'), false, 'no second fight while one runs');
  advance(s, 0.1, { x: 200, y: 0, z: 5 });
  assert.equal(s.bosses[0].active, false, 'the other boss stays dormant');
  s.hitEnemy('admiral', 1e4);
  assert.equal(s.isCleared('admiral'), true); assert.equal(s.isCleared('boss'), false);
  assert.equal(s.beginBoss(ready, 'boss'), true, 'the first era boss is still available');
  s.resetAll([true, false]);
  assert.equal(s.isCleared('boss'), true); assert.equal(s.isCleared('admiral'), false);
});
