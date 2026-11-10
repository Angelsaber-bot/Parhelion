import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {REGIONS,boundaryWalls, placeRegion } from '../src/map/regions';
import {regionLoader,bakeQuantized} from '../src/rendering/glb';
import {WorldGrid} from '../src/map/grid';
import {Player} from '../src/player/player';
const roots:THREE.Object3D[]=[],terrains:THREE.Mesh[]=[];
for(const def of REGIONS){
  const bytes=readFileSync(new URL(`../public/assets/${def.file}.core.glb`,import.meta.url));
  const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  bakeQuantized(scene);placeRegion(scene, def);scene.updateMatrixWorld(true);
  roots.push(scene);terrains.push(scene.getObjectByName('Terrain') as THREE.Mesh);
}
const grid=new WorldGrid(terrains,-1080,-1800,2160,2);
const joins=[
  {x:-360,z:-1440,axis:'x',name:'Orleans–Egypt'}, {x:360,z:-1440,axis:'x',name:'Egypt–Kyoto'},
  {x:-360,z:-720,axis:'x',name:'Qin–Winter'}, {x:360,z:-720,axis:'x',name:'Winter–Black Sail'},
  {x:-360,z:0,axis:'x',name:'Britain–Valley'}, {x:360,z:0,axis:'x',name:'Valley–Home'},
  {x:-720,z:-1080,axis:'z',name:'Orleans–Qin'}, {x:0,z:-1080,axis:'z',name:'Egypt–Winter'},
  {x:720,z:-1080,axis:'z',name:'Kyoto–Black Sail'}, {x:-720,z:-360,axis:'z',name:'Qin–Britain'},
  {x:0,z:-360,axis:'z',name:'Winter–Valley'}, {x:720,z:-360,axis:'z',name:'Black Sail–Home'},
];
function localCollision(x:number,z:number,axis:string){
  const dx=axis==='x'?50:12,dz=axis==='z'?50:12,positions:number[]=[],v=new THREE.Vector3();
  for(const root of roots)root.getObjectByName('COLLISION')!.traverse(o=>{
    const m=o as THREE.Mesh;if(!m.isMesh||m.userData.dynamic)return;
    const g=m.geometry,p=g.attributes.position,index=g.index,count=index?.count??p.count;
    const box=new THREE.Box3().setFromBufferAttribute(p as THREE.BufferAttribute).applyMatrix4(m.matrixWorld);
    if(box.max.x<x-dx||box.min.x>x+dx||box.max.z<z-dz||box.min.z>z+dz)return;
    for(let i=0;i<count;i+=3){
      const points=[];for(let j=0;j<3;j++){v.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(m.matrixWorld);points.push(v.clone());}
      if(points.every(p=>p.x<x-dx)||points.every(p=>p.x>x+dx)||points.every(p=>p.z<z-dz)||points.every(p=>p.z>z+dz))continue;
      for(const p of points)positions.push(p.x,p.y,p.z);
    }
  });
  const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  return {g,bvh:new MeshBVH(g)};
}
function ground(bvh:MeshBVH,x:number,z:number,ceiling=150){const hit=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x,ceiling,z),new THREE.Vector3(0,-1,0)),THREE.DoubleSide);assert.ok(hit,`ground at ${x},${z}`);return hit.point.y;}
function cross(bvh:MeshBVH,x:number,z:number,axis:string,reverse:boolean){
  const direction=reverse?-1:1,ax=axis==='x'?1:0,az=axis==='z'?1:0;
  const sx=x-35*ax*direction,sz=z-35*az*direction,gx=x+35*ax*direction,gz=z+35*az*direction;
  const p=new Player([{name:'continental ground',bvh,enabled:true}],0);p.teleport(sx,ground(bvh,sx,sz)+.5,sz);
  for(let i=0;i<90;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});
  for(let i=0;i<3000&&Math.hypot(p.pos.x-gx,p.pos.z-gz)>1;i++){
    p.yaw=Math.atan2(-(gx-p.pos.x),-(gz-p.pos.z));p.step(1/120,{x:0,z:1,jump:false,sprint:true});
  }
  assert.ok(Math.hypot(p.pos.x-gx,p.pos.z-gz)<1,`walk stuck at ${p.pos.toArray()}, target ${gx},${gz}`);
  for(let i=0;i<120;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});
  assert.ok(Math.abs(p.pos.y-ground(bvh,p.pos.x,p.pos.z,p.pos.y+1))<.5,`floor contact ${p.pos.y}, floor ${ground(bvh,p.pos.x,p.pos.z,p.pos.y+1)}`);assert.equal(p.swimming,false);
}
test('only the world exterior has a boundary wall',()=>{
  const g=boundaryWalls(),p=g.attributes.position;
  for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getX(i))>=1080||p.getZ(i)<=-1800||p.getZ(i)>=360);
  g.dispose();
});
for(const join of joins)test(`${join.name}: broad joins match heights and permit walking both ways off the road`,()=>{
  for(let t=-260;t<=260;t+=20){const x=join.x+(join.axis==='z'?t:0),z=join.z+(join.axis==='x'?t:0);assert.ok(grid.sampleHeight(x,z)!>.4,`no sea gutter at ${x},${z}`);}
  for(const t of [-180,180]){
    const x=join.x+(join.axis==='z'?t:0),z=join.z+(join.axis==='x'?t:0),{g,bvh}=localCollision(x,z,join.axis);
    const heights=terrains.map(m=>{
      const local=new THREE.Vector3(x,0,z).applyMatrix4(m.matrixWorld.clone().invert()),p=m.geometry.attributes.position;
      let height:number|undefined;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-local.x)<.04&&Math.abs(p.getZ(i)-local.z)<.04){height=p.getY(i);break;}return height;
    }).filter((y):y is number=>y!==undefined);
    assert.ok(heights.length>=2);assert.ok(Math.max(...heights)-Math.min(...heights)<.08,'meshes share a floor');
    cross(bvh,x,z,join.axis,false);cross(bvh,x,z,join.axis,true);g.dispose();
  }
});
test('the home town is dry land and the four-tile junctions have a floor',()=>{
  for(const x of [540,720,900])for(const z of [-180,0,180])assert.ok(grid.sampleHeight(x,z)!>0);
  for(const x of [-360,360])for(const z of [-1080,-360])assert.ok(grid.sampleHeight(x,z)!>0);
});
