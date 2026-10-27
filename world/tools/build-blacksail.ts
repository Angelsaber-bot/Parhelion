// Generates World 02 (黑帆尽头 Black Sail's End, 1718) as GLB + layout JSON.
//   npm run build:blacksail
// Same node contract as the other regions (ART / COLLISION / MARKERS); the layout adds the wreck updrafts.
import { buildBlacksailTerrain } from './gen/blacksail/terrain.js';
import { buildBlacksail } from './gen/blacksail/build.js';
import { BLACKSAIL, AREAS, PATHS, UPDRAFTS, LIGHTHOUSE, FLEET, TAVERN, PORT } from './gen/blacksail/layout.js';
import { writeRegion } from './gen/export.js';

const t0 = performance.now();
const terrain = buildBlacksailTerrain();
const { pieces, markers } = buildBlacksail(terrain.heightAt);
const lh = terrain.heightAt(LIGHTHOUSE.c[0], LIGHTHOUSE.c[1]);
const flag = FLEET.find((f) => f.id === 'flag')!;

const layout = {
  world: BLACKSAIL,
  areas: AREAS,
  paths: PATHS,
  markers,
  updrafts: UPDRAFTS,
  lights: [
    { p: [LIGHTHOUSE.c[0], lh + LIGHTHOUSE.h + 4, LIGHTHOUSE.c[1]], color: '#8fd8ff', intensity: 140, distance: 80 },
    { p: [flag.c[0], flag.deck + 10, flag.c[1]], color: '#6fe7c8', intensity: 90, distance: 50 },
    { p: [TAVERN.c[0], PORT.y + 5, TAVERN.c[1]], color: '#ffb36b', intensity: 50, distance: 28 },
  ],
  atmosphere: { fog: '#b9c9d8', near: 130, far: 800, sea: true },
  objective: {
    id: 'quench_the_cold_lamp',
    name: '黑帆尽头：熄灭冷灯',
    steps: [
      { id: 'meet', text: '在拿骚港的酒馆找到黑胡子', done: ['blackbeard_meet'] },
      { id: 'powder', text: '登上黑胡子要塞，用炮台击沉 3 艘幽灵小艇，取得碎片·火药', done: ['fort_cannon', 'ghost_boat_1', 'ghost_boat_2', 'ghost_boat_3', 'shard_powder'] },
      { id: 'compass', text: '乘上升气流攀上浮空沉船群，取得碎片·罗盘', done: ['shard_compass'] },
      { id: 'treasure', text: '找齐 3 片藏宝图，在骷髅礁挖出碎片·藏宝', done: ['map_piece_1', 'map_piece_2', 'map_piece_3', 'shard_treasure'] },
      { id: 'core', text: '走过幽灵栈桥登上旗舰，击败亡航提督，点亮海之核', done: ['sea_core'] },
      { id: 'contract', text: '回到酒馆，与黑胡子缔结契约', done: ['blackbeard_contract'] },
    ],
  },
};
const { bytes, tris } = await writeRegion({ file: 'world_blacksail', world: BLACKSAIL, terrain, pieces, markers, layout, waterSize: 4800 });
console.log(
  `world_blacksail.glb ${(bytes / 1024 / 1024).toFixed(2)} MB, ~${Math.round(tris / 1000)}k tris, ` +
    `${markers.length} markers, ${pieces.length} pieces, ${((performance.now() - t0) / 1000).toFixed(1)}s`,
);
