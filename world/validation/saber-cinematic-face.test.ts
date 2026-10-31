import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSaberCinematicFace, SABER_FACE_MORPHS, saberFaceExpression } from '../src/saberCinematicFace.ts';
import { readCharacter } from './characters/inspect.ts';
import { SERVANT_MODELS } from '../src/servant.ts';
import { fileURLToPath } from 'node:url';

test('Saber expression follows quiet charge, eye opening, shout and recovery', () => {
 const f=(phase:'intro'|'charge'|'release'|'outro',progress:number)=>saberFaceExpression({phase,progress,elapsed:1});
 assert.equal(f('charge',.2).blink,1);assert.equal(f('charge',.6).blink,0);
 assert.ok(f('release',.2).shout>.9);assert.equal(f('outro',.5).shout,0);
 for(const phase of ['intro','charge','release','outro'] as const)for(let p=0;p<=1;p+=.02)for(const value of Object.values(f(phase,p)))assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
});
test('Published Saber supports actual facial morphs and private reversible geometry motion',async()=>{
 const {gltf}=await readCharacter(fileURLToPath(SERVANT_MODELS.armor));
 const root=gltf.scene,face=root.getObjectByName('Face') as THREE.Mesh;
 const originalWeights=face.morphTargetInfluences!.slice();
 const hair=root.getObjectByName('Runtime_•_hair') as THREE.Mesh;
 const originalGeometry=hair.geometry,originalPosition=new Float32Array(hair.geometry.getAttribute('position').array),originalMaterial=hair.material;
 const controller=createSaberCinematicFace(root);assert.equal(controller.available,true);
 assert.notEqual(hair.geometry,originalGeometry);assert.notEqual(hair.material,originalMaterial);
 controller.update({phase:'charge',progress:.2,elapsed:2});assert.equal(face.morphTargetInfluences![SABER_FACE_MORPHS.blink],1);
 controller.update({phase:'release',progress:.2,elapsed:7});assert.ok(face.morphTargetInfluences![SABER_FACE_MORPHS.shout]>.8);
 const firstFrame=new Float32Array(hair.geometry.getAttribute('position').array);
 controller.update({phase:'release',progress:.2,elapsed:7});assert.deepEqual(new Float32Array(hair.geometry.getAttribute('position').array),firstFrame);
 controller.update({phase:'release',progress:.2,elapsed:NaN});assert.deepEqual(new Float32Array(hair.geometry.getAttribute('position').array),firstFrame);
 assert.deepEqual(new Float32Array(originalGeometry.getAttribute('position').array),originalPosition);
 assert.notDeepEqual(new Float32Array(hair.geometry.getAttribute('position').array),originalPosition);
 controller.reset();assert.deepEqual(face.morphTargetInfluences,originalWeights);assert.deepEqual(new Float32Array(hair.geometry.getAttribute('position').array),originalPosition);
 controller.dispose();controller.dispose();assert.equal(hair.geometry,originalGeometry);assert.equal(hair.material,originalMaterial);
});
test('Missing face rig is harmless',()=>{const c=createSaberCinematicFace(new THREE.Group());assert.equal(c.available,false);c.update({phase:'charge',progress:1,elapsed:2});c.reset();c.dispose();});

test('Integrated stage repeated casts preserve live face, hair and materials', async()=>{
 const { UltimateStage } = await import('../src/ultimateStage.ts');
 const { gltf }=await readCharacter(fileURLToPath(SERVANT_MODELS.armor));
 const source=gltf.scene,face=source.getObjectByName('Face') as THREE.Mesh,hair=source.getObjectByName('Runtime_•_hair') as THREE.Mesh;
 const sourceWeights=face.morphTargetInfluences!.slice(),sourceGeometry=hair.geometry,sourceMaterial=hair.material;
 const sourcePosition=new Float32Array(sourceGeometry.getAttribute('position').array);
 let disposed=0;sourceGeometry.addEventListener('dispose',()=>disposed++);
 for(const m of Array.isArray(sourceMaterial)?sourceMaterial:[sourceMaterial])m.addEventListener('dispose',()=>disposed++);
 const stage=new UltimateStage();
 for(let cast=0;cast<2;cast++){
  stage.begin({identity:'saber',sourceRoot:source,clips:gltf.animations});
  stage.update({elapsed:2,phase:'charge',progress:.2,pulse:0});
  stage.update({elapsed:8,phase:'release',progress:.2,pulse:1,strikeCount:1});
  assert.deepEqual(face.morphTargetInfluences,sourceWeights);
  assert.deepEqual(new Float32Array(sourceGeometry.getAttribute('position').array),sourcePosition);
  stage.end();assert.equal(stage.isActive,false);assert.deepEqual(stage.resourceCounts,{geometries:0,materials:0,actors:0});
  assert.equal(hair.geometry,sourceGeometry);assert.equal(hair.material,sourceMaterial);assert.equal(disposed,0);
 }
 stage.dispose();assert.equal(disposed,0);
});
