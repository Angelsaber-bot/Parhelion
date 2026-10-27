import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, unlinkSync } from 'node:fs';
import * as THREE from 'three';
import { BLACKSAIL_MATERIAL_PROFILES, blackSailMaterialProfile } from '../src/blackSailMaterialProfiles.ts';
import { blackSailToonMaterial } from '../src/blackSailMaterials.ts';
import { toonMaterial } from '../src/look.ts';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { Batch, BOX, T } from '../tools/gen/geo.ts';
import { writeRegion, applyBlackSailBeamFallback } from '../tools/gen/export.ts';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';
import { quantize } from '@gltf-transform/functions';

const gradient = new THREE.DataTexture(new Uint8Array([128, 230, 255]), 3, 1, THREE.RedFormat);

test('BlackSail surface profiles opt in by exact name and preserve other regions', () => {
  for (const name of ['M_Toon', 'M_Terrain', 'M_Foliage', 'M_Water', 'M_BlackSailTypo', 'M_KyotoTimber', 'M_WinterTimber', 'M_Ice', 'M_Frost', 'toString']) {
    assert.equal(blackSailMaterialProfile(name), undefined);
    assert.equal(blackSailToonMaterial(new THREE.MeshStandardMaterial({ name }), gradient), null);
  }
  const generic = toonMaterial(new THREE.MeshStandardMaterial({ name: 'M_Toon', vertexColors: true }));
  assert.equal(generic.customProgramCacheKey(), 'cel-default');
});

test('each BlackSail surface has distinct shader cache, bounded draw detail, and preserved colors', () => {
  const keys = new Set<string>();
  for (const [name, profile] of Object.entries(BLACKSAIL_MATERIAL_PROFILES)) {
    const source = new THREE.MeshStandardMaterial({ name, color: '#dad0b8', vertexColors: true,
      side: THREE.DoubleSide, transparent: true, opacity: 0.75, alphaTest: 0.1, depthWrite: false, depthTest: false, fog: false });
    const material = toonMaterial(source) as THREE.MeshToonMaterial;
    assert.ok(material.isMeshToonMaterial);
    assert.equal(material.color.getHex(), source.color.getHex());
    assert.equal(material.vertexColors, true);
    assert.equal(material.side, source.side);
    assert.equal(material.opacity, source.opacity);
    assert.equal(material.transparent, source.transparent);
    assert.equal(material.alphaTest, source.alphaTest);
    assert.equal(material.depthWrite, source.depthWrite);
    assert.equal(material.depthTest, source.depthTest);
    assert.equal(material.fog, source.fog);
    assert.equal(material.emissive.getHex(), 0, "physical surfaces never become ghost emission");
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
    assert.ok(vertex.indexOf('vec3 objectNormal') < vertex.indexOf('vBlackSailNormal ='));
    assert.ok(vertex.indexOf('vec3 transformed') < vertex.indexOf('vBlackSailWorld ='));
    assert.match(fragment, /vec3 normal\s*=/);
    assert.match(fragment, /varying vec3 vViewPosition/);
    assert.ok(fragment.indexOf('vec3 normal') < fragment.indexOf('float rim ='));
    assert.match(shader.vertexShader, /vBlackSailWorld =/);
    assert.match(shader.fragmentShader, /float footprint = fwidth/);
    assert.ok(shader.fragmentShader.includes('#include <fog_fragment>'));
    assert.ok(shader.fragmentShader.includes('#include <lights_fragment_begin>'));
    assert.ok(shader.fragmentShader.includes('#include <shadowmap_pars_fragment>'));
    assert.ok(!shader.fragmentShader.includes('sampler2D'), 'no surface texture allocation');
    assert.match(shader.fragmentShader, /float brush = blackSailBrush/);
    assert.equal(shader.fragmentShader.includes('float glint'), name === 'M_BlackSailBrass');
    assert.equal(shader.fragmentShader.includes('float weave'), name === 'M_BlackSailCanvas');
    assert.deepEqual(shader.uniforms, {}, 'surface detail adds no textures/uniforms');
    assert.ok(profile.rim <= 0.12, 'non-glowing, material-scaled rim');
  }
  assert.equal(keys.size, Object.keys(BLACKSAIL_MATERIAL_PROFILES).length);
});

test('actual compressed GLB exporter roundtrips all BlackSail PBR profiles and runtime toon identity', async () => {
  const file = `__blacksail_material_roundtrip_${process.pid}`;
  const urls = ['glb', 'layout.json'].map(ext => new URL(`../public/assets/${file}.${ext}`, import.meta.url));
  try {
    const pieces = [...Object.keys(BLACKSAIL_MATERIAL_PROFILES), 'M_Toon'].map((material, i) => ({
      name: `Surface_${i}`, material, batch: new Batch(`Surface_${i}`, material).add(BOX, '#a58c6b', T(i * 2, 1, 0)),
    }));
    await writeRegion({
      file, world: { id: 'blacksail-material-fixture', version: 1, seed: 1, half: 32, waterLevel: -4 },
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
      const expected = blackSailMaterialProfile(pieces[i].material);
      assert.equal(material.name, pieces[i].material);
      if (material.name === 'M_BlackSailCanvas') assert.equal(material.side, THREE.DoubleSide);
      assert.equal(material.roughness, expected?.roughness ?? 1);
      assert.equal(material.metalness, expected?.metalness ?? 0);
      const runtime = toonMaterial(material);
      if (expected) assert.equal(runtime.userData.blackSailSurface, material.name);
      else assert.equal(runtime.customProgramCacheKey(), 'cel-default');
    }
  } finally {
    for (const url of urls) { try { unlinkSync(url); } catch {} }
  }
});


test('Three runtime provides WebGL2 derivatives and fragment view matrix for BlackSail toon code', () => {
  const program = readFileSync(new URL('../node_modules/three/src/renderers/webgl/WebGLProgram.js', import.meta.url), 'utf8');
  assert.match(program, /#version 300 es/);
  assert.match(program, /uniform mat4 viewMatrix/);
  const renderer = readFileSync(new URL('../node_modules/three/src/renderers/WebGLRenderer.js', import.meta.url), 'utf8');
  assert.match(renderer, /webgl2/);
});

test('BlackSail export exact weld remains art-only, after existing quantization, without second reorder', () => {
  const exporter = readFileSync(new URL('../tools/gen/export.ts', import.meta.url), 'utf8');
  assert.match(exporter, /compress\(new Uint8Array\(glb\), r\.file === 'world_kyoto' \|\| r\.file === 'world_winter' \|\| r\.file === 'world_blacksail'\)/);
  assert.match(exporter, /if \(primitive\.getMaterial\(\)\?\.getName\(\) !== 'M_Collision'\) weldPrimitive/);
  assert.ok(exporter.indexOf('await doc.transform(reorder') < exporter.indexOf('if (exactWeld)'));
  assert.equal((exporter.match(/reorder\(\{/g) ?? []).length, 1, 'no post-quantization reorder: collision order is contractual');
});

test('existing water, target and ghost-emissive paths are not overridden', () => {
  for (const name of ['M_Water', 'M_Waterfall', 'M_Emissive', 'M_Target', 'M_Beam']) {
    const source = new THREE.MeshStandardMaterial({ name });
    assert.equal(blackSailToonMaterial(source, gradient), null);
    assert.equal(toonMaterial(source).userData.blackSailSurface, undefined);
  }
  assert.equal(toonMaterial(new THREE.MeshStandardMaterial({ name: 'M_Water' })).customProgramCacheKey(), 'cel-water');
  assert.equal(toonMaterial(new THREE.MeshStandardMaterial({ name: 'M_KyotoTimber' })).customProgramCacheKey(), 'kyoto-surface-v1-M_KyotoTimber');
});


// This asserts the delivered production asset, not a synthetic fixture. Run again after regeneration.
test('production BlackSail GLB assigns every claimed profile to real ART triangles', async () => {
  const bytes = readFileSync(new URL('../public/assets/world_blacksail.glb', import.meta.url));
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(gltf.scene);
  const art = gltf.scene.getObjectByName('ART');
  assert.ok(art);
  const assigned = new Set<string>();
  art.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const expected = blackSailMaterialProfile(material.name);
      if (!expected) continue;
      assert.ok(mesh.geometry.getAttribute('position').count >= 3, `${mesh.name}: nonempty production geometry`);
      assert.ok(mesh.geometry.getAttribute('color'), `${mesh.name}: authored palette survives`);
      assert.equal((material as THREE.MeshStandardMaterial).roughness, expected.roughness);
      assert.equal((material as THREE.MeshStandardMaterial).metalness, expected.metalness);
      assert.equal(toonMaterial(material).userData.blackSailSurface, material.name);
      if (material.name === 'M_BlackSailCanvas') assert.equal(material.side, THREE.DoubleSide);
      assigned.add(material.name);
    }
  });
  assert.deepEqual([...assigned].sort(), Object.keys(BLACKSAIL_MATERIAL_PROFILES).sort());
});

test('production ship fittings and sails use their physical identities, with ghost-beam exception', async () => {
  const bytes = readFileSync(new URL('../public/assets/world_blacksail.glb', import.meta.url));
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const checked = new Set<string>();
  gltf.scene.getObjectByName('ART')!.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.name.includes('_Ship_')) return;
    const suffix = mesh.name.split('_').at(-1)!;
    const expected = ({ Timber: 'M_BlackSailTimber', Canvas: mesh.name.startsWith('Ghost') ? 'M_Beam' : 'M_BlackSailCanvas', Iron: 'M_BlackSailIron', Brass: 'M_BlackSailBrass', Rigging: 'M_BlackSailRope' } as Record<string, string>)[suffix];
    if (!expected) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    assert.equal(material.name, expected, mesh.name);
    assert.ok(mesh.geometry.getAttribute('position').count >= 3);
    checked.add(expected);
    if (expected === 'M_Beam') {
      assert.equal(material.side, THREE.DoubleSide);
      assert.equal(material.transparent, true);
      assert.equal(material.opacity, 0.28);
      const runtime = toonMaterial(material);
      assert.equal(runtime.side, THREE.DoubleSide);
      assert.equal(runtime.depthWrite, false);
      assert.equal(runtime.transparent, true);
    }
  });
  assert.deepEqual([...checked].sort(), ['M_Beam', 'M_BlackSailTimber', 'M_BlackSailCanvas', 'M_BlackSailIron', 'M_BlackSailBrass', 'M_BlackSailRope'].sort());
});

test('production BlackSail beam portable GLB declares alpha blend without changing runtime intent', () => {
  const bytes = readFileSync(new URL('../public/assets/world_blacksail.glb', import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const beam = json.materials.find((m: { name: string }) => m.name === 'M_Beam');
  assert.ok(beam);
  assert.equal(beam.alphaMode, 'BLEND');
  assert.equal(beam.doubleSided, true);
  assert.equal(beam.pbrMetallicRoughness.baseColorFactor[3], 0.28);
});

test('compressed beam fixture preserves BlackSail-only portable alpha and other-region opt-out', async () => {
  const scene = new THREE.Scene();
  for (const [i, region] of ['world_blacksail', 'world_kyoto', 'world_winter', 'world_alpha'].entries()) {
    const material = new THREE.MeshStandardMaterial({ name: 'M_Beam' });
    applyBlackSailBeamFallback(material, region);
    assert.equal(material.depthWrite, region !== 'world_blacksail');
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    mesh.name = region; mesh.position.x = i * 2; scene.add(mesh);
  }
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true }) as ArrayBuffer;
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.readBinary(new Uint8Array(glb));
  await doc.transform(quantize());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const packed = await io.writeBinary(doc);
  const jsonLength = new DataView(packed.buffer, packed.byteOffset).getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(packed.subarray(20, 20 + jsonLength)));
  assert.equal(json.materials.filter((m: { alphaMode?: string }) => m.alphaMode === 'BLEND').length, 1);
  const gltf = await regionLoader().parseAsync(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength), '');
  for (const region of ['world_blacksail', 'world_kyoto', 'world_winter', 'world_alpha']) {
    const material = (gltf.scene.getObjectByName(region) as THREE.Mesh).material as THREE.MeshStandardMaterial;
    assert.equal(material.transparent, region === 'world_blacksail');
    assert.equal(material.opacity, region === 'world_blacksail' ? 0.28 : 1);
    assert.equal(material.side, region === 'world_blacksail' ? THREE.DoubleSide : THREE.FrontSide);
  }
});
