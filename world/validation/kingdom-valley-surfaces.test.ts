import {test}from'node:test';
import assert from'node:assert/strict';
import {readFileSync}from'node:fs';
import * as THREE from'three';
import {regionLoader,bakeQuantized}from'../src/glb.ts';
const bytes=readFileSync(new URL('../public/assets/world_britain.glb',import.meta.url));
const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
const meshes:THREE.Mesh[]=[];gltf.scene.getObjectByName('ART')!.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
test('Britain actual keep summit has no coincident upward faces across center/annular landing join',()=>{
 const ray=new THREE.Raycaster(),n=new THREE.Vector3();ray.far=.6;
 // These non-edge sample points reproduced the visible black triangles in the original export.
 for(const r of [5.55,6.02,7.21])for(const a of [.027,.407,.977,1.547,2.117,2.687]){
  const x=-160+Math.cos(a)*r,z=-214+Math.sin(a)*r;
  ray.set(new THREE.Vector3(x,61.1,z),new THREE.Vector3(0,-1,0));
  const hits=ray.intersectObjects(meshes,false).filter(h=>h.face&&n.copy(h.face.normal).transformDirection(h.object.matrixWorld).y>.95);
  for(let i=1;i<hits.length;i++)assert.ok(Math.abs(hits[i].point.y-hits[i-1].point.y)>.008,`coplanar summit at ${x},${z}: ${hits[i-1].object.name}/${hits[i].object.name}`);
 }
});
