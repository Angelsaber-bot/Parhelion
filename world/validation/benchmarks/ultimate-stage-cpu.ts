/** CPU-only begin/end cost. No shader upload, browser, frame-rate or GPU claim. */
import * as THREE from 'three';
import { fileURLToPath } from 'node:url';
import { readCharacter } from '../characters/inspect.ts';
import { SERVANT_MODELS } from '../../src/servant.ts';
import { CHARACTER_KITS } from '../../src/characters/catalog.ts';
import { UltimateStage } from '../../src/ultimateStage.ts';
const rows = [];
for (const [identity, url] of [['saber', SERVANT_MODELS.armor], ['napoleon', CHARACTER_KITS.napoleonMounted.assetUrl]]) {
  const { gltf } = await readCharacter(fileURLToPath(new URL(url)));
  const stage = new UltimateStage(), samples: number[] = [], boundsSamples: number[] = [];
  const original = THREE.Box3.prototype.setFromObject;
  THREE.Box3.prototype.setFromObject = function(object, precise) {
    const start = performance.now(); try { return original.call(this, object, precise); }
    finally { boundsSamples.push(performance.now() - start); }
  };
  try { for (let i = 0; i < 12; i++) { const start = performance.now(); stage.begin({ identity, sourceRoot: gltf.scene, clips: gltf.animations }); samples.push(performance.now() - start); stage.end(); } }
  finally { THREE.Box3.prototype.setFromObject = original; stage.dispose(); }
  const median = (xs: number[]) => [...xs].sort((a,b) => a-b)[Math.floor(xs.length / 2)];
  rows.push({ identity, samplesMs: samples, boundsSamplesMs: boundsSamples, medianBeginMs: median(samples), medianBoundsMs: median(boundsSamples), boundsCalls: boundsSamples.length });
}
console.log(JSON.stringify({ node: process.version, cpuOnly: true, note: 'Same loaded model, 12 begin/end cycles; includes cold first call; no GPU work.', rows }, null, 2));
