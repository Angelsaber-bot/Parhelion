import {HERO_COMBAT as H,abilityFor,abilityAllowsGunplay,CHARACTERS} from '../../shared/content.ts';
import {quickAbilityPlacement,returnPathClear,sidestepTarget,domainContains} from '../../shared/heroes.ts';
import {type ArenaMap,type Vec3} from '../../shared/map.ts';
import type {Snapshot} from '../../shared/match.ts';
import {BTN,type Input,type PlayerState} from '../../shared/sim.ts';
/** Predict only the owner's action/pose. Devices, hits, scans and healing stay authoritative. */
export function predictAbility(map:ArenaMap,p:PlayerState,input:Input,snapshot:Snapshot|null){
  const a=p.ability,kind=CHARACTERS[p.char].ability,def=abilityFor(p.char),tick=p.abilityTick+1;
  for(const e of snapshot?.entities??[])if(e.kind==='edict'&&e.hp>0&&e.expires>tick&&tick-e.created>=H.edict.arm&&domainContains(map,e,p)){p.slowUntil=Math.max(p.slowUntil,tick+2);p.dashSealedUntil=Math.max(p.dashSealedUntil,tick+2);p.dashQueue=[];}
  const recover=(n:number)=>{a.phase='recovery';a.endTick=tick+n;a.lockUntil=a.endTick;};
  if(a.phase==='guard'&&(tick>=a.endTick||!(input.buttons&BTN.SHIELD)))recover(def.recovery);
  if(a.phase==='windup'&&tick>=a.endTick){if(kind==='guard'){a.phase='guard';a.endTick=tick+H.guard.hold;a.lockUntil=a.endTick+def.recovery;a.guardBudget=H.guard.budget;if(!(input.buttons&BTN.SHIELD))recover(def.recovery);}else if(kind==='decoy'&&a.dodgeTarget){a.phase='return';a.target=a.dodgeTarget;a.endTick=tick+H.decoy.travel;a.lockUntil=a.endTick+def.recovery;}else recover(def.recovery);}
  if(a.phase==='channel'&&tick>=a.endTick)recover(0);
  if(a.phase==='recovery'&&tick>=a.endTick)a.phase='idle';
  if(a.phase==='return'&&a.target){const d=[a.target[0]-p.x,a.target[1]-p.y,a.target[2]-p.z],length=Math.hypot(...d),step=Math.min(length,(kind==='decoy'?H.decoy.speed:17)/60),next:[number,number,number]=[p.x+(length?d[0]/length*step:0),p.y+(length?d[1]/length*step:0),p.z+(length?d[2]/length*step:0)];if(returnPathClear(map,p,next)){[p.x,p.y,p.z]=next;p.vx=p.vy=p.vz=0;if(length<=step+.001||tick>=a.endTick)recover(kind==='decoy'?def.recovery:21);}else recover(kind==='decoy'?def.recovery:21);}
  const pressed=input.buttons&~p.prevButtons;
  if(a.phase==='channel'&&(pressed&(BTN.SHIELD|BTN.JUMP|BTN.DASH))){recover(0);return;}
  if(!(pressed&BTN.SHIELD)||!p.alive||snapshot?.phase!=='live'||a.phase!=='idle'||p.dashT>0||p.meleeWindup>0||p.fireCd>0&&p.weaponSlot===2)return;
  const anchor=snapshot.entities?.find(e=>e.owner===p.id&&e.kind==='anchor'&&e.hp>0&&e.expires>tick);
  if(kind==='anchor'&&anchor){const point:Vec3=[anchor.x,anchor.y,anchor.z];if(returnPathClear(map,p,point)){a.phase='return';a.target=point;a.endTick=tick+18;a.lockUntil=tick+39;p.reload=0;p.dashQueue=[];}return;}
  const active=snapshot.entities?.find(e=>e.owner===p.id&&e.lifeId===p.lifeId&&e.kind===kind&&e.hp>0&&e.expires>tick);
  if(active&&kind==='lens'){recover(12);return;}
  if(tick<a.readyAt)return;
  const placement=quickAbilityPlacement(map,{...p,yaw:input.yaw,pitch:input.pitch},kind);if(placement.error)return;
  const dodge=kind==='decoy'?sidestepTarget(map,p,input):null;if(kind==='decoy'&&!dodge)return;
  Object.assign(a,{phase:'windup',readyAt:tick+def.cooldown,castSeq:a.castSeq+1,startTick:tick,endTick:tick+def.windup,lockUntil:tick+def.windup+def.recovery,target:placement.point,dodgeTarget:dodge??undefined,yaw:input.yaw,guardBudget:0,failure:'',failureUntil:0});
  if(!abilityAllowsGunplay(p.char)){p.reload=0;p.dashQueue=[];}
}
