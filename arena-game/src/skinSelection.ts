import {WEAPONS, type WeaponId} from '../shared/content.ts';
import {sanitizedSkins} from './loadout.ts';

// Only surviving positions from the old catalog are needed for migration.
// Retired colors and motifs have no catalog entry or renderer anymore.
const LEGACY_SURVIVORS: Record<WeaponId, Record<number, string>> = {
  lumen: {5:'tidal-engine',6:'amber-apiary'},
  corona: {6:'abyssal-maw'},
  halo: {5:'celadon-atlas'},
  firefly: {5:'mint-arcade'},
  longnight: {4:'abyssal-requiem',6:'velvet-thorn'},
  blade: {5:'prismwing'},
  polearm: {4:'vermilion-plume',5:'ink-bamboo'},
  hammer: {4:'foundry-bell',6:'sugar-crash'},
};
const record=(raw:unknown):Record<string,unknown>=>raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};

/** ID-based saves survive future curation. Old numeric saves migrate once by
 * original weapon position; removed/invalid choices use that weapon's default. */
export function readSkinSelection(raw:unknown):number[]{
  const lobby=record(raw),ids=record(lobby.skinIds),legacy=lobby.skins;
  const current=Object.hasOwn(lobby,'skinIds');
  return WEAPONS.map((w,i)=>{
    const old=Array.isArray(legacy)?legacy[i]:undefined;
    const id=current?ids[w.id]:typeof old==='number'&&Number.isInteger(old)?LEGACY_SURVIVORS[w.id][old]:undefined;
    return Math.max(0,w.skins.findIndex(s=>s.id===id));
  });
}

/** Preserve unrelated lobby fields, but never write ambiguous numeric saves. */
export function withSkinSelection(raw:unknown,indices:readonly number[]){
  const {skins:_legacy,skinIds:_previous,...lobby}=record(raw);
  const safe=sanitizedSkins(indices);
  return {...lobby,skinIds:Object.fromEntries(WEAPONS.map((w,i)=>[w.id,w.skins[safe[i]].id]))};
}
