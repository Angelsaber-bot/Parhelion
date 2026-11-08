import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { JSDOM } from 'jsdom';
import { WeaponFinishStore, WEAPON_FINISH_KEY, weaponFinishUnlocked } from '../src/weapons/weaponFinishes';
import { createWeaponFinishControl } from '../src/weapons/weaponFinishControl';
import { makeWeaponFinishPattern } from '../src/weapons/weaponFinishPatterns';
import { createWeaponFinishMaterials } from '../src/weapons/weaponFinishMaterials';
import { parseLocalGlb } from './player-fixture';

const completed = new Set(['parallax_recorded']);
test('survey finish is earned only by recording Parallax Court, preserves version-one saves and never grants progress',()=>{
 const values=new Map([[WEAPON_FINISH_KEY,JSON.stringify({version:1,finish:'oath'})]]);
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}};
 const previous=new WeaponFinishStore(storage);assert.equal(previous.preference,'oath');
 const before=values.get(WEAPON_FINISH_KEY);
 assert.equal(previous.select('survey',new Set(['hq_terminal','campaign_alpha_complete'])),false);assert.equal(values.get(WEAPON_FINISH_KEY),before);
 assert.equal(weaponFinishUnlocked('survey',completed),true);assert.equal(previous.select('survey',completed),true);
 const loaded=new WeaponFinishStore(storage);assert.equal(loaded.preference,'survey');assert.equal(loaded.active(completed),'survey');assert.equal(loaded.active(new Set()),'original');assert.equal(loaded.preference,'survey');
 assert.deepEqual([...completed],['parallax_recorded']);assert.deepEqual([...values.keys()],[WEAPON_FINISH_KEY]);
});
test('survey can be selected through the production control only after the courtyard reward',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'document');const dom=new JSDOM('<!doctype html><body></body>');Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});
 const done=new Set<string>(),store=new WeaponFinishStore(),changes:string[]=[];const control=createWeaponFinishControl(store,done,id=>changes.push(id));
 try{
  document.body.append(control.root);const select=control.root.querySelector('select')!,option=select.querySelector<HTMLOptionElement>('[value=survey]')!;
  assert.equal(option.disabled,true);select.value='survey';select.dispatchEvent(new dom.window.Event('change'));assert.equal(select.value,'original');assert.deepEqual(changes,[]);
  done.add('parallax_recorded');control.refresh();assert.equal(option.disabled,false);select.value='survey';select.dispatchEvent(new dom.window.Event('change'));assert.equal(store.preference,'survey');assert.deepEqual(changes,['survey']);assert.deepEqual([...done],['parallax_recorded']);
 }finally{control.dispose();dom.window.close();if(old)Object.defineProperty(globalThis,'document',old);else Reflect.deleteProperty(globalThis,'document');}
});
test('survey artwork uses four opaque panel colors, two distinct panel treatments and a fixed texture budget',()=>{
 const signatures:string[]=[];
 for(const channel of ['ivory','dark'] as const){
  const texture=makeWeaponFinishPattern('survey',channel),data=texture.image.data as Uint8Array;
  const counts=new Map<string,number>();for(let i=0;i<data.length;i+=4){assert.equal(data[i+3],255);const color=`${data[i]},${data[i+1]},${data[i+2]}`;counts.set(color,(counts.get(color)??0)+1);}
  assert.equal(counts.size,4,'base, structure, brass graduations and cyan optics are distinct');assert.ok([...counts.values()].every(count=>count>100),'each authored layer survives the 128px sampling');assert.ok(Math.max(...counts.values())>128*128*.7,'markings leave most of the structural finish unpainted');
  assert.equal(data.byteLength,65536);assert.equal(texture.colorSpace,THREE.SRGBColorSpace);assert.equal(texture.generateMipmaps,true);signatures.push(Buffer.from(data).toString('base64'));texture.dispose();
 }
 assert.notEqual(signatures[0],signatures[1]);
});

test('survey finish applies privately to every authored gun without modifying shared model resources',async()=>{
 for(const file of ['01_Dawn_AR','02_Firefly_SMG','03_Afterglow_Shotgun','04_Meridian_DMR','05_Longnight_Sniper']){
  const gltf=await parseLocalGlb(new URL(`../../assets/weapons/glb/${file}.glb`,import.meta.url)),meshes:THREE.Mesh[]=[];gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh)});
  const originals=meshes.map(mesh=>({geometry:mesh.geometry,material:mesh.material})),controller=createWeaponFinishMaterials(gltf.scene);assert.equal(controller.apply('survey'),true);const textures=new Set<THREE.Texture>();
  for(const [i,mesh]of meshes.entries()){
   assert.equal(mesh.geometry,originals[i].geometry);
   for(const material of [mesh.material].flat()as THREE.MeshStandardMaterial[]){if(/^PH_(ivory|dark)(?:\.\d+)?$/.test(material.name)){assert.ok(material.map?.isDataTexture,`${file}: ${material.name} receives the patterned surface`);textures.add(material.map!);}}
  }
  assert.equal(textures.size,2,`${file}: one shared private map per material channel`);controller.apply('original');controller.dispose();for(const[i,mesh]of meshes.entries())assert.equal(mesh.material,originals[i].material);
 }
});
