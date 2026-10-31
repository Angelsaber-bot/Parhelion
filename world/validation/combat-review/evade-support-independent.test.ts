/** Isolated candidate audit only. Does not install in production main. */
import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';
import {Player} from '../../src/player';import {installEvadeSupportCandidate} from './evade-support-candidate';
const snapshot=(p:Player)=>({position:p.pos.toArray(),velocity:p.vel.toArray(),grounded:p.onGround,swimming:p.swimming,gliding:p.gliding,updraft:p.inUpdraft});
test('isolated support candidate leaves non-evade movement exactly unchanged and restores method ownership',()=>{
 const geometry=new THREE.BoxGeometry(200,.2,200).translate(0,-.1,0),colliders=[{name:'explicit-flat-control',enabled:true,bvh:new MeshBVH(geometry)}];
 try{for(const hz of [30,60,120])for(const water of [-100,2]){
  const baseline=new Player(colliders,water),candidate=new Player(colliders,water);baseline.teleport(0,.1,0);candidate.teleport(0,.1,0);const step=candidate.step,collision=(candidate as any).collide;const helper=installEvadeSupportCandidate(candidate);
  for(let i=0;i<hz*8;i++){const input={x:i%100<50?1:-1,z:.5,sprint:i%150<75,jump:i%90===0};baseline.yaw=candidate.yaw=Math.sin(i/hz)*.5;baseline.step(1/hz,input);candidate.step(1/hz,input);assert.deepEqual(snapshot(candidate),snapshot(baseline),`${hz}Hz water=${water} step=${i}`);}
  assert.equal(helper.diagnostics.supportQueries,0);assert.equal(helper.diagnostics.extraQueries,0);helper.dispose();helper.dispose();assert.equal(candidate.step,step);assert.equal((candidate as any).collide,collision);assert.equal(Object.hasOwn(candidate,'step'),false);assert.equal(Object.hasOwn(candidate,'collide'),false);
 }}finally{geometry.dispose();}
});
