import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

/** Compose a transform: position, Y rotation (rad), optional X/Z rotation, scale. */
export function T(
  x: number, y: number, z: number,
  ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0,
): THREE.Matrix4 {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}

/** Flat-shaded, vertex-coloured, non-indexed copy of a geometry. */
export function colored(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, m?: THREE.Matrix4) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  if (m) g.applyMatrix4(m);
  g.computeVertexNormals();
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Position-only copy for collision meshes. */
export function bare(geo: THREE.BufferGeometry, m?: THREE.Matrix4) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  if (m) g.applyMatrix4(m);
  return g;
}

export const BOX = new THREE.BoxGeometry(1, 1, 1);

/**
 * Accumulates coloured visual pieces and their collision proxies, then merges
 * them into one mesh each. One Batch = one named object in the GLB.
 */
export class Batch {
  vis: THREE.BufferGeometry[] = [];
  col: THREE.BufferGeometry[] = [];
  constructor(public name: string, public material = 'M_Toon') {}

  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, m: THREE.Matrix4, collide = true) {
    this.vis.push(colored(geo, color, m));
    if (collide) this.col.push(bare(geo, m));
    return this;
  }

  /** Collision-only proxy (e.g. ramp under visual stairs). */
  addCol(geo: THREE.BufferGeometry, m: THREE.Matrix4) {
    this.col.push(bare(geo, m));
    return this;
  }

  /** Axis box centred on (x, y, z) where y is the *bottom* of the box. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: THREE.ColorRepresentation, ry = 0, collide = true) {
    return this.add(BOX, color, T(x, y + h / 2, z, ry, w, h, d), collide);
  }

  /** Ramp (wedge) from (x,z) ground at y0 rising to y1 over length len along heading ry. */
  ramp(x: number, z: number, y0: number, y1: number, len: number, width: number, color: THREE.ColorRepresentation, ry = 0) {
    const rise = y1 - y0;
    const slope = Math.atan2(rise, len);
    const L = Math.hypot(rise, len);
    // a thin slab tilted around local X; centre at mid-ramp
    const m = T(x, y0 + rise / 2, z, ry, width, 0.3, L, -slope);
    return this.add(BOX, color, m);
  }

  build(): { vis: THREE.BufferGeometry | null; col: THREE.BufferGeometry | null } {
    return {
      vis: this.vis.length ? mergeGeometries(this.vis) : null,
      col: this.col.length ? mergeGeometries(this.col) : null,
    };
  }
}

export function distToSegment(px: number, pz: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz));
}

export function distToPolyline(px: number, pz: number, line: [number, number][]) {
  let d = Infinity;
  for (let i = 0; i < line.length - 1; i++) d = Math.min(d, distToSegment(px, pz, line[i], line[i + 1]));
  return d;
}
