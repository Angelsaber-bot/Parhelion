import * as THREE from 'three';
import {regionLoader,bakeQuantized} from '../rendering/glb';
import {REGIONS,regionAt,regionDistance} from './regions';
import {chunkMesh,DistanceCuller,freezeStaticArt} from '../rendering/chunk';
import {toonMaterial,addOutline} from '../rendering/look';
interface Resident{root:THREE.Group;culler:DistanceCuller;geometries:Set<THREE.BufferGeometry>;materials:Set<THREE.Material>;lastUsed:number;
 /** Pieces whose buffers have not reached the GPU yet; they are revealed under a per-frame byte budget. */
 pending:{mesh:THREE.Mesh;c:THREE.Vector3}[];uploaded:Set<ArrayLike<number>>;}
export interface RegionStreamingOptions{parent:THREE.Object3D;outlines:boolean;lowQuality:boolean;eager?:boolean;now?:()=>number;status?:(region:string,error?:unknown)=>void;
 /** Optional per-mesh rework of immutable art before it is chunked (null keeps the mesh as shipped). */
 carve?:(region:string,name:string,geometry:THREE.BufferGeometry)=>THREE.BufferGeometry|null;
 /** Compiles the new art's shaders off the frame (renderer.compileAsync) before it is shown. */
 warm?:(root:THREE.Object3D)=>Promise<unknown>|void;
 /** Bytes of geometry a newly installed region may upload to the GPU per frame (default: everything at once). */
 uploadBudget?:number;}
/** Bytes a mesh's buffers will upload on its first draw. Chunks of one source mesh share its vertex
 * buffers, so a buffer is only charged to the first piece that draws it. */
const uploadBytes=(mesh:THREE.Mesh,seen:Set<ArrayLike<number>>)=>{const g=mesh.geometry;let n=0;
 for(const a of [g.index,...Object.values(g.attributes)] as (THREE.BufferAttribute|null)[]){const array=a?.array;if(array&&!seen.has(array)){seen.add(array);n+=array.byteLength;}}return n;};
/** Leaves/trunks/rocks are chunked in large dense cells: their ink line is sub-pixel well before
 * a building's, so it stops earlier (Kyoto: ~400k outline triangles past 170 m before this). */
export function streamedOutlineDistance(name: string) {
  return /^Trees_(Leaves|Trunks)$|^Trees$|^Leaves$/.test(name) ? 70 : name === 'Rocks' ? 90 : /Roof|Rakuchu/.test(name) ? 110 : Infinity;
}
/** Same reach as the valley's own art (main.ts DRAW_DIST): small props fade into fog well before 600 m. */
export function streamedDrawDistance(name:string){return /Bushes/.test(name)?180:/Trees_Trunks/.test(name)?260:/Rocks/.test(name)?320:/(Leaves|Trees)/.test(name)?380:/Glow/.test(name)?500:600;}
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
   // Record ownership before conversion: replacement materials and chunking detach
   // source resources, while outlines use global materials owned by look.ts.
   root.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){geometries.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);}});
   if(this.disposed||controller.signal.aborted){this.releaseResources(root,geometries,materials);return false;}
   bakeQuantized(root);root.traverse(o=>{if((o as THREE.Mesh).isMesh)geometries.add((o as THREE.Mesh).geometry);});root.name=`Streamed_${id}`;root.position.set(def.offset[0],0,def.offset[1]);
   const cache=new Map<THREE.Material,THREE.Material>(),culler=new DistanceCuller(this.options.lowQuality?90:160);
   const meshes:THREE.Mesh[]=[];root.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
   for(const mesh of meshes){const carved=this.options.carve?.(id,mesh.name,mesh.geometry);if(carved&&carved!==mesh.geometry){const original=mesh.geometry;mesh.geometry=carved;geometries.delete(original);original.dispose();this.counters.disposedGeometries++;}geometries.add(mesh.geometry);const source=mesh.material as THREE.Material;materials.add(source);let material=cache.get(source);if(!material){material=toonMaterial(source);cache.set(source,material);materials.add(material);}mesh.material=material;mesh.receiveShadow=true;mesh.castShadow=!/Terrain|Water|Bushes|Glow_Props/.test(mesh.name);
    const count=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;const pieces=count>4000?chunkMesh(mesh,64):[mesh];
    for(const piece of pieces){geometries.add(piece.geometry);if(this.options.outlines&&piece.userData.outline)addOutline(piece);culler.add(piece,streamedDrawDistance(piece.name),streamedOutlineDistance(piece.name));}
   }
   // Shaders compile in parallel before the art is shown, so crossing into an era never stalls a frame on them.
   // A renderer without async compile returns nothing, and the install continues in the same tick.
   let warming:Promise<unknown>|void;try{warming=this.options.warm?.(root);}catch{warming=undefined;}
   if(warming){await warming.catch(()=>undefined);if(this.disposed||controller.signal.aborted){this.releaseResources(root,geometries,materials);return false;}}
   const pending:Resident['pending']=[];if(this.options.uploadBudget)for(const it of culler.items){pending.push({mesh:it.mesh,c:it.c});it.mesh.visible=false;}
   this.options.parent.add(root);root.updateMatrixWorld(true);freezeStaticArt(root);
   this.residents.set(id,{root,culler,geometries,materials,lastUsed:this.clock(),pending,uploaded:new Set()});this.counters.installs++;this.failures.delete(id);this.options.status?.('');return true;
  }catch(error){if(root)this.releaseResources(root,geometries,materials);if(!this.disposed&&!controller.signal.aborted){this.failures.set(id,{error,retryAt:this.clock()+5});this.options.status?.(id,error);}return false;
  }finally{this.requests.delete(id);}})();
  this.requests.set(id,{controller,promise});return promise;
 }
 update(position:THREE.Vector3,eye:THREE.Vector3,scale=1){
  if(this.disposed)return;this.position.copy(position);const current=regionAt(position.x,position.z).id,now=this.clock();
  // Newly streamed pieces reach the GPU a few megabytes per frame (nearest first)
  // instead of all at once; a piece stays hidden until its turn.
  let budget=this.options.uploadBudget??Infinity;
  for(const[id,r]of this.residents){r.culler.update(eye,scale);if(id===current||regionDistance(REGIONS.find(d=>d.id===id)!,position)<120)r.lastUsed=now;
   if(r.pending.length){r.pending.sort((a,b)=>a.c.distanceToSquared(eye)-b.c.distanceToSquared(eye));
    r.pending=r.pending.filter(p=>{if(!p.mesh.visible)return true;if(budget>0){p.mesh.traverse(o=>{if((o as THREE.Mesh).isMesh)budget-=uploadBytes(o as THREE.Mesh,r.uploaded);});return false;}p.mesh.visible=false;return true;});if(!r.pending.length)r.uploaded.clear();}}
  if(this.options.eager)return;
  // At most current + one approach region; hysteresis avoids seam thrashing.
  const wanted=REGIONS.filter(d=>d.id===current||regionDistance(d,position)<120).sort((a,b)=>(a.id===current?-1:b.id===current?1:regionDistance(a,position)-regionDistance(b,position))).slice(0,2);
  for(const[id,r]of [...this.residents])if(!wanted.some(d=>d.id===id)&&now-r.lastUsed>12)this.evict(id);
  for(const[id,request]of this.requests)if(!wanted.some(d=>d.id===id)&&id!==current)request.controller.abort();
  if(!this.requests.size){const next=wanted.find(d=>!this.residents.has(d.id)&&(this.failures.get(d.id)?.retryAt??0)<=now);if(next){while(this.residents.size>=2){const victim=[...this.residents].filter(([id])=>id!==current).sort((a,b)=>a[1].lastUsed-b[1].lastUsed)[0];if(!victim)break;this.evict(victim[0]);}void this.ensure(next.id);}}
 }
 retry(id:string){this.failures.delete(id);return this.ensure(id);}
 private evict(id:string){const r=this.residents.get(id);if(!r)return;this.releaseResources(r.root,r.geometries,r.materials);r.culler.items.length=0;r.pending.length=0;r.uploaded.clear();this.residents.delete(id);this.counters.evictions++;}
 /** The decoded GLB and its replacements are exclusively owned by this request.
  * Gather geometry again to include any clone produced before preparation failed;
  * never gather materials here because generated outlines share a global cache. */
 private releaseResources(root:THREE.Object3D,geometries:Set<THREE.BufferGeometry>,materials:Set<THREE.Material>){
  root.traverse(o=>{if((o as THREE.Mesh).isMesh)geometries.add((o as THREE.Mesh).geometry);});
  root.removeFromParent();root.clear();
  for(const g of geometries){g.dispose();this.counters.disposedGeometries++;}
  for(const m of materials){m.dispose();this.counters.disposedMaterials++;}
  geometries.clear();materials.clear();
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const request of this.requests.values())request.controller.abort();for(const id of [...this.residents.keys()])this.evict(id);this.failures.clear();}
}
