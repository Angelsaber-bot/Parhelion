import test from 'node:test';
import assert from 'node:assert/strict';
import { PARALLAX as P, canRecordView, recordParallaxView, concludeParallax, parallaxGuide, type SurveyFrame } from '../src/story/parallaxSurvey';
import { createParallaxGarden } from '../src/environment/parallaxGarden';
import { createQuestGuideCatalog } from '../src/story/questGuideCatalog';
const station = [0, 10, 0] as const, subject = [0, 12, -15] as const;
const frame: SurveyFrame = { feet: station, eye: [0, 12, 3], direction: [0, 0, -1], grounded: true, playable: true, clear: true };
test('observation requires ground position, sightline, orientation and finite inputs', () => {
 assert.equal(canRecordView(frame,station,subject),true);
 for(const change of [{grounded:false},{playable:false},{clear:false},{feet:[0,12,0]},{feet:[4,10,0]},{direction:[0,0,1]},{direction:[0,0,0]},{eye:[NaN,12,3]}])assert.equal(canRecordView({...frame,...change} as SurveyFrame,station,subject),false,JSON.stringify(change));
});
test('two genuine observations and explicit interpretation are required; retries preserve progress',()=>{
 const done=new Set<string>(['armory_rack']);assert.equal(recordParallaxView(P.front,done,frame,station,subject),false);done.add(P.started);assert.equal(concludeParallax('perspective',done),false);
 assert.equal(recordParallaxView(P.side,done,frame,station,subject),true);assert.equal(parallaxGuide(done)?.targetId,P.front);
 assert.equal(recordParallaxView(P.front,done,{...frame,clear:false},station,subject),false);assert.equal(recordParallaxView(P.front,done,frame,station,subject),true);assert.equal(recordParallaxView(P.front,done,frame,station,subject),false);
 assert.equal(parallaxGuide(done)?.targetId,P.board);assert.equal(concludeParallax('vanished',done),false);assert.equal(concludeParallax('later',done),false);
 const restored=new Set(JSON.parse(JSON.stringify([...done])) as string[]);assert.equal(concludeParallax('perspective',restored),true);assert.equal(concludeParallax('perspective',restored),false);assert.equal(parallaxGuide(restored),null);assert.deepEqual([...restored].filter(id=>!id.startsWith('parallax_')),['armory_rack']);
});
test('optional survey catalog has real bilingual targets and follows saved progress',()=>{
 const garden=createParallaxGarden(()=>10);
 try{const catalog=createQuestGuideCatalog({markers:garden.markers,objectives:[],npcs:[]}),done=new Set<string>();
 for(const [flag,target] of [[null,P.board],[P.started,P.front],[P.front,P.side],[P.side,P.board]] as const){if(flag)done.add(flag);const entry=catalog.list(done,new Set()).find(e=>e.id===P.quest)!;assert.equal(entry.category,'side');assert.equal(entry.guide?.targetId,target);assert.doesNotMatch(entry.guide!.targetLabel[1],/[\u3400-\u9fff]/);assert.ok(entry.guide!.position.every(Number.isFinite));}
 done.add(P.complete);assert.equal(catalog.resolve(P.quest,done,new Set()),null);assert.equal(catalog.list(done,new Set()).find(e=>e.id===P.quest)?.complete,true);
 garden.apply(done);assert.equal(garden.root.getObjectByName('Campaign_alpha_resolved')!.visible,true);garden.apply(new Set());assert.equal(garden.root.getObjectByName('Campaign_alpha_resolved')!.visible,false);
 }finally{garden.dispose();garden.dispose();}
});
