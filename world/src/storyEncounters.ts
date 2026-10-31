import type { Point3, Enemy, SpawnPoint, WorldCombatState } from './combat';
import { ENEMY_ROLES, type EnemyRole } from './enemyRoles';

export interface StoryEncounterActor {
  readonly role: EnemyRole;
  readonly offset: readonly [number, number];
  readonly title?: readonly [string, string];
  readonly pattern?: 'echo-warden';
}
/** Narrative owns stage/catalog lookup. Combat receives geometry + ordinary role data,
 * never save flags, reward grants, arbitrary stats or externally loaded assets.
 */
export interface StoryEncounterSpec {
  readonly id: string;
  readonly anchor: Point3;
  readonly actors: readonly StoryEncounterActor[];
}
export type StoryEncounterStartReason = 'started' | 'active' | 'busy' | 'out-of-range' | 'blocked' | 'invalid' | 'unavailable';
export interface StoryEncounterStartResult { readonly ok: boolean; readonly reason: StoryEncounterStartReason }
export interface StoryEncounterStatus { readonly id: string; readonly remaining: number }
export const STORY_ENCOUNTER_LIMITS = { actors: 3, trigger: 12, leash: 30, height: 8, actorOffset: 10, nearbyPressure: 20 } as const;
export interface StoryEncounterContext {
  readonly state: WorldCombatState;
  readonly player: Point3;
  readonly playable: boolean;
  readonly place: (x: number, z: number) => Point3 | null;
}
const finite = (p: Point3) => !!p && [p.x, p.y, p.z].every(Number.isFinite);
const distance = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.z - b.z);
const valid = (spec: StoryEncounterSpec) => !!spec && typeof spec.id === 'string' && /^false_dawn_[a-z0-9_]{1,48}$/.test(spec.id) && finite(spec.anchor)
  && Array.isArray(spec.actors) && spec.actors.length > 0 && spec.actors.length <= STORY_ENCOUNTER_LIMITS.actors
  && spec.actors.every(actor => !!actor && Object.hasOwn(ENEMY_ROLES, actor.role) && Array.isArray(actor.offset) && actor.offset.length === 2
    && actor.offset.every(Number.isFinite) && Math.hypot(...actor.offset) <= STORY_ENCOUNTER_LIMITS.actorOffset
    && (!actor.pattern || actor.pattern === 'echo-warden')
    && (!actor.title || Array.isArray(actor.title) && actor.title.length === 2 && actor.title.every((text: unknown) => typeof text === 'string' && text.length > 0 && text.length <= 96)));
const appearances = { stalker: 'deck_raider', duelist: 'samurai', breaker: 'sunward_guard', bombardier: 'deck_raider', musketeer: 'musketeer', lancer: 'ashigaru' } as const;

/** Exactly one local physical encounter. Up to three live actors enter the SAME combat
 * queries/authority as wilderness enemies. Cancellation is not a kill or a reward.
 */
export class StoryEncounterDirector {
  private generation = 0;
  private current: { id: string; anchor: Point3; actors: Enemy[] } | null = null;
  get status(): StoryEncounterStatus | null { return this.current ? { id: this.current.id, remaining: this.current.actors.filter(actor => actor.mode !== 'dead').length } : null; }
  start(spec: StoryEncounterSpec, context: StoryEncounterContext): StoryEncounterStartResult {
    if (!valid(spec) || !finite(context.player)) return { ok: false, reason: 'invalid' };
    if (this.current) return { ok: false, reason: this.current.id === spec.id ? 'active' : 'busy' };
    const { state, player } = context;
    if (!context.playable || state.defeated) return { ok: false, reason: 'unavailable' };
    if (state.bossStarted) return { ok: false, reason: 'busy' };
    if (distance(player,spec.anchor) > STORY_ENCOUNTER_LIMITS.trigger || Math.abs(player.y-spec.anchor.y) > STORY_ENCOUNTER_LIMITS.height) return { ok: false, reason: 'out-of-range' };
    // Mere 82m model activation isn't combat pressure. Never suppress unrelated enemies.
    if (state.enemies.some(enemy => enemy.active && !enemy.pacified && enemy.mode !== 'dead' && enemy.mode !== 'idle' && distance(enemy.p,player) < STORY_ENCOUNTER_LIMITS.nearbyPressure)) return { ok: false, reason: 'busy' };
    const spawns: SpawnPoint[] = [];
    for (const [index,actor] of spec.actors.entries()) {
      const point = context.place(spec.anchor.x+actor.offset[0],spec.anchor.z+actor.offset[1]);
      if (!point || !finite(point) || Math.abs(point.y-spec.anchor.y)>3 || distance(point,player)<2
        || spawns.some(other => distance(other.p,point)<2)
        || state.enemies.some(other => other.mode !== 'dead' && !other.pacified && distance(other.p,point)<5)) return { ok: false, reason: 'blocked' };
      spawns.push({ id: `story_${spec.id}_${this.generation + 1}_${index}`, kind: actor.role === 'bombardier' || actor.pattern ? 'crystal' : 'shade', p: { ...point }, role: actor.role,
        storyEncounter: spec.id, storyPattern: actor.pattern, displayName: actor.title, appearance: appearances[actor.role] });
    }
    const actors = state.replaceStoryEnemies(spawns); this.generation++;
    this.current = { id: spec.id, anchor: { ...spec.anchor }, actors };
    return { ok: true, reason: 'started' };
  }
  /** Call at authoritative fixed steps and after real hit events. Pause cannot advance
   * completion. Defeat/leash take precedence over observing a reset/dead roster.
   */
  observe(context: Pick<StoryEncounterContext, 'state'|'player'|'playable'>): { type: 'victory'|'cancel'; id: string } | null {
    if (!this.current) return null;
    const { state, player } = context, current = this.current;
    if (state.defeated || current.actors.some(actor => !state.enemies.includes(actor)) || !finite(player) || distance(player,current.anchor)>STORY_ENCOUNTER_LIMITS.leash || Math.abs(player.y-current.anchor.y)>STORY_ENCOUNTER_LIMITS.height) {
      this.current = null; return { type: 'cancel', id: current.id };
    }
    if (!context.playable) return null;
    if (current.actors.every(actor => actor.hp <= 0 && actor.mode === 'dead')) { this.current = null; return { type: 'victory', id: current.id }; }
    return null;
  }
  cancel() { const id = this.current?.id; this.current = null; return id ?? null; }
}
