// 幻日谷 (Sundog Valley) — World first area layout. Single source of truth for
// the generator; exported to public/assets/world_alpha.layout.json for the viewer,
// minimap, and later the server / AI tooling.
//
// Coordinates: meters, Y up, +X = east, -Z = north (three.js default forward).

export type V2 = [number, number];

export const WORLD = {
  id: 'world_alpha_sundog_valley',
  name: '幻日谷',
  nameEn: 'Sundog Valley',
  version: 1,
  seed: 20261026,
  half: 240, // map spans [-240, 240] on X and Z
  playHalf: 214, // invisible boundary walls
  cell: 2, // terrain grid resolution (m)
  waterLevel: 1.0,
};

export interface Area { id: string; name: string; nameEn: string; c: V2; r: number; color: string; tp: V2 }

export const AREAS: Area[] = [
  { id: 'camp', name: '降落营地', nameEn: 'Landing Camp', c: [5, 165], r: 34, color: '#f08a4b', tp: [3, 159] },
  { id: 'lake', name: '镜湖', nameEn: 'Mirror Lake', c: [0, -10], r: 44, color: '#46b8d8', tp: [-26, 16] },
  { id: 'forest', name: '回声森林', nameEn: 'Echo Forest', c: [110, 40], r: 70, color: '#3d9a58', tp: [92, 72] },
  { id: 'station', name: '旧观测站', nameEn: 'Old Observatory', c: [-140, -51], r: 42, color: '#e8e6df', tp: [-140, -8] },
  { id: 'tower', name: '幻日塔', nameEn: 'Parhelion Tower', c: [0, -162], r: 34, color: '#ffd76a', tp: [0, -142] },
  { id: 'falls', name: '雾瀑', nameEn: 'Mist Falls', c: [158, -60], r: 22, color: '#9fe3f0', tp: [140, -46] },
  { id: 'ford', name: '西岸渡口', nameEn: 'West Ford', c: [-95, 62], r: 26, color: '#c9a46b', tp: [-84, 82] },
];

// River: waterfall pond -> Mirror Lake -> out through the SW gorge.
export const POND = { c: [148, -60] as V2, r: 10 };
export const LAKE = { c: [0, -10] as V2, r: 36 };
export const ISLAND = { c: [6, -16] as V2, r: 7 };
export const RIVER: V2[] = [
  [148, -60], [118, -48], [80, -36], [45, -26], [20, -16], // into the lake
];
export const RIVER_OUT: V2[] = [
  [-18, 12], [-58, 38], [-95, 60], [-140, 76], [-190, 92], [-250, 108],
];

// Dirt trails (visual only; they are suggestions, the whole valley is open).
export const PATHS: V2[][] = [
  // camp -> ford bridge -> station south gate
  [[2, 142], [-22, 118], [-60, 92], [-88, 74], [-102, 50], [-124, 22], [-140, -14]],
  // camp -> forest ruin
  [[16, 144], [48, 118], [86, 80], [110, 50]],
  // lake west shore -> tower
  [[-24, 14], [-44, -20], [-36, -60], [-16, -100], [-4, -136]],
  // forest ruin -> log bridge -> tower
  [[112, 30], [96, -4], [82, -36], [64, -78], [30, -126], [10, -142]],
  // station back door -> tower (escape route)
  [[-156, -86], [-124, -118], [-70, -146], [-18, -160]],
  // forest -> east pass -> 星落海岸
  [[132, 40], [170, 32], [210, 30], [240, 30]],
  // forest -> falls
  [[104, 10], [128, -34], [140, -48]],
];

// Key structures
export const CAMP = { c: [5, 165] as V2, top: 20 };
export const STATION = { x0: -175, x1: -105, z0: -82, z1: -20, y: 8 };
export const RUIN = { c: [116, 36] as V2 };
export const TOWER = { c: [0, -162] as V2, top: 30 };
export const FALLS = { x: 166, z: -60 };
export const CAVE = { x0: 172, x1: 192, z0: -68, z1: -52, floor: 2.4, ceil: 9 };
export const BRIDGE = { c: [-95, 61] as V2 };
/** Mountain pass on the east edge that leads into 星落海岸 (world x > 240). */
export const PASS = { z: 30, y: 16 };
export const LOG_BRIDGE = { c: [81, -36] as V2 };

export type MarkerType =
  | 'spawn' | 'objective' | 'interact' | 'discovery' | 'enemy' | 'cover' | 'poi';

export interface Marker {
  id: string;
  type: MarkerType;
  label: string;
  p: [number, number, number];
  radius?: number;
  requires?: string[];
  note?: string;
}
