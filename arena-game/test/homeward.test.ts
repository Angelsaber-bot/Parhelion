import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {getMap} from '../shared/arenaMap.ts';
import {blockedAt,lineOfSight,tacticalArea,groundAt,raycastMap} from '../shared/map.ts';
import {NavGrid} from '../shared/nav.ts';
import {buildFighter,FighterAnimator} from '../src/player/fighter.ts';
import {disposeTree} from '../src/weapons/weaponArt.ts';
import {CHARACTERS,WEAPONS} from '../shared/content.ts';
const map=getMap('homeward');
describe('Homeward tactical geometry',()=>{
 it('keeps sampled ground sightlines below 40m across the public circulation grid',()=>{
  let longest=0;for(let x=-28;x<=28;x+=2)for(let z=-20;z<=20;z+=2){if(blockedAt(map,x,z,0)||Math.abs(groundAt(map,x,z,.1))>.1)continue;for(let i=0;i<32;i++){const angle=i*Math.PI/16,length=raycastMap(map,[x,1.62,z],[Math.sin(angle),0,Math.cos(angle)],70);if(Number.isFinite(length))longest=Math.max(longest,length);}}
  expect(longest).toBeGreaterThan(30);expect(longest).toBeLessThan(40);
 });

 it('has no platform-to-spawn sightline in 644 standing/crouched samples and never controls both yard centres',()=>{
   let samples=0;for(let x=-2.5;x<=2.5;x+=.25)for(let z=-14;z<=-9.5;z+=.25){if(blockedAt(map,x,z,2.6))continue;for(const h of [1.05,1.62]){samples++;const eye:[number,number,number]=[x,2.6+h,z];for(const a of map.data.anchors.filter(a=>a.kind==='spawn'))expect(lineOfSight(map,eye,[a.position[0],1.62,a.position[2]]),`${eye} -> ${a.id}`).toBe(false);expect(lineOfSight(map,eye,[-9,1.62,-6])&&lineOfSight(map,eye,[9,1.62,6])).toBe(false);}}expect(samples).toBe(644);
 });
 it('both ordinary stair routes reach the terrace and mirrored primary spawns differ by less than .25 seconds',()=>{
  const nav=new NavGrid(map),target=nav.nearest(0,2.6,-11)!;
  const travel=(id:string)=>{const a=map.data.anchors.find(a=>a.id===id)!;let last=a.position,length=0;const path=nav.path(nav.nearest(...a.position)!,target);expect(path?.length).toBeGreaterThan(1);for(const p of path!){length+=Math.hypot(p.x-last[0],p.y-last[1],p.z-last[2]);last=[p.x,p.y,p.z];}return length/5.2;};
  for(let i=0;i<2;i++)expect(Math.abs(travel(`spawn_-1_${i}`)-travel(`spawn_1_${i}`))).toBeLessThan(.25);
 });
 it('keeps the central cabinet solid, the eight-corner circulation clear, and named surfaces distinct',()=>{
  expect(blockedAt(map,0,0,0)).toBeTruthy();const ring=map.data.routes.find(r=>r.id==='hall_eight_corner_ring')!;
  for(const [x,y,z]of ring.points)expect(blockedAt(map,x,z,y)).toBeFalsy();
  expect(tacticalArea(map,-9,-6)?.surface).toBe('stone');expect(tacticalArea(map,9,6)?.surface).toBe('wood');expect(tacticalArea(map,0,-12)?.surface).toBe('metal');
 });
 it('loads the production GLB with finite PBR geometry and a matching mesh for every collider',async()=>{
  const bytes=readFileSync(new URL('../../arena-maps/homeward/assets/homeward_visual.glb',import.meta.url));const loader=new GLTFLoader();loader.register(()=>({name:'HEADLESS_TEXTURE',loadTexture:async()=>new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1)}));const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const ids=new Set<string>();let triangles=0;gltf.scene.traverse(o=>{if(o.userData.source_id)ids.add(o.userData.source_id);const m=o as THREE.Mesh;if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;expect(Array.from(m.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);});
  for(const o of map.data.objects.filter(o=>o.collision))expect(ids.has(o.id),o.id).toBe(true);expect(triangles).toBeLessThan(150000);expect(triangles).toBeGreaterThan(1000);disposeTree(gltf.scene);
 });
});
describe('legacy procedural rig compatibility',()=>{
 for(let char=0;char<CHARACTERS.length;char++)it(`${CHARACTERS[char].id}: all eight weapon poses remain finite and bounded`,()=>{
  const rig=buildFighter(char,0x54d3da),anim=new FighterAnimator(rig);const bounds=new THREE.Box3().setFromObject(rig.root);expect(bounds.max.y).toBeLessThan(2.4);expect(bounds.min.y).toBeGreaterThan(-.15);let triangles=0;rig.root.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh)triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});expect(triangles).toBeLessThan(45000);
  for(let weapon=0;weapon<WEAPONS.length;weapon++){anim.update(1/60,5.2,0,false,true,5.2,0);anim.melee(0,0,weapon);anim.ability(CHARACTERS[char].ability,'windup');rig.root.updateMatrixWorld(true);rig.root.traverse(o=>expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true));}disposeTree(rig.root);
 });
});
