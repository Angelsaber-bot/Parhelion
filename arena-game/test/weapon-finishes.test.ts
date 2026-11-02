import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {WEAPONS,ARENA_SKIN_COLLECTIONS} from '../shared/content.ts';
import {WeaponArtPool,combatArt,artPoint} from '../src/weaponArt.ts';
import {sanitizedSkins} from '../src/loadout.ts';
import {Match} from '../shared/match.ts';
import {ARENA_MAP} from '../shared/arenaMap.ts';
it('all eight weapons expose three appended themes and valid catalog-indexed saves',()=>{
 for(const w of WEAPONS)for(const skin of ARENA_SKIN_COLLECTIONS){const index=w.skins.findIndex(s=>s.id===skin.id);expect(index).toBeGreaterThan(0);const saved=WEAPONS.map(()=>0);saved[WEAPONS.indexOf(w)]=index;expect(sanitizedSkins(saved)).toEqual(saved);}
});
it('theme selection preserves authoritative movement, weapons, damage and timing',()=>{
 const before=JSON.stringify(WEAPONS.map(({skins,...rules})=>rules));
 const matches=[0,1].map(theme=>{const m=new Match(ARENA_MAP,'1v1');for(const [id,team]of [['a','A'],['b','B']]as const)m.addPlayer(id,{name:id,team,char:0,bot:false,skins:WEAPONS.map(w=>theme?w.skins.findIndex(s=>s.id==='astral'):0)});for(let tick=0;tick<400;tick++)m.step();return m.snapshot();});
 const strip=(value:unknown)=>JSON.parse(JSON.stringify(value,(key,v)=>key==='skins'?undefined:v));
 expect(strip(matches[0])).toEqual(strip(matches[1]));expect(JSON.stringify(WEAPONS.map(({skins,...rules})=>rules))).toBe(before);
});
for(const w of WEAPONS)it(`${w.id}: actual themed GLBs preserve anchors, source materials and authored bounds`,async()=>{
 const def=combatArt(w.id)!,bytes=await readFile(new URL(`../../assets/weapons/glb/${def.file}.glb`,import.meta.url));
 const source=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const original=new THREE.Box3().setFromObject(source),pool=new WeaponArtPool(async()=>source),handles=[];
 const defaults=pool.acquire(def,w.skins[0]);handles.push(defaults);const originalInstance=(await defaults.ready)!;
 for(const theme of ARENA_SKIN_COLLECTIONS){
  const h=pool.acquire(def,w.skins.find(s=>s.id===theme.id));handles.push(h);const instance=(await h.ready)!;instance.root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(instance.root);expect(bounds.min.distanceTo(original.min)).toBeLessThan(.001);expect(bounds.max.distanceTo(original.max)).toBeLessThan(.001);
  expect(instance.parts.body.getObjectByName(`FinishInlay_${theme.id}`)).toBeDefined();
  expect(instance.parts.body.position.toArray()).toEqual(originalInstance.parts.body.position.toArray());
  const materials=new Set<THREE.Material>();instance.root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
  expect([...materials].some(m=>m instanceof THREE.MeshPhysicalMaterial&&m.userData.finish===theme.id)).toBe(true);
  for(const anchor of [def.grip,...('muzzle'in def?[def.muzzle]:[])])if(anchor)expect(artPoint(def,anchor).toArray().every(Number.isFinite)).toBe(true);
 }
 originalInstance.root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])expect(m.userData.finish).toBeUndefined();});
 handles.forEach(h=>h.release());expect(pool.size).toBe(0);
});
