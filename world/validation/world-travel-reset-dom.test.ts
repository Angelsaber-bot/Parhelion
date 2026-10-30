import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { WORLD_PROGRESS_KEY, INITIAL_SPAWN_ID } from '../src/progress';

test('NON-GPU actual travel buttons and reset keys execute production handlers with revalidation', async (t) => {
  const harness = await bootWorldWithoutGpu({ deterministic: true });
  try {
    const { window, world } = harness, document = window.document;
    let now = 0;
    const frame = () => harness.frame(now += 1000 / 60);
    const key = (code: string) => {
      document.body.dispatchEvent(new window.KeyboardEvent('keydown', { code, key: code.replace('Key', '').toLowerCase(), bubbles: true, cancelable: true }));
      document.body.dispatchEvent(new window.KeyboardEvent('keyup', { code, bubbles: true }));
    };
    const enter = async () => {
      (document.getElementById('start') as HTMLElement).click(); await Promise.resolve();
      assert.equal(document.pointerLockElement, document.getElementById('view'));
    };
    const stops = [world.travelStops.find((stop: any) => stop.region === 'alpha'), world.travelStops.find((stop: any) => stop.region === 'britain')];
    const destinationButton = (index: number) => document.querySelectorAll<HTMLButtonElement>('#world-travel-panel .travel-stop')[world.travelStops.indexOf(stops[index])];
    world.done.add('summon_circle'); world.done.add('hq_terminal'); world.done.add('armory_rack');
    for (const stop of stops) world.found.add(stop.foundFlag);
    world.player.teleport(...stops[0].position);
    await enter(); for (let i = 0; i < 30; i++) frame();
    assert.equal(world.player.onGround, true);

    await t.test('N then an enabled destination button travels without restoring HP, energy or cooldown', () => {
      world.combat.state.hp = 67; world.combat.state.quietFor = 6;
      world.actions.skills.recordDamage({ id: 'fixture-hostile', damage: 40, eligible: true, source: 'weapon' });
      assert.equal(world.actions.skills.activate('skill', { enabled: true, origin: world.player.pos, direction: { x: 1, y: 0, z: 0 } }), true);
      world.actions.skills.cancel();
      const energy = world.actions.skills.energy, cooldown = world.actions.skills.cooldown('skill');
      assert.ok(energy > 0); assert.ok(cooldown > 0);
      key('KeyN'); assert.equal(world.travelPanel.open, true); assert.equal(document.pointerLockElement, null);
      const landing = world.combat.geometry.ground(stops[1].position[0], stops[1].position[2], stops[1].position[1] + 2);
      assert.ok(landing);
      const button = destinationButton(1); assert.equal(button.disabled, false); button.click();
      assert.equal(world.travelPanel.open, false); assert.equal(document.pointerLockElement, null);
      assert.equal(world.player.pos.x, stops[1].position[0]); assert.equal(world.player.pos.z, stops[1].position[2]);
      assert.ok(Math.abs(world.player.pos.y - landing.point.y - .25) < .02);
      assert.equal(world.combat.state.hp, 67); assert.equal(world.actions.skills.energy, energy);
      assert.equal(world.actions.skills.cooldown('skill'), cooldown);
      for (let i = 0; i < 45; i++) frame();
      assert.equal(world.player.onGround, true, 'actual Player settles at the checked destination even while the menu is open');
      assert.ok(Math.abs(world.player.pos.y - landing.point.y) < .08);
      assert.equal(world.combat.state.hp, 67); assert.equal(world.actions.skills.cooldown('skill'), cooldown);
    });

    await t.test('a real stale enabled button rechecks a newly introduced threat and rejects travel', async () => {
      await enter(); key('KeyN');
      const button = destinationButton(0); assert.equal(button.disabled, false);
      const enemy = world.combat.state.enemies.find((candidate: any) => candidate.kind !== 'king');
      const original = { active: enemy.active, pacified: enemy.pacified, mode: enemy.mode, p: { ...enemy.p } };
      enemy.active = true; enemy.pacified = false; enemy.mode = 'chase'; Object.assign(enemy.p, world.player.pos);
      const position = world.player.pos.clone(), hp = world.combat.state.hp, cooldown = world.actions.skills.cooldown('skill');
      button.click();
      assert.equal(world.travelPanel.open, true); assert.equal(document.pointerLockElement, null);
      assert.ok(world.player.pos.equals(position)); assert.equal(world.combat.state.hp, hp);
      assert.equal(world.actions.skills.cooldown('skill'), cooldown); assert.equal(destinationButton(0).disabled, true);
      Object.assign(enemy, original); world.travelPanel.hide();
    });

    await t.test('travel updates the real defeat-respawn destination, not merely the displayed position', async () => {
      await enter();
      world.player.teleport(stops[1].position[0] + 20, stops[1].position[1] + 1, stops[1].position[2]);
      world.combat.state.hp = 0; world.combat.state.defeatedFor = .001;
      for (let i = 0; i < 8; i++) frame();
      assert.equal(world.combat.defeated, false);
      assert.equal(world.player.pos.x, stops[1].position[0]); assert.equal(world.player.pos.z, stops[1].position[2]);
    });

    await t.test('actual R cancel preserves progress; actual R accept clears gameplay and retains preferences', async () => {
      world.settings.update({ sensitivity: 1.3, adsSensitivity: .7, invertY: true });
      const volume = document.getElementById('world-audio-volume') as HTMLInputElement;
      volume.value = '.2'; volume.dispatchEvent(new window.Event('input', { bubbles: true }));
      const resolution = document.getElementById('world-resolution') as HTMLSelectElement;
      resolution.value = 'crisp'; resolution.dispatchEvent(new window.Event('change', { bubbles: true }));
      window.localStorage.setItem('parhelion-language-v1', 'en');
      const preferenceKeys = [world.settings.key, 'parhelion-world-audio-v1', 'parhelion-world-resolution-v1', 'parhelion-language-v1'];
      const preferences = preferenceKeys.map(key => [key, window.localStorage.getItem(key)] as const);
      assert.ok(preferences.every(([, value]) => value !== null));
      world.done.add('saber_contract'); world.found.add('fixture_discovery');
      window.localStorage.setItem(WORLD_PROGRESS_KEY, JSON.stringify({ done: [...world.done], found: [...world.found] }));
      window.localStorage.setItem('fixture-unrelated-preference', 'keep');
      const progress = window.localStorage.getItem(WORLD_PROGRESS_KEY), done = [...world.done], found = [...world.found], position = world.player.pos.clone();
      let prompts = 0;
      window.confirm = message => { prompts++; assert.match(message, /新游戏|new game/); return false; };
      key('KeyR');
      assert.equal(prompts, 1); assert.equal(document.pointerLockElement, null);
      assert.deepEqual([...world.done], done); assert.deepEqual([...world.found], found); assert.ok(world.player.pos.equals(position));
      assert.equal(window.localStorage.getItem(WORLD_PROGRESS_KEY), progress);
      await enter(); window.confirm = () => { prompts++; return true; }; key('KeyR');
      assert.equal(prompts, 2); assert.equal(document.pointerLockElement, null);
      assert.equal(world.done.size, 0); assert.equal(world.found.size, 0); assert.equal(world.contract.roster.length, 0);
      assert.equal(world.actions.skills.energy, 0); assert.equal(world.actions.skills.cooldown('skill'), 0);
      assert.equal(world.rig.joints.Gun.visible, false);
      const spawn = world.layout.markers.find((marker: any) => marker.id === INITIAL_SPAWN_ID);
      assert.deepEqual(world.player.pos.toArray(), [spawn.p[0], spawn.p[1] + 1, spawn.p[2]]);
      assert.deepEqual(JSON.parse(window.localStorage.getItem(WORLD_PROGRESS_KEY)!), { done: [], found: [] });
      assert.equal(window.localStorage.getItem('fixture-unrelated-preference'), 'keep');
      for (const [key, value] of preferences) assert.equal(window.localStorage.getItem(key), value, key);
      assert.equal(world.settings.value.invertY, true); assert.equal(world.settings.value.sensitivity, 1.3);
      assert.equal(world.audio.volume, .2); assert.equal(resolution.value, 'crisp');
    });
    assert.equal(harness.errors.length, 0, JSON.stringify(harness.errors));
  } finally { await harness.close(); }
});
