// Execute the production event-registration section, not a duplicate input model.
// Browser graphics/pointer-lock UX is covered separately by browser.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
class Target {
  listeners = new Map<string, ((event: any) => unknown)[]>();
  addEventListener(type: string, fn: (event: any) => unknown) { this.listeners.set(type, [...this.listeners.get(type) ?? [], fn]); }
  emit(type: string, event: Record<string, unknown> = {}) { for (const fn of this.listeners.get(type) ?? []) fn({ preventDefault() {}, repeat: false, shiftKey: false, ...event }); }
}
function setup() {
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const section = source.slice(source.indexOf('const keys ='), source.indexOf('// ───────────── shooting'));
  assert.ok(section.length > 500, 'production input section located');
  const elements = new Map<string, any>();
  function $(id: string) {
    if (!elements.has(id)) {
      const classes = new Set<string>();
      elements.set(id, Object.assign(new Target(), { textContent: '', style: {}, classList: {
        contains: (s: string) => classes.has(s), remove: (s: string) => classes.delete(s), add: (s: string) => classes.add(s),
        toggle: (s: string, force?: boolean) => { const on = force ?? !classes.has(s); on ? classes.add(s) : classes.delete(s); return on; }
      } }));
    }
    return elements.get(id);
  }
  const document = Object.assign(new Target(), { pointerLockElement: null as unknown, visibilityState: 'visible', hasFocus: () => true });
  const target = new Target(), canvas = { requestPointerLock: () => Promise.resolve() };
  let actions = 0;
  const context = vm.createContext({ $, document, canvas, addEventListener: target.addEventListener.bind(target), player: { flying: false, yaw: 0, pitch: 0 }, THREE: { MathUtils: { clamp: (n: number, min: number, max: number) => Math.max(min, Math.min(n,max)) } }, debugCol: { visible: false }, toast() {}, interact() { actions++; }, save() {}, applyWorldState() {}, done: new Set(['relay_b']), found: new Set(['secret_cave']), layout: { areas: [] }, spawnAt() {} });
  vm.runInContext(transformSync(section + '\nglobalThis.state = {keys, get locked(){return locked}};', { loader: 'ts', format: 'cjs' }).code, context);
  return { $, document, target, canvas, context, actions: () => actions, lock() { document.pointerLockElement = canvas; document.emit('pointerlockchange'); } };
}
test('unlocked keys cannot move, interact or reset progress', () => {
  const s = setup();
  s.target.emit('keydown', { code: 'KeyW', key: 'w' });
  s.target.emit('keydown', { code: 'KeyE', key: 'e' });
  s.target.emit('keydown', { code: 'KeyR', key: 'r' });
  assert.equal(s.context.state.keys.size, 0);
  assert.equal(s.actions(), 0);
  assert.equal(s.context.done.has('relay_b'), true);
});
test('locked controls work and unlock/blur/hidden clear keys', () => {
  const s = setup(); s.lock();
  s.target.emit('keydown', { code: 'KeyW', key: 'w' });
  assert.equal(s.context.state.keys.has('KeyW'), true);
  s.target.emit('keydown', { code: 'KeyE', key: 'e' });
  assert.equal(s.actions(), 1);
  s.document.pointerLockElement = null; s.document.emit('pointerlockchange');
  assert.equal(s.context.state.keys.size, 0);
  s.lock(); s.target.emit('keydown', { code: 'KeyW' }); s.target.emit('blur');
  assert.equal(s.context.state.keys.size, 0);
  s.target.emit('keydown', { code: 'KeyW' }); s.document.visibilityState = 'hidden'; s.document.emit('visibilitychange');
  assert.equal(s.context.state.keys.size, 0);
});
test('map opening clears controls and blocks gameplay, closing restores control', () => {
  const s = setup(); s.lock();
  s.target.emit('keydown', { code: 'KeyW', key: 'w' });
  s.target.emit('keydown', { code: 'KeyM', key: 'm' });
  assert.equal(s.$('bigmap').classList.contains('open'), true);
  assert.equal(s.context.state.keys.size, 0);
  s.target.emit('keydown', { code: 'KeyE' }); s.target.emit('keydown', { code: 'KeyR' });
  assert.equal(s.actions(), 0); assert.equal(s.context.done.has('relay_b'), true);
  s.target.emit('keydown', { code: 'KeyM', key: 'm' });
  assert.equal(s.$('bigmap').classList.contains('open'), false);
  s.target.emit('keydown', { code: 'KeyW' });
  assert.equal(s.context.state.keys.has('KeyW'), true);
});
test('flight E only ascends; modified shortcuts and repeats do not trigger actions', () => {
  const s = setup(); s.lock(); s.context.player.flying = true;
  s.target.emit('keydown', { code: 'KeyE', key: 'e' });
  assert.equal(s.actions(), 0);
  assert.equal(s.context.state.keys.has('KeyE'), true);
  s.target.emit('keydown', { code: 'KeyR', key: 'r', metaKey: true });
  assert.equal(s.context.done.has('relay_b'), true);
  assert.equal(s.context.state.keys.size, 0);
  s.target.emit('keydown', { code: 'KeyF', repeat: true });
  assert.equal(s.context.player.flying, true);
});
test('pointer-lock rejection is handled and the entry prompt remains retryable', async () => {
  const s = setup();
  s.canvas.requestPointerLock = () => Promise.reject(new Error('blocked'));
  s.$('start').emit('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.match(s.$('loading').textContent, /无法锁定鼠标/);
  assert.equal(s.$('start').classList.contains('hidden'), false);
  assert.equal(s.context.state.keys.size, 0);
  s.lock();
  assert.equal(s.$('start').classList.contains('hidden'), true);
});
test('unlock closes the modal map and repeated map keys do not toggle twice', () => {
  const s = setup(); s.lock();
  s.target.emit('keydown', { code: 'KeyM' });
  s.target.emit('keydown', { code: 'KeyM', repeat: true });
  assert.equal(s.$('bigmap').classList.contains('open'), true);
  s.document.pointerLockElement = null; s.document.emit('pointerlockchange');
  assert.equal(s.$('bigmap').classList.contains('open'), false);
});
