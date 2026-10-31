/** Independent production scene inventory. NOT WebGL draw calls, GPU memory or FPS.
 * Usage (world cwd): node --expose-gc --import tsx validation/runtime-scene-audit.ts [report.json]
 * Reads actual runtime objects using the explicit NON-GPU boot adapter. Frustum candidates
 * exclude hidden ancestry and camera layers, but do not model occlusion/shadow/post passes.
 */
import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

type Count = {objects:number;meshes:number;visibleMeshes:number;frustumMeshes:number;candidateMaterialGroups:number;candidateTriangles:number;skinnedMeshes:number;lights:number;geometries:Set<THREE.BufferGeometry>;materials:Set<THREE.Material>;buffers:Set<ArrayBufferLike>};
const empty = ():Count=>({objects:0,meshes:0,visibleMeshes:0,frustumMeshes:0,candidateMaterialGroups:0,candidateTriangles:0,skinnedMeshes:0,lights:0,geometries:new Set(),materials:new Set(),buffers:new Set()});
function inventory(scene:THREE.Scene,camera:THREE.Camera){
 scene.updateMatrixWorld();camera.updateMatrixWorld();
 const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const total=empty(),groups=new Map<string,Count>();
 for(const root of scene.children){
  const name=root.name||root.type;const count=groups.get(name)??empty();groups.set(name,count);
  root.traverse(object=>{
   const mesh=object as THREE.Mesh;let visible=true;for(let p:THREE.Object3D|null=object;p;p=p.parent)visible&&=p.visible;
   for(const c of [count,total]){
    c.objects++;if((object as THREE.Light).isLight)c.lights++;
    if(!mesh.isMesh)continue;c.meshes++;if((mesh as THREE.SkinnedMesh).isSkinnedMesh)c.skinnedMeshes++;
    c.geometries.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])c.materials.add(material);
    if(!visible)continue;c.visibleMeshes++;
    if(!object.layers.test(camera.layers)||(object.frustumCulled&&!frustum.intersectsObject(mesh)))continue;c.frustumMeshes++;
    const geometry=mesh.geometry,totalElements=geometry.index?.count??geometry.attributes.position?.count??0;
    const range=geometry.drawRange,instances=(mesh as THREE.InstancedMesh).isInstancedMesh?(mesh as THREE.InstancedMesh).count:1;
    const draw=(start:number,length:number,material:THREE.Material|undefined)=>{if(!material?.visible)return;const elements=Math.max(0,Math.min(start+length,range.start+range.count,totalElements)-Math.max(start,range.start));if(!elements||!instances)return;c.candidateMaterialGroups++;c.candidateTriangles+=elements/3*instances;};
    if(Array.isArray(mesh.material)){for(const group of geometry.groups)draw(group.start,group.count,mesh.material[group.materialIndex??0]);}else draw(0,totalElements,mesh.material);
   }
  });
 }
 const finish=(c:Count)=>{
  for(const g of c.geometries){for(const attr of Object.values(g.attributes)){const a=attr as THREE.BufferAttribute|THREE.InterleavedBufferAttribute;const array=(a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute?(a as THREE.InterleavedBufferAttribute).data.array:(a as THREE.BufferAttribute).array;c.buffers.add(array.buffer);}if(g.index)c.buffers.add(g.index.array.buffer);}
  const {geometries,materials,buffers,...counts}=c;return{...counts,geometries:geometries.size,materials:materials.size,uniqueGeometryBackingBytes:[...buffers].reduce((n,b)=>n+b.byteLength,0)};
 };
 return{total:finish(total),groups:[...groups].map(([name,c])=>({name,...finish(c)})).sort((a,b)=>b.uniqueGeometryBackingBytes-a.uniqueGeometryBackingBytes)};
}
const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true});
try{
 const {world,window}=h;let now=0;
 (window.document.getElementById('start') as HTMLElement).click();await Promise.resolve();
 const samples=[];
 const scenarios: [string,number,number][] = process.env.WORLD_AUDIT_SCENARIOS ? JSON.parse(readFileSync(process.env.WORLD_AUDIT_SCENARIOS,'utf8')) : process.env.WORLD_AUDIT_SITES==='1' ? world.campaignSites.sites.map((site:any)=>['site_'+site.region,site.origin[0],site.origin[2]+4]) : [['valley_hq',3,159],['britain_town',-720,0],['blacksail_port',720,0],['winter_pack',-120,-680],['kyoto_node',100,560]];
 if(process.env.WORLD_AUDIT_SCENARIOS_OUT)writeFileSync(process.env.WORLD_AUDIT_SCENARIOS_OUT,JSON.stringify(scenarios));
 for(const [name,x,z]of scenarios){
  world.player.teleport(x,world.ground(x,z)+.02,z);world.player.yaw=0;world.player.pitch=0;
  for(let i=0;i<60;i++){world.combat.state.hp=100;h.frame(now+=1000/60);}
  await h.settleAssets();h.frame(now+=1000/60);
  for(const aspect of [16/9,9/16]){world.camera.aspect=aspect;world.camera.updateProjectionMatrix();samples.push({name,aspect,player:world.player.pos.toArray(),camera:world.camera.position.toArray(),...inventory(world.scene,world.camera)});}
 }
 globalThis.gc?.();
 const report={scope:'NON-GPU production runtime, low effects + no post. Candidate groups approximate only a single camera scene pass; not WebGL draw calls, GPU allocation, pixel quality or FPS. Geometry buffers are unique JS backing stores, not VRAM. Per-root bytes share resources and must not be summed.',worldRoot:process.env.WORLD_SOURCE_QA_ROOT??'fixture-local default',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',cwd:process.env.WORLD_SOURCE_QA_ROOT}).trim(),dirty:execFileSync('git',['status','--short'],{encoding:'utf8',cwd:process.env.WORLD_SOURCE_QA_ROOT}),node:process.version,samples,memory:process.memoryUsage(),errors:h.errors,warnings:h.warnings.map(a=>a.map(String))};
 const json=JSON.stringify(report,null,2);if(process.argv[2])writeFileSync(process.argv[2],json);console.log(json);
}finally{await h.close();}
