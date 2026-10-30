import type { Point3 } from './combat';
import type { StrikeOriginGeometry } from './combatActions';
import type { ServantId } from './contracts';

export type SkillSlot = 'skill' | 'ultimate';
export type SkillIdentity = ServantId | null;
interface Pattern { at: number; range: number; halfWidth: number; damage: number; maxTargets: number }
export interface SkillDefinition {
  name: string; nameEn: string; cooldown: number; duration: number;
  guard?: number; pulses: readonly Pattern[];
}
const pulse = (at: number, range: number, halfWidth: number, damage: number, maxTargets = 3): Pattern => ({ at, range, halfWidth, damage, maxTargets });
/** Budgets are per target, not per rendered particle. No effect teleports its caster. */
export const CONTRACT_SKILLS: Readonly<Record<ServantId | 'player', Readonly<Record<SkillSlot, SkillDefinition>>>> = {
  player: {
    skill: { name: '破阵脉冲', nameEn: 'Disruption Pulse', cooldown: 7, duration: .6, guard: .65, pulses: [pulse(.25, 3.8, 2.1, 30)] },
    ultimate: { name: '曙光反击', nameEn: 'Dawn Counter', cooldown: 24, duration: 1.1, guard: 1.1, pulses: [pulse(.55, 6, 3, 90)] },
  },
  saber: {
    skill: { name: '风王剑波', nameEn: 'Windguard Wave', cooldown: 8, duration: .8, guard: 1, pulses: [pulse(.35, 11, 1.7, 46)] },
    ultimate: { name: '誓约之光', nameEn: 'Oath of Light', cooldown: 28, duration: 1.4, guard: 1.4, pulses: [pulse(.7, 18, 2.4, 138, 4)] },
  },
  blackbeard: {
    skill: { name: '破阵枪击', nameEn: 'Breach Shot', cooldown: 8, duration: 1.4, pulses: [pulse(17 / 30, 23, .85, 51, 1)] },
    ultimate: { name: '黑帆炮列', nameEn: 'Black Sail Broadside', cooldown: 28, duration: 1.6, pulses: [pulse(.5, 25, 2, 48), pulse(.85, 25, 2, 48), pulse(1.2, 25, 2, 48)] },
  },
  napoleon: {
    skill: { name: '鹰旗突击', nameEn: 'Eagle Charge', cooldown: 9, duration: 1, pulses: [pulse(.55, 13, 1.8, 56)] },
    ultimate: { name: '帝国铁骑', nameEn: 'Imperial Cavalry', cooldown: 30, duration: 1.5, pulses: [pulse(.75, 20, 2.5, 155, 4)] },
  },
  musashi: {
    skill: { name: '二天双斩', nameEn: 'Twin Heavens', cooldown: 7, duration: .8, pulses: [pulse(.2, 4.8, 2.5, 27), pulse(.5, 5.4, 2.8, 29)] },
    ultimate: { name: '无空连刃', nameEn: 'Void Blades', cooldown: 26, duration: 1.4, pulses: [pulse(.35, 6, 3, 48), pulse(.65, 6.5, 3, 48), pulse(1, 7, 3.2, 60)] },
  },
};
interface SkillPose extends StrikeOriginGeometry { identity: SkillIdentity; slot: SkillSlot; origin: Point3; direction: Point3 }
export interface SkillStrike extends SkillPose, Pattern { type: 'strike'; pulse: number }
export type SkillEvent = SkillStrike
  | (SkillPose & { type: 'cast'; duration: number })
  | { type: 'guard'; duration: number; multiplier: number };
export interface SkillContext { enabled: boolean; origin: Point3; direction: Point3 }
export interface SkillDamage { id: string; damage: number; eligible: boolean; source: 'weapon' | 'melee' | 'skill' | 'ultimate' }
const finitePoint = (p: Point3) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);

/** A directional ground corridor. The combat adapter must additionally check live HP and LOS. */
export function skillContains(strike: SkillStrike, point: Point3): boolean {
  if (!finitePoint(point) || (strike.losOffset !== undefined && strike.losOffset !== 0 && strike.losOffset !== 1) ||
    (strike.casterFeetY !== undefined && !Number.isFinite(strike.casterFeetY)) ||
    (strike.losOffset === 0 && strike.casterFeetY === undefined)) return false;
  const dx = point.x - strike.origin.x, dz = point.z - strike.origin.z;
  const forward = dx * strike.direction.x + dz * strike.direction.z;
  const side = dx * strike.direction.z - dz * strike.direction.x;
  return forward >= 0 && forward <= strike.range && Math.abs(side) <= strike.halfWidth && Math.abs(point.y - (strike.casterFeetY ?? strike.origin.y)) <= 2.6;
}

/** Input-independent deterministic clock. Pausing cancels uncommitted pulses, never refunds costs. */
export class ContractSkills {
  private identity: SkillIdentity = null;
  private energyValue = 0;
  private cooldowns = { skill: 0, ultimate: 0 };
  private guardLeft = 0;
  private chargeBudget = 12;
  private events: SkillEvent[] = [];
  private generation = 0;
  private cast?: { pose: SkillPose; definition: SkillDefinition; elapsed: number; next: number; token: number; authored: boolean };
  get energy() { return this.energyValue; }
  get selected() { return this.identity; }
  get guarding() { return this.guardLeft > 0; }
  get casting() { return !!this.cast; }
  definition(slot: SkillSlot) { return CONTRACT_SKILLS[this.identity ?? 'player'][slot]; }
  cooldown(slot: SkillSlot) { return this.cooldowns[slot]; }
  setIdentity(identity: SkillIdentity) {
    if (identity === this.identity) return;
    this.cancel(); this.identity = identity;
  }
  activate(slot: SkillSlot, context: SkillContext): boolean {
    if (!context.enabled || this.cast || this.cooldowns[slot] > 0 || (slot === 'ultimate' && this.energyValue < 100)) return false;
    if (!finitePoint(context.origin) || !finitePoint(context.direction)) return false;
    const length = Math.hypot(context.direction.x, context.direction.z);
    if (length < 1e-6) return false;
    const definition = this.definition(slot);
    const pose: SkillPose = { losOffset: 1, casterFeetY: context.origin.y, identity: this.identity, slot, origin: { ...context.origin }, direction: { x: context.direction.x / length, y: 0, z: context.direction.z / length } };
    this.cooldowns[slot] = definition.cooldown;
    if (slot === 'ultimate') this.energyValue -= 100;
    this.cast = { pose, definition, elapsed: 0, next: 0, token: ++this.generation, authored: false };
    this.events.push({ ...pose, type: 'cast', duration: definition.duration });
    if (definition.guard) {
      this.guardLeft = definition.guard;
      this.events.push({ type: 'guard', duration: definition.guard, multiplier: .55 });
    }
    return true;
  }
  update(dt: number, enabled: boolean) {
    if (!enabled) { this.cancel(); return; }
    if (!Number.isFinite(dt) || dt <= 0) return;
    // The caller owns simulation time; a tab-resume spike must not grant a whole cooldown.
    dt = Math.min(dt, .25);
    this.cooldowns.skill = Math.max(0, this.cooldowns.skill - dt);
    this.cooldowns.ultimate = Math.max(0, this.cooldowns.ultimate - dt);
    this.guardLeft = Math.max(0, this.guardLeft - dt);
    this.chargeBudget = Math.min(12, this.chargeBudget + dt * 12);
    const cast = this.cast;
    if (!cast) return;
    cast.elapsed += dt;
    if (cast.authored) { if (cast.elapsed >= 8) this.cancel(); return; }
    while (cast.next < cast.definition.pulses.length && cast.elapsed + 1e-9 >= cast.definition.pulses[cast.next].at) {
      const index = cast.next++;
      this.events.push({ ...cast.pose, ...cast.definition.pulses[index], type: 'strike', pulse: index });
    }
    if (cast.elapsed + 1e-9 >= cast.definition.duration) this.cast = undefined;
  }
  /** Bind successful actor startup before the next update. Stale callbacks cannot affect a new cast. */
  bindPresentation(): number | null {
    if (!this.cast || this.cast.next > 0) return null;
    this.cast.authored = true; return this.cast.token;
  }
  contact(token: number, origin?: Point3, direction?: Point3, geometry: StrikeOriginGeometry = {}): boolean {
    const cast = this.cast;
    if (!cast || !cast.authored || cast.token !== token || cast.next >= cast.definition.pulses.length) return false;
    if (origin && !finitePoint(origin)) return false;
    const losOffset = geometry.losOffset ?? 1;
    if ((losOffset !== 0 && losOffset !== 1) ||
      (geometry.casterFeetY !== undefined && !Number.isFinite(geometry.casterFeetY)) ||
      (losOffset === 0 && geometry.casterFeetY === undefined)) return false;
    const pose = { ...cast.pose, origin: origin ? { ...origin } : cast.pose.origin,
      losOffset, casterFeetY: geometry.casterFeetY ?? origin?.y ?? cast.pose.origin.y };

    if (direction) {
      const length = Math.hypot(direction.x, direction.z);
      if (!finitePoint(direction) || length < 1e-6) return false;
      pose.direction = { x: direction.x / length, y: 0, z: direction.z / length };
    }
    const index = cast.next++;
    this.events.push({ ...pose, ...cast.definition.pulses[index], type: 'strike', pulse: index });
    return true;
  }
  finishPresentation(token: number, completed = true) {
    if (this.cast?.token !== token || !this.cast.authored) return;
    if (!completed) this.cancel(); else this.cast = undefined;
  }
  /** Call only for actual hostile HP lost. Skill chains never recharge themselves.
   * No lifetime enemy-ID cap: a long boss fight or legitimate rematch must keep charging.
   * The bounded token bucket prevents burst/multi-hit farming without retaining enemy IDs. */
  recordDamage(hit: SkillDamage): number {
    if (!hit.eligible || !hit.id || !Number.isFinite(hit.damage) || hit.damage <= 0 || (hit.source !== 'weapon' && hit.source !== 'melee')) return 0;
    const gained = Math.max(0, Math.min(hit.damage * .22, this.chargeBudget, 100 - this.energyValue));
    if (gained <= 0) return 0;
    this.chargeBudget -= gained; this.energyValue += gained;
    return gained;
  }
  drainEvents(): SkillEvent[] { const events = this.events; this.events = []; return events; }
  cancel() { this.cast = undefined; this.guardLeft = 0; this.events.length = 0; }
  reset() { this.cancel(); this.energyValue = 0; this.cooldowns = { skill: 0, ultimate: 0 }; this.chargeBudget = 12; }
}
