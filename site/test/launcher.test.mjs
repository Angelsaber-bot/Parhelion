import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { launch, probe, portsFrom } from '../scripts/launch.mjs';

async function stop(child) { if (!child || child.exitCode !== null) return; const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
async function freePort() { const s=http.createServer(); await new Promise(r=>s.listen(0,'127.0.0.1',r)); const p=s.address().port; await new Promise(r=>s.close(r)); return p; }
async function fixture(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'Parhelion 中文 空格 '));
  await fs.cp(new URL('../dist/', import.meta.url), path.join(root,'dist'),{recursive:true});
  t.after(()=>fs.rm(root,{recursive:true,force:true})); return root;
}
test('port validation never falls through to port 0 or privileged ports',()=>{
  assert.deepEqual(portsFrom('65535'),[65535]); assert.equal(portsFrom('4173').length,20);
  for(const bad of ['0','80','-1','65536','x','4173x','1.5','']) assert.throws(()=>portsFrom(bad));
});
test('missing prebuilt files fail clearly without installing anything',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'parhelion-empty-')); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await assert.rejects(launch({root,ports:[await freePort()],browser:false}),/预构建网站文件缺失/);
});
test('real clean bundle launches from Unicode path, reuses, serves maps; occupied port untouched',async t=>{
  const root=await fixture(t);
  const unrelated=http.createServer((req,res)=>res.end('other application'));
  await new Promise(r=>unrelated.listen(0,'127.0.0.1',r)); const busy=unrelated.address().port;
  t.after(()=>new Promise(r=>unrelated.close(r)));
  const port=await freePort();
  const a=await launch({root,ports:[busy,port],browser:false}); t.after(()=>stop(a.child));
  assert.equal(a.reused,false); assert.equal(a.port,port); assert.equal(a.child.connected,true);
  const b=await launch({root,ports:[busy,port],browser:false}); assert.equal(b.reused,true); assert.equal(b.child,null); assert.equal(b.url,a.url);
  for(const route of ['', 'arena/', 'world/']) { const r=await fetch(a.url+route); assert.equal(r.status,200); const body=await r.text(); assert.match(body, /Parhelion/i); if(route) assert.match(body,/\/site\/nav.js/); }
  assert.equal(await (await fetch(`http://127.0.0.1:${busy}/`)).text(),'other application');
  assert.equal((await probe(port)).ready,true);
  await stop(a.child); assert.equal(await probe(port),null);
});
test('simultaneous double-click starts one server rather than a second instance',async t=>{
  const root=await fixture(t); const port=await freePort();
  const results=await Promise.all([launch({root,ports:[port],browser:false}),launch({root,ports:[port],browser:false})]);
  for(const result of results) if(result.child) t.after(()=>stop(result.child));
  assert.equal(results.filter(r=>r.child).length,1); assert.equal(results.filter(r=>r.reused).length,1);
});
