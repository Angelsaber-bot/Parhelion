import {it,expect} from 'vitest';
import {HeroDemo} from '../src/ui/heroDemo.ts';
import {PLAYABLE_HERO_INDICES,playableHero} from '../shared/content.ts';
for(const char of PLAYABLE_HERO_INDICES)it(`real demonstration ${char} has the same outcome at 30 / 60 / 144 fps`,()=>{
 const outcomes=[];for(const fps of [30,60,144]){const demo=new HeroDemo(char);for(let i=0;i<fps*8+1;i++)demo.advance(1/fps);const p=demo.match.player('hero')!,enemy=demo.match.player('target')!;expect(demo.ticks).toBe(480);expect(p.ability.castSeq).toBe(1);outcomes.push([p.x,p.z,p.hp,enemy.hp,p.ability.readyAt]);}expect(outcomes[0]).toEqual(outcomes[1]);expect(outcomes[1]).toEqual(outcomes[2]);
});
it('retires Aster and Vega without changing stable indices of the World roster',()=>{expect(PLAYABLE_HERO_INDICES).toEqual([2,3,4,5,6,7,8]);expect(playableHero(0)).toBe(2);expect(playableHero(1)).toBe(2);expect(playableHero(8)).toBe(8);});
