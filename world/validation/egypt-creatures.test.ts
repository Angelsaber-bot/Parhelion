import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldCombatState, CREATURES, PRECISION } from '../src/combat/combat';
import { makeStoneArmour, makeTideLimb } from '../src/combat/egyptCreatures';

const at = { x: 0, y: 0, z: 3 };
test('stone armour sheds plain hits; seams (weak-spot rounds), punishes and counters go through', () => {
  const s = new WorldCombatState([{ id: 'stone', kind: 'shade', p: { x: 0, y: 0, z: 0 }, role: 'breaker', creature: 'stone-armour' }], []), e = s.enemies[0];
  assert.equal(e.maxHp, CREATURES['stone-armour'].hp);
  e.active = true; e.mode = 'chase';
  e.hp = e.maxHp; s.hitEnemy(e.id, 20, { source: 'ranged', origin: at }); const plain = e.maxHp - e.hp;
  e.hp = e.maxHp; s.hitEnemy(e.id, 20, { source: 'ranged', origin: at, precise: true }); const seam = e.maxHp - e.hp;
  assert.ok(Math.abs(seam / plain - PRECISION.multiplier / CREATURES['stone-armour'].plateTaken) < .05, `${seam} vs ${plain}`);
  const hits = s.drainEvents().filter(v => v.type === 'hit') as { plated?: boolean }[];
  assert.equal(hits[0].plated, true); assert.equal(hits[1].plated, undefined);
  e.mode = 'recover'; e.timer = 1; e.staggerCooldown = 0; e.hp = e.maxHp; s.hitEnemy(e.id, 10, { source: 'melee' });
  assert.equal(e.maxHp - e.hp, 20, 'a melee punish on the opening ignores the plates');
  // The top of its back is the weak spot: a round from above lands precise, one at belly height does not.
  const fromAbove = s.raycast({ x: 0, y: 6, z: 2 }, { x: 0, y: -1, z: -.3 }, 30)!, level = s.raycast({ x: 0, y: .6, z: 8 }, { x: 0, y: 0, z: -1 }, 30)!;
  assert.equal(fromAbove.precise, true); assert.equal(level.precise, false);
});

test('the Tide-Eater limb is rooted, halves damage until its shell cracks, then staggers and takes full damage', () => {
  const s = new WorldCombatState([{ id: 'limb', kind: 'shade', p: { x: 0, y: 0, z: 0 }, role: 'breaker', creature: 'tide-limb' }], []), e = s.enemies[0];
  assert.equal(e.maxHp, CREATURES['tide-limb'].hp);
  const terrain = { walk: (_from: unknown, x: number, z: number) => ({ x, y: 0, z }), lineOfSight: () => true };
  for (let i = 0; i < 60; i++) s.step(.05, { x: 0, y: 0, z: 12 }, true, terrain as never);
  assert.ok(Math.hypot(e.p.x, e.p.z) < 1e-9, 'never walks toward the player');
  e.mode = 'chase'; e.hp = e.maxHp; s.drainEvents();
  s.hitEnemy(e.id, 20, { source: 'ranged', origin: at }); assert.equal(e.maxHp - e.hp, 10, 'shell halves the blow');
  while (!e.shellBroken) s.hitEnemy(e.id, 20, { source: 'ranged', origin: at });
  assert.ok(e.hp <= e.maxHp * CREATURES['tide-limb'].shellUntil); assert.equal(e.mode, 'stagger');
  assert.ok(s.drainEvents().some(v => v.type === 'shellBreak'));
  const hp = e.hp; s.hitEnemy(e.id, 20, { source: 'ranged', origin: at }); assert.equal(hp - e.hp, 20, 'full damage once cracked');
  s.resetAll(); assert.equal(s.enemies[0].shellBroken, false, 'a reset grows the shell back');
  // Its reach is long enough to swing at a player standing outside ordinary melee range.
  assert.ok(CREATURES['tide-limb'].reach > 4);
});

test('creature models build, animate and shed the shell without errors', () => {
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const limb = makeTideLimb(geos, mats), stone = makeStoneArmour(geos, mats), lead = makeStoneArmour(geos, mats, true);
  for (const c of [limb, stone, lead]) { c.update(1.2, true, false); c.update(1.3, false, true); }
  const box = new THREE.Box3().setFromObject(limb.root);
  assert.ok(box.max.y > 4, `limb stands tall (${box.max.y.toFixed(2)} m)`);
  const shells = () => { let n = 0; limb.root.traverse(o => { if (o.name.startsWith('Limb_Shell_') && o.visible) n++; }); return n; };
  assert.ok(shells() >= 10); limb.breakShell(); assert.equal(shells(), 0); assert.equal(limb.shellBroken, true); limb.restoreShell(); assert.ok(shells() >= 10);
  assert.ok(new THREE.Box3().setFromObject(lead.root).getSize(new THREE.Vector3()).x > new THREE.Box3().setFromObject(stone.root).getSize(new THREE.Vector3()).x, 'the lead is larger');
  let seams = 0; stone.root.traverse(o => { if (o.name.startsWith('Stone_Seam') || o.name === 'Stone_Spine_Seam') seams++; }); assert.ok(seams >= 3, 'visible seams tell the player where to aim');
});
