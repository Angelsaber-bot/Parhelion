import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const threeRoot=process.env.PARHELION_THREE_ROOT||path.resolve(path.dirname(new URL(import.meta.url).pathname),'../../../../kingdom-iteration/world/node_modules/three');
const THREE=await import(pathToFileURL(path.join(threeRoot,'build/three.module.js')));
const {GLTFLoader}=await import(pathToFileURL(path.join(threeRoot,'examples/jsm/loaders/GLTFLoader.js')));
const reports=[];
for(const file of process.argv.slice(2)){
 const b=fs.readFileSync(file),loader=new GLTFLoader();loader.register(()=>({name:'CPU_QA_TEXTURE_STUB',loadTexture(){return Promise.resolve(new THREE.Texture())}}));
 const gltf=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');const model=gltf.scene,mixer=new THREE.AnimationMixer(model);let face;
 model.traverse(o=>{if(o.isSkinnedMesh&&Object.keys(o.morphTargetDictionary??{}).length===56)face=o});if(!face)throw Error('56-target face missing');
 const h=crypto.createHash('sha256');for(const name of ['position','normal','uv']){const a=face.geometry.attributes[name]?.array;if(a)h.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}for(const a of face.geometry.morphAttributes.position)h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));const faceHash=h.digest('hex');
 const idle=gltf.animations.find(a=>a.name==='Idle');mixer.clipAction(idle).play();mixer.setTime(0);model.updateMatrixWorld(true);face.skeleton.update();face.morphTargetInfluences.fill(0);let v=new THREE.Vector3();const baseline=[];for(let i=0;i<face.geometry.attributes.position.count;i++){face.getVertexPosition(i,v);baseline.push(v.clone())}
 const morphs=[];
 for(const [name,index] of Object.entries(face.morphTargetDictionary)){
  face.morphTargetInfluences.fill(0);face.morphTargetInfluences[index]=1;let max=0,nonfinite=0;
  for(let i=0;i<baseline.length;i++){face.getVertexPosition(i,v);if(![v.x,v.y,v.z].every(Number.isFinite))nonfinite++;max=Math.max(max,v.distanceTo(baseline[i]));}
  if(nonfinite||max<1e-7)throw Error('Invalid morph '+name);morphs.push({name,maxLocalDisplacement:max,nonfinite});
 }
 face.morphTargetInfluences.fill(0);const offsets={},socketErrors={Left:0,Right:0};
 for(const clip of gltf.animations){mixer.stopAllAction();const a=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();for(const phase of [0,.25,.5,.75,1]){mixer.setTime(clip.duration*phase);model.updateMatrixWorld(true);for(const side of ['Left','Right']){const socket=model.getObjectByName('Attachment_'+side+'Hand_Katana'),bone=model.getObjectByName('mixamorig'+side+'Hand');if(!socket||!bone)throw Error('Missing hand socket '+side);let p=socket.getWorldPosition(new THREE.Vector3()).applyMatrix4(bone.matrixWorld.clone().invert());if(!offsets[side])offsets[side]=p.clone();socketErrors[side]=Math.max(socketErrors[side],p.distanceTo(offsets[side]));}}}
 if(Object.values(socketErrors).some(v=>v>1e-5))throw Error('Socket drift');if(Object.values(offsets).some(v=>v.length()>.25))throw Error('Socket outside palm vicinity');
 reports.push({file,pass:true,faceGeometryAndMorphHash:faceHash,morphs,socketBoneLocalOffsets:Object.fromEntries(Object.entries(offsets).map(([k,v])=>[k,v.toArray()])),maxSocketDrift:socketErrors,scope:'Actual Three.js CPU morph deformation at every target and socket transforms sampled across all four clips; textures stubbed.'});
}
if(new Set(reports.map(r=>r.faceGeometryAndMorphHash)).size>1)throw Error('LOD facial geometry or morphs changed');
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname),'morph-socket-validation.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports.map(r=>({file:r.file,pass:r.pass,faceHash:r.faceGeometryAndMorphHash,morphs:r.morphs.length,drift:r.maxSocketDrift})),null,2));
