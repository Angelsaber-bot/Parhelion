import { describe, expect, it } from 'vitest';
import { ACTIONS, SettingsStore, defaultSettings, sanitizeSettings, validBinding } from '../../shared-client/settings.ts';
function storage() { const values = new Map<string,string>(); return { values, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } }; }
for (const mode of ['arena', 'world'] as const) describe(`${mode} settings`, () => {
  it('round-trips bindings, independent normal/ADS sensitivity and invert Y', () => {
    const disk = storage(), a = new SettingsStore(mode, disk);
    expect(a.action('KeyK')).toBeUndefined();
    expect(a.bind('fire', 'KeyK')).toBeNull(); a.update({ sensitivity: 1.8, adsSensitivity: .4, invertY: true });
    const b = new SettingsStore(mode, disk);
    expect(b.value).toEqual(a.value); expect(b.action('KeyK')).toBe('fire'); expect(b.label('fire')).toBe('K');
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
    const result = sanitizeSettings(mode, raw); expect(result.sensitivity).toBe(1); expect(result.adsSensitivity).toBe(.1); expect(result.bindings.forward).toBe('KeyP'); expect(result.bindings.fire).not.toBe('KeyP'); expect(result.bindings.left).toBe('KeyA');
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

for (const mode of ['arena', 'world'] as const) describe(`${mode} alternate bindings and migration`, () => {
  it('E and RMB are disjunctive ADS aliases, editable independently and persisted', () => {
    const disk = storage(), store = new SettingsStore(mode, disk);
    expect(store.bindingsFor('aim')).toEqual(['KeyE', 'Mouse2']);
    expect(store.isDown(new Set(['KeyE']), 'aim')).toBe(true);
    expect(store.isDown(new Set(['Mouse2']), 'aim')).toBe(true);
    expect(store.bind('aim', 'Mouse4', false, 'secondary')).toBeNull();
    expect(store.bindingsFor('aim')).toEqual(['KeyE', 'Mouse4']);
    expect(new SettingsStore(mode, disk).bindingsFor('aim')).toEqual(['KeyE', 'Mouse4']);
    store.clearSecondary('aim'); expect(store.bindingsFor('aim')).toEqual(['KeyE']);
    expect(store.bind('aim', 'KeyE', false, 'secondary')).toBeNull();
    expect(store.value.bindings.aim).toBe('KeyE'); // cannot remove essential primary by duplicating it
    expect(store.bind('aim', 'WheelDown', false, 'secondary')).toBe('hold');
  });
  it('secondary conflicts never silently steal a primary; swaps remain explicit', () => {
    const store = new SettingsStore(mode, storage());
    expect(store.bind('fire', 'Mouse2', false, 'secondary')).toBe('aim');
    expect(store.bind('fire', 'Mouse2', true, 'secondary')).toBeNull();
    expect(store.bindingsFor('aim')).toEqual(['KeyE']);
    expect(store.bindingsFor('fire')).toEqual(['Mouse0', 'Mouse2']);
    expect(store.bind('forward', 'KeyE', false, 'secondary')).toBe('swapHold');
    expect(store.value.bindings.aim).toBe('KeyE');
  });
  it('migrates v1 defaults and preserves custom controls, sensitivity and the original v1 record', () => {
    const disk = storage();
    const old = { version: 1, sensitivity: 2.3, adsSensitivity: .4, invertY: true,
      bindings: { ...defaultSettings(mode).bindings, aim: 'Mouse2', ...(mode === 'world' ? { interact: 'KeyE', fly: 'KeyF', descend: 'KeyQ' } : {}), forward: 'KeyP' } };
    disk.values.set(`parhelion-input-${mode}-v1`, JSON.stringify(old));
    const store = new SettingsStore(mode, disk);
    expect(store.value.bindings.forward).toBe('KeyP'); expect(store.value.sensitivity).toBe(2.3); expect(store.value.invertY).toBe(true);
    expect(store.bindingsFor('aim')).toEqual(['KeyE', 'Mouse2']);
    expect(store.notices.join(' ')).toMatch(/操作已更新/);
    expect(disk.values.get(`parhelion-input-${mode}-v1`)).toBe(JSON.stringify(old));
    expect(new SettingsStore(mode, disk).value).toEqual(store.value);
    if (mode === 'world') {
      expect(store.value.bindings.interact).toBe('KeyF'); expect(store.value.bindings.fly).toBe('KeyV');
      expect('descend' in store.value.bindings).toBe(false); expect('ascend' in store.value.bindings).toBe(false);
    }
  });
  it('custom E binding wins migration; only conflicting default is repaired and a notice explains it', () => {
    const disk = storage();
    disk.values.set(`parhelion-input-${mode}-v1`, JSON.stringify({ version: 1, bindings: { fire: 'KeyE', aim: 'Mouse2', forward: 'KeyJ', ...(mode === 'world' ? { interact: 'Mouse4', fly: 'KeyF' } : {}) } }));
    const store = new SettingsStore(mode, disk);
    expect(store.value.bindings.fire).toBe('KeyE'); expect(store.value.bindings.forward).toBe('KeyJ');
    expect(store.value.bindings.aim).not.toBe('KeyE'); expect(store.action('Mouse2')).toBe('aim');
    expect(store.notices.join(' ')).toMatch(/按键冲突/);
    if (mode === 'world') expect(store.value.bindings.interact).toBe('Mouse4');
  });
});

for (const slot of ['primary', 'secondary'] as const) it(`old World v3 custom P ${slot} survives the new main-route default and round-trips`, () => {
  const disk = storage(), old = defaultSettings('world');
  // Faithful pre-expansion v3 record: these new actions did not exist yet.
  for (const action of ['travel', 'mainRoute', 'skill', 'ultimate', 'melee', 'evade']) {
    delete old.bindings[action]; delete old.secondaryBindings[action];
  }
  const action = 'sprint'; // Later than mainRoute in the current action list.
  (slot === 'primary' ? old.bindings : old.secondaryBindings)[action] = 'KeyP';
  old.sensitivity = 1.75; old.adsSensitivity = .4; old.invertY = true;
  const raw = JSON.stringify(old);
  disk.values.set('parhelion-input-world-v3', raw);
  const store = new SettingsStore('world', disk);
  expect(store.action('KeyP')).toBe(action);
  expect(store.bindingsFor(action)).toEqual(slot === 'primary' ? ['KeyP', 'ShiftRight'] : ['ShiftLeft', 'KeyP']);
  expect(store.value.bindings.mainRoute).not.toBe('KeyP');
  expect(validBinding(store.value.bindings.mainRoute)).toBe(true);
  expect(store.action(store.value.bindings.mainRoute)).toBe('mainRoute');
  expect(store.notices.join(' ')).toContain('按键冲突');
  expect(store.value.sensitivity).toBe(1.75); expect(store.value.adsSensitivity).toBe(.4); expect(store.value.invertY).toBe(true);
  expect(disk.values.get(store.key)).toBe(raw); // Reading v3 does not overwrite the user's record.
  expect(new SettingsStore('world', disk).value).toEqual(store.value);
  store.update({ sensitivity: 2 }); // A subsequent normal save persists the repaired new default.
  const reloaded = new SettingsStore('world', disk);
  expect(reloaded.value).toEqual(store.value); expect(reloaded.action('KeyP')).toBe(action);
  expect(reloaded.notices).toEqual([]);
});
