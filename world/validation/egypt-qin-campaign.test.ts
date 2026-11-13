import {qinChapterGuide} from '../src/story/qinCampaign';
import test from 'node:test';import assert from 'node:assert/strict';
import {EGYPT_CAMPAIGN as E,commitEgyptChapter,egyptChapterReady} from '../src/story/egyptCampaign';
import {QIN_CAMPAIGN as Q,commitQinChapter,qinTallyBorrowed,createQinCrewTransit} from '../src/story/qinCampaign';
import {egyptWaterFlag} from '../src/story/egyptWaterPlan';
test('Egypt trial admits three independent solutions but forbids a brake release before bypass proof',()=>{
 for(const solution of [E.side,E.armor,E.steady]){
  const d=new Set(['journey_egypt_weir',egyptWaterFlag('eastBridge')]);
  for(const f of [E.started,E.limb,E.temple,E.bed,E.relocated,E.trial])assert.ok(commitEgyptChapter(f,d));
  assert.ok(!commitEgyptChapter(E.forebay,d));assert.ok(!commitEgyptChapter(E.brake,d));
  assert.ok(commitEgyptChapter(solution,d));for(const f of [E.forebay,E.bypass,E.brake,E.bell])assert.ok(commitEgyptChapter(f,d));assert.ok(d.has(E.ready));
 }
});
test('Egypt local ending requires actual battle completion, sky bypass, and the selected bank interaction',()=>{
 for(const option of ['westBridge','eastBaffle'] as const){const d=new Set([E.bypass,egyptWaterFlag(option)]);
 assert.ok(!commitEgyptChapter(E.drained,d));d.add('realm_egypt_phase_3');assert.ok(commitEgyptChapter(E.drained,d));
 const id=option==='westBridge'?E.moored:E.irrigation;assert.equal(egyptChapterReady(id===E.moored?E.irrigation:E.moored,d),false);
 assert.ok(!commitEgyptChapter(E.meal,d));assert.ok(commitEgyptChapter(id,d));assert.ok(commitEgyptChapter(E.meal,d));assert.ok(d.has(E.complete));}
});
test('Qin shield plan changes before departure, persists after lock, and never grants independent authority',()=>{
 const d=new Set(['journey_qin_workers']);for(const f of [Q.started,Q.guard,Q.take,Q.locked])assert.ok(commitQinChapter(f,d));
 assert.ok(!d.has(Q.guard));assert.ok(!commitQinChapter(Q.guard,d));assert.ok(!d.has('journey_qin_public_order'));
 for(const f of [Q.observe,Q.halt,Q.loan,Q.road])assert.ok(commitQinChapter(f,d));assert.ok(qinTallyBorrowed(d));
 const transit=createQinCrewTransit(d,()=>true,()=>{});for(let i=0;i<600;i++)transit.update(.1,false);assert.equal(transit.progress(),0);
 for(let i=0;i<500;i++)transit.update(.1,true);assert.ok(d.has(Q.arrived));assert.ok(commitQinChapter(Q.returned,d));assert.ok(!qinTallyBorrowed(d));assert.ok(d.has(Q.complete));
});
test('Qin failed transit checkpoint never claims an arrival and reload retains only committed segments',()=>{
 const d=new Set([Q.loan,Q.road]);const failed=createQinCrewTransit(d,()=>false,()=>{});for(let i=0;i<500;i++)failed.update(.1,true);assert.ok(!d.has(Q.arrived));assert.ok(!d.has(Q.arrived+'_1'));
 d.add(Q.arrived+'_1');d.add(Q.arrived+'_2');const resumed=createQinCrewTransit(d,()=>true,()=>{});assert.equal(resumed.progress(),.4);
});

test('Qin guidance advances to departure after either shield choice instead of alternating choices',()=>{
 for(const choice of [Q.guard,Q.take])assert.equal(qinChapterGuide(new Set(['journey_qin_workers',Q.started,choice]))?.id,Q.locked);
});
