import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldMaterialCache, isImmutableMapMaterial } from '../src/worldMaterialCache.ts';
import { toonMaterial } from '../src/look.ts';
import { KYOTO_MATERIAL_PROFILES } from '../src/kyotoMaterialProfiles.ts';
import { WINTER_MATERIAL_PROFILES } from '../src/winterMaterialProfiles.ts';
import { BLACKSAIL_MATERIAL_PROFILES } from '../src/blackSailMaterialProfiles.ts';
import { BRITAIN_MATERIAL_PROFILES } from '../src/britainMaterialProfiles.ts';
import { VALLEY_MATERIAL_PROFILES } from '../src/valleyMaterialProfiles.ts';

test('conversion shares only explicitly immutable source identity within this world', () => {
  const cache = new WorldMaterialCache(), source = new THREE.MeshStandardMaterial({ name: 'M_KyotoTimber' });
  const first = cache.convert(source, true);
  assert.equal(cache.convert(source, true), first); assert.equal(cache.hits, 1); assert.equal(cache.conversions, 1);
  assert.notEqual(cache.convert(source), first); assert.notEqual(cache.convert(source, false), first);
  assert.notEqual(new WorldMaterialCache().convert(source, true), first);
  const separate = source.clone(); separate.color.set('#ff3300');
  const other = cache.convert(separate, true) as THREE.MeshToonMaterial;
  assert.notEqual(other, first); assert.equal(other.color.getHex(), separate.color.getHex());
});
test('dynamic source and halo/water/target/beam remain isolated', () => {
  for (const name of ['M_Halo', 'M_Water', 'M_Waterfall', 'M_Target', 'M_Beam']) {
    const cache = new WorldMaterialCache(), source = new THREE.MeshStandardMaterial({ name });
    assert.equal(isImmutableMapMaterial(source), false);
    const first = cache.convert(source, true), second = cache.convert(source, true);
    assert.notEqual(first, second); assert.equal(cache.hits, 0);
    first.opacity = .123; assert.notEqual(second.opacity, .123);
  }
  const cache = new WorldMaterialCache(), source = new THREE.MeshStandardMaterial({ name: 'M_Toon' });
  source.userData.dynamic = true;
  assert.notEqual(cache.convert(source, true), cache.convert(source, true));
});
function signature(material: THREE.Material) {
  const json = material.toJSON(); delete json.uuid;
  const shader = { vertexShader: THREE.ShaderLib.toon.vertexShader, fragmentShader: THREE.ShaderLib.toon.fragmentShader, uniforms: {} };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return { json, shader, program: material.customProgramCacheKey() };
}
test('all five authored profiles and generic/effect materials retain exact factory output', () => {
  const names = [...Object.keys(KYOTO_MATERIAL_PROFILES), ...Object.keys(WINTER_MATERIAL_PROFILES), ...Object.keys(BLACKSAIL_MATERIAL_PROFILES),
    ...Object.keys(BRITAIN_MATERIAL_PROFILES), ...Object.keys(VALLEY_MATERIAL_PROFILES), 'M_Toon', 'M_Terrain', 'M_Foliage', 'M_Water', 'M_Halo', 'M_Target', 'M_Beam'];
  const cache = new WorldMaterialCache();
  for (const name of names) {
    const source = new THREE.MeshStandardMaterial({ name, color: '#aa7755', vertexColors: true,
      side: THREE.DoubleSide, transparent: true, opacity: .7, alphaTest: .1, depthWrite: false });
    assert.deepEqual(signature(cache.convert(source, true)), signature(toonMaterial(source)), name);
  }
});
