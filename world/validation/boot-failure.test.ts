import test from 'node:test';import assert from 'node:assert/strict';import {worldBootFailure} from '../src/bootFailure.ts';
test('graphics context failure distinguishes graphics from network and does not recommend save destruction',()=>{const [zh,en]=worldBootFailure('THREE.WebGLRenderer: Error creating WebGL context.');assert.match(zh,/WebGL 2/);assert.doesNotMatch(zh,/检查网络/);assert.match(en,/Resetting game progress will not fix/);});
test('download failures retain useful specific evidence',()=>{assert.match(worldBootFailure('asset HTTP 404')[1],/asset HTTP 404/);});
