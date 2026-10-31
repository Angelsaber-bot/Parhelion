import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { readCharacter } from './characters/inspect.ts';
import { musashiGeometry } from './characters/musashi-motion-metrics.ts';
import { CharacterKit, type KitEventResult } from '../src/characters/characterKit.ts';
import { CHARACTER_KITS } from '../src/characters/catalog.ts';
import { musashiLocomotionClip } from '../src/characters/musashiLocomotion.ts';
const definition=CHARACTER_KITS.musashi;
async function fixture(onEvent?:(e:KitEventResult)=>void){const {gltf}=await readCharacter(fileURLToPath(new URL(definition.assetUrl)));const actor=new CharacterKit(gltf,definition,{onEvent});return {actor,gltf};}
const bone=(actor:CharacterKit,name:string)=>actor.model.getObjectByName(`mixamorig${name}`)!;
const pos=(actor:CharacterKit,name:string)=>bone(actor,name).getWorldPosition(new THREE.Vector3());
const direction=(actor:CharacterKit,a:string,b:string)=>pos(actor,b).sub(pos(actor,a)).normalize();
function advance(actor:CharacterKit,time:number,dt=1/120){for(let t=0;t<time-1e-9;){const step=Math.min(dt,time-t);actor.update(step);t+=step;}}

test('Musashi: actual gait lowers both arms, counter-swings to the feet, keeps blades above ground/outside cloth and preserves soles',async()=>{
  const {actor}=await fixture(),geo=musashiGeometry(actor);const report:any={};
  actor.mixer.update(0);geo.sync();const attachments=geo.blades.flatMap(mesh=>Array.from({length:8},(_,n)=>{const i=Math.floor(n*mesh.geometry.attributes.position.count/8),hand=mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getX(i)];return{mesh,i,hand,local:hand.worldToLocal(mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld))};}));
  for(const state of ['idle','walk','run']as const){
    actor.play(state);advance(actor,.3);let minBlade=Infinity,minFoot=Infinity,maxArm=-Infinity,minClear=Infinity;const arms:number[]=[],legs:number[]=[],elbows:number[]=[];
    for(let f=0;f<120;f++){
      actor.update(definition.clips[state].duration/120);const ground=geo.ground();for(const {mesh,i,hand,local}of attachments){const p=hand.worldToLocal(mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));assert.ok(p.distanceTo(local)<1e-6,'both actual blades remain rigidly bound to their original hands');}minBlade=Math.min(minBlade,ground.bladeMin);minFoot=Math.min(minFoot,ground.footMin);
      for(const side of ['Left','Right']){const upper=direction(actor,`${side}Arm`,`${side}ForeArm`),lower=direction(actor,`${side}ForeArm`,`${side}Hand`);if(side==='Left')elbows.push(upper.angleTo(lower));maxArm=Math.max(maxArm,upper.y);assert.ok(upper.y<-.93,'upper arms no longer held sideways');assert.ok(upper.angleTo(lower)<.6,'relaxed elbow bend, not a locked guard');}
      arms.push(pos(actor,'LeftHand').z);legs.push(pos(actor,'LeftFoot').z);
      if(f%10===0){const c=geo.clearance();assert.equal(c.intersects,false,`${state}@${f}: blade intersects torso/cloth/legs`);minClear=Math.min(minClear,c.distance);}
    }
    assert.ok(minBlade>.20,`${state} full blades clear ground: ${minBlade}`);assert.ok(minFoot>-.02,`${state} feet penetrate ground: ${minFoot}`);assert.ok(minClear>.008,`${state} blade/cloth clearance ${minClear}`);
    if(state!=='idle'){
      assert.ok(Math.max(...elbows)-Math.min(...elbows)>(state==='walk'?.13:.17),'forearm trails the shoulder with changing elbow flex, not a rigid low pendulum');
      const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length,ma=mean(arms),ml=mean(legs),cov=arms.reduce((a,x,i)=>a+(x-ma)*(legs[i]-ml),0),den=Math.sqrt(arms.reduce((a,x)=>a+(x-ma)**2,0)*legs.reduce((a,x)=>a+(x-ml)**2,0));
      assert.ok(cov/den<-.7,`hands counter-swing rather than move in phase with the same-side foot: ${state} correlation ${cov/den}`);assert.ok(Math.max(...arms)-Math.min(...arms)>.07,'natural gait is not a frozen low pose');
    }
    report[state]={minBlade,minFoot,maxArm,minClear};
  }
  console.log('MUSASHI_GEOMETRY',JSON.stringify(report));actor.dispose();
});

test('Musashi: source clips, lower-body channels, socket bindings, grip/finger pose and two-hit contact poses are unchanged',async()=>{
  const {actor,gltf}=await fixture();
  for(const state of ['idle','walk','run']as const){const source=gltf.animations.find(c=>c.name===definition.clips[state].name)!,original=JSON.stringify(source.toJSON()),relaxed=musashiLocomotionClip(source,gltf.scene,state);assert.equal(JSON.stringify(source.toJSON()),original);
    for(const track of source.tracks.filter(t=>/Hips|UpLeg|Leg|Foot|Toe|Hand(?:Thumb|Index|Middle|Ring|Pinky)/.test(t.name))){const copy=relaxed.tracks.find(t=>t.name===track.name)!;assert.deepEqual(copy.values,track.values);assert.deepEqual(copy.times,track.times);}
  }
  const attack=gltf.animations.find(c=>c.name==='Attack')!;const performed=musashiLocomotionClip(attack,gltf.scene,'attack');assert.notEqual(performed,attack);assert.equal(performed.duration,attack.duration);
  const localSockets=Object.values(definition.sockets).map(s=>{const o=actor.model.getObjectByName(s.node)!;return {o,p:o.position.clone(),q:o.quaternion.clone(),parent:o.parent};});
  actor.play('walk');advance(actor,.5);actor.play('attack');advance(actor,19/30);
  const reference=gltf.scene.clone(true),mixer=new THREE.AnimationMixer(reference);mixer.clipAction(attack).play();
  for(const time of [19/30,33/30]){if(time>19/30)advance(actor,time-19/30);mixer.setTime(time);actor.root.updateWorldMatrix(true,true);reference.updateWorldMatrix(true,true);
    for(const t of attack.tracks.filter(t=>t.name.endsWith('.quaternion'))){const name=t.name.split('.')[0],actual=actor.model.getObjectByName(name)!,expected=reference.getObjectByName(name)!;assert.ok(actual.quaternion.clone().normalize().angleTo(expected.quaternion.clone().normalize())<1e-5,`${name} exact attack pose at ${time}`);}
    for(const {o,p,q,parent}of localSockets){assert.deepEqual(o.position,p);assert.deepEqual(o.quaternion.toArray(),q.toArray());assert.equal(o.parent,parent);}
  }
  mixer.stopAllAction();actor.dispose();
});

test('Musashi: all idle/walk/run/attack blends and rapid interruptions stay continuous, finite, and leave authored event times intact',async()=>{
  const events:KitEventResult[]=[],{actor}=await fixture(e=>events.push(e));const geo=musashiGeometry(actor);
  let maxStep=0,minTransitionBlade=Infinity;
  for(const from of ['idle','walk','run','attack'])for(const to of ['idle','walk','run','attack'])if(from!==to){actor.play(from,{restart:true});advance(actor,.4);geo.sync();let previous=pos(actor,'RightHand');actor.play(to,{restart:true});for(let f=0;f<45;f++){actor.update(1/120);minTransitionBlade=Math.min(minTransitionBlade,geo.ground().bladeMin);const current=pos(actor,'RightHand');maxStep=Math.max(maxStep,current.distanceTo(previous));previous=current;assert.ok(current.toArray().every(Number.isFinite));}}
  for(let f=0;f<120;f++){if(f%7===0)actor.play(['walk','run','idle'][Math.floor(f/7)%3]);actor.update(1/120);geo.sync();assert.ok(pos(actor,'RightHand').toArray().every(Number.isFinite));}
  assert.ok(minTransitionBlade>.05,`transition blade floor clearance ${minTransitionBlade}`);
  assert.ok(maxStep<.065,`transition hand step ${maxStep} m at 120Hz`);
  events.length=0;actor.play('attack',{restart:true});advance(actor,.62);assert.equal(events.length,0);advance(actor,1.6-.62+1/120);assert.deepEqual(events.map(e=>[e.at,e.socket]),[[19/30,'rightKatana'],[33/30,'leftKatana']]);assert.equal(actor.state,'idle');
  const before=actor.clipTime;actor.update(.1,true);assert.equal(actor.clipTime,before);actor.dispose();console.log('MUSASHI_TRANSITION',JSON.stringify({maxStep,minTransitionBlade}));
});

test('Musashi: ten repeated gait cycles return to the same pose without accumulating torso/wrist corrections',async()=>{
  const {actor}=await fixture();
  for(const state of ['idle','walk','run']as const){actor.play(state);advance(actor,.37);actor.root.updateWorldMatrix(true,true);
    const names=['Spine','Spine1','Spine2','Neck','LeftHand','RightHand','LeftFoot','RightFoot'],initial=names.map(name=>({q:bone(actor,name).quaternion.clone(),p:pos(actor,name)}));
    for(let cycle=0;cycle<10;cycle++){advance(actor,definition.clips[state].duration);actor.root.updateWorldMatrix(true,true);for(const [i,name]of names.entries()){assert.ok(bone(actor,name).quaternion.clone().normalize().angleTo(initial[i].q.clone().normalize())<2e-5,`${state} ${name} rotation drift`);assert.ok(pos(actor,name).distanceTo(initial[i].p)<2e-5,`${state} ${name} position drift`);}}
  }
  actor.dispose();
});
