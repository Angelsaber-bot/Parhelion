import * as THREE from 'three';

/**
 * 星官穹顶: the astronomers' ceiling over the Q06 viewpoint, painted as a night sky. A deep indigo
 * panel carries ~240 stars (a slow twinkle), twelve constellations joined by faint gold lines, and a
 * gold celestial ring with the 28 lunar mansions ticked around it. Visual only; drawn near the dome.
 */
export const STAR_CEILING = Object.freeze({ stars: 240, constellations: 12, mansions: 28, viewRange: 90 });

/** Deterministic pseudo-random so the sky is the same every visit. */
function rng(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

export function createQinStarCeiling(center: readonly [number, number, number], size: readonly [number, number]) {
  const root = new THREE.Group(); root.name = 'QinStarCeiling'; root.position.set(center[0], center[1], center[2]);
  const [w, d] = size, rand = rng(0x51a9);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const keep = <T extends THREE.BufferGeometry | THREE.Material>(x: T) => { (x instanceof THREE.Material ? materials : geometries).push(x as never); return x; };
  // Backing panel facing down.
  const panel = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, d)), keep(new THREE.MeshBasicMaterial({ color: '#141a3a', side: THREE.DoubleSide })));
  panel.rotation.x = Math.PI / 2; root.add(panel);
  const frame = new THREE.Mesh(keep(new THREE.RingGeometry(1, 1.04, 4, 1, Math.PI / 4)), keep(new THREE.MeshBasicMaterial({ color: '#b08a4a', side: THREE.DoubleSide })));
  frame.rotation.x = Math.PI / 2; frame.scale.set(w / 1.414, d / 1.414, 1); frame.position.y = -.01; root.add(frame);
  // Stars: instanced discs just below the panel.
  const starGeo = keep(new THREE.CircleGeometry(1, 6)); starGeo.rotateX(Math.PI / 2);
  const starMat = keep(new THREE.MeshBasicMaterial({ color: '#fff4d6', side: THREE.DoubleSide, toneMapped: false }));
  const stars = new THREE.InstancedMesh(starGeo, starMat, STAR_CEILING.stars); stars.frustumCulled = false; root.add(stars);
  const base: { x: number; z: number; r: number; phase: number }[] = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < STAR_CEILING.stars; i++) base.push({ x: (rand() - .5) * w * .94, z: (rand() - .5) * d * .94, r: .04 + rand() ** 3 * .14, phase: rand() * Math.PI * 2 });
  // Constellations: small clusters of brighter stars joined in a chain.
  const linePts: number[] = [];
  for (let c = 0; c < STAR_CEILING.constellations; c++) {
    const cx = (rand() - .5) * w * .8, cz = (rand() - .5) * d * .8, n = 4 + Math.floor(rand() * 4); let px = cx, pz = cz;
    for (let k = 0; k < n; k++) {
      const x = cx + (rand() - .5) * 4.5, z = cz + (rand() - .5) * 4.5, i = c * 7 + k;
      if (i < base.length) base[i] = { x, z, r: .13 + rand() * .07, phase: rand() * Math.PI * 2 };
      if (k) linePts.push(px, -.04, pz, x, -.04, z); px = x; pz = z;
    }
  }
  const lineGeo = keep(new THREE.BufferGeometry()); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
  const lines = new THREE.LineSegments(lineGeo, keep(new THREE.LineBasicMaterial({ color: '#d9b26a', transparent: true, opacity: .55 }))); root.add(lines);
  // Gold celestial ring with the 28 mansions.
  const ringR = Math.min(w, d) * .38, gold = keep(new THREE.MeshBasicMaterial({ color: '#c9a050', side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(keep(new THREE.RingGeometry(ringR - .06, ringR + .06, 96)), gold); ring.rotation.x = Math.PI / 2; ring.position.y = -.03; root.add(ring);
  const tickGeo = keep(new THREE.PlaneGeometry(.06, .7)); tickGeo.rotateX(Math.PI / 2);
  for (let m = 0; m < STAR_CEILING.mansions; m++) { const a = m / STAR_CEILING.mansions * Math.PI * 2, t = new THREE.Mesh(tickGeo, gold); t.position.set(Math.cos(a) * ringR, -.035, Math.sin(a) * ringR); t.rotation.y = -a + Math.PI / 2; root.add(t); }
  let time = 0;
  const place = () => {
    for (let i = 0; i < base.length; i++) {
      const s = base[i], tw = .75 + .25 * Math.sin(time * (1.2 + (i % 5) * .3) + s.phase);
      dummy.position.set(s.x, -.05, s.z); dummy.scale.setScalar(s.r * tw); dummy.updateMatrix(); stars.setMatrixAt(i, dummy.matrix);
    }
    stars.instanceMatrix.needsUpdate = true;
  };
  place();
  return {
    root,
    update(dt: number, viewer: THREE.Vector3) {
      root.visible = Math.hypot(viewer.x - center[0], viewer.z - center[2]) < STAR_CEILING.viewRange; if (!root.visible) return;
      time += dt; place();
    },
    dispose() { root.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); stars.dispose(); },
  };
}
