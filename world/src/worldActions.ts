import * as THREE from 'three';
import { ContractSkills, type SkillSlot, type SkillEvent } from './contractSkills';
import { SkillPresentation } from './skillPresentation';
import { PlayerMelee, PlayerEvade } from './playerMelee';
import type { ServantId } from './contracts';
import type { Point3, HitContext } from './combat';
import type { StrikeRequest, StrikeResult, StrikeOriginGeometry } from './combatActions';
import { bilingual } from '../../shared-client/i18n';
export interface ActionPoseCommand {
 direction: Point3; contacts: number;
 onContact(position: Point3, direction: Point3, socket?: string, geometry?: StrikeOriginGeometry): void;
 onFinish(completed: boolean): void;
}
export interface WorldActionContext {
 enabled: boolean; grounded: boolean; armed: boolean; bladeReady: boolean; bladeFailed?: boolean;
 position: Point3; yaw: number; moveX: number; moveZ: number; identity: ServantId | null;
}
export interface WorldActionOptions {
 scene: THREE.Object3D;
 context(): WorldActionContext;
 strike(request: StrikeRequest, source: HitContext['source']): StrikeResult;
 defense(value: {guard:number;invulnerable:boolean}):void;
 startPose(identity:ServantId, command:ActionPoseCommand):boolean;
 cancelPoses():void;
 toast(message:string):void;
 reducedEffects():boolean;
 bladeDirection?():Point3;
 bladeOrigin?():Point3;
 cue?(kind:'melee'|'skill'|'evade'):void;
 onCast?(event: Extract<SkillEvent,{type:'cast'}>):void;
}
/** Browser integration boundary. All damage still goes through live combat LOS/range validation. */
export class WorldActions {
 readonly skills = new ContractSkills();
 readonly melee = new PlayerMelee();
 readonly evade = new PlayerEvade();
 readonly effects: SkillPresentation;
 private disposed = false;
 constructor(private options:WorldActionOptions){this.effects=new SkillPresentation(options.scene);}
 get equipmentReady(){return this.options.context().armed;}
 get meleeAvailable(){const c=this.options.context();return c.armed&&c.bladeReady;}
 press(action:string):boolean {
   if(!['skill','ultimate','melee','evade'].includes(action))return false;
   const c=this.options.context();
   if(!c.enabled||!c.grounded)return true;
   if(this.skills.selected!==c.identity){this.options.cancelPoses();this.skills.setIdentity(c.identity);}
   if(action==='melee'){
     if(!c.armed){this.options.toast(bilingual('先在营地领取装备。','Collect your equipment at camp first.'));return true;}
     if(!c.bladeReady){this.options.toast(c.bladeFailed?bilingual('近战模型加载失败，请重新加载页面后重试。','The melee model failed to load. Reload the page to retry.'):bilingual('近战武器正在加载。','Melee weapon is still loading.'));return true;}
     if(!this.skills.casting&&!this.evade.active&&this.melee.press(c.yaw+Math.PI))this.options.cue?.('melee');
     return true;
   }
   if(action==='evade'){
     if(this.skills.casting && this.skills.selected === null)return true;
     const x=-Math.sin(c.yaw)*c.moveZ+Math.cos(c.yaw)*c.moveX;
     const z=-Math.cos(c.yaw)*c.moveZ-Math.sin(c.yaw)*c.moveX;
     if(this.evade.start(x||z?x:Math.sin(c.yaw),x||z?z:Math.cos(c.yaw))){this.melee.cancel();this.options.cue?.('evade');}
     return true;
   }
   if(!c.armed){this.options.toast(bilingual('先在营地领取装备。','Collect your equipment at camp first.'));return true;}
   if(this.melee.active||this.evade.active||this.skills.casting)return true;
   const slot=action as SkillSlot;
   if(this.skills.cooldown(slot)>0){this.options.toast(bilingual('技能正在冷却。','Ability is cooling down.'));return true;}
   if(slot==='ultimate'&&this.skills.energy<100){this.options.toast(bilingual('命中敌人积蓄能量，满格后释放终结技。','Hit enemies to build energy; unleash your ultimate at full charge.'));return true;}
   const direction={x:-Math.sin(c.yaw),y:0,z:-Math.cos(c.yaw)};
   let token:number|null=null;
   if(c.identity){
     const started=this.options.startPose(c.identity,{direction,contacts:this.skills.definition(slot).pulses.length,
       onContact:(position,forward,_socket,geometry)=>{if(token!==null)this.skills.contact(token,position,forward,geometry);},
       onFinish:(completed)=>{if(token!==null)this.skills.finishPresentation(token,completed);}});
     if(!started){this.options.toast(bilingual('让从者靠近并面向目标；骑兵还需要安全的冲锋路线。','Bring your companion nearby and face a target; cavalry also needs a safe charge route.'));return true;}
   }
   if(!this.skills.activate(slot,{enabled:true,origin:c.position,direction})) {this.options.cancelPoses();return true;}
   if(c.identity)token=this.skills.bindPresentation();
   this.options.toast(bilingual(this.skills.definition(slot).name,this.skills.definition(slot).nameEn));
   this.flush();return true;
 }
 update(dt:number){
   if(this.disposed)return;
   const c=this.options.context();
   const enabled=c.enabled&&c.grounded;
   if(this.skills.selected!==c.identity){this.options.cancelPoses();this.skills.setIdentity(c.identity);}
   if(!enabled){this.cancel(); if(c.enabled){this.skills.update(dt,true);this.melee.update(dt,true);this.evade.update(dt,true);} this.effects.update(dt,false);return;}
   this.skills.update(dt,true);this.evade.update(dt,true);
   const contact=this.melee.update(dt,true);
   if(contact){
     const strike={origin:{...c.position},direction:{x:Math.sin(contact.yaw),y:0,z:Math.cos(contact.yaw)},range:contact.range,halfWidth:contact.halfWidth,damage:contact.damage,maxTargets:3};
     this.options.strike(strike,'melee');
     this.effects.show({...strike,type:'strike',identity:null,slot:'skill',pulse:contact.combo,at:0},this.options.reducedEffects(),{style:'melee',origin:this.options.bladeOrigin?.(),bladeDirection:this.options.bladeDirection?.()});
   }
   this.options.defense({guard:this.skills.guarding?.55:1,invulnerable:this.evade.remaining>.10});
   this.flush();
 }
 present(dt:number){const c=this.options.context();this.effects.update(dt,c.enabled&&c.grounded,this.options.reducedEffects());}
 /** Authored animation contacts arrive after actor update; resolve those in this same frame. */
 flush(){
   const c=this.options.context();
   if(!c.enabled||!c.grounded||this.skills.selected!==c.identity){this.cancel();return;}
   for(const event of this.skills.drainEvents()){
     if(event.type==='cast'){this.options.cue?.('skill');this.options.onCast?.(event);}
     if(event.type==='strike')this.options.strike(event,event.slot==='ultimate'?'ultimate':'skill');
     this.effects.show(event,this.options.reducedEffects());
   }
 }
 recordDamage(hit:{id:string;damage:number;source:HitContext['source'];eligible:boolean}){
   if(hit.source==='ranged'||hit.source==='melee')this.skills.recordDamage({...hit,source:hit.source==='ranged'?'weapon':'melee'});
 }
 cancel(){this.skills.cancel();this.melee.cancel();this.evade.update(0,false);this.options.cancelPoses();this.options.defense({guard:1,invulnerable:false});this.effects.clear();}
 reset(){this.cancel();this.skills.reset();this.melee.reset();this.evade.reset();}
 dispose(){if(this.disposed)return;this.disposed=true;this.cancel();this.effects.dispose();}
}
