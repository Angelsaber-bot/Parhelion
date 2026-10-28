/** Node CPU comparison only. No WebGL/GPU/browser/FPS claim. Both use the actual Dawn AR. */
import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { buildCharacter, CharacterAnimator } from '../../src/character.ts';
import { SkinnedCharacterAnimator } from '../../src/skinnedCharacter.ts';
import { attachExplorerRifle } from '../../src/weaponArt.ts';
import { parseLocalGlb, playerFixture } from '../player-fixture.ts';

const path = process.argv[2]; if (!path) throw new Error('Pass an output JSON path');
const fresh = await playerFixture(false);
const oldRig = buildCharacter(new THREE.MeshStandardMaterial());
const oldRifle = attachExplorerRifle(oldRig, undefined, () => parseLocalGlb(new URL('../../../assets/weapons/glb/01_Dawn_AR.glb', import.meta.url)));
await oldRifle.ready;
const states = [
  { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: 0 },
  { speed: 9, onGround: true, swimming: false, vy: 0, moveYaw: .6 },
  { speed: 3, onGround: false, swimming: true, vy: 0, moveYaw: 1 },
  { speed: 8, onGround: false, swimming: false, vy: -2, moveYaw: 1.5, gliding: true },
  { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: 0, aim: 1, pitch: .5 },
];
const results: Record<string, unknown> = {};
for (const [label, rig, animator] of [
  ['segmented_previous', oldRig, new CharacterAnimator(oldRig)],
  ['skinned_default', fresh.rig, new SkinnedCharacterAnimator(fresh.rig)],
] as const) {
  const tick = (i: number) => { animator.update(1/60, states[Math.floor(i / 180) % states.length]); rig.root.updateMatrixWorld(true); };
  for (let i = 0; i < 4000; i++) tick(i);
  const samples: number[] = [];
  for (let batch = 0; batch < 7; batch++) {
    const start = performance.now();
    for (let i = 0; i < 6000; i++) tick(i);
    samples.push((performance.now() - start) / 6000);
  }
  samples.sort((a,b) => a-b);
  results[label] = { medianCpuMilliseconds: samples[3], samples };
}
const sha256=(path:URL)=>createHash('sha256').update(readFileSync(path)).digest('hex');
writeFileSync(path, JSON.stringify({ scope: 'Node CPU animation/IK/bone/hierarchy update only, actual rifle in both rigs, no outlines, no WebGL rendering or FPS', assetHash:sha256(new URL('../../../assets/characters/player_v2/player_v2.glb',import.meta.url)),animatorHash:sha256(new URL('../../src/skinnedCharacter.ts',import.meta.url)),warmup:4000,batches:7,iterationsPerBatch:6000,states,results }, null, 2));
fresh.dispose(); oldRifle.dispose();
console.log(JSON.stringify(results, null, 2));
