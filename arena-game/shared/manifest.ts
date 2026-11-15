import {HERO_COMBAT,ABILITIES,CHARACTERS,WEAPONS,HERO_RULESET,PLAYABLE_HERO_INDICES} from './content.ts';
import {MAPS} from './arenaMap.ts';
// Deterministic across browser, Node and Worker; identifies the actual roster/rules/maps.
const source=JSON.stringify([HERO_RULESET,PLAYABLE_HERO_INDICES,CHARACTERS,ABILITIES,HERO_COMBAT,WEAPONS,MAPS.map(m=>[m.id,m.data])]);
let hash=2166136261;for(let i=0;i<source.length;i++)hash=Math.imul(hash^source.charCodeAt(i),16777619)>>>0;
export const CONTENT_MANIFEST=`arena-${hash.toString(16).padStart(8,'0')}`;
export function assertContentManifest(value:unknown){if(value!==undefined&&value!==CONTENT_MANIFEST)throw new Error('角色或地图内容版本不匹配，请刷新 / Arena content mismatch; refresh both clients');}
