import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {Player} from '../src/player/player';
import {flagshipPoint} from '../src/map/shipInteriorCut';
import {ADVENTURE as A} from '../src/story/openWorldCampaign';
import {WORLD_PROGRESS_KEY} from '../src/core/progress';
import {createResidentEventRuntime} from '../src/story/residentEvents';
import {getResidentWorkGuide} from '../src/story/residentEventRules';

test('five resident jobs require their different field actions, preserve partial work and cancel carried items safely',()=>{
 const done=new Set(['adventure_v2',...['alpha','britain','blacksail','winter','kyoto'].map(r=>`campaign_${r}_met`)]);let reachable=true,saves=0;
 const r=createResidentEventRuntime({done,save:()=>{saves++;},changed(){},toast(){},reachable:()=>reachable});
 const act=(key:string)=>r.interact(`resident_${key}`);
 act('alpha_tune');assert.equal(done.has('campaign_alpha_worked'),false);act('alpha_ground');act('alpha_rhythm');act('alpha_tune');assert.ok(done.has('campaign_alpha_worked'));assert.equal(r.dial,1);
 act('britain_stamp');assert.equal(done.has('campaign_britain_worked'),false);for(const k of ['order','witness_a','witness_b','stamp'])act(`britain_${k}`);assert.ok(done.has('campaign_britain_worked'));
 act('blacksail_hood');assert.equal(done.has('campaign_blacksail_worked'),false);for(const k of ['manifest_a','manifest_b','manifest_c','hood'])act(`blacksail_${k}`);assert.ok(done.has('campaign_blacksail_worked'));
 act('winter_underlay');assert.equal(done.has('campaign_winter_work_step_1'),false);act('winter_blanket');assert.equal(getResidentWorkGuide('winter',done,r.carrying)?.targetId,'resident_winter_underlay');r.cancelCarry();act('winter_underlay');assert.equal(done.has('campaign_winter_work_step_1'),false);
 for(const k of ['blanket','underlay','strap_b','strap_a'])act(`winter_${k}`);assert.ok(done.has('campaign_winter_worked'));
 for(let i=0;i<3;i++){act('kyoto_page');assert.equal(getResidentWorkGuide('kyoto',done,r.carrying)?.targetId,'resident_kyoto_rack');act('kyoto_rack');}assert.ok(done.has('campaign_kyoto_work_step_1'));for(const k of ['weight_a','weight_b'])act(`kyoto_${k}`);assert.ok(done.has('campaign_kyoto_worked'));
 const before=saves;reachable=false;assert.equal(act('winter_hoofprints'),false);assert.equal(saves,before);reachable=true;
 act('winter_horse');assert.equal(done.has('resident_winter_horse_found'),false);act('winter_hoofprints');act('winter_horse');assert.ok(done.has('resident_winter_horse_found'));
 act('kyoto_cross_start');r.update(new THREE.Vector3(150,.5,780),false,true);act('kyoto_cross_finish');assert.equal(done.has('resident_kyoto_dry_shoes'),false);
 act('kyoto_cross_start');r.update(new THREE.Vector3(150,3,780),true,true);act('kyoto_cross_finish');assert.ok(done.has('resident_kyoto_dry_shoes'));assert.ok(done.has('resident_kyoto_glider_trick'));
 const copy=new Set(done);r.reset();assert.deepEqual(done,copy);assert.equal(r.carrying,null);
});

test('finished spaces: both hold entrances and exits walk on actual carved hull; all new field sockets have grounded body clearance',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{[WORLD_PROGRESS_KEY]:JSON.stringify({done:[A.started,'armory_rack',...['alpha','britain','blacksail','winter','kyoto'].map(r=>`campaign_${r}_met`)],found:[]})}}),w=h.world;let time=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(time+=1000/60);};
 try{
  (h.window.document.getElementById('start')as HTMLElement).click();await Promise.resolve();frame(2);
  const q=w.combat.geometry,issues:string[]=[];
  for(const m of w.residentEventScene.markers){const g=q.ground(m.p[0],m.p[2],m.p[1]+1);if(!g||Math.abs(g.point.y-(m.p[1]-.9))>.2||!q.clear(new THREE.Vector3(m.p[0],g.point.y+.04,m.p[2]),.35,1.8))issues.push(`${m.id}: ${m.p} floor=${g?.point.y}`);}
  assert.deepEqual(issues,[]);
  function walk(route:number[][],visit?:(p:THREE.Vector3)=>void){const p=new Player(w.colliders,w.layout.world.waterLevel);p.teleport(route[0][0],route[0][1]+.2,route[0][2]);let k=1;
   for(let n=0;n<8000&&k<route.length;n++){const t=route[k],dx=t[0]-p.pos.x,dz=t[2]-p.pos.z;if(Math.hypot(dx,dz)<.45){k++;continue;}p.yaw=Math.atan2(-dx,-dz);p.step(1/120,{x:0,z:1,jump:false,sprint:false});visit?.(p.pos);}
   assert.equal(k,route.length,`hold passage stuck ${p.pos.toArray()} next ${route[k]}`);return p;
  }
  for(const route of w.flagshipInterior.rampRoutes){walk(route);walk([...route].reverse());}
  const leisureDone=new Set<string>(),crossing=createResidentEventRuntime({done:leisureDone,reachable:()=>true,save(){},changed(){},toast(){}});
  crossing.interact('resident_kyoto_cross_start');walk([[128,q.ground(128,780)!.point.y,780],[176,1.8,780]],p=>crossing.update(p,false,true));assert.equal(crossing.crossing,true,'actual turtle stones keep shoes dry');crossing.interact('resident_kyoto_cross_finish');assert.ok(leisureDone.has('resident_kyoto_dry_shoes'));
  crossing.interact('resident_kyoto_cross_start');walk([[128,q.ground(128,784)!.point.y,784],[176,1.8,784]],p=>crossing.update(p,false,true));assert.equal(crossing.crossing,false,'wading alongside the stones invalidates the challenge');
  const edge=flagshipPoint(10,4.3,3.4);w.player.teleport(...edge,Math.PI/2);frame(90);const cameraV=(w.camera.position.x-1016)*Math.cos(.15)-(w.camera.position.z-104)*Math.sin(.15);assert.ok(cameraV<5.02,`camera stays inside the new hold wall: ${cameraV}`);
  const sequence:Record<string,string[]>={alpha:['ground','rhythm','tune'],britain:['order','witness_a','witness_b','stamp'],blacksail:['manifest_a','manifest_b','manifest_c','hood'],winter:['blanket','underlay','strap_a','strap_b'],kyoto:['page','rack','page','rack','page','rack','weight_a','weight_b']};
  for(const[region,actions]of Object.entries(sequence)){
   for(const key of actions){const id=`resident_${region}_${key}`,m=w.layout.markers.find((m:any)=>m.id===id)!;w.player.teleport(m.p[0],m.p[1]-.6,m.p[2]);frame(60);const code=w.settings.bindingsFor('interact')[0];h.window.document.body.dispatchEvent(new h.window.KeyboardEvent('keydown',{code,bubbles:true}));h.window.document.body.dispatchEvent(new h.window.KeyboardEvent('keyup',{code,bubbles:true}));frame();if(w.residentEventRuntime.carrying){const midpoint=w.rig.handSockets.L.getWorldPosition(new THREE.Vector3()).add(w.rig.handSockets.R.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);assert.ok(midpoint.distanceTo(w.residentEventScene.carried.position)<.09,'carried prop follows both actual palms');assert.equal(w.rig.joints.Gun.visible,false,'hands stay occupied while carrying');}if(key.startsWith('manifest_'))assert.ok(w.done.has(id),`${id}: ${w.player.pos.toArray()}, prompt=${h.window.document.getElementById('prompt')?.textContent}, toast=${h.window.document.getElementById('toast')?.textContent}`);}
   assert.ok(w.done.has(`campaign_${region}_worked`),`${region} physical interactions: ${h.window.document.getElementById('toast')?.textContent}`);
  }
  const legacyWork=new Set(['alpha','britain','blacksail','winter','kyoto'].map(r=>`campaign_${r}_worked`));w.residentEventScene.apply(legacyWork,w.player.pos,0,null,0);
  for(const name of['InsulatingUnderlay','TiedStrap0','CornerWeight0','DryingPage0','DryingPage1','DryingPage2'])assert.equal(w.residentEventScene.root.getObjectByName(name).visible,true,`legacy completed work projects ${name}`);
  assert.equal(w.residentEventScene.root.getObjectByName('LaterMusterOrder').visible,false);w.residentEventScene.apply(w.done,w.player.pos,0,null,0);
  const m=w.layout.markers.find((m:any)=>m.id===A.records)!;w.player.teleport(m.p[0],m.p[1],m.p[2]);frame(60);assert.ok(Math.abs(w.player.pos.y-3.4)<.15);assert.equal(h.errors.length,0);
 }finally{await h.close();}
});

test('production region streaming starts with one visual payload and evicts real GPU buffers; revisiting reloads without changing progress',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,streaming:true}),w=h.world;let time=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(time+=1000/60);};
 try{
  assert.deepEqual(Array.from(w.regionVisuals.diagnostics.resident),['alpha']);assert.equal(w.regionVisuals.diagnostics.downloads,1);
  const original=[...w.done];w.player.teleport(520,10,150);frame();assert.equal(w.regionVisuals.ready('blacksail'),false);await h.settleAssets();frame();assert.ok(w.regionVisuals.ready('blacksail'));
  frame(900);const d=w.regionVisuals.diagnostics;assert.equal(d.resident.includes('alpha'),false);assert.ok(d.evictions>=1&&d.disposedGeometries>0&&d.disposedMaterials>0,JSON.stringify(d));
  w.player.teleport(-90,10,240);frame();await h.settleAssets();frame();assert.ok(w.regionVisuals.ready('alpha'));assert.ok(w.regionVisuals.diagnostics.downloads>=3);assert.deepEqual([...w.done],original);assert.equal(h.errors.length,0);
 }finally{await h.close();}
});

test('local cavalry uses the loaded Napoleon horse and a real contact while Saber remains selected; leaving releases the actor',async()=>{
 const flags=[A.started,'armory_rack','saber_contract','napoleon_meet',A.road];
 const h=await bootWorldWithoutGpu({deterministic:true,exposeEraActors:true,initialStorage:{[WORLD_PROGRESS_KEY]:JSON.stringify({done:flags,found:[]})}}),w=h.world,d=h.window.document;let time=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(time+=1000/60);};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame(2);
  const m=w.layout.markers.find((m:any)=>m.id==='adventure_winter_support');w.player.teleport(m.p[0],m.p[1]+.3,m.p[2]);frame(70);const selected=w.contract.selected;await h.settleAssets();frame();
  assert.ok(w.cavalrySupport.request(),d.getElementById('toast')?.textContent);frame(2);await h.settleAssets();frame(2);
  const napoleon=w.__qaEraActors.find((a:any)=>a.servant==='napoleon');assert.ok(napoleon.actor);const actor=napoleon.actor;

  assert.ok(w.cavalrySupport.ownsActor,d.getElementById('toast')?.textContent);
  for(let i=0;i<500&&!w.done.has('adventure_winter_cavalry_contact');i++)frame();
  assert.ok(w.done.has('adventure_winter_cavalry_contact'),`${d.getElementById('toast')?.textContent}; phase=${napoleon.follow.mountedPhase}, hp=${w.combat.state.hp}, pos=${actor.root.position.toArray()}`);
  assert.equal(w.contract.selected,selected);assert.equal(w.contract.roster.includes('napoleon'),false);assert.equal(napoleon.actor,actor);

  w.cavalrySupport.cancel();const saved=[...w.done];frame(100);assert.deepEqual([...w.done],saved);
  w.player.teleport(-90,10,240);frame(1000);await h.settleAssets();frame();assert.equal(w.cavalrySupport.ownsActor,false);assert.equal(napoleon.actor,undefined);
  const hoof=w.layout.markers.find((m:any)=>m.id==='resident_winter_hoofprints');w.player.teleport(hoof.p[0],hoof.p[1]-.6,hoof.p[2]);frame(60);const code=w.settings.bindingsFor('interact')[0];d.body.dispatchEvent(new h.window.KeyboardEvent('keydown',{code,bubbles:true}));d.body.dispatchEvent(new h.window.KeyboardEvent('keyup',{code,bubbles:true}));frame(2);await h.settleAssets();frame();
  assert.ok(w.done.has('resident_winter_horse_trail'));const horse=w.residentEventScene.horseSpot,meeting=w.layout.markers.find((m:any)=>m.id==='napoleon_contract');assert.ok(Math.hypot(meeting.p[0]-horse[0],meeting.p[2]-horse[2])<.01,'the contract guide follows the actual grazing horse');assert.ok(napoleon.actor.root.position.distanceTo(new THREE.Vector3(horse[0],horse[1]-.9,horse[2]))<.01);assert.equal(h.errors.length,0);
 }finally{await h.close();}
});
