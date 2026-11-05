import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import{buildBritainSettlement}from'../src/settlements/britain.ts';import{buildWinterSettlement}from'../src/settlements/winter.ts';
import{architectureBatches,portHouse}from'../tools/gen/blacksail/architecture.ts';
function first(group:THREE.Object3D,p:number[],d:number[]){group.updateMatrixWorld(true);return new THREE.Raycaster(new THREE.Vector3(...p),new THREE.Vector3(...d)).intersectObject(group,true)[0]?.distance??Infinity;}
test('royal forge closes its rear attic and front roof/wall junction',()=>{
 const group=buildBritainSettlement().group;
 assert.ok(first(group,[-10,5.3,-12],[0,0,1])<4.3,'rear gable must meet the roof above the back wall');
 assert.ok(first(group,[-4.2,4.42,12],[0,0,-1])<6.3,'front infill must follow the actual overhanging roof pitch');
});
test('stable rear attic is weather closed while its walk-in arcade stays open',()=>{
 const group=buildBritainSettlement().group;
 assert.ok(first(group,[10,4.4,-12],[0,0,1])<3.3,'rear attic above the stable back wall');
 assert.ok(first(group,[7,1.8,11],[0,0,-1])>5,'open front aisle stays open');
});
test('winter aid-house attic has no gaps between the decorative board courses',()=>{
 const group=buildWinterSettlement().group;
 for(const dy of [.23,.45,.67,.89,1.11])assert.ok(first(group,[2,3.8+dy,-4],[-1,0,0])<3.2,`continuous attic cheek at ${dy}m`);
});
test('Nassau intact hip roofs have a physical underside and sealed perimeter',()=>{
 const a=architectureBatches();portHouse(a.art,0,0,0,0,10,8,5,0);
 const g=a.pieces().find(p=>p.material==='M_BlackSailTerracotta')!.batch.vis[0];
 const p=g.attributes.position,edges=new Map<string,number>();const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*10000)).join(',');
 for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){const x=key(i+j),y=key(i+(j+1)%3),id=x<y?`${x}/${y}`:`${y}/${x}`;edges.set(id,(edges.get(id)??0)+1);}
 assert.ok([...edges.values()].every(n=>n===2),'each roof edge must have exactly two incident faces');
 const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.FrontSide}));assert.ok(first(mesh,[0,5.5,0],[0,1,0])<3,'soffit visible from inside the hip');
});

test('all four Blackbeard fort watchtower roofs meet continuous masonry',async()=>{
 const {buildBlacksail}=await import('../tools/gen/blacksail/build.ts');
 const {heightFn}=await import('../tools/gen/blacksail/terrain.ts');
 const {FORT}=await import('../tools/gen/blacksail/layout.ts');
 const {mergeGeometries}=await import('three/examples/jsm/utils/BufferGeometryUtils.js');
 const {pieces}=buildBlacksail(heightFn),group=new THREE.Group();
 for(const p of pieces)if(p.batch.vis.length)group.add(new THREE.Mesh(mergeGeometries(p.batch.vis)!,new THREE.MeshBasicMaterial()));
 for(let k=0;k<4;k++){
  const angle=Math.PI/4+k*Math.PI/2,x=FORT.c[0]+Math.cos(angle)*(FORT.r-3)*1.15,z=FORT.c[1]+Math.sin(angle)*(FORT.r-3)*1.15;
  assert.ok(first(group,[x+4,FORT.top+5+3.55,z],[-1,0,0])<2,`watchtower ${k}: 1.1m gap below the roof`);
 }
});

test('sloping house foundations continuously join the existing floor and terrain with identical physical shape',async()=>{
 const {Batch}=await import('../tools/gen/geo.ts');const {addGroundFooting}=await import('../tools/gen/footings.ts');
 const flat=new Batch('flat');assert.equal(addGroundFooting(flat,0,2,0,0,10,8,()=>2,'#999999'),false);assert.equal(flat.vis.length,0);
 const b=new Batch('slope'),ry=.7,x=10,z=20,y=5,terrain=(px:number,pz:number)=>4+.1*(px-x)-.15*(pz-z);
 assert.equal(addGroundFooting(b,x,y,z,ry,10,8,terrain,'#999999'),true);
 assert.deepEqual(b.vis[0].attributes.position.array,b.col[0].attributes.position.array,'visible and physical foundation match');
 const mesh=new THREE.Mesh(b.vis[0],new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 for(const u of[-.49,0,.49])for(const v of[-.49,0,.49]){
  const px=x+Math.cos(ry)*u*10+Math.sin(ry)*v*8,pz=z-Math.sin(ry)*u*10+Math.cos(ry)*v*8;
  const hits=new THREE.Raycaster(new THREE.Vector3(px,100,pz),new THREE.Vector3(0,-1,0)).intersectObject(mesh);
  assert.ok(hits[0].point.y>=y&&hits.at(-1)!.point.y<terrain(px,pz),'support spans floor to sloped terrain');
 }
});
