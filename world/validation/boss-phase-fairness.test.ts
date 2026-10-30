import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOSSES, WorldCombatState, enemyAttackContains, enemyAttackRadius, enemyAttackTiming, type CombatTerrain, type Enemy } from '../src/combat.ts';
import { bossAttackDamage } from '../src/bossPatterns.ts';

const terrain: CombatTerrain = { walk: (from) => ({ ...from }), lineOfSight: () => true };
const origin = { x: 0, y: 0, z: 0 };
const aim = { x: 12, y: 0, z: 0 };
function encounter(id: string) {
  const state = new WorldCombatState([], { id, kind: 'king', p: origin, requires: [] });
  assert.equal(state.beginBoss(new Set()), true);
  state.drainEvents();
  return state;
}

for (const boss of BOSSES) {
  test(`${boss.id}: half-HP at the last 1ms cancels the old burst rather than expanding its impact`, () => {
    const state = encounter(boss.id), enemy = state.boss;
    // A legal phase-one tell just before contact; the player has already left its circle.
    enemy.attack = 'burst'; enemy.attackCount = 1; enemy.mode = 'windup';
    enemy.timer = .001; Object.assign(enemy.target, aim);
    const dodged = { x: aim.x + 5.5, y: 0, z: 0 };
    assert.equal(enemyAttackRadius(enemy), 4.8);
    assert.equal(enemyAttackContains(enemy, dodged), false);
    assert.equal(state.hitEnemy(enemy.id, enemy.maxHp / 2), true);
    assert.equal(enemy.phase, 2);
    assert.equal(enemyAttackRadius(enemy), 6.2);
    assert.equal(enemyAttackContains(enemy, dodged), true, 'fixture is inside the expanded phase-two footprint');
    assert.equal(enemy.mode, 'recover', 'old tell is canceled, not silently upgraded');
    assert.equal(enemy.timer, 1.2);
    assert.equal(state.drainEvents().filter(event => event.type === 'phase').length, 1);
    state.step(.05, dodged, true, terrain);
    assert.equal(state.hp, 100, 'old impact deadline cannot hurt the dodging player');

    for (let i = 0; i < 100 && enemy.mode !== 'windup'; i++) {
      state.step(.05, dodged, true, terrain);
      assert.equal(state.hp, 100, 'phase transition/recovery cannot apply attack damage');
    }
    assert.equal(enemy.mode, 'windup');
    assert.equal(enemy.phase, 2);
    assert.equal(enemy.timer, enemyAttackTiming(enemy).windup, 'next attack receives its full phase-two tell');
    assert.deepEqual(enemy.target, dodged, 'only the fresh attack acquires the new player location');
    const damage = bossAttackDamage(enemy);
    while (enemy.timer > .05) {
      state.step(.05, dodged, true, terrain);
      assert.equal(state.hp, 100, 'no early contact in the new tell');
    }
    state.step(enemy.timer + .001, dodged, true, terrain);
    assert.equal(state.hp, 100 - damage, 'phase-two damage remains intact after its full tell');
    assert.equal(enemy.mode, 'recover');
    state.hitEnemy(enemy.id, 1);
    assert.equal(state.drainEvents().filter(event => event.type === 'phase').length, 0, 'HUD phase transition is emitted once');
  });

  test(`${boss.id}: threshold interrupts every attack profile, but an already-resolved impact keeps phase-one damage`, () => {
    for (const attack of ['sweep', 'burst', 'shot', 'thrust'] as const satisfies readonly Enemy['attack'][]) {
      const state = encounter(boss.id), enemy = state.boss;
      enemy.attack = attack; enemy.attackCount = 1; enemy.mode = 'windup'; enemy.timer = .001;
      const player = { x: 1, y: 0, z: 0 }; Object.assign(enemy.target, player);
      const firstDamage = bossAttackDamage(enemy);
      state.step(.05, player, true, terrain);
      assert.equal(state.hp, 100 - firstDamage, `${attack}: impact before the hit uses phase one`);
      state.hitEnemy(enemy.id, enemy.maxHp / 2);
      assert.equal(enemy.phase, 2); assert.equal(enemy.mode, 'recover');
      state.step(.05, player, true, terrain);
      assert.equal(state.hp, 100 - firstDamage, `${attack}: threshold cannot apply a second impact`);

      const interrupted = encounter(boss.id), pending = interrupted.boss;
      pending.attack = attack; pending.attackCount = 1; pending.mode = 'windup'; pending.timer = .001;
      Object.assign(pending.target, player);
      interrupted.hitEnemy(pending.id, pending.maxHp / 2);
      interrupted.step(.05, player, true, terrain);
      assert.equal(interrupted.hp, 100, `${attack}: threshold before impact cancels it even inside the old tell`);
    }
  });
}
