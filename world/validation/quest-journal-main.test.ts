/** Actual main event/UI path with explicit non-GPU renderer. Synthetic progress
 * fixtures isolate menu transitions; this is not a traversal or combat playthrough. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';

test('actual main quest browser only pins deliberately, advances saved steps, and preserves modal/locale/remap gates',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true}),w=h.world,d=h.window.document;let time=0;
 const frame=()=>h.frame(time+=1000/60),frames=()=>{for(let i=0;i<15;i++)frame()};
 const key=(code:string,key=code)=>{d.body.dispatchEvent(new h.window.KeyboardEvent('keydown',{code,key,bubbles:true,cancelable:true}));d.body.dispatchEvent(new h.window.KeyboardEvent('keyup',{code,key,bubbles:true}));};
 const enter=async()=>{(d.getElementById('start')as HTMLElement).click();await Promise.resolve()};
 const open=()=>{if(d.pointerLockElement)d.exitPointerLock();const opener=d.getElementById('world-quest-journal-open')as HTMLElement;opener.focus();opener.click();return d.getElementById('world-quest-journal')!};
 try{
  await enter();frames();const before=[...w.done],found=[...w.found],position=w.player.pos.clone();
  const panel=open();assert.equal(panel.hidden,false);assert.equal(d.pointerLockElement,null);assert.equal(d.getElementById('world-tracked-story'),null,'opening is not tracking');
  for(const code of ['KeyW','KeyQ','KeyX','KeyB','Digit1'])key(code);frames();assert.deepEqual([...w.done],before);assert.deepEqual([...w.found],found);assert.equal(w.player.pos.x,position.x);assert.equal(w.player.pos.z,position.z);
  const select=panel.querySelector('select')!;select.value='all';select.dispatchEvent(new h.window.Event('change'));
  assert.equal(panel.querySelector<HTMLButtonElement>('[data-quest-track="main:winter"]')!.disabled,true,'closed seam has no remote pin bypass');
  const first=panel.querySelector<HTMLButtonElement>('[data-quest-track="main:alpha"]')!;first.focus();
  const language=d.querySelector<HTMLSelectElement>('#world-settings .parhelion-language select')!;language.value='en';language.dispatchEvent(new h.window.Event('change',{bubbles:true}));
  assert.equal((d.activeElement as HTMLElement).dataset.questTrack,'main:alpha');first.click();assert.equal(panel.hidden,false,'detached pre-locale button cannot pin');
  panel.querySelector<HTMLButtonElement>('[data-quest-track="main:alpha"]')!.click();assert.equal(panel.hidden,true);await enter();frames();assert.match(d.getElementById('world-tracked-story')!.textContent!,/archivist/i);
  // Test-only saved-fact changes verify the runtime's actual guide projection.
  for(const id of ['valley_story_met','valley_story_resolved','hq_terminal','armory_rack'])w.done.add(id);frames();assert.match(d.getElementById('world-tracked-story')!.textContent!,/practice targets|firing range/i);
  w.done.add('range_target_1');frames();const next=open().querySelector('[data-quest-id="main:alpha"] .quest-target')!;assert.match(next.textContent!,/Practice target 2/);
  key('Escape','Escape');assert.equal(panel.hidden,true);assert.equal(d.activeElement,d.getElementById('world-quest-journal-open'),`actual focus ${d.activeElement?.outerHTML}; opener ${d.getElementById('world-quest-journal-open')?.outerHTML}`);
  assert.equal(w.settings.bind('mainRoute','KeyL',true),null);await enter();key('KeyL');frames();assert.equal(d.getElementById('world-tracked-story'),null,'configured return key clears explicit quest pin');
  open();const category=panel.querySelectorAll('select')[1];category.value='discovery';category.dispatchEvent(new h.window.Event('change'));
  const discovery=panel.querySelector<HTMLButtonElement>('[data-quest-track^="discovery:"]')!,discoveryId=discovery.dataset.questTrack!.slice('discovery:'.length);
  discovery.click();await enter();frames();assert.ok(d.getElementById('world-tracked-story'));
  w.found.add(discoveryId);frames();assert.equal(d.getElementById('world-tracked-story'),null,'real found-state completion releases the finished instruction');
  open();const link=[...panel.querySelectorAll<HTMLButtonElement>('button')].find(b=>/Five resident/.test(b.textContent!))!;link.click();assert.equal(panel.hidden,true);assert.equal(w.campaignJournal.open,true);key('Escape','Escape');
  open();const categories=panel.querySelectorAll('select')[1];categories.value='main';categories.dispatchEvent(new h.window.Event('change'));
  panel.querySelector<HTMLButtonElement>('[data-quest-track="main:alpha"]')!.click();await enter();frames();assert.ok(d.getElementById('world-tracked-story'));
  assert.equal(w.settings.bind('reset','KeyK',true),null);h.window.confirm=()=>false;key('KeyK');assert.equal(w.done.has('armory_rack'),true,'canceling reset preserves actual progress');
  await enter();h.window.confirm=()=>true;key('KeyK');frames();assert.equal(w.done.has('armory_rack'),false);assert.equal(d.getElementById('world-tracked-story'),null,'confirmed reset clears old explicit quest pin');
  d.getElementById('view')!.dispatchEvent(new h.window.Event('webglcontextlost',{cancelable:true}));open();assert.equal(panel.hidden,true,'lost graphics cannot open another gameplay modal');
  assert.deepEqual(h.errors,[]);
 }finally{await h.close()}
});
