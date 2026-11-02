import * as THREE from 'three';
import type {CharacterKit} from './characters/characterKit';
import type {KitCompanion} from './kitCompanion';
import type {Localized} from './settlements/types';
export interface CavalrySupportHooks{
 done:Set<string>;player:THREE.Vector3;actor():CharacterKit|undefined;follow:KitCompanion;
 start():{ok:boolean;reason?:Localized};target():{id:string;point:THREE.Vector3}|null;
 ground(x:number,z:number):number|null;clear(p:THREE.Vector3):boolean;
 strike(p:THREE.Vector3,direction:{x:number;y:number;z:number}):boolean;
 toast(line:Localized):void;save():void;changed():void;
}
/** One scripted local deployment borrows Napoleon's existing actor. It never
 * recruits, selects or recalls a companion and never creates a second horse AI. */
export class LocalCavalrySupport{
 private pending=false;private deployed=false;private charging=false;private generation=0;private cooldown=0;
 readonly signal=new THREE.Vector3(40,0,-687);
 constructor(private h:CavalrySupportHooks){}
 get needed(){return this.pending||this.deployed;}
 get ownsActor(){return this.deployed;}
 get busy(){return this.pending||this.charging;}
 request(){
  if(!this.h.done.has('napoleon_meet')||!this.h.done.has('adventure_winter_road')){this.h.toast(['先与拿破仑会面，并完整清开拒马走廊。','Meet Napoleon and clear the complete roadblock corridor first.']);return false;}
  if(this.busy||this.cooldown>0||this.h.follow.attacking){this.h.toast(['支援正在执行或整队，请先利用已经创造的突破窗口。','Support is executing or regrouping. Use the opening it has created.']);return false;}
  const result=this.h.start();if(!result.ok){this.h.toast(result.reason??['支援信号暂不能接通。','Cannot connect the support signal yet.']);return false;}
  this.pending=true;this.generation++;this.h.toast(['拿破仑收到突破信号。白马会从大道后方接近；你继续压制侧翼，当前同行从者保持不变。','Napoleon receives the breach signal. His white horse approaches from the rear; suppress the flank. Your current companion remains selected.']);return true;
 }
 update(dt:number,playable:boolean){
  if(!playable)return;this.cooldown=Math.max(0,this.cooldown-dt);
  if(this.h.player.distanceTo(new THREE.Vector3(40,this.h.player.y,-687))>90){if(this.pending||this.deployed)this.cancel();this.deployed=false;return;}
  if(!this.pending)return;
  if(this.h.player.distanceTo(new THREE.Vector3(40,this.h.player.y,-687))>25){this.cancel();return;}
  const actor=this.h.actor();if(!actor)return;const target=this.h.target();if(!target){this.pending=false;this.h.toast(['尚无可安全接触的目标。把阵地守卫引到已清出的宽街，再发信号。','No safely reachable target. Draw the guards onto the cleared wide road, then signal.']);return;}
  const stage=new THREE.Vector3(40,0,-695),floor=this.h.ground(stage.x,stage.z);if(floor===null){this.pending=false;return;}stage.y=floor;
  if(!this.h.clear(stage)){this.pending=false;this.h.toast(['马匹的整队位置受阻，支援没有发动。','The horse staging position is blocked; support did not start.']);return;}
  actor.root.position.copy(stage);actor.root.visible=true;actor.root.rotation.y=Math.atan2(target.point.x-stage.x,target.point.z-stage.z);actor.root.updateMatrixWorld(true);
  const token=this.generation,direction=target.point.clone().sub(stage).setY(0).normalize();this.deployed=true;this.pending=false;
  const started=this.h.follow.startSkillPose(actor,{slot:'skill',direction,targetId:target.id,targetPoint:target.point,contacts:1,
   onContact:(position,forward)=>{if(token!==this.generation)return;if(this.h.strike(new THREE.Vector3(position.x,position.y,position.z),forward)){this.h.done.add('adventure_winter_cavalry_contact');this.h.save();this.h.changed();}},
   onFinish:completed=>{if(token!==this.generation)return;this.charging=false;this.cooldown=completed?24:4;this.h.toast(completed?['骑兵完成一次突破，拿破仑在宽街接应；把握窗口继续推进。','The cavalry completes its breach; Napoleon covers the wide road. Use the opening to advance.']:['冲锋通路或目标已改变，拿破仑停止动作重新整队。','The charge route or target changed; Napoleon stops and regroups.']);}
  },this.h.player,actor.root.rotation.y);
  this.charging=started;if(started)this.cooldown=24;if(!started){this.cooldown=3;actor.play('idle');this.h.toast(['整匹马的冲锋通路不成立。继续清理走廊，再发信号；支援没有消耗同行技能。','No valid horse-sized charge corridor. Clear the approach and signal again; companion skills were not spent.']);}
 }
 present(actor:CharacterKit,dt:number,playable:boolean){if(!this.deployed)return false;if(this.charging)this.h.follow.update(actor,dt,this.h.player,actor.root.rotation.y,!playable);else{actor.play('idle');actor.update(dt,!playable);}return true;}
 yieldToCompanion(){if(!this.busy)this.deployed=false;}
 cancel(){const owned=this.deployed;this.generation++;this.pending=false;this.charging=false;if(owned)this.h.follow.cancelSkillPose(this.h.actor());}
 reset(){this.cancel();this.deployed=false;this.cooldown=0;}
}
