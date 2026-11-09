// Shared grenade rules: deterministic ballistic flight with per-axis bounces against the
// map's boxes, blast falloff, and smoke volumes. The Match owns the projectiles; clients only
// render snapshots, so nothing here is predicted.

import { DT, FRAG, GRENADE, SMOKE, type Team, type UtilityId } from './content.ts';
import { groundAt, raycastMap, type ArenaMap, type Vec3 } from './map.ts';
import { quant } from './sim.ts';

export interface Grenade {
  id: number; owner: string; team: Team; kind: UtilityId;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  fuse: number; // ticks left
  rest: boolean;
}
export interface Smoke { id: number; owner: string; x: number; y: number; z: number; life: number }

/** Spawn just ahead of the hand, never inside a wall the thrower is touching. */
export function launchGrenade(m: ArenaMap, id: number, owner: string, team: Team, kind: UtilityId, origin: Vec3, dir: Vec3, carry: readonly [number, number]): Grenade {
  const ahead = Math.min(.45, Math.max(0, raycastMap(m, origin, dir, .45) - GRENADE.radius));
  return {
    id, owner, team, kind,
    x: quant(origin[0] + dir[0] * ahead), y: quant(origin[1] + dir[1] * ahead), z: quant(origin[2] + dir[2] * ahead),
    vx: quant(dir[0] * GRENADE.speed + carry[0] * GRENADE.inherit),
    vy: quant(dir[1] * GRENADE.speed + GRENADE.lift),
    vz: quant(dir[2] * GRENADE.speed + carry[1] * GRENADE.inherit),
    fuse: kind === 'frag' ? FRAG.fuse : SMOKE.fuse, rest: false,
  };
}

/** One tick of flight. Returns true when it struck a surface hard enough to be heard. */
export function stepGrenade(m: ArenaMap, g: Grenade): boolean {
  if (g.rest) return false;
  g.vy -= GRENADE.gravity * DT;
  const r = GRENADE.radius;
  let loud = false;
  // X, then Z, then Y: each axis is swept separately, so a box face reflects only its own axis.
  for (const axis of [0, 2, 1] as const) {
    const v = axis === 0 ? g.vx : axis === 2 ? g.vz : g.vy, d = v * DT;
    if (Math.abs(d) < 1e-9) continue;
    const s = Math.sign(d), dir: Vec3 = axis === 0 ? [s, 0, 0] : axis === 2 ? [0, 0, s] : [0, s, 0];
    const hit = raycastMap(m, [g.x, g.y, g.z], dir, Math.abs(d) + r);
    const move = hit === Infinity ? d : s * Math.max(0, hit - r);
    if (axis === 0) g.x += move; else if (axis === 2) g.z += move; else g.y += move;
    if (hit === Infinity) continue;
    loud ||= Math.abs(v) > 2;
    const bounced = -v * GRENADE.restitution;
    if (axis === 0) g.vx = bounced; else if (axis === 2) g.vz = bounced;
    else { g.vy = bounced; if (v < 0) { g.vx *= GRENADE.friction; g.vz *= GRENADE.friction; } }
  }
  // The arena floor and open edges are a hard boundary too.
  const floor = groundAt(m, g.x, g.z, g.y + .3) + r;
  if (g.y < floor) { g.y = floor; if (g.vy < 0) { loud ||= g.vy < -2; g.vy = -g.vy * GRENADE.restitution; g.vx *= GRENADE.friction; g.vz *= GRENADE.friction; } }
  const b = m.movementBounds;
  if (g.x < b.minX || g.x > b.maxX) { g.x = Math.max(b.minX, Math.min(b.maxX, g.x)); g.vx = -g.vx * GRENADE.restitution; }
  if (g.z < b.minZ || g.z > b.maxZ) { g.z = Math.max(b.minZ, Math.min(b.maxZ, g.z)); g.vz = -g.vz * GRENADE.restitution; }
  if (g.y <= floor + .02 && Math.abs(g.vy) < 1.2 && Math.hypot(g.vx, g.vz) < .5) { g.rest = true; g.vx = g.vy = g.vz = 0; }
  g.x = quant(g.x); g.y = quant(g.y); g.z = quant(g.z);
  g.vx = quant(g.vx); g.vy = quant(g.vy); g.vz = quant(g.vz);
  return loud;
}

/** Linear falloff from full damage at the centre to the minimum at the edge; 0 outside. */
export function fragDamage(distance: number): number {
  if (!(distance >= 0) || distance > FRAG.radius) return 0;
  return Math.round(FRAG.damage + (FRAG.minDamage - FRAG.damage) * distance / FRAG.radius);
}

/** Smoke is a sphere around the cloud's centre, a little above where the can landed. */
export const smokeCentre = (s: Smoke): Vec3 => [s.x, s.y + 1.3, s.z];
/** True when the segment a→b passes through any live smoke volume (vision only, never bullets). */
export function smokeBlocks(smokes: readonly Smoke[], a: Vec3, b: Vec3): boolean {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  for (const s of smokes) {
    if (s.life <= 0) continue;
    const c = smokeCentre(s), t = len2 > 0 ? Math.max(0, Math.min(1, ((c[0] - a[0]) * d[0] + (c[1] - a[1]) * d[1] + (c[2] - a[2]) * d[2]) / len2)) : 0;
    const q: Vec3 = [a[0] + d[0] * t - c[0], a[1] + d[1] * t - c[1], a[2] + d[2] * t - c[2]];
    if (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] < SMOKE.radius * SMOKE.radius) return true;
  }
  return false;
}
