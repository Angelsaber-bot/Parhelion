import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installGeometricShadowFacing } from '../src/rendering/geometricShadowFacing';

test('directional shadows use the true face direction, once, and only on the stock chunk', () => {
  const chunks = { lights_fragment_begin: (THREE.ShaderChunk as unknown as Record<string, string>).lights_fragment_begin };
  if (chunks.lights_fragment_begin.includes('parhelionFaceNormal')) return; // already installed by an earlier import
  assert.equal(installGeometricShadowFacing(chunks), true);
  const patched = chunks.lights_fragment_begin;
  assert.match(patched, /vec3 parhelionFaceNormal = cross\( dFdx\( geometryPosition \), dFdy\( geometryPosition \) \)/);
  assert.match(patched, /vDirectionalShadowCoord\[ i \] \) \* smoothstep\( 0\.0, 0\.12, dot\( parhelionFaceNormal, directLight\.direction \) \)/);
  // The face normal is declared after geometryPosition and before it is used.
  assert.ok(patched.indexOf('vec3 geometryPosition') < patched.indexOf('vec3 parhelionFaceNormal'));
  assert.ok(patched.indexOf('vec3 parhelionFaceNormal') < patched.indexOf('dot( parhelionFaceNormal, directLight'));
  // Point and spot shadows are untouched.
  assert.equal(patched.match(/parhelionFaceNormal, directLight/g)!.length, 1);
  assert.equal(installGeometricShadowFacing(chunks), false, 'idempotent');
  assert.equal(installGeometricShadowFacing({ lights_fragment_begin: 'void main(){}' }), false, 'unknown chunk left alone');
});
