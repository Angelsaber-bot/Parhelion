import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('NON-GPU production modal interruptions return control rather than retaining hidden viewing state', async t => {
  const harness = await bootWorldWithoutGpu({ deterministic: true });
  try {
    const { window, world } = harness, document = window.document;
    let now = 0;
    const frame = () => harness.frame(now += 1000 / 60);
    const down = (code: string, target: Element = document.body) => target.dispatchEvent(new window.KeyboardEvent('keydown', { code, key: code === 'Escape' ? 'Escape' : code.replace('Key', '').toLowerCase(), bubbles: true, cancelable: true }));
    const up = (code: string) => document.body.dispatchEvent(new window.KeyboardEvent('keyup', { code, bubbles: true }));
    const key = (code: string, target?: Element) => { down(code, target); up(code); };
    const enter = async () => { (document.getElementById('start') as HTMLElement).click(); await Promise.resolve(); assert.equal(document.pointerLockElement, document.getElementById('view')); };
    const settle = () => { for (let i = 0; i < 40; i++) frame(); assert.equal(world.player.onGround, true); };
    const stop = world.travelStops.find((stop: any) => stop.region === 'alpha');
    world.player.teleport(...stop.position); await enter(); settle();

    await t.test('Esc while inspecting a companion exits inspection before entering gameplay again', async () => {
      world.contract.recruit('saber_contract'); await world.servant.ensureLoaded(); frame();
      assert.equal(world.servant.root.visible, true); key('KeyU');
      const before = world.player.pos.clone(); down('KeyW'); for (let i = 0; i < 10; i++) frame(); up('KeyW');
      assert.ok(world.player.pos.distanceTo(before) < .01, 'inspection initially pauses locomotion');
      key('Escape'); document.exitPointerLock(); await enter();
      const resumed = world.player.pos.clone(); down('KeyW'); for (let i = 0; i < 10; i++) frame(); up('KeyW');
      assert.ok(world.player.pos.distanceTo(resumed) > .2, 'return from Escape menu must not retain hidden inspection lockout');
    });

    await t.test('settings rebinding routes dialogue to its new key and map/blur never resumes a held movement key', async () => {
      key('KeyO'); assert.equal(world.settingsPanel.open, true);
      const binding = document.querySelector<HTMLButtonElement>('#world-settings [data-bind="interact"][data-slot="primary"]')!;
      binding.click(); key('KeyI', binding);
      assert.equal(world.settings.action('KeyI'), 'interact'); assert.notEqual(world.settings.action('KeyF'), 'interact');
      (document.querySelector('#world-settings [data-close]') as HTMLButtonElement).click(); await enter();
      const npc = world.scene.getObjectByName('Resident_alpha_archivist'), point = npc.getWorldPosition(new THREE.Vector3());
      // The archivist is under the residence roof; a top-down debug ground ray would put us on that roof.
      world.player.teleport(point.x, point.y + .05, point.z + 1); settle();
      key('KeyI'); const dialogue = document.getElementById('world-dialogue')!;
      assert.equal(dialogue.hidden, false, JSON.stringify({ player: world.player.pos.toArray(), npc: point.toArray(), locked: !!document.pointerLockElement, settings: world.settingsPanel.open, ground: world.player.onGround, key: world.settings.action('KeyI'), errors: harness.errors })); assert.match(dialogue.textContent!, /I/);
      key('KeyF'); assert.equal(dialogue.hidden, false, 'old interaction binding cannot dismiss dialogue');
      down('KeyW'); key('KeyM'); assert.equal(dialogue.hidden, true); assert.equal(document.getElementById('bigmap')!.classList.contains('open'), true);
      key('KeyM'); const before = world.player.pos.clone(); for (let i = 0; i < 10; i++) frame();
      assert.ok(world.player.pos.distanceTo(before) < .01, 'cleared held movement cannot restart on modal close'); up('KeyW');
      key('KeyI'); assert.equal(dialogue.hidden, false); window.dispatchEvent(new window.Event('blur'));
      assert.equal(dialogue.hidden, true); key('KeyI'); assert.equal(dialogue.hidden, false); key('KeyI'); assert.equal(dialogue.hidden, true);
    });
    await t.test('real swimming and gliding keep exploration cooldowns running, while the map still freezes them', () => {
      world.actions.skills.reset();
      assert.equal(world.actions.skills.activate('skill', { enabled: true, origin: world.player.pos, direction: { x: 1, y: 0, z: 0 } }), true);
      world.actions.skills.cancel();
      const start = world.actions.skills.cooldown('skill');
      // The preceding blur deliberately invalidates the clock. Its first resumed
      // frame owns zero simulation time; only the following frame can enter water.
      const resumedPosition = world.player.pos.toArray(); frame();
      assert.deepEqual(world.player.pos.toArray(), resumedPosition);
      assert.equal(world.actions.skills.cooldown('skill'), start);
      // Water state comes from real production Player physics, not manually assigned flags.
      world.player.teleport(1100, world.player.waterLevel - 2, -400);
      frame(); assert.equal(world.player.swimming, true);
      const swimmingCooldown = world.actions.skills.cooldown('skill');
      key('KeyQ'); assert.equal(world.actions.skills.cooldown('skill'), swimmingCooldown, 'no new underwater cast');
      let swimmingFrames = 0;
      for (let i = 0; i < 24; i++) {
        const before = world.actions.skills.cooldown('skill'); frame();
        if (world.player.swimming) { swimmingFrames++; assert.ok(world.actions.skills.cooldown('skill') < before); }
      }
      assert.ok(swimmingFrames > 5, 'exercise real buoyant swimming rather than only a transient flag');
      assert.ok(world.actions.skills.cooldown('skill') < start - .3);
      assert.equal(world.actions.skills.casting, false);
      world.player.teleport(...[stop.position[0], stop.position[1] + 80, stop.position[2]]);
      down('Space'); frame(); up('Space'); assert.equal(world.player.gliding, true);
      const glideCooldown = world.actions.skills.cooldown('skill');
      for (let i = 0; i < 24; i++) frame();
      assert.ok(world.actions.skills.cooldown('skill') < glideCooldown - .3);
      key('KeyM'); const pausedCooldown = world.actions.skills.cooldown('skill');
      for (let i = 0; i < 24; i++) frame();
      assert.equal(world.actions.skills.cooldown('skill'), pausedCooldown);
      key('KeyM'); world.player.teleport(...stop.position); settle();
    });
    await t.test('a long recorded epilogue remains readable after page-two settings/blur interruption and language changes', async () => {
      for (const flag of ['hq_terminal', 'armory_rack', 'sun_core', 'sea_core', 'winter_core', 'fire_core', 'britain_memorial', 'blacksail_harbor_signal', 'winter_shelter_stove', 'kyoto_lantern_route']) world.done.add(flag);
      const terminal = world.layout.markers.find((marker: any) => marker.id === 'hq_terminal');
      world.player.teleport(...terminal.p); settle();
      const dialogue = document.getElementById('world-dialogue')!, text = document.getElementById('world-dialogue-text')!, hint = document.getElementById('world-dialogue-hint')!;
      key('KeyI'); assert.equal(dialogue.hidden, false); assert.match(hint.textContent!, /^1\//);
      const firstPage = text.textContent;
      key('KeyI'); assert.match(hint.textContent!, /^2\//); assert.notEqual(text.textContent, firstPage);
      const language = document.querySelector<HTMLSelectElement>('body > .parhelion-language select')!;
      language.value = 'en'; language.dispatchEvent(new window.Event('change', { bubbles: true }));
      assert.match(hint.textContent!, /^2\//, 'language change preserves the semantic page');
      assert.match(text.textContent!, /memorial|harbor|stove|lantern|trial/i);
      key('KeyO'); assert.equal(dialogue.hidden, true); assert.equal(text.textContent, '');
      world.settingsPanel.close(); await enter(); key('KeyI');
      assert.equal(world.done.has('world_epilogue_recorded'), true);
      assert.equal(dialogue.hidden, false); assert.match(hint.textContent!, /^1\//);
      const englishFirst = text.textContent; assert.match(englishFirst!, /Observation filed/);
      key('KeyI'); assert.match(hint.textContent!, /^2\//); window.dispatchEvent(new window.Event('blur'));
      assert.equal(dialogue.hidden, true); key('KeyI'); assert.equal(text.textContent, englishFirst);
      assert.match(hint.textContent!, /^1\//, 'reopening a saved record starts at the first page, not the interrupted cursor');
      key('KeyM'); key('KeyM');
    });
    assert.equal(harness.errors.length, 0, JSON.stringify(harness.errors));
  } finally { await harness.close(); }
});
