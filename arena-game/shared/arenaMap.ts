// Arena maps, read in place from their map pipelines (never copied):
//   aster  ../arena/runtime/map.json                 (ASTER research station, the first map)
//   zenith ../arena-maps/zenith/runtime/map.json     (ZENITH sky terrace)
// All maps share one data format, so collision, nav, bots and rules work unchanged on each.
import aster from '../../arena/runtime/map.json';
import zenith from '../../arena-maps/zenith/runtime/map.json';
import { buildMap, type ArenaMap, type MapData } from './map.ts';

export interface MapInfo {
  id: string;
  name: string;
  blurb: string;
  data: MapData;
}

export const MAPS: MapInfo[] = [
  { id: 'aster', name: 'ASTER 研究站', blurb: '72×56 · 镜像对称 · 北侧长廊高台 + 中央反应堆庭院', data: aster as unknown as MapData },
  { id: 'zenith', name: 'ZENITH 日冕天台', blurb: '60×44 · 点对称 · 两座对角高台 + 花园侧翼 + 日晷中庭', data: zenith as unknown as MapData },
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
