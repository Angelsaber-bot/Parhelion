/** Cosmetic-only profiles. Never imported by the deterministic simulation. */
import {signatureOf,type SignatureId} from '../shared/signatureSkins.ts';
export type ParticleShape='ember'|'crystal'|'ring'|'pixel'|'petal'|'star';
export type TrailShape='straight'|'wave'|'pulse'|'fork';
export interface SkinEffect {color:number;secondary:number;particle:ParticleShape;trail:TrailShape;life:number;spread:number;flash:number}
const motifs:Record<SignatureId,readonly[ParticleShape,TrailShape,number,number,number]>={
 'tidal-engine':['ring','wave',.24,1.6,.18], 'amber-apiary':['ember','pulse',.28,2,.18],
 'graviton-crucible':['ring','wave',.30,1.4,.22], 'cloudline':['star','straight',.20,2,.17],
 'abyssal-maw':['petal','fork',.24,2.5,.20], 'cinder-express':['ember','pulse',.27,3.6,.23],
 'celadon-atlas':['crystal','straight',.25,2,.16], 'owl-canticle':['petal','fork',.27,2,.18],
 'brass-horizon':['ring','pulse',.25,1.8,.17], 'mint-arcade':['pixel','pulse',.20,2.5,.14],
 'koi-current':['petal','wave',.25,1.8,.16], 'mixtape':['pixel','pulse',.22,2,.17],
 'abyssal-requiem':['ring','wave',.30,1.6,.23], 'velvet-thorn':['petal','fork',.30,2,.22],
 'meridian-key':['star','pulse',.27,2,.21], 'glacier-survey':['crystal','fork',.32,2.6,.22],
 'prismwing':['crystal','wave',.28,2,.18], 'crescent-sabre':['star','straight',.23,3,.16],
 'vermilion-plume':['ember','wave',.30,3,.21], 'ink-bamboo':['petal','straight',.28,2,.15],
 'reef-regalia':['ring','wave',.32,2.2,.19], 'foundry-bell':['ember','fork',.30,4,.25],
 'sugar-crash':['pixel','pulse',.30,2.5,.22], 'cathedral-chime':['crystal','pulse',.34,2.4,.23],
};
export function skinEffect(id?:string):SkinEffect|undefined{
 const s=signatureOf(id);if(!s)return;const [particle,trail,life,spread,flash]=motifs[s.id];
 return{color:s.accent,secondary:s.trim,particle,trail,life,spread,flash};
}
