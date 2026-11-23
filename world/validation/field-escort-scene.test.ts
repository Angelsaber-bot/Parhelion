import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createFieldChapterScene } from '../src/environment/fieldChapterScene';
import { QIN_CHAPTERS, QX } from '../src/story/qinChapters';
import { WINTER_CHAPTERS, WC } from '../src/story/winterChapters';
import type { FieldChapterContent, FieldEscortPose } from '../src/story/fieldChapters';
import { prepareEscortRoute, escortPoseAt } from '../src/story/fieldEscort';

function routeScene(chapter: FieldChapterContent, id: string) {
  const set = { ...chapter.set, actions: chapter.set.actions.filter(action => action.id === id) };
  const props = chapter.props.filter(prop => prop.at === id);
  const actors = chapter.actors.filter(actor => actor.escort?.action === id);
  return createFieldChapterScene([{ set, props, actors }], () => [0, 2.9, 0], () => 2, () => true);
}
const viewer = new THREE.Vector3(1, 2, 0);
function pose(x: number, z: number, yaw: number, active: boolean): FieldEscortPose {
  return { point: [x, 2, z], yaw, active, destination: [8, 2, 7] };
}
function at(object: THREE.Object3D, expected: number[]) {
  assert.ok(object.position.distanceTo(new THREE.Vector3(...expected)) < .08, `${object.name} at ${object.position.toArray()} instead of ${expected}`);
}

test('Luc and the occupied stretcher turn along the carried route and lower at the saved handoff', () => {
  const scene = routeScene(WINTER_CHAPTERS, WC.stretcher);
  try {
    let p = pose(0, 0, 0, false);
    const tick = () => scene.update(1 / 60, viewer, undefined, () => p);
    const stretcher = scene.root.getObjectByName('FieldProp_' + WC.stretcher)!;
    const mat = scene.root.getObjectByName('FieldDestination_' + WC.stretcher)!;
    const luc = scene.root.getObjectByName('Resident_w_luc')!;
    scene.apply(new Set()); tick();
    assert.equal(stretcher.visible, false);
    assert.equal(mat.visible, false);
    scene.apply(new Set([WC.crate])); tick();
    assert.ok(stretcher.visible && luc.visible && stretcher.getObjectByName('CasualtyFace'));
    at(stretcher, [0, 2.13, -.98]);
    at(mat, [8, 2, 7]);
    p = pose(4, 0, Math.PI / 2, true); tick();
    at(stretcher, [3.02, 2.78, 0]); at(luc, [1.82, 2, 0]);
    assert.equal(luc.getObjectByName('ResidentArmLeft')!.rotation.x, -.48);
    assert.equal(luc.rotation.y, stretcher.rotation.y);
    p = { ...p, waiting: true }; tick();
    at(stretcher, [3.02, 2.13, 0]); at(luc, [1.82, 2, 0]);
    p = pose(8, 7, 0, false);
    scene.apply(new Set([WC.stretcher])); tick();
    at(stretcher, [8, 2.13, 6.02]); at(luc, [8, 2, 4.82]);
  } finally { scene.dispose(); }
});

test('the route turns the rear grip smoothly across a corner without cutting the surveyed path', () => {
  const route = prepareEscortRoute([[0, 0, 0], [6, 0, 0], [6, 0, 6]])!;
  const before = escortPoseAt(route, 5.99, true), after = escortPoseAt(route, 6.01, true);
  assert.ok(Math.abs(after.yaw - before.yaw) < .04);
  assert.ok(Math.abs(after.yaw - Math.PI / 4) < .025);
  assert.deepEqual(before.point, [5.99, 0, 0]);
  assert.equal(after.point[0], 6);
  assert.equal(escortPoseAt(route, 0, false).yaw, Math.PI / 2);
  assert.equal(escortPoseAt(route, 12, false).yaw, 0);
});

test('both Qin families gather visibly at pickup and change formation with the route heading', () => {
  const scene = routeScene(QIN_CHAPTERS, QX.guide);
  try {
    const family = QIN_CHAPTERS.actors.filter(actor => actor.escort?.action === QX.guide)
      .map(actor => scene.root.getObjectByName('Resident_' + actor.id)!);
    const register = scene.root.getObjectByName('FieldDestination_' + QX.guide)!;
    let p = pose(0, 0, 0, false);
    const tick = () => scene.update(1 / 60, viewer, undefined, () => p);
    scene.apply(new Set()); tick();
    assert.ok(family.every(person => !person.visible));
    scene.apply(new Set([QX.roster])); tick();
    assert.equal(family.length, 4);
    assert.ok(family.every(person => person.visible && person.position.z < 0));
    at(register, [8, 2, 7]);
    p = pose(6, 3, Math.PI / 2, true); tick();
    assert.ok(family.every(person => person.position.x < 6 && Math.abs(person.position.z - 3) < .6));
    assert.ok(family.some(person => Math.abs(person.getObjectByName('ResidentHip_1')!.rotation.x) > .001));
    tick();
    assert.ok(family.every(person => Math.abs(person.getObjectByName('ResidentHip_1')!.rotation.x) < .001));
    scene.apply(new Set([QX.guide])); p = pose(8, 7, 0, false); tick();
    assert.ok(family.every(person => person.position.distanceTo(register.position) < 3));
  } finally { scene.dispose(); }
});
