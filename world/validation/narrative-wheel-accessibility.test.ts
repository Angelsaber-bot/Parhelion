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
