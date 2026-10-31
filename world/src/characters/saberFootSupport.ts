import * as THREE from 'three';

export type SaberFloorQuery = (x: number, z: number, baseY: number) => number | null;
export type SaberFootprint = { halfWidth: number; halfLength: number; forwardOffset: number; lateralOffset: number };
export type SaberSupportPlane = {
  valid: boolean;
  kind: 'plane' | 'step' | 'unsupported';
  point: THREE.Vector3;
  normal: THREE.Vector3;
  serial: number;
};
type Cache = SaberSupportPlane & {
  initialized: boolean; x: number; z: number; yaw: number; revision: number; queriedAt: number;
};
const newCache = (): Cache => ({ valid: false, kind: 'unsupported', point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), serial: 0,
  initialized: false, x: 0, z: 0, yaw: 0, revision: -1, queriedAt: -Infinity });

/** Cached landing/stance support, NOT an every-frame five-ray ground solver.
 * Caller supplies a predicted landing point during swing, the fixed ankle during
 * stance, and a revision when immutable collider BVHs/enabled states change.
 * Stable stance therefore performs no fresh terrain query. Only meaningful target
 * changes can refresh, at most every 80 ms; contact/revision edges may refresh now.
 */
export class SaberFootSupport {
  readonly diagnostics = { floorQueries: 0, cacheHits: 0, refreshes: 0, unsupported: 0 };
  private readonly cache = [newCache(), newCache()];
  private readonly heights = new Float64Array(5);
  private time = 0;
  constructor(private readonly floor: SaberFloorQuery, private readonly footprints: readonly SaberFootprint[]) {}
  advance(dt: number) { this.time += Math.max(0, dt); }
  clear() { for (const c of this.cache) c.initialized = false; }
  heightAt(plane: SaberSupportPlane, x: number, z: number) {
    return plane.valid ? plane.point.y - (plane.normal.x * (x - plane.point.x) + plane.normal.z * (z - plane.point.z)) / plane.normal.y : NaN;
  }
  read(side: number, x: number, z: number, baseY: number, yaw: number, revision: number, contactEdge = false): SaberSupportPlane {
    const c = this.cache[side], headingChange = Math.abs(Math.atan2(Math.sin(yaw - c.yaw), Math.cos(yaw - c.yaw)));
    const changed = Math.hypot(x - c.x, z - c.z) > .12 || headingChange > .16;
    const revisionChanged = revision !== c.revision;
    const edge = contactEdge && (this.time !== c.queriedAt || Math.hypot(x - c.x, z - c.z) > 1e-6);
    if (c.initialized && !revisionChanged && !edge && !(changed && this.time - c.queriedAt >= .08)) {
      this.diagnostics.cacheHits++; return c;
    }
    c.initialized = true; c.x = x; c.z = z; c.yaw = yaw; c.revision = revision; c.queriedAt = this.time; c.serial++;
    c.valid = false; c.kind = 'unsupported'; this.diagnostics.refreshes++;
    const footprint = this.footprints[side], w = footprint.halfWidth, l = footprint.halfLength, sin = Math.sin(yaw), cos = Math.cos(yaw);
    const cx = x + cos * footprint.lateralOffset + sin * footprint.forwardOffset;
    const cz = z - sin * footprint.lateralOffset + cos * footprint.forwardOffset;
    c.point.set(cx, baseY, cz); c.normal.set(0, 1, 0);
    for (let i = 0; i < 5; i++) {
      const ox = i === 0 ? 0 : i === 1 || i === 3 ? -w : w;
      const oz = i === 0 ? 0 : i < 3 ? l : -l;
      this.diagnostics.floorQueries++;
      const height = this.floor(cx + cos * ox + sin * oz, cz - sin * ox + cos * oz, baseY);
      if (height === null || !Number.isFinite(height)) { this.diagnostics.unsupported++; return c; }
      this.heights[i] = height;
    }
    const h = this.heights, min = Math.min(...h), max = Math.max(...h);
    if (max - min > .28) { this.diagnostics.unsupported++; return c; }
    const gx = ((h[2] + h[4]) - (h[1] + h[3])) / (4 * w);
    const gz = ((h[1] + h[2]) - (h[3] + h[4])) / (4 * l);
    let residual = 0, positive = 0;
    for (let i = 1; i < 5; i++) {
      const ox = i === 1 || i === 3 ? -w : w, oz = i < 3 ? l : -l;
      const error = h[i] - h[0] - gx * ox - gz * oz;
      residual = Math.max(residual, Math.abs(error)); positive = Math.max(positive, error);
    }
    if (residual > .012) {
      // A rigid shoe cannot bend across a riser. Keep it over the upper tread;
      // callers still enforce finite leg reach and never move the collision root.
      c.kind = 'step'; c.point.y = max;
    } else {
      c.normal.set(-gx * cos - gz * sin, 1, gx * sin - gz * cos).normalize();
      if (c.normal.y < .72) { this.diagnostics.unsupported++; return c; }
      c.kind = 'plane'; c.point.y = h[0] + positive;
    }
    c.valid = true; return c;
  }
}
