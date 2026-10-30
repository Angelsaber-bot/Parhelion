import test from 'node:test';import assert from 'node:assert/strict';import {warmupShaders} from '../src/shaderWarmup.ts';
test('shader warmup does not run on unsupported drivers and preserves successful readiness',async()=>{
 let n=0;assert.equal(await warmupShaders(false,async()=>{n++}), 'unavailable');assert.equal(n,0);assert.equal(await warmupShaders(true,async()=>{n++}), 'ready');assert.equal(n,1);
});
test('shader warmup failure or hang cannot prevent eventual entry',async()=>{
 assert.equal(await warmupShaders(true,()=>{throw new Error('driver')}), 'failed');
 assert.equal(await warmupShaders(true,()=>Promise.reject(new Error('compile'))), 'failed');
 assert.equal(await warmupShaders(true,()=>new Promise(()=>{}),5), 'timed-out');
});
