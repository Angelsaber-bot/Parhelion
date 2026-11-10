import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { EXPANSION_PLANS, EXPANSION_CONNECTIONS, WORLD_PLAN, planToWorld, type RoutePoint } from '../src/map/worldPlan';
import { REGIONS, regionAt, boundaryWalls, placeRegion } from '../src/map/regions';
import { TILE_JOINS } from '../tools/gen/continent';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import { Player } from '../src/player/player';
import { WorldGrid } from '../src/map/grid';
import type { Layout } from '../src/core/types';

const boundaries=boundaryWalls();
async function load(id:string) {
  const def=REGIONS.find(r=>r.id===id)!;
  const bytes=readFileSync(new URL(`../public/assets/${def.file}.core.glb`,import.meta.url));
  const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  bakeQuantized(scene);placeRegion(scene, def);scene.updateMatrixWorld(true);
  return scene;
}
function geometry(root:THREE.Object3D) {
  const geos:THREE.BufferGeometry[]=[];
  root.getObjectByName('COLLISION')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||m.userData.dynamic)return;
    let g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());if(m.geometry.index)g.setIndex(m.geometry.index.clone());g.applyMatrix4(m.matrixWorld);if(g.index)g=g.toNonIndexed();geos.push(g);
  });return geos;
}
type Frame={offset:readonly [number,number];rotated?:boolean};
function walk(bvh:MeshBVH,route:readonly RoutePoint[],frame:Frame) {
  const p=new Player([{name:'static',enabled:true,bvh}],0),a=route[0],[ax,az]=planToWorld(frame,a[0],a[2]);
  p.teleport(ax,a[1]+.6,az);
  for(let i=0;i<90;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});
  for(let k=1;k<route.length;k++) {
    const goal=route[k],[x,z]=planToWorld(frame,goal[0],goal[2]);
    let frames=0;const budget=120*(Math.hypot(p.pos.x-x,p.pos.z-z)/6+12);
    while(Math.hypot(p.pos.x-x,p.pos.z-z)>1&&frames++<budget) {
      p.yaw=Math.atan2(-(x-p.pos.x),-(z-p.pos.z));p.step(1/120,{x:0,z:1,jump:false,sprint:true});
    }
    assert.ok(Math.hypot(p.pos.x-x,p.pos.z-z)<=1,`waypoint ${k}: stuck at ${p.pos.toArray().map(n=>n.toFixed(2))}, wanted ${x},${goal[1]},${z}`);
    assert.ok(Math.abs(p.pos.y-goal[1])<1.2,`waypoint ${k}: expected floor ${goal[1]}, got ${p.pos.y}`);
    assert.equal(p.swimming,false,'routes stay above the global water plane');
  }
  return p;
}

test('eight areas fit the approximate 3×3 envelope; finale remains an independent seven-domain map',()=>{
  assert.equal(REGIONS.length,9);assert.equal(WORLD_PLAN.finale.requiredRegions.length,7);assert.equal(WORLD_PLAN.finale.separateMap,true);
  assert.ok(!REGIONS.some(r=>String(r.id)==='convergence'));
  for(const plan of EXPANSION_PLANS) {
    assert.ok(plan.outline.length>8);
    assert.equal(regionAt(...plan.offset).id,plan.id);
    const [bx0,bx1,bz0,bz1]=WORLD_PLAN.bounds;
    for(const [lx,lz] of plan.outline){const [x,z]=planToWorld(plan,lx,lz);assert.ok(x>=bx0&&x<=bx1&&z>=bz0&&z<=bz1);}
    const def=REGIONS.find(r=>r.id===plan.id)!;
    assert.equal(WORLD_PLAN.topology,'continuous-mainland');
    assert.equal(WORLD_PLAN.interiorBarriers,false);
    const layout:Layout=JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`,import.meta.url),'utf8'));
    assert.equal(layout.objective.steps.length,0,'walking through a blockout cannot finish a chapter');
    assert.ok(layout.markers.every(m=>m.type==='spawn'||m.type==='poi'||m.type==='discovery'),'real discoveries are separate from story and boss completion markers');
  }
  for(const id of ['alpha','britain','blacksail','winter','kyoto']) {
    const def=REGIONS.find(r=>r.id===id)!;assert.equal(regionAt(...def.offset).id,id);
  }
});

for(const plan of EXPANSION_PLANS) {
  test(`${plan.id}: shipped collision supports all main, side and vertical routes without jumping`,async()=>{
    const root=await load(plan.id),geos=geometry(root);const merged=mergeGeometries([boundaries,...geos]);const bvh=new MeshBVH(merged);
    for(const route of plan.routes) {
      try{walk(bvh,route.points,plan);walk(bvh,[...route.points].reverse(),plan);}catch(error){throw new Error(`${plan.id}/${route.id}: ${error instanceof Error?error.message:error}`);}
    }
    for(const site of plan.sites) {
      const [sx,sz]=planToWorld(plan,site.position[0],site.position[2]);
      const ray=new THREE.Ray(new THREE.Vector3(sx,site.position[1]+1,sz),new THREE.Vector3(0,-1,0));
      const hit=bvh.raycastFirst(ray,THREE.DoubleSide);assert.ok(hit&&Math.abs(hit.point.y-site.position[1])<.6,`${site.name} has a real floor at its authored height`);
    }
    merged.dispose();geos.forEach(g=>g.dispose());
  });
  test(`${plan.id}: existing neighbour connects on foot and land continues beyond the landmark envelope`,async()=>{
    const connection=EXPANSION_CONNECTIONS.find(c=>c.to===plan.id)!,root=await load(plan.id),old=await load(connection.from);
    const geos=[...geometry(root),...geometry(old)],merged=mergeGeometries([boundaries,...geos]),bvh=new MeshBVH(merged);
    const layout=JSON.parse(readFileSync(new URL(`../public/assets/world_${plan.id}.layout.json`,import.meta.url),'utf8'));
    // The full, finely sampled deck is also used by the shipping generator.
    walk(bvh,layout.development.access.filter((_:unknown,i:number,a:unknown[])=>i%5===0||i===a.length-1),plan);
    const mesh=root.getObjectByName('Terrain') as THREE.Mesh;
    const grid=new WorldGrid([mesh],plan.offset[0]-400,plan.offset[1]-400,800,2);
    // every side shared with a neighbouring tile is broad land (world frame)
    const joins=TILE_JOINS[plan.id].map(side=>side==='N'?[0,-330]:side==='S'?[0,330]:side==='W'?[-330,0]:[330,0]);
    for(const [x,z] of joins)assert.ok(grid.sampleHeight(plan.offset[0]+x,plan.offset[1]+z)!>0,'broad land continues past the former island contour');
    merged.dispose();geos.forEach(g=>g.dispose());
  });
}
