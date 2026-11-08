import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {WEAPON_FINISHES,WEAPON_FINISH_KEY,WeaponFinishStore,weaponFinishUnlocked} from '../src/weapons/weaponFinishes';
import {makeWeaponFinishPattern,weaponFinishPatternInk} from '../src/weapons/weaponFinishPatterns';
import {createWeaponFinishMaterials} from '../src/weapons/weaponFinishMaterials';
import {parseLocalGlb} from './player-fixture';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';

const crafted=['guard-sash','sealed-passage','night-nacre'] as const;
test('three new finishes append stable ids, are immediately available and preserve every version-one preference',()=>{
 const legacy=['original','survey','signal','oath','tide','frost','ember'];
 assert.deepEqual(WEAPON_FINISHES.map(f=>f.id),[...legacy,...crafted]);
 const empty=new Set<string>(),values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 for(const id of legacy){
  values.set(WEAPON_FINISH_KEY,JSON.stringify({version:1,finish:id}));
  assert.equal(new WeaponFinishStore(storage).preference,id,'adding cosmetics never migrates or drops an old preference');
 }
 for(const id of crafted){
  assert.equal(weaponFinishUnlocked(id,empty),true);
  const store=new WeaponFinishStore(storage);assert.equal(store.select(id,empty),true);
  const reload=new WeaponFinishStore(storage);assert.equal(reload.preference,id);assert.equal(reload.active(empty),id);
  assert.deepEqual(JSON.parse(values.get(WEAPON_FINISH_KEY)!),{version:1,finish:id});
 }
 assert.equal(empty.size,0);assert.deepEqual([...values.keys()],[WEAPON_FINISH_KEY]);
 const denied=new WeaponFinishStore({getItem(){throw new Error('denied');},setItem(){throw new Error('quota');}});
 assert.equal(denied.select('night-nacre',empty),true);assert.equal(denied.saved,false);assert.equal(denied.active(empty),'night-nacre');
});

test('crafted finishes have distinct composed masks and four or five opaque colors in each bounded panel texture',()=>{
 const signatures=new Set<string>(),masks:number[][]=[];
 for(const id of crafted){
  const pair:string[]=[];
  for(const channel of ['ivory','dark'] as const){
   const t=makeWeaponFinishPattern(id,channel),again=makeWeaponFinishPattern(id,channel),data=t.image.data as Uint8Array;
   assert.equal(data.byteLength,65536);assert.deepEqual(data,again.image.data);assert.equal(t.colorSpace,THREE.SRGBColorSpace);
   assert.equal(t.generateMipmaps,true);assert.equal(t.wrapS,THREE.RepeatWrapping);assert.equal(t.wrapT,THREE.RepeatWrapping);
   const colors=new Map<string,number>();for(let i=0;i<data.length;i+=4){assert.equal(data[i+3],255);const c=Array.from(data.slice(i,i+3)).join(',');colors.set(c,(colors.get(c)??0)+1);}
   assert.ok(colors.size>=4&&colors.size<=5);assert.ok([...colors.values()].every(n=>n>=100),'each composed layer survives the texture resolution');
   assert.ok(Math.max(...colors.values())>16384*.65,'ornament keeps a readable dominant field');
   const signature=createHash('sha256').update(data).digest('hex');signatures.add(signature);pair.push(signature);t.dispose();again.dispose();
  }
  assert.notEqual(pair[0],pair[1],'primary and dark panels retain distinct treatments');
  const mask=Array.from({length:16384},(_,i)=>+weaponFinishPatternInk(id,(i%128+.5)/128,(Math.floor(i/128)+.5)/128));masks.push(mask);
 }
 assert.equal(signatures.size,6);
 for(let a=0;a<masks.length;a++)for(let b=a+1;b<masks.length;b++)assert.ok(masks[a].filter((v,i)=>v!==masks[b][i]).length>2000,'themes differ in composition, not only in palette');
 // Features are sampled independently of colors: a sash, a seal, and open space
 // between a cluster of nacre fragments remain recognizable at panel resolution.
 assert.equal(weaponFinishPatternInk('guard-sash',.42,.5),true);
 assert.equal(weaponFinishPatternInk('guard-sash',.93,.60),false);
 assert.equal(weaponFinishPatternInk('sealed-passage',.77,.69),true);
 assert.equal(weaponFinishPatternInk('sealed-passage',.30,.72),false);
 assert.equal(weaponFinishPatternInk('night-nacre',.49,.43),true);
 assert.equal(weaponFinishPatternInk('night-nacre',.50,.85),false);
});

test('all five real gun GLBs keep exact geometry, sockets and physical material settings across new finish switching',async()=>{
 for(const file of ['01_Dawn_AR','02_Firefly_SMG','03_Afterglow_Shotgun','04_Meridian_DMR','05_Longnight_Sniper']){
  const {scene}=await parseLocalGlb(new URL(`../../assets/weapons/glb/${file}.glb`,import.meta.url));
  const meshes:THREE.Mesh[]=[],transforms:{object:THREE.Object3D;matrix:number[]}[]=[];
  scene.updateMatrixWorld(true);scene.traverse(o=>{transforms.push({object:o,matrix:o.matrixWorld.toArray()});if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
  const originals=meshes.map(m=>({geometry:m.geometry,material:m.material,attributes:Object.fromEntries(Object.entries(m.geometry.attributes).map(([name,a])=>[name,a.array.slice()])),index:m.geometry.index?.array.slice()}));
  const control=createWeaponFinishMaterials(scene),textures=new Set<THREE.Texture>();
  for(let repeat=0;repeat<3;repeat++)for(const id of crafted){
   assert.equal(control.apply(id),true);scene.updateMatrixWorld(true);
   for(const {object,matrix}of transforms)assert.deepEqual(object.matrixWorld.toArray(),matrix,`${file}: every anchor and mesh transform stays exact`);
   for(const [i,m]of meshes.entries()){
    const before=originals[i];assert.equal(m.geometry,before.geometry);assert.deepEqual(m.geometry.index?.array,before.index);
    for(const [name,values]of Object.entries(before.attributes))assert.deepEqual(m.geometry.attributes[name].array,values,`${file}: ${name} untouched`);
    const old=[before.material].flat() as THREE.MeshStandardMaterial[];
    for(const [j,mat]of([m.material].flat()as THREE.MeshStandardMaterial[]).entries()){
     assert.notEqual(mat,old[j]);
     for(const key of ['roughness','metalness','opacity','transparent','depthWrite','emissiveIntensity','normalMap']as const)assert.equal(mat[key],old[j][key]);
     assert.ok(mat.emissive.equals(old[j].emissive));
     if(/^PH_(ivory|dark)(?:\.\d+)?$/.test(mat.name)){assert.ok(mat.map?.isDataTexture);textures.add(mat.map!);assert.equal(mat.color.getHexString(),'ffffff');}
    }
   }
  }
  assert.equal(textures.size,6,`${file}: only two cached patterns per new theme despite repeated selection`);
  let disposed=0;textures.forEach(t=>t.addEventListener('dispose',()=>disposed++));control.apply('original');control.dispose();control.dispose();assert.equal(disposed,6);
  meshes.forEach((m,i)=>assert.equal(m.material,originals[i].material));
 }
});

test('production settings select, apply and reload all three finishes without earning flags or changing combat state',async()=>{
 let persisted='';
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{[WEAPON_FINISH_KEY]:JSON.stringify({version:1,finish:'oath'})}});
 try{
  const w=h.world,d=h.window.document,select=d.getElementById('world-weapon-finish')as HTMLSelectElement;
  assert.equal(w.weaponFinishStore.preference,'oath');assert.equal(select.value,'original','old locked preference remains saved but unavailable');
  const beforeDone=[...w.done],beforeFound=[...w.found];
  const combatSnapshot=()=>({hp:w.combat.state.hp,ammo:w.combat.state.ammo,gunHeat:w.combat.state.gunHeat,gunVent:w.combat.state.gunVent,shotCooldown:w.combat.state.shotCooldown,active:w.arsenal.equipped});
  const priorCombat=combatSnapshot(),gun=w.combat.state.gun,profile=JSON.stringify(gun);
  assert.equal(typeof priorCombat.hp,'number');assert.equal(typeof priorCombat.ammo,'number');
  for(const id of crafted){
   assert.equal(select.querySelector<HTMLOptionElement>(`[value="${id}"]`)!.disabled,false);
   select.value=id;select.dispatchEvent(new h.window.Event('change'));await h.settleAssets();
   assert.equal(w.weaponFinishStore.active(w.done),id);assert.equal(w.arsenal.art.finish,id);assert.equal(w.arsenal.meleeArt.finish,id);
   assert.deepEqual([...w.done],beforeDone);assert.deepEqual([...w.found],beforeFound);
   assert.deepEqual(combatSnapshot(),priorCombat);assert.equal(w.combat.state.gun,gun);assert.equal(JSON.stringify(w.combat.state.gun),profile,'damage, cadence, range and the complete equipped profile are unchanged');
   persisted=h.window.localStorage.getItem(WEAPON_FINISH_KEY)!;assert.deepEqual(JSON.parse(persisted),{version:1,finish:id});
  }
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
 const reload=await bootWorldWithoutGpu({deterministic:true,initialStorage:{[WEAPON_FINISH_KEY]:persisted}});
 try{
  await reload.settleAssets();const w=reload.world;
  assert.equal((reload.window.document.getElementById('world-weapon-finish')as HTMLSelectElement).value,'night-nacre');
  assert.equal(w.weaponFinishStore.active(w.done),'night-nacre');assert.equal(w.arsenal.art.finish,'night-nacre');assert.equal(w.arsenal.meleeArt.finish,'night-nacre');assert.deepEqual(reload.errors,[]);
 }finally{await reload.close();}
});
