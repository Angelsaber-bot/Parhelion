/** Production GLB/bones, planar root displacement. Not terrain/browser contact validation. */
import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const source=resolve(process.argv[3] ?? '..');
const { playerFixture } = await import(pathToFileURL(`${source}/world/validation/player-fixture.ts`).href);
const { SkinnedCharacterAnimator } = await import(pathToFileURL(`${source}/world/src/skinnedCharacter.ts`).href);
const out = process.argv[2];
const results = [];
for (const hz of [30, 60, 120]) for (const speed of [2, 5.5, 9]) {
  const f = await playerFixture(), a = new SkinnedCharacterAnimator(f.rig);
  a.reset(false); const state = { speed, onGround:true, swimming:false, vy:0, moveYaw:0, armed:false };
  for(let i=0;i<hz*2;i++){ f.rig.root.position.z += speed/hz; a.update(1/hz,state); }
  const feet = ['L','R'].map(s=>f.rig.joints[`Foot_${s}`]);
  let prev = feet.map(b=>b.getWorldPosition(new THREE.Vector3())), minFoot=Infinity, maxFoot=-Infinity, minToe=Infinity;
  let contactSamples=0,maxContactSpeed=0;
  let velocities:number[]=[], lowFootVelocities:number[]=[], samples:{height:number;velocity:number}[]=[];
  for(let i=0;i<hz*3;i++){
    f.rig.root.position.z += speed/hz; a.update(1/hz,state);
    feet.forEach((b,j)=>{
      const p=b.getWorldPosition(new THREE.Vector3()), v=p.distanceTo(prev[j])*hz;
      const restY=f.rig.rest.get(b)!.rootP.y;
      if(Math.abs(p.y-restY)<1e-8&&Math.abs(prev[j].y-restY)<1e-8){contactSamples++;maxContactSpeed=Math.max(maxContactSpeed,v);}
      const toe=f.rig.joints[`Toe_${j?'R':'L'}`].getWorldPosition(new THREE.Vector3());
      minFoot=Math.min(minFoot,p.y); maxFoot=Math.max(maxFoot,p.y);minToe=Math.min(minToe,toe.y);
      velocities.push(v);samples.push({height:p.y,velocity:v});prev[j]=p;
    });
  }
  lowFootVelocities=samples.filter(s=>s.height<minFoot+.01).map(s=>s.velocity);
  results.push({ hz,speed,contactSamples,maxContactSpeed:contactSamples?maxContactSpeed:null,minFoot,maxFoot,minToe, lowFootSamples:lowFootVelocities.length,
    lowFootMeanSpeed:lowFootVelocities.reduce((a,b)=>a+b,0)/lowFootVelocities.length,
    lowFootMaxSpeed:Math.max(...lowFootVelocities), maxFootSpeed:Math.max(...velocities) });
  f.dispose();
}
const text=JSON.stringify({ description:'Actual runtime rig, constant-speed flat translation; contact requires adjacent samples at bind-support height within 1e-8m. lowFoot is ankle within 1 cm of its observed minimum (includes lift-off/landing). Bone metrics are not terrain validation.', results },null,2);
if(out)await writeFile(out,text+'\n'); console.log(text);
