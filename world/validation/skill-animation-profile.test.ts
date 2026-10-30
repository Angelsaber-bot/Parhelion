import test from 'node:test';import assert from 'node:assert/strict';
import {skillAnimationProfile,skillAnimationSample} from '../src/skillAnimationProfile';
test('profiles are monotonic, hold before contact, and preserve legacy 1x clock without slot',()=>{
 for(const id of ['saber','blackbeard','musashi'])for(const slot of [undefined,'skill','ultimate'] as const){
  const p=skillAnimationProfile(id,slot),contact=.65,duration=1.6,info=skillAnimationSample(p,0,duration,contact);let previous=0;
  for(let time=0;time<=info.duration+.1;time+=.001){const sample=skillAnimationSample(p,time,duration,contact);assert.ok(sample.clipTime>=previous-1e-10&&sample.clipTime<=duration);if(slot===undefined)assert.ok(Math.abs(sample.clipTime-Math.min(duration,time))<1e-8);previous=sample.clipTime;}
  if(slot){const a=skillAnimationSample(p,info.holdStart+.001,duration,contact),b=skillAnimationSample(p,info.holdEnd-.001,duration,contact);assert.equal(a.clipTime,b.clipTime);assert.ok(a.clipTime<contact);}
 }
 assert.ok(skillAnimationProfile('saber','ultimate').holdSeconds>skillAnimationProfile('saber','skill').holdSeconds+.2);
 assert.ok(skillAnimationProfile('blackbeard','ultimate',1).holdSeconds<skillAnimationProfile('blackbeard','ultimate').holdSeconds);
});
