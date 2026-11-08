/** Ambient life is decoration: bounded cost, era-specific, recycled around the player, never in the way. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createAmbientLife, AMBIENT_LIFE, REGION_LIFE } from '../src/environment/ambientLife.ts';

const hills = (x: number, z: number) => Math.sin(x * .05) * 3 + Math.cos(z * .04) * 2;
const draws = (root: THREE.Object3D) => { let n = 0; root.traverse(o => { if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints) n++; }); return n; };

test('each era has its own mix, within fixed caps and three draw calls', () => {
  const kinds = new Set<string>();
  for (const region of ['alpha', 'britain', 'blacksail', 'winter', 'kyoto'] as const) {
    const life = createAmbientLife({ terrain: hills, waterLevel: -100 }, 3);
    life.update(.016, new THREE.Vector3(0, 0, 0), region, true);
    const c = life.counts, want = REGION_LIFE[region];
    assert.ok(c.butterflies <= AMBIENT_LIFE.maxButterflies && c.birds <= AMBIENT_LIFE.maxBirds && c.fireflies <= AMBIENT_LIFE.maxFireflies);
    assert.equal(c.butterflies, want.butterflies, region); assert.equal(c.birds, want.birds, region); assert.equal(c.fireflies, want.fireflies, region);
    assert.equal(draws(life.root), 3);
    life.root.traverse(o => { if ((o as THREE.Mesh).isMesh) assert.equal((o as THREE.Mesh).castShadow, false); });
    kinds.add(JSON.stringify([want.butterflies > 0, want.birdColor, want.fireflies > 0, want.overWater]));
    life.dispose();
  }
  assert.equal(kinds.size, 5, 'no two eras share the same life');
  assert.equal(REGION_LIFE.winter.butterflies, 0, 'no butterflies on the winter road');
  assert.ok(REGION_LIFE.kyoto.fireflies > REGION_LIFE.alpha.fireflies, 'Kyoto has the fireflies');
  assert.ok(REGION_LIFE.blacksail.overWater, 'gulls keep to the sea');
});

test('creatures stay around a moving player, above the ground, and finite', () => {
  const life = createAmbientLife({ terrain: hills, waterLevel: -100 }, 11), p = new THREE.Vector3();
  for (let i = 0; i < 1200; i++) { p.x += .25; p.z += .1; life.update(1 / 30, p, 'britain', true); }
  const all = [...life.creatures.butterflies, ...life.creatures.birds, ...life.creatures.fireflies];
  for (const c of all) {
    assert.ok([c.x, c.y, c.z].every(Number.isFinite));
    assert.ok(Math.hypot(c.x - p.x, c.z - p.z) < AMBIENT_LIFE.radius * 1.7, 'recycled near the player');
    assert.ok(c.y >= hills(c.x, c.z) - .05, 'never under the ground');
  }
  for (const c of life.creatures.butterflies) assert.ok(c.y - hills(c.x, c.z) < 6, 'butterflies stay low');
  life.update(NaN, p, 'britain', true); life.update(-1, p, 'britain', true);
  for (const c of all) assert.ok([c.x, c.y, c.z].every(Number.isFinite));
  life.dispose(); life.dispose();
});

test('a perched bird bursts into the air when the player walks up, then circles', () => {
  const life = createAmbientLife({ terrain: () => 0, waterLevel: -100 }, 5), far = new THREE.Vector3(0, 0, 0);
  life.update(.016, far, 'winter', true);
  const bird = life.creatures.birds[0];
  bird.mode = 0; bird.x = 10; bird.z = 0; bird.y = 0;
  life.update(.05, far, 'winter', true); assert.equal(bird.mode, 0, 'stays put while the player is away');
  const near = new THREE.Vector3(8, 0, 0);
  life.update(.05, near, 'winter', true); assert.equal(bird.mode, 2, 'takes off');
  const startY = bird.y; for (let i = 0; i < 20; i++) life.update(.05, near, 'winter', true);
  assert.ok(bird.y > startY + 3, 'climbs'); assert.ok(bird.x > 10, 'away from the player');
  for (let i = 0; i < 60; i++) life.update(.05, near, 'winter', true);
  assert.equal(bird.mode, 1, 'settles into a circle');
  life.dispose();
});

test('paused updates freeze the flock; switching era re-rolls it; gulls start over water', () => {
  const life = createAmbientLife({ terrain: x => (x > 0 ? 4 : -4), waterLevel: 0 }, 9), p = new THREE.Vector3();
  life.update(.016, p, 'alpha', true);
  const before = JSON.stringify(life.creatures.butterflies);
  life.update(0, p, 'alpha', true); assert.equal(JSON.stringify(life.creatures.butterflies), before);
  life.update(.016, p, 'blacksail', true); assert.equal(life.region, 'blacksail');
  const flying = life.creatures.birds.filter(c => c.mode === 1);
  assert.ok(flying.length > 0 && flying.every(c => c.cx < 0), 'circling gulls are anchored over the sea');
  assert.ok(life.creatures.butterflies.every(c => c.x > 0), 'butterflies only over land');
  life.update(.016, p, 'blacksail', false); assert.equal(life.root.visible, false);
  life.dispose();
});
