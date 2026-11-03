import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SIGNATURE_SKINS,signatureModelOf} from '../shared/signatureSkins.ts';
import {WEAPONS} from '../shared/content.ts';
import {WeaponArtPool,artPoint,combatArt,makeArtMount} from '../src/weaponArt.ts';
import {attachGunArt} from '../src/gunArt.ts';
import {poseMelee} from '../src/meleeArt.ts';

const modeled=SIGNATURE_SKINS.filter(s=>signatureModelOf(s.id));
for(const skin of modeled)it(`${skin.id}: editable GLB export matches its runtime model and socket manifest`,async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../assets/weapons/structural_v1/manifest.json',import.meta.url),'utf8')),entry=manifest.models.find((m:any)=>m.id===skin.id),bytes=await readFile(new URL(`../../assets/weapons/structural_v1/${entry.file}`,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),def=combatArt(skin.weapon)!;let triangles=0,tagged=false;gltf.scene.traverse(o=>{if(o.userData.structuralSkin===skin.id)tagged=true;if(o instanceof THREE.Mesh){triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;expect(o.geometry.getAttribute('normal')).toBeDefined();}});expect(tagged).toBe(true);expect(triangles).toBe(entry.triangles);expect(entry.sockets.grip).toEqual(def.grip);expect(entry.sockets.muzzle).toEqual(def.muzzle);
});
it('new silhouettes remain four weapon-exclusive choices in the same saved catalog',()=>{expect(modeled.map(s=>s.weapon).sort()).toEqual(['blade','corona','hammer','polearm']);for(const s of modeled)expect(WEAPONS.find(w=>w.id===s.weapon)!.skins.some(v=>v.id===s.id)).toBe(true);});
for(const skin of modeled)it(`${skin.id}: a complete batched model, independent ownership and zero base-GLB downloads`,async()=>{
 const def=combatArt(skin.weapon)!;let downloads=0;const pool=new WeaponArtPool(async()=>{downloads++;throw Error('base GLB must not load');}),a=pool.acquire(def,skin),b=pool.acquire(def,skin),one=(await a.ready)!,two=(await b.ready)!;
 expect(downloads).toBe(0);expect(one.root.userData.structuralSkin).toBe(skin.id);expect(one.parts.body.parent?.name).toBe(def.file+'_ROOT');
 let triangles=0,meshes=0;const resources=new Set<THREE.BufferGeometry|THREE.Material>(),counts=new Map<THREE.BufferGeometry|THREE.Material,number>();
 one.root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;expect(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);expect(o.geometry.getAttribute('normal')).toBeDefined();expect(o.geometry.getAttribute('uv')).toBeDefined();resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);});
 expect(meshes).toBeGreaterThan(2);expect(meshes).toBeLessThan(22);expect(triangles).toBeGreaterThan(500);expect(triangles).toBeLessThan(22000);
 two.root.traverse(o=>{if(o instanceof THREE.Mesh){expect(resources.has(o.geometry)).toBe(false);for(const m of Array.isArray(o.material)?o.material:[o.material])expect(resources.has(m)).toBe(false);}});
 const bytes=await readFile(new URL(`../../assets/weapons/glb/${def.file}.glb`,import.meta.url)),original=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const before=new THREE.Box3().setFromObject(original).getSize(new THREE.Vector3()),after=new THREE.Box3().setFromObject(one.root).getSize(new THREE.Vector3());expect(Math.max(...after.toArray().map((v,i)=>Math.abs(v-before.getComponent(i))))).toBeGreaterThan(.03);
 for(const resource of resources){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)!+1));}
 a.release();a.release();expect([...counts.values()].every(n=>n===1)).toBe(true);expect(new THREE.Box3().setFromObject(two.root).isEmpty()).toBe(false);b.release();expect(pool.size).toBe(0);
});
it('releasing a modeled finish before its ready microtask never installs a stale model',async()=>{const s=modeled[0],pool=new WeaponArtPool(async()=>{throw Error('unexpected');}),h=pool.acquire(combatArt(s.weapon)!,s);h.release();expect(await h.ready).toBeNull();});
function fallback(){const group=new THREE.Group(),muzzle=new THREE.Object3D();group.add(new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.4),new THREE.MeshStandardMaterial()));return{group,muzzle};}
for(const skin of modeled)it(`${skin.id}: real view-model poses keep original sockets and stay in front of the camera`,async()=>{
 const def=combatArt(skin.weapon)!,index=WEAPONS.findIndex(w=>w.id===skin.weapon),skinIndex=WEAPONS[index].skins.findIndex(s=>s.id===skin.id),pool=new WeaponArtPool(async()=>{throw Error('unexpected');}),presentation=attachGunArt(index,skinIndex,fallback(),true,pool);await presentation.ready;
 expect(presentation.group.userData.artState).toBe('ready');expect(artPoint(def,def.grip).distanceTo(new THREE.Vector3(0,-.1,.07))).toBeLessThan(.001);
 if(WEAPONS[index].kind==='melee'){
  const group=presentation.group;group.scale.setScalar(index===6?.6:.72);
  for(let i=0;i<=40;i++)for(const [ready,strike]of [[i/40,0],[0,i/40]]){poseMelee(group,index,ready,strike,true);group.updateMatrixWorld(true);expect(new THREE.Box3().setFromObject(group).max.z).toBeLessThan(-.01);}
 }else{
  expect(presentation.muzzle.position.distanceTo(artPoint(def,def.muzzle!))).toBeLessThan(1e-9);expect(presentation.sight.distanceTo(artPoint(def,def.sight!))).toBeLessThan(1e-9);
  presentation.animate(1,.5);presentation.animate(0,0);
  const h=pool.acquire(def,skin),raw=(await h.ready)!;raw.root.updateMatrixWorld(true);const p=def.sight!;const ray=new THREE.Raycaster(new THREE.Vector3(p[0]-.4,p[1],p[2]),new THREE.Vector3(1,0,0),0,3);expect(ray.intersectObject(raw.root,true)).toHaveLength(0);
  const mount=makeArtMount(def,raw.root),view=new THREE.Group();view.add(mount);view.scale.setScalar(.72);const sight=artPoint(def,p).multiplyScalar(.72);view.position.set(-sight.x,-sight.y,-.34-sight.z);view.updateMatrixWorld(true);expect(new THREE.Box3().setFromObject(view).max.z).toBeLessThan(-.01);h.release();
 }
 presentation.dispose();
});
