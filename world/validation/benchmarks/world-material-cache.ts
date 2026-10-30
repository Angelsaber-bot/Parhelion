/** Actual shipped map GLBs + actual settlement-kit material allocation audit.
 * CPU/model allocation evidence only: not GPU timing, draw-call or FPS evidence. */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader } from '../../src/glb.ts';
import { REGIONS } from '../../src/regions.ts';
import { isStaticArtEligible } from '../../src/chunk.ts';
import { WorldMaterialCache } from '../../src/worldMaterialCache.ts';
import { buildAlphaSettlement } from '../../src/settlements/alpha.ts';
import { buildBritainSettlement } from '../../src/settlements/britain.ts';
import { buildBlackSailSettlement } from '../../src/settlements/blacksail.ts';
import { buildWinterSettlement } from '../../src/settlements/winter.ts';
import { buildKyotoSettlement } from '../../src/settlements/kyoto.ts';
const cache = new WorldMaterialCache();
const rows: {name: string; meshes: number; beforeMaterials: number; afterMaterials: number; cachedReuse: number}[] = [];
let waterIncluded = false;
function audit(name: string, root: THREE.Object3D, map = false) {
  const before = cache.conversions, hits = cache.hits; let meshes = 0;
  root.traverse(object => {
    const mesh = object as THREE.Mesh; if (!mesh.isMesh) return;
    // Runtime retains just one global sea. Its choice is irrelevant to the cache,
    // as every water material is deliberately excluded from sharing.
    if (map && mesh.name === 'Water') { if (waterIncluded) return; waterIncluded = true; }
    meshes++;
    for (const source of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) cache.convert(source, isStaticArtEligible(mesh));
  });
  rows.push({name, meshes, beforeMaterials: cache.conversions - before + cache.hits - hits, afterMaterials: cache.conversions - before, cachedReuse: cache.hits - hits});
}
for (const region of REGIONS) {
  const bytes = readFileSync(new URL(`../../public/assets/${region.file}.glb`, import.meta.url));
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  audit(region.id, gltf.scene.getObjectByName('ART')!, true);
}
for (const kit of [buildAlphaSettlement(), buildBritainSettlement(), buildBlackSailSettlement(), buildWinterSettlement(), buildKyotoSettlement()]) audit(`${kit.id} settlement kit`, kit.group);
console.log(JSON.stringify({scope: 'Actual ART meshes (one retained water), five settlement kits before placement foundations; source-identity allocations only', rows,
  beforeMaterials: cache.conversions + cache.hits, afterMaterials: cache.conversions, avoidedMaterialInstances: cache.hits,
  reductionPercent: 100 * cache.hits / (cache.conversions + cache.hits)}, null, 2));
