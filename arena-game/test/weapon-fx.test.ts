import { expect, it } from 'vitest';
import * as THREE from 'three';
import { WeaponFx, WEAPON_FX_BUDGET, streakTiming, surfaceNormal } from '../src/rendering/weaponFx.ts';
import { buildMap, type MapData } from '../shared/map.ts';

const box = (id: string, position: [number, number, number], size: [number, number, number]) => ({ id, type: 'box', position, size, material: '', collision: true, role: 'wall' });
const map = buildMap({
  mapId: 'fx-fixture', version: '1', bounds: { min: [-30, -1, -30], max: [30, 12, 30] },
  player: { radius: .32, height: 1.8, eyeHeight: 1.65, walkSpeed: 5.2, stepHeight: .28 },
  objects: [box('floor', [0, -.1, 0], [60, .2, 60]), box('wall', [0, 1.5, -6], [8, 3, .4])] as MapData['objects'],
  anchors: [{ id: 'a', kind: 'spawn', team: 'west', position: [0, 0, 0] }, { id: 'b', kind: 'spawn', team: 'east', position: [0, 0, -2] }] as MapData['anchors'], routes: [],
} as MapData);
const uniforms = (o: THREE.Object3D) => ((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;

it('a tracer streak flies from the muzzle to the hit, then shrinks into it and is released', () => {
  const parent = new THREE.Group(), fx = new WeaponFx(parent);
  fx.streak([0, 1, 0], [0, 1, -40], 0xffcc88, .02, 400);
  const mesh = parent.children[0], { travel, fade } = streakTiming(40, 400);
  const headZ = () => uniforms(mesh).uHead.value.z as number, tailZ = () => uniforms(mesh).uTail.value.z as number;
  expect(headZ()).toBeCloseTo(0, 6);
  fx.update(travel / 2); expect(headZ()).toBeCloseTo(-20, 1); expect(tailZ()).toBeGreaterThan(headZ());
  fx.update(travel / 2); expect(headZ()).toBeCloseTo(-40, 1);
  fx.update(fade * .9); expect(Math.abs(tailZ() - headZ())).toBeLessThan(1);
  fx.update(fade); expect(parent.children).toHaveLength(0); fx.dispose();
});
it('travel stays readable: never a single frame, never a long float', () => {
  expect(streakTiming(3, 800).travel).toBeGreaterThanOrEqual(.035); expect(streakTiming(500, 300).travel).toBeLessThanOrEqual(.14);
});
it('your own aimed shot keeps the first metres of the sight line empty', () => {
  const parent = new THREE.Group(), fx = new WeaponFx(parent); fx.streak([0, 1, 0], [0, 1, -30], 0xffffff, .02, 400, .3, 2.5);
  const u = uniforms(parent.children[0]); expect(u.uTail.value.z).toBeLessThanOrEqual(-2.5 + 1e-9); expect(u.uOpacity.value).toBeCloseTo(.3);
  for (let i = 0; i < 6; i++) { fx.update(1 / 60); if (parent.children.length) expect(u.uTail.value.z).toBeLessThanOrEqual(-2.5 + 1e-9); }
  fx.dispose();
});
it('every pool is bounded and replaces the oldest; clear and dispose release everything', () => {
  for (const q of ['high', 'low'] as const) {
    const parent = new THREE.Group(), fx = new WeaponFx(parent, q), b = WEAPON_FX_BUDGET[q];
    for (let i = 0; i < 500; i++) { fx.streak([i, 0, 0], [i, 0, -10], 1); fx.flash([i, 0, 0], 1); fx.puff([i, 0, 0], 1, .2, .5); fx.decal([i, 0, 0], [0, 1, 0]); fx.arc([i, 0, 0], [i, 0, -1], 1, 1, 1); }
    expect(fx.inventory).toMatchObject(b); expect(parent.children).toHaveLength(b.streaks + b.flashes + b.puffs + b.decals + b.arcs);
    fx.clear(); expect(parent.children).toHaveLength(0); fx.dispose(); expect(fx.inventory.disposed).toBe(true);
  }
});
it('bullet holes lie flush on the face that was hit and fade before they vanish', () => {
  expect(surfaceNormal(map, [1, 1.5, -5.8], [0, 0, -1])).toEqual([0, 0, 1]); // front of the wall
  expect(surfaceNormal(map, [1, 0, 3], [0, -.6, -.8])).toEqual([0, 1, 0]); // floor
  expect(surfaceNormal(map, [4, 1.5, -6], [-1, 0, 0])).toEqual([1, 0, 0]); // wall's end face
  const parent = new THREE.Group(), fx = new WeaponFx(parent); fx.decal([1, 1.5, -5.8], [0, 0, 1]);
  const hole = parent.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  expect(new THREE.Vector3(0, 0, 1).applyQuaternion(hole.quaternion).z).toBeCloseTo(1, 6); expect(hole.position.z).toBeGreaterThan(-5.8);
  fx.update(7); expect(hole.material.opacity).toBeLessThan(.9); fx.update(2); expect(parent.children).toHaveLength(0); fx.dispose();
});
it('a melee arc sweeps in, then fades, and its middle points at the target', () => {
  const parent = new THREE.Group(), fx = new WeaponFx(parent); fx.arc([0, 1.4, 0], [3, 1.4, 0], 0x9cf0ff, 1.5, 2, false, .2);
  const arc = parent.children[0] as THREE.Mesh, u = uniforms(arc);
  const mid = new THREE.Vector3(0, 0, -1).applyQuaternion(arc.quaternion); expect(mid.x).toBeGreaterThan(.85);
  fx.update(.05); const p1 = u.uProgress.value; fx.update(.05); expect(u.uProgress.value).toBeGreaterThan(p1);
  fx.update(.2); expect(parent.children).toHaveLength(0); fx.dispose();
});
