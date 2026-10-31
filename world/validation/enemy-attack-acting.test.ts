import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { WorldCombatState, enemyAttackTiming } from '../src/combat.ts';
import { EnemyVisuals, type EnemyModel } from '../src/enemyVisuals.ts';
import { measureEnemyWeaponAxis, ENEMY_WEAPON_HAND, ENEMY_SWORD_STYLES } from '../src/enemyAttackActing.ts';
import { parseLocalGlb } from './player-fixture.ts';
for (const model of Object.keys(ENEMY_WEAPON_HAND) as (keyof typeof ENEMY_WEAPON_HAND)[]) test(`${model}: stronger sword acting retains hand attachment, native assets and exact repeat/paused poses`, async () => {
  const gltf = await parseLocalGlb(new URL(`../public/assets/enemies/${model}.glb`, import.meta.url));
  const native = new Map<THREE.Object3D, number[]>(); gltf.scene.traverse(o => native.set(o, [...o.position.toArray(), ...o.quaternion.toArray()]));
  const measurement = measureEnemyWeaponAxis(gltf.scene, ENEMY_WEAPON_HAND[model]);
  assert.ok(measurement && measurement.reach > .4 && measurement.reach < 1.5); assert.ok(Math.abs(measurement.axis.length() - 1) < 1e-7);
  const visuals = new EnemyVisuals(); (visuals as any).cache.set(model, gltf);
  const e = new WorldCombatState([{ id: 'actor', kind: 'shade', p: { x: 0, y: 0, z: 0 }, role: 'duelist' }], []).enemies[0];
  const parent = new THREE.Group(), fallback = new THREE.Group(); e.active = true; e.attackCount = e.contactSequence = 1;
  const timing = enemyAttackTiming(e); let contactDirection: THREE.Vector3 | undefined;
  for (const [mode, timer] of [['windup', .4], ['windup', .1], ['recover', timing.recovery], ['recover', timing.recovery - .1], ['recover', 0], ['idle', 0]] as const) {
    e.mode = mode; e.timer = timer;
    visuals.update(e, model, parent, fallback, 0, 5, true); parent.updateMatrixWorld(true);
    const instance = (visuals as any).instances.get(e.id), root = instance.root as THREE.Object3D;
    const bones: THREE.Bone[] = []; root.traverse(o => { if (o instanceof THREE.Bone) bones.push(o); });
    const first = bones.flatMap(b => [...b.position.toArray(), ...b.quaternion.toArray()]);
    for (let repeat = 0; repeat < 25; repeat++) visuals.update(e, model, parent, fallback, 0, 5, true);
    const repeated = bones.flatMap(b => [...b.position.toArray(), ...b.quaternion.toArray()]);
    assert.equal(repeated.length, first.length);
    assert.ok(first.every((n, i) => Math.abs(n - repeated[i]) < 1e-7), `${mode}/${timer}: paused overlay must not accumulate`);
    parent.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root, true);
    assert.ok(bounds.min.y >= -.006 && bounds.min.y < .1, 'native soles stay planted');
    assert.ok(bounds.max.y < 3.5 && bounds.getSize(new THREE.Vector3()).length() < 5, 'bounded human attack silhouette');
    const footPositions = ['footR','footL'].map(name => root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()));
    const pelvisPosition = root.getObjectByName('pelvis')!.getWorldPosition(new THREE.Vector3());
    instance.acting.restore(); root.updateWorldMatrix(true,true);
    for (const [index,name] of ['footR','footL'].entries()) assert.ok(root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).distanceTo(footPositions[index]) < .000002, 'weight transfer solves native feet back to planted targets');
    if (mode === 'recover' && timer === timing.recovery) {
      const nativePelvis = root.getObjectByName('pelvis')!.getWorldPosition(new THREE.Vector3());
      assert.ok(pelvisPosition.y < nativePelvis.y-.02 && pelvisPosition.z > nativePelvis.z+.03, 'contact has actual lower-body weight transfer, not just an arm gesture');
    }
    instance.acting.update(e); root.updateWorldMatrix(true,true);
    assert.deepEqual(root.position.toArray(),[0,0,0],'scene root never skates or changes collision position');
    if (mode === 'recover' && timer === timing.recovery) {
      const hand = root.getObjectByName(`hand${ENEMY_WEAPON_HAND[model]}`)!;
      contactDirection = measurement.axis.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(contactDirection.z > .9, 'actual held blade leads forward at simulation contact');
      assert.ok(hand.getWorldPosition(new THREE.Vector3()).z > .3, 'hand commits forward instead of a passive carry pose');
    }
  }
  assert.ok(contactDirection);
  for (const [object, expected] of native) assert.deepEqual([...object.position.toArray(), ...object.quaternion.toArray()], expected, 'template rig remains immutable');
  visuals.dispose();
});

test('four native sword styles have distinct preparations and follow-through silhouettes without new damage profiles',()=>{
 assert.equal(new Set(Object.values(ENEMY_SWORD_STYLES).map(style=>style.name)).size,4);
 assert.equal(new Set(Object.values(ENEMY_SWORD_STYLES).map(style=>JSON.stringify(style.preparation))).size,4);
 assert.ok(ENEMY_SWORD_STYLES.sunward_guard.load > ENEMY_SWORD_STYLES.samurai.load);
 assert.ok(ENEMY_SWORD_STYLES.deck_raider.turn > ENEMY_SWORD_STYLES.officer.turn);
 assert.ok(ENEMY_SWORD_STYLES.officer.drive > ENEMY_SWORD_STYLES.deck_raider.drive);
});
