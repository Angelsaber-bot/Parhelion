import { fbm, smoothstep, lerp } from '../rng';
import type { ExpansionPlan } from '../../../src/map/worldPlan';

/** The home-town tile: rolling farmland west, a broad town shelf, falling to an east harbour. */
export function homeAuthoredHeight(plan: ExpansionPlan, x: number, z: number): number {
  let h = 15 + fbm(x * .006, z * .006, 4, 7301) * 5 + fbm(x * .03, z * .03, 2, 7307) * .8;
  // the land steps down toward the eastern bay
  h = lerp(h, 3.5 + fbm(x * .02, z * .02, 2, 7311) * .6, smoothstep(140, 300, x + 25 * Math.sin(z * .013)));
  const site = (id: string) => plan.sites.find(s => s.id === id)!.position;
  // level town square and harbour apron
  for (const [id, r] of [['square', 48], ['harbour', 34], ['northroad', 24]] as const) {
    const [sx, sy, sz] = site(id), d = Math.hypot(x - sx, z - sz);
    h = lerp(h, sy - .1, 1 - smoothstep(r * .7, r * 1.6, d));
  }
  // roads are graded: the ground meets each route at its authored height
  for (const route of plan.routes) for (let i = 1; i < route.points.length; i++) {
    const [ax, ay, az] = route.points[i - 1], [bx, by, bz] = route.points[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    h = lerp(h, ay + (by - ay) * t - .1, 1 - smoothstep(7, 26, d));
  }
  return h;
}
