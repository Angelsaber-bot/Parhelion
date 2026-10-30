import { WorldAudio } from '../src/worldAudio';
import * as campaignClosure from '../src/campaignClosure';
import { FortCannon, FORT_CANNON } from '../src/fortCannon';
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
  // Ordinary input fixture: no owned cinematic or presentation resources.
  const context = vm.createContext({ultimateDirector: undefined, abortUltimate() {}, narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false, FORT_CANNON, fortCannon: new FortCannon(), actions: undefined, hudRevision: 0, inspectServant: false, servantRoot: () => ({visible:true}), combat: { defeated: false }, contract: { toggle: () => false, cycle: () => null }, servantName: () => ({ zh: 'Saber', en: 'Saber' }), bilingual: (zh: string) => zh, localizeText: (text: string) => text, languageToggle: { hidden: false }, setLoading: (text: string) => { $('loading').textContent = text; }, resetProgress() {}, ShoulderAim, SettingsStore, createSettingsPanel, shoot() { shots++; }, $, document, canvas, addEventListener: target.addEventListener.bind(target), player: { flying: false, gliding: false, swimming: false, onGround: true, yaw: 0, pitch: 0 }, THREE: { MathUtils: { clamp: (n: number, min: number, max: number) => Math.max(min, Math.min(n,max)) } }, debugCol: { visible: false }, toast() {}, interactSettlementNpc: () => false, interact() { actions++; }, save() {}, applyWorldState() {}, done: new Set(['relay_b']), found: new Set(['secret_cave']), layout: { areas: [] }, spawnAt() {} });
  vm.runInContext(transformSync(section + '\nglobalThis.state = {keys, aim, settings, settingsPanel, down, get locked(){return locked}};', { loader: 'ts', format: 'cjs' }).code, context);
  return { $, document, target, canvas, context, actions: () => actions, shots: () => shots, lock() { document.pointerLockElement = canvas; document.emit('pointerlockchange'); } };
}
test('unlocked keys cannot move, interact or reset progress', () => {
  const s = setup();
  s.target.emit('keydown', { code: 'KeyW', key: 'w' });
  s.target.emit('keydown', { code: 'KeyF', key: 'f' });
  s.target.emit('keydown', { code: 'KeyR', key: 'r' });
  assert.equal(s.context.state.keys.size, 0);
  assert.equal(s.actions(), 0);
  assert.equal(s.context.done.has('relay_b'), true);
});

test('servant inspection clears held input, blocks gameplay and remains dismissible without repeating', () => {
  const s=setup();s.lock();
  const inspect=s.context.state.settings.bindingsFor('inspectServant')[0];
  s.target.emit('keydown',{code:'KeyW'});s.target.emit('mousedown',{button:2});
  s.target.emit('keydown',{code:inspect});
  assert.equal(s.context.inspectServant,true);assert.equal(s.context.state.keys.size,0);assert.equal(s.context.state.aim.held,false);
  s.target.emit('keydown',{code:'KeyW'});s.target.emit('keydown',{code:'KeyF'});s.target.emit('mousedown',{button:0});
  assert.equal(s.context.state.keys.size,0);assert.equal(s.actions(),0);assert.equal(s.shots(),0);
  s.target.emit('keydown',{code:inspect,repeat:true});assert.equal(s.context.inspectServant,true);
  s.target.emit('keydown',{code:inspect});assert.equal(s.context.inspectServant,false);
  s.target.emit('keydown',{code:'KeyW'});assert.equal(s.context.state.keys.has('KeyW'),true);
  s.target.emit('keydown',{code:'KeyM'});s.target.emit('keydown',{code:inspect});assert.equal(s.context.inspectServant,false);
  s.target.emit('keydown',{code:'KeyM'});s.context.combat.defeated=true;
  s.target.emit('keydown',{code:inspect});assert.equal(s.context.inspectServant,false);
});
test('locked controls work and unlock/blur/hidden clear keys', () => {
  const s = setup(); s.lock();
  s.target.emit('keydown', { code: 'KeyW', key: 'w' });
  assert.equal(s.context.state.keys.has('KeyW'), true);
  s.target.emit('keydown', { code: 'KeyF', key: 'f' });
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
  s.target.emit('keydown', { code: 'KeyF' }); s.target.emit('keydown', { code: 'KeyR' });
  assert.equal(s.actions(), 0); assert.equal(s.context.done.has('relay_b'), true);
  s.target.emit('keydown', { code: 'KeyM', key: 'm' });
  assert.equal(s.$('bigmap').classList.contains('open'), false);
  s.target.emit('keydown', { code: 'KeyW' });
  assert.equal(s.context.state.keys.has('KeyW'), true);
});
test('flight has no interaction/rise alias; modified shortcuts and repeats do not trigger actions', () => {
  const s = setup(); s.lock(); s.context.player.flying = true;
  s.target.emit('keydown', { code: 'KeyF', key: 'f' });
  assert.equal(s.actions(), 0);
  assert.equal(s.context.state.keys.has('KeyF'), true);
  s.target.emit('keydown', { code: 'KeyR', key: 'r', metaKey: true });
  assert.equal(s.context.done.has('relay_b'), true);
  assert.equal(s.context.state.keys.size, 0);
  s.target.emit('keydown', { code: 'KeyV', repeat: true });
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
  assert.equal(store.bind('fire', 'KeyK'), null); store.bind('forward', 'Mouse3');
  s.target.emit('keydown', { code: 'KeyK' }); assert.equal(s.shots(), 1);
  s.target.emit('mousedown', { button: 3 }); assert.equal(s.context.state.down('forward'), true);
  store.update({ sensitivity: 2, adsSensitivity: .3, invertY: true });
  assert.equal(s.context.state.keys.size, 0); assert.match(s.$('help').textContent, /K 射击/);
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

test('World E and RMB are OR aliases; release one keeps shoulder aim while the other is held', () => {
  for (const mouseFirst of [false, true]) {
    const s = setup(); s.lock();
    const key = () => s.target.emit('keydown', { code: 'KeyE' });
    const mouse = () => s.target.emit('mousedown', { button: 2 });
    if (mouseFirst) { mouse(); key(); } else { key(); mouse(); }
    assert.equal(s.context.state.aim.held, true); assert.equal(s.actions(), 0);
    if (mouseFirst) s.target.emit('keyup', { code: 'KeyE' }); else s.target.emit('mouseup', { button: 2 });
    assert.equal(s.context.state.aim.held, true);
    if (mouseFirst) s.target.emit('mouseup', { button: 2 }); else s.target.emit('keyup', { code: 'KeyE' });
    assert.equal(s.context.state.aim.held, false);
    assert.match(s.$('help').textContent, /E \/ 鼠标右键 按住肩射瞄准/);
    assert.match(s.$('help').textContent, /F 互动/);
  }
});
test('World alias rebind/menu/blur clear both keys and stale repeats never restore movement or aim', () => {
  for (const interrupt of ['blur', 'map', 'settings', 'rebind']) {
    const s = setup(); s.lock();
    s.target.emit('keydown', { code: 'KeyE' }); s.target.emit('mousedown', { button: 2 }); s.target.emit('keydown', { code: 'KeyW' });
    if (interrupt === 'blur') s.target.emit('blur');
    if (interrupt === 'map') s.target.emit('keydown', { code: 'KeyM' });
    if (interrupt === 'settings') s.target.emit('keydown', { code: 'KeyO' });
    if (interrupt === 'rebind') s.context.state.settings.bind('aim', 'Mouse4', false, 'secondary');
    s.target.emit('mouseup', { button: 2 }); s.target.emit('keydown', { code: 'KeyE', repeat: true }); s.target.emit('keydown', { code: 'KeyW', repeat: true });
    assert.equal(s.context.state.aim.held, false, interrupt); assert.equal(s.context.state.keys.size, 0, interrupt);
  }
});
test('manual flight vertical controls are absent; Space stays jump/glide and F only interacts', () => {
  const s = setup(); s.lock(); const settings = s.context.state.settings;
  assert.equal(settings.value.bindings.ascend, undefined); assert.equal(settings.value.bindings.descend, undefined);
  assert.equal(settings.action('Space'), 'jump'); assert.equal(settings.action('KeyQ'), 'skill'); assert.equal(settings.action('ControlLeft'), undefined);
  assert.doesNotMatch(s.$('help').textContent, /飞行上升|飞行下降|互动／飞行/);
  s.target.emit('keydown', { code: 'KeyF' }); assert.equal(s.actions(), 1);
  s.target.emit('keydown', { code: 'KeyV' }); assert.equal(s.context.player.flying, true);
  s.target.emit('keydown', { code: 'KeyF' }); assert.equal(s.actions(), 1);
  assert.equal(settings.action('KeyE'), 'aim');
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /down\('(?:ascend|descend)'\)|\bup:\s/);
});

test('World both Shift aliases stay active until both release, and defeat blocks gameplay actions', () => {
  const s = setup(); s.lock();
  s.target.emit('keydown', { code: 'ShiftLeft' }); s.target.emit('keydown', { code: 'ShiftRight' });
  assert.equal(s.context.state.down('sprint'),true);
  s.target.emit('keyup', { code: 'ShiftLeft' }); assert.equal(s.context.state.down('sprint'),true);
  s.target.emit('keyup', { code: 'ShiftRight' }); assert.equal(s.context.state.down('sprint'),false);
  s.context.combat.defeated = true;
  s.target.emit('keydown', { code: 'KeyV' }); s.target.emit('keydown', { code: 'KeyF' });
  assert.equal(s.context.player.flying,false); assert.equal(s.actions(),0);
});
test('World summon hotkey is rebindable, suppressed by maps/settings, and repeats do not retrigger', () => {
  const s=setup(); s.lock(); let calls=0;
  s.context.contract.toggle=()=>{calls++;return true;}; s.context.contract.summoned=true;
  s.target.emit('keydown',{code:'KeyT'}); s.target.emit('keydown',{code:'KeyT',repeat:true}); assert.equal(calls,1);
  assert.equal(s.context.state.settings.bind('summon','KeyK'),null);
  s.target.emit('keydown',{code:'KeyT'}); assert.equal(calls,1);
  s.target.emit('keydown',{code:'KeyK'}); assert.equal(calls,2);
  s.target.emit('keydown',{code:'KeyM'}); s.target.emit('keydown',{code:'KeyK'}); assert.equal(calls,2);
  s.target.emit('keydown',{code:'KeyM'}); s.target.emit('keydown',{code:'KeyO'}); s.target.emit('keydown',{code:'KeyK'}); assert.equal(calls,2);
});
