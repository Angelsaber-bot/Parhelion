import * as THREE from 'three';

/** Layer the main camera does not draw. Far props move here instead of toggling `visible`, so
 * the game logic that owns visibility (quest states, discoveries, residents) is never fought. */
export const FAR_PROP_LAYER = 1;

/** Surface distance past which a prop of this radius stops drawing. Small props (2 m) go at
 * ~225 m where they are a few fogged pixels; landmark-sized pieces stay out to the fog. */
export function farPropDistance(radius: number, scale = 1) {
  return (200 + Math.max(0, radius) * 12) * scale;
}

/**
 * Distance culling for the World's many small authored props that are not chunked (exploration
 * caches, statues, hub dressing, story sets, residents). Measured: from Kyoto 85 of 385 in-view
 * draws were such props more than 260 m away. Work is spread over frames: each update checks
 * one slice, so a full sweep costs a few hundred sphere tests every ~8 frames.
 */
export class FarPropCuller {
  readonly items: THREE.Object3D[] = [];
  private cursor = 0;
  private readonly sphere = new THREE.Sphere();
  add(root: THREE.Object3D | undefined | null) {
    root?.traverse(object => {
      const mesh = object as THREE.Mesh;
      if ((mesh.isMesh || (object as THREE.Points).isPoints) && mesh.geometry) this.items.push(object);
    });
  }
  update(eye: THREE.Vector3, scale = 1, slices = 8) {
    const n = this.items.length; if (!n || !eye.toArray().every(Number.isFinite)) return;
    for (let k = Math.ceil(n / Math.max(1, slices)); k > 0; k--) {
      if (this.cursor >= this.items.length) this.cursor = 0;
      const object = this.items[this.cursor];
      // Disposed / detached props leave the list for good.
      if (!object.parent) { this.items.splice(this.cursor, 1); if (!this.items.length) return; continue; }
      this.cursor++;
      // Instanced meshes are measured by their instances, not the template: ambient birds and
      // butterflies keep their template at the origin while their instances follow the player.
      const instanced = object as THREE.InstancedMesh;
      let bounds: THREE.Sphere | null;
      if (instanced.isInstancedMesh) { instanced.computeBoundingSphere(); bounds = instanced.boundingSphere; }
      else { const geometry = (object as THREE.Mesh).geometry as THREE.BufferGeometry; if (!geometry.boundingSphere) geometry.computeBoundingSphere(); bounds = geometry.boundingSphere; }
      if (!bounds) continue;
      this.sphere.copy(bounds).applyMatrix4(object.matrixWorld);
      const far = this.sphere.center.distanceTo(eye) - this.sphere.radius > farPropDistance(this.sphere.radius, scale);
      object.layers.set(far ? FAR_PROP_LAYER : 0);
    }
  }
  /** Bring everything back (teleports, cinematics that move the camera far away). */
  reset() { for (const object of this.items) object.layers.set(0); this.cursor = 0; }
}
