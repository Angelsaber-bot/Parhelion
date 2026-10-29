/** Match the existing rapid movement/ADS regression schedule on either actual runtime rig. */
import * as THREE from 'three';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const source=resolve(process.argv[2]??'..'),out=process.argv[3];
const {playerFixture}=await import(pathToFileURL(`${source}/world/validation/player-fixture.ts`).href);
const {SkinnedCharacterAnimator}=await import(pathToFileURL(`${source}/world/src/skinnedCharacter.ts`).href);
const {ShoulderAim}=await import(pathToFileURL(`${source}/world/src/aim.ts`).href);
const rows=[];
for(const hz of [30,60,120]){
 const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig),aim=new ShoulderAim();
 const base={speed:0,onGround:true,swimming:false,vy:0,moveYaw:0};a.update(0,base);
 const hands=()=>['L','R'].map(s=>f.rig.handSockets[s].getWorldPosition(new THREE.Vector3()));
 let prev=hands(),maxHandTravel=0;
 for(let cycle=0;cycle<10;cycle++){
  aim.held=cycle%2===0;
  for(let i=0;i<Math.ceil(hz*.15);i++){
   a.update(1/hz,{...base,speed:cycle%3===0?0:9,aim:aim.step(1/hz,true),pitch:.3});
   const next=hands();maxHandTravel=Math.max(maxHandTravel,...next.map((p,j)=>p.distanceTo(prev[j])));prev=next;
  }
 }
 rows.push({hz,maxHandTravel,maxHandSpeed:maxHandTravel*hz});f.dispose();
}
const result={source,description:'Actual production rapid movement/ADS fixture, same inputs. Intentional zero-dt first-shot alignment excluded and separately tested.',rows};
if(out)await writeFile(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
