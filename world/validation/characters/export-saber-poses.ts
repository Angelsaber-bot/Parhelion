/** CPU-skin the actual ContractServant; offline material review, not a WebGL capture. */
import * as THREE from 'three';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readCharacter} from './inspect.ts';
import {ContractServant,SERVANT_MODELS} from '../../src/servant.ts';
import {FirstContract} from '../../src/contracts.ts';
import {ServantAppearance} from '../../src/servantAppearance.ts';
const out=process.argv[2]??'/tmp/saber-review',label=process.argv[3]??'after',state=process.argv.includes('--idle')?'idle':'walk';
const selected=process.argv.find(arg=>arg.startsWith('--frames='))?.slice(9).split(',').map(Number);
await mkdir(out,{recursive:true});const summaries:any={};
for(const outfit of (process.argv.includes('--armor-only')?['armor']:['armor','civilian']) as ('armor'|'civilian')[]){
 const asset=fileURLToPath(new URL(SERVANT_MODELS[outfit])),{gltf}=await readCharacter(asset),appearance=new ServantAppearance();appearance.select(outfit);
 const actor=new ContractServant({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,colliders:[],load:async()=>gltf,target:()=>null,strike:()=>null});
 await actor.ensureLoaded();actor.root.position.set(0,0,0);actor.root.rotation.set(0,0,0);
 const internal=actor as any;internal.play(state);internal.tick(.25);const action=internal.clips.get(state) as THREE.AnimationAction;
 action.time=0;if(internal.idleCarry?.action)internal.idleCarry.action.time=0;internal.tick(0);const rows:any[]=[];
 const point=new THREE.Vector3();const bone=(name:string)=>gltf.scene.getObjectByName(`mixamorig${name}`)!;
 function pos(name:string){return bone(name).getWorldPosition(new THREE.Vector3());}
 for(let frame=0;frame<=120;frame++){
  if(frame)internal.tick(action.getClip().duration/120);
  actor.root.updateWorldMatrix(true,true);const row:any={phase:frame/120,hip:pos('Hips').toArray()};
  for(const side of ['Left','Right']){const shoulder=pos(`${side}Arm`),elbow=pos(`${side}ForeArm`),hand=pos(`${side}Hand`),upper=elbow.clone().sub(shoulder).normalize(),lower=hand.clone().sub(elbow).normalize();
   row[side]={hand:hand.toArray(),shoulderPitch:Math.atan2(upper.z,-upper.y),shoulderAbduction:Math.atan2(Math.abs(upper.x),-upper.y),elbowBend:upper.angleTo(lower),handBelowShoulder:shoulder.y-hand.y,foot:pos(`${side}Foot`).toArray(),knee:pos(`${side}Leg`).toArray(),thighPitch:Math.atan2(pos(`${side}Leg`).sub(pos(`${side}UpLeg`)).z,-pos(`${side}Leg`).sub(pos(`${side}UpLeg`)).y)};
  }
  rows.push(row);if(frame===120||(selected?!selected.includes(frame):frame%10!==0))continue;
  const id=`saber-${label}-${outfit}-${selected?`phase-${frame}`:String(frame/10).padStart(2,'0')}`,meshes:any[]=[];const bounds:any={};
  gltf.scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh||!mesh.visible)return;
   if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
   const count=mesh.geometry.attributes.position.count,positions=new Float32Array(count*3),uvs=new Float32Array(count*2),colors=new Float32Array(count*4),box=new THREE.Box3();
   for(let i=0;i<count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);positions.set(point.toArray(),i*3);box.expandByPoint(point);const uv=mesh.geometry.attributes.uv;if(uv){uvs[i*2]=uv.getX(i);uvs[i*2+1]=uv.getY(i);}const c=mesh.geometry.attributes.color;colors.set(c?[c.getX(i),c.getY(i),c.getZ(i),c.itemSize===4?c.getW(i):1]:[1,1,1,1],i*4);}
   bounds[mesh.name]={min:box.min.toArray(),max:box.max.toArray()};const index=mesh.geometry.index,indices=new Uint32Array(index?Array.from(index.array):Array.from({length:count},(_,i)=>i));
   const file=`${id}-${meshes.length}.bin`,data=Buffer.concat([Buffer.from(positions.buffer),Buffer.from(uvs.buffer),Buffer.from(colors.buffer),Buffer.from(indices.buffer)]);
   meshes.push({name:mesh.name,file,count,indices:indices.length,groups:mesh.geometry.groups,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.name),data});
  });
  for(const mesh of meshes){await writeFile(path.join(out,mesh.file),mesh.data);delete mesh.data;}
  row.bounds=bounds;await writeFile(path.join(out,`${id}.json`),JSON.stringify({id,phase:frame/120,label:`Saber ${outfit} ${label} runtime / phase ${frame/120}`,framing:{center:[0,.95,0],size:2.2},asset:asset.replace(/\.gz$/,''),meshes}));
 }
 const range=(values:number[])=>Math.max(...values)-Math.min(...values);
 summaries[outfit]={state,duration:action.getClip().duration,hipVerticalRange:range(rows.map(r=>r.hip[1])),sides:Object.fromEntries(['Left','Right'].map(side=>[side,{handForeAftRange:range(rows.map(r=>r[side].hand[2])),shoulderPitchRange:range(rows.map(r=>r[side].shoulderPitch)),maxAbduction:Math.max(...rows.map(r=>r[side].shoulderAbduction)),elbowBendRange:range(rows.map(r=>r[side].elbowBend)),minElbowBend:Math.min(...rows.map(r=>r[side].elbowBend)),maxElbowBend:Math.max(...rows.map(r=>r[side].elbowBend)),footForeAftRange:range(rows.map(r=>r[side].foot[2]))}])),samples:rows};
 actor.dispose();console.log(outfit,JSON.stringify({...summaries[outfit],samples:undefined}));
}
await writeFile(path.join(out,`metrics-${label}.json`),JSON.stringify(summaries,null,2));
