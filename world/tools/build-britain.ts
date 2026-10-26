// Generates World 01 (落日王国 Sunset Kingdom) as GLB + layout JSON.
//   npm run build:britain
// Same node contract as the other regions (ART / COLLISION / MARKERS).
import { buildBritainTerrain } from './gen/britain/terrain.js';
import { buildBritain } from './gen/britain/build.js';
import { BRITAIN, AREAS, PATHS, CORE, HALL, CASTLE } from './gen/britain/layout.js';
import { writeRegion } from './gen/export.js';

const t0 = performance.now();
const terrain = buildBritainTerrain();
const { pieces, markers } = buildBritain(terrain.heightAt);
const core = terrain.heightAt(CORE.c[0], CORE.c[1]);

const layout = {
  world: BRITAIN,
  areas: AREAS,
  paths: PATHS,
  markers,
  lights: [
    { p: [CORE.c[0], core + 18, CORE.c[1]], color: '#ff9a4a', intensity: 160, distance: 70 },
    { p: [HALL.c[0], CASTLE.top + 4, HALL.c[1]], color: '#ffb36b', intensity: 60, distance: 30 },
  ],
  atmosphere: { fog: '#f2c9a8', near: 140, far: 820 },
  objective: {
    id: 'relight_the_sunset',
    name: '落日王国：点亮落日之核',
    steps: [
      { id: 'contract', text: '在圣剑湖拔出湖中之剑，与 Saber 缔结契约', done: ['saber_contract'] },
      { id: 'camp', text: '骑士营地试炼：击倒 3 个木人，取得碎片·誓约', done: ['camp_dummy_1', 'camp_dummy_2', 'camp_dummy_3', 'shard_camp'] },
      { id: 'tower', text: '登上卡美洛主塔，取得碎片·王座', done: ['shard_tower'] },
      { id: 'table', text: '点燃圆桌大厅的 3 个火盆，取得碎片·圆桌', done: ['hall_brazier_1', 'hall_brazier_2', 'hall_brazier_3', 'shard_table'] },
      { id: 'core', text: '在卡姆兰战场点亮落日之核', done: ['sun_core'] },
    ],
  },
};
const { bytes, tris } = await writeRegion({ file: 'world_britain', world: BRITAIN, terrain, pieces, markers, layout });
console.log(
  `world_britain.glb ${(bytes / 1024 / 1024).toFixed(2)} MB, ~${Math.round(tris / 1000)}k tris, ` +
    `${markers.length} markers, ${pieces.length} pieces, ${((performance.now() - t0) / 1000).toFixed(1)}s`,
);
