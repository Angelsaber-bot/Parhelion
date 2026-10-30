import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {regionLoader,bakeQuantized} from '../src/glb';
import {WorldGrid} from '../src/grid';
import {GRID} from '../src/regions';
import {mergeParts} from '../src/settlements/merge';
import {installSettlements} from '../src/settlements/core';
import {buildAlphaSettlement} from '../src/settlements/alpha';
import {createValleyStoryScene} from '../src/valleyStoryScene';
import {Player} from '../src/player';
import {createSettlementNpcs} from '../src/settlements/npcs';
const bytes=readFileSync(new URL('../public/assets/world_alpha.glb',import.meta.url));
const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
const terrains:THREE.Mesh[]=[],geos:THREE.BufferGeometry[]=[],props:THREE.BufferGeometry[]=[];
gltf.scene.getObjectByName('ART')!.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='Terrain')terrains.push(o);});
gltf.scene.getObjectByName('COLLISION')!.traverse(o=>{if(!(o instanceof THREE.Mesh))return;let g=new THREE.BufferGeometry().setAttribute('position',o.geometry.attributes.position.clone());if(o.geometry.index)g.setIndex(o.geometry.index.clone());g.applyMatrix4(o.matrixWorld);if(g.index)g=g.toNonIndexed();geos.push(g);if(o.name!=='COL_Terrain')props.push(g);});
const layout=JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json',import.meta.url),'utf8'));
const grid=new WorldGrid(terrains,GRID.x0,GRID.z0,GRID.span,GRID.cell,'#4f8fa8',GRID.spanZ);
const settlements=installSettlements([buildAlphaSettlement()],{grid,layout,blockers:new MeshBVH(mergeParts(props))});
const placement=settlements.placements[0];
const worldCollider={name:'actual-alpha-and-residence',enabled:true,bvh:new MeshBVH(mergeParts([...geos,...settlements.collisionGeometries]))};
test('actual shipped alpha residence: closed gate blocks Player, open gate permits passage; central entrance stays open',()=>{
 const scene=createValleyStoryScene(placement),[x,y,z]=placement.position;
 const walk=(dx:number,open:boolean)=>{scene.applyState({powered:open,shortcutOpen:open,resolved:open});const p=new Player([worldCollider,...scene.colliders],layout.world.waterLevel);p.teleport(x+dx,y+.2,z+18);for(let i=0;i<240;i++)p.step(1/120,{x:0,z:1,jump:false,sprint:false});return p.pos;};
 const closed=walk(6.7,false),open=walk(6.7,true),main=walk(0,false);
 assert.ok(closed.z>z+14,`closed ${closed.toArray()}`);assert.ok(open.z<z+9,`open ${open.toArray()}`);assert.ok(Math.abs(open.y-y)<.2,`terrain ${open.toArray()}`);assert.ok(main.z<z+9,`main entrance ${main.toArray()}`);
 console.log('Actual Valley Player gate walk',JSON.stringify({placement:placement.position,closed:closed.toArray(),open:open.toArray(),main:main.toArray()}));scene.dispose();
});
test('authored addition bounded cost, no lights, actual panel and return socket body clearance',()=>{
 const scene=createValleyStoryScene(placement);let meshes=0,triangles=0,lights=0;scene.group.traverse(o=>{if(o instanceof THREE.Light)lights++;if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});assert.ok(meshes<=6);assert.ok(triangles<500);assert.equal(lights,0);
 const [x,y,z]=placement.position;
 for(const p of [[x+5.2,y,z+16.5],[x-3,y,z+8],[x+8.8,y,z+15.3],[x+6.7,y,z+8]]){const b=new THREE.Box3(new THREE.Vector3(p[0]-.35,p[1]+.2,p[2]-.35),new THREE.Vector3(p[0]+.35,p[1]+1.75,p[2]+.35));assert.equal(worldCollider.bvh.intersectsBox(b,new THREE.Matrix4()),false,`blocked proposed standing point ${p}`);}
 const eye=new THREE.Vector3(x+8.8,y+1.62,z+15.3),target=new THREE.Vector3(...scene.markers[0].p),ray=new THREE.Ray(eye,target.clone().sub(eye).normalize()),length=eye.distanceTo(target);
 for(const collider of [worldCollider,...scene.colliders]){const hit=collider.bvh.raycastFirst(ray,THREE.DoubleSide);assert.ok(!hit||hit.distance>=length-.05,`panel LOS blocked by ${collider.name} at ${hit?.distance}`);}
 scene.applyState({powered:true,shortcutOpen:true,resolved:true});const lit=scene.group.getObjectByName('RestoredPathInlays') as THREE.Mesh;assert.ok((lit.material as THREE.MeshStandardMaterial).emissiveIntensity>0);scene.dispose();scene.dispose();assert.equal(scene.colliders.every(c=>!c.enabled),true);
});
test('resident relocation waits until return, moves interaction socket and preserves original caller data',()=>{
 const input=settlements.npcs,baseline=JSON.stringify(input),npcs=createSettlementNpcs(input),s=input.find(s=>s.id==='alpha_archivist')!,origin=new THREE.Vector3(...s.position),dest:[number,number,number]=[placement.position[0]-3,placement.position[1]+.02,placement.position[2]+8];
 npcs.setDialogue(s.id,[['新的线路已亮起。','The route is lit.']]);npcs.requestRelocation(s.id,dest);npcs.gesture(s.id);npcs.update(.1,origin);assert.deepEqual(npcs.group.getObjectByName(`Resident_${s.id}`)!.position.toArray(),s.position);npcs.update(.1,origin.clone().add(new THREE.Vector3(30,0,0)));assert.deepEqual(npcs.group.getObjectByName(`Resident_${s.id}`)!.position.toArray(),s.position);npcs.update(.1,new THREE.Vector3(300,10,300));assert.deepEqual(npcs.group.getObjectByName(`Resident_${s.id}`)!.position.toArray(),dest);assert.equal(npcs.nearest(new THREE.Vector3(...dest))?.id,s.id);assert.equal(npcs.interact(s.id)?.[1],'The route is lit.');assert.equal(JSON.stringify(input),baseline);
 npcs.setDialogue(s.id,null);assert.deepEqual(npcs.interact(s.id),s.lines[0]);npcs.requestRelocation(s.id,null);npcs.update(.1,new THREE.Vector3(300,10,300));assert.deepEqual(npcs.group.getObjectByName(`Resident_${s.id}`)!.position.toArray(),s.position);npcs.dispose();
});

test('archivist cooperation opens gate independently of optional green panel confirmation',()=>{
 const scene=createValleyStoryScene(placement),panel=scene.group.getObjectByName('MaintenanceLatchPanel') as THREE.Mesh,material=panel.material as THREE.MeshStandardMaterial;
 scene.applyState({powered:false,shortcutOpen:true,resolved:false});assert.equal(scene.colliders[1].enabled,false);assert.equal(material.emissiveIntensity,0);assert.equal(material.color.getHex(),0x56666b);
 scene.applyState({powered:false,shortcutOpen:true,resolved:false,discovered:true});assert.equal(scene.colliders[1].enabled,false);assert.equal(material.emissiveIntensity,.9);assert.equal(material.color.getHex(),0x8ce2b0);
 const npcs=createSettlementNpcs(settlements.npcs);const p=npcs.getPosition('alpha_archivist')!;p[0]=999;assert.notEqual(npcs.getPosition('alpha_archivist')![0],999);assert.equal(npcs.getPosition('missing'),null);npcs.dispose();assert.equal(npcs.getPosition('alpha_archivist'),null);scene.dispose();
});

test('initial archivist stands grounded outside locked gate and is reachable before entry',()=>{
 const scene=createValleyStoryScene(placement),p=new Player([worldCollider,...scene.colliders],layout.world.waterLevel),[x,y,z]=scene.archivistInitial;p.teleport(x,y+.15,z);for(let i=0;i<120;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});assert.ok(Math.abs(p.pos.y-y)<.015,`NPC feet ${y}; physical ground ${p.pos.y}`);
 const input=settlements.npcs.map(s=>s.id==='alpha_archivist'?{...s,position:scene.archivistInitial}:s),npcs=createSettlementNpcs(input),approach=new THREE.Vector3(x,y,z+2);assert.equal(npcs.nearest(approach)?.id,'alpha_archivist');assert.ok(z>placement.position[2]+14);
 const eye=approach.clone().add(new THREE.Vector3(0,1.4,0)),target=new THREE.Vector3(x,y+1.2,z),ray=new THREE.Ray(eye,target.clone().sub(eye).normalize());for(const c of[worldCollider,...scene.colliders]){const hit=c.bvh.raycastFirst(ray,THREE.DoubleSide);assert.ok(!hit||hit.distance>eye.distanceTo(target)-.05,`NPC LOS blocked ${c.name}`);}npcs.dispose();scene.dispose();
});
