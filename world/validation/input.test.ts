// Execute the production event-registration section, not a duplicate input model.
// Browser graphics/pointer-lock UX is covered separately by browser.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ShoulderAim } from '../src/aim.ts';
import { SettingsStore } from '../../shared-client/settings.ts';
import { transformSync } from 'esbuild';
class Target {
  listeners = new Map<string, ((event: any) => unknown)[]>();
  addEventListener(type: string, fn: (event: any) => unknown) { this.listeners.set(type, [...this.listeners.get(type) ?? [], fn]); }
  emit(type: string, event: Record<string, unknown> = {}) { for (const fn of this.listeners.get(type) ?? []) fn({ preventDefault() {}, stopPropagation() {}, repeat: false, shiftKey: false, ...event }); }
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
  let actions = 0, shots = 0;
  const createSettingsPanel = (_store: unknown, hooks: { onOpen(): void; onClose(): void }) => ({
    open: false, show() { if (this.open) return; this.open = true; hooks.onOpen(); }, close() { this.open = false; hooks.onClose(); },
  });
  (document as any).exitPointerLock = () => { document.pointerLockElement = null; document.emit('pointerlockchange'); };
  const context = vm.createContext({ ShoulderAim, SettingsStore, createSettingsPanel, shoot() { shots++; }, $, document, canvas, addEventListener: target.addEventListener.bind(target), player: { flying: false, yaw: 0, pitch: 0 }, THREE: { MathUtils: { clamp: (n: number, min: number, max: number) => Math.max(min, Math.min(n,max)) } }, debugCol: { visible: false }, toast() {}, interact() { actions++; }, save() {}, applyWorldState() {}, done: new Set(['relay_b']), found: new Set(['secret_cave']), layout: { areas: [] }, spawnAt() {} });
  vm.runInContext(transformSync(section + '\nglobalThis.state = {keys, aim, settings, settingsPanel, down, get locked(){return locked}};', { loader: 'ts', format: 'cjs' }).code, context);
  return { $, document, target, canvas, context, actions: () => actions, shots: () => shots, lock() { document.pointerLockElement = canvas; document.emit('pointerlockchange'); } };
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

test('right-button shoulder aim releases on mouseup, blur, visibility, unlock and map open', () => {
  const s = setup(); s.lock();
  const aim = s.context.state.aim;
  s.target.emit('mousedown', { button: 2 }); assert.equal(aim.held, true);
  s.target.emit('mouseup', { button: 2 }); assert.equal(aim.held, false);
  for (const event of ['blur', 'visibilitychange', 'pointerlockchange', 'map']) {
    s.target.emit('mousedown', { button: 2 }); aim.value = 1;
    if (event === 'blur') s.target.emit(event);
    else if (event === 'map') s.target.emit('keydown', { code: 'KeyM' });
    else s.document.emit(event);
    assert.equal(aim.held, false, event); assert.equal(aim.value, 0, event);
  }
});

test('World custom bindings drive real input, shooting, sensitivity and hints', () => {
  const s = setup(); s.lock(); const store = s.context.state.settings;
  store.bind('fire', 'KeyP'); store.bind('forward', 'Mouse3');
  s.target.emit('keydown', { code: 'KeyP' }); assert.equal(s.shots(), 1);
  s.target.emit('mousedown', { button: 3 }); assert.equal(s.context.state.down('forward'), true);
  store.update({ sensitivity: 2, adsSensitivity: .3, invertY: true });
  assert.equal(s.context.state.keys.size, 0); assert.match(s.$('help').textContent, /P 射击/);
  s.document.emit('mousemove', { movementX: 10, movementY: 10 });
  assert.equal(s.context.player.yaw, -.044000000000000004); assert.equal(s.context.player.pitch, .044000000000000004);
});
test('World settings hotkey/menu clears movement and aim, blocks gameplay and never relocks on close', () => {
  const s = setup(); s.lock();
  s.target.emit('keydown', { code: 'KeyW' }); s.target.emit('mousedown', { button: 2 });
  s.target.emit('keydown', { code: 'KeyO' });
  assert.equal(s.context.state.settingsPanel.open, true); assert.equal(s.context.state.keys.size, 0); assert.equal(s.context.state.aim.held, false);
  s.target.emit('keydown', { code: 'KeyR' }); assert.equal(s.context.done.has('relay_b'), true);
  s.context.state.settingsPanel.close(); assert.equal(s.context.state.locked, false);
  s.target.emit('keydown', { code: 'KeyW' }); assert.equal(s.context.state.keys.size, 0);
});
