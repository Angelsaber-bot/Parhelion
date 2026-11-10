import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {ORLEANS_WORK_ACTIONS,ORLEANS_UNDERPASS} from '../src/map/orleansWorks';
import {Player} from '../src/player/player';

test('actual grounded main input operates local works, opens the physical passage and restores saved facilities',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true}),w=h.world,d=h.window.document;let time=0,storage='';
 const frames=(n=1)=>{for(let i=0;i<n;i++)h.frame(time+=1000/60);};
 const key=(down:boolean)=>d.body.dispatchEvent(new h.window.KeyboardEvent(down?'keydown':'keyup',{code:'KeyF',bubbles:true,cancelable:true}));
 const walk=(player:Player,x:number,z:number,limit=1800)=>{for(let i=0;i<limit&&Math.hypot(player.pos.x-x,player.pos.z-z)>.3;i++){player.yaw=Math.atan2(-(x-player.pos.x),-(z-player.pos.z));player.step(1/120,{x:0,z:1,jump:false,sprint:false});}return Math.hypot(player.pos.x-x,player.pos.z-z);};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frames(15);const before=[...w.done];
  const gate=w.orleansWorksScene.collider;assert.equal(gate.enabled,true);
  const p=new Player(w.colliders,0);p.teleport(-883,3,-778);for(let i=0;i<120;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});
  assert.ok(walk(p,-866,-790,600)>1,'closed grille physically blocks a capsule');
  for(const action of ORLEANS_WORK_ACTIONS){
   const marker=w.layout.markers.find((m:any)=>m.id===action.id);assert.ok(marker);w.player.teleport(marker.p[0],marker.p[1]-.35,marker.p[2]);frames(120);
   assert.ok(w.player.onGround&&!w.player.swimming&&!w.player.flying,action.id+' grounded');assert.ok(w.player.pos.distanceTo(new w.THREE.Vector3(...marker.p))<2.6,action.id+' approachable '+JSON.stringify({player:w.player.pos.toArray(),marker:marker.p}));
   key(true);frames(2);key(false);frames(2);assert.equal(w.orleansWorksRuntime.active,action.id,action.id+' actual input selects facility');
   key(true);frames(20);assert.ok(!d.getElementById('orleans-work-progress')!.hidden);assert.ok(!w.done.has(action.flag));frames(Math.ceil(action.seconds*60)+5);key(false);frames(2);
   assert.ok(w.done.has(action.flag),action.id+' completes');assert.equal(w.orleansWorksRuntime.active,null);assert.ok(d.getElementById('orleans-work-progress')!.hidden);
  }
  assert.deepEqual([...w.done].filter((v:string)=>!before.includes(v)).sort(),ORLEANS_WORK_ACTIONS.map(a=>a.flag).sort());assert.equal(gate.enabled,false);
  for(const points of [ORLEANS_UNDERPASS,[...ORLEANS_UNDERPASS].reverse()]){
   const player=new Player(w.colliders,0),first=points[0];player.teleport(first[0]-720,first[1]+.6,first[2]-1440);for(let i=0;i<120;i++)player.step(1/120,{x:0,z:0,jump:false,sprint:false});
   for(const point of points.slice(1)){assert.ok(walk(player,point[0]-720,point[2]-1440)<.3,`open route blocked at ${player.pos.toArray()}`);assert.equal(player.swimming,false);}
  }
  if(d.pointerLockElement)d.exitPointerLock();(d.getElementById('world-quest-journal-open')as HTMLElement).click();
  const journal=d.getElementById('world-quest-journal')!,showDone=journal.querySelector<HTMLInputElement>('input[type=checkbox]')!;showDone.checked=true;showDone.dispatchEvent(new h.window.Event('change',{bubbles:true}));for(const a of ORLEANS_WORK_ACTIONS)assert.match(journal.textContent!,new RegExp(a.label[0]));
  storage=h.window.localStorage.getItem('parhelion.world.progress.v2')!;assert.ok(storage);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
 const restored=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':storage}});
 try{assert.equal(restored.world.orleansWorksScene.collider.enabled,false);for(const a of ORLEANS_WORK_ACTIONS)assert.ok(restored.world.done.has(a.flag));assert.equal(restored.world.orleansWorksRuntime.active,null);assert.equal(restored.world.orleansWorksScene.root.getObjectByName('OrleansBelfryBell').rotation.z,0);assert.deepEqual(restored.errors,[]);}finally{await restored.close();}
});
