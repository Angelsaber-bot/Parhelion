/** Single-camera geometry/material candidate audit + optional retained-heap snapshot.
 * NOT actual renderer draw calls, fragment time, GPU memory or device FPS. */
import * as THREE from 'three';
import {writeFileSync} from 'node:fs';
import {writeHeapSnapshot} from 'node:v8';
import {execFileSync} from 'node:child_process';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {isStaticArtEligible} from '../src/chunk';
function geometryBuffers(g:THREE.BufferGeometry){const b=new Set<ArrayBufferLike>();for(const a of Object.values(g.attributes)){const array=(a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute?(a as THREE.InterleavedBufferAttribute).data.array:(a as THREE.BufferAttribute).array;b.add(array.buffer);}if(g.index)b.add(g.index.array.buffer);return b;}
function audit(scene:THREE.Scene,camera:THREE.Camera){
 scene.updateMatrixWorld();camera.updateMatrixWorld();const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const rows:any[]=[],bufferOwners=new Map<ArrayBufferLike,Set<string>>(),materialUses=new Map<THREE.Material,number>();
 scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
  for(const b of geometryBuffers(mesh.geometry)){const owners=bufferOwners.get(b)??new Set();owners.add(mesh.name||mesh.type);bufferOwners.set(b,owners);}
  for(let p:THREE.Object3D|null=mesh;p;p=p.parent)if(!p.visible)return;
  if(!mesh.layers.test(camera.layers)||(mesh.frustumCulled&&!frustum.intersectsObject(mesh)))return;
  const path:string[]=[];for(let p:THREE.Object3D|null=mesh;p;p=p.parent)path.unshift(p.name||p.type);
  const g=mesh.geometry,n=g.index?.count??g.attributes.position?.count??0,range=g.drawRange;
  if(!g.boundingSphere)g.computeBoundingSphere();const sphere=g.boundingSphere!.clone().applyMatrix4(mesh.matrixWorld);const nearestSphereDistance=Math.max(0,sphere.center.distanceTo(camera.position)-sphere.radius);
  const draw=(start:number,count:number,material:THREE.Material|undefined)=>{
   if(!material?.visible)return;const elements=Math.max(0,Math.min(n,start+count,range.start+range.count)-Math.max(start,range.start));if(!elements)return;
   const m=material as THREE.MeshStandardMaterial;materialUses.set(material,(materialUses.get(material)??0)+1);
   rows.push({name:mesh.name,path:path.join('/'),triangles:elements/3*((mesh as THREE.InstancedMesh).isInstancedMesh?(mesh as THREE.InstancedMesh).count:1),materialName:m.name||'(unnamed)',materialType:m.type,shaderKey:m.customProgramCacheKey().slice(0,180),transparent:m.transparent,side:m.side,color:m.color?.getHexString(),vertexColors:m.vertexColors,outline:mesh.name.endsWith('__outline'),staticArt:isStaticArtEligible(mesh)&&path.includes('ART'),nearestSphereDistance,sphereRadius:sphere.radius,sphereCenter:sphere.center.toArray(),distance:mesh.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position),geometryPositionBytes:g.attributes.position.array.byteLength});
  };
  if(Array.isArray(mesh.material)){for(const group of g.groups)draw(group.start,group.count,mesh.material[group.materialIndex??0]);}else draw(0,n,mesh.material);
 });
 const aggregate=(key:(r:any)=>string)=>{const map=new Map<string,{key:string;groups:number;triangles:number}>();for(const r of rows){const k=key(r),v=map.get(k)??{key:k,groups:0,triangles:0};v.groups++;v.triangles+=r.triangles;map.set(k,v);}return [...map.values()].sort((a,b)=>b.triangles-a.triangles);};
 return{candidates:rows,candidateGroups:rows.length,candidateTriangles:rows.reduce((n,r)=>n+r.triangles,0),distinctVisibleMaterialIdentities:materialUses.size,byMeshName:aggregate(r=>r.name),byMaterialShader:aggregate(r=>`${r.materialType}:${r.materialName}:${r.shaderKey}`),topCandidates:[...rows].sort((a,b)=>b.triangles-a.triangles).slice(0,35),largestBackingBuffers:[...bufferOwners].map(([b,names])=>({bytes:b.byteLength,owners:[...names].slice(0,12),ownerNames:names.size})).sort((a,b)=>b.bytes-a.bytes).slice(0,20),outlines:{groups:rows.filter(r=>r.outline).length,triangles:rows.filter(r=>r.outline).reduce((n,r)=>n+r.triangles,0)},immutableArt:{groups:rows.filter(r=>r.staticArt).length,triangles:rows.filter(r=>r.staticArt).reduce((n,r)=>n+r.triangles,0)}};
}
const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true});
try{const{world:w,window}=h;let now=0;(window.document.getElementById('start')as HTMLElement).click();await Promise.resolve();const samples=[];
 for(const[name,x,z]of[['valley_hq',3,159],['kyoto_busy',100,560],['kyoto_south',60,950]]as const){w.player.teleport(x,w.ground(x,z)+.02,z);w.player.yaw=0;w.player.pitch=0;for(let i=0;i<60;i++){w.combat.state.hp=100;h.frame(now+=1000/60);}await h.settleAssets();h.frame(now+=1000/60);w.camera.aspect=16/9;w.camera.updateProjectionMatrix();samples.push({name,player:w.player.pos.toArray(),...audit(w.scene,w.camera)});}
 globalThis.gc?.();const memory=process.memoryUsage();const colliderGeometries=w.colliders.map((c:any)=>({name:c.name,triangles:(c.bvh.geometry.index?.count??c.bvh.geometry.attributes.position.count)/3,backingBytes:[...geometryBuffers(c.bvh.geometry)].reduce((n,b)=>n+b.byteLength,0)})).sort((a:any,b:any)=>b.backingBytes-a.backingBytes);
 const report={scope:'NON-GPU low-effect production scene camera candidates. Shader labels are source paths, not measured GPU costs. Immutable eligibility is diagnostic only; no batching/culling/material mutation performed.',sourceRoot:process.env.WORLD_SOURCE_QA_ROOT,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:process.env.WORLD_SOURCE_QA_ROOT,encoding:'utf8'}).trim(),samples,colliderGeometries,memory,errors:h.errors};writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify({commit:report.commit,memory,errors:h.errors}));
 if(process.env.WORLD_AUDIT_HEAP)console.log('Heap snapshot',writeHeapSnapshot(process.env.WORLD_AUDIT_HEAP));
}finally{await h.close();}
