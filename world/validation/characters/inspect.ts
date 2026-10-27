import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodeCharacterAsset } from '../../src/characters/characterKit.ts';

/** Real project Three loader/CPU skinning. Texture GPU upload is intentionally stubbed in Node. */
export async function readCharacter(path: string) {
  const source = await readFile(path);
  const decoded = await decodeCharacterAsset(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength));
  const bytes = Buffer.from(decoded), jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  const loader = new GLTFLoader();
  loader.register(() => ({ name:'NODE_GEOMETRY_ONLY_TEXTURE_ADAPTER', loadTexture(){return Promise.resolve(new THREE.Texture());} }));
  const gltf = await loader.parseAsync(decoded,'');
  return { gltf,json,bytes:source.byteLength,rawBytes:bytes.length,sha256:createHash('sha256').update(source).digest('hex'),rawSha256:createHash('sha256').update(bytes).digest('hex') };
}
export function inspectCharacter(gltf: GLTF) {
  const meshes: THREE.Mesh[] = [],bones = new Set<THREE.Bone>(),materials = new Set<THREE.Material>(),faults:string[]=[];
  let triangles=0,vertices=0,maxWeightError=0,minWeight=1;
  gltf.scene.traverse(object=>{
    if((object as THREE.Camera).isCamera || (object as THREE.Light).isLight)faults.push(`render helper ${object.name}`);
    if((object as THREE.Bone).isBone)bones.add(object as THREE.Bone);
    const mesh=object as THREE.SkinnedMesh;if(!mesh.isMesh)return;
    meshes.push(mesh);triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;vertices+=mesh.geometry.attributes.position.count;
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);
    for(const [name,attribute] of Object.entries(mesh.geometry.attributes))for(const value of attribute.array)if(!Number.isFinite(value)){faults.push(`nonfinite ${mesh.name}.${name}`);break;}
    for(const [name,targets] of Object.entries(mesh.geometry.morphAttributes))for(const attribute of targets??[])for(const value of attribute.array)if(!Number.isFinite(value)){faults.push(`nonfinite morph ${mesh.name}.${name}`);break;}
    if(mesh.isSkinnedMesh){
      const weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex;
      if(!weights||!indices){faults.push(`missing weights ${mesh.name}`);return;}
      for(let i=0;i<weights.count;i++){
        const values=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
        maxWeightError=Math.max(maxWeightError,Math.abs(values.reduce((a,b)=>a+b,0)-1));minWeight=Math.min(minWeight,...values);
        for(const index of [indices.getX(i),indices.getY(i),indices.getZ(i),indices.getW(i)])if(index<0||index>=mesh.skeleton.bones.length)faults.push(`invalid joint ${mesh.name}:${i}`);
      }
    }
  });
  const mixer=new THREE.AnimationMixer(gltf.scene),sample=new THREE.Vector3();
  function sampleBounds(stride=157){
    gltf.scene.updateMatrixWorld(true);for(const mesh of meshes)if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
    const box=new THREE.Box3();
    for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i+=stride){
      mesh.getVertexPosition(i,sample).applyMatrix4(mesh.matrixWorld);if(!sample.toArray().every(Number.isFinite))faults.push(`nonfinite animated ${mesh.name}`);else box.expandByPoint(sample);
    }
    return {min:box.min.toArray(),max:box.max.toArray()};
  }
  const rest=sampleBounds(1),clips=[];
  for(const clip of gltf.animations){
    mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
    const frames=[];for(let i=0;i<=16;i++){mixer.setTime(clip.duration*i/16);frames.push({time:clip.duration*i/16,...sampleBounds()});}
    const movingTracks=clip.tracks.filter(track=>{const size=track.getValueSize();for(let i=size;i<track.values.length;i++)if(Math.abs(track.values[i]-track.values[i%size])>1e-6)return true;return false;}).length;
    clips.push({name:clip.name,duration:clip.duration,tracks:clip.tracks.length,movingTracks,start:Math.min(...clip.tracks.map(track=>track.times[0])),frames});
  }
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
  return {triangles,vertices,meshes:meshes.length,bones:bones.size,materials:materials.size,maxWeightError,minWeight,rest,clips,faults};
}
export function inspectFootClearance(gltf: GLTF, footPattern = /(?:Foot|Toe|Hoof)/i) {
  const samples:{mesh:THREE.SkinnedMesh;indices:number[]}[]=[];
  gltf.scene.traverse(object=>{
    const mesh=object as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh)return;
    const weights=mesh.geometry.attributes.skinWeight,joints=mesh.geometry.attributes.skinIndex,indices:number[]=[];
    for(let i=0;i<weights.count;i++){
      let footWeight=0;for(let c=0;c<4;c++){const joint=joints.getComponent(i,c);if(footPattern.test(mesh.skeleton.bones[joint]?.name??''))footWeight+=weights.getComponent(i,c);}
      if(footWeight>.8)indices.push(i);
    }
    if(indices.length)samples.push({mesh,indices});
  });
  const mixer=new THREE.AnimationMixer(gltf.scene),v=new THREE.Vector3(),result=[];
  for(const clip of gltf.animations){
    mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();const minimums=[],intervals=Math.ceil(clip.duration*120);
    for(let frame=0;frame<=intervals;frame++){
      mixer.setTime(clip.duration*frame/intervals);gltf.scene.updateMatrixWorld(true);let min=Infinity;
      for(const {mesh,indices} of samples){mesh.skeleton.update();for(const i of indices){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);min=Math.min(min,v.y);}}
      minimums.push(min);
    }
    result.push({name:clip.name,sampleRateHz:120,samples:minimums.length,minY:Math.min(...minimums),maxOfMinY:Math.max(...minimums),minimums});
  }
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
  return {footVertices:samples.reduce((a,s)=>a+s.indices.length,0),clips:result};
}
