import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('NON-GPU sixty production UI interruption cycles retain bounded nodes/listeners and never refund a paid ultimate', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true });
  const { window, world } = h, document = window.document;
  const proto = window.EventTarget.prototype, add = proto.addEventListener, remove = proto.removeEventListener;
  try {
    let now = 0, confirmations = 0;
    const frame = () => h.frame(now += 1000 / 60);
    const down = (code: string) => document.body.dispatchEvent(new window.KeyboardEvent('keydown', { code, key: code === 'Escape' ? 'Escape' : code.replace('Key', '').toLowerCase(), bubbles: true, cancelable: true }));
    const up = (code: string) => document.body.dispatchEvent(new window.KeyboardEvent('keyup', { code, bubbles: true }));
    const key = (code: string) => { down(code); up(code); };
    const enter = async () => { if (!document.pointerLockElement) { (document.getElementById('start') as HTMLElement).click(); await Promise.resolve(); } };
    const settingsOpen = document.getElementById('settings-open') as HTMLButtonElement;
    const settingsClose = document.querySelector<HTMLButtonElement>('#world-settings [data-close]')!;
    const language = document.querySelector<HTMLSelectElement>('#world-settings .parhelion-language select')!;
    const dialogue = document.getElementById('world-dialogue')!;
    const bigmap = document.getElementById('bigmap')!;
    const state = world.combat.state;
    world.done.add('hq_terminal'); world.done.add('armory_rack'); world.done.add('valley_story_met'); world.done.add('valley_story_resolved');
    const npc = world.scene.getObjectByName('Resident_alpha_archivist'), position = npc.getWorldPosition(new THREE.Vector3());
    world.player.teleport(position.x, position.y + .05, position.z + 1); await enter();
    for (let i = 0; i < 45; i++) frame();
    assert.equal(world.player.onGround, true);
    // Warm all modal structures before counting persistent nodes and subsequent registrations.
    key('KeyF'); key('KeyM'); key('KeyM'); key('KeyN'); key('Escape');
    settingsOpen.click(); language.value = 'en'; language.dispatchEvent(new window.Event('change', { bubbles: true })); settingsClose.click(); await enter();
    for (let i = 0; i < 40; i++) { world.actions.skills.update(.25, true); world.actions.skills.recordDamage({ id: 'synthetic-earned-hit', damage: 100, eligible: true, source: 'weapon' }); }
    assert.equal(world.actions.skills.energy, 100); key('KeyX'); assert.equal(world.actions.skills.energy, 0);
    const paidCooldown = world.actions.skills.cooldown('ultimate'); assert.ok(paidCooldown > 20);
    // An external settings interruption cancels the owned cinematic safely;
    // ordinary map keys are deliberately captured during the ultimate now.
    world.settingsPanel.show(); assert.equal(world.ultimateDirector.active, false); assert.equal(world.actions.skills.casting, false);
    settingsClose.click(); await enter();
    // Finish actual lazy assets requested by the warm-up, then let presentation
    // attach their cached models before treating scene-node identity as a baseline.
    await h.settleAssets(); frame(); await h.settleAssets(); frame();
    const fixedTargets = new Set<EventTarget>([window, document, ...document.querySelectorAll('*')]);
    const registrations = new Map<EventTarget, Map<string, Set<EventListenerOrEventListenerObject>>>();
    const captureKey = (type: string, options?: boolean | AddEventListenerOptions) => `${type}:${typeof options === 'boolean' ? options : !!options?.capture}`;
    proto.addEventListener = function(type, listener, options) {
      if (listener && fixedTargets.has(this)) { const events = registrations.get(this) ?? new Map(); const key = captureKey(type, options), listeners = events.get(key) ?? new Set(); listeners.add(listener); events.set(key, listeners); registrations.set(this, events); }
      return add.call(this, type, listener, options);
    };
    proto.removeEventListener = function(type, listener, options) {
      if (listener) registrations.get(this)?.get(captureKey(type, options))?.delete(listener);
      return remove.call(this, type, listener, options);
    };
    const nodes = document.querySelectorAll('*').length;
    const sceneNodes = () => { let count = 0; world.scene.traverse(() => count++); return count; };
    const sceneBaseline = sceneNodes(), bodyPosition = world.player.pos.clone();
    const baselineObjects = new Set<unknown>(); world.scene.traverse((object: unknown) => baselineObjects.add(object));
    window.confirm = () => { confirmations++; return false; };
    let previousCooldown = paidCooldown;
    for (let iteration = 0; iteration < 60; iteration++) {
      await enter(); down('KeyW'); key('KeyF'); assert.equal(dialogue.hidden, false, `dialogue ${iteration}`);
      key('KeyQ'); document.body.dispatchEvent(new window.MouseEvent('mousedown', { button: 0, bubbles: true }));
      assert.equal(world.actions.skills.casting, false); assert.equal(world.actions.melee.active, false);
      key('KeyM'); assert.equal(dialogue.hidden, true); assert.equal(bigmap.classList.contains('open'), true);
      const paused = world.actions.skills.cooldown('ultimate'); frame(); assert.equal(world.actions.skills.cooldown('ultimate'), paused);
      key('KeyM'); frame(); up('KeyW'); assert.ok(world.player.pos.distanceTo(bodyPosition) < .01, `stale movement ${iteration}`);
      key('KeyN'); assert.equal(world.travelPanel.open, true); key('Escape'); assert.equal(world.travelPanel.open, false); assert.equal(document.pointerLockElement, null);
      settingsOpen.click(); assert.equal(world.settingsPanel.open, true);
      language.value = iteration % 2 ? 'en' : 'zh'; language.dispatchEvent(new window.Event('change', { bubbles: true }));
      settingsClose.click(); assert.equal(world.settingsPanel.open, false); await enter();
      if (iteration % 10 === 0) { key('KeyR'); assert.equal(document.pointerLockElement, null); await enter(); }
      window.dispatchEvent(new window.Event('blur')); frame();
      const cooldown = world.actions.skills.cooldown('ultimate');
      assert.ok(cooldown <= previousCooldown && cooldown > 0, `no cooldown reset/refund ${iteration}`); previousCooldown = cooldown;
      assert.equal(world.actions.skills.energy, 0); assert.equal(world.actions.skills.casting, false);
      assert.equal(document.querySelectorAll('*').length, nodes, `connected DOM bounded ${iteration}`);
      const added: string[] = []; world.scene.traverse((object: any) => { if (!baselineObjects.has(object)) added.push(`${object.name}:${object.type}:${object.parent?.name}`); });
      assert.equal(sceneNodes(), sceneBaseline, `scene graph bounded ${iteration}: ${added.join(', ')}`);
      assert.equal(state.defeated, false); assert.equal(world.done.has('armory_rack'), true);
    }
    assert.equal(confirmations, 6);
    const retained = [...registrations.values()].flatMap(events => [...events.values()]).reduce((sum, listeners) => sum + listeners.size, 0);
    assert.equal(retained, 0, 'no additional listeners accumulate on persistent DOM/window/document targets');
    assert.equal(h.errors.length, 0, JSON.stringify(h.errors));
  } finally { proto.addEventListener = add; proto.removeEventListener = remove; await h.close(); }
});
