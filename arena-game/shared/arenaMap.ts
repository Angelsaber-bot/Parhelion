// Arena maps, read in place from their map pipelines (never copied):
//   aster  ../arena/runtime/map.json                 (ASTER research station, the first map)
//   zenith ../arena-maps/zenith/runtime/map.json     (ZENITH sky terrace)
//   sakura ../arena-maps/sakura/runtime/map.json     (SAKURA shrine at dusk)
//   neon   ../arena-maps/neon/runtime/map.json       (NEON harbour container yard at night)
// All maps share one data format, so collision, nav, bots and rules work unchanged on each.
import aster from '../../arena/runtime/map.json';
import zenith from '../../arena-maps/zenith/runtime/map.json';
import sakura from '../../arena-maps/sakura/runtime/map.json';
import neon from '../../arena-maps/neon/runtime/map.json';
import blackflag from '../../arena-maps/blackflag/runtime/map.json';
import frostcourt from '../../arena-maps/frostcourt/runtime/map.json';
import camlann from '../../arena-maps/camlann/runtime/map.json';
import { buildMap, type ArenaMap, type MapData } from './map.ts';

export interface MapInfo {
  id: string;
  name: string;
  blurb: string;
  data: MapData;
  /** Client atmosphere when the map data has none (ASTER's map.json is owned by its own pipeline). */
  preset?: string;
  /** Five chapter arenas are the primary choices. Legacy IDs remain loadable by URL/rooms. */
  chapter?: number;
}

export const MAPS: MapInfo[] = [
  { id: 'aster', name: 'ASTER 研究站', blurb: '72×56 · 极光下的极地研究站 · 北侧长廊高台 + HELIOS 反应堆庭院', data: aster as unknown as MapData, preset: 'aurora', chapter: 1 },
  { id: 'zenith', name: 'ZENITH 日冕天台', blurb: '60×48 · 三层阶梯 · 下沉日晷池 + 双塔悬台 + 高台出生', data: zenith as unknown as MapData },
  { id: 'sakura', name: 'SAKURA 樱庭', blurb: '64×44 · 黄昏神社 · 经典三路：参道长枪 / 拜殿室内近战 / 锦鲤池', data: sakura as unknown as MapData, chapter: 5 },
  { id: 'neon', name: 'NEON 夜港', blurb: '56×56 · 霓虹夜景 · 集装箱迷宫 + 对角出生 + 5 米吊桥甲板', data: neon as unknown as MapData },
  { id: 'camlann', name: 'CAM LANN 誓约荒原', blurb: '64×48 · 亚瑟王 · 低矮石垒、破损木厅与草土战场 · 双坡道遗址', data: camlann as unknown as MapData, chapter: 2 },
  { id: 'blackflag', name: 'BLACKFLAG 黑帆战舰', blurb: '64×34 · 黑胡子 · 木甲板、风帆与升高艉楼 · 双舷环线', data: blackflag as unknown as MapData, chapter: 3 },
  { id: 'frostcourt', name: 'FROSTCOURT 永冬庭院', blurb: '60×48 · 拿破仑 · 飘雪石庭、冰封喷泉与单侧拱廊', data: frostcourt as unknown as MapData, chapter: 4 },
];
export const CHAPTER_MAPS: MapInfo[] = MAPS.filter((m) => m.chapter !== undefined).sort((a, b) => a.chapter! - b.chapter!);
export const DEFAULT_MAP = 'aster';

const built = new Map<string, ArenaMap>();
/** Built collision map for an id; unknown ids fall back to the default map. */
export function getMap(id?: string): ArenaMap {
  const info = MAPS.find((m) => m.id === id) ?? MAPS.find((m) => m.id === DEFAULT_MAP)!;
  let m = built.get(info.id);
  if (!m) { m = buildMap(info.data); built.set(info.id, m); }
  return m;
}
export const mapIdOf = (id?: string) => (MAPS.some((m) => m.id === id) ? id! : DEFAULT_MAP);

export const MAP_DATA = getMap(DEFAULT_MAP).data;
export const ARENA_MAP = getMap(DEFAULT_MAP);
