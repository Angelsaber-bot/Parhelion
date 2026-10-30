import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorEncounters, AKECHI_GUARDS, KNIGHT_TRIAL_ID, KNIGHT_TRIAL_CLEAR, KYOTO_QUIET_LEDGE } from '../src/authoredEncounters.ts';
import { WorldCombatState, distanceXZ, type CombatTerrain, type Point3 } from '../src/combat.ts';
import { q, spawns, layout } from './enemy-live-terrain.fixture.ts';

const point = (x: number, z = 0, y = 0): Point3 => ({ x, y, z });
const flat: CombatTerrain = { walk: (_from, x, z) => point(x, z), lineOfSight: () => true };
const authored = authorEncounters(spawns, q.safeSpawn);

test('authored Akechi pair swaps two safe Kyoto actors, never grows population or weakens exclusions', () => {
  assert.equal(authored.length, 145); assert.deepEqual(authored.map(s => s.id), spawns.map(s => s.id));
  const moved = authored.filter((s, i) => distanceXZ(s.p, spawns[i].p) > .01);
  assert.deepEqual(moved.map(s => s.id), AKECHI_GUARDS.map(s => s.id));
  assert.deepEqual(moved.map(s => s.role), ['lancer', 'duelist']);
  for (const s of moved) {
    assert.ok(q.safeSpawn(s.p.x, s.p.z), 'unchanged original validator accepts guard');
    assert.ok(q.clear(s.p)); assert.ok(s.p.y > layout.world.waterLevel + .45);
    assert.ok(distanceXZ(s.p, KYOTO_QUIET_LEDGE) > 35, 'quiet ledge remains outside leash');
    assert.equal(s.encounter, 'akechi');
  }
  assert.deepEqual(authorEncounters(spawns, () => null).map(s => s.p), spawns.map(s => s.p), 'failed placements preserve original actors rather than fallback into unsafe space');
  assert.deepEqual(authorEncounters([], q.safeSpawn), [], 'no actor means no extra spawn');
});

test('actual camp direct approach is threatened, but quiet ledge can observe without aggro', () => {
  const guards = authored.filter(s => s.encounter === 'akechi');
  const direct = point(-216, 888, q.ground(-216, 888)!.point.y);
  const s = new WorldCombatState(guards, []); s.setDefense({ guard: 1, invulnerable: true });
  for (let i = 0; i < 240; i++) s.step(.05, direct, true, q.terrain);
  assert.ok(s.enemies.some(e => e.attackCount > 0), `direct camp route must have actual attacks: ${JSON.stringify(s.enemies)}`);
  assert.ok(s.enemies.every(e => q.clear(e.p, .6)), 'no phasing into camp structures');
  const innerApproach = point(-216, 900, q.ground(-216, 900)!.point.y);
  const inner = new WorldCombatState(guards, []); inner.setDefense({ guard: 1, invulnerable: true });
  for (let i = 0; i < 160; i++) inner.step(.05, innerApproach, true, q.terrain);
  assert.ok(inner.enemies.every(e => e.attackCount > 0), 'both complementary roles can actually attack along the inner camp approach');
  const quiet = new WorldCombatState(guards, []);
  for (let i = 0; i < 120; i++) quiet.step(.05, KYOTO_QUIET_LEDGE, true, q.terrain);
  assert.equal(quiet.hp, 100); assert.ok(quiet.enemies.every(e => e.mode === 'idle' && e.attackCount === 0));
});

test('lantern route meaningfully reduces local perception, not all-world immunity', () => {
  const spawn = { id: 'guard', kind: 'shade' as const, p: point(-202, 882), encounter: 'akechi' as const, role: 'lancer' as const };
  const normal = new WorldCombatState([spawn], []), quiet = new WorldCombatState([spawn], []);
  const lane = point(-218, 864);
  quiet.syncWorldFlags(new Set(['kyoto_lantern_route']));
  normal.step(.05, lane, true, flat); quiet.step(.05, lane, true, flat);
  assert.notEqual(normal.enemies[0].mode, 'idle'); assert.equal(quiet.enemies[0].mode, 'idle');
  quiet.step(.05, point(-202, 875), true, flat); assert.notEqual(quiet.enemies[0].mode, 'idle', 'entering the camp still starts combat');
});

test('named knight first win stays retired, explicit rematch waits for arrival and does not move home', () => {
  const s = new WorldCombatState([{ id: KNIGHT_TRIAL_ID, miniboss: KNIGHT_TRIAL_ID, kind: 'shade', p: point(0) }], []), e = s.enemies[0];
  s.step(.05, point(2), true, flat); s.hitEnemy(e.id, 10000);
  for (let i = 0; i < 3000; i++) s.step(.05, point(50), true, flat);
  assert.equal(e.mode, 'dead'); assert.equal(e.timer, Infinity);
  s.syncWorldFlags(new Set([KNIGHT_TRIAL_CLEAR]));
  assert.equal(s.startOptionalTrial('unknown'), false); assert.equal(s.startOptionalTrial(e.id), true); assert.equal(s.startOptionalTrial(e.id), false);
  s.syncWorldFlags(new Set([KNIGHT_TRIAL_CLEAR])); s.step(.05, point(500), true, flat); assert.equal(e.mode, 'dead', 'request does not start cross-map battle');
  s.step(.05, point(20), true, flat); assert.equal(e.hp, e.maxHp); assert.deepEqual(e.home, point(0)); assert.equal(e.mode, 'idle');
  s.step(.05, point(2), true, flat); assert.equal(e.mode, 'windup');
  s.syncWorldFlags(new Set([KNIGHT_TRIAL_CLEAR])); assert.equal(e.mode, 'windup', 'saved completion does not cancel explicit replay');
  s.hitEnemy(e.id, 10000); assert.equal(e.mode, 'dead');
  assert.equal(s.drainEvents().filter(e => e.type === 'victory').length, 0, 'optional trial never creates boss rewards');
});

test('road pack yields to the named knight so the duel has readable tells', () => {
  const s = new WorldCombatState([
    { id: KNIGHT_TRIAL_ID, miniboss: KNIGHT_TRIAL_ID, kind: 'shade', p: point(0) },
    { id: 'wild_56', kind: 'shade', p: point(3, 3) }, { id: 'wild_56b', kind: 'shade', p: point(3, -3) },
  ], []);
  s.step(.05, point(2), true, flat); s.step(.05, point(2), true, flat);
  assert.equal(s.enemies[0].mode, 'windup');
  assert.ok(s.enemies.slice(1).every(e => e.mode === 'idle'));
  s.hitEnemy(KNIGHT_TRIAL_ID, 10000); s.syncWorldFlags(new Set([KNIGHT_TRIAL_CLEAR]));
  assert.ok(s.enemies.slice(1).every(e => e.mode === 'pacified'), 'first victory really leaves the road safe');
  s.resetAll(); s.syncWorldFlags(new Set()); assert.ok(s.enemies.slice(1).every(e => !e.pacified));
});

test('relay B pacifies visible mechanical actors without kill, damage, ray targets or farmable skill targets', () => {
  const s = new WorldCombatState([{ id: 'wild_48', kind: 'shade', p: point(0) }, { id: 'other', kind: 'shade', p: point(50) }], []);
  s.step(.05, point(2), true, flat); s.drainEvents();
  s.syncWorldFlags(new Set(['relay_b'])); s.step(.05, point(2), true, flat);
  const e = s.enemies[0]; assert.equal(e.mode, 'pacified'); assert.equal(e.active, true); assert.equal(e.hp, e.maxHp);
  assert.equal(s.hitEnemy(e.id, 30, { source: 'melee' }), false);
  assert.equal(s.raycast(point(0, 4, 1.05), point(0, -1)), null);
  assert.deepEqual(s.drainEvents(), []); assert.equal(s.enemies[1].pacified, false);
  for (let i = 0; i < 100; i++) s.step(.05, point(1), true, flat);
  assert.equal(s.hp, 100, 'peaceful shutdown cannot attack');
  s.resetAll(); s.syncWorldFlags(new Set()); s.step(.05, point(1), true, flat);
  assert.equal(e.pacified, false); assert.equal(e.mode, 'windup', 'new game restores original encounter');
});
