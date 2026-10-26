import { afterEach, describe, expect, it, vi } from 'vitest';
import { AimState, aimSensitivity } from '../src/aim.ts';
import { Controls } from '../src/controls.ts';
import { buildFighter, FighterAnimator } from '../src/fighter.ts';
import * as THREE from 'three';
import { BTN } from '../shared/sim.ts';
class Target {
  listeners = new Map<string, ((e: any) => unknown)[]>();
  addEventListener(type: string, fn: (e: any) => unknown) { this.listeners.set(type, [...this.listeners.get(type) ?? [], fn]); }
  emit(type: string, e: object = {}) { for (const fn of this.listeners.get(type) ?? []) fn({ preventDefault() {}, ...e }); }
}
function setup() {
  const window = new Target(), canvas = new Target(), document = Object.assign(new Target(), { pointerLockElement: canvas });
  vi.stubGlobal('addEventListener', window.addEventListener.bind(window)); vi.stubGlobal('document', document);
  return { window, canvas, document, controls: new Controls(canvas as unknown as HTMLCanvasElement) };
}
afterEach(() => vi.unstubAllGlobals());
it('ADS zoom interpolates and clears on inactive state or weapon change; sensitivity follows zoom', () => {
  const aim = new AimState(); aim.update(.1, true, true, 0);
  for (let i = 0; i < 30; i++) aim.update(.05, true, true, 0);
  expect(aim.value).toBe(1); expect(aim.fov(0)).toBe(56); expect(aimSensitivity(24)).toBeLessThan(aimSensitivity(56));
  aim.update(.1, true, false, 0); expect(aim.value).toBe(0);
  aim.update(.1, true, true, 0); expect(aim.value).toBeGreaterThan(0);
  aim.update(.1, true, true, 2); expect(aim.value).toBe(0);
});
it('right mouse aims instead of raising shield; Q still shields and left mouse still fires', () => {
  const { controls, canvas, window } = setup();
  canvas.emit('mousedown', { button: 2 }); expect(controls.aimHeld).toBe(true); expect(controls.sample().buttons & BTN.SHIELD).toBe(0);
  window.emit('keydown', { code: 'KeyQ' }); expect(controls.sample().buttons & BTN.SHIELD).toBe(BTN.SHIELD);
  canvas.emit('mousedown', { button: 0 }); expect(controls.sample().buttons & BTN.FIRE).toBe(BTN.FIRE);
  window.emit('mouseup', { button: 2 }); expect(controls.aimHeld).toBe(false);
});
for (const event of ['blur', 'visibilitychange', 'pointerlockchange', 'wheel', 'weapon']) it(`ADS clears on ${event}`, () => {
  const { controls, canvas, window, document } = setup(); canvas.emit('mousedown', { button: 2 }); controls.lookScale = .2;
  if (event === 'visibilitychange' || event === 'pointerlockchange') document.emit(event);
  else if (event === 'weapon') window.emit('keydown', { code: 'Digit2' });
  else window.emit(event, { deltaY: 1 });
  expect(controls.aimHeld).toBe(false); expect(controls.lookScale).toBe(1);
});

it('custom keyboard/mouse bindings, sensitivity, crouch and rebind cancellation execute real handlers', () => {
  const { controls, canvas, window } = setup();
  controls.settings.bind('forward', 'Mouse3'); canvas.emit('mousedown', { button: 3 }); expect(controls.sample().mz).toBe(1);
  controls.settings.bind('fire', 'KeyP'); expect(controls.sample().mz).toBe(0);
  window.emit('keydown', { code: 'KeyP' }); expect(controls.sample().buttons & BTN.FIRE).toBe(BTN.FIRE);
  window.emit('keyup', { code: 'KeyP' }); expect(controls.sample().buttons & BTN.FIRE).toBe(0);
  window.emit('keydown', { code: 'KeyC' }); expect(controls.sample().buttons & BTN.CROUCH).toBe(BTN.CROUCH);
  window.emit('keyup', { code: 'KeyC' }); expect(controls.sample().buttons & BTN.CROUCH).toBe(0);
  controls.settings.update({ sensitivity: 2, invertY: true });
  window.emit('mousemove', { movementX: 10, movementY: 10 }); expect(controls.yaw).toBeCloseTo(-.044); expect(controls.pitch).toBeCloseTo(.044);
  controls.blocked = true; canvas.emit('mousedown', { button: 0 }); window.emit('keydown', { code: 'KeyC' });
  expect(controls.sample()).toEqual({ mx: 0, mz: 0, buttons: 0 });
});

it('remote crouch visibly bends knees and places the head within the short hull', () => {
  for (const char of [0, 1]) {
    const rig = buildFighter(char, 0x55eeee), anim = new FighterAnimator(rig);
    for (let i = 0; i < 90; i++) anim.update(1/60, 0, 0, true);
    rig.root.updateMatrixWorld(true);
    const head = rig.joints.Head.getWorldPosition(new THREE.Vector3()).y + .11;
    expect(head).toBeGreaterThan(.97); expect(head).toBeLessThan(1.03);
    expect(rig.joints.Thigh_L.rotation.x).toBeGreaterThan(1);
    expect(rig.joints.Shin_L.rotation.x).toBeLessThan(-2);
    for (let i = 0; i < 90; i++) anim.update(1/60, 0, 0, false);
    expect(rig.aim.position.y).toBeGreaterThan(1.3);
  }
});
