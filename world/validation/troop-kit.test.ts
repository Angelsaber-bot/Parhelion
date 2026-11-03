/** Field kit: a patrol must not look like one soldier stamped six times, and kit must never hide a tell. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createTroopKit, troopVariant, TROOP_VARIANTS } from '../src/troopKitVisual.ts';

function rig() {
  const root = new THREE.Group();
  const pelvis = new THREE.Bone(); pelvis.name = 'pelvis'; pelvis.position.y = .91;
  const chest = new THREE.Bone(); chest.name = 'chest'; chest.position.y = .36;
  const head = new THREE.Bone(); head.name = 'head'; head.position.y = .28;
  chest.add(head); pelvis.add(chest); root.add(pelvis); root.updateMatrixWorld(true);
  return root;
}
const count = (o: THREE.Object3D) => { let n = 0; o.traverse(x => { if ((x as THREE.Mesh).isMesh) n++; }); return n; };

test('kit is stable per soldier and spread across the variants', () => {
  for (const id of ['wild_3b', 'wild_41', 'story_oath_2']) assert.equal(troopVariant(id), troopVariant(id));
  const seen = new Map<string, number>();
  for (let i = 0; i < 400; i++) { const v = troopVariant(`wild_${i}`); seen.set(v, (seen.get(v) ?? 0) + 1); }
  for (const v of TROOP_VARIANTS) assert.ok((seen.get(v) ?? 0) > 20, `${v} is near-unused: ${seen.get(v) ?? 0}`);
});

test('kit hangs off a bone, clears the face, and clears away on remove', () => {
  const kit = createTroopKit();
  const drawn = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const id = `wild_${i}`, actor = rig(), worn = kit.attach(actor, id);
    const variant = troopVariant(id);
    if (variant === 'none') { assert.equal(worn, null, 'a bare soldier draws nothing'); continue; }
    assert.ok(worn, `${variant} did not attach`);
    drawn.add(variant);
    const head = actor.getObjectByName('head')!, chest = actor.getObjectByName('chest')!;
    assert.equal(actor.children.filter(o => o.userData.visualOnly).length, 0, 'kit left off the bones');
    const box = new THREE.Box3(), face = new THREE.Box3();
    for (const g of [...head.children, ...chest.children]) if (g.userData.visualOnly) box.expandByObject(g);
    for (const g of head.children) if (g.userData.visualOnly) face.expandByObject(g);
    // Nothing may cross the face, and nothing may stand off further than a worn cloak.
    if (!face.isEmpty()) assert.ok(face.max.z < .06, `${variant} hangs across the face`);
    assert.ok(box.max.z < .26, `${variant} juts out in front of the soldier`);
    assert.ok(box.min.y > .95 && box.max.y < 2, `${variant} sits off the body`);
    worn!.remove();
    assert.equal(count(head) + count(chest), 0, `${variant} survived remove()`);
  }
  assert.equal(drawn.size, TROOP_VARIANTS.length - 1, 'every drawn variant was exercised');
  kit.dispose();
});

test('a rig with no chest bone takes no kit', () => {
  const kit = createTroopKit();
  const bare = new THREE.Group();
  for (let i = 0; i < 20; i++) assert.equal(kit.attach(bare, `wild_${i}`), null);
  kit.dispose();
});
