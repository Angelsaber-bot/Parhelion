/** Independent actual Musashi rig arm measurements; not a visual or FPS claim. */
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const source=resolve(process.argv[2]??'..'),out=resolve(process.argv[3]??'../docs/character-motion-20261028'),label=process.argv[4]??'after';
const {readCharacter}=await import(pathToFileURL(`${source}/world/validation/characters/inspect.ts`).href);
const {CharacterKit}=await import(pathToFileURL(`${source}/world/src/characters/characterKit.ts`).href);
const {CHARACTER_KITS}=await import(pathToFileURL(`${source}/world/src/characters/catalog.ts`).href);
const definition=CHARACTER_KITS.musashi,asset=fileURLToPath(new URL(definition.assetUrl));
const result:any={label,source,scope:'Actual runtime bone/world samples, not rendered appearance, browser or FPS evidence',states:{}};
const range=(v:number[])=>Math.max(...v)-Math.min(...v);
for(const state of ['idle','walk','run']) {
 const {gltf}=await readCharacter(asset),actor=new CharacterKit(gltf,definition,{transitionSeconds:0});actor.play(state);actor.mixer.update(0);
 const rows:any[]=[];
 for(let i=0;i<=120;i++) {
  actor.root.updateWorldMatrix(true,true);
  const row:any={t:definition.clips[state].duration*i/120};
  for(const side of ['Left','Right']) {
   const bone=(name:string)=>actor.model.getObjectByName(`mixamorig${side}${name}`),point=(name:string)=>bone(name).getWorldPosition(new THREE.Vector3());
   const shoulder=point('Arm'),elbow=point('ForeArm'),hand=point('Hand'),upper=elbow.clone().sub(shoulder).normalize(),lower=hand.clone().sub(elbow).normalize();
   row[side]={hand:hand.toArray(),upperPitch:Math.atan2(upper.z,-upper.y),elbowBend:upper.angleTo(lower),handBelowShoulder:shoulder.y-hand.y,handRotation:bone('Hand').getWorldQuaternion(new THREE.Quaternion()).toArray()};
  }
  rows.push(row);actor.update(definition.clips[state].duration/120);
 }
 result.states[state]={samples:rows,summary:Object.fromEntries(['Left','Right'].map(side=>[side,{handForeAftRange:range(rows.map(r=>r[side].hand[2])),upperPitchRange:range(rows.map(r=>r[side].upperPitch)),elbowBendRange:range(rows.map(r=>r[side].elbowBend)),minElbowBend:Math.min(...rows.map(r=>r[side].elbowBend)),maxElbowBend:Math.max(...rows.map(r=>r[side].elbowBend)),minHandBelowShoulder:Math.min(...rows.map(r=>r[side].handBelowShoulder))}]))};actor.dispose();
}
await mkdir(out,{recursive:true});await writeFile(`${out}/musashi-${label}-arm-metrics.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(Object.fromEntries(Object.entries(result.states).map(([s,r]:any)=>[s,r.summary])),null,2));
