import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p:string)=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const baseline=read('./blacksail/baseline-contract.json');
const layout=read('../public/assets/world_blacksail.layout.json');
test('Black Sail preserves exact complete world, markers, objective, routes, areas and updraft gameplay contract',()=>{
 for(const key of ['world','markers','objective','paths','areas','updrafts']) assert.deepEqual(layout[key],baseline[key],key);
});
