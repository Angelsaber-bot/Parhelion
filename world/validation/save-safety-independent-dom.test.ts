/** Actual-main persistence fault injection. NON-GPU; successful browser reload is not simulated. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
const KEY='parhelion.world.progress.v2';
test('NON-GPU failed chronicle save stays in memory, retry persists, rejected/failed/superseded imports preserve live progress and preferences',async()=>{
 const initial=JSON.stringify({done:['hq_terminal','armory_rack'],found:['keep_discovery']}),preference='parhelion.world.weapon.finish.v1';
 const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true,initialStorage:{[KEY]:initial,[preference]:'{"version":1,"finish":"signal"}','parhelion-world-resolution-v1':'crisp'}});
 const {world:w,window}=h,d=window.document,doneIdentity=w.done,foundIdentity=w.found;
 const original=window.Storage.prototype.setItem;let quota=true,confirmations=0,accept=false;
 window.Storage.prototype.setItem=function(key,value){if(key===KEY&&quota)throw new Error('QA quota');return original.call(this,key,value);};
 window.confirm=()=>{confirmations++;return accept;};
 const key=(code:string)=>{d.body.dispatchEvent(new window.KeyboardEvent('keydown',{code,bubbles:true}));d.body.dispatchEvent(new window.KeyboardEvent('keyup',{code,bubbles:true}));};
 const select=async(raw:string|Promise<string>,size=100)=>{Object.defineProperty(file,'files',{configurable:true,value:[{size,text:()=>Promise.resolve(raw)}]});file.dispatchEvent(new window.Event('change'));await new Promise(r=>setTimeout(r,0));};
 const panel=d.getElementById('world-progress-status')!,file=panel.querySelector<HTMLInputElement>('input[type=file]')!;
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();
  const npc=w.campaignSites.sites.find((s:any)=>s.region==='alpha').npc;w.player.teleport(...npc.position);w.player.onGround=true;key('KeyF');
  assert.ok(w.done.has('campaign_alpha_met'));assert.equal(w.worldProgress.persistence,'failed');assert.equal(window.localStorage.getItem(KEY),initial);
  assert.equal(d.getElementById('world-save-warning')!.hidden,false);assert.match(d.getElementById('world-dialogue-text')!.textContent!,/未保存|not.*saved/i);
  w.narrative.hide();quota=false;(panel.querySelector('button')as HTMLButtonElement).click();
  assert.equal(w.worldProgress.persistence,'saved');assert.equal(d.getElementById('world-save-warning')!.hidden,true);assert.ok(JSON.parse(window.localStorage.getItem(KEY)!).done.includes('campaign_alpha_met'));
  const snapshot=window.localStorage.getItem(KEY),live=[...w.done].sort(),prefs=[window.localStorage.getItem(preference),window.localStorage.getItem('parhelion-world-resolution-v1')];
  await select('{broken');await select('{"done":[],"found":[]}',262145);await select('{"done":[3],"found":[]}');assert.equal(confirmations,0);assert.equal(window.localStorage.getItem(KEY),snapshot);
  await select('{"done":["replace"],"found":[]}');assert.equal(confirmations,1);assert.deepEqual([...w.done].sort(),live,'canceled import is non-mutating');
  quota=true;accept=true;await select('{"done":["replace"],"found":[]}');assert.equal(confirmations,2);assert.equal(w.worldProgress.persistence,'failed');assert.equal(window.localStorage.getItem(KEY),snapshot);assert.deepEqual([...w.done].sort(),live);assert.match(panel.textContent!,/保持不变|unchanged/i);
  // Old pending file cannot become authoritative after a newer selection is canceled.
  quota=false;accept=false;let resolveOld!:(s:string)=>void;const old=new Promise<string>(resolve=>{resolveOld=resolve;});
  await select(old);await select('{"done":["newer"],"found":[]}');const afterNew=confirmations;resolveOld('{"done":["older"],"found":[]}');await new Promise(r=>setTimeout(r,0));
  assert.equal(confirmations,afterNew);assert.equal(window.localStorage.getItem(KEY),snapshot);assert.deepEqual([...w.done].sort(),live);
  (panel.querySelector('button')as HTMLButtonElement).click();assert.equal(w.worldProgress.persistence,'saved');assert.equal(w.done,doneIdentity);assert.equal(w.found,foundIdentity);
  assert.deepEqual([window.localStorage.getItem(preference),window.localStorage.getItem('parhelion-world-resolution-v1')],prefs);
  assert.deepEqual(h.errors,[]);
 }finally{window.Storage.prototype.setItem=original;await h.close();}
});
