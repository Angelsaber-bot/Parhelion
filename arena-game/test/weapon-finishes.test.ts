import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {WEAPONS} from '../shared/content.ts';
import {SIGNATURE_SKINS,signaturesFor,signatureModelOf} from '../shared/signatureSkins.ts';
import {finishOf} from '../src/cosmetics/weaponFinishes.ts';
import {addSignatureArt} from '../src/cosmetics/signatureFinishes.ts';
import {WeaponArtPool,combatArt,artPoint} from '../src/weapons/weaponArt.ts';
import {sanitizedSkins} from '../src/ui/loadout.ts';
import {Match} from '../shared/match.ts';
import {ARENA_MAP} from '../shared/arenaMap.ts';
it('the curated catalog appends new finishes without moving any previous index',()=>{
 const expected={lumen:['tidal-engine','amber-apiary','graviton-crucible','cloudline','stormcoil'],corona:['abyssal-maw','cinder-express','sealed-passage','lantern-warden','bastion-breaker'],halo:['celadon-atlas','owl-canticle','brass-horizon','night-nacre','petal-scabbard'],firefly:['mint-arcade','koi-current','mixtape','guard-sash','hummingbird'],longnight:['abyssal-requiem','velvet-thorn','meridian-key','glacier-survey','void-lance'],blade:['prismwing','crescent-sabre'],polearm:['vermilion-plume','ink-bamboo','reef-regalia'],hammer:['foundry-bell','sugar-crash','cathedral-chime']};
 expect(SIGNATURE_SKINS).toHaveLength(33);expect(new Set(SIGNATURE_SKINS.map(s=>s.id)).size).toBe(33);
 for(const w of WEAPONS){expect(w.skins.map(s=>s.id)).toEqual(expected[w.id]);expect(signaturesFor(w.id).map(s=>s.id)).toEqual(expected[w.id]);for(const skin of w.skins){expect(WEAPONS.filter(other=>other.skins.some(s=>s.id===skin.id)).map(w=>w.id)).toEqual([w.id]);expect(finishOf(skin.id,w.id)).toBe(skin.id);expect(finishOf(skin.id,WEAPONS.find(other=>other!==w)!.id)).toBeNull();}}
 for(const id of ['dawn','ember','astral','sunforged','petalglass','night-courier','dune-falcon','moonbite','equator-pulse','paper-crane','peach-fizz','copper-cartographer','obsidian-surveyor','snowline-ghost','rime-oath','storm-circuit','meteor-heart'])expect(finishOf(id)).toBeNull();
 const saved=WEAPONS.map(w=>w.skins.length-1);expect(sanitizedSkins(saved)).toEqual(saved);
});
it('curation preserves authoritative movement, weapons, damage and timing',()=>{
 const before=JSON.stringify(WEAPONS.map(({skins,...rules})=>rules));
 const matches=[0,1].map(theme=>{const m=new Match(ARENA_MAP,'1v1');for(const [id,team]of [['a','A'],['b','B']]as const)m.addPlayer(id,{name:id,team,char:0,bot:false,skins:WEAPONS.map(w=>theme?w.skins.length-1:0)});for(let tick=0;tick<400;tick++)m.step();return m.snapshot();});
 const strip=(value:unknown)=>JSON.parse(JSON.stringify(value,(key,v)=>key==='skins'?undefined:v));
 expect(strip(matches[0])).toEqual(strip(matches[1]));expect(JSON.stringify(WEAPONS.map(({skins,...rules})=>rules))).toBe(before);
});
it('receiver artwork clips at real openings instead of forming floating webs across a vent',()=>{
 const shape=new THREE.Shape();shape.moveTo(-.65,.02);shape.lineTo(1.4,.02);shape.lineTo(1.4,.48);shape.lineTo(-.65,.48);shape.closePath();
 const hole=new THREE.Path();hole.moveTo(.65,.1);hole.lineTo(.65,.30);hole.lineTo(1,.30);hole.lineTo(1,.1);hole.closePath();shape.holes.push(hole);
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.05,bevelEnabled:false}),material=new THREE.MeshStandardMaterial();material.name='PH_ivory';const body=new THREE.Group();body.add(new THREE.Mesh(geometry,material));
 const art=addSignatureArt({body},'amber-apiary');let triangles=0;
 for(const group of art.groups)group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i+=3){const center=new THREE.Vector3().fromBufferAttribute(p,i).add(new THREE.Vector3().fromBufferAttribute(p,i+1)).add(new THREE.Vector3().fromBufferAttribute(p,i+2)).multiplyScalar(1/3);expect(center.x>.65001&&center.x<.99999&&center.y>.10001&&center.y<.29999).toBe(false);triangles++;}});
 expect(triangles).toBeGreaterThan(100);art.dispose();geometry.dispose();material.dispose();
});
it('curved hammer artwork retains its gear design and lies on the actual source surface',()=>{
 const geometry=new THREE.SphereGeometry(.4,48,32).scale(1,1,.3).translate(.47,.055,0),material=new THREE.MeshStandardMaterial();material.name='PH_ivory';const source=new THREE.Mesh(geometry,material),body=new THREE.Group();body.add(source);const art=addSignatureArt({body},'foundry-bell');let vertices=0;body.updateMatrixWorld(true);
 for(const group of art.groups)group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position');vertices+=p.count;for(let i=0;i<p.count;i+=Math.max(3,Math.floor(p.count/24)*3)){const center=new THREE.Vector3().fromBufferAttribute(p,i).add(new THREE.Vector3().fromBufferAttribute(p,i+1)).add(new THREE.Vector3().fromBufferAttribute(p,i+2)).multiplyScalar(1/3);const side=center.z>=0?1:-1,ray=new THREE.Raycaster(new THREE.Vector3(center.x,center.y,side),new THREE.Vector3(0,0,-side)),hit=ray.intersectObject(source)[0];expect(hit).toBeDefined();expect(Math.abs(hit.point.z-center.z)).toBeLessThan(.004);}});
 expect(vertices).toBeGreaterThan(300);art.dispose();geometry.dispose();material.dispose();
});
for(const w of WEAPONS)it(`${w.id}: actual themed GLBs preserve anchors, source materials and authored bounds`,async()=>{
 const def=combatArt(w.id)!,bytes=await readFile(new URL(`../../assets/weapons/glb/${def.file}.glb`,import.meta.url));
 const source=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const original=new THREE.Box3().setFromObject(source),pool=new WeaponArtPool(async()=>source),handles=[];
 const defaults=pool.acquire(def);handles.push(defaults);const originalInstance=(await defaults.ready)!;
 const disposals=new Map<THREE.BufferGeometry,number>();
 for(const theme of signaturesFor(w.id)){
  if(signatureModelOf(theme.id,w.id))continue; // replacement models have dedicated silhouette/socket tests
  const h=pool.acquire(def,w.skins.find(s=>s.id===theme.id));handles.push(h);const instance=(await h.ready)!;instance.root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(instance.root);expect(bounds.min.distanceTo(original.min)).toBeLessThan(.001);expect(bounds.max.distanceTo(original.max)).toBeLessThan(.001);
  expect(instance.parts.body.getObjectByName(`Signature_${theme.id}_body`)).toBeDefined();
  let reliefVertices=0;instance.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.name.startsWith(`Signature_${theme.id}_`)){const p=o.geometry.getAttribute('position');reliefVertices+=p.count;expect(Array.from(p.array).every(Number.isFinite)).toBe(true);disposals.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>disposals.set(o.geometry,disposals.get(o.geometry)!+1));}});expect(reliefVertices).toBeGreaterThan(100);expect(reliefVertices).toBeLessThan(28000);
  expect(instance.parts.body.position.toArray()).toEqual(originalInstance.parts.body.position.toArray());
  const materials=new Set<THREE.Material>();instance.root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
  expect([...materials].some(m=>m instanceof THREE.MeshPhysicalMaterial&&m.userData.finish===theme.id)).toBe(true);
  for(const anchor of [def.grip,...('muzzle'in def?[def.muzzle]:[])])if(anchor)expect(artPoint(def,anchor).toArray().every(Number.isFinite)).toBe(true);
 }
 originalInstance.root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])expect(m.userData.finish).toBeUndefined();});
 handles.forEach(h=>{h.release();h.release();});expect(pool.size).toBe(0);expect([...disposals.values()].every(count=>count===1)).toBe(true);
});
