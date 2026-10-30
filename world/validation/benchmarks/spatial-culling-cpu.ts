/** Actual production map chunks. CPU culling only, NOT GPU/frame-rate evidence.
 * Run from world: node --import tsx validation/benchmarks/spatial-culling-cpu.ts [report.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../../src/glb.ts';
import { chunkMesh, DistanceCuller, isStaticArtEligible } from '../../src/chunk.ts';
import { REGIONS } from '../../src/regions.ts';
const ranges: Record<string, number> = { Bushes: 180, Trees_Leaves: 380, Trees_Trunks: 260, Rocks: 320, Lamps: 240, Glow_Props: 500, Terrain: 760 };
const culler = new DistanceCuller(160);
const inventory: Record<string, number> = {};
for (const region of REGIONS) {
  const bytes = readFileSync(`public/assets/${region.file}.glb`);
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(gltf.scene); gltf.scene.position.set(region.offset[0], 0, region.offset[1]);
  const meshes: THREE.Mesh[] = []; gltf.scene.getObjectByName('ART')!.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  let count = 0;
  for (const mesh of meshes) {
    if (!isStaticArtEligible(mesh)) continue;
    const tris = (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    const pieces = tris > 4000 ? chunkMesh(mesh, 64) : [mesh];
    if (pieces.length <= 1) continue;
    for (const piece of pieces) {
      if (mesh.userData.outline) { const outline = new THREE.Object3D(); outline.name = `${piece.name}__outline`; piece.add(outline); }
      culler.add(piece, ranges[mesh.name] ?? 1e9); count++;
    }
  }
  inventory[region.id] = count;
}
// Exact pre-change production implementation, using the same immutable objects/data.
const linear = (eye: THREE.Vector3, scale = 1) => {
  for (const item of culler.items) {
    const d2 = item.c.distanceToSquared(eye);
    item.mesh.visible = d2 < (item.max * scale + item.r) ** 2;
    if (item.outline) item.outline.visible = d2 < (culler.outlineDist * scale + item.r) ** 2;
  }
};
const path = REGIONS.flatMap(region => Array.from({ length: 240 }, (_, i) => new THREE.Vector3(
  region.offset[0] + Math.sin(i / 60) * 260, 8 + Math.sin(i / 100) * 5,
  region.offset[1] + Math.cos(i / 60) * 260)));
for (const eye of path) {
  culler.update(eye);
  for (const item of culler.items) {
    const d2 = item.c.distanceToSquared(eye);
    if (item.mesh.visible !== (d2 < (item.max + item.r) ** 2) ||
        (item.outline && item.outline.visible !== (d2 < (culler.outlineDist + item.r) ** 2))) throw new Error('Visibility mismatch');
  }
}
const run = (fn: (eye: THREE.Vector3) => void) => {
  const start = performance.now();
  for (let repeat = 0; repeat < 4; repeat++) for (const eye of path) fn(eye);
  return (performance.now() - start) / (path.length * 4);
};
const optimized = (eye: THREE.Vector3) => culler.update(eye);
run(linear); run(optimized);
const before: number[] = [], after: number[] = [];
for (let i = 0; i < 9; i++) {
  if (i % 2 === 0) { before.push(run(linear)); after.push(run(optimized)); }
  else { after.push(run(optimized)); before.push(run(linear)); }
}
const median = (x: number[]) => [...x].sort((a, b) => a - b)[4];
const report = {
  kind: 'Node CPU culling-only benchmark. Not browser, GPU or FPS evidence.',
  fixture: 'All five production GLBs, production region offsets/chunk size/draw ranges, unchanged art, 1200 camera samples; 9 alternating rounds of 4800 updates after warmup.',
  visibilityEquivalenceSamples: path.length, inventory, totalChunks: culler.items.length,
  beforeMs: { median: median(before), samples: before }, afterMs: { median: median(after), samples: after },
  medianReductionPercent: (1 - median(after) / median(before)) * 100,
};
console.log(JSON.stringify(report, null, 2));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
