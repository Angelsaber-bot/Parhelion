/** Real Player capsule + combat clocks over a BVH arena. Not a browser/GPU or human playtest. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { Player } from '../src/player.ts';
import { WorldCombatState, enemyAttackTiming, type Enemy, type CombatTerrain } from '../src/combat.ts';
import { ENEMY_ROLES, type EnemyRole } from '../src/enemyRoles.ts';

const STEP=1/120;
const FPS=[27,30,60,120];
const p=(x:number,z=0)=>({x,y:0,z});
const ground:CombatTerrain={walk:(_from,x,z)=>p(x,z),lineOfSight:()=>true};
function replay(fps:number, role:EnemyRole|'boss_winter_warden'|'boss_hellfire_lord', policy:'side'|'retreat'|'still', wall=false) {
  const floor=new THREE.BoxGeometry(100,1,100).translate(0,-.5,0);
  const wallGeo=new THREE.BoxGeometry(16,3,.2).translate(5,1.5,.7);
  const colliders=[{name:'floor',enabled:true,bvh:new MeshBVH(floor)}];
  if(wall) colliders.push({name:'wall',enabled:true,bvh:new MeshBVH(wallGeo)});
  const player=new Player(colliders,-10);
  const isBoss=role.startsWith('boss_');
  const range=isBoss?6.5:ENEMY_ROLES[role as EnemyRole].range-.2;
  player.teleport(range,.01,0);
  const idle={x:0,z:0,jump:false,sprint:false};
  for(let i=0;i<30;i++) player.step(STEP,idle);
  const state=new WorldCombatState(isBoss?[]:[{id:'actor',kind:'shade',p:p(0),role:role as EnemyRole}],{id:isBoss?role:'unused',kind:'king',p:isBoss?p(0):p(100),requires:[]});
  const enemy:Enemy=isBoss?state.boss:state.enemies[0];
  if(isBoss) {state.beginBoss(new Set());enemy.phase=2;enemy.attackCount=role==='boss_winter_warden'?1:2;}
  enemy.mode='chase';enemy.timer=0;
  state.step(.05,player.pos,true,ground);
  assert.equal(enemy.mode,'windup');
  const tell=enemyAttackTiming(enemy).windup;
  let acc=0,aiAcc=0,elapsed=0,renderElapsed=0,physicsSteps=0;
  while(enemy.mode==='windup' && renderElapsed<4) {
    renderElapsed+=1/fps;acc+=1/fps;
    // Human input can only change on a rendered frame, so reaction has real display quantization.
    const reacted=renderElapsed>=.3;
    while(acc+1e-9>=STEP && enemy.mode==='windup') {
      const x=reacted&&policy==='retreat'?1:0;
      const z=reacted&&policy==='side'?-1:0; // Player yaw0: negative input z moves world+z.
      player.step(STEP,{...idle,x,z});
      elapsed+=STEP;physicsSteps++;aiAcc+=STEP;
      if(aiAcc+1e-9>=.05) {state.step(.05,player.pos,true,ground);aiAcc=Math.max(0,aiAcc-.05);}
      acc=Math.max(0,acc-STEP);
    }
  }
  const result={hp:state.hp,x:player.pos.x,z:player.pos.z,y:player.pos.y,elapsed,physicsSteps,tell,mode:enemy.mode,attack:enemy.attack};
  floor.dispose();wallGeo.dispose();return result;
}
for(const role of Object.keys(ENEMY_ROLES) as EnemyRole[]) test(`${role}: physical ground movement after a .3s reaction avoids its first attack at every display rate`,()=>{
  const profile=ENEMY_ROLES[role];
  const policy=profile.attack==='sweep'?'retreat':'side';
  const runs=FPS.map(fps=>replay(fps,role,policy));
  for(const run of runs) {
    assert.equal(run.hp,100,`${role}: ${JSON.stringify(run)}`);
    assert.equal(run.mode,'recover');assert.ok(Math.abs(run.y)<.02,'capsule remains grounded');
  }
  assert.equal(new Set(runs.map(run=>run.physicsSteps)).size,1,'same impact simulation tick across display rates');
  assert.ok(replay(60,role,'still').hp<100,'passing dodge test cannot mean a disconnected attack');
});
for(const id of ['boss_winter_warden','boss_hellfire_lord'] as const) test(`${id}: midrange spear respects real blocked sidesteps, with retreat as an available alternative`,()=>{
  for(const fps of FPS) {
    const side=replay(fps,id,'side'), blocked=replay(fps,id,'side',true), retreat=replay(fps,id,'retreat',true);
    assert.equal(side.attack,'thrust');assert.equal(side.hp,100);
    assert.ok(blocked.z<.35,'BVH wall actually prevents imaginary side movement');
    assert.ok(blocked.hp<100,'cannot dodge through geometry');
    assert.equal(retreat.hp,100,'walking out beyond the spear remains possible despite blocked side');
    assert.ok(retreat.x>8);
  }
});
