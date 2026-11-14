import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldCombatState, CROW_SHADOWS, crowLampOut, crowShadowAt } from '../src/combat/combat';
import { bossAttackTiming } from '../src/combat/bossPatterns';
import { createCrowShadowVisual, createLampOutSoot, crowSilhouetteGeometry, lampOutCue, SHADOW_LOOK } from '../src/combat/crowShadowVisual';

function seal() {
  const s = new WorldCombatState([], { id: 'boss_hellfire_lord', kind: 'king', p: { x: 0, y: 0, z: 0 }, requires: [] });
  assert.equal(s.beginBoss(new Set(), 'boss_hellfire_lord'), true);
  const b = s.boss; b.active = true; b.squareYaw = 0; b.phase = 2; b.mode = 'chase'; b.attackCount = 1; b.hp = b.maxHp * .6;
  const step = (dt: number, p = { x: 0, y: 0, z: 9 }) => (s as unknown as { stepCrowSeal(dt: number, p: unknown): void }).stepCrowSeal(dt, p);
  return { s, b, step };
}

test('the false shadow stands beside him on alternating sides, facing as he faces', () => {
  const left = crowShadowAt({ p: { x: 10, y: 2, z: 5 }, attackCount: 2 }, 0), right = crowShadowAt({ p: { x: 10, y: 2, z: 5 }, attackCount: 3 }, 0);
  assert.equal(left.side, -1); assert.equal(right.side, 1);
  assert.ok(Math.abs(left.x - (10 - CROW_SHADOWS.side)) < 1e-9 && Math.abs(right.x - (10 + CROW_SHADOWS.side)) < 1e-9);
  assert.ok(Math.abs(left.z - (5 + CROW_SHADOWS.forward)) < 1e-9 && left.y === 2);
  const turned = crowShadowAt({ p: { x: 0, y: 0, z: 0 }, attackCount: 3 }, Math.PI / 2);
  assert.ok(Math.abs(turned.z + CROW_SHADOWS.side) < 1e-9, 'turns with him');
  // Never overlapping the real hit volume (king radius 1.45): his own outline still takes every centred shot.
  assert.ok(CROW_SHADOWS.side - CROW_SHADOWS.radius > 1.45);
});

test('only phase two throws a shadow, and a reset clears it', () => {
  const { s, b, step } = seal();
  b.phase = 1; step(.05); assert.equal(s.crowShadow, null);
  b.phase = 2; step(.05); assert.ok(s.crowShadow);
  b.mode = 'recover'; step(.05); assert.equal(s.crowShadow, null, 'not while he recovers: the punish window is clean');
  b.mode = 'windup'; step(.05); assert.ok(s.crowShadow);
  s.resetBoss(); assert.equal(s.crowShadow, null);
});

test('a round into the shadow is stopped, tears it and deals no damage; blades ignore it', () => {
  const { s, b, step } = seal(); step(.05);
  const sh = s.crowShadow!, from = { x: sh.x, y: sh.y + CROW_SHADOWS.height, z: sh.z + 9 };
  const hit = s.raycast(from, { x: 0, y: 0, z: -1 }, 60)!;
  assert.equal(hit.id, b.id); assert.equal(hit.decoy, true); assert.equal(hit.precise, false);
  const hp = b.hp; s.drainEvents();
  assert.equal(s.hitEnemy(hit.id, 30, { source: 'ranged', origin: from, precise: hit.precise, decoy: hit.decoy }), true);
  assert.equal(b.hp, hp, 'paper takes the round');
  const ev = s.drainEvents(); assert.ok(ev.some(e => e.type === 'crowShadowTorn')); assert.ok(!ev.some(e => e.type === 'hit'));
  assert.equal(s.crowShadow, null);
  // Torn for a few seconds, then thrown again.
  step(CROW_SHADOWS.torn - .1); assert.equal(s.crowShadow, null);
  step(.2); assert.ok(s.crowShadow);
  // A centred shot at him is never eaten by the shadow.
  const real = s.raycast({ x: 0, y: 1.8, z: 12 }, { x: 0, y: 0, z: -1 }, 60)!;
  assert.equal(real.decoy, undefined); assert.equal(real.id, b.id);
  // A decoy flag without a standing shadow (stale) is an ordinary hit, and melee never tears it.
  const before = b.hp; s.hitEnemy(b.id, 10, { source: 'melee', decoy: true }); assert.ok(b.hp < before);
  assert.ok(s.crowShadow, 'a blade does not tear the screen');
});

test('a wall between the gun and the shadow still wins (maxDistance)', () => {
  const { s, step } = seal(); step(.05);
  const sh = s.crowShadow!, from = { x: sh.x, y: sh.y + CROW_SHADOWS.height, z: sh.z + 9 };
  assert.equal(s.raycast(from, { x: 0, y: 0, z: -1 }, 5), null);
});

test('lamp-out: every fourth beat above 30 %, the beat recovers longer', () => {
  const { b } = seal();
  b.mode = 'windup'; b.attackCount = 4; assert.equal(crowLampOut(b), true);
  b.attackCount = 5; assert.equal(crowLampOut(b), false);
  b.attackCount = 8; b.hp = b.maxHp * .25; assert.equal(crowLampOut(b), false, 'the curtain phase takes over below 30 %');
  b.hp = b.maxHp * .6; b.phase = 1; assert.equal(crowLampOut(b), false);
  b.phase = 2; b.mode = 'chase'; assert.equal(crowLampOut(b), false);
});

test('lamp-out recovery is the normal recovery plus the stumble', () => {
  const s = new WorldCombatState([], { id: 'boss_hellfire_lord', kind: 'king', p: { x: 0, y: 0, z: 0 }, requires: [] });
  s.beginBoss(new Set(), 'boss_hellfire_lord');
  const b = s.boss; b.active = true; b.phase = 2; b.hp = b.maxHp * .6; b.squareYaw = 0;
  const recoverAfter = (count: number) => {
    b.mode = 'windup'; b.attackCount = count; b.attack = 'sweep'; b.timer = 0.0001; b.p = { x: 0, y: 0, z: 0 }; Object.assign(b.target, { x: 0, y: 0, z: 30 });
    (s as unknown as { hurtCooldown: number }).hurtCooldown = 9;
    s.step(.016, { x: 0, y: 0, z: 30 }, true, { walk: (_f, x, z) => ({ x, y: 0, z }), lineOfSight: () => true }); assert.equal(b.mode, 'recover');
    return b.timer + .016;
  };
  const dark = recoverAfter(4), normal = recoverAfter(7);
  const base4 = bossAttackTiming({ ...b, attackCount: 4 }).recovery, base7 = bossAttackTiming({ ...b, attackCount: 7 }).recovery;
  assert.ok(Math.abs(dark - (base4 + CROW_SHADOWS.lampRecover)) < .02, `${dark} vs ${base4}`);
  assert.ok(Math.abs(normal - base7) < .02);
});

test('lamp-out cue: ring stays faint, the glint is the timing cue and peaks at the cut', () => {
  assert.ok(lampOutCue(0).ring < .15 && lampOutCue(1).ring < .25);
  assert.ok(lampOutCue(1).glint === 1 && lampOutCue(.5).glint < lampOutCue(.9).glint && lampOutCue(0).glint > 0);
});

test('shadow visual: a samurai silhouette on a screen that tears into falling shreds', () => {
  const fig = crowSilhouetteGeometry(); fig.computeBoundingBox(); const box = fig.boundingBox!;
  assert.ok(box.max.y > 3 && Math.abs(box.min.y) < 1e-6, 'raised blade above the helm, feet on the floor');
  assert.ok(box.max.x - box.min.x > 1.6 && box.max.z - box.min.z < 1e-6, 'flat, wide stance');
  assert.ok(fig.getAttribute('position').count < 400, 'cheap: one merged flat mesh'); fig.dispose();
  const parent = new THREE.Group(), v = createCrowShadowVisual(parent);
  v.update(.1, null, false); assert.equal(v.root.visible, false);
  const at = { x: 3, y: 0, z: 4, yaw: .5, side: 1 as const };
  v.update(.3, at, false); assert.equal(v.root.visible, true); assert.ok(Math.abs(v.root.position.x - 3) < 1e-9 && Math.abs(v.root.rotation.y - .5) < 1e-9);
  v.tear({ x: 3, y: 1.5, z: 4 }); assert.equal(v.root.visible, false); assert.equal(v.tearing, true);
  const start = new THREE.Matrix4(); v.update(.05, null, false); v.shreds.getMatrixAt(0, start);
  for (let i = 0; i < 10; i++) v.update(.05, null, false);
  const later = new THREE.Matrix4(); v.shreds.getMatrixAt(0, later);
  assert.ok(new THREE.Vector3().setFromMatrixPosition(later).y < new THREE.Vector3().setFromMatrixPosition(start).y + .5, 'shreds fall');
  v.update(SHADOW_LOOK.shredLife, null, false); assert.equal(v.tearing, false); assert.equal(v.shreds.visible, false);
  v.dispose(); assert.equal(parent.children.length, 0);
});

test('lamp-out soot fades in around him and away after, never a dome over the arena', () => {
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const soot = createLampOutSoot(geos, mats);
  soot.update(.1, false); assert.equal(soot.root.visible, false);
  soot.update(.1, true); assert.ok(soot.root.visible && soot.strength > 0 && soot.strength < 1, 'fades in');
  soot.update(1, true); assert.equal(soot.strength, 1);
  const box = new THREE.Box3().setFromObject(soot.root);
  assert.ok(box.max.y < 4.5, 'low smoke, not a dome'); assert.ok(box.max.x < 6 && box.min.x > -6);
  soot.update(.3, false); assert.ok(soot.root.visible && soot.strength < 1, 'lingers briefly');
  soot.update(1, false); assert.equal(soot.root.visible, false);
  assert.ok(geos.length >= 4 && mats.length >= 4, 'owner pools take its resources');
  soot.dispose();
});
