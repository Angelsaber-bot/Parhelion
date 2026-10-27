import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildCharacter, CharacterAnimator } from '../src/character.ts';
import { attachExplorerRifle } from '../src/weaponArt.ts';
async function asset() {
  const b = await readFile(new URL('../../assets/weapons/glb/01_Dawn_AR.glb', import.meta.url));
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
}
test('actual World AR replaces fallback, preserves two-hand anchors, and points with TPS aim', async () => {
  const rig = buildCharacter(new THREE.MeshStandardMaterial()), rifle = attachExplorerRifle(rig, undefined, asset);
  await rifle.ready;
  assert.equal(rig.joints.Gun.userData.artState, 'ready'); assert.equal(rig.joints.Gun.getObjectByName('Rifle'), undefined);
  for (const [anchor, hand] of [[rig.gunAnchors.grip, rig.gunHands.right], [rig.gunAnchors.support, rig.gunHands.left]]) {
    const transformed = anchor.clone().applyQuaternion(rig.gunHold.q).add(rig.gunHold.p);
    assert.ok(transformed.distanceTo(hand) < 1e-6, 'low-ready hand placement');
  }
  const animator = new CharacterAnimator(rig);
  for (const pitch of [-1.4, -.6, 0, .6, 1.4]) {
    animator.update(1/60, { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: 0, aim: 1, pitch });
    const barrel = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.joints.Gun.quaternion);
    assert.ok(barrel.distanceTo(new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch))) < 1e-6);
    rig.root.updateMatrixWorld(true);
    const muzzle = rifle.muzzleWorld();
    assert.ok(muzzle.toArray().every(Number.isFinite), 'muzzle follows animated authored gun');
    const localMuzzle = rig.joints.Gun.worldToLocal(muzzle.clone());
    assert.ok(localMuzzle.z < -0.3, 'projectiles originate at the forward barrel, not the receiver');
    for (const side of ['R', 'L']) {
      const anchor = (side === 'R' ? rig.gunAnchors.grip : rig.gunAnchors.support).clone().applyMatrix4(rig.joints.Gun.matrixWorld);
      const hand = new THREE.Vector3(0, -.28, 0).applyMatrix4(rig.joints[`Forearm_${side}`].matrixWorld);
      assert.ok(hand.distanceTo(anchor) < .035, `ADS ${side} grip error ${hand.distanceTo(anchor)}`);
    }
  }
  // Repeated ADS, then swimming/gliding, must return control to the existing animator.
  animator.update(.1, { speed: 2, onGround: false, swimming: true, vy: 0, moveYaw: 0, aim: 0 });
  assert.ok(Number.isFinite(rig.joints.Gun.quaternion.w));
  rifle.dispose(); rifle.dispose();
});
test('World model failure leaves its original character rifle available', async () => {
  const rig = buildCharacter(new THREE.MeshStandardMaterial());
  const rifle = attachExplorerRifle(rig, undefined, async () => { throw new Error('offline'); });
  await rifle.ready; assert.equal(rig.joints.Gun.userData.artState, 'fallback'); assert.ok(rig.joints.Gun.getObjectByName('Rifle'));
  assert.ok(rifle.muzzleWorld().toArray().every(Number.isFinite), 'fallback still supplies a valid muzzle');
  rifle.dispose();
});
