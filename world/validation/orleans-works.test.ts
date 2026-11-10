import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createOrleansWorksRuntime} from '../src/story/orleansWorks';
import {createOrleansWorksScene} from '../src/environment/orleansWorksScene';
import {ORLEANS_WORKS as W,ORLEANS_WORK_ACTIONS} from '../src/map/orleansWorks';
import {createQuestGuideCatalog} from '../src/story/questGuideCatalog';

const frame={dt:1/60,held:true,playable:true,inRange:true,grounded:true,moving:false,attacking:false};
function fixture(){
 const done=new Set<string>(['sun_core']);let saves=0,changed=0,rings=0,damage=0,reachable=true;
 const runtime=createOrleansWorksRuntime({done,save:()=>{saves++;return true;},changed:()=>changed++,reachable:()=>reachable,damage:()=>damage,toast:()=>{},ring:()=>rings++,sound:()=>{}});
 const release=()=>runtime.update({...frame,held:false});
 const hold=(seconds:number)=>{for(let i=0;i<seconds*60;i++)runtime.update(frame);};
 return{done,runtime,release,hold,get saves(){return saves;},get changed(){return changed;},get rings(){return rings;},hurt(){damage++;},unreachable(){reachable=false;}};
}
test('three local works require grounded held input and save only their own actual completion',()=>{
 for(const a of ORLEANS_WORK_ACTIONS){const h=fixture();h.runtime.interact(a.id);h.hold(10);assert.equal(h.runtime.progress,0,'the opening keypress cannot accidentally complete work');h.release();h.hold(a.seconds-1/60);assert.equal(h.done.has(a.flag),false);h.hold(1/60);assert.equal(h.done.has(a.flag),true);assert.equal(h.saves,1);assert.equal(h.changed,1);assert.deepEqual([...h.done].sort(),['sun_core',a.flag].sort());h.runtime.interact(a.id);assert.equal(h.saves,1);h.runtime.dispose();}
});
test('movement, damage, pause, attacking and range loss interrupt without preserving partial work',()=>{
 for(const reason of ['moving','playable','attacking','inRange','grounded','damage'] as const){
  const h=fixture();h.runtime.interact(W.sluice);h.release();h.hold(1);
  if(reason==='damage')h.hurt();
  h.runtime.update({...frame,...(reason==='damage'?{}:{[reason]:reason==='moving'||reason==='attacking'})});
  assert.equal(h.runtime.active,null,reason);assert.equal(h.done.has(W.sluiceDone),false);assert.equal(h.saves,0);
  h.runtime.interact(W.sluice);h.hold(10);assert.equal(h.done.has(W.sluiceDone),false,'holding through an interruption cannot auto-restart');h.runtime.dispose();
 }
});
test('large frame deltas, stale completion reach and invalid actions cannot remotely finish a facility',()=>{
 const h=fixture();assert.equal(h.runtime.interact('__proto__'),false);h.runtime.interact(W.sluice);h.release();h.runtime.update({...frame,dt:200});assert.ok(h.runtime.progress<=.05/3+.00001);h.unreachable();h.hold(4);assert.equal(h.saves,0);assert.equal(h.runtime.active,null);assert.equal(h.done.has(W.sluiceDone),false);h.runtime.dispose();
});
test('walking away before the first hold removes the pending operation instead of leaving a remote progress prompt',()=>{
 const h=fixture();h.runtime.interact(W.sluice);assert.equal(h.runtime.requiresRelease,true);h.runtime.update({...frame,inRange:false});assert.equal(h.runtime.active,null);assert.equal(h.saves,0);h.runtime.dispose();
});
test('bell can be rung again after a local cooldown without duplicate completion or ringing on load',()=>{
 const h=fixture();h.runtime.interact(W.bell);h.release();h.hold(1.5);assert.equal(h.rings,1);h.runtime.interact(W.bell);assert.equal(h.rings,1);h.hold(3.1);h.runtime.interact(W.bell);assert.equal(h.rings,2);assert.equal(h.saves,1);h.runtime.reset();assert.equal(h.rings,2);h.runtime.dispose();
});
test('physical grille follows saved completion while mechanisms animate finite, private geometry',()=>{
 const scene=createOrleansWorksScene((_x,_z,ceiling)=>ceiling-.95),done=new Set<string>();
 try{
  scene.apply(done);assert.equal(scene.collider.enabled,true);
  const cargo=scene.root.getObjectByName('OrleansCraneGrain')!,start=cargo.position.clone();scene.apply(done,W.crane,.7);assert.ok(cargo.position.y>start.y+5&&cargo.position.x>start.x);
  scene.apply(done,W.sluice,.9);assert.equal(scene.collider.enabled,true,'physical opening waits for committed completion');done.add(W.sluiceDone);scene.apply(done);assert.equal(scene.collider.enabled,false);
  scene.ring();scene.update(.05,new THREE.Vector3(-720,14,-720));assert.notEqual(scene.root.getObjectByName('OrleansBelfryBell')!.rotation.z,0);
  scene.apply(done,W.crane,NaN);scene.update(Infinity,new THREE.Vector3(-720,14,-720));scene.root.updateMatrixWorld(true);scene.root.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
  assert.equal(scene.markers.length,3);assert.ok(scene.markers.every(m=>m.type==='interact'&&m.p.every(Number.isFinite)));
 }finally{scene.dispose();scene.dispose();assert.equal(scene.collider.enabled,false);}
});
test('guidance exposes only installed local facilities, translates targets and completes from saved work rather than discoveries',()=>{
 const input={markers:ORLEANS_WORK_ACTIONS.map(a=>({id:a.id,type:'interact' as const,label:a.label[0],p:[a.position[0]-720,a.position[1]+.95,a.position[2]-720] as [number,number,number]})),objectives:[],npcs:[]};
 const catalog=createQuestGuideCatalog(input),done=new Set<string>(),found=new Set(ORLEANS_WORK_ACTIONS.map(a=>a.id));
 for(const a of ORLEANS_WORK_ACTIONS){const entry=catalog.list(done,found).find(e=>e.id===`side:${a.id}`)!;assert.equal(entry.region,'orleans');assert.equal(entry.complete,false);assert.equal(entry.guide?.targetId,a.id);assert.deepEqual(entry.guide?.targetLabel,a.label);assert.deepEqual(entry.guide?.text,a.hint);done.add(a.flag);assert.equal(catalog.list(done,found).find(e=>e.id===entry.id)!.complete,true);}
 assert.equal(createQuestGuideCatalog({...input,markers:[]}).list(done,found).filter(e=>e.region==='orleans').length,0);
});
