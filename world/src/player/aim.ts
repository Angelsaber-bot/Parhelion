/** Third-person shoulder ADS; no new damage, weapon class or quest behaviour. */
export class ShoulderAim {
  held = false;
  value = 0;
  clear() { this.held = false; this.value = 0; }
  step(dt: number, active: boolean) {
    if (!active) this.clear();
    this.value += ((this.held ? 1 : 0) - this.value) * (1 - Math.exp(-Math.max(0, dt) * 16));
    if (this.value < 0.001) this.value = 0;
    if (this.value > 0.999) this.value = 1;
    return this.value;
  }
}

export function shoulderArmLength(aim: number, gliding: boolean, obstruction?: number) {
  const desired = gliding ? 5.2 : 3.6 + (1.5 - 3.6) * aim;
  return Math.min(desired, obstruction === undefined ? desired : Math.max(0.08, obstruction - 0.3));
}
