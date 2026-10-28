/** Real five-region collision query budget; CPU diagnostic, not a browser FPS benchmark. */
import { readFileSync,writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader,bakeQuantized } from '../../src/glb.ts';
import { REGIONS,boundaryWalls } from '../../src/regions.ts';
import { MountedCharge } from '../../src/mountedCharge.ts';
import { CharacterKit } from '../../src/characters/characterKit.ts';
import { CHARACTER_KITS } from '../../src/characters/catalog.ts';
import { readCharacter } from './inspect.ts';
import { fileURLToPath } from 'node:url';
import type { Collider } from '../../src/player.ts';
const geos:THREE.BufferGeometry[]=[boundaryWalls()],colliders:Collider[]=[];
for(const def of REGIONS){const bytes=readFileSync(new URL(`../../public/assets/${def.file}.glb`,import.meta.url)),gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  bakeQuantized(gltf.scene);gltf.scene.position.set(def.offset[0],0,def.offset[1]);gltf.scene.updateMatrixWorld(true);
  gltf.scene.getObjectByName('COLLISION')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;let g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());if(m.geometry.index)g.setIndex(m.geometry.index.clone());g.applyMatrix4(m.matrixWorld);if(g.index)g=g.toNonIndexed();if(m.userData.dynamic)colliders.push({name:m.name,bvh:new MeshBVH(g),enabled:true});else geos.push(g);});
}
colliders.unshift({name:'static',enabled:true,bvh:new MeshBVH(mergeGeometries(geos))});let queries=0,boxQueries=0;
for(const collider of colliders){const original=collider.bvh.raycastFirst.bind(collider.bvh);collider.bvh.raycastFirst=(...args)=>{queries++;return original(...args);};const box=collider.bvh.intersectsBox.bind(collider.bvh);collider.bvh.intersectsBox=(...args)=>{boxQueries++;return box(...args);};}
const definition=CHARACTER_KITS.napoleonMounted,{gltf}=await readCharacter(fileURLToPath(new URL(definition.assetUrl)));
const player=new THREE.Vector3(96,12,-932),enemy={id:'winter-qa',position:new THREE.Vector3(96,12,-924)};let hits=0;
const controller=new MountedCharge({colliders,range:4.5,damage:16,engage:()=>enemy,target:(p,r,id)=>p.distanceTo(enemy.position)<r&&(!id||id===enemy.id)?enemy:null,strike:(p,r)=>{if(p.distanceTo(enemy.position)<r)hits++;return enemy;}});
const actor=new CharacterKit(gltf,definition,{onEvent:e=>controller.onEvent(actor,e)});const frames:{phase:string;queries:number;boxQueries:number;ms:number}[]=[];
for(let i=0;i<600;i++){queries=0;boxQueries=0;const phase=controller.phase,start=performance.now();controller.update(actor,1/60,player,0);frames.push({phase,queries,boxQueries,ms:performance.now()-start});}
const byPhase=Object.fromEntries(['follow','approach','charge','recover'].map(phase=>{const values=frames.filter(f=>f.phase===phase);return[phase,{frames:values.length,meanRayQueries:values.reduce((n,f)=>n+f.queries,0)/Math.max(1,values.length),maxRayQueries:Math.max(0,...values.map(f=>f.queries)),meanBodyQueries:values.reduce((n,f)=>n+f.boxQueries,0)/Math.max(1,values.length),maxBodyQueries:Math.max(0,...values.map(f=>f.boxQueries)),meanMs:values.reduce((n,f)=>n+f.ms,0)/Math.max(1,values.length),p95Ms:values.map(f=>f.ms).sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*.95)-1)]??0,maxMs:Math.max(0,...values.map(f=>f.ms))}];}));
const result={note:'Actual five-region merged static BVH + enabled dynamic colliders; runtime mounted actor. CPU timing is environment-specific, not WebGL FPS.',colliders:colliders.length,frames:frames.length,hits,coldFirstFrame:frames[0],position:actor.root.position.toArray(),byPhase};console.log(JSON.stringify(result,null,2));
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2));actor.dispose();
