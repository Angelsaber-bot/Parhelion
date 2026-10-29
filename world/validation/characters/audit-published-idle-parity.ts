/** Independent parity audit against an actual published checkout supplied on the CLI. */
import * as THREE from 'three';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {readCharacter} from './inspect.ts';
import {ContractServant,SERVANT_MODELS} from '../../src/servant.ts';
import {FirstContract} from '../../src/contracts.ts';
import {ServantAppearance} from '../../src/servantAppearance.ts';
const baseline=resolve(process.argv[2]);const out=resolve(process.argv[3]);
const Original=(await import(pathToFileURL(`${baseline}/world/src/servant.ts`).href)).ContractServant;
const result:any={baseline,description:'Independent direct runtime comparison, not stored fixture comparison',outfits:{}};
for(const outfit of ['armor','civilian']as const){
 async function make(C:any){const {gltf}=await readCharacter(fileURLToPath(new URL(SERVANT_MODELS[outfit])));const appearance=new ServantAppearance();appearance.select(outfit);const actor=new C({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,colliders:[],load:async()=>gltf,target:()=>null,strike:()=>null});await actor.ensureLoaded();return {actor,gltf};}
 const old=await make(Original),fresh=await make(ContractServant);let maxAngle=0,maxPosition=0,samples=0;
 for(const state of ['idle','walk']){
  fresh.actor.play(state);fresh.actor.tick(.25);
  for(let i=0;i<73;i++){
   const t=(i*.13719)%2.4;old.actor.clips.get('idle').time=t;old.actor.tick(0);
   fresh.actor.idleCarry.action.time=t;fresh.actor.clips.get(state).time=(i*.06113)%fresh.actor.clips.get(state).getClip().duration;fresh.actor.tick(0);
   const spine=old.gltf.scene.getObjectByName('mixamorigSpine')!;
   spine.traverse(b=>{const n=fresh.gltf.scene.getObjectByName(b.name)!;if(!n)return;const angle=b.quaternion.clone().normalize().angleTo(n.quaternion.clone().normalize());const position=b.position.distanceTo(n.position);maxAngle=Math.max(maxAngle,angle);maxPosition=Math.max(maxPosition,position);samples++;assert.ok(angle<.00001,`${state}/${outfit}/${b.name} ${angle}`);assert.ok(position<1e-8);});
  }
 }
 result.outfits[outfit]={samples,maxLocalAngleRadians:maxAngle,maxLocalPositionMeters:maxPosition};old.actor.dispose();fresh.actor.dispose();
}
await writeFile(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
