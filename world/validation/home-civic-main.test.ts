import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {HOME_CIVIC,HOME_TARGETS} from '../src/map/homeActivities';

test('actual main input carries bread, operates works, fishes and shoots a complete town practice round',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({version:2,done:['armory_rack'],found:[]})}}),w=h.world,d=h.window.document;let t=0,saved='';
 const frames=(n=1)=>{for(let i=0;i<n;i++)h.frame(t+=1000/60);};
 const key=(code:string,down:boolean)=>d.body.dispatchEvent(new h.window.KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true}));
 const tap=()=>{key('KeyF',true);frames(1);key('KeyF',false);frames(1);};
 const at=(id:string)=>{const m=w.layout.markers.find((m:any)=>m.id===id);assert.ok(m);w.player.teleport(m.p[0],m.p[1]-.65,m.p[2]);frames(90);w.combat.state.quietFor=10;assert.ok(w.player.onGround,id+' grounded');assert.ok(w.player.pos.distanceTo(new w.THREE.Vector3(...m.p))<2.6,id+' clear approach');};
 const choose=(id:string)=>{for(let i=0;i<10&&!w.narrative.choosing;i++)tap();const b=d.querySelector<HTMLButtonElement>(`#world-dialogue-choices button[data-choice="${id}"]`);assert.ok(b,`${id}: ${d.getElementById('world-dialogue')?.textContent}`);b.click();};
 const walk=(x:number,z:number)=>{key('ShiftLeft',true);key('KeyW',true);for(let i=0;i<1800&&Math.hypot(w.player.pos.x-x,w.player.pos.z-z)>.55;i++){w.player.yaw=Math.atan2(-(x-w.player.pos.x),-(z-w.player.pos.z));frames();}key('KeyW',false);key('ShiftLeft',false);frames(12);assert.ok(Math.hypot(w.player.pos.x-x,w.player.pos.z-z)<.9,`walk blocked ${w.player.pos.toArray()} -> ${x},${z}`);};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frames(20);
  at('home_notice');tap();choose('accept');assert.ok(w.done.has(HOME_CIVIC.started));
  at('home_bread_pickup');tap();assert.equal(w.homeTown.activities.carrying,true);
  for(const [x,z]of[[-120,66],[-120,50],[-115,10],[-35,10],[-35,-18],[-26,-26]]){walk(x+720,z);assert.equal(w.homeTown.activities.carrying,true,`bread carry along ${x},${z}`);}
  assert.equal(w.homeTown.activities.carrying,true,'basket survives actual walking');tap();assert.ok(w.done.has(HOME_CIVIC.bread));assert.equal(w.homeTown.activities.carrying,false);assert.deepEqual(w.homeTown.activities.carried.position.toArray(),[697,17.68,-30]);
  for(const [id,flag,seconds]of[['home_winch',HOME_CIVIC.boat,5],['home_lighthouse',HOME_CIVIC.light,3],['home_water',HOME_CIVIC.garden,3]]as const){
   at(id);tap();assert.equal(w.homeTown.activities.active,id,id+' starts from real F');key('KeyF',true);frames(seconds*60+8);key('KeyF',false);frames();assert.ok(w.done.has(flag),id+' completed');
  }
  at('home_notice');tap();choose('report');assert.ok(w.done.has(HOME_CIVIC.complete));
  at('home_fishing');tap();frames(280);assert.equal(w.homeTown.activities.fishing,'bite');tap();assert.ok(w.done.has(HOME_CIVIC.fish));
  at('home_practice_start');tap();assert.equal(w.homeTown.activities.training,true);
  for(const p of HOME_TARGETS){
   const target=new w.THREE.Vector3(p[0]+720,p[1],p[2]);w.camera.lookAt(target);w.camera.updateMatrixWorld();
   h.window.dispatchEvent(new h.window.MouseEvent('mousedown',{button:0,bubbles:true}));h.window.dispatchEvent(new h.window.MouseEvent('mouseup',{button:0,bubbles:true}));frames(30);
  }
  assert.ok(w.done.has(HOME_CIVIC.practice),'real camera/muzzle shot path hits all three distinct targets');
  w.player.teleport(570,16.4,40);frames(90);w.combat.state.quietFor=10;assert.ok(w.found.has('travel_home'),'grounded visit registers home');
  w.player.teleport(600,16.4,40);frames(90);w.combat.state.quietFor=10;const hp=w.combat.state.hp,before=[...w.done];assert.equal(w.executeSafeTravel('travel_home'),true);assert.ok(Math.hypot(w.player.pos.x-570,w.player.pos.z-40)<.01);assert.equal(w.combat.state.hp,hp);assert.deepEqual([...w.done],before,'returning home does not grant or clear chapters');
  d.exitPointerLock();(d.getElementById('world-quest-journal-open')as HTMLElement).click();const journal=d.getElementById('world-quest-journal')!;const show=journal.querySelector<HTMLInputElement>('input[type=checkbox]')!;show.checked=true;show.dispatchEvent(new h.window.Event('change',{bubbles:true}));assert.match(journal.textContent!,/把日子接起来/);assert.match(journal.textContent!,/垂钓/);
  saved=h.window.localStorage.getItem('parhelion.world.progress.v2')!;assert.ok([...w.done].every((flag:string)=>flag==='armory_rack'||flag.startsWith('home_')));assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
 const restored=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':saved}});
 try{for(const flag of[HOME_CIVIC.bread,HOME_CIVIC.boat,HOME_CIVIC.light,HOME_CIVIC.garden,HOME_CIVIC.complete,HOME_CIVIC.fish,HOME_CIVIC.practice])assert.ok(restored.world.done.has(flag));assert.equal(restored.world.homeTown.activities.active,null);assert.equal(restored.world.homeTown.activities.carrying,false);assert.equal(restored.world.homeTown.activities.training,false);assert.equal(restored.world.homeTown.activities.fishing,'idle');assert.deepEqual(restored.errors,[]);}finally{await restored.close();}
});
