// Ray tests against player hit volumes and deployed shields.

import { CROUCH, HITBOX, SHIELD } from './content.ts';
import type { Vec3 } from './map.ts';

/** Distance along unit ray d to a sphere, or Infinity. */
export function raySphere(o: Vec3, d: Vec3, c: Vec3, r: number): number {
  const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  const t = -b - s;
  if (t >= 0) return t;
  return -b + s >= 0 ? 0 : Infinity;
}

/** Ray vs vertical capsule (segment from y0 to y1 at x,z with radius r). */
export function rayCapsule(o: Vec3, d: Vec3, x: number, z: number, y0: number, y1: number, r: number): number {
  // infinite vertical cylinder first
  const ox = o[0] - x, oz = o[2] - z;
  const a = d[0] * d[0] + d[2] * d[2];
  let best = Infinity;
  if (a > 1e-12) {
    const b = ox * d[0] + oz * d[2];
    const c = ox * ox + oz * oz - r * r;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a;
      if (t >= 0) {
        const y = o[1] + d[1] * t;
        if (y >= y0 && y <= y1) best = t;
      }
    }
  }
  return Math.min(best, raySphere(o, d, [x, y0, z], r), raySphere(o, d, [x, y1, z], r));
}

export interface BodyHit { t: number; head: boolean }

export const playerHitbox = (crouched = false) => crouched ? CROUCH.hitbox : HITBOX;

export function rayPlayer(o: Vec3, d: Vec3, px: number, py: number, pz: number, crouched = false): BodyHit | null {
  const hitbox = playerHitbox(crouched);
  const th = raySphere(o, d, [px, py + hitbox.headY, pz], hitbox.headRadius);
  const tb = rayCapsule(o, d, px, pz, py + hitbox.bodyBottom + hitbox.bodyRadius,
    py + hitbox.bodyTop - hitbox.bodyRadius, hitbox.bodyRadius);
  if (th === Infinity && tb === Infinity) return null;
  return th <= tb ? { t: th, head: true } : { t: tb, head: false };
}

/** Shield is a vertical rectangle centred at (x, y..y+h, z), facing along yaw. */
export function rayShield(o: Vec3, d: Vec3, x: number, y: number, z: number, yaw: number): number {
  const nx = -Math.sin(yaw), nz = -Math.cos(yaw);
  const denom = nx * d[0] + nz * d[2];
  if (Math.abs(denom) < 1e-9) return Infinity;
  const t = (nx * (x - o[0]) + nz * (z - o[2])) / denom;
  if (t < 0) return Infinity;
  const hx = o[0] + d[0] * t - x, hy = o[1] + d[1] * t, hz = o[2] + d[2] * t - z;
  const lateral = hx * Math.cos(yaw) - hz * Math.sin(yaw);
  if (Math.abs(lateral) > SHIELD.width / 2) return Infinity;
  if (hy < y || hy > y + SHIELD.height) return Infinity;
  return t;
}
