import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WorldProgress, WORLD_PROGRESS_KEY, LEGACY_WORLD_PROGRESS_KEYS, type ProgressStorage } from '../src/progress.ts';
import { VALLEY_STORY as V, getValleyStoryState, getValleyStoryGuide, interactValleyStory } from '../src/valleyStory.ts';
class Storage implements ProgressStorage {
 values=new Map<string,string>(); getItem(k:string){return this.values.get(k)??null;} setItem(k:string,v:string){this.values.set(k,v);} removeItem(k:string){this.values.delete(k);}
}
const layout=JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json',import.meta.url),'utf8'));
test('Valley save/reload retains every stage, discovery and original equipment authority',()=>{
 const s=new Storage();let p=new WorldProgress(s);const reload=()=>{p.save();p=new WorldProgress(s);};
 assert.equal(getValleyStoryState(p.done).stage,'meet');assert.equal(getValleyStoryState(p.done).shortcutOpen,false);
 interactValleyStory(V.npc,p.done);reload();assert.equal(getValleyStoryState(p.done).stage,'restore');assert.equal(getValleyStoryState(p.done).shortcutOpen,true);assert.equal(p.armed,false);
 interactValleyStory(V.discovery,p.done);reload();assert.equal(getValleyStoryState(p.done).discovered,true);assert.equal(getValleyStoryState(p.done).stage,'restore');
 p.done.add(V.terminal);reload();assert.equal(getValleyStoryState(p.done).stage,'report');assert.equal(getValleyStoryState(p.done).powered,true);
 interactValleyStory(V.npc,p.done);reload();assert.equal(getValleyStoryState(p.done).stage,'complete');assert.equal(getValleyStoryGuide(p.done),null);assert.equal(p.armed,false);
 p.done.add('armory_rack');reload();assert.equal(p.armed,true);
});
test('Valley reset survives reload without resurrection or preference loss',()=>{
 const s=new Storage();s.setItem('parhelion.settings','keep');const p=new WorldProgress(s);
 for(const id of [V.met,V.resolved,V.discovery,V.terminal,'armory_rack'])p.done.add(id);p.found.add('side_landmark');p.save();
 for(const k of LEGACY_WORLD_PROGRESS_KEYS)s.setItem(k,JSON.stringify({done:[V.resolved,'armory_rack'],found:['old']}));
 p.reset();const fresh=new WorldProgress(s);assert.equal(getValleyStoryState(fresh.done).stage,'meet');assert.equal(getValleyStoryState(fresh.done).shortcutOpen,false);assert.equal(getValleyStoryState(fresh.done).powered,false);assert.equal(getValleyStoryState(fresh.done).discovered,false);assert.equal(fresh.armed,false);assert.equal(fresh.found.size,0);assert.equal(fresh.done.size,0);assert.equal(s.getItem('parhelion.settings'),'keep');
});
test('advanced legacy progress never regresses or invents power/equipment',()=>{
 for(const flag of ['armory_rack','relay_b','tower_console','summon_circle']){
  const s=new Storage();s.setItem(LEGACY_WORLD_PROGRESS_KEYS[0],JSON.stringify({done:[flag],found:['old_landmark']}));const p=new WorldProgress(s),before=[...p.done];
  assert.equal(getValleyStoryState(p.done).stage,'complete');assert.equal(getValleyStoryGuide(p.done),null);assert.equal(getValleyStoryState(p.done).powered,false);assert.equal(p.armed,flag==='armory_rack');
  assert.equal(interactValleyStory(V.npc,p.done).changed,false);assert.deepEqual([...p.done],before);assert.equal(p.found.has('old_landmark'),true);assert.notEqual(s.getItem(WORLD_PROGRESS_KEY),null);assert.equal(getValleyStoryState(new WorldProgress(s).done).stage,'complete');
 }
});
test('original nine-step Alpha mainline never requires optional story flags',()=>{
 assert.equal(layout.objective.steps.length,9);const extras=new Set<string>([V.met,V.resolved,V.discovery]);
 for(const step of layout.objective.steps)for(const id of step.done)assert.equal(extras.has(id),false);
 for(const marker of layout.markers)for(const id of marker.requires??[])assert.equal(extras.has(id),false);
 const p=new WorldProgress();for(const step of layout.objective.steps)for(const id of step.done)p.done.add(id);
 assert.equal(getValleyStoryState(p.done).stage,'complete');assert.equal(p.done.has(V.discovery),false);assert.equal(layout.markers.find((m:any)=>m.id===V.terminal)?.type,'interact');
});
test('guide/state evaluation has no silent save or completion mutation',()=>{
 const s=new Storage(),p=new WorldProgress(s);for(let i=0;i<100;i++){getValleyStoryState(p.done);getValleyStoryGuide(p.done);}assert.equal(p.done.size,0);assert.equal(s.values.size,0);
});
