// Client-only gun feel: camera kick and recovery, screen shake, FOV punch and crosshair bloom.
// The aim kick really moves the player's view (and so the next shots); most of it springs back
// on its own, like the recoil pattern of a mature shooter. None of this touches shared rules.

import type { Controls } from './controls.ts';

interface WeaponFeel {
  kick: number; // visual camera pitch per shot (rad), recovers fast
  kickYaw: number; // random visual yaw per shot
  aimKick: number; // how far the real aim climbs per shot
  aimReturn: number; // fraction of the aim climb that springs back
  shake: number; // screen-shake amplitude added per shot
  fov: number; // FOV punch in degrees
  bloom: number; // crosshair spread per shot (0..1)
  roll: number; // camera roll kick
}

export const FEEL: WeaponFeel[] = [
  { kick: 0.014, kickYaw: 0.006, aimKick: 0.0055, aimReturn: 0.7, shake: 0.004, fov: 0.7, bloom: 0.18, roll: 0.004 }, // Lumen AR
  { kick: 0.075, kickYaw: 0.016, aimKick: 0.022, aimReturn: 0.85, shake: 0.03, fov: 4.5, bloom: 0.9, roll: 0.02 }, // Corona SG
  { kick: 0.05, kickYaw: 0.008, aimKick: 0.016, aimReturn: 0.9, shake: 0.014, fov: 2.4, bloom: 0.6, roll: 0.01 }, // Halo DMR
  { kick: 0.009, kickYaw: 0.005, aimKick: 0.0035, aimReturn: 0.65, shake: 0.003, fov: 0.4, bloom: 0.13, roll: 0.003 }, // Firefly SMG
  { kick: 0.09, kickYaw: 0.009, aimKick: 0.028, aimReturn: 0.9, shake: 0.02, fov: 3.5, bloom: 0.8, roll: 0.015 }, // Longnight sniper
];

export class Feel {
  pitch = 0;
  yaw = 0;
  roll = 0;
  fov = 0;
  bloom = 0;
  private shakeAmp = 0;
  private aimDebt = 0; // aim climb still to be returned
  private t = 0;

  fire(weapon: number) {
    const f = FEEL[weapon] ?? FEEL[0];
    this.pitch += f.kick;
    this.yaw += (Math.random() - 0.5) * 2 * f.kickYaw;
    this.roll += (Math.random() - 0.5) * 2 * f.roll;
    this.fov += f.fov;
    this.shakeAmp = Math.min(0.05, this.shakeAmp + f.shake);
    this.bloom = Math.min(1, this.bloom + f.bloom);
    return f;
  }

  /** Climb the real aim; part of it is paid back over the next few frames. */
  kickAim(controls: Controls, weapon: number) {
    const f = FEEL[weapon] ?? FEEL[0];
    const k = f.aimKick * (0.8 + Math.random() * 0.4);
    controls.pitch = Math.min(1.45, controls.pitch + k);
    controls.yaw += (Math.random() - 0.5) * f.aimKick * 0.5;
    this.aimDebt += k * f.aimReturn;
  }

  hurt(amount: number) {
    this.shakeAmp = Math.min(0.06, this.shakeAmp + 0.004 * amount / 10);
    this.roll += (Math.random() - 0.5) * 0.03;
  }

  update(dt: number, controls: Controls, moving: number) {
    this.t += dt;
    const fast = 1 - Math.exp(-dt * 16), slow = 1 - Math.exp(-dt * 9);
    this.pitch -= this.pitch * fast;
    this.yaw -= this.yaw * fast;
    this.roll -= this.roll * slow;
    this.fov -= this.fov * slow;
    this.shakeAmp -= this.shakeAmp * (1 - Math.exp(-dt * 10));
    const pay = this.aimDebt * (1 - Math.exp(-dt * 7));
    controls.pitch -= pay;
    this.aimDebt -= pay;
    const rest = moving * 0.35;
    this.bloom += (rest - this.bloom) * (1 - Math.exp(-dt * (this.bloom > rest ? 6 : 12)));
  }

  /** Total view offsets for this frame: [pitch, yaw, roll]. */
  offsets(): [number, number, number] {
    const s = this.shakeAmp, t = this.t * 60;
    return [
      this.pitch + Math.sin(t * 1.7) * s,
      this.yaw + Math.sin(t * 2.3 + 1) * s * 0.8,
      this.roll + Math.sin(t * 1.1 + 2) * s * 0.5,
    ];
  }
}
