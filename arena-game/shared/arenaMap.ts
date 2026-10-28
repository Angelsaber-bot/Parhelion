// Arena maps, read in place from their map pipelines (never copied):
//   aster  ../arena/runtime/map.json                 (ASTER research station, the first map)
//   <id>   ../arena-maps/<id>/runtime/map.json       (the four other chapter arenas)
// All maps share one data format, so collision, nav, bots and rules work unchanged on each.
import aster from '../../arena/runtime/map.json';
import sakura from '../../arena-maps/sakura/runtime/map.json';
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
  /** Chapter number shown in the lobby. */
  chapter: number;
}

export const MAPS: MapInfo[] = [
  { id: 'aster', name: 'ASTER 研究站', blurb: '极光研究站 · 长廊高台', data: aster as unknown as MapData, preset: 'aurora', chapter: 1 },
  { id: 'camlann', name: 'CAM LANN 誓约荒原', blurb: '亚瑟王 · 石垒废墟', data: camlann as unknown as MapData, chapter: 2 },
  { id: 'blackflag', name: 'BLACKFLAG 黑帆战舰', blurb: '黑胡子 · 双舷甲板', data: blackflag as unknown as MapData, chapter: 3 },
  { id: 'frostcourt', name: 'FROSTCOURT 永冬庭院', blurb: '拿破仑 · 雪庭拱廊', data: frostcourt as unknown as MapData, chapter: 4 },
  { id: 'sakura', name: 'SAKURA 樱庭', blurb: '黄昏神社 · 经典三路', data: sakura as unknown as MapData, chapter: 5 },
];
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
