/** Actual Arena main/Controls/DOM. Renderer, game, sessions and browser pointer
 * lock are explicit boundary adapters; no network or GPU behavior is claimed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
const root = resolve('../arena-game');
const mocks: Record<string, string> = {
  'scene.ts': 'export class ArenaScene { loadMap(){return Promise.resolve()}setView(){}render(){}disposeCombatEffects(){} }',
  'game.ts': `export class Game { constructor(session,scene,controls,hud,onExit){this.session=session;this.online=session.online;this.onExit=onExit;window.__qa.games++}setPaused(p){window.__qa.pauses.push(p)}stop(){if(this.stopped)return;this.stopped=true;this.session.close();this.onExit('')} }`,
  'session.ts': `export function startOffline(){return window.__qa.session(false)}export async function joinOnline(){return window.__qa.session(true)}`,
  'audio.ts': 'export const sfx={unlock(){}}', 'armory.ts': 'export function openArmory(){}',
};
const bundle = build({ entryPoints: [resolve(root, 'src/main.ts')], bundle: true, write: false, format: 'iife', platform: 'browser', loader: { '.webp': 'dataurl', '.css': 'empty' }, plugins: [{ name: 'boundaries', setup(b) { b.onResolve({ filter: /\.\/(scene|game|session|audio|armory)\.ts$/ }, a => ({ path: a.path.slice(2), namespace: 'boundary' })); b.onLoad({ filter: /.*/, namespace: 'boundary' }, a => ({ contents: mocks[a.path], loader: 'js' })); } }] });
for (const mode of ['offline', 'online']) for (const failure of ['reject', 'throw', 'event-only']) test(`${mode} pointer-lock ${failure} offers explicit retry without a duplicate session`, async () => {
  const dom = new JSDOM(readFileSync(resolve(root, 'index.html'), 'utf8'), { url: 'https://arena.test/', pretendToBeVisual: true, runScripts: 'outside-only' }), w = dom.window, d = w.document;
  const errors: unknown[] = []; dom.virtualConsole.on('jsdomError', error => errors.push(error));
  const qa = { games: 0, joins: 0, closes: 0, pauses: [] as boolean[], session(online: boolean) { this.joins++; return { online, close: () => { this.closes++; } }; } }; (w as any).__qa = qa;
  w.requestAnimationFrame = () => 1; (w as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  (w as any).fetch = () => { throw new Error('network forbidden'); }; (w as any).WebSocket = class { constructor() { throw new Error('network forbidden'); } };
  w.HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open', ''); }; w.HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  d.exitPointerLock = () => { Object.defineProperty(d, 'pointerLockElement', { configurable: true, value: null }); d.dispatchEvent(new w.Event('pointerlockchange')); };
  w.HTMLCanvasElement.prototype.requestPointerLock = function() { if (failure === 'throw') throw new Error('browser rejected'); d.dispatchEvent(new w.Event('pointerlockerror')); return failure === 'reject' ? Promise.reject(new Error('browser rejected')) : undefined as any; };
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0)); };
  try {
    w.eval((await bundle).outputFiles[0].text); await flush();
    (d.querySelector(`[data-mode="${mode}"]`) as HTMLElement).click(); (d.getElementById('play') as HTMLElement).click(); await flush();
    const controls = (w as any).arena.controls;
    assert.equal(qa.games, 1); assert.equal(qa.joins, 1); assert.equal(controls.locked, false);
    assert.equal(d.getElementById('pause')!.classList.contains('hidden'), false);
    assert.equal(d.getElementById('pointer-lock-note')!.hidden, false);
    assert.match(d.getElementById('pointer-lock-note')!.textContent!, /未锁定鼠标|Mouse capture was not granted/);
    if (mode === 'online') assert.ok(qa.pauses.every(value => !value), 'online authority never pauses'); else assert.equal(qa.pauses.at(-1), true);
    controls.settings.bind('fire', 'KeyK'); d.body.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'KeyK', bubbles: true })); assert.equal(controls.sample().buttons, 0);
    let rejectLate!: (error: Error) => void;
    w.HTMLCanvasElement.prototype.requestPointerLock = () => new Promise<void>((_resolve, reject) => { rejectLate = reject; });
    (d.getElementById('resume') as HTMLElement).click();
    w.HTMLCanvasElement.prototype.requestPointerLock = function() { Object.defineProperty(d, 'pointerLockElement', { configurable: true, value: this }); d.dispatchEvent(new w.Event('pointerlockchange')); return Promise.resolve(); };
    (d.getElementById('resume') as HTMLElement).click(); await flush();
    rejectLate(new Error('obsolete request rejection')); d.dispatchEvent(new w.Event('pointerlockerror')); await flush();
    assert.equal(controls.locked, true); assert.equal(d.getElementById('pause')!.classList.contains('hidden'), true); assert.equal(d.getElementById('pointer-lock-note')!.hidden, true);
    assert.equal(qa.games, 1); assert.equal(qa.joins, 1); assert.equal(qa.pauses.at(-1), false); assert.equal(controls.sample().buttons, 0);
    if (mode === 'offline' && failure === 'reject') {
      d.exitPointerLock();
      let grantLate!: () => void;
      w.HTMLCanvasElement.prototype.requestPointerLock = function() { const canvas = this; return new Promise<void>(resolve => { grantLate = () => { Object.defineProperty(d, 'pointerLockElement', { configurable: true, value: canvas }); d.dispatchEvent(new w.Event('pointerlockchange')); resolve(); }; }); };
      (d.getElementById('resume') as HTMLElement).click();
      (d.getElementById('leave') as HTMLElement).click();
      grantLate(); await flush();
      assert.equal(d.pointerLockElement, null, 'late browser grant after Leave must not capture the lobby');
      assert.equal(d.getElementById('lobby')!.classList.contains('hidden'), false);
    }
    w.dispatchEvent(new w.PageTransitionEvent('pagehide', { persisted: false })); assert.equal(qa.closes, 1); assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});
