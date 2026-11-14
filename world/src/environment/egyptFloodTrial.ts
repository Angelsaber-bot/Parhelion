import * as THREE from 'three';

type P = readonly [number, number, number];
export type FloodStage = 'idle' | 'blocked' | 'flowing';
/** E06 试洪 as a working water show: closed → the gate lifts and a small flow runs down the channel →
 * the dry armour plate blocks the outlet and the water backs up → any solution clears it and the flow
 * runs on past the outlet. The high-bank bypass basin swirls once tested and runs hard while the sky
 * water drains in stages (E08). Visual only; the chapter flags drive it. */
export function floodStage(d: ReadonlySet<string>, f: { trial: string; side: string; armor: string; steady: string }): FloodStage {
  if (!d.has(f.trial)) return 'idle';
  return [f.side, f.armor, f.steady].some(x => d.has(x)) ? 'flowing' : 'blocked';
}

/** A tileable flow texture (bright crests on teal) made without the DOM, so tests can build it too. */
function flowTexture() {
  const w = 4, h = 64, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const crest = Math.max(0, Math.sin(y / h * Math.PI * 6)) ** 6, foam = Math.max(0, Math.sin(y / h * Math.PI * 2 + 1)) ** 12;
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, k = Math.min(1, crest * .55 + foam * .8); data.set([60 + k * 190, 150 + k * 100, 165 + k * 85, 215], i); }
  }
  const t = new THREE.DataTexture(data, w, h); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

export function createFloodTrial(points: { gate: P; outlet: P; basin: P }, ground: (x: number, z: number, ceiling: number) => number | null) {
  const root = new THREE.Group(); root.name = 'EgyptFloodTrial';
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const mat = <M extends THREE.Material>(m: M) => { materials.push(m); return m; };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = root) => { geometries.push(g); const o = new THREE.Mesh(g, m); o.raycast = () => {}; parent.add(o); return o; };
  const stone = mat(new THREE.MeshStandardMaterial({ color: '#c9b088', roughness: .9 })), wood = mat(new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: .85 }));
  const texture = flowTexture();
  const flowMat = mat(new THREE.MeshStandardMaterial({ map: texture, color: '#9fe3e6', roughness: .15, metalness: .1, transparent: true, opacity: .88, emissive: '#1d5f66', emissiveIntensity: .25 }));
  const poolMat = mat(new THREE.MeshStandardMaterial({ color: '#3f8f98', roughness: .1, metalness: .2, transparent: true, opacity: .85, emissive: '#16484e', emissiveIntensity: .3 }));
  const foamMat = mat(new THREE.MeshBasicMaterial({ color: '#f2fbf8', transparent: true, opacity: .75, depthWrite: false }));
  const height = (x: number, z: number, y: number) => ground(x, z, y + 3) ?? y;
  const [gx, gy, gz] = points.gate, [ox, oy, oz] = points.outlet;
  const dx = ox - gx, dz = oz - gz, run = Math.hypot(dx, dz) || 1, ux = dx / run, uz = dz / run, yaw = Math.atan2(ux, uz);

  // The sluice gate: two posts, a lintel and a leaf that lifts when the test flow is admitted.
  const gate = new THREE.Group(); gate.position.set(gx, height(gx, gz, gy), gz); gate.rotation.y = yaw; root.add(gate);
  for (const s of [-1, 1]) { const post = mesh(new THREE.BoxGeometry(.5, 3, .6), stone, gate); post.position.set(s * 1.5, 1.5, 0); }
  mesh(new THREE.BoxGeometry(3.6, .45, .7), stone, gate).position.set(0, 3.1, 0);
  const leaf = mesh(new THREE.BoxGeometry(2.5, 1.6, .18), wood, gate); leaf.position.set(0, .8, 0);
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(.05, .05, 1.2, 6), wood, gate).position.set(s * .6, 3.9, 0);

  // The channel: a ribbon of flowing water that follows the ground from the gate to past the outlet.
  const past = 9, segments = 40, ribbon = new THREE.BufferGeometry(), half = 1.25;
  const positions = new Float32Array((segments + 1) * 2 * 3), uvs = new Float32Array((segments + 1) * 2 * 2), index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const s = i / segments * (run + past), cx = gx + ux * s, cz = gz + uz * s, y = height(cx, cz, gy + (oy - gy) * Math.min(1, s / run)) + .08;
    for (const [k, side] of [[0, -1], [1, 1]] as const) {
      const j = i * 2 + k; positions.set([cx - uz * half * side, y, cz + ux * half * side], j * 3); uvs.set([k, s / 3], j * 2);
    }
    if (i < segments) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  ribbon.setAttribute('position', new THREE.BufferAttribute(positions, 3)); ribbon.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); ribbon.setIndex(index); ribbon.computeVertexNormals();
  const stream = mesh(ribbon, flowMat); stream.name = 'FloodTrialStream'; stream.receiveShadow = true;
  // Clip the ribbon at the outlet while blocked: draw only the first part of the index range.
  const blockedCount = Math.round(segments * run / (run + past)) * 6;

  // The backed-up pool at the blocked outlet, with a churning foam ring.
  const pool = mesh(new THREE.CircleGeometry(3.2, 28), poolMat); pool.rotation.x = -Math.PI / 2; pool.name = 'FloodTrialPool';
  const poolY = height(ox, oz, oy) + .22; pool.position.set(ox, poolY, oz);
  const foamRing = mesh(new THREE.RingGeometry(2.6, 3.3, 32), foamMat); foamRing.rotation.x = -Math.PI / 2; foamRing.position.set(ox, poolY + .02, oz);
  // Spray where the flow leaves the gate and where it tumbles past the outlet.
  const sprayGeo = new THREE.SphereGeometry(.12, 6, 4), spray = new THREE.InstancedMesh(sprayGeo, foamMat, 24); geometries.push(sprayGeo); spray.raycast = () => {}; spray.frustumCulled = false; root.add(spray);
  const fall = new THREE.Vector3(ox + ux * 2.5, poolY, oz + uz * 2.5);

  // The bypass stilling basin on the high bank.
  const [bx, by, bz] = points.basin, basinY = height(bx, bz, by) + .25;
  const basin = new THREE.Group(); basin.position.set(bx, basinY, bz); root.add(basin);
  const rim = mesh(new THREE.TorusGeometry(3.4, .3, 6, 28), stone, basin); rim.rotation.x = Math.PI / 2;
  const basinWater = mesh(new THREE.CircleGeometry(3.3, 28), flowMat, basin); basinWater.rotation.x = -Math.PI / 2; basinWater.name = 'FloodTrialBasinWater';
  const swirl = mesh(new THREE.RingGeometry(1.2, 2.6, 24, 1, 0, Math.PI * 1.3), foamMat, basin); swirl.rotation.x = -Math.PI / 2; swirl.position.y = .03;

  const dummy = new THREE.Object3D();
  let stage: FloodStage = 'idle', basinMode: 'dry' | 'tested' | 'draining' = 'dry', time = 0, lift = 0;
  return {
    root,
    get stage() { return stage; },
    get basinMode() { return basinMode; },
    apply(next: FloodStage, bypass: 'dry' | 'tested' | 'draining') {
      stage = next; basinMode = bypass;
      stream.visible = next !== 'idle'; ribbon.setDrawRange(0, next === 'blocked' ? blockedCount : Infinity);
      pool.visible = foamRing.visible = next === 'blocked'; spray.visible = next !== 'idle';
      basinWater.visible = swirl.visible = bypass !== 'dry';
    },
    update(dt: number) {
      time += dt;
      lift += ((stage === 'idle' ? 0 : 1.25) - lift) * Math.min(1, dt * 1.5); leaf.position.y = .8 + lift;
      texture.offset.y = -time * (stage === 'flowing' ? 1.1 : .55);
      if (pool.visible) { const s = 1 + Math.sin(time * 2.4) * .03; foamRing.scale.set(s, s, 1); foamMat.opacity = .55 + Math.sin(time * 5) * .15; }
      swirl.rotation.z = -time * (basinMode === 'draining' ? 2.4 : .9);
      if (spray.visible) {
        for (let i = 0; i < 24; i++) {
          const atGate = i < 12, k = (time * 1.7 + i * .37) % 1, a = i * 2.39;
          const base = atGate ? new THREE.Vector3(gx + ux * .8, height(gx, gz, gy) + .3, gz + uz * .8) : stage === 'flowing' ? fall : new THREE.Vector3(ox - ux * 2.6, poolY, oz - uz * 2.6);
          dummy.position.set(base.x + Math.cos(a) * .9 * k, base.y + Math.sin(k * Math.PI) * (atGate ? .9 : .6), base.z + Math.sin(a) * .9 * k);
          dummy.scale.setScalar(1 - k * .6); dummy.updateMatrix(); spray.setMatrixAt(i, dummy.matrix);
        }
        spray.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() { root.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); texture.dispose(); spray.dispose(); },
  };
}
