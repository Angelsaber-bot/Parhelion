/** Local coordinates in the Everwinter tile (world Z = local Z - 720). */
export const WINTER_SCHOOL = { x: 18, z: -88, width: 22, depth: 22, ground: 10.5, floor: 10.7 } as const;
export const WINTER_CUSTOMS = { x: -73, z: 245, width: 46, depth: 38, ground: 7.9, floor: 8.1 } as const;
export const WINTER_CIVIL_CLEARANCE = [[5, -102, 31, -74], [-108, 223, -45, 268]] as const;
export const WINTER_CIVIL_PATHS = [
  [[18, -77], [18, -68], [40, -68]], [[29, -88], [40, -88]],
  [[-73, 226], [-73, 215], [-40, 214]],
  [[-50, 228], [-45, 228]], [[-50, 262], [-45, 262]],
  [[-96, 226], [-112, 225], [-112, 265], [-96, 264]],
] as const;

/** Reject the whole tree, including its snow tiers and collision proxy. */
export function winterCivilClearance(x: number, z: number, crown = 0) {
  if (WINTER_CIVIL_CLEARANCE.some(r => x > r[0] - crown && x < r[2] + crown && z > r[1] - crown && z < r[3] + crown)) return true;
  return WINTER_CIVIL_PATHS.some(path => path.slice(1).some((b, i) => {
    const a = path[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 3.6 + crown;
  }));
}
