import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installHeightMist, heightMistAt, HEIGHT_MIST } from '../src/rendering/heightMist';

test('the mist patch lands once in all four fog chunks and keeps three\'s own fog line', () => {
  const chunks = { ...(THREE.ShaderChunk as unknown as Record<string, string>) };
  assert.equal(installHeightMist(chunks), true); assert.equal(installHeightMist(chunks), false, 'idempotent');
  for (const key of ['fog_pars_vertex', 'fog_pars_fragment']) assert.ok(chunks[key].includes('varying float vFogWorldY;'), key);
  assert.ok(chunks.fog_vertex.includes('vFogWorldY = cameraPosition.y + dot( vec3( viewMatrix[ 1 ] ), mvPosition.xyz );'));
  const fr = chunks.fog_fragment;
  assert.ok(fr.indexOf('pmLow') < fr.indexOf('gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );'), 'thickens before the mix');
  assert.ok(fr.includes('#ifndef FOG_EXP2') && fr.includes('step( 300.00, fogFar )'), 'linear fog only, long-fog scenes only');
  assert.equal(installHeightMist({ fog_pars_vertex: '', fog_vertex: 'moved', fog_pars_fragment: '', fog_fragment: '' }), false);
});

test('world Y from view space: the GLSL identity holds for a turned, raised camera', () => {
  const cam = new THREE.PerspectiveCamera(); cam.position.set(30, 42, -7); cam.lookAt(100, 5, 60); cam.updateMatrixWorld();
  const world = new THREE.Vector3(80, 3.5, 44), view = world.clone().applyMatrix4(cam.matrixWorldInverse), e = cam.matrixWorldInverse.elements;
  // viewMatrix[1] in GLSL is the second column: elements 4, 5, 6.
  const y = cam.position.y + e[4] * view.x + e[5] * view.y + e[6] * view.z;
  assert.ok(Math.abs(y - 3.5) < 1e-4, String(y));
});

test('lowlands haze with distance, heights stay clear, nearby stays crisp', () => {
  assert.equal(heightMistAt(1, 10), 0, 'nothing close to the camera');
  assert.equal(heightMistAt(40, 500), 0, 'hilltops and towers stay clear');
  assert.ok(Math.abs(heightMistAt(0, 400) - HEIGHT_MIST.strength) < 1e-9, 'full strength far and low');
  assert.ok(heightMistAt(4, 150) > heightMistAt(10, 150) && heightMistAt(4, 250) > heightMistAt(4, 120));
  assert.ok(HEIGHT_MIST.strength <= .4, 'a veil, never a wall');
});
