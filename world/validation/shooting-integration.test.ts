import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

/** Execute the production shoot function, including shoulder-to-muzzle occlusion and quest bookkeeping. */
function setup({ wall = false, enemy = false, enabled = true } = {}) {
  const source = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  const section = source.slice(source.indexOf('function shoot()'),source.indexOf('// ───────────── interaction'));
  assert.ok(section.length > 500);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0,1.3,5); camera.updateMatrixWorld(true);
  const gun = new THREE.Group(), root = new THREE.Group(); root.add(gun); gun.position.set(0,1.3,2); root.updateMatrixWorld(true);
  const target = new THREE.Mesh(new THREE.SphereGeometry(.5,16,12),new THREE.MeshBasicMaterial());
  target.position.set(0,1.3,-5); target.userData.target = 'range_target_1'; target.updateMatrixWorld(true);
  const geometry = wall ? new MeshBVH(new THREE.PlaneGeometry(20,20)) : null;
  const shots: { start: THREE.Vector3; end: THREE.Vector3; hit: boolean }[] = [], damage: string[] = [];
  const done = new Set<string>(); let saves=0;
  const combat = {
    canShoot: () => enabled,
    geometry: { cast(origin: THREE.Vector3,direction: THREE.Vector3,max: number) { const hit = geometry?.raycastFirst(new THREE.Ray(origin,direction.clone().normalize()),THREE.DoubleSide); return hit && hit.distance < max ? hit : null; } },
    raycast: (_origin: THREE.Vector3,_direction: THREE.Vector3,max: number) => enemy && 6 < max ? {id:'wild_0',distance:6,point:{x:0,y:1.3,z:-1}} : null,
    damageEnemy: (id: string) => damage.push(id),
    shot: (start: THREE.Vector3,end: THREE.Vector3,hit: boolean) => shots.push({start:start.clone(),end:end.clone(),hit}),
  };
  const context=vm.createContext({THREE,gameplayActive:()=>true,player:{flying:false,pos:new THREE.Vector3(0,0,2)},camera,ray:new THREE.Raycaster(),combat,
    targets:[target],rig:{root,joints:{Gun:gun}},rifle:{muzzleWorld:()=>gun.localToWorld(new THREE.Vector3(0,0,-.68))},done,toast(){},save(){saves++;},applyWorldState(){},$(){return {classList:{add(){},remove(){}}};},setTimeout(){}});
  vm.runInContext(transformSync(section+'\nglobalThis.shoot = shoot;',{loader:'ts',format:'cjs'}).code,context);
  return {shoot:()=>context.shoot(),shots,damage,done,saves:()=>saves};
}
test('World production shooting preserves quest targets and always renders a visible shot', () => {
  const s=setup(); s.shoot(); assert.equal(s.done.has('range_target_1'),true); assert.equal(s.saves(),1);
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
