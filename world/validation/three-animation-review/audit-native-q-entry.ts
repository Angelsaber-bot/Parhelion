import * as THREE from 'three';import {writeFile}from'node:fs/promises';import{resolve}from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';
const world=resolve(process.argv[2]),output=resolve(process.argv[3]);const imp=(p:string)=>import(pathToFileURL(resolve(world,p)).href);
const{CharacterKit}=await imp('src/characters/characterKit.ts'),{CHARACTER_KITS}=await imp('src/characters/catalog.ts'),{KitCompanion}=await imp('src/kitCompanion.ts'),{readCharacter}=await imp('validation/characters/inspect.ts');const rows:any[]=[];
for(const hz of [30,60,120])for(const from of ['idle','walk','run','attack']){
 const def=CHARACTER_KITS.musashi,{gltf}=await readCharacter(fileURLToPath(new URL(def.assetUrl)));let time=0,ended=false;const hits:any[]=[];
 const follow=new KitCompanion({colliders:[],range:4.5,damage:16,target:()=>null,strike:()=>null});const actor=new CharacterKit(gltf,def,{onEvent:(event:any)=>follow.onEvent(actor,event)});const dt=1/hz;
 actor.play(from,{restart:true});for(let i=0;i<Math.round(.45*hz);i++)actor.update(dt);
 const names=['mixamorigLeftFoot','mixamorigRightFoot','mixamorigLeftHand','mixamorigRightHand'];
 const sample=()=>{actor.root.updateWorldMatrix(true,true);return names.map(name=>actor.root.worldToLocal(actor.model.getObjectByName(name).getWorldPosition(new THREE.Vector3())).toArray());};
 let prev=sample();const frames:any[]=[];const admitted=follow.startSkillPose(actor,{slot:'skill',direction:{x:0,y:0,z:1},contacts:2,onContact:(_:any,__:any,socket:string)=>hits.push({time,socket}),onFinish:(success:boolean)=>{ended=true;hits.push({time,finished:success});}},new THREE.Vector3(),0);
 for(let f=0;f<hz*3&&!ended;f++){time+=dt;follow.update(actor,dt,new THREE.Vector3(),0,false);const now=sample();const speeds=now.map((p:number[],i:number)=>Math.hypot(...p.map((v,j)=>v-prev[i][j]))/dt);frames.push({time,state:actor.state,clipTime:actor.clipTime,speeds,weights:[...(actor as any).actions.entries()].map(([state,a]:any)=>({state,time:a.time,weight:a.getEffectiveWeight()}))});prev=now;}
 rows.push({hz,from,admitted,hits,names,frames,maxByNode:names.map((name,i)=>({name,...frames.reduce((a,b)=>b.speeds[i]>a.speeds[i]?b:a)}))});actor.dispose();
}
await writeFile(output,JSON.stringify({scope:'Native Musashi Q entry from explicit component states; no HP/movement proof. Read-only ActionBlend weights expose clip-clock fade. Actual input evidence is separate.',world,rows},null,2),{flag:'wx'});console.log('complete',rows.length);
