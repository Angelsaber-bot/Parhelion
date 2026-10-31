import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_EPISODES as D, CAMPAIGN_REGIONS as R, campaignEpisodeFlags as flags, chooseCampaignEpisode as choose, getCampaignEpisodeGuide as guide, getCampaignEpisodeJournal as journal, getCampaignEpisodeState as state, getCampaignEpisodeObjective as objective, interactCampaignEpisode as interact } from '../src/campaignEpisodes';
import { CAMPAIGN_WORK_TASKS as TASKS } from '../src/campaignWorkTasks';
import { WorldProgress, WORLD_PROGRESS_KEY, LEGACY_WORLD_PROGRESS_KEYS } from '../src/progress';
import { getEraBossRequirements, getEraStoryGuide, ERA_STORIES, ERA_IDS } from '../src/eraStories';
import type { RegionId } from '../src/settlements/types';
const correct = (r:RegionId,i:number) => TASKS[r][i].options.find(o=>o.correct)!.id;
function work(r:RegionId,done:Set<string>) {
 interact(D[r].npc,done);
 for(let i=0;i<2;i++) {
  const offered=interact(D[r].work,done);assert.equal(offered.changed,false);assert.deepEqual(offered.choices?.map(c=>c.id),TASKS[r][i].options.map(c=>c.id));
  assert.equal(choose(r,correct(r,i),done).changed,true);assert.equal(state(r,done).workProgress,i+1);
 }
}
test('unique physical IDs, two distinct outcomes and aligned bilingual authored copy',()=>{
 const ids=new Set<string>();
 for(const r of R){const d=D[r];for(const id of[d.npc,d.work,d.decision]){assert.ok(!ids.has(id));ids.add(id);}
 assert.equal(d.choices.length,2);assert.equal(new Set(d.choices.map(c=>c.id)).size,2);
 const pairs=[d.title,d.speaker,d.workLabel,d.decisionLabel,d.brief,d.working,d.worked,d.question,d.evidenceText,d.report,d.complete,...d.choices.flatMap(c=>[c.label,c.response,c.ending]),...TASKS[r].flatMap(s=>[s.prompt,s.success,...s.options.flatMap(o=>[o.label,o.feedback])])];
 for(const p of pairs){assert.equal(p.length,2);assert.ok(p[0].trim());assert.ok(p[1].trim());assert.equal(p[0].split('\n').length,p[1].split('\n').length);}
 for(const s of TASKS[r])assert.equal(s.options.filter(o=>o.correct).length,1);
 }
});
test('ten routes require deliberate work, choice, world evidence and spoken report; repeats grant nothing',()=>{
 for(const r of R)for(const choice of D[r].choices){const done=new Set<string>(),d=D[r],f=flags(r);
 assert.equal(state(r,done).stage,'briefing');for(const id of[d.work,d.decision])assert.equal(interact(id,done).changed,false);
 assert.equal(choose(r,choice.id,done).changed,false);assert.equal(done.size,0);
 work(r,done);assert.equal(state(r,done).stage,'decision');const before=[...done];
 for(let i=0;i<5;i++){assert.equal(interact(d.decision,done).changed,false);journal(done);guide(r,done);state(r,done);}assert.deepEqual([...done],before);
 assert.equal(choose(r,choice.id,done).changed,true);assert.equal(state(r,done).stage,'follow-through');assert.ok(done.has(f.choice(choice.id)));
 const chosen=[...done];for(const c of d.choices)assert.equal(choose(r,c.id,done).changed,false);assert.deepEqual([...done],chosen);
 assert.equal(interact(d.npc,done).changed,false);assert.ok([...done].every(id=>id.startsWith(`campaign_${r}_`)),'never invent old core, equipment or contract');
 d.evidence.forEach(id=>done.add(id));assert.equal(state(r,done).stage,'report');assert.equal(done.has(f.complete),false);
 const report=interact(d.npc,done);assert.equal(report.changed,true);assert.ok(report.dialogue?.[1].includes(choice.ending[1]));assert.equal(state(r,done).stage,'complete');assert.equal(guide(r,done),null);
 const completed=[...done];for(const id of[d.npc,d.work,d.decision])assert.equal(interact(id,done).changed,false);assert.deepEqual([...done],completed);
 }
});
test('wrong approaches stay safely retryable and stale stage confirmations cannot skip steps',()=>{
 for(const r of R){const done=new Set<string>();interact(D[r].npc,done);assert.equal(choose(r,correct(r,1),done).changed,false);
 for(let i=0;i<2;i++){const before=[...done];for(const wrong of TASKS[r][i].options.filter(o=>!o.correct)){const result=choose(r,wrong.id,done);assert.equal(result.changed,false);assert.ok(result.choices?.length);assert.ok(result.dialogue?.[1].includes(wrong.feedback[1]));assert.deepEqual([...done],before);}
 assert.equal(choose(r,correct(r,i),done).changed,true);assert.equal(choose(r,correct(r,i),done).changed,false);}
 }
});
test('old completed worlds still have fresh episodes, with no replay of old evidence required',()=>{
 for(const r of R){const d=D[r],snapshots=r==='alpha'?[['relay_a','relay_b']]:[[d.core!],...(r==='britain'?[]:[[ERA_STORIES[r].contract]])];
 for(const old of snapshots){const done=new Set(old);assert.equal(state(r,done).stage,'briefing');assert.equal(state(r,done).completed,false);assert.equal(state(r,done).evidenceReady,true);work(r,done);choose(r,d.choices[0].id,done);assert.equal(state(r,done).stage,'report');assert.equal(interact(d.npc,done).changed,true);old.forEach(id=>assert.ok(done.has(id)));}}
 assert.equal(state('britain',new Set(['saber_contract'])).evidenceReady,false);
});
test('every interrupted stage survives save/reload; reset invalidates choices and preserves no legacy progress',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 for(const r of R){values.clear();values.set(LEGACY_WORLD_PROGRESS_KEYS[0],JSON.stringify({done:['armory_rack'],found:['legacy_landmark']}));let p=new WorldProgress(storage);const d=D[r];const reload=()=>{assert.equal(p.save(),true);p=new WorldProgress(storage);};
 interact(d.npc,p.done);reload();assert.equal(state(r,p.done).stage,'work');for(let i=0;i<2;i++){choose(r,correct(r,i),p.done);reload();assert.equal(state(r,p.done).workProgress,i+1);}
 choose(r,d.choices[1].id,p.done);reload();assert.equal(state(r,p.done).choice,d.choices[1].id);d.evidence.forEach(id=>p.done.add(id));reload();assert.equal(state(r,p.done).stage,'report');interact(d.npc,p.done);reload();assert.equal(state(r,p.done).stage,'complete');assert.equal(p.armed,true);assert.ok(p.found.has('legacy_landmark'));assert.ok(values.has(WORLD_PROGRESS_KEY));
 p.reset();reload();assert.equal(state(r,p.done).stage,'briefing');assert.equal(p.armed,false);assert.equal(choose(r,d.choices[1].id,p.done).changed,false);
 }
});
test('unknown input and forged choice flags are harmless; original boss gate requirements remain unchanged',()=>{
 const done=new Set<string>(),baseline=ERA_IDS.map(r=>getEraBossRequirements(ERA_STORIES[r].core,done));
 for(const r of R){done.add(`campaign_${r}_choice_invalid`);assert.equal(state(r,done).choice,null);assert.equal(choose(r,'work_2_invalid',done).changed,false);assert.equal(choose(r,'__proto__',done).changed,false);}
 assert.equal(interact('unrelated_marker',done).handled,false);for(const r of['__proto__','constructor','','bad'])assert.equal(choose(r,'broadcast',done).handled,false);
 assert.deepEqual(ERA_IDS.map(r=>getEraBossRequirements(ERA_STORIES[r].core,done)),baseline);
});


test('tracked chronicle evidence follows real prerequisites rather than locked cores, with old Alpha partial saves respected',()=>{
 for(const r of R){const done=new Set<string>();work(r,done);choose(r,D[r].choices[0].id,done);
 const check=()=>{const hud=objective(r,done)!;assert.ok(hud.line[0].length<=65);assert.ok(hud.line[1].length<=100,hud.line[1]);};check();
 if(r!=='alpha'){for(const beat of ERA_STORIES[r].beats){assert.equal(guide(r,done)!.targetId,getEraStoryGuide(r,done)!.targetId);check();for(const flag of beat.flags){done.add(flag);check();}}}
 else{assert.equal(guide(r,done)!.targetId,'armory_rack');done.add('armory_rack');assert.equal(guide(r,done)!.targetId,'ruin_target_1');for(const flag of['ruin_target_1','ruin_target_2','ruin_target_3'])done.add(flag);assert.equal(guide(r,done)!.targetId,'relay_a');done.add('relay_a');done.delete('armory_rack');assert.equal(guide(r,done)!.targetId,'relay_b','never sends old repaired-relay saves back to new introductory chores');check();}
 D[r].evidence.forEach(id=>done.add(id));check();interact(D[r].npc,done);assert.equal(objective(r,done),null);
 }
 const done=new Set(R.map(r=>flags(r).complete));assert.ok(objective('alpha',done)?.line[1].includes('dispatch board'));
});
