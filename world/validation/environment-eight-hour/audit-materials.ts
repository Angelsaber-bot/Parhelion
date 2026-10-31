/** Source-material audit only: dark albedo is not proof of a runtime rendering defect. */
import * as THREE from 'three';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {regionLoader,bakeQuantized} from '../../src/glb';
import {REGIONS} from '../../src/regions';
const out='../../parhelion-eight-hour-evidence/environment/material-audit';await mkdir(out,{recursive:true});
const results:any[]=[];
for(const def of REGIONS){
 const bytes=await readFile(`public/assets/${def.file}.glb`),gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(gltf.scene);gltf.scene.position.set(def.offset[0],0,def.offset[1]);gltf.scene.updateMatrixWorld(true);
 const rows:any[]=[],errors:string[]=[],materials=new Set<THREE.Material>();let meshCount=0,triangles=0;
 gltf.scene.getObjectByName('ART')!.traverse(o=>{
  if(!(o instanceof THREE.Mesh))return;meshCount++;const g:THREE.BufferGeometry=o.geometry,p=g.attributes.position,n=g.attributes.normal,ix=g.index,c=g.attributes.color,slots=Array.isArray(o.material)?o.material:[o.material],count=ix?.count??p.count;triangles+=count/3;
  if(!n)errors.push(`${o.name}: missing normals`);if(!slots.length)errors.push(`${o.name}: no material slots`);
  for(const a of Object.values(g.attributes))for(let i=0;i<a.array.length;i++)if(!Number.isFinite(a.array[i])){errors.push(`${o.name}: non-finite attribute`);break;}
  const groups=g.groups.length?g.groups:[{start:0,count,materialIndex:0}];
  for(const group of groups){const m=slots[group.materialIndex??0] as THREE.MeshStandardMaterial|undefined;if(!m){errors.push(`${o.name}: invalid material slot ${group.materialIndex}`);continue;}materials.add(m);
   const base=m.color?.toArray()??[1,1,1],samples=Math.min(512,group.count),average=[0,0,0];let dark=0,badNormals=0;
   for(let j=0;j<samples;j++){const at=group.start+Math.min(group.count-1,Math.floor((j+.5)*group.count/samples)),index=ix?ix.getX(at):at;if(index>=p.count){errors.push(`${o.name}: out-of-range vertex ${index}`);continue;}
    const color=base.map((v,k)=>v*(m.vertexColors&&c?(k===0?c.getX(index):k===1?c.getY(index):c.getZ(index)):1));for(let k=0;k<3;k++)average[k]+=color[k]/samples;
    if(.2126*color[0]+.7152*color[1]+.0722*color[2]<.003)dark++;
    if(n&&Math.hypot(n.getX(index),n.getY(index),n.getZ(index))<.8)badNormals++;
   }
   const bounds=new THREE.Box3().setFromObject(o);rows.push({mesh:o.name,material:m.name,triangles:group.count/3,vertexColors:!!m.vertexColors,baseColor:base,effectiveAlbedoAverage:average,nearBlackFraction:dark/samples,normalIssueFraction:badNormals/samples,emissive:m.emissive?.toArray()??null,emissiveIntensity:m.emissiveIntensity??0,opacity:m.opacity,transparent:m.transparent,textured:!!m.map,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},semanticDarkHint:/char|burn|ash|soot|coal|iron|shadow|dark|炭|焦/i.test(`${o.name} ${m.name}`)});
  }
 });
 const flagged=rows.filter(r=>!r.material||r.nearBlackFraction>.5||r.normalIssueFraction>0),summary={region:def.id,meshCount,triangles,materialCount:materials.size,unnamed:rows.filter(r=>!r.material).length,nearBlack:rows.filter(r=>r.nearBlackFraction>.5).length,normalIssues:rows.filter(r=>r.normalIssueFraction>0).length,errors};
 results.push({summary,flagged,rows});console.log(JSON.stringify(summary));
 gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});for(const m of materials)m.dispose();
}
await writeFile(`${out}/production-materials.json`,JSON.stringify(results,null,2));
if(results.some(r=>r.summary.errors.length))process.exitCode=1;
