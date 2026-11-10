import {RelayChannel,type RelayChannelFrame} from './relayChannel';
import {ORLEANS_WORKS as W,ORLEANS_WORK_ACTIONS} from '../map/orleansWorks';
import type {Localized} from '../settlements/types';

export interface OrleansWorksHooks{
 done:Set<string>;save():boolean;changed():void;reachable(id:string):boolean;
 damage():number;toast(line:Localized):void;ring():void;sound():void;
}
/** Local public works, independent of the unreleased servant chapter. */
export function createOrleansWorksRuntime(h:OrleansWorksHooks){
 let active:string|null=null,channel:RelayChannel|null=null,bellCooldown=0,disposed=false;
 const action=(id:string)=>ORLEANS_WORK_ACTIONS.find(a=>a.id===id);
 const interrupt=()=>{channel?.reset(h.damage());channel=null;active=null;};
 return{
  get active(){return active;},get progress(){return channel?.progress??0;},get requiresRelease(){return channel?.requiresRelease??false;},
  interact(id:string){
   const a=action(id);if(disposed||!a||!h.reachable(id))return false;
   if(h.done.has(a.flag)){
    if(id===W.bell&&bellCooldown<=0){h.ring();bellCooldown=3;}
    else h.toast(id===W.crane?['粮袋已运到堤岸，河港继续收货。','The grain is on the quay; the harbour remains open.']:id===W.sluice?['检修栅已升起，可沿旧引水道往返。','The service grille is raised; the old watercourse is open.']:['钟声还在回荡。','The bell is still ringing.']);
    return true;
   }
   if(active===id)return true;
   interrupt();active=id;channel=new RelayChannel(a.seconds);channel.reset(h.damage());
   h.toast(a.hint);return true;
  },
  update(frame:Omit<RelayChannelFrame,'active'|'damageRevision'>){
   if(disposed)return;
   if(frame.playable&&Number.isFinite(frame.dt))bellCooldown=Math.max(0,bellCooldown-Math.min(.05,Math.max(0,frame.dt)));
   if(!active||!channel)return;
   const result=channel.update({...frame,active:true,damageRevision:h.damage()});
   if(result.interrupted){h.toast(['操作中断；站稳后松开，再按住交互。','Work interrupted. Stand still, release, then hold Interact again.']);interrupt();return;}
   if(!frame.playable||!frame.inRange||!frame.grounded||frame.moving||frame.attacking){interrupt();return;}
   if(!result.completedNow)return;
   if(!h.reachable(active)){interrupt();return;}
   const a=action(active)!;
   h.done.add(a.flag);const saved=h.save();
   if(a.id===W.bell){h.ring();bellCooldown=3;}else h.sound();
   interrupt();h.changed();
   const line:Localized=a.id===W.crane?['粮袋已落在堤岸，踏轮吊机恢复运转。','The grain reaches the quay; the treadwheel crane is working again.']:a.id===W.sluice?['铁栅升起：河港与城内之间的旧引水道已接通。','The grille rises: the old watercourse now connects the harbour and inner town.']:['钟楼报时，河港与城墙都听得到。','The belfry tolls across the quay and walls.'];
   h.toast(saved?line:[line[0]+' 本次记录尚未保存。',line[1]+' This record has not been saved.']);
  },
  interrupt,
  reset(){interrupt();bellCooldown=0;},
  dispose(){interrupt();disposed=true;},
 };
}
