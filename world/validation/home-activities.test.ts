import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import * as THREE from 'three';
import {createHomeActivities,type HomeActivityFrame} from '../src/story/homeActivities';
import {HOME_CIVIC,HOME_CIVIC_ACTIONS,homeCivicGuide} from '../src/map/homeActivities';
import {createQuestGuideCatalog} from '../src/story/questGuideCatalog';
import {discoverTravelStops,getTravelBlock,type SafeTravelStop,type TravelContext} from '../src/story/safeTravel';

function fixture(done=new Set<string>()){
 const dom=new JSDOM('<body></body>'),before=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});
 let frame:HomeActivityFrame={held:false,moving:false,attacking:false,grounded:true,damage:0},safe=true,reachable=true,saveCount=0,refills=0;
 let callback:((value:string)=>void)|undefined;
 const dialogue={show(){},showChoices(_line:unknown,_speaker:unknown,_items:unknown,fn:(value:string)=>void){callback=fn;}};
 const scene=new THREE.Scene(),w=createHomeActivities({scene,done,dialogue:dialogue as any,save:()=>{saveCount++;},changed(){},canInteract:()=>reachable,safe:()=>safe,rest:()=>true,refill:()=>++refills,toast(){},prepareDialogue:()=>w.interrupt(),input:()=>frame});
 const player=new THREE.Vector3(973,6.1,126);
 const tick=(n=1,playable=true)=>{for(let i=0;i<n;i++)w.update(.05,player,playable);};
 return{w,done,scene,player,tick,choose:(value:string)=>callback?.(value),patch:(patch:Partial<HomeActivityFrame>)=>Object.assign(frame,patch),reach:(value:boolean)=>reachable=value,safe:(value:boolean)=>safe=value,saveCount:()=>saveCount,refills:()=>refills,
 close(){w.dispose();dom.window.close();if(before)Object.defineProperty(globalThis,'document',before);else Reflect.deleteProperty(globalThis,'document');}};
}
test('real held works move the boat and collision, persist scene changes, require release and cancel invalid finishes',()=>{
 const f=fixture();try{
  const boat=f.w.root.getObjectByName('HomeHaulBoat')!,before=boat.position.clone();
  f.patch({held:true});assert.equal(f.w.interact('home_winch'),true);f.tick(150);assert.equal(f.w.progress,0,'initial held key cannot complete operation');
  f.patch({held:false});f.tick();f.patch({held:true});f.w.interact('home_winch');f.tick(40);assert.ok(boat.position.distanceTo(before)>2);assert.ok(!f.done.has(HOME_CIVIC.boat));
  f.patch({moving:true});f.tick();assert.equal(f.w.active,null);assert.deepEqual(boat.position.toArray(),before.toArray(),'cancel restores initial physical pose');
  f.patch({moving:false,held:false});f.w.interact('home_winch');f.tick();f.patch({held:true});f.tick(110);assert.ok(f.done.has(HOME_CIVIC.boat));assert.deepEqual(boat.position.toArray(),[985,6.8,143]);
  const box=f.w.colliders[0].bvh.getBoundingBox(new THREE.Box3());assert.ok(box.containsPoint(boat.position),'collision follows the real delivered hull');
  for(const id of['home_lighthouse','home_water']){f.patch({held:false});f.w.interact(id);f.tick();f.patch({held:true});f.tick(70);assert.equal(f.w.active,null);}
  assert.ok(f.done.has(HOME_CIVIC.light)&&f.done.has(HOME_CIVIC.garden));assert.equal(f.w.root.getObjectByName('HomeWateredFlowers')!.visible,true);
  const json=JSON.stringify([...f.done]);f.w.interrupt();f.done.clear();f.w.apply();assert.equal(f.w.root.getObjectByName('HomeWateredFlowers')!.visible,false);for(const flag of JSON.parse(json))f.done.add(flag);f.w.apply();assert.deepEqual(boat.position.toArray(),[985,6.8,143]);
 }finally{f.close();}
});
test('a real bread carry is required and interruptions cannot grant delivery or town report',()=>{
 const f=fixture();try{
  f.w.interact('home_bread_drop');assert.equal(f.done.has(HOME_CIVIC.bread),false);
  f.w.interact('home_bread_pickup');assert.equal(f.w.carrying,true);f.tick(1,false);assert.equal(f.w.carrying,false);
  f.w.interact('home_bread_pickup');f.patch({damage:1});f.tick();assert.equal(f.w.carrying,false);
  f.w.interact('home_bread_pickup');f.w.interact('home_bread_drop');assert.ok(f.done.has(HOME_CIVIC.bread));assert.equal(f.w.carrying,false);
  f.w.interact('home_notice');f.choose('report');assert.equal(f.done.has(HOME_CIVIC.complete),false);
  f.w.interact('home_notice');f.choose('accept');assert.ok(f.done.has(HOME_CIVIC.started));
  for(const flag of[HOME_CIVIC.boat,HOME_CIVIC.light,HOME_CIVIC.garden])f.done.add(flag);
  f.w.interact('home_notice');f.reach(false);f.choose('report');assert.equal(f.done.has(HOME_CIVIC.complete),false,'stale choice revalidates proximity');
  f.reach(true);f.w.interact('home_notice');f.choose('report');assert.ok(f.done.has(HOME_CIVIC.complete));
  assert.ok([...f.done].every(f=>f.startsWith('home_')),'town never grants chapters, contracts or equipment');
 }finally{f.close();}
});
test('fishing has a bite window and practice needs three distinct hits in a live local round',()=>{
 const f=fixture();try{
  f.player.set(1022,6.1,112);f.w.interact('home_fishing');f.w.interact('home_fishing');assert.equal(f.done.has(HOME_CIVIC.fish),false);f.tick(92);assert.equal(f.w.fishing,'bite');f.w.interact('home_fishing');assert.ok(f.done.has(HOME_CIVIC.fish));
  f.w.interact('home_fishing');f.tick(160);assert.equal(f.w.fishing,'idle','missed bite can be retried');
  f.w.interact('home_practice_start');assert.equal(f.w.training,false,'an empty-handed visit cannot grant a weapon');f.done.add('armory_rack');f.player.set(790,16.1,-100);f.w.interact('home_practice_start');
  f.w.hit('home_practice_target_1');f.w.hit('home_practice_target_1');assert.equal(f.done.has(HOME_CIVIC.practice),false);
  f.w.hit('home_practice_target_2');f.w.hit('home_practice_target_3');assert.ok(f.done.has(HOME_CIVIC.practice));assert.equal(f.w.training,false);
  f.w.interact('home_practice_start');assert.equal(f.w.training,true);f.player.x+=40;f.tick();assert.equal(f.w.training,false,'leaving ends the transient round');
 }finally{f.close();}
});
test('town services preserve equipment gates and quest targets follow physical delivery state',()=>{
 const f=fixture();try{
  f.w.interact('home_repair_service');f.choose('refill');assert.equal(f.refills(),0);f.done.add('armory_rack');f.w.interact('home_repair_service');f.choose('refill');assert.equal(f.refills(),1);
  f.w.interact('home_tailor_service');f.choose('rose');assert.ok(f.done.has('home_decor_rose'));f.w.interact('home_grocer_service');f.choose('moss');assert.ok(!f.done.has('home_decor_rose')&&f.done.has('home_decor_moss'));
  const markers=[...f.w.markers,{id:'home_notice',type:'interact' as const,label:'归乡广场公告栏',p:[553,17,35] as [number,number,number]}];
  const catalog=createQuestGuideCatalog({markers,objectives:[],npcs:[]});f.done.add(HOME_CIVIC.started);
  const get=(carrying=false)=>catalog.list(f.done,new Set(),{homeCarrying:carrying}).find(e=>e.id==='side:home-civic')!;
  assert.equal(homeCivicGuide(f.done),'home_bread_pickup');assert.equal(get().guide?.targetId,'home_bread_pickup');assert.equal(get(true).guide?.targetId,'home_bread_drop');
  assert.ok(HOME_CIVIC_ACTIONS.filter(a=>a.flag).every(a=>catalog.list(f.done,new Set()).some(e=>e.id===`side:${a.id}`)));
 }finally{f.close();}
});
test('home travel requires a real grounded visit and keeps the combat gate without a historical-seam prerequisite',()=>{
 const stop:SafeTravelStop={id:'travel_home',region:'home',name:['归乡广场','Homeward Square'],position:[570,16.1,40],radius:12,foundFlag:'travel_home'},found=new Set<string>(),done=new Set<string>();
 const c:TravelContext={sessionReady:true,defeated:false,combatActive:false,threatened:false,quietSeconds:10,flying:false,gliding:false,swimming:false,onGround:true,mounted:false,actionActive:false};
 assert.equal(getTravelBlock(stop.id,[stop],done,found,c),'undiscovered');discoverTravelStops([stop],stop.position,{...c,flying:true},found);assert.equal(found.size,0);
 assert.deepEqual(discoverTravelStops([stop],stop.position,c,found),[stop.id]);assert.equal(getTravelBlock(stop.id,[stop],done,found,c),null);assert.equal(done.size,0,'a visit cannot unlock the historical seams');assert.equal(getTravelBlock(stop.id,[stop],done,found,{...c,threatened:true}),'combat');
});
