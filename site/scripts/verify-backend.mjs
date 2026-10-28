import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Client } from '../../arena-game/node_modules/@colyseus/sdk/build/index.mjs';
import WebSocket from '../../arena-game/node_modules/ws/wrapper.mjs';
// Matches arena-game/shared/protocol.ts RULES_VERSION.
const RULES_VERSION = 3;
const source = fileURLToPath(new URL('../dist/', import.meta.url));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'Parhelion 中文 smoke '));
await fs.cp(source, path.join(root, 'dist'), { recursive: true });
const reserve = http.createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
let logs = '';
const child = fork(path.join(root, 'dist/server.cjs'), [root, String(port)], { cwd: root, env: { ...process.env, NODE_PATH: '' }, silent: true });
child.stdout.on('data', b => logs += b); child.stderr.on('data', b => logs += b);
const rooms = [];
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('startup timeout: '+logs)), 5000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error('early exit '+code+': '+logs)); });
    child.on('message', message => { if (message.event === 'ready') { clearTimeout(timer); resolve(); } else if (message.event === 'error') { clearTimeout(timer); reject(new Error(JSON.stringify(message))); } });
  });
  const url = `http://127.0.0.1:${port}`;
  for (const route of ['/', '/arena/', '/world/']) {
    const response = await fetch(url+route); assert.equal(response.status, 200); const html=await response.text();
    if (route !== '/') assert.match(html, /\/site\/nav\.js/);
    console.log('PASS route', route, response.status);
  }
  const health = await (await fetch(url+'/__parhelion/health')).json();
  assert.equal(health.ready, true); console.log('PASS health', health.buildId.slice(0,12));
  const assets = [
    '/arena/assets/' + (await fs.readdir(path.join(source, 'public/arena/assets'))).find(name => name.startsWith('station_visual-') && name.endsWith('.glb')),
    '/world/assets/world_alpha.glb', '/world/assets/world_alpha.layout.json', '/site/nav.js', '/site/nav.css'
  ];
  for (const route of assets) {const r=await fetch(url+route);assert.equal(r.status,200,route); await r.arrayBuffer();console.log('PASS asset',route);}
  for (const route of ['/', '/matchmake/joinOrCreate/arena']) {
    for (const headers of [{host:'evil.example'}, {origin:'https://evil.example'}]) {
      const status=await new Promise((resolve,reject)=>{const req=http.request(url+route,{method:route==='/'?'GET':'POST',headers},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject);req.end();});assert.equal(status,403);console.log('PASS hostile HTTP',route,JSON.stringify(headers));
    }
  }
  for (const headers of [{Host:'evil.example'}, {Origin:'https://evil.example'}]) {
    await new Promise((resolve,reject)=>{const ws=new WebSocket(url.replace('http','ws')+'/bad/room',{headers}); const timer=setTimeout(()=>{ws.terminate();reject(new Error('upgrade timeout'))},3000);ws.on('unexpected-response',(_,r)=>{clearTimeout(timer);r.resume();assert.equal(r.statusCode,403);ws.terminate();resolve();});ws.on('error',()=>{});ws.on('open',()=>{clearTimeout(timer);ws.terminate();reject(new Error('hostile socket accepted'))});});
    console.log('PASS hostile WebSocket',JSON.stringify(headers));
  }
  const a=await new Client(url).joinOrCreate('arena',{rulesVersion:RULES_VERSION,layout:'1v1',team:'A',name:'Smoke A'}); rooms.push(a);a.onMessage('welcome',()=>{});
  const b=await new Client(url).joinOrCreate('arena',{rulesVersion:RULES_VERSION,layout:'1v1',team:'B',name:'Smoke B'}); rooms.push(b);b.onMessage('welcome',()=>{});b.onMessage('snap',()=>{});
  assert.equal(a.roomId,b.roomId);
  const snap=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('snapshot timeout')),3000);a.onMessage('snap',s=>{clearTimeout(timer);resolve(s)});});
  assert.equal(snap.players.length,2);assert.equal(snap.players.filter(p=>p.bot).length,0);console.log('PASS same-origin live 1v1 two-client match',a.roomId);
  const botRoom=await new Client(url).joinOrCreate('arena',{rulesVersion:RULES_VERSION,layout:'2v2',team:'A',bots:true,name:'Smoke Bot'}); rooms.push(botRoom); botRoom.onMessage('welcome',()=>{}); const botSnap=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('bot snapshot timeout')),3000);botRoom.onMessage('snap',s=>{clearTimeout(timer);resolve(s)});}); assert.equal(botSnap.players.length,4);assert.equal(botSnap.players.filter(p=>p.bot).length,3);console.log('PASS same-origin 2v2 one human + three bots');
  const occupied=fork(path.join(root,'dist/server.cjs'),[root,String(port)],{cwd:root,env:{...process.env,NODE_PATH:''},silent:true});
  const occupiedResult=await new Promise((resolve,reject)=>{let diagnostic;const timer=setTimeout(()=>{occupied.kill();reject(new Error('occupied timeout'))},4000);occupied.on('message',m=>diagnostic=m);occupied.once('exit',code=>{clearTimeout(timer);resolve({code,diagnostic})});});
  assert.equal(occupiedResult.code,20);assert.equal(occupiedResult.diagnostic.code,'EADDRINUSE');console.log('PASS occupied port',JSON.stringify(occupiedResult));
  assert.equal((await fetch(url+'/')).status,200);console.log('PASS original server survives occupied-port attempt');
  console.log('ALL BACKEND SMOKE CHECKS PASSED; no node_modules in runtime root');
} finally {
  await Promise.all(rooms.map(room=>room.leave().catch(()=>{})));
  if (child.exitCode === null) { const exit=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exit; }
  await fs.rm(root,{recursive:true,force:true});
  console.log(logs.trim());
}
