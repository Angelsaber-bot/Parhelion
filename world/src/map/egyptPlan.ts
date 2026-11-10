/**
 * Solar Egypt: an oasis and its river in the west, a sandstone plateau across the north
 * cut by the Sunrift canyon, the colossi and the Sun Temple on the plateau's lip, a pyramid
 * beyond, dunes and a warm coast to the south and east. Region-local coordinates
 * (world = local + [720, 720]); -Z is north. Shared by generator, runtime and tests.
 */
export type EgyptPoint = readonly [number, number, number];
export const EGYPT_OFFSET = [0, -1440] as const;
/** Egypt is turned half a circle: authored (x,z) sits at EGYPT_OFFSET + (-x,-z). */
export const EGYPT_FRAME = { offset: EGYPT_OFFSET, rotated: true } as const;
/** Egypt authored (x,z) → world, and back (a half turn is its own inverse). */
export const egyptToWorld = (x: number, z: number): [number, number] => [EGYPT_OFFSET[0] - x, EGYPT_OFFSET[1] - z];
export const worldToEgypt = (x: number, z: number): [number, number] => [EGYPT_OFFSET[0] - x, EGYPT_OFFSET[1] - z];

/** Spring lake at the oasis and the river it feeds, falling to the southern shore. */
export const EGYPT_LAKE = { x: -205, z: 150, rx: 38, rz: 26, surface: 12.4 } as const;
export const EGYPT_RIVER: readonly EgyptPoint[] = [[-178, 11.8, 168], [-140, 10.6, 182], [-95, 9.4, 176], [-48, 8.2, 158], [-5, 7, 152], [30, 5.6, 172], [52, 3.8, 210], [62, 1.2, 252], [66, -1.5, 300]];

/** Sandstone plateau: a polygon of the escarpment edge, top height and how sharp the cliffs are. */
export const EGYPT_PLATEAU = {
  edge: [[-250, -40], [-210, -52], [-150, -40], [-120, -50], [-60, -70], [-10, -64], [30, -60], [130, -60], [190, -78], [260, -60], [310, -90], [300, -230], [262, -258], [230, -292], [192, -270], [150, -300], [100, -284], [40, -282], [2, -302], [-60, -296], [-108, -272], [-150, -300], [-200, -278], [-235, -270], [-246, -218], [-268, -186], [-262, -160], [-238, -112]] as [number, number][],
  top: 36, cliff: 7,
};
/** 裂日峡谷: the canyon floor polyline from the desert up onto the plateau. */
export const EGYPT_CANYON: readonly EgyptPoint[] = [[-128, 14.2, -38], [-112, 16, -70], [-92, 19, -104], [-66, 24, -126], [-36, 29.5, -128], [-6, 35.8, -122]];

/** The Sun Temple and its terrace on the plateau's southern lip. */
export const EGYPT_TEMPLE = {
  terrace: [32, 128, -198, -78, 30] as const,
  pylon: { z: -90, depth: 10, towers: [[44, 72], [88, 116]] as [number, number][], height: 18 },
  court: [40, 120, -125, -95] as const,
  hall: [40, 120, -166, -125, 10] as const,
  sanctuary: [66, 94, -192, -166, 9] as const,
  columns: { x: [46, 54, 68, 92, 106, 114], z: [-131, -141, -158] },
  roofShrine: [56, 40, -150] as const,
  courtRoof: 40,
};
/** 引光: the sun-disc emitter, three turnable bronze mirrors and the sun disc in the sanctuary. */
export const EGYPT_MIRRORS = {
  y: 32.4,
  emitter: { p: [108, -108] as [number, number], dir: [-1, 0] as [number, number] },
  mirrors: [
    { id: 'egypt_mirror_court', p: [60, -108] as [number, number] },
    { id: 'egypt_mirror_hall', p: [60, -150] as [number, number] },
    { id: 'egypt_mirror_axis', p: [80, -150] as [number, number] },
  ],
  target: [80, -189] as [number, number],
  solved: 'egypt_sun_sanctuary_lit',
  door: { x: 80, z: -191, width: 6, height: 5.5 },
};

/** Underground: the incline behind the sanctuary and the solar-barque tomb under the plateau. */
export interface EgyptRoom { id: string; x0: number; x1: number; z0: number; z1: number; floor: number; height: number }
export interface EgyptCorridor { id: string; a: EgyptPoint; b: EgyptPoint; width: number; height: number }
export const EGYPT_ROOMS: readonly EgyptRoom[] = [
  { id: 'barque-tomb', x0: 62, x1: 98, z0: -268, z1: -236, floor: 14, height: 11 },
];
export const EGYPT_CORRIDORS: readonly EgyptCorridor[] = [
  { id: 'tomb-incline', a: [80, 30, -192], b: [80, 14, -236], width: 6, height: 5.5 },
];

/** Low pads, [x, y, z, flat radius]. */
export const EGYPT_PADS: readonly (readonly [number, number, number, number])[] = [
  [-165, 14, 110, 30],  // caravan town
  [-30, 10, 140, 12],   // river quay
  [80, 24, 6, 40],      // court of colossi
  [165, 18, 125, 26],   // solar trial
  [190, 37, -200, 46],  // pyramid plateau
];

export function egyptDistanceToPolyline(x: number, z: number, line: readonly EgyptPoint[]): { d: number; y: number; t: number } {
  let best = { d: Infinity, y: line[0][1], t: 0 };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
    if (d < best.d) best = { d, y: a[1] + (b[1] - a[1]) * t, t: (i - 1 + t) / (line.length - 1) };
  }
  return best;
}
