/** Defeat dissolve: fixed capacity, one draw, presentation only, slots recycle. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { DefeatEffects, DEFEAT_FX } from '../src/combat/defeatEffects.ts';
import { readFileSync } from 'node:fs';

test('a defeat bursts into rising motes and a ground ring, then goes idle', () => {
  const parent = new THREE.Group(), fx = new DefeatEffects(parent);
  let draws = 0; parent.traverse(o => { if ((o as THREE.Points).isPoints) draws++; }); assert.equal(draws, 1);
  const slot = fx.emit({ x: 3, y: 1, z: -2 }, 0xffe3a0);
  assert.equal(slot, 0); assert.equal(fx.age(slot), 0);
  const g = fx.points.geometry, pos = g.getAttribute('position'), vel = g.getAttribute('aVel');
  const per = DEFEAT_FX.motes + DEFEAT_FX.ring;
  for (let i = 0; i < per; i++) {
    assert.ok(Math.hypot(pos.getX(i) - 3, pos.getZ(i) + 2) < .5, 'starts on the body');
    assert.ok(pos.getY(i) >= 1 && pos.getY(i) < 3.2);
    if (i < DEFEAT_FX.motes) assert.ok(vel.getY(i) > .5, 'motes rise'); else assert.ok(Math.hypot(vel.getX(i), vel.getZ(i)) > 3, 'ring runs outward');
  }
  for (let t = 0; t < 2; t += .1) fx.update(.1, 1080);
  assert.ok(fx.age(slot) > DEFEAT_FX.life, 'finished');
  // Slots recycle at a fixed capacity; bad input is refused.
  for (let i = 0; i < DEFEAT_FX.slots + 2; i++) fx.emit({ x: i, y: 0, z: 0 }, 0xffffff, 1.7);
  assert.equal(g.getAttribute('position').count, DEFEAT_FX.slots * per);
  assert.equal(fx.emit({ x: NaN, y: 0, z: 0 }, 0xffffff), -1);
  assert.equal(fx.emit({ x: 0, y: 0, z: 0 }, 0xffffff, 0), -1);
  fx.clear(); assert.equal(fx.age(0), Infinity);
  fx.dispose(); fx.dispose(); assert.equal(parent.children.length, 0);
});

test('the combat view bursts every kill in the right colour and scale', () => {
  const src = readFileSync(new URL('../src/combat/combatView.ts', import.meta.url), 'utf8');
  const kill = src.slice(src.indexOf("event.type === 'kill'"), src.indexOf('this.options.onKill?.(event.id)'));
  assert.match(kill, /this\.defeatEffects\.emit\(fallen\.p/);
  assert.match(kill, /elite\.colors\[2\]/); assert.match(kill, /kind === 'king' \? 1\.7/);
  assert.match(src, /this\.defeatEffects\.dispose\(\)/);
});
