/** CPU-only helper cost; this is not a GPU or browser FPS benchmark.
 * Run: node --import tsx validation/benchmarks/local-light-cpu.ts */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { REGIONS } from '../../src/regions.ts';
import { LocalPointLightPool, StabilizedSunShadow, type LocalLightDefinition } from '../../src/renderLighting.ts';
const definitions: LocalLightDefinition[] = [{ p: [182, 6, -60], color: '#7ff6ff', intensity: 60, distance: 26 }];
for (const region of REGIONS) {
  const layout = JSON.parse(readFileSync(new URL(`../../public/assets/${region.file}.layout.json`, import.meta.url), 'utf8'));
  definitions.push(...(layout.lights ?? []).map((light: LocalLightDefinition) => ({ ...light, p: [light.p[0] + region.offset[0], light.p[1], light.p[2] + region.offset[1]] as const })));
}
const pool = new LocalPointLightPool(definitions), camera = new THREE.PerspectiveCamera(75, 16 / 9, .1, 1300);
const shadow = new StabilizedSunShadow(), light = new THREE.DirectionalLight(), direction = new THREE.Vector3(-.45, .62, .64).normalize();
Object.assign(light.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70 }); light.shadow.mapSize.set(2048, 2048);
function step(i: number) {
  const region = REGIONS[Math.floor(i / 2000) % REGIONS.length];
  camera.position.set(region.offset[0] + Math.sin(i * .01) * 200, 2, region.offset[1] + Math.cos(i * .01) * 200);
  camera.rotation.y = i * .01; pool.update(camera); shadow.update(light, camera.position, direction);
}
for (let i = 0; i < 10000; i++) step(i);
const results: number[] = [];
for (let run = 0; run < 7; run++) { const start = performance.now(); for (let i = 0; i < 20000; i++) step(i); results.push((performance.now() - start) / 20000); }
results.sort((a, b) => a - b);
console.log(JSON.stringify({ scope: 'Node CPU helper overhead only; no browser/GPU/FPS claim', authoredLights: definitions.length,
  fixedPointLightTerms: pool.lights.length, fewerPointLightTermsPercent: 100 * (1 - pool.lights.length / definitions.length),
  sampleCount: 140000, combinedSelectorAndShadowMsPerUpdateMedian: results[3], min: results[0], max: results[6] }, null, 2));
