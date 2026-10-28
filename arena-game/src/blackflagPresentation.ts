import * as THREE from 'three';
import type { Atmosphere } from './atmosphere.ts';

/** Ship-only look. Do not edit the shared seabreeze preset: other authored maps may use it. */
export const BLACKFLAG_ATMOSPHERE: Atmosphere = {
  background: 0xa1bdc9,
  // The whole 64 x 34 m fighting deck remains in front of the fog. Only the sea,
  // distant sails and islands soften into the horizon, never opponents or cover.
  fog: [0xb8cdd5, 78, 230], exposure: 1.0,
  hemi: [0xc7e1eb, 0x626779, 1.45],
  sun: { color: 0xffe2b4, intensity: 2.95, pos: [-32, 39, 24] },
  sky: { horizon: 0xe3dfca, mid: 0x7ba8bb, top: 0x366d95, sun: 0xffedca, cloudLit: 0xf8ead6, cloudShade: 0x97adbf, night: 0 },
  particles: 'none', bloom: 0.12, bloomThreshold: 1.95,
};

const SHIP_SHADOW_MATERIALS = new Set([
  'timber', 'deck', 'plank', 'grain', 'tar', 'iron', 'brass', 'canvas',
  'canvasShade', 'blackSail', 'woodLight', 'woodDark',
]);

/** GLTFLoader puts extras on the parent Group when a node has multiple primitives.
 * Only Blackflag uses this policy; sea/background must not enter the static shadow
 * pass, but opaque sails, rope, rails and cabin carpentry should cast onto the deck.
 */
export function blackflagCastsShadow(mesh: THREE.Mesh): boolean {
  let node: THREE.Object3D | null = mesh;
  while (node) {
    const data = node.userData;
    if (typeof data.castShadow === 'boolean') return data.castShadow;
    if (data.decorative === true) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      return materials.every(material => SHIP_SHADOW_MATERIALS.has(material.name));
    }
    if (data.decorative === false || data.role) return data.role !== 'floor' && data.role !== 'wayfinding';
    node = node.parent;
  }
  return true;
}

export const BLACKFLAG_EFFECT_BUDGET = {
  high: { sea: 96, motes: 48 },
  low: { sea: 32, motes: 0 },
} as const;

/** Fixed, world-space fields: never a camera-following haze or a combat effect.
 * High: 144 points / two draws; low: 32 points / one draw. One shadowless fill.
 * No new textures, custom shaders, render targets or per-frame object allocations.
 */
export class BlackflagEffects {
  readonly root = new THREE.Group();
  private readonly sea: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly motes: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null;
  private readonly fill = new THREE.DirectionalLight(0xa6d6e8, 0.32);
  private readonly seaPositions: THREE.BufferAttribute;
  private readonly motePositions: THREE.BufferAttribute | null;
  private readonly seaSeeds: Float32Array;
  private readonly moteSeeds: Float32Array;
  private time = 0;
  private disposed = false;

  constructor(texture: THREE.Texture, quality: 'high' | 'low') {
    this.root.name = 'BLACKFLAG_sea_light_and_air';
    this.fill.name = 'BLACKFLAG_cool_sea_fill';
    this.fill.position.set(30, 8, -24);
    this.fill.castShadow = false;
    this.root.add(this.fill, this.fill.target);

    const budget = BLACKFLAG_EFFECT_BUDGET[quality];
    this.seaSeeds = new Float32Array(budget.sea * 3);
    this.moteSeeds = new Float32Array(budget.motes * 3);
    // Deterministic fields make captures and regression checks reproducible. No
    // Math.random in the update path, and positions never expand with camera travel.
    let seed = 0xb1ac5ea;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < budget.sea; i++) {
      const k = i * 3;
      this.seaSeeds[k] = random() * 144 - 72;
      this.seaSeeds[k + 1] = random() * Math.PI * 2;
      this.seaSeeds[k + 2] = (i % 2 ? 1 : -1) * (22 + random() * 62);
    }
    for (let i = 0; i < budget.motes; i++) {
      const k = i * 3;
      this.moteSeeds[k] = random() * 48 - 24;
      this.moteSeeds[k + 1] = 6 + random() * 12;
      this.moteSeeds[k + 2] = random() * 28 - 14;
    }
    this.sea = this.makePoints('BLACKFLAG_sea_glints', budget.sea, texture, 0xc5e2e5, 0.13, 0.45);
    this.seaPositions = this.sea.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.motes = budget.motes ? this.makePoints('BLACKFLAG_upper_sun_motes', budget.motes, texture, 0xffe6b8, 0.06, 0.3) : null;
    this.motePositions = this.motes?.geometry.getAttribute('position') as THREE.BufferAttribute ?? null;
    this.update(0);
  }

  private makePoints(name: string, count: number, texture: THREE.Texture, color: number, size: number, opacity: number) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.PointsMaterial({
      color, map: texture, size, sizeAttenuation: true, opacity, transparent: true,
      alphaTest: 0.02, depthTest: true, depthWrite: false,
      blending: THREE.NormalBlending, fog: true, toneMapped: true,
    });
    const points = new THREE.Points(geometry, material);
    points.name = name;
    // A fixed conservative bound avoids recomputing bounding spheres each frame.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), name === 'BLACKFLAG_sea_glints' ? 116 : 36);
    points.castShadow = points.receiveShadow = false;
    this.root.add(points);
    return points;
  }

  update(dt: number) {
    if (this.disposed) return;
    // Paused tabs and malformed caller deltas must not produce streaks/NaNs.
    if (Number.isFinite(dt) && dt > 0) this.time += Math.min(dt, 0.1);
    const t = this.time;
    const sea = this.seaPositions.array as Float32Array;
    for (let k = 0; k < sea.length; k += 3) {
      const phase = this.seaSeeds[k + 1];
      sea[k] = this.seaSeeds[k] + Math.sin(t * 0.48 + phase) * 0.75;
      // Sea surface is -6.025 m: all glints stay just above it and below the hull.
      sea[k + 1] = -5.96 + Math.sin(t * 0.9 + phase) * 0.025;
      sea[k + 2] = this.seaSeeds[k + 2] + Math.cos(t * 0.38 + phase) * 0.28;
    }
    this.seaPositions.needsUpdate = true;
    if (this.motePositions) {
      const motes = this.motePositions.array as Float32Array;
      for (let k = 0; k < motes.length; k += 3) {
        const phase = this.moteSeeds[k + 1];
        motes[k] = this.moteSeeds[k] + Math.sin(t * 0.19 + phase) * 1.1;
        // Above both end-deck eye heights; never fill the reticle/opponent band.
        motes[k + 1] = phase + Math.sin(t * 0.33 + this.moteSeeds[k]) * 0.22;
        motes[k + 2] = this.moteSeeds[k + 2] + Math.cos(t * 0.15 + phase) * 0.6;
      }
      this.motePositions.needsUpdate = true;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.sea.geometry.dispose();
    this.sea.material.dispose();
    this.motes?.geometry.dispose();
    this.motes?.material.dispose();
    this.fill.dispose();
    this.root.clear();
    // The supplied glow texture belongs to ArenaScene and is deliberately retained.
  }
}
