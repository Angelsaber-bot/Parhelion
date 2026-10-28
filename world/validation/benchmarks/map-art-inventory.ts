/** Actual asset inventory and static eligibility proof, without rendering or texture upload. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {regionLoader,bakeQuantized} from '../../src/glb.ts';
import {isStaticArtEligible} from '../../src/chunk.ts';
const result=[];
for(const region of ['alpha','britain','blacksail','winter','kyoto']){
 const bytes=readFileSync(`public/assets/world_${region}.glb`),gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(gltf.scene);
 const art=gltf.scene.getObjectByName('ART')!;let meshes=0,triangles=0,staticEligible=0;const protectedObjects:any[]=[];
 art.traverse(object=>{const m=object as THREE.Mesh;if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
 if(isStaticArtEligible(m))staticEligible++;else protectedObjects.push({name:m.name,userData:m.userData,parent:m.parent?.name});});
 result.push({region,sha256:createHash('sha256').update(bytes).digest('hex'),meshes,triangles,staticEligible,protectedObjects});
}
console.log(JSON.stringify(result,null,2));if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2));
