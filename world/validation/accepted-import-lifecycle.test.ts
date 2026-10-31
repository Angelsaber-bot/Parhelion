/** Successful actual-main import with JSDOM navigation intentionally unavailable.
 * Verifies immediate teardown before reload, not successful browser navigation. */
import test from'node:test';import assert from'node:assert/strict';import{bootWorldWithoutGpu}from'./world-dom-boot.fixture';import{FALSE_DAWN as F}from'../src/falseDawnCampaign';
test('accepted backup cancels active story actors before unavailable navigation without reward or reset refund',async()=>{
 const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true});const{world:w,window}=h,d=window.document;let now=0;const navigationErrors:Error[]=[];const vc=h.virtualConsole;const onError=(error:Error)=>navigationErrors.push(error);vc.on('jsdomError',onError);
 const key=(code:string)=>{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));};
 try{
  for(const flag of ['armory_rack',F.receiver])w.done.add(flag);(d.getElementById('start')as HTMLElement).click();await Promise.resolve();
  const m=w.layout.markers.find((m:any)=>m.id===F.recorder),x=m.p[0],z=m.p[2]+.65,g=w.combat.geometry.ground(x,z,m.p[1]+3);assert.ok(g);w.player.teleport(x,g.point.y+.04,z);w.player.onGround=true;key('KeyF');for(let n=0;w.narrative.open&&!w.narrative.choosing&&n<60;n++)key('KeyF');assert.ok(w.narrative.choosing);key('Digit1');key('KeyF');assert.equal(w.combat.storyEncounter?.id,'false_dawn_courier');h.frame(now+=1000/60);await h.settleAssets();
  const ids=w.combat.state.enemies.filter((e:any)=>e.storyEncounter).map((e:any)=>e.id);assert.ok(ids.length);const hp=w.combat.state.hp;
  const raw=JSON.stringify({done:['hq_terminal'],found:['restored_discovery']}),file=d.querySelector<HTMLInputElement>('#world-progress-status input[type=file]')!;window.confirm=()=>true;Object.defineProperty(file,'files',{configurable:true,value:[{size:raw.length,text:async()=>raw}]});file.dispatchEvent(new window.Event('change'));await new Promise(r=>setTimeout(r,0));await h.settleAssets();
  assert.equal(w.combat.storyEncounter,null);assert.equal(w.combat.state.enemies.filter((e:any)=>e.storyEncounter).length,0);for(const id of ids)assert.equal(w.scene.getObjectByName(id),undefined);
  assert.deepEqual([...w.done],['hq_terminal']);assert.deepEqual([...w.found],['restored_discovery']);assert.deepEqual(JSON.parse(window.localStorage.getItem('parhelion.world.progress.v2')!),JSON.parse(raw));assert.equal(w.combat.state.hp,hp,'cancel does not reset/refund HP');assert.equal(w.done.has('false_dawn_courier_cleared'),false);assert.equal(w.narrative.open,false);
  assert.equal(navigationErrors.length,1,'only the explicit unavailable-navigation diagnostic is expected');assert.match(navigationErrors[0].message,/Not implemented: navigation/);assert.deepEqual(h.errors,[]);
 }finally{vc.removeListener('jsdomError',onError);await h.close();}
});
