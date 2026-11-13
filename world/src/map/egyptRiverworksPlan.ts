/** Region-local hydraulic and pedestrian reservations shared by the terrain
 * generator and live architecture. Heights in the overflow are water levels. */
export const EGYPT_OVERFLOW = [
  [-5, 6.65, 152], [11, 6.5, 158], [30, 6.25, 163], [47, 6, 178],
  [67, 5.6, 192], [67, 5.4, 205], [58, 4.1, 218], [55, 3.05, 224],
] as const;
export const EGYPT_STILLING_BASIN = { x: 67, z: 198, width: 15, depth: 14, floor: 4.55, water: 5.48 } as const;
/** The west diversion crosses the lower processional road before reaching the
 * deep harbor. Continuous falling levels; no water climbs a terrain overlay. */
export const EGYPT_WEST_DIVERSION = [[-8, 14, 120], [-20, 13.2, 130], [-55, 12.7, 135],
  [-89, 11.8, 153], [-110, 9.45, 177]] as const;
export const EGYPT_ROYAL_CAUSEWAY = [[-30, 10.15, 140], [0, 13.15, 110]] as const;
export const EGYPT_ROYAL_REPLACEMENT = [[-42, 152], [-30, 140], [0, 110], [12, 98]] as const;
export const EGYPT_FIELD_TERRACES = [
  { x: 28, z: 214, width: 14, depth: 12, floor: 7.4 },
  { x: 29, z: 233, width: 14, depth: 12, floor: 7.6 },
  { x: 8, z: 195, width: 11, depth: 9, floor: 7.8 },
] as const;
export const EGYPT_FIELD_WORKSHOP = { x: 18, z: 249, width: 10, depth: 8, floor: 8.3 } as const;
export const EGYPT_MAINTENANCE_DESCENT = [[-55, 16, 27], [-42, 10, 47], [-29, 10, 47], [-17, 17.9, 66]] as const;
export const EGYPT_WHEEL_TRENCH = { x0: -43.6, x1: -31.5, z0: 43.5, z1: 51.8, floor: 8.3 } as const;
export const EGYPT_WHEEL_BYPASS = [[-55, 16, 27], [-61.5, 16.5, 33], [-57, 17.5, 49], [-46, 18.2, 58],
  [-28, 18.2, 62], [-28, 18.2, 69], [-22, 18.2, 70], [-17, 17.9, 70], [-17, 17.9, 66]] as const;
export const EGYPT_HIGH_STAIR = [[-17, 17.9, 66], [-10, 17.9, 66], [-10, 20.7, 76],
  [-10, 24.3, 83], [-12, 24.3, 83], [-12, 24.3, 87]] as const;
export const EGYPT_WATER_LIFT_APPROACH = [[-17, 17.9, 66], [-5, 17.9, 66], [-5, 17.9, 97],
  [-18.6, 17.9, 97], [-18.6, 17.9, 95.8]] as const;
export const EGYPT_SOLAR_DEPARTURE = [-17, 24, 82] as const;
export const EGYPT_SOLAR_FORK = [-17, 25.6, 74] as const;
export const EGYPT_SOLAR_MERGE = [-14, 36, -92] as const;
export const EGYPT_SOLAR_ARRIVAL = [-6, 36, -146] as const;
export const EGYPT_SOLAR_APPROACH = [EGYPT_SOLAR_DEPARTURE, EGYPT_SOLAR_FORK] as const;
export const EGYPT_SOLAR_RETURN = [EGYPT_SOLAR_MERGE, EGYPT_SOLAR_ARRIVAL] as const;
export const EGYPT_HIGH_BRANCH = [EGYPT_SOLAR_FORK, [-3, 29, 77], [10, 32, 77], [26, 34, 51],
  [28, 35, 18], [9, 36, -16], [-8, 36, -50], EGYPT_SOLAR_MERGE] as const;
export const EGYPT_COLUMN_BRANCH = [EGYPT_SOLAR_FORK, [-40, 28, 64], [-80, 31, 40], [-43, 33, 17],
  [-30, 35, -26], EGYPT_SOLAR_MERGE] as const;
export const EGYPT_HIGH_CHANNEL = [EGYPT_SOLAR_DEPARTURE, ...EGYPT_HIGH_BRANCH, EGYPT_SOLAR_ARRIVAL] as const;
export const EGYPT_COLUMN_CHANNEL = [EGYPT_SOLAR_DEPARTURE, ...EGYPT_COLUMN_BRANCH, EGYPT_SOLAR_ARRIVAL] as const;
/** Constant-offset inspection ledge. Unit-normal miters keep the ledge outside
 * sharp channel bends, including the hairpin at the shaded colonnade. */
export function egyptInspectionWalk(points: readonly (readonly [number, number, number])[]): [number, number, number][] {
  const normal = (a: readonly number[], b: readonly number[]) => {
    const dx = b[0] - a[0], dz = b[2] - a[2], n = Math.hypot(dx, dz) || 1;
    return [dz / n, -dx / n];
  };
  return points.map((p, i) => {
    const a = normal(points[Math.max(0, i - 1)], points[i === 0 ? 1 : i]);
    const b = normal(points[i === points.length - 1 ? i - 1 : i], points[Math.min(points.length - 1, i + 1)]);
    const length = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1;
    const x = (a[0] + b[0]) / length, z = (a[1] + b[1]) / length;
    const reach = 4.6 / Math.max(.3, x * b[0] + z * b[1]);
    return [p[0] + x * reach, p[1] + .3, p[2] + z * reach];
  });
}
export const EGYPT_HIGH_WALK_ENTRY = [[-12, 24.3, 87], [3, 28.4, 89], [16, 32.1, 89],
  [24, 35.8, 86], [24, 36.2, 74], [15, 36.2, 67], [10.8, 34, 68], egyptInspectionWalk(EGYPT_HIGH_BRANCH)[2]] as const;
export const EGYPT_TEMPLE_WORKS = { x0: 8, x1: 32, z0: -176, z1: -124, floor: 24, gallery: 32 } as const;
export const EGYPT_TEMPLE_SIDE_DOOR = { x: 20, z: -173, width: 2.8, height: 2.65 } as const;
export const EGYPT_TEMPLE_SIDE_WALK = [[20, 24, -173], [20, 24, -185.5], [22, 24, -185.5],
  [28.1, 27.8, -185.5], [30, 27.8, -185.5], [30, 27.8, -183.1], [30, 32, -174],
  [30, 32, -172.9], [24.5, 32, -172.9], [24.5, 32, -171]] as const;
export const EGYPT_TEMPLE_STAIR_CUT = { x0: 17, x1: 31.7, z0: -188, z1: -172, floor: 24 } as const;
export const EGYPT_MARKET_SITES = {
  market: { x: -176, z: 144, width: 13, depth: 9.4 },
  landing: { x: -158, z: 158, width: 12, depth: 8 },
  hull: { x: -154, z: 167 },
} as const;
export const EGYPT_MARKET_PATHS = [
  [[-173, 137], [-169, 143], [-166, 149], [-160, 151]],
  [[-181, 145], [-179, 153], [-175, 157], [-169, 162]],
] as const;
export const EGYPT_RIVERWORKS_PATHS = [
  [[-32, 118], [-23, 128], [-23, 152], [-23, 177], [-10, 184], [14, 184], [23, 174], [23, 150], [23, 133], [36, 115]],
  [[-23, 164], [-42, 164], [-60, 185], [-65, 181]],
  [[23, 174], [46, 177], [51, 192], [51, 205], [43, 218], [43, 202]],
  [[51, 192], [56, 204], [56, 216], [67, 216]],
  [[23, 150], [35, 150], [40, 163]],
  [[-23, 139], [-14, 120], [-8, 120], [0, 132]],
  [[-151, 145], [-149, 165], [-157, 194], [-141, 230], [-107, 237], [-72, 228], [-64, 196], [-84, 186]],
  [[-137, 198], [-117, 193], [-92, 190], [-65, 181], [-38, 177], [-17, 166]],
  [[-17, 166], [3, 177], [12, 193], [16, 211], [16, 238], [38, 243], [44, 223], [43, 202], [33, 186], [13, 163]],
  [[-70, 194], [-70, 184], [-70, 162], [-70, 136], [-70, 130]],
  [[-64, 196], [-70, 205], [-70, 222], [-72, 228]],
  [[16, 202], [16, 207], [44, 207], [44, 221]],
  EGYPT_ROYAL_REPLACEMENT, ...EGYPT_MARKET_PATHS, EGYPT_WHEEL_BYPASS.map(([x, , z]) => [x, z] as const),
  EGYPT_HIGH_WALK_ENTRY.map(([x, , z]) => [x, z] as const),
  EGYPT_WATER_LIFT_APPROACH.map(([x, , z]) => [x, z] as const),
  EGYPT_HIGH_STAIR.map(([x, , z]) => [x, z] as const),
] as const;
export const EGYPT_RIVERWORKS_CLEARANCE = [
  [-13, 159, 13, 179], [-18, 180, 22, 190], [57, 188, 78, 208],
  [-128, 203, -110, 225], [-95, 205, -79, 224], [-122, 179, -94, 193],
  [10, 204, 40, 242], [-1, 187, 17, 203], [11, 244, 25, 255],
  [-149, 116, -141, 125], [8, 139, 16, 147],
  [-137, 198, -125, 228],
  [-183, 139, -169, 150], [-164, 153, -150, 174],
  [EGYPT_TEMPLE_STAIR_CUT.x0, EGYPT_TEMPLE_STAIR_CUT.z0, EGYPT_TEMPLE_STAIR_CUT.x1, EGYPT_TEMPLE_STAIR_CUT.z1],
] as const;

function distance(x: number, z: number, path: readonly (readonly [number, number])[]) {
  let closest = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    closest = Math.min(closest, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
  }
  return closest;
}
const overflowPlan = EGYPT_OVERFLOW.map(p => [p[0], p[2]] as const);
export function egyptRiverworksClearance(x: number, z: number, crown = 0) {
  return EGYPT_RIVERWORKS_CLEARANCE.some(r => x > r[0] - crown && x < r[2] + crown && z > r[1] - crown && z < r[3] + crown)
    || EGYPT_RIVERWORKS_PATHS.some(path => distance(x, z, path) < 3 + crown)
    || distance(x, z, overflowPlan) < 3.5 + crown
    || distance(x, z, EGYPT_WEST_DIVERSION.map(p => [p[0], p[2]] as const)) < 6.5 + crown
    || distance(x, z, EGYPT_HIGH_CHANNEL.map(p => [p[0], p[2]] as const)) < 5.2 + crown
    || distance(x, z, EGYPT_COLUMN_CHANNEL.map(p => [p[0], p[2]] as const)) < 5.2 + crown
    || distance(x, z, EGYPT_MAINTENANCE_DESCENT.map(p => [p[0], p[2]] as const)) < 4 + crown;
}
