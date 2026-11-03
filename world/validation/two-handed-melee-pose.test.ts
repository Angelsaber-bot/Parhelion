/** Polearm and hammer use their own two-handed arcs on the real player rig and authored GLBs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { playerFixture, parseLocalGlb } from './player-fixture';
import { SkinnedCharacterAnimator, POLEARM_LEAD, HAMMER_SUPPORT } from '../src/skinnedCharacter';
import { attachExplorerBlade } from '../src/playerBladeArt';
import { MELEE_BEATS, PlayerMelee } from '../src/playerMelee';
import { worldMelee } from '../src/worldArsenal';
const base = { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: 0 };
const v = () => new THREE.Vector3();
const GLB = { polearm: '07_Meteor_Polearm.glb', hammer: '08_Faultline_Hammer.glb' } as const;
async function fixture(style: keyof typeof GLB) {
  const f = await playerFixture();
  const art = attachExplorerBlade(f.rig, () => parseLocalGlb(new URL(`../../assets/weapons/glb/${GLB[style]}`, import.meta.url)), style);
  await art.ready;
  return { ...f, art, dispose() { art.dispose(); f.dispose(); } };
}
const axis = (rig: { handSockets: Record<'R' | 'L', THREE.Object3D> }) => {
  const s = rig.handSockets.R; s.updateWorldMatrix(true, false);
  return s.localToWorld(new THREE.Vector3(0, -.03, 1)).sub(s.localToWorld(new THREE.Vector3(0, -.03, 0))).normalize();
};

for (const style of ['polearm', 'hammer'] as const) {
  test(`${style}: both hands stay on the shaft, inside reach, feet planted, through all three beats`, async t => {
    const f = await fixture(style), a = new SkinnedCharacterAnimator(f.rig);
    let maxReach = 0, maxShaft = 0, maxFoot = 0;
    for (const combo of [0, 1, 2]) {
      a.reset(true); for (let i = 0; i < 60; i++) a.update(1 / 120, base);
      for (let i = 0; i <= 120; i++) {
        a.update(1 / 120, { ...base, melee: { phase: i / 120, combo, yaw: 0, style } });
        assert.deepEqual(f.rig.root.position.toArray(), [0, 0, 0]);
        assert.ok(f.rig.root.matrixWorld.elements.every(Number.isFinite));
        maxReach = Math.max(maxReach, f.rig.diagnostics.armReachError.R, f.rig.diagnostics.armReachError.L);
        if (combo > 0 || i > 24) {
          const s = f.rig.handSockets.R, d = style === 'polearm' ? POLEARM_LEAD : HAMMER_SUPPORT;
          const shaft = s.localToWorld(new THREE.Vector3(0, -.03, d));
          maxShaft = Math.max(maxShaft, f.rig.handSockets.L.getWorldPosition(v()).distanceTo(shaft));
        }
        for (const side of ['R', 'L'] as const) {
          const foot = f.rig.joints[`Foot_${side}`] as THREE.Bone;
          const drift = foot.getWorldPosition(v()).distanceTo(f.rig.rest.get(foot)!.rootP);
          maxFoot = Math.max(maxFoot, drift);
        }
      }
    }
    t.diagnostic(JSON.stringify({ maxReach, maxShaft, maxFoot }));
    assert.ok(maxReach < .03, 'both arms reach their targets');
    assert.ok(maxShaft < .08, 'the support hand closes on the shaft');
    assert.ok(maxFoot < .01, 'feet stay planted');
    f.dispose();
  });

  test(`${style}: the weapon crosses in front at the damage frame and moves smoothly through a queued combo`, async t => {
    const f = await fixture(style), a = new SkinnedCharacterAnimator(f.rig);
    for (let i = 0; i < 60; i++) a.update(1 / 120, base);
    for (const combo of [0, 1, 2]) {
      const phase = MELEE_BEATS[combo].contact / MELEE_BEATS[combo].duration;
      a.update(1 / 120, { ...base, melee: { phase, combo, yaw: 0, style } });
      const dir = axis(f.rig), hand = f.rig.handSockets.R.getWorldPosition(v());
      assert.ok(dir.z > .25, `${style} cut ${combo} points ahead at contact (${dir.toArray().map(n => n.toFixed(2))})`);
      assert.ok(hand.z > .1, 'and the hands are out in front');
    }
    const m = new PlayerMelee(); m.style = worldMelee(style)!;
    a.reset(true); for (let i = 0; i < 60; i++) a.update(1 / 120, base);
    m.press(0); let previous: THREE.Quaternion | undefined, maxStep = 0, transitions = 0, last = 0;
    for (let frame = 0; frame < 500; frame++) {
      if (m.active && m.phase > .6) m.press(0);
      m.update(1 / 120, true);
      a.update(1 / 120, { ...base, melee: m.active ? { phase: m.phase, combo: m.combo, yaw: 0, style: m.style.id } : undefined });
      f.art.update(m.active);
      const q = f.rig.handSockets.R.getWorldQuaternion(new THREE.Quaternion());
      // What the player sees: the weapon is drawn (art visible). The hidden draw-in is the blade's.
      if (previous && f.art.root.visible) maxStep = Math.max(maxStep, q.angleTo(previous)); previous = q;
      if (m.active && m.combo !== last) { transitions++; last = m.combo; }
    }
    t.diagnostic(JSON.stringify({ maxFrameDegrees: THREE.MathUtils.radToDeg(maxStep) }));
    assert.equal(transitions, 2); assert.ok(maxStep < .3, 'no snapping between frames or beats');
    assert.notEqual(f.rig.diagnostics.mode, 'melee', 'recovers to locomotion');
    f.dispose();
  });
}

test('the hammer slam visibly winds up overhead and the polearm lunge reaches past the blade', async () => {
  const f = await fixture('hammer'), a = new SkinnedCharacterAnimator(f.rig);
  for (let i = 0; i < 60; i++) a.update(1 / 120, base);
  a.update(1 / 120, { ...base, melee: { phase: .28, combo: 2, yaw: 0, style: 'hammer' } });
  const head = f.rig.joints.Head.getWorldPosition(v()).y;
  assert.ok(f.rig.handSockets.R.getWorldPosition(v()).y > head, 'hands above the head before the slam');
  assert.ok(axis(f.rig).y > .5, 'head of the hammer raised');
  f.dispose();
  const p = await fixture('polearm'), b = new SkinnedCharacterAnimator(p.rig);
  for (let i = 0; i < 60; i++) b.update(1 / 120, base);
  const phase = MELEE_BEATS[2].contact / MELEE_BEATS[2].duration;
  b.update(1 / 120, { ...base, melee: { phase, combo: 2, yaw: 0 } });
  const blade = p.rig.handSockets.R.getWorldPosition(v()).z;
  b.update(1 / 120, { ...base, melee: { phase, combo: 2, yaw: 0, style: 'polearm' } });
  assert.ok(p.rig.handSockets.L.getWorldPosition(v()).z > blade + .1, 'the lead hand drives further out than the sword hand');
  const tip = p.rig.handSockets.R.localToWorld(new THREE.Vector3(0, -.03, 1.3));
  assert.ok(tip.z > 1.3 && Math.abs(tip.y - p.rig.joints.Chest.getWorldPosition(v()).y) < .45, `spearhead out front at chest height (${tip.toArray().map(n => n.toFixed(2))})`);
  p.dispose();
});
