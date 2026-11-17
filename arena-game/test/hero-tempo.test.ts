import {it,expect} from 'vitest';
import {HeroDemo} from '../src/ui/heroDemo.ts';
import {BTN,type Input} from '../shared/sim.ts';
import {abilityFor} from '../shared/content.ts';
function input(seq:number,buttons=0,mx=0):Input{return {seq,mx,mz:0,yaw:0,pitch:0,buttons,weapon:0,view:0};}
for(const [char,z,damage,maxTicks] of [[2,-7,80,5],[3,-7,30,12],[4,-3,70,8],[5,-7,70,11],[7,-10,30,22]])it(`hero ${char}: a single tap produces an opening in the first firefight`,()=>{
 const m=new HeroDemo(char).match,enemy=m.player('target')!;enemy.z=z;let first=0;
 for(let i=0;i<maxTicks;i++){m.queueInputs('hero',[input(i+1,i===0?BTN.SHIELD:0)]);m.step();if(enemy.hp<150&&!first)first=i+1;}
 expect(first).toBeGreaterThan(0);expect(first).toBeLessThanOrEqual(maxTicks);expect(enemy.hp).toBe(150-damage);expect(m.player('hero')!.ability.castSeq).toBe(1);
});
it('banner gives its first 30 HP before the next normal rifle shot interval',()=>{
 const m=new HeroDemo(6).match,p=m.player('hero')!;p.hp=70;
 for(let i=0;i<7;i++){m.queueInputs('hero',[input(i+1,i===0?BTN.SHIELD:0)]);m.step();}expect(p.hp).toBe(100);
});
it('the hook is a projectile: a sidestep before it arrives makes it miss and refunds 40%',()=>{
 const health=[];for(const dash of [false,true]){const m=new HeroDemo(3).match,enemy=m.player('target')!,hero=m.player('hero')!;enemy.z=-12;
 for(let i=0;i<24;i++){m.queueInputs('hero',[input(i+1,i===0?BTN.SHIELD:0)]);m.queueInputs('target',[{...input(i+1,dash&&i===2?BTN.DASH:0),mx:dash?1:0}]);m.step();}
 health.push(enemy.hp);if(dash)expect(hero.ability.readyAt).toBe(1+abilityFor(3).cooldown-240);}
 expect(health[0]).toBe(120);expect(health[1]).toBe(150);
});
it('swallow cut keeps gunfire available, cannot stack a dash or jump, and a kill readies it again',()=>{
 const m=new HeroDemo(4).match,p=m.player('hero')!;
 for(let i=0;i<20;i++){m.queueInputs('hero',[input(i+1,BTN.FIRE|(i===0?BTN.SHIELD|BTN.DASH|BTN.JUMP:0),1)]);m.step();}
 expect(p.dashCharges).toBe(3);expect(p.dashT).toBe(0);expect(p.y).toBe(0);expect(p.z).toBeCloseTo(-6,1);expect(p.x).toBeLessThan(1);expect(p.ammo[0]).toBeLessThan(30);
 const k=new HeroDemo(4).match,enemy=k.player('target')!,hero=k.player('hero')!;enemy.z=-3;enemy.hp=60;
 for(let i=0;i<12;i++){k.queueInputs('hero',[input(i+1,i===0?BTN.SHIELD:0)]);k.step();}
 expect(enemy.alive).toBe(false);expect(hero.ability.readyAt).toBeLessThanOrEqual(k.tick);
});
it('the edict lands within a third of a second, roots without damage and wears off',()=>{
 const m=new HeroDemo(8).match,enemy=m.player('target')!;enemy.z=-4;let rooted=0,held=0;
 for(let i=0;i<90;i++){m.queueInputs('hero',[{...input(i+1,i===0?BTN.SHIELD:0),pitch:-Math.atan2(1.62,4)}]);m.queueInputs('target',[{...input(i+1),mz:1}]);m.step();if(!rooted&&enemy.rootUntil>m.tick){rooted=i+1;held=enemy.z;}if(rooted&&enemy.rootUntil>m.tick)expect(enemy.z).toBe(held);}
 expect(rooted).toBeGreaterThan(0);expect(rooted).toBeLessThanOrEqual(20);expect(enemy.hp).toBe(150);expect(enemy.rootUntil).toBeLessThan(m.tick);expect(enemy.z).not.toBe(held);
});
it('cooldowns support repeated engagements without unlimited casts',()=>{
 for(const char of [2,3,4,5,6,7,8]){const m=new HeroDemo(char).match,p=m.player('hero')!,cd=abilityFor(char).cooldown;expect(cd).toBeGreaterThanOrEqual(450);expect(cd).toBeLessThanOrEqual(720);
 for(let i=0;i<cd;i++){m.queueInputs('hero',[input(i+1,i%2===0?BTN.SHIELD:0)]);m.step();}expect(p.ability.castSeq).toBe(1);}
});
