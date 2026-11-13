/** The harbor's inland service loop, in Black Sail region-local coordinates. */
export const BLACKSAIL_CIVIL_SITES = {
  salt: { x: -80, z: 65, width: 20, depth: 18, ground: 15.5, floor: 15.7 },
  customs: { x: -60, z: 112, width: 30, depth: 24, ground: 10.7, floor: 10.9 },
  cable: { x: -44, z: 65, width: 12, depth: 14, ground: 16, floor: 16.2 },
} as const;
export const BLACKSAIL_CIVIL_CLEARANCE = [
  ...Object.values(BLACKSAIL_CIVIL_SITES).map(site =>
    [site.x - site.width / 2 - 1, site.z - site.depth / 2 - 1, site.x + site.width / 2 + 1, site.z + site.depth / 2 + 1] as const),
  [-34, 62, -28, 76] as const,
];
export const BLACKSAIL_CIVIL_PATHS = [
  [[-60, 30], [-60, 48], [-80, 48], [-80, 56]],
  [[-70, 65], [-50, 65], [-44, 65]],
  [[-80, 74], [-86, 87], [-86, 112], [-75, 112]],
  [[-44, 72], [-44, 83], [-59, 100]],
  [[-60, 124], [-70, 135], [-81, 140]],
] as const;
