import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshBVH } from 'three-mesh-bvh';
import { KitCompanion } from '../src/kitCompanion.ts';
import { CharacterKit, type CharacterKitDefinition } from '../src/characters/characterKit.ts';
import { MOUNTED_CHARGE, mountedChargeDistance } from '../src/characters/mountedChargeMotion.ts';
import type { Collider } from '../src/player.ts';
const contact=23/30,duration=1.4;
function fixture(extra:Collider[]=[],floorSize=100) {
  const scene=new THREE.Group(),socket=new THREE.Object3D();socket.name='Saddle';scene.add(socket);
  const definition:CharacterKitDefinition={id:'mounted-test',assetUrl:'test',defaultState:'idle',rootMotion:'in-place',mount:{saddleSocket:'saddle',riderSeatSocket:'saddle'},sockets:{saddle:{node:'Saddle'}},
    clips:{idle:{name:'Idle',duration:3,loop:true},walk:{name:'Walk',duration:1,loop:true,nominalSpeed:.7},run:{name:'Run',duration:.8,loop:true,nominalSpeed:2.093},attack:{name:'Attack',duration,loop:false,events:[{at:contact,kind:'hit'}]}}};
  const gltf={scene,animations:Object.values(definition.clips).map(c=>new THREE.AnimationClip(c.name,c.duration,[]))}as GLTF;
  const colliders:Collider[]=[{name:'floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(floorSize,floorSize).rotateX(-Math.PI/2))},...extra];
  let enemy:{id:string;position:THREE.Vector3}|null={id:'enemy',position:new THREE.Vector3(0,0,7)},time=0,cooldown=0;
  const attempts:{id:string;time:number;position:THREE.Vector3;hit:boolean}[]=[],player=new THREE.Vector3();
  const follow=new KitCompanion({colliders,range:4.5,damage:16,engage:()=>enemy,
    target:(p,r,id)=>enemy&&(!id||id===enemy.id)&&cooldown<=0&&p.distanceTo(enemy.position)<r?enemy:null,
    strike:(p,r,_d,id)=>{const hit=!!enemy&&enemy.id===id&&p.distanceTo(enemy.position)<r&&cooldown<=0;attempts.push({id,time,position:p.clone(),hit});if(hit)cooldown=1.1;return hit?enemy:null;}});
  const actor=new CharacterKit(gltf,definition,{onEvent:event=>follow.onEvent(actor,event)});
  function tick(dt=.05,paused=false){time+=dt;cooldown=Math.max(0,cooldown-dt);follow.update(actor,dt,player,0,paused);}
  function until(when:()=>boolean,limit=20){for(let i=0;i<limit/.05&&!when();i++)tick();assert.ok(when(),`condition not met: ${follow.mountedPhase}, ${actor.root.position.toArray()}`);}
  return{actor,follow,player,colliders,attempts,tick,until,get enemy(){return enemy;},set enemy(v){enemy=v;},get time(){return time;}};
}
const wall=(x:number,z:number,width=10):Collider=>({name:'wall',enabled:true,bvh:new MeshBVH(new THREE.BoxGeometry(width,4,.3).translate(x,2,z))});

test('mounted servant stages, advances through one authored hit, brakes, recovers and charges again after cooldown',()=>{
  const f=fixture();f.until(()=>f.follow.mountedPhase==='charge');const start=f.actor.root.position.clone(),began=f.time;
  for(let i=0;i<14;i++)f.tick();assert.equal(f.attempts.length,0);assert.ok(f.actor.root.position.distanceTo(start)>3);
  f.until(()=>f.attempts.length===1);assert.equal(f.attempts[0].hit,true);assert.ok(Math.abs(f.attempts[0].time-began-contact)<.051);
  assert.ok(Math.abs(f.attempts[0].position.distanceTo(start)-mountedChargeDistance(contact,duration,contact))<1e-5,'root sampled at exact contact, not end of crossing frame');
  f.until(()=>f.follow.mountedPhase==='recover');assert.equal(f.attempts.length,1);
  const stopped=f.actor.root.position.clone();for(let i=0;i<10;i++)f.tick();assert.equal(f.attempts.length,1);assert.ok(stopped.distanceTo(f.actor.root.position)<1e-6);
  f.until(()=>f.attempts.length===2);assert.equal(f.attempts[1].hit,true);assert.ok(f.attempts[1].time-f.attempts[0].time>duration+MOUNTED_CHARGE.recovery);
  f.actor.dispose();
});

test('target death or replacement before contact never redirects the committed hit to another enemy',()=>{
  for(const replacement of [null,{id:'replacement',position:new THREE.Vector3(0,0,7)}]){
    const f=fixture();f.until(()=>f.follow.mountedPhase==='charge');f.tick();f.enemy=replacement;f.tick();
    assert.equal(f.follow.mountedPhase,'recover');assert.equal(f.attempts.length,0);f.actor.dispose();
  }
});

test('pause freezes locomotion and animation; recall cancels contact without a post-resume backlog',()=>{
  const f=fixture();f.until(()=>f.follow.mountedPhase==='charge');f.tick();const at=f.actor.root.position.clone(),time=f.actor.clipTime;
  for(let i=0;i<20;i++)f.tick(.1,true);assert.equal(f.actor.clipTime,time);assert.ok(at.distanceTo(f.actor.root.position)<1e-8);
  f.follow.release(f.actor);assert.equal(f.follow.attacking,false);assert.equal(f.actor.state,'idle');f.enemy=null;
  for(let i=0;i<30;i++)f.tick();assert.equal(f.attempts.length,0);f.actor.dispose();
});

test('a blocked enemy is not charged through walls; disabled colliders allow the next attempt',()=>{
  const obstacle=wall(0,3,30),f=fixture([obstacle]);for(let i=0;i<160;i++)f.tick();
  assert.equal(f.attempts.length,0);assert.ok(f.actor.root.position.z<3-MOUNTED_CHARGE.halfLength);
  obstacle.enabled=false;f.until(()=>f.attempts.some(a=>a.hit));f.actor.dispose();
});

test('a wall appearing during charge cancels the pending hit before horse penetration',()=>{
  const obstacle=wall(0,4,30);obstacle.enabled=false;const f=fixture([obstacle]);f.until(()=>f.follow.mountedPhase==='charge');
  obstacle.enabled=true;f.tick();assert.equal(f.follow.mountedPhase,'recover');assert.equal(f.attempts.length,0);f.actor.dispose();
});

test('unsupported ground and narrow edges cannot be crossed by a horse-sized footprint',()=>{
  const f=fixture([],10);f.enemy={id:'enemy',position:new THREE.Vector3(0,0,8)};
  for(let i=0;i<200;i++)f.tick();assert.equal(f.attempts.length,0);assert.ok(Math.abs(f.actor.root.position.z)<5);f.actor.dispose();
});

test('fast fleeing targets can evade a committed straight charge; no homing or retarget damage',()=>{
  const f=fixture();f.until(()=>f.follow.mountedPhase==='charge');const heading=f.actor.root.rotation.y;
  for(let i=0;i<20;i++){f.enemy!.position.x-=.2;f.tick();}
  assert.ok(f.attempts.every(a=>!a.hit));assert.equal(f.actor.root.rotation.y,heading);f.actor.dispose();
});

test('death during approach drops the target and an unreachable staging slot does not run against a wall',()=>{
  const f=fixture();f.until(()=>f.follow.mountedPhase==='approach');f.enemy=null;f.tick();
  assert.equal(f.follow.mountedPhase,'follow');assert.equal(f.attempts.length,0);f.actor.dispose();
  const obstacle=wall(0,3,30),blocked=fixture([obstacle]);
  for(let i=0;i<100;i++)blocked.tick();
  assert.equal(blocked.follow.mountedPhase,'follow');assert.equal(blocked.actor.state,'idle');assert.equal(blocked.attempts.length,0);blocked.actor.dispose();
});
