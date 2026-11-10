import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { weaponArtPool } from '../src/weapons/weaponArt.ts';
import { Viewmodel } from '../src/rendering/scene.ts';
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
  expect(gun.position.toArray()).toEqual([.13, -.15, -.45]);
  expect(gun.rotation.toArray().slice(0, 3)).toEqual([0, .15, -.025]);
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
it('a melee strike leaves a short skin-coloured trail in viewmodel space that fades out', () => {
  const vm = new Viewmodel(); vm.set(5, WEAPONS[5].skins.findIndex(s => s.id === 'serpent-kris')); vm.update(1 / 60); vm.update(1);
  const trail = vm.root.getObjectByName('Viewmodel swing trail') as THREE.Mesh;
  expect(trail.visible).toBe(false);
  vm.strike(); for (let i = 0; i < 6; i++) vm.update(1 / 60);
  expect(trail.visible).toBe(true); expect(trail.geometry.getIndex()!.count).toBeGreaterThan(6);
  const colors = trail.geometry.getAttribute('color'); let lit = 0; for (let i = 0; i < colors.count; i++) lit = Math.max(lit, colors.getX(i), colors.getY(i), colors.getZ(i));
  expect(lit).toBeGreaterThan(.1); expect(lit).toBeLessThanOrEqual(.9);
  for (let i = 0; i < 90; i++) vm.update(1 / 60);
  expect(trail.visible).toBe(false); vm.clear();
});
it('stock melee weapons (no finish) also leave a swing trail, and it clears on reset', () => {
  for (const weapon of [5, 6, 7]) {
    const vm = new Viewmodel(); vm.set(weapon, 0); vm.update(1 / 60);
    const trail = vm.root.getObjectByName('Viewmodel swing trail') as THREE.Mesh;
    vm.strike(); for (let i = 0; i < 6; i++) vm.update(1 / 60);
    expect(trail.visible, `weapon ${weapon}`).toBe(true); expect(trail.geometry.drawRange.count).toBeGreaterThan(6);
    vm.resetMotion(); vm.update(0); expect(trail.visible).toBe(false); vm.clear();
  }
});
it('the muzzle flash lasts two frames of time at any frame rate', () => {
  for (const hz of [30, 60, 144, 240]) {
    const vm = new Viewmodel(); vm.set(0, 0); vm.update(0); vm.fire();
    const flash = () => vm.root.children.some((o) => o instanceof THREE.Sprite && o.visible && (o as THREE.Sprite).material.blending === THREE.AdditiveBlending && o.parent === vm.root);
    expect(flash()).toBe(true); let t = 0; while (t < .03) { vm.update(1 / hz); t += 1 / hz; }
    const at30 = (vm as unknown as { flashLife: number }).flashLife; for (let i = 0; i < 20; i++) vm.update(1 / hz);
    expect((vm as unknown as { flashLife: number }).flashLife).toBe(0); expect(at30).toBeLessThan(.045); vm.clear();
  }
});
it('inspect turns the weapon and any shot cancels it at once', () => {
  const vm = new Viewmodel(); vm.set(0, 0); for (let i = 0; i < 30; i++) vm.update(1 / 60);
  const gun = vm.root.children.find((o) => o instanceof THREE.Group)!, rest = gun.rotation.y;
  vm.inspect(); for (let i = 0; i < 50; i++) vm.update(1 / 60);
  expect(vm.inspecting).toBe(true); expect(Math.abs(gun.rotation.y - rest)).toBeGreaterThan(.5);
  vm.fire(); vm.update(1 / 60); expect(vm.inspecting).toBe(false); vm.clear();
});
it('skin muzzle sparks fly forward from the muzzle and expire', () => {
  const vm = new Viewmodel(); vm.set(0, WEAPONS[0].skins.findIndex(s => s.id === 'stormcoil')); vm.update(1 / 60);
  const before = vm.root.children.filter(o => o instanceof THREE.Sprite).length; vm.fire();
  const sparks = vm.root.children.filter(o => o instanceof THREE.Sprite);
  expect(sparks.length).toBeGreaterThan(before + 2);
  for (let i = 0; i < 30; i++) vm.update(1 / 60);
  expect(vm.root.children.filter(o => o instanceof THREE.Sprite && o.visible).length).toBeLessThanOrEqual(1); vm.clear();
});
it('while aiming, no skin sparks are thrown into the sight picture and a scoped shot never flashes in the scope', () => {
  const vm = new Viewmodel(); vm.set(0, WEAPONS[0].skins.findIndex(s => s.id === 'stormcoil')); vm.update(1 / 60); vm.aim = 1;
  const before = vm.root.children.filter(o => o instanceof THREE.Sprite).length; vm.fire();
  expect(vm.root.children.filter(o => o instanceof THREE.Sprite).length).toBe(before); vm.clear();
  const dmr = new Viewmodel(); dmr.set(2, 0); dmr.update(1 / 60); dmr.aim = 1; dmr.fire();
  expect(dmr.root.children.some(o => o instanceof THREE.Sprite && o.visible)).toBe(false); dmr.clear();
});
