import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldCombatState, enemyAttackContains, enemyAttackRadius, enemyAttackTiming, enemyThrustLength, rangedDamageMultiplier, COMBAT, type CombatTerrain, type Enemy, type Point3 } from '../src/combat.ts';
import { ENEMY_ROLES, selectEnemyRole, type EnemyRole } from '../src/enemyRoles.ts';
import { collectStrikeTargets, type StrikeRequest } from '../src/combatActions.ts';

const p = (x: number, z = 0, y = 0): Point3 => ({ x, y, z });
const terrain: CombatTerrain = { walk: (_from, x, z) => p(x, z), lineOfSight: () => true };
function setup(role: EnemyRole = 'stalker') {
  const s = new WorldCombatState([{ id: role, kind: 'shade', p: p(0) }], []);
  const e = s.enemies[0]; e.role = role; return { s, e };
}
function advance(s: WorldCombatState, seconds: number, player: Point3) {
  for (let i = 0; i < Math.ceil(seconds / .05); i++) s.step(.05, player, true, terrain);
}
function armed(e: Enemy) { e.active = true; e.mode = 'windup'; e.timer = .01; e.attack = 'sweep'; }

test('six stable roles diversify existing regional IDs without adding population or health', () => {
  const roles = new Set<EnemyRole>();
  for (const home of [p(0), p(-720), p(720), p(0, -720), p(0, 720)]) {
    for (let i = 0; i < 20; i++) {
      const spec = { id: `wild_${i}`, home, kind: i % 2 ? 'shade' as const : 'crystal' as const };
      const role = selectEnemyRole(spec); assert.equal(selectEnemyRole(spec), role); roles.add(role);
    }
  }
  assert.equal(roles.size, 6);
  assert.equal(COMBAT.wildernessCap, 160);
  const s = new WorldCombatState([{ id: 'a', kind: 'shade', p: p(0) }, { id: 'b', kind: 'crystal', p: p(20) }], []);
  assert.deepEqual(s.enemies.map(e => e.maxHp), [66, 88], 'no sponge inflation');
});

test('each role telegraphs its real footprint, locks aim and exposes a dodgeable recovery', () => {
  for (const role of Object.keys(ENEMY_ROLES) as EnemyRole[]) {
    const { s, e } = setup(role), profile = ENEMY_ROLES[role];
    const player = p(Math.min(18, profile.range - .2));
    s.step(.05, player, true, terrain);
    assert.equal(e.attack, profile.attack); assert.equal(e.mode, 'windup');
    assert.ok(e.timer >= .8, `${role}: readable windup`);
    assert.equal(enemyAttackRadius(e), profile.radius);
    const locked = { ...e.target };
    advance(s, profile.windup + .05, p(player.x, 9));
    assert.equal(s.hp, 100, `${role}: sidestep survives`);
    assert.deepEqual(e.target, locked, `${role}: no homing target`);
    assert.equal(e.mode, 'recover');
    assert.ok(e.timer > .2);
    const hit = setup(role); hit.s.step(.05, player, true, terrain);
    advance(hit.s, profile.windup + .05, player);
    assert.equal(hit.s.hp, 100 - profile.damage, `${role}: stationary player takes exactly one hit`);
    const wall = setup(role); wall.s.step(.05, player, true, terrain);
    for (let i = 0; i < 35; i++) wall.s.step(.05, player, true, { ...terrain, lineOfSight: () => false });
    assert.equal(wall.s.hp, 100, `${role}: cover blocks impact`);
  }
});

test('thrust rectangle is finite, directional and height-aware, not a circle or homing ray', () => {
  const { e } = setup('lancer'); e.attack = 'thrust'; e.target = p(5);
  assert.equal(enemyThrustLength(e), 6);
  assert.equal(enemyAttackContains(e, p(3, .8)), true);
  for (const point of [p(3, .86), p(-.1), p(6.01), p(3, 0, 3)]) assert.equal(enemyAttackContains(e, point), false);
  e.target = p(0, -5);
  assert.equal(enemyAttackContains(e, p(.8, -3)), true);
  assert.equal(enemyAttackContains(e, p(3)), false);
});

test('duelist has two independently readable attacks then a long punish window', () => {
  const { s, e } = setup('duelist'); s.step(.05, p(2), true, terrain);
  assert.equal(e.attackCount, 1); assert.equal(enemyAttackTiming(e).recovery, .45);
  advance(s, 1.8, p(2));
  assert.equal(e.attackCount, 2); assert.equal(e.mode, 'windup');
  assert.equal(enemyAttackTiming(e).windup, .85); assert.equal(enemyAttackTiming(e).recovery, 1.8);
});

test('melee interrupts ordinary windup once per cooldown; ranged and servant hits cannot stunlock', () => {
  const { s, e } = setup('breaker'); armed(e); e.timer = 1;
  s.hitEnemy(e.id, 5, { source: 'melee' });
  assert.equal(e.mode, 'stagger'); assert.equal(e.staggerCooldown, 4);
  assert.equal(s.drainEvents().filter(ev => ev.type === 'stagger').length, 1);
  e.mode = 'windup'; e.timer = 1;
  s.hitEnemy(e.id, 5, { source: 'melee' }); assert.equal(e.mode, 'windup');
  e.staggerCooldown = 0;
  for (const source of ['ranged', 'servant', 'skill', 'ultimate'] as const) { s.hitEnemy(e.id, 1, { source }); assert.equal(e.mode, 'windup'); }
  e.mode = 'recover'; const before = e.hp;
  s.hitEnemy(e.id, 10, { source: 'melee' }); assert.equal(before - e.hp, 20, 'natural recovery rewards commitment');
  e.staggerCooldown = 2; const staggerHp = e.hp;
  s.hitEnemy(e.id, 10, { source: 'melee' }); assert.equal(staggerHp - e.hp, 10, 'forced stagger cannot compound punish bonus');
});

test('bosses and elites are not invalidated by cheap melee stagger', () => {
  const s = new WorldCombatState([{ id: 'elite', kind: 'shade', miniboss: 'elite_oath_knight', p: p(0) }], { id: 'boss', kind: 'king', p: p(5), requires: [] });
  s.beginBoss(new Set());
  for (const e of s.enemies) { armed(e); s.hitEnemy(e.id, 10, { source: 'melee' }); assert.equal(e.mode, 'windup'); }
});

test('rifle range falloff preserves close hits, bounds long damage, and does not affect raw/skill damage', () => {
  assert.equal(COMBAT.shotDamage, 16); assert.equal(COMBAT.shotInterval, .14);
  assert.equal(rangedDamageMultiplier(18), 1); assert.equal(rangedDamageMultiplier(65), .45);
  assert.equal(rangedDamageMultiplier(500), .45); assert.ok(rangedDamageMultiplier(40) < 1);
  const { s, e } = setup(); e.active = true;
  s.hitEnemy(e.id, 16, { source: 'ranged', origin: p(100) }); assert.equal(e.hp, 58.8);
  s.hitEnemy(e.id, 16, { source: 'skill', origin: p(100) }); assert.equal(e.hp, 42.8);
  s.hitEnemy(e.id, 10); assert.equal(e.hp, 32.8);
});

test('guard reduces actual damage, evade avoids one impact, pause and reset clear protection', () => {
  const { s, e } = setup(); armed(e);
  s.setDefense({ guard: .55, invulnerable: false }); s.step(.05, p(1), true, terrain);
  assert.equal(s.hp, 93.4);
  assert.equal(s.drainEvents().find(ev => ev.type === 'hurt')?.damage, 6.6);
  armed(e); s.hurtCooldown = 0; s.setDefense({ guard: 1, invulnerable: true }); s.step(.05, p(1), true, terrain);
  assert.equal(s.hp, 93.4);
  s.step(.05, p(1), false, terrain); armed(e); s.step(.05, p(1), true, terrain); assert.equal(s.hp, 81.4);
  s.setDefense({ guard: 0, invulnerable: true }); s.resetAll(); armed(e); s.step(.05, p(1), true, terrain); assert.equal(s.hp, 88);
});

test('area strikes cap targets, sort deterministically, reject invalid input and revalidate cover/height', () => {
  const s = new WorldCombatState([
    { id: 'b', kind: 'shade', p: p(3, -.5) }, { id: 'a', kind: 'shade', p: p(3, .5) },
    { id: 'behind', kind: 'shade', p: p(-1) }, { id: 'side', kind: 'shade', p: p(2, 3) },
    { id: 'high', kind: 'shade', p: p(2, 0, 3) }, { id: 'far', kind: 'shade', p: p(20) },
  ], []);
  for (const e of s.enemies) e.active = true;
  const strike: StrikeRequest = { origin: p(0), direction: p(4), range: 5, halfWidth: 1, damage: 30, maxTargets: 1 };
  assert.deepEqual(collectStrikeTargets(s.enemies, strike, terrain).map(e => e.id), ['a']);
  assert.deepEqual(collectStrikeTargets(s.enemies, { ...strike, maxTargets: 2 }, terrain).map(e => e.id), ['a', 'b']);
  assert.equal(collectStrikeTargets(s.enemies, strike, { ...terrain, lineOfSight: () => false }).length, 0);
  for (const change of [{ damage: NaN }, { damage: 181 }, { range: Infinity }, { range: 41 }, { maxTargets: 999 }, { halfWidth: -1 }, { direction: p(0) }]) {
    assert.equal(collectStrikeTargets(s.enemies, { ...strike, ...change }, terrain).length, 0);
  }
  s.enemies[1].mode = 'dead'; assert.deepEqual(collectStrikeTargets(s.enemies, strike, terrain).map(e => e.id), ['b']);
});

test('chapter bosses have distinct rhythms without hidden or untelegraphed follow-ups', async () => {
  const { chooseBossAttack, bossAttackTiming, bossAttackDamage } = await import('../src/bossPatterns.ts');
  const state = (id: string) => new WorldCombatState([], { id, kind: 'king', p: p(0), requires: [] }).boss;
  const king = state('boss_vacant_king'), admiral = state('boss_drowned_admiral'), winter = state('boss_winter_warden'), fire = state('boss_hellfire_lord');
  king.attackCount = 2; admiral.attackCount = 2;
  assert.equal(chooseBossAttack(king, 12), 'burst'); assert.equal(chooseBossAttack(admiral, 12), 'shot');
  winter.attackCount = 1; assert.equal(chooseBossAttack(winter, 4), 'thrust');
  fire.attackCount = 1; fire.attack = 'sweep'; assert.equal(bossAttackTiming(fire).recovery, .55);
  fire.attackCount = 2; assert.equal(bossAttackTiming(fire).recovery, 1.6);
  assert.equal(chooseBossAttack(fire, 4), 'thrust');
  for (const e of [king, admiral, winter, fire]) for (const phase of [1, 2] as const) for (const attack of ['sweep', 'burst', 'shot', 'thrust'] as const) {
    e.phase = phase; e.attack = attack;
    assert.ok(bossAttackTiming(e).windup >= .85, 'every attack offers a reaction window');
    assert.ok(bossAttackTiming(e).recovery >= .55);
    assert.ok(bossAttackDamage(e) <= 32, 'no new one-shot damage');
  }
});

test('settlement aid cannot revive, heal a boss fight, overheal or be used during pressure', () => {
  const { s } = setup(); s.hp = 40;
  assert.equal(s.recoverAtSettlement(25), false);
  s.quietFor = 5; assert.equal(s.recoverAtSettlement(10000), true); assert.equal(s.hp, 65);
  s.defeatedFor = 1; assert.equal(s.recoverAtSettlement(25), false); s.defeatedFor = 0;
  s.bossStarted = true; assert.equal(s.recoverAtSettlement(25), false); s.bossStarted = false;
  assert.equal(s.recoverAtSettlement(NaN), false); s.hp = 95;
  assert.equal(s.recoverAtSettlement(25), true); assert.equal(s.hp, 100); assert.equal(s.recoverAtSettlement(25), false);
});

test('eight rifle rounds visibly vent, pause freezes vent and a full idle resets heat', () => {
  const { s } = setup();
  for (let i = 0; i < 8; i++) {
    assert.equal(s.canShoot(), true);
    if (i < 7) advance(s, .15, p(100));
  }
  assert.equal(s.gunHeat, 8); assert.equal(s.gunVent, 1.1); assert.equal(s.canShoot(), false);
  s.step(.1, p(100), false, terrain); assert.equal(s.gunVent, 1.1, 'menus do not advance heat timing');
  advance(s, .9, p(100)); assert.equal(s.canShoot(), false);
  advance(s, .25, p(100)); assert.equal(s.gunHeat, 0); assert.equal(s.canShoot(), true);
  advance(s, 1.15, p(100)); assert.equal(s.gunHeat, 0, 'controlled taps can cool without exhausting the burst');
  s.canShoot(); s.resetAll(); assert.equal(s.gunHeat, 0); assert.equal(s.gunVent, 0);
});

test('bosses keep telegraphing against a distant player instead of parity soft-lock after first burst', () => {
  for (const id of ['boss_vacant_king', 'boss_drowned_admiral', 'boss_winter_warden', 'boss_hellfire_lord']) {
    const s = new WorldCombatState([], { id, kind: 'king', p: p(0), requires: [] });
    s.beginBoss(new Set()); s.setDefense({ guard: 1, invulnerable: true });
    advance(s, 12, p(18));
    assert.ok(s.boss.attackCount >= 3, `${id}: keeps ranged pressure, ${s.boss.attackCount}`);
  }
});
