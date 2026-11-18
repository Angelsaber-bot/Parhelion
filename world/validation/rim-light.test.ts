import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { RIM_STRENGTH, RIM_UNIFORMS, applyRimLight, rimLightCharacter } from '../../shared-client/rimLight';

test('rim light chains onto lit materials once and leaves unlit ones alone', () => {
  const lit = new THREE.MeshStandardMaterial(), toon = new THREE.MeshToonMaterial(), basic = new THREE.MeshBasicMaterial();
  let previousRan = 0;
  lit.onBeforeCompile = shader => { previousRan++; shader.fragmentShader += '\n// previous'; };
  const keyBefore = lit.customProgramCacheKey(), versionBefore = lit.version;
  assert.equal(applyRimLight(lit as never), true);
  assert.equal(applyRimLight(lit as never), false, 'second call is a no-op');
  assert.equal(applyRimLight(basic as never), false, 'unlit materials stay as they are');
  assert.equal(applyRimLight(toon as never), true);
  assert.equal(lit.customProgramCacheKey(), `${keyBefore}|rim`);
  assert.ok(lit.version > versionBefore, 'marked for recompile before first use');
  const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '', fragmentShader: 'void main(){\n#include <emissivemap_fragment>\n}' };
  lit.onBeforeCompile(shader as never, undefined as never);
  assert.equal(previousRan, 1, 'the earlier onBeforeCompile still runs');
  assert.match(shader.fragmentShader, /\/\/ previous/);
  assert.match(shader.fragmentShader, /uniform vec3 rimColor;/);
  assert.match(shader.fragmentShader, /#include <emissivemap_fragment>\s*\{\s*float rimFacing/);
  assert.equal(shader.uniforms.rimStrength, RIM_UNIFORMS.rimStrength, 'every material shares one strength uniform');
  assert.equal(RIM_UNIFORMS.rimStrength.value, RIM_STRENGTH);
});

test('a character root gets the rim on every lit mesh material, shared materials once', () => {
  const shared = new THREE.MeshStandardMaterial(), root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), shared), new THREE.Mesh(new THREE.BoxGeometry(), [shared, new THREE.MeshPhysicalMaterial()]), new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  assert.equal(rimLightCharacter(root), 2);
  assert.equal(rimLightCharacter(root), 0);
});

test('World applies the rim where characters load, before their shaders compile, and dims it at night', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.match(read('../src/characters/characterKit.ts'), /clampUvChannels\(gltf\.scene\); rimLightCharacter\(gltf\.scene\);/);
  assert.match(read('../src/companions/servant.ts'), /clampUvChannels\(gltf\.scene\); rimLightCharacter\(gltf\.scene\);/);
  assert.match(read('../src/player/skinnedCharacter.ts'), /for \(const replacement of materials\.values\(\)\) applyRimLight\(replacement as never\);/);
  assert.match(read('../src/main.ts'), /RIM_UNIFORMS\.rimStrength\.value = RIM_STRENGTH \* \(1 - \.55 \* twilight\.nightAmount\);/);
});
