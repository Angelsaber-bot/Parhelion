import * as THREE from 'three';
import type { Collider } from '../player';

/** Bounded, visual-only local snapshot of immutable world-space collision triangles.
 * No controller changes. A stable patch uses no BVH calls; enabled/replaced/updated
 * collider geometry invalidates it at beginFrame. Overflow is unsupported, never a
 * partially sampled floor. In-place refits must mark changed attributes needsUpdate
 * (including indices), or explicitly call clear(); unannounced raw array writes
 * are outside the immutable collider contract and are not hashed every frame.
 * Heights use CompanionNavigation's existing ray window.
 */
export class SaberTerrainPatch {
  revision = 0;
  readonly diagnostics = { refreshes: 0, shapecasts: 0, triangles: 0, heightQueries: 0, overflows: 0, triangleTests: 0, boundsTests: 0, sourceTriangles: 0 };
  private bounds = new WeakMap<object, THREE.Box3>();
  private readonly box = new THREE.Box3();
  private readonly normal = new THREE.Vector3();
  private readonly data = new Float64Array(512 * 13);
  private readonly snapshot: { collider: Collider; bvh: object; enabled: boolean; position: object; version: number; index: object | null; indexVersion: number }[] = [];
  private count = 0;
  private valid = false;
  private ready = false;
  private oversized = false;
  private x = 0; private z = 0; private y = 0;
  constructor(private readonly colliders: Collider[]) {}
  beginFrame(x?: number, z?: number, baseY?: number) {
    if (this.colliders.length > 256) { this.oversized = true; this.ready = true; this.valid = false; return; }
    if (this.oversized) { this.ready = false; this.oversized = false; }
    let changed = this.snapshot.length !== this.colliders.length;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i], position = c.bvh.geometry.attributes.position, s = this.snapshot[i];
      const version = 'version' in position ? position.version : position.data.version;
      const index = c.bvh.geometry.index, indexVersion = index?.version ?? -1;
      if (!s || s.collider !== c || s.bvh !== c.bvh || s.enabled !== c.enabled || s.position !== position || s.version !== version || s.index !== index || s.indexVersion !== indexVersion) {
        changed = true; this.snapshot[i] = { collider: c, bvh: c.bvh, enabled: c.enabled, position, version, index, indexVersion };
        this.bounds.delete(c.bvh);
      }
    }
    this.snapshot.length = this.colliders.length;
    if (changed) { this.ready = false; this.revision++; }
    if (x !== undefined && z !== undefined && baseY !== undefined && Number.isFinite(x) && Number.isFinite(z) && Number.isFinite(baseY) && (!this.ready || Math.abs(x - this.x) > .4 || Math.abs(z - this.z) > .4 || Math.abs(baseY - this.y) > .3)) this.refresh(x, z, baseY);
  }
  clear() { this.revision++; this.ready = false; this.bounds = new WeakMap(); }
  private refresh(x: number, z: number, y: number) {
    this.x = x; this.z = z; this.y = y; this.count = 0; this.valid = true; this.ready = true; this.diagnostics.refreshes++;
    this.box.min.set(x - 2.5, y - 1.2, z - 2.5); this.box.max.set(x + 2.5, y + 1.1, z + 2.5);
    let visitedBounds = 0, visitedTriangles = 0;
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      let bounds = this.bounds.get(c.bvh);
      if (!bounds) { bounds = c.bvh.getBoundingBox(new THREE.Box3()); this.bounds.set(c.bvh, bounds); }
      if (!bounds.intersectsBox(this.box)) continue;
      this.diagnostics.shapecasts++;
      c.bvh.shapecast({
        intersectsBounds: bounds => {
          this.diagnostics.boundsTests++;
          if (++visitedBounds > 2048) this.valid = false;
          return this.valid && bounds.intersectsBox(this.box);
        },
        intersectsTriangle: triangle => {
          this.diagnostics.sourceTriangles++;
          if (++visitedTriangles > 4096) { this.valid = false; return true; }
          triangle.getNormal(this.normal);
          if (Math.abs(this.normal.y) <= .7) return false;
          const { a, b, c } = triangle;
          const minX = Math.min(a.x, b.x, c.x), maxX = Math.max(a.x, b.x, c.x), minZ = Math.min(a.z, b.z, c.z), maxZ = Math.max(a.z, b.z, c.z);
          if (maxX < this.box.min.x || minX > this.box.max.x || maxZ < this.box.min.z || minZ > this.box.max.z) return false;
          if (this.count >= 512) { this.valid = false; return true; }
          const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
          if (Math.abs(det) < 1e-12) return false;
          const k = this.count++ * 13, d = this.data;
          d[k] = minX; d[k + 1] = maxX; d[k + 2] = minZ; d[k + 3] = maxZ;
          d[k + 4] = (b.z - c.z) / det; d[k + 5] = (c.x - b.x) / det;
          d[k + 6] = (c.z - a.z) / det; d[k + 7] = (a.x - c.x) / det;
          d[k + 8] = c.x; d[k + 9] = c.z; d[k + 10] = a.y; d[k + 11] = b.y; d[k + 12] = c.y;
          return false;
        },
      });
      if (!this.valid) { this.diagnostics.overflows++; break; }
    }
    this.diagnostics.triangles = Math.max(this.diagnostics.triangles, this.count);
  }
  floor(x: number, z: number, baseY: number): number | null {
    this.diagnostics.heightQueries++;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(baseY)) return null;
    if (!this.ready) this.refresh(x, z, baseY);
    if (Math.abs(x - this.x) > 2.5 || Math.abs(z - this.z) > 2.5 || Math.abs(baseY - this.y) > .3) return null;
    if (!this.valid) return null;
    let best = -Infinity; const d = this.data;
    for (let i = 0; i < this.count; i++) {
      const k = i * 13;
      if (x < d[k] - 1e-8 || x > d[k + 1] + 1e-8 || z < d[k + 2] - 1e-8 || z > d[k + 3] + 1e-8) continue;
      this.diagnostics.triangleTests++;
      const dx = x - d[k + 8], dz = z - d[k + 9], u = d[k + 4] * dx + d[k + 5] * dz, v = d[k + 6] * dx + d[k + 7] * dz;
      if (u < -1e-8 || v < -1e-8 || u + v > 1 + 1e-8) continue;
      const height = u * d[k + 10] + v * d[k + 11] + (1 - u - v) * d[k + 12];
      if (height <= baseY + .7 && height > baseY - .8 && height > best) best = height;
    }
    return Number.isFinite(best) ? best : null;
  }
}
