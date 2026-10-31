/** Isolated source-generator parity; never writes regenerated public assets. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile,unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildBlacksailTerrain } from '../../tools/gen/blacksail/terrain';
import { buildBlacksail } from '../../tools/gen/blacksail/build';
const temp=new URL('../../tools/gen/blacksail/.tavern-roof-baseline-build.ts',import.meta.url);
const source=execFileSync('git',['show','fd4a4b3:world/tools/gen/blacksail/build.ts'],{encoding:'utf8'});
function digest(piece:any){
 const h=createHash('sha256');h.update(JSON.stringify({name:piece.name,material:piece.material,outline:piece.outline,dynamic:piece.dynamic,userData:piece.userData}));
 for(const kind of['vis','col'])for(const g of piece.batch[kind]){
  h.update(kind);for(const key of Object.keys(g.attributes).sort()){const a=g.attributes[key];h.update(key+':'+a.itemSize+':'+a.normalized);h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
  if(g.index)h.update(Buffer.from(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength));
 }
 return h.digest('hex');
}
try{
 await writeFile(temp,source);const baseline=await import(temp.href),terrain=buildBlacksailTerrain();
 const old=baseline.buildBlacksail(terrain.heightAt),candidate=buildBlacksail(terrain.heightAt);
 assert.deepEqual(candidate.markers,old.markers,'Every original marker exact');
 const added=candidate.pieces.filter((p:any)=>p.name==='Nassau_Tavern_Timber_Underside');assert.equal(added.length,1);assert.equal(added[0].batch.col.length,0);
 const unchanged=candidate.pieces.filter((p:any)=>p.name!=='Nassau_Tavern_Timber_Underside');
 assert.equal(unchanged.length,old.pieces.length);
 for(let i=0;i<old.pieces.length;i++)assert.equal(digest(unchanged[i]),digest(old.pieces[i]),`Original piece ${old.pieces[i].name} exact geometry/material/collision/order`);
 const result={baseline:'fd4a4b3',originalPiecesExact:old.pieces.length,originalMarkersExact:old.markers.length,addedPieces:1,addedTriangles:added[0].batch.vis[0].attributes.position.count/3,addedColliders:0};
 if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{await unlink(temp).catch(()=>{});}
