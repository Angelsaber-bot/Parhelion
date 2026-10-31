/** Actual main, synthetic corrupt storage only. No browser navigation/GPU claim. */
import test from 'node:test';import assert from 'node:assert/strict';
import{bootWorldWithoutGpu}from'./world-dom-boot.fixture';
const KEY='parhelion.world.progress.v2';
test('corrupt current save survives real quest autosave, canceled repair and stale-tab confirmation; explicit repair preserves session',async()=>{
 const raw=' {"done": ["irreplaceable", BROKEN\n',pref='{"version":1,"finish":"signal"}';
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{[KEY]:raw,'parhelion.world_alpha.progress.v1':'{"done":["legacy_should_not_load"],"found":[]}','parhelion.world.weapon.finish.v1':pref}});
 const{world:w,window}=h,d=window.document;let now=0;const frame=()=>h.frame(now+=1000/60);
 const key=(code:string)=>{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true}));};
 const navigation:any[]=[];h.virtualConsole.on('jsdomError',(e:any)=>navigation.push(e));
 try{
  assert.equal(w.worldProgress.saveBlocked,true);assert.equal(w.worldProgress.exportUnreadableSnapshot(),raw);assert.equal(w.done.has('legacy_should_not_load'),false);
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();
  const npc=w.campaignSites.sites.find((s:any)=>s.region==='alpha').npc;const[x,y,z]=npc.position,g=w.combat.geometry.ground(x,z+.65,y+3);assert.ok(g);w.player.teleport(x,g.point.y+.1,z+.65);
  for(let i=0;i<120&&!w.player.onGround;i++)frame();assert.ok(w.player.onGround);key('KeyF');assert.ok(w.done.has('campaign_alpha_met'),'real interaction changes session progress');w.narrative.hide();
  for(let i=0;i<120;i++)frame();assert.equal(window.localStorage.getItem(KEY),raw);assert.equal(w.worldProgress.saveBlocked,true);assert.equal(d.getElementById('world-save-warning')!.hidden,false);
  const panel=d.getElementById('world-progress-status')!,buttons=panel.querySelectorAll('button');assert.equal(buttons[3].hidden,false,'raw-original download remains available');
  window.confirm=()=>false;buttons[0].click();assert.equal(window.localStorage.getItem(KEY),raw);assert.equal(navigation.length,0);
  const newer='{"done":["other_tab"],"found":[]}';window.confirm=()=>{window.localStorage.setItem(KEY,newer);return true;};buttons[0].click();
  assert.equal(window.localStorage.getItem(KEY),newer);assert.ok(w.done.has('campaign_alpha_met'));assert.equal(w.done.has('other_tab'),false);assert.equal(navigation.length,0);assert.match(panel.textContent!,/另一页面|another tab/);
  let prompts=0;window.confirm=()=>{prompts++;return true;};buttons[0].click();assert.equal(prompts,0,'stale original is rejected before prompting');assert.equal(window.localStorage.getItem(KEY),newer);
  // Explicit test setup restores the original corrupt bytes, as if the other tab undid its write.
  window.localStorage.setItem(KEY,raw);buttons[0].click();assert.equal(prompts,1);assert.equal(w.worldProgress.saveBlocked,false);assert.ok(JSON.parse(window.localStorage.getItem(KEY)!).done.includes('campaign_alpha_met'));assert.equal(w.worldProgress.exportUnreadableSnapshot(),null);
  assert.equal(window.localStorage.getItem('parhelion.world.weapon.finish.v1'),pref);assert.equal(navigation.length,1);assert.match(navigation[0].message,/Not implemented: navigation/);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});


test('partly malformed current save restores usable flags to actual main without autosaving away original bytes',async()=>{
 const raw=JSON.stringify({done:['armory_rack','campaign_britain_worked',null,''],found:['keep_valid',23],future:{sentinel:'preserve raw'}});
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{[KEY]:raw,'parhelion.world_alpha.progress.v1':JSON.stringify({done:['legacy_only'],found:['legacy_found']})}});
 const{world:w,window}=h,d=window.document;let now=0;const frame=()=>h.frame(now+=1000/60);
 try{
  assert.equal(w.worldProgress.armed,true);assert.ok(w.done.has('campaign_britain_worked'));assert.ok(w.found.has('keep_valid'));assert.equal(w.done.has('legacy_only'),false);assert.equal(w.found.has('legacy_found'),false);assert.equal(w.done.has(''),false);assert.equal(w.worldProgress.saveBlocked,true);assert.equal(w.worldProgress.exportUnreadableSnapshot(),raw);
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();const npc=w.campaignSites.sites.find((s:any)=>s.region==='alpha').npc,[x,y,z]=npc.position,g=w.combat.geometry.ground(x,z+.6,y+3);assert.ok(g);w.player.teleport(x,g.point.y+.1,z+.6);for(let i=0;i<180&&!w.player.onGround;i++)frame();assert.ok(w.player.onGround);
  for(const type of ['keydown','keyup'])d.body.dispatchEvent(new window.KeyboardEvent(type,{code:'KeyF',bubbles:true}));assert.ok(w.done.has('campaign_alpha_met'));assert.equal(window.localStorage.getItem(KEY),raw);assert.equal(w.worldProgress.persistence,'invalid');assert.equal(d.getElementById('world-save-warning')!.hidden,false);
  window.confirm=()=>false;(d.querySelector('#world-progress-status button')as HTMLButtonElement).click();assert.equal(window.localStorage.getItem(KEY),raw);assert.ok(w.done.has('armory_rack'));assert.ok(w.done.has('campaign_alpha_met'));assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
