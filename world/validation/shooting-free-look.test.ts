import { WorldAudio } from '../src/worldAudio';
import * as campaignClosure from '../src/campaignClosure';
import { FortCannon, FORT_CANNON } from '../src/fortCannon';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as THREE from 'three';
import {playerFixture} from './player-fixture.ts';
import {SkinnedCharacterAnimator} from '../src/skinnedCharacter.ts';

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const press=main.slice(main.indexOf('function press('),main.indexOf('function release('));
const shoot=main.slice(main.indexOf('function shoot()'),main.indexOf('// ───────────── interaction'));
const tick=main.split('\n').find(line=>line.trimStart().startsWith('anim.update(dt,'))!;
const cameraUpdate=main.split('\n').find(line=>line.trimStart().startsWith('camera.rotation.set(player.pitch,'))!;
const source=transformSync(`${press}\n${shoot}\nglobalThis.press=press;globalThis.shoot=shoot;globalThis.tick=()=>{${cameraUpdate}${tick}rig.root.updateMatrixWorld(true);camera.updateMatrixWorld(true);};`,{loader:'ts',format:'cjs'}).code;

/** Read the actual two circular muzzle sections, not the wrist/contact or a guessed gun axis. */
function actualBarrel(rig:Awaited<ReturnType<typeof playerFixture>>['rig']) {
  const art=rig.joints.Gun.getObjectByName('01_Dawn_AR_ROOT')!;assert.ok(art);
  art.updateWorldMatrix(true,true);const inverse=art.matrixWorld.clone().invert();
  const rings=[1.750,1.886].map(x=>({x,points:[] as THREE.Vector3[]}));
  art.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
    const position=mesh.geometry.attributes.position,matrix=inverse.clone().multiply(mesh.matrixWorld);
    for(let i=0;i<position.count;i++) {const p=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(matrix);
      for(const ring of rings)if(Math.abs(p.x-ring.x)<2e-6)ring.points.push(p);
    }
  });
  const centers=rings.map(r=>{assert.ok(r.points.length>=16);return new THREE.Box3().setFromPoints(r.points).getCenter(new THREE.Vector3());});
  return()=>art.localToWorld(centers[1].clone()).sub(art.localToWorld(centers[0].clone())).normalize();
}

async function setup(state:{swimming?:boolean;gliding?:boolean;moving?:boolean}={}) {
  const f=await playerFixture(),{rig,rifle}=f,anim=new SkinnedCharacterAnimator(rig),barrel=actualBarrel(rig);
  const player={flying:false,pos:new THREE.Vector3(2,.7,-3),vel:new THREE.Vector3(),onGround:!state.swimming&&!state.gliding,swimming:!!state.swimming,gliding:!!state.gliding,pitch:0,yaw:Math.PI};
  rig.root.position.copy(player.pos);
  const camera=new THREE.PerspectiveCamera(70);camera.position.set(1.55,2.25,-6);
  const keys=new Set<string>(),aim={value:0,held:false};
  const shots:{start:THREE.Vector3;end:THREE.Vector3}[]=[],queryDirections:THREE.Vector3[]=[];
  let eligible=true;
  const c=vm.createContext({narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false,campaignJournalOpen:false,campaignTrackedRegion:null,falseDawnTracked:false,falseDawnRuntime:undefined,THREE,FORT_CANNON,fortCannon:new FortCannon(),actions:undefined,inspectServant:false,worldProgress:{armed:true},gameplayActive:()=>true,locked:true,settings:{action:()=> 'fire'},settingsPanel:{open:false},document:{visibilityState:'visible',hasFocus:()=>true},keys,aim,down:(action:string)=>action==='fire'&&keys.has('Mouse0'),player,anim,rig,camera,ray:new THREE.Raycaster(),targets:[],dt:1/60,hs:state.moving?9:0,ads:0,wx:0,wz:0,
    combat:{defeated:false,canShoot:()=>eligible,geometry:{cast:()=>null},raycast:()=>null,shot:(start:THREE.Vector3,end:THREE.Vector3)=>shots.push({start:start.clone(),end:end.clone()})},
    rifle:{muzzleWorld:()=>{queryDirections.push(barrel());return rifle.muzzleWorld();}},done:new Set(),toast(){},save(){},applyWorldState(){},$(){return{classList:{add(){},remove(){}}}},setTimeout(){}});
  vm.runInContext(source,c);
  for(let i=0;i<180;i++)c.tick();
  return{...f,anim,barrel,player,camera,keys,aim,c,shots,queryDirections,setEligible:(v:boolean)=>{eligible=v;}};
}

function assertContact(f:Awaited<ReturnType<typeof setup>>) {
  for(const [side,key]of [['R','grip'],['L','support']] as const) {
    const error=f.rig.handSockets[side].getWorldPosition(new THREE.Vector3()).distanceTo(f.rig.joints.Gun.localToWorld(f.rig.gunAnchors[key].clone()));
    assert.ok(error<.002,`${side} contact drift ${error}`);
  }
}

test('production press first shot synchronously matches real camera at ±90/180 free-look, with no RAF or ADS',async()=>{
  for(const state of [{},{moving:true},{gliding:true},{swimming:true}]) {
    const f=await setup(state);
    for(const yawOffset of [-Math.PI/2,Math.PI/2,Math.PI,-Math.PI])for(const pitch of [-1.5,0,.75,1.5]) {
      f.keys.clear();f.anim.facing=0;
      f.anim.update(0,{speed:0,onGround:f.player.onGround,swimming:f.player.swimming,gliding:f.player.gliding,vy:0,moveYaw:null,aim:0,pitch:0});
      // Actual current view deliberately differs from player yaw/pitch: the event must use the
      // same camera direction as targeting, not stale input fields or the next frame's intended view.
      f.camera.rotation.set(pitch,Math.PI+yawOffset,0,'YXZ');f.camera.updateMatrixWorld(true);
      const beforeCamera=f.camera.matrixWorld.clone(),beforeProjection=f.camera.projectionMatrix.clone(),beforePlayer={yaw:f.player.yaw,pitch:f.player.pitch},beforeAim={...f.aim},n=f.shots.length;
      const look=f.camera.getWorldDirection(new THREE.Vector3());
      f.c.press('Mouse0');
      assert.equal(f.shots.length,n+1,'no hidden delay');
      assert.ok(f.queryDirections.at(-1)!.distanceTo(look)<1e-6,`barrel not aligned at yaw${yawOffset},pitch${pitch}`);
      assert.ok(f.shots.at(-1)!.start.distanceTo(f.rifle.muzzleWorld())<1e-8,'shot must start at the actual muzzle');
      assertContact(f);
      assert.ok(f.camera.matrixWorld.equals(beforeCamera));assert.ok(f.camera.projectionMatrix.equals(beforeProjection));
      assert.deepEqual({yaw:f.player.yaw,pitch:f.player.pitch},beforePlayer);assert.deepEqual(f.aim,beforeAim);
    }
    f.dispose();
  }
});

test('held fire tracks view between eligible shots, rather than reverting to locomotion/low-ready on cooldown frames',async()=>{
  const f=await setup({gliding:true});f.c.press('Mouse0');
  for(const hz of [30,60,120]) {
    f.c.dt=1/hz;
    for(let i=0;i<30;i++) {
      f.player.yaw=Math.PI+Math.sin(i*.23)*Math.PI;f.player.pitch=Math.sin(i*.13)*1.45;
      f.c.wx=-Math.sin(f.player.yaw);f.c.wz=-Math.cos(f.player.yaw); // movement need not face the shot
      f.setEligible(i%7===0);const before=f.shots.length;
      f.c.tick();
      const look=f.camera.getWorldDirection(new THREE.Vector3());
      assert.ok(f.barrel().distanceTo(look)<1e-6,'must remain raised/aligned even without a new eligible shot');assertContact(f);
      f.c.shoot();assert.equal(f.shots.length,before+(i%7===0?1:0),'original cadence gate must remain authoritative');
    }
  }
  f.keys.clear();f.c.wx=f.c.wz=0;
  for(let i=0;i<600;i++)f.c.tick();
  assert.equal(f.rig.diagnostics.mode,'glide');assert.equal(f.rig.glider.root.visible,true);
  for(const side of ['R','L']as const)assert.ok(f.rig.handSockets[side].getWorldPosition(new THREE.Vector3()).distanceTo(f.rig.glider.grips[side].getWorldPosition(new THREE.Vector3()))<.002);
  f.dispose();
});
