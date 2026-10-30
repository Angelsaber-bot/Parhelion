import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createValleyStoryScene } from '../src/valleyStoryScene.ts';
import type { SettlementPlacement } from '../src/settlements/types.ts';
const placement:SettlementPlacement={id:'alpha',name:['测试','Test'],position:[-166,10.0383,212],entry:[-166,10.0383,227],footprint:[34,30],groundRange:0};
test('Valley additions have a small static budget, no added light/shadow emitter or textures',()=>{
 const s=createValleyStoryScene(placement);let meshes=0,tris=0,lights=0;const mats=new Set<THREE.Material>();
 s.group.traverse(o=>{if(o instanceof THREE.Light)lights++;if(o instanceof THREE.Mesh){meshes++;tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.equal(o.castShadow,false);for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});
 assert.ok(meshes<=6);assert.ok(tris<=1000);assert.equal(lights,0);assert.ok(mats.size<=4);assert.equal(s.colliders.length,2);assert.equal(s.markers.length,1);
 for(const m of mats)assert.equal((m as THREE.MeshStandardMaterial).map,null);
 s.dispose();
});
test('power and optional gate cause persistent physical scene changes and reset reverses them',()=>{
 const s=createValleyStoryScene(placement), gate=s.group.getObjectByName('MaintenanceLiftGate')!,inlays=s.group.getObjectByName('RestoredPathInlays') as THREE.Mesh;
 const material=inlays.material as THREE.MeshStandardMaterial;const geometry=(gate as THREE.Mesh).geometry,tree=s.colliders[1].bvh,closedY=gate.position.y;
 assert.equal(s.colliders[1].enabled,true);assert.equal(gate.position.y,closedY);assert.equal(material.emissiveIntensity,0);
 s.applyState({powered:true,shortcutOpen:false,resolved:false});assert.ok(material.emissiveIntensity>0);assert.equal(s.colliders[1].enabled,true);
 s.applyState({powered:true,shortcutOpen:true,resolved:true});assert.equal(s.colliders[1].enabled,false);assert.ok(gate.position.y-closedY>2.5);assert.equal(s.group.userData.storyResolved,true);
 for(let i=0;i<1000;i++)s.applyState({powered:true,shortcutOpen:true,resolved:true});
 assert.equal((gate as THREE.Mesh).geometry,geometry);assert.equal(s.colliders[1].bvh,tree);
 s.applyState({powered:false,shortcutOpen:false,resolved:false});assert.equal(s.colliders[1].enabled,true);assert.equal(gate.position.y,closedY);assert.equal(material.emissiveIntensity,0);
 s.dispose();assert.equal(s.group.children.length,0);assert.ok(s.colliders.every(c=>!c.enabled));s.dispose();
});
