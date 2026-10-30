/** Repeatable Node inventory/CPU proxy. NOT a browser, raster, GPU-memory or FPS measurement.
 * Run from world/: node --import tsx validation/world-expansion-baseline.ts [report.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../src/glb';
import { chunkMesh, isStaticArtEligible } from '../src/chunk';
import { REGIONS, mergeLayouts } from '../src/regions';
import { WorldMap } from '../src/map';
import type { Layout } from '../src/types';

const regions = [];
for (const def of REGIONS) {
  const bytes = readFileSync(new URL(`../public/assets/${def.file}.glb`, import.meta.url));
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(gltf.scene);
  const art = gltf.scene.getObjectByName('ART')!;
  const sources: THREE.Mesh[] = []; art.traverse(o => { if ((o as THREE.Mesh).isMesh) sources.push(o as THREE.Mesh); });
  const buffers = new Set<ArrayBufferLike>(), materials = new Set<THREE.Material>();
  let triangles = 0, chunkMeshes = 0, outlineMeshes = 0;
  for (const source of sources) {
    const count = (source.geometry.index?.count ?? source.geometry.attributes.position.count) / 3;
    triangles += count;
    const pieces = isStaticArtEligible(source) && count > 4000 ? chunkMesh(source, 64) : [source];
    chunkMeshes += pieces.length;
    if (source.userData.outline) outlineMeshes += pieces.length;
    for (const mesh of pieces) {
      for (const attr of Object.values(mesh.geometry.attributes)) {
        const array = (attr as THREE.BufferAttribute).array ?? (attr as THREE.InterleavedBufferAttribute).data.array;
        buffers.add(array.buffer);
      }
      if (mesh.geometry.index) buffers.add(mesh.geometry.index.array.buffer);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    }
  }
  regions.push({ region: def.id, sha256: createHash('sha256').update(bytes).digest('hex'), fileBytes: bytes.length,
    sourceMeshes: sources.length, chunkMeshes, outlineMeshes, triangles, sourceMaterials: materials.size,
    uniqueArtArrayBufferBytes: [...buffers].reduce((n, b) => n + b.byteLength, 0) });
}
const layout = mergeLayouts(REGIONS.map(def => ({ def, layout: JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`, import.meta.url), 'utf8')) as Layout })));
// Real presentation code, no canvas rasterization. Count JS canvas calls separately from wall time.
let commands = 0;
const ctx = new Proxy({ canvas: { width: 380, clientWidth: 380 } } as Record<string, unknown>, {
  get(target, key: string) { if (key in target) return target[key]; if (key === 'measureText') return (s: string) => ({ width: s.length * 12 }); return () => { commands++; }; },
  set(target, key: string, value) { target[key] = value; commands++; return true; },
}) as unknown as CanvasRenderingContext2D;
const map = Object.assign(Object.create(WorldMap.prototype) as WorldMap, { base: {}, layout, size: 1081, sizeZ: 1081, half: 1080, halfZ: 1080, x0: -1080, z0: -1080 });
const position = new THREE.Vector3(3, 21, 159), done = new Set<string>(), found = new Set<string>();
const mapCpu = [false, true].map(full => {
  Object.assign(ctx.canvas, { width: full ? 1200 : 380, clientWidth: full ? 640 : 380 });
  const draw = () => map.draw(ctx, position, .5, { full, done, found, target: [-166, 228] });
  for (let i = 0; i < 100; i++) draw();
  commands = 0; draw(); const commandsPerDraw = commands;
  const samplesMs = [];
  for (let sample = 0; sample < 7; sample++) { const start = performance.now(); for (let i = 0; i < 1000; i++) draw(); samplesMs.push((performance.now() - start) / 1000); }
  return { full, commandsPerDraw, medianMs: [...samplesMs].sort((a,b) => a-b)[3], samplesMs };
});
const report = { scope: 'Node production-asset inventory + JS map presentation proxy; excludes canvas rasterization, browser, GPU memory and FPS.',
  runtime: process.version, regions, authoredPointLightsIncludingCave: (layout.lights?.length ?? 0) + 1,
  markers: layout.markers.length, areas: layout.areas.length, mapCpu };
console.log(JSON.stringify(report, null, 2));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
