import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { CharacterKit, type CharacterKitDefinition, type KitEventResult } from '../src/characters/characterKit.ts';
import { CHARACTER_KITS } from '../src/characters/catalog.ts';
import { inspectCharacter, inspectFootClearance, readCharacter } from './characters/inspect.ts';

test('all three requested kits are present and remain opt-in rather than auto-spawned',async()=>{
  assert.deepEqual(Object.keys(CHARACTER_KITS).sort(),['blackbeard','musashi','napoleonMounted'].sort());
  const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
  assert.match(main,/CHARACTER_KITS|loadCharacterKit|characters\/catalog/,'the three delivered kits are explicitly wired to their existing quest markers');
});
for(const [id,profile] of Object.entries(CHARACTER_KITS)) {
  const definition:CharacterKitDefinition=profile;
  test(`${id}: actual final GLB has valid geometry/skins, zero-based clips, grounded feet and declared sockets`,async()=>{
    const asset=await readCharacter(fileURLToPath(new URL(definition.assetUrl))),report=inspectCharacter(asset.gltf);
    assert.deepEqual(report.faults,[]);assert.ok(report.triangles>10_000);assert.ok(report.triangles<2_000_000);
    if(id==='blackbeard')assert.ok(report.triangles>=402_274,'do not substitute a reduced export');
    if(id==='musashi')assert.ok(report.triangles>=173_648,'full LOD0 is the default, not LOD1');
    assert.ok(report.maxWeightError<1e-4);assert.ok(report.minWeight>=0);assert.ok(report.bones>=20&&report.bones<=128);
    assert.ok(report.rest.min[1]>=-.025&&report.rest.min[1]<=.1);
    assert.ok(report.rest.max[1]>1.5&&report.rest.max[1]<5.5);
    for(const image of asset.json.images??[]){assert.ok(image.bufferView!==undefined||image.uri?.startsWith('data:'),'no hidden remote texture dependency');}
    for(const clip of report.clips){assert.ok(Math.abs(clip.start)<1e-6);assert.ok(clip.movingTracks>0);}
    const feet=inspectFootClearance(asset.gltf);assert.ok(feet.footVertices>20,'sample actual skinned foot/hoof vertices');
    for(const clip of feet.clips)assert.ok(clip.minY+(definition.visualOffset?.[1]??0)>-.005,`${clip.name} foot penetration exceeds5mm`);
    const events:KitEventResult[]=[],actor=new CharacterKit(asset.gltf,definition,{onEvent:event=>events.push(event)});
    for(const semantic of Object.keys(definition.sockets))assert.ok(actor.socketTransform(semantic)?.position.toArray().every(Number.isFinite));
    actor.play('attack');for(let i=0;i<Math.ceil(definition.clips.attack.duration/.05)+2;i++)actor.update(.05);
    assert.equal(events.length,definition.clips.attack.events?.length??0);assert.equal(actor.state,definition.defaultState);
    actor.dispose();assert.equal(actor.root.children.length,0);
  });
  test(`${id}: actual loop endpoints and Idle/Walk/Run/Attack crossfades stay finite and in-place`,async()=>{
    const {gltf}=await readCharacter(fileURLToPath(new URL(definition.assetUrl)));const mixer=new THREE.AnimationMixer(gltf.scene);
    const meshes:THREE.Mesh[]=[];gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
    function sample(){gltf.scene.updateMatrixWorld(true);const points:number[]=[];const p=new THREE.Vector3();
      for(const mesh of meshes){if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
        for(let i=0;i<mesh.geometry.attributes.position.count;i+=197){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.length()<12);points.push(...p.toArray());}}
      return points;
    }
    for(const entry of Object.values(definition.clips).filter(c=>c.loop)){
      mixer.stopAllAction();const clip=gltf.animations.find(c=>c.name===entry.name)!;const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
      mixer.setTime(0);const first=sample();mixer.setTime(clip.duration);const last=sample();assert.equal(first.length,last.length);
      assert.ok(first.every((n,i)=>Math.abs(n-last[i])<.001),`${entry.name} loop seam`);
    }
    for(const [a,b] of [['idle','walk'],['walk','run'],['run','idle'],['idle','attack'],['walk','attack'],['attack','idle']]){
      mixer.stopAllAction();mixer.setTime(0);const first=mixer.clipAction(gltf.animations.find(c=>c.name===definition.clips[a].name)!).reset().play();mixer.update(.15);
      const next=mixer.clipAction(gltf.animations.find(c=>c.name===definition.clips[b].name)!).reset().play();first.crossFadeTo(next,.18,false);
      for(let i=0;i<8;i++){mixer.update(.03);sample();}assert.ok(gltf.scene.position.length()<.001,'no double root motion');
    }
    mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);new CharacterKit(gltf,definition).dispose();
  });
}
test('blackbeard: exported muzzle +Z follows the actual skinned barrel, not Blender source -Y',async()=>{
  const {gltf}=await readCharacter(fileURLToPath(new URL(CHARACTER_KITS.blackbeard.assetUrl)));
  const rig=JSON.parse(await readFile(new URL('../../assets/characters/blackbeard/rig/rig_manifest.json',import.meta.url),'utf8'));
  const mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(c=>c.name==='Attack')!).play();mixer.setTime(17/30);gltf.scene.updateMatrixWorld(true);
  const socket=gltf.scene.getObjectByName('Blackbeard_Muzzle')!,mesh=gltf.scene.getObjectByName('Blackbeard_firearm_1') as THREE.SkinnedMesh;mesh.skeleton.update();
  assert.equal(socket.parent?.name,'HandR');const rest=new THREE.Matrix4().set(...rig.weapon_attachment.rest_world_matrix.flat() as [number,number,number,number,number,number,number,number,number,number,number,number,number,number,number,number]);
  function point(y:number){const p=new THREE.Vector3(0,y,.138).applyMatrix4(rest);p.set(p.x,p.z,-p.y);return mesh.applyBoneTransform(0,p).applyMatrix4(mesh.matrixWorld);}
  const muzzle=point(-.467),breech=point(-.139),axis=new THREE.Vector3(0,0,1).transformDirection(socket.matrixWorld);
  assert.ok(muzzle.distanceTo(socket.getWorldPosition(new THREE.Vector3()))<1e-5);assert.ok(muzzle.sub(breech).normalize().dot(axis)>.99999);
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);new CharacterKit(gltf,CHARACTER_KITS.blackbeard).dispose();
});

test('napoleonMounted: one clock keeps the rider seat and sword aligned throughout every mounted clip',async()=>{
  const definition=CHARACTER_KITS.napoleonMounted,{gltf}=await readCharacter(fileURLToPath(new URL(definition.assetUrl)));
  const saddle=gltf.scene.getObjectByName('SaddleSocket')!,seat=gltf.scene.getObjectByName('RiderSeatAnchor')!;
  const grip=gltf.scene.getObjectByName('SaberSocket')!,tip=gltf.scene.getObjectByName('SaberTip')!;assert.ok(saddle&&seat&&grip&&tip);
  const mixer=new THREE.AnimationMixer(gltf.scene);
  for(const clip of gltf.animations){
    mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();let first:THREE.Vector3|undefined,length=0;
    for(let i=0;i<=32;i++){
      mixer.setTime(clip.duration*i/32);gltf.scene.updateMatrixWorld(true);
      const local=saddle.worldToLocal(seat.getWorldPosition(new THREE.Vector3()));
      if(!first)first=local.clone();assert.ok(local.distanceTo(first)<.002,'seat drift relative to saddle exceeds2mm');
      const blade=tip.getWorldPosition(new THREE.Vector3()).sub(grip.getWorldPosition(new THREE.Vector3()));
      if(i===0)length=blade.length();assert.ok(length>.3&&length<2);assert.ok(Math.abs(blade.length()-length)<.001,'blade must remain attached during mounted attack');
    }
  }
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);new CharacterKit(gltf,definition).dispose();
});

test('every released gzip sidecar restores the exact GLB, not a stale prior geometry',async()=>{
  const root=fileURLToPath(new URL('../../assets/characters/',import.meta.url));let count=0;
  async function visit(directory:string){for(const item of await readdir(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory())await visit(file);else if(file.endsWith('.glb.gz')){
    const [compressed,raw]=await Promise.all([readFile(file),readFile(file.slice(0,-3))]);assert.deepEqual(gunzipSync(compressed),raw,file);count++;
  }}}
  for(const name of ['blackbeard','musashi','napoleon'])await visit(path.join(root,name));assert.ok(count>=7);
});
test('published default asset hashes match the curated release manifest',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../../assets/characters/CHARACTER_KIT_MANIFEST.json',import.meta.url),'utf8'));
  assert.deepEqual(manifest.characters.map((c:{id:string})=>c.id).sort(),Object.keys(CHARACTER_KITS).sort());
  for(const entry of manifest.characters){const data=await readFile(fileURLToPath(new URL(CHARACTER_KITS[entry.id as keyof typeof CHARACTER_KITS].assetUrl)));
    assert.equal(createHash('sha256').update(data).digest('hex'),entry.runtime.gzip_sha256);
    assert.equal(createHash('sha256').update(gunzipSync(data)).digest('hex'),entry.runtime.raw_sha256);
  }
});
for(const variant of [
  {name:'Blackbeard optional tricorn',url:'../../assets/characters/blackbeard/hat/blackbeard_tricorn.glb.gz',profile:CHARACTER_KITS.blackbeard},
  {name:'Musashi optional LOD1',url:'../../assets/characters/musashi/Musashi_Runtime_LOD1.glb.gz',profile:CHARACTER_KITS.musashi},
])test(`${variant.name}: explicit optional variant preserves the same runtime clip/socket contract`,async()=>{
  const {gltf}=await readCharacter(fileURLToPath(new URL(variant.url,import.meta.url))),report=inspectCharacter(gltf);assert.deepEqual(report.faults,[]);
  const events:KitEventResult[]=[],actor=new CharacterKit(gltf,variant.profile,{onEvent:e=>events.push(e)});actor.play('attack');
  for(let i=0;i<36;i++)actor.update(.05);assert.equal(events.length,variant.profile.clips.attack.events.length);assert.equal(actor.state,'idle');actor.dispose();
});
