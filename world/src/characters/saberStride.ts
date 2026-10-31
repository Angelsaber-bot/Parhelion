import * as THREE from 'three';

/** Presentation calibration only. The follow controller keeps its existing speed cap. */
export const SABER_RUN_STRIDE = Object.freeze({ nominalSpeed: 4.5, reach: .23, lift: .18 });
export function saberRunRate(speed:number,duration:number){return (1.5+.12*Math.max(0,speed))*duration;}
export function sampleSaberRunFoot(phase: number, duration: number, nominalSpeed:number=SABER_RUN_STRIDE.nominalSpeed, lift:number=SABER_RUN_STRIDE.lift) {
  const p=((phase%1)+1)%1,stance=Math.min(.7,2*SABER_RUN_STRIDE.reach/(duration*Math.max(.1,nominalSpeed)));
  if(p<stance)return {z:SABER_RUN_STRIDE.reach*(1-2*p/stance),y:0,swing:0,contact:true};
  const u=(p-stance)/(1-stance),tangent=-2*SABER_RUN_STRIDE.reach*(1-stance)/stance;
  // A brief toe-off/landing velocity match, not a single cubic with a 40 cm
  // overshoot at near-floor height. The return is C1 at all segment boundaries.
  const edge=.05,overshoot=-tangent*edge*.5,low=-SABER_RUN_STRIDE.reach-overshoot,high=-low;
  let z:number;
  if(u<edge)z=-SABER_RUN_STRIDE.reach+tangent*(u-u*u/(2*edge));
  else if(u>1-edge){const w=1-u;z=SABER_RUN_STRIDE.reach-tangent*(w-w*w/(2*edge));}
  else{const t=(u-edge)/(1-2*edge);z=THREE.MathUtils.lerp(low,high,t*t*(3-2*t));}
  // Zero vertical velocity at both contact boundaries; a prompt heel lift also
  // clears the longer reach without asking the short rig to stretch its leg.
  const swing=Math.sin(Math.PI*u)**1.5;
  return {z,y:lift*swing,swing,contact:false};
}
