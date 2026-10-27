import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, unlinkSync } from 'node:fs';
import * as THREE from 'three';
import { WINTER_MATERIAL_PROFILES, winterMaterialProfile } from '../src/winterMaterialProfiles.ts';
import { winterToonMaterial } from '../src/winterMaterials.ts';
import { toonMaterial } from '../src/look.ts';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { Batch, BOX, T } from '../tools/gen/geo.ts';
import { writeRegion } from '../tools/gen/export.ts';

const gradient = new THREE.DataTexture(new Uint8Array([128, 230, 255]), 3, 1, THREE.RedFormat);

test('Winter surface profiles opt in by exact name and preserve other regions', () => {
  for (const name of ['M_Toon', 'M_Terrain', 'M_Foliage', 'M_Water', 'M_WinterTypo', 'M_KyotoTimber', 'M_Ice', 'M_Frost', 'toString']) {
    assert.equal(winterMaterialProfile(name), undefined);
    assert.equal(winterToonMaterial(new THREE.MeshStandardMaterial({ name }), gradient), null);
  }
  const generic = toonMaterial(new THREE.MeshStandardMaterial({ name: 'M_Toon', vertexColors: true }));
  assert.equal(generic.customProgramCacheKey(), 'cel-default');
});

test('each Winter surface has distinct shader cache, bounded draw detail, and preserved colors', () => {
  const keys = new Set<string>();
  for (const [name, profile] of Object.entries(WINTER_MATERIAL_PROFILES)) {
    const source = new THREE.MeshStandardMaterial({ name, color: '#dad0b8', vertexColors: true,
      side: THREE.DoubleSide, transparent: true, opacity: 0.75, alphaTest: 0.1, depthWrite: false });
    const material = toonMaterial(source) as THREE.MeshToonMaterial;
    assert.ok(material.isMeshToonMaterial);
    assert.equal(material.color.getHex(), source.color.getHex());
    assert.equal(material.vertexColors, true);
    assert.equal(material.side, source.side);
    assert.equal(material.opacity, source.opacity);
    assert.equal(material.transparent, source.transparent);
    assert.equal(material.alphaTest, source.alphaTest);
    assert.equal(material.depthWrite, source.depthWrite);
    assert.equal(material.userData.roughness, profile.roughness);
    keys.add(material.customProgramCacheKey());
    const shader = {
      vertexShader: THREE.ShaderLib.toon.vertexShader,
      fragmentShader: THREE.ShaderLib.toon.fragmentShader,
      uniforms: {},
    };
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    // This is source-contract validation, not a GPU compiler or a visual assertion.
    const expand = (text: string): string => text.replace(/#include <(\w+)>/g, (_all, key) => {
      const chunk = THREE.ShaderChunk[key as keyof typeof THREE.ShaderChunk];
      assert.equal(typeof chunk, 'string', `known Three shader chunk ${key}`);
      return expand(chunk);
    });
    const vertex = expand(shader.vertexShader), fragment = expand(shader.fragmentShader);
    assert.match(vertex, /vec3 objectNormal\s*=/);
    assert.match(vertex, /vec3 transformed\s*=/);
    assert.ok(vertex.indexOf('vec3 objectNormal') < vertex.indexOf('vWinterNormal ='));
    assert.ok(vertex.indexOf('vec3 transformed') < vertex.indexOf('vWinterWorld ='));
    assert.match(fragment, /vec3 normal\s*=/);
    assert.match(fragment, /varying vec3 vViewPosition/);
    assert.ok(fragment.indexOf('vec3 normal') < fragment.indexOf('float rim ='));
    assert.match(shader.vertexShader, /vWinterWorld =/);
    assert.match(shader.fragmentShader, /float footprint = fwidth/);
    assert.match(shader.fragmentShader, /float brush = winterBrush/);
    assert.equal(shader.fragmentShader.includes('float glint'), name === 'M_WinterGold');
    assert.equal(shader.fragmentShader.includes('vec3 excess'), name === 'M_WinterSnow');
    assert.equal(shader.fragmentShader.includes('float weave'), name === 'M_WinterCanvas');
    assert.deepEqual(shader.uniforms, {}, 'surface detail adds no textures/uniforms');
    assert.ok(profile.rim <= 0.12, 'non-glowing, material-scaled rim');
  }
  assert.equal(keys.size, Object.keys(WINTER_MATERIAL_PROFILES).length);
});

test('actual compressed GLB exporter roundtrips all Winter PBR profiles and runtime toon identity', async () => {
  const file = `__winter_material_roundtrip_${process.pid}`;
  const urls = ['glb', 'layout.json'].map(ext => new URL(`../public/assets/${file}.${ext}`, import.meta.url));
  try {
    const pieces = [...Object.keys(WINTER_MATERIAL_PROFILES), 'M_Toon'].map((material, i) => ({
      name: `Surface_${i}`, material, batch: new Batch(`Surface_${i}`, material).add(BOX, '#a58c6b', T(i * 2, 1, 0)),
    }));
    await writeRegion({
      file, world: { id: 'winter-material-fixture', version: 1, seed: 1, half: 32, waterLevel: -4 },
      terrain: { vis: new THREE.PlaneGeometry(64, 64).rotateX(-Math.PI / 2), col: new THREE.PlaneGeometry(64, 64).rotateX(-Math.PI / 2) },
      pieces, markers: [], layout: {},
    });
    const bytes = readFileSync(urls[0]);
    const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    bakeQuantized(gltf.scene);
    for (let i = 0; i < pieces.length; i++) {
      const mesh = gltf.scene.getObjectByName(`Surface_${i}`) as THREE.Mesh;
      assert.ok(mesh?.geometry.getAttribute('color'), 'authored vertex colors survive compression');
      const material = mesh.material as THREE.MeshStandardMaterial;
      const expected = winterMaterialProfile(pieces[i].material);
      assert.equal(material.name, pieces[i].material);
      assert.equal(material.roughness, expected?.roughness ?? 1);
      assert.equal(material.metalness, expected?.metalness ?? 0);
      const runtime = toonMaterial(material);
      if (expected) assert.equal(runtime.userData.winterSurface, material.name);
      else assert.equal(runtime.customProgramCacheKey(), 'cel-default');
    }
  } finally {
    for (const url of urls) { try { unlinkSync(url); } catch {} }
  }
});


test('Three runtime provides WebGL2 derivatives and fragment view matrix for Winter toon code', () => {
  const program = readFileSync(new URL('../node_modules/three/src/renderers/webgl/WebGLProgram.js', import.meta.url), 'utf8');
  assert.match(program, /#version 300 es/);
  assert.match(program, /uniform mat4 viewMatrix/);
  const renderer = readFileSync(new URL('../node_modules/three/src/renderers/WebGLRenderer.js', import.meta.url), 'utf8');
  assert.match(renderer, /webgl2/);
});

test('winter export exact weld remains art-only, after existing quantization, without second reorder', () => {
  const exporter = readFileSync(new URL('../tools/gen/export.ts', import.meta.url), 'utf8');
  assert.match(exporter, /compress\(new Uint8Array\(glb\), r\.file === 'world_kyoto' \|\| r\.file === 'world_winter'\)/);
  assert.match(exporter, /if \(primitive\.getMaterial\(\)\?\.getName\(\) !== 'M_Collision'\) weldPrimitive/);
  assert.ok(exporter.indexOf('await doc.transform(reorder') < exporter.indexOf('if (exactWeld)'));
  assert.equal((exporter.match(/reorder\(\{/g) ?? []).length, 1, 'no post-quantization reorder: collision order is contractual');
});

test('existing water, frost-target and emissive paths are not overridden', () => {
  for (const name of ['M_Water', 'M_Waterfall', 'M_Emissive', 'M_Target', 'M_Beam']) {
    const source = new THREE.MeshStandardMaterial({ name });
    assert.equal(winterToonMaterial(source, gradient), null);
    assert.equal(toonMaterial(source).userData.winterSurface, undefined);
  }
  assert.equal(toonMaterial(new THREE.MeshStandardMaterial({ name: 'M_Water' })).customProgramCacheKey(), 'cel-water');
  assert.equal(toonMaterial(new THREE.MeshStandardMaterial({ name: 'M_KyotoTimber' })).customProgramCacheKey(), 'kyoto-surface-v1-M_KyotoTimber');
});

test('production Everwinter GLB actually assigns cloth, iron and eagle gold to their physical profiles', async () => {
  const bytes = readFileSync(new URL('../public/assets/world_winter.glb', import.meta.url));
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(gltf.scene);
  for (const [name, profile] of [
    ['Bivouac_WinterCanvas', 'M_WinterCanvas'],
    ['Bivouac_WinterIron', 'M_WinterIron'],
    ['Bivouac_WinterGold', 'M_WinterGold'],
    ['Crossing_WinterIron', 'M_WinterIron'],
    ['Fieldworks_Details_WinterCanvas', 'M_WinterCanvas'],
    ['Fieldworks_Details_WinterIron', 'M_WinterIron'],
  ]) {
    const mesh = gltf.scene.getObjectByName(name) as THREE.Mesh;
    assert.ok(mesh?.isMesh && mesh.geometry.getAttribute('position').count > 0, `${name}: real map triangles, not fixture-only profile`);
    const material = mesh.material as THREE.MeshStandardMaterial;
    assert.equal(material.name, profile);
    const expected = winterMaterialProfile(profile)!;
    assert.equal(material.roughness, expected.roughness);
    assert.equal(material.metalness, expected.metalness);
    assert.equal(toonMaterial(material).userData.winterSurface, profile);
  }
});
