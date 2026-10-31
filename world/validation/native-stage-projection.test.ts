import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {nativeStageProjection} from './remaster-review/native-stage-projection';
test('native projection audit scans actual posed geometry and restores aspect without changing source',()=>{
 const scene=new THREE.Scene(),clone=new THREE.Group();scene.add(clone);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());mesh.name='visible';clone.add(mesh);
 const hidden=new THREE.Group();hidden.visible=false;hidden.add(mesh.clone());clone.add(hidden);
 const camera=new THREE.PerspectiveCamera(45,1.5,.1,100);camera.position.z=6;camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const stage={scene,clone,camera,setAspect(aspect:number){camera.aspect=aspect;camera.updateProjectionMatrix();}};
 const before=mesh.matrix.clone();const result=nativeStageProjection(stage);assert.equal(camera.aspect,1.5);assert.equal(result.length,2);assert.ok(result.every(r=>r.meshes.length===1&&r.meshes[0].vertices===24&&r.meshes[0].outside===0));assert.ok(mesh.matrix.equals(before));
});

test('native projection excludes undrawn indexed vertices',()=>{const scene=new THREE.Scene(),clone=new THREE.Group();scene.add(clone);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.1,0,0,0,.1,0,999,999,999],3));g.setIndex([0,1,2]);clone.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial()));const camera=new THREE.PerspectiveCamera(45,1,.1,100);camera.position.z=6;camera.updateMatrixWorld(true);const stage={scene,clone,camera,setAspect(a:number){camera.aspect=a;camera.updateProjectionMatrix();}};for(const row of nativeStageProjection(stage)){assert.equal(row.meshes[0].vertices,3);assert.equal(row.meshes[0].attributeVertices,4);assert.equal(row.meshes[0].outside,0);}});
