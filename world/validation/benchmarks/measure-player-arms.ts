/** Same imported production skeleton in both versions; sampled free-arm/leg correlation. */
import * as THREE from 'three';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const source = resolve(process.argv[2] ?? '..'), output = process.argv[3];
const { playerFixture } = await import(pathToFileURL(`${source}/world/validation/player-fixture.ts`).href);
const { SkinnedCharacterAnimator } = await import(pathToFileURL(`${source}/world/src/skinnedCharacter.ts`).href);
const rows:any[] = [];
const range=(xs:number[])=>Math.max(...xs)-Math.min(...xs);
const correlation=(xs:number[],ys:number[])=>{const x=xs.reduce((a,b)=>a+b,0)/xs.length,y=ys.reduce((a,b)=>a+b,0)/ys.length;
return xs.reduce((n,v,i)=>n+(v-x)*(ys[i]-y),0)/Math.sqrt(xs.reduce((n,v)=>n+(v-x)**2,0)*ys.reduce((n,v)=>n+(v-y)**2,0));};
for(const armed of [false,true])for(const speed of [5.5,9]){
 const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);a.reset(armed);
 const state={speed,onGround:true,swimming:false,vy:0,moveYaw:0,armed};
 for(let i=0;i<120;i++)a.update(1/60,state);
 for(const side of (armed?['L']:['L','R'])){
  const handZ:number[]=[],footZ:number[]=[],flex:number[]=[],palms:THREE.Quaternion[]=[];
  for(let i=0;i<180;i++){
   a.update(1/60,state);
   const shoulder=f.rig.joints[`Arm_${side}`].getWorldPosition(new THREE.Vector3()),elbow=f.rig.joints[`Forearm_${side}`].getWorldPosition(new THREE.Vector3()),hand=f.rig.joints[`Hand_${side}`].getWorldPosition(new THREE.Vector3());
   flex.push((Math.PI-shoulder.sub(elbow).angleTo(hand.clone().sub(elbow)))*180/Math.PI);
   handZ.push(f.rig.handSockets[side].getWorldPosition(new THREE.Vector3()).z);
   footZ.push(f.rig.joints[`Foot_${side}`].getWorldPosition(new THREE.Vector3()).z);
   palms.push(f.rig.handSockets[side].getWorldQuaternion(new THREE.Quaternion()));
  }
  let palmRange=0;for(const x of palms)for(const y of palms)palmRange=Math.max(palmRange,x.angleTo(y));
  rows.push({armed,speed,side,handForeAftRange:range(handZ),sameSideHandFootCorrelation:correlation(handZ,footZ),elbowMinDegrees:Math.min(...flex),elbowMaxDegrees:Math.max(...flex),palmOrientationRangeDegrees:palmRange*180/Math.PI});
 }
 f.dispose();
}
const result={description:'Actual production 60 Hz rig; 2 second settle, 3 second cycles. Negative same-side hand-foot correlation indicates contralateral arm swing. Angular metrics alone are not a visual quality claim.',source,rows};
if(output)await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
