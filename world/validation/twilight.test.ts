import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { makeSky, SUN_DIR } from '../src/rendering/look.ts';
import { KingdomTwilight, twilightWeight } from '../src/map/twilight.ts';
test('twilight is bounded to the western region and victory restores a warmer dawn', () => {
  assert.equal(twilightWeight(0), 0); assert.equal(twilightWeight(720), 0);
  assert.equal(twilightWeight(-720), 1); assert.equal(twilightWeight(-720, true), .45);
  assert.ok(twilightWeight(-380) > 0 && twilightWeight(-380) < 1);
});
test('twilight reuses lights and does not mutate the global daytime sun or lose visibility', () => {
  const original = SUN_DIR.clone(), scene = new THREE.Scene(); scene.fog = new THREE.Fog('#ffffff',120,720);
  const sky = makeSky(), sun = new THREE.DirectionalLight(), hemi = new THREE.HemisphereLight();
  const dusk = new KingdomTwilight(sky,sun,hemi,scene);
  for (let i=0;i<120;i++) dusk.update(1/60,-720,false);
  assert.ok(dusk.direction.y < original.y); assert.ok(hemi.intensity >= 1.15); assert.ok(sun.intensity >= 2);
  assert.ok(SUN_DIR.equals(original)); assert.equal(scene.children.length,0);
  scene.fog = null; assert.doesNotThrow(() => dusk.update(.1,0,false));
  sky.geometry.dispose(); (sky.material as THREE.Material).dispose();
});

test('the relocated realms and high court each have their own sky at first entry and after restoration', () => {
  const scene = new THREE.Scene(), sky = makeSky(), sun = new THREE.DirectionalLight();
  scene.fog = new THREE.Fog('#ffffff', 1, 10);
  const lighting = new KingdomTwilight(sky, sun, new THREE.HemisphereLight(), scene);
  const uniforms = (sky.material as THREE.ShaderMaterial).uniforms;
  const sample = (x: number, z: number, restored = false, high = false) => {
    lighting.update(10, x, restored, restored, z, restored, restored, false, false, high);
    return { sun: sun.color.clone(), fog: scene.fog!.color.clone(), clouds: uniforms.cloudCover.value };
  };
  const kyoto = sample(720, -1440), winter = sample(0, -720), port = sample(720, -720);
  const home = sample(720, 0), egypt = sample(0, -1440), qin = sample(-720, -720);
  const orleans = sample(-720, -1440), britain = sample(-720, 0), valley = sample(0, 0), high = sample(125, 210, false, true);
  assert.equal(new Set([kyoto, winter, port, home, egypt, qin, orleans, britain, valley, high].map(p => p.fog.getHex())).size, 10);
  assert.ok(kyoto.fog.r > kyoto.fog.b && winter.fog.b > winter.fog.r);
  assert.ok(port.clouds > home.clouds && port.clouds > egypt.clouds);
  assert.ok(kyoto.sun.b < sample(720, -1440, true).sun.b);
  assert.equal(uniforms.keyColor.value, sun.color);
  sky.geometry.dispose(); (sky.material as THREE.Material).dispose();
});

test('a stationary camera either side of a regional boundary sees a continuous gradient', () => {
  const scene = new THREE.Scene(), sky = makeSky(), sun = new THREE.DirectionalLight();
  const lighting = new KingdomTwilight(sky, sun, new THREE.HemisphereLight(), scene);
  const top = (sky.material as THREE.ShaderMaterial).uniforms.top.value as THREE.Color;
  const daylight = (x: number) => { lighting.update(10, x, false); return top.clone(); };
  const valley = daylight(0), britain = daylight(-720);
  const east = daylight(-359.9), west = daylight(-360.1);
  assert.ok(east.b > britain.b && east.b < valley.b);
  assert.ok(Math.abs(east.b - west.b) < .001);
  sky.geometry.dispose(); (sky.material as THREE.Material).dispose();
});
