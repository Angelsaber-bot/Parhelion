import { WorldAudio } from '../src/worldAudio';
import * as campaignClosure from '../src/campaignClosure';
import { getEraProgressReaction } from '../src/eraStories';
import { FortCannon, FORT_CANNON } from '../src/fortCannon';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { playerFixture } from './player-fixture.ts';
import { SkinnedCharacterAnimator } from '../src/skinnedCharacter.ts';

/** Execute the production shoot function, including shoulder-to-muzzle occlusion and quest bookkeeping. */
function setup({ wall = false, enemy = false, enabled = true, armed = true, cannonTarget = false, playerArt = undefined as Awaited<ReturnType<typeof playerFixture>> | undefined, animator = undefined as SkinnedCharacterAnimator | undefined } = {}) {
  const source = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  const section = source.slice(source.indexOf('function shoot()'),source.indexOf('// ───────────── interaction'));
  assert.ok(section.length > 500);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0,1.3,5); camera.updateMatrixWorld(true);
  const gun = new THREE.Group(), root = new THREE.Group(); root.add(gun); gun.position.set(0,1.3,2); root.updateMatrixWorld(true);
  const target = new THREE.Mesh(new THREE.SphereGeometry(.5,16,12),new THREE.MeshBasicMaterial());
  target.position.set(0,1.3,-5); target.userData.target = 'range_target_1'; target.updateMatrixWorld(true);
  if(cannonTarget) Object.assign(target.userData,{needs:FORT_CANNON.marker,nearWorld:[0,2],nearR:8});
  const geometry = wall ? new MeshBVH(new THREE.PlaneGeometry(20,20)) : null;
  const shots: { start: THREE.Vector3; end: THREE.Vector3; hit: boolean }[] = [], damage: string[] = [];
  const done = new Set<string>(cannonTarget?[FORT_CANNON.marker]:[]); let saves=0;const markers:number[]=[];
  const combat = {
    canShoot: () => enabled,
    flashHitMarker: (duration:number) => markers.push(duration),
    geometry: { cast(origin: THREE.Vector3,direction: THREE.Vector3,max: number) { const hit = geometry?.raycastFirst(new THREE.Ray(origin,direction.clone().normalize()),THREE.DoubleSide); return hit && hit.distance < max ? hit : null; } },
    raycast: (_origin: THREE.Vector3,_direction: THREE.Vector3,max: number) => enemy && 6 < max ? {id:'wild_0',distance:6,point:{x:0,y:1.3,z:-1}} : null,
    damageEnemy: (id: string) => damage.push(id),
    shot: (start: THREE.Vector3,end: THREE.Vector3,hit: boolean) => shots.push({start:start.clone(),end:end.clone(),hit}),
  };
  const context=vm.createContext({narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false,THREE,getEraProgressReaction,settings:{label:()=> 'F'},bilingual:(zh:string)=>zh,FORT_CANNON,fortCannon:new FortCannon(),actions:undefined,inspectServant:false,worldProgress:{armed},gameplayActive:()=>true,player:{flying:false,pitch:0,pos:new THREE.Vector3(0,0,2)},camera,ray:new THREE.Raycaster(),combat,
    targets:[target],rig:playerArt?.rig ?? {root,joints:{Gun:gun}},rifle:playerArt?.rifle ?? {muzzleWorld:()=>gun.localToWorld(new THREE.Vector3(0,0,-.68))},anim:animator ?? {prepareShot(){}},done,toast(){},save(){saves++;},applyWorldState(){},$(){return {classList:{add(){},remove(){}}};},setTimeout(){}});
  vm.runInContext(transformSync(section+'\nglobalThis.shoot = shoot;',{loader:'ts',format:'cjs'}).code,context);
  return {shoot:()=>context.shoot(),shots,damage,done,markers,saves:()=>saves};
}
test('World production shooting preserves quest targets and always renders a visible shot', () => {
  const s=setup(); s.shoot(); assert.equal(s.done.has('range_target_1'),true); assert.equal(s.saves(),1);assert.deepEqual(s.markers,[.14]);
  assert.equal(s.shots.length,1); assert.equal(s.shots[0].hit,true); assert.ok(s.shots[0].end.z < -4);
});
test('closer enemy receives damage instead of completing the target behind it', () => {
  const s=setup({enemy:true});s.shoot();assert.deepEqual(s.damage,['wild_0']);assert.equal(s.done.size,0);assert.equal(s.shots[0].end.z,-1);
});
test('solid wall blocks both camera targeting and the actual muzzle-to-target shot', () => {
  const s=setup({wall:true,enemy:true});s.shoot();assert.equal(s.damage.length,0);assert.equal(s.done.size,0);
  assert.ok(Math.abs(s.shots[0].end.z)<1e-8);assert.equal(s.shots[0].hit,true);
});
test('shot cadence blocks all damage, quest mutation and visuals together', () => {
  const s=setup({enabled:false});s.shoot();assert.equal(s.shots.length,0);assert.equal(s.damage.length,0);assert.equal(s.done.size,0);
});

test('unarmed input cannot damage enemies, complete gun-required objectives or render shots', () => {
  for (const enemy of [false, true]) {
    const s = setup({ armed: false, enemy }); s.shoot();
    assert.equal(s.shots.length, 0); assert.equal(s.damage.length, 0);
    assert.equal(s.done.size, 0); assert.equal(s.saves(), 0);
  }
});

test('immediate input-event shoot prepares actual held weapon before muzzle query, without awaiting RAF', async () => {
  const playerArt = await playerFixture(), animator = new SkinnedCharacterAnimator(playerArt.rig);
  playerArt.rig.root.position.set(0, 0, 2);
  for (let i = 0; i < 180; i++) animator.update(1/60, {speed:8,onGround:false,swimming:false,gliding:true,vy:-2,moveYaw:0});
  const slungMuzzle = playerArt.rifle.muzzleWorld();
  const s = setup({playerArt,animator});
  s.shoot(); // Same synchronous shoot() used by the production press('fire') path; no frame step.
  const heldMuzzle = playerArt.rifle.muzzleWorld();
  assert.ok(heldMuzzle.distanceTo(slungMuzzle) > .3);
  assert.equal(s.shots.length,1); assert.ok(s.shots[0].start.distanceTo(heldMuzzle) < 1e-6);
  for (const [side,key] of [['R','grip'],['L','support']] as const)
    assert.ok(playerArt.rig.handSockets[side].getWorldPosition(new THREE.Vector3()).distanceTo(playerArt.rig.joints.Gun.localToWorld(playerArt.rig.gunAnchors[key].clone())) < .002);
  playerArt.dispose();
});

test('rifle cannot bypass the mounted cannon even after loading and while standing on its firing deck',()=>{
 const s=setup({cannonTarget:true});s.shoot();assert.equal(s.done.has('range_target_1'),false);assert.equal(s.done.has(FORT_CANNON.marker),true);assert.equal(s.saves(),0);assert.equal(s.damage.length,0);
});
