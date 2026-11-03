import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { WORLD_GUNS, DEFAULT_GUN, worldGun, gunUnlocked, unlockedGuns, cycleGun, equippedGun, newlyUnlocked, gunDistanceMultiplier } from '../src/worldArsenal.ts';
import { WORLD_RIFLE } from '../src/worldBalance.ts';
import { MINIBOSSES } from '../src/minibosses.ts';
import { flagElite } from '../src/exploration/catalog.ts';
import { flagResonance } from '../src/resonance.ts';
const registry = JSON.parse(readFileSync(new URL('../../assets/weapons/registry.json', import.meta.url), 'utf8')) as { combat: string; grip?: number[]; support?: number[]; muzzle?: number[] }[];

test('the World carries exactly the Arena guns, each with authored art and hand anchors', () => {
  assert.deepEqual(WORLD_GUNS.map(g => g.id), ['lumen', 'firefly', 'corona', 'halo', 'longnight']);
  for (const gun of WORLD_GUNS) {
    const art = registry.find(a => a.combat === gun.id);
    assert.ok(art?.grip && art.support && art.muzzle, `${gun.id} has grip, support and muzzle anchors`);
  }
  const lumen = worldGun('lumen')!;
  assert.equal(lumen.damage, WORLD_RIFLE.damage); assert.equal(lumen.interval, WORLD_RIFLE.interval);
  assert.equal(lumen.burst, WORLD_RIFLE.burst); assert.equal(lumen.range, WORLD_RIFLE.enemyRange);
  assert.equal(lumen.unlock, null, 'the starting rifle is owned from the start');
});

test('every other gun is earned from a real save flag, mostly a roaming elite', () => {
  const elites = new Set(MINIBOSSES.map(m => flagElite(m.id)));
  for (const gun of WORLD_GUNS.filter(g => g.unlock)) assert.ok(elites.has(gun.unlock!.flag) || gun.unlock!.flag === flagResonance(1), `${gun.id} unlock flag is real`);
  assert.equal(new Set(WORLD_GUNS.map(g => g.unlock?.flag)).size, WORLD_GUNS.length, 'one unlock each');
  const done = new Set<string>();
  assert.deepEqual(unlockedGuns(done).map(g => g.id), ['lumen']);
  done.add(flagElite('elite_reef_captain'));
  assert.ok(gunUnlocked(worldGun('corona')!, done));
  assert.deepEqual(newlyUnlocked(new Set(), done).map(g => g.id), ['corona']);
});

test('cycling skips locked guns and wraps; a stored gun the save does not own falls back', () => {
  const done = new Set([flagElite('elite_reef_captain'), flagElite('elite_frost_officer')]);
  assert.equal(cycleGun('lumen', 1, done), 'corona');
  assert.equal(cycleGun('corona', 1, done), 'longnight');
  assert.equal(cycleGun('longnight', 1, done), 'lumen');
  assert.equal(cycleGun('lumen', -1, done), 'longnight');
  assert.equal(cycleGun('lumen', 1, new Set()), 'lumen', 'only one owned');
  assert.equal(equippedGun('longnight', done), 'longnight');
  assert.equal(equippedGun('longnight', new Set()), DEFAULT_GUN, 'new game drops back to the AR');
  assert.equal(equippedGun('nonsense', done), DEFAULT_GUN);
});

test('roles are distinct: shotgun owns close range, marksman guns keep damage far out', () => {
  const sg = worldGun('corona')!, dmr = worldGun('halo')!, sniper = worldGun('longnight')!, smg = worldGun('firefly')!, ar = worldGun('lumen')!;
  const perSecond = (g: typeof ar, d: number) => g.damage * g.pellets * gunDistanceMultiplier(g, d) / g.interval;
  assert.ok(sg.damage * sg.pellets * gunDistanceMultiplier(sg, 4) > 50, 'a close shell lands hard');
  assert.ok(gunDistanceMultiplier(sg, 20) < .25, 'and fades fast');
  assert.ok(perSecond(dmr, 60) > perSecond(ar, 60), 'DMR beats AR at 60 m');
  assert.ok(sniper.damage * gunDistanceMultiplier(sniper, 100) > 66, 'sniper still one-shots a troop at 100 m');
  assert.ok(perSecond(smg, 6) > perSecond(ar, 6), 'SMG out-shreds the AR up close');
  assert.ok(sg.ammoCost > 1 && dmr.ammoCost > 1 && sniper.ammoCost > dmr.ammoCost, 'heavier shots cost more of the field ammo');
});

test('combat uses the equipped gun: cadence, ammo cost, reach and falloff', async () => {
  const { WorldCombatState } = await import('../src/combat.ts');
  const s = new WorldCombatState([{ id: 'troop', kind: 'shade', p: { x: 0, y: 0, z: 0 } }], []), e = s.enemies[0];
  const terrain = { walk: (_p: unknown, x: number, z: number) => ({ x, y: 0, z }), lineOfSight: () => true };
  s.step(.05, { x: 3, y: 0, z: 0 }, true, terrain);
  e.role = 'stalker'; // no rifle armour, so the raw pellet damage is visible
  const sg = worldGun('corona')!;
  s.setGun(sg); assert.equal(s.gun, sg);
  assert.equal(s.canShoot(), false, 'a short draw delay after switching');
  for (let i = 0; i < 8; i++) s.step(.05, { x: 3, y: 0, z: 0 }, true, terrain);
  const ammo = s.ammo; assert.equal(s.canShoot(), true); assert.equal(s.ammo, ammo - sg.ammoCost);
  assert.equal(s.canShoot(), false, 'pump interval');
  // Range: a shotgun pellet from 30 m does nothing.
  assert.equal(s.hitEnemy('troop', sg.damage, { source: 'ranged', origin: { x: 30, y: 0, z: 0 } }), false);
  assert.ok(s.hitEnemy('troop', sg.damage, { source: 'ranged', origin: { x: 3, y: 0, z: 0 } }));
  const hit = s.drainEvents().find(ev => ev.type === 'hit') as { damage: number };
  assert.equal(hit.damage, sg.damage, 'full pellet damage inside 5 m');
  // Out of ammo for a shell even with a round or two left.
  s.ammo = 2; for (let i = 0; i < 20; i++) s.step(.05, { x: 3, y: 0, z: 0 }, true, terrain);
  assert.equal(s.canShoot(), false); assert.equal(s.ammo, 2);
  // The AR keeps the original World rifle behaviour.
  s.setGun(worldGun('lumen')!); assert.equal(s.gun.ammoCost, 1);
  void e;
});

test('melee weapons: Arena trio, elite unlocks, and the combo scales by weapon', async () => {
  const { WORLD_MELEE, worldMelee, cycleMelee, equippedMelee, unlockedMelee } = await import('../src/worldArsenal.ts');
  const { PlayerMelee, MELEE_BEATS } = await import('../src/playerMelee.ts');
  assert.deepEqual(WORLD_MELEE.map(x => x.id), ['blade', 'polearm', 'hammer']);
  for (const x of WORLD_MELEE) assert.ok(registry.find(a => a.combat === x.id), `${x.id} has authored art`);
  const blade = worldMelee('blade')!; assert.deepEqual([blade.damage, blade.range, blade.width, blade.speed], [1, 1, 1, 1], 'blade keeps the original combo');
  const done = new Set<string>();
  assert.deepEqual(unlockedMelee(done).map(x => x.id), ['blade']);
  assert.equal(cycleMelee('blade', done), 'blade');
  done.add(flagElite('elite_oath_knight'));
  assert.equal(cycleMelee('blade', done), 'hammer'); assert.equal(cycleMelee('hammer', done), 'blade');
  assert.equal(equippedMelee('polearm', done), 'blade', 'not owned yet');
  // Drive one beat with each weapon: same contact count, scaled numbers and tempo.
  const contact = (style: { damage: number; range: number; width: number; speed: number }) => {
    const m = new PlayerMelee(); m.style = style; m.press(0); let t = 0, hit = null;
    while (!hit && t < 2) { hit = m.update(.01, true); t += .01; }
    return { hit: hit!, t };
  };
  const b = contact(blade), h = contact(worldMelee('hammer')!), p = contact(worldMelee('polearm')!);
  assert.equal(b.hit.damage, MELEE_BEATS[0].damage);
  assert.ok(h.hit.damage > b.hit.damage * 1.4 && h.t > b.t, 'hammer hits harder, later');
  assert.ok(p.hit.range > b.hit.range * 1.5 && p.hit.halfWidth < b.hit.halfWidth, 'polearm reaches far, narrow');
});
