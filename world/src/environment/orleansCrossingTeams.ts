import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * O08 「三队同时动」 at the Orleans bridge: engineers carry a plank to the mark, boatmen bring a boat
 * in to the pier, crossbowmen shift behind fresh mantlets — all at once, as the chapter says. While
 * the crossing is open and the run not yet made they rehearse it in a loop; once the player has run
 * it they hold the finished positions. Visual only (no collision), small instanced figures.
 */
type V = readonly [number, number, number];
export type CrossingPhase = 'hidden' | 'rehearsing' | 'done';
export const CROSSING = Object.freeze({ cycle: 9, viewRange: 240 });

/** A soldier/worker figure (≈1.8 m) with a tunic colour and either a kettle helmet or a cap. */
export function figureGeometry(tunic: string, helmet: boolean) {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => {
    g.translate(x, y, z); const c = new THREE.Color(color), n = g.getAttribute('position').count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g.index ? g.toNonIndexed() : g);
  };
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(.16, .8, .18), '#3d3a36', s * .11, .4, 0);
  add(new THREE.CylinderGeometry(.24, .3, .66, 8), tunic, 0, 1.08, 0);
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(.065, .055, .6, 6), tunic, s * .3, 1.12, .04);
  add(new THREE.SphereGeometry(.14, 8, 6), '#d9b08c', 0, 1.56, 0);
  if (helmet) add(new THREE.CylinderGeometry(.2, .2, .05, 10), '#8d939a', 0, 1.66, 0), add(new THREE.SphereGeometry(.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#8d939a', 0, 1.64, 0);
  else add(new THREE.CylinderGeometry(.13, .15, .12, 8), '#5a4632', 0, 1.69, 0);
  const g = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); g.computeVertexNormals(); return g;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp3 = (a: V, b: V, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function createOrleansCrossingTeams(spots: { deckFrom: V; deckMark: V; boatFrom: V; boatPier: V; coverFrom: V; coverTo: V }, ground: (x: number, z: number, ceiling: number) => number | null) {
  const root = new THREE.Group(); root.name = 'OrleansCrossingTeams';
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }); materials.push(vc);
  const solid = (c: string) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: .85 }); materials.push(m); return m; };
  const team = (tunic: string, helmet: boolean, n: number) => { const g = figureGeometry(tunic, helmet); geometries.push(g); const m = new THREE.InstancedMesh(g, vc, n); m.castShadow = true; m.frustumCulled = false; root.add(m); return m; };
  const engineers = team('#8a6a3c', false, 4), boatmen = team('#3f5f7a', false, 3), crossbows = team('#2f4d8c', true, 3);
  const plankGeo = new THREE.BoxGeometry(.35, .08, 4.2); geometries.push(plankGeo);
  const plank = new THREE.Mesh(plankGeo, solid('#9c7a4e')); plank.castShadow = true; root.add(plank);
  const hullGeo = new THREE.BoxGeometry(1.9, .55, 5.2), bowGeo = new THREE.ConeGeometry(.95, 1.4, 4); bowGeo.rotateX(Math.PI / 2); bowGeo.rotateZ(Math.PI / 4); geometries.push(hullGeo, bowGeo);
  const boat = new THREE.Group(); root.add(boat);
  const hullMat = solid('#6b4a2e'); const hull = new THREE.Mesh(hullGeo, hullMat); hull.position.y = .2; boat.add(hull);
  const bow = new THREE.Mesh(bowGeo, hullMat); bow.position.set(0, .2, 3.2); bow.scale.set(1, .6, 1); boat.add(bow);
  const mantletGeo = new THREE.BoxGeometry(1.6, 1.3, .14); geometries.push(mantletGeo);
  const mantletMat = solid('#7a6448'), mantlets = [-1.8, 0, 1.8].map(() => { const m = new THREE.Mesh(mantletGeo, mantletMat); m.castShadow = true; root.add(m); return m; });
  const dummy = new THREE.Object3D(), heights = new Map<string, number>();
  const h = (x: number, z: number, y: number) => { const k = `${Math.round(x * 2)}:${Math.round(z * 2)}`; let v = heights.get(k); if (v === undefined) { v = ground(x, z, y + 2) ?? y; heights.set(k, v); } return v; };
  const set = (mesh: THREE.InstancedMesh, i: number, p: readonly number[], yaw: number, walking: boolean, t: number) => {
    const bob = walking ? Math.abs(Math.sin(t * 9 + i)) * .05 : 0;
    dummy.position.set(p[0], p[1] + bob, p[2]); dummy.rotation.set(0, yaw, walking ? Math.sin(t * 9 + i) * .04 : 0); dummy.scale.setScalar(1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  };
  const yawOf = (a: V, b: V) => Math.atan2(b[0] - a[0], b[2] - a[2]);
  let phase: CrossingPhase = 'hidden', time = 0;
  // Mantlets stand at the new cover line, facing back across the river.
  const coverYaw = yawOf(spots.coverFrom, spots.coverTo) + Math.PI / 2;
  mantlets.forEach((m, k) => { const off = (k - 1) * 1.8, x = spots.coverTo[0] + Math.cos(coverYaw) * off, z = spots.coverTo[2] - Math.sin(coverYaw) * off; m.position.set(x, h(x, z, spots.coverTo[1]) + .65, z + .9); m.rotation.y = coverYaw; });
  function pose(progress: number) {
    const walking = progress > 0 && progress < 1, p = smooth(Math.min(1, Math.max(0, progress)));
    // Engineers: two pairs either side of the plank, walking it along the deck to the mark.
    const e = lerp3(spots.deckFrom, spots.deckMark, p), eyaw = yawOf(spots.deckFrom, spots.deckMark), ex = Math.cos(eyaw), ez = -Math.sin(eyaw), fx = Math.sin(eyaw), fz = Math.cos(eyaw);
    for (let i = 0; i < 4; i++) { const side = i % 2 ? .45 : -.45, along = i < 2 ? 1.4 : -1.4, x = e[0] + ex * side + fx * along, z = e[2] + ez * side + fz * along; set(engineers, i, [x, h(x, z, e[1]), z], eyaw, walking, time); }
    plank.position.set(e[0], h(e[0], e[2], e[1]) + 1.32, e[2]); plank.rotation.y = eyaw;
    // Boatmen: the boat glides in from mid-river to the pier; two row, one stands at the bow.
    const b = lerp3(spots.boatFrom, spots.boatPier, p), byaw = yawOf(spots.boatFrom, spots.boatPier);
    boat.position.set(b[0], b[1] + Math.sin(time * 1.6) * .05, b[2]); boat.rotation.set(Math.sin(time * 1.3) * .02, byaw, Math.sin(time * 1.1) * .03);
    const bfx = Math.sin(byaw), bfz = Math.cos(byaw);
    for (let i = 0; i < 3; i++) { const along = [-1.4, .2, 2.2][i], x = b[0] + bfx * along, z = b[2] + bfz * along; set(boatmen, i, [x, b[1] + .45 - (i < 2 ? .3 : 0), z], byaw + (i < 2 ? Math.sin(time * 2.4 + i) * .2 : 0), false, time); }
    // Crossbowmen: shift from the open bank to behind the mantlets.
    const c = lerp3(spots.coverFrom, spots.coverTo, p), cyaw = walking ? yawOf(spots.coverFrom, spots.coverTo) : coverYaw - Math.PI / 2;
    for (let i = 0; i < 3; i++) { const off = (i - 1) * 1.8, x = c[0] + Math.cos(coverYaw) * off, z = c[2] - Math.sin(coverYaw) * off; set(crossbows, i, [x, h(x, z, c[1]), z], cyaw, walking, time); }
    for (const m of [engineers, boatmen, crossbows]) m.instanceMatrix.needsUpdate = true;
  }
  return {
    root,
    get phase() { return phase; },
    apply(next: CrossingPhase) { phase = next; root.visible = next !== 'hidden'; },
    /** 0 at the start of a rehearsal, 1 at the finished positions (exposed for tests). */
    progress() { if (phase === 'done') return 1; const t = time % CROSSING.cycle; return Math.min(1, Math.max(0, (t - 1) / (CROSSING.cycle - 3))); },
    update(dt: number, viewer: THREE.Vector3) {
      if (phase === 'hidden') return;
      root.visible = Math.hypot(viewer.x - spots.deckMark[0], viewer.z - spots.deckMark[2]) < CROSSING.viewRange; if (!root.visible) return;
      time += dt; pose(this.progress());
    },
    dispose() { root.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); [engineers, boatmen, crossbows].forEach(m => m.dispose()); },
  };
}
