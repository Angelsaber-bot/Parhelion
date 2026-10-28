import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const before=JSON.parse(readFileSync(new URL('./kingdom-valley/five-world-baseline.json',import.meta.url),'utf8'));
for(const region of ['alpha','britain','blacksail','winter','kyoto']) {
 test(`${region}: full world layout, every marker, objective and route remain identical after final two-region art pass`,()=>{
  const current=JSON.parse(readFileSync(new URL(`../public/assets/world_${region}.layout.json`,import.meta.url),'utf8'));
  assert.deepEqual(current,before[region].layout);
 });
 // The subsequent authorized five-region micro-detail pass intentionally changes
 // ten named ART batches. Its stricter per-node whitelist lives in
 // map-polish.test.ts; the historic five-world-baseline.json stays untouched.
}
