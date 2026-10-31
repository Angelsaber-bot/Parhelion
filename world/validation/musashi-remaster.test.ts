import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from'three';import{fileURLToPath}from'node:url';
import{readCharacter}from'./characters/inspect';import{CHARACTER_KITS}from'../src/characters/catalog';import{createMusashiUltimatePerformance}from'../src/musashiUltimatePerformance';import{musashiLocomotionClip}from'../src/characters/musashiLocomotion';
import{skillAnimationProfile,skillAnimationSample}from'../src/skillAnimationProfile';
const asset=fileURLToPath(CHARACTER_KITS.musashi.assetUrl);
function schedule(){const hits:number[]=[];let total=0;for(let cycle=0;hits.length<3;cycle++){const p=skillAnimationProfile('musashi','ultimate',cycle),d=skillAnimationSample(p,0,1.6,19/30).duration;for(const contact of[19/30,33/30]){if(hits.length>=3)break;let lo=0,hi=d;for(let i=0;i<35;i++){const mid=(lo+hi)/2;if(skillAnimationSample(p,mid,1.6,19/30).clipTime<contact)lo=mid;else hi=mid;}hits.push(total+hi);}total+=d;}return{hits,total};}

test('Musashi dedicated dual-blade performance stays finite, grounded and local; reset/dispose restore exact captured pose',async()=>{
 const{gltf}=await readCharacter(asset),root=gltf.scene,mixer=new THREE.AnimationMixer(root);mixer.clipAction(gltf.animations.find(c=>c.name==='Idle')!).play();mixer.update(0);
 const nodes:THREE.Object3D[]=[];root.traverse(o=>nodes.push(o));const snapshot=()=>nodes.map(o=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]);const initial=snapshot(),source=gltf.animations.map(c=>JSON.stringify(c.toJSON()));
 const sockets=['Attachment_RightHand_Katana','Attachment_LeftHand_Katana'].map(n=>root.getObjectByName(n)!);const local=sockets.map(o=>({p:o.position.toArray(),q:o.quaternion.toArray(),parent:o.parent}));const{hits,total}=schedule();const perf=createMusashiUltimatePerformance(root,gltf.animations);let maxStep=0;let previous:THREE.Vector3[]|undefined;
 for(let frame=0;frame<=Math.ceil((5+total+.85)*120);frame++){
  const t=frame/120,phase=t<1.2?'intro':t<5?'charge':t<5+total?'release':'outro',start=phase==='intro'?0:phase==='charge'?1.2:phase==='release'?5:5+total,span=phase==='intro'?1.2:phase==='charge'?3.8:phase==='release'?total:.85;
  perf.update({phase,elapsed:t,progress:Math.min(1,(t-start)/span),strikeCount:hits.filter(h=>t-5>=h).length});
  for(const row of snapshot())assert(row.every(Number.isFinite));
  const hands=sockets.map(o=>o.getWorldPosition(new THREE.Vector3()));if(previous)hands.forEach((p,i)=>maxStep=Math.max(maxStep,p.distanceTo(previous![i])));previous=hands;
  if(phase==='release')for(const side of['Left','Right']){const foot=root.getObjectByName('mixamorig'+side+'Foot')!.getWorldPosition(new THREE.Vector3());assert(foot.y>.025&&foot.y<.13,'planted ankle remains at native ground height');}
  for(const[i,s]of sockets.entries()){assert.deepEqual(s.position.toArray(),local[i].p);assert.deepEqual(s.quaternion.toArray(),local[i].q);assert.equal(s.parent,local[i].parent);}
 }
 assert(maxStep<.10,`bounded 120Hz hand step ${maxStep}`);assert.deepEqual(gltf.animations.map(c=>JSON.stringify(c.toJSON())),source);
 perf.reset();assert.deepEqual(snapshot(),initial);perf.update({phase:'charge',progress:.6,elapsed:2});perf.dispose();assert.deepEqual(snapshot(),initial);perf.dispose();perf.update({phase:'release',progress:1,elapsed:10,strikeCount:3});assert.deepEqual(snapshot(),initial);mixer.stopAllAction();console.log('MUSASHI_REMASTER_HAND_STEP',maxStep);
});

test('ordinary Musashi remaster visibly changes bookends, preserves complete contact samples and does not mutate source clips',async()=>{
 const{gltf}=await readCharacter(asset),source=gltf.animations.find(c=>c.name==='Attack')!,json=JSON.stringify(source.toJSON()),clip=musashiLocomotionClip(source,gltf.scene,'attack');assert.notEqual(clip,source);assert.equal(JSON.stringify(source.toJSON()),json);
 let changed=0;for(const track of source.tracks){const next=clip.tracks.find(t=>t.name===track.name)!;const sample=(t:THREE.KeyframeTrack,time:number)=>Array.from((t as THREE.KeyframeTrack&{createInterpolant():THREE.Interpolant}).createInterpolant().evaluate(time));for(const time of[19/30,33/30]){const a=sample(track,time),b=sample(next,time);assert.equal(a.length,b.length);assert(Math.max(...a.map((v,i)=>Math.abs(v-b[i])))<1e-5,`${track.name} contact preserved`);}if(track.name.endsWith('Arm.quaternion')||track.name.endsWith('Hand.quaternion')){if(sample(track,.16).some((v,i)=>Math.abs(v-sample(next,.16)[i])>.08))changed++;}}
 assert(changed>=4,'both arms and hands have a genuinely different low-carry entrance');
});

test('native Musashi face blinks in idle and clears blink/focus through ordinary transitions',async()=>{
 const{gltf}=await readCharacter(asset);const{CharacterKit}=await import('../src/characters/characterKit');const actor=new CharacterKit(gltf,CHARACTER_KITS.musashi,{transitionSeconds:0});let face:THREE.Mesh|undefined;actor.model.traverse(o=>{const m=o as THREE.Mesh;if(m.morphTargetDictionary?.Blink!==undefined)face=m;});assert(face?.morphTargetInfluences&&face.morphTargetDictionary);
 for(let i=0;i<234;i++)actor.update(.01);assert(face.morphTargetInfluences[face.morphTargetDictionary.Blink]>.85,'actual morph binding closes eyelids');
 actor.play('attack');actor.update(.2);assert.equal(face.morphTargetInfluences[face.morphTargetDictionary.Blink],0);assert(face.morphTargetInfluences[face.morphTargetDictionary.Angry]>0);
 actor.play('idle');actor.update(.01);assert(face.morphTargetInfluences[face.morphTargetDictionary.Angry]<.001);actor.dispose();
});
