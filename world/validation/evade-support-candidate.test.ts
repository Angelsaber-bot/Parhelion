/** Validation-only candidate coverage. Real Player/capsule/BVH + original evade
 * clock; no forced grounding. Production installation is intentionally absent. */
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';
import {Player,type Collider} from '../src/player';import {PlayerEvade} from '../src/playerMelee';import {installEvadeSupportCandidate} from './combat-review/evade-support-candidate';
const idle={x:0,z:0,jump:false,sprint:false};
const collider=(name:string,geometry:THREE.BufferGeometry):Collider=>({name,enabled:true,bvh:new MeshBVH(geometry)});
const slope=(gradient=.05)=>collider('walkable slope',new THREE.PlaneGeometry(400,400).rotateX(-Math.PI/2).rotateZ(-Math.atan(gradient)));
const box=(name:string,size:[number,number,number],at:[number,number,number])=>collider(name,new THREE.BoxGeometry(...size).translate(...at));
function setup(colliders:Collider[],candidate:boolean,x=0,z=0){const player=new Player(colliders,-100),probe=candidate?installEvadeSupportCandidate(player):null;player.teleport(x,.2,z);for(let i=0;i<180;i++)player.step(1/120,idle);assert.equal(player.onGround,true);return{player,probe};}
function evade(player:Player,dt:number,direction={x:1,z:0},extra:{jump?:boolean;moveAfter?:boolean}={}){
 const clock=new PlayerEvade();assert.equal(player.onGround,true);assert.equal(clock.start(direction.x,direction.z),true);const from=player.pos.clone(),trace:{remaining:number;cooldown:number;grounded:boolean;invulnerable:boolean}[]=[];
 for(let i=0;i<Math.ceil(.5/dt);i++){const remaining=clock.remaining;player.step(dt,{...idle,x:extra.moveAfter?1:0,jump:!!extra.jump,evade:remaining>0?{...direction,strength:Math.min(remaining,dt)/dt}:undefined});if(!player.onGround)clock.update(0,false);clock.update(dt,true);trace.push({remaining:clock.remaining,cooldown:clock.cooldown,grounded:player.onGround,invulnerable:remaining>.10});}
 return{distance:Math.hypot(player.pos.x-from.x,player.pos.z-from.z),from,trace,clock};
}
for(const hz of [30,60,120])test(`${hz}Hz: bounded support preserves exact3.12m evade and original clocks without cumulative downhill boost`,()=>{
 const geometry=slope(),flat=slope(0),a=setup([geometry],true),control=setup([flat],false);const result=evade(a.player,1/hz),reference=evade(control.player,1/hz);
 assert.ok(Math.abs(result.distance-3.12)<1e-6);assert.deepEqual(result.trace.map(({remaining,cooldown,invulnerable})=>({remaining,cooldown,invulnerable})),reference.trace.map(({remaining,cooldown,invulnerable})=>({remaining,cooldown,invulnerable})));
 let distance=result.distance;for(let repeat=0;repeat<9;repeat++){for(let i=0;i<180;i++)a.player.step(1/120,idle);distance+=evade(a.player,1/hz).distance;}
 assert.ok(Math.abs(distance-31.2)<1e-6);const diagnostics=a.probe!.diagnostics;assert.ok(diagnostics.extraQueries<=diagnostics.supportQueries&&diagnostics.supportQueries<=diagnostics.steps);assert.ok(diagnostics.maxObservedExtraQueriesPerStep<=1);assert.ok(diagnostics.maxObservedSupportQueriesPerStep<=1);assert.equal(diagnostics.maxExtraQueriesPerStep,1);assert.equal(diagnostics.maxSupportRaysPerStep,1);a.probe!.dispose();geometry.bvh.geometry.dispose();flat.bvh.geometry.dispose();
});
test('thin ledge rejects over-edge support and preserves genuine fall cancellation/rollback',()=>{
 for(const start of [-.16,-.15,-.10]){const ledge=box('thin ledge',[.4,.2,5],[0,-.1,0]),a=setup([ledge],true,start),b=setup([ledge],false,start),one=evade(a.player,1/120,{x:1,z:0},{moveAfter:true}),two=evade(b.player,1/120,{x:1,z:0},{moveAfter:true});
  assert.ok(one.distance<4.6);assert.equal(a.player.onGround,false);assert.equal(one.clock.remaining,0);assert.ok(Math.abs(one.distance-two.distance)<1e-8,'no new rim grab extends travel');assert.ok(a.probe!.diagnostics.supportRejected>=1);assert.equal(a.probe!.diagnostics.recovered,0);a.probe!.dispose();ledge.bvh.geometry.dispose();}
});
test('solid corner and low ceiling remain collision barriers; support cannot add lateral penetration',()=>{
 for(const shape of ['corner','ceiling']as const){const colliders=[slope(),box('wall',[.1,4,10],[1,2,0]),...(shape==='corner'?[box('other wall',[10,4,.1],[0,2,1])]:[box('low roof',[4,.2,5],[3,1.75,0])])],a=setup(colliders,true);evade(a.player,1/120,shape==='corner'?{x:1,z:1}:{x:1,z:0});assert.ok(a.player.pos.x<=.60001);if(shape==='corner')assert.ok(a.player.pos.z<=.60001);a.probe!.dispose();colliders.forEach(c=>c.bvh.geometry.dispose());}
});
test('jump, swimming transition, updraft and genuine airborne glide never receive support recovery',()=>{
 for(const mode of ['jump','water','updraft','glide']as const){const ground=slope(0),a=setup([ground],true),b=setup([ground],false);
  for(const player of [a.player,b.player]){if(mode==='water')player.waterLevel=2;if(mode==='updraft')player.updrafts=[{x:0,z:0,r:10,y0:0,y1:10}];if(mode==='glide'){player.step(1/120,{...idle,jump:true});player.step(1/120,idle);player.step(1/120,{...idle,jump:true});assert.equal(player.gliding,true);}}
  if(mode==='glide'){for(let i=0;i<20;i++){a.player.step(1/120,{...idle,evade:{x:1,z:0}});b.player.step(1/120,{...idle,evade:{x:1,z:0}});}}else{evade(a.player,1/120,{x:1,z:0},{jump:mode==='jump'});evade(b.player,1/120,{x:1,z:0},{jump:mode==='jump'});}
  assert.deepEqual(a.player.pos.toArray(),b.player.pos.toArray());assert.deepEqual(a.player.vel.toArray(),b.player.vel.toArray());assert.equal(a.probe!.diagnostics.supportQueries,0);a.probe!.dispose();ground.bvh.geometry.dispose();}
});
test('steep/nonwalkable slope cannot become an airborne evade foothold',()=>{
 const steep=slope(Math.tan(60*Math.PI/180)),player=new Player([steep],-100),candidate=installEvadeSupportCandidate(player);player.teleport(0,.2,0);for(let i=0;i<120;i++)player.step(1/120,{...idle,evade:{x:1,z:0}});assert.equal(player.onGround,false);assert.equal(candidate.diagnostics.recovered,0);assert.equal(candidate.diagnostics.supportQueries,0);candidate.dispose();steep.bvh.geometry.dispose();
});
