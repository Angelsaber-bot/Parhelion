/** Champion regalia: every chapter boss must be told apart by silhouette, not by its health bar. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { BOSSES } from '../src/combat.ts';
import { MINIBOSSES } from '../src/minibosses.ts';
import { ELITE_CRESTS, hasEliteCrest, createEliteCrestKit } from '../src/eliteCrestVisual.ts';
import { BOSS_REGALIA_IDS, hasBossRegalia, createBossRegaliaKit, type BossRegaliaId } from '../src/bossRegaliaVisual.ts';

/** Stand-in for the authored rig: the bones the kits pin regalia to, in their bind-pose places. */
function rig() {
  const root = new THREE.Group(); root.name = 'ChampionRig';
  const pelvis = new THREE.Bone(); pelvis.name = 'pelvis'; pelvis.position.y = .91;
  const chest = new THREE.Bone(); chest.name = 'chest'; chest.position.y = .36;
  const head = new THREE.Bone(); head.name = 'head'; head.position.y = .28;
  chest.add(head); pelvis.add(chest); root.add(pelvis); root.updateMatrixWorld(true);
  return root;
}
const count = (o: THREE.Object3D) => { let n = 0; o.traverse(x => { if ((x as THREE.Mesh).isMesh) n++; }); return n; };

test('every chapter boss has its own regalia', () => {
  for (const boss of BOSSES) assert.ok(hasBossRegalia(boss.id), `${boss.id} has no regalia`);
  assert.equal(BOSS_REGALIA_IDS.length, BOSSES.length);
});

test('regalia pins to the head and chest bones and carries real detail', () => {
  for (const id of BOSS_REGALIA_IDS) {
    const kit = createBossRegaliaKit(id), actor = rig();
    const worn = kit.attach(actor);
    assert.ok(worn, `${id} did not attach`);
    const head = actor.getObjectByName('head')!, chest = actor.getObjectByName('chest')!;
    // Nothing may be left parented to the actor root: bones carry the regalia so it follows the animation.
    assert.equal(actor.children.filter(o => o.userData.visualOnly).length, 0, `${id} left regalia off the bones`);
    const onBones = count(head) + count(chest);
    assert.ok(onBones >= 20, `${id} regalia is too plain: ${onBones} meshes`);
    assert.ok(onBones <= 140, `${id} regalia is too heavy: ${onBones} meshes`);
    // Regalia sits on the authored silhouette, never inside the floor or out past arm's reach.
    const box = new THREE.Box3();
    for (const g of [...head.children, ...chest.children]) if (g.userData.visualOnly) box.expandByObject(g);
    assert.ok(box.min.y > .78, `${id} regalia drags on the ground (${box.min.y.toFixed(2)})`);
    assert.ok(box.max.y < 2.4, `${id} regalia towers over the champion (${box.max.y.toFixed(2)})`);
    assert.ok(box.max.x < .5 && box.min.x > -.5, `${id} regalia sticks out past the arms`);
    worn!.remove();
    assert.equal(count(head) + count(chest), 0, `${id} regalia survived remove()`);
    kit.dispose();
  }
});

test('regalia animates without touching the simulation', () => {
  for (const id of BOSS_REGALIA_IDS) {
    const kit = createBossRegaliaKit(id), actor = rig();
    const worn = kit.attach(actor)!;
    const enemy = Object.freeze({ mode: 'windup' });
    for (let t = 0; t < 4; t += .25) worn.update?.(enemy, t);
    worn.update?.(Object.freeze({ mode: 'idle' }), 4);
    worn.remove(); kit.dispose();
  }
});

test('an unknown champion gets no regalia', () => {
  assert.equal(hasBossRegalia('wild_3b'), false);
  assert.equal(hasBossRegalia('elite_oath_knight'), false);
  const ids: readonly string[] = BOSS_REGALIA_IDS as readonly BossRegaliaId[];
  assert.equal(new Set(ids).size, ids.length);
});

test('every roaming elite with an authored kit carries a sashimono', () => {
  for (const def of MINIBOSSES) {
    // The valley sentinel is the one elite with no human kit: it is a procedural crystal creature.
    const expected = def.id !== 'elite_valley_sentinel';
    assert.equal(hasEliteCrest(def.id), expected, `${def.id} crest mismatch`);
  }
  assert.equal(hasEliteCrest(undefined), false);
  assert.equal(hasEliteCrest('boss_vacant_king'), false);
});

test('elite crests ride the bones and clear away on remove', () => {
  for (const id of Object.keys(ELITE_CRESTS)) {
    const kit = createEliteCrestKit(id), actor = rig();
    const worn = kit.attach(actor);
    assert.ok(worn, `${id} did not attach`);
    const head = actor.getObjectByName('head')!, chest = actor.getObjectByName('chest')!;
    assert.equal(actor.children.filter(o => o.userData.visualOnly).length, 0, `${id} left the crest off the bones`);
    const worn_meshes = count(head) + count(chest);
    assert.ok(worn_meshes >= 15 && worn_meshes <= 60, `${id} crest mesh count ${worn_meshes}`);
    // The banner must stand above the shoulder and behind the back, never across the face.
    const banner = chest.getObjectByName('EliteSashimono')!;
    const box = new THREE.Box3().setFromObject(banner);
    assert.ok(box.max.y > 1.9, `${id} banner does not clear the head`);
    assert.ok(box.min.z < -.1, `${id} banner is not worn on the back`);
    for (const mode of ['idle', 'chase', 'windup']) worn!.update?.({ mode }, 1.5);
    worn!.remove();
    assert.equal(count(head) + count(chest), 0, `${id} crest survived remove()`);
    kit.dispose();
  }
});

test('a rallied elite banner smoulders and its gems burn brighter', async () => {
  const { createEliteCrestKit } = await import('../src/eliteCrestVisual.ts');
  const THREE = await import('three');
  const root = new THREE.Group(), chest = new THREE.Bone(), head = new THREE.Bone(); chest.name = 'chest'; head.name = 'head'; chest.position.y = 1.27; head.position.y = .28; chest.add(head); root.add(chest); root.updateMatrixWorld(true);
  const kit = createEliteCrestKit('elite_oath_knight'), worn = kit.attach(root)!;
  const mat = (name: string) => { let m: THREE.MeshStandardMaterial | undefined; root.traverse(o => { const x = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (x?.name === name) m = x; }); return m!; };
  worn.update({ mode: 'chase', phase: 1 }, 1);
  const calm = [mat('EliteBanner').emissiveIntensity, mat('EliteRankGem').emissiveIntensity];
  assert.equal(calm[0], 0);
  worn.update({ mode: 'chase', phase: 2 }, 1);
  assert.ok(mat('EliteBanner').emissiveIntensity > .2); assert.ok(mat('EliteRankGem').emissiveIntensity > calm[1] + .9);
  worn.remove(); kit.dispose();
});
