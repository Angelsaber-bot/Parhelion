import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { weaponArtPool } from '../src/weaponArt.ts';
import { Viewmodel } from '../src/scene.ts';
import { WEAPONS } from '../shared/content.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }) }) });
  // Keep this a real Viewmodel/Three transform test without network or renderer dependencies.
  // Authored GLB anchors/bounds have separate real-GLTFLoader coverage in weapon-art.test.ts.
  vi.spyOn(weaponArtPool, 'acquire').mockReturnValue({ ready: Promise.resolve(null), release() {} });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('full ADS remains exactly centred through movement, sway, shot kick and reload cosmetics', () => {
  const vm = new Viewmodel(); vm.set(0, 0); vm.aim = 1; vm.moving = 1; vm.reloading = .4;
  vm.look(.2, -.1); vm.fire(); vm.update(1 / 60);
  const gun = vm.root.children.find((o) => o instanceof THREE.Group)!;
  const sight = new THREE.Vector3(0, .088, .02);
  gun.updateWorldMatrix(true, true); sight.applyMatrix4(gun.matrixWorld);
  expect(sight.x).toBeCloseTo(0, 12); expect(sight.y).toBeCloseTo(0, 12); expect(sight.z).toBeCloseTo(-.34, 12);
  expect(gun.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
  vm.clear();
});
it('first shot still flashes immediately and recoil is visible on its first update; reset clears transient state', () => {
  const vm = new Viewmodel(); vm.set(0, 0); vm.resetMotion(); vm.update(0);
  const gun = vm.root.children.find((o) => o instanceof THREE.Group)!;
  const restZ = gun.position.z; vm.fire();
  expect(vm.root.children.some((o) => o instanceof THREE.Sprite && o.visible)).toBe(true);
  vm.update(1 / 60); expect(gun.position.z).toBeGreaterThan(restZ);
  vm.moving = 1; vm.aim = .5; vm.reloading = .6; vm.meleeWindup = 1; vm.look(.1, .1);
  vm.resetMotion(); vm.update(0);
  expect(gun.position.toArray()).toEqual([.17, -.16, -.4]);
  expect(gun.rotation.toArray().slice(0, 3)).toEqual([0, .04, 0]);
  expect(vm.root.children.filter((o) => o instanceof THREE.Sprite).every((o) => !o.visible)).toBe(true);
  vm.clear();
});
it('scoped visibility resets and melee contact poses are not altered by smoothed walking bob', () => {
  const vm = new Viewmodel(); vm.set(4, 0); vm.aim = 1; vm.update(0);
  let gun = vm.root.children.find((o) => o instanceof THREE.Group)!;
  expect(gun.visible).toBe(false); vm.resetMotion(); vm.update(0); expect(gun.visible).toBe(true);
  vm.set(5, 0); vm.meleeWindup = WEAPONS[5].windup! / 2; vm.update(0);
  gun = vm.root.children.find((o) => o instanceof THREE.Group)!;
  const pose = [...gun.position.toArray(), ...gun.quaternion.toArray()];
  vm.moving = 1; for (let i = 0; i < 30; i++) vm.update(1 / 60);
  expect([...gun.position.toArray(), ...gun.quaternion.toArray()]).toEqual(pose);
  vm.clear();
});
