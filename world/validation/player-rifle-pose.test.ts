import test from 'node:test';
import assert from 'node:assert/strict';
import {limitRifleElbowPole} from '../src/playerRiflePose';

test('wrist-safe elbow arc never crosses anatomical limit, including already bent wrists',()=>{
 let seed=90210;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 let positive=0;
 for(let i=0;i<20000;i++){
  const length=.2+rand()*.2, axial=(rand()*2-1)*length,radius=Math.sqrt(length*length-axial*axial);
  const dz=rand()*2-1,azimuth=rand()*Math.PI*2,radial=Math.sqrt(1-dz*dz),a=radial*Math.cos(azimuth),b=radial*Math.sin(azimuth),c=axial*dz;
  const requested=(rand()*2-1),result=limitRifleElbowPole(requested,c,a,b,radius,length);
  assert.ok(Number.isFinite(result));assert.ok(Math.abs(result)<=Math.abs(requested)+1e-12);assert.ok(result*requested>=0);
  const baseline=(c-radius*a)/length,minimum=Math.min(baseline,Math.cos(12.5*Math.PI/180));
  for(let j=0;j<=20;j++){const t=result*j/20,cos=(c-radius*(a*Math.cos(t)+b*Math.sin(t)))/length;assert.ok(cos>=minimum-1e-9,JSON.stringify({i,t,cos,minimum,result,requested}));}
  if(Math.abs(result)>.01)positive++;
 }
 assert.ok(positive>1000,'guard permits useful safe adjustments rather than always returning baseline');
});

test('invalid and degenerate wrist geometry fails to original pole without mutation',()=>{
 for(let i=0;i<6;i++)for(const bad of[NaN,Infinity,-Infinity]){const args=[-.8,.1,.2,.3,.2,.3];args[i]=bad;assert.equal(limitRifleElbowPole(...args as [number,number,number,number,number,number]),0);}
 assert.equal(limitRifleElbowPole(-.8,.1,.2,.3,0,.3),0);
 assert.equal(limitRifleElbowPole(-.8,.1,.2,.3,-.2,.3),0);
 assert.equal(limitRifleElbowPole(-.8,.1,.2,.3,.2,0),0);
});

test('requested-angle cap is continuous and deterministic at first anatomical boundary',()=>{
 const args:[number,number,number,number,number]=[.18,-.3,-.4,.2,.3];let last=0;
 for(let i=0;i<=10000;i++){const request=-i/10000,v=limitRifleElbowPole(request,...args);assert.equal(v,limitRifleElbowPole(request,...args));assert.ok(Math.abs(v-last)<=.000100001);last=v;}
});
