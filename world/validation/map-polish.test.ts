import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {snapshot} from './map-polish/snapshot.mjs';
import {countPreparedArt} from './map-polish/chunk-budget.ts';

const before=JSON.parse(readFileSync(new URL('./map-polish/baseline.json',import.meta.url),'utf8'));
const assets=fileURLToPath(new URL('../public/assets/',import.meta.url));
const chunkBaseline=JSON.parse(readFileSync(new URL('./map-polish/chunk-baseline.json',import.meta.url),'utf8'));
// Explicitly bounded authoring permission, NOT an updated expected-output hash.
// Every other exported node/accessor/transform must equal the untouched a309625
// baseline. A later explicit user request aligns four Alpha seam blockers; only
// their named COLLISION nodes plus four matching visible dynamic fields are exempt.
const seamNames = ['west','north','east','south'].map(id => `Seam_${id}_Gate`);
const edits:Record<string,{nodes:string[];triangles:number;bytes:number}>={
  alpha:{nodes:['Valley_Landing_Fieldkit_Ceramic','Valley_Landing_Fieldkit_Metal'],triangles:700,bytes:23000},
  britain:{nodes:['Britain_Physical_Wool','Britain_Physical_Bronze','Britain_Physical_Iron'],triangles:500,bytes:5000},
  blacksail:{nodes:['Nassau_Craft_Iron','Nassau_Craft_Rope'],triangles:1100,bytes:8000},
  winter:{nodes:['Bivouac_WinterCanvas'],triangles:500,bytes:6000},
  kyoto:{nodes:['Inari','Higashiyama'],triangles:1600,bytes:14000},
};
for(const [region,allowed] of Object.entries(edits))test(`${region}: bounded detail whitelist preserves exact gameplay and all unrelated GLB content`,async()=>{
  const old=before.regions[region],now=await snapshot(assets,region);
  assert.equal(before.baselineCommit,'a3096254ef0fff455a29932bc5fef2e57fa49f44');
  assert.equal(now.layoutSha256,old.layoutSha256,'complete layout bytes: quests, gates, navigation, spawns and lighting');
  assert.deepEqual(now.materials,old.materials,'existing surface/alpha/material identities');
  const added = region === 'alpha' ? seamNames : [];
  assert.deepEqual(Object.keys(now.nodes).filter(n=>!added.includes(n)),Object.keys(old.nodes),'only four named visible seam fields may be added; no removal/reorder');
  for(const [name,node] of Object.entries(now.nodes)){
    if(added.includes(name)) {
      assert.deepEqual(node.extras,{opensWhen:['summon_circle'],outline:false,dynamic:true});
      assert.equal(node.primitives.length,1); assert.equal(node.primitives[0].material,'M_Beam');
      assert.equal(node.primitives[0].triangles,60,'three complete visible/physical panels');
    } else if(added.some(n=>name===`COL_${n}`)) {
      assert.deepEqual(node.extras,old.nodes[name].extras,'original unlock contract');
      assert.deepEqual(node.children,old.nodes[name].children);
      assert.equal(node.primitives.length,1); assert.equal(node.primitives[0].material,'M_Collision');
      assert.equal(node.primitives[0].triangles,60);
      // Exact exported pylon alignment and all triangle positions vs ART are
      // checked independently in seam-barrier.test.ts, not accepted by a hash refresh.
    } else if(name==='ART' && added.length) {
      assert.deepEqual({...node,children:node.children.filter(n=>!added.includes(n))},old.nodes[name]);
    } else if(!allowed.nodes.includes(name))assert.deepEqual(node,old.nodes[name],`${name}: exact decoded accessor hashes and scene metadata`);
    else {
      assert.notDeepEqual(node.primitives,old.nodes[name].primitives,`${name}: intended visual detail actually exported`);
      assert.deepEqual(node.extras,old.nodes[name].extras,`${name}: no new dynamic/quest behavior`);
      for(const key of ['translation','rotation','scale'])assert.deepEqual(node[key],old.nodes[name][key],`${name}: unchanged quantized transform/bounds`);
      assert.deepEqual(node.children,old.nodes[name].children,`${name}: hierarchy`);
      assert.deepEqual(node.primitives.map(p=>p.material),old.nodes[name].primitives.map(p=>p.material),`${name}: material batches`);
    }
  }
  assert.equal(now.artPrimitives,old.artPrimitives+added.length,'only matching dynamic seam-field ART primitives added');
  assert.ok(now.artTriangles>old.artTriangles&&now.artTriangles-old.artTriangles<=allowed.triangles,'small declared triangle budget');
  assert.ok(now.bytes-old.bytes<=allowed.bytes,'small compressed asset delta budget');
  assert.ok(now.bytes<25*1024*1024,'existing individual-file delivery ceiling');
  const prepared=await countPreparedArt(assets,region),original=chunkBaseline[region];
  assert.equal(prepared.chunks,original.chunks+added.length,'only four matching dynamic seam meshes added');
  assert.equal(prepared.outlineChunks,original.outlineChunks,'no additional outline meshes');
  assert.deepEqual(Object.fromEntries(Object.entries(prepared.byMesh).filter(([name])=>!added.includes(name))),original.byMesh,'exact unrelated per-source chunk distribution, including 4k threshold');
  for(const name of added)assert.equal(prepared.byMesh[name],1);
});
