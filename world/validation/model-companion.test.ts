import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterKit, type CharacterKitDefinition, type CharacterKitOptions } from '../src/characters/characterKit.ts';
import { ModelCompanion } from '../src/companions/modelCompanion.ts';
import { KitCompanion } from '../src/companions/kitCompanion.ts';
import { CHARACTER_KITS } from '../src/characters/catalog.ts';
import { FirstContract } from '../src/companions/contracts.ts';

function fixture(definition: CharacterKitDefinition, options: CharacterKitOptions = {}) {
  const scene = new THREE.Group(), geometry = new THREE.BoxGeometry(), texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  scene.add(new THREE.Mesh(geometry, material));
  for (const socket of Object.values(definition.sockets)) { const node = new THREE.Object3D(); node.name = socket.node; scene.add(node); }
  const animationNode = new THREE.Object3D(); animationNode.name = 'NativeHover'; animationNode.position.y = .4; scene.add(animationNode);
  const animations = Object.values(definition.clips).map(clip => new THREE.AnimationClip(clip.name, clip.duration, [new THREE.NumberKeyframeTrack('NativeHover.position[y]', [0, clip.duration], [.4, .4])]));
  const actor = new CharacterKit({ scene, animations } as GLTF, definition, options);
  const counts = { geometry: 0, material: 0, texture: 0, dispose: 0, update: 0 };
  geometry.addEventListener('dispose', () => counts.geometry++);
  material.addEventListener('dispose', () => counts.material++);
  texture.addEventListener('dispose', () => counts.texture++);
  const dispose = actor.dispose.bind(actor), update = actor.update.bind(actor);
  actor.dispose = () => { counts.dispose++; dispose(); };
  actor.update = (...args) => { counts.update++; update(...args); };
  return { actor, counts };
}
function deferredLoader() {
  const calls: Array<{ definition: CharacterKitDefinition; signal?: AbortSignal; resolve: (actor: CharacterKit) => void; reject: (error: unknown) => void }> = [];
  const load = (definition: CharacterKitDefinition, options: CharacterKitOptions & { signal?: AbortSignal } = {}) => new Promise<CharacterKit>((resolve, reject) => { calls.push({ definition, signal: options.signal, resolve, reject }); });
  return { calls, load };
}
const flush = () => Promise.resolve();
function floor() { return { name: 'ground', enabled: true, bvh: new MeshBVH(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2)) }; }

test('rapid A/B/A selections abort old requests; stale completions dispose once and cannot replace the newest actor', async () => {
  const loader = deferredLoader(), scene = new THREE.Scene(), storyRoot = new THREE.Group(); scene.add(storyRoot);
  const companion = new ModelCompanion({ scene, colliders: [floor()], load: loader.load });
  const a = companion.select('jeanne'); await flush();
  assert.equal(companion.select('jeanne'), a, 'repeated selection reuses pending load');
  const b = companion.select('ozymandias'); await flush();
  const newest = companion.select('jeanne'); await flush();
  assert.equal(loader.calls.length, 3); assert.equal(loader.calls[0].signal?.aborted, true); assert.equal(loader.calls[1].signal?.aborted, true);
  const oldA = fixture(CHARACTER_KITS.jeanne), oldB = fixture(CHARACTER_KITS.ozymandias), current = fixture(CHARACTER_KITS.jeanne);
  loader.calls[2].resolve(current.actor); await newest;
  loader.calls[0].resolve(oldA.actor); loader.calls[1].resolve(oldB.actor); await Promise.all([a, b]);
  assert.equal(companion.actor, current.actor); assert.equal(companion.state, 'ready');
  assert.deepEqual(scene.children, [storyRoot, current.actor.root]);
  assert.equal(oldA.counts.dispose, 1); assert.equal(oldB.counts.dispose, 1); assert.equal(current.counts.dispose, 0);
  companion.update(1 / 60, new THREE.Vector3(), 0, true, false);
  assert.equal(oldA.counts.update, 0); assert.equal(oldB.counts.update, 0); assert.ok(current.counts.update > 0);
  await companion.select(null); companion.dispose(); companion.dispose();
  assert.equal(current.counts.dispose, 1); assert.equal(current.counts.geometry, 1); assert.equal(current.counts.material, 1); assert.equal(current.counts.texture, 1);
  assert.deepEqual(scene.children, [storyRoot]);
});

test('clearing or disposing during a request removes the preview and absorbs late success/failure', async () => {
  for (const finish of ['clear', 'dispose'] as const) {
    const loader = deferredLoader(), scene = new THREE.Scene(), companion = new ModelCompanion({ scene, colliders: [], load: loader.load });
    const pending = companion.select('qinShiHuang'); await flush();
    if (finish === 'clear') await companion.select(null); else companion.dispose();
    const loaded = fixture(CHARACTER_KITS.qinShiHuang); loader.calls[0].resolve(loaded.actor); await pending;
    assert.equal(companion.selected, null); assert.equal(companion.state, 'off'); assert.equal(companion.actor, undefined); assert.equal(scene.children.length, 0); assert.equal(loaded.counts.dispose, 1);
    companion.dispose(); assert.equal(loaded.counts.dispose, 1);
  }
  const loader = deferredLoader(), companion = new ModelCompanion({ scene: new THREE.Scene(), colliders: [], load: loader.load });
  const pending = companion.select('jeanne'); await flush(); await companion.select(null); loader.calls[0].reject(new Error('late failure')); await pending;
  assert.equal(companion.state, 'off'); assert.equal(companion.error, undefined);
});

test('failed and synchronous loads are recoverable without touching contract progress, selection, or storage', async () => {
  const done = new Set(['saber_contract', 'relay_a']), writes: string[] = [];
  const contract = new FirstContract(done, { getItem: () => null, setItem: (_key, value) => writes.push(value) });
  const loader = deferredLoader(), companion = new ModelCompanion({ scene: new THREE.Scene(), colliders: [], load: loader.load });
  const first = companion.select('ozymandias'); await flush(); loader.calls[0].reject(new Error('HTTP 503')); await first;
  assert.equal(companion.state, 'failed'); assert.equal(companion.selected, 'ozymandias'); assert.equal(companion.actor, undefined);
  const retry = companion.retry(); assert.equal(companion.state, 'loading'); await flush();
  const loaded = fixture(CHARACTER_KITS.ozymandias); loader.calls[1].resolve(loaded.actor); await retry;
  assert.equal(companion.state, 'ready'); assert.equal(companion.error, undefined); assert.equal(contract.selected, 'saber'); assert.equal(contract.summoned, true); assert.deepEqual([...done], ['saber_contract', 'relay_a']); assert.deepEqual(writes, []);
  companion.dispose();
  const synchronous = new ModelCompanion({ scene: new THREE.Scene(), colliders: [], load: () => { throw new Error('synchronous loader failure'); } });
  await synchronous.select('jeanne'); assert.equal(synchronous.state, 'failed'); synchronous.dispose();
});

test('pause freezes model; disabled hides it; safe grounded placement retains native hover and shared environment', async () => {
  const environment = new THREE.Texture(); let environmentDisposals = 0; environment.addEventListener('dispose', () => environmentDisposals++);
  let loaded: ReturnType<typeof fixture>;
  const companion = new ModelCompanion({ scene: new THREE.Scene(), colliders: [floor()], environment: () => environment, load: async (definition, options) => (loaded = fixture(definition, options)).actor });
  await companion.select('qinShiHuang'); const actor = loaded!.actor;
  assert.equal(actor.root.visible, false); assert.equal(companion.placementPending, true);
  companion.update(.1, new THREE.Vector3(), 0, true, true); assert.equal(actor.root.visible, false);
  companion.update(.1, new THREE.Vector3(), 0, true, false); assert.equal(actor.root.visible, true); assert.equal(companion.placementPending, false);
  const before = actor.root.position.clone(), time = actor.clipTime;
  companion.update(.1, new THREE.Vector3(10, 0, 0), 1, true, true); assert.deepEqual(actor.root.position, before); assert.equal(actor.clipTime, time);
  assert.ok(Math.abs(actor.model.getObjectByName('NativeHover')!.position.y - .4) < 1e-7); assert.deepEqual(actor.model.position.toArray(), [0, 0, 0]); assert.deepEqual(actor.root.scale.toArray(), [1, 1, 1]);
  companion.update(.1, new THREE.Vector3(), 0, false, false); assert.equal(actor.root.visible, false);
  companion.update(.1, new THREE.Vector3(10, 0, 0), 0, true, false); assert.equal(actor.root.visible, true); assert.ok(actor.root.position.distanceTo(new THREE.Vector3(10, 0, 0)) < 4);
  companion.dispose(); assert.equal(environmentDisposals, 0); environment.dispose();
});

test('no floor means no unsafe origin spawn; selecting None always clears it', async () => {
  const companion = new ModelCompanion({ scene: new THREE.Scene(), colliders: [], load: async definition => fixture(definition).actor });
  await companion.select('jeanne'); companion.update(.1, new THREE.Vector3(50, 40, 20), 0, true, false);
  assert.equal(companion.actor!.root.visible, false); assert.equal(companion.placementPending, true);
  await companion.select(null); assert.equal(companion.actor, undefined); assert.equal(companion.state, 'off'); companion.dispose();
});

test('extra model and existing story companion occupy mirrored slots without changing story movement', async () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const colliders = [floor()], scene = new THREE.Scene(), player = new THREE.Vector3();
    const story = fixture(CHARACTER_KITS.musashi), follow = new KitCompanion({ colliders, range: 3.5, damage: 9, target: () => null, strike: () => null });
    scene.add(story.actor.root);
    const companion = new ModelCompanion({ scene, colliders, reservedRoots: () => [story.actor.root], load: async definition => fixture(definition).actor });
    await companion.select('jeanne');
    for (let frame = 0; frame < 120; frame++) { follow.update(story.actor, 1 / 60, player, yaw, false); companion.update(1 / 60, player, yaw, true, false); }
    const extra = companion.actor!.root;
    assert.equal(extra.visible, true); assert.ok(extra.position.distanceTo(story.actor.root.position) > 4.7);
    assert.ok(story.actor.root.position.distanceTo(new THREE.Vector3(-Math.cos(yaw) * 2.4 - Math.sin(yaw) * .8, 0, Math.sin(yaw) * 2.4 - Math.cos(yaw) * .8)) < 1e-6);
    assert.ok(extra.position.distanceTo(new THREE.Vector3(Math.cos(yaw) * 2.4 - Math.sin(yaw) * .8, 0, -Math.sin(yaw) * 2.4 - Math.cos(yaw) * .8)) < 1e-6);
    // A long-distance return must use the same reservation, rather than the old story slot.
    extra.position.set(30, 0, 30);
    for (let frame = 0; frame < 90; frame++) { follow.update(story.actor, 1 / 60, player, yaw, false); companion.update(1 / 60, player, yaw, true, false); }
    assert.ok(extra.position.distanceTo(player) < 4); assert.ok(extra.position.distanceTo(story.actor.root.position) >= 1.2);
    companion.dispose(); follow.release(story.actor); story.actor.dispose();
  }
});

test('blocked side and narrow bridge fallback never choose the occupied story slot', async () => {
  const cases = [
    [floor(), { name: 'right-wall', enabled: true, bvh: new MeshBVH(new THREE.BoxGeometry(3, 3, 8).translate(3.3, 1.5, -.8)) }],
    [{ name: 'narrow-bridge', enabled: true, bvh: new MeshBVH(new THREE.PlaneGeometry(1.3, 100).rotateX(-Math.PI / 2)) }],
  ];
  for (const colliders of cases) {
    const scene = new THREE.Scene(), player = new THREE.Vector3(), story = fixture(CHARACTER_KITS.musashi);
    const follow = new KitCompanion({ colliders, range: 3.5, damage: 9, target: () => null, strike: () => null }); scene.add(story.actor.root);
    const companion = new ModelCompanion({ scene, colliders, reservedRoots: () => [story.actor.root], load: async definition => fixture(definition).actor });
    await companion.select('jeanne');
    for (let frame = 0; frame < 180; frame++) {
      follow.update(story.actor, 1 / 60, player, 0, false); companion.update(1 / 60, player, 0, true, false);
      if (companion.actor!.root.visible) assert.ok(companion.actor!.root.position.distanceTo(story.actor.root.position) >= 1.2 - 1e-7);
    }
    assert.equal(companion.actor!.root.visible, true, 'an unoccupied centerline fallback exists');
    companion.dispose(); follow.release(story.actor); story.actor.dispose();
  }
});

test('newly summoned story actor has priority; occupied movement is not allowed and no free slot hides the model', async () => {
  const reserved: THREE.Group[] = [], scene = new THREE.Scene(), companion = new ModelCompanion({ scene, colliders: [floor()], reservedRoots: () => reserved, load: async definition => fixture(definition).actor });
  await companion.select('jeanne'); companion.update(.1, new THREE.Vector3(), 0, true, false);
  const actor = companion.actor!, story = new THREE.Group(); story.position.copy(actor.root.position); const storyPosition = story.position.clone(); reserved.push(story);
  companion.update(.1, new THREE.Vector3(), 0, true, false); assert.ok(actor.root.position.distanceTo(story.position) >= 1.2); assert.deepEqual(story.position, storyPosition);
  // Occupy all authored side and centerline return candidates. No overlap fallback is allowed.
  for (const x of [-3.4, -2.4, -1.4, 1.4, 2.4, 3.4]) { const root = new THREE.Group(); root.position.set(x, 0, -.8); reserved.push(root); }
  for (const z of [-1.6, 1.6]) { const root = new THREE.Group(); root.position.set(0, 0, z); reserved.push(root); }
  companion.update(.1, new THREE.Vector3(), 0, true, false); assert.equal(actor.root.visible, false); assert.equal(companion.placementPending, true);
  reserved.length = 0; companion.update(.1, new THREE.Vector3(), 0, true, false); assert.equal(actor.root.visible, true);
  companion.dispose();
});

test('tall native models reject a two-metre ceiling and recover when clearance is available', async () => {
  for (const id of ['jeanne', 'qinShiHuang'] as const) {
    const ceiling = { name: 'two-metre-ceiling', enabled: true, bvh: new MeshBVH(new THREE.PlaneGeometry(100, 100).rotateX(Math.PI / 2).translate(0, 2, 0)) };
    const companion = new ModelCompanion({ scene: new THREE.Scene(), colliders: [floor(), ceiling], load: async definition => fixture(definition).actor });
    await companion.select(id); companion.update(.1, new THREE.Vector3(), 0, true, false);
    assert.equal(companion.state, 'ready'); assert.equal(companion.actor!.root.visible, false); assert.equal(companion.placementPending, true);
    ceiling.enabled = false; companion.update(.1, new THREE.Vector3(), 0, true, false); assert.equal(companion.actor!.root.visible, true);
    ceiling.enabled = true; companion.update(.1, new THREE.Vector3(), 0, true, false); assert.equal(companion.actor!.root.visible, false, 'newly enabled low ceiling hides the extra model, not the story');
    companion.dispose();
  }
});

test('wide model rejects narrow walls even when the generic foot/body path would fit', async () => {
  const walls = [-1, 1].map(x => ({ name: `wall-${x}`, enabled: true, bvh: new MeshBVH(new THREE.BoxGeometry(.1, 4, 100).translate(x, 2, 0)) }));
  const companion = new ModelCompanion({ scene: new THREE.Scene(), colliders: [floor(), ...walls], load: async definition => fixture(definition).actor });
  await companion.select('jeanne'); companion.update(.1, new THREE.Vector3(), 0, true, false);
  assert.equal(companion.actor!.root.visible, false); assert.equal(companion.placementPending, true);
  walls.forEach(wall => { wall.enabled = false; }); companion.update(.1, new THREE.Vector3(), 0, true, false); assert.equal(companion.actor!.root.visible, true);
  companion.dispose();
});

test('height-varying upper clearances permit gentle open slopes without shrinking or grounding native art', async () => {
  for (const slope of [.1, .15]) for (const id of ['jeanne', 'ozymandias', 'qinShiHuang'] as const) {
    const geometry = new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2).rotateZ(Math.atan(slope));
    const companion = new ModelCompanion({ scene: new THREE.Scene(), colliders: [{ name: 'slope', enabled: true, bvh: new MeshBVH(geometry) }], load: async definition => fixture(definition).actor });
    await companion.select(id); const player = new THREE.Vector3();
    for (let frame = 0; frame < 180; frame++) {
      player.x += 1 / 60; player.y = player.x * slope;
      companion.update(1 / 60, player, 0, true, false);
      assert.equal(companion.actor!.root.visible, true, `${id} on slope ${slope}`);
      assert.ok(Math.abs(companion.actor!.root.position.y - companion.actor!.root.position.x * slope) < 1e-5);
      assert.deepEqual(companion.actor!.model.position.toArray(), [0, 0, 0]); assert.deepEqual(companion.actor!.root.scale.toArray(), [1, 1, 1]);
    }
    companion.dispose(); geometry.dispose();
  }
});
