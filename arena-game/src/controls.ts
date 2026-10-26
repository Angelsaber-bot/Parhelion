// Keyboard + mouse sampling. Keys are cleared on every lifecycle event that can swallow a keyup
// (blur, visibility, pointer-lock loss) so movement never sticks.

import { WEAPONS } from '../shared/content.ts';
import { BTN } from '../shared/sim.ts';

const BIND: Record<string, number> = {
  Space: BTN.JUMP,
  ShiftLeft: BTN.DASH, ShiftRight: BTN.DASH, KeyE: BTN.DASH,
  KeyQ: BTN.SHIELD,
  KeyR: BTN.RELOAD,
};

export class Controls {
  yaw = 0;
  pitch = 0;
  weapon = 0;
  sensitivity = 0.0022;
  scoreboard = false;
  private keys = new Set<string>();
  private mouseDown = false;
  private latched = 0; // presses that happened between ticks, held for one tick
  onLockChange: (locked: boolean) => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    const clear = () => { this.keys.clear(); this.mouseDown = false; this.scoreboard = false; };
    addEventListener('keydown', (e) => {
      if (!this.locked) return;
      if (e.code === 'Tab') { e.preventDefault(); this.scoreboard = true; return; }
      if (/^Digit[1-9]$/.test(e.code)) {
        const n = Number(e.code.slice(5)) - 1;
        if (n < WEAPONS.length) this.weapon = n;
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) { clear(); return; }
      if (e.repeat) return;
      this.keys.add(e.code);
      this.latched |= BIND[e.code] ?? 0;
      if (BIND[e.code] || e.code.startsWith('Key') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Tab') this.scoreboard = false;
    });
    addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    document.addEventListener('pointerlockchange', () => { clear(); this.onLockChange(this.locked); });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouseDown = true; this.latched |= BTN.FIRE; }
      if (e.button === 2) this.latched |= BTN.SHIELD;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - e.movementY * this.sensitivity));
    });
    addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.weapon = (this.weapon + (e.deltaY > 0 ? 1 : WEAPONS.length - 1)) % WEAPONS.length;
    });
  }

  /** Automated browser tests can't take pointer lock; ?test treats the page as locked. */
  force = false;

  get locked() { return this.force || document.pointerLockElement === this.canvas; }

  lock() { void this.canvas.requestPointerLock(); }

  /** Movement axes and button mask for one simulation tick. */
  sample(): { mx: number; mz: number; buttons: number } {
    const k = this.keys;
    const mz = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let buttons = this.latched;
    this.latched = 0;
    for (const code of k) buttons |= BIND[code] ?? 0;
    if (this.mouseDown) buttons |= BTN.FIRE;
    return { mx, mz, buttons };
  }
}
