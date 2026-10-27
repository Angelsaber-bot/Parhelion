// 黑帆尽头 (Black Sail's End) — World 02, the pirate sea of 1718, the year Blackbeard fell. East of
// 幻日谷 through the mountain pass (valley x = 360, z = 30). It replaces the earlier 星落海岸 prototype:
// the pier village grew into Nassau, the floating isles became storm-lifted wrecks, the sea arch became
// Skull Reef and the watch lighthouse now burns with a cold light over a ghost fleet.
//
// Coordinates: region-local metres, Y up, +X = east, -Z = north. Land lies north-west; the sea is to the
// south and east. The west edge (x = -360) meets the valley.

import type { V2, Area } from '../layout.js';

export const BLACKSAIL = {
  id: 'world_blacksail_end',
  name: '黑帆尽头',
  nameEn: "Black Sail's End",
  version: 1,
  seed: 17181122,
  half: 360,
  playHalf: 334,
  cell: 2,
  waterLevel: 1.0,
};

/** Where this region sits in the shared world: directly east of 幻日谷. */
export const OFFSET: V2 = [720, 0];
/** The pass road enters from the west edge at this z (valley PASS.z = 30, PASS.y = 16). */
export const PASS_Z = 30;
export const PASS_Y = 16;

export const AREAS: Area[] = [
  { id: 'pass_trail', name: '山口栈道', nameEn: 'Pass Trail', c: [-300, 30], r: 40, color: '#c9b58f', tp: [-318, 30] },
  { id: 'port', name: '拿骚港', nameEn: 'Nassau Port', c: [-120, 150], r: 60, color: '#f08a4b', tp: [-110, 138] },
  { id: 'smugglers', name: '走私者草原', nameEn: "Smugglers' Downs", c: [-50, 10], r: 70, color: '#9fcf6b', tp: [-60, 40] },
  { id: 'fort', name: '黑胡子要塞', nameEn: "Blackbeard's Fort", c: [180, -190], r: 56, color: '#d9534f', tp: [124, -142] },
  { id: 'wrecks', name: '浮空沉船群', nameEn: 'Sky Wrecks', c: [-140, -190], r: 70, color: '#9fe3f0', tp: [-140, -120] },
  { id: 'reef', name: '骷髅礁', nameEn: 'Skull Reef', c: [160, 186], r: 46, color: '#ecd9a0', tp: [100, 120] },
  { id: 'lighthouse', name: '亡航灯塔', nameEn: 'Drowned Lighthouse', c: [262, -14], r: 34, color: '#7fb8ff', tp: [214, -14] },
];

/** South shore z at x and east shore x at z: land lies north of the first and west of the second. */
export const shoreZ = (x: number) => 205 + 9 * Math.sin(x * 0.021) - 215 * Math.pow(Math.min(1, Math.max(0, (x + 40) / 300)), 1.7);
export const shoreX = (z: number) => 254 + 10 * Math.sin(z * 0.025 + 0.6);

export const PORT = { c: [-120, 150] as V2, y: 3.4, piers: [-170, -120, -70] as number[], pierZ1: 262 };
export const TAVERN = { c: [-128, 128] as V2, w: 16, d: 11 };
export const MEADOW = { c: [-50, 10] as V2 };
export const WINDMILL = { c: [-20, -24] as V2 };
/** Fort on the north-east sea cliff: a star fort whose seaward battery covers the ghost boats. */
export const FORT = { c: [180, -190] as V2, r: 40, top: 30, gateA: Math.PI * 0.85 };
/** The star outline the curtain walls follow: four bastion tips with the curtains bent 6 m inward. */
export function fortOutline(): V2[] {
  const [fx, fz] = FORT.c, R = (FORT.r - 3) * 1.15;
  const corner = (k: number): V2 => { const a = Math.PI / 4 + (k * Math.PI) / 2; return [fx + Math.cos(a) * R, fz + Math.sin(a) * R]; };
  const out: V2[] = [];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corner(k), [bx, bz] = corner(k + 1);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, L = Math.hypot(fx - mx, fz - mz);
    out.push([ax, az], [mx + ((fx - mx) / L) * 6, mz + ((fz - mz) / L) * 6]);
  }
  return out;
}
/** The working gun of the battery, just inside the east curtain (lowered to a parapet there). */
export const CANNON = { c: [205, -172] as V2 };
export const GHOST_BOATS: V2[] = [[300, -132], [312, -196], [292, -258]];
/** The storm vortex crater with wrecks lifted above it (the former crater + floating isles). */
export const VORTEX = { c: [-140, -190] as V2, R: 40, floor: 6 };
export const WRECKS: { id: string; c: V2; y: number; len: number; ry: number }[] = [
  { id: 'w1', c: [-112, -160], y: 26, len: 22, ry: 0.4 },
  { id: 'w2', c: [-146, -142], y: 40, len: 26, ry: -0.5 },
  { id: 'w3', c: [-178, -170], y: 54, len: 22, ry: 1.2 },
  { id: 'w4', c: [-160, -214], y: 68, len: 30, ry: 0.2 },
  { id: 'w5', c: [-108, -214], y: 46, len: 18, ry: -1.1 },
];
export const UPDRAFTS: { x: number; z: number; r: number; y0: number; y1: number }[] = [
  { x: -128, z: -184, r: 4, y0: 6, y1: 40 }, // vortex core -> w1
  { x: -112, z: -156, r: 3, y0: 25, y1: 56 }, // w1 -> w2
  { x: -146, z: -138, r: 3.5, y0: 39, y1: 70 }, // w2 -> w3
  { x: -180, z: -166, r: 3, y0: 53, y1: 84 }, // w3 -> w4
];
export const REEF = { c: [160, 196] as V2, r: 26 };
export const SANDBAR: V2[] = [[96, 132], [122, 156], [146, 176]];
export const HALF_WRECK = { c: [104, 214] as V2 };
/** Sand spit from the sandbar's middle to just short of the half wreck's stern (stones climb the rest). */
export const WRECK_SPIT: V2[] = [SANDBAR[1], [110.5, 209]];
export const HEADLAND = { a: [196, -12] as V2, b: [272, -14] as V2, r: 16 };
export const LIGHTHOUSE = { c: [266, -14] as V2, h: 24 };
/** Ghost fleet anchored east of the lighthouse; the flagship is the boss arena. */
export const FLEET: { id: string; c: V2; len: number; ry: number; deck: number }[] = [
  { id: 'g1', c: [298, 22], len: 26, ry: 0.2, deck: 5 },
  { id: 'g2', c: [312, 58], len: 28, ry: -0.3, deck: 5.5 },
  { id: 'flag', c: [296, 104], len: 46, ry: 0.15, deck: 6 },
];

export const PATHS: V2[][] = [
  // pass trail -> downs -> Nassau
  [[-360, 30], [-300, 30], [-240, 26], [-170, 20], [-100, 16], [-60, 30], [-100, 90], [-120, 116]],
  // downs -> sky wrecks (vortex rim)
  [[-60, 4], [-80, -60], [-110, -110], [-130, -140]],
  // downs -> fort gate
  [[-40, 0], [20, -40], [80, -90], [126, -150]],
  // downs -> lighthouse headland
  [[-30, 20], [60, 6], [140, -6], [200, -12]],
  // Nassau east shore -> sandbar to Skull Reef
  [[-70, 160], [0, 150], [60, 128], [92, 128]],
];
