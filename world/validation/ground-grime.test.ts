import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installGroundGrime, adoptGroundGrime, wantsGroundGrime, groundGrimeUniforms, GROUND_GRIME, GROUND_GRIME_GLSL } from '../src/rendering/groundGrime';
import { installGeometricShadowFacing } from '../src/rendering/geometricShadowFacing';

test('the patch lands once in the shared lighting chunk, after the shadow-facing patch, and declares its uniforms', () => {
  const chunks = { ...(THREE.ShaderChunk as unknown as Record<string, string>) };
  assert.equal(installGeometricShadowFacing(chunks), true);
  assert.equal(installGroundGrime(chunks), true);
  assert.equal(installGroundGrime(chunks), false, 'idempotent');
  assert.ok(chunks.lights_pars_begin.startsWith('#ifdef PARHELION_GROUND\nuniform sampler2D parhelionGround;'), 'stock programs never declare the sampler');
  const lights = chunks.lights_fragment_begin;
  assert.ok(lights.includes('parhelionGroundGrime') && lights.includes('parhelionFaceNormal'), 'both patches coexist');
  assert.ok(lights.indexOf('parhelionGroundGrime') > lights.indexOf('geometryViewDir ='), 'reads the view direction after it is declared');
  assert.equal(installGroundGrime({ lights_fragment_begin: 'moved', lights_pars_begin: '' }), false, 'a moved chunk keeps stock behaviour');
});

test('GLSL: vertical faces near the ground only, inside the map, opt-in by uniform', () => {
  assert.ok(GROUND_GRIME_GLSL.trim().startsWith('#ifdef PARHELION_GROUND') && GROUND_GRIME_GLSL.trim().endsWith('#endif'), 'only adopted programs carry it');
  assert.ok(GROUND_GRIME_GLSL.includes('#ifdef USE_SKINNING'), 'characters get a short contact band, not dirty shins');
  assert.ok(GROUND_GRIME_GLSL.includes('step( -0.5, pgAbove )'), 'nothing underground or in a basement');
  assert.ok(GROUND_GRIME.band <= 1.2 && GROUND_GRIME.skinnedBand < .3);
  assert.ok(Math.min(...GROUND_GRIME.tint) > .45, 'grime darkens, never to black');
});

test('adoption: lit opaque art takes the shared uniforms; terrain, water and translucent never do', () => {
  const wall = new THREE.MeshToonMaterial({ name: 'M_KyotoPlaster' }), terrain = new THREE.MeshToonMaterial({ name: 'M_Terrain' });
  const glass = new THREE.MeshStandardMaterial({ name: 'Glass', transparent: true, opacity: .5 }), basic = new THREE.MeshBasicMaterial();
  const optOut = new THREE.MeshLambertMaterial(); optOut.userData.noGroundGrime = true;
  assert.equal(wantsGroundGrime(wall), true); assert.equal(wantsGroundGrime(terrain), false); assert.equal(wantsGroundGrime(glass), false);
  assert.equal(wantsGroundGrime(basic), false, 'unlit glow and ink stay untouched'); assert.equal(wantsGroundGrime(optOut), false);
  let priorRan = false; wall.onBeforeCompile = () => { priorRan = true; };
  const root = new THREE.Group();
  for (const m of [wall, terrain, glass, basic, optOut]) root.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), wall)); // shared material counts once
  assert.equal(adoptGroundGrime(root), 1); assert.equal(adoptGroundGrime(root), 0, 'repeat-safe');
  const shader = { uniforms: {} as Record<string, unknown>, vertexShader: '', fragmentShader: '' };
  wall.onBeforeCompile(shader as never, {} as never);
  assert.ok(priorRan, 'chains the material\'s own shader edits');
  assert.equal(shader.uniforms.parhelionGround, groundGrimeUniforms.parhelionGround, 'one shared texture, never cloned');
  assert.equal(shader.uniforms.parhelionGroundOn, groundGrimeUniforms.parhelionGroundOn);
  assert.ok('PARHELION_GROUND' in (shader as unknown as { defines: object }).defines);
  assert.ok(wall.customProgramCacheKey().endsWith('|ground'), 'adopted materials never share a stock program');
});

test('water reads the same baked height: shallows and shore foam, deep water off the map', async () => {
  const { toonMaterial, WATER_DEPTH } = await import('../src/rendering/look');
  const water = toonMaterial(new THREE.MeshStandardMaterial({ name: 'M_Water' }));
  const shader = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\n#include <project_vertex>', fragmentShader: '#include <common>\n#include <opaque_fragment>' };
  water.onBeforeCompile(shader as never, {} as never);
  assert.equal(shader.uniforms.uGround, groundGrimeUniforms.parhelionGround, 'shares the one height texture');
  assert.equal(shader.uniforms.uGroundBox, groundGrimeUniforms.parhelionGroundBox);
  assert.ok(shader.fragmentShader.includes('Shore foam') && shader.fragmentShader.includes('? 99.0'), 'no terrain under it reads as deep');
  assert.ok(shader.fragmentShader.indexOf('uniform sampler2D uGround') < shader.fragmentShader.indexOf('texture2D(uGround'));
  assert.ok(WATER_DEPTH.foam < 1 && WATER_DEPTH.shallow > WATER_DEPTH.foam);
  assert.equal(water.customProgramCacheKey(), 'cel-water');
  water.dispose();
});
