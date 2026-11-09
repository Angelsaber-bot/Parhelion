import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SIGNATURE_SKINS,signatureModelOf} from '../shared/signatureSkins.ts';
import {WEAPONS} from '../shared/content.ts';
import {WeaponArtPool,artPoint,combatArt,makeArtMount} from '../src/weapons/weaponArt.ts';
import {attachGunArt} from '../src/weapons/gunArt.ts';
import {poseMelee} from '../src/weapons/meleeArt.ts';

const modeled=SIGNATURE_SKINS.filter(s=>signatureModelOf(s.id));
for(const id of ['graviton-crucible','koi-current','owl-canticle','meridian-key'])it(`${id}: the bore has real depth instead of a flat cap at the muzzle`,async()=>{
 const skin=SIGNATURE_SKINS.find(s=>s.id===id)!,def=combatArt(skin.weapon)!,pool=new WeaponArtPool(async()=>{throw Error('unexpected download');}),h=pool.acquire(def,skin),model=(await h.ready)!;
 model.root.updateMatrixWorld(true);const p=def.muzzle!,ray=new THREE.Raycaster(new THREE.Vector3(p[0]+.02,p[1],p[2]),new THREE.Vector3(-1,0,0));
 const first=ray.intersectObject(model.root,true)[0];expect(first).toBeDefined();expect(first.distance).toBeGreaterThan(.20);expect(first.distance).toBeLessThan(.50);h.release();
});
for(const skin of modeled)it(`${skin.id}: editable GLB export matches its runtime model and socket manifest`,async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../assets/weapons/structural_v1/manifest.json',import.meta.url),'utf8')),entry=manifest.models.find((m:any)=>m.id===skin.id),bytes=await readFile(new URL(`../../assets/weapons/structural_v1/${entry.file}`,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),def=combatArt(skin.weapon)!;let triangles=0,tagged=false;gltf.scene.traverse(o=>{if(o.userData.structuralSkin===skin.id)tagged=true;if(o instanceof THREE.Mesh){triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;expect(o.geometry.getAttribute('normal')).toBeDefined();}});expect(tagged).toBe(true);expect(triangles).toBe(entry.triangles);expect(entry.sockets.grip).toEqual(def.grip);expect(entry.sockets.muzzle).toEqual(def.muzzle);
});
it('every weapon has five exclusive finishes, each a distinct full replacement model',()=>{for(const weapon of WEAPONS){const styles=modeled.filter(s=>s.weapon===weapon.id);expect(weapon.skins).toHaveLength(5);expect(styles).toHaveLength(5);expect(new Set(styles.map(s=>signatureModelOf(s.id))).size).toBe(5);for(const s of styles)expect(weapon.skins.some(v=>v.id===s.id)).toBe(true);}expect(new Set(modeled.map(s=>signatureModelOf(s.id))).size).toBe(SIGNATURE_SKINS.length);});
for(const skin of modeled)it(`${skin.id}: a complete batched model, independent ownership and zero base-GLB downloads`,async()=>{
 const def=combatArt(skin.weapon)!;let downloads=0;const pool=new WeaponArtPool(async()=>{downloads++;throw Error('base GLB must not load');}),a=pool.acquire(def,skin),b=pool.acquire(def,skin),one=(await a.ready)!,two=(await b.ready)!;
 expect(downloads).toBe(0);expect(one.root.userData.structuralSkin).toBe(skin.id);expect(one.parts.body.parent?.name).toBe(def.file+'_ROOT');
 let triangles=0,meshes=0;const resources=new Set<THREE.BufferGeometry|THREE.Material>(),counts=new Map<THREE.BufferGeometry|THREE.Material,number>();
 one.root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;expect(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);expect(o.geometry.getAttribute('normal')).toBeDefined();expect(o.geometry.getAttribute('uv')).toBeDefined();resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);});
 expect(meshes).toBeGreaterThan(2);expect(meshes).toBeLessThan(22);expect(triangles).toBeGreaterThan(500);expect(triangles).toBeLessThan(40000);
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
for(const id of ['stormcoil','lantern-warden','hummingbird','void-lance','tidal-engine','foundry-bell','clockwork-cleaver','tide-moon','comet-thruster'])it(`${id}: its rotor turns around a fixed pivot and speeds up under kick`,async()=>{
 const {spinSignatureParts}=await import('../src/cosmetics/signatureMotion.ts');
 const skin=SIGNATURE_SKINS.find(s=>s.id===id)!,def=combatArt(skin.weapon)!,pool=new WeaponArtPool(async()=>{throw Error('unexpected');}),h=pool.acquire(def,skin),model=(await h.ready)!;
 const rotors=Object.values(model.parts).filter(p=>p.userData.spin);expect(rotors).toHaveLength(1);const rotor=rotors[0],pivot=rotor.position.clone(),axis=rotor.userData.spin.axis as 'x'|'y'|'z';
 spinSignatureParts(model.parts,1);spinSignatureParts(model.parts,1.05);const idle=rotor.rotation[axis];expect(idle).toBeGreaterThan(0);
 spinSignatureParts(model.parts,1.10,1);expect(rotor.rotation[axis]-idle).toBeGreaterThan(idle);expect(rotor.position.distanceTo(pivot)).toBe(0);
 for(const other of(['x','y','z']as const).filter(a=>a!==axis))expect(rotor.rotation[other]).toBe(0);
 spinSignatureParts(model.parts,Number.NaN);spinSignatureParts(model.parts,500);expect(Number.isFinite(rotor.rotation[axis])).toBe(true);h.release();
});
it('every sculpted finish is one continuous piece: no part floats more than 0.006 units from the rest',{timeout:30000},async()=>{
 const {sculptSignature,pieceIslands}=await import('../src/cosmetics/signatureModels.ts');const {disposeTree}=await import('../src/weapons/weaponArt.ts');
 for(const skin of modeled){const s=sculptSignature(combatArt(skin.weapon)!,skin.id)!,instance=s.finish();expect(s.pieces.length).toBeGreaterThan(8);
  const islands=pieceIslands(s.pieces,.006);expect(islands.length,`${skin.id} has ${islands.length} separate pieces`).toBe(1);disposeTree(instance.root);}
});
it('a gap the width of a hair is reported as a separate island',async()=>{
 const {pieceIslands}=await import('../src/cosmetics/signatureModels.ts');const box=(x:number)=>({role:'body',box:new THREE.Box3(new THREE.Vector3(x,0,0),new THREE.Vector3(x+1,1,1))});
 expect(pieceIslands([box(0),box(1.004)],.006)).toHaveLength(1);expect(pieceIslands([box(0),box(1.02)],.006)).toHaveLength(2);
});
for(const skin of modeled)it(`${skin.id}: ambient motes use its own particle shape, stay on the model, animate and dispose`,async()=>{
 const {spinSignatureParts}=await import('../src/cosmetics/signatureMotion.ts');const {skinEffect}=await import('../src/cosmetics/skinEffects.ts');
 const def=combatArt(skin.weapon)!,pool=new WeaponArtPool(async()=>{throw Error('unexpected');}),h=pool.acquire(def,skin),model=(await h.ready)!;
 const motes=model.parts.motes as THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;expect(motes).toBeInstanceOf(THREE.Points);expect(motes.parent?.name).toBe(def.file+'_ROOT');
 const shapes={ember:0,crystal:1,ring:2,pixel:3,petal:4,star:5};expect(motes.material.uniforms.uShape.value).toBe(shapes[skinEffect(skin.id)!.particle]);
 expect(motes.material.uniforms.uColor.value.getHex()).toBe(skin.accent);
 const p=motes.geometry.getAttribute('position');expect(p.count).toBeGreaterThan(10);expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
 const solid=new THREE.Box3();model.root.traverse(o=>{if(o instanceof THREE.Mesh)solid.expandByObject(o);});solid.expandByScalar(.03);model.root.updateMatrixWorld(true);
 for(let i=0;i<p.count;i++)expect(solid.containsPoint(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(motes.matrixWorld))).toBe(true);
 spinSignatureParts(model.parts,3.5,1);expect(motes.material.uniforms.uTime.value).toBe(3.5);expect(motes.material.uniforms.uKick.value).toBeGreaterThan(0);
 let disposed=0;motes.geometry.addEventListener('dispose',()=>disposed++);motes.material.addEventListener('dispose',()=>disposed++);h.release();expect(disposed).toBe(2);
});
