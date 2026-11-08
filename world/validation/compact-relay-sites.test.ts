import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createCompactRelaySites,COMPACT_RELAY_ART_LIMITS} from '../src/story/compactRelaySites';
import {COMPACT_RELAY_SITE,COMPACT_RELAY_MARKER_IDS,COMPACT_RELAY_COVER,COMPACT_RELAY_PLATFORM} from '../src/story/compactRelaySitesData';
const height=(x:number,z:number)=>z<0?8.0147:10.003314018249512;
test('compact relay is one bounded authored yard, three covers and an accessible two-ramp deck, with no lights',()=>{
 const s=createCompactRelaySites(height),materials=new Set<THREE.Material>();let meshes=0,triangles=0;const bounds=new THREE.Box3().setFromObject(s.root);
 assert.ok(bounds.min.x>=-86&&bounds.max.x<=-40&&bounds.min.z>=200&&bounds.max.z<=236);s.root.traverse(o=>{assert.ok(!(o as THREE.Light).isLight);const m=o as THREE.Mesh;if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;for(const material of Array.isArray(m.material)?m.material:[m.material]){materials.add(material);assert.equal((material as THREE.MeshStandardMaterial).emissiveIntensity,1);assert.equal((material as THREE.MeshStandardMaterial).emissive.getHex(),0);}assert.equal(m.castShadow,false);});
 assert.ok(meshes<=COMPACT_RELAY_ART_LIMITS.meshes);assert.ok(triangles<COMPACT_RELAY_ART_LIMITS.triangles);assert.ok(materials.size<=3);assert.equal(s.collisionGeometries.length,6);assert.equal(COMPACT_RELAY_COVER.length,3);
 const p=COMPACT_RELAY_PLATFORM;assert.ok(Math.atan2(p.rise,p.deckStart-p.north)<Math.PI/12);assert.ok(Math.atan2(p.rise,p.south-p.deckEnd)<Math.PI/12);assert.equal(p.width,4.5);
 assert.deepEqual(s.markers.map(m=>m.id),COMPACT_RELAY_MARKER_IDS);assert.equal(s.markers[0].radius,1.5);assert.ok(Math.hypot(s.entry[0]-s.anchor[0],s.entry[2]-s.anchor[2])+1.5<12);for(const a of s.enemySockets)assert.ok(Math.hypot(a[0]-s.anchor[0],a[2]-s.anchor[2])<=10);
 assert.ok(Math.hypot(s.entry[0]-s.deployment[0],s.entry[2]-s.deployment[2])>10);s.dispose();
});
test('marker feet use real terrain and new solids do not cover start, channel or enemy standing sockets',()=>{
 const s=createCompactRelaySites(height);assert.equal(s.arrival[1],8.0147);for(const p of[s.entry,s.channelStand,s.deployment,...s.enemySockets])for(const g of s.collisionGeometries){g.computeBoundingBox();const b=g.boundingBox!;assert.ok(!(p[0]>b.min.x-.36&&p[0]<b.max.x+.36&&p[2]>b.min.z-.36&&p[2]<b.max.z+.36),'standing capsule overlaps a new obstacle');}
 assert.throws(()=>createCompactRelaySites(()=>null),/terrain unavailable/);s.dispose();
});
test('deck top uses front-facing triangles and both 1.2 m ramps connect to ground',()=>{
 const s=createCompactRelaySites(height);s.root.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(-44,20,218),new THREE.Vector3(0,-1,0));const top=ray.intersectObject(s.root,true)[0];assert.ok(top);assert.ok(Math.abs(top.point.y-(height(0,0)+1.2))<1e-5);s.dispose();
});
test('channel/completion/reset only change visible indicators, never geometry, colliders or markers',()=>{
 const s=createCompactRelaySites(height),meshes:THREE.Mesh[]=[];s.root.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});const geometry=meshes.map(m=>m.geometry),collision=[...s.collisionGeometries],markers=JSON.stringify(s.markers),resources=[...geometry,...collision],materials=new Set(meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]));
 for(let i=0;i<100;i++)s.applyState({active:!!(i%2),complete:i%3===0,progress:i%11/10});s.applyState({active:false,complete:false,progress:NaN});assert.ok(meshes.filter(m=>/briefed|choiceA|choiceB|resolved/.test(m.name)).every(m=>!m.visible));assert.deepEqual(meshes.map(m=>m.geometry),geometry);assert.deepEqual(s.collisionGeometries,collision);assert.equal(JSON.stringify(s.markers),markers);
 let disposed=0;for(const g of resources)g.addEventListener('dispose',()=>disposed++);for(const m of materials)m.addEventListener('dispose',()=>disposed++);s.dispose();s.dispose();assert.equal(disposed,resources.length+materials.size);
});

test('completed replay still displays the new active channel progress, while deployment remains unlocked',()=>{const s=createCompactRelaySites(height),layers=['briefed','choiceA','choiceB'];const mesh=(layer:string)=>s.root.children.find(o=>o.name.endsWith('_'+layer))!;s.applyState({active:false,complete:true,progress:0});assert(layers.every(l=>mesh(l).visible));for(const [progress,expected]of[[0,0],[.2,1],[.5,2],[1,3]]){s.applyState({active:true,complete:true,progress});assert.equal(layers.filter(l=>mesh(l).visible).length,expected);assert.equal(mesh('resolved').visible,true);}s.dispose();});

test('flank cable cover blocks a grounded lower lane but the maintenance deck sees over it',()=>{const s=createCompactRelaySites(height);s.root.updateMatrixWorld(true);const gun=new THREE.Vector3(-51,height(0,0)+1.25,228);const hits=(p:THREE.Vector3)=>{const delta=gun.clone().sub(p);return new THREE.Raycaster(p,delta.clone().normalize(),.01,delta.length()-.08).intersectObject(s.root,true);};assert.ok(hits(new THREE.Vector3(-47,height(0,0)+1.25,218)).length>0);assert.equal(hits(new THREE.Vector3(-44,height(0,0)+1.2+1.25,218)).length,0);s.dispose();});
