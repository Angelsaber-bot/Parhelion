import { enemyAttackTiming, type Enemy } from './combat';

/** The native clips are pose demonstrations, not event tracks. These normalized samples
 * identify the authored extension/cut pose; the SIMULATION remains the sole contact clock.
 * No animation callback can deal damage, repeat an attack or spend player resources.
 */
export const ENEMY_CONTACT_SAMPLE = {
  ashigaru: .375, samurai: .28125, sunward_guard: .5, deck_raider: .5, officer: .5, musketeer: 0,
} as const;
export type EnemyPoseModel = keyof typeof ENEMY_CONTACT_SAMPLE;
export interface EnemyAttackPose {
  clip: 'Idle' | 'Walk' | 'Attack_Windup' | 'Attack' | 'Aim' | 'FirePreview' | 'Hit';
  /** undefined means freely looping locomotion. Otherwise this is an absolute clip sample. */
  sample?: number;
  stage: 'idle' | 'move' | 'anticipation' | 'commit' | 'contact' | 'followThrough' | 'settle' | 'stagger';
}
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
/** Pure, render-rate-independent mapping. The last 200ms of the existing windup plays
 * the weapon's forward stroke. At actual contact the clip is ALREADY at extension,
 * rather than starting an Attack demonstration after the player lost HP.
 * Full advertised windup/recovery durations, footprints and punish windows are unchanged.
 */
export function enemyAttackPose(e: Enemy, model: EnemyPoseModel): EnemyAttackPose {
  const timing = enemyAttackTiming(e), ranged = model === 'musketeer';
  const contact = ENEMY_CONTACT_SAMPLE[model];
  if (e.mode === 'windup') {
    if (ranged) return { clip: 'Aim', sample: clamp(1 - e.timer / timing.windup), stage: 'anticipation' };
    const forward = Math.min(.2, timing.windup * .25);
    if (e.timer > forward) return { clip: 'Attack_Windup', sample: clamp((timing.windup - e.timer) / (timing.windup - forward)), stage: 'anticipation' };
    return { clip: 'Attack', sample: contact * clamp(1 - e.timer / forward), stage: 'commit' };
  }
  if (e.mode === 'recover' && e.contactSequence === e.attackCount && e.attackCount > 0) {
    const elapsed = Math.max(0, timing.recovery - e.timer);
    // Keep a quick recoil/follow-through even when the reload/punish window is long.
    // Hold the authored end pose, then blend naturally to locomotion next state.
    const follow = Math.min(ranged ? .5 : .45, timing.recovery * .8);
    const phase = clamp(elapsed / follow);
    return { clip: ranged ? 'FirePreview' : 'Attack', sample: contact + (1 - contact) * phase,
      stage: elapsed <= 1e-7 ? 'contact' : phase < 1 ? 'followThrough' : 'settle' };
  }
  if (e.mode === 'stagger') return { clip: 'Hit', sample: clamp(1 - e.timer / .9), stage: 'stagger' };
  return e.mode === 'chase' ? { clip: 'Walk', stage: 'move' } : { clip: 'Idle', stage: 'idle' };
}
