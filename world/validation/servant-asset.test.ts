import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FirstContract } from '../src/contracts.ts';
import { ContractServant, SERVANT_CLIPS, SERVANT_MODELS, decodeServantModel } from '../src/servant.ts';
import type { ServantOutfit } from '../src/servantAppearance.ts';

async function loadAsset(outfit: ServantOutfit) {
  const gzip=await readFile(new URL(SERVANT_MODELS[outfit]));
  const bytes=Buffer.from(await decodeServantModel(gzip.buffer.slice(gzip.byteOffset,gzip.byteOffset+gzip.byteLength)));
  assert.ok(gzip.byteLength < 25 * 1024 * 1024, 'runtime file below existing hosting single-file ceiling');
  assert.ok(bytes.byteLength < 100_000_000,'full-fidelity single actor asset budget, not hosting approval');
  const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  assert.ok(json.images?.length>0,'refined face/body textures retained');
  for(const image of json.images) {
    assert.equal(image.uri,undefined,'no external texture requests');
    const view=json.bufferViews[image.bufferView];assert.ok(view?.byteLength>0,'embedded texture bytes exist');
  }
  const loader=new GLTFLoader();
  // Node has no GPU/ImageBitmap decoder. Preserve actual geometry, skins, animation,
  // UVs and material links; only texture upload is stubbed. Artist GLB renders cover appearance.
  loader.register(()=>({name:'NODE_GEOMETRY_ONLY_TEXTURE_ADAPTER',loadTexture(){return Promise.resolve(new THREE.Texture());}}));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
for(const outfit of ['armor','civilian'] as const) {
  test(`accepted ${outfit} GLB retains full geometry, finite normalized skinning and four real clips`, async () => {
    const gltf=await loadAsset(outfit),meshes:THREE.SkinnedMesh[]=[],bones=new Set<THREE.Bone>();let triangles=0;
    gltf.scene.traverse(o=>{
      assert.equal((o as THREE.Camera).isCamera,undefined,'no camera in runtime GLB');
      assert.equal((o as THREE.Light).isLight,undefined,'no staging light in runtime GLB');
      assert.doesNotMatch(o.name,/Backdrop|Turntable|ReferencePlane|PreviewLight/i);
      if((o as THREE.Bone).isBone)bones.add(o as THREE.Bone);
      const m=o as THREE.SkinnedMesh;if(!m.isMesh)return;
      assert.equal(m.isSkinnedMesh,true,`unskinned runtime part ${o.name}`);meshes.push(m);
      triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      for(const name of ['position','normal','skinWeight','skinIndex']) {
        const attribute=m.geometry.attributes[name];assert.ok(attribute,`${name} exists`);
        for(const value of attribute.array)assert.ok(Number.isFinite(value),`${name} finite`);
      }
      const weights=m.geometry.attributes.skinWeight,indices=m.geometry.attributes.skinIndex;
      for(let i=0;i<weights.count;i++) {
        assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<.001);
        for(const index of [indices.getX(i),indices.getY(i),indices.getZ(i),indices.getW(i)])assert.ok(index>=0&&index<m.skeleton.bones.length);
      }
    });
    assert.ok(meshes.length>0&&meshes.length<=40);assert.ok(bones.size>=60&&bones.size<=96);
    assert.ok(triangles<=1_200_000,'full-quality bounded single actor budget');
    if(outfit==='armor')assert.ok(triangles>=850_000,'do not silently substitute simplified/rejected geometry');
    const rest=new THREE.Box3().setFromObject(gltf.scene),size=rest.getSize(new THREE.Vector3());
    assert.ok(Math.abs(rest.min.y)<.035,`feet at y0, got ${rest.min.y}`);assert.ok(size.y>1.5&&size.y<1.95);
    const mixer=new THREE.AnimationMixer(gltf.scene),sample=new THREE.Vector3();
    for(const name of SERVANT_CLIPS) {
      const clip=gltf.animations.find(c=>c.name===name);assert.ok(clip);
      const duration={Idle:2.4,Walk:.9,Run:17/30,Attack:1.2}[name];
      assert.ok(Math.abs(clip.duration-duration)<1e-5, `${name} zero-based duration ${clip.duration}`);
      for(const track of clip.tracks) assert.ok(Math.abs(track.times[0])<1e-6, 'no 33ms held first frame');
      assert.ok(clip.tracks.length>=60,'real articulated skeleton tracks');
      const action=mixer.clipAction(clip);mixer.stopAllAction();action.reset().setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
      for(const time of [0,.25,.5,.75,1]) {
        mixer.setTime(clip.duration*time);gltf.scene.updateMatrixWorld(true);
        for(const mesh of meshes) {
          mesh.skeleton.update();
          for(let i=0;i<mesh.geometry.attributes.position.count;i+=251) {
            mesh.getVertexPosition(i,sample).applyMatrix4(mesh.matrixWorld);
            assert.ok(sample.toArray().every(Number.isFinite));assert.ok(sample.length()<6,'bounded animated deformation');
          }
        }
        assert.ok(gltf.scene.position.length()<.001,'in-place root');
      }
    }
    mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
    const scene=new THREE.Scene();
    const servant=new ContractServant({scene,marker:{id:'saber_contract',type:'interact',label:'Saber',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),colliders:[],target:()=>null,strike:()=>null,load:async()=>gltf});
    await servant.selectOutfit(outfit);assert.equal(servant.state,'ready');assert.equal(servant.activeOutfit,outfit);
    servant.update(.1,new THREE.Vector3(),0,true,false);assert.equal(servant.root.visible,true);assert.equal(servant.animation,'Idle');
    assert.ok(servant.root.getObjectByProperty('isSkinnedMesh',true));
    servant.dispose();assert.equal(scene.children.length,0);
  });
}
