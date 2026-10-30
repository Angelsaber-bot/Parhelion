import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controls } from '../src/controls.ts';
import { ResultsBoard, syncResultsBoardLayers } from '../src/resultsBoard.ts';
import { readFileSync } from 'node:fs';
import { SettingsStore, defaultSettings } from '../../shared-client/settings.ts';
import { BTN } from '../shared/sim.ts';
import { meleeMotion, meleeRecoverySeconds } from '../src/meleeArt.ts';
import { WEAPONS } from '../shared/content.ts';
import { displayWeaponName } from '../src/loadout.ts';
import { setLanguage } from '../../shared-client/i18n.ts';
function storage() { const values = new Map<string,string>(); return { values, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k,v); } }; }
afterEach(() => { vi.unstubAllGlobals(); setLanguage('zh'); });
for (const mode of ['arena', 'world'] as const) describe(`${mode} both Shift aliases`, () => {
  const action = mode === 'arena' ? 'dash' : 'sprint';
  it('holds while either Shift is down; release order cannot cancel the other', () => {
    const store = new SettingsStore(mode, storage()), keys = new Set<string>();
    expect(store.bindingsFor(action)).toEqual(['ShiftLeft','ShiftRight']);
    for (const first of ['ShiftLeft','ShiftRight']) {
      const second = first === 'ShiftLeft' ? 'ShiftRight' : 'ShiftLeft';
      keys.add(first); expect(store.isDown(keys, action)).toBe(true);
      keys.add(second); keys.delete(first); expect(store.isDown(keys, action)).toBe(true);
      keys.delete(second); expect(store.isDown(keys, action)).toBe(false);
    }
  });
  it('migrates unchanged v2 defaults once and preserves sensitivity plus the old record', () => {
    const disk = storage(), defaults = defaultSettings(mode);
    const old = { ...defaults, version: 2, sensitivity: 1.75, secondaryBindings: { ...defaults.secondaryBindings, [action]: '' } };
    const raw = JSON.stringify(old); disk.values.set(`parhelion-input-${mode}-v2`, raw);
    const store = new SettingsStore(mode, disk);
    expect(store.bindingsFor(action)).toEqual(['ShiftLeft','ShiftRight']); expect(store.value.sensitivity).toBe(1.75);
    expect(disk.values.get(`parhelion-input-${mode}-v2`)).toBe(raw); expect(store.value.version).toBe(3);
    store.clearSecondary(action); expect(new SettingsStore(mode, disk).bindingsFor(action)).toEqual(['ShiftLeft']);
  });
  it('preserves custom sprint and existing right-Shift assignments with an explicit conflict notice', () => {
    const disk = storage(), defaults = defaultSettings(mode);
    disk.values.set(`parhelion-input-${mode}-v2`, JSON.stringify({ ...defaults, version: 2, bindings: { ...defaults.bindings, fire: 'ShiftRight' }, secondaryBindings: { ...defaults.secondaryBindings, [action]: '' } }));
    const store = new SettingsStore(mode, disk);
    expect(store.action('ShiftRight')).toBe('fire'); expect(store.bindingsFor(action)).toEqual(['ShiftLeft']); expect(store.notices.join(' ')).toContain('按键冲突');
    disk.values.delete(store.key);
    disk.values.set(`parhelion-input-${mode}-v2`, JSON.stringify({ ...defaults, version: 2, bindings: { ...defaults.bindings, [action]: 'KeyK' }, secondaryBindings: { ...defaults.secondaryBindings, [action]: '' } }));
    expect(new SettingsStore(mode, disk).bindingsFor(action)).toEqual(['KeyK']);
  });
  it('right Shift is a real rebindable secondary slot and cannot be silently stolen', () => {
    const store = new SettingsStore(mode, storage());
    expect(store.bind('fire', 'ShiftRight')).toBe(action);
    expect(store.bind('fire', 'ShiftRight', true)).toBeNull();
    expect(store.action('ShiftRight')).toBe('fire'); expect(store.bindingsFor(action)).toEqual(['ShiftLeft','Mouse0']);
  });
});
it('real Controls samples both Shift keys and preserves S backward plus hold-Tab in live play', () => {
  const listeners = new Map<string, ((event: Record<string, unknown>) => void)[]>();
  const add = (type: string, fn: (event: Record<string, unknown>) => void) => listeners.set(type, [...listeners.get(type) ?? [], fn]);
  const doc = { addEventListener: add, pointerLockElement: null };
  vi.stubGlobal('addEventListener', add); vi.stubGlobal('document', doc);
  const canvas = { addEventListener: add } as unknown as HTMLCanvasElement;
  const controls = new Controls(canvas, new SettingsStore('arena', storage())); controls.force = true;
  const fire = (type: string, code: string) => listeners.get(type)?.forEach((fn) => fn({ code, repeat: false, preventDefault() {} }));
  fire('keydown', 'ShiftLeft'); expect(controls.sample().buttons & BTN.DASH).toBe(BTN.DASH);
  fire('keydown', 'ShiftRight'); fire('keyup', 'ShiftLeft'); expect(controls.sample().buttons & BTN.DASH).toBe(BTN.DASH);
  fire('keyup', 'ShiftRight'); expect(controls.sample().buttons & BTN.DASH).toBe(0);
  fire('keydown', 'KeyS'); expect(controls.sample().mz).toBe(-1); expect(controls.scoreboard).toBe(false);
  fire('keydown', 'Tab'); expect(controls.scoreboard).toBe(true); fire('keyup', 'Tab'); expect(controls.scoreboard).toBe(false);
  fire('blur', ''); expect(controls.sample()).toEqual({ mx: 0, mz: 0, buttons: 0 });
});
it('S toggles only ended results, ignores edits/repeats/modifiers, and resets after every new round', () => {
  const board = new ResultsBoard(); expect(board.key('KeyS')).toBe(false);
  board.setEnded(true); expect(board.open).toBe(false);
  expect(board.key('KeyS')).toBe(true); expect(board.open).toBe(true);
  for (const args of [[true,false,false],[false,true,false],[false,false,true]]) expect(board.key('KeyS', ...args as [boolean,boolean,boolean])).toBe(false);
  expect(board.open).toBe(true); expect(board.key('Escape')).toBe(true); expect(board.open).toBe(false);
  board.key('KeyS'); board.key('KeyS'); expect(board.open).toBe(false);
  board.toggle(); board.setEnded(false); expect(board.open).toBe(false); expect(board.key('KeyS')).toBe(false);
});
it('plain weapon names localize without changing stable IDs, stats or skin catalog', () => {
  const before = structuredClone(WEAPONS);
  expect(WEAPONS.map((w) => displayWeaponName(w.id))).toEqual(['突击步枪 AR','霰弹枪','精确射手步枪 DMR','冲锋枪 SMG','狙击步枪','单手剑','长枪','战锤']);
  setLanguage('en'); expect(WEAPONS.map((w) => displayWeaponName(w.id))).toEqual(['Assault Rifle AR','Shotgun','Marksman Rifle DMR','Submachine Gun SMG','Sniper Rifle','Sword','Spear','War Hammer']);
  expect(displayWeaponName('unknown')).toBe('Unknown weapon'); expect(WEAPONS).toEqual(before);
});
for (const weapon of [5,6,7]) it(`melee ${weapon} prepares, reaches continuous impact and returns exactly to idle over its unchanged recovery`, () => {
  const idle = meleeMotion(weapon, 0, 0, true), prep = meleeMotion(weapon, .6, 0, true);
  expect(prep).not.toEqual(idle);
  const end = meleeMotion(weapon, 1, 0, true), impact = meleeMotion(weapon, 0, 1, true);
  for (const field of ['position','rotation'] as const) end[field].forEach((v, i) => expect(v).toBeCloseTo(impact[field][i], 12));
  expect(meleeMotion(weapon,0,0,true)).toEqual(idle);
  expect(meleeRecoverySeconds(weapon)).toBe((WEAPONS[weapon].interval - WEAPONS[weapon].windup!) / 60);
  for (let i = 0; i <= 100; i++) for (const first of [true,false]) {
    const sample = meleeMotion(weapon, i / 100, 0, first), recovery = meleeMotion(weapon, 0, i / 100, first);
    expect([...sample.position, ...sample.rotation, ...recovery.position, ...recovery.rotation].every(Number.isFinite)).toBe(true);
  }
});

it('game rejects stale/duplicate end snapshots, clears round UI once and coalesces repeat rematch clicks', async () => {
  const { Game } = await import('../src/game.ts');
  const { getMap } = await import('../shared/arenaMap.ts');
  const { Match } = await import('../shared/match.ts');
  const match = new Match(getMap('aster'), '1v1');
  match.addPlayer('a', { name: 'A', team: 'A', char: 0, skins: [], bot: false });
  match.addPlayer('b', { name: 'B', team: 'B', char: 1, skins: [], bot: false });
  const session = { id: 'a', map: match.map, online: false, onSnapshot: (_s: import('../shared/match.ts').Snapshot) => {}, onClose: () => {}, close: vi.fn(), rematch: vi.fn(), send: vi.fn(), setPaused: vi.fn() };
  const controls = { yaw: 0, pitch: 0, clearAll: vi.fn(), clearAim: vi.fn(), weapon: 2, resultsScoreboard: true };
  const scene = { viewmodel: { aim: 0, clear: vi.fn() }, camera: { fov: 78, updateProjectionMatrix: vi.fn() }, pruneAvatars: vi.fn(), clearCombatEffects: vi.fn() };
  const hud = { announce: vi.fn(), resetRound: vi.fn(), aim: vi.fn() };
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {});
  const game = new Game(session, scene as never, controls as never, hud as never, () => {});
  const restart = vi.fn(), ended = vi.fn(); game.onRestart = restart; game.onEnded = ended;
  expect(hud.resetRound).toHaveBeenCalledTimes(1); // fresh session clears reused HUD before any snapshot
  expect(controls.resultsScoreboard).toBe(false);
  try {
    match.phase = 'ended'; match.score = { A: 7, B: 3 }; match.tick = 10;
    const result = match.snapshot(); session.onSnapshot(result);
    expect(game.ended).toBe(true); expect(ended).toHaveBeenCalledTimes(1);
    game.rematch(); game.rematch(); expect(session.rematch).toHaveBeenCalledTimes(1);
    match.rematch(); match.tick = 11; const fresh = match.snapshot(); session.onSnapshot(fresh);
    expect(game.ended).toBe(false); expect(restart).toHaveBeenCalledTimes(1); expect(hud.resetRound).toHaveBeenCalledTimes(2);
    expect(controls.weapon).toBe(0); expect(controls.resultsScoreboard).toBe(false);
    session.onSnapshot(result); session.onSnapshot(fresh);
    expect(game.ended).toBe(false); expect(ended).toHaveBeenCalledTimes(1); expect(restart).toHaveBeenCalledTimes(1);
    game.rematch(); expect(session.rematch).toHaveBeenCalledTimes(1);
    const oldCallback = session.onSnapshot;
    game.stop(); oldCallback({ ...result, tick: 99 }); expect(ended).toHaveBeenCalledTimes(1);
    const freshGame = new Game(session, scene as never, controls as never, hud as never, () => {});
    expect(hud.resetRound).toHaveBeenCalledTimes(3); expect(freshGame.ended).toBe(false);
    oldCallback({ ...result, tick: 100 }); expect(freshGame.ended).toBe(false);
    freshGame.stop();
  } finally { game.stop(); }
});


it('results raise the HUD stacking context above the end overlay, restore normal layering on close and keep mouse access', () => {
  const makeNode = () => {
    const classes = new Set<string>();
    return { classes, classList: { toggle(name: string, on?: boolean) { if (on) classes.add(name); else classes.delete(name); return !!on; } } };
  };
  const hud = makeNode(), endCard = makeNode(), board = new ResultsBoard();
  const sync = () => syncResultsBoardLayers(board.open, hud as unknown as HTMLElement, endCard as unknown as HTMLElement);
  board.setEnded(true); board.key('KeyS'); sync();
  expect(hud.classes.has('viewing-scores')).toBe(true); expect(endCard.classes.has('viewing-scores')).toBe(true);
  board.close(); sync(); // mouse-close uses the same state transition
  expect(hud.classes.has('viewing-scores')).toBe(false); expect(endCard.classes.has('viewing-scores')).toBe(false);
  board.key('KeyS'); sync(); board.key('Escape'); sync(); expect(hud.classes.has('viewing-scores')).toBe(false);
  board.key('KeyS'); sync(); board.setEnded(false); sync(); expect(hud.classes.has('viewing-scores')).toBe(false);
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const declaration = (selector: string) => css.slice(css.indexOf(selector + ' {')).split('}')[0];
  const z = (selector: string) => Number(declaration(selector).match(/z-index:\s*(\d+)/)?.[1]);
  expect(z('#hud')).toBeLessThan(z('.overlay'));
  expect(z('#hud.viewing-scores')).toBeGreaterThan(z('.overlay'));
  expect(declaration('#scoreboard.results')).toMatch(/pointer-events:\s*auto/);
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  expect(main).toContain("syncResultsBoardLayers(resultsBoard.open, $('hud'), $('endcard'))");
  expect(main).toContain("closest('[data-close-scores]')");
});
