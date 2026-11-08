/** Baking gear down to one draw per material must change the cost, never the picture. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { bakeAttachedKits, disposeBakedKits } from '../src/companions/kitMerge.ts';
import { createBossRegaliaKit, BOSS_REGALIA_IDS } from '../src/combat/bossRegaliaVisual.ts';
import { createEliteCrestKit, ELITE_CRESTS } from '../src/combat/eliteCrestVisual.ts';
import { createTroopKit, troopVariant, TROOP_VARIANTS } from '../src/combat/troopKitVisual.ts';
import { createShieldKit } from '../src/combat/shieldbearerVisual.ts';
import { createShinobiKit } from '../src/combat/shinobiVisual.ts';
import { createPowderKit } from '../src/combat/powderVisual.ts';
import { createJaegerKit } from '../src/combat/jaegerVisual.ts';
import { createBombardierKit, createBreakerKit } from '../src/combat/roleGearVisual.ts';

function rig() {
  const root = new THREE.Group();
  const pelvis = new THREE.Bone(); pelvis.name = 'pelvis'; pelvis.position.y = .91;
  const chest = new THREE.Bone(); chest.name = 'chest'; chest.position.y = .36;
  const head = new THREE.Bone(); head.name = 'head'; head.position.y = .28;
  const upper = new THREE.Bone(); upper.name = 'upper_armL'; upper.position.set(.2, .16, 0);
  const fore = new THREE.Bone(); fore.name = 'forearmL'; fore.position.set(.12, -.27, .01);
  const foreR = new THREE.Bone(); foreR.name = 'forearmR'; foreR.position.set(-.32, -.11, .01);
  upper.add(fore); chest.add(head, upper, foreR); pelvis.add(chest); root.add(pelvis); root.updateMatrixWorld(true);
  return root;
}
const meshes = (o: THREE.Object3D) => { const out: THREE.Mesh[] = []; o.traverse(x => { if ((x as THREE.Mesh).isMesh) out.push(x as THREE.Mesh); }); return out; };
const triangles = (o: THREE.Object3D) => meshes(o).reduce((n, m) => n + (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3, 0);

/** Every kit in the world, each with the bone set it expects. */
function kits(): { name: string; kit: { attach(a: THREE.Object3D, id?: string): unknown; dispose(): void }; id?: string }[] {
  const list = [
    ...BOSS_REGALIA_IDS.map(id => ({ name: id, kit: createBossRegaliaKit(id) })),
    ...Object.keys(ELITE_CRESTS).map(id => ({ name: id, kit: createEliteCrestKit(id) })),
    { name: 'shieldbearer', kit: createShieldKit() },
    { name: 'shinobi', kit: createShinobiKit() },
    { name: 'powder', kit: createPowderKit() },
    { name: 'jaeger', kit: createJaegerKit() },
    { name: 'bombardier', kit: createBombardierKit() },
    { name: 'breaker', kit: createBreakerKit() },
  ];
  for (const variant of TROOP_VARIANTS) {
    if (variant === 'none') continue;
    let id = '';
    for (let i = 0; i < 4000 && !id; i++) if (troopVariant(`wild_${i}`) === variant) id = `wild_${i}`;
    list.push({ name: `troop_${variant}`, kit: createTroopKit() as never, id });
  }
  return list as never;
}

test('baking keeps the silhouette and the triangles, and cuts the draws', () => {
  for (const { name, kit, id } of kits()) {
    const actor = rig();
    assert.ok(kit.attach(actor, id), `${name} did not attach`);
    actor.updateMatrixWorld(true);
    const before = new THREE.Box3().setFromObject(actor, true), beforeTris = triangles(actor), beforeMeshes = meshes(actor).length;
    const saved = bakeAttachedKits(actor);
    actor.updateMatrixWorld(true);
    const after = new THREE.Box3().setFromObject(actor, true), afterTris = triangles(actor), afterMeshes = meshes(actor).length;
    assert.equal(afterTris, beforeTris, `${name} changed triangle count`);
    for (const key of ['min', 'max'] as const) for (const axis of ['x', 'y', 'z'] as const)
      assert.ok(Math.abs(before[key][axis] - after[key][axis]) < 1e-4, `${name} moved: ${key}.${axis} ${before[key][axis]} -> ${after[key][axis]}`);
    assert.equal(afterMeshes, beforeMeshes - saved, `${name} lost or gained meshes`);
    if (beforeMeshes > 6) assert.ok(afterMeshes <= beforeMeshes / 2, `${name} barely baked: ${beforeMeshes} -> ${afterMeshes}`);
    disposeBakedKits(actor); kit.dispose();
  }
});

test('the pieces an update() drives survive baking', () => {
  // The halo rings, the kelp, the ember seams, the keg spark, the slow-match and the banner are
  // held by closures; baking them away would freeze or crash the animation.
  const cases: [string, () => { attach(a: THREE.Object3D): unknown; dispose(): void }, string][] = [
    ['boss_vacant_king', () => createBossRegaliaKit('boss_vacant_king'), 'KingVacantHalo'],
    ['boss_drowned_admiral', () => createBossRegaliaKit('boss_drowned_admiral'), 'AdmiralKelp'],
    ['boss_hellfire_lord', () => createBossRegaliaKit('boss_hellfire_lord'), 'HellfireEmber'],
    ['elite_oath_knight', () => createEliteCrestKit('elite_oath_knight'), 'EliteBanner'],
    ['powder', () => createPowderKit(), 'PowderKegSpark'],
    ['bombardier', () => createBombardierKit(), 'BombardierEmber'],
  ];
  for (const [name, make, material] of cases) {
    const kit = make(), actor = rig();
    const worn = kit.attach(actor) as { update?(e: { mode: string }, t: number): void; remove(): void };
    const live = () => meshes(actor).filter(m => m.userData.dynamic === true && (m.material as THREE.Material).name === material);
    const kept = live().length;
    assert.ok(kept > 0, `${name} marks no ${material} mesh as dynamic`);
    bakeAttachedKits(actor);
    assert.equal(live().length, kept, `${name} baked away its ${material} pieces`);
    assert.ok(meshes(actor).some(m => m.userData.baked), `${name} baked nothing at all`);
    for (const mode of ['idle', 'chase', 'windup']) worn.update?.({ mode }, 2.5);
    worn.remove(); disposeBakedKits(actor); kit.dispose();
  }
});
