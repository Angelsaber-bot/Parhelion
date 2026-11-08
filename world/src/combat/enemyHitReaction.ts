/**
 * How a struck enemy's model reacts for the instant after a hit: a white flash over the first few
 * frames, and a flinch, a lean away from the blow with a small push back that eases out. Driven only by
 * the simulation's hit timer, so the reaction lasts exactly as long as the hit does and never moves
 * the enemy itself. A boss barely rocks; a fighter mid-windup flinches less so its tell still reads.
 */
import type { Enemy } from './combat';

export const HIT_REACTION = Object.freeze({ window: .11, flash: .045, lean: .16, push: .14, boss: .35, windup: .5 });

export function enemyHitReaction(e: Pick<Enemy, 'hitTime' | 'kind' | 'mode' | 'pacified'>): { flash: boolean; lean: number; push: number } {
  const left = Math.max(0, Math.min(HIT_REACTION.window, e.hitTime || 0));
  if (!left || e.pacified || e.mode === 'dead') return { flash: false, lean: 0, push: 0 };
  const s = left / HIT_REACTION.window, ease = s * s * (3 - 2 * s);
  const weight = (e.kind === 'king' ? HIT_REACTION.boss : 1) * (e.mode === 'windup' ? HIT_REACTION.windup : 1);
  return { flash: HIT_REACTION.window - left < HIT_REACTION.flash, lean: -HIT_REACTION.lean * ease * weight, push: -HIT_REACTION.push * ease * weight };
}
