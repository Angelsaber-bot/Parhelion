/** Real GLB and renderer-lifecycle checks. Not a browser/visual quality acceptance. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { EnemyVisuals, ENEMY_VISUAL_BUDGET, enemyClip, enemyModel, type EnemyModel } from '../src/enemyVisuals.ts';
import { WorldCombatState, enemyAttackTiming } from '../src/combat.ts';
import { parseLocalGlb } from './player-fixture.ts';
const models: EnemyModel[] = ['samurai','ashigaru','musketeer','officer','sunward_guard','deck_raider'];
const asset = (key: string) => parseLocalGlb(new URL(`../public/assets/enemies/${key}.glb`,import.meta.url));
function meshes(root: THREE.Object3D) { const out: THREE.SkinnedMesh[]=[];root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)out.push(o);});return out; }
for(const model of models) for(const suffix of ['', '_lod1']) test(`${model}${suffix}: delivered GLB has finite animated geometry and independent clone bones`, async()=>{
  const gltf=await asset(model+suffix), skins=meshes(gltf.scene);
  assert.ok(skins.length>0,'actual skinned GLB, not a procedural replacement');
  assert.ok(gltf.animations.some(c=>c.name==='Idle'));assert.ok(gltf.animations.some(c=>c.name==='Walk'));
  for(const name of model==='musketeer'?['Aim','FirePreview']:['Attack_Windup','Attack'])assert.ok(gltf.animations.some(c=>c.name===name),`${model}${suffix}: missing required gameplay clip ${name}`);
  const a=clone(gltf.scene),b=clone(gltf.scene),am=meshes(a),bm=meshes(b);
  assert.equal(am.length,skins.length);
  for(let i=0;i<skins.length;i++) {
    assert.equal(am[i].geometry,skins[i].geometry,'clones share immutable geometry');
    assert.equal(am[i].material,skins[i].material,'clones share materials');
    assert.notEqual(am[i].skeleton,bm[i].skeleton);assert.notEqual(am[i].skeleton.bones[0],bm[i].skeleton.bones[0]);
    assert.ok(am[i].skeleton.bones.length>10);
  }
  const untouched=bm.flatMap(m=>m.skeleton.bones.flatMap(bone=>bone.matrix.toArray()));
  const mixer=new THREE.AnimationMixer(a),p=new THREE.Vector3();let samples=0;
  for(const mode of ['idle','chase','windup','recover'] as const) {
    const name=enemyClip(model,mode,gltf.animations.map(c=>c.name));
    assert.ok(name&&!/Run|Death/.test(name),'unapproved combat animation excluded');
    if(model==='musketeer'&&mode==='recover')assert.equal(name,'FirePreview','ranged simulation uses authored shot preview');
    const clip=gltf.animations.find(c=>c.name===name)!;assert.ok(clip.duration>0);
    mixer.stopAllAction();mixer.clipAction(clip).reset().play();
    for(const dt of [.01,.12,.3]) {mixer.update(dt);a.updateMatrixWorld(true);
      for(const mesh of am) {mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=149) {
        mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.length()<15);samples++;
      }}
    }
  }
  assert.ok(samples>20);assert.deepEqual(bm.flatMap(m=>m.skeleton.bones.flatMap(bone=>bone.matrix.toArray())),untouched,'animation never mutates another enemy');
  mixer.stopAllAction();mixer.uncacheRoot(a);for(const root of [a,b,gltf.scene])for(const m of meshes(root))m.skeleton.dispose();
});

test('enemy appearance is deterministic by authored home, boss remains bespoke',()=>{
  const mk=(x:number,z:number)=>({id:'sample',home:{x,y:0,z},kind:'shade' as const});
  assert.ok(['samurai','ashigaru'].includes(enemyModel(mk(0,720))!));
  assert.ok(['musketeer','officer'].includes(enemyModel(mk(0,-720))!));
  assert.equal(enemyModel(mk(-720,0)),'sunward_guard');assert.equal(enemyModel(mk(720,0)),'deck_raider');
  assert.equal(enemyModel({...mk(720,0),kind:'king'}),null);
  assert.equal(enemyModel({...mk(0,720),miniboss:'captain'}),'samurai');
});

test('real-GLB visual lifecycle stays capped, releases paused/dead instances, shares templates and disposes once',async()=>{
  const gltf=await asset('ashigaru'), low=await asset('ashigaru_lod1'), visuals=new EnemyVisuals();
  const internals=visuals as any;internals.cache.set('ashigaru',gltf);internals.cache.set('ashigaru_lod1',low);
  const state=new WorldCombatState(Array.from({length:30},(_,i)=>({id:`test_${i}`,kind:'shade' as const,p:{x:0,y:0,z:720}})),[]);
  const parents=state.enemies.map(()=>new THREE.Group()),fallbacks=state.enemies.map(()=>new THREE.Group());
  state.enemies.forEach((e,i)=>{e.active=true;visuals.update(e,'ashigaru',parents[i],fallbacks[i],.05,5,true);});
  assert.equal(visuals.activeMixers,ENEMY_VISUAL_BUDGET);assert.equal(fallbacks[24].visible,true);
  const playing=internals.instances.get(state.enemies[0].id), beforeTime=playing.action.time;
  visuals.update(state.enemies[0],'ashigaru',parents[0],fallbacks[0],.05,5,true);
  assert.ok(playing.action.time>beforeTime,'same state frame must advance rather than reset clip time');
  state.enemies[0].mode='windup';state.enemies[0].timer=.4;
  visuals.update(state.enemies[0],'ashigaru',parents[0],fallbacks[0],.01,5,true);
  const windupTime=playing.action.time;
  assert.equal(playing.action.getEffectiveTimeScale(),playing.action.getClip().duration/enemyAttackTiming(state.enemies[0]).windup,'pose windup uses the same timing as actual contact simulation');
  visuals.update(state.enemies[0],'ashigaru',parents[0],fallbacks[0],.01,5,true);
  assert.ok(playing.action.time>=windupTime,'unchanged windup cannot reset to initial seek');

  for(let cycle=0;cycle<12;cycle++) {
    state.enemies.forEach((e,i)=>visuals.update(e,'ashigaru',parents[i],fallbacks[i],.05,cycle%2?30:5,true));
    assert.equal(visuals.activeMixers,ENEMY_VISUAL_BUDGET);
    assert.equal(parents.reduce((n,p)=>n+p.children.length,0),ENEMY_VISUAL_BUDGET,'LOD change must replace old clones');
  }
  visuals.update(state.enemies[0],'ashigaru',parents[0],fallbacks[0],.05,5,false);
  assert.equal(visuals.activeMixers,23);assert.equal(parents[0].children.length,0);
  state.enemies[1].mode='dead';visuals.update(state.enemies[1],'ashigaru',parents[1],fallbacks[1],.05,5,true);assert.equal(visuals.activeMixers,22);
  const geos=new Set<THREE.BufferGeometry>();for(const template of [gltf,low])template.scene.traverse(o=>{if(o instanceof THREE.Mesh)geos.add(o.geometry);});
  let disposed=0;geos.forEach(g=>g.addEventListener('dispose',()=>disposed++));
  visuals.dispose();visuals.dispose();assert.equal(visuals.activeMixers,0);assert.equal(disposed,geos.size);
  assert.equal(parents.reduce((n,p)=>n+p.children.length,0),0);assert.equal(internals.cache.size,0);
  visuals.update(state.enemies[2],'ashigaru',parents[2],fallbacks[2],.05,5,true);assert.equal(visuals.activeMixers,0);
});

for(const model of models) test(`${model}: exact CPU skinned bounds stay grounded in every selected gameplay clip`,async()=>{
  const gltf=await asset(model),mixer=new THREE.AnimationMixer(gltf.scene);
  const names=new Set(['idle','chase','windup','recover'].map(mode=>enemyClip(model,mode as any,gltf.animations.map(c=>c.name))));
  for(const name of names){const clip=gltf.animations.find(c=>c.name===name)!;mixer.stopAllAction();mixer.clipAction(clip).reset().play();
    for(let i=0;i<=10;i++){mixer.setTime(clip.duration*i/10);gltf.scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(gltf.scene,true);
      assert.ok(box.min.y>=-.006,`${name} frame ${i}: penetration ${box.min.y}`);assert.ok(box.min.y<.1,`${name} frame ${i}: airborne ${box.min.y}`);
      assert.ok(box.max.y>1.4&&box.max.y<3.5,`${name}: human scale includes held weapon`);assert.ok(box.getSize(new THREE.Vector3()).length()<6);
    }
  }
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
});

test('asset failure is cached and late successful load after disposal releases template without resurrecting enemies',async()=>{
  const enemy=new WorldCombatState([{id:'late',kind:'shade',p:{x:0,y:0,z:720}}],[]).enemies[0];enemy.active=true;
  const parent=new THREE.Group(),fallback=new THREE.Group();let calls=0;let success:Function=()=>{},failure:Function=()=>{};
  const visuals=new EnemyVisuals(),internals=visuals as any;
  internals.loader.load=(_url:string,onLoad:Function,_progress:unknown,onError:Function)=>{calls++;success=onLoad;failure=onError;};
  visuals.update(enemy,'ashigaru',parent,fallback,.05,5,true);assert.equal(calls,1);assert.equal(visuals.activeMixers,0);assert.equal(fallback.visible,true);
  failure(new Error('fixture missing'));for(let i=0;i<8;i++)visuals.update(enemy,'ashigaru',parent,fallback,.05,5,true);
  assert.equal(calls,1,'failed asset cached, not requested every frame');
  // Another LOD starts one genuine pending request. Disposing the world must own its eventual bytes.
  visuals.update(enemy,'ashigaru',parent,fallback,.05,30,true);assert.equal(calls,2);visuals.dispose();
  const gltf=await asset('ashigaru_lod1'),geometries=new Set<THREE.BufferGeometry>();gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh)geometries.add(o.geometry);});
  let disposals=0;geometries.forEach(g=>g.addEventListener('dispose',()=>disposals++));success(gltf);
  assert.equal(disposals,geometries.size);assert.equal(visuals.activeMixers,0);assert.equal(parent.children.length,0);assert.equal(internals.cache.size,0);assert.equal(internals.pending.size,0);
});
