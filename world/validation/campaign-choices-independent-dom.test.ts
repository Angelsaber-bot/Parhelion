/** Actual production handlers/save/site state through NON-GPU DOM adapter.
 * Positioning skips travel; real collider traversal is covered independently.
 * Old mainline evidence is an explicit legacy fixture, not new-quest completion. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {CAMPAIGN_REGIONS,CAMPAIGN_EPISODES,campaignEpisodeFlags,getCampaignEpisodeState} from '../src/campaignEpisodes';
import {CAMPAIGN_WORK_TASKS} from '../src/campaignWorkTasks';
import {LEGACY_WORLD_PROGRESS_KEYS,WORLD_PROGRESS_KEY,WorldProgress} from '../src/progress';

test('NON-GPU five legacy-save chronicles require deliberate work/branch choices; cancel, locale, stale range and repeat are safe',async t=>{
 const legacy=['hq_terminal','armory_rack','relay_a','relay_b','sun_core','sea_core','winter_core','fire_core',...CAMPAIGN_REGIONS.flatMap(r=>CAMPAIGN_EPISODES[r].evidence)];
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{[LEGACY_WORLD_PROGRESS_KEYS[0]]:JSON.stringify({done:legacy,found:['old_discovery']})}});
 const {world:w,window}=h,d=window.document;let writes=0;let staleChoice:HTMLButtonElement|undefined;
 const originalSet=window.Storage.prototype.setItem;window.Storage.prototype.setItem=function(this:Storage,k:string,v:string){if(k===WORLD_PROGRESS_KEY)writes++;return originalSet.call(this,k,v);};
 const key=(code:string)=>{d.body.dispatchEvent(new window.KeyboardEvent('keydown',{code,bubbles:true}));d.body.dispatchEvent(new window.KeyboardEvent('keyup',{code,bubbles:true}));};
 const enter=async()=>{if(!d.pointerLockElement){(d.getElementById('start')as HTMLElement).click();await Promise.resolve();}};
 const dialog=d.getElementById('world-dialogue')!,options=d.getElementById('world-dialogue-choices')!;
 const close=()=>{for(let i=0;!dialog.hidden&&i<40;i++){assert.ok(options.hidden,'close only ordinary text, never default-confirm choices');key('KeyF');}assert.equal(dialog.hidden,true);};
 const at=(p:number[])=>{w.player.teleport(...p);w.player.onGround=true;w.player.flying=w.player.swimming=w.player.gliding=false;};
 const marker=(id:string)=>{close();const m=w.layout.markers.find((m:any)=>m.id===id);assert.ok(m,id);at(m.p);key('KeyF');assert.equal(dialog.hidden,false);};
 const choices=()=>{for(let i=0;options.hidden&&!dialog.hidden&&i<40;i++)key('KeyF');assert.equal(options.hidden,false);};
 const click=(id:string)=>{choices();const b=options.querySelector<HTMLButtonElement>(`[data-choice="${id}"]`);assert.ok(b,id);b.click();return b;};
 const dismiss=()=>{key('KeyM');assert.equal(dialog.hidden,true);key('KeyM');};
 try{
  await enter();
  for(const region of CAMPAIGN_REGIONS)await t.test(region,async()=>{
   const def=CAMPAIGN_EPISODES[region],flags=campaignEpisodeFlags(region),site=w.campaignSites.sites.find((s:any)=>s.region===region);
   assert.ok(site);assert.equal(getCampaignEpisodeState(region,w.done).stage,'briefing');assert.equal(getCampaignEpisodeState(region,w.done).evidenceReady,true,'legacy mainline evidence retained');
   assert.equal(site.root.userData.campaignState.stage,0,'old core does not auto-complete newly authored work');
   close();at(site.npc.position);key('KeyF');assert.ok(w.done.has(flags.met));close();
   for(let stepIndex=0;stepIndex<2;stepIndex++){
    const step=CAMPAIGN_WORK_TASKS[region][stepIndex],right=step.options.find(o=>o.correct)!,wrong=step.options.find(o=>!o.correct)!;
    marker(def.work);choices();const before=JSON.stringify([...w.done]),savedWrites=writes;
    for(let i=0;i<6;i++)key('KeyF');assert.equal(JSON.stringify([...w.done]),before,'Interact with no selection cannot solve work');assert.equal(writes,savedWrites);
    const beforeDigit=w.player.pos.toArray();key('Digit1');assert.deepEqual(w.player.pos.toArray(),beforeDigit,'choice digit cannot invoke debug teleport');dismiss();assert.equal(JSON.stringify([...w.done]),before,'dismissing selected work does not commit');
    marker(def.work);click(wrong.id);assert.equal(JSON.stringify([...w.done]),before,'incorrect work is feedback, not completion');assert.equal(writes,savedWrites);dismiss();
    marker(def.work);choices();const correctIndex=step.options.findIndex(o=>o.correct);key(`Digit${correctIndex+1}`);
    const language=d.querySelector<HTMLSelectElement>('#world-settings .parhelion-language select')!;
    language.value=stepIndex?'zh':'en';language.dispatchEvent(new window.Event('change',{bubbles:true}));
    assert.equal(options.querySelector('[aria-pressed="true"]')?.getAttribute('data-choice'),right.id,'locale preserves deliberate selection');
    key('KeyF');assert.equal(writes,savedWrites+1,'exactly one work progress save');close();
    assert.equal(getCampaignEpisodeState(region,w.done).workProgress,stepIndex+1);
   }
   marker(def.decision);choices();const before=[...w.done].sort(),savedWrites=writes;
   key('Digit2');const blurButton=options.querySelector<HTMLButtonElement>('[data-choice]')!;window.dispatchEvent(new window.Event('blur'));assert.equal(dialog.hidden,true);blurButton.click();assert.deepEqual([...w.done].sort(),before,'blur invalidates pending choice');assert.equal(writes,savedWrites);
   marker(def.decision);choices();
   key('KeyF');assert.deepEqual([...w.done].sort(),before,'decision has no default');
   // Fault-injected newly obstructed LOS exercises the real confirmation guard.
   // Combined real-map capsule/LOS reachability is verified by the environment audit.
   const cast=w.combat.geometry.cast;try{w.combat.geometry.cast=()=>({distance:.1});options.querySelector<HTMLButtonElement>('[data-choice]')!.click();}finally{w.combat.geometry.cast=cast;}
   assert.deepEqual([...w.done].sort(),before,'new obstruction cancels pending confirmation');assert.equal(writes,savedWrites);assert.equal(dialog.hidden,true);
   marker(def.decision);choices();
   // A pending dialog must recheck the exact origin even with a stale connected button.
   const branchButton=options.querySelector<HTMLButtonElement>('[data-choice]')!;at([10000,30,10000]);branchButton.click();
   assert.deepEqual([...w.done].sort(),before);assert.equal(writes,savedWrites);assert.equal(dialog.hidden,true);
   marker(def.decision);choices();staleChoice=options.querySelector<HTMLButtonElement>('[data-choice]')!;key('Digit2');const selected=def.choices[1].id;key('KeyF');
   assert.ok(w.done.has(flags.choice(selected)));assert.equal(writes,savedWrites+1);assert.equal(getCampaignEpisodeState(region,w.done).stage,'report');close();
   at(site.npc.position);key('KeyF');assert.ok(w.done.has(flags.complete));close();assert.equal(site.root.userData.campaignState.stage,3);
   const completed=[...w.done].sort(),completedWrites=writes;
   marker(def.work);close();marker(def.decision);close();at(site.npc.position);key('KeyF');close();
   assert.deepEqual([...w.done].sort(),completed);assert.equal(writes,completedWrites,'revisiting cannot duplicate first completion saves');
   const restored=new WorldProgress(window.localStorage);assert.deepEqual([...restored.done].sort(),completed);assert.ok(restored.found.has('old_discovery'));
   for(const flag of legacy)assert.ok(w.done.has(flag),'old campaign flag survives');
  });
  window.confirm=()=>true;key('KeyR');assert.equal(w.done.size,0);assert.equal(w.found.size,0);const resetWrites=writes;staleChoice?.click();assert.equal(w.done.size,0,'stale branch button cannot revive a reset save');assert.equal(writes,resetWrites);
  for(const site of w.campaignSites.sites)assert.equal(site.root.userData.campaignState.stage,0);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
 }finally{window.Storage.prototype.setItem=originalSet;await h.close();}
});
