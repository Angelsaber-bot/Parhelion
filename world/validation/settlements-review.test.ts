import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {buildAlphaSettlement} from '../src/settlements/alpha.ts';
import {buildBritainSettlement} from '../src/settlements/britain.ts';
import {buildBlackSailSettlement} from '../src/settlements/blacksail.ts';
import {buildWinterSettlement} from '../src/settlements/winter.ts';
import {buildKyotoSettlement} from '../src/settlements/kyoto.ts';
const builders=[buildAlphaSettlement,buildBritainSettlement,buildBlackSailSettlement,buildWinterSettlement,buildKyotoSettlement];
for(const build of builders){
 test(`${build.name}: finite detailed geometry, bilingual sockets, bounded footprint`,()=>{
  const kit=build();kit.group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(kit.group);assert.ok(!bounds.isEmpty());
  let tris=0,meshes=0,solids=0;
  kit.group.traverse((node)=>{const mesh=node as THREE.Mesh;if(!mesh.isMesh)return;meshes++;const pos=mesh.geometry.getAttribute('position');assert.ok(pos?.count>0);for(const v of pos.array)assert.ok(Number.isFinite(v));tris+=(mesh.geometry.index?.count??pos.count)/3;if(mesh.userData.solid)solids++;});
  assert.ok(meshes>=6,'buildings need visible architectural layers');assert.ok(tris<150000,'per-settlement triangle budget');assert.ok(solids>0,'walls/floors require physical collision');
  assert.ok(bounds.max.x<=kit.footprint[0]/2+.5 && bounds.min.x>=-kit.footprint[0]/2-.5,'X footprint must include eaves/props');
  assert.ok(bounds.max.z<=kit.footprint[1]/2+.5 && bounds.min.z>=-kit.footprint[1]/2-.5,'Z footprint must include eaves/props');
  assert.ok(kit.npcs.length>=1&&kit.npcs.length<=4,'small NPC count');assert.equal(new Set(kit.npcs.map(n=>n.id)).size,kit.npcs.length);
  for(const npc of kit.npcs){assert.ok(npc.position.every(Number.isFinite));assert.ok(npc.role.every(s=>s.trim().length>0));assert.ok(npc.lines.length>0);assert.ok(npc.lines.every(pair=>pair.length===2&&pair.every(s=>s.trim().length>0)));}
 });
 test(`${build.name}: entry and NPC body sockets are not inside solid walls`,()=>{
  const kit=build();kit.group.updateMatrixWorld(true);const solidTrees:MeshBVH[]=[];
  kit.group.traverse(node=>{if((node as THREE.Mesh).isMesh&&node.userData.solid)solidTrees.push(new MeshBVH((node as THREE.Mesh).geometry.clone().applyMatrix4(node.matrixWorld)));});
  const positions=[[kit.entry[0],.9,kit.entry[1]],...kit.npcs.map(n=>[n.position[0],n.position[1]+.9,n.position[2]])];
  for(const [x,y,z]of positions){const p=new THREE.Vector3(x,y,z);assert.ok(!solidTrees.some(b=>(b.closestPointToPoint(p)?.distance??Infinity)<.35),`socket ${x},${y},${z} has less than 0.35m physical surface clearance`);}
 });
}
import {Player} from '../src/player.ts';
const portals:[()=>ReturnType<typeof buildAlphaSettlement>,string,number,number][]=[
 [buildAlphaSettlement,'residence',0,-1],[buildBritainSettlement,'forge',-10,6],[buildBlackSailSettlement,'customs hall',0,5],[buildWinterSettlement,'aid house',-8,4],[buildKyotoSettlement,'inn',8,4],[buildKyotoSettlement,'swordsmith',-10,3],
];
for(const [build,label,x,z]of portals)test(`${build.name}: actual player walks into ${label} without jumping`,()=>{
 const kit=build();kit.group.updateMatrixWorld(true);const colliders:{name:string;bvh:MeshBVH;enabled:boolean}[]=[];
 kit.group.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&m.userData.solid)colliders.push({name:m.name,enabled:true,bvh:new MeshBVH(m.geometry.clone().applyMatrix4(m.matrixWorld))});});
 const player=new Player(colliders,-12);player.teleport(x,.05,z+2);
 for(let i=0;i<120;i++)player.step(1/120,{x:0,z:1,jump:false,sprint:false});
 assert.ok(player.pos.z<z-.7,`${label} front portal blocks player at ${player.pos.toArray()}`);assert.ok(player.pos.y>-.15,`${label} floor does not support player`);
});
