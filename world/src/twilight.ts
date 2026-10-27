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
/** 黑帆尽头: a grey-green storm sky over the pirate sea; clears to a bright sea day once the core is lit. */
export function stormWeight(worldX: number, restored = false): number {
  const x = THREE.MathUtils.clamp((worldX - 330) / 170, 0, 1);
  return x * x * (3 - 2 * x) * (restored ? .3 : 1);
}
const STORM = {
  top: new THREE.Color('#2f4458'), mid: new THREE.Color('#6f8fa0'), horizon: new THREE.Color('#d8e4e0'),
  fog: new THREE.Color('#a9bcc6'), sun: new THREE.Color('#e8f0ff'), sky: new THREE.Color('#c9d8e6'), ground: new THREE.Color('#7f8f8a'),
};
const STORM_SUN = new THREE.Vector3(.55, .42, -.72).normalize();
/** 永冬之城: a pale, low winter sky to the north; the sun comes back once the winter core burns. */
export function snowWeight(worldZ: number, restored = false): number {
  const z = THREE.MathUtils.clamp((-worldZ - 330) / 170, 0, 1);
  return z * z * (3 - 2 * z) * (restored ? .35 : 1);
}
const SNOW = {
  top: new THREE.Color('#6f8db8'), mid: new THREE.Color('#b9cbe2'), horizon: new THREE.Color('#f1f4f9'),
  fog: new THREE.Color('#dce5f0'), sun: new THREE.Color('#f2f6ff'), sky: new THREE.Color('#e2eaf6'), ground: new THREE.Color('#c3cbd8'),
};
const SNOW_SUN = new THREE.Vector3(-.2, .22, -.95).normalize();

/** Reuses the existing sky, sunlight and fog; adds no passes, particles or shadow maps. */
export class KingdomTwilight {
  readonly direction = SUN_DIR.clone();
  private blend = 0;
  private storm = 0;
  private snow = 0;
  private readonly uniforms: Record<string, THREE.IUniform>;
  constructor(private sky: THREE.Mesh, private sun: THREE.DirectionalLight,
    private hemisphere: THREE.HemisphereLight, private scene: THREE.Scene) {
    this.uniforms = (sky.material as THREE.ShaderMaterial).uniforms;
    this.uniforms.sunDir.value = this.direction;
  }
  update(dt: number, x: number, restored: boolean, stormRestored = false, z = 0, snowRestored = false) {
    this.blend = THREE.MathUtils.damp(this.blend, twilightWeight(x, restored), 1.8, dt);
    this.storm = THREE.MathUtils.damp(this.storm, stormWeight(x, stormRestored), 1.8, dt);
    this.snow = THREE.MathUtils.damp(this.snow, snowWeight(z, snowRestored), 1.8, dt);
    const a = this.blend, b = this.storm, c = this.snow;
    for (const key of ['top', 'mid', 'horizon'] as const) (this.uniforms[key].value as THREE.Color).copy(DAY[key]).lerp(DUSK[key], a).lerp(STORM[key], b).lerp(SNOW[key], c);
    this.direction.copy(SUN_DIR).lerp(DUSK_SUN, a).lerp(STORM_SUN, b).lerp(SNOW_SUN, c).normalize();
    this.sun.color.copy(DAY.sun).lerp(DUSK.sun, a).lerp(STORM.sun, b).lerp(SNOW.sun, c);
    this.sun.intensity = THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(2.7, 2.05, a), 2.1, b), 2.2, c);
    this.hemisphere.color.copy(DAY.sky).lerp(DUSK.sky, a).lerp(STORM.sky, b).lerp(SNOW.sky, c);
    this.hemisphere.groundColor.copy(DAY.ground).lerp(DUSK.ground, a).lerp(STORM.ground, b).lerp(SNOW.ground, c);
    // Keep the battle floor and silhouettes readable even at deepest twilight.
    this.hemisphere.intensity = THREE.MathUtils.lerp(1.15, 1.32, Math.max(a, b, c));
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(DAY.fog).lerp(DUSK.fog, a).lerp(STORM.fog, b).lerp(SNOW.fog, c);
      this.scene.fog.near = THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(120, 145, a), 120, b), 100, c);
      this.scene.fog.far = THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(720, 680, a), 640, b), 600, c);
    }
  }
}
