// Actual local Colyseus sockets for every active chapter. Not a deployed Worker test.
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client, type Room } from '@colyseus/sdk';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ArenaRoom } from '../server/ArenaRoom.ts';
import { CHAPTER_MAPS } from '../shared/arenaMap.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { BTN } from '../shared/sim.ts';
import { joinOnline, type Session } from '../src/session.ts';
import type { Snapshot } from '../shared/match.ts';
const port=31000+Math.floor(Math.random()*500);
let server:Server;
beforeAll(async()=>{server=new Server({transport:new WebSocketTransport()});server.define('arena',ArenaRoom).filterBy(['layout','map','bots']);await server.listen(port);});
afterAll(async()=>{await server.gracefullyShutdown(false);});
function next<T>(room:Room,type:string,predicate:(value:T)=>boolean=()=>true):Promise<T>{
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error(`Timed out waiting for ${type}`)),4000);
    const off=room.onMessage(type,(value:T)=>{if(predicate(value)){clearTimeout(timeout);off();resolve(value);}});
  });
}
it('all five chapters pair only with their own map and acknowledge authoritative input over real sockets',async()=>{
  const rooms:Room[]=[],ids=new Set<string>(),client=new Client(`ws://127.0.0.1:${port}`);
  try{
    for(const info of CHAPTER_MAPS){
      const options={rulesVersion:RULES_VERSION,map:info.id,layout:'1v1',char:0,skins:[],bots:false};
      const a=await client.joinOrCreate('arena',{...options,team:'A',name:'QA A'});rooms.push(a);
      const welcomeA=await next<{map:string;rulesVersion:number}>(a,'welcome');
      expect(welcomeA.map).toBe(info.id);expect(welcomeA.rulesVersion).toBe(RULES_VERSION);
      expect(ids.has(a.roomId)).toBe(false);ids.add(a.roomId);
      const b=await client.joinOrCreate('arena',{...options,team:'B',name:'QA B'});rooms.push(b);
      const welcomeB=await next<{map:string}>(b,'welcome');expect(welcomeB.map).toBe(info.id);expect(b.roomId).toBe(a.roomId);
      b.onMessage('snap',()=>{});
      const acknowledged=next<Snapshot>(a,'snap',s=>s.players.some(p=>p.id===a.sessionId&&p.lastSeq===1));
      a.send('input',[{seq:1,mx:0,mz:0,yaw:0,pitch:0,buttons:BTN.CROUCH,weapon:0,view:0}]);
      const snap=await acknowledged;expect(snap.players).toHaveLength(2);expect(snap.players.find(p=>p.id===a.sessionId)!.crouched).toBe(true);
      a.onMessage('snap',()=>{});
    }
    expect(ids.size).toBe(5);
  }finally{await Promise.all(rooms.map(room=>room.leave()));}
},15000);

import { WebSocket, WebSocketServer } from 'ws';
import { RoomCore } from '../shared/room.ts';
let jsonServer:WebSocketServer;
beforeAll(async()=>{
  const cores=new Map<string,RoomCore>();let sequence=0;
  jsonServer=new WebSocketServer({port:port+1000});
  jsonServer.on('connection',(ws,req)=>{
    const opts=JSON.parse(new URL(req.url!,`http://127.0.0.1:${port+1000}`).searchParams.get('o')??'{}');
    const key=String(opts.map),core=cores.get(key)??new RoomCore(opts);cores.set(key,core);
    const id=`chapter-json-${++sequence}`;
    try{ws.send(JSON.stringify({t:'welcome',d:core.join(id,opts)}));}catch(e){ws.send(JSON.stringify({t:'error',d:String(e)}));ws.close();return;}
    ws.on('message',bytes=>{
      const msg=JSON.parse(String(bytes));if(msg.t==='input')core.input(id,msg.d);
      let snap:Snapshot|null=null;for(let i=0;i<3;i++)snap=core.step()??snap;
      if(snap)ws.send(JSON.stringify({t:'snap',d:snap}));
    });
    ws.on('close',()=>core.leave(id));
  });
  await new Promise<void>(resolve=>jsonServer.once('listening',resolve));
});
afterAll(async()=>{jsonServer.clients.forEach(ws=>ws.terminate());await new Promise<void>(resolve=>jsonServer.close(()=>resolve()));});
function jsonMessage<T>(ws:WebSocket,type:string):Promise<T>{
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{ws.off('message',listener);reject(new Error(`JSON ${type} timeout`));},4000);
    const listener=(bytes:Buffer)=>{const msg=JSON.parse(String(bytes));if(msg.t===type){clearTimeout(timeout);ws.off('message',listener);resolve(msg.d);}};
    ws.on('message',listener);
  });
}
it('all five chapter IDs and inputs cross actual Worker-style JSON sockets using RoomCore (not hosted Cloudflare)',async()=>{
  const sockets:WebSocket[]=[];
  try{
    for(const info of CHAPTER_MAPS){
      const open=(team:string)=>new WebSocket(`ws://127.0.0.1:${port+1000}/arena?o=${encodeURIComponent(JSON.stringify({rulesVersion:RULES_VERSION,map:info.id,layout:'1v1',team,name:'JSON QA',char:0,skins:[]}))}`);
      const a=open('A');sockets.push(a);const wa=await jsonMessage<{id:string;map:string;rulesVersion:number}>(a,'welcome');
      expect(wa.map).toBe(info.id);expect(wa.rulesVersion).toBe(RULES_VERSION);
      const b=open('B');sockets.push(b);expect((await jsonMessage<{map:string}>(b,'welcome')).map).toBe(info.id);
      const acknowledged=jsonMessage<Snapshot>(a,'snap');a.send(JSON.stringify({t:'input',d:[{seq:1,mx:0,mz:0,yaw:0,pitch:0,buttons:BTN.CROUCH,weapon:0,view:0}]}));
      const snap=await acknowledged;expect(snap.players).toHaveLength(2);
      expect(snap.players.find(p=>p.id===wa.id)!.lastSeq).toBe(1);expect(snap.players.find(p=>p.id===wa.id)!.crouched).toBe(true);
    }
  }finally{sockets.forEach(ws=>ws.close());}
},15000);

for(const bots of [false,true])it(`Colyseus retains the explicit bots=${bots} matchmaking filter when chapter clients pair`,async()=>{
  const client=new Client(`ws://127.0.0.1:${port}`),rooms:Room[]=[];
  try{
    const options={rulesVersion:RULES_VERSION,map:'blackflag',layout:'2v2',bots,char:0,skins:[]};
    const a=await client.joinOrCreate('arena',{...options,team:'A',name:'Filter A'});rooms.push(a);await next(a,'welcome');a.onMessage('snap',()=>{});
    const b=await client.joinOrCreate('arena',{...options,team:'B',name:'Filter B'});rooms.push(b);await next(b,'welcome');b.onMessage('snap',()=>{});
    expect(b.roomId).toBe(a.roomId);
  }finally{await Promise.all(rooms.map(room=>room.leave()));}
});

it('the actual online session normalizes omitted bots to false and does not join a bot-filled room',async()=>{
  const sessions:Session[]=[];
  const observe=(session:Session)=>new Promise<Snapshot>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('session snapshot timeout')),4000);
    session.onSnapshot=snap=>{clearTimeout(timeout);resolve(snap);};
  });
  try{
    const options={map:'camlann',layout:'2v2' as const,team:'A' as const,name:'Client QA',char:0,skins:[]};
    const filled=await joinOnline(`ws://127.0.0.1:${port}`,{...options,bots:true});sessions.push(filled);
    expect((await observe(filled)).players.filter(p=>p.bot)).toHaveLength(3);
    const empty=await joinOnline(`ws://127.0.0.1:${port}`,options);sessions.push(empty);
    const snapshot=await observe(empty);expect(snapshot.players).toHaveLength(1);expect(snapshot.players[0].id).toBe(empty.id);expect(snapshot.players[0].bot).toBe(false);
    const second=await joinOnline(`ws://127.0.0.1:${port}`,{...options,team:'B',bots:false});sessions.push(second);
    const paired=await observe(empty);expect(paired.players.map(p=>p.id).sort()).toEqual([empty.id,second.id].sort());
  }finally{sessions.forEach(session=>session.close());}
});
