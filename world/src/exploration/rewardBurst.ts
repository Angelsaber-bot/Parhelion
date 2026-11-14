import * as THREE from 'three';

/**
 * Opening a chest throws its Halo Crystals up out of the lid; after a beat they home into the player
 * and wink out. A fixed pool of shards (no per-open allocation). Visual only — the reward itself is
 * granted when the chest opens.
 */
export const BURST = Object.freeze({ pool: 32, rise: .55, home: .75, max: 12 });
interface Shard { mesh: THREE.Mesh; v: THREE.Vector3; age: number; on: boolean; delay: number }

export class RewardBurst {
  readonly root = new THREE.Group();
  private readonly shards: Shard[] = [];
  private readonly geometry = new THREE.OctahedronGeometry(.11);
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private next = 0;
  constructor() {
    this.root.name = 'ChestRewardBurst';
    for (let i = 0; i < BURST.pool; i++) {
      const mesh = new THREE.Mesh(this.geometry); mesh.visible = false; mesh.raycast = () => {}; this.root.add(mesh);
      this.shards.push({ mesh, v: new THREE.Vector3(), age: 0, on: false, delay: 0 });
    }
  }
  private material(color: string) {
    let m = this.materials.get(color);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .9, roughness: .2, metalness: .3 }); this.materials.set(color, m); }
    return m;
  }
  /** Throw `count` shards (capped) from `at`, fanned out and upward. */
  emit(at: THREE.Vector3, count: number, color: string) {
    const n = Math.min(BURST.max, Math.max(1, Math.round(count))), material = this.material(color);
    for (let i = 0; i < n; i++) {
      const s = this.shards[this.next]; this.next = (this.next + 1) % this.shards.length;
      const a = i / n * Math.PI * 2 + Math.random() * .4;
      s.mesh.position.copy(at); s.mesh.material = material; s.mesh.visible = true; s.mesh.scale.setScalar(1);
      s.v.set(Math.cos(a) * 1.6, 3.4 + Math.random() * 1.2, Math.sin(a) * 1.6); s.age = 0; s.on = true; s.delay = i * .03;
    }
    return n;
  }
  get active() { return this.shards.filter(s => s.on).length; }
  update(dt: number, target: THREE.Vector3) {
    for (const s of this.shards) {
      if (!s.on) continue;
      s.age += dt; const t = s.age - s.delay; if (t < 0) continue;
      s.mesh.rotation.y += dt * 9; s.mesh.rotation.x += dt * 5;
      if (t < BURST.rise) { s.v.y -= 9 * dt; s.mesh.position.addScaledVector(s.v, dt); continue; }
      // Home in with easing; wink out on arrival.
      const k = Math.min(1, (t - BURST.rise) / BURST.home), pull = 1 - (1 - k) ** 3;
      s.mesh.position.lerp(target, Math.min(1, pull * .35 + dt * 6));
      s.mesh.scale.setScalar(1 - k * .7);
      if (k >= 1 || s.mesh.position.distanceTo(target) < .2) { s.on = false; s.mesh.visible = false; }
    }
  }
  dispose() { this.root.removeFromParent(); this.geometry.dispose(); this.materials.forEach(m => m.dispose()); }
}
