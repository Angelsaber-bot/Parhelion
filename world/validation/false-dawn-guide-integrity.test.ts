import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFalseDawnSites } from '../src/falseDawnSites';
import { regionAt } from '../src/regions';
import { FALSE_DAWN as F, chooseFalseDawn, confirmFalseDawnEncounterStart, getFalseDawnGuide, getFalseDawnObjective, getFalseDawnState, interactFalseDawn, recordFalseDawnEncounterVictory, type FalseDawnEncounterId } from '../src/falseDawnCampaign';
import { paginateDialogue } from '../src/narrativePanel';
import type { Localized } from '../src/settlements/types';

test('every reachable continuation guide resolves to its actual authored region/target, including canceled array retries',()=>{
 const targets=new Map<string,{region:string,kind:'marker'|'npc'}>();
 for(const region of['alpha','britain','blacksail','winter','kyoto']){const layout=JSON.parse(readFileSync(new URL(`../public/assets/world_${region}.layout.json`,import.meta.url),'utf8'));for(const marker of layout.markers)targets.set(marker.id,{region,kind:'marker'});}
 targets.set('alpha_signal_keeper',{region:'alpha',kind:'npc'});targets.set('campaign_alpha_work',{region:'alpha',kind:'marker'});
 const sites=createFalseDawnSites();for(const marker of sites.markers)targets.set(marker.id,{region:regionAt(marker.p[0],marker.p[2]).id,kind:'marker'});
 const seen=new Set<string>();
 const verify=(done:Set<string>,activeEncounter?:string)=>{const guide=getFalseDawnGuide(done,{activeEncounter});const objective=getFalseDawnObjective(done,activeEncounter);if(objective){assert.ok(objective.line[0].length<=60);assert.ok(objective.line[1].length<=100,objective.line[1]);assert.ok(objective.title[0]);assert.ok(objective.title[1]);}else assert.equal(getFalseDawnState(done).stage,'complete');seen.add(getFalseDawnState(done).stage);if(!guide){assert.equal(getFalseDawnState(done).stage,'complete');return;}const target=targets.get(guide.targetId);assert.ok(target,guide.targetId);assert.equal(target.region,guide.region,guide.targetId);assert.equal(target.kind,guide.targetKind);for(const text of[guide.title,guide.text]){assert.ok(text[0]);assert.ok(text[1]);}};
 const checked=(done:Set<string>,line:Localized|null)=>{verify(done);if(!line)return;const pages=paginateDialogue(line);for(const language of[0,1]as const)assert.equal(pages.map(page=>page[language]).join('\n'),line[language]);};
 try{for(const route of['harbor','winter']as const){const done=new Set<string>();verify(done);done.add('campaign_alpha_met');verify(done);done.add(F.receiver);verify(done);done.add('armory_rack');verify(done);
 const launch=(id:FalseDawnEncounterId,at:string)=>{checked(done,interactFalseDawn(at,done).dialogue);chooseFalseDawn(at,`start:${id}`,done);confirmFalseDawnEncounterStart(id,done);verify(done,id);recordFalseDawnEncounterVictory(id,done);verify(done);};
 launch('false_dawn_courier',F.recorder);checked(done,interactFalseDawn(F.recorder,done).dialogue);checked(done,chooseFalseDawn(F.recorder,`route_${route}`,done).dialogue);
 const station=route==='harbor'?F.harbor:F.winter;if(route==='harbor')launch('false_dawn_harbor',station);else{launch('false_dawn_winter_1',station);launch('false_dawn_winter_2',station);}
 checked(done,interactFalseDawn(station,done).dialogue);checked(done,chooseFalseDawn(station,'key_living',done).dialogue);
 confirmFalseDawnEncounterStart('false_dawn_array',done);verify(done);verify(done,'false_dawn_array');for(const emitter of F.emitters){interactFalseDawn(emitter,done,{activeEncounter:'false_dawn_array'});verify(done,'false_dawn_array');verify(done);}
 recordFalseDawnEncounterVictory('false_dawn_array',done);verify(done);launch('false_dawn_warden',F.array);checked(done,interactFalseDawn(F.array,done).dialogue);checked(done,chooseFalseDawn(F.array,'ending_repurpose',done).dialogue);
 }
 assert.deepEqual([...seen].sort(),['locked','equipment','lead','courier','route','harbor','harbor-key','winter-one','winter-two','winter-key','return','array','warden','ending','complete'].sort());
 }finally{sites.dispose();}
});
