import type { SkillSlot } from './contractSkills';
/** Time-remapping of existing authored clips, not new keyframes or invented damage events.
 * The pause is strictly before the first authored contact. Ordinary attacks never use it. */
export interface SkillAnimationProfile {
  windupRate: number;
  holdSeconds: number;
  holdFraction: number;
  releaseRate: number;
  recoveryRate: number;
}
const ORDINARY: Readonly<SkillAnimationProfile> = Object.freeze({windupRate:1,holdSeconds:0,holdFraction:.8,releaseRate:1,recoveryRate:1});
const PROFILES: Readonly<Record<string, Readonly<Record<SkillSlot, Readonly<SkillAnimationProfile>>>>> = {
  saber: {
    skill:{windupRate:2,holdSeconds:.08,holdFraction:.5,releaseRate:2.2,recoveryRate:1.8},
    ultimate:{windupRate:1.8,holdSeconds:.32,holdFraction:.5,releaseRate:2.6,recoveryRate:1.8},
  },
  blackbeard: {
    skill:{windupRate:1.35,holdSeconds:.18,holdFraction:.8,releaseRate:2,recoveryRate:2},
    ultimate:{windupRate:1.8,holdSeconds:.25,holdFraction:.8,releaseRate:2.8,recoveryRate:3},
  },
  musashi: {
    skill:{windupRate:2,holdSeconds:.05,holdFraction:.8,releaseRate:2.2,recoveryRate:1.8},
    ultimate:{windupRate:1.7,holdSeconds:.18,holdFraction:.8,releaseRate:2.8,recoveryRate:2.5},
  },
};
const FOLLOWUPS: Readonly<Record<string, Readonly<SkillAnimationProfile>>> = {
  blackbeard:{windupRate:2.6,holdSeconds:.035,holdFraction:.8,releaseRate:2.8,recoveryRate:3},
  musashi:{windupRate:2.6,holdSeconds:.025,holdFraction:.8,releaseRate:2.8,recoveryRate:2.5},
};
export function skillAnimationProfile(identity: string, slot?: SkillSlot, cycle=0): Readonly<SkillAnimationProfile> {
  if(!slot)return ORDINARY;
  return slot==='ultimate'&&cycle>0 ? FOLLOWUPS[identity]??PROFILES[identity]?.[slot]??ORDINARY : PROFILES[identity]?.[slot]??ORDINARY;
}
export function skillAnimationSample(profile: Readonly<SkillAnimationProfile>, elapsed: number, duration: number, contact: number) {
  const holdPose=contact*profile.holdFraction,windup=holdPose/profile.windupRate;
  const release=(contact-holdPose)/profile.releaseRate,recovery=(duration-contact)/profile.recoveryRate;
  const total=windup+profile.holdSeconds+release+recovery;
  let t=Math.max(0,elapsed),clipTime:number;
  if(t<windup)clipTime=t*profile.windupRate;
  else if((t-=windup)<profile.holdSeconds)clipTime=holdPose;
  else if((t-=profile.holdSeconds)<release)clipTime=holdPose+t*profile.releaseRate;
  else {t-=release;clipTime=Math.min(duration,contact+t*profile.recoveryRate);}
  return {clipTime,duration:total,holdStart:windup,holdEnd:windup+profile.holdSeconds,contactAt:windup+profile.holdSeconds+release};
}
