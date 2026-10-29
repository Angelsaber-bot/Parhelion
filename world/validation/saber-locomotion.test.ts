import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {fileURLToPath} from 'node:url';
import {publishedSaberIdleClip,SaberIdleCarry} from '../src/characters/saberLocomotion.ts';
import {readFile} from 'node:fs/promises';
import {ContractServant,SERVANT_MODELS} from '../src/servant.ts';
import {FirstContract} from '../src/contracts.ts';
import {ServantAppearance} from '../src/servantAppearance.ts';
import {readCharacter} from './characters/inspect.ts';
const published = JSON.parse(await readFile(new URL('./characters/fixtures/saber-published-idle.json', import.meta.url), 'utf8'));
const relaxed = /mixamorig:?(?:RightArm|RightForeArm|RightHand|LeftArm|LeftForeArm)\.quaternion$/;
for(const outfit of ['armor','civilian'] as const){
 test(`${outfit}: published carry layer preserves assets, all lower-body tracks and authored combat`,async()=>{
  const {gltf,sha256}=await readCharacter(fileURLToPath(new URL(SERVANT_MODELS[outfit]))),idle=gltf.animations.find(c=>c.name==='Idle')!,walk=gltf.animations.find(c=>c.name==='Walk')!;
  assert.equal(sha256,published.outfits[outfit].assetSha256,'reference is bound to the actual published asset');
  const source=JSON.stringify(gltf.animations.map(c=>c.toJSON())),transforms:any[]=[];gltf.scene.traverse(o=>transforms.push([o.uuid,...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]));
  const restored=publishedSaberIdleClip(gltf.scene,idle),mixer=new THREE.AnimationMixer(gltf.scene),carry=new SaberIdleCarry(gltf.scene,mixer,idle);
  assert.notEqual(restored,idle);assert.equal(restored.duration,idle.duration);assert.equal(restored.tracks.length,idle.tracks.length);
  for(const original of idle.tracks){if(!relaxed.test(original.name)){const restoredTrack=restored.tracks.find(t=>t.name===original.name)!;assert.deepEqual(restoredTrack.times,original.times,original.name);assert.deepEqual(restoredTrack.values,original.values,original.name);}}
  const upper=new Set(Object.keys(published.outfits[outfit].reference));
  for(const originalClip of [idle,walk]){const clip=carry.locomotionClip(originalClip);assert.equal(clip.name,originalClip.name);assert.equal(clip.duration,originalClip.duration);
   for(const original of originalClip.tracks){const baked=clip.tracks.find(t=>t.name===original.name);if(upper.has(original.name.slice(0,original.name.lastIndexOf('.')))){assert.equal(baked,undefined,'locomotion must not fight the shared original Idle upper pose');}else{assert.ok(baked);assert.deepEqual(baked.times,original.times,original.name);assert.deepEqual(baked.values,original.values,original.name);}}
  }
  assert.equal(JSON.stringify(gltf.animations.map(c=>c.toJSON())),source,'source assets/clips are not modified');const after:any[]=[];gltf.scene.traverse(o=>after.push([o.uuid,...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]));assert.deepEqual(after,transforms,'baking never poses the live model');
  for(const name of ['Run','Attack']){const original=gltf.animations.find(c=>c.name===name)!;assert.equal(carry.locomotionClip(original),original);}
  const unknown=new SaberIdleCarry(new THREE.Group(),new THREE.AnimationMixer(new THREE.Group()),idle);assert.equal(unknown.action,undefined);assert.equal(unknown.locomotionClip(walk),walk);
  mixer.stopAllAction();
 });
 test(`${outfit}: Idle and Walk retain all 55 published upper local quaternions and grip on the original independent 2.4-second clock`,async()=>{
  const baseline=published.outfits[outfit];let maxSigned=0,maxAngle=0;
  for(const [state,rate] of [['idle',1],['walk',.65],['walk',1.8]] as const){
   const {gltf}=await readCharacter(fileURLToPath(new URL(SERVANT_MODELS[outfit]))),appearance=new ServantAppearance();appearance.select(outfit);
   const actor=new ContractServant({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,colliders:[],load:async()=>gltf,target:()=>null,strike:()=>null});await actor.ensureLoaded();
   const runtime=actor as any;runtime.play(state,false,rate);runtime.tick(.25);runtime.clips.get(state).time=0;runtime.idleCarry.action.time=0;runtime.tick(0);
   const startLeg=gltf.scene.getObjectByName('mixamorigLeftUpLeg')!.quaternion.clone();let legRange=0;
   for(let frame=0;frame<=120;frame++){
    if(frame)runtime.tick(baseline.duration/120);
    for(const [name,expected]of Object.entries(baseline.samples[frame]) as [string,number[]][]){
     const joint=gltf.scene.getObjectByName(name)!;const signed=Math.max(...joint.quaternion.toArray().map((v,i)=>Math.abs(v-expected[i])));const angle=joint.quaternion.clone().normalize().angleTo(new THREE.Quaternion().fromArray(expected).normalize());maxSigned=Math.max(maxSigned,signed);maxAngle=Math.max(maxAngle,angle);
     assert.ok(signed<1e-6,`${state}@${rate} frame=${frame} ${name} signed q error ${signed}`);assert.ok(angle<1e-6,`${state}@${rate} frame=${frame} ${name} local angle ${angle}`);
     assert.ok(joint.position.distanceTo(new THREE.Vector3().fromArray(baseline.reference[name].position))<1e-9,`${name}: unchanged local joint/grip position`);
     assert.ok(joint.scale.distanceTo(new THREE.Vector3().fromArray(baseline.reference[name].scale))<1e-9,`${name}: unchanged local scale`);
    }
    legRange=Math.max(legRange,startLeg.angleTo(gltf.scene.getObjectByName('mixamorigLeftUpLeg')!.quaternion));
   }
   if(state==='walk')assert.ok(legRange>.35,'authored leg locomotion continues while upper pose follows Idle');
   assert.equal(runtime.idleCarry.action.getEffectiveTimeScale(),1,'walking speed cannot accelerate breathing');actor.dispose();
  }
  console.log(`${outfit}: published reference max signed quaternion component error=${maxSigned}; normalized angle error=${maxAngle} rad`);
 });
 test(`${outfit}: actual Saber interrupted idle/walk/run/attack transitions do not pop or accumulate pose corrections`,async()=>{
  const {gltf}=await readCharacter(fileURLToPath(new URL(SERVANT_MODELS[outfit]))),appearance=new ServantAppearance();appearance.select(outfit);
  const actor=new ContractServant({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,colliders:[],load:async()=>gltf,target:()=>null,strike:()=>null});await actor.ensureLoaded();
  const runtime=actor as unknown as {play(name:string,restart?:boolean,rate?:number):void;tick(dt:number):void;clips:Map<string,THREE.AnimationAction>};runtime.tick(.25);
  const names=['Spine','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand'];const bones=names.map(n=>gltf.scene.getObjectByName('mixamorig'+n)!);
  const snapshot=()=>{actor.root.updateWorldMatrix(true,true);return bones.map(b=>({position:b.getWorldPosition(new THREE.Vector3()),rotation:b.getWorldQuaternion(new THREE.Quaternion())}));};
  for(const [state,duration]of [['walk',.07],['idle',.03],['walk',.07],['run',.06],['walk',.04],['attack',.08],['walk',.2],['attack',.4],['idle',.4]]as const){
   // Separate upper/lower PropertyMixers can renormalize Float32 source quaternions at a new blend. Allow <1 micrometer, never a visible pose change.
   const before=snapshot();runtime.play(state,state==='attack');runtime.tick(0);const zero=snapshot();zero.forEach((pose,i)=>{assert.ok(pose.position.distanceTo(before[i].position)<1e-6,`zero-time ${state} ${names[i]} position ${pose.position.distanceTo(before[i].position)}`);assert.ok(pose.rotation.clone().normalize().angleTo(before[i].rotation.clone().normalize())<1e-6,`zero-time ${state} ${names[i]}: ${pose.rotation.clone().normalize().angleTo(before[i].rotation.clone().normalize())}`);});
   let previous=zero;for(let t=0;t<duration-1e-8;){const dt=Math.min(1/120,duration-t);runtime.tick(dt);t+=dt;const next=snapshot();next.forEach((pose,i)=>{assert.ok(pose.position.distanceTo(previous[i].position)<.11,'bounded interrupted transition position');assert.ok(pose.rotation.angleTo(previous[i].rotation)<.35,'bounded interrupted transition rotation');});previous=next;}
   const fixed=snapshot();for(let i=0;i<20;i++)runtime.tick(0);snapshot().forEach((pose,i)=>{assert.ok(pose.position.distanceTo(fixed[i].position)<1e-10);assert.ok(pose.rotation.clone().normalize().angleTo(fixed[i].rotation.clone().normalize())<1e-6,'zero time cannot accumulate a live pose override');});
  }
  actor.dispose();
 });
}
