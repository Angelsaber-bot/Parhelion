import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AdaptiveResolution, resolutionMode, targetDpr } from '../src/renderQuality.ts';
import { DistanceCuller, freezeStaticArt } from '../src/chunk.ts';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

test('fixed balanced is default; native crisp is explicit; low and invalid DPR are safe', () => {
  assert.equal(resolutionMode(undefined), 'balanced'); assert.equal(resolutionMode(null), 'balanced');
  assert.equal(resolutionMode('garbage'), 'balanced'); assert.equal(resolutionMode(''), 'balanced');
  assert.equal(resolutionMode('crisp'), 'crisp'); assert.equal(resolutionMode('adaptive'), 'adaptive');
  assert.equal(targetDpr(2, resolutionMode(undefined)), 1.25);
  assert.equal(targetDpr(2, 'crisp'), 2); assert.equal(targetDpr(3, 'crisp'), 2);
  assert.equal(targetDpr(1, 'crisp'), 1); assert.equal(targetDpr(2, 'balanced'), 1.25);
  assert.equal(targetDpr(2, 'crisp', true), 1); assert.equal(targetDpr(NaN, 'crisp'), 1);
});
function windowAt(controller: AdaptiveResolution, fps: number, current: number, maximum = 2, active = true) {
  let value = current;
  for (let n = 0; n < fps * 2 + 1; n++) value = controller.sample(1 / fps, value, maximum, active);
  return value;
}
test('adaptive opt-in, native 1× floor and sustained headroom recovery', () => {
  const a = new AdaptiveResolution();
  assert.equal(windowAt(a, 30, 2, 2, false), 2);
  assert.equal(windowAt(a, 30, 2), 1.9);
  a.reset(); assert.equal(windowAt(a, 30, 1), 1);
  a.reset(); assert.equal(windowAt(a, 30, .8, .8), .8);
  a.reset(); assert.equal(windowAt(a, 60, 1.5), 1.5);
  assert.equal(windowAt(a, 60, 1.5), 1.5);
  assert.equal(windowAt(a, 60, 1.5), 1.55);
  assert.equal(a.sample(10, 1.5, 2, true), 1.5);
});
test('actual EffectComposer CSS sizes stay single-DPR initially, on DPR change and resize', () => {
  const renderer = { getPixelRatio: () => 2 } as THREE.WebGLRenderer;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(800, 600));
  const pass = new Pass(); let observed: number[] = [];
  pass.setSize = (w, h) => { observed = [w, h]; };
  composer.addPass(pass); composer.setSize(800, 600);
  assert.deepEqual(observed, [1600, 1200]); assert.equal(composer.renderTarget1.width, 1600);
  composer.setPixelRatio(1.25); assert.deepEqual(observed, [1000, 750]);
  composer.setSize(1000, 700); assert.deepEqual(observed, [1250, 875]);
  composer.dispose();
});
test('static art skips recomposition and preserves nested transformed matrices', () => {
  const scene = new THREE.Scene(), region = new THREE.Group(); region.position.set(700, 0, -30); scene.add(region);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); mesh.position.set(4, 5, 6); mesh.rotation.y = .7; region.add(mesh);
  const outline = new THREE.Mesh(mesh.geometry, mesh.material); mesh.add(outline);
  scene.updateMatrixWorld(true); const expected = mesh.matrixWorld.clone(), outlineExpected = outline.matrixWorld.clone();
  freezeStaticArt(mesh);
  let compositions = 0; mesh.updateMatrix = () => { compositions++; }; outline.updateMatrix = () => { compositions++; };
  scene.updateMatrixWorld(); scene.updateMatrixWorld();
  assert.equal(compositions, 0); assert.deepEqual(mesh.matrixWorld.elements, expected.elements); assert.deepEqual(outline.matrixWorld.elements, outlineExpected.elements);
  assert.equal(mesh.matrixWorldAutoUpdate, false); assert.equal(outline.matrixWorldAutoUpdate, false);
});
test('squared culling matches original sphere test and respects world scaling', () => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2), new THREE.MeshBasicMaterial()); mesh.geometry.computeBoundingSphere(); mesh.scale.setScalar(3); mesh.position.x = 10;
  const outline = new THREE.Object3D(); outline.name = 'mesh__outline'; mesh.add(outline);
  const culler = new DistanceCuller(5); culler.add(mesh, 20);
  assert.ok(Math.abs(culler.items[0].r - 6) < .00001);
  for (let x = -50; x < 50; x += .25) {
    const eye = new THREE.Vector3(x, 0, 0); culler.update(eye);
    const d = eye.distanceTo(culler.items[0].c) - culler.items[0].r;
    assert.equal(mesh.visible, d < 20); assert.equal(outline.visible, d < 5);
  }
});
