import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sourceFingerprint,localInstallCurrent} from '../../arena-game/scripts/local-install.mjs';
import {createStaticHandler} from '../scripts/http.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'arena-install-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const arena=path.join(root,'arena-game'),site=path.join(root,'site'),dist=path.join(site,'dist');
 await fs.mkdir(path.join(arena,'src'),{recursive:true});await fs.writeFile(path.join(arena,'src/main.ts'),'new rules');
 await fs.mkdir(path.join(dist,'public/arena'),{recursive:true});
 const version={sourceFingerprint:await sourceFingerprint(arena),rulesVersion:32},data={'public/arena/index.html':'new Arena','public/arena/model.bin':'model','server.cjs':'new server','public/arena/arena-version.json':JSON.stringify(version)};
 for(const [name,body] of Object.entries(data))await fs.writeFile(path.join(dist,name),body);
 await fs.writeFile(path.join(dist,'build.json'),JSON.stringify({arenaLocal:version,files:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,hash(v)]))}));
 return {arena,site,dist};
}
test('intact Arena install is current; changed source invalidates it',async t=>{const f=await fixture(t);assert.equal(await localInstallCurrent(f.arena,f.site),true);await fs.writeFile(path.join(f.arena,'src/main.ts'),'changed');assert.equal(await localInstallCurrent(f.arena,f.site),false);});
test('overwritten client or missing version cannot silently launch',async t=>{const f=await fixture(t);await fs.writeFile(path.join(f.dist,'public/arena/index.html'),'old Aster/Vega');assert.equal(await localInstallCurrent(f.arena,f.site),false);await fs.rm(path.join(f.dist,'public/arena/arena-version.json'));assert.equal(await localInstallCurrent(f.arena,f.site),false);});
test('missing model and changed server invalidate installation',async t=>{const f=await fixture(t);await fs.writeFile(path.join(f.dist,'server.cjs'),'old rules');assert.equal(await localInstallCurrent(f.arena,f.site),false);await fs.writeFile(path.join(f.dist,'server.cjs'),'new server');await fs.rm(path.join(f.dist,'public/arena/model.bin'));assert.equal(await localInstallCurrent(f.arena,f.site),false);});
test('local handler serves binary models without caching or directory access',async t=>{const f=await fixture(t),handler=await createStaticHandler(f.site);const headers={};let status,body;const res={setHeader(k,v){headers[k]=v;},writeHead(s,h){status=s;Object.assign(headers,h);},end(b){body=b;}};await handler({headers:{host:'127.0.0.1:4173'},method:'GET',url:'/arena/model.bin'},res);assert.equal(status,200);assert.equal(headers['Content-Type'],'application/octet-stream');assert.equal(headers['Cache-Control'],'no-store');assert.equal(body.toString(),'model');await handler({headers:{host:'127.0.0.1:4173'},method:'GET',url:'/arena/../server.cjs'},res);assert.equal(status,400);});
test('chapter collision and GLB changes invalidate local install, including ASTER base and overlay',async t=>{
 for(const file of ['../arena/runtime/map.json','../arena/assets/station_visual.glb','../arena-maps/aster/assets/aster_overlay.glb','../arena-maps/sakura/runtime/map.json','../arena-maps/orleans/assets/orleans_visual.glb']){
  const f=await fixture(t),asset=path.resolve(f.arena,file);await fs.mkdir(path.dirname(asset),{recursive:true});await fs.writeFile(asset,'new authored map');assert.equal(await localInstallCurrent(f.arena,f.site),false,file);
 }
});
