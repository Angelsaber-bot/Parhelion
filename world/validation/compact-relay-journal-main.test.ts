/** Production main/menu projection. Saved-fact fixtures isolate guidance; no GPU
 * or actual encounter victory is claimed by this test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {COMPACT_RELAY} from '../src/story/compactRelayCampaign';
test('actual main exposes early exercise and completed deployment without mutating original progress',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true}),w=h.world,d=h.window.document;let time=0;
 const frames=()=>{for(let i=0;i<15;i++)h.frame(time+=1000/60)};
 const enter=async()=>{(d.getElementById('start')as HTMLElement).click();await Promise.resolve();frames()};
 const open=()=>{if(d.pointerLockElement)d.exitPointerLock();(d.getElementById('world-quest-journal-open')as HTMLElement).click();return d.getElementById('world-quest-journal')!};
 try{
  await enter();const before=[...w.done],found=[...w.found];let panel=open();const button=panel.querySelector<HTMLButtonElement>('[data-quest-track="main:compact-relay"]')!;
  assert.ok(button);assert.equal(button.disabled,false);assert.match(button.closest('article')!.textContent!,/武器架/);assert.deepEqual([...w.done],before);assert.deepEqual([...w.found],found);
  button.click();await enter();assert.match(d.getElementById('world-tracked-story')!.textContent!,/武器架/);
  w.done.add('armory_rack');w.done.add('relay_b');frames();panel=open();const ready=panel.querySelector<HTMLButtonElement>('[data-quest-track="main:compact-relay"]')!;assert.match(ready.closest('article')!.textContent!,/庭院入口/);assert.equal(w.done.has(COMPACT_RELAY.complete),false,'old relay does not complete new exercise');
  ready.click();await enter();w.done.add(COMPACT_RELAY.complete);frames();panel=open();const earned=panel.querySelector<HTMLButtonElement>('[data-quest-track="main:compact-relay"]')!;assert.equal(earned.disabled,false);assert.equal(earned.textContent,'前往部署板');
  const language=d.querySelector<HTMLSelectElement>('#world-settings .parhelion-language select')!;language.value='en';language.dispatchEvent(new h.window.Event('change',{bubbles:true}));earned.click();assert.equal(panel.hidden,false,'stale locale button cannot pin');
  const current=panel.querySelector<HTMLButtonElement>('[data-quest-track="main:compact-relay"]')!;assert.equal(current.textContent,'Go to deployment board');current.click();await enter();assert.match(d.getElementById('world-tracked-story')!.textContent!,/deployment/i);
  assert.equal(w.done.has('relay_b'),true);assert.deepEqual([...w.found],found);assert.equal(w.compactRelayRuntime.active,false);assert.deepEqual(h.errors,[]);
 }finally{await h.close()}
});
