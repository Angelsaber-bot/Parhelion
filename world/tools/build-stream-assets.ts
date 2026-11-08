import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {regionLoader,bakeQuantized} from '../src/rendering/glb';
import {REGIONS} from '../src/map/regions';
import {isStaticArtEligible} from '../src/rendering/chunk';
import {carveFlagshipDeck} from '../src/map/shipInteriorCut';
import {compress} from './gen/export';
const manifest:Record<string,{core:number;visual:number;source:number}>={};
for(const def of REGIONS){
 const source=readFileSync(new URL(`../public/assets/${def.file}.glb`,import.meta.url));
 const gltf=await regionLoader().parseAsync(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'');bakeQuantized(gltf.scene);
 if(def.id==='blacksail')gltf.scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||m.name==='Terrain'||m.name==='COL_Terrain')return;const cut=carveFlagshipDeck(m.geometry);if(cut){m.geometry.dispose();m.geometry=cut;}});
 const core=gltf.scene,visual=new THREE.Group();visual.name=`RegionVisual_${def.id}`;
 const art=core.getObjectByName('ART')!;
 for(const child of[...art.children])if(child.name!=='Terrain'&&child.name!=='Water'&&isStaticArtEligible(child))visual.add(child);
 const sizes={source:source.byteLength,core:0,visual:0};
 for(const[kind,root]of[['core',core],['visual',visual]]as const){const scene=new THREE.Scene();scene.add(root);const buffer=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:false})as ArrayBuffer;const packed=await compress(new Uint8Array(buffer),true);writeFileSync(new URL(`../public/assets/${def.file}.${kind}.glb`,import.meta.url),packed);sizes[kind]=packed.byteLength;scene.remove(root);}
 manifest[def.id]=sizes;console.log(def.id,sizes);
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();for(const root of[core,visual])root.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){geometries.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.add(mat);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
writeFileSync(new URL('../public/assets/world-stream.manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
