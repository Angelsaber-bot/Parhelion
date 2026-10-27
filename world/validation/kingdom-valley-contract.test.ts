import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const before=JSON.parse(readFileSync(new URL('./kingdom-valley/five-world-baseline.json',import.meta.url),'utf8'));
for(const region of ['alpha','britain','blacksail','winter','kyoto']) {
 test(`${region}: full world layout, every marker, objective and route remain identical after final two-region art pass`,()=>{
  const current=JSON.parse(readFileSync(new URL(`../public/assets/world_${region}.layout.json`,import.meta.url),'utf8'));
  assert.deepEqual(current,before[region].layout);
 });
 if(!['alpha','britain'].includes(region))test(`${region}: already reviewed chapter GLB remains byte-identical`,()=>{
  const bytes=readFileSync(new URL(`../public/assets/world_${region}.glb`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),before[region].glb_sha256);
 });
}
