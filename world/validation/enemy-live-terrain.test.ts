import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { WorldGrid } from '../src/grid.ts';
import { makeCombatTerrain } from '../src/combatTerrain.ts';
import { COMBAT } from '../src/combat.ts';
import { REGIONS, regionAt } from '../src/regions.ts';
import { layout, grid, q, spawns, minis } from './enemy-live-terrain.fixture.ts';
import type { Layout } from '../src/types.ts';

function nearestToSegment(x:number,z:number,a:number[],b:number[]) {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}
function nearestPath(x:number,z:number) {
  return Math.min(...layout.paths.flatMap(path=>path.slice(1).map((b,i)=>nearestToSegment(x,z,path[i],b))));
}

test('terrain sampler is bilinear and rejects invalid/outside points without collision-roof ambiguity',()=>{
  const field=new WorldGrid([],0,0,2,1);field.h.set([0,1,2,1,2,3,2,3,4]);
  assert.equal(field.sampleHeight(.5,.5),1);assert.equal(field.sampleHeight(2,2),4);
  assert.equal(field.sampleHeight(-.01,0),null);assert.equal(field.sampleHeight(0,2.01),null);
  assert.equal(field.sampleHeight(NaN,0),null);assert.equal(field.sampleHeight(0,Infinity),null);
});

test('spawn-only roof filter rejects inaccessible roofs while retaining low raised paths and normal LOS',()=>{
  const lay={world:{waterLevel:-2},areas:[],markers:[]} as unknown as Layout;
  const roof=new THREE.BoxGeometry(20,1,20).translate(0,5,0);
  const colliders=[{name:'roof',enabled:true,bvh:new MeshBVH(roof)}];
  const legacy=makeCombatTerrain(colliders,lay),safe=makeCombatTerrain(colliders,lay,()=>0);
  assert.ok(legacy.safeSpawn(0,0),'top-down alone accepts an empty flat roof');
  assert.equal(safe.safeSpawn(0,0),null,'terrain baseline prevents that invisible encounter');
  assert.equal(safe.ground(0,0)?.point.y,legacy.ground(0,0)?.point.y,'collision ground queries themselves unchanged');
  const road=new THREE.BoxGeometry(20,.2,20).translate(0,1,0);
  assert.ok(makeCombatTerrain([{name:'raised-road',enabled:true,bvh:new MeshBVH(road)}],lay,()=>0).safeSpawn(0,0),'1.1m raised road permitted');
  assert.equal(makeCombatTerrain(colliders,lay,()=>null).safeSpawn(0,0),null,'unknown terrain cannot place an enemy on a roof');
});

test('actual runtime map with settlements has moderately denser grounded encounters and five reachable elites',()=>{
  assert.ok(spawns.length>=140 && spawns.length<=150,`ordinary count ${spawns.length}`);
  assert.ok(spawns.length+minis.length<=COMBAT.wildernessCap);
  assert.equal(minis.length,5);assert.equal(new Set(minis.map(e=>regionAt(e.p.x,e.p.z).id)).size,5);
  for(const def of REGIONS)assert.ok(spawns.filter(e=>regionAt(e.p.x,e.p.z).id===def.id).length>=27,def.id);
  for(const enemy of [...spawns,...minis]){
    assert.ok(q.safeSpawn(enemy.p.x,enemy.p.z),`${enemy.id} respects actual settlement and quest filters`);
    assert.ok(q.clear(enemy.p));
    const terrain=grid.sampleHeight(enemy.p.x,enemy.p.z);assert.notEqual(terrain,null);
    assert.ok(enemy.p.y-terrain!<=1.55,`${enemy.id} stranded above terrain (${enemy.p.y-terrain!}m)`);
  }
  for(const elite of minis)assert.ok(nearestPath(elite.p.x,elite.p.z)<=25,`${elite.id} too far from a visible route`);
});

test('authored route coverage is improved in every region without filling protected hubs',()=>{
  // Baseline sampled the same 20m path points: median distances were 86.6,99.1,74.5,65.8,80.3m.
  // Samples include safe hubs; requiring every point to have combat would violate town safety.
  const limits:Record<string,number>={alpha:65,britain:65,blacksail:60,winter:60,kyoto:60};
  for(const def of REGIONS){
    const samples:number[]=[];
    for(const path of layout.paths)for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let distance=0;distance<length;distance+=20){
        const x=a[0]+(b[0]-a[0])*distance/length,z=a[1]+(b[1]-a[1])*distance/length;
        if(regionAt(x,z).id!==def.id)continue;
        samples.push(Math.min(...spawns.map(e=>Math.hypot(x-e.p.x,z-e.p.z))));
      }
    }
    samples.sort((a,b)=>a-b);assert.ok(samples.length>20);
    assert.ok(samples[Math.floor(samples.length/2)]<limits[def.id],`${def.id} route median remains empty`);
    assert.ok(samples.filter(d=>d>COMBAT.activeRange).length/samples.length<.25,`${def.id} excessive off-range path samples`);
  }
});
