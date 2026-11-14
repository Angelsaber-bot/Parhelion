import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFieldChapterScene } from '../src/environment/fieldChapterScene';
import type { FieldChapterContent } from '../src/story/fieldChapters';

test('a gliding prop follows its work action: start, halfway, finished', () => {
  const content: FieldChapterContent = {
    set: { region: 'alpha', title: ['t', 't'], actions: [{ region: 'alpha', chapter: 'T01', id: 't_push', near: 'anchor', kind: 'work', seconds: 8, label: ['a', 'a'], line: ['b', 'b'] }] },
    props: [{ at: 't_push', off: [0, 1, 0], size: [1, 1, 1], color: 0x777777, rot: [0, 0, 0], moved: { when: 't_push', off: [0, 1, -8], rot: [0, 1, 0] }, glide: 't_push' }],
    actors: [],
  };
  const scene = createFieldChapterScene([content], () => [0, 0, 0], () => 0, () => true);
  const prop = scene.root.getObjectByName('FieldProp_t_push')!, at = scene.point('t_push')!;
  let k = 0; const viewer = new THREE.Vector3(at[0], 0, at[2]);
  scene.apply(new Set()); scene.update(0, viewer, () => k); assert.ok(Math.abs(prop.position.z - at[2]) < 1e-6);
  k = .5; scene.update(0, viewer, () => k); assert.ok(Math.abs(prop.position.z - (at[2] - 4)) < 1e-6, 'halfway along'); assert.ok(Math.abs(prop.rotation.y - .5) < 1e-6, 'and halfway turned');
  k = 1; scene.update(0, viewer, () => k); assert.ok(Math.abs(prop.position.z - (at[2] - 8)) < 1e-6);
});
