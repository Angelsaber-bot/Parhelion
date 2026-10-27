// Generates World 04 (业火京都 Kyoto Ablaze, 1582) as GLB + layout JSON.
//   npm run build:kyoto
// Same node contract as the other regions (ART / COLLISION / MARKERS).
import { buildKyotoTerrain } from './gen/kyoto/terrain.js';
import { buildKyoto } from './gen/kyoto/build.js';
import { KYOTO, AREAS, PATHS, CORE, CITY_Y, HONNOJI, KIYOMIZU, SANJO, PAVILION } from './gen/kyoto/layout.js';
import { writeRegion } from './gen/export.js';

const t0 = performance.now();
const terrain = buildKyotoTerrain();
const { pieces, markers } = buildKyoto(terrain.heightAt);

const layout = {
  world: KYOTO,
  areas: AREAS,
  paths: PATHS,
  markers,
  lights: [
    { p: [CORE.c[0], CITY_Y + 16, CORE.c[1]], color: '#ff7a3a', intensity: 160, distance: 80 },
    { p: [HONNOJI.c[0] - 18, CITY_Y + 14, HONNOJI.c[1]], color: '#ff8a3a', intensity: 120, distance: 70 },
    { p: [(SANJO.x0 + SANJO.x1) / 2, SANJO.y + 5, SANJO.z], color: '#ffcf7a', intensity: 50, distance: 30 },
    { p: [KIYOMIZU.stage.c[0], KIYOMIZU.y + 6, KIYOMIZU.stage.c[1]], color: '#ffd6a0', intensity: 60, distance: 36 },
    { p: [PAVILION.c[0], 10, PAVILION.c[1] + 8], color: '#ffe08a', intensity: 70, distance: 40 },
  ],
  atmosphere: { fog: '#6a4048', near: 110, far: 640 },
  objective: {
    id: 'quench_the_hellfire',
    name: '业火京都：熄灭本能寺的业火',
    steps: [
      { id: 'meet', text: '在鸭川的三条大桥上找到宫本武藏', done: ['musashi_meet'] },
      { id: 'kinkaku', text: '踩着镜湖池里的石头走到金阁，取得碎片·金阁', done: ['shard_kinkaku'] },
      { id: 'kiyomizu', text: '登上三年坂，在清水舞台上取得碎片·舞台', done: ['shard_kiyomizu'] },
      { id: 'kikyo', text: '射落明智军阵的 3 面桔梗大旗，取得碎片·桔梗', done: ['kikyo_banner_1', 'kikyo_banner_2', 'kikyo_banner_3', 'shard_kikyo'] },
      { id: 'core', text: '在本能寺点亮京之核，击败业火之主', done: ['fire_core'] },
      { id: 'contract', text: '回到三条大桥，与宫本武藏缔结契约', done: ['musashi_contract'] },
    ],
  },
};
const { bytes, tris } = await writeRegion({ file: 'world_kyoto', world: KYOTO, terrain, pieces, markers, layout });
console.log(
  `world_kyoto.glb ${(bytes / 1024 / 1024).toFixed(2)} MB, ~${Math.round(tris / 1000)}k tris, ` +
    `${markers.length} markers, ${pieces.length} pieces, ${((performance.now() - t0) / 1000).toFixed(1)}s`,
);
