import * as THREE from 'three';
import { toonMaterial } from './look';

/** Gameplay/effect materials can mutate even when their transforms are static. */
export function isImmutableMapMaterial(source: THREE.Material): boolean {
  if (/water|halo|target|beam/i.test(source.name)) return false;
  return !['spin', 'bob', 'dynamic', 'showWhen', 'hideWhen', 'opensWhen', 'mutable'].some(key => !!source.userData[key]);
}
/** Per-world, explicitly opted-in source-identity cache, never by display name.
 * Allocation only: the existing toonMaterial is the sole conversion factory.
 * Callers retain lifecycle ownership; never dispose a shared material per mesh. */
export class WorldMaterialCache {
  private readonly converted = new WeakMap<THREE.Material, THREE.Material>();
  conversions = 0;
  hits = 0;
  constructor(private readonly factory: (source: THREE.Material) => THREE.Material = toonMaterial) {}
  convert(source: THREE.Material, immutable = false): THREE.Material {
    const cacheable = immutable && isImmutableMapMaterial(source);
    if (cacheable) {
      const existing = this.converted.get(source);
      if (existing) { this.hits++; return existing; }
    }
    const result = this.factory(source); this.conversions++;
    if (cacheable) this.converted.set(source, result);
    return result;
  }
}
