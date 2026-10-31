import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// The optional wedge experiment obstructed a previously valid pre-RelayB ridge
// crossing. Keep original geometry rather than relaxing physics or rewriting the
// route. Actual fresh input and staged-glide evidence live in the QA reports.
test('rejected tower ramp leaves original Alpha geometry and all old corridors byte-identical',()=>{
 const bytes=readFileSync(new URL('../public/assets/world_alpha.glb',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),
  '1fb8d6823f2afcbdd11586d92013df4250243505a956c49db98fb14624f2e850');
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 assert(!gltf.nodes.some((n:{name?:string})=>n.name==='Tower_West_Access'||n.name==='COL_Tower_West_Access'));
 const layout=JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json',import.meta.url),'utf8'));
 const marker=layout.markers.find((m:{id:string})=>m.id==='tower_console');
 assert.deepEqual(marker.requires,['relay_a','relay_b']);assert.deepEqual(marker.p,[0,30.5,-150.5]);
});
