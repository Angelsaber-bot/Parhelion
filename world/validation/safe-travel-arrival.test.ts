import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/player';
import { createEraStoryScene } from '../src/eraStoryScenes';
import { createValleyStoryScene } from '../src/valleyStoryScene';
import { createTraversalRepairs } from '../src/traversalRepairs';
import { createSafeTravelStops } from '../src/safeTravel';
import { makeCombatTerrain } from '../src/combatTerrain';
/** Match the runtime collider stack, including all five living-hub additions. */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { REGIONS, mergeLayouts, boundaryWalls, GRID } from '../src/regions.ts';
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
    if (object.userData.dynamic) { colliders.push({ name: object.name, enabled: true, bvh: new MeshBVH(geometry) }); }
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
const traversalRepairs = createTraversalRepairs();geos.push(...traversalRepairs.collisionGeometries);
for (const placement of settlements.placements) layout.areas.push({
  id: `${placement.id}_living_hub`, name: placement.name[0], nameEn: placement.name[1],
  c: [placement.position[0], placement.position[2]], r: Math.hypot(...placement.footprint) / 2,
  tp: [placement.entry[0], placement.entry[2] + 8], region: placement.id, color: '#c4ced6',
});
colliders.unshift({ name: 'static', enabled: true, bvh: new MeshBVH(mergeParts(geos)) });
// Independent Node collision tests, not browser/GPU acceptance. Real five-region
// meshes, installed settlements and additive story props share Player collision.
const storyScenes = settlements.placements.map(p => p.id === 'alpha' ? createValleyStoryScene(p) : createEraStoryScene(p));
for (const story of storyScenes) { colliders.push(...story.colliders); layout.markers.push(...story.markers); }

const stops = createSafeTravelStops(settlements.placements);
const query = makeCombatTerrain(colliders, layout, (x, z) => grid.sampleHeight(x, z));
const idle = { x: 0, z: 0, jump: false, sprint: false };
for (const arrivalLift of [.06, .25, 1]) for (const stop of stops) test(`${stop.region}: arrival +${arrivalLift} passes real preflight, settles below roof and walks outward`, () => {
  const p = new Player(colliders, layout.world.waterLevel);
  const [x, y, z] = stop.position;
  const landing = query.ground(x, z, y + 2);
  assert.ok(landing, 'production ground(x,z,y+2) must find the entrance floor');
  assert.ok(Math.abs(landing.point.y-y) <= 1, 'production elevation check must accept the entrance');
  assert.equal(query.clear(landing.point, .38, 1.8), true, 'production arrival capsule preflight must pass');
  p.teleport(x, landing.point.y + arrivalLift, z, Math.PI);
  for (let i = 0; i < 240; i++) p.step(1 / 120, idle);
  assert.equal(p.onGround, true, 'arrival must settle on the real collision surface');
  assert.equal(p.swimming, false);
  assert.ok(Math.abs(p.pos.y - stop.position[1]) < .4, `roof/fall at ${p.pos.toArray()} vs ${stop.position}`);
  assert.ok(Math.hypot(p.pos.x-stop.position[0], p.pos.z-stop.position[2]) < .4, 'capsule must not be pushed out of a wall');
  // South-facing exits in all five authored kits have a validated exterior ramp.
  for (let i = 0; i < 240; i++) p.step(1 / 120, { ...idle, z: 1 });
  assert.ok(p.pos.z > stop.position[2] + 8, `blocked exit at ${p.pos.toArray()}`);
  assert.ok(Math.abs(p.pos.x-stop.position[0]) < .5, 'exit should not require a lateral teleport');
  assert.ok(p.pos.y > layout.world.waterLevel + .3, 'arrival cannot lead directly into water');
  assert.equal(p.swimming, false);
});
