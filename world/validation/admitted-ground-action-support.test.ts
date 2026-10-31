import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';
import {Player} from '../src/player';import {Player as HistoricalPlayer} from './fixtures/player-pre-ground-actions';import {WorldActions} from '../src/worldActions';
const snapshot=(p:Player|HistoricalPlayer)=>({p:p.pos.toArray(),v:p.vel.toArray(),ground:p.onGround,swim:p.swimming,glide:p.gliding,updraft:p.inUpdraft});
for(const hz of[30,60,120])for(const water of[-10,2])test(`default-false admitted-action API preserves historical movement at${hz}Hz/water${water}`,()=>{
 const geometry=new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2).rotateZ(.05),colliders=[{name:'slope',enabled:true,bvh:new MeshBVH(geometry)}],a=new HistoricalPlayer(colliders,water),b=new Player(colliders,water);
 try{a.teleport(0,.05,0);b.teleport(0,.05,0);for(let i=0;i<hz*8;i++){const input={x:Math.sin(i/hz),z:i>hz*6?0:1,jump:i===hz*2||i===hz*3,sprint:i>hz*4&&i<hz*5};a.step(1/hz,input);b.step(1/hz,input);assert.deepEqual(snapshot(b),snapshot(a));}assert.equal((b as any).evadeSupport.diagnostics.supportPasses,0);}finally{geometry.dispose();}
});
function run(action:'melee'|'skill',kind:'flat'|'slope'|'ledge'|'jump',enabled=true,includeGuard=false){
 const geometry=kind==='ledge'?new THREE.BoxGeometry(4,.2,20).translate(0,-.1,0):new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2).rotateZ(kind==='slope'?.055:0),p=new Player([{name:kind,enabled:true,bvh:new MeshBVH(geometry)}],-20),idle={x:0,z:0,jump:false,sprint:false},contacts:number[]=[],cooldowns:number[]=[],counts:number[]=[],grounded:boolean[]=[],guards:boolean[]=[],dt=1/120;let t=0;
 p.teleport(kind==='ledge'?-1.55:0,.04,0);for(let i=0;i<120;i++)p.step(dt,idle);assert.equal(p.onGround,true);
 const actions=new WorldActions({scene:new THREE.Scene(),context:()=>({enabled,grounded:p.onGround,armed:true,bladeReady:true,position:p.pos,yaw:0,moveX:-1,moveZ:0,identity:null}),strike:()=>{contacts.push(t);return{damage:0,kills:[],hits:[]};},startPose:()=>false,cancelPoses:()=>{},defense:()=>{},toast:()=>{},reducedEffects:()=>true});
 try{actions.press(action);assert.equal(action==='melee'?actions.melee.active:actions.skills.casting,enabled);
  for(let i=0;i<120;i++){t=(i+1)*dt;const input={...idle,x:kind==='jump'?0:-1,jump:kind==='jump'&&i===0};p.step(dt,input,enabled&&(actions.melee.active||actions.skills.casting||(includeGuard&&actions.skills.guarding)));actions.update(dt);cooldowns.push(action==='skill'?actions.skills.cooldown('skill'):actions.melee.cooldown);counts.push((p as any).evadeSupport.diagnostics.supportPasses);grounded.push(p.onGround);guards.push(actions.skills.guarding);}
  return{contacts,cooldowns,counts,grounded,guards,diagnostics:(p as any).evadeSupport.diagnostics};
 }finally{actions.dispose();geometry.dispose();}
}
for(const action of['melee','skill']as const)test(`already-admitted ${action} preserves flat contact/cooldown clocks on gentle downhill`,()=>{
 const flat=run(action,'flat'),slope=run(action,'slope');assert.deepEqual(slope.contacts,flat.contacts);assert.equal(slope.contacts.length,1);assert.deepEqual(slope.cooldowns,flat.cooldowns);assert.ok(slope.diagnostics.recovered>0);
 const finish=action==='melee'?60:72;assert.equal(slope.counts.at(-1),slope.counts[finish],'finished action cannot continue support recovery');assert.ok(slope.grounded.slice(finish+1).some(value=>!value),'ordinary downhill contact behavior remains unchanged after action');
});
for(const action of['melee','skill']as const)test(`${action} still cancels on real ledge/jump without refund or contact`,()=>{
 for(const kind of['ledge','jump']as const){const result=run(action,kind);assert.equal(result.contacts.length,0);assert.ok(result.grounded.some(value=>!value));if(action==='skill')assert.ok(Math.abs(result.cooldowns.at(-1)!-6)<1e-7);if(kind==='jump')assert.equal(result.diagnostics.supportPasses,0);else assert.ok(result.diagnostics.rejected>0);}
});
test('disabled action coordinator does not request geometric recovery',()=>{const r=run('skill','slope',false);assert.equal(r.contacts.length,0);assert.equal(r.diagnostics.supportPasses,0);});
test('combined already-admitted action and evade invokes only the original single recovery path',()=>{
 const geometry=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2).rotateZ(.1),colliders=[{name:'slope',enabled:true,bvh:new MeshBVH(geometry)}],a=new HistoricalPlayer(colliders,-10),b=new Player(colliders,-10),idle={x:0,z:0,jump:false,sprint:false};
 try{a.teleport(0,.02,0);b.teleport(0,.02,0);for(let i=0;i<120;i++){a.step(1/120,idle);b.step(1/120,idle);}for(let i=0;i<28;i++){const input={...idle,evade:{x:-1,z:0,strength:1}};a.step(1/120,input);b.step(1/120,input,true);assert.deepEqual(snapshot(b),snapshot(a));assert.deepEqual((b as any).evadeSupport.diagnostics,(a as any).evadeSupport.diagnostics);}}finally{geometry.dispose();}
});

test('diagnostic: existing Q guard tail requires admitted skill ownership beyond cast duration',t=>{
 const flat=run('skill','flat'),castingOnly=run('skill','slope'),guardOwned=run('skill','slope',true,true);
 t.diagnostic(JSON.stringify({flatGuardSteps:flat.guards.filter(Boolean).length,castingOnlyGuardSteps:castingOnly.guards.filter(Boolean).length,guardOwnedSteps:guardOwned.guards.filter(Boolean).length}));
 assert.ok(castingOnly.guards.filter(Boolean).length<flat.guards.filter(Boolean).length);assert.deepEqual(guardOwned.guards,flat.guards);assert.deepEqual(guardOwned.contacts,flat.contacts);assert.deepEqual(guardOwned.cooldowns,flat.cooldowns);assert.equal(guardOwned.counts.at(-1),guardOwned.counts[78],'guard-only ownership ends without further support');
});
