import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const before=JSON.parse(readFileSync(new URL('./kingdom-valley/five-world-baseline.json',import.meta.url),'utf8'));
for(const region of ['alpha','britain','blacksail','winter','kyoto']) {
 test(`${region}: full world layout, every marker, objective and route preserve baseline except three approved Alpha copy strings`,()=>{
  const current=JSON.parse(readFileSync(new URL(`../public/assets/world_${region}.layout.json`,import.meta.url),'utf8'));
  if (region === 'alpha') {
   // No baseline refresh: verify exact approved replacements at exact fields,
   // reverse only those fields, then compare the entire historical contract.
   const relay=current.objective.steps.find((step:any)=>step.id==='relay_b');
   const tower=current.objective.steps.find((step:any)=>step.id==='tower');
   const marker=current.markers.find((entry:any)=>entry.id==='relay_b');
   assert.equal(relay.text,'进入废弃前哨站并启动中继器 B');
   assert.equal(marker.note,'进入据点后启动');
   assert.equal(tower.text,'从西侧跑跳，空中再按跳跃展翼；外缘落稳后跳上平台，绕柱启动控制台。');
   relay.text='清除废弃前哨站并启动中继器 B';
   marker.note='清除据点后启动';
   tower.text='前往幻日塔，启动控制台';
  }
  assert.deepEqual(current,before[region].layout);
 });
 // The subsequent authorized five-region micro-detail pass intentionally changes
 // ten named ART batches. Its stricter per-node whitelist lives in
 // map-polish.test.ts; the historic five-world-baseline.json stays untouched.
}
