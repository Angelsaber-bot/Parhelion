import {RelayChannel,type RelayChannelFrame} from './relayChannel';
import {dramaActive,dramaReported,dramaDecision,JOURNEY_DRAMA} from './journeyDrama';
import {ADVENTURE as A,adventureChapterComplete,winterRouteReady,type AdventurePoint,getAdventureEndingText} from './openWorldCampaign';
import type {AdventureAction} from './adventureSites';
import type {Localized} from '../settlements/types';
import type {StoryEncounterSpec} from './storyEncounters';
export interface AdventureHooks{
 done:Set<string>;actions:ReadonlyMap<string,AdventureAction>;path:readonly AdventurePoint[];
 reachable(id:string):boolean;save():boolean;changed():void;toast(line:Localized):void;
 encounter():string|null;start(spec:StoryEncounterSpec):{ok:boolean;reason?:Localized};cancel():void;damage():number;
 cavalry?():boolean;ending?(line:Localized):void;supply():boolean;moveCart(from:AdventurePoint,to:AdventurePoint):boolean;
}
export function adventureEncounter(action:AdventureAction,guardian=false):StoryEncounterSpec{
 return{id:guardian?'adventure_guardian':`adventure_guard_${action.id.slice(-1)}`,anchor:{x:action.p[0],y:action.p[1],z:action.p[2]},actors:guardian?[{role:'breaker',offset:[5,1],pattern:'echo-warden',title:['预写守门者','Warden of the Written Dawn']}]:[{role:'musketeer',offset:action.id.endsWith('_2')?[-5,3]:action.id.endsWith('_3')?[-5,-1]:[-5,-5],title:['复制回路卫兵','Copying Circuit Guard']},{role:'lancer',offset:action.id.endsWith('_2')?[3,-5]:action.id.endsWith('_3')?[5,1]:[5,3],title:['转发哨兵','Relay Sentinel']}]};
}
export function cartCheckpoint(done:ReadonlySet<string>,length:number,prefix='adventure_cart_leg_'){let leg=0;while(leg<length-1&&done.has(`${prefix}${leg+1}`))leg++;return leg;}
export function createAdventureRuntime(h:AdventureHooks){
 let channel=new RelayChannel();let current:AdventureAction|null=null,shipLeg=cartCheckpoint(h.done,7,'adventure_ship_leg_'),shipTime=0,leg=cartCheckpoint(h.done,h.path.length),fraction=0,guardianPending=false,pendingGuard:string|null=null;
 const guardId=(id:string)=>`adventure_guard_${id.slice(-1)}`;
 const guardsCleared=(id:string)=>h.done.has(`${guardId(id)}_cleared`);
 const commit=(id:string)=>{if(h.done.has(id))return false;h.done.add(id);if(!h.save())h.toast(['进度尚未写入存档，请重试保存或备份。','Progress has not been saved; retry saving or make a backup.']);h.changed();return true;};
 const finalReady=()=>['britain','blacksail','winter','kyoto'].every(r=>adventureChapterComplete(r as 'britain'|'blacksail'|'winter'|'kyoto',h.done))&&(!dramaActive(h.done)||(dramaReported(h.done).length===4&&h.done.has(JOURNEY_DRAMA.confession)));
 function blocked(action:AdventureAction):Localized|null{
  const id=action.id;
  if(id==='adventure_tomorrow'&&dramaActive(h.done)&&!dramaDecision(h.done))return ['先与岚决定频道今后的值守方式。','Decide the channel’s future with Lan first.'];
  if(id==='adventure_harbor_records'&&h.done.has('adventure_harbor_alarm_disabled'))return null;
  if(id==='adventure_harbor_exit'&&(!h.done.has(A.records)||(!h.done.has('sea_core')&&!h.done.has('blackbeard_contract'))))return ['先取得真实记录并解除提督的命令，再确认离舰。','Recover the true record and end the Admiral’s orders before confirming disembarkation.'];
  if(id==='adventure_harbor_depart'&&!h.done.has(A.exited))return ['先带着记录离舰，再放行商船。','Disembark with the record before authorizing the merchant ship.'];
  if(id==='adventure_winter_convoy'&&(!h.done.has(A.road)||(!h.done.has('winter_core')&&!h.done.has('napoleon_contract'))||!winterRouteReady(h.done)))return ['先准备路线、清开拒马并解除红场命令，药车才会出发。','Prepare the route, clear the roadblock and end the Red Square orders before releasing the cart.'];
  if(id==='adventure_winter_arrival'&&(!h.done.has(A.convoy)||leg<h.path.length-1))return ['药车尚未抵达渡口。行程在世界运行时推进，途中检查点会保存；可以继续探索。','The cart has not reached the crossing. It travels while the world runs and saves transit checkpoints; you may keep exploring.'];
  if(id==='adventure_kyoto_evidence'&&(!h.done.has('fire_core')&&!h.done.has('musashi_contract')))return ['先解除本能寺的异常，再核对没有被覆盖的记录。','Resolve Honnō-ji’s anomaly before comparing the unaltered record.'];
  if((A.emitters as readonly string[]).includes(id)||id==='adventure_guardian'||id==='adventure_tower'||id==='adventure_exit'||id==='adventure_tomorrow'){
   if(!finalReady())return ['四区还有未完成的归路行动。先让当地居民与运输真正脱离循环。','A region still has an unfinished return journey. Free its people and transport from the loop first.'];
   if(id==='adventure_guardian'&&!A.emitters.every(f=>h.done.has(f)))return ['先切断塔外三处复制发射器。','Disable all three copying emitters first.'];
   if(id==='adventure_tower'&&!h.done.has(A.guardian))return ['先解除塔前讯号源的守门者。','Defeat the signal Warden before taking over the tower.'];
   if(id==='adventure_exit'&&!h.done.has(A.takeover))return ['先在塔顶完成手动接管，出口灯才会亮起。','Take manual control at the tower top to restore the exit lights.'];
   if(id==='adventure_tomorrow'&&!h.done.has(A.escaped))return ['先沿塔梯安全撤到南侧集合点。','Descend safely to the southern assembly point first.'];
  }
  return null;
 }
 return {
  get departureProgress(){return h.done.has(A.departed)?1:(shipLeg+shipTime/5)/6;},
  get channel(){return current;},get progress(){return channel.progress;},
  get cartPosition():AdventurePoint{if(h.done.has(A.arrived))return [...h.path.at(-1)!];const a=h.path[Math.min(leg,h.path.length-1)],b=h.path[Math.min(leg+1,h.path.length-1)];return a.map((v,i)=>v+(b[i]-v)*fraction)as AdventurePoint;},
  get cartProgress(){return h.done.has(A.arrived)?1:(leg+fraction)/(h.path.length-1);},
  hit(id:string){
   if(id===A.brace1||id===A.brace2){commit(id);if(h.done.has(A.brace1)&&h.done.has(A.brace2))commit(A.road);h.toast(h.done.has(A.road)?['拒马支架倒下，宽街已经清出。','The braces collapse; the wide road is clear.']:['一处支架已断；另一处仍在支撑拒马。','One brace is broken; the other still supports the roadblock.']);return true;}
   if(id.startsWith('adventure_fun_')){const changed=commit(id);if(changed)h.toast(['命中，成绩已经记录。','Hit. Your score is recorded.']);return true;}return false;
  },
  interact(id:string){
   const action=h.actions.get(id);if(!action||!h.reachable(id))return false;
   if(id.startsWith('adventure_home_')){const region=id.slice('adventure_home_'.length) as 'britain'|'blacksail'|'winter'|'kyoto';if(!adventureChapterComplete(region,h.done)){h.toast(['当地归路还未完成，这处服务暂未开放。','The region’s return journey is unfinished; this service is not open yet.']);return true;}commit(`${id}_seen`);h.toast(h.supply()?['归来的居民为你补充了药品，体力恢复。','The returning residents offer medicine; health restored.']:['居民记得你打开的归路。休息并脱离战斗后，可以在这里补给。','The residents remember the road you opened. Rest out of combat to resupply here.']);return true;}
   if(id==='adventure_winter_support'){h.cavalry?.();return true;}
   const reason=blocked(action);if(reason){h.toast(reason);return true;}
   if(action.flag&&h.done.has(action.flag)){h.toast(['这项行动已经完成，结果仍然保留。','This action is complete; its result remains.']);return true;}
   if(id==='adventure_guardian'){
    if(h.done.has(A.guardian)){h.toast(['讯号源已停止复制，守门者不会在和平世界中重生。','The source has stopped copying; the Warden will not respawn in the restored world.']);return true;}
    const result=h.start(adventureEncounter(action,true));if(result.ok)guardianPending=true;h.toast(result.ok?['守门者已显现。观察预警，侧移躲开突刺，在收势时反击。','The Warden appears. Read the tells, sidestep its thrust and punish recovery.']:result.reason??['先脱离其他战斗。','Leave other combat first.']);return true;
   }
   if(current?.id===id)return true;
   if((A.emitters as readonly string[]).includes(id)&&!guardsCleared(id)&&h.encounter()!==guardId(id)){
    const result=h.start(adventureEncounter(action));if(!result.ok){h.toast(result.reason??['发射器守卫暂不能接通，请稍后重试。','Cannot engage the emitter guards; try again shortly.']);return true;}
    pendingGuard=guardId(id);
   }
   if(action.seconds&&current?.id===action.id)return true;
   if(action.seconds){current=action;channel=new RelayChannel(action.seconds);channel.reset(h.damage());h.toast([`${action.label[0]}：站稳，松开后按住交互键 ${action.seconds} 秒。`,`${action.label[1]}: stand still, release then hold Interact for ${action.seconds} seconds.`]);return true;}
   if(action.flag)commit(action.flag);
   if(id==='adventure_tomorrow'&&h.ending)h.ending(getAdventureEndingText());
   else if(id==='adventure_tomorrow')h.toast(['你记录了一个没有被预先写好的明天。所有归路仍然开放，可以继续探索、与从者同行或自愿重战。','You record a tomorrow that was not written in advance. Every return route remains open: explore, travel with your companion, or choose a rematch.']);
   else h.toast([`${action.label[0]}已完成。`,`${action.label[1]} complete.`]);return true;
  },
  update(frame:Omit<RelayChannelFrame,'active'|'damageRevision'>){
   if(guardianPending&&h.encounter()!=='adventure_guardian')guardianPending=false;
   if(current&&(A.emitters as readonly string[]).includes(current.id)&&!guardsCleared(current.id)&&h.encounter()!==guardId(current.id)){current=null;channel.reset(h.damage());}
   const result=channel.update({...frame,active:!!current,damageRevision:h.damage()});
   if(result.interrupted)h.toast(['操作中断，已提交的世界变化保留；松开交互后重新操作。','Interaction interrupted. Committed changes remain; release Interact and try again.']);
   if(current&&result.completedNow&&h.reachable(current.id)&&!blocked(current)){
    const action=current;current=null;if(action.flag)commit(action.flag);
    if(action.id==='adventure_harbor_records'&&!h.done.has('sea_core')&&!h.done.has('blackbeard_contract')&&!h.done.has('adventure_harbor_alarm_disabled')&&!h.done.has('adventure_harbor_alarm_cleared')){const spec:StoryEncounterSpec={id:'adventure_harbor_alarm',anchor:{x:action.p[0],y:action.p[1],z:action.p[2]},actors:[{role:'duelist',offset:[-3,-3],title:['船腹截击手','Hold Interceptor']},{role:'musketeer',offset:[1,-5],title:['舱口警戒手','Hatch Sentry']}]};const started=h.start(spec);if(!started.ok)h.toast(started.reason??['警报已响，断路器仍可关闭。','The alarm is sounding; the breaker is still accessible.']);}
    if(action.id==='adventure_harbor_alarm'&&h.encounter()==='adventure_harbor_alarm')h.cancel();
    if((A.emitters as readonly string[]).includes(action.id)&&h.encounter()===`adventure_guard_${action.id.slice(-1)}`)h.cancel();
    h.toast([`${action.label[0]}已完成，现场状态已经改变。`,`${action.label[1]} complete; the site has changed.`]);
   }
   if(frame.playable&&h.done.has(A.sailing)&&!h.done.has(A.departed)){shipTime+=Math.min(Math.max(frame.dt,0),.05);if(shipTime+1e-9>=5){shipTime=0;shipLeg++;commit(`adventure_ship_leg_${shipLeg}`);if(shipLeg>=6){commit(A.departed);h.toast(['商船已驶离港口。回酒馆与黑胡子正式契约，或继续沿海岸探索。','The merchant ship has left port. Return to the tavern for your pact with Blackbeard, or keep exploring the coast.']);}}}
   if(!frame.playable||!h.done.has(A.convoy)||h.done.has(A.arrived)||leg>=h.path.length-1)return;
   const a=h.path[leg],b=h.path[leg+1],length=Math.hypot(a[0]-b[0],a[2]-b[2]);
   const next=Math.min(1,fraction+Math.min(Math.max(frame.dt,0),.05)*2.8/Math.max(1,length));
   const p=a.map((v,i)=>v+(b[i]-v)*next)as AdventurePoint;
   if(!Number.isFinite(next)||!h.moveCart(this.cartPosition,p))return;
   fraction=next;if(fraction>=1){leg++;fraction=0;commit(`adventure_cart_leg_${leg}`);if(leg===h.path.length-1)h.toast(['药车已到渡口，等待你验收。','The medicine cart has reached the crossing and awaits your confirmation.']);}
  },
  victory(id:string){if(id==='adventure_harbor_alarm'){commit('adventure_harbor_alarm_cleared');return true;}if(id===pendingGuard){pendingGuard=null;commit(`${id}_cleared`);h.toast(['发射器守卫已清除。回到装置，按住交互键关闭；守卫不会因操作中断而重生。','Emitter guards defeated. Return and hold Interact to shut it down; interrupted operation will not respawn the guards.']);return true;}if(id!=='adventure_guardian'||!guardianPending||!finalReady()||!A.emitters.every(flag=>h.done.has(flag)))return false;guardianPending=false;commit(A.guardian);h.toast(['守门者已解除。登塔手动接管，再沿照明出口撤离。','The Warden is defeated. Take manual control atop the tower, then follow the lit exit.']);return true;},
  interrupt(){current=null;channel.reset(h.damage());},
  reset(){this.interrupt();guardianPending=false;pendingGuard=null;leg=cartCheckpoint(h.done,h.path.length);fraction=0;shipTime=0;shipLeg=cartCheckpoint(h.done,7,'adventure_ship_leg_');},
 };
}
