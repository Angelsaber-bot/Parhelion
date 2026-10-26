// 落日王国 (Sunset Kingdom) — World 01, Britain around 537 under an eternal dusk. It lies west of
// 幻日谷 and is entered on foot through the western era seam (valley x = -334, z = -30).
//
// Coordinates: region-local metres, Y up, +X = east, -Z = north. The east edge (x = 360) meets the valley.

import type { V2, Area } from '../layout.js';

export const BRITAIN = {
  id: 'world_britain_sunset_kingdom',
  name: '落日王国',
  nameEn: 'Sunset Kingdom',
  version: 1,
  seed: 5370537,
  half: 360,
  playHalf: 334,
  cell: 2,
  waterLevel: 1.0,
};

/** Where this region sits in the shared world: directly west of 幻日谷. */
export const OFFSET: V2 = [-720, 0];
/** The seam gorge enters from the east edge at this z. */
export const SEAM_Z = -30;

export const AREAS: Area[] = [
  { id: 'mistwood', name: '迷雾森林', nameEn: 'Mistwood', c: [230, -20], r: 70, color: '#8fb36a', tp: [300, -30] },
  { id: 'swordlake', name: '圣剑湖', nameEn: 'Lake of the Sword', c: [40, 90], r: 62, color: '#7fd1e0', tp: [40, 22] },
  { id: 'knights', name: '骑士营地', nameEn: "Knights' Camp", c: [170, -200], r: 40, color: '#5f8bd8', tp: [170, -150] },
  { id: 'camelot', name: '卡美洛外围', nameEn: 'Camelot Outskirts', c: [-190, -190], r: 70, color: '#f2e2b8', tp: [-122, -122] },
  { id: 'roundtable', name: '圆桌大厅', nameEn: 'Round Table Hall', c: [-215, -165], r: 15, color: '#ffd76a', tp: [-192, -165] },
  { id: 'camlann', name: '卡姆兰战场', nameEn: 'Camlann', c: [-200, 200], r: 85, color: '#e0664f', tp: [-110, 165] },
];

export const LAKE = { c: [40, 90] as V2, r: 56 };
export const ISLET = { c: [40, 96] as V2, r: 9 };
export const KCAMP = { c: [170, -200] as V2, r: 32 };
/** Camelot outskirts: walled town on a plateau; the gate faces south-east toward the lake road. */
export const CASTLE = { c: [-190, -190] as V2, r: 62, top: 34, gateA: Math.PI / 4 };
export const KEEP = { c: [-160, -214] as V2, r: 6, h: 26 };
export const HALL = { c: [-215, -165] as V2, r: 13 };
export const CAMLANN = { c: [-200, 200] as V2, r: 90 };
export const CORE = { c: [-206, 212] as V2 };
/** Camelot itself: a far silhouette on the north-west mountains (not reachable in the Alpha). */
export const CAMELOT_FAR = { c: [-306, -312] as V2 };

export const PATHS: V2[][] = [
  // seam gorge -> Mistwood -> lake north shore
  [[360, -30], [300, -30], [240, -24], [180, -8], [110, 12], [56, 26]],
  // Mistwood -> knights' camp
  [[204, -26], [204, -100], [176, -150]],
  // lake west shore -> Camelot gate
  [[2, 58], [-60, 8], [-104, -86], [-140, -140]],
  // lake south-west -> Camlann
  [[-4, 128], [-60, 166], [-120, 184]],
];
