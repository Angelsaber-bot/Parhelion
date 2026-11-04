import type { Enemy } from './combat';
/** A named NEW story elite, not a replacement for the four era bosses. Health uses
 * the existing Oath Knight tier; authored geometry/timing, no arbitrary stat overrides.
 */
export const ECHO_WARDEN = { hp: 264, range: 17, thrustLength: 7.5, stanceBreak: 1.0 } as const;
const first = { sweep: { windup: 1.3, recovery: 1.8 }, thrust: { windup: 1.2, recovery: 1.65 }, burst: { windup: 1.4, recovery: 1.75 }, shot: { windup: 1.4, recovery: 1.75 } } as const;
const second = { sweep: { windup: 1.15, recovery: 1.65 }, thrust: { windup: 1.1, recovery: 1.55 }, burst: { windup: 1.3, recovery: 1.7 }, shot: { windup: 1.3, recovery: 1.7 } } as const;
export const echoWardenTiming = (e: Pick<Enemy,'phase'|'attack'>) => (e.phase === 1 ? first : second)[e.attack];
/**
 * Each domain's warden carries its region's signature into phase 2 (after the stance break):
 * 落日王国 shieldbearer — the tower shield stops rifle rounds from the front (blade or flank);
 * 黑帆尽头 powder — bursts become keg barrages with a wider blast ring;
 * 永冬之城 jaeger — at range the third beat is an aimed long shot (break line of sight or sidestep);
 * 业火京都 shinobi — vanishes and reappears behind the player (see combat.ts, SHINOBI_BLINK).
 */
export const WARDEN_SIGNATURE = { kegRadius: 3.9, shotRadius: 1.25, shotDamage: 22, shotMin: 9 } as const;
type WardenView = Pick<Enemy,'attack'> & Partial<Pick<Enemy,'phase'|'role'>>;
export const echoWardenRadius = (e: WardenView) => e.attack === 'thrust' ? .95 : e.attack === 'sweep' ? 3.5 : e.attack === 'shot' ? WARDEN_SIGNATURE.shotRadius
  : e.phase === 2 && e.role === 'powder' ? WARDEN_SIGNATURE.kegRadius : 2.8;
export const echoWardenDamage = (e: Pick<Enemy,'attack'>) => e.attack === 'shot' ? WARDEN_SIGNATURE.shotDamage : e.attack === 'burst' ? 16 : 18;
/** Reach margins prevent a decorative, impossible thrust. No target tracking after tell. */
export function chooseEchoWardenAttack(e: Pick<Enemy,'attackCount'> & Partial<Pick<Enemy,'phase'|'role'>>, distance: number): Enemy['attack'] {
  const beat = e.attackCount % 3;
  if (beat === 0 && distance <= 7) return 'thrust';
  if (beat === 1 && distance < 3.2) return 'sweep';
  if (e.phase === 2 && e.role === 'jaeger' && distance >= WARDEN_SIGNATURE.shotMin) return 'shot';
  return 'burst';
}
