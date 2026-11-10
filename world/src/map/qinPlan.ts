/**
 * Qin Empire: one complete Mount Li with the palace on its southern spur and a
 * buried city that grows out of the mountain's interior. Shared by the
 * generator (terrain/architecture), the runtime army-order mechanism and tests.
 * All coordinates are region-local (world = local + [720, -720]); -Z is north.
 */
export type QinPoint = readonly [number, number, number];
export const QIN_OFFSET = [720, -720] as const;

/** Crest polylines [x, crestHeight, z]. Heights fall away as broad Gaussian flanks. */
export const QIN_RIDGES: readonly { id: string; points: QinPoint[] }[] = [
  // 骊山主脊: north-west spur, the col where the palace spur branches, the summit and the eastern ridge.
  { id: 'lishan', points: [[-225,30,-15],[-155,50,-74],[-85,73,-118],[-15,96,-140],[60,113,-120],[130,150,-104],[190,124,-72],[250,84,-44],[300,48,-24]] },
  // 宫城支脊: from the col down past the watch tower and palace to the pass.
  { id: 'palace-spur', points: [[60,113,-120],[84,105,-96],[98,95,-72],[100,88,-50],[90,84,-32],[30,74,8],[-25,58,44],[-74,52,56]] },
  // 宫后山屏: the mountain closes behind the palace terrace like a screen.
  { id: 'palace-backdrop', points: [[60,113,-120],[35,100,-82],[0,84,-56],[-42,62,-36]] },
  // 宫前台地: the broad southern shoulder carrying the outer court.
  { id: 'palace-shoulder', points: [[-5,60,74],[55,67,68],[118,62,60]] },
  // 南岭: low southern hills framing the post-road valley.
  { id: 'south-hills', points: [[-170,36,205],[-112,46,128],[-74,52,106],[-40,46,150],[30,40,176],[95,34,170]] },
];

/** 骊水: a mountain stream from the pass, through the town, along the post road. */
export const QIN_STREAM: readonly QinPoint[] = [[-28,29,74],[-70,25.5,64],[-110,23,64],[-152,21,74],[-188,20,78],[-232,19,92],[-282,18,128],[-322,17.2,162]];

export const QIN_LEVELS = { town: 22, pass: 27, court: 58, terrace: 70, pavilion: 82, foundry: 46, army: 28, royal: 10 } as const;

/** Flattened surface pads [x, y, z, radius] (radius = fully flat core). */
export const QIN_PADS: readonly (readonly [number, number, number, number])[] = [
  [-185,22,100,46],   // 集镇主街与小巷
  [-222,24,58,14],    // 窑场
  [-128,22.6,124,12], // 铸造棚
  [-212,22,138,12],   // 简牍库
  [-128,28,-42,18],   // 石料场
];

/** Rammed-earth palace platforms: [x0, x1, z0, z1, topY]. */
export const QIN_PALACE = {
  court: [8, 72, 44, 90, 58] as const,
  terrace: [2, 104, -42, 16, 70] as const,
  pavilion: [80, 100, -42, -22, 82] as const,
  hall: [22, 58, -12, 6] as const,
  gate: [40, 58, 86] as const,
};

/**
 * Underground rooms and straight corridors. Corridors are axis-aligned and end on a
 * room wall or at a portal facing the surface; their floors are straight ramps.
 */
export interface QinRoom { id: string; x0: number; x1: number; z0: number; z1: number; floor: number; height: number }
export interface QinCorridor { id: string; a: QinPoint; b: QinPoint; width: number; height: number; portal?: 'a' | 'b' }
export const QIN_ROOMS: readonly QinRoom[] = [
  { id: 'palace-landing', x0: 35.5, x1: 44.5, z0: -77, z1: -68, floor: 62, height: 7 },
  { id: 'foundry', x0: 100, x1: 160, z0: -130, z1: -62, floor: 46, height: 11 },
  { id: 'army', x0: -60, x1: 30, z0: -160, z1: -100, floor: 28, height: 11 },
  { id: 'quarry-landing', x0: -129.5, x1: -120.5, z0: -119.5, z1: -110.5, floor: 28, height: 7 },
  { id: 'deep-landing', x0: -21.5, x1: -12.5, z0: -194.5, z1: -185.5, floor: 19, height: 7 },
  { id: 'royal', x0: 31, x1: 79, z0: -202, z1: -154, floor: 10, height: 29 },
];
export const QIN_CORRIDORS: readonly QinCorridor[] = [
  // 斜道: palace rear court into the mountain, then down to the foundry.
  { id: 'palace-incline', a: [40, 70, -42], b: [40, 62, -68], width: 7, height: 6, portal: 'a' },
  { id: 'foundry-gallery', a: [44.5, 62, -72.5], b: [100, 46, -72.5], width: 7, height: 6 },
  // 运俑轨道: rail incline from the foundry down to the terracotta garrison.
  { id: 'rail-incline', a: [100, 46, -115], b: [30, 28, -115], width: 8, height: 7 },
  // 检修道: low maintenance tunnel from the town quarry.
  { id: 'maintenance-south', a: [-125, 28, -56], b: [-125, 28, -110.5], width: 6, height: 5.5, portal: 'a' },
  { id: 'maintenance-east', a: [-120.5, 28, -115], b: [-60, 28, -115], width: 6, height: 5.5 },
  // 斜井: from the garrison's middle file down to the buried royal city.
  { id: 'deep-shaft', a: [-17, 28, -160], b: [-17, 19, -185.5], width: 6, height: 6 },
  { id: 'royal-gallery', a: [-12.5, 19, -190], b: [31, 10, -190], width: 6, height: 6 },
];

/**
 * 军令机关: two rows of turntable ranks across the garrison hall. A rank lying along
 * the hall's depth seals its row; turned crosswise it leaves 10 m aisles. Phase A
 * (守陵阵) seals the east row; phase B (让道阵) opens it and the deep-shaft gate but
 * seals the west row behind the player. Any zone has a lever, so no state traps.
 */
export const QIN_ARMY = {
  flag: 'qin_army_order_b',
  rows: [
    { id: 'g1', x: 0, openIn: 'b' as const },
    { id: 'g2', x: -35, openIn: 'a' as const },
  ],
  shaftGate: { x: -17, z: -159, width: 7, height: 6, openIn: 'b' as const },
  rankCenters: [-152.5, -137.5, -122.5, -107.5],
  rankLength: 15.6, rankWidth: 5,
  levers: [
    { id: 'qin_order_east', p: [16, 28, -152] as QinPoint, zone: 'east' as const },
    { id: 'qin_order_middle', p: [-17, 28, -104] as QinPoint, zone: 'middle' as const },
    { id: 'qin_order_west', p: [-50, 28, -152] as QinPoint, zone: 'west' as const },
  ],
};

/**
 * 升降机关: a lift shaft from a headframe beside the ridge path straight down into the
 * garrison's central avenue (the skylight), so the middle file can be entered from above.
 */
export const QIN_LIFT = {
  x: -17, z: -130, half: 2.5, bottom: 28, top: 95.2,
  deck: [-21, -13, -136.5, -125.6] as const,
  markers: { top: 'qin_lift_top', bottom: 'qin_lift_bottom' },
  speed: 4,
};

export function qinDistanceToPolyline(x: number, z: number, line: readonly QinPoint[]): { d: number; y: number } {
  let best = { d: Infinity, y: line[0][1] };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
    if (d < best.d) best = { d, y: a[1] + (b[1] - a[1]) * t };
  }
  return best;
}
