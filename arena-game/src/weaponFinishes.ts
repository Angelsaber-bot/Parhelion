/** Presentation-only curated finishes. No simulation, hitboxes or audio timing. */
import * as THREE from 'three';
import {SIGNATURE_SKINS,signatureOf,type SignatureId} from '../shared/signatureSkins.ts';
import {signatureMaterial} from './signatureFinishes.ts';
export type FinishId=SignatureId;
export const FINISH_DETAILS=Object.fromEntries(SIGNATURE_SKINS.map(s=>[s.id,{zh:s.zh,en:s.en,description:[...s.description],trim:s.trim,light:s.accent}])) as Record<FinishId,{zh:string;en:string;description:[string,string];trim:number;light:number}>;
export const finishOf=(id?:string,weapon?:string):FinishId|null=>signatureOf(id,weapon)?.id??null;
const clock={value:0};
export function updateFinishClock(seconds:number){if(Number.isFinite(seconds))clock.value=seconds;}
export function finishMaterial(source:THREE.MeshStandardMaterial,id:FinishId){return signatureMaterial(source,id,clock);}
