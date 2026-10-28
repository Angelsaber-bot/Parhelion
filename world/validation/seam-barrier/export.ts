import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../../src/glb.ts';
import { SEAM_BARRIERS, seamBarrierSegments } from '../../tools/gen/valley/seam-barrier.ts';
import { heightFn } from '../../tools/gen/terrain.ts';
const path=new URL('../../public/assets/world_alpha.glb',import.meta.url);
const bytes=readFileSync(path), gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
const data={source:'world/public/assets/world_alpha.glb',sha256:createHash('sha256').update(bytes).digest('hex'),note:'Decoded actual production asset; additive beam lighting approximated for offline Blender preview, not WebGL.',gates:SEAM_BARRIERS.map(s=>{
  const col=gltf.scene.getObjectByName(`COL_Seam_${s.id}_Gate`) as THREE.Mesh;
  const b=new THREE.Box3().setFromObject(col),base=s.base??heightFn(...s.center);
  const old=s.id==='west'?[[-334.5,-50],[-334.5,-10]]:s.id==='east'?[[342.5,10],[342.5,50]]:s.id==='north'?[[-50,-342],[50,-342]]:[[-10,342],[90,342]];
  return {...s,base,segments:seamBarrierSegments(s),old,bounds:{min:b.min.toArray(),max:b.max.toArray()},
    eye:[s.center[0]+s.inward[0]*31,base+3.2,s.center[1]+s.inward[1]*31],target:[s.center[0],base+6,s.center[1]]};
})};
writeFileSync(new URL('./geometry.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
