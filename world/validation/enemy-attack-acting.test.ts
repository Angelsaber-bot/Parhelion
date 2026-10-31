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

test('Echo Warden thrust and discharge have distinct contact silhouettes, planted feet and no independent paused clock',async()=>{
 const model='sunward_guard',gltf=await parseLocalGlb(new URL('../public/assets/enemies/sunward_guard.glb',import.meta.url)),visuals=new EnemyVisuals();(visuals as any).cache.set(model,gltf);
 const e=new WorldCombatState([{id:'warden',kind:'crystal',p:{x:0,y:0,z:0},role:'breaker',storyPattern:'echo-warden'}],[]).enemies[0];e.active=true;e.attackCount=e.contactSequence=1;
 const parent=new THREE.Group(),fallback=new THREE.Group(),measurement=measureEnemyWeaponAxis(gltf.scene,'R')!;const signatures:string[]=[],directions:Record<string,THREE.Vector3>={};
 for(const attack of ['sweep','thrust','burst'] as const){
  e.attack=attack;const timing=enemyAttackTiming(e);e.mode='recover';e.timer=timing.recovery;visuals.update(e,model,parent,fallback,0,5,true);parent.updateMatrixWorld(true);
  const instance=(visuals as any).instances.get(e.id),root=instance.root as THREE.Object3D,feet=['footR','footL'].map(name=>root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()));
  const hand=root.getObjectByName('handR')!;directions[attack]=measurement.axis.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
  const bones:THREE.Bone[]=[];root.traverse(o=>{if(o instanceof THREE.Bone)bones.push(o);});const pose=()=>bones.flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray()]);const before=pose();signatures.push(JSON.stringify(before));
  for(let i=0;i<25;i++)visuals.update(e,model,parent,fallback,0,5,true);assert.ok(pose().every((n,i)=>Math.abs(n-before[i])<1e-7));
  if(attack==='burst'){
   const centers=['indigo','walnut'].map(material=>{const sum=new THREE.Vector3();let count=0;root.traverse(o=>{if(!(o instanceof THREE.SkinnedMesh)||![o.material].flat().some(m=>m.name.includes(material)))return;const bi=o.skeleton.bones.findIndex(b=>b.name==='forearmL'),si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight;o.skeleton.update();for(let i=0;i<si.count;i++)if([0,1,2,3].some(k=>si.getComponent(i,k)===bi&&sw.getComponent(i,k)>.8)){sum.add(o.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(o.matrixWorld));count++;}});return sum.divideScalar(count);});
   assert.ok(centers[0].z>centers[1].z+.01,'actual forearm-weighted shield blue face points toward the threat, not wooden back');
  }
  instance.acting.restore();root.updateWorldMatrix(true,true);for(const [i,name]of ['footR','footL'].entries())assert.ok(root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).distanceTo(feet[i])<.000002);
 }
 assert.equal(new Set(signatures).size,3);assert.ok(directions.thrust.z>.99,'thrust extends horizontally into locked corridor');assert.ok(directions.burst.y<-.95,'discharge braces with blade lowered, not a fake melee cut');visuals.dispose();
});
