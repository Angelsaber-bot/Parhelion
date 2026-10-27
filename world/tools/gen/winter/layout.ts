// 永冬之城 (Everwinter City) — World 03, Russia in the winter of 1812, the year the Grande Armée froze.
// North of 幻日谷 through the northern ice seam (valley x = 0, z = -318): the frozen sea arm under the
// seam runs on as the frozen Berezina. Its crossing, Napoleon's bivouac, the beacon snowfield, burnt
// Moscow with the Kremlin and Red Square, and a frozen gorge with an ice cavern.
//
// Coordinates: region-local metres, Y up, +X = east, -Z = north. The south edge (z = +360) meets the
// valley's north edge; the region sits at world offset (0, -720).

import type { V2, Area } from '../layout.js';

export const WINTER = {
  id: 'world_everwinter',
  name: '永冬之城',
  nameEn: 'Everwinter City',
  version: 1,
  seed: 18121126,
  half: 360,
  playHalf: 334,
  cell: 2,
  waterLevel: 1.0,
};

/** Where this region sits in the shared world: directly north of 幻日谷. */
export const OFFSET: V2 = [0, -720];
/** The frozen river's surface (the valley's ice bay is at the same height). */
export const ICE_Y = WINTER.waterLevel + 0.12;

/** The frozen Berezina: from the valley's ice seam north, bending east into the gorge. */
export const RIVER: V2[] = [[0, 380], [0, 300], [-8, 240], [14, 180], [70, 132], [150, 104], [218, 70], [258, 14], [280, -56], [296, -128]];
export const RIVER_W = 18;
/** Two of General Eblé's pontoon bridges across the crossing (z of each), half-wrecked. */
export const CROSSING = { c: [-4, 250] as V2, bridges: [228, 262] };
export const BIVOUAC = { c: [-190, 170] as V2, y: 6 };
/** Napoleon's field tent: where he waits, and where the contract is made. */
export const IMPERIAL_TENT = { c: [-176, 132] as V2, w: 12, d: 9 };
/** Three beacon fires on the western snowfield, and the cairn of lost eagles between them. */
export const BEACONS: V2[] = [[-286, 76], [-168, 34], [-262, -52]];
export const EAGLE = { c: [-224, 22] as V2 };
/** Burnt Moscow on its hill: the Kremlin, Ivan the Great's bell tower, Red Square and the cathedral. */
export const CITY = { c: [44, -196] as V2, y: 12 };
export const KREMLIN = { c: [-6, -206] as V2, r: 52 };
export const BELL = { c: [-8, -214] as V2, h: 40 };
export const REDSQ = { c: [96, -200] as V2, w: 40, d: 76 };
export const BASIL = { c: [96, -252] as V2 };
export const CORE = { c: [96, -228] as V2 };
/** The gorge narrows where three frost seals hold an ice wall across the river; the cavern lies beyond. */
export const GORGE = { from: 6, to: 9 }; // RIVER segment indices walled by cliffs
export const ICE_GATE = { c: [272, -30] as V2, ry: 0.28 };
export const CAVERN = { c: [296, -128] as V2, r: 22 };

export const AREAS: Area[] = [
  { id: 'crossing', name: '别列津纳渡口', nameEn: 'Berezina Crossing', c: [0, 260], r: 50, color: '#bfe9ff', tp: [0, 318] },
  { id: 'bivouac', name: '大军营地', nameEn: 'Grande Armée Bivouac', c: [-190, 170], r: 60, color: '#f0b36b', tp: [-140, 186] },
  { id: 'snowfield', name: '烽火雪原', nameEn: 'Beacon Snowfield', c: [-224, 22], r: 80, color: '#e8eef8', tp: [-160, 74] },
  { id: 'moscow', name: '燃烧的莫斯科', nameEn: 'Burning Moscow', c: [40, -120], r: 56, color: '#ff8a5c', tp: [40, -86] },
  { id: 'kremlin', name: '克里姆林宫', nameEn: 'The Kremlin', c: [-6, -206], r: 50, color: '#d9534f', tp: [-6, -168] },
  { id: 'redsquare', name: '红场', nameEn: 'Red Square', c: [96, -200], r: 36, color: '#9fd0ff', tp: [96, -168] },
  { id: 'gorge', name: '冰封峡谷', nameEn: 'Frozen Gorge', c: [262, 10], r: 50, color: '#7fd8ff', tp: [214, 76] },
];

export const PATHS: V2[][] = [
  // seam -> crossing bank -> bivouac
  [[22, 300], [30, 262], [-40, 214], [-100, 196], [-140, 186]],
  // bivouac -> snowfield (beacon road)
  [[-158, 150], [-160, 112], [-190, 96], [-200, 60], [-210, 30]],
  // crossing -> Smolensk road north -> Moscow outskirts
  [[30, 262], [60, 200], [50, 120], [40, 40], [40, -40], [40, -100]],
  // outskirts -> Kremlin south gate / Red Square
  [[40, -100], [20, -140], [-6, -150]],
  [[40, -100], [80, -150], [96, -168]],
  // crossing -> river bank east -> gorge mouth
  [[60, 200], [120, 150], [190, 110], [214, 76]],
];
