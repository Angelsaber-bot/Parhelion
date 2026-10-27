import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p:string)=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const baseline=read('./winter/baseline-contract.json');
const layout=read('../public/assets/world_winter.layout.json');
test('Everwinter refinement preserves world identity, quest IDs and objective unlock contracts',()=>{
 for(const k of ['id','seed','half','playHalf','cell','waterLevel']) assert.deepEqual(layout.world[k],baseline.world[k],`world.${k}`);
 assert.deepEqual(layout.objective,baseline.objective);
 assert.deepEqual(layout.markers,baseline.markers,'no added, removed, reordered or changed gameplay markers');
 for(const marker of baseline.markers){
  const current=layout.markers.find((m:any)=>m.id===marker.id);
  assert.ok(current,`preserved marker ${marker.id}`);
  assert.deepEqual(current,marker,`marker ${marker.id}: coordinates, type, gates and radius remain stable`);
 }
});
test('Everwinter refinement preserves established area teleports and all six quest routes',()=>{
 for(const area of baseline.areas){
  const current=layout.areas.find((a:any)=>a.id===area.id);assert.ok(current,area.id);
  assert.deepEqual(current.tp,area.tp,`teleport ${area.id}`);
 }
 assert.deepEqual(layout.paths,baseline.paths,'the complete ordered six-route array remains identical');
 baseline.paths.forEach((p:any,i:number)=>assert.deepEqual(layout.paths[i],p,`existing quest route ${i}`));
});
