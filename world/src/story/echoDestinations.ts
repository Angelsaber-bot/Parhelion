import { WORLD_REGION_IDS, type WorldRegionId } from '../core/regionIdentity';
import type { Localized } from '../settlements/types';

interface EchoDestination {
  map: string;
  title: Localized;
  /** Local metres at the roadside plinth, plus its bearing towards the reader. */
  x: number;
  z: number;
  yaw: number;
  stone: string;
  trim: string;
}

export const ECHO_DESTINATIONS = {
  home: { map: 'homeward', title: ['归灯回街', 'Homeward Circuit'], x: 91, z: -100, yaw: -Math.PI/2, stone: '#adad9c', trim: '#ac925e' },
  alpha: { map: 'aster', title: ['极光研究站', 'Aster Research Station'], x: -18, z: 116, yaw: -1.04, stone: '#596d78', trim: '#7fbcbf' },
  britain: { map: 'camlann', title: ['誓约荒原', 'Camlann'], x: 266, z: -31, yaw: .12, stone: '#827e72', trim: '#b89a62' },
  blacksail: { map: 'blackflag', title: ['黑帆战舰', 'Blackflag'], x: -286, z: 34, yaw: Math.PI, stone: '#685447', trim: '#ba9271' },
  winter: { map: 'frostcourt', title: ['永冬庭院', 'Frostcourt'], x: 26, z: 293, yaw: -1.42, stone: '#727f8c', trim: '#bfd4d2' },
  kyoto: { map: 'sakura', title: ['樱庭', 'Sakura Courtyard'], x: 48, z: -203, yaw: -Math.PI/2, stone: '#635752', trim: '#ba5946' },
  orleans: { map: 'orleans', title: ['奥尔良河城', 'Orléans'], x: -64, z: 83, yaw: -2.28, stone: '#9c9687', trim: '#42677b' },
  egypt: { map: 'suntemple', title: ['日轮神殿', 'Sun Temple'], x: -143, z: 119, yaw: Math.PI, stone: '#c19a6f', trim: '#398e91' },
  qin: { map: 'lishan', title: ['骊山地宫', 'Lishan'], x: -161, z: 97, yaw: Math.PI, stone: '#777971', trim: '#985446' },
} satisfies Record<WorldRegionId, EchoDestination>;

export function echoMarkerId(region: WorldRegionId) {
  return region === 'home' ? 'home_echo_hall' : `arena_echo_${region}`;
}

const regionsByMarker = new Map(WORLD_REGION_IDS.map(region => [echoMarkerId(region), region]));

export function echoMarkerRegion(id: string | null): WorldRegionId | undefined {
  return id === null ? undefined : regionsByMarker.get(id);
}
