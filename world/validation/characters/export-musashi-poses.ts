/** Actual Three.js CPU-skinned actor snapshots. Offline material rendering is NOT WebGL QA. */
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readCharacter } from './inspect.ts';
import { CharacterKit } from '../../src/characters/characterKit.ts';
import { CHARACTER_KITS } from '../../src/characters/catalog.ts';
const out=process.argv[2]??'/tmp/parhelion-musashi-poses';await mkdir(out,{recursive:true});
const baseline=process.argv.includes('--baseline'),definition=CHARACTER_KITS.musashi,asset=fileURLToPath(new URL(definition.assetUrl));
const frames:readonly (readonly [string,number])[]=process.argv.includes('--walk-cycle') ? Array.from({length:16},(_,i)=>['walk',definition.clips.walk.duration*i/16]as const) : [['idle',.75],['walk',4/30],['walk',12/30],['run',5/30],['attack',19/30],['attack',33/30]];
for(const [state,time] of frames){
  const {gltf}=await readCharacter(asset),actor=new CharacterKit(gltf,baseline?{...definition,id:'musashi-authored'}:definition,{transitionSeconds:0});actor.play(state);actor.mixer.update(0);
  for(let t=0;t<time-1e-8;){const step=Math.min(.05,time-t);actor.update(step);t+=step;}
  const id=`musashi-${baseline?'before':'after'}-${state}-${Math.round(time*30)}`,meshes:any[]=[];actor.root.updateWorldMatrix(true,true);const point=new THREE.Vector3();
  actor.root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh||!mesh.visible)return;
    if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
    const count=mesh.geometry.attributes.position.count,positions=new Float32Array(count*3),uvs=new Float32Array(count*2),colors=new Float32Array(count*4);
    for(let i=0;i<count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);positions.set(point.toArray(),i*3);const uv=mesh.geometry.attributes.uv;if(uv){uvs[i*2]=uv.getX(i);uvs[i*2+1]=uv.getY(i);}const color=mesh.geometry.attributes.color;colors.set(color?[color.getX(i),color.getY(i),color.getZ(i),color.itemSize===4?color.getW(i):1]:[1,1,1,1],i*4);}
    const index=mesh.geometry.index,indices=new Uint32Array(index?Array.from(index.array):Array.from({length:count},(_,i)=>i));
    const file=`${id}-${meshes.length}.bin`,data=Buffer.concat([Buffer.from(positions.buffer),Buffer.from(uvs.buffer),Buffer.from(colors.buffer),Buffer.from(indices.buffer)]);
    meshes.push({name:mesh.name,file,count,indices:indices.length,groups:mesh.geometry.groups,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.name),data});
  });
  for(const mesh of meshes){await writeFile(path.join(out,mesh.file),mesh.data);delete mesh.data;}
  await writeFile(path.join(out,`${id}.json`),JSON.stringify({id,label:`Musashi ${baseline?'authored baseline':'relaxed runtime'} ${state} @ ${time.toFixed(3)}s`,...(process.argv.includes('--walk-cycle')?{framing:{center:[0,.9,-.2],size:1.95}}:{}),asset:asset.replace(/\.gz$/,''),meshes}));actor.dispose();
}
console.log(`Actual Musashi CPU-skinned snapshots: ${out}`);
