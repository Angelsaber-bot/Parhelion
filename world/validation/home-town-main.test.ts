import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {HOME_FLAGS} from '../src/story/homeTown';

test('real main input invites Saber, welcomes her, shares a meal, preserves saves and uses one actor for home/follow',async()=>{
 const legacy=['saber_contract','sun_core'];let saved='';
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({version:2,done:legacy,found:[]}), 'parhelion.world.contract.v1':JSON.stringify({version:1,servant:'saber',summoned:false})}});
 const w=h.world,d=h.window.document;let time=0;
 const frames=(n=1)=>{for(let i=0;i<n;i++)h.frame(time+=1000/60);};
 const key=(code:string)=>{d.body.dispatchEvent(new h.window.KeyboardEvent('keydown',{code,bubbles:true}));d.body.dispatchEvent(new h.window.KeyboardEvent('keyup',{code,bubbles:true}));};
 const at=(id:string)=>{const m=w.layout.markers.find((m:any)=>m.id===id);assert.ok(m);w.player.teleport(m.p[0],m.p[1]-.65,m.p[2]);frames(100);w.combat.state.quietFor=10;assert.ok(w.player.onGround,id+' grounded');return m;};
 const choose=(id:string)=>{for(let i=0;i<10&&!w.narrative.choosing;i++)key('KeyF');const button=d.querySelector<HTMLButtonElement>(`#world-dialogue-choices button[data-choice="${id}"]`);assert.ok(button,`choice ${id}: ${d.getElementById('world-dialogue')?.textContent}`);button.click();};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frames(10);
  at('home_register');key('KeyF');choose('later');assert.ok(!w.done.has(HOME_FLAGS.invited),'cancel never invites');
  key('KeyF');w.player.teleport(730,16,-21);choose('invite');assert.ok(!w.done.has(HOME_FLAGS.invited),'a stale choice cannot invite from outside interaction range');at('home_register');
  key('KeyF');choose('invite');assert.ok(w.done.has(HOME_FLAGS.invited));w.narrative.hide();frames(10);await h.settleAssets();
  assert.equal(w.servant.root.visible,true);assert.equal(w.servant.state,'ready');assert.equal(w.servant.root.name,'ArtoriaContractServant');
  at('home_saber_talk');key('KeyF');choose('talk');assert.ok(w.done.has(HOME_FLAGS.welcome));
  at('home_meal');key('KeyF');choose('meal');assert.ok(w.done.has(HOME_FLAGS.meal));assert.equal(w.homeTown.root.getObjectByName('HomeSharedMeal').visible,true);w.narrative.hide();
  at('home_register');key('KeyF');choose('follow');assert.equal(w.contract.summoned,true);frames(10);
  assert.equal(w.scene.getObjectsByProperty('name','ArtoriaContractServant').length,1,'same actor, never a residence clone');
  key('KeyT');frames(10);assert.equal(w.contract.summoned,false);assert.equal(w.servant.root.visible,true);
  // Real collision navigation walks out of her room and along the hall; no wall teleport.
  const observer=new w.THREE.Vector3(645,16,-70),start=w.servant.root.position.clone();
  for(let i=0;i<900;i++){w.homeTown.update(.1,observer,true,true);w.servant.update(.1,observer,0,true,false);}
  assert.ok(w.homeTown.routeIndex>=3,`daily path advances through doorway and hall: ${w.homeTown.routeIndex}`);assert.ok(w.servant.root.position.distanceTo(start)>12,'resident physically walks');
  const stopped=w.servant.root.position.clone();for(let i=0;i<30;i++){w.homeTown.update(.1,observer,false,true);w.servant.update(.1,observer,0,true,true);}assert.deepEqual(w.servant.root.position.toArray(),stopped.toArray(),'pause freezes residence movement');
  assert.deepEqual([...w.done].filter((v:string)=>!v.startsWith('home_')),legacy,'home cannot grant chapter/weapon/contract facts');
  saved=h.window.localStorage.getItem('parhelion.world.progress.v2')!;assert.deepEqual(h.errors,[]);
  w.worldProgress.reset();w.contract.reset();w.homeTown.apply();w.homeTown.update(0,observer,true,true);w.servant.update(0,observer,0,true,false);
  for(const flag of Object.values(HOME_FLAGS))assert.ok(!w.done.has(flag));assert.equal(w.homeTown.root.getObjectByName('SaberHomeLuggage').visible,false);assert.equal(w.servant.root.visible,false,'progress reset removes residence without manufacturing an uncontracted town actor');
 }finally{await h.close();}
 const restored=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':saved,'parhelion.world.contract.v1':JSON.stringify({version:1,servant:'saber',summoned:false})}});
 try{for(const f of[HOME_FLAGS.invited,HOME_FLAGS.welcome,HOME_FLAGS.meal])assert.ok(restored.world.done.has(f));assert.equal(restored.world.homeTown.root.getObjectByName('SaberHomeLuggage').visible,true);assert.equal(restored.world.homeTown.root.getObjectByName('HomeSharedMeal').visible,true);assert.deepEqual(restored.errors,[]);}finally{await restored.close();}
});

test('uncontracted guest book and stale home facts cannot summon or house Saber',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({version:2,done:[HOME_FLAGS.invited],found:[]})}});
 try{const w=h.world;w.player.teleport(689,16.5,-21);for(let i=0;i<120;i++)h.frame(i*1000/60);w.combat.state.quietFor=10;w.homeTown.interact('home_register');assert.equal(w.contract.recruited,false);assert.equal(w.homeTown.root.getObjectByName('SaberHomeLuggage').visible,false);assert.equal(w.servant.root.visible,false);assert.ok(!w.done.has('saber_contract'));}finally{await h.close();}
});
