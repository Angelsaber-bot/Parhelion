import {afterEach,expect,it,vi} from 'vitest';

afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it.each(['?test','?low&test','?mute'])('%s never creates an audio device for any game sound',async(search)=>{
 vi.resetModules();vi.stubGlobal('location',{search});let attempts=0;
 vi.stubGlobal('AudioContext',class{constructor(){attempts++;throw Error('no real audio during tests');}});
 const {sfx}=await import('../src/rendering/audio.ts');
 sfx.unlock();for(let weapon=0;weapon<8;weapon++){sfx.shot(weapon,true);sfx.melee(weapon,true);sfx.melee(weapon,false);sfx.meleeHit(weapon);}
 sfx.impact(2);sfx.hit(true);sfx.hit(false);sfx.kill();sfx.hurt();sfx.dash();sfx.shield();sfx.shieldBreak();sfx.reload();sfx.empty();
 expect(attempts).toBe(0);
});
it('ordinary play retains its audio initialization path',async()=>{
 vi.resetModules();vi.stubGlobal('location',{search:'?low'});let attempts=0;
 vi.stubGlobal('AudioContext',class{constructor(){attempts++;throw Error('no real audio during tests');}});
 const {sfx}=await import('../src/rendering/audio.ts');sfx.unlock();expect(attempts).toBe(1);
});
