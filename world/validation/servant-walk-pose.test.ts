import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { ContractServant, SERVANT_MODELS } from '../src/servant.ts';
import { FirstContract } from '../src/contracts.ts';
import { ServantAppearance } from '../src/servantAppearance.ts';
import { readCharacter } from './characters/inspect.ts';
import { CharacterKit } from '../src/characters/characterKit.ts';
import { CHARACTER_KITS } from '../src/characters/catalog.ts';
import { mountedChargeDistance } from '../src/characters/mountedChargeMotion.ts';

for(const outfit of ['armor','civilian'] as const)test(`${outfit}: actual Artoria walking arms match relaxed idle, crossfades stay finite, authored attack remains unmodified`,async()=>{
  const {gltf}=await readCharacter(fileURLToPath(new URL(SERVANT_MODELS[outfit])));
  const appearance=new ServantAppearance();appearance.select(outfit);let enemy=false;const enemyPosition=new THREE.Vector3();
  const servant=new ContractServant({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,
    colliders:[{name:'floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2))}],load:async()=>gltf,
    target:()=>enemy?{id:'enemy',position:enemyPosition}:null,strike:()=>null});
  await servant.ensureLoaded();const p=new THREE.Vector3();
  const bone=(n:string)=>gltf.scene.getObjectByName(`mixamorig${n}`)??gltf.scene.getObjectByName(`mixamorig:${n}`)!;
  function direction(a:string,b:string){servant.root.updateWorldMatrix(true,true);return bone(b).getWorldPosition(new THREE.Vector3()).sub(bone(a).getWorldPosition(new THREE.Vector3())).normalize();}
  for(let i=0;i<20;i++)servant.update(.05,p,0,true,false);
  const idleRight=direction('RightArm','RightForeArm'),idleLeft=direction('LeftArm','LeftForeArm');
  const armSamples:THREE.Vector3[]=[],localArms:THREE.Quaternion[]=[];
  // Sustain a real 1 m/s walk, rather than directly invoking private pose methods.
  for(let i=0;i<100;i++){p.x+=.05;servant.update(.05,p,0,true,false);if(servant.animation==='Walk'&&i>30){
    const right=direction('RightArm','RightForeArm'),left=direction('LeftArm','LeftForeArm');armSamples.push(right);localArms.push(bone('RightArm').quaternion.clone());
    assert.ok(right.y<-.85&&left.y<-.9,`arms must hang below shoulders: ${right.y},${left.y}`);
    assert.ok(Math.abs(right.y-idleRight.y)<.05&&Math.abs(left.y-idleLeft.y)<.05);
  }}
  assert.ok(armSamples.length>40);assert.ok(localArms.every(q=>q.clone().normalize().angleTo(localArms[0].clone().normalize())<.015),'walking retains published Idle arm breathing, not a new arm swing');
  for(let i=0;i<30;i++)servant.update(.05,p,0,true,false);assert.equal(servant.animation,'Idle');
  // The walk moved both player and companion away from the world origin. Place
  // a supported, reachable melee target near the current actor, then allow its
  // real facing gate rather than relying on the old unlimited target callback.
  enemyPosition.copy(servant.root.position).add(new THREE.Vector3(0,0,1.2));enemy=true;
  for(let i=0;i<60&&servant.animation!=='Attack';i++)servant.update(.05,p,0,true,false);
  assert.equal(servant.animation,'Attack','nearby target starts after natural turning');
  // The first attack update already advanced .05s; seven more sample exactly .4s.
  for(let i=0;i<7;i++)servant.update(.05,p,0,true,false);assert.equal(servant.animation,'Attack');
  // After the crossfade, no relaxed-arm modifier may affect the authored sword attack.
  const actual=bone('RightArm').quaternion.clone();
  const {gltf:reference}=await readCharacter(fileURLToPath(new URL(SERVANT_MODELS[outfit])));
  const mixer=new THREE.AnimationMixer(reference.scene);mixer.clipAction(reference.animations.find(c=>c.name==='Attack')!).play();mixer.update(.4);
  const original=reference.scene.getObjectByName('mixamorigRightArm')??reference.scene.getObjectByName('mixamorig:RightArm')!;
  assert.ok(actual.angleTo(original.quaternion)<1e-5,'attack arm quaternion is authored, not relaxed');
  for(const n of ['RightArm','RightForeArm','RightHand','LeftArm','LeftForeArm','LeftHand'])assert.ok(bone(n).quaternion.toArray().every(Number.isFinite));
  mixer.stopAllAction();new CharacterKit(reference,{id:'cleanup',assetUrl:'test',rootMotion:'in-place',defaultState:'idle',clips:{idle:{name:'Idle',duration:reference.animations.find(c=>c.name==='Idle')!.duration,loop:true}},sockets:{}}).dispose();
  servant.dispose();
});

test('actual Napoleon charge retains synchronized saddle/seat, animated gallop and original sword contact',async()=>{
  const definition=CHARACTER_KITS.napoleonMounted,{gltf}=await readCharacter(fileURLToPath(new URL(definition.assetUrl)));
  const actor=new CharacterKit(gltf,definition,{transitionSeconds:0});actor.play('attack');
  const saddle=actor.model.getObjectByName('SaddleSocket')!,seat=actor.model.getObjectByName('RiderSeatAnchor')!,hoof=actor.model.getObjectByName('H_ForeHoof_L')!;
  let first:THREE.Vector3|undefined;const hoofSamples:THREE.Vector3[]=[];
  for(let i=0;i<27;i++){actor.update(.05);actor.root.updateWorldMatrix(true,true);const relative=saddle.worldToLocal(seat.getWorldPosition(new THREE.Vector3()));
    if(!first)first=relative.clone();assert.ok(relative.distanceTo(first)<.002,'rider stays on white horse saddle');hoofSamples.push(hoof.getWorldPosition(new THREE.Vector3()));}
  assert.ok(hoofSamples.some(p=>p.distanceTo(hoofSamples[0])>.15),'horse does not freeze its legs during the attack');
  const sourceAttack=gltf.animations.find(c=>c.name==='MountedAttack')!;
  const rightHandTrack=sourceAttack.tracks.find(t=>t.name==='HandR.quaternion'||t.name==='Hand.R.quaternion');
  assert.ok(rightHandTrack,'source saber-hand animation exists');
  actor.play('attack',{restart:true});actor.update(.25);actor.update(.25);actor.update(.25);actor.update(23/30-.75);
  const sampled=(rightHandTrack as THREE.KeyframeTrack&{createInterpolant():THREE.Interpolant}).createInterpolant().evaluate(23/30);
  const hand=actor.model.getObjectByName('Hand.R')??actor.model.getObjectByName('HandR')!;
  assert.ok(hand.quaternion.clone().normalize().angleTo(new THREE.Quaternion().fromArray(sampled).normalize())<1e-5,'saber hand retains original authored contact pose');
  const start=mountedChargeDistance(0,1.4,23/30),end=mountedChargeDistance(1.4,1.4,23/30);
  assert.equal(start,0);assert.ok(end>4.5&&end<5.1);actor.dispose();
});
