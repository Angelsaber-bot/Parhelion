import * as THREE from 'three';
import { SUN_DIR } from '../rendering/look';
import { regionAt } from './regions';

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
/** 业火京都: a smoky, fire-lit night sky to the south; dawn breaks once the core is relit. */
export function fireWeight(worldZ: number, restored = false): number {
  const z = THREE.MathUtils.clamp((worldZ - 330) / 170, 0, 1);
  return z * z * (3 - 2 * z) * (restored ? .3 : 1);
}
const FIRE = {
  top: new THREE.Color('#1d1a3a'), mid: new THREE.Color('#6a2f4a'), horizon: new THREE.Color('#ff8a4a'),
  fog: new THREE.Color('#7a4a52'), sun: new THREE.Color('#ffb070'), sky: new THREE.Color('#8f7ab8'), ground: new THREE.Color('#8a6058'),
};
const FIRE_SUN = new THREE.Vector3(.3, .2, .93).normalize();
const NIGHT = {
  top: new THREE.Color('#253960'), mid: new THREE.Color('#4a6381'), horizon: new THREE.Color('#8b9bae'),
  fog: new THREE.Color('#72839b'), sun: new THREE.Color('#a4b9ed'), sky: new THREE.Color('#9eaed0'), ground: new THREE.Color('#717b75'),
};
const EXPANSION_SKIES = [
  {id:'orleans',top:'#536c99',mid:'#aab9cc',horizon:'#f6ddbd',fog:'#cbd1cb',sun:'#ffe4bb',sky:'#e0e5f0',ground:'#969b7a',direction:new THREE.Vector3(-.6,.55,.35).normalize()},
  {id:'egypt',top:'#347bb0',mid:'#9dcddd',horizon:'#ffe5b7',fog:'#e3d0aa',sun:'#fff1ce',sky:'#e1edeb',ground:'#bca16a',direction:new THREE.Vector3(.3,.9,.2).normalize()},
  {id:'qin',top:'#5b8291',mid:'#bed3cb',horizon:'#eee7cf',fog:'#ccd8cc',sun:'#f8edc9',sky:'#dbe8dc',ground:'#829175',direction:new THREE.Vector3(.4,.65,-.4).normalize()},
].map(p=>({...p,top:new THREE.Color(p.top),mid:new THREE.Color(p.mid),horizon:new THREE.Color(p.horizon),fog:new THREE.Color(p.fog),sun:new THREE.Color(p.sun),sky:new THREE.Color(p.sky),ground:new THREE.Color(p.ground)}));

/** Reuses the existing sky, sunlight and fog; adds no passes, particles or shadow maps. */
export class KingdomTwilight {
  readonly direction = SUN_DIR.clone();
  private blend = 0;
  private storm = 0;
  private snow = 0;
  private fire = 0;
  private night = 0;
  private expansionWeights = [0,0,0];
  private readonly uniforms: Record<string, THREE.IUniform>;
  constructor(sky: THREE.Mesh, private sun: THREE.DirectionalLight,
    private hemisphere: THREE.HemisphereLight, private scene: THREE.Scene) {
    this.uniforms = (sky.material as THREE.ShaderMaterial).uniforms;
    this.uniforms.sunDir.value = this.direction;
  }
  update(dt: number, x: number, restored: boolean, stormRestored = false, z = 0, snowRestored = false, fireRestored = false, valleyTrial = false, kingdomEvening = false) {
    this.blend = THREE.MathUtils.damp(this.blend, twilightWeight(x, restored), 1.8, dt);
    this.storm = THREE.MathUtils.damp(this.storm, stormWeight(x, stormRestored), 1.8, dt);
    this.snow = THREE.MathUtils.damp(this.snow, snowWeight(z, snowRestored), 1.8, dt);
    this.fire = THREE.MathUtils.damp(this.fire, fireWeight(z, fireRestored), 1.8, dt);
    const a = this.blend, b = this.storm, c = this.snow, f = this.fire;
    for (const key of ['top', 'mid', 'horizon'] as const) (this.uniforms[key].value as THREE.Color).copy(DAY[key]).lerp(DUSK[key], a).lerp(STORM[key], b).lerp(SNOW[key], c).lerp(FIRE[key], f);
    this.direction.copy(SUN_DIR).lerp(DUSK_SUN, a).lerp(STORM_SUN, b).lerp(SNOW_SUN, c).lerp(FIRE_SUN, f).normalize();
    this.sun.color.copy(DAY.sun).lerp(DUSK.sun, a).lerp(STORM.sun, b).lerp(SNOW.sun, c).lerp(FIRE.sun, f);
    this.sun.intensity = THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(2.7, 2.05, a), 2.1, b), 2.2, c), 1.7, f);
    this.hemisphere.color.copy(DAY.sky).lerp(DUSK.sky, a).lerp(STORM.sky, b).lerp(SNOW.sky, c).lerp(FIRE.sky, f);
    this.hemisphere.groundColor.copy(DAY.ground).lerp(DUSK.ground, a).lerp(STORM.ground, b).lerp(SNOW.ground, c).lerp(FIRE.ground, f);
    // Keep the battle floor and silhouettes readable even at deepest twilight.
    this.hemisphere.intensity = THREE.MathUtils.lerp(1.15, 1.32, Math.max(a, b, c, f));
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(DAY.fog).lerp(DUSK.fog, a).lerp(STORM.fog, b).lerp(SNOW.fog, c).lerp(FIRE.fog, f);
      this.scene.fog.near = THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(120, 145, a), 120, b), 100, c), 110, f);
      this.scene.fog.far = THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(720, 680, a), 640, b), 600, c), 620, f);
    }
    // Corner domains own their atmosphere; axis-based legacy era blends alone
    // would make Egypt inherit Kyoto's fire and Qin inherit the winter storm.
    const region=regionAt(x,z).id;
    for(const [i,preset] of EXPANSION_SKIES.entries()) {
      const weight=this.expansionWeights[i]=THREE.MathUtils.damp(this.expansionWeights[i],region===preset.id?1:0,1.8,dt);
      for(const key of ['top','mid','horizon'] as const)(this.uniforms[key].value as THREE.Color).lerp(preset[key],weight);
      this.direction.lerp(preset.direction,weight).normalize();this.sun.color.lerp(preset.sun,weight);this.sun.intensity=THREE.MathUtils.lerp(this.sun.intensity,2.7,weight);
      this.hemisphere.color.lerp(preset.sky,weight);this.hemisphere.groundColor.lerp(preset.ground,weight);
      if(this.scene.fog instanceof THREE.Fog){this.scene.fog.color.lerp(preset.fog,weight);this.scene.fog.near=THREE.MathUtils.lerp(this.scene.fog.near,150,weight);this.scene.fog.far=THREE.MathUtils.lerp(this.scene.fog.far,780,weight);}
    }
    const afterDark = (valleyTrial && region === 'alpha') || (kingdomEvening && region === 'britain');
    this.night = THREE.MathUtils.damp(this.night, Number(afterDark), 1.65, dt);
    const night = this.night;
    for (const key of ['top', 'mid', 'horizon'] as const) (this.uniforms[key].value as THREE.Color).lerp(NIGHT[key], night);
    this.sun.color.lerp(NIGHT.sun, night); this.sun.intensity = THREE.MathUtils.lerp(this.sun.intensity, .85, night);
    this.hemisphere.color.lerp(NIGHT.sky, night); this.hemisphere.groundColor.lerp(NIGHT.ground, night);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.lerp(NIGHT.fog, night);
      this.scene.fog.far = THREE.MathUtils.lerp(this.scene.fog.far, 410, night);
    }
  }
}
