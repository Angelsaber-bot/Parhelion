import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_RIFLE as R } from '../src/core/worldBalance';
import { WorldCombatState, type CombatTerrain } from '../src/combat/combat';
const p = (x = 0, z = 0) => ({ x, y: 0, z });
const terrain: CombatTerrain = { walk: (_f, x, z) => p(x, z), lineOfSight: () => true };
const make = () => new WorldCombatState([{ id: 'wild_a', kind: 'shade', p: p(3) }], { id: 'boss', kind: 'king', p: p(40), requires: [] });
function fire(s: WorldCombatState, seconds: number) { let shots = 0; for (let t = 0; t < seconds; t += 1 / 60) { if (s.canShoot()) shots++; s.step(1 / 60, p(0, 30), true, terrain); } return shots; }

test('ammo: the rifle runs dry in the field and only melee is left', () => {
  const s = make(); assert.equal(s.ammo, R.ammoMax);
  s.ammo = 8; const shots = fire(s, 4.5);
  assert.equal(shots, 8); assert.equal(s.ammo, 0); assert.ok(s.dryPulls > 0);
  assert.equal(s.canShoot(), false);
});
test('ammo: kills, chests and settlements resupply up to the cap', () => {
  const s = make(); s.ammo = 0;
  const e = s.enemies[0]; e.active = true; e.mode = 'chase';
  assert.ok(s.hitEnemy(e.id, 999, { source: 'melee' })); assert.equal(s.ammo, R.ammoPerKill);
  assert.equal(s.refillAmmo(R.ammoChest), R.ammoChest); assert.equal(s.ammo, R.ammoPerKill + R.ammoChest);
  assert.equal(s.refillAmmo(), R.ammoMax - R.ammoPerKill - R.ammoChest); assert.equal(s.ammo, R.ammoMax);
  assert.equal(s.refillAmmo(10), 0); assert.equal(s.refillAmmo(NaN), 0); assert.equal(s.refillAmmo(-5), 0);
});
test('ammo: era-boss fights are corona-fed and never consume rounds', () => {
  const s = make(); s.ammo = 0;
  assert.ok(s.beginBoss(new Set()));
  assert.ok(fire(s, 5) > 10); assert.equal(s.ammo, 0);
});
test('ammo: reviving after a defeat never strands the player empty', () => {
  const s = make(); s.ammo = 0;
  const e = s.enemies[0]; e.active = true;
  s.hp = 1; (s as unknown as { hurt(n: number): void }).hurt(50); assert.ok(s.defeated);
  for (let i = 0; i < 400 && s.defeated; i++) s.step(1 / 60, p(), true, terrain);
  assert.equal(s.defeated, false); assert.equal(s.ammo, R.ammoRespawn);
  s.resetAll(); assert.equal(s.ammo, R.ammoMax);
});
test('ammo: out of combat a small reserve trickles back so quest shots never soft-lock', () => {
  const s = new WorldCombatState([], []); s.ammo = 0;
  for (let t = 0; t < 60; t += .05) s.step(.05, p(), true, terrain);
  assert.equal(s.ammo, R.ammoTrickleCap, 'trickle stops at the small cap');
  s.ammo = 50; for (let t = 0; t < 30; t += .05) s.step(.05, p(), true, terrain); assert.equal(s.ammo, 50);
});
