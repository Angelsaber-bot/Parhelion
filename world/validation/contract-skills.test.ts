import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ContractSkills, CONTRACT_SKILLS, skillContains, type SkillStrike } from '../src/contractSkills.ts';
import { SkillPresentation } from '../src/skillPresentation.ts';
import * as THREE from 'three';
import { WorldCombatState } from '../src/combat.ts';
const context = () => ({ enabled: true, origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } });
function advance(s: ContractSkills, seconds: number) { for (let t = 0; t < seconds - 1e-8; t += .1) s.update(.1, true); }
function charge(s: ContractSkills) { for (let i = 0; i < 10; i++) { s.recordDamage({ id: `enemy${i}`, damage: 100, eligible: true, source: 'weapon' }); advance(s, 1); } }
test('all identities have bounded distinct skill and ultimate patterns', () => {
  assert.equal(Object.keys(CONTRACT_SKILLS).length, 5);
  for (const d of Object.values(CONTRACT_SKILLS)) {
    assert.ok(d.skill.cooldown >= 7);
    const normal = d.skill.pulses.reduce((n, p) => n + p.damage, 0), ult = d.ultimate.pulses.reduce((n, p) => n + p.damage, 0);
    assert.ok(normal <= 60 && ult <= normal * 4); assert.ok(d.ultimate.cooldown >= 24);
  }
});
test('snapshot aim, reject repeat activation, deterministic pulse contacts and footprints', () => {
  const s = new ContractSkills(); s.setIdentity('blackbeard'); charge(s); const ctx = context();
  assert.equal(s.activate('ultimate', ctx), true); assert.equal(s.activate('ultimate', ctx), false);
  ctx.origin.x = 99; ctx.direction.z = -1; s.drainEvents(); advance(s, 1.6);
  const hits = s.drainEvents().filter((e): e is SkillStrike => e.type === 'strike');
  assert.deepEqual(hits.map(h => h.pulse), [0, 1, 2]); assert.ok(hits.every(h => h.origin.x === 0 && h.direction.z === 1));
  assert.equal(skillContains(hits[0], { x: 0, y: 0, z: 10 }), true);
  for (const p of [{ x: 0, y: 0, z: -1 }, { x: 3, y: 0, z: 10 }, { x: 0, y: 5, z: 10 }]) assert.equal(skillContains(hits[0], p), false);
});
test('pause/switch cancel pending pulses and guard but preserve cooldown', () => {
  const s = new ContractSkills(); s.setIdentity('saber'); s.activate('skill', context()); assert.equal(s.guarding, true);
  s.update(.2, false); assert.equal(s.guarding, false); assert.equal(s.casting, false); assert.deepEqual(s.drainEvents(), []);
  assert.equal(s.cooldown('skill'), 8); s.setIdentity('musashi'); assert.equal(s.activate('skill', context()), false);
  advance(s, 8.1); assert.equal(s.activate('skill', context()), true); s.cancel(); advance(s, 1); assert.deepEqual(s.drainEvents(), []);
});
test('energy excludes dummy and skill damage; burst rate and meter stay bounded', () => {
  const s = new ContractSkills();
  for (const source of ['skill', 'ultimate'] as const) assert.equal(s.recordDamage({ id: 'e', damage: 999, eligible: true, source }), 0);
  assert.equal(s.recordDamage({ id: 'dummy', damage: 999, eligible: false, source: 'weapon' }), 0);
  assert.equal(s.recordDamage({ id: 'e', damage: NaN, eligible: true, source: 'weapon' }), 0);
  assert.equal(s.recordDamage({ id: 'e', damage: 999, eligible: true, source: 'weapon' }), 12);
  assert.equal(s.recordDamage({ id: 'e', damage: 999, eligible: true, source: 'weapon' }), 0);
  for (let i = 0; i < 20; i++) { advance(s, 1); s.recordDamage({ id: 'e', damage: 999, eligible: true, source: 'weapon' }); }
  assert.equal(s.energy, 100);
  s.activate('ultimate', context()); s.cancel();
  for (let i = 0; i < 5; i++) { advance(s, 1); s.recordDamage({ id: 'e', damage: 999, eligible: true, source: 'weapon' }); }
  assert.equal(s.energy, 60, 'same real target can recharge after spending; no hidden lifetime cap');
});
test('ultimate spends once, cancellation never refunds; reset and invalid input safe', () => {
  const s = new ContractSkills(); assert.equal(s.activate('ultimate', context()), false); charge(s); assert.equal(s.energy, 100);
  assert.equal(s.activate('ultimate', context()), true); assert.equal(s.energy, 0); s.cancel(); assert.equal(s.activate('ultimate', context()), false);
  assert.ok(s.cooldown('ultimate') > 0); s.reset(); assert.equal(s.cooldown('ultimate'), 0); assert.equal(s.energy, 0); assert.deepEqual(s.drainEvents(), []);
  assert.equal(s.activate('skill', { ...context(), enabled: false }), false);
  assert.equal(s.activate('skill', { ...context(), direction: { x: 0, y: 1, z: 0 } }), false);
  s.update(Infinity, true); assert.equal(s.energy, 0);
});
test('presentation reuses pool/geometry/materials, reduced flash, idempotent disposal', () => {
  const scene = new THREE.Scene(), fx = new SkillPresentation(scene), s = new ContractSkills(); s.activate('skill', context()); const e = s.drainEvents()[0];
  const geometry = new Set(), materials = new Set();
  fx.root.traverse(o => { if (o instanceof THREE.Mesh) { geometry.add(o.geometry); materials.add(o.material); } });
  for (let i = 0; i < 100; i++) fx.show(e, true);
  assert.equal(fx.root.children.length, 18); assert.equal(geometry.size, 2); assert.equal(materials.size, 18);
  fx.root.traverse(o => { if (o instanceof THREE.Mesh) assert.ok(o.material.opacity <= .12); });
  fx.update(.1, false); assert.ok(fx.root.children.every(o => !o.visible)); fx.dispose(); fx.dispose(); assert.equal(scene.children.length, 0);
});
test('equal simulation time produces identical authored pulses across frame partitions', () => {
  function run(dt: number) {
    const s = new ContractSkills(); s.setIdentity('musashi'); s.activate('skill', context());
    const events = s.drainEvents();
    for (let t = 0; t < 1 - 1e-8; t += dt) { s.update(dt, true); events.push(...s.drainEvents()); }
    return events;
  }
  assert.deepEqual(run(.02), run(.1));
});
test('all disabled control contexts use the same cancellation gate and do not time-skip', () => {
  for (const reason of ['settings', 'unfocused', 'viewer', 'flying', 'dead']) {
    const s = new ContractSkills(); s.setIdentity('blackbeard'); s.activate('skill', context());
    s.update(.1, true); s.update(50, false); advance(s, 1);
    assert.deepEqual(s.drainEvents(), [], reason); assert.ok(s.cooldown('skill') > 6, reason);
  }
});
test('actual boss HP can recharge a second ultimate, but not bypass its cooldown', () => {
  const state = new WorldCombatState([], { id: 'boss_vacant_king', kind: 'king', p: { x: 0, y: 0, z: 0 }, requires: [] });
  state.beginBoss(new Set());
  const skills = new ContractSkills(); skills.setIdentity('saber');
  function shot() {
    const before = state.boss.hp;
    assert.equal(state.hitEnemy(state.boss.id, 16, { source: 'ranged', origin: { x: 0, y: 0, z: 10 } }), true);
    skills.recordDamage({ id: state.boss.id, damage: before - state.boss.hp, eligible: true, source: 'weapon' });
  }
  for (let i = 0; i < 50 && skills.energy < 100; i++) { shot(); skills.update(.2, true); }
  assert.equal(skills.energy, 100); assert.equal(skills.activate('ultimate', context()), true);
  skills.cancel(); // focus loss cancels the presentation but cannot refund or reset its cooldown.
  for (let i = 0; i < 50 && skills.energy < 100; i++) { shot(); skills.update(.2, true); }
  assert.equal(skills.energy, 100); assert.ok(state.boss.hp > 0);
  assert.ok(skills.cooldown('ultimate') > 0); assert.equal(skills.activate('ultimate', context()), false);
  advance(skills, 30); assert.equal(skills.activate('ultimate', context()), true); assert.equal(skills.energy, 0);
  skills.reset(); assert.equal(skills.energy, 0); assert.equal(skills.cooldown('ultimate'), 0);
});
