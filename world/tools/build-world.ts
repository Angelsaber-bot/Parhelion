// Generates the World first area (幻日谷) blockout as GLB + layout JSON.
//   npm run build:world
// Output (deterministic for a given WORLD.seed):
//   public/assets/world_alpha.glb          visual meshes (ART), collision proxies (COLLISION), markers (MARKERS)
//   public/assets/world_alpha.layout.json  areas, river, paths, markers — for the viewer/minimap/server/AI
// The GLB opens directly in Blender (File > Import > glTF) for art passes; keep the node names.

import { buildTerrain } from './gen/terrain.js';
import { buildStructures } from './gen/structures.js';
import { buildVegetation } from './gen/vegetation.js';
import { WORLD, AREAS, RIVER, RIVER_OUT, PATHS, LAKE, POND } from './gen/layout.js';
import { writeRegion } from './gen/export.js';

const t0 = performance.now();
const terrain = buildTerrain();
const { pieces, markers } = buildStructures(terrain.heightAt);
pieces.push(...buildVegetation(terrain.heightAt));

const layout = {
  world: WORLD,
  areas: AREAS,
  water: { lake: LAKE, pond: POND, river: [...RIVER, ...RIVER_OUT] },
  paths: PATHS,
  markers,
  objective: {
    id: 'restart_parhelion_tower',
    name: '重启幻日塔',
    steps: [
      { id: 'ruin_targets', text: '在回声森林遗迹击中 3 个机关靶，打开神龛', done: ['ruin_target_1', 'ruin_target_2', 'ruin_target_3'] },
      { id: 'relay_a', text: '启动中继器 A（森林遗迹）', done: ['relay_a'] },
      { id: 'relay_b', text: '清除旧观测站并启动中继器 B', done: ['relay_b'] },
      { id: 'tower', text: '前往幻日塔，启动控制台', done: ['tower_console'] },
    ],
  },
};
const { bytes, tris } = await writeRegion({ file: 'world_alpha', world: WORLD, terrain, pieces, markers, layout });

console.log(
  `world_alpha.glb ${(bytes / 1024 / 1024).toFixed(2)} MB, ~${Math.round(tris / 1000)}k tris, ` +
    `${markers.length} markers, ${pieces.length} pieces, ${((performance.now() - t0) / 1000).toFixed(1)}s`,
);
