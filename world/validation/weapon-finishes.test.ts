import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { WeaponFinishStore, WEAPON_FINISHES, WEAPON_FINISH_KEY, weaponFinishUnlocked } from '../src/weaponFinishes.ts';
import { createWeaponFinishMaterials } from '../src/weaponFinishMaterials.ts';
import { parseLocalGlb } from './player-fixture.ts';
const unlocked = new Set(WEAPON_FINISHES.flatMap(finish => finish.unlock ? [finish.unlock] : []));
test('finish selection is earned, save-compatible and cannot mutate progression or gameplay', () => {
  const values = new Map<string, string>(); const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const store = new WeaponFinishStore(storage), empty = new Set<string>();
  assert.equal(store.active(empty), 'original'); assert.equal(store.select('oath', empty), false);
  for (const invalid of [null, 'unknown', '__proto__', {}, 1]) assert.equal(store.select(invalid, unlocked), false);
  for (const finish of WEAPON_FINISHES) { assert.equal(store.select(finish.id, unlocked), true); assert.equal(store.active(unlocked), finish.id); }
  assert.equal(empty.size, 0); assert.equal(unlocked.size, 5);
  assert.deepEqual([...values.keys()], [WEAPON_FINISH_KEY], 'never writes progress/contracts/shared controls');
  const loaded = new WeaponFinishStore(storage); assert.equal(loaded.preference, 'ember');
  assert.equal(loaded.active(empty), 'original', 'new game/import without unlock shows original');
  assert.equal(loaded.preference, 'ember', 'saved preference is not destroyed');
  assert.equal(loaded.active(unlocked), 'ember', 'earned flag restores preference');
  assert.equal(weaponFinishUnlocked('ember', new Set(['campaign_kyoto_complete'])), true);
});
test('malformed/storage-denied preferences safely default; memory selection works without persistence', () => {
  for (const text of ['bad-json', 'null', '{"version":2,"finish":"ember"}', '{"version":1,"finish":"evil"}', 'x'.repeat(10000)]) {
    const store = new WeaponFinishStore({ getItem: () => text, setItem() {} }); assert.equal(store.preference, 'original');
  }
  const store = new WeaponFinishStore({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } });
  assert.equal(store.saved, false); assert.equal(store.select('frost', unlocked), true); assert.equal(store.active(unlocked), 'frost'); assert.equal(store.saved, false);
});
for (const file of ['01_Dawn_AR', '06_Refract_Blade']) test(`${file}: every finish is material-only, isolated and reversible on actual weapon`, async () => {
  const gltf = await parseLocalGlb(new URL(`../../assets/weapons/glb/${file}.glb`, import.meta.url));
  const root = gltf.scene, meshes: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
  const before = meshes.map(mesh => ({ geometry: mesh.geometry, position: mesh.geometry.attributes.position.array.slice(), transform: mesh.matrix.toArray(), original: mesh.material, colors: [mesh.material].flat().map(m => (m as THREE.MeshStandardMaterial).color.clone()) }));
  const controls = createWeaponFinishMaterials(root); let cloneDisposals = 0;
  const clones = new Set(meshes.flatMap(mesh => [mesh.material].flat())); clones.forEach(m => m.addEventListener('dispose', () => cloneDisposals++));
  for (const finish of WEAPON_FINISHES) {
    assert.equal(controls.apply(finish.id), true);
    for (const [i, mesh] of meshes.entries()) {
      assert.equal(mesh.geometry, before[i].geometry); assert.deepEqual(mesh.geometry.attributes.position.array, before[i].position); assert.deepEqual(mesh.matrix.toArray(), before[i].transform);
      const originals = [before[i].original].flat() as THREE.MeshStandardMaterial[], now = [mesh.material].flat() as THREE.MeshStandardMaterial[];
      for (let j = 0; j < now.length; j++) {
        assert.notEqual(now[j], originals[j]); assert.ok(originals[j].color.equals(before[i].colors[j]));
        for (const field of ['roughness','metalness','opacity','transparent','depthWrite','emissiveIntensity','map','normalMap'] as const) assert.equal(now[j][field], originals[j][field], `${field} unchanged`);
      }
    }
    if (finish.id !== 'original') assert.ok(meshes.some((mesh, i) => [mesh.material].flat().some((m, j) => !(m as THREE.MeshStandardMaterial).color.equals(before[i].colors[j]))), 'both rifle and suffixed blade PH materials visibly recolor');
  }
  controls.apply('original'); meshes.forEach((mesh, i) => [mesh.material].flat().forEach((m, j) => assert.ok((m as THREE.MeshStandardMaterial).color.equals(before[i].colors[j]))));
  assert.equal(controls.apply('invalid'), false); controls.dispose(); controls.dispose();
  assert.equal(cloneDisposals, clones.size); meshes.forEach((mesh, i) => assert.equal(mesh.material, before[i].original)); assert.equal(controls.apply('ember'), false);
});

test('rifle and blade retain pre-load finish, support changes, and cancel late loads without scene/material leaks', async () => {
  const { buildSkinnedCharacter } = await import('../src/skinnedCharacter.ts');
  const { attachExplorerRifle } = await import('../src/weaponArt.ts');
  const { attachExplorerBlade } = await import('../src/playerBladeArt.ts');
  const character = await parseLocalGlb(new URL('../../assets/characters/player_v2/player_v2.glb', import.meta.url));
  const rig = buildSkinnedCharacter(character.scene);
  for (const kind of ['rifle', 'blade'] as const) {
    const asset = await parseLocalGlb(new URL(`../../assets/weapons/glb/${kind === 'rifle' ? '01_Dawn_AR' : '06_Refract_Blade'}.glb`, import.meta.url));
    let resolve!: (value: { scene: THREE.Group }) => void;
    const loader = () => new Promise<{ scene: THREE.Group }>(done => { resolve = done; });
    const art = kind === 'rifle' ? attachExplorerRifle(rig, undefined, loader) : attachExplorerBlade(rig, loader);
    assert.equal(art.setFinish('tide'), true); assert.equal(art.setFinish('unknown'), false);
    resolve(asset); await art.ready; assert.equal(art.finish, 'tide');
    let matched = 0; const originalMaterials = new Set<THREE.Material>();
    asset.scene.traverse(o => { if (!(o instanceof THREE.Mesh)) return; for (const m of [o.material].flat()) { originalMaterials.add(m); if (/^PH_dark(?:\.\d+)?$/.test(m.name)) { matched++; assert.equal((m as THREE.MeshStandardMaterial).color.getHexString(), '194843'); } } });
    assert.ok(matched > 0); assert.equal(art.setFinish('original'), true);
    let disposed = 0; originalMaterials.forEach(m => m.addEventListener('dispose', () => disposed++)); art.dispose(); art.dispose();
    assert.equal(disposed, originalMaterials.size, 'finish clone disposed exactly once'); assert.equal(art.setFinish('ember'), false);
    const late = await parseLocalGlb(new URL(`../../assets/weapons/glb/${kind === 'rifle' ? '01_Dawn_AR' : '06_Refract_Blade'}.glb`, import.meta.url));
    let finishLoad!: (value: { scene: THREE.Group }) => void;
    const delayed = () => new Promise<{ scene: THREE.Group }>(done => { finishLoad = done; });
    const canceled = kind === 'rifle' ? attachExplorerRifle(rig, undefined, delayed) : attachExplorerBlade(rig, delayed);
    canceled.setFinish('oath'); canceled.dispose(); finishLoad(late); await canceled.ready;
    assert.equal(late.scene.parent, null, 'late asset cannot reattach after dispose');
  }
  rig.dispose();
});
