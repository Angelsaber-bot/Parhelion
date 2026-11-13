// Region-local sites of the five settlement hubs, as placed on the reviewed 2026-11-10 maps.
// The placement search starts here, and the map generators keep these footprints (and the
// entry ramp, which always faces local +Z) clear of scattered trees, so regenerating a map
// cannot relocate a town.
export const SETTLEMENT_SITES = {
  alpha: { c: [-166, 212], footprint: [0, 0], entry: 0 },
  britain: { c: [-178, 152], footprint: [38, 36], entry: 17.5 },
  blacksail: { c: [-202, -124], footprint: [26, 36], entry: 13 },
  winter: { c: [8, 116], footprint: [0, 0], entry: 0 },
  kyoto: { c: [-172, 92], footprint: [0, 0], entry: 0 },
} as const satisfies Record<string, { c: readonly [number, number]; footprint: readonly [number, number]; entry: number }>;

/** True inside a hub's footprint, its 10 m entry ramp, or `pad` metres around them. */
export function insideSettlementSite(region: keyof typeof SETTLEMENT_SITES, x: number, z: number, pad = 1.5) {
  const { c: [cx, cz], footprint: [w, d], entry } = SETTLEMENT_SITES[region];
  if (!w || !d) return false;
  const front = cz + Math.max(entry, d / 2) + 10;
  return Math.abs(x - cx) <= w / 2 + .8 + pad && z >= cz - d / 2 - .8 - pad && z <= front + pad;
}
