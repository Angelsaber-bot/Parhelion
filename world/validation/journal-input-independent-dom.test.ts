/** Independent actual-main modal/input QA. NON-GPU, no browser pointer-lock claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';

test('NON-GPU journal is read-only, route-gated and clears movement; custom Digit1 Interact retains precedence',async()=>{
 const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true});
 const {world:w,window}=h,d=window.document;let now=0,commits=0;
 const down=(code:string,repeat=false,key=code)=>d.body.dispatchEvent(new window.KeyboardEvent('keydown',{code,key,repeat,bubbles:true,cancelable:true}));
 const up=(code:string)=>d.body.dispatchEvent(new window.KeyboardEvent('keyup',{code,bubbles:true}));
 const key=(code:string,text=code)=>{down(code,false,text);up(code);};
 const frame=()=>h.frame(now+=1000/60);
 const enter=async()=>{if(!d.pointerLockElement){(d.getElementById('start')as HTMLElement).click();await Promise.resolve();}};
 const open=d.getElementById('world-campaign-journal-open')as HTMLButtonElement;
 try{
  await enter();for(let i=0;i<60;i++)frame();
  const before=[...w.done].sort(),found=[...w.found].sort();down('KeyW');open.click();
  assert.equal(w.campaignJournal.open,true);assert.equal(d.pointerLockElement,null);
  const position=w.player.pos.clone(),hp=w.combat.state.hp,cooldown=w.actions.skills.cooldown('ultimate');
  for(const code of ['KeyQ','KeyX','KeyB','Digit1','KeyF'])key(code);
  for(let i=0;i<30;i++)frame();up('KeyW');
  assert.equal(w.player.pos.x,position.x);assert.equal(w.player.pos.z,position.z);assert.equal(w.combat.state.hp,hp);assert.equal(w.actions.skills.cooldown('ultimate'),cooldown);
  assert.deepEqual([...w.done].sort(),before);assert.deepEqual([...w.found].sort(),found);assert.equal(w.actions.melee.active,false);assert.equal(w.actions.skills.casting,false);
  const journal=d.getElementById('world-campaign-journal')!;
  assert.equal(journal.querySelectorAll('[data-campaign-entry]').length,5);
  for(const region of ['britain','blacksail','winter','kyoto']){const track=journal.querySelector<HTMLButtonElement>(`[data-campaign-region="${region}"]`)!;assert.equal(track.disabled,true);track.click();assert.equal(w.campaignJournal.open,true);}
  const alpha=journal.querySelector<HTMLButtonElement>('[data-campaign-region="alpha"]')!;assert.equal(alpha.disabled,false);alpha.focus();
  const language=d.querySelector<HTMLSelectElement>('#world-settings .parhelion-language select')!;language.value='en';language.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal((d.activeElement as HTMLElement).dataset.campaignRegion,'alpha');assert.deepEqual([...w.done].sort(),before);
  const close=journal.querySelector<HTMLButtonElement>('[data-journal-action="close"]')!;close.focus();key('Tab','Tab');assert.equal((d.activeElement as HTMLElement).dataset.campaignRegion,'alpha');
  journal.querySelector<HTMLButtonElement>('[data-campaign-region="alpha"]')!.click();assert.equal(w.campaignJournal.open,false);assert.deepEqual([...w.done].sort(),before);
  await enter();const stopped=w.player.pos.clone();for(let i=0;i<10;i++)frame();assert.equal(w.player.pos.x,stopped.x);assert.equal(w.player.pos.z,stopped.z,'journal closure does not revive held W');
  assert.equal(w.settings.bind('interact','Digit1',true),null);
  const pending=[{id:'left',label:['左','Left']},{id:'right',label:['右','Right']}];
  w.narrative.showChoices(['选择','Choose'],['测试','Test'],pending,()=>commits++);
  const origin=w.player.pos.toArray();key('Digit1');assert.equal(commits,0,'custom interact does not implicitly select option1');assert.deepEqual(w.player.pos.toArray(),origin);
  key('Digit2');assert.equal(commits,0);assert.deepEqual(w.player.pos.toArray(),origin,'choice number does not teleport');
  down('Digit1',true);up('Digit1');assert.equal(commits,0,'held-key repeat cannot confirm');key('Digit1');assert.equal(commits,1);assert.equal(w.narrative.open,false);
  assert.equal(w.settings.bind('interact','KeyF',true),null);
  // Repeated read/close/locale cycles cannot create progress or accumulate DOM nodes.
  open.click();const nodes=d.querySelectorAll('*').length;w.campaignJournal.hide();
  for(let i=0;i<30;i++){open.click();language.value=i%2?'zh':'en';language.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(d.querySelectorAll('*').length,nodes);key('Escape','Escape');assert.equal(w.campaignJournal.open,false);}
  assert.deepEqual([...w.done].sort(),before);assert.deepEqual([...w.found].sort(),found);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
