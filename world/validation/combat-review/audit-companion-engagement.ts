/** Actual main companion combat audit, not a story journey/human playtest.
 * Explicit entry teleport + catalog admission; real ground settling and normal
 * summon/dodge keys. No actor/HP/charge/ground/contact clock writes. Read-only
 * callback observation forwards unchanged arguments/results and timing.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CompanionNavigation as HistoricalCompanionNavigation} from '../fixtures/companion-navigation-pre-detour';
import {CompanionNavigationCandidate} from './companion-navigation-candidate';
import {installCompanionPursuitCandidate} from './companion-pursuit-candidate';
import {CompanionNavigation} from '../../src/companionNavigation';
import {mkdir,writeFile} from 'node:fs/promises';
import {bootWorldWithoutGpu} from '../world-dom-boot.fixture';
import {getFalseDawnEncounterSpec} from '../../src/falseDawnEncounterCatalog';
const name=process.argv[2]??'alpha-slope',diagnose=process.argv.includes('--diagnose'),reposition=process.argv.includes('--reposition')||process.argv.includes('--wide-reposition'),wideReposition=process.argv.includes('--wide-reposition');
const scenarios:Record<string,{id:string;offset:[number,number];seconds:number}>={
 'alpha-slope':{id:'false_dawn_warden',offset:[-2.3037204157,-5.2040747411],seconds:35},
 'alpha-cover':{id:'false_dawn_warden',offset:[0,9],seconds:35},
 'winter':{id:'false_dawn_winter_1',offset:[-3.9,-3.6],seconds:30},
 'harbor':{id:'false_dawn_harbor',offset:[0,-4.8],seconds:30},
};
const scenario=scenarios[name];assert.ok(scenario);const historicalNavigation=process.argv.includes('--historical-navigation');const candidateNavigation=process.argv.includes('--detour')||process.argv.includes('--late-detour'),lateDetour=process.argv.includes('--late-detour'),lateBaseline=process.argv.includes('--late-baseline-reset'),candidatePursuit=process.argv.includes('--continuity');const seconds=process.argv.find(arg=>arg.startsWith('--seconds='));if(seconds)scenario.seconds=Number(seconds.split('=')[1]);assert.ok(scenario.seconds>0&&scenario.seconds<=90);
const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack','saber_contract'],found:[]})}}),w=h.world,d=h.window.document;
let now=0,start=0;const held=new Set<string>(),frame=()=>h.frame(now+=1000/60),time=()=>Math.round((now-start)*1e3)/1e6;
const key=(action:string,down:boolean)=>{const code=w.settings.bindingsFor(action)[0];assert.ok(code);if(held.has(code)===down)return;if(down)held.add(code);else held.delete(code);d.body.dispatchEvent(new h.window.KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true,cancelable:true}));};
const press=(action:string)=>{key(action,true);key(action,false);};
const aim=(p:{x:number;z:number})=>{const yaw=Math.atan2(w.player.pos.x-p.x,w.player.pos.z-p.z),delta=Math.atan2(Math.sin(w.player.yaw-yaw),Math.cos(w.player.yaw-yaw)),event=new h.window.MouseEvent('mousemove',{bubbles:true});Object.defineProperties(event,{movementX:{value:delta/(.0022*w.settings.value.sensitivity)},movementY:{value:0}});d.dispatchEvent(event);};
let pursuit:ReturnType<typeof installCompanionPursuitCandidate>|undefined;
const probe=new CompanionNavigation(w.colliders),diagnostics:any[]=[],samples:any[]=[],calls:any[]=[],hits:any[]=[],attacks:any[]=[],evades:any[]=[];
try{
 (d.getElementById('start')as HTMLElement).click();await Promise.resolve();const spec=getFalseDawnEncounterSpec(scenario.id)!,x=spec.anchor.x+scenario.offset[0],z=spec.anchor.z+scenario.offset[1],floor=w.combat.geometry.ground(x,z,spec.anchor.y+4);assert.ok(floor);w.player.teleport(x,floor.point.y+.04,z);frame();await h.settleAssets();for(let i=0;i<180;i++)frame();assert.equal(w.player.onGround,true);
 if(!w.contract.summoned)press('summon');frame();await h.settleAssets();for(let i=0;i<90;i++)frame();assert.equal(w.contract.summoned,true);assert.equal(w.servant.state,'ready');
 if(historicalNavigation)w.servant.navigation=new HistoricalCompanionNavigation(w.colliders);
 if(candidateNavigation&&!lateDetour)w.servant.navigation=new CompanionNavigationCandidate(w.colliders);
 if(candidatePursuit)pursuit=installCompanionPursuitCandidate(w.servant,id=>w.combat.state.enemies.some((e:any)=>e.id===id&&e.active&&e.mode!=='dead'&&!e.pacified));
 const options=w.servant.options,previous:Record<string,string>={};
 for(const method of ['engage','target','track','strike']){const original=options[method];options[method]=(...args:any[])=>{const result=original(...args),key=result?.id??null;if(method==='strike'||previous[method]!==key){previous[method]=key;calls.push({time:time(),method,id:key,requestedId:typeof args[1]==='string'?args[1]:null,position:w.servant.root.position.toArray(),player:w.player.pos.toArray(),result:result?{id:result.id,position:result.position.toArray()}:null,cooldown:w.combat.allyCooldown});}return result;};}
 const drain=w.combat.state.drainEvents.bind(w.combat.state);w.combat.state.drainEvents=()=>{const events=drain();for(const event of events)if(event.type==='hit'||event.type==='attackContact')hits.push({time:time(),...event});return events;};
 start=now;assert.equal(w.combat.startStoryEncounter(spec,{position:w.player.pos,playable:true}).ok,true);frame();await h.settleAssets();frame();
 let repositionDone=false,repositionIndex=0,lateAttached=false;const attachments:any[]=[],rootJumps:any[]=[];const previousRoot=w.servant.root.position.clone();const attempted=new Set<string>();let previousAttack:string|null=null,lastAttackTime=0,dodgeCount=0,maxStuck=0;
 for(let step=0;step<scenario.seconds*60&&!w.combat.defeated&&w.combat.storyEncounter;step++){
  if((lateDetour||lateBaseline)&&!lateAttached&&time()>=22&&w.servant.navigation.stuckSeconds>=2){const before=w.servant.root.position.toArray(),stuck=w.servant.navigation.stuckSeconds;w.servant.navigation=lateDetour?new CompanionNavigationCandidate(w.colliders):new HistoricalCompanionNavigation(w.colliders);lateAttached=true;assert.deepEqual(w.servant.root.position.toArray(),before);attachments.push({time:time(),before,stuck,kind:lateDetour?'candidate':'baseline-reset'});}
  const live=w.combat.state.enemies.filter((e:any)=>e.storyEncounter&&e.mode!=='dead'),threat=live.filter((e:any)=>e.mode==='windup').sort((a:any,b:any)=>a.timer-b.timer)[0]??live[0];
  const repositioning=reposition&&time()>=16&&!repositionDone;
  if(repositioning){const goals=wideReposition?[{x:68,z:-636},{x:68,z:-628}]:[{x:66,z:-634}],goal=goals[repositionIndex];if(Math.hypot(w.player.pos.x-goal.x,w.player.pos.z-goal.z)<.4){repositionIndex++;repositionDone=repositionIndex>=goals.length;key('forward',false);}else{aim(goal);key('forward',true);}}
  if(threat&&!repositioning){aim(threat.p);const token=`${threat.id}:${threat.attackCount}`;if(threat.mode==='windup'&&threat.timer<=.1&&!attempted.has(token)){attempted.add(token);if(w.player.onGround&&w.actions.evade.cooldown<=0){const side=dodgeCount++%2?'left':'right';key(side,true);const before=w.actions.evade.remaining;press('evade');evades.push({time:time(),side,accepted:w.actions.evade.remaining>before,position:w.player.pos.toArray(),target:threat.id});}}}
  frame();key('left',false);key('right',false);
  const actor=w.servant,attack=actor.attackTarget;if(actor.root.position.distanceTo(previousRoot)>.5)rootJumps.push({time:time(),from:previousRoot.toArray(),to:actor.root.position.toArray(),distance:actor.root.position.distanceTo(previousRoot)});previousRoot.copy(actor.root.position);
  if(attack&&(attack!==previousAttack||actor.attackTime>lastAttackTime+.1))attacks.push({time:time(),target:attack,duration:actor.attackDuration,position:actor.root.position.toArray(),targetPosition:{...w.combat.state.enemies.find((e:any)=>e.id===attack)?.p}});
  previousAttack=attack;lastAttackTime=actor.attackTime;maxStuck=Math.max(maxStuck,actor.navigation.stuckSeconds);
  if(diagnose&&step%6===0&&time()>=14){const target=live[0],from=actor.root.position.clone();if(target){const to=new THREE.Vector3(target.p.x,target.p.y,target.p.z),eye=from.clone().add(new THREE.Vector3(0,1,0)),direction=to.clone().add(new THREE.Vector3(0,1,0)).sub(eye),hit=w.combat.geometry.cast(eye,direction,direction.length()-.05),goal=to.clone().add(from.clone().sub(to).setY(0).normalize());diagnostics.push({time:time(),from:from.toArray(),to:to.toArray(),player:w.player.pos.toArray(),playerDistance:Math.hypot(to.x-w.player.pos.x,to.z-w.player.pos.z),companionDistance:from.distanceTo(to),heightDifference:Math.abs(to.y-from.y),los:!hit,blocker:hit?{point:hit.point.toArray(),distance:hit.distance,faceIndex:hit.faceIndex,normal:hit.face?.normal.toArray()}:null,directWalk:probe.path(from,goal),pursuing:actor.pursuing,stuck:actor.navigation.stuckSeconds,goal:actor.navigation.goal.toArray(),waypoint:actor.navigation.waypoint.toArray()});}}
  if(step%6===0){const p=actor.root.position,ground=w.combat.geometry.ground(p.x,p.z,p.y+.5);samples.push({time:time(),player:w.player.pos.toArray(),hp:w.combat.state.hp,grounded:w.player.onGround,companion:{position:p.toArray(),yaw:actor.root.rotation.y,floor:ground?.point.y,feetGap:ground?p.y-ground.point.y:null,stuck:actor.navigation.stuckSeconds,pursuing:actor.pursuing,attackTime:actor.attackTime,target:actor.attackTarget,contactPending:actor.contactPending},enemies:live.map((e:any)=>({id:e.id,p:{...e.p},hp:e.hp,mode:e.mode,timer:e.timer}))});}
 }
 const report={evidence:'Actual-main companion acquisition/native attack/contact and world BVH navigation. Entry teleport/direct catalog admission are explicit setup; real settling and normal summon/dodge keys. Dodge timing reads accepted tells (mechanics oracle), not human reaction evidence. No hostile HP, ground, charge, companion placement or clocks written. CPU DOM harness, no GPU/FPS claim.',name,scenario,implementation:historicalNavigation?'historical-reference':candidateNavigation?'isolated-detour':'production',historicalNavigation,candidateNavigation,candidatePursuit,lateDetour,lateBaseline,attachments,rootJumps,detour:w.servant.navigation.detourDiagnostics??null,pursuit:pursuit?.memory.diagnostics,diagnose,reposition,wideReposition,repositionDone,diagnostics,elapsed:time(),hp:w.combat.state.hp,energy:w.actions.skills.energy,active:w.combat.storyEncounter,maxStuck,attacks,calls,hits,evades,samples,errors:h.errors,warnings:h.warnings};
 await mkdir('../artifacts/companion-engagement',{recursive:true});await writeFile(`../artifacts/companion-engagement/${name}${historicalNavigation?'-historical':''}${lateDetour?'-late-detour':candidateNavigation?'-detour':''}${lateBaseline?'-late-baseline-reset':''}${candidatePursuit?'-continuity':''}${diagnose?'-diagnostic':''}${wideReposition?'-wide-reposition':reposition?'-reposition':''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,diagnostics:diagnostics.length,samples:samples.length,calls:calls.length,hits:hits.filter(row=>row.type==='hit'),attacks:attacks.length}));assert.deepEqual(h.errors,[]);
}finally{pursuit?.dispose();for(const code of held)d.body.dispatchEvent(new h.window.KeyboardEvent('keyup',{code,bubbles:true}));await h.close();}
