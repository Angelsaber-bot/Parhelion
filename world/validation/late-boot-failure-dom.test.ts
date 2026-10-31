/** Explicit late-construction fault in the test bundle only; real main handlers/DOM. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('a late initialization failure cannot enter pointer lock or invoke partial gameplay from the failure overlay', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, faultAfterInputRegistration: true,
    initialStorage: { 'parhelion.world.progress.v2': '{"done":["preserved"],"found":[]}' } });
  const d = h.window.document;
  try {
    assert.ok(d.getElementById('retry'));
    assert.match(d.getElementById('loading')!.textContent!, /Injected late initialization failure/);
    assert.equal(h.errors.length, 1, 'Only the deliberately injected boot failure');
    const original = d.getElementById('loading')!.textContent;
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve();
    assert.equal(d.pointerLockElement, null, 'Failure overlay does not enter partial gameplay');
    for (const code of ['KeyF', 'KeyR', 'KeyQ', 'KeyV']) {
      d.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { code, bubbles: true }));
      d.body.dispatchEvent(new h.window.KeyboardEvent('keyup', { code, bubbles: true }));
    }
    // Model an already-pending browser lock resolving after initialization failed.
    await (d.getElementById('view') as HTMLCanvasElement).requestPointerLock();
    assert.equal(d.pointerLockElement, null, 'Late pointer lock is immediately released');
    d.dispatchEvent(new h.window.Event('pointerlockerror'));
    assert.equal(h.window.localStorage.getItem('parhelion.world.progress.v2'), '{"done":["preserved"],"found":[]}');
    d.getElementById('view')!.dispatchEvent(new h.window.Event('webglcontextlost', { cancelable: true }));
    d.getElementById('view')!.dispatchEvent(new h.window.Event('webglcontextrestored'));
    assert.equal(h.errors.length, 1); assert.equal(d.getElementById('loading')!.textContent, original);
    assert.equal((d.getElementById('start') as HTMLElement).classList.contains('hidden'), false);
  } finally { await h.close(); }
});
