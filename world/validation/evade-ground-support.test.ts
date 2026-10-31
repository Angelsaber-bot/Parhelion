import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';
import {Player} from '../src/player';import {EvadeGroundSupport} from '../src/evadeGroundSupport';import {verifyEvadeSupport} from './evade-support-contract.fixture';
/** Observation only: this does not replace collision or install support behavior. */
function observeProduction(player:Player){
 const original=player.step,descriptor=Object.getOwnPropertyDescriptor(player,'step');let steps=0,maxExtra=0,maxSupport=0;
 player.step=function(dt,input){const before=(this as any).evadeSupport.diagnostics;steps++;const result=original.call(this,dt,input),after=(this as any).evadeSupport.diagnostics;maxExtra=Math.max(maxExtra,after.capsuleRetries-before.capsuleRetries);maxSupport=Math.max(maxSupport,after.supportPasses-before.supportPasses);return result;};
 return{get diagnostics(){const d=(player as any).evadeSupport.diagnostics;return{steps,supportQueries:d.supportPasses,supportRejected:d.rejected,extraQueries:d.capsuleRetries,recovered:d.recovered,maxExtraQueriesPerStep:d.maxCapsuleRetriesPerStep,maxSupportRaysPerStep:d.maxSupportPassesPerStep,maxObservedExtraQueriesPerStep:maxExtra,maxObservedSupportQueriesPerStep:maxSupport};},dispose(){if(descriptor)Object.defineProperty(player,'step',descriptor);else delete(player as any).step;}};
}
verifyEvadeSupport('production Player',Player,observeProduction);
test('support retry exceptions restore position/velocity/contact state before propagation',()=>{
 const geometry=new THREE.PlaneGeometry(20,20).rotateX(-Math.PI/2),collider={name:'floor',enabled:true,bvh:new MeshBVH(geometry)},support=new EvadeGroundSupport(),body={pos:new THREE.Vector3(0,.005,0),vel:new THREE.Vector3(0,-.18,0),onGround:false,swimming:false,gliding:false,inUpdraft:false,flying:false};
 const position=body.pos.clone(),velocity=body.vel.clone();assert.throws(()=>support.tryRecover(body,[collider],()=>{body.pos.x+=1;body.vel.y=4;throw Error('fixture collision failure');}),/fixture collision failure/);assert.deepEqual(body.pos,position);assert.deepEqual(body.vel,velocity);assert.equal(body.onGround,false);assert.equal(support.diagnostics.rolledBack,1);geometry.dispose();
});
