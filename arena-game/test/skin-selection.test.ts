import {expect,it} from 'vitest';
import {WEAPONS} from '../shared/content.ts';
import {readSkinSelection,withSkinSelection} from '../src/cosmetics/skinSelection.ts';

const ids=(indices:number[])=>Object.fromEntries(WEAPONS.map((w,i)=>[w.id,w.skins[indices[i]].id]));
it('migrates real pre-curation saves by identity, across all eight weapons',()=>{
  expect(ids(readSkinSelection({skins:[6,6,5,5,6,5,5,6]}))).toEqual({lumen:'amber-apiary',corona:'abyssal-maw',halo:'celadon-atlas',firefly:'mint-arcade',longnight:'velvet-thorn',blade:'prismwing',polearm:'ink-bamboo',hammer:'sugar-crash'});
  expect(ids(readSkinSelection({skins:[5,6,5,5,4,5,4,4]}))).toEqual({lumen:'tidal-engine',corona:'abyssal-maw',halo:'celadon-atlas',firefly:'mint-arcade',longnight:'abyssal-requiem',blade:'prismwing',polearm:'vermilion-plume',hammer:'foundry-bell'});
});
it('removed, corrupt and forged legacy indices fall back within their own weapon',()=>{
  for(const skins of [[7,5,7,4,5,6,6,5],[0,1,2,3,-1,.5,100,NaN],[],null,'invalid'])expect(readSkinSelection({skins})).toEqual([0,0,0,0,0,0,0,0]);
});
it('saves stable IDs, discards numeric positions and preserves other lobby fields',()=>{
  const choice=[1,0,0,0,1,0,1,1];
  const saved=withSkinSelection({name:'Player',map:'blackflag',layout:'2v2',char:1,server:'ws://localhost:2567',skins:[6,6,5,5,6,5,5,6]},choice);
  expect(saved).not.toHaveProperty('skins');expect(saved).toMatchObject({name:'Player',map:'blackflag',layout:'2v2',char:1,server:'ws://localhost:2567'});
  expect(saved.skinIds).toEqual({lumen:'amber-apiary',corona:'abyssal-maw',halo:'celadon-atlas',firefly:'mint-arcade',longnight:'velvet-thorn',blade:'prismwing',polearm:'ink-bamboo',hammer:'sugar-crash'});
  expect(readSkinSelection(JSON.parse(JSON.stringify(saved)))).toEqual(choice);
});
it('stable IDs win over stale positions, reject other weapons and never revive removed skins',()=>{
  expect(readSkinSelection({skins:[6,6,5,5,6,5,5,6],skinIds:{lumen:'sugar-crash',corona:'abyssal-maw',longnight:'snowline-ghost',hammer:'sugar-crash'}})).toEqual([0,0,0,0,0,0,0,1]);
  for(const skinIds of [null,[],42,'wrong'])expect(readSkinSelection({skinIds,skins:[6,6,5,5,6,5,5,6]})).toEqual([0,0,0,0,0,0,0,0]);
  for(const raw of [null,[],false,42,'wrong'])expect(readSkinSelection(raw)).toEqual([0,0,0,0,0,0,0,0]);
});
