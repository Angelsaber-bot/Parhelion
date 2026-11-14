import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FootDust, FOOT_DUST, DUST_LOOK, dustSurface, strideLength, landingPuffs } from '../src/player/footDust';

const state = (over: Partial<{ pos: THREE.Vector3; vel: THREE.Vector3; onGround: boolean; swimming: boolean; gliding: boolean; flying: boolean }> = {}) =>
  ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), onGround: true, swimming: false, gliding: false, flying: false, ...over });

test('the ground under the feet: region decides the dust, wading always splashes', () => {
  assert.equal(dustSurface('winter', -3), 'snow'); assert.equal(dustSurface('egypt', -1), 'sand'); assert.equal(dustSurface('kyoto', 0), 'ash');
  assert.equal(dustSurface('home', -.2), 'stone'); assert.equal(dustSurface('somewhere-new', 0), 'earth');
  assert.equal(dustSurface('egypt', .3), 'water'); assert.equal(dustSurface('winter', FOOT_DUST.wadeMax + .1), 'snow', 'swimming depth is not a footstep');
  assert.ok(DUST_LOOK.water.gravity > DUST_LOOK.snow.gravity && DUST_LOOK.snow.gravity > DUST_LOOK.ash.gravity, 'droplets fall, snow settles, ash hangs');
});

test('stride and landing sizes', () => {
  assert.equal(strideLength(2), FOOT_DUST.strideWalk); assert.equal(strideLength(20), FOOT_DUST.strideSprint);
  assert.ok(strideLength(7) > FOOT_DUST.strideWalk && strideLength(7) < FOOT_DUST.strideSprint);
  assert.equal(landingPuffs(3), 0, 'a step off a kerb raises nothing'); assert.equal(landingPuffs(NaN), 0);
  assert.ok(landingPuffs(FOOT_DUST.landMin) >= 6 && landingPuffs(40) === 16 && landingPuffs(12) > landingPuffs(6));
});

test('walking puffs once per stride from alternating feet; standing still raises nothing', () => {
  const d = new FootDust(), s = state();
  for (let i = 0; i <= 60; i++) { d.update(1 / 60, s, 'earth'); s.pos.z += 4.5 / 60; }
  const strides = Math.floor(4.5 / FOOT_DUST.strideWalk);
  assert.equal(d.emitted, strides * 3, `${strides} strides, three puffs each`);
  assert.equal(d.mesh.visible, true);
  const before = d.emitted;
  for (let i = 0; i < 90; i++) d.update(1 / 60, s, 'earth');
  assert.equal(d.emitted, before); assert.equal(d.mesh.visible, false, 'every puff has thinned away');
  d.dispose();
});

test('sprinting throws more per stride; gliding, swimming and flying throw none', () => {
  const run = new FootDust(), s = state();
  for (let i = 0; i <= 60; i++) { run.update(1 / 60, s, 'sand'); s.pos.x += 9 / 60; }
  assert.equal(run.emitted, Math.floor(9 / FOOT_DUST.strideSprint) * 4);
  for (const over of [{ gliding: true, onGround: false }, { swimming: true }, { flying: true }]) {
    const d = new FootDust(), q = state(over);
    for (let i = 0; i < 60; i++) { d.update(1 / 60, q, 'earth'); q.pos.x += 9 / 60; }
    assert.equal(d.emitted, 0, JSON.stringify(over)); d.dispose();
  }
  run.dispose();
});

test('a hard landing throws a ring sized by the fall; a soft one does not; take-off kicks', () => {
  const d = new FootDust(), s = state();
  d.update(.016, s, 'earth');
  s.onGround = false; s.vel.y = 8; d.update(.016, s, 'earth'); assert.equal(d.emitted, 5, 'jump kick');
  s.vel.y = -14; d.update(.016, s, 'earth');
  s.onGround = true; s.vel.y = 0; d.update(.016, s, 'snow');
  assert.equal(d.emitted, 5 + landingPuffs(14));
  // A soft drop afterwards: nothing.
  const base = d.emitted; s.onGround = false; s.vel.y = -2; d.update(.016, s, 'earth'); s.onGround = true; s.vel.y = 0; d.update(.016, s, 'earth');
  assert.equal(d.emitted, base);
  // Disabled (paused, reduced effects) ages puffs but never emits, and clear() forgets the fall.
  s.onGround = false; s.vel.y = -20; d.update(.016, s, 'earth', false); d.clear(); s.onGround = true; d.update(.016, s, 'earth');
  assert.equal(d.emitted, base, 'a teleport is not a landing');
  d.dispose();
});

test('puffs rise, spread and shrink to nothing inside their life; the pool never grows', () => {
  const d = new FootDust(), at = new THREE.Vector3(5, 2, 5);
  d.burst(at, 12, 'earth'); const s = state({ pos: at.clone() });
  d.update(.1, s, 'earth');
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  d.mesh.getMatrixAt(0, m); m.decompose(p, q, sc);
  assert.ok(sc.x > 0 && p.y > 2 && Math.hypot(p.x - 5, p.z - 5) > .18, 'moving outward and up');
  for (let i = 0; i < 10; i++) d.update(.1, s, 'earth');
  d.mesh.getMatrixAt(0, m); assert.ok(m.elements[0] === 0 && m.elements[5] === 0 && m.elements[10] === 0, 'shrunk to nothing');
  d.burst(at, 500, 'water'); assert.equal(d.mesh.count, FOOT_DUST.pool);
  d.dispose();
});

test('ground speed comes from the feet, not the vertical-only velocity; a teleport is not a stride', () => {
  const d = new FootDust(), s = state();
  d.update(1 / 60, s, 'earth'); s.pos.x += 300; d.update(1 / 60, s, 'earth');
  assert.equal(d.emitted, 0, 'an impossible speed is ignored');
  d.clear(); d.update(1 / 60, s, 'earth'); s.pos.x += 2; d.update(.5, s, 'earth');
  assert.equal(d.emitted, 3, 'two metres at walking pace: one stride');
  d.dispose();
});

test('a bullet impact sprays chips back off the surface, toward the shooter', () => {
  const d = new FootDust(), at = new THREE.Vector3(10, 1.5, 10), back = new THREE.Vector3(0, 0, 1);
  d.impact(at, back, 'stone', 4); assert.equal(d.emitted, 4); assert.equal(d.mesh.visible, true);
  d.update(.1, state({ pos: new THREE.Vector3(0, 0, 0) }), 'earth');
  const m = new THREE.Matrix4(); let ahead = 0;
  for (let i = 0; i < 4; i++) { d.mesh.getMatrixAt(i, m); if (m.elements[14] > 10) ahead++; }
  assert.equal(ahead, 4, 'every chip leaves on the shooter\'s side of the wall');
  // Straight down onto a floor: the spray axes are still well defined.
  d.impact(at, new THREE.Vector3(0, 1, 0), 'sand', 3); d.update(.05, state(), 'earth');
  for (let i = 4; i < 7; i++) { d.mesh.getMatrixAt(i, m); assert.ok(Number.isFinite(m.elements[12]) && m.elements[13] > 1.5); }
  d.dispose();
});
