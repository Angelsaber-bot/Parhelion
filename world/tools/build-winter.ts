// Generates World 03 (永冬之城 Everwinter City, 1812) as GLB + layout JSON.
//   npm run build:winter
// Same node contract as the other regions (ART / COLLISION / MARKERS).
import { buildWinterTerrain } from './gen/winter/terrain.js';
import { buildWinter } from './gen/winter/build.js';
import { WINTER, AREAS, PATHS, CORE, CITY, BIVOUAC, IMPERIAL_TENT, CAVERN, ICE_Y } from './gen/winter/layout.js';
import { writeRegion } from './gen/export.js';

const t0 = performance.now();
const terrain = buildWinterTerrain();
const { pieces, markers } = buildWinter(terrain.heightAt);

const layout = {
  world: WINTER,
  areas: AREAS,
  paths: PATHS,
  markers,
  lights: [
    { p: [CORE.c[0], CITY.y + 16, CORE.c[1]], color: '#9fd8ff', intensity: 140, distance: 70 },
    { p: [IMPERIAL_TENT.c[0], BIVOUAC.y + 4, IMPERIAL_TENT.c[1]], color: '#ffb36b', intensity: 60, distance: 30 },
    { p: [CAVERN.c[0], ICE_Y + 8, CAVERN.c[1]], color: '#8fe4ff', intensity: 90, distance: 40 },
  ],
  atmosphere: { fog: '#dfe8f2', near: 110, far: 700 },
  objective: {
    id: 'end_the_long_winter',
    name: '永冬之城：结束永恒的冬天',
    steps: [
      { id: 'meet', text: '在大军营地的皇帝帐篷里找到拿破仑', done: ['napoleon_meet'] },
      { id: 'eagle', text: '点燃雪原上的 3 座烽火，取得碎片·鹰旗（离开火堆太久会冻僵）', done: ['beacon_1', 'beacon_2', 'beacon_3', 'shard_eagle'] },
      { id: 'bell', text: '沿脚手架爬上伊凡大帝钟楼，取得碎片·钟声', done: ['shard_bell'] },
      { id: 'frost', text: '击碎冰封峡谷的 3 枚冰封印，进入冰窟取得碎片·霜晶', done: ['frost_seal_1', 'frost_seal_2', 'frost_seal_3', 'shard_frost'] },
      { id: 'core', text: '在红场点亮冬之核，击败执冬者', done: ['winter_core'] },
      { id: 'contract', text: '回到皇帝帐篷，与拿破仑缔结契约', done: ['napoleon_contract'] },
    ],
  },
};
const { bytes, tris } = await writeRegion({ file: 'world_winter', world: WINTER, terrain, pieces, markers, layout });
console.log(
  `world_winter.glb ${(bytes / 1024 / 1024).toFixed(2)} MB, ~${Math.round(tris / 1000)}k tris, ` +
    `${markers.length} markers, ${pieces.length} pieces, ${((performance.now() - t0) / 1000).toFixed(1)}s`,
);
