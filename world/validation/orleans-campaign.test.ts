import {createRealmClimax} from '../src/story/realmClimaxes';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrleansCampaign, ORLEANS_CAMPAIGN as C, orleansCampaignReady,orleansCampaignGuide} from '../src/story/orleansCampaign';
function setup(flags:string[]=[]){const done=new Set(['journey_orleans_muster',...flags]);let saved=true,active:string|null=null;
 const runtime=createOrleansCampaign({done,save:()=>saved,changed(){},toast(){},reachable:()=>true,position:()=>[0,.9,0],encounter:()=>active,start:spec=>{active=spec.id;return true;}});
 return{done,runtime,failSave(){saved=false;},win(){assert.ok(active);runtime.victory(active);active=null;},tick(n:number,playing=true){for(let i=0;i<n*10+1;i++)runtime.update(.1,playing,true);}};
}
test('persistent relay survives departure; builders wait for an actual scout victory and save ramp checkpoints',()=>{
 const s=setup();s.runtime.interact(C.started);s.runtime.interact(C.relay);s.tick(20);assert.ok(!s.done.has(C.ramp));
 s.runtime.victory('orleans_main_scout');assert.ok(!s.done.has(C.scout));
 s.runtime.interact(C.scout);s.win();s.tick(6);assert.ok(s.done.has(C.ramp+'_1'));assert.ok(!s.done.has(C.ramp));
 const resumed=setup([...s.done]);resumed.tick(20);assert.ok(resumed.done.has(C.ramp));assert.ok(resumed.done.has(C.relay));
});
test('team identity requires all three silhouettes; an unchosen appearance cannot silently become the selected flag',()=>{
 const s=setup([C.lookout]);s.runtime.interact(C.stitch);s.runtime.interact(C.swallow);s.runtime.interact(C.bars);
 assert.ok(!s.done.has(C.swallow)&&s.done.has(C.bars));assert.ok(!orleansCampaignReady(C.test,s.done));
 for(const f of [C.boat,C.builder,C.archer])s.runtime.interact(f);s.runtime.interact(C.test);assert.ok(s.done.has(C.test));
});
test('cannon interception and engineer rescue are independent and both can be earned',()=>{
 const s=setup([C.lookout]);s.runtime.interact(C.cannon);s.win();assert.ok(!s.done.has(C.engineers));s.runtime.interact(C.engineers);s.win();assert.ok(s.done.has(C.cannon)&&s.done.has(C.engineers));
});
test('pre-agreed teams execute in order without repeated orders; paused play does not build',()=>{
 const s=setup([C.camp]);s.runtime.interact(C.agree);s.runtime.hit(C.screen);s.tick(60,false);assert.ok(!s.done.has(C.planks));
 s.tick(14);assert.ok(s.done.has(C.planks));assert.ok(!s.done.has(C.shifted));s.tick(20);assert.ok(s.done.has(C.moored)&&s.done.has(C.shifted));
});
test('one beam changes plans before assembly, locks after confirmation, and requires a physical crossing',()=>{
 const s=setup([C.shifted]);for(const f of [C.model,C.bridge,C.ferry,C.locked])s.runtime.interact(f);
 assert.ok(s.done.has(C.ferry)&&!s.done.has(C.bridge));s.runtime.interact(C.bridge);assert.ok(!s.done.has(C.bridge));
 s.tick(20);assert.ok(s.done.has(C.assembled)&&!s.done.has(C.complete));s.runtime.interact(C.trial);assert.ok(s.done.has(C.complete));
});
test('save failure restores the previous choice and cannot leave a partial lock',()=>{
 const s=setup([C.model,C.bridge]);s.failSave();s.runtime.interact(C.ferry);assert.ok(s.done.has(C.bridge)&&!s.done.has(C.ferry));s.runtime.interact(C.locked);assert.ok(!s.done.has(C.locked));
});

test('intercepted cannon removes the second crossing lane while the independent engineer result accelerates assembly',()=>{
 for(const intercepted of [false,true]){
  const d=new Set(['realm_orleans_phase_1',...(intercepted?[C.cannon]:[])]);
  const battle=createRealmClimax('orleans',{x:0,y:0,z:0},{done:d,save(){},hurt(){},warn(){}});battle.start();
  for(let i=0;i<30;i++)battle.update(.08,{x:0,y:0,z:8});
  assert.equal(battle.tell?.shape,intercepted?'line':'cross');
 }
 const saved=setup([C.locked,C.engineers]),lost=setup([C.locked]);saved.tick(9);lost.tick(9);
 assert.ok(saved.done.has(C.assembled));assert.ok(!lost.done.has(C.assembled));
});

test('guidance advances beyond mutually exclusive choices',()=>{
 const base=['journey_orleans_muster',C.started,C.relay,C.scout,C.ramp,C.lookout,C.stitch];
 for(const style of [C.swallow,C.bars])assert.equal(orleansCampaignGuide(new Set([...base,style]))?.id,C.boat);
 const preceding=[...base,C.bars,C.boat,C.builder,C.archer,C.test,C.inspect,C.flank,C.retreat,C.cover,C.camp,C.agree,C.screen,C.planks,C.moored,C.shifted,C.model];
 for(const plan of [C.bridge,C.ferry])assert.equal(orleansCampaignGuide(new Set([...preceding,plan]))?.id,C.locked);
});
