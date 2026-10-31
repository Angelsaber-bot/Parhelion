/** CPU-skinned runtime temporal evidence. Offline geometry, not WebGL/FPS evidence. */
import * as THREE from 'three';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { playerFixture } from '../player-fixture.ts';
import { SkinnedCharacterAnimator } from '../../src/skinnedCharacter.ts';
const out=process.argv[2];if(!out)throw new Error('Pass a workspace output directory');await mkdir(out,{recursive:true});
const {rig,dispose}=await playerFixture();const baseline=process.argv.find(arg=>arg.startsWith('--baseline-module='))?.slice('--baseline-module='.length);
const RuntimeAnimator=baseline?(await import(pathToFileURL(path.resolve(baseline)).href)).SkinnedCharacterAnimator:SkinnedCharacterAnimator;
const runtimeSource=baseline?path.resolve(baseline):fileURLToPath(new URL('../../src/skinnedCharacter.ts',import.meta.url));
const runtimeSha256=createHash('sha256').update(await readFile(runtimeSource)).digest('hex');
const animator=new RuntimeAnimator(rig);animator.reset(false);
const state={speed:0,onGround:true,swimming:false,vy:0,moveYaw:0,armed:false};
for(let i=0;i<60;i++)animator.update(1/60,state);
async function dump(id:string,label:string){
 rig.root.updateWorldMatrix(true,true);rig.skeletons.forEach(s=>s.update());const meshes:object[]=[];
 for(const mesh of rig.meshes){
  if(!(mesh as THREE.SkinnedMesh).isSkinnedMesh||!mesh.visible)continue;
  const count=mesh.geometry.attributes.position.count,p=new Float32Array(count*3),uv=new Float32Array(count*2),color=new Float32Array(count*4),v=new THREE.Vector3();
  for(let i=0;i<count;i++){
   mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);p.set(v.toArray(),i*3);
   const a=mesh.geometry.attributes.uv;if(a){uv[i*2]=a.getX(i);uv[i*2+1]=a.getY(i);}
   const c=mesh.geometry.attributes.color;color.set(c?[c.getX(i),c.getY(i),c.getZ(i),c.itemSize===4?c.getW(i):1]:[1,1,1,1],i*4);
  }
  const index=mesh.geometry.index,indices=new Uint32Array(index?Array.from(index.array):Array.from({length:count},(_,i)=>i));
  const file=`${id}-${meshes.length}.bin`;
  await writeFile(path.join(out,file),Buffer.concat([Buffer.from(p.buffer),Buffer.from(uv.buffer),Buffer.from(color.buffer),Buffer.from(indices.buffer)]));
  meshes.push({name:mesh.name,file,count,indices:indices.length,groups:mesh.geometry.groups,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.name)});
 }
 const manifest={id,label,mode:baseline?'baseline':'current',runtimeSha256,limitations:['Actual runtime CPU skinning; offline Cycles, not WebGL or GPU FPS','Test root follows a ballistic path; this is not the game camera/controller'],asset:fileURLToPath(new URL('../../../assets/characters/player_v2/player_v2.glb',import.meta.url)),framing:{center:[0,1.65,0],size:3.3},meshes};
 await writeFile(path.join(out,id+'.json'),JSON.stringify(manifest));
 await writeFile(path.join(out,id+'-side.json'),JSON.stringify({...manifest,id:id+'-side',view:'side'}));
 if([4,8,13,15,17].includes(Number(id.slice(-3))))for(const view of ['front','side'])await writeFile(path.join(out,id+'-close-'+view+'.json'),JSON.stringify({...manifest,id:id+'-close-'+view,view,framing:{center:[0,rig.root.position.y+1.05,0],size:2.05}}));
}
// 24 evenly-spaced snapshots: real root follows a simple ballistic test path; the
// animator owns only bones. Fixed camera framing permits comparing temporal silhouettes.
for(let frame=0;frame<24;frame++){
 const time=frame/15;
 for(let sub=0;sub<4;sub++){
  const t=Math.max(0,time-(3-sub)/60),flight=t>.12&&t<.98,age=Math.max(0,t-.12);
  rig.root.position.y=flight?Math.max(0,6*age-7*age*age):0;
  animator.update(1/60,{...state,onGround:!flight,vy:flight?6-14*age:0});
 }
 await dump(`player-landing-${String(frame).padStart(3,'0')}`,`CPU runtime jump/landing ${time.toFixed(3)}s`);
}
dispose();console.log('CPU runtime sequence exported',out);
