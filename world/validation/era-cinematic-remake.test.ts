import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {fileURLToPath} from 'node:url';
import {readCharacter} from './characters/inspect.ts';
import {CHARACTER_KITS} from '../src/characters/catalog.ts';
import {EraCinematicRemake} from '../src/eraCinematicRemake.ts';
const owner={mesh(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Object3D){const mesh=new THREE.Mesh(g,m);p.add(mesh);return mesh;},material(color:number,opacity:number){return new THREE.MeshBasicMaterial({color,opacity,transparent:opacity<1});}};
for(const identity of ['blackbeard','napoleon','musashi'] as const)test(`${identity} has actual private 3D expression channels, finite camera and idempotent cleanup`,async()=>{
 const kit=CHARACTER_KITS[identity==='napoleon'?'napoleonMounted':identity];
 const{gltf}=await readCharacter(fileURLToPath(kit.assetUrl)),source=gltf.scene,copy=clone(source),actor=new THREE.Group();actor.add(copy);
 const before=JSON.stringify(source.toJSON()),materials=new Map<THREE.Mesh,THREE.Material|THREE.Material[]>(),geometries=new Map<THREE.Mesh,THREE.BufferGeometry>();
 copy.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){materials.set(m,m.material);geometries.set(m,m.geometry);}});
 const art=new EraCinematicRemake(actor,copy,identity,owner),camera=new THREE.PerspectiveCamera();
 assert.ok(art.expressionChannels.morphMeshes+art.expressionChannels.geometryChannels>0);
 if(identity==='blackbeard'){const hat=copy.getObjectByName('Blackbeard cinematic-only optimized tricorn') as THREE.SkinnedMesh;assert.ok(hat?.isSkinnedMesh);assert.equal(hat.geometry.index!.count/3,2681);assert.equal(source.getObjectByName(hat.name),undefined);}
 const shots=new Set<string>();
 for(const phase of ['intro','charge','release','outro'] as const)for(let i=0;i<=10;i++){
  art.update({phase,elapsed:['intro','charge','release','outro'].indexOf(phase)*3+i*.1,progress:i/10,pulse:.3,strikeCount:phase==='release'?Math.floor(i/4)+1:0},camera,i===9);
  shots.add(art.shot);assert.ok(camera.position.toArray().every(Number.isFinite));assert.ok(art.aim.toArray().every(Number.isFinite));
  copy.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){const p=mesh.geometry.attributes.position;for(let j=0;j<p.count;j++)assert.ok(Number.isFinite(p.getX(j)+p.getY(j)+p.getZ(j)));}});
 }
 assert.ok(shots.size>=3);assert.equal(JSON.stringify(source.toJSON()),before,'original materials and geometry remain untouched');
 art.dispose();art.dispose();assert.equal(copy.getObjectByName('Blackbeard cinematic-only optimized tricorn'),undefined);for(const[m,value]of materials)assert.equal(m.material,value);for(const[m,value]of geometries)assert.equal(m.geometry,value);
});
test('unknown head supports a finite fallback without model assets',()=>{const actor=new THREE.Group(),copy=new THREE.Group();actor.add(copy);const art=new EraCinematicRemake(actor,copy,'blackbeard',owner),camera=new THREE.PerspectiveCamera();art.update({phase:'intro',elapsed:0,progress:0,pulse:0},camera,false);assert.ok(camera.position.toArray().every(Number.isFinite));art.update({phase:'charge',elapsed:NaN,progress:NaN,pulse:0},camera,false);art.dispose();});

test('mounted reveal keeps whole rider head inside widescreen throughout charge',async()=>{
 const {gltf}=await readCharacter(fileURLToPath(CHARACTER_KITS.napoleonMounted.assetUrl));const copy=clone(gltf.scene),actor=new THREE.Group();actor.add(copy);const art=new EraCinematicRemake(actor,copy,'napoleon',owner),camera=new THREE.PerspectiveCamera(42,16/9,.01,100);
 const head=copy.getObjectByName('Head')!;
 for(let i=0;i<=60;i++){art.update({phase:'charge',elapsed:1.2+i*3.8/60,progress:i/60,pulse:0,strikeCount:0},camera,false);for(const x of [-.18,.18])for(const y of [-.1,.3])for(const z of [-.18,.18]){const corner=head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(x,y,z)).project(camera);assert.ok(Math.abs(corner.x)<.9&&Math.abs(corner.y)<.9,`rider head clipped at charge ${i}/60: ${corner.toArray()}`);}}
 art.dispose();
});
