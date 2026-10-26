// The ASTER Arena map, read in place from ../arena (owned by the map pipeline).
import raw from '../../arena/runtime/map.json';
import { buildMap, type MapData } from './map.ts';

export const MAP_DATA = raw as unknown as MapData;
export const ARENA_MAP = buildMap(MAP_DATA);
