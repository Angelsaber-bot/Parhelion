import test from 'node:test';
import assert from 'node:assert/strict';
import {JOURNEY_DRAMA as D,JOURNEY_CAST,JOURNEY_REGIONS,journeyScene,confirmJourneyScene,dramaDecision,journeyEnding,journeyRevisit} from '../src/story/journeyDrama';
import {getCurrentAdventureGuide} from '../src/story/openWorldCampaign';
import {createSettlementNpcs} from '../src/settlements/npcs';
import * as THREE from 'three';
const facts=()=>new Set<string>(['adventure_v2',D.started]);
test('legacy journeys stay intact; opening and cancel do not fabricate equipment, transport or reports',()=>{
 assert.equal(journeyScene(JOURNEY_CAST.alpha.npc,new Set(['adventure_v2'])),null);
 const done=facts(),before=[...done],scene=journeyScene(JOURNEY_CAST.alpha.npc,done)!;assert.equal(scene.beat,'opening');assert.deepEqual([...done],before);
 assert.equal(confirmJourneyScene(scene,'later',done),false);assert.deepEqual([...done],before);
 assert.equal(confirmJourneyScene(scene,'accept',done),true);assert.equal(confirmJourneyScene(scene,'accept',done),false);
 assert.equal(done.has('armory_rack'),false);assert.equal(done.has('campaign_alpha_worked'),false);
});
test('four distinct reports require actual rescue, departure, arrival and recovered evidence',()=>{
 const done=facts();done.add(D.opening);
 const proofs={britain:['sun_core','kingdom_gate_rescued'],blacksail:['adventure_harbor_departed'],winter:['adventure_winter_arrived'],kyoto:['adventure_kyoto_evidence','fire_core']};
 for(const region of JOURNEY_REGIONS){
  const scene=journeyScene(JOURNEY_CAST[region].npc,done)!;assert.equal(scene.beat,'brief');confirmJourneyScene(scene,'accept',done);
  assert.equal(journeyScene(JOURNEY_CAST[region].npc,done),null);for(const f of proofs[region])done.add(f);
  const report=journeyScene(JOURNEY_CAST[region].npc,done)!;assert.equal(report.beat,'report');assert.equal(confirmJourneyScene(report,'accept',done),true);assert.equal(confirmJourneyScene(report,'accept',done),false);
 }
 assert.equal(journeyScene(JOURNEY_CAST.alpha.npc,done)!.beat,'confession');assert.equal(done.has('adventure_guardian_cleared'),false);
});
test('ending requires confession, four reports, physical escape and one explicit durable choice',()=>{
 const done=facts();done.add(D.opening);done.add(D.confession);
 for(const region of JOURNEY_REGIONS)done.add(D.report(region));
 assert.notEqual(journeyScene(JOURNEY_CAST.alpha.npc,done)!.beat,'decision');done.add('adventure_escaped');
 const scene=journeyScene(JOURNEY_CAST.alpha.npc,done)!;assert.equal(scene.beat,'decision');assert.equal(dramaDecision(done),null);
 assert.equal(confirmJourneyScene(scene,'forged',done),false);assert.equal(confirmJourneyScene(scene,'open',done),true);assert.equal(confirmJourneyScene(scene,'watch',done),false);
 assert.equal(dramaDecision(done),'open');assert.equal(done.has('adventure_tomorrow'),false);
 const other=new Set([...done].filter(f=>!f.startsWith(D.decision)));other.add(D.decision+'watch');assert.notDeepEqual(journeyEnding(done),journeyEnding(other));assert.notDeepEqual(journeyRevisit('alpha',done),journeyRevisit('alpha',other));
});
test('NPC guidance resolves actual actors and prioritizes a confession rather than an already finished core',()=>{
 const done=facts();assert.equal(getCurrentAdventureGuide('alpha',done)!.targetKind,'npc');assert.equal(getCurrentAdventureGuide('alpha',done)!.targetId,JOURNEY_CAST.alpha.npc);
 done.add(D.opening);done.add(D.report('britain'));done.add(D.report('winter'));
 assert.equal(getCurrentAdventureGuide('alpha',done)!.targetId,JOURNEY_CAST.alpha.npc);
});
test('legacy cleared cores still guide unfinished human rescues instead of silently completing them',()=>{
 const done=facts();done.add(D.opening);done.add(D.brief('britain'));done.add('sun_core');
 const guide=getCurrentAdventureGuide('britain',done)!;assert.ok(guide.targetId.startsWith('kingdom_gate_'));assert.equal(done.has(D.report('britain')),false);
 done.add(D.brief('blacksail'));done.add('sea_core');assert.notEqual(getCurrentAdventureGuide('blacksail',done)!.targetId,'blackbeard_meet');
});
test('a legacy Kyoto pact can report recovered evidence and unlock the finale without fabricated core flags',()=>{
 const done=facts();
 for(const flag of [D.opening,D.confession,'armory_rack','compact_relay_complete','saber_contract','sun_core','kingdom_gate_rescued','blackbeard_contract','adventure_harbor_departed','napoleon_contract','adventure_winter_arrived','musashi_contract'])done.add(flag);
 for(const region of JOURNEY_REGIONS){done.add(D.brief(region));if(region!=='kyoto')done.add(D.report(region));}
 assert.equal(getCurrentAdventureGuide('kyoto',done)?.targetId,'adventure_kyoto_evidence');
 assert.equal(journeyScene(JOURNEY_CAST.kyoto.npc,done),null);
 done.add('adventure_kyoto_evidence');
 assert.equal(getCurrentAdventureGuide('alpha',done)?.targetId,JOURNEY_CAST.kyoto.npc);
 const report=journeyScene(JOURNEY_CAST.kyoto.npc,done)!;
 assert.equal(report.beat,'report');assert.equal(confirmJourneyScene(report,'accept',done),true);
 assert.equal(getCurrentAdventureGuide('alpha',done)?.targetId,'adventure_emitter_1');
 assert.equal(done.has('fire_core'),false);
 for(const flag of ['kikyo_banner_1','kikyo_banner_2','kikyo_banner_3'])assert.equal(done.has(flag),false);
});
test('portrait speech uses stable, bounded morph buffers and releases owned geometry',()=>{
 const system=createSettlementNpcs([{id:JOURNEY_CAST.alpha.npc,region:'alpha',role:JOURNEY_CAST.alpha.name,position:[0,0,0],lines:[['你好','Hello']]}]);
 const head=system.group.getObjectByName('ResidentFaceAndHair') as THREE.Mesh,geometry=head.geometry;assert.equal(geometry.morphAttributes.position.length,2);
 system.setSpeaking(JOURNEY_CAST.alpha.npc);for(let i=0;i<90;i++)system.update(1/60,new THREE.Vector3(0,0,2));assert.ok(head.morphTargetInfluences![0]>.1);
 system.setSpeaking(null);for(let i=0;i<90;i++)system.update(1/60,new THREE.Vector3(0,0,2));assert.ok(head.morphTargetInfluences![0]<.001);assert.equal(head.geometry,geometry);system.dispose();
});
