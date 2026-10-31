import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldGraphicsRecovery } from '../src/graphicsRecovery';

test('graphics event controller is idempotent and requires explicit resume after restoration', () => {
  const canvas = new EventTarget(); let suspends = 0, changes = 0;
  const recovery = new WorldGraphicsRecovery(canvas, () => suspends++, () => changes++);
  const loss = () => { const event = new Event('webglcontextlost', { cancelable: true }); canvas.dispatchEvent(event); return event; };
  assert.equal(recovery.resume(), false); assert.equal(recovery.blocked, false);
  assert.equal(loss().defaultPrevented, true); loss(); assert.equal(suspends, 1); assert.equal(changes, 1);
  canvas.dispatchEvent(new Event('webglcontextrestored')); canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(recovery.state, 'awaiting-resume'); assert.equal(recovery.blocked, true); assert.equal(changes, 2);
  assert.equal(recovery.resume(), true); assert.equal(recovery.resume(), false); assert.equal(recovery.blocked, false);
  loss(); assert.equal(suspends, 2); recovery.dispose(); recovery.dispose();
  const before = changes; loss(); canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(changes, before); assert.equal(suspends, 2); assert.equal(recovery.state, 'disposed'); assert.equal(recovery.resume(), false);
});


test('boot resource work waits for browser restoration and releases waiters on disposal', async () => {
  const canvas = new EventTarget(), recovery = new WorldGraphicsRecovery(canvas, () => {}, () => {});
  assert.equal(await recovery.whenContextAvailable(), true);
  canvas.dispatchEvent(new Event('webglcontextlost')); let resolved = false;
  const waiting = recovery.whenContextAvailable().then(value => { resolved = true; return value; });
  await Promise.resolve(); assert.equal(resolved, false);
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(await waiting, true); assert.equal(recovery.blocked, true, 'resource initialization is not gameplay resume');
  canvas.dispatchEvent(new Event('webglcontextlost'));
  const canceled = recovery.whenContextAvailable(); recovery.dispose(); assert.equal(await canceled, false);
});

test('a second loss before the restored microtask cannot release waiting boot work', async () => {
  const canvas=new EventTarget(),recovery=new WorldGraphicsRecovery(canvas,()=>{},()=>{});
  canvas.dispatchEvent(new Event('webglcontextlost'));let released=false;
  const waiting=recovery.whenContextAvailable().then(value=>{released=true;return value;});
  canvas.dispatchEvent(new Event('webglcontextrestored'));canvas.dispatchEvent(new Event('webglcontextlost'));
  await Promise.resolve();await Promise.resolve();assert.equal(released,false);
  canvas.dispatchEvent(new Event('webglcontextrestored'));assert.equal(await waiting,true);recovery.dispose();
});
