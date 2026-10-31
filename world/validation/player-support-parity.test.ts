/** Production, not a recovery wrapper: compare every non-evade state against the
 * exact pre-support Player source (3d66e31 / blob1149bd93). */
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';
import {Player} from '../src/player';import {Player as BeforeSupport} from './fixtures/player-pre-evade-support';
for(const hz of [30,60,120])for(const wet of [false,true])test(`production non-evade parity ${hz}Hz ${wet?'water':'dry'} for8seconds`,()=>{
 const floor=new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2).rotateZ(-.03),wall=new THREE.BoxGeometry(.3,4,5).translate(3,2,-2),colliders=[floor,wall].map((geometry,i)=>({name:`fixture${i}`,enabled:true,bvh:new MeshBVH(geometry)}));
 const current=new Player(colliders,wet?1.8:-100),old=new BeforeSupport(colliders,wet?1.8:-100);current.teleport(0,.2,0);old.teleport(0,.2,0);
 for(let i=0;i<hz*8;i++){const t=i/hz,input={x:t<2?1:t<4?-1:0,z:t<5?0:1,jump:(t>.7&&t<.8)||(t>2.5&&t<2.6),sprint:t>3&&t<6};current.step(1/hz,input);old.step(1/hz,input);
  assert.deepEqual({p:current.pos.toArray(),v:current.vel.toArray(),ground:current.onGround,swim:current.swimming,glide:current.gliding,updraft:current.inUpdraft},{p:old.pos.toArray(),v:old.vel.toArray(),ground:old.onGround,swim:old.swimming,glide:old.gliding,updraft:old.inUpdraft});}
 assert.equal((current as any).evadeSupport.diagnostics.supportPasses,0);floor.dispose();wall.dispose();
});
