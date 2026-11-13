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
/** 1–3: Meyrick's command-deck stage from remaining strength. */
export function meyrickStage(e: Pick<Enemy, 'hp' | 'maxHp'>): 1 | 2 | 3 { const f = e.hp / e.maxHp; return f > 2 / 3 ? 1 : f > 1 / 3 ? 2 : 3; }
export function chooseBossAttack(e: Enemy, distance: number): Enemy['attack'] {
  // B08 梅瑞克 at the command deck, three stages by strength: (1) reads as a firing rhythm,
  // (2) lift covers rise and boarders press, so he fires every other beat, (3) cornered at the helm:
  // no more cannon, only close sweeps and thrusts in the narrowed space.
  if (e.id === 'boss_drowned_admiral') {
    const stage = meyrickStage(e);
    if (stage < 3 && distance >= 6 && e.attackCount % (stage === 2 ? 2 : 3) === (stage === 2 ? 1 : 2)) return 'shot';
    if (stage === 3 && distance <= 7.5 && e.attackCount % 2 === 1) return 'thrust';
  }
  // An 8m thrust remains a real mid-range threat, not a melee-only animation.
  // Keep a .5m reach margin: targets beyond it receive the existing distant tell instead.
  // Selection happens before attackCount increments; the next beat keeps its full windup.
  if (distance <= 7.5) {
    if (e.id === 'boss_winter_warden' && e.attackCount % 2 === 1) return 'thrust';
    if (e.id === 'boss_hellfire_lord' && e.attackCount % 3 === 2) return 'thrust';
  }
  if (distance >= 6) return 'burst';
  return 'sweep';
}
export function bossAttackDamage(e: Enemy): number {
  const stronger = e.phase === 2;
  if (e.id === 'boss_drowned_admiral') return e.attack === 'shot' ? stronger ? 25 : 20 : stronger ? 29 : 23;
  if (e.id === 'boss_hellfire_lord' && e.attack === 'sweep') return stronger ? 23 : 18;
  return stronger ? 32 : 25;
}
