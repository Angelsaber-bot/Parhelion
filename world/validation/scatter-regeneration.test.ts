import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import { components } from '../tools/reground-scatter-parts';
import { invalidateScatterSeating } from '../tools/scatter-seating-record';

test('regenerating one tile invalidates its old vertex ledger without discarding neighbouring tiles',()=>{
  const dir=mkdtempSync(`${tmpdir()}/parhelion-seating-`),path=pathToFileURL(`${dir}/record.json`);
  try {
    const winter={Rocks:[[200,[[0,4]]]]};
    writeFileSync(path,JSON.stringify({regions:{kyoto:{Rocks:[[1200,[[0,59]]]]},winter},appliedHashes:{kyoto:'old-topology',winter:'retained'}}));
    invalidateScatterSeating('kyoto',path);
    const result=JSON.parse(readFileSync(path,'utf8'));
    assert.deepEqual(result.regions.kyoto,{});
    assert.deepEqual(result.regions.winter,winter);
    assert.deepEqual(result.appliedHashes,{winter:'retained'});
  } finally { rmSync(dir,{recursive:true}); }
});

// The previous seating test only proved that the newest shifts were rigid. It
// missed meshes already torn by reversing another export's vertex ranges.
for(const region of ['alpha','britain','blacksail','winter','kyoto'])test(`${region}: shipped foliage and rocks contain no torn vertical spikes`,async()=>{
  const bytes=readFileSync(new URL(`../public/assets/world_${region}.glb`,import.meta.url));
  const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  bakeQuantized(scene);
  scene.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||!/^(Trees_Trunks|Trees_Leaves|Rocks|Bushes)/.test(o.name))return;
    const p=o.geometry.attributes.position,point=new THREE.Vector3();
    for(const vertices of components(o.geometry)){
      const box=new THREE.Box3();for(const i of vertices)box.expandByPoint(point.fromBufferAttribute(p,i));
      const size=box.getSize(new THREE.Vector3());
      assert.ok(size.y<=Math.max(25,size.x*5,size.z*5),`${o.name}: torn component at ${box.getCenter(new THREE.Vector3()).toArray()}, size ${size.toArray()}`);
    }
  });
});
