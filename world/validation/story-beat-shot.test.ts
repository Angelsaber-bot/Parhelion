import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { StoryBeatShot, STORY_SHOT, storyShotWeight } from '../src/cinematics/storyBeatShot';

test('a story shot eases out of third person, orbits the beat, and hands the camera back', () => {
  assert.equal(storyShotWeight(0), 0); assert.equal(storyShotWeight(STORY_SHOT.blendIn + .1), 1);
  assert.equal(storyShotWeight(STORY_SHOT.blendIn + STORY_SHOT.hold + STORY_SHOT.blendOut), 0);
  const shot = new StoryBeatShot(), cam = new THREE.PerspectiveCamera(), focus = new THREE.Vector3(10, 0, 10);
  cam.position.set(0, 2, 0); shot.start(focus, 'line', cam); assert.equal(shot.active, true);
  shot.update(STORY_SHOT.blendIn + .2, cam);
  assert.ok(Math.abs(cam.position.distanceTo(new THREE.Vector3(10, 0, 10)) - Math.hypot(STORY_SHOT.radius, STORY_SHOT.height)) < .01, 'on the orbit');
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), toFocus = new THREE.Vector3(10, 1.2, 10).sub(cam.position).normalize();
  assert.ok(forward.dot(toFocus) > .99, 'looking at the beat');
  shot.skip(); for (let i = 0; i < 40; i++) shot.update(1 / 30, cam);
  assert.equal(shot.active, false, 'a key skips to the hand-back, which finishes on its own');
  shot.dispose();
});
