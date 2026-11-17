import {afterEach,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {HeroDemo} from '../src/ui/heroDemo.ts';
import {quickAbilityPlacement} from '../shared/heroes.ts';
import {CHARACTERS,PLAYABLE_HERO_INDICES} from '../shared/content.ts';
import {BTN,applyInput,clonePlayer} from '../shared/sim.ts';
import {predictAbility} from '../src/player/abilityPrediction.ts';
import {HeroEffects} from '../src/rendering/heroEffects.ts';
import {Game} from '../src/game.ts';
import {AimState} from '../src/player/aim.ts';
afterEach(()=>vi.unstubAllGlobals());
for(const char of [3,4,5,6,7,8]){
 it(`${CHARACTERS[char].id}: off-hand cast preserves normal fire cadence, ammo and aim`,()=>{
  const outputs=[];for(const cast of [false,true]){const m=new HeroDemo(char).match,p=m.player('hero')!,shots:number[]=[];for(let f=0;f<90;f++){m.queueInputs('hero',[{seq:f+1,mx:0,mz:0,yaw:.123,pitch:.15,buttons:BTN.FIRE|(cast&&f===5?BTN.SHIELD:0),weapon:0,view:m.tick}]);m.step();for(const e of m.snapshot().events)if(e.t==='shot'&&e.id==='hero')shots.push(m.tick);}expect(p.ability.castSeq).toBe(cast?1:0);expect(p.pitch).toBeCloseTo(.15,3);expect(p.yaw).toBeCloseTo(.123,3);outputs.push([shots,p.ammo]);}expect(outputs[0]).toEqual(outputs[1]);
 });
 it(`${CHARACTERS[char].id}: prediction retains reload and permits shots during the cast`,()=>{
  const m=new HeroDemo(char).match,snap=m.snapshot(),p=clonePlayer(m.player('hero')!);p.reload=50;const q={seq:1,mx:0,mz:0,yaw:0,pitch:0,buttons:BTN.SHIELD,weapon:0,view:0};predictAbility(m.map,p,q,snap);expect(p.reload).toBe(50);p.reload=0;const events=applyInput(m.map,p,{...q,buttons:BTN.SHIELD|BTN.FIRE});expect(events.some(e=>e.type==='fire')).toBe(true);expect(p.ability.castSeq).toBe(1);
 });
}
for(const char of [3,5,7,8])it(`${CHARACTERS[char].id}: ground placement is independent of vertical gun aim`,()=>{
 const m=new HeroDemo(char).match,p=m.player('hero')!,results=[];for(const pitch of [-1.2,0,1.2])results.push(quickAbilityPlacement(m.map,{...p,pitch},CHARACTERS[char].ability));expect(results[0].error).toBe('');expect(results[0]).toEqual(results[1]);expect(results[1]).toEqual(results[2]);
});
it('idle weapon aiming has no skill footprint; casting displays only the accepted fixed point',()=>{
 const demo=new HeroDemo(8),scene=new THREE.Scene(),effects=new HeroEffects(scene),p=demo.match.player('hero')!;effects.placement(demo.match.map,p);const preview=scene.getObjectByName('Ability footprint preview')!;expect(preview.visible).toBe(false);p.ability.phase='windup';p.ability.target=[0,0,-10];p.ability.yaw=0;p.yaw=1.3;p.pitch=1;effects.placement(demo.match.map,p);expect(preview.visible).toBe(true);expect(preview.position.z).toBe(-10);expect(preview.rotation.y).toBe(0);effects.dispose();
});
it('the actual game draw loop keeps ADS held, FOV and sensitivity stable through every hero action',()=>{
 vi.stubGlobal('document',{visibilityState:'visible',hasFocus:()=>true});
 for(const char of PLAYABLE_HERO_INDICES)for(const weapon of [0,4]){
  const demo=new HeroDemo(char),me=demo.match.player('hero')!;me.weapon=weapon;const aim=new AimState();for(let n=0;n<60;n++)aim.update(1/60,true,true,weapon);
  const controls={yaw:.2,pitch:.1,aimHeld:true,locked:true,adsSensitivity:.85,lookScale:1,clearAim:vi.fn(function(this:{aimHeld:boolean}){this.aimHeld=false;})};
  const no=()=>{},vm={set:no,look:no,hands:{update:no},aim:1};const scene={endAvatars:no,pruneAvatars:no,setView:vi.fn(),viewmodel:vm,update:no,render:no};
  const game=Object.assign(Object.create(Game.prototype),{me,aim,aimWeapon:weapon,controls,scene,map:demo.match.map,session:{id:'hero',online:false},snaps:[],latest:null,names:new Map(),hud:{aim:no,scope:no,bloom:no,update:no},feel:{update:no,offsets:()=>[0,0,0],fov:0,bloom:0},smooth:[0,0,0],lastLook:[.2,.1],stepDistance:0});
  const values=[];for(const phase of ['idle','windup','guard','return','recovery']){me.ability.phase=phase as typeof me.ability.phase;me.ability.lockUntil=999;game.draw(1/60);values.push([aim.fov(weapon),controls.lookScale]);expect(controls.aimHeld).toBe(true);}expect(controls.clearAim).not.toHaveBeenCalled();for(const v of values)expect(v).toEqual(values[0]);
 }
});
it('one hook press lands in the first fifth of a second and is still single-shot after repeated Q',()=>{
 const m=new HeroDemo(3).match,p=m.player('hero')!,enemy=m.player('target')!;enemy.z=-7;
 for(let i=0;i<120;i++){m.queueInputs('hero',[{seq:i+1,mx:0,mz:0,yaw:0,pitch:0,buttons:i%2===0?BTN.SHIELD:0,weapon:0,view:m.tick}]);m.step();if(i===12)expect(enemy.hp).toBe(170);}
 expect(enemy.hp).toBe(170);expect(p.ability.castSeq).toBe(1);
});
