/** Inspect production GLB geometry through the exact runtime decoder. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { regionLoader, bakeQuantized } from '../../src/glb.ts';
import * as THREE from 'three';
const path=process.argv[2];const buf=readFileSync(path);
const gltf=await regionLoader().parseAsync(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'');
bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
const meshes:any[]=[];let triangles=0,artTriangles=0,collisionTriangles=0;
gltf.scene.traverse(o=>{
 const m=o as THREE.Mesh;if(!m.isMesh)return;
 const g=m.geometry,n=(g.index?.count??g.attributes.position.count)/3;triangles+=n;
 let parent=m.parent,group='';while(parent){if(['ART','COLLISION'].includes(parent.name))group=parent.name;parent=parent.parent;}
 if(group==='ART')artTriangles+=n;if(group==='COLLISION')collisionTriangles+=n;
 const colors=new Set<string>();const attr=g.attributes.color;
 if(attr)for(let i=0;i<attr.count;i++)colors.add([attr.getX(i),attr.getY(i),attr.getZ(i)].map(v=>Math.round(v*255)).join(','));
 const box=new THREE.Box3().setFromObject(m);const mats=(Array.isArray(m.material)?m.material:[m.material]) as THREE.MeshStandardMaterial[];
 meshes.push({name:m.name,group,triangles:n,vertices:g.attributes.position.count,colors:colors.size,bounds:[box.min.toArray(),box.max.toArray()],materials:mats.map(mat=>({name:mat.name,roughness:mat.roughness,metalness:mat.metalness,opacity:mat.opacity,userData:mat.userData})),extras:m.userData});
});
const report={file:path,sha256:createHash('sha256').update(buf).digest('hex'),bytes:buf.byteLength,triangles,artTriangles,collisionTriangles,artDrawCallsBeforeRuntimeChunking:meshes.filter(m=>m.group==='ART').length,meshCount:meshes.length,materials:[...new Set(meshes.flatMap(m=>m.materials.map((x:any)=>x.name)))],meshes};
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,meshes:undefined},null,2));
