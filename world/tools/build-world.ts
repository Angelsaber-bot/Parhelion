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
    name: '幻日谷：重启幻日塔',
    steps: [
      { id: 'hq', text: '前往幻日观测所，启动观测终端', done: ['hq_terminal'] },
      { id: 'armory', text: '在枪械工坊领取装备', done: ['armory_rack'] },
      { id: 'range', text: '在靶场击中 3 个练习靶', done: ['range_target_1', 'range_target_2', 'range_target_3'] },
      { id: 'ruin_targets', text: '在回声森林遗迹击中 3 个机关靶，打开神龛', done: ['ruin_target_1', 'ruin_target_2', 'ruin_target_3'] },
      { id: 'relay_a', text: '启动中继器 A（森林遗迹）', done: ['relay_a'] },
      { id: 'relay_b', text: '清除废弃前哨站并启动中继器 B', done: ['relay_b'] },
      { id: 'tower', text: '前往幻日塔，启动控制台', done: ['tower_console'] },
      { id: 'seams', text: '调查四处时层断面（西 / 北 / 东 / 南）', done: ['seam_west', 'seam_north', 'seam_east', 'seam_south'] },
      { id: 'summon', text: '回到召唤大厅，稳定召唤阵', done: ['summon_circle'] },
    ],
  },
};
const { bytes, tris } = await writeRegion({ file: 'world_alpha', world: WORLD, terrain, pieces, markers, layout });

console.log(
  `world_alpha.glb ${(bytes / 1024 / 1024).toFixed(2)} MB, ~${Math.round(tris / 1000)}k tris, ` +
    `${markers.length} markers, ${pieces.length} pieces, ${((performance.now() - t0) / 1000).toFixed(1)}s`,
);
