import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RewardBurst, BURST } from '../src/exploration/rewardBurst';

test('chest crystals burst up out of the lid, then fly into the player and vanish', () => {
  const b = new RewardBurst(), at = new THREE.Vector3(0, 1, 0), player = new THREE.Vector3(4, 1.2, 0);
  assert.equal(b.emit(at, 30, '#ffd76a'), BURST.max, 'capped');
  b.update(.2, player);
  const ys = b.root.children.filter(o => o.visible).map(o => o.position.y);
  assert.ok(Math.max(...ys) > at.y + .3, 'they rise first');
  for (let i = 0; i < 120 && b.active; i++) b.update(1 / 60, player);
  assert.equal(b.active, 0, 'all reach the player within ~2 s');
  b.dispose();
});
