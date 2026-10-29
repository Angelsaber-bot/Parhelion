import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldCombatState, enemyAttackRadius, distanceXZ, isMusketeer, enemyAttackTiming, type CombatTerrain, type Point3 } from '../src/combat.ts';
import { MINIBOSSES, makeMinibossSpawns } from '../src/minibosses.ts';
const terrain: CombatTerrain = { walk: (_p, x, z) => ({ x, y: 0, z }), lineOfSight: () => true };
const flat = (x: number, z: number) => ({ x, y: 0, z });
const advance = (s: WorldCombatState, seconds: number, p: Point3, t = terrain) => {
  for (let i = 0; i < seconds * 20; i++) s.step(.05, p, true, t);
};
test('one deterministic elite per region, bounded safe placement and crowd separation', () => {
  const points = makeMinibossSpawns(flat);
  assert.equal(points.length, 5); assert.equal(new Set(MINIBOSSES.map(m => m.region)).size, 5);
  assert.deepEqual(points, makeMinibossSpawns(flat));
  for (const p of makeMinibossSpawns(flat, points)) assert.ok(points.every(other => distanceXZ(p.p, other.p) >= 16));
  let calls = 0; assert.deepEqual(makeMinibossSpawns(() => { calls++; return null; }), []);
  assert.equal(calls, 49 * 5);
});
test('elite has modest HP, locked dodgeable tell, LOS, leash and no story reward', () => {
  const spawn = { ...makeMinibossSpawns(flat)[0], p: flat(0, 0) };
  const s = new WorldCombatState([spawn], []), e = s.enemies[0];
  assert.equal(e.maxHp, 220);
  const p = flat(12, 0); advance(s, .05, p);
  assert.equal(e.mode, 'windup'); assert.equal(e.attack, 'burst'); assert.equal(e.timer, 1.4);
  assert.deepEqual(e.target, p); assert.equal(enemyAttackRadius(e), 4.5);
  advance(s, 1.5, flat(12, 9)); assert.equal(s.hp, 100);
  advance(s, .1, flat(50, 0)); assert.equal(e.mode, 'idle'); assert.equal(e.hp, 220);
  advance(s, .05, p); advance(s, 1.5, p, { ...terrain, lineOfSight: () => false }); assert.equal(s.hp, 100);
  s.hitEnemy(e.id, 264); assert.equal(s.drainEvents().some(event => event.type === 'victory'), false);
  advance(s, 130, p); assert.equal(e.mode, 'dead');
  advance(s, .1, flat(50, 0)); assert.equal(e.hp, 220);
});
test('winter musketeer shoots a locked dodgeable point with matching radius, range and cover checks', () => {
  const make = () => new WorldCombatState([{ id: 'musket', kind: 'shade', p: flat(0, -720) }], []);
  const s = make(), e = s.enemies[0], p = flat(12, -720);
  assert.equal(isMusketeer(e), true);
  advance(s, .05, p); assert.equal(e.attack, 'shot'); assert.equal(e.timer, 1.2);
  assert.deepEqual(e.target, p); assert.equal(enemyAttackRadius(e), 1.4);
  advance(s, 1.25, flat(12, -716)); assert.equal(s.hp, 100, 'side-step dodges musket');
  const hit = make(); advance(hit, 1.3, p); assert.equal(hit.hp, 86);
  const wall = make(); advance(wall, .05, p); advance(wall, 1.25, p, { ...terrain, lineOfSight: () => false });
  assert.equal(wall.hp, 100, 'cover blocks actual shot impact');
  const far = make(); advance(far, 1.3, flat(26, -720)); assert.equal(far.enemies[0].attackCount, 0);
});

test('regional elites have distinct readable attacks rather than shared magical ground bursts', () => {
  for (const def of MINIBOSSES) {
    const s = new WorldCombatState([{ id: def.id, miniboss: def.id, kind: def.kind, p: flat(0, 0) }], []);
    const e = s.enemies[0], p = flat(def.profile.attack === 'burst' ? 12 : 2, 0);
    advance(s, .05, p);
    assert.equal(e.attack, def.profile.attack);
    assert.equal(e.mode, 'windup'); assert.equal(e.timer, def.profile.windup);
    assert.ok(e.timer >= .9, 'every elite strike has a readable tell');
    assert.equal(enemyAttackRadius(e), def.profile.radius);
    advance(s, def.profile.windup + .05, flat(10, 10)); assert.equal(s.hp, 100, 'every elite strike can be dodged');
    assert.equal(e.mode, 'recover');
    const covered = new WorldCombatState([{ id: def.id, miniboss: def.id, kind: def.kind, p: flat(0, 0) }], []);
    advance(covered, .05, p);
    advance(covered, def.profile.windup + .05, p, { ...terrain, lineOfSight: () => false });
    assert.equal(covered.hp, 100, 'cover blocks every regional elite impact');
    if (def.id === 'elite_ember_samurai') {
      assert.equal(enemyAttackTiming(e).recovery, .55);
      e.attackCount = 2; assert.equal(enemyAttackTiming(e).recovery, 1.65, 'paired slashes expose a longer punish window');
    }
  }
});
