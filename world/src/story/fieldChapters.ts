import type { Localized } from '../settlements/types';
import type { EnemyRole } from '../combat/enemyRoles';
import type { StoryEncounterSpec } from './storyEncounters';
import { advanceEscort, escortPoseAt, prepareEscortRoute, type EscortRoute, type EscortTask } from './fieldEscort';
export type { FieldEscortPose } from './fieldEscort';

/** Regional main-story chapters authored as real field actions on the existing maps.
 * Every action is a physical marker: talk/operate, a story fight, a shot target, or timed work
 * that only advances while the player stays at the site. Progress lives in the ordinary `done` set. */
export type FieldRegion = 'alpha' | 'britain' | 'winter' | 'blacksail' | 'kyoto' | 'egypt' | 'orleans' | 'qin' | 'home';
export interface FieldAction {
  readonly id: string;
  readonly region: FieldRegion;
  readonly chapter: string;
  /** Anchored on an existing layout marker, offset [dx, dz] metres, so it always stands on mapped ground. */
  readonly near: string;
  readonly off?: readonly [number, number];
  readonly label: Localized;
  readonly line: Localized;
  readonly after?: readonly string[];
  /** At least one of these must be done. */
  readonly any?: readonly string[];
  /** Closed once any of these is done. */
  readonly not?: readonly string[];
  readonly kind?: 'fight' | 'shot' | 'work' | 'escort';
  readonly escort?: EscortTask;
  /** Alternative methods: the first one done closes the others. */
  readonly alt?: string;
  /** Switchable plan choice: picking one clears its siblings until `lock` is done. */
  readonly pick?: string;
  readonly lock?: string;
  /** Not shown by the main guide (side beats and reactions). */
  readonly optional?: boolean;
  readonly foes?: readonly (readonly [EnemyRole, Localized?])[];
  readonly seconds?: number;
  /** Extra durable facts this action establishes (chapter completion, opened routes). */
  readonly adds?: readonly string[];
  /** Chapter-level availability that depends on other systems (region open, boss cleared). */
  readonly gate?: (d: ReadonlySet<string>) => boolean;
}
export interface FieldChapterSet {
  readonly region: FieldRegion;
  readonly title: Localized;
  readonly actions: readonly FieldAction[];
}

export function fieldActionReady(a: FieldAction, d: ReadonlySet<string>, actions: readonly FieldAction[]): boolean {
  if (d.has(a.id)) return false;
  if (a.lock && d.has(a.lock)) return false;
  if (a.after && !a.after.every(f => d.has(f))) return false;
  if (a.any && !a.any.some(f => d.has(f))) return false;
  if (a.not && a.not.some(f => d.has(f))) return false;
  if (a.alt && actions.some(o => o.alt === a.alt && o.id !== a.id && d.has(o.id))) return false;
  return a.gate ? a.gate(d) : true;
}
export function commitFieldAction(a: FieldAction, d: Set<string>, actions: readonly FieldAction[]): boolean {
  if (!fieldActionReady(a, d, actions)) return false;
  if (a.pick) for (const o of actions) if (o.pick === a.pick && o.id !== a.id) d.delete(o.id);
  d.add(a.id);
  for (const f of a.adds ?? []) d.add(f);
  return true;
}
/** The next main beat: alternatives and plan choices collapse to the first open member. */
export function fieldChapterGuide(set: FieldChapterSet, d: ReadonlySet<string>): FieldAction | null {
  for (const a of set.actions) {
    if (a.optional || !fieldActionReady(a, d, set.actions)) continue;
    if (a.pick && set.actions.some(o => o.pick === a.pick && d.has(o.id))) continue;
    return a;
  }
  return null;
}
export const fieldEncounterId = (id: string) => `chapter_${id}`;

export interface FieldChapterHooks {
  done: Set<string>;
  sets: readonly FieldChapterSet[];
  save(): boolean;
  changed(): void;
  toast(line: Localized): void;
  reachable(id: string): boolean;
  position(id: string): [number, number, number] | undefined;
  escortRoute?(id: string): readonly V3[] | undefined;
  start(spec: StoryEncounterSpec): boolean;
}
/** Shared transaction rules: a failed save rolls the field state back; nothing advances while paused. */
export function createFieldChapters(h: FieldChapterHooks) {
  const byId = new Map<string, { a: FieldAction; set: FieldChapterSet }>();
  for (const set of h.sets) for (const a of set.actions) byId.set(a.id, { a, set });
  let pending: string | null = null, working: string | null = null, work = 0;
  const routes = new Map<string, EscortRoute>();
  for (const [id, { a }] of byId) {
    if (!a.escort) continue;
    const points = h.escortRoute?.(id);
    const route = points && prepareEscortRoute(points);
    if (route) routes.set(id, route);
  }
  let escort: { id: string; distance: number; waiting: boolean } | null = null;
  function finish(id: string) {
    const entry = byId.get(id); if (!entry) return false;
    const before = new Set(h.done);
    if (!commitFieldAction(entry.a, h.done, entry.set.actions)) return false;
    if (!h.save()) { h.done.clear(); before.forEach(f => h.done.add(f)); h.toast(['保存失败，现场状态尚未提交。', 'Save failed. The field state has not been committed.']); return false; }
    h.changed(); h.toast(entry.a.line); return true;
  }
  const segments = (id: string) => { let n = 0; while (n < 3 && h.done.has(`${id}_${n + 1}`)) n++; return n; };
  const savedDistance = (id: string, route: EscortRoute) => route.length * (h.done.has(id) ? 1 : segments(id) / 4);
  const escortPose = (id: string) => {
    const route = routes.get(id);
    if (!route) return null;
    const active = escort?.id === id;
    const pose = escortPoseAt(route, active ? escort!.distance : savedDistance(id, route), active);
    pose.waiting = active && escort!.waiting;
    return pose;
  };
  function updateEscort(dt: number, player: [number, number, number]) {
    if (!escort) return;
    const { id } = escort, e = byId.get(id)!, route = routes.get(id)!;
    if (!fieldActionReady(e.a, h.done, e.set.actions)) { escort = null; return; }
    const next = advanceEscort(route, escort.distance, player, Math.min(dt, .1));
    escort.distance = next.distance;
    escort.waiting = next.waiting;
    if (route.length - escort.distance < .0001) {
      escort = null;
      finish(id);
      return;
    }
    const checkpoint = segments(id) + 1;
    if (checkpoint > 3 || next.distance < checkpoint * route.length / 4) return;
    const flag = `${id}_${checkpoint}`;
    h.done.add(flag);
    if (h.save()) { h.changed(); return; }
    h.done.delete(flag);
    escort = null;
    h.toast(['保存失败。回到队伍上一个交接点可以重试。', 'Save failed. Rejoin the party at its last checkpoint to retry.']);
  }
  return {
    escortPose,
    escortGuide() {
      if (!escort) return null;
      const a = byId.get(escort.id)!.a, route = routes.get(escort.id)!;
      const leg = route.legs.find(leg => escort!.distance < leg.start + leg.span - .0001) ?? route.legs[route.legs.length - 1];
      const distance = escort.waiting ? escort.distance : Math.min(leg.start + leg.span, escort.distance + 2.8);
      const label: Localized = escort.waiting ? ['队伍停下了。回到他们身边，再一起前进。', 'The party is waiting. Return to them and walk on together.'] : a.escort!.instruction;
      return { id: escort.id, p: escortPoseAt(route, distance, true).point, label };
    },
    escorting: () => escort?.id ?? null,
    carryingStretcher: () => !!(escort && !escort.waiting && byId.get(escort.id)?.a.escort?.carry),
    interruptEscort() { escort = null; },
    has: (id: string) => byId.has(id),
    action: (id: string) => byId.get(id)?.a,
    ready: (id: string) => { const e = byId.get(id); return !!e && fieldActionReady(e.a, h.done, e.set.actions); },
    interact(id: string) {
      const e = byId.get(id); if (!e || !h.reachable(id)) return false;
      if (!fieldActionReady(e.a, h.done, e.set.actions)) { h.toast(['先完成这一章当前的现场目标。已做的工作会保留。', 'Finish the current field objective of this chapter first. Completed work remains.']); return true; }
      if (e.a.kind === 'shot') { h.toast(['用枪击中标出的部件。', 'Shoot the marked part.']); return true; }
      if (e.a.kind === 'escort') {
        const route = routes.get(id);
        if (!route || !e.a.escort) return false;
        if (escort?.id !== id) escort = { id, distance: savedDistance(id, route), waiting: false };
        working = null;
        h.toast(e.a.escort.instruction);
        return true;
      }
      if (e.a.kind === 'work') {
        working = id; work = 0;
        h.toast(['开始作业。留在现场即可推进；离开或暂停会停下，已完成的段落会保留。', 'Work started. Stay on site to progress; leaving or pausing stops it, finished segments remain.']);
        return true;
      }
      if (e.a.kind === 'fight') {
        const p = h.position(id); if (!p) return true;
        const foes = e.a.foes ?? [['lancer'], ['musketeer']];
        const offsets: [number, number][] = [[-4, 6], [4, 6], [0, 8]];
        const spec: StoryEncounterSpec = { id: fieldEncounterId(id), anchor: { x: p[0], y: p[1] - .9, z: p[2] },
          actors: foes.slice(0, 3).map(([role, title], i) => ({ role, offset: offsets[i], ...(title ? { title } : {}) })) };
        if (h.start(spec)) pending = spec.id;
        else h.toast(['现场仍有战斗或落点受阻，请清出空间后重试。', 'Another fight is active or the landing is blocked. Clear space and retry.']);
        return true;
      }
      return finish(id);
    },
    hit(id: string) { const e = byId.get(id); if (e?.a.kind !== 'shot') return false; if (fieldActionReady(e.a, h.done, e.set.actions)) finish(id); return true; },
    victory(encounter: string) {
      if (!encounter.startsWith('chapter_') || !byId.has(encounter.slice(8))) return false;
      if (pending !== encounter) return true;
      pending = null; finish(encounter.slice(8)); return true;
    },
    /** Timed work: four durable quarters while the player stays within 9 m and play is active. */
    update(dt: number, playable: boolean, player: [number, number, number]) {
      if (escort && playable && Number.isFinite(dt) && dt > 0) updateEscort(dt, player);
      if (!working) return;
      const e = byId.get(working), p = h.position(working);
      if (!e || !p || !fieldActionReady(e.a, h.done, e.set.actions)) { working = null; return; }
      if (!playable || !Number.isFinite(dt) || dt <= 0 || Math.hypot(player[0] - p[0], player[2] - p[2]) > 9) return;
      work += Math.min(dt, .1);
      const quarter = (e.a.seconds ?? 8) / 4;
      if (work < quarter) return;
      work = 0;
      const n = segments(working);
      if (n >= 3) { const id = working; working = null; finish(id); return; }
      const flag = `${working}_${n + 1}`; h.done.add(flag);
      if (!h.save()) h.done.delete(flag); else h.changed();
    },
    progress(id: string) { if (h.done.has(id)) return 1; if (escort?.id === id) return escort.distance / routes.get(id)!.length; const e = byId.get(id); return Math.min(1, (segments(id) + (working === id ? work / ((e?.a.seconds ?? 8) / 4) : 0)) / 4); },
    working: () => escort?.id ?? working,
    reset() { pending = null; working = null; work = 0; escort = null; },
  };
}

export type V3 = readonly [number, number, number];
/** A simple physical prop placed relative to an action's standing point. `moved` is a durable state
 * change (a dropped crate, a lowered beam, a boat that left); `target` makes it a shot target. */
export interface FieldProp {
  readonly at: string;
  readonly off: V3;
  readonly size: V3;
  readonly color: number;
  readonly rot?: V3;
  readonly show?: (d: ReadonlySet<string>) => boolean;
  readonly moved?: { readonly when: string | ((d: ReadonlySet<string>) => boolean); readonly off: V3; readonly rot?: V3 };
  readonly target?: string;
  /** Draw a modelled object of this size instead of a plain block (visual only). */
  readonly model?: 'chaser' | 'pennant' | 'standard' | 'shell' | 'stretcher' | 'receiving-mat' | 'muster-board';
  /** Slide from `off` to `moved.off` as this work action progresses (instead of jumping on completion). */
  readonly glide?: string;
}
/** A named resident or companion whose work station follows the story: [action id, dx, dz] or hidden. */
export interface FieldActor {
  readonly id: string;
  readonly role: Localized;
  readonly coat: number;
  readonly place: (d: ReadonlySet<string>) => readonly [string, number, number] | null;
  /** Local right/forward offset from the escort route's lead position. */
  readonly escort?: { action: string; right: number; forward: number; grips?: boolean };
}
export interface FieldChapterContent {
  readonly set: FieldChapterSet;
  readonly props: readonly FieldProp[];
  readonly actors: readonly FieldActor[];
}
