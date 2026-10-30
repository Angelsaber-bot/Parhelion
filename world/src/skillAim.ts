import type { Enemy, Point3, CombatTerrain } from './combat';
export interface ResolvedSkillAim { origin:Point3; direction:Point3; targetId?:string; targetPoint?:Point3 }
const finite=(p:Point3)=>[p.x,p.y,p.z].every(Number.isFinite);
/** Pick a visible hostile near the player's aim, then aim FROM the servant.
 * The target snapshot is not homing damage: each authored contact still checks
 * live range, floor height, hostility and LOS through collectStrikeTargets. */
export function resolveServantSkillAim(options:{
 player:Point3; caster:Point3; viewOrigin:Point3; viewDirection:Point3;
 range:number; enemies:readonly Enemy[]; terrain:Pick<CombatTerrain,'lineOfSight'>;
}):ResolvedSkillAim|null {
 const {player,caster,viewOrigin,viewDirection,range,enemies,terrain}=options;
 if(![player,caster,viewOrigin,viewDirection].every(finite)||!Number.isFinite(range)||range<=0||range>40)return null;
 const length=Math.hypot(viewDirection.x,viewDirection.z);if(length<1e-6)return null;
 const ux=viewDirection.x/length,uz=viewDirection.z/length;
 const from={x:caster.x,y:caster.y+1,z:caster.z};
 let target:Enemy|undefined,best=Infinity;
 for(const e of enemies){
  if(!e.active||e.mode==='dead'||e.pacified||e.hp<=0||!finite(e.p)||Math.abs(e.p.y-caster.y)>2.6)continue;
  const dx=e.p.x-player.x,dz=e.p.z-player.z,forward=dx*ux+dz*uz,across=Math.abs(dx*uz-dz*ux);
  if(forward<0||across>Math.max(1.1,forward*Math.tan(Math.PI/9)))continue;
  const distance=Math.hypot(e.p.x-caster.x,e.p.z-caster.z);if(distance<.05||distance>range)continue;
  const center={x:e.p.x,y:e.p.y+1,z:e.p.z};
  if(!terrain.lineOfSight(viewOrigin,center)||!terrain.lineOfSight(from,center))continue;
  const score=across/Math.max(1,forward)*100+distance*.01;
  if(score<best||(score===best&&e.id<(target?.id??''))){target=e;best=score;}
 }
 const point=target?{...target.p}:{x:player.x+ux*range,y:caster.y,z:player.z+uz*range};
 const dx=point.x-caster.x,dz=point.z-caster.z,d=Math.hypot(dx,dz);
 return {origin:{...caster},direction:d>.001?{x:dx/d,y:0,z:dz/d}:{x:ux,y:0,z:uz},...(target?{targetId:target.id,targetPoint:point}:{})};
}
