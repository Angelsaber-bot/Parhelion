// 星落海岸 (Starfall Coast) — World region 2. A sea-facing region east of 幻日谷: beaches and a
// fishing pier in the south, a lighthouse headland in the west, a meteor crater with floating
// isles above it in the north, and a sky temple on the eastern cliff plateau.
//
// Traversal is the point of this region: updraft columns lift the player and the glider
// (Space in the air) carries them between floating isles, the lighthouse and the sea stacks.
//
// Coordinates: meters, Y up, +X = east, -Z = north. Ocean lies to the west and south.

import type { V2, Area } from '../layout.js';

export const COAST = {
  id: 'world_coast_starfall',
  name: '星落海岸',
  nameEn: 'Starfall Coast',
  version: 1,
  seed: 20261027,
  half: 240,
  playHalf: 214,
  cell: 2,
  waterLevel: 1.0,
};

export const AREAS: Area[] = [
  { id: 'pier', name: '潮汐码头', nameEn: 'Tide Pier', c: [70, 152], r: 34, color: '#f08a4b', tp: [62, 140] },
  { id: 'meadow', name: '风铃草原', nameEn: 'Bellwind Meadow', c: [10, 40], r: 50, color: '#8fd36b', tp: [12, 66] },
  { id: 'bay', name: '白沙湾', nameEn: 'Whitesand Bay', c: [-58, 118], r: 40, color: '#ecd9a0', tp: [-34, 104] },
  { id: 'light', name: '守望灯塔', nameEn: 'Watch Lighthouse', c: [-150, -20], r: 26, color: '#ff6b6b', tp: [-122, -20] },
  { id: 'crater', name: '星陨坑', nameEn: 'Starfall Crater', c: [10, -80], r: 44, color: '#a98bff', tp: [10, -30] },
  { id: 'isles', name: '浮空群岛', nameEn: 'Floating Isles', c: [76, -134], r: 40, color: '#9fe3f0', tp: [40, -112] },
  { id: 'temple', name: '断崖神殿', nameEn: 'Cliff Temple', c: [166, 0], r: 30, color: '#ffd76a', tp: [146, 8] },
];

/** Signed distance-ish to the coastline (positive on land). */
export const shoreX = (z: number) => -70 + 22 * Math.sin(z * 0.011 + 1);
export const shoreZ = (x: number) => 172 + 14 * Math.sin(x * 0.018);

export const BAY = { c: [-78, 132] as V2, r: 50 };
export const CRATER = { c: [10, -80] as V2, R: 36, floor: 5 };
export const HEADLAND = { a: [-48, -20] as V2, b: [-162, -20] as V2, r: 20 };
export const LIGHTHOUSE = { c: [-150, -20] as V2, h: 24 };
export const PLATEAU = { edge: 122, top: 36 };
export const TEMPLE = { c: [166, 0] as V2, r: 24 };
export const STAIRS = { z0: 14, z1: 46, lanes: [110, 114.5] };
export const VILLAGE = { c: [70, 150] as V2 };
export const PIER = { x: 70, z0: 166, z1: 210, y: 2.4 };
export const ARCH = { c: [-84, 142] as V2 };
export const PORTAL = { c: [48, 136] as V2 };

/** Floating isles: centre, top height, radius. */
export const ISLES: { id: string; c: V2; y: number; r: number }[] = [
  { id: 'i1', c: [40, -112], y: 30, r: 9 },
  { id: 'i2', c: [72, -128], y: 44, r: 11 },
  { id: 'i3', c: [100, -104], y: 56, r: 8 },
  { id: 'i4', c: [82, -162], y: 66, r: 13 },
  { id: 'i5', c: [124, -140], y: 48, r: 7 },
  { id: 'i6', c: [-12, -140], y: 20, r: 8 },
];

/** Updraft columns: x, z, radius, base y, top y. Kept in the layout so the runtime can lift the player. */
export const UPDRAFTS: { x: number; z: number; r: number; y0: number; y1: number }[] = [
  { x: 22, z: -72, r: 4, y0: 4, y1: 44 }, // crater core → glide to i1 / i6
  { x: 36, z: -108, r: 3, y0: 29, y1: 58 }, // i1 → i2
  { x: 76, z: -124, r: 3.5, y0: 43, y1: 72 }, // i2 → i3 / i4
  { x: 96, z: -100, r: 3, y0: 55, y1: 84 }, // i3 → i4
  { x: 104, z: 30, r: 3.5, y0: 6, y1: 46 }, // foot of the cliff → temple plateau shortcut
];

/** Sea stacks (rock pillars standing in the sea). */
export const STACKS: { c: V2; h: number; r: number }[] = [
  { c: [-128, 34], h: 18, r: 5 },
  { c: [-112, 70], h: 11, r: 4 },
  { c: [-186, 22], h: 14, r: 4.5 },
  { c: [-34, 196], h: 9, r: 3.5 },
  { c: [-120, -62], h: 13, r: 4 },
];

export const PATHS: V2[][] = [
  // pier village -> meadow -> crater south rim
  [[66, 140], [50, 110], [24, 70], [12, 30], [8, -10], [10, -40]],
  // meadow -> headland -> lighthouse
  [[8, 20], [-24, 0], [-50, -18], [-90, -20], [-136, -20]],
  // meadow -> bay
  [[14, 60], [-14, 86], [-38, 104]],
  // pier village -> foot of the cliff stairs
  [[80, 136], [100, 96], [108, 60], [110, 48]],
  // temple approach on the plateau
  [[124, 30], [140, 16], [150, 8]],
];
