import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { WORLD_PROGRESS_KEY, LEGACY_WORLD_PROGRESS_KEYS, INITIAL_SPAWN_ID } from '../src/progress';
import { CONTRACT_STORAGE_KEY } from '../src/contracts';
import { defaultSettings } from '../../shared-client/settings';

const legacyAlpha = JSON.stringify({ done: ['hq_terminal', 'armory_rack', 'summon_circle'], found: ['travel_alpha'] });
const legacyCoast = JSON.stringify({ done: ['blackbeard_contract', 'blacksail_harbor_signal'], found: ['travel_blacksail'] });
const controls = defaultSettings('world'); controls.sensitivity = 1.8; controls.invertY = true; controls.bindings.forward = 'ArrowUp';
const preferences = {
  'parhelion-input-world-v3': JSON.stringify(controls),
  'parhelion-language-v1': 'en',
  'parhelion-world-audio-v1': JSON.stringify({ volume: .2, muted: true }),
  'parhelion-world-resolution-v1': 'crisp',
};

test('NON-GPU actual legacy startup migrates once; confirmed new game remains empty across a real second boot with stale legacy slots', async () => {
  const first = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    ...preferences, [LEGACY_WORLD_PROGRESS_KEYS[0]]: legacyAlpha, [LEGACY_WORLD_PROGRESS_KEYS[1]]: legacyCoast,
    [CONTRACT_STORAGE_KEY]: JSON.stringify({ version: 1, servant: 'blackbeard', summoned: true }),
  } });
  let resetStorage: Record<string, string> = {};
  try {
    const { world, window } = first, document = window.document;
    for (const flag of ['armory_rack', 'summon_circle', 'blackbeard_contract', 'blacksail_harbor_signal']) assert.equal(world.done.has(flag), true, flag);
    assert.equal(world.found.has('travel_alpha'), true); assert.equal(world.found.has('travel_blacksail'), true);
    assert.equal(world.rig.joints.Gun.visible, true); assert.deepEqual([...world.contract.roster], ['blackbeard']);
    assert.equal(world.contract.selected, 'blackbeard'); assert.equal(world.contract.companionSummoned, true);
    assert.equal(world.combat.state.isCleared('boss_drowned_admiral'), true, 'legacy post-core contract is authoritative in actual combat constructor');
    assert.equal(world.done.has('sea_core'), false, 'compatibility does not fabricate absent quest flags');
    assert.equal(world.settings.action('ArrowUp'), 'forward'); assert.equal(world.audio.muted, true);
    assert.equal(document.documentElement.lang, 'en');
    assert.ok(window.localStorage.getItem(WORLD_PROGRESS_KEY));
    for (const key of LEGACY_WORLD_PROGRESS_KEYS) assert.equal(window.localStorage.getItem(key), null);
    const migrated = window.localStorage.getItem(WORLD_PROGRESS_KEY);
    const enter = async () => { (document.getElementById('start') as HTMLElement).click(); await Promise.resolve(); };
    const reset = () => { document.body.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyR', key: 'r', bubbles: true, cancelable: true })); document.body.dispatchEvent(new window.KeyboardEvent('keyup', { code: 'KeyR', bubbles: true })); };
    await enter(); window.confirm = () => false; reset();
    assert.equal(window.localStorage.getItem(WORLD_PROGRESS_KEY), migrated);
    assert.equal(world.contract.companionSummoned, true);
    await enter(); window.confirm = () => true; reset();
    assert.equal(world.done.size, 0); assert.equal(world.found.size, 0); assert.equal(world.rig.joints.Gun.visible, false);
    assert.equal(world.contract.roster.length, 0); assert.equal(world.contract.companionSummoned, false);
    for (const [key, value] of Object.entries(preferences)) assert.equal(window.localStorage.getItem(key), value, key);
    resetStorage = Object.fromEntries(Array.from({ length: window.localStorage.length }, (_, i) => { const key = window.localStorage.key(i)!; return [key, window.localStorage.getItem(key)!]; }));
    assert.equal(first.errors.length, 0, JSON.stringify(first.errors));
  } finally { await first.close(); }

  // Simulate an older tab restoring stale slots/preferences after the accepted reset.
  const second = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    ...resetStorage, [LEGACY_WORLD_PROGRESS_KEYS[0]]: legacyAlpha, [LEGACY_WORLD_PROGRESS_KEYS[1]]: legacyCoast,
    [CONTRACT_STORAGE_KEY]: JSON.stringify({ version: 1, servant: 'blackbeard', summoned: true }),
  } });
  try {
    const { world, window } = second;
    assert.equal(world.done.size, 0); assert.equal(world.found.size, 0);
    assert.equal(world.rig.joints.Gun.visible, false); assert.equal(world.contract.roster.length, 0); assert.equal(world.contract.companionSummoned, false);
    assert.equal(world.combat.state.isCleared('boss_drowned_admiral'), false);
    const spawn = world.layout.markers.find((marker: any) => marker.id === INITIAL_SPAWN_ID);
    assert.deepEqual(world.player.pos.toArray(), [spawn.p[0], spawn.p[1] + 1, spawn.p[2]]);
    assert.deepEqual(JSON.parse(window.localStorage.getItem(WORLD_PROGRESS_KEY)!), { done: [], found: [] });
    assert.equal(world.settings.action('ArrowUp'), 'forward'); assert.equal(world.audio.muted, true);
    for (const [key, value] of Object.entries(preferences)) assert.equal(window.localStorage.getItem(key), value, key);
    assert.equal(second.errors.length, 0, JSON.stringify(second.errors));
  } finally { await second.close(); }
});
