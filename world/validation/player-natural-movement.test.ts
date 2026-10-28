import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { playerFixture } from './player-fixture.ts';
import { SkinnedCharacterAnimator } from '../src/skinnedCharacter.ts';
import { ShoulderAim } from '../src/aim.ts';

const base = { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: 0 };
type Rig = Awaited<ReturnType<typeof playerFixture>>['rig'];
const point = (rig: Rig, side: 'R' | 'L') => rig.handSockets[side].getWorldPosition(new THREE.Vector3());
function contact(rig: Rig, side: 'R' | 'L') {
  return point(rig, side).distanceTo(rig.joints.Gun.localToWorld((side === 'R' ? rig.gunAnchors.grip : rig.gunAnchors.support).clone()));
}
function gunMeshes(rig: Rig) {
  const meshes: THREE.Mesh[] = []; rig.joints.Gun.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); }); return meshes;
}

test('walk/run carry is lowered, right-hand attached and left arm swings; ADS/fire reclaim both palms at 30/60/120 Hz', async t => {
  for (const hz of [30, 60, 120]) for (const speed of [5.5, 9]) {
    const f = await playerFixture(), animator = new SkinnedCharacterAnimator(f.rig), rig = f.rig;
    for (let i = 0; i < hz * 2; i++) animator.update(1 / hz, { ...base, speed });
    let minLeftZ = Infinity, maxLeftZ = -Infinity, minMuzzleY = Infinity;
    for (let i = 0; i < hz; i++) {
      animator.update(1 / hz, { ...base, speed });
      const shoulderY = (rig.joints.Arm_R.getWorldPosition(new THREE.Vector3()).y + rig.joints.Arm_L.getWorldPosition(new THREE.Vector3()).y) / 2;
      assert.ok(shoulderY - point(rig, 'R').y > .35, 'right carry must not be held at chest/shoulder level');
      assert.ok(shoulderY - point(rig, 'L').y > .35, 'left arm must relax instead of holding the foregrip');
      assert.ok(contact(rig, 'R') < .002); assert.ok(contact(rig, 'L') > .20);
      const barrel = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.joints.Gun.getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(barrel.y < -.8, 'un-aimed travel points the barrel down');
      minLeftZ = Math.min(minLeftZ, point(rig, 'L').z); maxLeftZ = Math.max(maxLeftZ, point(rig, 'L').z);
      minMuzzleY = Math.min(minMuzzleY, f.rifle.muzzleWorld().y);
      assert.ok(new THREE.Box3().setFromObject(rig.joints.Gun).min.y > .08, 'the actual rifle cannot enter the ground');
    }
    assert.ok(maxLeftZ - minLeftZ > .15, 'non-weapon arm needs visible natural gait swing');
    t.diagnostic(JSON.stringify({ hz, speed, leftSwing: maxLeftZ - minLeftZ, minMuzzleY }));
    // Input-event shots before the next animation tick may be immediate, never stale carry.
    for (const yaw of [-Math.PI, -1.2, .9]) for (const pitch of [-1.45, 0, 1.45]) {
      const look = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      animator.prepareShot(look);
      assert.ok(contact(rig, 'R') < .002 && contact(rig, 'L') < .002);
      assert.ok(new THREE.Vector3(0, 0, -1).applyQuaternion(rig.joints.Gun.getWorldQuaternion(new THREE.Quaternion())).distanceTo(look) < 1e-6);
    }
    for (let i = 0; i < hz * 2; i++) animator.update(1 / hz, { ...base, speed, aim: 1, pitch: .6 });
    assert.ok(contact(rig, 'R') < .002 && contact(rig, 'L') < .002);
    for (let i = 0; i < hz * 2; i++) animator.update(1 / hz, { ...base, speed });
    assert.ok(contact(rig, 'R') < .002); assert.ok(contact(rig, 'L') > .20);
    f.dispose();
  }
});

test('rapid movement/ADS release and glider interruptions settle without drift or invalid transforms', async t => {
  for (const hz of [30, 60, 120]) {
    const f = await playerFixture(), animator = new SkinnedCharacterAnimator(f.rig), aim = new ShoulderAim();
    let previous = [point(f.rig, 'R'), point(f.rig, 'L')], maxTravel = 0;
    animator.update(0, base); previous = [point(f.rig, 'R'), point(f.rig, 'L')];
    for (let cycle = 0; cycle < 10; cycle++) {
      aim.held = cycle % 2 === 0;
      for (let i = 0; i < Math.ceil(hz * .15); i++) {
        animator.update(1 / hz, { ...base, speed: cycle % 3 === 0 ? 0 : 9, aim: aim.step(1 / hz, true), pitch: .3 });
        const next = [point(f.rig, 'R'), point(f.rig, 'L')];
        maxTravel = Math.max(maxTravel, ...next.map((p, j) => p.distanceTo(previous[j]))); previous = next;
        assert.ok(contact(f.rig, 'R') < .002);
        for (const bone of Object.values(f.rig.bones)) assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
      }
    }
    t.diagnostic(JSON.stringify({ hz, maxTravel }));
    assert.ok(maxTravel * hz < 6, 'normal ADS/movement changes cannot teleport a hand');
    for (const state of [
      { ...base, speed: 8, onGround: false, gliding: true, vy: -2 },
      { ...base, speed: 9 }, { ...base, swimming: true, onGround: false, speed: 3 }, { ...base, speed: 5.5 }, base,
    ]) {
      for (let i = 0; i < hz * 2; i++) animator.update(1 / hz, state);
      assert.equal(f.rig.glider.root.visible, !!(state as any).gliding);
      assert.deepEqual(f.rig.glider.root.scale.toArray(), [1, 1, 1]);
    }
    assert.ok(contact(f.rig, 'R') < .002 && contact(f.rig, 'L') < .002, 'standing returns to existing two-hand ready');
    f.dispose();
  }
});

test('actual lowered Dawn triangles clear trousers, shoes and uniform throughout walk/run strides', async () => {
  const f = await playerFixture(), animator = new SkinnedCharacterAnimator(f.rig), guns = gunMeshes(f.rig);
  const gunTrees = guns.map(m => new MeshBVH(m.geometry));
  const bodies = f.rig.meshes.filter(m => /BodyBatch_0[123457]_/.test(m.name)) as THREE.SkinnedMesh[];
  assert.equal(bodies.length, 6);
  for (const speed of [5.5, 9]) {
    for (let i = 0; i < 120; i++) animator.update(1 / 60, { ...base, speed });
    for (let frame = 0; frame < 24; frame++) {
      animator.update(1 / 30, { ...base, speed });
      for (const body of bodies) {
        const geometry = new THREE.BufferGeometry(), positions = new Float32Array(body.geometry.attributes.position.count * 3), p = new THREE.Vector3();
        for (let i = 0; i < positions.length / 3; i++) body.getVertexPosition(i, p).toArray(positions, i * 3);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setIndex(body.geometry.index!.clone());
        const tree = new MeshBVH(geometry), inverse = body.matrixWorld.clone().invert();
        guns.forEach((gun, i) => assert.equal(tree.bvhcast(gunTrees[i], inverse.clone().multiply(gun.matrixWorld), {
          intersectsTriangles: (a, b) => a.intersectsTriangle(b, undefined, true),
        }), false, `${body.name}/${gun.name} crosses at speed=${speed}, sample=${frame}`));
        geometry.dispose();
      }
    }
  }
  f.dispose();
});

test('unarmed startup/reset hides the rifle immediately, clears old firing/glide state and preserves free-arm movement', async () => {
  const f = await playerFixture(), animator = new SkinnedCharacterAnimator(f.rig), rig = f.rig;
  for (const hz of [30, 60, 120]) {
    for (let i = 0; i < hz; i++) animator.update(1 / hz, { ...base, speed: 8, onGround: false, gliding: true, firing: true, lookYaw: 2 });
    animator.reset(false, .7);
    assert.equal(rig.joints.Gun.visible, false); assert.equal(rig.glider.root.visible, false);
    assert.equal(rig.diagnostics.mode, 'unarmed'); assert.equal(animator.facing, .7);
    assert.deepEqual(rig.glider.root.scale.toArray(), [1, 1, 1]);
    // Stale input cannot resurrect an unowned rifle or aim/facing ownership.
    animator.prepareShot(new THREE.Vector3(-1, .4, 0));
    assert.equal(rig.joints.Gun.visible, false); assert.equal(animator.facing, .7);
    const positions: number[][] = [];
    for (let i = 0; i < hz; i++) {
      animator.update(1 / hz, { ...base, armed: false, speed: 5.5, firing: true, aim: 1, lookYaw: -1 });
      assert.equal(rig.joints.Gun.visible, false); assert.equal(rig.diagnostics.mode, 'unarmed');
      const local = (side: 'R' | 'L') => rig.root.worldToLocal(point(rig, side));
      positions.push([local('R').z, local('L').z]);
      for (const bone of Object.values(rig.bones)) assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
    }
    for (const side of [0, 1]) assert.ok(Math.max(...positions.map(p => p[side])) - Math.min(...positions.map(p => p[side])) > .15);
    for (let i = 0; i < hz * 2; i++) animator.update(1 / hz, { ...base, armed: false, speed: 8, gliding: true, onGround: false, vy: -2 });
    assert.equal(rig.glider.root.visible, true); assert.equal(rig.joints.Gun.visible, false);
    for (const side of ['R', 'L'] as const) assert.ok(point(rig, side).distanceTo(rig.glider.grips[side].getWorldPosition(new THREE.Vector3())) < .002);
    animator.reset(false, 0);
    assert.equal(rig.glider.root.visible, false);
    for (let i = 0; i < hz * 2; i++) animator.update(1 / hz, { ...base, armed: true });
    assert.equal(rig.joints.Gun.visible, true); assert.ok(contact(rig, 'R') < .002 && contact(rig, 'L') < .002);
  }
  f.dispose();
});
