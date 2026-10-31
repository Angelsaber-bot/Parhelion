import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {fileURLToPath}from'node:url';
import{readCharacter}from'../characters/inspect';import{CHARACTER_KITS}from'../../src/characters/catalog';import{freeArmCandidate}from'../captain-continuity/free-arm-candidate';
test('isolated Blackbeard free-arm candidate preserves source/right weapon/body and bounded normalized keys',async()=>{
 const{gltf}=await readCharacter(fileURLToPath(new URL(CHARACTER_KITS.blackbeard.assetUrl)));const source=gltf.animations.find(c=>c.name==='Attack')!;const before=JSON.stringify(source.toJSON()),candidate=freeArmCandidate(source,'blackbeard');assert.equal(JSON.stringify(source.toJSON()),before);assert.equal(candidate.duration,source.duration);assert.equal(candidate.tracks.length,source.tracks.length);assert.equal(freeArmCandidate(source,'musashi'),source);
 const diagnostics:any[]=[];
 for(let i=0;i<source.tracks.length;i++){
  const a=source.tracks[i],b=candidate.tracks[i];assert.equal(b.name,a.name);assert.deepEqual(b.times,a.times);
  if(!/^(UpperArmL|ForearmL|HandL)\.quaternion$/.test(a.name)){assert.deepEqual(b.values,a.values);continue;}
  let changed=0;for(let k=0;k<b.values.length;k+=4){const q=new THREE.Quaternion().fromArray(b.values,k);assert.ok(Math.abs(q.length()-1)<1e-6);if(q.toArray().some((v,n)=>v!==a.values[k+n]))changed++;}assert.ok(changed>0);
  const ia=(a as any).createInterpolant(),ib=(b as any).createInterpolant();let first=Infinity,last=-Infinity,peak=0;
  for(let k=0;k<=8400;k++){const t=k/6000;const qa=new THREE.Quaternion().fromArray(ia.evaluate(t)).normalize(),qb=new THREE.Quaternion().fromArray(ib.evaluate(t)).normalize();const delta=qa.angleTo(qb);if(delta>1e-5){first=Math.min(first,t);last=t;peak=Math.max(peak,delta);}assert.ok(Number.isFinite(delta));}
  diagnostics.push({track:a.name,changedKeys:changed,firstEffectiveChangeSeconds:first,lastEffectiveChangeSeconds:last,peakAngleRadians:peak});
 }
 assert.ok(diagnostics.every(r=>r.firstEffectiveChangeSeconds>.43),'real attack entry remains unchanged');console.log('FREE_ARM_INTERPOLATED_SUPPORT',JSON.stringify(diagnostics));
});

test('production native constructor positively uses the correction and preserves actual gun contact',async()=>{
 const {CharacterKit}=await import('../../src/characters/characterKit');const{refineCaptainCavalryContinuity}=await import('../../src/captainCavalryContinuity');const def=CHARACTER_KITS.blackbeard,{gltf}=await readCharacter(fileURLToPath(new URL(def.assetUrl)));const raw=gltf.animations.find(c=>c.name==='Attack')!,events:any[]=[];const actor=new CharacterKit(gltf,def,{onEvent:e=>events.push(e)});
 try{const actual=actor.presentationClips.find(c=>c.name==='Attack')!;assert.notEqual(actual,raw);assert.equal(refineCaptainCavalryContinuity(raw,'attack','blackbeard'),actual);assert.equal(refineCaptainCavalryContinuity(actual,'attack','blackbeard'),actual);const expected=freeArmCandidate(raw,'blackbeard');const {uuid:actualUuid,...actualClip}=actual.toJSON(),{uuid:expectedUuid,...expectedClip}=expected.toJSON();assert.notEqual(actualUuid,expectedUuid,'independently constructed clips own distinct IDs');assert.deepEqual(actualClip,expectedClip);
 const reference=actor.model.clone(true),mixer=new THREE.AnimationMixer(reference);const action=mixer.clipAction(raw).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(17/30);reference.updateMatrixWorld(true);const expectedMuzzle=reference.getObjectByName('Blackbeard_Muzzle')!.getWorldPosition(new THREE.Vector3());
 actor.play('attack');for(let i=0;i<90;i++)actor.update(1/120);assert.equal(events.length,1);assert.equal(events[0].at,17/30);assert.ok(events[0].transform.position.distanceTo(expectedMuzzle)<1e-10);mixer.stopAllAction();mixer.uncacheRoot(reference);
 const before=new Set(raw.tracks.flatMap(t=>[t.times.buffer,t.values.buffer])),after=new Set(actual.tracks.flatMap(t=>[t.times.buffer,t.values.buffer]));console.log('CORRECTED_ATTACK_TRACK_STORAGE',JSON.stringify({rawBytes:[...before].reduce((n,b)=>n+b.byteLength,0),correctedBytes:[...after].reduce((n,b)=>n+b.byteLength,0),newBackingBytes:[...after].filter(b=>!before.has(b)).reduce((n,b)=>n+b.byteLength,0)}));
 }finally{actor.dispose();}
});
