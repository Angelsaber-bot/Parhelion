import {test as nodeTest} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';import {Player as HistoricalPlayer} from './fixtures/player-pre-general-support';
export function verifyGeneralGroundSupport(label:string,Player:new(...args:any[])=>any,install:(p:any)=>{readonly diagnostics:any;dispose():void}){
const test=(name:string,run:()=>void)=>nodeTest(`${label}: ${name}`,run);
const idle={x:0,z:0,jump:false,sprint:false},collider=(g:THREE.BufferGeometry)=>({name:'fixture',enabled:true,bvh:new MeshBVH(g)}),state=(p:any)=>({p:p.pos.toArray(),v:p.vel.toArray(),ground:p.onGround,swim:p.swimming,glide:p.gliding,updraft:p.inUpdraft});
function settle(p:any){for(let i=0;i<120;i++)p.step(1/120,idle);assert.ok(p.onGround);}
for(const angle of[0,3,6,12])test(`general candidate walks ${angle}degree slope without changing horizontal distance`,()=>{
 const g=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2).rotateZ(angle*Math.PI/180),colliders=[collider(g)],a=new HistoricalPlayer(colliders,-20),b=new Player(colliders,-20),c=install(b);
 try{a.teleport(0,.04,0);b.teleport(0,.04,0);settle(a);settle(b);let air=0,oldAir=0;for(let i=0;i<480;i++){const input={...idle,x:-1};a.step(1/120,input);b.step(1/120,input);assert.equal(b.pos.x,a.pos.x);assert.equal(b.pos.z,a.pos.z);assert.ok(Math.abs(b.pos.y-a.pos.y)<.04);air+=Number(!b.onGround);oldAir+=Number(!a.onGround);}if(angle<=6){assert.equal(air,0);if(angle)assert.ok(oldAir>0&&c.diagnostics.recovered>0);else assert.equal(c.diagnostics.supportPasses,0);}else{assert.equal(air,oldAir,'12degree stance gap exceeds strict1cm predicate, so no broader snap');assert.equal(c.diagnostics.recovered,0);assert.ok(c.diagnostics.rejected>0);}}finally{c.dispose();g.dispose();}
});
test('flat jump, second-press glide, and airborne teleport preserve baseline trajectory exactly',()=>{
 const g=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2),colliders=[collider(g)],a=new HistoricalPlayer(colliders,-20),b=new Player(colliders,-20),c=install(b);
 try{a.teleport(0,.04,0);b.teleport(0,.04,0);settle(a);settle(b);for(let i=0;i<240;i++){const input={...idle,z:1,jump:i===0||i===20};a.step(1/120,input);b.step(1/120,input);assert.deepEqual(state(b),state(a));}assert.equal(c.diagnostics.supportPasses,0);a.teleport(0,10,0);b.teleport(0,10,0);for(let i=0;i<60;i++){a.step(1/120,idle);b.step(1/120,idle);assert.deepEqual(state(b),state(a));}assert.equal(c.diagnostics.supportPasses,0);}finally{c.dispose();g.dispose();}
});
test('real ledge fall and swimming do not gain a foothold or trajectory change',()=>{
 const g=new THREE.BoxGeometry(4,.2,20).translate(0,-.1,0),colliders=[collider(g)],a=new HistoricalPlayer(colliders,-2),b=new Player(colliders,-2),c=install(b);
 try{a.teleport(-1.55,.04,0);b.teleport(-1.55,.04,0);settle(a);settle(b);let swim=false;for(let i=0;i<480;i++){const input={...idle,x:-1};a.step(1/120,input);b.step(1/120,input);assert.deepEqual(state(b),state(a));swim||=b.swimming;}assert.ok(swim);assert.equal(c.diagnostics.recovered,0);assert.ok(c.diagnostics.rejected>0);}finally{c.dispose();g.dispose();}
});
test('updraft airborne trajectory and nonwalkable slope remain unchanged',()=>{
 const g=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2).rotateZ(Math.PI/3),colliders=[collider(g)],a=new HistoricalPlayer(colliders,-20),b=new Player(colliders,-20),c=install(b);
 try{a.teleport(0,2,0);b.teleport(0,2,0);a.updrafts=[{x:0,z:0,r:4,y0:0,y1:10}];b.updrafts=[...a.updrafts];for(let i=0;i<120;i++){a.step(1/120,idle);b.step(1/120,idle);assert.deepEqual(state(b),state(a));}assert.equal(c.diagnostics.supportPasses,0);assert.ok(b.inUpdraft);}finally{c.dispose();g.dispose();}
});
test('closing the physical support floor never preserves ground through a removed collider',()=>{
 const g=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2),floor=collider(g),a=new HistoricalPlayer([floor],-20),b=new Player([floor],-20),c=install(b);
 try{a.teleport(0,.04,0);b.teleport(0,.04,0);settle(a);settle(b);floor.enabled=false;for(let i=0;i<30;i++){a.step(1/120,idle);b.step(1/120,idle);assert.deepEqual(state(b),state(a));}assert.equal(c.diagnostics.recovered,0);assert.equal(b.onGround,false);}finally{c.dispose();g.dispose();}
});
for(const kind of ['step','corner','low-roof']as const)test(`general ${kind} control preserves actual collision and horizontal path`,()=>{
 const floor=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2),obstacles=kind==='step'?[new THREE.BoxGeometry(2,.25,10).translate(-3,.125,0)]:kind==='corner'?[new THREE.BoxGeometry(.3,4,10).translate(-3,2,0),new THREE.BoxGeometry(10,4,.3).translate(0,2,3)]:[new THREE.BoxGeometry(5,.2,8).translate(-4,2,0)];const geometries=[floor,...obstacles],colliders=geometries.map(collider),a=new HistoricalPlayer(colliders,-20),b=new Player(colliders,-20),c=install(b);
 try{a.teleport(0,.04,0);b.teleport(0,.04,0);settle(a);settle(b);for(let i=0;i<480;i++){const input={...idle,x:-1,z:kind==='corner'?.5:0,jump:kind==='low-roof'&&i===35};a.step(1/120,input);b.step(1/120,input);assert.deepEqual(state(b),state(a));}assert.equal(c.diagnostics.recovered,0);assert.ok(c.diagnostics.maxSupportPassesPerStep<=1&&c.diagnostics.maxCapsuleRetriesPerStep<=1);}finally{c.dispose();geometries.forEach(g=>g.dispose());}
});
test('sloping shoreline keeps swim admission step and has no recovery in water',()=>{
 const g=new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2).rotateZ(.1),colliders=[collider(g)],a=new HistoricalPlayer(colliders,0),b=new Player(colliders,0),c=install(b);
 try{a.teleport(0,.04,0);b.teleport(0,.04,0);settle(a);settle(b);let firstA=-1,firstB=-1,maxXZ=0;for(let i=0;i<960;i++){const queries=c.diagnostics.supportPasses;a.step(1/120,{...idle,x:-1});b.step(1/120,{...idle,x:-1});if(a.swimming&&firstA<0)firstA=i;if(b.swimming&&firstB<0)firstB=i;if(firstB>=0)assert.equal(c.diagnostics.supportPasses,queries,'no additional support after first water entry');maxXZ=Math.max(maxXZ,Math.abs(a.pos.x-b.pos.x));}assert.equal(firstA,251);assert.equal(firstB,firstA);assert.ok(maxXZ<=.02062500001,'existing buoyancy threshold can differ by one speed step');assert.equal(a.pos.x,b.pos.x);assert.ok(c.diagnostics.recovered>0);}finally{c.dispose();g.dispose();}
});
for(const hz of[30,60,120])test(`general walking support at ${hz}Hz preserves horizontal travel and bounded queries`,()=>{
 const g=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2).rotateZ(Math.PI/30),colliders=[collider(g)],a=new HistoricalPlayer(colliders,-20),b=new Player(colliders,-20),c=install(b);
 try{a.teleport(0,.04,0);b.teleport(0,.04,0);settle(a);settle(b);let grounded=0;for(let i=0;i<hz*4;i++){a.step(1/hz,{...idle,x:-1});b.step(1/hz,{...idle,x:-1});assert.equal(b.pos.x,a.pos.x);assert.equal(b.pos.z,a.pos.z);grounded+=Number(b.onGround);}assert.equal(grounded,hz*4);assert.ok(c.diagnostics.maxSupportPassesPerStep<=1&&c.diagnostics.maxCapsuleRetriesPerStep<=1);}finally{c.dispose();g.dispose();}
});
test('step-down support respects the unchanged 1cm gap instead of introducing ledge grace',()=>{
 for(const drop of[.005,.009,.012,.025]){const geometries=[new THREE.BoxGeometry(4,.2,10).translate(-2,-.1,0),new THREE.BoxGeometry(20,.2,10).translate(10,-.1-drop,0)],colliders=geometries.map(collider),p=new Player(colliders,-20),c=install(p);
  try{p.teleport(-.5,.04,0);settle(p);for(let i=0;i<60;i++)p.step(1/120,{...idle,x:1});if(drop<.01)assert.ok(c.diagnostics.recovered>0);else{assert.equal(c.diagnostics.recovered,0);assert.ok(c.diagnostics.rejected>0);assert.equal(c.diagnostics.capsuleRetries,0);}assert.ok(c.diagnostics.maxSupportPassesPerStep<=1&&c.diagnostics.maxCapsuleRetriesPerStep<=1);}finally{c.dispose();geometries.forEach(g=>g.dispose());}}
});
test('a near-floor airborne teleport cannot manufacture prior-grounded provenance',()=>{
 const g=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2),p=new Player([collider(g)],-20),c=install(p);
 try{p.teleport(0,.009,0);assert.equal(p.onGround,false);p.step(1/120,idle);assert.equal(p.onGround,false);assert.ok(p.pos.y>0&&p.pos.y<.01);assert.equal(c.diagnostics.supportPasses,0);for(let i=0;i<10;i++)p.step(1/120,idle);assert.ok(p.onGround,'natural capsule contact may land normally');assert.equal(c.diagnostics.supportPasses,0);}finally{c.dispose();g.dispose();}
});

}
