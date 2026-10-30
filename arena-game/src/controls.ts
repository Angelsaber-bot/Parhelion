// Configurable browser input. Simulation only receives its existing bitmask plus authoritative crouch.
import { BTN } from '../shared/sim.ts';
import { SettingsStore } from '../../shared-client/settings.ts';
const BUTTONS: Record<string, number> = { jump: BTN.JUMP, dash: BTN.DASH, shield: BTN.SHIELD, reload: BTN.RELOAD, fire: BTN.FIRE, crouch: BTN.CROUCH };
export class Controls {
  yaw = 0;
  pitch = 0;
  weapon = 0;
  sensitivity = .0022;
  aimHeld = false;
  lookScale = 1;
  scoreboard = false;
  /** Results-only display state; S never enters the live movement binding table. */
  resultsScoreboard = false;
  blocked = false;
  private keys = new Set<string>();
  private latched = 0;
  onLockChange: (locked: boolean) => void = () => {};
  onSettings: () => void = () => {};
  constructor(private canvas: HTMLCanvasElement, readonly settings = new SettingsStore('arena')) {
    settings.subscribe(() => this.clearAll());
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) { this.clearAll(); return; }
      if (!this.locked) return;
      if (this.settings.action(e.code)) { e.preventDefault(); this.press(e.code, e.repeat); }
    });
    addEventListener('keyup', (e) => this.release(e.code));
    addEventListener('blur', () => this.clearAll());
    document.addEventListener('visibilitychange', () => this.clearAll());
    document.addEventListener('pointerlockchange', () => { this.clearAll(); this.onLockChange(this.locked); });
    canvas.addEventListener('mousedown', (e) => { if (this.locked) { e.preventDefault(); this.press(`Mouse${e.button}`); } });
    addEventListener('mouseup', (e) => this.release(`Mouse${e.button}`));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('auxclick', (e) => { if (this.locked) e.preventDefault(); });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const sensitivity = this.sensitivity * this.settings.value.sensitivity * this.lookScale;
      this.yaw -= e.movementX * sensitivity;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - e.movementY * sensitivity * (this.settings.value.invertY ? -1 : 1)));
    });
    addEventListener('wheel', (e) => {
      if (!this.locked) return;
      e.preventDefault();
      const binding = e.deltaY > 0 ? 'WheelDown' : 'WheelUp';
      this.press(binding); this.release(binding); // wheel actions are pulses, never stuck holds
    }, { passive: false });
  }
  private press(binding: string, repeat = false) {
    const action = this.settings.action(binding);
    if (!action || repeat) return;
    if (action === 'settings') { this.clearAll(); this.onSettings(); return; }
    this.keys.add(binding);
    this.latched |= BUTTONS[action] ?? 0;
    if (action === 'aim') this.aimHeld = true;
    if (action === 'scoreboard') this.scoreboard = true;
    if (/^weapon[1-3]$/.test(action)) { this.weapon = Number(action.slice(-1)) - 1; this.clearAim(); }
    if (action === 'nextWeapon' || action === 'prevWeapon') {
      this.clearAim(); this.weapon = (this.weapon + (action === 'nextWeapon' ? 1 : 2)) % 3;
    }
  }
  private release(binding: string) {
    this.keys.delete(binding);
    const action = this.settings.action(binding);
    if (action === 'aim') this.aimHeld = this.settings.isDown(this.keys, 'aim');
    if (action === 'scoreboard') this.scoreboard = this.settings.isDown(this.keys, 'scoreboard');
  }
  /** Automated browser tests may explicitly bypass pointer lock; menus still block them. */
  force = false;
  get locked() { return !this.blocked && (this.force || document.pointerLockElement === this.canvas); }
  get adsSensitivity() { return this.settings.value.adsSensitivity; }
  clearAim() { for (const binding of this.settings.bindingsFor('aim')) this.keys.delete(binding); this.aimHeld = false; this.lookScale = 1; }
  /** One-shot button for the next input sample (fixed keys outside the rebinding table). */
  pulse(bit: number) { if (this.locked) this.latched |= bit; }
  clearAll() { this.keys.clear(); this.latched = 0; this.scoreboard = false; this.clearAim(); }
  lock() { if (!this.blocked) void this.canvas.requestPointerLock(); }
  sample(): { mx: number; mz: number; buttons: number } {
    if (this.blocked) { this.clearAll(); return { mx: 0, mz: 0, buttons: 0 }; }
    const down = (action: string) => this.settings.isDown(this.keys, action);
    const mz = Number(down('forward')) - Number(down('back'));
    const mx = Number(down('right')) - Number(down('left'));
    let buttons = this.latched; this.latched = 0;
    for (const [action, bit] of Object.entries(BUTTONS)) if (down(action)) buttons |= bit;
    return { mx, mz, buttons };
  }
}
