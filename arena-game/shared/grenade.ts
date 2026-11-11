// Shared grenade rules: deterministic ballistic flight with per-axis bounces against the
// map's boxes, blast falloff, and smoke volumes. The Match owns the projectiles; clients only
// render snapshots, so nothing here is predicted.

import { DT, FRAG, GRENADE, SMOKE, type Team, type UtilityId } from './content.ts';
import { groundAt, raycastMap, type ArenaMap, type Vec3 } from './map.ts';
import { quant } from './sim.ts';

export interface Grenade {
  id: number; owner: string; team: Team; kind: UtilityId;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  fuse: number; // frag ticks left, zero while waiting for contact; smoke has no fuse
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
    fuse: kind === 'frag' ? FRAG.fuse : 0, rest: false,
  };
}

/** One tick of flight. Landed means support this tick, not a past bounce. */
export function stepGrenade(m: ArenaMap, g: Grenade): { loud: boolean; landed: boolean } {
  if (g.rest) return { loud: false, landed: true };
  g.vy -= GRENADE.gravity * DT;
  const r = GRENADE.radius;
  let loud = false;
  // Sweep horizontal axes separately so a wall reflects only its own axis.
  for (const axis of [0, 2] as const) {
    const v = axis === 0 ? g.vx : g.vz, d = v * DT;
    if (Math.abs(d) < 1e-9) continue;
    const s = Math.sign(d), dir: Vec3 = axis === 0 ? [s, 0, 0] : [0, 0, s];
    const hit = raycastMap(m, [g.x, g.y, g.z], dir, Math.abs(d) + r);
    const move = hit === Infinity ? d : s * Math.max(0, hit - r);
    if (axis === 0) g.x += move; else g.z += move;
    if (hit === Infinity) continue;
    loud ||= Math.abs(v) > 2;
    const bounced = -v * GRENADE.restitution;
    if (axis === 0) g.vx = bounced; else g.vz = bounced;
  }
  const b = m.movementBounds;
  if (g.x < b.minX || g.x > b.maxX) { g.x = Math.max(b.minX, Math.min(b.maxX, g.x)); g.vx = -g.vx * GRENADE.restitution; }
  if (g.z < b.minZ || g.z > b.maxZ) { g.z = Math.max(b.minZ, Math.min(b.maxZ, g.z)); g.vz = -g.vz * GRENADE.restitution; }
  // Sweep the bottom onto real support below the centre. Player step-up tolerance
  // would let a grenade snap onto a platform from underneath.
  const dy = g.vy * DT;
  const floor = dy <= 0 ? groundAt(m, g.x, g.z, g.y, 0) : -100;
  const landed = floor > -100 && g.y + dy <= floor + r;
  if (landed) {
    g.y = floor + r; loud ||= g.vy < -2;
    g.vy = -g.vy * GRENADE.restitution; g.vx *= GRENADE.friction; g.vz *= GRENADE.friction;
    if (g.vy < 1.2 && Math.hypot(g.vx, g.vz) < .5) { g.rest = true; g.vx = g.vy = g.vz = 0; }
  } else if (dy > 0) {
    const hit = raycastMap(m, [g.x, g.y, g.z], [0, 1, 0], dy + r);
    g.y += hit === Infinity ? dy : Math.max(0, hit - r);
    if (hit !== Infinity) { loud ||= g.vy > 2; g.vy = -g.vy * GRENADE.restitution; }
  } else g.y += dy;
  g.x = quant(g.x); g.y = quant(g.y); g.z = quant(g.z);
  g.vx = quant(g.vx); g.vy = quant(g.vy); g.vz = quant(g.vz);
  return { loud, landed };
}

/** True when a blast this far away reaches you (it is then lethal to enemies). */
export function fragReaches(distance: number): boolean { return distance >= 0 && distance <= FRAG.radius; }

/** Smoke is a sphere around the cloud's centre, a little above where the can landed. */
export const smokeCentre = (s: Smoke): Vec3 => [s.x, s.y + 1.3, s.z];
export function insideSmoke(smokes: readonly Smoke[], p: readonly number[]): boolean {
  for (const s of smokes) { if (s.life <= 0) continue; const c = smokeCentre(s); if ((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2 < SMOKE.radius * SMOKE.radius) return true; }
  return false;
}
/** True when the segment a→b passes through any live smoke volume (vision; bullets only lose damage). */
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
