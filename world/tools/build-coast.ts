// Generates World region 2 (星落海岸 Starfall Coast) as GLB + layout JSON.
//   npm run build:coast
// Same node contract as world_alpha (ART / COLLISION / MARKERS); the layout adds traversal data
// (updrafts) and region lighting that the viewer reads.
import { buildCoastTerrain } from './gen/coast/terrain.js';
import { buildCoast } from './gen/coast/build.js';
import { COAST, AREAS, PATHS, UPDRAFTS, CRATER, ISLES } from './gen/coast/layout.js';
import { writeRegion } from './gen/export.js';

const t0 = performance.now();
const terrain = buildCoastTerrain();
const { pieces, markers } = buildCoast(terrain.heightAt);
const f = terrain.heightAt(CRATER.c[0], CRATER.c[1]);

const layout = {
  world: COAST,
  areas: AREAS,
  paths: PATHS,
  markers,
  updrafts: UPDRAFTS,
  isles: ISLES,
  lights: [
    { p: [CRATER.c[0], f + 8, CRATER.c[1]], color: '#b9a8ff', intensity: 120, distance: 60 },
  ],
  atmosphere: { fog: '#c9e6f4', near: 140, far: 820, sea: true },
  objective: {
    id: 'light_the_lighthouse',
    name: '点亮守望灯塔',
    steps: [
      { id: 'shards', text: '收集 3 枚星之碎片（陨坑 / 浮空岛 / 海蚀拱）', done: ['shard_crater', 'shard_isle', 'shard_arch'] },
      { id: 'altar', text: '在断崖神殿献上碎片，点亮星辉祭坛', done: ['temple_altar'] },
      { id: 'lamp', text: '登上守望灯塔，点亮明灯', done: ['lighthouse_lamp'] },
    ],
  },
};
const { bytes, tris } = await writeRegion({ file: 'world_coast', world: COAST, terrain, pieces, markers, layout, waterSize: 4000 });
console.log(
  `world_coast.glb ${(bytes / 1024 / 1024).toFixed(2)} MB, ~${Math.round(tris / 1000)}k tris, ` +
    `${markers.length} markers, ${pieces.length} pieces, ${((performance.now() - t0) / 1000).toFixed(1)}s`,
);
