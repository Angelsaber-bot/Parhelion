// Environment fixtures and outcome rewards for PPO. None of these routines control the learner.
import { HUMAN_FEATURES, wrapAngle } from '../shared/humanCombat.ts';
import { TICK_HZ } from '../shared/content.ts';
import { lineOfSight, type ArenaMap, type Vec3 } from '../shared/map.ts';
import type { Controller } from '../shared/match.ts';
import type { NavGrid, NavNode } from '../shared/nav.ts';
import { playerHitbox } from '../shared/hit.ts';
import { forward } from '../shared/sim.ts';

export type ContactDrill = 'retreat' | 'corner' | 'smoke';
export type Escape = 'left' | 'right' | 'reverse' | 'hold' | 'away';
export interface RivalCourse { escape: Escape; route: NavNode[]; wait: number; duration: number }

export const SIGHTLINE_BANDS = [[28, 45], [45, 80]] as const;

/** Playable, unobstructed lanes at distances the close-contact drills cannot sample. */
export function sightlineStart(map: ArenaMap, nav: NavGrid, random: () => number,
                               occupied: (node: NavNode) => boolean) {
  const first = random() < .5 ? 0 : 1;
  for (const index of [first, 1 - first]) {
    const [minimum, maximum] = SIGHTLINE_BANDS[index];
    for (let attempt = 0; attempt < 600; attempt++) {
      const a = nav.nodes[Math.floor(random() * nav.nodes.length)];
      const b = nav.nodes[Math.floor(random() * nav.nodes.length)];
      if (!a?.links.length || !b?.links.length) continue;
      const distance = Math.hypot(a.x - b.x, a.z - b.z);
      if (distance < minimum || distance >= maximum || occupied(a) || occupied(b)) continue;
      if (!lineOfSight(map, [a.x, a.y + map.eye, a.z], [b.x, b.y + 1.1, b.z]) ||
          !lineOfSight(map, [b.x, b.y + map.eye, b.z], [a.x, a.y + 1.1, a.z])) continue;
      return { a, b, distance, minimum };
    }
  }
}

// Sample a shorter, still occluded approach along the real route between the two
// spawns. Only the rollout initializer sees this route.
export function waitingApproach(map: ArenaMap, nav: NavGrid, pilot: Pick<NavNode, 'x' | 'y' | 'z'>,
                                rival: Pick<NavNode, 'x' | 'y' | 'z'>, random: () => number,
                                nearSightline = false) {
  const start = nav.nearest(pilot.x, pilot.y, pilot.z), goal = nav.nearest(rival.x, rival.y, rival.z);
  if (!start || !goal) return;
  const path = nav.path(start, goal);
  if (!path) return;
  const hidden = (node: NavNode) => {
    const eye: Vec3 = [node.x, node.y + map.eye, node.z];
    return !lineOfSight(map, eye, [rival.x, rival.y + 1.1, rival.z]) &&
      !lineOfSight(map, eye, [rival.x, rival.y + playerHitbox(false).headY, rival.z]);
  };
  const separated = (node: NavNode) => Math.hypot(node.x - rival.x, node.z - rival.z) >= 4;
  if (nearSightline) {
    // A short, still-hidden approach can provide a first sighting to learn from.
    const occluded = path.map(hidden);
    const openings = path.filter((node, i) => occluded[i] && separated(node) &&
      occluded.slice(i + 1, i + 4).includes(false));
    if (openings.length) return openings[Math.floor(random() * openings.length)];
  }
  const candidates = path.slice(-40, -8).filter(node => separated(node) && hidden(node));
  return candidates[Math.floor(random() * candidates.length)];
}

export function escapeFor(drill: ContactDrill, random: () => number): Escape {
  if (drill === 'retreat') return 'away';
  const variants: Escape[] = drill === 'smoke' ? ['left', 'right', 'reverse', 'hold'] : ['left', 'right', 'reverse'];
  return variants[Math.floor(random() * variants.length)];
}

/** A reachable path for the training rival, in the rival's starting frame. Environment setup
 * may place either player; no itinerary, rival coordinate or scenario ID enters the learner. */
export function rivalCourse(map: ArenaMap, nav: NavGrid, a: NavNode, b: NavNode, drill: ContactDrill | 'encounter',
                            escape: Escape, random: () => number): RivalCourse | undefined {
  const wait = Math.round((.5 + random() * .7) * TICK_HZ);
  const duration = wait + Math.round((4 + random() * 3) * TICK_HZ);
  if (escape === 'hold') return { escape, route: [], wait, duration };
  const angle = Math.atan2(b.z - a.z, b.x - a.x);
  const side = escape === 'reverse' ? (random() < .5 ? -1 : 1) : (escape === 'right' ? 1 : -1);
  const direction = angle + (escape === 'away' ? 0 : side * Math.PI / 2);
  const eye: Vec3 = [a.x, a.y + 1.4, a.z];
  for (const offset of [0, .35, -.35]) {
    const distance = 5 + random() * 4, dx = Math.cos(direction + offset), dz = Math.sin(direction + offset);
    const end = nav.nearest(b.x + distance * dx, b.y, b.z + distance * dz);
    if (!end || (end.x - b.x) * dx + (end.z - b.z) * dz < 4 || Math.abs(end.y - b.y) > 1.5) continue;
    if (drill === 'corner' && lineOfSight(map, eye, [end.x, end.y + 1.4, end.z])) continue;
    const route = nav.path(b, end, 2000);
    if (!route?.length || route.length > 36) continue;
    if (escape === 'reverse') {
      // Use a separate return path: drops in the navigation mesh can be one-way.
      const back = nav.path(end, b, 2000);
      if (!back?.length || back.length > 36) continue;
      route.push(...back);
    }
    return { escape, route, wait, duration };
  }
}

/** Keep the opponent's regular camera, weapons and combat decisions. Its movement through the
 * sampled course uses ordinary match inputs and collisions; after the drill its policy resumes. */
export function courseRival(driver: Controller, course: RivalCourse, start: number, life: number): Controller {
  let waypoint = 0;
  return { think(match, id) {
    const input = driver.think(match, id), me = match.player(id)!;
    const elapsed = match.tick - start;
    if (!me.alive || me.lifeId !== life || elapsed >= course.duration) return input;
    input.mx = input.mz = 0;
    if (elapsed < course.wait) return input;
    while (waypoint < course.route.length) {
      const node = course.route[waypoint], dx = node.x - me.x, dz = node.z - me.z;
      const distance = Math.hypot(dx, dz);
      if (distance > .28) {
        const [fx, fz] = forward(input.yaw);
        input.mx = (-fz * dx + fx * dz) / distance;
        input.mz = (fx * dx + fz * dz) / distance;
        break;
      }
      waypoint++;
    }
    return input;
  } };
}

interface RewardStep { obs: readonly number[]; reward: number; reset: boolean }

// Only an initially clear close-range drill can earn this once, on the first
// positive damage event. Count elapsed simulation ticks, including the hit tick.
export function openingDamageCredit(initialView: readonly number[], elapsed: number) {
  if (initialView[0] !== 1 || !(initialView[3] <= 12 / 45) || elapsed < 1 || elapsed > 2 * TICK_HZ) return 0;
  return elapsed <= TICK_HZ / 2 ? .08 : .04;
}

export function sightlineDamageCredit(view: readonly number[], elapsed: number, distance: number, minimum: number) {
  return view[0] === 1 && elapsed >= 1 && elapsed <= 3 * TICK_HZ &&
    view[3] >= minimum / 45 && distance >= minimum ? .08 : 0;
}

/** One small contact bonus per probe. Two delayed clear observations confirm recovery;
 * silhouettes and resets cannot earn the bonus. Rewards go to actions preceding the observation. */
export function scoreContactDrill(steps: RewardStep[], drill: ContactDrill | 'rear', duration: number, period: number,
                                  smokeWindow?: { start: number; end: number }) {
  let hadContact = false, lost = false, unseen = 0, clear = 0;
  const end = Math.min(steps.length, Math.ceil(duration / period));
  if (drill === 'rear') {
    if (!end || steps[0].obs[0] !== 0) return false;
    const heading = (obs: readonly number[]) =>
      Math.atan2(obs[HUMAN_FEATURES.length + 3], obs[HUMAN_FEATURES.length + 4]);
    const initial = heading(steps[0].obs);
    for (let i = 1; i + 1 < end; i++) {
      if (steps[i].reset || steps[i + 1].reset) break;
      if (steps[i].obs[0] !== 1 || steps[i + 1].obs[0] !== 1) continue;
      // Give credit to the action that acquired the target. A rival simply
      // walking into an unchanged field of view earns no search reward.
      if (steps[i - 1].obs[0] !== 1 && Math.abs(wrapAngle(heading(steps[i].obs) - initial)) >= Math.PI / 4) {
        steps[i - 1].reward += .05;
        return true;
      }
    }
    return false;
  }
  for (let i = 0; i < end; i++) {
    if (i > 0 && steps[i].reset) break;
    if (steps[i].obs[0] !== 1) {
      // Only loss of contact during the smoke drill can qualify its recovery.
      if (drill !== 'smoke' || (smokeWindow && i >= smokeWindow.start && i < smokeWindow.end)) unseen++;
      clear = 0;
      if (hadContact && unseen >= 2) lost = true;
      continue;
    }
    clear++; unseen = 0;
    if (clear < 2) continue;
    hadContact = true;
    if (lost || (drill === 'retreat' && clear * period >= 2.5 * TICK_HZ)) {
      steps[i - 1].reward += .05;
      return true;
    }
  }
  return false;
}
