import type {Localized} from '../settlements/types';
import {COMPACT_RELAY as SITE_IDS} from './compactRelaySitesData';

export const COMPACT_RELAY={...SITE_IDS,complete:'compact_relay_complete'} as const;
export const COMPACT_RELAY_TITLE:Localized=['前沿联络 · 突破演练','Forward Relay · Breach Exercise'];
export interface CompactRelayContext {active?:boolean;/** Elapsed uninterrupted seconds, not a ratio. */progress?:number;lastInterrupt?:string|null;}
export interface CompactRelayState {stage:'equipment'|'ready'|'active'|'channel'|'complete';complete:boolean;active:boolean;progress:number;}
export function getCompactRelayState(done:ReadonlySet<string>,context:CompactRelayContext={}):CompactRelayState{
 const complete=done.has(COMPACT_RELAY.complete),armed=done.has('armory_rack');
 const active=armed&&!!context.active,progress=active&&Number.isFinite(context.progress)?Math.max(0,Math.min(3,context.progress!)):0;
 return{stage:active?(progress>0?'channel':'active'):complete?'complete':armed?'ready':'equipment',complete,active,progress};
}
/** Runtime calls only after its authoritative uninterrupted channel/range/LOS/
 * alive/session checks. No enemy kill, original relay, contract or found flag is written. */
export function completeCompactRelay(done:Set<string>):boolean{
 if(!done.has('armory_rack')||done.has(COMPACT_RELAY.complete))return false;
 done.add(COMPACT_RELAY.complete);return true;
}
export function getCompactRelayIntro(done:ReadonlySet<string>):Localized{
 if(done.has('adventure_v2'))return ['求援讯号正在重复未来才会发生的呼叫。先接通服务庭院控制柜，恢复最低外联，再去核对现场。\n正街低墙与北侧维修路都能到达机柜。站稳按住交互键三秒；移动、受伤和攻击会中断。接通后，停战指令会终止这组巡卫的攻击，四条出谷道路会开放。','The receiver repeats a distress call before it happens. Restore the minimum uplink at the service-yard cabinet, then compare it with the world.\nUse front cover or the north maintenance flank. Stand still and hold Interact for three seconds; movement, damage and attacks interrupt. Connecting sends the patrol a ceasefire and opens the four roads out of the Valley.'];
 const reward=done.has(COMPACT_RELAY.complete)
  ?['部署权限已保留。这次可以换条路线重练，不会重复领奖。','Your deployment access is retained. Try the other approach; replay does not grant another reward.']
  :['首次完成就在现场开放部署板，可自愿前往旧前哨站门外；不会替你启动中继器 B。','Your first completion opens the deployment board here: optionally travel to the old outpost gate. It does not activate Relay B for you.'];
 return[`停机坪服务庭院的巡卫会压住控制柜。正面借低掩体逼近，或走北侧维修路绕到侧面。\n站稳并按住自己的交互键 3 秒接通联络，即可让本场训练巡卫接令撤回；不强制全杀，停战也不算击杀。移动、受伤、攻击或松键会清空接通进度；中断后要松开再按。\n${reward[0]}`,`The service-yard patrol covers the relay cabinet. Advance through the front low cover or flank along the northern maintenance route.\nStand still and hold your Interact binding for 3 seconds to signal this training patrol to withdraw. A full clear is optional; ceasefire is not a kill. Movement, damage, attacks or releasing Interact reset channel progress; release and press again after an interruption.\n${reward[1]}`];
}
export function getCompactRelayInterrupt(reason:string):Localized{
 switch(reason){
  case 'released':return['接通已中断：交互键已松开。站稳后重新按住。','Connection interrupted: Interact released. Stand still and hold it again.'];
  case 'movement':return['接通已中断：发生移动。先站稳，松开交互键再按住。','Connection interrupted by movement. Stop, release Interact, then hold it again.'];
  case 'hurt':return['接通已中断：受到攻击。先找掩护，松开交互键再按住。','Connection interrupted by damage. Find cover, release Interact, then hold it again.'];
  case 'attack':return['接通已中断：你正在攻击。停火后松开交互键再按住。','Connection interrupted by your attack. Stop attacking, release Interact, then hold again.'];
  case 'out-of-range':return['接通已中断：离开机柜范围或视线受阻。靠近站稳，松开后再按。','Connection interrupted: outside cabinet range or line of sight. Reposition, then release and hold again.'];
  default:return['接通已暂停，进度已清空。回到可操作状态后松开交互键再按住。','Connection paused and progress reset. Resume play, release Interact, then hold it again.'];
 }
}
export interface CompactRelayGuide{title:Localized;text:Localized;targetId:string;targetKind:'marker';region:'alpha';}
export function getCompactRelayGuide(done:ReadonlySet<string>,context:CompactRelayContext={}):CompactRelayGuide{
 const state=getCompactRelayState(done,context);
 const at=(text:Localized,targetId:string):CompactRelayGuide=>({title:COMPACT_RELAY_TITLE,text,targetId,targetKind:'marker',region:'alpha'});
 switch(state.stage){
  case 'equipment':return at(['先在工坊武器架领取装备；演练就在停机坪旁，不必先通关旧主线。','Collect armory equipment; the exercise is beside the helipad, without a campaign-clear prerequisite.'],'armory_rack');
  case 'ready':return at(['到停机坪服务庭院入口主动开始演练；正面掩体或北侧维修路均可突破。','Start at the helipad service-yard entrance; use front cover or the northern flank.'],COMPACT_RELAY.entry);
  case 'active':return at(context.lastInterrupt?getCompactRelayInterrupt(context.lastInterrupt):['逼近控制柜，站稳按住交互键 3 秒；不必击败全部巡卫。','Reach the cabinet, stand still and hold Interact for 3 seconds; a full clear is optional.'],COMPACT_RELAY.controller);
  case 'channel':return at([`接通 ${state.progress.toFixed(1)}/3 秒：保持交互，别移动或攻击；受伤会中断。`,`Connecting ${state.progress.toFixed(1)}/3 s: hold Interact; moving, attacking or damage interrupts.`],COMPACT_RELAY.controller);
  case 'complete':return at(['前沿部署已永久开放。到部署板可前往旧前哨站门外；不改写原主线进度。','Forward deployment unlocked. Use the board for the old outpost gate; original campaign progress is unchanged.'],COMPACT_RELAY.deployment);
 }
}
