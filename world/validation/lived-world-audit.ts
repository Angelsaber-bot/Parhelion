/** Audit actual production world placement and interaction ownership; no GPU claims. */
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import * as THREE from 'three';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {CHESTS, markerChest} from '../src/exploration/catalog';
import {buildAlphaSettlement} from '../src/settlements/alpha';
import {buildBritainSettlement} from '../src/settlements/britain';
import {buildBlackSailSettlement} from '../src/settlements/blacksail';
import {buildWinterSettlement} from '../src/settlements/winter';
import {buildKyotoSettlement} from '../src/settlements/kyoto';

const out=resolve(process.argv[2]??'../_local/releases/world-quality-20261105/before');
await mkdir(out,{recursive:true});
const h=await bootWorldWithoutGpu({deterministic:true});
try{
 const w=h.world, ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
 const ground=(x:number,z:number,ceiling:number)=>{
  ray.origin.set(x,ceiling,z);let highest=-Infinity;
  for(const c of w.colliders)if(c.enabled){const hit=c.bvh.raycastFirst(ray,THREE.DoubleSide);if(hit)highest=Math.max(highest,hit.point.y);}
  return highest;
 };
 const chests=CHESTS.map(def=>{
  const rt=w.exploration.state.chests.get(def.id),m=w.layout.markers.find((m:any)=>m.id===markerChest(def.id));
  const y=rt.base.y, support=ground(def.p[0],def.p[1],y+14);
  // Record, rather than silently relocating onto an overhead building or tree.
  return{id:def.id,region:def.region,position:rt.base.toArray(),authoredFloor:def.y??null,surfaceAbove:support-y,requires:def.requires??null,owned:w.exploration.owns(m.id),marker:m.p};
 });
 const discovery=w.layout.markers.filter((m:any)=>m.type==='discovery').map((m:any)=>({id:m.id,label:m.label,position:m.p,interactive:w.exploration.owns(m.id)}));
 const residents:any[]=[];
 w.scene.traverse((o:THREE.Object3D)=>{if(!o.userData.settlementNpc)return;let triangles=0,meshes=0;const mats=new Set();o.traverse((m:any)=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;mats.add(m.material);}});residents.push({id:o.name,region:o.userData.region,position:o.getWorldPosition(new THREE.Vector3()).toArray(),height:new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).y,triangles,meshes,materials:mats.size});});
 const hubs=[buildAlphaSettlement,buildBritainSettlement,buildBlackSailSettlement,buildWinterSettlement,buildKyotoSettlement].map(build=>{
  const kit=build(),materials=new Set<THREE.Material>();let triangles=0,meshes=0;
  kit.group.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  return{id:kit.id,triangles,meshes,footprint:kit.footprint,materialSurfaces:[...new Set([...materials].map(m=>m.userData.craftSurface).filter(Boolean))]};
 });
 const markers=w.layout.markers.filter((m:any)=>m.type==='interact');
 const report={mode:'Production main + real GLBs/BVH, renderer stubbed; not visual QA',hubs,chests,discovery,residents,interactions:markers.length,duplicateInteractions:markers.filter((m:any,i:number)=>markers.findIndex((other:any)=>other.id===m.id)!==i).map((m:any)=>m.id),errors:h.errors};
 await writeFile(resolve(out,'audit.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({hubs,chests:chests.length,raisedChests:chests.filter((c:any)=>c.surfaceAbove>.8&&c.authoredFloor===null),legacyChestDiscoveries:discovery.filter((m:any)=>['secret_pillar','secret_cave'].includes(m.id)),residents:residents.length,interactions:markers.length,duplicates:report.duplicateInteractions,errors:h.errors},null,2));
}finally{await h.close();}
