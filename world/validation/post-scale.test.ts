import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { scalePassResolution } from '../../shared-client/postScale.ts';
import { MsaaScenePass } from '../src/rendering/msaaScenePass.ts';
import { POST_SCALE } from '../src/rendering/renderQuality.ts';

test('scaled passes receive a fraction of the composer size, never below one pixel', () => {
  const seen: number[][] = [];
  const pass = scalePassResolution({ setSize: (w: number, h: number) => { seen.push([w, h]); } }, .5);
  pass.setSize(1600, 900); pass.setSize(1, 1); pass.setSize(1601, 901);
  assert.deepEqual(seen, [[800, 450], [1, 1], [801, 451]]);
  const same = { setSize() {} }, original = same.setSize;
  assert.equal(scalePassResolution(same, 1).setSize, original);
  assert.equal(scalePassResolution(same, Number.NaN).setSize, original);
});

test('only ambient occlusion runs below composer resolution in World', () => {
  assert.deepEqual(POST_SCALE, { ao: .5 });
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /scalePassResolution\(new GTAOPass\(/);
  assert.match(main, /composer\.addPass\(new UnrealBloomPass\(new THREE\.Vector2\(innerWidth, innerHeight\), 0\.22, 0\.45, 0\.97\)\)/);
  // High multisamples only its scene pass; medium keeps multisampled composer buffers.
  assert.match(main, /samples: highQ \|\| lowQ \? 0 : 2/);
  assert.match(main, /highQ \? new MsaaScenePass\(scene, camera, 4\) : new RenderPass\(scene, camera\)/);
});

test('MSAA scene pass owns a multisampled half-float target that follows the composer size', () => {
  const pass = new MsaaScenePass(new THREE.Scene(), new THREE.PerspectiveCamera(), 4);
  assert.equal(pass.target.samples, 4);
  assert.equal(pass.target.texture.type, THREE.HalfFloatType);
  assert.equal(pass.needsSwap, false);
  pass.setSize(1920, 1080);
  assert.deepEqual([pass.target.width, pass.target.height], [1920, 1080]);
  pass.dispose();
});
