/** Production shoot/firePellets code against real BVH cover and sphere contacts.
 * The camera can see above a wall while the held barrel is still below it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { campaignSourceContext } from './campaign-source-context';
import { makeCombatTerrain } from '../src/combat/combatTerrain';
import { WorldCombatState } from '../src/combat/combat';
import { worldGun } from '../src/weapons/worldArsenal';
import { WORLD_RIFLE } from '../src/core/worldBalance';
import type { Layout } from '../src/core/types';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const code = transformSync(main.slice(main.indexOf('function shoot()'), main.indexOf('// ───────────── interaction')) + '\nglobalThis.shoot = shoot;', { loader: 'ts', format: 'cjs' }).code;
function fixture(width: number, enabled = true) {
  const wall = new THREE.BoxGeometry(width, 1.6, .1).translate(0, .8, -1);
  const collider = { name: 'low-cover', bvh: new MeshBVH(wall), enabled };
  const geometry = makeCombatTerrain([collider], { world: { seed: 537, waterLevel: -2 }, areas: [], markers: [] } as unknown as Layout);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 3); camera.updateMatrixWorld(true);
  const muzzle = new THREE.Vector3(0, 1, 0), sphere = new THREE.Sphere(new THREE.Vector3(0, 1.5, -8), 1.7);
  const state = new WorldCombatState([], []); state.setGun(worldGun('corona')!); state.shotCooldown = 0;
  const shots: { end: THREE.Vector3; hit: boolean; flash: boolean }[] = [], damage: number[] = [];
  let cameraContacts = 0;
  const combat = {
    state, geometry, canShoot: () => state.canShoot(),
    raycast(origin: THREE.Vector3, direction: THREE.Vector3, max: number) {
      const point = new THREE.Ray(origin, direction).intersectSphere(sphere, new THREE.Vector3());
      if (!point || point.distanceTo(origin) > max) return null;
      cameraContacts++; return { id: 'target', point, distance: point.distanceTo(origin) };
    },
    damageEnemy(_id: string, amount: number) { damage.push(amount); },
    shot(_muzzle: THREE.Vector3, end: THREE.Vector3, hit: boolean, flash = true) { shots.push({ end: end.clone(), hit, flash }); },
  };
  const random = Object.create(Math); random.random = () => .5;
  const context = vm.createContext({ ...campaignSourceContext, THREE, Math: random, WORLD_RIFLE, worldProgress: { armed: true }, gameplayActive: () => true,
    player: { pos: new THREE.Vector3(0, 0, 1), flying: false }, camera, ray: new THREE.Raycaster(), combat,
    targets: [], rig: { root: new THREE.Group() }, rifle: { muzzleWorld: () => muzzle.clone() }, anim: { prepareShot() {} },
    fortCannon: { mounted: false }, actions: undefined, inspectServant: false, audio: { shot() {} }, done: new Set(), toast() {},
  });
  vm.runInContext(code, context);
  return { shoot: () => context.shoot(), shots, damage, state, contacts: () => cameraContacts, dispose: () => wall.dispose() };
}
test('camera-visible enemy behind low cover takes no shotgun damage while the muzzle path is blocked', () => {
  const f = fixture(20);
  try {
    const before = f.state.ammo; f.shoot();
    assert.equal(f.contacts(), 9, 'the camera has all nine real sphere contacts above the low cover');
    assert.equal(f.damage.length, 0, 'each pellet independently respects the low muzzle obstruction');
    assert.equal(f.shots.length, 9); assert.ok(f.shots.every(shot => Math.abs(shot.end.z + .95) < 1e-6), 'every tracer terminates on the near cover face');
    assert.equal(f.shots.filter(shot => shot.flash).length, 1); assert.equal(f.state.ammo, before - 3, 'one shell, not nine ammo deductions');
  } finally { f.dispose(); }
});
test('a narrow central obstruction blocks only intercepted pellets, preserving spread around its sides', () => {
  const f = fixture(.06);
  try {
    f.shoot(); assert.equal(f.shots.length, 9); assert.ok(Math.abs(f.shots[0].end.z + .95) < 1e-6, 'center shot hits the pillar');
    assert.ok(f.damage.length > 0 && f.damage.length < 8, `expected mixed pellet paths, got ${f.damage.length} enemy hits`);
    assert.equal(f.shots.filter(shot => shot.end.z < -2).length, f.damage.length, 'each unobstructed tracer corresponds to one accepted damage event');
  } finally { f.dispose(); }
});
test('opening the same cover restores every pellet without changing authored damage or shell cost', () => {
  const f = fixture(20, false);
  try {
    const before = f.state.ammo; f.shoot(); assert.equal(f.damage.length, 9); assert.ok(f.damage.every(amount => amount === worldGun('corona')!.damage));
    assert.equal(f.state.ammo, before - 3); assert.ok(f.shots.every(shot => shot.end.z < -2));
  } finally { f.dispose(); }
});
