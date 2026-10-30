import { WorldAudio } from '../src/worldAudio';
import * as campaignClosure from '../src/campaignClosure';
import {FortCannon, FORT_CANNON} from '../src/fortCannon.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { WorldProgress, WORLD_PROGRESS_KEY, LEGACY_WORLD_PROGRESS_KEYS, ARMORY_MARKER, INITIAL_SPAWN_ID, clearStartOverrides, type ProgressStorage } from '../src/progress.ts';
import { FirstContract, CONTRACT_STORAGE_KEY, servantByContract } from '../src/contracts.ts';
import { Player } from '../src/player.ts';
import { VALLEY_STORY } from '../src/valleyStory.ts';
import * as eraStory from '../src/eraStories.ts';
import { WorldCombatState, COMBAT } from '../src/combat.ts';
import { KitCompanion } from '../src/kitCompanion.ts';
import { ShoulderAim } from '../src/aim.ts';
import { SettingsStore } from '../../shared-client/settings.ts';
import { LANGUAGE_KEY, readLanguage } from '../../shared-client/i18n.ts';
import { SERVANT_APPEARANCE_KEY, ServantAppearance } from '../src/servantAppearance.ts';
import { SkinnedCharacterAnimator, buildSkinnedCharacter } from '../src/skinnedCharacter.ts';
import { attachExplorerRifle } from '../src/weaponArt.ts';
import { playerFixture, parseLocalGlb } from './player-fixture.ts';
import type { Layout } from '../src/types.ts';

class MemoryStorage implements ProgressStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const snapshot = (done: unknown = [], found: unknown = []) => JSON.stringify({ done, found });
const alpha: Layout = JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json', import.meta.url), 'utf8'));
const markers = new Map(alpha.markers.map(m => [m.id, m]));
const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const startup = source.slice(source.indexOf('const player = new Player'), source.indexOf('// explorer character'));
const reset = source.slice(source.indexOf('function resetProgress()'), source.indexOf('const keys ='));
const interaction = source.slice(source.indexOf('function interact()'), source.indexOf('function checkDiscoveries()'));
function run(context: vm.Context, code: string) { vm.runInContext(transformSync(code, { loader: 'ts', format: 'cjs' }).code, context); }

test('clean startup is unarmed at authored Alpha spawn; no gameplay method writes preferences', () => {
  const storage = new MemoryStorage(), progress = new WorldProgress(storage);
  assert.equal(progress.equippedWeapon, null); assert.equal(progress.armed, false);
  assert.equal(progress.done.size, 0); assert.equal(progress.found.size, 0); assert.equal(storage.values.size, 0);
  const c = vm.createContext({narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false, FORT_CANNON, fortCannon: new FortCannon(), actions: undefined, hudRevision: 0, Player, THREE, colliders: [], layout: alpha, markers, INITIAL_SPAWN_ID, startRegion: 'alpha', params: new URLSearchParams() });
  run(c, startup + '\nglobalThis.start = { player, initialSpawn };');
  const spawn = markers.get(INITIAL_SPAWN_ID)!;
  assert.equal(c.start.initialSpawn, spawn);
  assert.deepEqual(c.start.player.pos.toArray(), [spawn.p[0], spawn.p[1] + 1, spawn.p[2]]);
  assert.equal(c.start.player.yaw, 0); assert.equal(c.start.player.pitch, 0); assert.equal(c.start.player.flying, false);
});

test('current save is authoritative, reset survives reload without old quests/equipment/contracts reappearing', () => {
  const storage = new MemoryStorage();
  storage.setItem(WORLD_PROGRESS_KEY, JSON.stringify({ done: [ARMORY_MARKER, 'saber_contract', 'sun_core'], found: ['secret_cave'], equippedWeapon: 'dawn_ar', selectedWeapon: 'dawn_ar', position: [900, 4, 30] }));
  for (const key of LEGACY_WORLD_PROGRESS_KEYS) storage.setItem(key, snapshot([ARMORY_MARKER, 'relay_a', 'tower_console'], ['old_secret']));
  storage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify({ version: 1, servant: 'saber', summoned: true }));
  const progress = new WorldProgress(storage), contract = new FirstContract(progress.done, storage);
  assert.equal(progress.armed, true); assert.equal(progress.equippedWeapon, 'dawn_ar'); assert.equal(contract.summoned, true);
  assert.equal(progress.done.has('relay_a'), false, 'v1 must not merge into an existing v2 snapshot');
  const doneIdentity = progress.done, foundIdentity = progress.found;
  assert.equal(progress.reset(), true); contract.reset();
  assert.equal(progress.done, doneIdentity); assert.equal(progress.found, foundIdentity, 'live consumers keep the same cleared sets');
  assert.equal(progress.equippedWeapon, null); assert.equal(contract.selected, null); assert.equal(contract.companionSummoned, false);
  for (const key of LEGACY_WORLD_PROGRESS_KEYS) assert.equal(storage.getItem(key), null);
  const reloaded = new WorldProgress(storage), reloadedContract = new FirstContract(reloaded.done, storage);
  assert.equal(reloaded.done.size, 0); assert.equal(reloaded.found.size, 0); assert.equal(reloaded.armed, false);
  assert.equal(reloadedContract.selected, null); assert.equal(reloadedContract.anyRecruited, false);
  assert.deepEqual(JSON.parse(storage.getItem(WORLD_PROGRESS_KEY)!), { done: [], found: [] });
});

test('legacy migration occurs only once; empty current and stale slot fields never grant a gun', () => {
  const storage = new MemoryStorage();
  storage.setItem(LEGACY_WORLD_PROGRESS_KEYS[0], snapshot([ARMORY_MARKER], ['secret_cave']));
  storage.setItem(LEGACY_WORLD_PROGRESS_KEYS[1], snapshot(['relay_b']));
  const migrated = new WorldProgress(storage);
  assert.equal(migrated.armed, true); assert.equal(migrated.done.has('relay_b'), true);
  assert.ok(storage.getItem(WORLD_PROGRESS_KEY));
  // Simulate an adapter without removeItem, or an old client writing v1 again after reset.
  migrated.reset(); storage.setItem(LEGACY_WORLD_PROGRESS_KEYS[0], snapshot([ARMORY_MARKER]));
  assert.equal(new WorldProgress(storage).armed, false);
  storage.setItem(WORLD_PROGRESS_KEY, JSON.stringify({ done: [], found: [], selectedWeapon: 'dawn_ar', equippedWeapon: 'dawn_ar' }));
  assert.equal(new WorldProgress(storage).equippedWeapon, null);
  storage.setItem(WORLD_PROGRESS_KEY, '{broken'); assert.equal(new WorldProgress(storage).armed, false);
  storage.setItem(WORLD_PROGRESS_KEY, snapshot([ARMORY_MARKER, 4, null], 'not-an-array'));
  const guarded = new WorldProgress(storage); assert.equal(guarded.done.size, 1); assert.equal(guarded.found.size, 0);
});

test('reset preserves custom controls, sensitivity, locale, graphics, HUD and appearance preferences byte-for-byte', () => {
  const storage = new MemoryStorage(), settings = new SettingsStore('world', storage);
  assert.equal(settings.bind('fire', 'Mouse4'), null);
  settings.update({ sensitivity: 1.7, adsSensitivity: .9, invertY: true });
  for (const [key, value] of [[LANGUAGE_KEY, 'en'], ['parhelion-world-resolution-v1', 'crisp'], ['parhelion.guide', 'off'], ['parhelion.world.hide.help', '1'], [SERVANT_APPEARANCE_KEY, JSON.stringify({ version: 1, outfit: 'civilian' })], ['unrelated.app', 'keep']]) storage.setItem(key, value);
  const preferences = new Map(storage.values);
  const progress = new WorldProgress(storage); progress.done.add(ARMORY_MARKER); progress.save();
  const beforeNoAction = new Map(storage.values); new WorldProgress(storage);
  assert.deepEqual(storage.values, beforeNoAction, 'opening/reloading without reset must not change a current save');
  progress.reset(); new FirstContract(progress.done, storage).reset();
  for (const [key, value] of preferences) assert.equal(storage.getItem(key), value, key);
  const reloadedSettings = new SettingsStore('world', storage);
  assert.equal(reloadedSettings.action('Mouse4'), 'fire'); assert.equal(reloadedSettings.value.sensitivity, 1.7);
  assert.equal(reloadedSettings.value.adsSensitivity, .9); assert.equal(reloadedSettings.value.invertY, true);
  assert.equal(readLanguage(storage), 'en');
  assert.equal(new ServantAppearance(storage).outfit, 'civilian');
});

test('unavailable persistence still resets live state without deleting unrelated storage', () => {
  const storage = new MemoryStorage(); storage.setItem(WORLD_PROGRESS_KEY, snapshot([ARMORY_MARKER]));
  const progress = new WorldProgress({ getItem: key => storage.getItem(key), setItem() { throw new Error('quota/security'); }, removeItem() { assert.fail('must not delete legacy before replacement is saved'); } });
  assert.equal(progress.reset(), false); assert.equal(progress.armed, false); assert.equal(progress.done.size, 0);
  assert.equal(new WorldProgress().reset(), false);
});

test('production reset clears dirty gameplay immediately, resets URL start overrides, and survives reload at Alpha', async () => {
  const fixture = await playerFixture(), { rig } = fixture, anim = new SkinnedCharacterAnimator(rig);
  const storage = new MemoryStorage(), worldProgress = new WorldProgress(storage);
  for (const id of [ARMORY_MARKER, 'saber_contract', 'napoleon_contract', 'tower_console', 'winter_core']) worldProgress.done.add(id);
  worldProgress.found.add('secret_cave'); worldProgress.save();
  const contract = new FirstContract(worldProgress.done, storage); contract.select('napoleon');
  const combatState = new WorldCombatState([{ id: 'wild', kind: 'wisp', p: { x: 0, y: 0, z: 0 } }], [{ id: 'boss', kind: 'king', p: { x: 0, y: 0, z: 0 }, requires: [] }]);
  combatState.beginBoss(new Set()); combatState.hp = 3; combatState.shotCooldown = 2; combatState.quietFor = 8;
  let strikes = 0;
  const follow = new KitCompanion({ colliders: [], range: 4, damage: 10, target: () => null, strike: () => { strikes++; return null; } });
  const actor = { root: new THREE.Group(), state: 'attack', definition: { defaultState: 'idle' }, play(state: string) { this.state = state; } };
  (follow as any).attackTarget = 'wild'; (follow as any).activeLast = true;
  const marker = markers.get('hq_terminal')!;
  const keys = new Set(['Mouse0', 'Mouse2', 'KeyW', 'Space']), aim = new ShoulderAim(); aim.held = true; aim.value = 1;
  const params = new URLSearchParams('region=kyoto&spawn=station&cam=2,3,4&lit&q=low&fov=82&clean');
  const location = { href: `https://example.test/world/?${params}#keep-me` };
  let historyWrites = 0, servantCanceled = false;
  const elements = new Map<string, any>();
  const $ = (id: string) => { if (!elements.has(id)) elements.set(id, { textContent: 'stale', classList: { remove() {} } }); return elements.get(id); };
  const c = vm.createContext({narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false, FORT_CANNON, fortCannon: new FortCannon(), actions: undefined, hudRevision: 0, Player, THREE, URL, clearStartOverrides, colliders: [], layout: alpha, markers: new Map([...markers, ['kyoto_spawn_p1', { ...marker, p: [30, 8, 930] }]]), INITIAL_SPAWN_ID, startRegion: 'kyoto', params: new URLSearchParams(),
    worldProgress, contract, combat: { reset: () => combatState.resetAll(false) }, rig, anim,
    prevPos: new THREE.Vector3(900, 30, 30), inspectServant: true, thirdPerson: false,
    servant: { update(dt: number, p: THREE.Vector3, yaw: number, enabled: boolean, paused: boolean) { servantCanceled = dt === 0 && !enabled && paused; } },
    eraActors: [{ markerId: marker.id, follow, actor }], cold: { warmth: 0, frozen: true, warned: true }, coldHud: { hidden: false }, frost: { style: { opacity: '1' } },
    acc: .08, camDist: 1.5, currentArea: 'moscow', lastRegion: 'winter', camera: new THREE.PerspectiveCamera(50), baseFov: 82,
    location, history: { state: { preserved: true }, replaceState(state: any, unused: string, url: string) { assert.equal(state.preserved, true); historyWrites++; location.href = url; } },
    clearInput() { keys.clear(); aim.clear(); }, $, applyWorldState() {}, renderContract() {}, toast() {}, bilingual: (zh: string) => zh,
  });
  run(c, startup + reset + '\nglobalThis.runtime = { player, resetProgress, spawnAt, get spawn(){return spawn} };');
  const p: Player = c.runtime.player;
  assert.deepEqual(p.pos.toArray(), [30, 9, 930], 'fresh intentional chapter debug start still works');
  c.params = params;
  p.flying = true; p.pitch = 1.2; p.yaw = 2.4; p.pos.set(40, 50, -800); p.vel.set(3, -7, 5);
  p.gliding = true; p.inUpdraft = true; p.swimming = true; (p as any).jumpHeld = true;
  for (let i = 0; i < 120; i++) anim.update(1 / 60, { speed: 8, onGround: false, swimming: false, gliding: true, vy: -2, moveYaw: 2.4, aim: 1, firing: true });
  c.runtime.resetProgress();
  const initial = markers.get(INITIAL_SPAWN_ID)!;
  assert.deepEqual(p.pos.toArray(), [initial.p[0], initial.p[1] + 1, initial.p[2]]); assert.deepEqual(p.vel.toArray(), [0, 0, 0]);
  assert.equal(p.yaw, 0); assert.equal(p.pitch, 0); assert.equal(p.flying, false); assert.equal(p.gliding, false); assert.equal(p.inUpdraft, false); assert.equal((p as any).jumpHeld, false);
  assert.equal(rig.joints.Gun.visible, false); assert.equal(rig.glider.root.visible, false); assert.equal(rig.root.visible, true);
  assert.equal(keys.size, 0); assert.equal(aim.held, false);
  assert.equal(aim.value, 0);
  assert.equal(worldProgress.armed, false); assert.equal(worldProgress.done.size, 0); assert.equal(worldProgress.found.size, 0);
  assert.equal(contract.selected, null); assert.equal(contract.companionSummoned, false); assert.equal(servantCanceled, true);
  assert.equal(actor.state, 'idle'); assert.equal(actor.root.visible, false); assert.deepEqual(actor.root.position.toArray(), marker.p);
  follow.onEvent(actor as any, { state: 'attack', kind: 'hit' } as any); assert.equal(strikes, 0, 'pending companion hit cannot survive reset');
  assert.equal(combatState.hp, COMBAT.playerHp); assert.equal(combatState.bossStarted, false); assert.equal(combatState.quietFor, 0); assert.equal(combatState.shotCooldown, 0);
  assert.equal(c.cold.warmth, 100); assert.equal(c.cold.frozen, false); assert.equal(c.coldHud.hidden, true); assert.equal(c.frost.style.opacity, '0');
  assert.equal(c.inspectServant, false); assert.equal(c.thirdPerson, true); assert.equal(c.camera.fov, 82); assert.equal(c.acc, 0); assert.equal(c.camDist, 3.6);
  assert.equal(historyWrites, 1);
  const url = new URL(location.href);
  for (const key of ['region', 'spawn', 'cam', 'lit']) assert.equal(url.searchParams.has(key), false);
  assert.equal(url.searchParams.get('q'), 'low'); assert.equal(url.searchParams.get('fov'), '82'); assert.equal(url.searchParams.has('clean'), true); assert.equal(url.hash, '#keep-me');
  const reload = vm.createContext({narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false, FORT_CANNON, fortCannon: new FortCannon(), actions: undefined, hudRevision: 0, Player, THREE, colliders: [], layout: alpha, markers, INITIAL_SPAWN_ID, startRegion: url.searchParams.get('region') ?? 'alpha', params: url.searchParams });
  run(reload, startup + '\nglobalThis.position = player.pos;');
  assert.deepEqual(reload.position.toArray(), p.pos.toArray()); assert.equal(new WorldProgress(storage).armed, false);
  // Defeat respawn is not full reset: it keeps subsequently acquired equipment/progress.
  worldProgress.done.add(ARMORY_MARKER); worldProgress.done.add('hq_terminal'); worldProgress.save();
  p.teleport(900, 30, 30); c.runtime.spawnAt();
  assert.deepEqual(p.pos.toArray(), [initial.p[0], initial.p[1] + 1, initial.p[2]]); assert.equal(worldProgress.armed, true); assert.equal(worldProgress.done.has('hq_terminal'), true);
  fixture.dispose();
});

test('existing tutorial grants the gun before gun-required objectives and clears a previously held trigger', async () => {
  const fixture = await playerFixture(), anim = new SkinnedCharacterAnimator(fixture.rig), worldProgress = new WorldProgress(new MemoryStorage());
  const armory = markers.get(ARMORY_MARKER)!;
  assert.equal(armory.type, 'interact');
  const steps = alpha.objective.steps;
  assert.ok(steps.findIndex(s => s.done.includes('hq_terminal')) < steps.findIndex(s => s.done.includes(ARMORY_MARKER)));
  assert.ok(steps.findIndex(s => s.done.includes(ARMORY_MARKER)) < steps.findIndex(s => s.done.includes('range_target_1')));
  // No armory requirement asks the unarmed player to shoot anything.
  for (const requirement of armory.requires ?? []) assert.ok(!/target|dummy|banner|seal|core/.test(requirement));
  for (const requirement of armory.requires ?? []) worldProgress.done.add(requirement);
  const keys = new Set(['Mouse0', 'Mouse2']), aim = new ShoulderAim(); aim.held = true;
  anim.reset(false, Math.PI);
  const player = new Player([], 1); player.teleport(...armory.p);
  let equipmentMessage = '';
  const context = vm.createContext({settings: new SettingsStore('world', new MemoryStorage()), speakDialogue(line: [string,string]) { equipmentMessage = line[0]; }, narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false, FORT_CANNON, fortCannon: new FortCannon(), ...eraStory, eraOptionalIds: new Set(Object.values(eraStory.ERA_OPTIONALS).map(x => x.id)), nearestInteract: () => armory, markers, ARMORY_MARKER, BOSSES: [], done: worldProgress.done, worldProgress, servantByContract,
    VALLEY_STORY, player, anim, clearInput() { keys.clear(); aim.clear(); }, save: () => worldProgress.save(), applyWorldState() {}, toast() {}, bilingual: (zh: string) => zh, localizeText: (text: string) => text });
  run(context, interaction + '\ninteract();');
  assert.equal(worldProgress.armed, true); assert.equal(worldProgress.equippedWeapon, 'dawn_ar'); assert.equal(fixture.rig.joints.Gun.visible, true);
  assert.equal(keys.size, 0); assert.equal(aim.held, false);
  assert.match(equipmentMessage, /8发/); assert.match(equipmentMessage, /近战连击/);
  // Execute the production ADS permission expression, not a copied predicate.
  const canAim = source.split('\n').find(line => line.trimStart().startsWith('const canAim ='))!;
  const adsContext = vm.createContext({narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false, FORT_CANNON, fortCannon: new FortCannon(), worldProgress, player, gameplayActive: () => true });
  run(adsContext, `{ ${canAim} globalThis.canAimNow = canAim; }`); assert.equal(adsContext.canAimNow, true);
  worldProgress.reset(); run(adsContext, `{ ${canAim} globalThis.canAimNow = canAim; }`); assert.equal(adsContext.canAimNow, false);
  fixture.dispose();
});

test('late weapon-art attachment cannot reveal or equip an unowned gun', async () => {
  const gltf = await parseLocalGlb(new URL('../../assets/characters/player_v2/player_v2.glb', import.meta.url));
  const rig = buildSkinnedCharacter(gltf.scene), anim = new SkinnedCharacterAnimator(rig);
  let resolve!: (value: { scene: THREE.Group }) => void;
  const rifle = attachExplorerRifle(rig, undefined, () => new Promise(r => { resolve = r; }));
  anim.reset(false, Math.PI); assert.equal(rig.joints.Gun.visible, false);
  resolve(await parseLocalGlb(new URL('../../assets/weapons/glb/01_Dawn_AR.glb', import.meta.url))); await rifle.ready;
  assert.equal(rig.joints.Gun.visible, false); anim.prepareShot(new THREE.Vector3(0, 0, -1)); assert.equal(rig.joints.Gun.visible, false);
  const hiddenBeforeAttach = source.indexOf('rig.joints.Gun.visible = worldProgress.armed;');
  assert.ok(hiddenBeforeAttach > 0 && hiddenBeforeAttach < source.indexOf('const rifle = attachExplorerRifle'));
  rifle.dispose(); rig.dispose();
});

test('production world-state application re-locks quest gates and restores targets after clearing progress', () => {
  const worldProgress = new WorldProgress(new MemoryStorage()), done = worldProgress.done;
  for (const id of ['tower_console', 'summon_circle', 'range_target_1']) done.add(id);
  const target = { name: 'TGT_range_target_1', visible: true, userData: { target: 'range_target_1' } };
  const gate = { name: 'Seam_west_Gate', opensWhen: ['summon_circle'] };
  const solid = { name: 'GhostBridge', solidWhen: ['tower_console'] };
  const art = { visible: true };
  const colliders = new Map([['COL_TGT_range_target_1', { enabled: true }], ['COL_Seam_west_Gate', { enabled: true }], ['COL_GhostBridge', { enabled: false }]]);
  const shown = { visible: false, userData: { showWhen: ['tower_console'] } };
  const hidden = { visible: true, userData: { hideWhen: 'tower_console' } };
  let syncCalls=0;
  const c = vm.createContext({narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false, combat:{syncWorldProgress(value:Set<string>){assert.equal(value,done);syncCalls++;}}, FORT_CANNON, fortCannon: new FortCannon(), ...eraStory, hudRevision: 0, layout: { markers: [], objectives: [] }, eraStoryScenes: [], getLanguage: () => 'zh', applyValleyStory() {}, done, targets: [target], gates: [gate], solids: [solid], stateful: [shown, hidden], haloMat: { color: new THREE.Color() }, collider: (name: string) => colliders.get(name), byName: () => art, renderObjective() {} });
  const apply = source.slice(source.indexOf('function applyWorldState()'), source.indexOf('// ───────────── quest guide'));
  run(c, apply + '\napplyWorldState();');
  assert.equal(art.visible, false); assert.equal(colliders.get('COL_Seam_west_Gate')!.enabled, false); assert.equal(target.visible, false);
  worldProgress.reset(); run(c, 'applyWorldState();'); assert.equal(syncCalls,2);
  assert.equal(art.visible, true); assert.equal(colliders.get('COL_Seam_west_Gate')!.enabled, true);
  assert.equal(target.visible, true); assert.equal(colliders.get('COL_TGT_range_target_1')!.enabled, true);
  assert.equal(colliders.get('COL_GhostBridge')!.enabled, false); assert.equal(shown.visible, false); assert.equal(hidden.visible, true);
});
