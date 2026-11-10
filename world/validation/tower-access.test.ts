import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {snapshot} from './map-polish/snapshot.mjs';

// The optional wedge experiment obstructed a previously valid pre-RelayB ridge
// crossing. Keep its original geometry rather than relaxing physics or rewriting
// the route. Authorized chest, workshop and forest-log edits elsewhere in Alpha
// must not redefine this contract: compare the tower and approach against the
// unchanged historical node/accessor baseline instead of refreshing a file hash.
test('rejected tower ramp stays absent and the original tower approach remains byte-exact',async()=>{
 const baseline=JSON.parse(readFileSync(new URL('./map-polish/baseline.json',import.meta.url),'utf8'));
 assert.equal(baseline.baselineCommit,'a3096254ef0fff455a29932bc5fef2e57fa49f44');
 const before=baseline.regions.alpha;
 const now=await snapshot(fileURLToPath(new URL('../public/assets/',import.meta.url)),'alpha');
 for(const name of ['Tower_West_Access','COL_Tower_West_Access'])assert.equal(Object.hasOwn(now.nodes,name),false);
 // Includes the entire ordered static prop collider, not merely its tower slice.
 // Exact COLLISION children also reject a newly appended access obstruction.
 const unchanged=[
  'Tower','Tower_Halo','Valley_Tower_Calibration_Metal','Valley_Tower_Calibration_Glass',
  'Valley_Tower_Calibration_Ceramic','Valley_Tower_Calibration_Brass',
  'Glow_Props','Lamps','Rocks','Trees_Trunks','Trees_Leaves','Bushes',
  'COLLISION','COL_Props',
  'MK_interact_tower_console','MK_enemy_tower_enemy_0','MK_enemy_tower_enemy_1',
 ];
 for(const name of unchanged){
  assert.ok(Object.hasOwn(before.nodes,name),`${name}: explicit historical node exists`);
  assert.deepEqual(now.nodes[name],before.nodes[name],`${name}: exact accessor bytes, indices, transforms and metadata`);
 }
 const layout=JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json',import.meta.url),'utf8'));
 const marker=layout.markers.find((m:{id:string})=>m.id==='tower_console');
 assert.deepEqual(marker.requires,['relay_a','relay_b']);assert.deepEqual(marker.p,[0,30.5,-150.5]);
});
