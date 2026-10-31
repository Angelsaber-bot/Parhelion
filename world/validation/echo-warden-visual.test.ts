import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createEchoWardenVisual} from '../src/echoWardenVisual';import {parseLocalGlb} from './player-fixture';
test('Warden-only signal vanes are bounded opaque cosmetic meshes, phase-clock pure, and release private resources exactly once',async()=>{
 const gltf=await parseLocalGlb(new URL('../public/assets/enemies/sunward_guard.glb',import.meta.url));
 const root=gltf.scene,before:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)before.push(o);});const originals=before.map(m=>({geometry:m.geometry,material:m.material}));
 const visual=createEchoWardenVisual(root);assert.ok(visual);assert.equal(visual.root.parent?.name,'chest');
 const meshes:THREE.Mesh[]=[];visual.root.traverse(o=>{assert.equal(o instanceof THREE.Light,false);if(o instanceof THREE.Mesh)meshes.push(o);});assert.equal(meshes.length,6);
 const geometries=new Set(meshes.map(m=>m.geometry)),materials=new Set(meshes.map(m=>m.material as THREE.MeshStandardMaterial));assert.equal(geometries.size,2);assert.equal(materials.size,2);
 assert.equal([...geometries].reduce((n,g)=>n+(g.index?.count??g.attributes.position.count)/3,0)*3,72);
 for(const m of materials){assert.equal(m.transparent,false);assert.equal(m.opacity,1);assert.equal(m.map,null);}
 const state={phase:1 as 1|2,mode:'windup' as const,timer:1};visual.update(state);root.updateWorldMatrix(true,true);const snapshot=meshes.map(m=>m.matrixWorld.toArray());
 for(let i=0;i<50;i++)visual.update(state);root.updateWorldMatrix(true,true);assert.deepEqual(meshes.map(m=>m.matrixWorld.toArray()),snapshot);
 visual.update({...state,phase:2});root.updateWorldMatrix(true,true);assert.notDeepEqual(meshes.map(m=>m.matrixWorld.toArray()),snapshot);
 before.forEach((m,i)=>{assert.equal(m.geometry,originals[i].geometry);assert.equal(m.material,originals[i].material);});
 let disposed=0;[...geometries,...materials].forEach(resource=>resource.addEventListener('dispose',()=>disposed++));visual.dispose();visual.dispose();assert.equal(disposed,4);assert.equal(visual.root.parent,null);visual.update(state);assert.equal(disposed,4);
});
