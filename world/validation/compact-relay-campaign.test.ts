import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPACT_RELAY,getCompactRelayState as state,getCompactRelayGuide as guide,completeCompactRelay as complete,getCompactRelayIntro,getCompactRelayInterrupt} from '../src/compactRelayCampaign';
test('only equipment is required, old completion never grants the exercise reward',()=>{
 const done=new Set(['relay_b','world_epilogue_recorded','false_dawn_complete']);
 assert.equal(state(done).stage,'equipment');assert.equal(guide(done).targetId,'armory_rack');assert.equal(complete(done),false);
 done.add('armory_rack');assert.equal(state(done).stage,'ready');assert.equal(guide(done).targetId,COMPACT_RELAY.entry);
 const before=[...done];assert.equal(complete(done),true);assert.equal(complete(done),false);assert.deepEqual([...done],[...before,COMPACT_RELAY.complete]);
});
test('session channel is bounded, never persisted, and completed replays remain active',()=>{
 const done=new Set(['armory_rack']);assert.equal(state(done,{active:true}).stage,'active');
 assert.equal(state(done,{active:true,progress:1.5}).stage,'channel');assert.equal(state(done,{active:true,progress:99}).progress,3);
 for(const progress of [NaN,Infinity,-1])assert.equal(state(done,{active:true,progress}).progress,0);
 assert.equal(state(done,{active:false,progress:3}).stage,'ready');assert.equal(done.size,1);
 complete(done);const loaded=new Set(JSON.parse(JSON.stringify([...done])) as string[]);
 assert.equal(state(loaded).stage,'complete');assert.equal(guide(loaded).targetId,COMPACT_RELAY.deployment);
 assert.equal(state(loaded,{active:true}).stage,'active');assert.equal(state(loaded,{active:true}).complete,true);
 assert.equal(guide(loaded,{active:true,progress:2}).targetId,COMPACT_RELAY.controller);assert.equal(complete(loaded),false);
});
test('both locales explain real channel, optional clear, retry and non-progress-skipping reward',()=>{
 const intro=getCompactRelayIntro(new Set(['armory_rack']));assert.match(intro[0],/3 秒/);assert.match(intro[1],/full clear is optional/);assert.match(intro[1],/does not activate Relay B/);
 for(const reason of ['released','movement','hurt','attack','unavailable','out-of-range']){const text=getCompactRelayInterrupt(reason);assert.ok(text[0]);assert.ok(text[1]);assert.doesNotMatch(text[1],/[\u3400-\u9fff]/);assert.deepEqual(guide(new Set(['armory_rack']),{active:true,lastInterrupt:reason}).text,text);}
 assert.match(getCompactRelayIntro(new Set([COMPACT_RELAY.complete]))[1],/does not grant another reward/);
});
