import * as THREE from 'three';

/**
 * Where the winter city's frozen crossing meets a neighbouring region's open water, the ice used to end
 * on the tile border as one straight edge. Broken ice now drifts off the shelf: large plates hard against
 * the edge, smaller and sparser ones further out, bobbing on the water, so the frozen era thaws into the
 * next one instead of stopping on a ruler line. Found from the terrain itself (any border where a flat
 * shelf at the waterline faces water), instanced (one draw), visual only.
 */
export const ICE_FLOES = Object.freeze({ max: 240, reach: 30, perSample: 4, big: 3.2, small: .7, viewRange: 320, shelfBand: .3, probe: [6, 12, 18, 24] as const });

export interface FloePlan { x: number; z: number; size: number; yaw: number; phase: number }

function rng(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

/**
 * Plan floes along the given tile borders. `height(x, z)` is terrain height (null off the map),
 * `frozen(x, z)` says whether a point belongs to the frozen region.
 */
export function planIceFloes(borders: { xs: readonly number[]; zs: readonly number[] }, extent: { x0: number; z0: number; span: number; spanZ: number },
  height: (x: number, z: number) => number | null, frozen: (x: number, z: number) => boolean, waterLevel: number): FloePlan[] {
  const out: FloePlan[] = [], rand = rng(0x1ce), shelfY = waterLevel + .1;
  const scan = (axis: 'x' | 'z', at: number, t0: number, t1: number) => {
    for (let t = t0; t <= t1; t += 2) for (const side of [-1, 1]) {
      const p = (d: number, lateral = 0): [number, number] => axis === 'x' ? [at + d, t + lateral] : [t + lateral, at + d];
      const [sx, sz] = p(side * 2), shelf = height(sx, sz);
      if (shelf === null || !frozen(sx, sz)) continue;
      // The neighbour's bank may shelve gently: open water counts anywhere in the first stretch beyond the line.
      let water = Infinity; for (const d of ICE_FLOES.probe) { const h = height(...p(-side * d)); if (h !== null) water = Math.min(water, h); }
      if (water === Infinity) continue;
      if (Math.abs(shelf - shelfY) > ICE_FLOES.shelfBand || water > waterLevel - .15) continue;
      for (let k = 0; k < ICE_FLOES.perSample && out.length < ICE_FLOES.max; k++) {
        // Crowded against the shelf, thinning out into open water.
        const far = rand() ** 2, d = 1 + far * ICE_FLOES.reach, [x, z] = p(-side * d, (rand() - .5) * 5), bed = height(x, z);
        if (bed === null || bed > waterLevel - .12) continue;
        out.push({ x, z, size: (ICE_FLOES.big + (ICE_FLOES.small - ICE_FLOES.big) * far) * (.6 + rand() * .7), yaw: rand() * Math.PI * 2, phase: rand() * Math.PI * 2 });
      }
    }
  };
  for (const x of borders.xs) scan('x', x, extent.z0 + 4, extent.z0 + extent.spanZ - 4);
  for (const z of borders.zs) scan('z', z, extent.x0 + 4, extent.x0 + extent.span - 4);
  return out;
}

export function createIceFloes(plan: readonly FloePlan[], waterLevel: number) {
  const geometry = new THREE.CylinderGeometry(1, .9, .24, 7), material = new THREE.MeshLambertMaterial({ color: '#eef6fb', emissive: '#6f93ad', emissiveIntensity: .25, flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, plan.length));
  mesh.name = 'IceFloes'; mesh.count = plan.length; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.raycast = () => {};
  const dummy = new THREE.Object3D(), center = new THREE.Vector3();
  for (const f of plan) center.x += f.x / Math.max(1, plan.length), center.z += f.z / Math.max(1, plan.length);
  let time = 0;
  const place = () => {
    for (let i = 0; i < plan.length; i++) {
      const f = plan[i];
      // Each plate rides the water: a slow bob, a slight tilt and a lazy turn of its own.
      dummy.position.set(f.x, waterLevel + .03 + Math.sin(time * .8 + f.phase) * .035, f.z);
      dummy.rotation.set(Math.sin(time * .6 + f.phase) * .03, f.yaw + time * .02 * Math.sin(f.phase * 3), Math.cos(time * .5 + f.phase) * .03);
      dummy.scale.set(f.size, 1, f.size * (.7 + .3 * Math.abs(Math.sin(f.phase * 2)))); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  place();
  return {
    mesh, count: plan.length,
    update(dt: number, viewer: THREE.Vector3) {
      if (!plan.length) { mesh.visible = false; return; }
      mesh.visible = Math.hypot(viewer.x - center.x, viewer.z - center.z) < ICE_FLOES.viewRange; if (!mesh.visible) return;
      time += dt; place();
    },
    dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); mesh.dispose(); },
  };
}
