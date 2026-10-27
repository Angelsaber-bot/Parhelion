import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, unlinkSync } from 'node:fs';
import * as THREE from 'three';
import { KYOTO_MATERIAL_PROFILES, kyotoMaterialProfile } from '../src/kyotoMaterialProfiles.ts';
import { kyotoToonMaterial } from '../src/kyotoMaterials.ts';
import { toonMaterial } from '../src/look.ts';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { Batch, BOX, T } from '../tools/gen/geo.ts';
import { writeRegion } from '../tools/gen/export.ts';

const gradient = new THREE.DataTexture(new Uint8Array([128, 230, 255]), 3, 1, THREE.RedFormat);

test('Kyoto surface profiles opt in by exact name and preserve other regions', () => {
  for (const name of ['M_Toon', 'M_Terrain', 'M_Foliage', 'M_Water', 'M_KyotoTypo', 'toString']) {
    assert.equal(kyotoMaterialProfile(name), undefined);
    assert.equal(kyotoToonMaterial(new THREE.MeshStandardMaterial({ name }), gradient), null);
  }
  const generic = toonMaterial(new THREE.MeshStandardMaterial({ name: 'M_Toon', vertexColors: true }));
  assert.equal(generic.customProgramCacheKey(), 'cel-default');
});

test('each Kyoto surface has distinct shader cache, bounded draw detail, and preserved colors', () => {
  const keys = new Set<string>();
  for (const [name, profile] of Object.entries(KYOTO_MATERIAL_PROFILES)) {
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
    assert.ok(vertex.indexOf('vec3 objectNormal') < vertex.indexOf('vKyotoNormal ='));
    assert.ok(vertex.indexOf('vec3 transformed') < vertex.indexOf('vKyotoWorld ='));
    assert.match(fragment, /vec3 normal\s*=/);
    assert.match(fragment, /varying vec3 vViewPosition/);
    assert.ok(fragment.indexOf('vec3 normal') < fragment.indexOf('float rim ='));
    assert.match(shader.vertexShader, /vKyotoWorld =/);
    assert.match(shader.fragmentShader, /float footprint = fwidth/);
    assert.match(shader.fragmentShader, /float brush = kyotoBrush/);
    assert.equal(shader.fragmentShader.includes('float glint'), name === 'M_KyotoGold');
    assert.ok(profile.rim <= 0.12, 'non-glowing, material-scaled rim');
  }
  assert.equal(keys.size, Object.keys(KYOTO_MATERIAL_PROFILES).length);
});

test('actual compressed GLB exporter roundtrips all Kyoto PBR profiles and runtime toon identity', async () => {
  const file = `__kyoto_material_roundtrip_${process.pid}`;
  const urls = ['glb', 'layout.json'].map(ext => new URL(`../public/assets/${file}.${ext}`, import.meta.url));
  try {
    const pieces = [...Object.keys(KYOTO_MATERIAL_PROFILES), 'M_Toon'].map((material, i) => ({
      name: `Surface_${i}`, material, batch: new Batch(`Surface_${i}`, material).add(BOX, '#a58c6b', T(i * 2, 1, 0)),
    }));
    await writeRegion({
      file, world: { id: 'kyoto-material-fixture', version: 1, seed: 1, half: 32, waterLevel: -4 },
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
      const expected = kyotoMaterialProfile(pieces[i].material);
      assert.equal(material.name, pieces[i].material);
      assert.equal(material.roughness, expected?.roughness ?? 1);
      assert.equal(material.metalness, expected?.metalness ?? 0);
      const runtime = toonMaterial(material);
      if (expected) assert.equal(runtime.userData.kyotoSurface, material.name);
      else assert.equal(runtime.customProgramCacheKey(), 'cel-default');
    }
  } finally {
    for (const url of urls) { try { unlinkSync(url); } catch {} }
  }
});


test('Three runtime provides WebGL2 derivatives and fragment view matrix for Kyoto toon code', () => {
  const program = readFileSync(new URL('../node_modules/three/src/renderers/webgl/WebGLProgram.js', import.meta.url), 'utf8');
  assert.match(program, /#version 300 es/);
  assert.match(program, /uniform mat4 viewMatrix/);
  const renderer = readFileSync(new URL('../node_modules/three/src/renderers/WebGLRenderer.js', import.meta.url), 'utf8');
  assert.match(renderer, /webgl2/);
});
