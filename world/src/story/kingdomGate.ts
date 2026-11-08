import type { Localized } from '../settlements/types';
import type { StoryEncounterSpec } from './storyEncounters';
import { RelayChannel, type RelayChannelFrame } from './relayChannel';
export const KINGDOM_GATE = {
 entry:'kingdom_gate_notice', latch:'kingdom_gate_latch', winch:'kingdom_gate_winch',
 unlocked:'kingdom_gate_unlocked', open:'kingdom_gate_open', rescued:'kingdom_gate_rescued',
 service:'kingdom_gate_service', encounter:'kingdom_gate_patrol',
} as const;
export function isKingdomGateOpen(done:ReadonlySet<string>){
 return done.has(KINGDOM_GATE.open)||done.has('sun_core')||(!done.has('adventure_v2')&&(done.has('hall_brazier_1')||['saber_contract','shard_camp','shard_tower','shard_table'].every(id=>done.has(id))));
}
export type GatePoint = [number,number,number];
/** Tangent and outward coordinates at the existing southeast Camelot arch. */
export function gatePoint(side:number,outward:number,height=0):GatePoint {
 const s=Math.SQRT1_2;
 return [-910+(60+outward+side)*s,34+height,-190+(60+outward-side)*s];
}
export function gateGuide(done:ReadonlySet<string>):{targetId:string;text:Localized}|null {
 if(done.has(KINGDOM_GATE.rescued))return null;
 if(!done.has(KINGDOM_GATE.entry)&&!done.has(KINGDOM_GATE.unlocked)&&!done.has(KINGDOM_GATE.open))return {targetId:KINGDOM_GATE.entry,text:['王城居民被困在门外。到城门告示处观察封锁，选择接近方法。','Residents are stranded outside. Inspect the blockade at the gate notice and choose your approach.']};
 if(!done.has(KINGDOM_GATE.unlocked)&&!done.has(KINGDOM_GATE.open))return {targetId:KINGDOM_GATE.latch,text:['打开归路：射断金色锁扣，或沿城墙左侧接近，亲手拆闩。告示牌可启动守卫遭遇。','Open the way home: shoot the gold latch, or approach along the left wall and release it by hand. The notice starts the guard encounter.']};
 if(!done.has(KINGDOM_GATE.open))return {targetId:KINGDOM_GATE.winch,text:['锁扣已解除。在绞盘旁站稳，按住交互键三秒；移动、攻击或受伤会中断。','Latch released. Stand by the winch and hold Interact for three seconds; movement, attacks or damage interrupt.']};
 return {targetId:KINGDOM_GATE.service,text:['城门已开。护送居民穿门到内侧灯下；附近威胁会让他们停下，抵达后才完成救援。','Gate open. Escort the residents through to the inner lamp. Nearby threats stop them; rescue completes only on arrival.']};
}
export const GATE_ESCORT_PATH:readonly GatePoint[]=[gatePoint(0,8),gatePoint(0,3),gatePoint(0,-3),gatePoint(0,-8)];
export function gateEncounter():StoryEncounterSpec {
 const [x,y,z]=gatePoint(0,7);
 return {id:KINGDOM_GATE.encounter,anchor:{x,y,z},actors:[
  {role:'musketeer',offset:[-5,3],title:['城门射手','Gate Musketeer']},
  {role:'breaker',offset:[3,-5],title:['封路重卫','Roadblock Guard']},
 ]};
}
export interface GateHooks {
 done:Set<string>; save():boolean; changed():void; toast(line:Localized):void;
 reachable(id:string):boolean; start():{ok:boolean;reason?:Localized};
 supply():boolean; cancel():void; encounter():string|null; damage():number;
}
/** Only committed facts persist. Escort position and winch channel restart safely. */
export function createKingdomGateRuntime(h:GateHooks){
 const channel=new RelayChannel();let escort=0,channeling=false;
 function commit(flag:string){if(h.done.has(flag))return;h.done.add(flag);const saved=h.save();h.changed();if(!saved)h.toast(['进度尚未保存，请在设置中重试或备份。','Progress is not saved; retry or back up in Settings.']);}
 return {
  get progress(){return channel.progress;},get escort(){return h.done.has(KINGDOM_GATE.rescued)?1:escort;},
  unlock(){commit(KINGDOM_GATE.unlocked);h.toast(['锁扣脱落，绞盘可以转动了。','The latch falls away. The winch is free.']);},
  interact(id:string){
   if(!h.reachable(id))return;
   if(id===KINGDOM_GATE.entry){
    if(h.done.has(KINGDOM_GATE.rescued)){h.toast(['归路仍然开放，居民已在城内安顿。','The way remains open; the residents are settled inside.']);return;}
    if(!h.done.has('armory_rack')){h.toast(['先领取步枪，再来解除封锁。','Collect your rifle before tackling the blockade.']);return;}
    const result=h.start();if(result.ok)commit(KINGDOM_GATE.entry);h.toast(result.ok?['正街有射线，左侧低墙可以遮挡。射断或拆开金色锁扣，再操作右侧绞盘；可利用同行从者创造窗口。','The main approach is exposed; the left low wall offers cover. Shoot or release the gold latch, then work the right winch. Your companion can create an opening.']:result.reason??['暂不能开始城门遭遇。','Cannot start the gate encounter yet.']);
   }else if(id===KINGDOM_GATE.latch)this.unlock();
   else if(id===KINGDOM_GATE.winch){
    channeling=!h.done.has(KINGDOM_GATE.open)&&h.done.has(KINGDOM_GATE.unlocked);
    h.toast(channeling?['松开后按住交互键三秒转动绞盘。','Release, then hold Interact for three seconds to turn the winch.']:['先解除金色锁扣；已打开的城门会保持开放。','Release the gold latch first; an open gate stays open.']);
   }else if(id===KINGDOM_GATE.service&&h.done.has(KINGDOM_GATE.rescued)){const healed=h.supply();h.toast(healed?['归人递来补给，体力已恢复。','The returners offer supplies; health restored.']:['归路仍然开放。脱离战斗并稍作休息后，可以在这里补给。','The way remains open. Leave combat and rest briefly to resupply here.']);}
  },
  update(frame:Omit<RelayChannelFrame,'active'|'damageRevision'>,escortSafe:boolean,advance:(fraction:number)=>boolean){
   const result=channel.update({...frame,active:channeling,damageRevision:h.damage()});
   if(result.interrupted)h.toast(['绞盘操作中断；站稳后松开再按。','Winch interrupted; stand still, release and press again.']);
   if(result.completedNow&&h.reachable(KINGDOM_GATE.winch)){commit(KINGDOM_GATE.open);channeling=false;h.toast(['城门已升起。陪居民走到城内灯下。','The gate rises. Accompany the residents to the inner lamp.']);}
   if(!frame.playable||!h.done.has(KINGDOM_GATE.open)||h.done.has(KINGDOM_GATE.rescued)||!escortSafe)return;
   const next=Math.min(1,escort+Math.min(Math.max(frame.dt,0),.05)/16);
   if(!Number.isFinite(next)||!advance(next))return;
   escort=next;
   if(escort>=1){commit(KINGDOM_GATE.rescued);if(h.encounter()===KINGDOM_GATE.encounter)h.cancel();h.toast(['居民已穿门抵达，归人补给点亮灯。下一站：圆桌大厅第一盏誓火。','The residents arrive through the gate; the supply lamp is lit. Next: the first oath hearth in the Round Table Hall.']);}
  },
  interrupt(){channel.reset(h.damage());channeling=false;},
  reset(){this.interrupt();escort=0;},
 };
}
