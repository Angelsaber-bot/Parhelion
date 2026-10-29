/** Offline visual/geometry audit of actual runtime settlement builders; not a browser capture. */
import * as THREE from 'three';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createSettlementNpcs} from '../../src/settlements/npcs.ts';
import type {SettlementKit} from '../../src/settlements/types.ts';
const out=process.argv[2]??'../docs/settlements-20261029/meshes';
await mkdir(out,{recursive:true});
const names=[['alpha','buildAlphaSettlement'],['britain','buildBritainSettlement'],['blacksail','buildBlackSailSettlement'],['winter','buildWinterSettlement'],['kyoto','buildKyotoSettlement']];
const report:any[]=[];
for(const [id,build] of names){
 if(process.argv[3]&&!process.argv[3].split(',').includes(id))continue;
 const module=await import(`../../src/settlements/${id}.ts`);const kit:SettlementKit=module[build]();
 const residents=createSettlementNpcs(kit.npcs.map(n=>({...n,region:kit.id})));kit.group.add(residents.group);kit.group.updateMatrixWorld(true);const lights:any[]=[];kit.group.traverse(o=>{const l=o as THREE.PointLight;if(l.isPointLight)lights.push({position:l.getWorldPosition(new THREE.Vector3()).toArray(),color:l.color.toArray(),intensity:l.intensity,distance:l.distance});});const meshes:any[]=[];let vertices=0,triangles=0,solids=0;const materialIds=new Set();
 const p=new THREE.Vector3();
 kit.group.traverse((obj)=>{const mesh=obj as THREE.Mesh;if(!mesh.isMesh)return;const pos=mesh.geometry.getAttribute('position');const idx=mesh.geometry.index;
  const positions=new Float32Array(pos.count*3);for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);positions.set(p.toArray(),i*3);}
  const colors=new Float32Array(pos.count*3).fill(1);const colorAttr=mesh.geometry.getAttribute('color');if(colorAttr)for(let i=0;i<pos.count;i++){colors[i*3]=colorAttr.getX(i);colors[i*3+1]=colorAttr.getY(i);colors[i*3+2]=colorAttr.getZ(i);}
  const indices=new Uint32Array(idx?Array.from(idx.array):Array.from({length:pos.count},(_,i)=>i));
  const materials=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(mat=>{materialIds.add(mat.uuid);const m=mat as THREE.MeshStandardMaterial;return {name:m.name,vertexColors:m.vertexColors,color:m.color?.toArray()??[.5,.5,.5],roughness:m.roughness??.7,metalness:m.metalness??0,emissive:m.emissive?.toArray()??[0,0,0],emissiveIntensity:m.emissiveIntensity??0,opacity:m.opacity,transparent:m.transparent};});
  const file=`${id}-${meshes.length}.bin`;meshes.push({name:mesh.name,file,count:pos.count,indices:indices.length,materials,groups:mesh.geometry.groups,solid:!!mesh.userData.solid,data:Buffer.concat([Buffer.from(positions.buffer),Buffer.from(colors.buffer),Buffer.from(indices.buffer)])});
  vertices+=pos.count;triangles+=indices.length/3;if(mesh.userData.solid)solids++;
 });
 for(const mesh of meshes){await writeFile(path.join(out,mesh.file),mesh.data);delete mesh.data;}
 const bounds=new THREE.Box3().setFromObject(kit.group);const row={id,name:kit.name,meshes:meshes.length,vertices,triangles,materials:materialIds.size,solids,footprint:kit.footprint,entry:kit.entry,npcs:kit.npcs,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
 await writeFile(path.join(out,`${id}.json`),JSON.stringify({...row,meshes,lights}));report.push(row);console.log(JSON.stringify(row));
}
await writeFile(path.join(path.dirname(out),'geometry-audit.json'),JSON.stringify(report,null,2));
