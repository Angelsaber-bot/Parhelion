import {it,expect} from 'vitest';
import {HeroDemo} from '../src/ui/heroDemo.ts';
import {BTN,type Input} from '../shared/sim.ts';
import {HERO_COMBAT,abilityFor} from '../shared/content.ts';
function input(seq:number,buttons=0,mx=0):Input{return {seq,mx,mz:0,yaw:0,pitch:0,buttons,weapon:0,view:0};}
for(const [char,z,damage,maxTicks] of [[2,-7,70,5],[3,-7,80,28],[5,-4,60,31],[7,-10,30,22],[8,-4,30,16]])it(`hero ${char}: a single tap produces an opening in the first firefight`,()=>{
 const m=new HeroDemo(char).match,enemy=m.player('target')!;enemy.z=z;let first=0;
 for(let i=0;i<maxTicks;i++){m.queueInputs('hero',[input(i+1,i===0?BTN.SHIELD:0)]);m.step();if(enemy.hp<150&&!first)first=i+1;}
 expect(first).toBeGreaterThan(0);expect(first).toBeLessThanOrEqual(maxTicks);expect(enemy.hp).toBe(150-damage);expect(m.player('hero')!.ability.castSeq).toBe(1);
});
it('banner gives its first 30 HP before the next normal rifle shot interval',()=>{
 const m=new HeroDemo(6).match,p=m.player('hero')!;p.hp=70;
 for(let i=0;i<7;i++){m.queueInputs('hero',[input(i+1,i===0?BTN.SHIELD:0)]);m.step();}expect(p.hp).toBe(100);
});
it('moving enemies are threatened by broadside but a reactive forward dash clears its shallow blast band',()=>{
 const health=[];for(const dash of [false,true]){const m=new HeroDemo(3).match,enemy=m.player('target')!;enemy.z=-7;
 for(let i=0;i<29;i++){m.queueInputs('hero',[input(i+1,i===0?BTN.SHIELD:0)]);m.queueInputs('target',[{...input(i+1,dash&&i===8?BTN.DASH:0),mz:1}]);m.step();}health.push(enemy.hp);}
 expect(health[0]).toBe(70);expect(health[1]).toBe(150);
});
it('sidestep keeps gunfire and reload available but cannot stack a universal dash or jump',()=>{
 const m=new HeroDemo(4).match,p=m.player('hero')!;
 for(let i=0;i<20;i++){m.queueInputs('hero',[input(i+1,BTN.FIRE|(i===0?BTN.SHIELD|BTN.DASH|BTN.JUMP:0),1)]);m.step();}
 expect(p.dashCharges).toBe(3);expect(p.dashT).toBe(0);expect(p.y).toBe(0);expect(p.x).toBeGreaterThanOrEqual(5);expect(p.x).toBeLessThan(5.6);expect(p.ammo[0]).toBeLessThan(30);
});
it('the domain opening hits once, allows shooting and releases the slow when its seal breaks',()=>{
 const m=new HeroDemo(8).match,enemy=m.player('target')!;enemy.z=-4;
 for(let i=0;i<30;i++){m.queueInputs('hero',[input(i+1,i===0?BTN.SHIELD:0)]);m.step();}
 expect(enemy.hp).toBe(120);const e=m.heroes.entities[0];m.heroes.hit(e,HERO_COMBAT.edict.hp,1);for(let i=0;i<3;i++)m.step();expect(enemy.slowUntil).toBeLessThan(m.tick);expect(m.heroes.entities).toHaveLength(0);
});
it('cooldowns support repeated engagements without unlimited casts',()=>{
 for(const char of [2,3,4,5,6,7,8]){const m=new HeroDemo(char).match,p=m.player('hero')!,cd=abilityFor(char).cooldown;expect(cd).toBeGreaterThanOrEqual(450);expect(cd).toBeLessThanOrEqual(720);
 for(let i=0;i<cd;i++){m.queueInputs('hero',[input(i+1,i%2===0?BTN.SHIELD:0)]);m.step();}expect(p.ability.castSeq).toBe(1);}
});
