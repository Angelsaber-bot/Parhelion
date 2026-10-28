/** Node CPU proxy only: actual production map art transforms, no WebGL/GPU/FPS claim. */
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { chunkMesh, freezeStaticArt, isStaticArtEligible } from '../src/chunk.ts';
const results = [];
for (const name of ['alpha', 'britain', 'blacksail', 'winter', 'kyoto']) {
  const bytes = readFileSync(`public/assets/world_${name}.glb`);
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(gltf.scene);
  const art = gltf.scene.getObjectByName('ART')!;
  const sources: THREE.Mesh[] = []; art.traverse(o => { if ((o as THREE.Mesh).isMesh) sources.push(o as THREE.Mesh); });
  const staticMeshes: THREE.Mesh[] = [];
  for (const m of sources) {
    const special = !isStaticArtEligible(m);
    if (special) continue;
    const tris = (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
    for (const piece of tris > 4000 ? chunkMesh(m, 64) : [m]) {
      if (m.userData.outline) { const o = new THREE.Mesh(piece.geometry, piece.material); o.name = `${piece.name}__outline`; piece.add(o); }
      staticMeshes.push(piece);
    }
  }
  const scene = new THREE.Scene(); scene.add(art); scene.updateMatrixWorld(true);
  let count = 0; for (const mesh of staticMeshes) mesh.traverse(() => count++);
  const bench = () => {
    for (let i = 0; i < 100; i++) scene.updateMatrixWorld();
    const samples: number[] = [];
    for (let s = 0; s < 7; s++) { const start = performance.now(); for (let i = 0; i < 300; i++) scene.updateMatrixWorld(); samples.push((performance.now() - start) / 300); }
    return { medianMs: samples.sort((a,b) => a-b)[3], samplesMs: samples };
  };
  const before = bench(); staticMeshes.forEach(freezeStaticArt); const after = bench();
  results.push({region:name, staticChunkMeshes:staticMeshes.length, staticObjectsWithOutlines:count, eliminatedLocalCompositionsPerSceneUpdate:count, eliminatedWorldMultiplicationsPerSceneUpdate:count, before, after});
}
const report = {kind:'Node CPU transform-only proxy; not browser/GPU/FPS. Same production map ART, chunk size and outlines. 7 × 300 updates after 100 warmups.', results};
console.log(JSON.stringify(report, null, 2));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report,null,2));
