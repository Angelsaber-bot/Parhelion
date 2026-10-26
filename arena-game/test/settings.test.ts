import { describe, expect, it } from 'vitest';
import { ACTIONS, SettingsStore, defaultSettings, sanitizeSettings, validBinding } from '../../shared-client/settings.ts';
function storage() { const values = new Map<string,string>(); return { values, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } }; }
for (const mode of ['arena', 'world'] as const) describe(`${mode} settings`, () => {
  it('round-trips bindings, independent normal/ADS sensitivity and invert Y', () => {
    const disk = storage(), a = new SettingsStore(mode, disk);
    expect(a.bind('fire', 'KeyP')).toBeNull(); a.update({ sensitivity: 1.8, adsSensitivity: .4, invertY: true });
    const b = new SettingsStore(mode, disk);
    expect(b.value).toEqual(a.value); expect(b.action('KeyP')).toBe('fire'); expect(b.label('fire')).toBe('P');
  });
  it('conflicts require an explicit swap; reserved keys cannot steal Escape/system shortcuts', () => {
    const store = new SettingsStore(mode, storage()), before = structuredClone(store.value);
    expect(store.bind('fire', 'KeyW')).toBe('forward'); expect(store.value).toEqual(before);
    expect(store.bind('fire', 'KeyW', true)).toBeNull(); expect(store.value.bindings.forward).toBe('Mouse0');
    for (const key of ['Escape','MetaLeft','ControlLeft','AltLeft','F5','Delete','Enter']) expect(store.bind('fire', key)).toBe('reserved');
    expect(store.bind('aim', 'WheelUp')).toBe('hold');
    expect(new Set(Object.values(store.value.bindings)).size).toBe(ACTIONS[mode].length);
  });
  it('corrupt JSON, unsupported versions, duplicate bindings and invalid numbers recover safely', () => {
    const disk = storage(); disk.values.set(`parhelion-input-${mode}-v1`, '{broken');
    expect(new SettingsStore(mode, disk).value).toEqual(defaultSettings(mode));
    const raw = { ...defaultSettings(mode), sensitivity: Infinity, adsSensitivity: -3, bindings: { forward: 'KeyP', fire: 'KeyP' } };
    const result = sanitizeSettings(mode, raw); expect(result.sensitivity).toBe(1); expect(result.adsSensitivity).toBe(.1); expect(result.bindings).toEqual(defaultSettings(mode).bindings);
    expect(sanitizeSettings(mode, { version: 999 }).bindings).toEqual(defaultSettings(mode).bindings);
    expect(sanitizeSettings(mode, { ...defaultSettings(mode), sensitivity: 100, adsSensitivity: 50 }).sensitivity).toBe(4);
  });
  it('reset persists defaults and subscriptions clear consumers; storage failure keeps session usable', () => {
    const disk = storage(), store = new SettingsStore(mode, disk); let changed = 0; store.subscribe(() => changed++);
    store.update({ sensitivity: 2 }); store.reset(); expect(changed).toBe(2); expect(new SettingsStore(mode, disk).value).toEqual(defaultSettings(mode));
    const blocked = new SettingsStore(mode, { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
    blocked.update({ sensitivity: 1.2 }); expect(blocked.value.sensitivity).toBe(1.2); expect(blocked.saved).toBe(false);
  });
});
it('each mode has a separate persisted namespace', () => {
  const disk = storage(), a = new SettingsStore('arena', disk), w = new SettingsStore('world', disk);
  a.update({ sensitivity: 3 }); expect(w.value.sensitivity).toBe(1); expect(a.key).not.toBe(w.key);
});

it('swap cannot move a wheel binding onto a held movement or aim action', () => {
  const store = new SettingsStore('arena', storage()), before = structuredClone(store.value);
  expect(store.bind('nextWeapon', 'KeyW')).toBe('swapHold');
  expect(store.bind('nextWeapon', 'KeyW', true)).toBe('swapHold');
  expect(store.value).toEqual(before);
  expect(store.bind('forward', 'KeyP')).toBeNull();
  expect(store.bind('nextWeapon', 'KeyW')).toBeNull();
});
