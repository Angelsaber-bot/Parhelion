import * as THREE from 'three';

/**
 * Third-person courtesy: a companion that walks up against the lens, or stands between the camera and
 * the player, drops out of the camera's view until it moves clear. Visibility, AI and colliders are
 * untouched; only render layers change, so owner code that toggles `visible` keeps working.
 */
export const CLEARANCE = Object.freeze({ near: 1.6, lane: .65, chest: 1.1, reach: .85 });

/** Whether a body centred at `body` blocks the view from `eye` to `focus` (the player's head). */
export function blocksView(body: THREE.Vector3Like, eye: THREE.Vector3Like, focus: THREE.Vector3Like) {
  const ex = body.x - eye.x, ey = body.y - eye.y, ez = body.z - eye.z;
  if (Math.hypot(ex, ey, ez) < CLEARANCE.near) return true;
  const fx = focus.x - eye.x, fy = focus.y - eye.y, fz = focus.z - eye.z, len2 = fx * fx + fy * fy + fz * fz;
  if (len2 < 1e-6) return false;
  const t = (ex * fx + ey * fy + ez * fz) / len2;
  if (t <= 0 || t >= CLEARANCE.reach) return false;
  return Math.hypot(ex - fx * t, ey - fy * t, ez - fz * t) < CLEARANCE.lane;
}

export class CameraClearance {
  private readonly cleared = new Map<THREE.Object3D, Map<THREE.Object3D, number>>();
  private readonly body = new THREE.Vector3();
  update(roots: readonly (THREE.Object3D | null | undefined)[], eye: THREE.Vector3, focus: THREE.Vector3, enabled: boolean) {
    const live = new Set<THREE.Object3D>();
    for (const root of roots) {
      if (!root) continue; live.add(root);
      this.body.copy(root.position); this.body.y += CLEARANCE.chest;
      const block = enabled && root.visible && blocksView(this.body, eye, focus);
      if (block && !this.cleared.has(root)) this.hide(root); else if (!block && this.cleared.has(root)) this.show(root);
    }
    for (const root of [...this.cleared.keys()]) if (!live.has(root)) this.show(root);
  }
  isCleared(root: THREE.Object3D) { return this.cleared.has(root); }
  private hide(root: THREE.Object3D) {
    const masks = new Map<THREE.Object3D, number>();
    root.traverse(o => { masks.set(o, o.layers.mask); o.layers.mask = 0; });
    this.cleared.set(root, masks);
  }
  private show(root: THREE.Object3D) {
    const masks = this.cleared.get(root); this.cleared.delete(root);
    // Children added while cleared keep whatever layers they were given.
    masks?.forEach((mask, o) => { if (o.layers.mask === 0) o.layers.mask = mask; });
  }
}
