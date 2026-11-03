import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runScenario } from './balance-scenarios';

test('all four bosses continue threatening a ranged player through both phases', () => {
  for (const boss of ['boss_vacant_king', 'boss_drowned_admiral', 'boss_winter_warden', 'boss_hellfire_lord']) {
    const result = runScenario({ name: boss, boss, strategy: 'dodge-gun' });
    assert.equal(result.terminal, 'victory', boss);
    assert.ok(result.attacks >= 5, `${boss} must not stop after its first ranged attack`);
    assert.notEqual(result.phase2At, null, boss);
    assert.equal(result.damageTaken, 0, 'ideal sprint response can leave locked impact zones');
    assert.ok(result.seconds > 20 && result.seconds < 60, 'sustained vent preserves bounded completion');
  }
});
test('stationary gun and blind close-range spam are not safe boss wins', () => {
  for (const strategy of ['stationary-gun', 'melee-spam'] as const) {
    const result = runScenario({ name: strategy, boss: 'boss_vacant_king', strategy });
    assert.equal(result.terminal, 'death'); assert.equal(result.damageTaken, 100);
  }
});
test('real evade movement and authored melee contacts can punish every boss without a forced hit', () => {
  for (const boss of ['boss_vacant_king', 'boss_drowned_admiral', 'boss_winter_warden', 'boss_hellfire_lord']) {
    const result = runScenario({ name: boss, boss, strategy: 'melee-evade' });
    assert.equal(result.terminal, 'victory', boss); assert.equal(result.damageTaken, 0, boss);
    assert.ok(result.hits.melee >= 1800 - 1e-6); assert.notEqual(result.phase2At, null);
  }
});
test('fresh single-boss encounters can charge and spend an ultimate for every identity', () => {
  for (const identity of ['saber', 'blackbeard', 'napoleon', 'musashi'] as const) {
    const result = runScenario({ name: identity, boss: 'boss_vacant_king', strategy: 'mixed', identity, companionGun: true });
    assert.equal(result.terminal, 'victory', identity); assert.ok(result.ultimates >= 1, identity);
    assert.ok(result.firstUltimateAt !== null && result.firstUltimateAt > 7, 'real HP damage +12/s rate limit, not a prefilled meter');
    assert.ok(result.hits.ultimate > 0, `${identity} ultimate must actually connect, not only spend energy`);
  }
});
test('two- and four-role packs resolve without deadlocks and actual damage is HP bounded', () => {
  for (const pack of [2, 4]) for (const strategy of ['kite-gun', 'melee-spam', 'melee-evade'] as const) {
    const result = runScenario({ name: `${pack}-${strategy}`, pack, strategy });
    assert.equal(result.terminal, 'victory'); assert.equal(result.kills, pack); assert.equal(result.damageDealt, 66 * pack);
    assert.ok(result.seconds < 20);
  }
});

test('a shield wall cannot be shot down inside one magazine, but the blade always answers', () => {
  const spray = runScenario({ name: 'shieldbearer3-kite-gun', pack: 3, roles: ['shieldbearer'], strategy: 'kite-gun' });
  assert.notEqual(spray.terminal, 'victory', 'facing tower shields must not fall to held fire alone');
  assert.ok(spray.dryPulls > 0, 'the magazine has to actually run out');
  assert.ok(spray.kills < 3, 'held fire must not clear the pack');
  const blade = runScenario({ name: 'shieldbearer3-melee-evade', pack: 3, roles: ['shieldbearer'], strategy: 'melee-evade' });
  assert.equal(blade.terminal, 'victory'); assert.equal(blade.damageTaken, 0);
  const field = runScenario({ name: 'shieldbearer3-gun-then-melee', pack: 3, roles: ['shieldbearer'], strategy: 'gun-then-melee' });
  assert.equal(field.terminal, 'victory', 'shooting until dry and then closing has to work');
  assert.ok(field.firstDryAt !== null && field.firstDryAt < 60, 'the cap has to bite inside the fight');
  assert.ok((field.hits.melee ?? 0) > 30, 'the blade has to finish what the rifle started');
  assert.ok(field.seconds > blade.seconds, 'spraying at a shield first is slower than committing to the blade');
});

test('every regional signature role is beatable by an honest policy without a forced hit', () => {
  for (const role of ['shinobi', 'powder', 'jaeger'] as const) {
    const gun = runScenario({ name: `${role}3-gun-then-melee`, pack: 3, roles: [role], strategy: 'gun-then-melee' });
    const blade = runScenario({ name: `${role}3-melee-evade`, pack: 3, roles: [role], strategy: 'melee-evade' });
    for (const result of [gun, blade]) { assert.equal(result.terminal, 'victory', `${role} ${result.strategy}`); assert.equal(result.kills, 3, role); }
    assert.equal(gun.damageTaken, 0, `${role} must be answerable at range without a forced hit`);
    assert.ok(gun.ammoLeft > 0, `${role} must not cost a whole magazine`);
  }
});

test('kills keep an ordinary field fight supplied', () => {
  const attrition = runScenario({ name: 'attrition8', pack: 8, strategy: 'gun-then-melee', seconds: 240 });
  assert.equal(attrition.terminal, 'victory'); assert.equal(attrition.kills, 8);
  assert.ok(attrition.ammoLeft > 0, 'eight ordinary enemies must not strand the player at zero');
  assert.ok(attrition.shots > 40, 'the rifle still carries an ordinary pack');
});
