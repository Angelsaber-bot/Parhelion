import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
const require = createRequire(import.meta.url);

test('NON-GPU teardown immediately after cross-era lazy loads drains real fetch/body/parse tasks and restores shared adapters', async () => {
  const prototype = require('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader.prototype;
  const parseAsync = prototype.parseAsync, parse = prototype.parse, arrayBuffer = Response.prototype.arrayBuffer;
  const previousProgress = Object.getOwnPropertyDescriptor(globalThis, 'ProgressEvent');
  const h = await bootWorldWithoutGpu({ deterministic: true });
  let closed = false;
  try {
    const { window, world } = h;
    (window.document.getElementById('start') as HTMLElement).click(); await Promise.resolve();
    let now = 0;
    // All three lazy kits start without an IO sleep or waiting for one era before the next.
    for (const id of ['blackbeard_meet', 'napoleon_meet', 'musashi_meet']) {
      const marker = world.layout.markers.find((marker: any) => marker.id === id);
      world.player.teleport(...marker.p); h.frame(now += 1000 / 60);
    }
    await h.close(); closed = true;
    assert.equal(prototype.parseAsync, parseAsync); assert.equal(prototype.parse, parse); assert.equal(Response.prototype.arrayBuffer, arrayBuffer);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'ProgressEvent'), previousProgress);
    const lateActors: string[] = []; world.scene.traverse((object: any) => { if (object.name.startsWith('CharacterKit:')) lateActors.push(object.name); });
    assert.deepEqual(lateActors, [], 'actors resolving after pagehide are disposed, never appended to the closed scene');
    assert.equal(h.errors.length, 0, JSON.stringify(h.errors));
    await h.close();
    assert.equal(prototype.parseAsync, parseAsync, 'repeated close cannot restore stale wrappers over another owner');
  } finally { if (!closed) await h.close(); }
});

test('NON-GPU close waits for an outstanding response-body promise rather than an arbitrary sleep', async () => {
  const native = Response.prototype.arrayBuffer;
  let gate = false, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  Response.prototype.arrayBuffer = async function() { if (gate) await pending; return native.call(this); };
  let h: Awaited<ReturnType<typeof bootWorldWithoutGpu>> | undefined;
  try {
    h = await bootWorldWithoutGpu({ deterministic: true });
    gate = true;
    const body = new Response('delayed-body').arrayBuffer();
    let closed = false;
    const closing = h.close().then(() => { closed = true; });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(closed, false, 'close must remain pending while a tracked body task is unresolved');
    release();
    assert.equal(new TextDecoder().decode(await body), 'delayed-body'); await closing;
    assert.equal(closed, true);
    assert.equal(h.errors.length, 0, JSON.stringify(h.errors));
  } finally { release(); if (h) await h.close(); Response.prototype.arrayBuffer = native; }
});
