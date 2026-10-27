import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, unlinkSync } from 'node:fs';
import * as THREE from 'three';
import { BRITAIN_MATERIAL_PROFILES, britainMaterialProfile } from '../src/britainMaterialProfiles.ts';
import { VALLEY_MATERIAL_PROFILES, valleyMaterialProfile } from '../src/valleyMaterialProfiles.ts';
import { britainToonMaterial } from '../src/britainMaterials.ts';
import { valleyToonMaterial } from '../src/valleyMaterials.ts';
import { toonMaterial } from '../src/look.ts';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { Batch, BOX, T } from '../tools/gen/geo.ts';
import { writeRegion } from '../tools/gen/export.ts';

const gradient = new THREE.DataTexture(new Uint8Array([128, 230, 255]), 3, 1, THREE.RedFormat);
const regions = [
  { id: 'britain', file: 'world_britain', cap: 'Britain', profiles: BRITAIN_MATERIAL_PROFILES, profile: britainMaterialProfile, toon: britainToonMaterial, double: 'M_BritainWool' },
  { id: 'valley', file: 'world_alpha', cap: 'Valley', profiles: VALLEY_MATERIAL_PROFILES, profile: valleyMaterialProfile, toon: valleyToonMaterial, double: 'M_ValleyCanvas' },
] as const;

for (const region of regions) {
  test(`${region.cap} material names are exact opt-ins, not prefix matches or global changes`, () => {
    for (const name of ['M_Toon', 'M_Terrain', 'M_Foliage', 'M_Water', 'M_Beam', 'M_Target', 'M_Emissive',
      'M_KyotoTimber', 'M_WinterTimber', 'M_BlackSailTimber', `M_${region.cap}Typo`, 'toString', '__proto__']) {
      assert.equal(region.profile(name), undefined);
      assert.equal(region.toon(new THREE.MeshStandardMaterial({ name }), gradient), null);
    }
    const other = regions.find(r => r !== region)!;
    for (const name of Object.keys(other.profiles)) assert.equal(region.profile(name), undefined);
  });

  test(`${region.cap} shaders preserve authored state and use bounded filtered surface detail`, () => {
    const keys = new Set<string>();
    for (const [name, profile] of Object.entries(region.profiles)) {
      const source = new THREE.MeshStandardMaterial({ name, color: '#d8cdbb', vertexColors: true,
        side: THREE.DoubleSide, transparent: true, opacity: 0.73, alphaTest: 0.12, depthWrite: false, depthTest: false, fog: false });
      const material = toonMaterial(source) as THREE.MeshToonMaterial;
      assert.ok(material.isMeshToonMaterial);
      for (const key of ['vertexColors', 'side', 'transparent', 'opacity', 'alphaTest', 'depthWrite', 'depthTest', 'fog'] as const) assert.equal(material[key], source[key], key);
      assert.equal(material.color.getHex(), source.color.getHex());
      assert.equal(material.emissive.getHex(), 0, 'physical surfaces have no emissive component');
      assert.equal(material.userData[`${region.id}Surface`], name);
      assert.equal(material.userData.roughness, profile.roughness);
      assert.equal(material.userData.metalness, profile.metalness);
      assert.ok(profile.rim <= 0.08 && profile.grain <= 0.06, 'restrained material-specific detail');
      keys.add(material.customProgramCacheKey());
      const shader = { vertexShader: THREE.ShaderLib.toon.vertexShader, fragmentShader: THREE.ShaderLib.toon.fragmentShader, uniforms: {} };
      material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      const expand = (source: string): string => source.replace(/#include <(\w+)>/g, (_all, key) => {
        const chunk = THREE.ShaderChunk[key as keyof typeof THREE.ShaderChunk];
        assert.equal(typeof chunk, 'string', `known chunk ${key}`);
        return expand(chunk);
      });
      const vertex = expand(shader.vertexShader), fragment = expand(shader.fragmentShader);
      assert.match(vertex, /vec3 objectNormal\s*=/);
      assert.match(vertex, /vec3 transformed\s*=/);
      assert.ok(vertex.indexOf('vec3 objectNormal') < vertex.indexOf(`v${region.cap}Normal =`));
      assert.ok(vertex.indexOf('vec3 transformed') < vertex.indexOf(`v${region.cap}World =`));
      assert.match(fragment, /vec3 normal\s*=/);
      assert.ok(fragment.indexOf('vec3 normal') < fragment.indexOf('float rim ='));
      assert.match(shader.fragmentShader, /float footprint = fwidth/);
      for (const chunk of ['fog_fragment', 'lights_fragment_begin', 'shadowmap_pars_fragment']) assert.ok(shader.fragmentShader.includes(`#include <${chunk}>`));
      assert.ok(!shader.fragmentShader.includes('sampler2D'), 'no extra surface textures');
      assert.deepEqual(shader.uniforms, {}, 'no extra uniforms or animated surface passes');
      const glint = region.id === 'britain' ? name === 'M_BritainBronze' : ['M_ValleyCeramic', 'M_ValleyMetal', 'M_ValleyGlass', 'M_ValleyBrass'].includes(name);
      assert.equal(shader.fragmentShader.includes('float glint'), glint);
      if (glint) assert.match(shader.fragmentShader, /float glint = .* \* lit;/, 'glint gated by received light');
      assert.equal(shader.fragmentShader.includes('float weave'), name === region.double);
    }
    assert.equal(keys.size, Object.keys(region.profiles).length);
  });

  test(`${region.cap} compressed exporter fixture preserves PBR, vertex color and toon identity`, async () => {
    const file = `__${region.id}_material_roundtrip_${process.pid}`;
    const urls = ['glb', 'layout.json'].map(ext => new URL(`../public/assets/${file}.${ext}`, import.meta.url));
    try {
      const pieces = [...Object.keys(region.profiles), 'M_Toon'].map((material, i) => ({
        name: `Surface_${i}`, material, batch: new Batch(`Surface_${i}`, material).add(BOX, '#b7aaa0', T(i * 2, 1, 0)),
      }));
      await writeRegion({ file, world: { id: `${region.id}-fixture`, version: 1, seed: 1, half: 32, waterLevel: -4 },
        terrain: { vis: new THREE.PlaneGeometry(64, 64).rotateX(-Math.PI / 2), col: new THREE.PlaneGeometry(64, 64).rotateX(-Math.PI / 2) }, pieces, markers: [], layout: {} });
      const bytes = readFileSync(urls[0]);
      const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
      bakeQuantized(gltf.scene);
      for (const [i, piece] of pieces.entries()) {
        const mesh = gltf.scene.getObjectByName(`Surface_${i}`) as THREE.Mesh;
        assert.ok(mesh.geometry.getAttribute('color'));
        const material = mesh.material as THREE.MeshStandardMaterial, p = region.profile(piece.material);
        assert.equal(material.name, piece.material);
        assert.equal(material.roughness, p?.roughness ?? 1);
        assert.equal(material.metalness, p?.metalness ?? 0);
        assert.equal(material.side, material.name === region.double ? THREE.DoubleSide : THREE.FrontSide);
        assert.equal(material.transparent, false, 'opaque physical panels do not introduce depth-sort holes');
        if (p) assert.equal(toonMaterial(material).userData[`${region.id}Surface`], material.name);
        else assert.equal(toonMaterial(material).customProgramCacheKey(), 'cel-default');
      }
    } finally { for (const url of urls) { try { unlinkSync(url); } catch {} } }
  });

  test(`production ${region.cap} GLB actually assigns every profile to nonempty ART`, async () => {
    const bytes = readFileSync(new URL(`../public/assets/${region.file}.glb`, import.meta.url));
    const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    bakeQuantized(gltf.scene);
    const art = gltf.scene.getObjectByName('ART');
    assert.ok(art);
    const assigned = new Set<string>();
    art.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const expected = region.profile(material.name);
        if (!expected) continue;
        assert.ok(mesh.geometry.getAttribute('position').count >= 3, `${mesh.name}: nonempty geometry`);
        assert.ok(mesh.geometry.getAttribute('color'), `${mesh.name}: authored palette`);
        assert.equal((material as THREE.MeshStandardMaterial).roughness, expected.roughness);
        assert.equal((material as THREE.MeshStandardMaterial).metalness, expected.metalness);
        assert.equal(toonMaterial(material).userData[`${region.id}Surface`], material.name);
        assert.equal(material.side, material.name === region.double ? THREE.DoubleSide : THREE.FrontSide);
        assigned.add(material.name);
      }
    });
    assert.deepEqual([...assigned].sort(), Object.keys(region.profiles).sort());
  });
}

test('five-region crafted ART weld preserves one original reorder and excludes all collision primitives', () => {
  const exporter = readFileSync(new URL('../tools/gen/export.ts', import.meta.url), 'utf8');
  assert.match(exporter, /r\.file === 'world_britain' \|\| r\.file === 'world_alpha'/);
  assert.match(exporter, /if \(primitive\.getMaterial\(\)\?\.getName\(\) !== 'M_Collision'\) weldPrimitive/);
  assert.ok(exporter.indexOf('await doc.transform(reorder') < exporter.indexOf('if (exactWeld)'));
  assert.equal((exporter.match(/reorder\(\{/g) ?? []).length, 1);
});

test('new region profiles preserve all previous surface dispatch keys and story-material paths', () => {
  for (const [name, key] of [
    ['M_KyotoTimber', 'kyoto-surface-v1-M_KyotoTimber'],
    ['M_WinterTimber', 'winter-surface-v1-M_WinterTimber'],
    ['M_BlackSailTimber', 'blacksail-surface-v1-M_BlackSailTimber'],
    ['M_Toon', 'cel-default'], ['M_Water', 'cel-water'],
  ]) assert.equal(toonMaterial(new THREE.MeshStandardMaterial({ name })).customProgramCacheKey(), key);
  for (const name of ['M_Emissive', 'M_Target', 'M_Beam']) {
    const m = toonMaterial(new THREE.MeshStandardMaterial({ name }));
    assert.ok((m as THREE.MeshBasicMaterial).isMeshBasicMaterial);
    assert.equal(m.userData.britainSurface, undefined);
    assert.equal(m.userData.valleySurface, undefined);
  }
});
