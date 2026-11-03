import type { EnemyKind, Point3 } from './combat';
import { regionAt } from './regions';

export type EnemyRole = 'stalker' | 'duelist' | 'breaker' | 'bombardier' | 'musketeer' | 'lancer' | 'shieldbearer' | 'shinobi' | 'powder';
export interface EnemyRoleProfile {
  readonly name: readonly [string, string];
  readonly counter: readonly [string, string];
  readonly attack: 'sweep' | 'burst' | 'shot' | 'thrust';
  readonly range: number; readonly radius: number; readonly speed: number;
  readonly windup: number; readonly recovery: number; readonly damage: number;
  readonly paired?: boolean;
}
export const SHINOBI_BLINK = Object.freeze({ min: 5, max: 15, behind: 1.8, cooldown: 6.5, first: 1.5 });
/** Shared immutable profiles: no new enemies, health inflation, or tick-time profile allocation. */
export const ENEMY_ROLES: Readonly<Record<EnemyRole, EnemyRoleProfile>> = {
  lancer: { name: ['长兵突刺手', 'Lancer'], counter: ['横向闪开直线突刺，绕侧反击', 'Sidestep the locked thrust and flank'], attack: 'thrust', range: 5, radius: .85, speed: 3.3, windup: 1.1, recovery: 1.7, damage: 17 },
  stalker: { name: ['游猎者', 'Stalker'], counter: ['退开横扫，再近身反击', 'Step outside the sweep, then punish'], attack: 'sweep', range: 2, radius: 2.4, speed: 3.8, windup: .8, recovery: 1.25, damage: 12 },
  duelist: { name: ['双斩剑士', 'Duelist'], counter: ['躲开两斩，抓住第二斩后的空隙', 'Evade both cuts; punish after the second'], attack: 'sweep', range: 2.5, radius: 2.9, speed: 4, windup: .85, recovery: 1.8, damage: 10, paired: true },
  breaker: { name: ['重击卫士', 'Breaker'], counter: ['重击蓄力很长；近战打断或退开', 'Interrupt the long windup with melee, or retreat'], attack: 'sweep', range: 3, radius: 3.7, speed: 2.8, windup: 1.35, recovery: 2, damage: 20 },
  bombardier: { name: ['投射哨兵', 'Bombardier'], counter: ['离开落点，贴近可打断蓄力', 'Leave the marked impact; close in to interrupt'], attack: 'burst', range: 17, radius: 2.8, speed: 2.6, windup: 1.4, recovery: 1.8, damage: 16 },
  // 落日王国 signature: a tower shield eats rifle rounds from the front; the shield charge
  // commits it, and the recovery after a missed charge (or the blade) is the answer.
  shieldbearer: { name: ['持盾骑士', 'Shieldbearer'], counter: ['盾挡子弹：侧闪躲开盾冲，趁它收势或用近战破防', 'The shield stops bullets: sidestep the charge, then punish the recovery or use the blade'], attack: 'thrust', range: 6, radius: 1.1, speed: 3.1, windup: 1.05, recovery: 2.1, damage: 15 },
  // 业火京都 signature: vanishes in a smoke puff and reappears behind the player for a quick cut.
  shinobi: { name: ['影忍', 'Shinobi'], counter: ['黑烟一闪它就在你背后：立刻闪避或回身近战', 'Smoke means it is behind you: evade at once or turn and cut'], attack: 'sweep', range: 2.2, radius: 2.3, speed: 4.2, windup: .85, recovery: 1.5, damage: 11 },
  // 黑帆尽头 signature: charges in with a lit keg; the blast stuns the carrier too. Run out of the ring, then punish.
  powder: { name: ['火药水手', 'Powder Monkey'], counter: ['点燃火药桶后快跑出圈，爆炸会把它自己震晕，趁机反击', 'Once the keg is lit, get out of the ring; the blast stuns it, so punish'], attack: 'sweep', range: 2.4, radius: 3.4, speed: 4.4, windup: 1.6, recovery: 2.6, damage: 24 },
  musketeer: { name: ['燧发枪手', 'Musketeer'], counter: ['侧移或找掩体，装填时反击', 'Sidestep or take cover; punish the reload'], attack: 'shot', range: 24, radius: 1.4, speed: 3, windup: 1.2, recovery: 2, damage: 14 },
};
export function enemyIdHash(id: string): number {
  let value = 0;
  for (let i = 0; i < id.length; i++) value = (Math.imul(value, 31) + id.charCodeAt(i)) >>> 0;
  return value;
}
/** Assign once from stable ID/home. Appearance can read the same profile without random rolls. */
export function selectEnemyRole(e: { id: string; kind: EnemyKind; home: Point3; miniboss?: string }): EnemyRole {
  const region = regionAt(e.home.x, e.home.z).id, hash = enemyIdHash(e.id);
  if (region === 'winter' && e.kind !== 'king' && !e.miniboss && hash % 3 !== 0) return 'musketeer';
  if (region === 'kyoto') return hash % 3 === 0 ? 'lancer' : hash % 3 === 1 && !e.miniboss && e.kind !== 'king' ? 'shinobi' : 'duelist';
  if (region === 'britain') return hash % 3 === 0 && !e.miniboss && e.kind !== 'king' ? 'shieldbearer' : hash % 2 === 0 ? 'breaker' : 'duelist';
  if (region === 'blacksail') return hash % 3 === 0 ? 'bombardier' : hash % 3 === 1 && !e.miniboss && e.kind !== 'king' ? 'powder' : 'duelist';
  if (region === 'winter') return 'breaker';
  return e.kind === 'crystal' ? 'bombardier' : hash % 3 === 0 ? 'breaker' : 'stalker';
}
