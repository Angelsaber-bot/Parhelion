/** Component diagnostic of live Q entry, not a gameplay damage proof. */
import * as THREE from 'three';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { CharacterKit } from '../../src/characters/characterKit';
import { CHARACTER_KITS } from '../../src/characters/catalog';
import { KitCompanion } from '../../src/kitCompanion';
import { installSkillEntryVisualCandidate } from './skill-entry-visual-candidate';
import { readCharacter } from '../characters/inspect';
const out=process.argv[2];if(!out)throw new Error('output path required');
const loaded=await readCharacter(fileURLToPath(new URL(CHARACTER_KITS.musashi.assetUrl)));
let follower:KitCompanion|undefined;const actor=new CharacterKit(loaded.gltf,CHARACTER_KITS.musashi,{onEvent:e=>follower?.onEvent(actor,e)});
const names=['mixamorigLeftFoot','mixamorigRightFoot','Attachment_RightHand_Katana','Attachment_LeftHand_Katana'];
const sample=()=>{actor.root.updateWorldMatrix(true,true);return names.map(n=>actor.model.getObjectByName(n)!.getWorldPosition(new THREE.Vector3()));};
let realDt=1/60;const candidate=process.argv.includes('--candidate');if(candidate)installSkillEntryVisualCandidate(actor,()=>realDt);
const rows=[];
for(const hz of [30,60,120])for(const state of ['idle','walk','run','attack'] as const)for(const warm of [.23,.45,.75])for(const rate of [1,2,3]){
 realDt=1/hz;follower?.release(actor);actor.play(state,{restart:true,rate});for(let t=0;t<warm-1e-8;t+=1/hz)actor.update(Math.min(1/hz,warm-t));
 const prior=actor.state,priorTime=actor.clipTime;let previous=sample();const contacts:{time:number;position:number[];direction:number[]}[]=[],steps=[];let time=0;
 follower=new KitCompanion({colliders:[],range:3,damage:1,target:()=>null,strike:()=>null});
 const admitted=follower.startSkillPose(actor,{direction:{x:0,y:0,z:1},slot:'skill',contacts:2,onContact:(p,d)=>contacts.push({time,position:[p.x,p.y,p.z],direction:[d.x,d.y,d.z]}),onFinish:()=>{}},actor.root.position.clone(),0);
 for(let i=0;i<hz;i++){
  time=(i+1)/hz;follower.update(actor,1/hz,actor.root.position.clone(),0,false);const current=sample();
  steps.push({time,state:actor.state,clipTime:actor.clipTime,speeds:current.map((p,j)=>p.distanceTo(previous[j])*hz)});previous=current;
 }
 rows.push({hz,requestedState:state,prior,priorTime,warm,rate,admitted,contacts,first100ms:steps.filter(s=>s.time<=.1),maxFootSpeed:Math.max(...steps.flatMap(s=>s.speeds.slice(0,2)))});
}
actor.dispose();await writeFile(out,JSON.stringify({candidate,scope:'Native component Q entry; fixed root/no collisions; speeds m/s, not sole contacts',names,rows},null,2),{flag:'wx'});
