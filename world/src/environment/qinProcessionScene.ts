import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Q06 逆着葬礼走: the funeral ranks as a real procession instead of placeholder blocks. Terracotta
 * figures in ceremonial step march in two crossing columns: one cuts the old road (four files wide),
 * one files inward toward the central hall further off. Visual only; the chapter decides when the
 * road is cut (`cutting`) and when the column has moved on. One instanced draw per column.
 */
export const PROCESSION = Object.freeze({ files: 4, perFile: 14, spacing: 1.45, fileGap: 1.1, speed: 1.05, lane: 44, inward: 30, viewRange: 220 });

/** A terracotta figure (≈1.85 m): legs, tunic, lamellar vest, arms at the sides, head and topknot. */
export function terracottaGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, color: string, x: number, y: number, z: number, rx = 0) => {
    g.rotateX(rx); g.translate(x, y, z); const c = new THREE.Color(color), n = g.getAttribute('position').count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g.index ? g.toNonIndexed() : g);
  };
  const clay = '#9a7b5c', dark = '#6e5843', vest = '#7f6a52', face = '#a88968';
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(.17, .78, .2), dark, s * .12, .39, 0);
  add(new THREE.CylinderGeometry(.26, .36, .62, 8), clay, 0, .98, 0);
  add(new THREE.BoxGeometry(.5, .42, .3), vest, 0, 1.22, 0);
  for (let r = 0; r < 3; r++) add(new THREE.BoxGeometry(.52, .03, .32), dark, 0, 1.06 + r * .14, 0);
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(.07, .06, .62, 6), clay, s * .31, 1.12, .02);
  add(new THREE.SphereGeometry(.15, 8, 6), face, 0, 1.6, 0);
  add(new THREE.CylinderGeometry(.06, .08, .1, 6), dark, .04, 1.77, -.03);
  const merged = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); merged.computeVertexNormals(); return merged;
}

export function createQinProcessionScene(anchor: () => readonly number[] | undefined, ground: (x: number, z: number, y: number) => number | null) {
  const root = new THREE.Group(); root.name = 'QinFuneralProcession';
  const geometry = terracottaGeometry(), material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, flatShading: true });
  const make = (count: number) => { const m = new THREE.InstancedMesh(geometry, material, count); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; root.add(m); return m; };
  const count = PROCESSION.files * PROCESSION.perFile, cutter = make(count), inward = make(count);
  const dummy = new THREE.Object3D(), heights = new Map<string, number>();
  let base: readonly number[] | undefined, time = 0, mode: 'hidden' | 'cutting' | 'moved' = 'hidden';
  const height = (x: number, z: number, y: number) => {
    const key = `${Math.round(x * 2)}:${Math.round(z * 2)}`; let h = heights.get(key);
    if (h === undefined) { h = ground(x, z, y + 3) ?? y; heights.set(key, h); } return h;
  };
  /** Position `i` of a column along its lane: files side by side, figures one behind another, looping. */
  const place = (mesh: THREE.InstancedMesh, origin: [number, number, number], dir: [number, number], i: number, offset: number) => {
    const file = i % PROCESSION.files, rank = Math.floor(i / PROCESSION.files), span = PROCESSION.lane;
    const s = ((rank * PROCESSION.spacing + offset) % span + span) % span - span / 2;
    const lat = (file - (PROCESSION.files - 1) / 2) * PROCESSION.fileGap;
    const x = origin[0] + dir[0] * s - dir[1] * lat, z = origin[2] + dir[1] * s + dir[0] * lat;
    // A stiff ceremonial step: a small lift each pace and a slight shoulder sway, staggered by file.
    const step = Math.sin((s / .72) * Math.PI + file), y = height(x, z, origin[1]) + Math.max(0, step) * .04;
    // Figures fade in and out at the lane ends instead of popping.
    const edge = Math.min(1, (span / 2 - Math.abs(s)) / 2.5);
    dummy.position.set(x, y, z); dummy.rotation.set(0, Math.atan2(dir[0], dir[1]), step * .03); dummy.scale.setScalar(Math.max(.001, edge));
    dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  };
  return {
    root,
    /** `cutting`: the column crosses the road now; `moved`: it has passed on (only the far column remains). */
    apply(state: 'hidden' | 'cutting' | 'moved') { mode = state; root.visible = state !== 'hidden'; cutter.visible = state === 'cutting'; },
    get mode() { return mode; },
    update(dt: number, viewer: THREE.Vector3) {
      if (mode === 'hidden') return;
      const at = anchor(); if (!at) { root.visible = false; return; }
      if (!base || base[0] !== at[0] || base[2] !== at[2]) { base = at; heights.clear(); }
      root.visible = Math.hypot(viewer.x - at[0], viewer.z - at[2]) < PROCESSION.viewRange; if (!root.visible) return;
      time += dt; const travel = time * PROCESSION.speed;
      // The cutting column crosses the road (east–west) just in front of the cut point.
      if (cutter.visible) { for (let i = 0; i < count; i++) place(cutter, [at[0], at[1], at[2] + 1.5], [1, 0], i, travel); cutter.instanceMatrix.needsUpdate = true; }
      // The inward column files toward the hall (north) further off, crossing the first column's line.
      for (let i = 0; i < count; i++) place(inward, [at[0] + PROCESSION.inward * .5, at[1], at[2] - 18], [0, -1], i, travel * .9);
      inward.instanceMatrix.needsUpdate = true;
    },
    dispose() { root.removeFromParent(); geometry.dispose(); material.dispose(); cutter.dispose(); inward.dispose(); },
  };
}
