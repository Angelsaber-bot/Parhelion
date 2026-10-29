import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AvatarMotion, ViewmodelStride } from '../src/characterMotion.ts';
import { buildFighter, FighterAnimator } from '../src/fighter.ts';

const make = () => { const rig = buildFighter(1, 0x4fd6e0); return { rig, anim: new FighterAnimator(rig) }; };
const pose = (rig: ReturnType<typeof buildFighter>) => Object.fromEntries(Object.entries(rig.joints).map(([key, joint]) => [key, [...joint.position.toArray(), ...joint.quaternion.toArray()]]));

describe('interpolated avatar motion', () => {
  it('resolves forward, back and strafe relative to the rendered facing, not world axes', () => {
    const m = new AvatarMotion();
    m.sample([0, 0, 0], 0, 1 / 60);
    const result = m.sample([0, 0, -.1], 0, 1 / 60);
    expect(result.forward).toBeGreaterThan(0); expect(result.strafe).toBeCloseTo(0);
    // Changing facing changes the basis without inventing speed.
    const speed = result.speed;
    m.sample([0, 0, -.1], Math.PI / 2, 0);
    expect(result.strafe).toBeCloseTo(speed); expect(result.forward).toBeCloseTo(0);
    m.sample([0, 0, -.1], Math.PI, 0);
    expect(result.forward).toBeCloseTo(-speed);
  });
  it('rejects teleports, long suspension and stale previous-round velocity; normal dash remains motion', () => {
    const m = new AvatarMotion(); m.sample([0, 0, 0], 0, 1 / 60);
    expect(m.sample([0, 0, -.3], 0, 1 / 60).speed).toBeGreaterThan(0);
    expect(m.state.discontinuity).toBe(false);
    expect(m.sample([20, 4, 20], 0, 1 / 60)).toMatchObject({ speed: 0, vy: 0, discontinuity: true });
    expect(m.sample([20, 4, 20.1], 0, 2)).toMatchObject({ speed: 0, vy: 0, discontinuity: true });
    m.reset(); expect(m.sample([-10, 0, 7], 0, 1 / 60)).toMatchObject({ speed: 0, vy: 0, discontinuity: false });
  });
  it('keeps constant-velocity filtering independent of render cadence', () => {
    const speeds = [30, 60, 144].map((hz) => {
      const m = new AvatarMotion(); m.sample([0, 0, 0], 0, 1 / hz);
      for (let i = 1; i <= hz; i++) m.sample([0, 0, -5 * i / hz], 0, 1 / hz);
      return m.state.speed;
    });
    speeds.forEach((speed) => expect(speed).toBeCloseTo(speeds[0], 10));
  });
});

describe('actual procedural fighter rig', () => {
  it('does not resume a run at jump apex, and does not jump while climbing a grounded ramp', () => {
    const apex = make(), ramp = make();
    for (let i = 0; i < 90; i++) {
      apex.anim.update(1 / 60, 5, 0, false, false, 5, 0);
      ramp.anim.update(1 / 60, 5, 3, false, true, 5, 0);
    }
    expect(apex.rig.joints.Thigh_L.rotation.x).toBeCloseTo(apex.rig.joints.Thigh_R.rotation.x, 5);
    expect(apex.rig.joints.Shin_L.rotation.x).toBeCloseTo(-.45, 5);
    expect(Math.abs(ramp.rig.joints.Thigh_L.rotation.x - ramp.rig.joints.Thigh_R.rotation.x)).toBeGreaterThan(.1);
  });
  it('uses a lateral step for strafing and a smaller reversed stride for backpedalling', () => {
    const forward = make(), back = make(), side = make();
    for (let i = 0; i < 13; i++) {
      forward.anim.update(1 / 60, 5, 0, false, true, 5, 0);
      back.anim.update(1 / 60, 5, 0, false, true, -5, 0);
      side.anim.update(1 / 60, 5, 0, false, true, 0, 5);
    }
    expect(back.rig.joints.Thigh_L.rotation.x).toBeCloseTo(-forward.rig.joints.Thigh_L.rotation.x * .72);
    expect(side.rig.joints.Thigh_L.rotation.x).toBeCloseTo(0);
    expect(Math.abs(side.rig.joints.Thigh_L.rotation.z)).toBeGreaterThan(.01);
    // Aim pivot yaw is not driven by lower-body direction.
    expect(side.rig.aim.rotation.y).toBe(0);
  });
  it('side-step feet retain their left/right order throughout the full gait instead of crossing', () => {
    for (const direction of [-1, 1]) {
      const { rig, anim } = make(), inverseHips = new THREE.Matrix4();
      const left = new THREE.Vector3(), right = new THREE.Vector3();
      for (let i = 0; i < 120; i++) {
        anim.update(1 / 60, 5.5, 0, false, true, 0, direction * 5.5);
        rig.root.updateMatrixWorld(true); inverseHips.copy(rig.joints.Hips.matrixWorld).invert();
        left.set(0, -.42, -.04).applyMatrix4(rig.joints.Shin_L.matrixWorld).applyMatrix4(inverseHips);
        right.set(0, -.42, -.04).applyMatrix4(rig.joints.Shin_R.matrixWorld).applyMatrix4(inverseHips);
        expect(right.x - left.x).toBeGreaterThan(.1);
      }
    }
  });
  it('reset removes crouch, air, gait, landing and melee residue, including an airborne crouched spawn', () => {
    const old = make(), fresh = make();
    for (let i = 0; i < 60; i++) old.anim.update(1 / 60, 5, -4, true, false, 3, 4);
    old.anim.melee(.75, 0, 7);
    old.anim.reset(); fresh.anim.reset();
    expect(pose(old.rig)).toEqual(pose(fresh.rig));
    old.anim.reset(true, false); fresh.anim.reset(true, false);
    expect(pose(old.rig)).toEqual(pose(fresh.rig));
    expect(old.rig.aim.position.y).toBeCloseTo(.69);
  });
  it('keeps all actual joint matrices finite through crouch/jump/land/reversal and repeated resets', () => {
    const { rig, anim } = make();
    for (let i = 0; i < 360; i++) {
      const grounded = i % 90 < 45;
      anim.update(1 / 60, 5, grounded ? 0 : Math.sin(i / 10) * 6, i % 120 < 60, grounded, Math.sin(i / 20) * 5, Math.cos(i / 20) * 5);
      if (i % 120 === 119) anim.reset();
      rig.root.updateMatrixWorld(true);
      rig.root.traverse((o: THREE.Object3D) => expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true));
    }
  });
});

describe('FPS bob envelope', () => {
  it('eases start/stop instead of popping and resets for rematches', () => {
    const stride = new ViewmodelStride(); stride.update(1 / 60, 1);
    expect(stride.weight).toBeGreaterThan(0); expect(stride.weight).toBeLessThan(.2);
    const previous = stride.weight; stride.update(1 / 60, 0);
    expect(stride.weight).toBeGreaterThan(0); expect(stride.weight).toBeLessThan(previous);
    stride.reset(); expect(stride.weight).toBe(0); expect(stride.phase).toBe(0);
  });
  it('has the same amplitude and phase at 30/60/144 Hz, and rejects invalid input', () => {
    const values = [30, 60, 144].map((hz) => {
      const stride = new ViewmodelStride();
      for (let i = 0; i < hz; i++) stride.update(1 / hz, 1);
      for (let i = 0; i < hz; i++) stride.update(1 / hz, 0);
      return [stride.weight, stride.phase];
    });
    for (const [weight, phase] of values) { expect(weight).toBeCloseTo(values[0][0], 12); expect(phase).toBeCloseTo(values[0][1], 12); }
    const stride = new ViewmodelStride(); stride.update(NaN, Infinity);
    expect(stride.weight).toBe(0); expect(stride.phase).toBe(0);
  });
});
