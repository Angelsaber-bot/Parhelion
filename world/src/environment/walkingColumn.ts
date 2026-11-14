import * as THREE from 'three';
import { figureGeometry } from './orleansCrossingTeams';

/**
 * A stream of people walking a path in a loop, carrying bundles, or gathered as a crowd at its end.
 * Used for continuous resident migrations (Egypt E05: the Workmen's Village moving to the high bank).
 * Visual only; instanced (one draw per clothing colour plus one for the bundles).
 */
export type ColumnMode = 'hidden' | 'walking' | 'gathered';
type V = readonly [number, number, number];

export function pathLength(points: readonly V[]) { let L = 0; for (let i = 1; i < points.length; i++) L += Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]); return L; }
/** Point and heading at distance `s` along the polyline (clamped). */
export function pointAlong(points: readonly V[], s: number): { p: [number, number, number]; yaw: number } {
  let left = Math.max(0, s);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (left <= len || i === points.length - 1) { const t = len ? Math.min(1, left / len) : 0; return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], yaw: Math.atan2(b[0] - a[0], b[2] - a[2]) }; }
    left -= len;
  }
  return { p: [...points[0]] as [number, number, number], yaw: 0 };
}

export function createWalkingColumn(options: { name: string; path: readonly V[]; people: number; spacing: number; speed: number; tunics: readonly string[]; viewRange?: number },
  ground: (x: number, z: number, ceiling: number) => number | null) {
  const { path, people, spacing, speed, tunics } = options, total = pathLength(path), viewRange = options.viewRange ?? 260;
  const root = new THREE.Group(); root.name = options.name;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, flatShading: true });
  const geometries = tunics.map(c => figureGeometry(c, false));
  const per = Math.ceil(people / tunics.length);
  const meshes = geometries.map(g => { const m = new THREE.InstancedMesh(g, material, per); m.castShadow = true; m.frustumCulled = false; root.add(m); return m; });
  const bundleGeo = new THREE.BoxGeometry(.5, .32, .38), bundleMat = new THREE.MeshStandardMaterial({ color: '#b89a6a', roughness: .9 });
  const bundles = new THREE.InstancedMesh(bundleGeo, bundleMat, people); bundles.castShadow = true; bundles.frustumCulled = false; root.add(bundles);
  const dummy = new THREE.Object3D(), heights = new Map<string, number>();
  const h = (x: number, z: number, y: number) => { const k = `${Math.round(x)}:${Math.round(z)}`; let v = heights.get(k); if (v === undefined) { v = ground(x, z, y + 3) ?? y; heights.set(k, v); } return v; };
  let mode: ColumnMode = 'hidden', time = 0;
  const end = path[path.length - 1];
  function place(i: number) {
    let x: number, z: number, y: number, yaw: number, walking = mode === 'walking';
    if (walking) {
      const s = ((time * speed + i * spacing) % total + total) % total, at = pointAlong(path, s);
      // Each walker keeps to its own side of the path.
      const lat = ((i * 7) % 5 - 2) * .35; x = at.p[0] + Math.cos(at.yaw) * lat; z = at.p[2] - Math.sin(at.yaw) * lat; yaw = at.yaw; y = h(x, z, at.p[1]);
    } else {
      // Gathered: a loose crowd on rings around the end of the path, facing its centre.
      const ring = Math.floor(Math.sqrt(i)), a = i * 2.4; x = end[0] + Math.cos(a) * (1.2 + ring * 1.1); z = end[2] + Math.sin(a) * (1.2 + ring * 1.1);
      yaw = Math.atan2(end[0] - x, end[2] - z); y = h(x, z, end[1]);
    }
    const bob = walking ? Math.abs(Math.sin(time * 8 + i)) * .05 : 0;
    dummy.position.set(x, y + bob, z); dummy.rotation.set(0, yaw, walking ? Math.sin(time * 8 + i) * .035 : 0); dummy.scale.setScalar(1); dummy.updateMatrix();
    meshes[i % meshes.length].setMatrixAt(Math.floor(i / meshes.length), dummy.matrix);
    // Bundles ride on the head while walking and sit on the ground at the gathering.
    dummy.position.set(x, walking ? y + 1.9 + bob : y + .16, z); if (!walking) dummy.position.x += Math.cos(yaw) * .5;
    dummy.updateMatrix(); bundles.setMatrixAt(i, dummy.matrix);
  }
  return {
    root,
    get mode() { return mode; },
    apply(next: ColumnMode) { mode = next; root.visible = next !== 'hidden'; },
    update(dt: number, viewer: THREE.Vector3) {
      if (mode === 'hidden') return;
      const mid = pointAlong(path, total / 2).p;
      root.visible = Math.hypot(viewer.x - mid[0], viewer.z - mid[2]) < viewRange + total / 2; if (!root.visible) return;
      time += dt;
      for (let i = 0; i < people; i++) place(i);
      for (const m of meshes) m.instanceMatrix.needsUpdate = true; bundles.instanceMatrix.needsUpdate = true;
    },
    dispose() { root.removeFromParent(); geometries.forEach(g => g.dispose()); material.dispose(); bundleGeo.dispose(); bundleMat.dispose(); meshes.forEach(m => m.dispose()); bundles.dispose(); },
  };
}
