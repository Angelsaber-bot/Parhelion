/** Non-mutating check of authored building material intent through the live toon adapter. */
import * as THREE from 'three';import {toonMaterial} from '../../src/look';import{writeFile,mkdir}from'node:fs/promises';
const results:any[]=[];
for(const [region,builder]of [['alpha','buildAlphaSettlement'],['britain','buildBritainSettlement'],['blacksail','buildBlackSailSettlement'],['winter','buildWinterSettlement'],['kyoto','buildKyotoSettlement']]){
 const module=await import(`../../src/settlements/${region}.ts`),kit=module[builder](),seen=new Map<THREE.Material,string[]>();kit.group.traverse((o:THREE.Object3D)=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])seen.set(m,[...(seen.get(m)??[]),o.name]);});const issues:any[]=[];
 for(const[source,meshes]of seen){const s=source as THREE.MeshStandardMaterial,t=toonMaterial(s) as THREE.MeshToonMaterial,lost:string[]=[];
  if(s.emissive?.getHex()&&s.emissiveIntensity>0&&(!t.emissive?.getHex()||t.emissiveIntensity!==s.emissiveIntensity))lost.push('emissive');
  for(const property of['side','transparent','opacity','alphaTest','depthWrite','map']as const)if(s[property]!==t[property])lost.push(property);
  if(lost.length)issues.push({meshes,lost,source:{name:s.name,color:s.color?.getHexString(),emissive:s.emissive?.getHexString(),emissiveIntensity:s.emissiveIntensity,side:s.side,transparent:s.transparent,opacity:s.opacity,hasMap:!!s.map},adapted:{emissive:t.emissive?.getHexString(),emissiveIntensity:t.emissiveIntensity,side:t.side,transparent:t.transparent,opacity:t.opacity,hasMap:!!t.map}});t.dispose();
 }
 results.push({region,sourceMaterials:seen.size,issues});console.log(JSON.stringify({region,sourceMaterials:seen.size,affected:issues.length,emissiveLost:issues.filter(i=>i.lost.includes('emissive')).length,sideLost:issues.filter(i=>i.lost.includes('side')).length,mapsLost:issues.filter(i=>i.lost.includes('map')).length}));kit.group.traverse((o:THREE.Object3D)=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});for(const m of seen.keys())m.dispose();
}
await mkdir('../../parhelion-eight-hour-evidence/environment/material-audit',{recursive:true});await writeFile('../../parhelion-eight-hour-evidence/environment/material-audit/settlement-adapter.json',JSON.stringify(results,null,2));
