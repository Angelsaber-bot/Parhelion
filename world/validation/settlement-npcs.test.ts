import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSettlementNpcs, SETTLEMENT_NPC_LIMITS } from '../src/settlements/npcs';
import type { PlacedNpcSocket } from '../src/settlements/types';
const npc=(id='forge',x=0):PlacedNpcSocket=>({id,region:'britain',role:['铁匠','Blacksmith'],position:[x,2,0],lines:[['炉火正旺。','The forge is warm.'],['路上小心。','Safe travels.']]});
test('resident speaks only a known bilingual line, cycles without progression side effects',()=>{
 const sockets=[npc()];const original=JSON.stringify(sockets),system=createSettlementNpcs(sockets);
 assert.deepEqual(system.interact('forge'),sockets[0].lines[0]);assert.deepEqual(system.interact('forge'),sockets[0].lines[1]);assert.deepEqual(system.interact('forge'),sockets[0].lines[0]);assert.equal(system.interact('missing'),null);assert.equal(JSON.stringify(sockets),original);system.dispose();
});
test('nearest resident respects horizontal and vertical interaction bounds',()=>{
 const system=createSettlementNpcs([npc('far',5),npc('near',0)]);assert.equal(system.nearest(new THREE.Vector3(1,2,0))?.id,'near');assert.equal(system.nearest(new THREE.Vector3(0,5,0)),null);assert.equal(system.nearest(new THREE.Vector3(0,2,3)),null);assert.equal(system.nearest(new THREE.Vector3(0,2,SETTLEMENT_NPC_LIMITS.interaction))?.id,'near');system.dispose();
});
test('all five region residents have human-scale faces and bounded scene cost',()=>{
 const regions=['alpha','britain','blacksail','winter','kyoto'] as const;
 const system=createSettlementNpcs(regions.map((region,i)=>({...npc(region,i*4),region})));let meshes=0,triangles=0;const materials=new Set<THREE.Material>();system.group.updateMatrixWorld(true);
 system.group.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??0)/3;assert.ok(o.geometry.getAttribute('color'));if(!Array.isArray(o.material))materials.add(o.material);}});
 assert.equal(meshes,30);assert.equal(materials.size,1);assert.ok(triangles<70000,`${triangles} triangles exceed five-resident budget`);
 for(const person of system.group.children){assert.ok(person.getObjectByName('ResidentEyes'));const bounds=new THREE.Box3().setFromObject(person);const height=bounds.max.y-bounds.min.y;assert.ok(height>1.5&&height<1.95,`Unexpected resident height ${height}`);}system.dispose();
});
test('far residents are hidden and idle updates are finite for invalid delta',()=>{
 const system=createSettlementNpcs([npc()]);const person=system.group.children[0];system.update(.016,new THREE.Vector3(1000,2,0));assert.equal(person.visible,false);system.update(NaN,new THREE.Vector3(0,2,1));assert.equal(person.visible,true);for(let i=0;i<40;i++)system.update(.016,new THREE.Vector3(0,2,1));system.group.traverse(o=>assert.ok([o.position.x,o.position.y,o.position.z,o.rotation.x,o.rotation.y,o.rotation.z].every(Number.isFinite)));system.dispose();system.dispose();assert.equal(system.group.children.length,0);assert.equal(system.nearest(new THREE.Vector3()),null);assert.equal(system.interact('forge'),null);
});
test('invalid and duplicate resident sockets fail clearly before scene construction',()=>{
 assert.throws(()=>createSettlementNpcs([npc(),npc()]),/Duplicate/);assert.throws(()=>createSettlementNpcs([{...npc(),position:[NaN,0,0]}]),/Invalid/);
});

import {CAMPAIGN_EPISODES,CAMPAIGN_REGIONS} from '../src/campaignEpisodes';
test('campaign residents have distinct work silhouettes within the existing six-batch actor budget',()=>{
 const sockets=CAMPAIGN_REGIONS.map((region,i)=>({id:CAMPAIGN_EPISODES[region].npc,region,role:CAMPAIGN_EPISODES[region].speaker,position:[i*2,0,0]as[number,number,number],lines:[CAMPAIGN_EPISODES[region].brief]}));
 const residents=createSettlementNpcs(sockets);const signatures:number[]=[];
 for(const person of residents.group.children){let meshes=0,triangles=0;person.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});assert.equal(meshes,6);assert.ok(triangles<14000);signatures.push(triangles);}
 assert.equal(new Set(signatures).size,5,'each occupation has authored accessory geometry');
 for(let i=0;i<600;i++)residents.update(1/60,new THREE.Vector3(4,0,3));
 residents.group.updateMatrixWorld(true);for(const person of residents.group.children){const bounds=new THREE.Box3().setFromObject(person);assert.ok(bounds.max.y-bounds.min.y<2,'human-scaled work clothing');person.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}
 residents.dispose();
});
