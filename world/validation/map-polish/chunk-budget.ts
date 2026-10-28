/** Real runtime decoder + chunk builder, without pretending this is a GPU/FPS test.
 * node --import tsx validation/map-polish/chunk-budget.ts BEFORE_DIR AFTER_DIR OUT.json
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {regionLoader,bakeQuantized} from '../../src/glb.ts';
import {chunkMesh,isStaticArtEligible} from '../../src/chunk.ts';

export async function countPreparedArt(directory:string,region:string){
  const bytes=readFileSync(resolve(directory,`world_${region}.glb`));
  const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  bakeQuantized(gltf.scene);
  const meshes:THREE.Mesh[]=[];
  gltf.scene.getObjectByName('ART')!.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
  let chunks=0,outlineChunks=0,triangles=0;
  const byMesh:Record<string,number>={};
  for(const m of meshes){
    const tris=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
    const pieces=isStaticArtEligible(m)&&tris>4000?chunkMesh(m,64):[m];
    byMesh[m.name]=pieces.length;
    chunks+=pieces.length;triangles+=tris;
    if(m.userData.outline)outlineChunks+=pieces.length;
  }
  return {chunks,outlineChunks,triangles,byMesh};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const results={note:'Offline actual runtime decoder/chunkMesh counts. Not per-frame draw calls, shadow passes, GPU timing or FPS.',regions:{}} as {note:string;regions:Record<string,unknown>};
  for(const region of ['alpha','britain','blacksail','winter','kyoto']){
    const before=await countPreparedArt(process.argv[2],region),after=await countPreparedArt(process.argv[3],region);
    const delta={chunks:after.chunks-before.chunks,outlineChunks:after.outlineChunks-before.outlineChunks,triangles:after.triangles-before.triangles};
    results.regions[region]={before,after,delta};console.log(region,delta);
  }
  writeFileSync(process.argv[4],JSON.stringify(results,null,2)+'\n');
}
