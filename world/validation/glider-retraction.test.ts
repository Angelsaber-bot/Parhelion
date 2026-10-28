import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { Player } from '../src/player.ts';
import { SkinnedCharacterAnimator, type PlayerAnimationState } from '../src/skinnedCharacter.ts';
import { playerFixture } from './player-fixture.ts';

const base: PlayerAnimationState = { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: 0 };
const glide = { ...base, speed: 8, onGround: false, gliding: true, vy: -2 };
const idle = { x: 0, z: 0, jump: false, sprint: false };
type Rig = Awaited<ReturnType<typeof playerFixture>>['rig'];
function hands(rig: Rig) { return (['R', 'L'] as const).map(side => rig.handSockets[side].getWorldPosition(new THREE.Vector3())); }
function gunError(rig: Rig) {
  return Math.max(...(['R', 'L'] as const).map((side, i) => rig.handSockets[side].getWorldPosition(new THREE.Vector3())
    .distanceTo(rig.joints.Gun.localToWorld((i ? rig.gunAnchors.support : rig.gunAnchors.grip).clone()))));
}
function deployed(rig: Rig) { return 1 + rig.glider.wings[0].rotation.z / 1.35; }

test('landing cancels gliding in the collision step, not on a later physics/render tick', () => {
  const geometry = new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2);
  const p = new Player([{ name: 'floor', bvh: new MeshBVH(geometry), enabled: true }], -100);
  p.teleport(0, .005, 0); p.gliding = true; p.vel.y = -2;
  p.step(1 / 120, idle);
  assert.equal(p.onGround, true); assert.equal(p.gliding, false);
  geometry.dispose();
});

test('jump is still a press-edge glide toggle; release, held input, water, flight and updraft retain their rules', () => {
  for (const hz of [30, 60, 120]) {
    const p = new Player([], -100); p.teleport(0, 100, 0);
    p.step(1 / hz, { ...idle, jump: true }); assert.equal(p.gliding, true);
    p.step(1 / hz, idle); assert.equal(p.gliding, true, 'key release is not a new close action');
    p.step(1 / hz, { ...idle, jump: true }); assert.equal(p.gliding, false);
    for (let i = 0; i < 3; i++) { p.step(1 / hz, { ...idle, jump: true }); assert.equal(p.gliding, false); }
    for (let i = 0; i < 12; i++) {
      p.step(1 / hz, idle); p.step(1 / hz, { ...idle, jump: true });
      assert.equal(p.gliding, i % 2 === 0);
    }
    p.gliding = true; p.waterLevel = p.pos.y + 2; p.step(1 / hz, idle);
    assert.equal(p.swimming, true); assert.equal(p.gliding, false);
    p.flying = true; assert.equal(p.gliding, false);
    p.flying = false; p.waterLevel = -100; p.teleport(0, 20, 0);
    p.updrafts = [{ x: 0, z: 0, r: 4, y0: 0, y1: 60 }]; p.step(1 / hz, idle);
    assert.equal(p.gliding, true, 'automatic updraft opening is unchanged');
  }
});

test('real-rig retraction is bounded at 30/60/120 Hz, with fast canopy hide and rifle recovery', async t => {
  const metrics = [];
  for (const hz of [30, 60, 120]) for (const [name, state] of [
    ['air-toggle', { ...base, onGround: false, vy: -3 }], ['landing', base],
  ] as const) {
    const f = await playerFixture(), animator = new SkinnedCharacterAnimator(f.rig);
    for (let i = 0; i < hz * 3; i++) animator.update(1 / hz, glide);
    let canopyHidden = 0, rifleContact = 0, previous = hands(f.rig), maxHandTravel = 0, lastDeploy = deployed(f.rig);
    for (let i = 1; i <= hz * 2; i++) {
      animator.update(1 / hz, state);
      const amount = deployed(f.rig), next = hands(f.rig);
      assert.ok(amount <= lastDeploy + 1e-10, 'no rebound while stowing'); lastDeploy = amount;
      maxHandTravel = Math.max(maxHandTravel, ...next.map((p, j) => p.distanceTo(previous[j]))); previous = next;
      if (!f.rig.glider.root.visible && !canopyHidden) canopyHidden = i / hz;
      if (gunError(f.rig) < .002 && !rifleContact) rifleContact = i / hz;
      assert.deepEqual(f.rig.glider.root.scale.toArray(), [1, 1, 1]);
    }
    metrics.push({ hz, state: name, canopyHidden, rifleContact, maxHandTravel });
    t.diagnostic(JSON.stringify(metrics.at(-1)));
    assert.ok(canopyHidden > 0 && canopyHidden <= .37, `canopy lingered ${canopyHidden}s`);
    assert.ok(rifleContact > 0 && rifleContact <= .34, `rifle return took ${rifleContact}s`);
    assert.ok(maxHandTravel * hz <= 4.2, `hand moved ${maxHandTravel}m in one ${hz}Hz frame`);
    assert.equal(deployed(f.rig), 0, 'finite close reaches fully folded, not an asymptotic leftover');
    assert.equal(f.rig.diagnostics.mode, 'ready'); f.dispose();
  }
});

test('partial deploy/stow reversals, swimming and fire/ADS interruptions never leave a hidden or scaled-open glider', async () => {
  for (const hz of [30, 60, 120]) {
    const f = await playerFixture(), animator = new SkinnedCharacterAnimator(f.rig);
    for (let cycle = 0; cycle < 8; cycle++) {
      for (let i = 0; i < Math.max(1, Math.round(hz * .08)); i++) animator.update(1 / hz, glide);
      for (let i = 0; i < Math.max(1, Math.round(hz * .05)); i++) animator.update(1 / hz, base);
      for (const bone of Object.values(f.rig.bones)) assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
    }
    for (let i = 0; i < hz * 2; i++) animator.update(1 / hz, glide);
    assert.equal(f.rig.glider.root.visible, true);
    assert.ok(deployed(f.rig) > .999); assert.equal(f.rig.diagnostics.mode, 'glide');
    for (const side of ['R', 'L'] as const) assert.ok(f.rig.handSockets[side].getWorldPosition(new THREE.Vector3())
      .distanceTo(f.rig.glider.grips[side].getWorldPosition(new THREE.Vector3())) < .002);
    const before = deployed(f.rig), look = new THREE.Vector3(.4, .6, -.7).normalize();
    animator.prepareShot(look);
    assert.equal(deployed(f.rig), before, 'dt=0 first-shot pose must not fold the canopy');
    assert.ok(gunError(f.rig) < .002);
    assert.ok(new THREE.Vector3(0, 0, -1).applyQuaternion(f.rig.joints.Gun.getWorldQuaternion(new THREE.Quaternion())).distanceTo(look) < 1e-6);
    for (let i = 0; i < hz; i++) animator.update(1 / hz, { ...base, aim: 1, pitch: .6, firing: true, lookYaw: 1.2 });
    assert.equal(f.rig.glider.root.visible, false); assert.ok(gunError(f.rig) < .002);
    for (let i = 0; i < hz * 2; i++) animator.update(1 / hz, glide);
    for (let i = 0; i < Math.ceil(hz * .37); i++) animator.update(1 / hz, { ...base, onGround: false, swimming: true, speed: 3 });
    assert.equal(f.rig.glider.root.visible, false); assert.equal(deployed(f.rig), 0);
    assert.equal(f.rig.diagnostics.mode, 'swim');
    assert.deepEqual(f.rig.glider.root.scale.toArray(), [1, 1, 1]);
    for (let i = 0; i < hz * 2; i++) animator.update(1 / hz, glide);
    assert.equal(f.rig.glider.root.visible, true); assert.ok(deployed(f.rig) > .999);
    assert.equal(f.rig.diagnostics.mode, 'glide'); f.dispose();
  }
});

test('unarmed landing releases handles throughout the close instead of snapping after the canopy hides', async t => {
  for (const hz of [30, 60, 120]) {
    const f = await playerFixture(), animator = new SkinnedCharacterAnimator(f.rig);
    animator.reset(false);
    for (let i = 0; i < hz * 2; i++) animator.update(1 / hz, { ...glide, armed: false });
    let previous = hands(f.rig), maxHandTravel = 0;
    for (let i = 0; i < Math.ceil(hz * .4); i++) {
      animator.update(1 / hz, { ...base, armed: false });
      const next = hands(f.rig); maxHandTravel = Math.max(maxHandTravel, ...next.map((p, j) => p.distanceTo(previous[j]))); previous = next;
    }
    t.diagnostic(JSON.stringify({ hz, state: 'unarmed-landing', maxHandTravel }));
    assert.ok(maxHandTravel * hz < 4.5, 'the hidden-canopy threshold must not drop both hands in one frame');
    assert.equal(f.rig.glider.root.visible, false); assert.equal(f.rig.joints.Gun.visible, false);
    assert.equal(f.rig.diagnostics.mode, 'unarmed'); f.dispose();
  }
});
