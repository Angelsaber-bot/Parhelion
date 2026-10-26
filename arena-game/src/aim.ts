/** Client-only ADS; no accuracy bonus and no new network state. */
export const AIM_FOV = [56, 62, 24, 58, 16, 78, 78, 78] as const;
export const isScopedWeapon = (weapon: number) => weapon === 2 || weapon === 4;
export const canAimWeapon = (weapon: number) => weapon >= 0 && weapon < 5;
export class AimState {
  value = 0;
  private weapon = -1;
  reset() { this.value = 0; }
  update(dt: number, held: boolean, active: boolean, weapon: number) {
    if (!active || !canAimWeapon(weapon) || weapon !== this.weapon) { this.reset(); this.weapon = weapon; return this.value; }
    this.value += ((held ? 1 : 0) - this.value) * (1 - Math.exp(-Math.max(0, dt) * 18));
    if (this.value < 0.001) this.value = 0;
    if (this.value > 0.999) this.value = 1;
    return this.value;
  }
  fov(weapon: number) { return 78 + ((AIM_FOV[weapon] ?? 56) - 78) * this.value; }
}
export function aimSensitivity(fov: number, preference = 0.85) {
  return Math.tan(fov * Math.PI / 360) / Math.tan(78 * Math.PI / 360) * preference;
}
