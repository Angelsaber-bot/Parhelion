// 业火京都 (Kyoto Ablaze) — World 04, Kyoto on the night of 本能寺之变 (21 June 1582, 天正十年六月二日).
// South of 幻日谷 through the southern torii seam (valley x = 40, z = 318): a tunnel of vermilion torii runs
// on through the Inari hills and comes down into the city. The chessboard streets of 洛中, the Kamo River
// with the Sanjō bridge, Higashiyama with the Yasaka pagoda and Kiyomizu's stage, the Golden Pavilion on
// its pond, the Akechi army camped on the western hills, and Honnō-ji burning inside its moat.
//
// Coordinates: region-local metres, Y up, +X = east, -Z = north. The north edge (z = -360) meets the
// valley's south edge; the region sits at world offset (0, 720).

import type { V2, Area } from '../layout.js';

export const KYOTO = {
  id: 'world_kyoto',
  name: '业火京都',
  nameEn: 'Kyoto Ablaze',
  version: 1,
  seed: 15820621,
  half: 360,
  playHalf: 334,
  cell: 2,
  waterLevel: 1.0,
};

/** Where this region sits in the shared world: directly south of 幻日谷. */
export const OFFSET: V2 = [0, 720];
/** Street level of the city basin. */
export const CITY_Y = 4;

/** The torii tunnel from the valley seam through the Inari hills (it starts on the valley side). */
export const TORII_PATH: V2[] = [[40, -372], [40, -344], [33, -318], [46, -290], [40, -262], [40, -250]];
/** Height of the tunnel floor at the boundary (the valley's notch floor meets it there). */
export const SEAM_Y = 10;
export const INARI = { gate: [40, -242] as V2 };

/** 洛中: the chessboard grid. Street centre lines and the block between them. */
export const STREETS_X = Array.from({ length: 10 }, (_, k) => -165 + k * 30);
export const STREETS_Z = Array.from({ length: 12 }, (_, k) => -195 + k * 30);
export const STREET_W = 8;
export const SANJO_Z = -75;

/** Honnō-ji: a fortified temple with a moat and earthen walls; the gate faces east. */
export const HONNOJI = { c: [-100, 45] as V2, half: 45, moat: 6 };
export const CORE = { c: [-74, 45] as V2 };

/** The Kamo River (shallow enough to wade), the Sanjō bridge and the turtle stepping stones. */
export const KAMO: V2[] = [[176, -380], [164, -250], [152, -120], [150, 0], [154, 120], [162, 250], [172, 380]];
export const KAMO_W = 10; // half width of the water
export const KAMO_BANK = 24; // half width of the gravel riverbed (河原)
export const SANJO = { z: SANJO_Z, x0: 120, x1: 184, y: 5.2 };
export const TOBI_Z = 60;

/** Higashiyama: the Yasaka pagoda, the Sannenzaka steps and Kiyomizu's hall and stage. */
export const YASAKA = { c: [214, 6] as V2 };
export const YASAKA_SHRINE = { c: [212, -20] as V2 };
/** Sannenzaka: stepped street up the hill, [x, z, y] per point. */
export const SANNEN: [number, number, number][] = [[192, 28, 4.6], [212, 34, 9], [230, 38, 16], [246, 42, 23], [262, 46, 30], [278, 48, 34]];
export const KIYOMIZU = { y: 34, terrace: [276, 316, 28, 70] as [number, number, number, number], hall: { c: [298, 50] as V2, w: 24, d: 18 }, stage: { c: [266, 64] as V2, w: 22, d: 14 } };
export const OTOWA = { c: [262, 80] as V2 };

/** Kinkaku-ji: the Golden Pavilion on the north shore of Kyōko-chi pond. */
export const POND = { c: [-215, -182] as V2, rx: 42, rz: 30 };
export const PAVILION = { c: [-215, -218] as V2, w: 14, d: 11 };
/** Islands, and the stepping-stone route across the pond from the south shore to the pavilion's deck. */
export const ISLES: { c: V2; r: number }[] = [{ c: [-226, -168], r: 5 }, { c: [-206, -186], r: 6 }, { c: [-232, -196], r: 4 }];
export const STONE_ROUTE: V2[] = [[-222, -148], [-226, -166], [-206, -184], [-214, -207]];

/** The Akechi army on the western hills (老ノ坂): curtained HQ and three great bellflower banners. */
export const AKECHI = { c: [-232, 168] as V2, y: 14 };
export const BANNERS: V2[] = [[-286, 132], [-292, 186], [-262, 222]];

/** The ruined Rashōmon at the south end of the old Suzaku avenue. */
export const RASHOMON = { c: [-15, 292] as V2 };

export const AREAS: Area[] = [
  { id: 'inari', name: '千本鸟居', nameEn: 'Senbon Torii', c: [40, -300], r: 50, color: '#ff6a3d', tp: [40, -232] },
  { id: 'rakuchu', name: '洛中三条通', nameEn: 'Sanjō Avenue', c: [-15, -75], r: 70, color: '#f2c35a', tp: [45, -90] },
  { id: 'kamo', name: '鸭川三条大桥', nameEn: 'Sanjō Bridge on the Kamo', c: [152, -75], r: 40, color: '#7fd0ff', tp: [110, -75] },
  { id: 'honnoji', name: '本能寺', nameEn: 'Honnō-ji', c: [-100, 45], r: 55, color: '#ff4a2a', tp: [-30, 45] },
  { id: 'higashiyama', name: '东山清水寺', nameEn: 'Kiyomizu-dera, Higashiyama', c: [260, 40], r: 60, color: '#f08ab0', tp: [196, 30] },
  { id: 'kinkaku', name: '金阁寺', nameEn: 'Kinkaku-ji', c: [-215, -190], r: 55, color: '#ffd66b', tp: [-215, -138] },
  { id: 'akechi', name: '明智军阵', nameEn: 'Akechi Camp', c: [-240, 168], r: 60, color: '#8f7bd8', tp: [-190, 150] },
];

export const PATHS: V2[][] = [
  // torii exit -> down the east street -> Sanjō avenue -> the bridge
  [[40, -236], [45, -200], [45, -75], [116, -75]],
  // Sanjō avenue west -> south on the Suzaku line -> Honnō-ji's east gate
  [[45, -75], [-15, -75], [-15, 45], [-50, 45]],
  // bridge east end -> Yasaka shrine -> the pagoda -> foot of Sannenzaka
  [[186, -75], [194, -40], [196, 0], [192, 28]],
  // Sanjō avenue west -> north-west -> Kinkaku-ji south shore
  [[-15, -75], [-165, -75], [-190, -110], [-215, -140]],
  // Suzaku south -> west along the ninth street -> the Akechi camp
  [[-15, 45], [-15, 135], [-165, 135], [-200, 150]],
  // Suzaku south -> Rashōmon
  [[-15, 135], [-15, 280]],
];

/** Compressed western excursion: a historical-inspired Arashiyama landscape, not a survey reconstruction.
 * The timber crossing deliberately does not copy the modern concrete Togetsukyō bridge. */
export const ARASHIYAMA = {
  bounds: [-320, -200, -100, 90] as const,
  bankY: 5.8,
  bridge: { x: -267, z0: 12, z1: 58, width: 8.8, deckY: 6.05 },
  river: { x0: -330, x1: -194, z: 35, halfWidth: 12 },
  garden: { c: [-285, -37] as V2, rx: 15, rz: 11, waterY: 5.05 },
  hall: { c: [-244, -63] as V2, w: 25, d: 15 },
  bambooPath: [[-304, -91], [-306, -66], [-308, -43], [-304, -17], [-288, 3], [-267, 8]] as V2[],
};

AREAS.push({ id: 'arashiyama', name: '岚山·渡月桥', nameEn: 'Arashiyama · Timber Crossing', c: [-270, -8], r: 72, color: '#83c5ae', tp: [-267, 3] });
// Existing indices 0–5 are a gameplay contract; append optional exploration routes only.
PATHS.push(
  [[-165, -75], [-190, -97], [-220, -103], [-267, -100], [-267, -74], [-267, -10], [-267, 12], [-267, 58], [-267, 76]],
  [[-267, -100], [-286, -100], [-304, -91], ...ARASHIYAMA.bambooPath.slice(1)],
  [[-267, 76], [-238, 76], [-218, 65]],
);
