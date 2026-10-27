/** Exact decoded attribute/winding multiset comparison across lossless index optimization. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {regionLoader,bakeQuantized} from '../../src/glb.ts';
const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
async function inspect(path:string){
 const bytes=readFileSync(path);const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
 const meshes:any[]=[]; const nodes:any[]=[];
 gltf.scene.traverse(o=>{nodes.push({name:o.name,matrix:o.matrixWorld.toArray(),extras:o.userData});const m=o as THREE.Mesh;if(!m.isMesh)return;
 const g=m.geometry;const names=Object.keys(g.attributes).sort();const n=g.attributes.position.count;
 const vertexHashes:string[]=[];
 for(let i=0;i<n;i++){const values:number[]=[];for(const name of names){const a=g.attributes[name];for(let k=0;k<a.itemSize;k++)values.push(a.getComponent(i,k));}vertexHashes.push(hash(new Uint8Array(new Float64Array(values).buffer)));}
 const tris:string[]=[];const count=g.index?.count??n;
 for(let i=0;i<count;i+=3){const v=[0,1,2].map(k=>vertexHashes[g.index?g.index.getX(i+k):i+k]);const start=v[0]<=v[1]&&v[0]<=v[2]?0:v[1]<=v[2]?1:2;tris.push(hash(v[start]+v[(start+1)%3]+v[(start+2)%3]));}
 const orderedTriangleAttributeHash=hash(tris.join(''));tris.sort();const mats=(Array.isArray(m.material)?m.material:[m.material]).map(x=>{const a=x as THREE.MeshStandardMaterial;return {name:a.name,color:a.color?.toArray(),roughness:a.roughness,metalness:a.metalness,opacity:a.opacity,transparent:a.transparent,side:a.side,vertexColors:a.vertexColors,userData:a.userData};});
 meshes.push({name:m.name,...(mats.some(x=>x.name==='M_Collision')?{orderedTriangleAttributeHash}:{}),triangles:count/3,attributes:names.map(name=>({name,itemSize:g.attributes[name].itemSize})),orientedTriangleAttributeHash:hash(tris.join('')),materials:mats});
 });
 meshes.sort((a,b)=>a.name.localeCompare(b.name));nodes.sort((a,b)=>a.name.localeCompare(b.name));return{path,sha256:hash(bytes),bytes:bytes.length,meshes,nodes};
}
const before=await inspect(process.argv[2]);const after=await inspect(process.argv[3]);const equal=JSON.stringify(before.meshes)===JSON.stringify(after.meshes)&&JSON.stringify(before.nodes)===JSON.stringify(after.nodes);
const result={equivalent:equal,method:'Decoded exact attribute values, oriented triangle multiset SHA256 per mesh, world transforms, node extras, material properties; collision triangle sequence also exact. ART index/triangle order excluded.',before,after};writeFileSync(process.argv[4],JSON.stringify(result,null,2));console.log(JSON.stringify({equivalent:equal,beforeSha256:before.sha256,afterSha256:after.sha256,beforeBytes:before.bytes,afterBytes:after.bytes,differentMeshes:before.meshes.filter((m,i)=>JSON.stringify(m)!==JSON.stringify(after.meshes[i])).map(m=>m.name),nodesEqual:JSON.stringify(before.nodes)===JSON.stringify(after.nodes)},null,2));if(!equal)process.exitCode=1;
