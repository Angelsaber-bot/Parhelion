import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {UltimateStage} from '../src/ultimateStage.ts';
function source(){const root=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(.8,2,.5),new THREE.MeshBasicMaterial());body.position.y=1;root.add(body);const muzzle=new THREE.Object3D();muzzle.name='Blackbeard_Muzzle';muzzle.position.set(.3,1.5,.6);root.add(muzzle);return root;}
function visible(stage:UltimateStage,match:RegExp){const names:string[]=[];stage.scene.traverse(o=>{if(o.visible&&match.test(o.name))names.push(o.name);});return names;}
test('Blackbeard cannon banks follow exactly three contact counts, not phase progress or pulse',()=>{
 const stage=new UltimateStage();stage.begin({identity:'blackbeard',sourceRoot:source()});const resources=stage.resourceCounts;
 stage.update({elapsed:2,phase:'release',progress:.9,pulse:1,strikeCount:0});assert.equal(visible(stage,/port .*flash/).length,0);
 stage.update({elapsed:2.1,phase:'release',progress:.1,pulse:1,strikeCount:1});assert.equal(visible(stage,/salvo 1 port .*flash/).length,3);assert.equal(visible(stage,/actual muzzle signal/).length,1);
 stage.update({elapsed:2.3,phase:'release',progress:.4,pulse:1,strikeCount:2});assert.equal(visible(stage,/salvo 2 port .*flash/).length,4);
 stage.update({elapsed:2.5,phase:'release',progress:.7,pulse:1,strikeCount:3});assert.equal(visible(stage,/salvo 3 port .*flash/).length,7);assert.deepEqual(stage.resourceCounts,resources);
 stage.update({elapsed:2.55,phase:'outro',progress:.1,pulse:.5,strikeCount:3});assert.ok(visible(stage,/port .*smoke/).length>=7);
 for(let i=0;i<14;i++)stage.update({elapsed:2.65+i*.1,phase:'outro',progress:.9,pulse:1,strikeCount:4});assert.equal(visible(stage,/port .*(flash|smoke|trace)/).length,0);
 stage.end();assert.equal(stage.scene.children.length,0);
});
test('Blackbeard muzzle glint samples clone socket and reduced salvos use fewer bounded ports',()=>{
 const root=source(),stage=new UltimateStage();stage.begin({identity:'blackbeard',sourceRoot:root,reducedEffects:true});stage.update({elapsed:2,phase:'release',progress:.2,pulse:1,strikeCount:1});
 const socket=stage.scene.getObjectByName('Blackbeard_Muzzle')!,flash=stage.scene.getObjectByName('Blackbeard actual muzzle signal')!;
 assert.ok(flash.position.distanceTo(socket.getWorldPosition(new THREE.Vector3()))<1e-8);assert.equal(visible(stage,/salvo 1 port .*flash/).length,1);
 assert.deepEqual(root.getObjectByName('Blackbeard_Muzzle')!.position.toArray(),[.3,1.5,.6]);stage.dispose();
});
test('Blackbeard second and third strikes use actual low cannon-row shots; reduced mode stays stable',()=>{
 for(const reducedEffects of[false,true]){const stage=new UltimateStage();stage.begin({identity:'blackbeard',sourceRoot:source(),reducedEffects});stage.update({elapsed:3,phase:'release',progress:.5,pulse:1,strikeCount:2});
 const ship=stage.scene.getObjectByName('Original broadside silhouette')!;ship.updateMatrixWorld(true);const port=ship.localToWorld(new THREE.Vector3(-6.32,2.68,-5.39));
 assert.equal(stage.camera.fov,reducedEffects?38:56);assert.equal(stage.camera.position.distanceTo(port)<2,!reducedEffects);
 stage.update({elapsed:3.1,phase:'outro',progress:.8,pulse:0,strikeCount:3});assert.equal(stage.camera.fov,38);stage.dispose();}
});
test('hero cannon bores are recessed behind open rounded lips and retain bounded shared resources',()=>{
 const stage=new UltimateStage();stage.begin({identity:'blackbeard',sourceRoot:source()});
 assert.equal(visible(stage,/Blackbeard hero cannon/).length,7);assert.equal(visible(stage,/recessed dark bore/).length,7);
 const barrel=stage.scene.getObjectByName('Blackbeard hero cannon 1')!;
 const tube=barrel.children.find(o=>(o as THREE.Mesh).geometry instanceof THREE.CylinderGeometry) as THREE.Mesh<THREE.CylinderGeometry>;
 assert.equal(tube.geometry.parameters.openEnded,true);assert.equal(tube.geometry.parameters.radialSegments,16);
 assert.ok(barrel.getObjectByName('Blackbeard recessed dark bore 1')!.position.z < .575);
 const counts=stage.resourceCounts;stage.update({elapsed:3,phase:'release',progress:.5,pulse:1,strikeCount:3});assert.deepEqual(stage.resourceCounts,counts);stage.end();assert.equal(stage.scene.children.length,0);
});
test('mounted travel is continuous at charge/release and retains its endpoint through outro',()=>{
 const stage=new UltimateStage();stage.begin({identity:'napoleon',sourceRoot:source()});
 const actor=(stage as unknown as {actor:THREE.Group}).actor;
 stage.update({elapsed:2,phase:'charge',progress:1,pulse:0,strikeCount:0});const chargeZ=actor.position.z;
 stage.update({elapsed:2.01,phase:'release',progress:0,pulse:0,strikeCount:0});assert.equal(actor.position.z,chargeZ);assert.equal(visible(stage,/Napoleon ground impact/).length,0);
 stage.update({elapsed:2.2,phase:'release',progress:1,pulse:1,strikeCount:1});const endZ=actor.position.z;
 stage.update({elapsed:2.3,phase:'outro',progress:.3,pulse:0,strikeCount:1});assert.equal(actor.position.z,endZ);assert.equal(visible(stage,/Napoleon ground impact/).length,1);
 stage.update({elapsed:3,phase:'outro',progress:1,pulse:1,strikeCount:1});assert.equal(visible(stage,/Napoleon ground impact/).length,0);stage.dispose();
});
test('Musashi monumental crossing is third-contact-only and decays through outro without retrigger',()=>{
 const stage=new UltimateStage();stage.begin({identity:'musashi',sourceRoot:source()});const counts=stage.resourceCounts;
 for(let strikeCount=0;strikeCount<3;strikeCount++){stage.update({elapsed:2+strikeCount*.2,phase:'release',progress:.9,pulse:1,strikeCount});assert.equal(visible(stage,/Musashi third .*crossing/).length,0);}
 stage.update({elapsed:2.6,phase:'release',progress:.9,pulse:1,strikeCount:3});assert.equal(visible(stage,/Musashi third .*crossing/).length,2);
 stage.update({elapsed:2.75,phase:'outro',progress:.2,pulse:0,strikeCount:3});assert.equal(visible(stage,/Musashi third central cut/).length,1);
 stage.update({elapsed:3.3,phase:'outro',progress:1,pulse:1,strikeCount:4});assert.equal(visible(stage,/Musashi third/).length,0);assert.deepEqual(stage.resourceCounts,counts);stage.dispose();
});
test('Musashi finisher has broad pointed colored blade cores, while reduced mode caps width and opacity',()=>{
 const measurements=[];
 for(const reducedEffects of[false,true]){const stage=new UltimateStage();stage.begin({identity:'musashi',sourceRoot:source(),reducedEffects});stage.update({elapsed:3,phase:'release',progress:.8,pulse:1,strikeCount:3});
 const blade=stage.scene.getObjectByName('Musashi third red crossing') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
 const color=blade.geometry.attributes.color;assert.equal(color.itemSize,4);assert.equal(color.getW(12*7+3),1);assert.equal(color.getW(12*7),0);
 blade.geometry.computeBoundingBox();const width=blade.geometry.boundingBox!.getSize(new THREE.Vector3()).x*blade.scale.x;
 measurements.push({width,opacity:blade.material.opacity});stage.dispose();}
 assert.ok(measurements[0].width>.8);assert.ok(measurements[1].width<.16);assert.equal(measurements[1].opacity,.3);
});
test('short mounted release travels visibly by elapsed time and camera/aim track the exact displacement',()=>{
 for(const reducedEffects of [false,true]){const root=source(),stage=new UltimateStage();stage.begin({identity:'napoleon',sourceRoot:root,reducedEffects});
 const internal=stage as unknown as {actor:THREE.Group;aim:THREE.Vector3};
 stage.update({elapsed:.24,phase:'charge',progress:.8,pulse:0,strikeCount:0});const before=internal.actor.position.z;
 stage.update({elapsed:.25,phase:'release',progress:0,pulse:0,strikeCount:0});assert.equal(internal.actor.position.z,before);
 const camera=stage.camera.position.clone(),aim=internal.aim.clone();
 stage.update({elapsed:.85,phase:'release',progress:.6/2.9,pulse:1,strikeCount:1});const travel=internal.actor.position.z-before;
 assert.ok(reducedEffects?travel<=.31:travel>2);assert.ok(travel>0);
 assert.ok(Math.abs(stage.camera.position.z-camera.z-travel)<1e-8);assert.ok(Math.abs(internal.aim.z-aim.z-travel)<1e-8);
 const end=internal.actor.position.z;stage.update({elapsed:.86,phase:'outro',progress:0,pulse:0,strikeCount:1});assert.equal(internal.actor.position.z,end);
 assert.equal(root.position.z,0);stage.dispose();}
});
test('mounted direct release entry and live Reduced latch never teleport or rewind travel',()=>{
 const stage=new UltimateStage();stage.begin({identity:'napoleon',sourceRoot:source()});const actor=(stage as unknown as {actor:THREE.Group}).actor;
 stage.update({elapsed:0,phase:'release',progress:.7,pulse:0,strikeCount:0});assert.equal(actor.position.z,0);
 stage.update({elapsed:.5,phase:'release',progress:.71,pulse:1,strikeCount:1});const travel=actor.position.z;assert.ok(travel>1.7);
 stage.update({elapsed:.51,phase:'release',progress:.72,pulse:0,strikeCount:1,reduced:true});assert.equal(actor.position.z,travel);
 stage.update({elapsed:.7,phase:'outro',progress:1,pulse:0,strikeCount:1});assert.equal(actor.position.z,travel);stage.end();
 stage.begin({identity:'napoleon',sourceRoot:source()});stage.update({elapsed:0,phase:'release',progress:0,pulse:0,strikeCount:0});assert.equal((stage as unknown as {actor:THREE.Group}).actor.position.z,0);stage.dispose();
});
