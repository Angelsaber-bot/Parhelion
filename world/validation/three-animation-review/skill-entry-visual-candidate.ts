/** Isolated diagnostic only: separate outgoing gait/fade time from the attack clip clock. */
import type * as THREE from 'three';
import type { CharacterKit } from '../../src/characters/characterKit';
export function installSkillEntryVisualCandidate(actor: CharacterKit, realDt: () => number) {
 const kit=actor as unknown as {blend:{elapsed:number;duration:number;target?:THREE.AnimationAction;weights:Map<THREE.AnimationAction,number>;update:(m:THREE.AnimationMixer,dt:number)=>void}};
 const originalUpdate=actor.update.bind(actor),blend=kit.blend,originalBlend=blend.update.bind(blend);let ratio=1;
 blend.update=(mixer,dt)=>{
  if(ratio===1||blend.duration<=0){originalBlend(mixer,dt);return;}
  const outgoing=[...blend.weights.keys()].filter(a=>a!==blend.target).map(a=>({a,rate:a.getEffectiveTimeScale()}));
  for(const {a,rate}of outgoing)a.setEffectiveTimeScale(rate*ratio);
  blend.elapsed-=dt*(1-ratio);
  try{originalBlend(mixer,dt);}finally{for(const {a,rate}of outgoing)a.setEffectiveTimeScale(rate);}
 };
 actor.update=(dt,paused=false)=>{ratio=actor.state==='attack'&&dt>0?realDt()/dt:1;try{originalUpdate(dt,paused);}finally{ratio=1;}};
 return()=>{actor.update=originalUpdate;blend.update=originalBlend;};
}
