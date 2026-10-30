import type { Point3 } from './combat';
export const FORT_CANNON = {
 marker: 'fort_cannon', muzzle: { x:925.12,y:33.6,z:-172 }, station:{x:923.5,y:32.6,z:-172},
 radius:4.5, reload:1.3, range:180, halfArc:Math.PI*50/180,
} as const;
const finite=(p:Point3)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
export class FortCannon {
 mounted=false; reload=0;
 near(p:Point3){return finite(p)&&Math.hypot(p.x-FORT_CANNON.station.x,p.z-FORT_CANNON.station.z)<=FORT_CANNON.radius&&Math.abs(p.y-FORT_CANNON.station.y)<=2.8;}
 toggle(position:Point3,loaded:boolean){if(this.mounted){this.mounted=false;return false;}this.mounted=loaded&&this.near(position);return this.mounted;}
 update(dt:number,position:Point3,enabled:boolean){if(!enabled||!this.near(position))this.mounted=false;if(enabled&&Number.isFinite(dt)&&dt>0)this.reload=Math.max(0,this.reload-Math.min(dt,.1));}
 canAim(point:Point3){
  if(!finite(point))return false;
  const dx=point.x-FORT_CANNON.muzzle.x,dz=point.z-FORT_CANNON.muzzle.z;
  return dx>0&&Math.abs(Math.atan2(dz,dx))<=FORT_CANNON.halfArc&&Math.hypot(dx,point.y-FORT_CANNON.muzzle.y,dz)<=FORT_CANNON.range;
 }
 fire(point:Point3){if(!this.mounted||this.reload>0||!this.canAim(point))return false;this.reload=FORT_CANNON.reload;return true;}
 cancel(){this.mounted=false;}
 reset(){this.cancel();this.reload=0;}
}
