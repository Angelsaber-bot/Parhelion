import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WEAPON_ART, WeaponArtPool, artPoint, combatArt, makeArtMount } from '../src/weaponArt.ts';
import { attachGunArt } from '../src/gunArt.ts';
import { poseMelee } from '../src/meleeArt.ts';
import { WEAPONS } from '../shared/content.ts';

async function parse(def = WEAPON_ART[0]) {
  const bytes = await readFile(new URL(`../../assets/weapons/glb/${def.file}.glb`, import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
for (const def of WEAPON_ART) it(`real GLTFLoader: ${def.id}, exact geometry, PBR and named pivots`, async () => {
  const gltf = await parse(def);
  expect(gltf.animations.length).toBe(0);
  const pool = new WeaponArtPool(async () => gltf.scene), h = pool.acquire(def);
  const instance = (await h.ready)!;
  expect(instance.parts.body).toBeDefined();
  expect(instance.parts.body.parent!.name).toBe(`${def.file}_ROOT`);
  let triangles = 0, meshes = 0;
  instance.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++; triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
    expect(m.geometry.attributes.normal).toBeDefined(); expect(m.geometry.attributes.uv).toBeDefined();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) expect((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial).toBe(true);
  });
  expect(triangles).toBe(def.triangles); expect(meshes).toBeGreaterThan(1);
  const bounds = new THREE.Box3().setFromObject(instance.root);
  expect(Number.isFinite(bounds.max.length())).toBe(true);
  h.release(); expect(pool.size).toBe(0);
});

it('all eight modeled weapons map one-to-one to real gameplay definitions', () => {
  expect(WEAPON_ART.map((x) => x.combat).sort()).toEqual(WEAPONS.map((w) => w.id).sort());
  expect(WEAPON_ART.filter((x) => !x.combat)).toHaveLength(0);
});
it('one load per active model, independent materials/poses, resource lifetime follows last owner', async () => {
  const source = (await parse()).scene;
  let loads = 0, geometryDisposals = 0;
  const geometries = new Set<THREE.BufferGeometry>(); source.traverse((o) => { if ((o as THREE.Mesh).isMesh) geometries.add((o as THREE.Mesh).geometry); });
  geometries.forEach((g) => g.addEventListener('dispose', () => geometryDisposals++));
  const pool = new WeaponArtPool(async () => { loads++; return source; });
  const a = pool.acquire(WEAPON_ART[0], WEAPONS[0].skins[0]), b = pool.acquire(WEAPON_ART[0], WEAPONS[0].skins[1]);
  const [x, y] = await Promise.all([a.ready, b.ready]);
  expect(loads).toBe(1);
  x!.parts.magazine.position.y -= 1;
  expect(x!.parts.magazine.position.y).not.toBe(y!.parts.magazine.position.y);
  const getMaterial = (root: THREE.Object3D) => { let found: THREE.Material | undefined; root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const mat = Array.isArray(m.material) ? m.material[0] : m.material; if (mat.name === 'PH_ivory') found = mat; } }); return found as THREE.MeshStandardMaterial; };
  expect(getMaterial(x!.root)).not.toBe(getMaterial(y!.root));
  expect(getMaterial(x!.root).color.getHex()).toBe(WEAPONS[0].skins[0].body);
  expect(getMaterial(y!.root).color.getHex()).toBe(WEAPONS[0].skins[1].body);
  a.release(); a.release(); expect(geometryDisposals).toBe(0); expect(pool.size).toBe(1);
  b.release(); expect(geometryDisposals).toBe(geometries.size); expect(pool.size).toBe(0);
});
it('closing/swapping before load finishes discards the stale result and frees it', async () => {
  let resolve!: (root: THREE.Group) => void;
  const pool = new WeaponArtPool(() => new Promise((r) => resolve = r));
  const h = pool.acquire(WEAPON_ART[0]); await Promise.resolve();
  h.release(); resolve((await parse()).scene);
  expect(await h.ready).toBeNull(); expect(pool.size).toBe(0);
});
it('failed loads are removable and a later acquire can retry', async () => {
  let calls = 0;
  const pool = new WeaponArtPool(async () => { if (++calls === 1) throw new Error('offline'); return (await parse()).scene; });
  const first = pool.acquire(WEAPON_ART[0]); await expect(first.ready).rejects.toThrow('offline'); first.release();
  const retry = pool.acquire(WEAPON_ART[0]); expect(await retry.ready).not.toBeNull(); retry.release(); expect(calls).toBe(2);
});
function fallback() {
  const group = new THREE.Group(), muzzle = new THREE.Object3D(); muzzle.position.z = -0.45;
  group.add(new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .8), new THREE.MeshStandardMaterial()), muzzle);
  return { group, muzzle };
}
it('gun swaps only art, uses authored muzzle/sight, animates cosmetic parts, then disposes', async () => {
  const def = WEAPON_ART[0], pool = new WeaponArtPool(async () => (await parse(def)).scene);
  const gun = attachGunArt(0, 0, fallback(), true, pool); await gun.ready;
  expect(gun.group.userData.artState).toBe('ready'); expect(gun.muzzle.position.distanceTo(artPoint(def, def.muzzle!))).toBeLessThan(1e-9);
  gun.animate(1, .5); gun.animate(0, 0);
  expect(gun.sight.distanceTo(artPoint(def, def.sight!))).toBeLessThan(1e-9);
  gun.dispose(); expect(pool.size).toBe(0);
});
it('load failure retains the usable fallback and its muzzle', async () => {
  const old = fallback(), pool = new WeaponArtPool(async () => { throw new Error('404'); });
  const gun = attachGunArt(0, 0, old, false, pool); await gun.ready;
  expect(gun.group.children).toContain(old.group); expect(gun.group.userData.artState).toBe('fallback'); expect(gun.muzzle.position.z).toBe(-.45);
  gun.dispose(); expect(pool.size).toBe(0);
});
for (const w of WEAPONS.filter((w) => w.kind === 'gun')) it(`${w.id}: one axis transform, hand anchor, on-screen muzzle, centred ADS sight`, async () => {
  const def = combatArt(w.id)!, source = (await parse(def)).scene;
  const mount = makeArtMount(def, source), gun = new THREE.Group(); gun.add(mount); gun.scale.setScalar(.72);
  const expectedForward = new THREE.Vector3(1, 0, 0).applyQuaternion(mount.quaternion); expect(expectedForward.distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-9);
  expect(artPoint(def, def.grip!).distanceTo(new THREE.Vector3(0, -.1, .07))).toBeLessThan(.001);
  gun.position.set(.17, -.16, -.4); gun.rotation.y = .04; gun.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, .01, 10); camera.updateProjectionMatrix();
  const muzzle = artPoint(def, def.muzzle!).applyMatrix4(gun.matrixWorld).project(camera);
  expect(Math.abs(muzzle.x)).toBeLessThan(1); expect(Math.abs(muzzle.y)).toBeLessThan(1);
  const sight = artPoint(def, def.sight!).multiplyScalar(.72);
  gun.position.set(-sight.x, -sight.y, -.34 - sight.z); gun.rotation.set(0, 0, 0); gun.updateMatrixWorld(true);
  const center = artPoint(def, def.sight!).applyMatrix4(gun.matrixWorld).project(camera);
  expect(Math.abs(center.x)).toBeLessThan(1e-8); expect(Math.abs(center.y)).toBeLessThan(1e-8);
  // No vertex is behind the eye / near clip when the sight is aligned.
  const bounds = new THREE.Box3().setFromObject(gun); expect(bounds.max.z).toBeLessThan(-.01);
});

for (const w of WEAPONS.filter((w) => w.kind === 'melee')) it(`${w.id}: actual combat model, hand grip, wind-up/swing and safe first-person bounds`, async () => {
  const index = WEAPONS.indexOf(w), def = combatArt(w.id)!;
  const pool = new WeaponArtPool(async () => (await parse(def)).scene);
  const presentation = attachGunArt(index, 0, fallback(), true, pool); await presentation.ready;
  expect(presentation.group.userData.artState).toBe('ready');
  expect(presentation.group.userData.artId).toBe(def.id);
  expect(artPoint(def, def.grip!).distanceTo(new THREE.Vector3(0, -.1, .07))).toBeLessThan(.001);
  const group = presentation.group; group.scale.setScalar(index === 6 ? .6 : .72);
  const poses: number[][] = [];
  for (const [ready, strike] of [[0, 0], [.25, 0], [.5, 0], [1, 0], [0, 1], [0, .5]]) {
    poseMelee(group, index, ready, strike, true); group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    expect(box.max.z).toBeLessThan(-.01);
    expect(box.min.toArray().every(Number.isFinite)).toBe(true);
    poses.push(group.rotation.toArray().slice(0, 3) as number[]);
  }
  expect(poses[0]).not.toEqual(poses[3]); expect(poses[3]).not.toEqual(poses[4]);
  presentation.dispose(); expect(pool.size).toBe(0);
});
