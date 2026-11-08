import { WORLD_RIFLE } from '../core/worldBalance';
import type { Localized } from '../settlements/types';
import type { WorldGun } from './worldArsenal';

export interface WeaponAmmoState {
  readonly ammo: number;
  readonly bossStarted: boolean;
  readonly gunVent: number;
  readonly gun: Pick<WorldGun, 'name' | 'ammoCost'>;
}
/** Read-only presentation of the current gun's ammunition requirement. Unlimited
 * boss ammunition does not bypass heat, and a shared reserve can be nonempty but
 * still unable to pay for a heavy shot. This does not change firing eligibility. */
export function weaponAmmoPresentation(state: WeaponAmmoState): {
  text: Localized; description: Localized; tone: 'boss' | 'empty' | 'low' | 'ok';
} {
  const { ammo, gun, bossStarted, gunVent } = state;
  const insufficient = !bossStarted && ammo < gun.ammoCost;
  const text: Localized = bossStarted ? ['∞', '∞'] : ammo <= 0 ? ['近战', 'MELEE']
    : insufficient ? [`${ammo} · 不足`, `${ammo} · NEED ${gun.ammoCost}`] : [`${ammo}`, `${ammo}`];
  const description: Localized = bossStarted
    ? [`${gun.name[0]} · 无限弹药`, `${gun.name[1]} · Unlimited ammunition`]
    : [`${gun.name[0]} · 现有 ${ammo} 发 · 每次射击需要 ${gun.ammoCost} 发`, `${gun.name[1]} · ${ammo} rounds available · ${gun.ammoCost} rounds per shot`];
  if (insufficient) {
    description[0] += ammo > 0 ? ' · 弹药不足，可换低耗弹武器或近战' : ' · 弹药耗尽，可近战或前往安全据点补给';
    description[1] += ammo > 0 ? ' · Insufficient ammunition; switch to a lower-cost gun or use melee' : ' · Out of ammunition; use melee or resupply at a safe settlement';
  }
  if (gunVent > 1e-9) {
    // Never display “0.0s” while firing is still blocked by the remaining vent.
    const seconds = (Math.ceil(gunVent * 10) / 10).toFixed(1);
    text[0] += ` · 散热 ${seconds}s`; text[1] += ` · COOL ${seconds}s`;
    description[0] += ` · 散热剩余 ${seconds} 秒`; description[1] += ` · Cooling for ${seconds} more seconds`;
  }
  return { text, description, tone: bossStarted ? 'boss' : insufficient ? 'empty' : ammo <= WORLD_RIFLE.ammoMax / 6 ? 'low' : 'ok' };
}

/** Call when the combat state reports a dry trigger pull; controls are supplied
 * by the host so remapping is reflected without creating another input binding. */
export function weaponDryFireHint(state: WeaponAmmoState, meleeLabel: string): Localized | null {
  if (state.bossStarted || state.ammo >= state.gun.ammoCost) return null;
  if (state.ammo > 0) return [
    `弹药不足 · 当前武器需要 ${state.gun.ammoCost} 发，现有 ${state.ammo} 发 · 可换低耗弹武器或 [${meleeLabel}] 近战`,
    `Insufficient ammo · This gun needs ${state.gun.ammoCost} rounds; ${state.ammo} available · Switch to a lower-cost gun or [${meleeLabel}] melee`,
  ];
  return [`弹药耗尽 · [${meleeLabel}] 近战，或回安全据点补给`, `Out of ammo · [${meleeLabel}] melee, or resupply at a safe settlement`];
}
