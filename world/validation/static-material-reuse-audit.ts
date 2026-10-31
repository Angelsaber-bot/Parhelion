/** Read-only authored source-material identity audit. No runtime caching/batching. */
import * as THREE from 'three';
import {readFileSync,writeFileSync}from'node:fs';
import{regionLoader,bakeQuantized}from'../src/glb';
import{REGIONS}from'../src/regions';
import{isStaticArtEligible}from'../src/chunk';
import{toonMaterial}from'../src/look';
const report=[];
for(const def of REGIONS){
 const bytes=readFileSync(`public/assets/${def.file}.glb`),gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(gltf.scene);
 const sources=new Map<THREE.Material,{meshes:string[];triangles:number}>();const excluded:string[]=[];
 gltf.scene.getObjectByName('ART')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;
  // Keep all stateful/interactive/animated shader-special material families private.
  if(!isStaticArtEligible(m)||/halo|gate|door|core|beam|target|water/i.test(m.name)||Array.isArray(m.material)||m.material.transparent||m.material.opacity!==1||m.material.blending!==THREE.NormalBlending||/Water|Beam|Halo|Target|Emissive/.test(m.material.name)){excluded.push(m.name);return;}
  const src=m.material,v=sources.get(src)??{meshes:[],triangles:0};v.meshes.push(m.name);v.triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;sources.set(src,v);
 });
 const groups=[...sources].map(([source,v])=>{const converted=toonMaterial(source);const row={sourceName:source.name,sourceIdentity:source.uuid,conversions:v.meshes.length,avoidableConversions:v.meshes.length-1,meshes:v.meshes,triangles:v.triangles,shaderKey:converted.customProgramCacheKey(),transparent:converted.transparent};converted.dispose();return row;});
 report.push({region:def.id,eligibleMeshes:groups.reduce((n,g)=>n+g.conversions,0),sourceMaterials:sources.size,avoidableConversions:groups.reduce((n,g)=>n+g.avoidableConversions,0),groups:groups.filter(g=>g.conversions>1).sort((a,b)=>b.conversions-a.conversions),excluded});
}
writeFileSync(process.argv[2],JSON.stringify({scope:'Source material identity reuse potential only. No draw-call reduction or GPU/FPS claim; production unchanged. Dynamic/interactive/halo/water/beam/target/emissive excluded.',regions:report},null,2));console.log(report.map(({region,eligibleMeshes,sourceMaterials,avoidableConversions})=>({region,eligibleMeshes,sourceMaterials,avoidableConversions})));
