import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldActions, type WorldActionContext, type ActionPoseCommand } from '../src/worldActions';
import type { StrikeRequest } from '../src/combatActions';
import type { HitContext } from '../src/combat';
import { Player, PLAYER } from '../src/player';
import { MeshBVH } from 'three-mesh-bvh';
import { attachExplorerBlade } from '../src/playerBladeArt';
import type { SkinnedCharacterRig } from '../src/skinnedCharacter';

function fixture() {
  const context:WorldActionContext={enabled:true,grounded:true,armed:true,bladeReady:true,position:{x:2,y:1,z:3},yaw:0,moveX:0,moveZ:0,identity:null};
  const strikes:{request:StrikeRequest;source:HitContext['source']}[]=[],messages:string[]=[];
  let command:ActionPoseCommand|undefined,poses=0,cancels=0,canPose=true,defense={guard:1,invulnerable:false};
  const actions=new WorldActions({scene:new THREE.Scene(),context:()=>context,
    strike:(request,source)=>{strikes.push({request,source});return{damage:request.damage,kills:[],hits:[{id:'enemy',damage:request.damage}]};},
    startPose:(_identity,value)=>{poses++;if(!canPose)return false;command=value;return true;},cancelPoses:()=>{cancels++;},
    defense:value=>{defense=value;},toast:message=>messages.push(message),reducedEffects:()=>false});
  return {actions,context,strikes,messages,command:()=>command!,poses:()=>poses,cancels:()=>cancels,defense:()=>defense,setCanPose:(v:boolean)=>{canPose=v;}};
}
test('all damage actions respect equipment and disabled/airborne contexts',()=>{
  for(const block of ['enabled','grounded','armed'] as const)for(const action of ['melee','skill','ultimate']){
    const f=fixture();f.context[block]=false;assert.equal(f.actions.press(action),true);
    for(let i=0;i<100;i++)f.actions.update(.05);f.actions.flush();
    assert.equal(f.strikes.length,0,`${block} ${action}`);assert.equal(f.actions.skills.cooldown('skill'),0);f.actions.dispose();
  }
});
test('melee contacts use the locked swing heading in all view quadrants, not later camera rotation',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const f=fixture();f.context.yaw=yaw;f.actions.press('melee');assert.equal(f.strikes.length,0);
    f.context.yaw=yaw+.7;f.actions.update(.1);assert.equal(f.strikes.length,0);f.actions.update(.1);
    assert.equal(f.strikes.length,1);const strike=f.strikes[0];assert.equal(strike.source,'melee');
    assert.ok(Math.abs(strike.request.direction.x+Math.sin(yaw))<1e-9);assert.ok(Math.abs(strike.request.direction.z+Math.cos(yaw))<1e-9);
    for(let i=0;i<20;i++)f.actions.update(.05);assert.equal(f.strikes.length,1);f.actions.dispose();
  }
});
test('cancel interrupts melee, evade, defense and authored contacts without refunding cooldowns',()=>{
  const f=fixture();f.actions.press('melee');f.actions.update(.1);f.actions.cancel();f.actions.update(.1);assert.equal(f.strikes.length,0);
  f.actions.press('evade');assert.equal(f.actions.evade.active,true);const evadeCooldown=f.actions.evade.cooldown;
  f.actions.cancel();assert.equal(f.actions.evade.active,false);assert.equal(f.actions.evade.cooldown,evadeCooldown);assert.deepEqual(f.defense(),{guard:1,invulnerable:false});
  f.context.identity='saber';f.actions.press('skill');const command=f.command(),cooldown=f.actions.skills.cooldown('skill');
  assert.ok(cooldown>0);f.actions.cancel();command.onContact(f.context.position,{x:0,y:0,z:-1});f.actions.flush();
  assert.equal(f.strikes.length,0);assert.equal(f.actions.skills.cooldown('skill'),cooldown);f.actions.dispose();
});
test('failed actor startup costs no skill cooldown; identity changes cannot refresh a successful cast',()=>{
  const f=fixture();f.context.identity='saber';f.setCanPose(false);f.actions.press('skill');assert.equal(f.actions.skills.cooldown('skill'),0);
  f.setCanPose(true);f.actions.press('skill');const cooldown=f.actions.skills.cooldown('skill'),old=f.command();assert.ok(cooldown>0);
  f.context.identity='musashi';f.actions.update(.01);assert.ok(f.actions.skills.cooldown('skill')>=cooldown-.011);
  old.onContact(f.context.position,{x:0,y:0,z:-1});f.actions.flush();assert.equal(f.strikes.length,0);
  f.actions.press('skill');assert.equal(f.poses(),2);assert.ok(f.actions.skills.cooldown('skill')>0);f.actions.dispose();
});
test('late authored contact after leaving ground is rejected by same-frame flush',()=>{
  const f=fixture();f.context.identity='saber';f.actions.press('skill');f.actions.update(.01);
  f.context.grounded=false;f.command().onContact(f.context.position,{x:0,y:0,z:-1});f.actions.flush();
  assert.equal(f.strikes.length,0);f.actions.dispose();
});
test('identity changes between input events cancel the old actor pose before new actions',()=>{
  const f=fixture();f.context.identity='saber';f.actions.press('skill');const previous=f.cancels();
  f.context.identity='musashi';f.actions.press('melee');assert.ok(f.cancels()>previous);f.actions.dispose();
});
test('ranged/melee damage alone charge energy; resets clear state rather than preserve paid resources',()=>{
  const f=fixture();for(const source of ['skill','ultimate','servant'] as const)f.actions.recordDamage({id:'enemy',damage:100,source,eligible:true});assert.equal(f.actions.skills.energy,0);
  f.actions.recordDamage({id:'enemy',damage:100,source:'ranged',eligible:true});assert.ok(f.actions.skills.energy>0);
  f.actions.press('skill');f.actions.reset();assert.equal(f.actions.skills.energy,0);assert.equal(f.actions.skills.cooldown('skill'),0);assert.equal(f.actions.melee.active,false);assert.equal(f.actions.evade.active,false);f.actions.dispose();
});

test('fixed-step evade uses the real capsule collision and cannot pass through a thin closed wall',()=>{
  const ground=new THREE.BoxGeometry(20,1,20).translate(0,-.5,0),wall=new THREE.BoxGeometry(10,4,.08).translate(0,2,0);
  const barriers=[{name:'ground',enabled:true,bvh:new MeshBVH(ground)},{name:'gate',enabled:true,bvh:new MeshBVH(wall)}];
  const player=new Player(barriers,-10);player.teleport(0,.01,1.5);
  const idle={x:0,z:0,jump:false,sprint:false};for(let i=0;i<30;i++)player.step(1/120,idle);assert.equal(player.onGround,true);
  for(let i=0;i<60;i++)player.step(1/120,{...idle,evade:{x:0,z:-1}});
  assert.ok(player.pos.z>=PLAYER.radius+.039,`closed wall penetrated: ${player.pos.z}`);
  barriers[1].enabled=false;for(let i=0;i<60;i++)player.step(1/120,{...idle,evade:{x:0,z:-1}});assert.ok(player.pos.z< -1);
  player.teleport(0,3,2);player.step(1/120,{...idle,evade:{x:0,z:-1}});assert.equal(player.pos.z,2,'airborne evade adds no horizontal impulse');
  ground.dispose();wall.dispose();
});
test('blade loading respects late disposal and owns shared resources exactly once',async()=>{
  const hand=new THREE.Group(),rig={handSockets:{R:hand}} as unknown as SkinnedCharacterRig;
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),model=new THREE.Group();model.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));
  let disposedGeometry=0,disposedMaterial=0;geometry.addEventListener('dispose',()=>disposedGeometry++);material.addEventListener('dispose',()=>disposedMaterial++);
  let resolve!:(value:{scene:THREE.Group})=>void;const blade=attachExplorerBlade(rig,()=>new Promise(r=>resolve=r));
  blade.update(true);assert.equal(blade.root.visible,false);blade.dispose();blade.dispose();resolve({scene:model});await blade.ready;
  assert.equal(blade.loaded,false);assert.equal(hand.children.length,0);assert.equal(disposedGeometry,1);assert.equal(disposedMaterial,1);
  const failed=attachExplorerBlade(rig,async()=>{throw new Error('network');});await assert.rejects(failed.ready,/network/);failed.update(true);assert.equal(failed.loaded,false);assert.equal(failed.root.visible,false);failed.dispose();
});

test('authored weapon-contact metadata reaches combat unchanged, without lifting or replacing the socket', () => {
  const f = fixture(); f.context.identity = 'blackbeard'; f.actions.press('skill');
  const muzzle = { x: 2.25, y: 2.2, z: 3.1 };
  f.command().onContact(muzzle, { x: 0, y: 0, z: -1 }, 'muzzle', { losOffset: 0, casterFeetY: 1 });
  f.actions.flush(); assert.equal(f.strikes.length, 1);
  assert.deepEqual(f.strikes[0].request.origin, muzzle); assert.equal(f.strikes[0].request.losOffset, 0); assert.equal(f.strikes[0].request.casterFeetY, 1);
  assert.deepEqual(f.context.position, { x: 2, y: 1, z: 3 }, 'actor/player position is not moved to satisfy a hit');
  f.actions.dispose();
});
