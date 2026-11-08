import * as THREE from 'three';

/**
 * Counts the point lights outside the lamp pool that the camera will actually light with this frame
 * (visible all the way up to the scene, on a camera layer). The main loop gives that many pool slots
 * away, so the total stays constant and no material ever recompiles because a lamp came into reach.
 * The list of lights is refreshed every few frames, which also picks up cinematic lights added later.
 */
export class PointLightCensus {
  private lights: THREE.PointLight[] = [];
  private refreshIn = 0;
  constructor(private readonly scene: THREE.Object3D, private readonly owned: ReadonlySet<THREE.Object3D>, private readonly every = 10) {}
  active(camera: THREE.Camera): number {
    if (this.refreshIn-- <= 0) {
      this.refreshIn = this.every; this.lights.length = 0;
      this.scene.traverse(o => { if ((o as THREE.PointLight).isPointLight && !this.owned.has(o)) this.lights.push(o as THREE.PointLight); });
    }
    let n = 0;
    for (const light of this.lights) {
      if (!light.layers.test(camera.layers)) continue;
      let node: THREE.Object3D | null = light, shown = true;
      for (; node; node = node.parent) { if (!node.visible) { shown = false; break; } if (node === this.scene) break; }
      if (shown && node === this.scene) n++;
    }
    return n;
  }
}
