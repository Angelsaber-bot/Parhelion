import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { WorldCombatState, type Point3 } from '../src/combat';
import { collectStrikeTargets, type StrikeRequest } from '../src/combatActions';
import { ContractSkills, skillContains, type SkillStrike } from '../src/contractSkills';
import { makeCombatTerrain } from '../src/combatTerrain';
import type { Layout } from '../src/types';

const point = (x: number, y = 0, z = 0): Point3 => ({ x, y, z });
const strike = (origin = point(0)): StrikeRequest => ({ origin, direction: point(1), range: 8, halfWidth: 1, damage: 30, maxTargets: 4 });
const state = (height = 0) => { const s = new WorldCombatState([{ id: 'enemy', kind: 'shade', p: point(4, height) }], []); s.enemies[0].active = true; return s; };
const open = { walk: () => null, lineOfSight: () => true };

test('real low-wall BVH blocks an actual weapon socket rather than a fictitious ray one metre above it', () => {
  const wall = new THREE.BoxGeometry(.15, 1.3, 4).translate(1, .65, 0);
  const terrain = makeCombatTerrain([{ name: 'low-wall', enabled: true, bvh: new MeshBVH(wall) }], { world: { waterLevel: -10 }, areas: [], markers: [] } as unknown as Layout).terrain;
  const s = state(), muzzle = point(0, 1.2), target = point(4, 1);
  assert.equal(terrain.lineOfSight(muzzle, target), false);
  assert.equal(terrain.lineOfSight(point(0, 2.2), target), true, 'regression setup proves the old +1 ray cleared this wall');
  assert.deepEqual(collectStrikeTargets(s.enemies, { ...strike(muzzle), losOffset: 0, casterFeetY: 0 }, terrain), []);
  assert.deepEqual(collectStrikeTargets(s.enemies, strike(point(0)), terrain), [], 'feet-origin defaults still use chest-height LOS');
  assert.equal(collectStrikeTargets(s.enemies, { ...strike(muzzle), losOffset: 0, casterFeetY: 0 }, open).length, 1, 'socket hit works without the wall');
  assert.deepEqual(muzzle, point(0, 1.2), 'no presentation/model position is changed to fix the ray');
  wall.dispose();
});

test('socket height never extends the floor-to-floor hit band across high platforms', () => {
  const raised = state(3.2), muzzle = point(0, 1.5);
  assert.equal(collectStrikeTargets(raised.enemies, { ...strike(muzzle), losOffset: 0, casterFeetY: 0 }, open).length, 0);
  const samePlatform = state(4);
  assert.equal(collectStrikeTargets(samePlatform.enemies, { ...strike(point(0, 5.5)), losOffset: 0, casterFeetY: 4 }, open).length, 1);
  assert.equal(collectStrikeTargets(state().enemies, { ...strike(point(0, 5.5)), losOffset: 0, casterFeetY: 4 }, open).length, 0);
  assert.equal(collectStrikeTargets(state(-3).enemies, { ...strike(muzzle), losOffset: 0, casterFeetY: 0 }, open).length, 0);
});

test('authored contact preserves exact socket position and forwards explicit LOS/floor metadata', () => {
  const skills = new ContractSkills(); skills.setIdentity('blackbeard');
  skills.activate('skill', { enabled: true, origin: point(0), direction: point(1) }); const token = skills.bindPresentation()!; skills.drainEvents();
  const muzzle = point(.25, 1.2, .1);
  assert.equal(skills.contact(token, muzzle, point(1), { losOffset: 0, casterFeetY: 0 }), true);
  const event = skills.drainEvents().find(e => e.type === 'strike') as SkillStrike;
  assert.deepEqual(event.origin, muzzle); assert.equal(event.losOffset, 0); assert.equal(event.casterFeetY, 0);
  assert.equal(skillContains(event, point(4, 3.2)), false, 'shared shape helper uses the same floor-height gate');
  assert.equal(skillContains(event, point(4)), true);
});

test('feet-based timed and actor-root fallbacks remain explicit, malformed socket metadata cannot hit', () => {
  const skills = new ContractSkills(); skills.activate('skill', { enabled: true, origin: point(0, 2), direction: point(1) }); skills.drainEvents(); skills.update(.25, true);
  const timed = skills.drainEvents().find(e => e.type === 'strike') as SkillStrike;
  assert.equal(timed.losOffset, 1); assert.equal(timed.casterFeetY, 2);
  const actor = new ContractSkills(); actor.setIdentity('saber'); actor.activate('skill', { enabled: true, origin: point(0), direction: point(1) }); const token = actor.bindPresentation()!; actor.drainEvents();
  assert.equal(actor.contact(token, point(0, 4), point(1), { losOffset: 0 }), false, 'unknown floor reference fails closed rather than guessing socket height');
  assert.equal(actor.contact(token, point(0, 4), point(1)), true);
  const fallback = actor.drainEvents().find(e => e.type === 'strike') as SkillStrike;
  assert.equal(fallback.losOffset, 1); assert.equal(fallback.casterFeetY, 4);
  for (const invalid of [{ losOffset: 0 }, { losOffset: 0, casterFeetY: NaN }, { losOffset: 3, casterFeetY: 0 }]) {
    assert.equal(collectStrikeTargets(state().enemies, { ...strike(point(0, 1.2)), ...invalid } as StrikeRequest, open).length, 0);
  }
});
