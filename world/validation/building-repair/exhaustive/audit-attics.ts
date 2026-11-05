/** Every retained Kyoto attic, against the shipped compressed ART, no selected sample houses. */
import * as THREE from 'three';import{readFileSync,writeFileSync}from'node:fs';import{MeshBVH}from'three-mesh-bvh';
import{regionLoader,bakeQuantized}from'../../../src/glb.ts';import{Batch,T}from'../../../tools/gen/geo.ts';import{addKyotoRoof}from'../../../tools/gen/kyoto/architecture.ts';
const root=process.argv[2]??'/tmp/parhelion-exhaustive-final',d=JSON.parse(readFileSync(root+'/inventory.json','utf8')),active=new Set(d.components.flatMap((c:any)=>c.scope??[]));
const bytes=readFileSync('public/assets/world_kyoto.glb'),gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
const trees:MeshBVH[]=[];gltf.scene.getObjectByName('ART')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;const g=m.geometry.clone().applyMatrix4(m.matrixWorld);trees.push(new MeshBVH(g));});
const rows:any[]=[];let probes=0;const up=new THREE.Vector3(0,1,0),ray=new THREE.Ray();
for(const rec of d.records.filter((r:any)=>r.name==='addKyotoAttic'&&active.has(r.id))){const[_,x,y,z,ry,w,depth,rw,rd,rise,color,kind='gable']=rec.args;const matrix=T(x,y,z,ry),b=new Batch('probe');addKyotoRoof(b,0,0,0,0,rw,rd,rise,'#ffffff',kind,false);const roof=new THREE.Mesh(b.vis[0],new THREE.MeshBasicMaterial());const failures=[];
 for(const axis of[0,2])for(const side of[-1,1])for(const fraction of[-.8,-.4,0,.4,.8]){
  const wall=side*(axis===0?w:depth)/2,u=fraction*(axis===0?depth:w)/2;
  const foot=new THREE.Vector3(axis===0?wall:u,-.5,axis===0?u:wall),h=new THREE.Raycaster(foot,up).intersectObject(roof)[0]?.point.y;
  if(h===undefined)throw Error(`roof absent ${rec.id}`);if(h<.12)continue;
  const start=new THREE.Vector3(axis===0?wall+side*.2:u,Math.max(.035,h*.5),axis===0?u:wall+side*.2).applyMatrix4(matrix);
  const direction=new THREE.Vector3(axis===0?-side:0,0,axis===2?-side:0).transformDirection(matrix);
  ray.set(start,direction);let distance=Infinity;for(const tree of trees){const hit=tree.raycastFirst(ray,THREE.FrontSide,0,.35);if(hit)distance=Math.min(distance,hit.distance);}
  probes++;if(distance>.35)failures.push({axis,side,fraction,start:start.toArray(),roofHeight:h});
 }
 rows.push({id:rec.id,x,y,z,kind,failures});
}
const report={attics:rows.length,probes,failedAttics:rows.filter(r=>r.failures.length),rows};writeFileSync(root+'/attic-envelope-findings.json',JSON.stringify(report,null,2));console.log(JSON.stringify({attics:rows.length,probes,failedAttics:report.failedAttics.length,examples:report.failedAttics.slice(0,3)},null,2));
if(report.failedAttics.length)process.exitCode=1;
