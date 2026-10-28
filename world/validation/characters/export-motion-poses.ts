/** CPU skin the actual runtime actors for offline still QA; not a browser/WebGL test. */
import * as THREE from 'three';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MeshBVH } from 'three-mesh-bvh';
import { readCharacter } from './inspect.ts';
import { ContractServant, SERVANT_MODELS } from '../../src/servant.ts';
import { FirstContract } from '../../src/contracts.ts';
import { ServantAppearance } from '../../src/servantAppearance.ts';
import { CharacterKit } from '../../src/characters/characterKit.ts';
import { CHARACTER_KITS } from '../../src/characters/catalog.ts';
const out=process.argv[2]??'/tmp/parhelion-motion-poses';await mkdir(out,{recursive:true});
async function dump(root:THREE.Object3D,id:string,asset:string,label:string){
  root.updateWorldMatrix(true,true);const meshes:any[]=[];const point=new THREE.Vector3();
  root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh||!mesh.visible)return;
    if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
    const count=mesh.geometry.attributes.position.count,positions=new Float32Array(count*3),uvs=new Float32Array(count*2),colors=new Float32Array(count*4);
    for(let i=0;i<count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);positions.set(point.toArray(),i*3);const uv=mesh.geometry.attributes.uv;if(uv){uvs[i*2]=uv.getX(i);uvs[i*2+1]=uv.getY(i);}const color=mesh.geometry.attributes.color;colors.set(color?[color.getX(i),color.getY(i),color.getZ(i),color.itemSize===4?color.getW(i):1]:[1,1,1,1],i*4);}
    const index=mesh.geometry.index,indices=new Uint32Array(index?Array.from(index.array):Array.from({length:count},(_,i)=>i));
    const data=Buffer.concat([Buffer.from(positions.buffer),Buffer.from(uvs.buffer),Buffer.from(colors.buffer),Buffer.from(indices.buffer)]);
    const file=`${id}-${meshes.length}.bin`;meshes.push({name:mesh.name,file,count,indices:indices.length,groups:mesh.geometry.groups,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.name),data});
  });
  for(const mesh of meshes){await writeFile(path.join(out,mesh.file),mesh.data);delete mesh.data;}
  await writeFile(path.join(out,`${id}.json`),JSON.stringify({id,label,asset:asset.replace(/\.gz$/,''),meshes}));
}
for(const outfit of ['armor','civilian']as const){
  const asset=fileURLToPath(new URL(SERVANT_MODELS[outfit])),{gltf}=await readCharacter(asset),appearance=new ServantAppearance();appearance.select(outfit);let enemy=false;
  const servant=new ContractServant({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,
    colliders:[{name:'floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2))}],load:async()=>gltf,target:()=>enemy?{id:'enemy',position:new THREE.Vector3(0,0,2)}:null,strike:()=>null});
  await servant.ensureLoaded();const player=new THREE.Vector3();for(let i=0;i<20;i++)servant.update(.05,player,0,true,false);
  servant.root.position.set(0,0,0);servant.root.rotation.y=0;await dump(servant.root,`${outfit}-idle`,asset,`Artoria ${outfit}: accepted relaxed idle`);
  // Actual follow path produces the relaxed Walk mix; root orientation is normalized only for the still.
  for(let i=0;i<100;i++){player.x+=.05;servant.update(.05,player,0,true,false);}
  servant.root.position.set(0,0,0);servant.root.rotation.y=0;
  // Update world-targeted arm relaxation at the normalized angle without advancing the clock.
  (servant as any).tick(0);await dump(servant.root,`${outfit}-walk`,asset,`Artoria ${outfit}: runtime relaxed walk`);
  enemy=true;for(let i=0;i<15;i++)servant.update(.05,player,0,true,false);
  servant.root.position.set(0,0,0);servant.root.rotation.y=0;await dump(servant.root,`${outfit}-attack`,asset,`Artoria ${outfit}: authored attack preserved`);servant.dispose();
}
{
  const definition=CHARACTER_KITS.napoleonMounted,asset=fileURLToPath(new URL(definition.assetUrl));
  for(const [id,time]of [['raise',.25],['contact',23/30],['brake',1.25]]as const){
    const {gltf}=await readCharacter(asset),actor=new CharacterKit(gltf,definition,{transitionSeconds:0});actor.play('attack');
    for(let t=0;t<time-1e-8;){const step=Math.min(.05,time-t);actor.update(step);t+=step;}
    await dump(actor.root,`napoleon-${id}`,asset,`Napoleon: runtime mounted charge ${id} @ ${time.toFixed(3)}s`);actor.dispose();
  }
}
console.log(`Actual CPU-skinned runtime pose exports: ${out}`);
