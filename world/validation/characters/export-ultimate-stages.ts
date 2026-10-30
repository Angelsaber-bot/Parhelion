/** Actual UltimateStage scene CPU export. Offline QA, not browser/GPU evidence. */
import * as THREE from 'three';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readCharacter} from './inspect.ts';
import {SERVANT_MODELS} from '../../src/servant.ts';
import {CHARACTER_KITS} from '../../src/characters/catalog.ts';
import {CharacterKit} from '../../src/characters/characterKit.ts';
import {UltimateStage} from '../../src/ultimateStage.ts';
const out=process.argv[2]??'/tmp/ultimate-stages';await mkdir(out,{recursive:true});
const sourceHashes:Record<string,string>={};
for(const file of ['../../src/ultimateStage.ts','../../src/ultimateEnergy.ts','../../tools/gen/blacksail/ships.ts','./export-ultimate-stages.ts','./render-ultimate-stages.py'])sourceHashes[file]=createHash('sha256').update(await readFile(new URL(file,import.meta.url))).digest('hex');
for(const identity of ['saber','blackbeard','napoleon','musashi'] as const){
 const definition=identity==='saber'?null:CHARACTER_KITS[identity==='napoleon'?'napoleonMounted':identity];
 const asset=fileURLToPath(new URL(definition?.assetUrl??SERVANT_MODELS.armor));
 for(const phase of ['intro','release'] as const){
  const {gltf}=await readCharacter(asset);let root:THREE.Object3D=gltf.scene;
  const kit=definition?new CharacterKit(gltf,definition,{transitionSeconds:0}):null;
  if(kit)root=kit.root;
  const stage=new UltimateStage();stage.begin({identity,sourceRoot:root,clips:gltf.animations});
  if(phase==='release'){
   // Real temporal phase history: complete intro + charge, then advance the source
   // alongside release. Do not capture the first frame of the 140ms visual blend.
   for(let t=.05;t<=.65+1e-8;t+=.05)stage.update({elapsed:t,phase:'intro',progress:t/.65,pulse:0,sourceRoot:root});
   for(let t=.05;t<=1.9+1e-8;t+=.05)stage.update({elapsed:.65+t,phase:'charge',progress:t/1.9,pulse:0,sourceRoot:root});
   const time=identity==='blackbeard'?17/30:identity==='napoleon'?23/30:identity==='musashi'?19/30:.7;
   const mixer=kit?null:new THREE.AnimationMixer(root);const clip=gltf.animations.find(c=>/attack/i.test(c.name));
   if(kit)kit.play('attack');else if(clip)mixer!.clipAction(clip).play();
   stage.update({elapsed:2.55,phase:'release',progress:0,pulse:0,sourceRoot:root});
   for(let t=0;t<time-1e-8;){const dt=Math.min(.05,time-t);if(kit)kit.update(dt);else mixer?.update(dt);t+=dt;stage.update({elapsed:2.55+t,phase:'release',progress:t/2.9,pulse:t>=time-1e-8?.6:0,sourceRoot:root});}
  }else for(let t=.05;t<=.4+1e-8;t+=.05)stage.update({elapsed:t,phase:'intro',progress:t/.65,pulse:0,sourceRoot:root});
  stage.setAspect(16/9);stage.scene.updateMatrixWorld(true);stage.camera.updateMatrixWorld(true);
  const id=`${identity}-${phase}`,meshes:any[]=[],point=new THREE.Vector3();
  stage.scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;let node:THREE.Object3D|null=mesh;while(node){if(!node.visible)return;node=node.parent;}
   if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
   const count=mesh.geometry.attributes.position.count,positions=new Float32Array(count*3),uvs=new Float32Array(count*2),colors=new Float32Array(count*4);
   for(let i=0;i<count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);positions.set(point.toArray(),i*3);const uv=mesh.geometry.attributes.uv;if(uv){uvs[i*2]=uv.getX(i);uvs[i*2+1]=uv.getY(i);}const c=mesh.geometry.attributes.color;colors.set(c?[c.getX(i),c.getY(i),c.getZ(i),c.itemSize===4?c.getW(i):1]:[1,1,1,1],i*4);}
   const index=mesh.geometry.index,indices=new Uint32Array(index?Array.from(index.array):Array.from({length:count},(_,i)=>i));
   const file=`${id}-${meshes.length}.bin`;meshes.push({name:mesh.name||`stage-${meshes.length}`,file,count,indices:indices.length,groups:mesh.geometry.groups,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>{const mat=m as THREE.MeshBasicMaterial & THREE.MeshStandardMaterial;return {name:m.name,basic:!!mat.isMeshBasicMaterial,color:mat.color?.toArray(),opacity:m.opacity,transparent:m.transparent,vertexColors:mat.vertexColors,standard:!!mat.isMeshStandardMaterial,roughness:mat.roughness,metalness:mat.metalness};}),data:Buffer.concat([Buffer.from(positions.buffer),Buffer.from(uvs.buffer),Buffer.from(colors.buffer),Buffer.from(indices.buffer)])});
  });
  for(const m of meshes){await writeFile(path.join(out,m.file),m.data);delete m.data;}
  const camera=stage.camera;const lights:any[]=[];stage.scene.traverse(o=>{if(o instanceof THREE.DirectionalLight)lights.push({position:o.position.toArray(),color:o.color.toArray(),intensity:o.intensity});});
  await writeFile(path.join(out,`${id}.json`),JSON.stringify({id,label:`${identity} ${phase}: actual stage CPU offline QA, not GPU`,asset:asset.replace(/\.gz$/,''),sourceHashes,assetSha256:createHash('sha256').update(await readFile(asset)).digest('hex'),stageSha256:createHash('sha256').update(await readFile(new URL('../../src/ultimateStage.ts',import.meta.url))).digest('hex'),meshes,camera:{position:camera.position.toArray(),direction:camera.getWorldDirection(new THREE.Vector3()).toArray(),up:camera.up.toArray(),fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far},background:(stage.scene.background as THREE.Color).toArray(),lights,limitations:['Blender Cycles CPU, not WebGL','MeshBasic approximated as emission with material RGB multiplied by vertex RGB and opacity by vertex Alpha; directional lighting converted to Suns; fog not reproduced','Authored attack clip sampled for still; not complete live cast timing']}));
  stage.dispose();kit?.dispose();
 }
}
console.log(out);
