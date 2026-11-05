/** Full registered house-footprint support audit against shipped terrain and repair proxies. */
import * as THREE from 'three';
import {readFileSync,writeFileSync} from 'node:fs';
import {MeshBVH} from 'three-mesh-bvh';
import {regionLoader,bakeQuantized} from '../../../src/glb.ts';
const root=process.argv[2]??'/tmp/parhelion-exhaustive-final';
const d=JSON.parse(readFileSync(root+'/inventory.json','utf8')),rows:any[]=[];
let foundationSupportedSamples=0;
for(const region of ['britain','blacksail','winter','kyoto']) {
 const bytes=readFileSync(`public/assets/world_${region}.glb`);
 const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
 const terrain=gltf.scene.getObjectByName('Terrain') as THREE.Mesh;
 const tree=new MeshBVH(terrain.geometry.clone().applyMatrix4(terrain.matrixWorld));
 const foundation=gltf.scene.getObjectByName(`COL_${region==='kyoto'?'Kyoto_Hillside_Foundations':'Winter_House_Foundations'}`) as THREE.Mesh|undefined;
 const support=foundation?new MeshBVH(foundation.geometry.clone().applyMatrix4(foundation.matrixWorld)):null;
 for(const r of d.inventory.filter((r:any)=>r.region===region&&['townHouse','portHouse','winterHouse','addMachiyaCraft','addBurntCraft'].includes(r.kind))) {
  const[_,x,y,z,ry,w,depth]=r.args;let min=Infinity,max=-Infinity,missing=0,supported=0;const unresolved:any[]=[];
  for(const u of[-.49,-.25,0,.25,.49])for(const v of[-.49,-.25,0,.25,.49]) {
   const px=x+Math.cos(ry)*u*w+Math.sin(ry)*v*depth,pz=z-Math.sin(ry)*u*w+Math.cos(ry)*v*depth;
   const hit=tree.raycastFirst(new THREE.Ray(new THREE.Vector3(px,500,pz),new THREE.Vector3(0,-1,0)),THREE.DoubleSide);
   if(!hit){missing++;continue;}const gap=y-hit.point.y;min=Math.min(min,gap);max=Math.max(max,gap);
   if(gap<=.15)continue;
   const ray=new THREE.Ray(new THREE.Vector3(px,500,pz),new THREE.Vector3(0,-1,0));
   const faces=support?.raycast(ray,THREE.DoubleSide).sort((a,b)=>a.distance-b.distance)??[];
   // A single closed support must span the complete exposed interval. Merely
   // intersecting some unrelated geometry above/below the house is insufficient.
   let continuous=false;
   for(let i=0;i+1<faces.length;i+=2)if(faces[i].point.y>=y-.05&&faces[i+1].point.y<=hit.point.y+.05)continuous=true;
   if(continuous){supported++;foundationSupportedSamples++;}else unresolved.push({x:px,z:pz,terrainY:hit.point.y,baseY:y,gap});
  }
  rows.push({id:r.id,region,kind:r.kind,x,y,z,minBaseMinusTerrain:min,maxBaseMinusTerrain:max,missingTerrainSamples:missing,foundationSupportedSamples:supported,unresolved,review:missing||unresolved.length?'needs-review':'supported'});
 }
}
const report={houses:rows.length,samples:rows.length*25,foundationSupportedSamples,requiresReview:rows.filter(r=>r.review==='needs-review'),rows};
writeFileSync(root+'/ground-findings.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({houses:rows.length,samples:report.samples,foundationSupportedSamples,requiresReview:report.requiresReview},null,2));
if(report.requiresReview.length)process.exitCode=1;
