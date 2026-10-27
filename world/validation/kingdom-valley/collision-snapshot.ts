/** Freeze exact ordered world-space collision triangle positions, transforms and gameplay extras. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {regionLoader,bakeQuantized} from '../../src/glb.ts';
export async function collisionSnapshot(path:string){
 const bytes=readFileSync(path),gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
 const meshes:any[]=[];gltf.scene.getObjectByName('COLLISION')!.traverse(o=>{
  const m=o as THREE.Mesh;if(!m.isMesh)return;const g=m.geometry,a=g.attributes.position,count=g.index?.count??a.count;
  const values=new Float64Array(count*3),v=new THREE.Vector3();
  for(let i=0;i<count;i++){v.fromBufferAttribute(a,g.index?g.index.getX(i):i).applyMatrix4(m.matrixWorld);values.set(v.toArray(),i*3);}
  meshes.push({name:m.name,triangles:count/3,orderedPositionHash:createHash('sha256').update(new Uint8Array(values.buffer)).digest('hex'),worldMatrix:m.matrixWorld.toArray(),extras:m.userData});
 });return meshes;
}
if(process.argv[1]?.endsWith('collision-snapshot.ts')){const out=await collisionSnapshot(process.argv[2]);writeFileSync(process.argv[3],JSON.stringify(out,null,2));console.log(out.map(x=>({name:x.name,triangles:x.triangles})));}
