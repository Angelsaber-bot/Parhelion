/** Root-space endpoint + signed imported-biceps audit. JSON evidence, not a visual pass. */
import * as THREE from 'three';import {writeFile}from'node:fs/promises';import {pathToFileURL}from'node:url';
import {playerFixture}from'../player-fixture.ts';
const {SkinnedCharacterAnimator}=await import(process.argv[3]?pathToFileURL(process.argv[3]).href:'../../src/skinnedCharacter.ts');
const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig),v=()=>new THREE.Vector3(),q=()=>new THREE.Quaternion();
const records:any[]=[];
for(const [mode,armed,speed,aim] of [['emptyhand',false,5.5,0],['carry',true,5.5,0],['ads',true,0,1]]as const){
 a.reset(armed);const state={armed,speed,aim,onGround:true,swimming:false,vy:0,moveYaw:0};for(let i=0;i<240;i++)a.update(1/120,state);
 for(let i=0;i<120;i++){
  a.update(1/120,state);
  for(const side of ['R','L']as const){
   const U=f.rig.joints[`Arm_${side}`]as THREE.Bone,E=f.rig.joints[`Forearm_${side}`],W=f.rig.joints[`Hand_${side}`];
   const s=U.getWorldPosition(v()),e=E.getWorldPosition(v()),w=W.getWorldPosition(v());const u=e.clone().sub(s).normalize(),d=w.clone().sub(e).normalize();
   const flex=d.clone().addScaledVector(u,-d.dot(u));const flexLength=flex.length();flex.normalize();
   const authored=new THREE.Vector3(0,0,1).applyQuaternion(f.rig.rest.get(U)!.rootQ.clone().invert()).applyQuaternion(U.getWorldQuaternion(q()));authored.addScaledVector(u,-authored.dot(u)).normalize();
   const reach=w.clone().sub(s).normalize(),pole=e.clone().sub(s);pole.addScaledVector(reach,-pole.dot(reach)).normalize();
   const back=new THREE.Vector3(0,0,-1);back.addScaledVector(reach,-back.dot(reach)).normalize();
   records.push({mode,side,frame:i,s:s.toArray(),e:e.toArray(),w:w.toArray(),signedFlex:authored.dot(flex),posteriorPole:pole.dot(back),flexLength});
  }
 }
}
const summary=Object.fromEntries(['emptyhand','carry','ads'].map(mode=>[mode,Object.fromEntries(['R','L'].map(side=>{const r=records.filter(x=>x.mode===mode&&x.side===side);return[side,{minSignedFlex:Math.min(...r.map(x=>x.signedFlex)),maxSignedFlex:Math.max(...r.map(x=>x.signedFlex)),minPosteriorPole:Math.min(...r.map(x=>x.posteriorPole)),minFlexLength:Math.min(...r.map(x=>x.flexLength))}]}))]));
await writeFile(process.argv[2],JSON.stringify({basisEvidence:'assets/characters/player_v2/README.md: glTF front -Z; runtime pi-Y gives +Z. Upper-arm frontal/biceps surface defines positive anatomical flexion. Mirrored sides share anterior, not local Euler sign.',summary,records},null,2));console.log(JSON.stringify(summary,null,2));f.dispose();
