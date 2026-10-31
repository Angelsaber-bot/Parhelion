/** Real main/import/storage/input; only navigation and GPU are explicit boundaries.
 * A no-op/throwing reload models failure to leave, not ordinary browser behavior. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { WORLD_PROGRESS_KEY } from '../src/progress';

for (const reloadMode of ['noop', 'throw'] as const) test(`accepted import retires old World when reload is ${reloadMode}`, async () => {
  const initial = JSON.stringify({ done: ['armory_rack', 'ruin_target_1', 'ruin_target_2', 'ruin_target_3'], found: [] });
  const h = await bootWorldWithoutGpu({ deterministic: true, reloadMode, initialStorage: { [WORLD_PROGRESS_KEY]: initial } });
  const w = h.world, d = h.window.document;
  let now = 0, reads = 0, confirmations = 0;
  const geometryDisposals = new Map<any, number>();
  w.falseDawnSites.root.traverse((node: any) => { if (node.geometry && !geometryDisposals.has(node.geometry)) { geometryDisposals.set(node.geometry, 0); node.geometry.addEventListener('dispose', () => geometryDisposals.set(node.geometry, geometryDisposals.get(node.geometry)! + 1)); } });
  const frame = () => h.frame(now += 1000 / 60);
  const key = (action: string, down: boolean) => d.body.dispatchEvent(new h.window.KeyboardEvent(down ? 'keydown' : 'keyup', { code: w.settings.bindingsFor(action)[0], bubbles: true, cancelable: true }));
  const storagePrototype = Object.getPrototypeOf(h.window.localStorage), setItem = storagePrototype.setItem;
  let quota = false;
  storagePrototype.setItem = function(key: string, value: string) { if (quota && key === WORLD_PROGRESS_KEY) throw new Error('quota'); return setItem.call(this, key, value); };
  try {
    (d.getElementById('start') as HTMLElement).click(); frame(); w.settingsPanel.show();
    const input = d.querySelector<HTMLInputElement>('#world-progress-status input[type=file]')!;
    const raw = '{"done":[],"found":[]}';
    Object.defineProperty(input, 'files', { configurable: true, value: [{ size: raw.length, async text() { reads++; return raw; } }] });
    h.window.confirm = () => { confirmations++; return true; };
    const importFile = async () => { input.dispatchEvent(new h.window.Event('change')); for (let i = 0; i < 12; i++) await Promise.resolve(); };
    quota = true; await importFile();
    assert.equal(h.window.localStorage.getItem(WORLD_PROGRESS_KEY), initial);
    assert.equal(w.graphicsRecovery.state, 'available', 'failed storage does not retire the existing session');
    assert.ok(w.done.has('armory_rack')); assert.equal(d.getElementById('world-reload-import'), null);
    quota = false;
    let finishOldRead!: (value: string) => void;
    const oldRead = new Promise<string>(resolve => { finishOldRead = resolve; });
    Object.defineProperty(input, 'files', { configurable: true, value: [{ size: 50, text() { reads++; return oldRead; } }] });
    input.dispatchEvent(new h.window.Event('change'));
    Object.defineProperty(input, 'files', { configurable: true, value: [{ size: raw.length, async text() { reads++; return raw; } }] });
    await importFile();
    const confirmed = confirmations;
    finishOldRead('{"done":["stale_async_quest"],"found":[]}');
    for (let i = 0; i < 12; i++) await Promise.resolve();
    assert.equal(confirmations, confirmed, 'retired pending read cannot ask again or replace committed import');
    assert.equal(h.window.localStorage.getItem(WORLD_PROGRESS_KEY), raw);
    assert.deepEqual([...w.done], []); assert.equal(w.graphicsRecovery.state, 'disposed');
    const retry = d.getElementById('world-reload-import') as HTMLButtonElement; assert.ok(retry);
    assert.match(d.getElementById('loading')!.textContent!, /备份已保存|Backup saved/);
    assert.equal(d.getElementById('world-progress-status'), null, 'old restore/reset controls are retired');
    const before = { p: w.player.pos.toArray(), hp: w.combat.state.hp, flags: [...w.done], found: [...w.found], saved: h.window.localStorage.getItem(WORLD_PROGRESS_KEY) };
    let renders = 0; const render = w.renderer.render.bind(w.renderer); w.renderer.render = (...args: any[]) => { renders++; return render(...args); };
    (d.getElementById('start') as HTMLElement).click(); key('forward', true); key('reset', true); key('reset', false);
    const canvas = d.getElementById('view')!;
    canvas.dispatchEvent(new h.window.Event('webglcontextlost', { cancelable: true })); canvas.dispatchEvent(new h.window.Event('webglcontextrestored'));
    for (let i = 0; i < 120; i++) frame(); key('forward', false);
    assert.deepEqual({ p: w.player.pos.toArray(), hp: w.combat.state.hp, flags: [...w.done], found: [...w.found], saved: h.window.localStorage.getItem(WORLD_PROGRESS_KEY) }, before);
    assert.equal(renders, 0); assert.equal(w.graphicsRecovery.state, 'disposed');
    const previousReads = reads; await importFile(); assert.equal(reads, previousReads, 'detached file callbacks cannot import again');
    retry.click(); retry.click(); assert.equal(w.graphicsRecovery.state, 'disposed');
    assert.equal(h.window.localStorage.getItem(WORLD_PROGRESS_KEY), raw);
    assert.ok(geometryDisposals.size > 0);
    for (let i = 0; i < 2; i++) h.window.dispatchEvent(new h.window.PageTransitionEvent('pagehide', { persisted: false }));
    assert.ok([...geometryDisposals.values()].every(count => count === 1), 'retired session resources still dispose exactly once on final exit');
    retry.click(); assert.equal(h.window.localStorage.getItem(WORLD_PROGRESS_KEY), raw); assert.deepEqual(h.errors, []);
  } finally { storagePrototype.setItem = setItem; await h.close(); }
});
