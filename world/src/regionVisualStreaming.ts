import * as THREE from 'three';
import {regionLoader,bakeQuantized} from './glb';
import {REGIONS,regionAt,type RegionDef} from './regions';
import {chunkMesh,DistanceCuller,freezeStaticArt} from './chunk';
import {toonMaterial,addOutline} from './look';
interface Resident{root:THREE.Group;culler:DistanceCuller;geometries:Set<THREE.BufferGeometry>;materials:Set<THREE.Material>;lastUsed:number;}
export interface RegionStreamingOptions{parent:THREE.Object3D;outlines:boolean;lowQuality:boolean;eager?:boolean;now?:()=>number;status?:(region:string,error?:unknown)=>void;}
/** Same reach as the valley's own art (main.ts DRAW_DIST): small props fade into fog well before 600 m. */
export function streamedDrawDistance(name:string){return /Bushes/.test(name)?180:/Trees_Trunks/.test(name)?260:/Rocks/.test(name)?320:/(Leaves|Trees)/.test(name)?380:/Glow/.test(name)?500:600;}
const regionDistance=(def:RegionDef,p:Pick<THREE.Vector3,'x'|'z'>)=>Math.hypot(Math.max(0,Math.abs(p.x-def.offset[0])-360),Math.max(0,Math.abs(p.z-def.offset[1])-360));
/** Only heavyweight immutable art is streamed. Terrain, collision, interactive
 * surfaces and save facts have independent permanent ownership. */
export class RegionVisualStreaming{
 private residents=new Map<string,Resident>();private requests=new Map<string,{controller:AbortController;promise:Promise<boolean>}>();
 private failures=new Map<string,{retryAt:number;error:unknown}>();private disposed=false;private position=new THREE.Vector3();private clock:()=>number;
 readonly counters={downloads:0,installs:0,evictions:0,disposedGeometries:0,disposedMaterials:0};
 constructor(private options:RegionStreamingOptions){this.clock=options.now??(()=>performance.now()/1000);}
 ready(id:string){return this.residents.has(id);}
 get diagnostics(){return{resident:[...this.residents.keys()],pending:[...this.requests.keys()],failed:[...this.failures.keys()],...this.counters};}
 async ensure(id:string):Promise<boolean>{
  if(this.disposed)return false;const existing=this.residents.get(id);if(existing){existing.lastUsed=this.clock();return true;}
  if(this.requests.has(id))return this.requests.get(id)!.promise;
  const def=REGIONS.find(r=>r.id===id);if(!def)return false;const controller=new AbortController();
  const promise=(async()=>{let root:THREE.Group|undefined;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();try{
   this.counters.downloads++;this.options.status?.(id);
   const response=await fetch(`./assets/${def.file}.visual.glb`,{signal:controller.signal});if(!response.ok)throw Error(`Region art HTTP ${response.status}`);
   const bytes=await response.arrayBuffer();controller.signal.throwIfAborted();const gltf=await regionLoader().parseAsync(bytes,'');root=gltf.scene;
   if(this.disposed||controller.signal.aborted){this.disposeUninstalled(root);return false;}
   bakeQuantized(root);root.name=`Streamed_${id}`;root.position.set(def.offset[0],0,def.offset[1]);
   const cache=new Map<THREE.Material,THREE.Material>(),culler=new DistanceCuller(this.options.lowQuality?90:160);
   const meshes:THREE.Mesh[]=[];root.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
   for(const mesh of meshes){geometries.add(mesh.geometry);const source=mesh.material as THREE.Material;materials.add(source);let material=cache.get(source);if(!material){material=toonMaterial(source);cache.set(source,material);materials.add(material);}mesh.material=material;mesh.receiveShadow=true;mesh.castShadow=!/Terrain|Water|Bushes|Glow_Props/.test(mesh.name);
    const count=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;const pieces=count>4000?chunkMesh(mesh,64):[mesh];
    for(const piece of pieces){geometries.add(piece.geometry);if(this.options.outlines&&piece.userData.outline)addOutline(piece);culler.add(piece,streamedDrawDistance(piece.name));}
   }
   this.options.parent.add(root);root.updateMatrixWorld(true);freezeStaticArt(root);
   this.residents.set(id,{root,culler,geometries,materials,lastUsed:this.clock()});this.counters.installs++;this.failures.delete(id);this.options.status?.('');return true;
  }catch(error){if(root){root.removeFromParent();root.clear();}geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());if(!this.disposed&&!controller.signal.aborted){this.failures.set(id,{error,retryAt:this.clock()+5});this.options.status?.(id,error);}return false;
  }finally{this.requests.delete(id);}})();
  this.requests.set(id,{controller,promise});return promise;
 }
 update(position:THREE.Vector3,eye:THREE.Vector3,scale=1){
  if(this.disposed)return;this.position.copy(position);const current=regionAt(position.x,position.z).id,now=this.clock();
  for(const[id,r]of this.residents){r.culler.update(eye,scale);if(id===current||regionDistance(REGIONS.find(d=>d.id===id)!,position)<120)r.lastUsed=now;}
  if(this.options.eager)return;
  // At most current + one approach region; hysteresis avoids seam thrashing.
  const wanted=REGIONS.filter(d=>d.id===current||regionDistance(d,position)<120).sort((a,b)=>(a.id===current?-1:b.id===current?1:regionDistance(a,position)-regionDistance(b,position))).slice(0,2);
  for(const[id,r]of [...this.residents])if(!wanted.some(d=>d.id===id)&&now-r.lastUsed>12)this.evict(id);
  for(const[id,request]of this.requests)if(!wanted.some(d=>d.id===id)&&id!==current)request.controller.abort();
  if(!this.requests.size){const next=wanted.find(d=>!this.residents.has(d.id)&&(this.failures.get(d.id)?.retryAt??0)<=now);if(next){while(this.residents.size>=2){const victim=[...this.residents].filter(([id])=>id!==current).sort((a,b)=>a[1].lastUsed-b[1].lastUsed)[0];if(!victim)break;this.evict(victim[0]);}void this.ensure(next.id);}}
 }
 retry(id:string){this.failures.delete(id);return this.ensure(id);}
 private evict(id:string){const r=this.residents.get(id);if(!r)return;r.root.removeFromParent();r.root.clear();r.culler.items.length=0;for(const g of r.geometries){g.dispose();this.counters.disposedGeometries++;}for(const m of r.materials){m.dispose();this.counters.disposedMaterials++;}r.geometries.clear();r.materials.clear();this.residents.delete(id);this.counters.evictions++;}
 private disposeUninstalled(root:THREE.Object3D){const gs=new Set<THREE.BufferGeometry>(),ms=new Set<THREE.Material>();root.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){gs.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])ms.add(m);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());root.removeFromParent();root.clear();}
 dispose(){if(this.disposed)return;this.disposed=true;for(const request of this.requests.values())request.controller.abort();for(const id of [...this.residents.keys()])this.evict(id);this.failures.clear();}
}
