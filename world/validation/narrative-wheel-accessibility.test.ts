/** Actual production input dispatch with an explicit non-GPU renderer. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
test('remapped wheel Interact reads dialogue and confirms only an explicit choice in both locales',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true}),w=h.world,d=h.window.document;let commits=0;
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();
  const language=d.querySelector<HTMLSelectElement>('#world-settings .parhelion-language select')!;
  for(const lang of['zh','en'])for(const binding of['WheelDown','WheelUp']){
   language.value=lang;language.dispatchEvent(new h.window.Event('change',{bubbles:true}));
   assert.equal(w.settings.bind('interact',binding,true),null);
   const wheel=()=>d.body.dispatchEvent(new h.window.WheelEvent('wheel',{deltaY:binding==='WheelDown'?120:-120,bubbles:true,cancelable:true}));
   w.narrative.show(['短句','Short line']);wheel();assert.equal(w.narrative.open,false,`${binding} must advance ordinary dialogue`);
   w.narrative.showChoices(['选择','Choose'],['测试','Test'],[{id:'one',label:['一','One']},{id:'two',label:['二','Two']}],()=>commits++);
   const before=commits;wheel();assert.equal(commits,before,'no implicit first answer');
   d.body.dispatchEvent(new h.window.KeyboardEvent('keydown',{code:'Digit2',bubbles:true,cancelable:true}));
   wheel();assert.equal(commits,before+1);assert.equal(w.narrative.open,false);wheel();assert.equal(commits,before+1,'no duplicate choice');
  }
  // The opposite, unbound wheel is not a blanket dialogue shortcut.
  w.narrative.show(['短句','Short line']);
  d.body.dispatchEvent(new h.window.WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true}));
  assert.equal(w.narrative.open,true);w.narrative.hide();
  w.settingsPanel.show();w.narrative.show(['后台对话','Background dialogue']);
  d.body.dispatchEvent(new h.window.WheelEvent('wheel',{deltaY:-120,bubbles:true,cancelable:true}));
  assert.equal(w.narrative.open,true,'Settings ownership still blocks remapped wheel');w.narrative.hide();w.settingsPanel.close();
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();
  d.getElementById('view')!.dispatchEvent(new h.window.Event('webglcontextlost',{cancelable:true}));
  w.narrative.show(['后台对话','Background dialogue']);
  d.body.dispatchEvent(new h.window.WheelEvent('wheel',{deltaY:-120,bubbles:true,cancelable:true}));
  assert.equal(w.narrative.open,true,'lost graphics context still blocks remapped wheel');w.narrative.hide();
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

test('pointer release dismisses remapped choices without committing and permits intentional resume',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true}),w=h.world,d=h.window.document;let commits=0;
 try{
  const start=d.getElementById('start') as HTMLElement;
  for(const binding of ['Digit1','ArrowDown','Mouse3','WheelUp']){
   start.click();await Promise.resolve();
   assert.equal(w.settings.bind('interact',binding,true),null);
   w.narrative.showChoices(['选择','Choose'],['测试','Test'],[{id:'one',label:['一','One']}],()=>commits++);
   w.narrative.selectChoice(0);
   const stale=d.querySelector<HTMLButtonElement>('#world-dialogue-choices button')!;
   // Escape belongs to native pointer lock. Exercise its resulting production
   // event; jsdom does not implement the browser's Escape or focus behavior.
   d.exitPointerLock();assert.equal(w.narrative.open,false);stale.click();assert.equal(commits,0);
   assert.equal(start.classList.contains('hidden'),false);
   start.click();await Promise.resolve();assert.equal(d.pointerLockElement,d.getElementById('view'));
   w.narrative.show(['继续','Continue']);
   if(binding==='WheelUp')d.body.dispatchEvent(new h.window.WheelEvent('wheel',{deltaY:-120,bubbles:true,cancelable:true}));
   else if(binding==='Mouse3')d.body.dispatchEvent(new h.window.MouseEvent('mousedown',{button:3,bubbles:true,cancelable:true}));
   else d.body.dispatchEvent(new h.window.KeyboardEvent('keydown',{code:binding,bubbles:true,cancelable:true}));
   assert.equal(w.narrative.open,false,`${binding}: dialogue can resume after release`);
   d.exitPointerLock();
  }
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
