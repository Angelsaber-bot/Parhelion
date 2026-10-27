import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildValleyCraft,decorateValleyRuinDoor,decorateValleyWaterfall,decorateValleyFallsRock,VALLEY_CRAFT_MATERIALS} from '../tools/gen/valley/craft.ts';
import {Batch} from '../tools/gen/geo.ts';
import type {Piece} from '../tools/gen/structures.ts';

function fingerprint(p:Piece[]){const h=createHash('sha256');for(const q of p){h.update(q.name);h.update(q.material);for(const g of q.batch.vis)for(const key of ['position','normal','color']){const a=g.attributes[key];h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}}return h.digest('hex');}
/** Geometry-only landmark signature: no object/material name, color, normal,
 * absolute translation or uniform scale participates in this comparison. */
function normalizedShape(p:Piece[]){
  const points:number[][]=[],lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const q of p)for(const g of q.batch.vis){const a=g.attributes.position;for(let i=0;i<a.count;i++){const v=[a.getX(i),a.getY(i),a.getZ(i)];points.push(v);for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k]);}}}
  const center=lo.map((v,k)=>(v+hi[k])/2),scale=Math.max(...lo.map((v,k)=>hi[k]-v));assert.ok(scale>0);
  const rows=points.map(v=>v.map((n,k)=>Math.round((n-center[k])/scale*10000)).join(',')).sort();
  return createHash('sha256').update(rows.join(';')).digest('hex');
}
const pieces=buildValleyCraft(()=>10);
test('Valley independent instrument architecture is finite, deterministic, and ART only',()=>{
  assert.equal(fingerprint(pieces),fingerprint(buildValleyCraft(()=>10)));
  let vertices=0;
  for(const p of pieces){assert.equal(p.batch.col.length,0,'craft cannot add or reorder gameplay proxies');assert.ok(p.batch.vis.length>0);assert.ok(!p.dynamic&&!p.userData,'craft cannot change objective state');for(const g of p.batch.vis){const pos=g.attributes.position;vertices+=pos.count;for(const n of Object.values(g.attributes))for(const v of n.array)assert.ok(Number.isFinite(v));}}
  assert.ok(vertices>25000,'actual crafted geometry, not material labels only');
  assert.ok(vertices<400000,'bounded landmark-detail budget');
});
test('Valley uses all seven authored physical surfaces on nonempty geometry',()=>{
  const used=new Set(pieces.map(p=>p.material));assert.deepEqual([...used].sort(),VALLEY_CRAFT_MATERIALS.map(s=>'M_Valley'+s).sort());
});
test('Valley landmarks use separate functional silhouettes rather than cloned historic facades',()=>{
  const groups=['HQ_Optical','Armory_Fabrication','Summon_Interferometer','Tower_Calibration','Landing_Fieldkit','Station_Retrofit','Ruin_Resonator','Exploration_Detail','Ford_Hydrology'];
  const hashes=groups.map(name=>{const ps=pieces.filter(p=>p.name.startsWith('Valley_'+name+'_'));assert.ok(ps.length>=2,name);const signature=normalizedShape(ps);assert.equal(signature,normalizedShape(ps.map(p=>({...p,name:'same',material:'same'}))),'names and material labels cannot establish distinctness');return signature;});
  assert.equal(new Set(hashes).size,groups.length);
  assert.ok(pieces.every(p=>!/(Kyoto|Winter|BlackSail|Britain)/.test(p.name)));
});
test('Valley craft contains no exact duplicate coplanar geometry submissions',()=>{
  for(const p of pieces){const seen=new Set<string>();for(const g of p.batch.vis){const a=g.attributes.position.array;const h=createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');assert.ok(!seen.has(h),p.name+' repeats geometry at the same coordinates');seen.add(h);}}
});
test('Valley carved shrine door relief stays ART-only in the existing dynamic door batch',()=>{
  const b=new Batch('Ruin_Door');decorateValleyRuinDoor(b,0,0,0);assert.equal(b.col.length,0);assert.ok(b.vis.length>=12);for(const g of b.vis)for(const v of g.attributes.position.array)assert.ok(Number.isFinite(v));
});
test('Valley waterfall has a connected broad curtain, depth ripple and west-facing normals',()=>{
 const b=new Batch('Waterfall','M_Waterfall');decorateValleyWaterfall(b);assert.equal(b.col.length,0);assert.equal(b.vis.length,9);
 const g=b.vis[0];g.computeBoundingBox();assert.ok(g.boundingBox!.max.z-g.boundingBox!.min.z>14);assert.ok(g.boundingBox!.max.x-g.boundingBox!.min.x>1.8);assert.ok(g.boundingBox!.max.y>39);assert.ok(g.attributes.normal.getX(0)<-.8);
});
test('Valley waterfall rock shell is finite and ART-only',()=>{const b=new Batch('FallsRock');decorateValleyFallsRock(b);assert.equal(b.col.length,0);assert.ok(b.vis.length>100);for(const g of b.vis)for(const v of g.attributes.position.array)assert.ok(Number.isFinite(v));});
test('Valley waterfall shell leaves the original western cave entry visually open',()=>{
 const b=new Batch('FallsRock');decorateValleyFallsRock(b);
 for(const g of b.vis){const p=g.attributes.position;for(let i=0;i<p.count;i+=3){const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;assert.ok(!(x<166&&y<8.3&&z>-64&&z<-56),'rock face must not visually plug cave route');}}
});
