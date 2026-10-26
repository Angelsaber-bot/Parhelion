// 幻日谷 (Parhelion Valley) — WORLD 00, the 2026 hub: observatory HQ, armory, summoning hall, the
// Parhelion Tower, and the three era seams (west → 落日王国, north → 永冬之城, east pass → the coast).
// World first area layout. Single source of truth for
// the generator; exported to public/assets/world_alpha.layout.json for the viewer,
// minimap, and later the server / AI tooling.
//
// Coordinates: meters, Y up, +X = east, -Z = north (three.js default forward).

export type V2 = [number, number];

export const WORLD = {
  id: 'world_alpha_sundog_valley',
  name: '幻日谷',
  nameEn: 'Parhelion Valley',
  version: 2,
  seed: 20261026,
  half: 360, // map spans [-360, 360] on X and Z
  playHalf: 334, // invisible boundary walls
  cell: 2, // terrain grid resolution (m)
  waterLevel: 1.0,
};

export interface Area { id: string; name: string; nameEn: string; c: V2; r: number; color: string; tp: V2 }

export const AREAS: Area[] = [
  { id: 'camp', name: '初始营地', nameEn: 'Landing Camp', c: [5, 165], r: 34, color: '#f08a4b', tp: [3, 159] },
  { id: 'hq', name: '幻日观测所', nameEn: 'Parhelion Observatory', c: [-118, 222], r: 26, color: '#6ff4ff', tp: [-112, 246] },
  { id: 'armory', name: '枪械工坊', nameEn: 'Armory', c: [-70, 252], r: 20, color: '#f4c95d', tp: [-92, 252] },
  { id: 'summon', name: '召唤大厅', nameEn: 'Summoning Hall', c: [-166, 256], r: 20, color: '#c9a2ff', tp: [-144, 256] },
  { id: 'tower', name: '幻日塔', nameEn: 'Parhelion Tower', c: [0, -162], r: 34, color: '#ffd76a', tp: [0, -142] },
  { id: 'lake', name: '镜湖', nameEn: 'Mirror Lake', c: [0, -10], r: 44, color: '#46b8d8', tp: [-26, 16] },
  { id: 'forest', name: '回声森林', nameEn: 'Echo Forest', c: [110, 40], r: 70, color: '#3d9a58', tp: [92, 72] },
  { id: 'station', name: '废弃前哨站', nameEn: 'Abandoned Outpost', c: [-140, -51], r: 42, color: '#e8e6df', tp: [-140, -8] },
  { id: 'falls', name: '雾瀑', nameEn: 'Mist Falls', c: [158, -60], r: 22, color: '#9fe3f0', tp: [140, -46] },
  { id: 'ford', name: '西岸渡口', nameEn: 'West Ford', c: [-95, 62], r: 26, color: '#c9a46b', tp: [-84, 82] },
  { id: 'seam_w', name: '西部时层', nameEn: 'Western Era Seam', c: [-304, -30], r: 30, color: '#ffb36b', tp: [-280, -30] },
  { id: 'seam_n', name: '北方冰海断面', nameEn: 'Northern Ice Seam', c: [0, -292], r: 40, color: '#bfe9ff', tp: [0, -246] },
  { id: 'pass', name: '东部山口', nameEn: 'Eastern Pass', c: [300, 30], r: 30, color: '#7fb0ff', tp: [276, 30] },
];

// River: waterfall pond -> Mirror Lake -> out through the SW gorge.
export const POND = { c: [148, -60] as V2, r: 10 };
export const LAKE = { c: [0, -10] as V2, r: 36 };
export const ISLAND = { c: [6, -16] as V2, r: 7 };
export const RIVER: V2[] = [
  [148, -60], [118, -48], [80, -36], [45, -26], [20, -16], // into the lake
];
export const RIVER_OUT: V2[] = [
  [-18, 12], [-58, 38], [-95, 60], [-140, 76], [-190, 92], [-250, 108], [-310, 122], [-380, 138],
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
  [[132, 40], [170, 32], [210, 30], [260, 30], [320, 30], [360, 30]],
  // camp -> observatory HQ plaza
  [[-6, 146], [-34, 152], [-62, 182], [-90, 212], [-112, 236]],
  // HQ -> west ford bridge
  [[-130, 214], [-124, 170], [-108, 120], [-96, 82]],
  // outpost -> western era seam
  [[-176, -36], [-230, -34], [-280, -30], [-300, -30]],
  // tower -> northern ice seam
  [[2, -178], [8, -212], [0, -244]],
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
/** Mountain pass on the east edge that leads into 星落海岸 (world x > 360). */
export const PASS = { z: 30, y: 16 };
/** Observatory HQ campus terrace (south-west of the camp) and its buildings. */
export const CAMPUS = { x0: -200, x1: -40, z0: 196, z1: 292, y: 10 };
export const PLAZA = { c: [-118, 246] as V2, r: 15 };
export const HQ = { x0: -138, x1: -98, z0: 202, z1: 224 };
export const ARMORY = { x0: -86, x1: -62, z0: 238, z1: 262 };
export const SUMMON = { c: [-166, 256] as V2, r: 12 };
/** Era seams: west (落日王国), north on the frozen bay (永冬之城), east at the pass (星落海岸 → 黑帆尽头). */
export const SEAM_W = { c: [-310, -30] as V2 };
export const BAY_N = { c: [0, -292] as V2, rx: 64, rz: 40 };
export const SEAM_N = { c: [0, -318] as V2 };
export const SEAM_E = { c: [318, 30] as V2 };
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
