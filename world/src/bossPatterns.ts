import type { Enemy } from './combat';

type Timing = { readonly windup: number; readonly recovery: number };
const KING: readonly Timing[] = [{ windup: 1.4, recovery: 1.4 }, { windup: 1, recovery: 1.1 }];
const CANNON: readonly Timing[] = [{ windup: 1.2, recovery: 1.8 }, { windup: 1, recovery: 1.5 }];
const BROADSIDE: readonly Timing[] = [{ windup: 1.6, recovery: 1.5 }, { windup: 1.3, recovery: 1.3 }];
const ICE_THRUST: readonly Timing[] = [{ windup: 1.4, recovery: 1.6 }, { windup: 1.15, recovery: 1.35 }];
const ICE_BURST: readonly Timing[] = [{ windup: 1.7, recovery: 1.5 }, { windup: 1.4, recovery: 1.25 }];
const FIRE_FIRST: readonly Timing[] = [{ windup: 1, recovery: .55 }, { windup: .85, recovery: .55 }];
const FIRE_SECOND: readonly Timing[] = [{ windup: 1, recovery: 1.6 }, { windup: .85, recovery: 1.4 }];
const FIRE_THRUST: readonly Timing[] = [{ windup: 1.3, recovery: 1.8 }, { windup: 1.1, recovery: 1.6 }];

/** Distinct chapter rhythms; every follow-up has a full tell and a punish window. */
export function bossAttackTiming(e: Enemy): Timing {
  const phase = e.phase - 1;
  if (e.id === 'boss_drowned_admiral') return (e.attack === 'shot' ? CANNON : BROADSIDE)[phase];
  if (e.id === 'boss_winter_warden') return (e.attack === 'thrust' ? ICE_THRUST : ICE_BURST)[phase];
  if (e.id === 'boss_hellfire_lord') return (e.attack === 'thrust' || e.attack === 'burst' ? FIRE_THRUST : e.attackCount % 3 === 1 ? FIRE_FIRST : FIRE_SECOND)[phase];
  return KING[phase];
}
export function chooseBossAttack(e: Enemy, distance: number): Enemy['attack'] {
  if (e.id === 'boss_drowned_admiral' && distance >= 6 && e.attackCount % 3 === 2) return 'shot';
  if (distance >= 6) return 'burst';
  if (e.id === 'boss_winter_warden' && e.attackCount % 2 === 1) return 'thrust';
  if (e.id === 'boss_hellfire_lord' && e.attackCount % 3 === 2) return 'thrust';
  return 'sweep';
}
export function bossAttackDamage(e: Enemy): number {
  const stronger = e.phase === 2;
  if (e.id === 'boss_drowned_admiral') return e.attack === 'shot' ? stronger ? 25 : 20 : stronger ? 29 : 23;
  if (e.id === 'boss_hellfire_lord' && e.attack === 'sweep') return stronger ? 23 : 18;
  return stronger ? 32 : 25;
}
