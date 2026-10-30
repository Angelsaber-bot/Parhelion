/** Match the runtime collider stack, including all five living-hub additions. */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { REGIONS, mergeLayouts, boundaryWalls, GRID } from '../src/regions.ts';
import { makeCombatTerrain } from '../src/combatTerrain.ts';
import { makeWildernessSpawns } from '../src/combat.ts';
import { makeMinibossSpawns } from '../src/minibosses.ts';
import { WorldGrid } from '../src/grid.ts';
import { mergeParts } from '../src/settlements/merge.ts';
import { installSettlements } from '../src/settlements/core.ts';
import { buildAlphaSettlement } from '../src/settlements/alpha.ts';
import { buildBritainSettlement } from '../src/settlements/britain.ts';
import { buildBlackSailSettlement } from '../src/settlements/blacksail.ts';
import { buildWinterSettlement } from '../src/settlements/winter.ts';
import { buildKyotoSettlement } from '../src/settlements/kyoto.ts';
import type { Collider } from '../src/player.ts';
import type { Layout } from '../src/types.ts';

const geos: THREE.BufferGeometry[] = [boundaryWalls()];
const props: THREE.BufferGeometry[] = [];
const colliders: Collider[] = [];
const terrains: THREE.Mesh[] = [];
const parts = await Promise.all(REGIONS.map(async def => {
  const bytes = readFileSync(new URL(`../public/assets/${def.file}.glb`, import.meta.url));
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(gltf.scene);
  gltf.scene.position.set(def.offset[0], 0, def.offset[1]);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.getObjectByName('ART')!.traverse(object => {
    if (object instanceof THREE.Mesh && object.name === 'Terrain') terrains.push(object);
  });
  gltf.scene.getObjectByName('COLLISION')!.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    let geometry = new THREE.BufferGeometry().setAttribute('position', object.geometry.attributes.position.clone());
    if (object.geometry.index) geometry.setIndex(object.geometry.index.clone());
    geometry.applyMatrix4(object.matrixWorld);
    if (geometry.index) geometry = geometry.toNonIndexed();
    if (object.name !== 'COL_Terrain') props.push(geometry);
    if (object.userData.dynamic) colliders.push({ name: object.name, enabled: true, bvh: new MeshBVH(geometry) });
    else geos.push(geometry);
  });
  const layout = JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`, import.meta.url), 'utf8')) as Layout;
  return { def, layout };
}));
const layout = mergeLayouts(parts);
const grid = new WorldGrid(terrains, GRID.x0, GRID.z0, GRID.span, GRID.cell, '#4f8fa8', GRID.spanZ);
const settlements = installSettlements([
  buildAlphaSettlement(), buildBritainSettlement(), buildBlackSailSettlement(), buildWinterSettlement(), buildKyotoSettlement(),
], { grid, blockers: new MeshBVH(mergeParts(props)), layout });
geos.push(...settlements.collisionGeometries);
for (const placement of settlements.placements) layout.areas.push({
  id: `${placement.id}_living_hub`, name: placement.name[0], nameEn: placement.name[1],
  c: [placement.position[0], placement.position[2]], r: Math.hypot(...placement.footprint) / 2,
  tp: [placement.entry[0], placement.entry[2] + 8], region: placement.id, color: '#c4ced6',
});
colliders.unshift({ name: 'static', enabled: true, bvh: new MeshBVH(mergeParts(geos)) });
const q = makeCombatTerrain(colliders, layout, (x, z) => grid.sampleHeight(x, z));
const spawns = makeWildernessSpawns(layout.world.seed ^ 537, q.safeSpawn);
const minis = makeMinibossSpawns(q.safeSpawn, spawns);
export { layout, grid, q, spawns, minis, colliders };
