import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { fileURLToPath } from 'node:url';
import { readCharacter } from './characters/inspect.ts';
import { ContractServant, SERVANT_MODELS } from '../src/servant.ts';
import { SaberGroundedLocomotion } from '../src/characters/saberGroundedLocomotion.ts';
import { saberRunRate } from '../src/characters/saberStride.ts';
import { SABER_SOLE_PROBES } from '../src/characters/saberSoleGeometry.ts';
import { FirstContract } from '../src/contracts.ts';
import { ServantAppearance } from '../src/servantAppearance.ts';
for (const outfit of ['armor', 'civilian'] as const) for (const hz of [30, 60, 120]) test(`${outfit} ${hz}Hz: grounded targets retain finite bones, world anchors and budgeted slopes`, async t => {
  const { gltf } = await readCharacter(fileURLToPath(SERVANT_MODELS[outfit]));
  const clips = JSON.stringify(gltf.animations.map(c => c.toJSON())), appearance = new ServantAppearance(); appearance.select(outfit);
  const geometry = new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) position.setY(i, .15 * position.getZ(i));
  const collider = { name: 'slope', enabled: true, bvh: new MeshBVH(geometry) };
  const actor = new ContractServant({ scene: new THREE.Scene(), marker: { id: 'test', type: 'interact', label: 'test', p: [0, 0, 0] }, contract: new FirstContract(new Set(['saber_contract'])), appearance, colliders: [collider], load: async () => gltf, target: () => null, strike: () => null });
  await actor.ensureLoaded(); const internal = actor as any, grounded = internal.grounding as SaberGroundedLocomotion; assert.ok(grounded instanceof SaberGroundedLocomotion, 'test the actual runtime attachment'); assert.equal(internal.stride.supported, true, 'native outfits take the supported cadence path');
  internal.play('run', false, saberRunRate(5.5, internal.clips.get('run').getClip().duration)); internal.strideSpeed = 5.5;
  const feet = ['Left', 'Right'].map(side => gltf.scene.getObjectByName('mixamorig' + side + 'Foot')!), previous = feet.map(() => new THREE.Vector3()), previousContact = [false, false], point = new THREE.Vector3();
  let min = Infinity, drift = 0, contacts = 0;
  for (let frame = 0; frame < 4 * hz; frame++) {
    actor.root.position.z = frame * 5.5 / hz; actor.root.position.y = .15 * actor.root.position.z;
    internal.tick(1 / hz); actor.root.updateMatrixWorld(true);
    for (let side = 0; side < 2; side++) {
      feet[side].getWorldPosition(point);
      if (previousContact[side] && actor.strideDiagnostics!.planted[side]) { drift = Math.max(drift, point.distanceTo(previous[side]) * hz); contacts++; }
      previous[side].copy(point); previousContact[side] = actor.strideDiagnostics!.planted[side];
      for (const p of SABER_SOLE_PROBES[outfit][side]) { point.fromArray(p).applyMatrix4(feet[side].matrixWorld); min = Math.min(min, point.y - .15 * point.z); }
    }
  }
  t.diagnostic(JSON.stringify({ min, drift, contacts, patch: grounded.patch.diagnostics, finalReach: internal.stride.diagnostics.maxTargetError }));
  assert.ok(min > -.0005); assert.ok(drift < .001); assert.ok(contacts > hz * .6, 'sprint retains measurable stance; consecutive-frame drift excludes touchdown and toe-off samples'); assert.ok(internal.stride.diagnostics.maxTargetError < .001);
  assert.ok(grounded.patch.diagnostics.shapecasts < hz * 2 + 10, 'moving slope cache must not raycast six points each frame');
  const snapshot = () => { const q: number[] = []; gltf.scene.traverse(o => q.push(...o.quaternion.toArray())); return q; };
  internal.tick(0); const before = snapshot(), casts = grounded.patch.diagnostics.shapecasts;
  for (let i = 0; i < 20; i++) internal.tick(0);
  assert.ok(Math.max(...snapshot().map((v, i) => Math.abs(v - before[i]))) < 1e-8); assert.equal(grounded.patch.diagnostics.shapecasts, casts);
  assert.equal(JSON.stringify(gltf.animations.map(c => c.toJSON())), clips);
  actor.dispose(); geometry.dispose();
});
test('grounded run/attack interruption keeps private stages isolated and outfit reload drops support ownership', async () => {
  const { UltimateStage } = await import('../src/ultimateStage.ts');
  const appearance = new ServantAppearance(); appearance.select('civilian');
  const geometry = new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setY(i, .12 * positions.getZ(i));
  const actor = new ContractServant({ scene: new THREE.Scene(), marker: { id: 'test', type: 'interact', label: 'test', p: [0, 0, 0] }, contract: new FirstContract(new Set(['saber_contract'])), appearance, colliders: [{ name: 'stage-source-slope', enabled: true, bvh: new MeshBVH(geometry) }], load: async url => (await readCharacter(fileURLToPath(url))).gltf, target: () => null, strike: () => null });
  await actor.ensureLoaded(); const a = actor as any, stage = new UltimateStage();
  try {
    a.play('run', false, saberRunRate(5.5, a.clips.get('run').getClip().duration)); a.strideSpeed = 5.5;
    for (let i = 0; i < 60; i++) { actor.root.position.z += 5.5 / 60; actor.root.position.y = .12 * actor.root.position.z; a.tick(1 / 60); }
    const source = actor.presentationModel!, snapshot = () => { const result: number[] = []; source.traverse(o => result.push(...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray())); return result; };
    const before = snapshot(); stage.begin({ identity: 'saber', sourceRoot: source, clips: actor.presentationClips });
    const canonical = (stage as any).clone.getObjectByName('mixamorigRightFoot').quaternion.clone();
    stage.update({ elapsed: .2, phase: 'intro', progress: .4, pulse: 0 }); assert.deepEqual(snapshot(), before, 'private stage cannot retain or write source corrections');
    const queries = actor.groundDiagnostics!.patch.heightQueries;
    a.play('attack', true); a.tick(.06); assert.equal(a.groundingActive, false); assert.equal(a.stride.support, undefined); assert.equal(actor.groundDiagnostics!.patch.heightQueries, queries);
    const during = snapshot(); stage.update({ elapsed: 1, phase: 'charge', progress: .6, pulse: 0 }); stage.end(); assert.deepEqual(snapshot(), during, 'cancel during outgoing Run blend leaves live source untouched');
    for (let i = 0; i < 15; i++) a.tick(1 / 60);
    const attack = a.clips.get('attack');
    for (const track of attack.getClip().tracks.filter((track: THREE.KeyframeTrack) => /^(?:mixamorig(?:Left|Right)(?:UpLeg|Leg|Foot|ToeBase)|RuntimeSkirt(?:Front|Back))\.quaternion$/.test(track.name))) {
      const curve = track.createInterpolant(), expected = new THREE.Quaternion().fromArray(curve.evaluate(attack.time)).normalize(), actual = source.getObjectByName(track.name.slice(0, -11))!.quaternion.clone().normalize();
      assert.ok(actual.angleTo(expected) < 1e-6, 'after fade, authored Attack lower curves own exactly');
    }
    a.cancelAttack(); for (let i = 0; i < 15; i++) a.tick(1 / 60);
    assert.equal(a.groundingActive, true); stage.begin({ identity: 'saber', sourceRoot: source, clips: actor.presentationClips });
    assert.ok((stage as any).clone.getObjectByName('mixamorigRightFoot').quaternion.angleTo(canonical) < 1e-6, 'private stage canonical foot is independent of grounded Run/Idle entry'); stage.end();
    const oldGrounding = a.grounding, root = actor.root.position.clone(); appearance.select('armor'); await actor.ensureLoaded();
    assert.notEqual(a.grounding, oldGrounding); assert.equal(oldGrounding.modified, false); assert.equal(source.parent, null); assert.ok(actor.root.position.equals(root));
    const retired = snapshot(); for (let i = 0; i < 10; i++) a.tick(1 / 60); assert.deepEqual(snapshot(), retired); assert.ok(actor.groundDiagnostics!.patch.heightQueries > 0);
  } finally { stage.dispose(); actor.dispose(); geometry.dispose(); }
});
