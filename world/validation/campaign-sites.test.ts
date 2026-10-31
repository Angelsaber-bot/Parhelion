import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { buildCampaignSite, createCampaignSites, CAMPAIGN_SITE_LOCAL, CAMPAIGN_SITE_LIMITS } from '../src/campaignSites.ts';
import { buildAlphaSettlement } from '../src/settlements/alpha.ts';
import { buildBritainSettlement } from '../src/settlements/britain.ts';
import { buildBlackSailSettlement } from '../src/settlements/blacksail.ts';
import { buildWinterSettlement } from '../src/settlements/winter.ts';
import { buildKyotoSettlement } from '../src/settlements/kyoto.ts';
import { createEraStoryScene } from '../src/eraStoryScenes.ts';
import { createValleyStoryScene } from '../src/valleyStoryScene.ts';
import { mergeParts } from '../src/settlements/merge.ts';
import { Player } from '../src/player.ts';
import type { RegionId, SettlementPlacement } from '../src/settlements/types.ts';
const builders={alpha:buildAlphaSettlement,britain:buildBritainSettlement,blacksail:buildBlackSailSettlement,winter:buildWinterSettlement,kyoto:buildKyotoSettlement};
// Explicit single-storey door, sleeping-wing, workshop and stable circulation.
const interiorTargets:Partial<Record<RegionId,[string,number,number][]>>={
 alpha:[['residence_door',0,-.6],['central_hall',0,-3],['west_sleeping_aisle',-6.5,-11.8],['east_sleeping_aisle',6.5,-11.8],['rear_dining_aisle',3.8,-11.5]],
 britain:[['forge_door',-10,6],['forge_rear_aisle',-10,-6.8],['forge_work_aisle',-8,-3],['stable_front_aisle',7,7],['stable_rear_aisle',7,-6.5],['abbey_nave',0,-12]],
 kyoto:[['inn_door',8,4.7],['inn_central_room',8,0],['west_sleeping_aisle',6,-7],['east_sleeping_aisle',10,-7],['smith_entry',-10,3.5],['smith_work_aisle',-9,-5]]
};
const choices={alpha:['broadcast','listen'],britain:['names','seats'],blacksail:['families','supplies'],winter:['shelter','convoy'],kyoto:['records','refuge']};
for(const region of Object.keys(builders)as RegionId[]){
 test(`campaign ${region}: bounded material-batched geometry, no lights/textures/shadow cost`,()=>{
  const site=buildCampaignSite(region);let triangles=0,meshes=0;const materials=new Set<THREE.Material>();
  site.root.traverse(o=>{assert.ok(!(o instanceof THREE.Light));if(!(o instanceof THREE.Mesh))return;meshes++;assert.equal(o.castShadow,false);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;const m=o.material as THREE.MeshStandardMaterial;materials.add(m);assert.equal(m.map,null);for(const a of Object.values(o.geometry.attributes))for(const v of a.array)assert.ok(Number.isFinite(v));});
  assert.ok(triangles<CAMPAIGN_SITE_LIMITS.triangles,`${triangles} triangles`);assert.ok(meshes<=CAMPAIGN_SITE_LIMITS.meshes);assert.ok(materials.size<=CAMPAIGN_SITE_LIMITS.materials);
  const kit=builders[region]();site.root.position.set(...CAMPAIGN_SITE_LOCAL[region]);site.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(site.root);
  assert.ok(b.min.x>=-kit.footprint[0]/2&&b.max.x<=kit.footprint[0]/2,'within original X footprint');assert.ok(b.min.z>=-kit.footprint[1]/2&&b.max.z<=kit.footprint[1]/2,'within original Z footprint');
  assert.ok(Math.hypot(site.interactions[0][0]-site.interactions[1][0],site.interactions[0][2]-site.interactions[1][2])>=2);site.dispose();
 });
 test(`campaign ${region}: state projection preserves geometry, materials and collision identity`,()=>{
  const site=buildCampaignSite(region),meshes=site.root.children as THREE.Mesh[],geometries=meshes.map(m=>m.geometry),materials=meshes.map(m=>m.material),collision=[...site.collisionGeometries];
  for(let i=0;i<1000;i++)site.applyState({stage:(i%4)as 0|1|2|3,choice:choices[region][i%2]});
  assert.deepEqual(meshes.map(m=>m.geometry),geometries);assert.deepEqual(meshes.map(m=>m.material),materials);assert.deepEqual(site.collisionGeometries,collision);
  for(const [index,choice]of choices[region].entries()){site.applyState({stage:3,choice});assert.equal(site.root.getObjectByName(`Campaign_${region}_choice${index===0?'A':'B'}`)?.visible,true);assert.equal(site.root.getObjectByName(`Campaign_${region}_choice${index===0?'B':'A'}`)?.visible,false);assert.equal(site.root.getObjectByName(`Campaign_${region}_resolved`)?.visible,true);}
  site.applyState({stage:0});for(const l of['briefed','choiceA','choiceB','resolved'])assert.equal(site.root.getObjectByName(`Campaign_${region}_${l}`)?.visible,false);
  let disposed=0;for(const g of [...geometries,...collision])g.addEventListener('dispose',()=>disposed++);site.dispose();site.dispose();assert.equal(disposed,geometries.length+collision.length);
 });
 test(`campaign ${region}: actual Player reaches new and old interactions without jumping`,()=>{
  const kit=builders[region]();kit.group.updateMatrixWorld(true);
  const p:SettlementPlacement={id:region,name:kit.name,position:[0,0,0],entry:[kit.entry[0],0,kit.entry[1]],footprint:kit.footprint,groundRange:0};
  const campaign=createCampaignSites([p]),old=region==='alpha'?createValleyStoryScene(p):createEraStoryScene(p),geos:THREE.BufferGeometry[]=[];
  kit.group.traverse(o=>{if(!(o instanceof THREE.Mesh)||!o.userData.solid)return;let g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index)g=g.toNonIndexed();geos.push(new THREE.BufferGeometry().setAttribute('position',g.attributes.position.clone()));g.dispose();});geos.push(...campaign.collisionGeometries);
  const bvh=new MeshBVH(mergeParts(geos)),colliders=[{name:'combined',enabled:true,bvh},...old.colliders];
  const targets=[...(interiorTargets[region]??[]).map(([id,x,z])=>({id,p:[x,0,z]})),...campaign.markers.map(m=>({id:m.id,p:m.p})),...campaign.npcs.map(n=>({id:n.id,p:n.position})),...kit.npcs.map(n=>({id:n.id,p:n.position})),...old.markers.map(m=>({id:m.id,p:m.p}))];
  if(region==='alpha'){
   const origin=CAMPAIGN_SITE_LOCAL.alpha,npc=campaign.npcs[0];
   for(const [name,x,z,expected]of [['east_receiver',-.35,1.65,'campaign_alpha_work'],['east_dispatch',2.35,1.65,'campaign_alpha_decision'],['west_keeper',-3.6,2.2,npc.id]]as const){
    const feet=new THREE.Vector3(origin[0]+x,0,origin[2]+z),eye=feet.clone().add(new THREE.Vector3(0,1.2,0));
    const candidates=[...campaign.markers.map(m=>({id:m.id,p:m.p,r:m.radius!})),{id:npc.id,p:npc.position,r:2.8}].filter(t=>feet.distanceTo(new THREE.Vector3(...t.p))<t.r).sort((a,b)=>feet.distanceToSquared(new THREE.Vector3(...a.p))-feet.distanceToSquared(new THREE.Vector3(...b.p)));
    assert.equal(candidates[0]?.id,expected,`${name}: natural standing point selects intended interaction`);
    const aim=new THREE.Vector3(...candidates[0].p);if(expected===npc.id)aim.y+=1.2;const direction=aim.sub(eye),distance=direction.length();direction.normalize();
    assert.ok(!colliders.some(c=>c.enabled&&c.bvh.raycastFirst(new THREE.Ray(eye,direction),THREE.DoubleSide,0,distance-.25)),`${name}: visible line of interaction`);
   }
  }
  // Conservative body-clearance flood-fill; the final route is walked through actual Player physics.
  const cell=.5,minX=-kit.footprint[0]/2+1,maxX=kit.footprint[0]/2-1,minZ=-kit.footprint[1]/2+1,maxZ=kit.footprint[1]/2;
  const nx=Math.ceil((maxX-minX)/cell)+1,nz=Math.ceil((maxZ-minZ)/cell)+1,blocked=new Uint8Array(nx*nz),point=new THREE.Vector3();
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){const x=minX+ix*cell,z=minZ+iz*cell;const ground=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x,.2,z),new THREE.Vector3(0,-1,0)),THREE.DoubleSide,0,.5);if(!ground){blocked[iz*nx+ix]=1;continue;}for(const y of[.4,.9,1.45]){point.set(x,y,z);if(colliders.some(c=>c.enabled&&(c.bvh.closestPointToPoint(point)?.distance??Infinity)<.39)){blocked[iz*nx+ix]=1;break;}}}
  const index=(x:number,z:number)=>Math.max(0,Math.min(nz-1,Math.round((z-minZ)/cell)))*nx+Math.max(0,Math.min(nx-1,Math.round((x-minX)/cell)));
  const start=index(kit.entry[0],kit.entry[1]-.6),queue=[start],prev=new Int32Array(nx*nz).fill(-2);prev[start]=-1;
  for(let head=0;head<queue.length;head++){const at=queue[head],x=at%nx,z=Math.floor(at/nx);for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,zz=z+dz,next=zz*nx+xx;if(xx<0||zz<0||xx>=nx||zz>=nz||blocked[next]||prev[next]!==-2)continue;prev[next]=at;queue.push(next);}}
  for(const target of targets){
   let goal=-1,distance=Infinity;for(const cellIndex of queue){const x=minX+(cellIndex%nx)*cell,z=minZ+Math.floor(cellIndex/nx)*cell,d=Math.hypot(x-target.p[0],z-target.p[2]);if(d<distance){distance=d;goal=cellIndex;}}
   assert.ok(distance<.85,`${target.id} unreachable body socket, nearest distance ${distance}`);
   const route:number[]=[];for(let at=goal;at>=0;at=prev[at])route.push(at);route.reverse();
   const player=new Player(colliders,-12);player.teleport(minX+(start%nx)*cell,.05,minZ+Math.floor(start/nx)*cell);
   for(const at of route){const x=minX+(at%nx)*cell,z=minZ+Math.floor(at/nx)*cell;let reached=false;for(let step=0;step<180;step++){if(Math.hypot(player.pos.x-x,player.pos.z-z)<.16){reached=true;break;}player.yaw=Math.atan2(-(x-player.pos.x),-(z-player.pos.z));player.step(1/120,{x:0,z:1,jump:false,sprint:false});}assert.ok(reached,`${target.id} player blocked at ${player.pos.toArray()} toward ${x},${z}`);}
   assert.ok(player.pos.y>-.15,`${target.id} unsupported floor ${player.pos.toArray()}`);
  }
  old.dispose();campaign.dispose();
 });
}
test('campaign site placement preserves offsets and distance culling',()=>{
 const p:SettlementPlacement={id:'alpha',name:['测试','Test'],position:[100,20,-100],entry:[100,20,-85.5],footprint:[34,30],groundRange:0};
 const scene=createCampaignSites([p]);assert.deepEqual(scene.sites[0].origin,[93,20,-94.8]);assert.equal(scene.markers.length,2);assert.equal(scene.npcs.length,1);
 scene.update({x:93,z:-94.8});assert.equal(scene.sites[0].root.visible,true);scene.update({x:1000,z:1000});assert.equal(scene.sites[0].root.visible,false);scene.dispose();
});

test('hard kiosk, oath shelter and tile veranda roofs stop an upward player capsule',()=>{
 for(const region of['alpha','britain','kyoto']as const){const site=buildCampaignSite(region),floor=new THREE.BoxGeometry(12,.2,12).translate(0,-.1,0),pad=new THREE.BoxGeometry(.8,.1,.8).translate(0,.65,.7),merged=mergeParts([floor,pad,...site.collisionGeometries],false),bvh=new MeshBVH(merged),player=new Player([{name:'roof-proof',bvh,enabled:true}],-100);
  const ceiling=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(0,1.9,.7),new THREE.Vector3(0,1,0)),THREE.DoubleSide);assert.ok(ceiling,`${region} visually hard roof has no collider`);assert.ok(ceiling.point.y>2.5&&ceiling.point.y<3.7);
  player.teleport(0,.74,.7);for(let i=0;i<60;i++)player.step(1/120,{x:0,z:0,jump:false,sprint:false});assert.equal(player.onGround,true);let highest=0;
  for(let i=0;i<180;i++){player.step(1/120,{x:0,z:0,jump:i===0,sprint:false});highest=Math.max(highest,player.pos.y+1.75);}assert.ok(highest<=ceiling.point.y+.035,`${region}: head ${highest} penetrates roof ${ceiling.point.y}`);assert.equal(player.onGround,true);
  merged.dispose();floor.dispose();pad.dispose();site.dispose();
 }
});
