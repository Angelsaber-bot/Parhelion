import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// The optional wedge experiment obstructed a previously valid pre-RelayB ridge
// crossing. Keep its original geometry rather than relaxing physics or rewriting
// the route. The current request replaces only the two legacy chest visuals;
// map-polish and kingdom-valley-export independently freeze every unrelated
// node and every original ordered collision triangle against the old baseline.
test('rejected tower ramp stays absent after the bounded legacy chest visual replacement',()=>{
 const bytes=readFileSync(new URL('../public/assets/world_alpha.glb',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),
  'b6c073d33a0da9d7acbd403ba76574d14ab437054f4869606172b1e1344f254a');
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 assert(!gltf.nodes.some((n:{name?:string})=>n.name==='Tower_West_Access'||n.name==='COL_Tower_West_Access'));
 const layout=JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json',import.meta.url),'utf8'));
 const marker=layout.markers.find((m:{id:string})=>m.id==='tower_console');
 assert.deepEqual(marker.requires,['relay_a','relay_b']);assert.deepEqual(marker.p,[0,30.5,-150.5]);
});
