import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { WorldCombatState, enemyAttackTiming } from '../src/combat.ts';
import { enemyAttackPose, ENEMY_CONTACT_SAMPLE, type EnemyPoseModel } from '../src/enemyAttackPresentation.ts';
import { EnemyVisuals } from '../src/enemyVisuals.ts';
import { parseLocalGlb } from './player-fixture.ts';
const p = { x: 0, y: 0, z: 720 };
const make = () => new WorldCombatState([{ id: 'pose', kind: 'shade', p }], []).enemies[0];
for (const model of Object.keys(ENEMY_CONTACT_SAMPLE) as EnemyPoseModel[]) {
  test(`${model}: strike leads real contact, preserves exact contact sample and stops on cancellation`, () => {
    const e = make(); e.attackCount = 1; e.mode = 'windup';
    const timing = enemyAttackTiming(e);
    e.timer = timing.windup;
    const start = enemyAttackPose(e, model);
    assert.equal(start.sample, 0); assert.equal(start.stage, 'anticipation');
    e.timer = .1; const committed = enemyAttackPose(e, model);
    if (model !== 'musketeer') {
      assert.equal(committed.clip, 'Attack'); assert.equal(committed.stage, 'commit');
      assert.ok(committed.sample! > 0 && committed.sample! < ENEMY_CONTACT_SAMPLE[model]);
    }
    e.timer = 0; const end = enemyAttackPose(e, model);
    e.mode = 'recover'; e.timer = timing.recovery; e.contactSequence = 1;
    const contact = enemyAttackPose(e, model);
    assert.equal(contact.stage, 'contact'); assert.equal(contact.sample, ENEMY_CONTACT_SAMPLE[model]);
    if (model !== 'musketeer') assert.equal(contact.sample, end.sample, 'no jump from windup boundary into contact');
    e.timer -= .25; const after = enemyAttackPose(e, model);
    assert.ok(after.sample! > contact.sample!);
    e.timer = 0; assert.equal(enemyAttackPose(e, model).sample, 1);
    e.mode = 'stagger'; e.timer = .9; assert.equal(enemyAttackPose(e, model).clip, 'Hit');
    e.mode = 'recover'; e.contactSequence = 0; assert.equal(enemyAttackPose(e, model).clip, 'Idle', 'phase/cancel recovery cannot fake a contact');
    for (const mode of ['idle', 'dead', 'pacified'] as const) { e.mode = mode; assert.equal(enemyAttackPose(e, model).clip, 'Idle'); }
  });
  test(`${model}: native animation pose is absolute across render rates, paused loading and LOD switches`, async () => {
    const gltf = await parseLocalGlb(new URL(`../public/assets/enemies/${model}.glb`, import.meta.url));
    const low = await parseLocalGlb(new URL(`../public/assets/enemies/${model}_lod1.glb`, import.meta.url));
    const visuals = new EnemyVisuals(), internals = visuals as any;
    internals.cache.set(model, gltf); internals.cache.set(`${model}_lod1`, low);
    const e = make(); e.active = true; e.mode = 'windup'; e.attackCount = 1; e.timer = .1;
    const parent = new THREE.Group(), fallback = new THREE.Group();
    for (const dt of [0, 1/144, 1/60, .1]) {
      visuals.update(e, model, parent, fallback, dt, 5, true);
      const instance = internals.instances.get(e.id), pose = enemyAttackPose(e, model);
      assert.equal(instance.action.time, instance.action.getClip().duration * pose.sample!, 'render delta cannot advance contact clock');
      parent.updateMatrixWorld(true);
      parent.traverse(o => { if (o instanceof THREE.SkinnedMesh) { o.skeleton.update(); const matrices=o.skeleton.boneMatrices; assert.ok(matrices); assert.ok([...matrices].every(Number.isFinite)); } });
    }
    visuals.update(e, model, parent, fallback, 0, 35, true);
    const instance = internals.instances.get(e.id);
    assert.equal(instance.key, `${model}_lod1`);
    assert.equal(instance.action.time, instance.action.getClip().duration * enemyAttackPose(e, model).sample!);
    e.mode = 'recover'; e.contactSequence = 1; e.timer = enemyAttackTiming(e).recovery;
    visuals.update(e, model, parent, fallback, .1, 35, true);
    assert.equal(instance.action.time, instance.action.getClip().duration * ENEMY_CONTACT_SAMPLE[model], 'contact pose is already extended at damage time');
    e.mode = 'dead'; visuals.update(e, model, parent, fallback, .1, 35, true);
    assert.equal(visuals.activeMixers, 0); visuals.dispose();
  });
}
