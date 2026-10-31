/** Paired native run-to-Q component film; use bounded stream renderer/gate. */
import * as THREE from 'three';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';import{createHash}from'node:crypto';import{createInterface}from'node:readline';
const world=process.argv.find(x=>x.startsWith('--world='))?.slice(8);if(!world)throw Error('--world required');
const moduleUrl=(p:string)=>pathToFileURL(path.resolve(world,p)).href;
const {CharacterKit}=await import(moduleUrl('src/characters/characterKit.ts'));
const {KitCompanion}=await import(moduleUrl('src/kitCompanion.ts'));
const {CHARACTER_KITS}=await import(moduleUrl('src/characters/catalog.ts'));
const {readCharacter}=await import(moduleUrl('validation/characters/inspect.ts'));
const out=process.argv[2];if(!out)throw Error('working directory required');await mkdir(out,{recursive:true});
const fps=30,identity='musashi',definition=CHARACTER_KITS.musashi,asset=fileURLToPath(definition.assetUrl),loaded=await readCharacter(asset);
const sourceHashes:Record<string,string>={};for(const p of ['src/characters/characterKit.ts','src/characters/actionBlend.ts','src/kitCompanion.ts','src/characters/musashiLocomotion.ts'])sourceHashes[p]=createHash('sha256').update(await readFile(path.resolve(world,p))).digest('hex');
let follower:any;const actor=new CharacterKit(loaded.gltf,definition,{onEvent:(e:any)=>follower?.onEvent(actor,e)});
const scene=new THREE.Scene();scene.background=new THREE.Color(0x75818c);scene.add(actor.root);
scene.add(new THREE.HemisphereLight(0xe6f3ff,0x75695c,1.6));const key=new THREE.DirectionalLight(0xfff4df,2.4);key.position.set(-3,6,5);scene.add(key);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0x77746d,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
const camera=new THREE.PerspectiveCamera(38,16/9,.1,100);camera.position.set(2.4,1.5,3.8);camera.lookAt(0,.92,0);camera.updateMatrixWorld(true);
actor.play('run',{restart:true,rate:2});for(let i=0;i<27;i++)actor.update(1/60);
const ack=createInterface({input:process.stdin})[Symbol.asyncIterator](),timeline:any[]=[],contacts:number[]=[];let currentTime=0,finished=false;
for(let frameIndex=0;frameIndex<48;frameIndex++){
 const elapsed=(frameIndex+1)/fps,phase=frameIndex<6?'run':finished?'recovery':'skill',progress=frameIndex/47;currentTime=elapsed;
 if(frameIndex===6){follower=new KitCompanion({colliders:[],range:3,damage:1,target:()=>null,strike:()=>null});if(!follower.startSkillPose(actor,{direction:{x:0,y:0,z:1},slot:'skill',contacts:2,onContact:()=>contacts.push(currentTime),onFinish:()=>{finished=true;}},actor.root.position.clone(),0))throw Error('Q rejected');}
 if(frameIndex<6||finished)actor.update(1/fps);else follower.update(actor,1/fps,actor.root.position.clone(),0,false);
 const strikeCount=contacts.length;scene.updateMatrixWorld(true);
  const sourceId=`${identity}-${String(frameIndex).padStart(3,"0")}`,id="current",meshes:any[]=[],point=new THREE.Vector3();
  scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;let node:THREE.Object3D|null=mesh;while(node){if(!node.visible)return;node=node.parent;}
   if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
   const count=mesh.geometry.attributes.position.count,positions=new Float32Array(count*3),uvs=new Float32Array(count*2),colors=new Float32Array(count*4);
   for(let i=0;i<count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);positions.set(point.toArray(),i*3);const uv=mesh.geometry.attributes.uv;if(uv){uvs[i*2]=uv.getX(i);uvs[i*2+1]=uv.getY(i);}const c=mesh.geometry.attributes.color;colors.set(c?[c.getX(i),c.getY(i),c.getZ(i),c.itemSize===4?c.getW(i):1]:[1,1,1,1],i*4);}
   const index=mesh.geometry.index,indices=new Uint32Array(index?Array.from(index.array):Array.from({length:count},(_,i)=>i));
   const file=`${id}-${meshes.length}.bin`;meshes.push({name:mesh.name||`stage-${meshes.length}`,file,count,indices:indices.length,groups:mesh.geometry.groups,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>{const mat=m as THREE.MeshBasicMaterial & THREE.MeshStandardMaterial;return {name:m.name,basic:!!mat.isMeshBasicMaterial,additive:mat.blending===THREE.AdditiveBlending,color:mat.color?.toArray(),opacity:m.opacity,transparent:m.transparent,vertexColors:mat.vertexColors,standard:!!mat.isMeshStandardMaterial,roughness:mat.roughness,metalness:mat.metalness};}),data:Buffer.concat([Buffer.from(positions.buffer),Buffer.from(uvs.buffer),Buffer.from(colors.buffer),Buffer.from(indices.buffer)])});
  });
  for(const m of meshes){await writeFile(path.join(out,m.file),m.data);delete m.data;}
  const lights:any[]=[];scene.traverse(o=>{if(o instanceof THREE.DirectionalLight)lights.push({type:'directional',position:o.position.toArray(),color:o.color.toArray(),intensity:o.intensity});else if(o instanceof THREE.PointLight)lights.push({type:'point',position:o.getWorldPosition(new THREE.Vector3()).toArray(),color:o.color.toArray(),intensity:o.intensity,distance:o.distance,decay:o.decay});else if(o instanceof THREE.HemisphereLight)lights.push({type:'hemisphere',position:o.position.toArray(),color:o.color.toArray(),groundColor:o.groundColor.toArray(),intensity:o.intensity});});
  await writeFile(path.join(out,`${id}.json`),JSON.stringify({id,elapsed,phase,progress,fps,authoredContacts:contacts,strikeCount,cutin:{visible:false,reveal:0,exit:0,reduced:false},label:`Native component run-to-Q ${phase}; fixed root studio, not gameplay capture`,asset:asset.replace(/\.gz$/,''),sourceHashes,assetSha256:createHash('sha256').update(await readFile(asset)).digest('hex'),meshes,camera:{position:camera.position.toArray(),direction:camera.getWorldDirection(new THREE.Vector3()).toArray(),up:camera.up.toArray(),fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far},background:(scene.background as THREE.Color).toArray(),lights,limitations:['Blender Cycles CPU, not WebGL','MeshBasic approximated as emission with material RGB multiplied by vertex RGB and opacity by vertex Alpha; directional lighting converted to Suns; fog not reproduced','Actual CharacterKit and KitCompanion component; fixed root/empty collision fixture, not full gameplay']}));
 const entry={sourceId,frameIndex,elapsed,phase,progress,strikeCount};timeline.push(entry);process.stdout.write(JSON.stringify(entry)+'\n');if((await ack.next()).done)break;
}
actor.dispose();await writeFile(path.join(out,'timeline-summary.json'),JSON.stringify({world,sourceHashes,timeline,contacts,scope:'Native component run-to-Q, fixed root studio; no gameplay or GPU claim'},null,2));process.exit(0);
