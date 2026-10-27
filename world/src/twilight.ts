import * as THREE from 'three';
import { SUN_DIR } from './look';

/** Blend across the western seam rather than switching the whole world's palette abruptly. */
export function twilightWeight(worldX: number, restored = false): number {
  const x = THREE.MathUtils.clamp((-worldX - 300) / 160, 0, 1);
  return x * x * (3 - 2 * x) * (restored ? .45 : 1);
}

const DAY = {
  top: new THREE.Color('#2a74dc'), mid: new THREE.Color('#7cc4f5'), horizon: new THREE.Color('#f2f6ff'),
  fog: new THREE.Color('#c4e2f6'), sun: new THREE.Color('#fff0d2'), sky: new THREE.Color('#d6ecff'), ground: new THREE.Color('#9aa98a'),
};
const DUSK = {
  top: new THREE.Color('#34386c'), mid: new THREE.Color('#b46b9a'), horizon: new THREE.Color('#ffc38a'),
  fog: new THREE.Color('#ba92a8'), sun: new THREE.Color('#ffd0a0'), sky: new THREE.Color('#d2c5ee'), ground: new THREE.Color('#a798a9'),
};
const DUSK_SUN = new THREE.Vector3(-.91, .18, .36).normalize();

/** Reuses the existing sky, sunlight and fog; adds no passes, particles or shadow maps. */
export class KingdomTwilight {
  readonly direction = SUN_DIR.clone();
  private blend = 0;
  private readonly uniforms: Record<string, THREE.IUniform>;
  constructor(private sky: THREE.Mesh, private sun: THREE.DirectionalLight,
    private hemisphere: THREE.HemisphereLight, private scene: THREE.Scene) {
    this.uniforms = (sky.material as THREE.ShaderMaterial).uniforms;
    this.uniforms.sunDir.value = this.direction;
  }
  update(dt: number, x: number, restored: boolean) {
    this.blend = THREE.MathUtils.damp(this.blend, twilightWeight(x, restored), 1.8, dt);
    const a = this.blend;
    for (const key of ['top', 'mid', 'horizon'] as const) (this.uniforms[key].value as THREE.Color).copy(DAY[key]).lerp(DUSK[key], a);
    this.direction.copy(SUN_DIR).lerp(DUSK_SUN, a).normalize();
    this.sun.color.copy(DAY.sun).lerp(DUSK.sun, a);
    this.sun.intensity = THREE.MathUtils.lerp(2.7, 2.05, a);
    this.hemisphere.color.copy(DAY.sky).lerp(DUSK.sky, a);
    this.hemisphere.groundColor.copy(DAY.ground).lerp(DUSK.ground, a);
    // Keep the battle floor and silhouettes readable even at deepest twilight.
    this.hemisphere.intensity = THREE.MathUtils.lerp(1.15, 1.32, a);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(DAY.fog).lerp(DUSK.fog, a);
      this.scene.fog.near = THREE.MathUtils.lerp(120, 145, a);
      this.scene.fog.far = THREE.MathUtils.lerp(720, 680, a);
    }
  }
}
