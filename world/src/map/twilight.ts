import * as THREE from 'three';
import { SUN_DIR } from '../rendering/look';
import type { WorldRegionId } from '../core/regionIdentity';
import { regionAt, REGIONS } from './regions';

export function twilightWeight(worldX: number, restored = false): number {
  const x = THREE.MathUtils.clamp((-worldX - 300) / 160, 0, 1);
  return x * x * (3 - 2 * x) * (restored ? .45 : 1);
}
export function stormWeight(worldX: number, restored = false): number {
  const x = THREE.MathUtils.clamp((worldX - 330) / 170, 0, 1);
  return x * x * (3 - 2 * x) * (restored ? .3 : 1);
}
export function snowWeight(worldZ: number, restored = false): number {
  const z = THREE.MathUtils.clamp((-worldZ - 330) / 170, 0, 1);
  return z * z * (3 - 2 * z) * (restored ? .35 : 1);
}
export function fireWeight(worldZ: number, restored = false): number {
  const z = THREE.MathUtils.clamp((worldZ - 330) / 170, 0, 1);
  return z * z * (3 - 2 * z) * (restored ? .3 : 1);
}

type AtmosphereOptions = {
  sky: [string, string, string];
  light: [string, string, string];
  direction: [number, number, number];
  sunlight: number;
  skylight: number;
  fog: [string, number, number];
  cloudCover: number;
};

function atmosphere(p: AtmosphereOptions) {
  return {
    top: new THREE.Color(p.sky[0]), mid: new THREE.Color(p.sky[1]), horizon: new THREE.Color(p.sky[2]),
    sun: new THREE.Color(p.light[0]), fill: new THREE.Color(p.light[1]), bounce: new THREE.Color(p.light[2]),
    direction: new THREE.Vector3(...p.direction).normalize(), sunlight: p.sunlight, skylight: p.skylight,
    fog: new THREE.Color(p.fog[0]), near: p.fog[1], far: p.fog[2], cloudCover: p.cloudCover,
  };
}
type Atmosphere = ReturnType<typeof atmosphere>;

const valleyDay: AtmosphereOptions = {
  sky: ['#376da6', '#91c2e3', '#e8e5cf'], light: ['#ffe5bb', '#c7e4ff', '#9b946e'],
  direction: SUN_DIR.toArray(), sunlight: 2.82, skylight: 1.07, fog: ['#c1d7dd', 108, 710], cloudCover: .01,
};

const skies: Record<WorldRegionId, Atmosphere> = {
  alpha: atmosphere(valleyDay),
  britain: atmosphere({
    sky: ['#424675', '#ac7d96', '#ffd198'], light: ['#ffcb94', '#c8cbed', '#97776c'],
    direction: [-.91, .23, .36], sunlight: 2.22, skylight: 1.2, fog: ['#bea6aa', 104, 665], cloudCover: -.025,
  }),
  blacksail: atmosphere({
    sky: ['#304955', '#71949d', '#d1dad0'], light: ['#dfeced', '#c0d7e1', '#74847c'],
    direction: [.55, .4, -.72], sunlight: 2.13, skylight: 1.26, fog: ['#a5bebf', 78, 600], cloudCover: .13,
  }),
  winter: atmosphere({
    sky: ['#597ba6', '#b4c9e0', '#eee7dc'], light: ['#ffecd0', '#d2e4ff', '#aebed3'],
    direction: [-.2, .26, -.95], sunlight: 2.25, skylight: 1.2, fog: ['#c4d5e4', 84, 620], cloudCover: .055,
  }),
  kyoto: atmosphere({
    sky: ['#282841', '#79505f', '#dc956b'], light: ['#ffae79', '#b1aad5', '#896253'],
    direction: [.3, .22, .93], sunlight: 1.87, skylight: 1.21, fog: ['#9a7375', 70, 565], cloudCover: .115,
  }),
  orleans: atmosphere({
    sky: ['#647ca0', '#bbc4ce', '#f3d8b3'], light: ['#ffe2ba', '#d0ddf1', '#9b9175'],
    direction: [-.71, .45, .35], sunlight: 2.56, skylight: 1.1, fog: ['#c8c7bc', 100, 720], cloudCover: .06,
  }),
  egypt: atmosphere({
    sky: ['#387b9f', '#a7cbd0', '#f4ddb4'], light: ['#fff0c9', '#d1e2e4', '#bea272'],
    direction: [.55, .78, .24], sunlight: 2.94, skylight: 1.04, fog: ['#dfcba9', 148, 825], cloudCover: -.15,
  }),
  qin: atmosphere({
    sky: ['#547482', '#a9c2bb', '#e9e3c9'], light: ['#f9e5bd', '#cfdfde', '#85947e'],
    direction: [.52, .48, -.63], sunlight: 2.43, skylight: 1.11, fog: ['#bccbc0', 82, 695], cloudCover: .045,
  }),
  home: atmosphere({
    sky: ['#537aa1', '#a9cfda', '#f2dec1'], light: ['#ffdfae', '#d3e4f2', '#aba07c'],
    direction: [-.64, .43, .51], sunlight: 2.56, skylight: 1.15, fog: ['#c6d2cc', 108, 705], cloudCover: -.065,
  }),
};
const nightSky = atmosphere({
  sky: ['#203151', '#485a79', '#8495a8'], light: ['#afc0ed', '#a9b5d3', '#6f797e'],
  direction: [-.6, .52, .45], sunlight: .85, skylight: 1.15, fog: ['#77879c', 75, 415], cloudCover: -.045,
});
const highSky = atmosphere({
  sky: ['#294978', '#81a8ca', '#f5dab0'], light: ['#ffe5b7', '#cfddf5', '#8c93af'],
  direction: [-.78, .36, -.24], sunlight: 2.87, skylight: 1.12, fog: ['#d1c9c7', 180, 960], cloudCover: -.14,
});

export class KingdomTwilight {
  readonly direction = SUN_DIR.clone();
  private readonly weights = new Float64Array(REGIONS.length);
  private night = 0;
  private upperCourt = 0;
  private readonly color = atmosphere(valleyDay);
  private initialized = false;
  private readonly uniforms: Record<string, THREE.IUniform>;
  get nightAmount() { return this.night; }

  constructor(sky: THREE.Mesh, private sun: THREE.DirectionalLight,
    private hemisphere: THREE.HemisphereLight, private scene: THREE.Scene) {
    this.uniforms = (sky.material as THREE.ShaderMaterial).uniforms;
    this.uniforms.sunDir.value = this.direction;
    this.uniforms.keyColor.value = this.sun.color;
  }

  private blend(p: Atmosphere, t: number) {
    for (const key of ['top', 'mid', 'horizon', 'sun', 'fill', 'bounce', 'fog'] as const) this.color[key].lerp(p[key], t);
    for (const key of ['sunlight', 'skylight', 'near', 'far', 'cloudCover'] as const)
      this.color[key] = THREE.MathUtils.lerp(this.color[key], p[key], t);
    this.color.direction.lerp(p.direction, t);
  }

  update(dt: number, x: number, restored: boolean, stormRestored = false, z = 0, snowRestored = false, fireRestored = false, valleyTrial = false, kingdomEvening = false, inSkyCourt = false) {
    const region = regionAt(x, z, this.weights).id;
    // Mix actual neighbours at seams, even where four realms meet. Restored realms
    // recover their daylight while retaining a little of their own atmosphere.
    let total = 0, daylight = 0;
    for (let i = 0; i < REGIONS.length; i++) {
      const id = REGIONS[i].id, weight = this.weights[i];
      if (!weight) continue;
      let recovery = 0;
      if (id === 'britain' && restored) recovery = .55;
      if (id === 'blacksail' && stormRestored) recovery = .7;
      if (id === 'winter' && snowRestored) recovery = .65;
      if (id === 'kyoto' && fireRestored) recovery = .7;
      daylight += weight * recovery;
      const remaining = weight * (1 - recovery);
      total += remaining;
      this.blend(skies[id], remaining / total);
    }
    if (daylight > 0) this.blend(skies.alpha, daylight);
    const afterDark = (valleyTrial && region === 'alpha') || (kingdomEvening && region === 'britain');
    const nightTarget = Number(afterDark && !inSkyCourt), courtTarget = Number(inSkyCourt);
    this.night = this.initialized ? THREE.MathUtils.damp(this.night, nightTarget, 1.65, dt) : nightTarget;
    this.upperCourt = this.initialized ? THREE.MathUtils.damp(this.upperCourt, courtTarget, 1.8, dt) : courtTarget;
    if (this.night > .0001) this.blend(nightSky, this.night);
    if (this.upperCourt > .0001) this.blend(highSky, this.upperCourt);

    const t = this.initialized ? 1 - Math.exp(-2.8 * dt) : 1;
    this.initialized = true;
    for (const key of ['top', 'mid', 'horizon'] as const) this.uniforms[key].value.lerp(this.color[key], t);
    this.uniforms.cloudCover.value = THREE.MathUtils.lerp(this.uniforms.cloudCover.value, this.color.cloudCover, t);
    this.direction.lerp(this.color.direction.normalize(), t).normalize();
    this.sun.color.lerp(this.color.sun, t);
    this.sun.intensity = THREE.MathUtils.lerp(this.sun.intensity, this.color.sunlight, t);
    this.hemisphere.color.lerp(this.color.fill, t);
    this.hemisphere.groundColor.lerp(this.color.bounce, t);
    this.hemisphere.intensity = THREE.MathUtils.lerp(this.hemisphere.intensity, this.color.skylight, t);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.lerp(this.color.fog, t);
      this.scene.fog.near = THREE.MathUtils.lerp(this.scene.fog.near, this.color.near, t);
      this.scene.fog.far = THREE.MathUtils.lerp(this.scene.fog.far, this.color.far, t);
    }
  }
}
