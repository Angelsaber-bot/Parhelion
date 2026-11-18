/** Hero authority. Tick deadlines are world time, never client packet counts. */
import { HERO_COMBAT as H, abilityFor, abilityAllowsGunplay, CHARACTERS, SHIELD, type AbilityId } from './content.ts';
import { smokeBlocks } from './grenade.ts';
import { playerHitbox, rayCapsule, rayPlayer, rayShield } from './hit.ts';
import { blockedAt, groundAt, lineOfSight, raycastMap, type ArenaMap, type Vec3 } from './map.ts';
import type { Match } from './match.ts';
import { aimDir, BTN, clonePlayer, forward, playerEye, type Input, type PlayerState } from './sim.ts';
import type { Smoke } from './grenade.ts';
import { freshAbility, type HeroEvent, type ReconMark, type TacticalEntity } from './heroState.ts';

export const BARRAGE_KILL = 101, WIND_KILL=102, BROADSIDE_KILL=103, SOLAR_KILL=104, EDICT_KILL=105, SWALLOW_KILL=106;
export const HERO_KILL_NAMES:Record<number,[string,string]>={101:['战争之神','God of war'],102:['风王铁槌','Wind king’s hammer'],103:['接舷钩','Boarding hook'],104:['日轮审判','Solar judgement'],105:['定身令','Edict of stillness'],106:['燕返','Swallow cut']};
/** Swallow cut: the furthest standing point up to six metres straight along the aim, or null when there is no room. */
export function swallowTarget(map:ArenaMap,p:PlayerState,yaw:number):Vec3|null {
  const [dx,dz]=forward(yaw);
  let result:Vec3|null=null;for(let d=.1;d<=H.decoy.distance+.001;d+=.1){const dest:Vec3=[p.x+dx*d,p.y,p.z+dz*d];if(!returnPathClear(map,p,dest,H.decoy.distance))break;result=dest;}
  return result&&distance(at(p),result)>=.5?result:null;
}
/** Napoleon's recoil: the shot throws the gunner straight back, the same way on the server and in prediction. */
export function applyRecoil(p:PlayerState){const [fx,fz]=forward(p.yaw),v=H.barrage.recoil/H.barrage.recoilTicks*60;Object.assign(p,{pullT:H.barrage.recoilTicks,pullX:-fx*v,pullZ:-fz*v,dashT:0,dashQueue:[]});}
/** Horizontal distance from a point to the segment a-b. */
function segmentDistance(a:Vec3,b:Vec3,x:number,z:number){const sx=b[0]-a[0],sz=b[2]-a[2],l=sx*sx+sz*sz,k=l>1e-9?Math.max(0,Math.min(1,((x-a[0])*sx+(z-a[2])*sz)/l)):0;return Math.hypot(a[0]+sx*k-x,a[2]+sz*k-z);}
/** Edict of stillness: an enemy close to the aim line within reach takes the edict at their feet; otherwise it lands where the aim meets the ground.
 *  Smoke never stops the snap (the edict reaches through smoke); a wall still does, so it cannot lock onto unseen enemies. */
export function edictPlacement(map:ArenaMap,p:PlayerState,enemies:readonly PlayerState[],_smokes:readonly Smoke[]=[]):{point:Vec3;error:string} {
  const eye:Vec3=[p.x,p.y+playerEye(map,p),p.z],dir=aimDir(p.yaw,p.pitch),reach=abilityFor(p.char).range;
  let best:PlayerState|null=null,score=Infinity;
  for(const e of enemies){
    if(!e.alive||e.team===p.team)continue;
    const c:Vec3=[e.x,e.y+.9,e.z],d=c.map((v,i)=>v-eye[i]) as Vec3,along=d[0]*dir[0]+d[1]*dir[1]+d[2]*dir[2];
    if(along<=0||Math.hypot(e.x-p.x,e.z-p.z)>reach)continue;
    const off=Math.sqrt(Math.max(0,d[0]*d[0]+d[1]*d[1]+d[2]*d[2]-along*along));
    if(off>H.edict.snap||!lineOfSight(map,eye,c))continue;
    if(off+along*.02<score){score=off+along*.02;best=e;}
  }
  if(best){const dx=best.x-eye[0],dy=best.y-.01-eye[1],dz=best.z-eye[2];const snapped=abilityPlacement(map,{...p,yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz))},'edict');if(!snapped.error)return snapped;}
  const direct=abilityPlacement(map,p,'edict');if(!direct.error)return direct;
  const near=quickAbilityPlacement(map,p,'edict');return near.error?direct:near;
}
const at = (p:{x:number;y:number;z:number}):Vec3 => [p.x,p.y,p.z];
const distance = (a:Vec3,b:Vec3) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const angle = (a:number) => Math.atan2(Math.sin(a),Math.cos(a));

export function tacticalPoints(e:TacticalEntity):Vec3[] {if(e.kind==='prayer')return [[e.x,e.y+.45,e.z],[e.x+Math.cos(e.yaw)*.36,e.y+1.35,e.z-Math.sin(e.yaw)*.36],[e.x,e.y+1.75,e.z]];return [[e.x,e.y+(e.kind==='lens'?1.3:.25),e.z]];}
export function rayTactical(origin:Vec3,dir:Vec3,e:TacticalEntity):{t:number;endpoint:number}|null {
  if(!['anchor','lens','prayer'].includes(e.kind)||e.hp<=0)return null;
  let best:{t:number;endpoint:number}|null=null;
  for(const [endpoint,p] of tacticalPoints(e).entries()) {
    const delta=p.map((n,i)=>n-origin[i]);
    const along=delta.reduce((sum,n,i)=>sum+n*dir[i],0),radius=e.kind==='lens'?.28:e.kind==='prayer'?.3:.25;
    const perpendicular2=Math.max(0,delta.reduce((sum,n)=>sum+n*n,0)-along*along);
    if(perpendicular2>radius*radius+1e-9)continue;
    const half=Math.sqrt(Math.max(0,radius*radius-perpendicular2));
    if(along+half<0)continue;
    const t=Math.max(0,along-half);
    if(!best||t<best.t)best={t,endpoint};
  }
  return best;
}

/** Full standing capsule sweep, including support and map bounds; a ray alone is insufficient. */
export function returnPathClear(map:ArenaMap, p:PlayerState, dest:Vec3, reach=5):boolean {
  if (!p.grounded || Math.abs(dest[1]-p.y)>.25 || distance(at(p),dest)>reach+.001) return false;
  const n=Math.max(1,Math.ceil(distance(at(p),dest)/.05)), b=map.movementBounds;
  for(let i=0;i<=n;i++) {
    const k=i/n,x=p.x+(dest[0]-p.x)*k,z=p.z+(dest[2]-p.z)*k,y=p.y+(dest[1]-p.y)*k;
    if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ||blockedAt(map,x,z,y,map.height)||Math.abs(groundAt(map,x,z,y+.05)-y)>.25) return false;
  }
  return true;
}
export function abilityPlacement(map:ArenaMap,p:PlayerState,kind:AbilityId):{point:Vec3; error:string} {
  if(kind==='guard'||kind==='barrage'||kind==='curtain'||kind==='decoy')return {point:at(p),error:''};
  if(kind==='prayer')return {point:at(p),error:p.grounded?'':'圣旗需要站立地面 / Banner needs supported ground'};
  const def=abilityFor(p.char), eye:Vec3=[p.x,p.y+playerEye(map,p),p.z], dir=aimDir(p.yaw,p.pitch);
  let point:Vec3;
  if(kind==='anchor') point=at(p);
  else if(kind==='barrier') point=[p.x-Math.sin(p.yaw)*def.range,p.y,p.z-Math.cos(p.yaw)*def.range];
  else {
    const hit=raycastMap(map,eye,dir,def.range+2);
    if(Number.isFinite(hit)&&hit<=def.range+.001) point=eye.map((v,i)=>v+dir[i]*hit) as Vec3;
    else {const horizontal=Math.min(def.range, p.pitch<-.02?playerEye(map,p)/-Math.tan(p.pitch):def.range);point=[p.x-Math.sin(p.yaw)*horizontal,p.y,p.z-Math.cos(p.yaw)*horizontal];}
  }
  const b=map.movementBounds;
  if(point[0]<b.minX||point[0]>b.maxX||point[2]<b.minZ||point[2]>b.maxZ) return {point,error:'超出场地 / Outside arena'};
  const floor=groundAt(map,point[0],point[2],point[1]+.06,0);
  if(floor<-90||Math.abs(floor-point[1])>.3) return {point,error:'需要可站立地面 / Need supported ground'};
  point[1]=floor;
  if(distance(eye,[point[0],point[1]+playerEye(map,p),point[2]])>def.range+.35 && !['guard','prayer'].includes(kind)) return {point,error:'超出技能距离 / Out of range'};
  if(blockedAt(map,point[0],point[2],point[1],map.height)||!lineOfSight(map,eye,[point[0],point[1]+.15,point[2]])) return {point,error:'实体遮挡 / Solid obstruction'};
  if(kind==='anchor'&&(!p.grounded||Math.abs(point[1]-p.y)>.25)) return {point,error:'需要同层平地 / Need level ground'};
  if(kind==='barrier') {
    const half=1.2;
    const thin={...map,radius:.09};
    const depths=[0];
    for(const depth of depths)for(let u=-half;u<=half+.01;u+=.1) {
      const x=point[0]+Math.cos(p.yaw)*u-Math.sin(p.yaw)*depth,z=point[2]-Math.sin(p.yaw)*u-Math.cos(p.yaw)*depth;
      if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ||Math.abs(groundAt(map,x,z,point[1]+.06,0)-point[1])>.08||blockedAt(thin,x,z,point[1],2)) return {point,error:'整幅范围须平整无遮挡 / Footprint obstructed'};
    }
  }
  if(!['guard','prayer'].includes(kind)) for(const zone of map.data.tactical?.spawnZones??[]) {
    const padding=zone.padding??3;
    const footprint=kind==='edict'?H.edict.radius:kind==='barrier'?1.2:0;
    if(zone.team!==p.team&&point[0]>=zone.min[0]-padding-footprint&&point[0]<=zone.max[0]+padding+footprint&&point[2]>=zone.min[1]-padding-footprint&&point[2]<=zone.max[1]+padding+footprint) return {point,error:'敌方出生缓冲区 / Enemy spawn buffer'};
  }
  return {point,error:''};
}
/** Quick cast uses horizontal facing, never the gun's vertical aim. No camera mutation. */
export function quickAbilityPlacement(map:ArenaMap,p:PlayerState,kind:AbilityId){
  const preferred:Partial<Record<AbilityId,number>>={lens:4,edict:4};
  const maximum=preferred[kind];if(maximum===undefined)return abilityPlacement(map,p,kind);
  let failure:{point:Vec3;error:string}|undefined;
  // Back off toward the caster.
  for(let d=maximum;d>=1;d-=.5){
    const result=abilityPlacement(map,{...p,pitch:-Math.atan2(playerEye(map,p),d)},kind);
    failure??=result;if(!result.error)return result;
  }
  return failure!;
}
/** The edict's circle reaches through walls, buildings, smoke and every floor above or below it. */
export function domainContains(_map:ArenaMap,e:Pick<TacticalEntity,'x'|'y'|'z'|'team'>,p:PlayerState){return p.alive&&p.team!==e.team&&Math.hypot(p.x-e.x,p.z-e.z)<=H.edict.radius;}
export function guardFaces(yaw:number,pitch:number,origin:Vec3,target:Vec3):boolean {
  const dx=origin[0]-target[0],dy=origin[1]-target[1],dz=origin[2]-target[2];
  return Math.abs(angle(Math.atan2(-dx,-dz)-yaw))<=70*Math.PI/180+1e-8 && Math.abs(Math.atan2(dy,Math.hypot(dx,dz))-pitch)<=50*Math.PI/180+1e-8;
}
export class HeroSystem {
  entities:TacticalEntity[]=[];
  marks:ReconMark[]=[];
  private serial=1;
  private guardSpent=new Map<string,number>();
  constructor(private m:Match) {}
  private emit(p:PlayerState,action:HeroEvent['action'],point=at(p),amount?:number) {this.m.emit({t:'ability',id:p.id,castSeq:p.ability.castSeq,kind:CHARACTERS[p.char].ability,action,at:point,amount});}
  reset() {this.entities=[];this.marks=[];this.guardSpent.clear(); for(const s of this.m.slots.values())s.state.ability=freshAbility();}
  clearLife(id:string) {
    this.entities=this.entities.filter(e=>e.owner!==id||e.kind==='barrage');
    this.m.shields=this.m.shields.filter(e=>e.owner!==id);
    for(const key of this.guardSpent.keys())if(key.startsWith(id+':'))this.guardSpent.delete(key);
    const p=this.m.player(id);if(p){p.ability={...freshAbility(),readyAt:p.ability.readyAt,castSeq:p.ability.castSeq};p.slowUntil=0;p.dashSealedUntil=0;p.rootUntil=0;p.revealedUntil=0;p.exposedUntil=0;p.pullT=0;}
  }
  private fail(p:PlayerState,message:string) {this.m.stats.abilityEvent(p.id,'rejected');p.ability.failure=message;p.ability.failureUntil=this.m.tick+100;}
  input(p:PlayerState,inp:Input) {
    const tick=this.m.tick,a=p.ability,kind=CHARACTERS[p.char].ability;
    p.abilityTick=tick-1; p.shieldCd=Math.max(0,a.readyAt-tick);
    const pressed=inp.buttons&~p.prevButtons;
    if(!p.alive)return;
    if(a.phase==='channel'&&(pressed&(BTN.SHIELD|BTN.JUMP|BTN.DASH))) {this.cancel(p);return;}
    if(a.phase==='guard'&&!(inp.buttons&BTN.SHIELD)) {a.yaw=inp.yaw;this.windSlash(p);}
    if(!(pressed&BTN.SHIELD))return;
    if(this.m.phase!=='live'){this.fail(p,'等待比赛开始 / Match not live');return;}
    if(a.phase!=='idle'||p.dashT>0||p.meleeWindup>0||this.m.slots.get(p.id)!.meleeReadyTick>tick){this.fail(p,'动作忙碌 / Action busy');return;}
    const anchor=this.entities.find(e=>e.owner===p.id&&e.kind==='anchor'&&e.expires>tick&&e.hp>0);
    if(kind==='anchor'&&anchor) {
      if(!returnPathClear(this.m.map,p,at(anchor))){this.fail(p,'回位须在 5 米内、同层且无遮挡 / Return path blocked');return;}
      a.phase='return';a.target=at(anchor);a.endTick=tick+18;a.lockUntil=tick+39;a.returnId=anchor.id;
      p.reload=0;p.dashQueue=[];this.entities=this.entities.filter(e=>e!==anchor);this.emit(p,'trigger');return;
    }
    const active=this.entities.find(e=>e.owner===p.id&&e.lifeId===p.lifeId&&e.kind===kind&&e.expires>tick&&e.hp>0);
    if(kind==='lens'&&active){active.yaw=inp.yaw;this.recover(p,12);this.emit(p,'trigger',at(active));return;}
    if(tick<a.readyAt){this.fail(p,'技能冷却中 / Ability cooling down');return;}
    const candidate={...p,yaw:inp.yaw,pitch:inp.pitch};
    const placement=kind==='edict'?edictPlacement(this.m.map,candidate,[...this.m.slots.values()].map(s=>s.state),this.m.smokes):quickAbilityPlacement(this.m.map,candidate,kind);
    if(placement.error){this.fail(p,placement.error);return;}
    const dodge=kind==='decoy'?swallowTarget(this.m.map,p,inp.yaw):null;
    if(kind==='decoy'&&!dodge){this.fail(p,'燕返路线受阻 / Swallow cut path blocked');return;}
    const def=abilityFor(p.char);
    Object.assign(a,{phase:'windup',readyAt:tick+def.cooldown,castSeq:a.castSeq+1,startTick:tick,endTick:tick+def.windup,lockUntil:tick+def.windup+def.recovery,target:placement.point,dodgeTarget:dodge??undefined,yaw:inp.yaw,guardBudget:0,failure:'',failureUntil:0,struck:[]});
    this.m.slots.get(p.id)!.spawnProtectedUntilTick=tick;
    if(!abilityAllowsGunplay(p.char)){p.reload=0;p.dashQueue=[];}
    this.emit(p,'accepted',placement.point);
  }
  private recover(p:PlayerState,ticks:number) {p.ability.phase='recovery';p.ability.endTick=this.m.tick+ticks;p.ability.lockUntil=this.m.tick+ticks;}
  private cancel(p:PlayerState) {this.emit(p,'cancel');this.recover(p,0);}
  damaged(p:PlayerState) {p.lastDamageTick=this.m.tick;if(p.ability.phase==='channel')this.cancel(p);}
  /** Historical eligibility, current shared per-cast budget: history never refunds absorbed damage. */
  absorb(p:PlayerState,raw:number,origin:Vec3,pose?:{yaw:number;pitch:number;guardSeq:number;guard:boolean;life:number;x:number;y:number;z:number}):number {
    const a=p.ability,valid=pose?pose.guard&&pose.life===p.lifeId:a.phase==='guard';
    if(!valid||!guardFaces(pose?.yaw??p.yaw,pose?.pitch??p.pitch,origin,pose?[pose.x,pose.y+1.1,pose.z]:[p.x,p.y+1.1,p.z]))return raw;
    const seq=pose?.guardSeq??a.castSeq,key=`${p.id}:${p.lifeId}:${seq}`,spent=this.guardSpent.get(key)??0,absorb=Math.min(raw,Math.max(0,H.guard.budget-spent));
    this.guardSpent.set(key,spent+absorb);
    if(seq===a.castSeq){a.guardBudget=H.guard.budget-spent-absorb;if(a.guardBudget<=0&&a.phase==='guard')this.windSlash(p);}
    if(absorb>0)this.emit(p,'blocked',at(p),absorb);
    return raw-absorb;
  }
  visible(a:Vec3,b:Vec3):boolean {
    if(!lineOfSight(this.m.map,a,b)||smokeBlocks(this.m.smokes,a,b))return false;
    const len=distance(a,b);if(len<.001)return true;const dir=b.map((v,i)=>(v-a[i])/len) as Vec3;
    return !this.m.shields.some(s=>s.hp>0&&s.life>0&&rayShield(a,dir,s.x,s.y,s.z,s.yaw)<len);
  }
  private windSlash(p:PlayerState){
    const amount=H.guard.damage+Math.round((H.guard.budget-p.ability.guardBudget)/H.guard.budget*H.guard.bonus),origin:Vec3=[p.x,p.y+1.1,p.z];
    this.recover(p,abilityFor(p.char).recovery);this.emit(p,'pulse',at(p),amount);
    for(const {state:enemy} of this.m.slots.values())if(enemy.alive&&enemy.team!==p.team&&distance(at(p),at(enemy))<=H.guard.range&&Math.abs(angle(Math.atan2(-(enemy.x-p.x),-(enemy.z-p.z))-p.ability.yaw))<=H.guard.halfAngle&&this.visible(origin,[enemy.x,enemy.y+1.1,enemy.z])){
      this.m.heroDamage(p.id,p.team,enemy.id,amount,WIND_KILL);
      // The wind throws survivors straight away from her.
      const dx=enemy.x-p.x,dz=enemy.z-p.z,len=Math.hypot(dx,dz)||1,v=H.guard.push/H.guard.pushTicks*60;
      if(enemy.alive&&!this.m.spawnProtected(enemy.id))Object.assign(enemy,{pullT:H.guard.pushTicks,pullX:dx/len*v,pullZ:dz/len*v,dashT:0,dashQueue:[]});
    }
  }
  protectedByBanner(p:PlayerState){return this.entities.some(e=>e.kind==='prayer'&&e.team===p.team&&e.hp>0&&e.expires>this.m.tick&&distance(at(e),at(p))<=H.prayer.radius&&this.visible([e.x,e.y+1,e.z],[p.x,p.y+1.1,p.z]));}

  /** Called before attacks so deadlines and expired guard/objects cannot be used for an extra tick. */
  begin() {
    const tick=this.m.tick;
    this.entities=this.entities.filter(e=>e.hp>0&&e.expires>tick);
    this.marks=this.marks.filter(e=>e.expires>tick&&this.m.player(e.victim)?.lifeId===e.lifeId&&this.m.player(e.victim)?.alive);
    for(const s of this.m.slots.values()) {
      const p=s.state,a=p.ability;p.abilityTick=tick;p.shieldCd=Math.max(0,a.readyAt-tick);
      if(!p.alive)continue;
      if(a.phase==='guard'&&tick>=a.endTick)this.windSlash(p);
      if(a.phase==='recovery'&&tick>=a.endTick)a.phase='idle';
      if(a.phase==='windup'&&tick>=a.endTick) {
        const kind=CHARACTERS[p.char].ability;
        if(kind==='guard') {a.phase='guard';a.guardBudget=H.guard.budget;a.endTick=tick+H.guard.hold;a.lockUntil=a.endTick+abilityFor(p.char).recovery;if(!(p.prevButtons&BTN.SHIELD))this.windSlash(p);}
        else if(kind==='decoy'&&a.dodgeTarget){a.phase='return';a.target=a.dodgeTarget;a.endTick=tick+H.decoy.travel;a.lockUntil=a.endTick+abilityFor(p.char).recovery;this.emit(p,'spawn',a.dodgeTarget);}
        else {this.spawn(p);this.recover(p,abilityFor(p.char).recovery);}
      }
      if(a.phase==='return'&&a.target) {
        const delta=a.target.map((v,i)=>v-at(p)[i]) as Vec3,len=Math.hypot(...delta);
        const step=Math.min((CHARACTERS[p.char].ability==='decoy'?H.decoy.speed:17)/60,len),next=at(p).map((v,i)=>v+(len>0?delta[i]/len*step:0)) as Vec3;
        const from=at(p),swallow=CHARACTERS[p.char].ability==='decoy';
        if(!returnPathClear(this.m.map,p,next,swallow?H.decoy.distance:5)){this.fail(p,'回位中断 / Return interrupted');this.recover(p,CHARACTERS[p.char].ability==='decoy'?abilityFor(p.char).recovery:21);}
        else {p.x=next[0];p.y=next[1];p.z=next[2];p.vx=p.vz=p.vy=0;if(swallow)this.swallow(p,from,next);if(p.ability.phase==='return'&&(len<=step+.001||tick>=a.endTick))this.recover(p,swallow?abilityFor(p.char).recovery:21);}
      }
    }
  }
  private spawn(p:PlayerState) {
    const a=p.ability,kind=CHARACTERS[p.char].ability,point=a.target??at(p),tick=this.m.tick;
    // Placement is fixed at acceptance; map collision is static for the entire round.
    if(kind==='barrier') {
      this.m.shields=this.m.shields.filter(s=>s.owner!==p.id);
      this.m.shields.push({id:100000+this.serial++,owner:p.id,team:p.team,x:point[0],y:point[1],z:point[2],yaw:a.yaw,hp:SHIELD.hp,life:SHIELD.life,created:tick,expires:tick+SHIELD.life});
    } else if(kind==='barrage'||kind==='curtain') {
      // Cannonball and hook leave from the eye along the current aim, so they go where the crosshair is.
      const eye:Vec3=[p.x,p.y+playerEye(this.m.map,p)-.12,p.z],dir=aimDir(p.yaw,p.pitch),spec=kind==='barrage'?H.barrage:H.curtain;
      this.entities.push({id:this.serial++,kind,owner:p.id,lifeId:p.lifeId,team:p.team,castSeq:a.castSeq,x:eye[0],y:eye[1],z:eye[2],yaw:p.yaw,hp:1,created:tick,expires:tick+Math.ceil(spec.range/spec.speed*60)+2,pulse:0,travelled:0,char:p.char,weapon:p.weapon,name:this.m.slots.get(p.id)!.info.name,shownHp:p.hp,dx:dir[0],dy:dir[1],dz:dir[2],ox:eye[0],oy:eye[1],oz:eye[2]});
      if(kind==='barrage')applyRecoil(p);
    } else {
      const life:Partial<Record<AbilityId,number>>={anchor:150,lens:H.lens.life,edict:H.edict.arm+H.edict.life,prayer:H.prayer.life};
      const e:TacticalEntity={id:this.serial++,kind,owner:p.id,lifeId:p.lifeId,team:p.team,castSeq:a.castSeq,x:point[0],y:point[1],z:point[2],yaw:a.yaw,hp:kind==='prayer'?H.prayer.hp:kind==='lens'?H.lens.hp:kind==='edict'?1:40,created:tick,expires:tick+(life[kind]??1),pulse:0,travelled:0,char:p.char,weapon:p.weapon,name:this.m.slots.get(p.id)!.info.name,shownHp:p.hp};
      this.entities.push(e);
    }
    this.emit(p,'spawn',point);
  }
  /** After damage, before healing: destructible devices destroyed this tick cannot scan. */
  effects(_previous:Map<string,Vec3>) {
    const tick=this.m.tick;
    for(const e of this.entities) {
      if(e.hp<=0||e.expires<=tick)continue;
      const age=tick-e.created;
      if(e.kind==='barrage')this.roll(e);
      else if(e.kind==='curtain'&&e.victim===undefined)this.fly(e);
      else if(e.kind==='curtain'){const v=this.m.player(e.victim!);if(!v?.alive||v.pullT<=0)e.hp=0;else{e.x=v.x;e.y=v.y+1.1;e.z=v.z;}}
      if(e.kind==='lens'&&e.pulse<H.lens.pulses&&age>=H.lens.warning+H.lens.interval*e.pulse) {
        e.pulse++;this.entityEvent(e,'pulse');
        for(const {state:p} of this.m.slots.values()) {
          if(!p.alive||p.team===e.team||distance([e.x,e.y+1.3,e.z],[p.x,p.y+1.1,p.z])>H.lens.range)continue;
          if(Math.abs(angle(Math.atan2(-(p.x-e.x),-(p.z-e.z))-e.yaw))>H.lens.halfAngle+1e-8||!this.visible([e.x,e.y+1.3,e.z],[p.x,p.y+1.1,p.z]))continue;
          this.m.heroDamage(e.owner,e.team,p.id,H.lens.damage,SOLAR_KILL);
          this.marks.push({id:`${e.id}:${e.pulse}:${p.id}:${p.lifeId}`,source:e.id,team:e.team,victim:p.id,lifeId:p.lifeId,x:p.x,y:p.y,z:p.z,expires:tick+H.lens.mark});
        }
      }
      // Once it lands the edict is a zone until it expires: everyone inside is slowed, and every enemy
      // life that is inside at the pulse or walks in later is rooted once, then exposed and revealed
      // until the zone ends.
      if(e.kind==='edict'&&age>=H.edict.arm){
        if(e.pulse===0){e.pulse=1;this.entityEvent(e,'pulse');}
        const struck=e.struck??=[];
        for(const {state:p} of this.m.slots.values()){
          if(!domainContains(this.m.map,e,p)||this.m.spawnProtected(p.id))continue;
          p.slowUntil=Math.max(p.slowUntil,tick+H.edict.linger);
          const life=`${p.id}:${p.lifeId}`;if(struck.includes(life))continue;struck.push(life);
          p.rootUntil=tick+H.edict.root;p.exposedUntil=e.expires;p.revealedUntil=e.expires;p.dashT=0;p.dashQueue=[];p.pullT=0;p.vx=p.vz=0;
          this.m.emit({t:'ability',id:e.owner,castSeq:e.castSeq,kind:e.kind,action:'trigger',at:at(p)});
        }
      }
    }
    this.entities=this.entities.filter(e=>e.hp>0&&e.expires>tick);
  }
  /** Swallow cut: every enemy the blades pass this tick takes one hit per cast; a kill readies the next cut at once. */
  private swallow(p:PlayerState,from:Vec3,to:Vec3){
    const a=p.ability,struck=a.struck??=[];
    for(const {state:v} of this.m.slots.values()){
      if(!v.alive||v.team===p.team||struck.includes(v.id)||Math.abs(v.y-p.y)>1.6||segmentDistance(from,to,v.x,v.z)>H.decoy.width)continue;
      if(!lineOfSight(this.m.map,[p.x,p.y+1,p.z],[v.x,v.y+1,v.z]))continue;
      struck.push(v.id);this.m.emit({t:'ability',id:p.id,castSeq:a.castSeq,kind:'decoy',action:'pulse',at:[v.x,v.y+1,v.z]});
      this.m.heroDamage(p.id,p.team,v.id,H.decoy.damage,SWALLOW_KILL);
      if(!v.alive){a.readyAt=this.m.tick;this.emit(p,'trigger',at(p));}
    }
  }
  /** One tick of the round shot: it passes through every enemy (70 each, knocked back), shatters shields and
   *  devices on the way, and bursts against the first wall. */
  private roll(e:TacticalEntity){
    const spec=H.barrage,o:Vec3=[e.x,e.y,e.z],d:Vec3=[e.dx??0,e.dy??0,e.dz??-1],struck=e.struck??=[];
    const len=Math.min(spec.speed/60,spec.range-e.travelled),wall=raycastMap(this.m.map,o,d,len),hitWall=Number.isFinite(wall)&&wall<=len,stop=hitWall?wall:len;
    for(const s of this.m.shields)if(s.hp>0&&s.life>0&&rayShield(o,d,s.x,s.y,s.z,s.yaw)<=stop)this.m.damageShield(s,s.hp);
    for(const other of this.entities){const key=`device:${other.id}`;if(other===e||other.team===e.team||!this.destructible(other)||struck.includes(key))continue;const h=rayTactical(o,d,other);if(h&&h.t<=stop){struck.push(key);this.hit(other,spec.damage);}}
    const l=Math.hypot(d[0],d[2])||1;
    for(const {state:p} of this.m.slots.values()){
      if(!p.alive||p.team===e.team||struck.includes(p.id))continue;
      const box=playerHitbox(p.crouched);if(rayCapsule(o,d,p.x,p.z,p.y+box.bodyBottom+box.bodyRadius,p.y+box.headY,box.bodyRadius+spec.ball)>stop)continue;
      struck.push(p.id);
      if(this.guardStops(e,p,spec.damage,o))return;
      this.m.emit({t:'ability',id:e.owner,castSeq:e.castSeq,kind:e.kind,action:'trigger',at:[p.x,p.y+1.1,p.z]});
      this.m.heroDamage(e.owner,e.team,p.id,spec.damage,BARRAGE_KILL);
      if(p.alive&&!this.m.spawnProtected(p.id)){p.vx+=d[0]/l*spec.knockback;p.vz+=d[2]/l*spec.knockback;p.vy=Math.max(p.vy,spec.lift);p.grounded=false;p.dashT=0;p.dashQueue=[];}
    }
    e.x=o[0]+d[0]*stop;e.y=o[1]+d[1]*stop;e.z=o[2]+d[2]*stop;e.travelled+=stop;
    if(hitWall){this.strike(e,[e.x,e.y,e.z],spec.radius,spec.splash,BARRAGE_KILL,new Set(struck));e.hp=0;}
    else if(e.travelled>=spec.range-1e-6)e.hp=0;
  }
  /** Artoria's guard: a cannonball or hook meeting her from the front is absorbed into the guard and stops there. */
  private guardStops(e:TacticalEntity,p:PlayerState,damage:number,from:Vec3):boolean{
    if(p.ability.phase!=='guard')return false;
    const left=this.absorb(p,damage,from);if(left>=damage)return false;
    if(left>0)this.m.heroDamage(e.owner,e.team,p.id,left,e.kind==='barrage'?BARRAGE_KILL:BROADSIDE_KILL);
    e.x=p.x;e.y=p.y+1.1;e.z=p.z;e.hp=0;this.m.emit({t:'ability',id:e.owner,castSeq:e.castSeq,kind:e.kind,action:'break',at:[p.x,p.y+1.1,p.z]});
    return true;
  }
  /** One tick of hook flight: the first wall, shield, device or enemy along the way stops it. */
  private fly(e:TacticalEntity){
    const spec=H.curtain,o:Vec3=[e.x,e.y,e.z],d:Vec3=[e.dx??0,e.dy??0,e.dz??-1];
    const len=Math.min(spec.speed/60,spec.range-e.travelled);
    let t=raycastMap(this.m.map,o,d,len),hit:'wall'|'shield'|'device'|'player'|null=Number.isFinite(t)&&t<=len?'wall':null,victim:PlayerState|null=null,device:TacticalEntity|null=null;
    if(!hit)t=len;
    for(const s of this.m.shields){if(s.hp<=0||s.life<=0)continue;const ts=rayShield(o,d,s.x,s.y,s.z,s.yaw);if(ts<t){t=ts;hit='shield';}}
    for(const other of this.entities){if(other===e||other.team===e.team||!this.destructible(other))continue;const h=rayTactical(o,d,other);if(h&&h.t<t){t=h.t;hit='device';device=other;}}
    for(const {state:p} of this.m.slots.values()){
      if(!p.alive||p.team===e.team)continue;
      const box=playerHitbox(p.crouched),tp=rayCapsule(o,d,p.x,p.z,p.y+box.bodyBottom+box.bodyRadius,p.y+box.headY,box.bodyRadius+spec.radius);
      if(tp<t){t=tp;hit='player';victim=p;}
    }
    e.x=o[0]+d[0]*t;e.y=o[1]+d[1]*t;e.z=o[2]+d[2]*t;e.travelled+=t;
    const point:Vec3=[e.x,e.y,e.z];
    if(!hit){if(e.travelled>=spec.range-1e-6)this.miss(e,point);return;}
    if(hit!=='player'||!victim){if(device)this.hit(device,H.curtain.damage);this.miss(e,point);return;}
    if(this.guardStops(e,victim,H.curtain.damage,o))return;
    this.m.emit({t:'ability',id:e.owner,castSeq:e.castSeq,kind:e.kind,action:'pulse',at:[victim.x,victim.y+1.1,victim.z]});
    this.m.heroDamage(e.owner,e.team,victim.id,H.curtain.damage,BROADSIDE_KILL);
    const owner=this.m.player(e.owner);
    if(!victim.alive||!owner?.alive||this.m.spawnProtected(victim.id)){e.hp=0;return;}
    // Drag the catch to a spot just in front of the caster; walls still stop the body on the way.
    const [fx,fz]=forward(owner.yaw),gx=owner.x+fx*H.curtain.pullTo-victim.x,gz=owner.z+fz*H.curtain.pullTo-victim.z,gap=Math.hypot(gx,gz);
    if(gap<.3){e.hp=0;victim.slowUntil=Math.max(victim.slowUntil,this.m.tick+H.curtain.slow);return;}
    const ticks=Math.min(H.curtain.maxPull,Math.ceil(gap/(H.curtain.pullSpeed/60))),speed=gap/ticks*60;
    Object.assign(victim,{pullT:ticks,pullX:gx/gap*speed,pullZ:gz/gap*speed,dashT:0,dashQueue:[],slowUntil:Math.max(victim.slowUntil,this.m.tick+ticks+H.curtain.slow)});
    e.victim=victim.id;e.commandedAt=this.m.tick;e.expires=this.m.tick+ticks+6;
  }
  /** A hook that catches nothing gives back part of its cooldown; a cannonball at full range simply falls away. */
  private miss(e:TacticalEntity,point:Vec3){
    e.hp=0;this.m.emit({t:'ability',id:e.owner,castSeq:e.castSeq,kind:e.kind,action:'break',at:point});
    const owner=this.m.player(e.owner);
    if(e.kind==='curtain'&&owner?.alive&&owner.lifeId===e.lifeId&&owner.ability.castSeq===e.castSeq)owner.ability.readyAt=Math.max(this.m.tick,owner.ability.readyAt-Math.round(abilityFor(owner.char).cooldown*H.curtain.refund));
  }
  heal() {
    for(const e of this.entities){if(e.kind!=='prayer'||!this.destructible(e)||this.m.tick-e.created<H.prayer.interval*e.pulse)continue;const burst=e.pulse===0;e.pulse++;
      for(const {state:p} of this.m.slots.values())if(p.alive&&p.team===e.team&&distance(at(e),at(p))<=H.prayer.radius&&this.visible([e.x,e.y+1,e.z],[p.x,p.y+1.1,p.z])){const amount=Math.min(burst?H.prayer.instant:H.prayer.heal,CHARACTERS[p.char].hp-p.hp);if(amount>0){p.hp+=amount;this.m.emit({t:'ability',id:e.owner,castSeq:e.castSeq,kind:e.kind,action:'heal',at:at(p),amount});}}
    }
  }
  private strike(e:TacticalEntity,point:Vec3,radius:number,damage:number,weapon:number,damaged=new Set<string>(),spared:unknown=null){
    this.m.emit({t:'ability',id:e.owner,castSeq:e.castSeq,kind:e.kind,action:'pulse',at:point});const blast={...e,x:point[0],y:point[1],z:point[2]};
    for(const {state:p} of this.m.slots.values())if(p.alive&&p.team!==e.team&&!damaged.has(p.id)&&this.blastVisible(blast,p,radius)){damaged.add(p.id);this.m.heroDamage(e.owner,e.team,p.id,damage,weapon);}
    for(const d of this.entities)if(d!==e&&d!==spared&&this.destructible(d))this.points(d).forEach((pos,index)=>{if(distance(point,pos)<=radius&&lineOfSight(this.m.map,[point[0],point[1]+.2,point[2]],pos))this.hit(d,damage,index);});
    for(const shield of this.m.shields)if(shield!==spared&&distance(point,at(shield))<=radius&&lineOfSight(this.m.map,[point[0],point[1]+.2,point[2]],[shield.x,shield.y+.5,shield.z]))this.m.damageShield(shield,damage);
  }
  private entityEvent(e:TacticalEntity,action:HeroEvent['action']) {this.m.emit({t:'ability',id:e.owner,castSeq:e.castSeq,kind:e.kind,action,at:at(e)});}
  destructible(e:TacticalEntity) {return ['anchor','lens','decoy','prayer'].includes(e.kind)&&e.hp>0&&e.expires>this.m.tick;}
  points(e:TacticalEntity):Vec3[] {return tacticalPoints(e);}
  hit(e:TacticalEntity,damage:number,_endpoint=0) {if(!this.destructible(e))return;e.hp-=damage;if(e.hp<=0)this.entityEvent(e,'break');}
  shoot(origin:Vec3,dir:Vec3,max:number,damage:number|((distance:number)=>number)):number {
    let nearest=max,solid:TacticalEntity|null=null,endpoint=0;
    for(const e of this.entities){if(!this.destructible(e))continue;const hit=rayTactical(origin,dir,e);if(hit&&hit.t<nearest){nearest=hit.t;solid=e;endpoint=hit.endpoint;}}
    // Echoes do not stop rays, but an intervening real device still protects the echo.
    for(const e of this.entities)if(e.kind==='decoy'&&this.destructible(e)){const h=rayPlayer(origin,dir,e.x,e.y,e.z,false);if(h&&h.t<nearest)this.hit(e,1);}
    if(solid)this.hit(solid,typeof damage==='function'?damage(nearest):damage,endpoint);return nearest;
  }
  melee(p:PlayerState,range:number,arc:number,damage:number) {
    for(const e of this.entities)if(this.destructible(e))for(const [index,point] of this.points(e).entries()){
      if(distance([p.x,p.y+.6,p.z],point)<range+.3&&Math.abs(angle(Math.atan2(-(point[0]-p.x),-(point[2]-p.z))-p.yaw))<arc&&lineOfSight(this.m.map,[p.x,p.y+1,p.z],point)){this.hit(e,damage,index);break;}
    }
  }
  blast(origin:Vec3,radius:number) {for(const e of this.entities)if(this.destructible(e))this.points(e).forEach((point,index)=>{if(distance(origin,point)<=radius&&lineOfSight(this.m.map,origin,point))this.hit(e,180,index);});}
  private blastVisible(e:TacticalEntity,p:PlayerState,radius:number) {
    if(Math.hypot(p.x-e.x,p.z-e.z)>radius+.3)return false;
    return [.4,1,1.6].some(h=>Math.abs(p.y-e.y)<2.8&&lineOfSight(this.m.map,[e.x,e.y+.15,e.z],[p.x,p.y+(p.crouched?h*.65:h),p.z]));
  }
  decoys():PlayerState[] {return this.entities.filter(e=>e.kind==='decoy'&&e.hp>0).map(e=>{const owner=this.m.player(e.owner)!;return {...clonePlayer(owner),id:`echo-${e.id}`,x:e.x,y:e.y,z:e.z,hp:e.shownHp,alive:true,char:e.char,weapon:e.weapon,yaw:e.yaw};});}
}
