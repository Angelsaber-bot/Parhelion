import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { fileURLToPath } from 'node:url';
import { ContractServant, SERVANT_MODELS } from '../src/servant.ts';
import { FirstContract } from '../src/contracts.ts';
import { ServantAppearance } from '../src/servantAppearance.ts';
import { PLAYER } from '../src/player.ts';
import { publishedSaberIdleClip } from '../src/characters/saberLocomotion.ts';
import { readCharacter } from './characters/inspect.ts';

for (const outfit of ['armor', 'civilian'] as const) test(`${outfit}: real follow updates keep idle carry at slow walk, normal travel, sprint catch-up and stopping`, async () => {
  const { gltf } = await readCharacter(fileURLToPath(new URL(SERVANT_MODELS[outfit])));
  const idle = gltf.animations.find(clip => clip.name === 'Idle')!;
  const reference = publishedSaberIdleClip(gltf.scene, idle);
  const upper = new Set<string>();
  gltf.scene.getObjectByName('mixamorigSpine')!.traverse(node => upper.add(node.name));
  const samples = reference.tracks.filter(track => track.name.endsWith('.quaternion') && upper.has(track.name.slice(0, -11))).map(track => ({
    bone: gltf.scene.getObjectByName(track.name.slice(0, -11))!,
    curve: (track as THREE.QuaternionKeyframeTrack & { createInterpolant(): THREE.Interpolant }).createInterpolant(),
  }));
  assert.equal(samples.length, 54);
  const appearance = new ServantAppearance(); appearance.select(outfit);
  const floor = new THREE.PlaneGeometry(1000, 1000).rotateX(-Math.PI / 2);
  const actor = new ContractServant({ scene: new THREE.Scene(), marker: { id: 'test', type: 'interact', label: 'test', p: [0, 0, 0] },
    contract: new FirstContract(new Set(['saber_contract'])), appearance, colliders: [{ name: 'floor', enabled: true, bvh: new MeshBVH(floor) }],
    load: async () => gltf, target: () => null, strike: () => null });
  await actor.ensureLoaded();
  const player = new THREE.Vector3(); let elapsed = 0, maxError = 0;
  const counts: Record<string, number> = {};
  // Player.walk is 5.5 m/s, not the artificial 1 m/s used by the old test.
  for (const [label, speed, seconds] of [['idle', 0, .5], ['slow', 1, 3], ['normal', PLAYER.walk, 4], ['sprint', PLAYER.sprint, 3], ['stopped', 0, 6]] as const) {
    let runs = 0, walks = 0;
    for (let frame = 0; frame < seconds * 60; frame++) {
      player.x += speed / 60; actor.update(1 / 60, player, 0, true, false); elapsed += 1 / 60;
      if (actor.animation === 'Run') runs++; if (actor.animation === 'Walk') walks++;
      for (const sample of samples) {
        const expected = new THREE.Quaternion().fromArray(sample.curve.evaluate(elapsed % idle.duration)).normalize();
        const error = sample.bone.quaternion.clone().normalize().angleTo(expected); maxError = Math.max(maxError, error);
        assert.ok(error < 1e-5, `${label} ${actor.animation} frame ${frame}: ${sample.bone.name} differs from idle by ${error} rad`);
      }
    }
    counts[label + 'Run'] = runs; counts[label + 'Walk'] = walks;
    if (label === 'slow') assert.ok(walks > 80, 'exercise real Walk');
    if (label === 'normal' || label === 'sprint') assert.ok(runs > 120, 'exercise the real Run selected by normal follow');
  }
  assert.equal(actor.animation, 'Idle');
  console.log(JSON.stringify({ outfit, playerWalk: PLAYER.walk, playerSprint: PLAYER.sprint, maxUpperAngleError: maxError, counts }));
  actor.dispose(); floor.dispose();
});
