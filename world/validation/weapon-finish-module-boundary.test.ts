import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import * as THREE from 'three';
import {createWeaponFinishMaterials} from '../src/weaponFinishMaterials';
const Foreign=createRequire(import.meta.url)('three');
test('loaded cross-constructor weapon receives real private color/pattern changes and exact default restoration',()=>{
 const root=new Foreign.Group(),source=new Foreign.MeshStandardMaterial({color:'#b5afa1'});source.name='PH_ivory';const mesh=new Foreign.Mesh(new Foreign.BoxGeometry(),source);root.add(mesh);
 assert.equal(mesh instanceof THREE.Mesh,false,'fixture must exercise a distinct loader constructor');
 const controller=createWeaponFinishMaterials(root);assert.equal(controller.materialCount,1);assert.notEqual(mesh.material,source);
 const clone=mesh.material;assert.equal(clone.map,null);assert.equal(controller.apply('oath'),true);assert.ok(clone.map?.isDataTexture,'selection must visibly apply a real albedo pattern, not only update the finish id');assert.equal(clone.color.getHexString(),'ffffff');assert.equal(source.map,null);assert.equal(source.color.getHexString(),'b5afa1');
 const pattern=clone.map;let materialDisposals=0,patternDisposals=0;clone.addEventListener('dispose',()=>materialDisposals++);pattern.addEventListener('dispose',()=>patternDisposals++);
 controller.apply('original');assert.equal(clone.map,null);assert.equal(clone.color.getHexString(),'b5afa1');controller.apply('oath');assert.equal(clone.map,pattern);controller.dispose();controller.dispose();assert.equal(mesh.material,source);assert.equal(materialDisposals,1);assert.equal(patternDisposals,1);mesh.geometry.dispose();source.dispose();
});

test('two equipped instances sharing a foreign source own separate finish clones/patterns and independent disposal',()=>{
 const source=new Foreign.MeshStandardMaterial({color:'#b5afa1'});source.name='PH_ivory';const geometry=new Foreign.BoxGeometry(),roots=[new Foreign.Group(),new Foreign.Group()],meshes=roots.map(root=>{const mesh=new Foreign.Mesh(geometry,source);root.add(mesh);return mesh;});
 const controllers=roots.map(root=>createWeaponFinishMaterials(root));controllers[0].apply('oath');controllers[1].apply('tide');assert.notEqual(meshes[0].material,meshes[1].material);assert.notEqual(meshes[0].material.map,meshes[1].material.map);
 const second=meshes[1].material,secondMap=second.map;let secondDisposed=0,sourceDisposed=0;second.addEventListener('dispose',()=>secondDisposed++);source.addEventListener('dispose',()=>sourceDisposed++);
 controllers[0].dispose();assert.equal(meshes[0].material,source);assert.equal(meshes[1].material,second);assert.equal(second.map,secondMap);assert.equal(secondDisposed,0);assert.equal(sourceDisposed,0);assert.equal(source.map,null);assert.equal(source.color.getHexString(),'b5afa1');
 controllers[1].apply('frost');assert.notEqual(second.map,secondMap);controllers[1].dispose();assert.equal(secondDisposed,1);assert.equal(sourceDisposed,0);assert.equal(meshes[1].material,source);geometry.dispose();source.dispose();
});

test('PBR brand alone is insufficient: malformed color/map shape is not recolored or patterned',()=>{
 for(const shape of [{color:{}},{color:{isColor:true}},{color:new THREE.Color(),map:{}}]){
  const root=new THREE.Group(),original=new THREE.Material();original.name='PH_ivory';const invalid=new THREE.Material()as any;Object.assign(invalid,{name:'PH_ivory',isMeshStandardMaterial:true,map:null},shape);original.clone=()=>invalid;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),original);root.add(mesh);const controller=createWeaponFinishMaterials(root);assert.doesNotThrow(()=>controller.apply('oath'));assert.equal(invalid.map,shape.map??null);assert.equal(controller.finish,'oath');controller.dispose();assert.equal(mesh.material,original);mesh.geometry.dispose();original.dispose();
 }
});
