import {readFileSync}from'node:fs';import *as THREE from'three';import{regionLoader,bakeQuantized}from'../../src/glb.ts';
const path=process.argv[2],region=process.argv[3];const bytes=readFileSync(path);const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
const meshes:THREE.Mesh[]=[];gltf.scene.getObjectByName('ART')!.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh)});
const points:number[][]=[];
if(region==='britain')for(let r=5.55;r<9;r+=.45)for(let a=.027;a<Math.PI*2;a+=.19)points.push([-160+Math.cos(a)*r,-214+Math.sin(a)*r,60.8]);
else for(let x=-126.13;x<-108;x+=1.37)for(let z=224.17;z<236;z+=.83)points.push([x,z,10.15]);
const ray=new THREE.Raycaster();const n=new THREE.Vector3();let found=0;
for(const[x,z,y]of points){ray.set(new THREE.Vector3(x,y+.3,z),new THREE.Vector3(0,-1,0));ray.far=.6;const hits=ray.intersectObjects(meshes,false).filter(h=>h.face&&n.copy(h.face.normal).transformDirection(h.object.matrixWorld).y>.95);for(let i=1;i<hits.length;i++)if(Math.abs(hits[i].point.y-hits[i-1].point.y)<.008){if(found<12)console.log({x,z,y:hits[i].point.y,names:[hits[i-1].object.name,hits[i].object.name],gap:Math.abs(hits[i].point.y-hits[i-1].point.y)});found++;break;}}
console.log('overlaps',found,'/',points.length);
