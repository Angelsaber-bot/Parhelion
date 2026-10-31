import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import{SERVANT_MOTION}from'../src/servant.ts';
import{sampleSaberRunFoot,SABER_RUN_STRIDE}from'../src/characters/saberStride.ts';
test('longer Saber run stride has continuous contact velocity and does not change controller calibration',()=>{
 assert.equal(SERVANT_MOTION.runSpeed,1.9983);assert.equal(SERVANT_MOTION.followSpeed,6);
 const duration=17/30,stance=2*SABER_RUN_STRIDE.reach/(duration*SABER_RUN_STRIDE.nominalSpeed),eps=1e-7;
 for(const p of [0,stance,1]){const a=sampleSaberRunFoot(p-eps,duration),b=sampleSaberRunFoot(p+eps,duration);assert.ok(Math.abs(a.z-b.z)<1e-5);assert.ok(Math.abs(a.y-b.y)<1e-9);}
 const a=sampleSaberRunFoot(stance/2-eps,duration),b=sampleSaberRunFoot(stance/2+eps,duration);assert.ok(Math.abs((b.z-a.z)/(2*eps*duration)+SABER_RUN_STRIDE.nominalSpeed)<1e-7);
 assert.ok(2*5.5/(duration*SABER_RUN_STRIDE.nominalSpeed)<4.4,'ordinary follow cannot become a 9-step/s treadmill');
});
