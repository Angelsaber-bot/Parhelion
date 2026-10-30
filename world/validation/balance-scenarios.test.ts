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
