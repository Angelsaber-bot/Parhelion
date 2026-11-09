import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { EXPANSION_PLANS, EXPANSION_CONNECTIONS, WORLD_PLAN, polygonDistance, distanceToLine, type RoutePoint } from '../src/map/worldPlan';
import { REGIONS, regionAt, regionContains, boundaryWalls } from '../src/map/regions';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import { Player } from '../src/player/player';
import { WorldGrid } from '../src/map/grid';
import type { Layout } from '../src/core/types';

const boundaries=boundaryWalls();
async function load(id:string) {
  const def=REGIONS.find(r=>r.id===id)!;
  const bytes=readFileSync(new URL(`../public/assets/${def.file}.core.glb`,import.meta.url));
  const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  bakeQuantized(scene);scene.position.set(def.offset[0],0,def.offset[1]);scene.updateMatrixWorld(true);
  return scene;
}
function geometry(root:THREE.Object3D) {
  const geos:THREE.BufferGeometry[]=[];
  root.getObjectByName('COLLISION')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||m.userData.dynamic)return;
    let g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());if(m.geometry.index)g.setIndex(m.geometry.index.clone());g.applyMatrix4(m.matrixWorld);if(g.index)g=g.toNonIndexed();geos.push(g);
  });return geos;
}
function walk(bvh:MeshBVH,route:readonly RoutePoint[],offset:[number,number]) {
  const p=new Player([{name:'static',enabled:true,bvh}],0),a=route[0];
  p.teleport(a[0]+offset[0],a[1]+.6,a[2]+offset[1]);
  for(let i=0;i<90;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});
  for(let k=1;k<route.length;k++) {
    const goal=route[k],x=goal[0]+offset[0],z=goal[2]+offset[1];
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
  assert.equal(REGIONS.length,8);assert.equal(WORLD_PLAN.finale.requiredRegions.length,7);assert.equal(WORLD_PLAN.finale.separateMap,true);
  assert.ok(!REGIONS.some(r=>String(r.id)==='convergence'));
  for(const plan of EXPANSION_PLANS) {
    assert.ok(plan.outline.length>8);
    assert.equal(regionAt(...plan.offset).id,plan.id);
    for(const [x,z] of plan.outline)assert.ok(x+plan.offset[0]>=-1080&&x+plan.offset[0]<=1080&&z+plan.offset[1]>=-1080&&z+plan.offset[1]<=1080);
    const def=REGIONS.find(r=>r.id===plan.id)!;
    assert.ok(!regionContains(def,plan.offset[0]+def.play[0],plan.offset[1]+def.play[2]),'rectangle corners are not playable by implication');
    const layout:Layout=JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`,import.meta.url),'utf8'));
    assert.equal(layout.objective.steps.length,0,'walking through a blockout cannot finish a chapter');
    assert.ok(layout.markers.every(m=>m.type==='spawn'||m.type==='poi'),'no pretend story or boss completion markers');
  }
  for(const id of ['alpha','britain','blacksail','winter','kyoto']) {
    const def=REGIONS.find(r=>r.id===id)!;assert.equal(regionAt(...def.offset).id,id);
  }
});

for(const plan of EXPANSION_PLANS) {
  test(`${plan.id}: shipped collision supports all main, side and vertical routes without jumping`,async()=>{
    const root=await load(plan.id),geos=geometry(root);const merged=mergeGeometries([boundaries,...geos]);const bvh=new MeshBVH(merged);
    for(const route of plan.routes) {
      try{walk(bvh,route.points,plan.offset);walk(bvh,[...route.points].reverse(),plan.offset);}catch(error){throw new Error(`${plan.id}/${route.id}: ${error instanceof Error?error.message:error}`);}
    }
    for(const site of plan.sites) {
      const ray=new THREE.Ray(new THREE.Vector3(site.position[0]+plan.offset[0],site.position[1]+1,site.position[2]+plan.offset[1]),new THREE.Vector3(0,-1,0));
      const hit=bvh.raycastFirst(ray,THREE.DoubleSide);assert.ok(hit&&Math.abs(hit.point.y-site.position[1])<.6,`${site.name} has a real floor at its authored height`);
    }
    merged.dispose();geos.forEach(g=>g.dispose());
  });
  test(`${plan.id}: existing neighbour connects on foot; irregular terrain leaves unused corners empty`,async()=>{
    const connection=EXPANSION_CONNECTIONS.find(c=>c.to===plan.id)!,root=await load(plan.id),old=await load(connection.from);
    const geos=[...geometry(root),...geometry(old)],merged=mergeGeometries([boundaries,...geos]),bvh=new MeshBVH(merged);
    const layout=JSON.parse(readFileSync(new URL(`../public/assets/world_${plan.id}.layout.json`,import.meta.url),'utf8'));
    // The full, finely sampled deck is also used by the shipping generator.
    walk(bvh,layout.development.access.filter((_:unknown,i:number,a:unknown[])=>i%5===0||i===a.length-1),plan.offset);
    const mesh=root.getObjectByName('Terrain') as THREE.Mesh;
    const grid=new WorldGrid([mesh],plan.offset[0]-400,plan.offset[1]-400,800,2);
    assert.equal(grid.sampleHeight(plan.offset[0]-330,plan.offset[1]-330),-12,'map baking does not paint square terrain outside the contour');
    if(plan.id==='qin')assert.ok(Math.abs(grid.sampleHeight(plan.offset[0],plan.offset[1])!-10)<.05,'the shaft shows its dry underground floor, rather than sea');
    const p=mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i+=137) {
      const x=p.getX(i),z=p.getZ(i);
      const onAccess=distanceToLine(x+plan.offset[0],z+plan.offset[1],connection.points)<connection.width/2+.04;
      assert.ok(polygonDistance(x,z,plan.outline)<.04||onAccess,'terrain vertices belong to the footprint or the physical road (within GLB quantization)');
    }
    merged.dispose();geos.forEach(g=>g.dispose());
  });
}
