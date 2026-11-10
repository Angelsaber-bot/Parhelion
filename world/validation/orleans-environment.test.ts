import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {regionLoader,bakeQuantized} from '../src/rendering/glb';
import {Player} from '../src/player/player';
import {WorldGrid} from '../src/map/grid';
import {settlementGrassClearance} from '../src/map/grassClearance';
import {ORLEANS_PAVED_COURTS} from '../src/map/worldPlan';
import {ORLEANS_UNDERPASS} from '../src/map/orleansWorks';

const bytes=readFileSync(new URL('../public/assets/world_orleans.core.glb',import.meta.url));
const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(scene);scene.updateMatrixWorld(true);
const geos:THREE.BufferGeometry[]=[];
scene.getObjectByName('COLLISION')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;let g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());if(m.geometry.index)g.setIndex(m.geometry.index.clone());if(g.index)g=g.toNonIndexed();geos.push(g);});
const solid=mergeGeometries(geos),bvh=new MeshBVH(solid),colliders=[{name:'Orleans',bvh,enabled:true}];
const grid=new WorldGrid([scene.getObjectByName('Terrain') as THREE.Mesh],-360,-360,720,2);
const layout=JSON.parse(readFileSync(new URL('../public/assets/world_orleans.layout.json',import.meta.url),'utf8'));
function stepTo(p:Player,x:number,z:number){
  for(let i=0;i<1800&&Math.hypot(p.pos.x-x,p.pos.z-z)>.3;i++){
    p.yaw=Math.atan2(-(x-p.pos.x),-(z-p.pos.z));p.step(1/120,{x:0,z:1,jump:false,sprint:false});
  }
  assert.ok(Math.hypot(p.pos.x-x,p.pos.z-z)<.3,`blocked at ${p.pos.toArray()}, target ${x},${z}`);
  assert.equal(p.swimming,false);
}
test('river is cut into the terrain, with dry banks rather than a painted blue strip',()=>{
  for(const z of [40,70,100,130]){
    let bed=Infinity;for(let x=-260;x<-140;x+=2)bed=Math.min(bed,grid.sampleHeight(x,z)!);
    assert.ok(bed<-1.5,`river bed at ${z}`);
    let westBank=-Infinity;for(let x=-260;x<=-220;x+=2)westBank=Math.max(westBank,grid.sampleHeight(x,z)!);
    assert.ok(westBank>5&&grid.sampleHeight(-120,z)!>5,`dry banks before the outer estuary at ${z}`);
  }
});
test('the service watercourse has a visible inward-facing stone vault and clear headroom below intact terrain',()=>{
 for(let i=4;i<=5;i++)for(const t of [.2,.5,.8]){
  const a=ORLEANS_UNDERPASS[i-1],b=ORLEANS_UNDERPASS[i],x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
  const floor=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x,3,z),new THREE.Vector3(0,-1,0)),THREE.FrontSide);
  const roof=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x,4.1,z),new THREE.Vector3(0,1,0)),THREE.FrontSide);
  assert.ok(floor&&Math.abs(floor.point.y-2.5)<.1,`dry walkway ${x},${z}`);
  assert.ok(roof&&roof.point.y>7.3&&roof.point.y<7.8,`inside-facing vault ${x},${z}: ${roof?.point.y}`);
  if((i===4&&t===.8)||(i===5&&t===.2))assert.ok(grid.sampleHeight(x,z)!>roof.point.y,'central tunnel retains town terrain above; the two sloping mouths are open');
 }
});
test('cathedral has an open nave, stone floor, a solid roof and a usable main entrance',()=>{
  for(const z of [-142,-165,-185]){
    const down=new THREE.Ray(new THREE.Vector3(35,34,z),new THREE.Vector3(0,-1,0)),floor=bvh.raycastFirst(down,THREE.DoubleSide);
    assert.ok(floor&&floor.point.y>=32.06&&floor.point.y<32.4,`stone floor at ${z}`);
    const up=new THREE.Ray(new THREE.Vector3(35,34,z),new THREE.Vector3(0,1,0)),roof=bvh.raycastFirst(up,THREE.DoubleSide);assert.ok(roof&&roof.point.y>50,'nave is roofed above head clearance');
  }
  const p=new Player(colliders,0);p.teleport(35,32.8,-120);for(let i=0;i<90;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});stepTo(p,35,-190);stepTo(p,35,-120);
});
test('every authored townhouse entrance can be walked into and back out without jumping',()=>{
  const houses=layout.development.houses as {position:[number,number,number];width:number;depth:number;rotation:number;approach:[number,number,number]}[];
  assert.ok(houses.length>=40,'a town has connected street frontages, not three isolated placeholders');
  for(const [i,h] of houses.entries()){
    const [x,y,z]=h.position,dx=Math.sin(h.rotation),dz=Math.cos(h.rotation),inside=h.depth/2-1;
    const p=new Player(colliders,0);p.teleport(h.approach[0],h.approach[1]+.6,h.approach[2]);
    for(let j=0;j<120;j++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});
    try{stepTo(p,x+dx*inside,z+dz*inside);stepTo(p,x,z);stepTo(p,x-dx*(h.depth/2-2),z-dz*(h.depth/2-2));stepTo(p,x,z);assert.ok(Math.abs(p.pos.y-y)<.6,`floor ${p.pos.y} vs ${y}`);stepTo(p,h.approach[0],h.approach[2]);}catch(error){throw new Error(`house ${i} at ${h.position}: ${error instanceof Error?error.message:error}`);}
  }
});

test('Orleans uses distinct building masses and roof profiles, with no overlapping duplicate house placements',()=>{
  const houses=layout.development.houses as {position:[number,number,number];family:string}[];
  const families=new Set(houses.map(h=>h.family));assert.equal(families.size,6,'six distinct river-trade building families');
  const profiles:number[]=[];
  for(const family of families){
    const h=houses.find(h=>h.family===family)!,[x,y,z]=h.position;
    const hit=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x,150,z),new THREE.Vector3(0,-1,0)),THREE.DoubleSide);
    assert.ok(hit);profiles.push(hit.point.y-y);
  }
  assert.ok(Math.max(...profiles)-Math.min(...profiles)>7,'warehouse, workshop and narrow street houses have visibly different masses');
  assert.ok(new Set(profiles.map(y=>Math.round(y))).size>=5,'roof differences are geometric rather than palette swaps');
  for(let i=0;i<houses.length;i++)for(let j=i+1;j<houses.length;j++){
    assert.ok(Math.hypot(houses[i].position[0]-houses[j].position[0],houses[i].position[2]-houses[j].position[2])>8,'no duplicate or stacked townhouse instances');
  }
});

test('cloister has covered passages with head clearance and an open planted court',()=>{
  for(const [x,z] of [[130,-166],[130,-194],[108,-218],[96,-218]]){
    const floor=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x,34,z),new THREE.Vector3(0,-1,0)),THREE.DoubleSide);
    assert.ok(floor&&floor.point.y>=32&&floor.point.y<32.5,`arcade floor at ${x},${z}`);
    const roof=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x,34,z),new THREE.Vector3(0,1,0)),THREE.DoubleSide);
    assert.ok(roof&&roof.point.y>=37.5,`covered walk has full body clearance at ${x},${z}`);
  }
  const sky=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(111,34,-194),new THREE.Vector3(0,1,0)),THREE.DoubleSide);
  assert.equal(sky,null,'central court remains open to the sky');
});

import {orleansResidentSockets,createOrleansResidentLife} from '../src/map/orleansResidents';
import {createSettlementNpcs} from '../src/settlements/npcs';
test('local residents speak independent directions, stay grounded and patrol without changing authored data',()=>{
  const sockets=orleansResidentSockets(),original=JSON.stringify(sockets),system=createSettlementNpcs(sockets);
  const ground=(x:number,z:number,ceiling:number)=>bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x+720,ceiling,z+720),new THREE.Vector3(0,-1,0)),THREE.DoubleSide)?.point.y??null;
  const life=createOrleansResidentLife(system,ground);
  assert.equal(sockets.length,8);assert.ok(sockets.every(s=>s.worldRegion==='orleans'));
  for(const s of sockets){
    const line=system.interact(s.id)!;assert.ok(line[0].length>10&&line[1].length>20);const p=system.getPosition(s.id)!;const floor=ground(p[0],p[2],p[1]+1);assert.ok(floor!==null&&Math.abs(floor-p[1])<.18,`${s.id} is grounded`);
    const visitor=new Player(colliders,0);visitor.teleport(p[0]+720,p[1]+.6,p[2]+720);
    for(let j=0;j<120;j++)visitor.step(1/120,{x:0,z:0,jump:false,sprint:false});
    assert.ok(Math.hypot(visitor.pos.x-p[0]-720,visitor.pos.z-p[2]-720)<.25&&Math.abs(visitor.pos.y-floor!)<.25,`${s.id} has full body clearance`);
  }
  for(const id of ['orleans_wall_patrol','orleans_quay_porter']){
    const start=system.getPosition(id)!,viewer=new THREE.Vector3(start[0]+8,start[1],start[2]+5);
    for(let i=0;i<900;i++){system.update(1/60,viewer);life.update(1/60,viewer,null,true);}
    const end=system.getPosition(id)!;assert.ok(Math.hypot(end[0]-start[0],end[2]-start[2])>5,'patrol visibly moves');assert.ok(Math.abs(end[1]-ground(end[0],end[2],end[1]+1)!)<.18);
    for(let i=0;i<120;i++)life.update(1/60,viewer,id,true);assert.deepEqual(system.getPosition(id),end,'conversation pauses the walker');
  }
  assert.equal(JSON.stringify(sockets),original);system.group.updateMatrixWorld(true);system.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
  life.dispose();system.dispose();
});

test('ordinary curving street lanes remain walkable between their houses and market furniture',()=>{
  for(const [i,authored] of (layout.development.streetLanes as [number,number,number][][]).entries())for(const lane of [authored,[...authored].reverse()]){
    const p=new Player(colliders,0),a=lane[0];p.teleport(a[0],a[1]+.6,a[2]);for(let k=0;k<90;k++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});
    for(const point of lane.filter((_,j)=>j%4===0||j===lane.length-1)){
      try{stepTo(p,point[0],point[2]);assert.ok(Math.abs(p.pos.y-point[1])<1.2,`street floor ${p.pos.y} vs ${point[1]}`);}catch(error){throw new Error(`lane ${i}: ${error instanceof Error?error.message:error}`);}
    }
  }
});

test('nine finished landmarks use persistent discovery markers without granting story or boss completion',()=>{
  const discoveries=layout.markers.filter((m:{type:string})=>m.type==='discovery');assert.equal(discoveries.length,9);assert.equal(layout.objective.steps.length,0);
  assert.equal(new Set(discoveries.map((m:{id:string})=>m.id)).size,9);
  for(const m of discoveries){const [x,y,z]=m.p;const hit=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x,y+1,z),new THREE.Vector3(0,-1,0)),THREE.DoubleSide);assert.ok(hit&&Math.abs(hit.point.y-y)<.6,`${m.id} is a physical place`);}
});
test('rounded paved courts exclude grass while their surrounding hillside remains planted',()=>{
  const g={x0:-1080,z0:-1080,cell:2,nx:361,nz:361},mask=settlementGrassClearance(g,[],[],[],ORLEANS_PAVED_COURTS);
  const at=(x:number,z:number)=>mask[Math.round((z-g.z0)/g.cell)*g.nx+Math.round((x-g.x0)/g.cell)];
  for(const [x,z,rx,rz] of ORLEANS_PAVED_COURTS){
    assert.equal(at(x,z),1);assert.equal(at(x+rx*.65,z),1,'walkable paving stays clear');
    assert.equal(at(x+rx+6,z),0,'adjacent meadow is retained');assert.equal(at(x+rx,z+rz),0,'clearing is rounded rather than a rectangular patch');
  }
});
