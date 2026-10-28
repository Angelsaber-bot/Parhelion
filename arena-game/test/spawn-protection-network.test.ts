// Actual client sessions over real Colyseus and Worker-format WebSockets.
// The authoritative clock is manually stepped for exact, non-wall-clock expiry assertions.
// Worker-format coverage uses its real RoomCore, not a deployed Cloudflare Durable Object.
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { WebSocketServer } from 'ws';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ArenaRoom } from '../server/ArenaRoom.ts';
import { COUNTDOWN_TICKS, RESPAWN_TICKS, SPAWN_PROTECTION_TICKS } from '../shared/content.ts';
import type { Match, Snapshot } from '../shared/match.ts';
import { RoomCore } from '../shared/room.ts';
import { BTN, type Input } from '../shared/sim.ts';
import { joinOnline, type Session } from '../src/session.ts';
const port=33000+Math.floor(Math.random()*400);
let server:Server, sockets:WebSocketServer, room:ArenaRoom;
const core=new RoomCore({layout:'1v1'});
class ManualRoom extends ArenaRoom {
  override onCreate(options:Parameters<ArenaRoom['onCreate']>[0]) {
    super.onCreate(options); this.setSimulationInterval(); room=this;
  }
}
beforeAll(async()=>{
  server=new Server({transport:new WebSocketTransport()}); server.define('arena',ManualRoom); await server.listen(port);
  sockets=new WebSocketServer({port:port+1000}); let next=0;
  sockets.on('connection',(ws,req)=>{
    const opts=JSON.parse(new URL(req.url!,`http://localhost:${port}`).searchParams.get('o')??'{}');
    const id=`protected-json-${++next}`; ws.send(JSON.stringify({t:'welcome',d:core.join(id,opts)}));
    ws.on('message',bytes=>{const msg=JSON.parse(String(bytes)); if(msg.t==='input')core.input(id,msg.d); if(msg.t==='rematch')core.rematch();});
    ws.on('close',()=>core.leave(id));
  });
  await new Promise<void>(resolve=>sockets.once('listening',resolve));
});
afterAll(async()=>{sockets.clients.forEach(ws=>ws.terminate());await new Promise<void>(resolve=>sockets.close(()=>resolve()));await server.gracefullyShutdown(false);});
async function until(predicate:()=>boolean){
  const deadline=performance.now()+2000;
  while(!predicate()){if(performance.now()>deadline)throw Error('input/rematch did not cross the real socket');await new Promise(resolve=>setTimeout(resolve,2));}
}
function observe(s:Session,send:()=>void){
  return new Promise<Snapshot>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('snapshot did not cross the real socket')),2000);
    s.onSnapshot=snap=>{clearTimeout(timeout);resolve(snap);}; send();
  });
}
for(const transport of ['Colyseus','Worker JSON'] as const) it(`${transport}: first spawn, firing, exact expiry, actual respawn and rematch protection survive real client transport`,async()=>{
  const url=`ws://127.0.0.1:${transport==='Colyseus'?port:port+1000}${transport==='Colyseus'?'':'/arena'}`;
  const options={layout:'1v1' as const,name:'Spawn QA',char:0,skins:[],loadout:['longnight','lumen','blade'] as ['longnight','lumen','blade']};
  const a=await joinOnline(url,{...options,team:'A'}), b=await joinOnline(url,{...options,team:'B'});
  const m=transport==='Colyseus'?room.match:core.match;
  const publish=()=>{const snap=m.snapshot();if(transport==='Colyseus')room.broadcast('snap',snap);else sockets.clients.forEach(ws=>ws.send(JSON.stringify({t:'snap',d:snap})));};
  const read=()=>observe(a,publish);
  let seq=0;
  const command=async(buttons:number,count=1)=>{
    const inputs:Input[]=Array.from({length:count},()=>({seq:++seq,mx:0,mz:0,yaw:Math.PI,pitch:0,buttons,weapon:0,view:m.tick}));
    a.send(inputs);await until(()=>m.slots.get(a.id)!.queue.at(-1)?.seq===seq);
    for(let i=0;i<count;i++)m.step();
  };
  const cool=async()=>{for(let i=0;i<78;i+=13)await command(0,13);};
  try{
    let snap=await read(); expect(snap.tick).toBe(0); expect(snap.players.every(p=>p.spawnProtectedUntilTick===SPAWN_PROTECTION_TICKS)).toBe(true);
    m.phase='live';m.phaseT=10000;
    // The clear south lane avoids ASTER's central cover at z=18.5.
    Object.assign(m.player(a.id)!,{x:0,y:0,z:20});Object.assign(m.player(b.id)!,{x:0,y:0,z:26});
    await command(BTN.FIRE);snap=await read();
    expect(snap.events.some(e=>e.t==='shot')).toBe(true); expect(snap.players.find(p=>p.id===b.id)!.hp).toBe(150);
    expect(snap.events.some(e=>e.t==='hit'||e.t==='kill')).toBe(false);
    expect(snap.players.find(p=>p.id===a.id)!.spawnProtectedUntilTick).toBe(150);
    await cool();while(m.tick<149)m.step();
    snap=await read();expect(snap.players.find(p=>p.id===b.id)!.spawnProtectedUntilTick!-snap.tick).toBe(1);
    await command(BTN.FIRE);snap=await read();expect(snap.tick).toBe(150);
    expect(snap.players.find(p=>p.id===b.id)!.alive).toBe(false);expect(snap.events.some(e=>e.t==='kill'&&e.victim===b.id)).toBe(true);
    expect(snap.score.A).toBe(1);expect(snap.players.find(p=>p.id===b.id)!.respawn).toBe(RESPAWN_TICKS-1);
    while(!m.player(b.id)!.alive)m.step();const born=m.tick;
    snap=await read();expect(snap.players.find(p=>p.id===b.id)!.spawnProtectedUntilTick).toBe(born+150);
    Object.assign(m.player(b.id)!,{x:0,y:0,z:26});
    await cool();await command(BTN.FIRE);snap=await read();
    expect(snap.players.find(p=>p.id===b.id)!.hp).toBe(150);expect(snap.events.some(e=>e.t==='hit'||e.t==='kill')).toBe(false);expect(snap.score.A).toBe(1);
    m.phase='ended';a.rematch();await until(()=>m.phase==='countdown');snap=await read();
    expect(snap.players.every(p=>p.spawnProtectedUntilTick===snap.tick+150)).toBe(true);expect(snap.score).toEqual({A:0,B:0});
    for(let i=0;i<COUNTDOWN_TICKS;i++)m.step();snap=await read();expect(snap.phase).toBe('live');
    expect(snap.players.every(p=>p.spawnProtectedUntilTick===snap.tick+150)).toBe(true);
  }finally{a.close();b.close();}
},10000);
