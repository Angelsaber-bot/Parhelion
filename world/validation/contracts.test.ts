import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FirstContract, CONTRACT_STORAGE_KEY } from '../src/contracts.ts';
function memory(initial?: string) { const data = new Map(initial ? [[CONTRACT_STORAGE_KEY,initial]] : []); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string,v: string) => { data.set(k,v); } }; }
test('first contract is unavailable before recruitment, then summoned and recall persists', () => {
  const done = new Set<string>(), storage = memory(), c = new FirstContract(done,storage);
  assert.equal(c.toggle(),false); assert.equal(c.summoned,false);
  c.recruit(); assert.equal(done.has('saber_contract'),true); assert.equal(c.summoned,true);
  c.toggle(); assert.equal(new FirstContract(done,storage).summoned,false);
  c.toggle(); assert.equal(new FirstContract(done,storage).summoned,true);
});
test('legacy quest saves recruit Saber; clearing progress cannot preserve an active companion', () => {
  const done = new Set(['saber_contract']), storage = memory(), c = new FirstContract(done,storage);
  assert.equal(c.recruited,true); assert.equal(c.summoned,true);
  done.clear(); c.reset(); assert.equal(c.recruited,false); assert.equal(c.summoned,false);
  assert.equal(new FirstContract(done,storage).summoned,false);
});
test('corrupt and denied storage remain playable without granting a missing quest', () => {
  assert.equal(new FirstContract(new Set(),memory('{bad')).summoned,false);
  const c = new FirstContract(new Set(), { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } });
  assert.doesNotThrow(() => c.recruit()); assert.equal(c.summoned,true);
});
