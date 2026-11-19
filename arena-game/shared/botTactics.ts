import { CHARACTERS, TICK_HZ, WEAPONS } from './content.ts';
import { lineOfSight, type ArenaMap, type Vec3 } from './map.ts';
import type { NavGrid, NavNode } from './nav.ts';
import type { PlayerState } from './sim.ts';

export const TACTIC_TICKS = 84;
export const TACTIC_MEMORY_TICKS = 90;
const POST_TACTIC_TICKS = 90;
export const TACTIC_INTERVAL = TACTIC_TICKS + POST_TACTIC_TICKS;

export interface TacticalCandidate {
  kind: 'baseline' | 'cover' | 'angle';
  path: readonly NavNode[];
  features: readonly number[];
}

export type TacticalPolicy = (candidates: readonly TacticalCandidate[]) => number;

export const TACTIC_FEATURES = [
  'health', 'magazine', 'alternateMagazine', 'reload', 'recentDamage', 'visible', 'memoryAge',
  'distance', 'weaponEffectiveRange', 'targetElevation', 'aggression', 'fireCooldown', 'baseline', 'cover',
  'pathLength', 'pathExposure', 'distanceChange', 'angleChange', 'destinationElevation',
] as const;

const clamp = (x: number, limit = 1) => Math.max(-1, Math.min(1, x / limit));
const point = (node: NavNode): Vec3 => [node.x, node.y, node.z];

function exposure(map: ArenaMap, spot: Vec3, threat: Vec3): boolean {
  return lineOfSight(map, threat, [spot[0], spot[1] + map.eye, spot[2]]) ||
    lineOfSight(map, threat, [spot[0], spot[1] + .9, spot[2]]);
}

/** The only opposing position supplied here is a perceived contact or a remembered sample. */
export function tacticalCandidates(
  map: ArenaMap, nav: NavGrid, me: PlayerState, alternateWeapon: number, aggression: number,
  threat: Vec3, visible: boolean, age: number, sinceDamage: number,
): TacticalCandidate[] {
  const distance = Math.hypot(threat[0] - me.x, threat[2] - me.z);
  const weapon = WEAPONS[me.weapon];
  const common = [
    me.hp / CHARACTERS[me.char].hp, me.ammo[me.weapon] / Math.max(1, weapon.mag),
    me.ammo[alternateWeapon] / WEAPONS[alternateWeapon].mag, clamp(me.reload, 2 * TICK_HZ),
    1 - clamp(sinceDamage, 2 * TICK_HZ), Number(visible), clamp(age, TACTIC_MEMORY_TICKS),
    clamp(distance, 35), clamp(weapon.falloffStart, 45), clamp(threat[1] - me.y - map.eye, 6), aggression,
    clamp(me.fireCd, TICK_HZ),
  ];
  const candidates: TacticalCandidate[] = [{ kind: 'baseline', path: [], features: [...common, 1, 0, 0, Number(visible), 0, 0, 0] }];
  const start = nav.nearest(me.x, me.y, me.z);
  if (!start) return candidates;

  const bearing = Math.atan2(me.z - threat[2], me.x - threat[0]);
  const examined = new Set<number>();
  const goals = [];
  for (const radius of [3.6, 6.5]) {
    for (let i = 0; i < 8; i++) {
      const angle = bearing + i * Math.PI / 4;
      const node = nav.nearest(me.x + radius * Math.cos(angle), me.y, me.z + radius * Math.sin(angle));
      if (!node || examined.has(node.id)) continue;
      examined.add(node.id);
      const travel = Math.hypot(node.x - me.x, node.y - me.y, node.z - me.z);
      if (travel < 1.8 || travel > 8) continue;
      const change = Math.hypot(node.x - threat[0], node.z - threat[2]) - distance;
      const delta = Math.atan2(node.z - threat[2], node.x - threat[0]) - bearing;
      const turn = Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
      const covered = !exposure(map, point(node), threat);
      const order = covered ? -travel : 4 * turn - .24 * travel;
      goals.push({ node, change, turn, covered, order });
    }
  }

  for (const covered of [true, false]) {
    const ranked = goals.filter(goal => goal.covered === covered).sort((a, b) => b.order - a.order);
    let accepted = 0;
    for (const goal of ranked.slice(0, 4)) {
      const path = nav.path(start, goal.node, 1600);
      if (!path?.length) continue;
      let length = 0, prev = start;
      for (const node of path) {
        length += Math.hypot(node.x - prev.x, node.y - prev.y, node.z - prev.z);
        prev = node;
      }
      if (length > 7.5) continue;
      const samples = [0, .33, .66, 1].map(f => path[Math.floor(f * (path.length - 1))]);
      const exposed = samples.filter(node => exposure(map, point(node), threat)).length / samples.length;
      candidates.push({
        kind: covered ? 'cover' : 'angle', path,
        features: [...common, 0, Number(covered), clamp(length, 7.5), exposed,
          clamp(goal.change, 8), clamp(goal.turn, Math.PI / 2), clamp(goal.node.y - me.y, 4)],
      });
      if (++accepted === 2) break;
    }
  }
  return candidates;
}

export interface TacticalWeights {
  hidden: number[][];
  bias: number[];
  output: number[];
}

export function tacticScore(weights: TacticalWeights, features: readonly number[]): number {
  let score = 0;
  for (let h = 0; h < weights.hidden.length; h++) {
    let activation = weights.bias[h];
    for (let f = 0; f < features.length; f++) activation += weights.hidden[h][f] * features[f];
    score += weights.output[h] * Math.tanh(activation);
  }
  return score;
}

export function learnedTactics(weights: TacticalWeights, margin = 0): TacticalPolicy {
  return candidates => {
    // Use the cover model during a vulnerable moment. A recovered player can resume ordinary
    // combat immediately, even if a short wait behind cover held up well in training.
    const [health, magazine, alternateMagazine, reload, recentDamage] = candidates[0].features;
    const vulnerable = reload > 0 || (magazine <= .45 && alternateMagazine <= .6) || (health <= .58 && recentDamage > .55);
    if (!vulnerable) return 0;
    let best = 0, score = tacticScore(weights, candidates[0].features) + margin;
    for (let i = 1; i < candidates.length; i++) {
      const next = tacticScore(weights, candidates[i].features);
      if (next > score) { best = i; score = next; }
    }
    return best;
  };
}
