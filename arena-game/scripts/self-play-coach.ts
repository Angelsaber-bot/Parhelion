import { WEAPONS } from '../shared/content.ts';
import { HUMAN_FEATURES, wrapAngle } from '../shared/humanCombat.ts';
import { groundAt, insideMovementBounds, type ArenaMap } from '../shared/map.ts';
import { canSlideTo, forward, type PlayerState } from '../shared/sim.ts';

// Targets are in actuator space (after tanh). Null leaves the decision to PPO.
export type CoachTargets = [yaw: number | null, pitch: number | null, strafe: number | null,
  forward: number | null, fire: 0 | 1 | null];

const scene = HUMAN_FEATURES.length;
const clamp = (x: number, max = 1) => Math.max(-max, Math.min(max, x));

function clearance(map: ArenaMap, me: PlayerState, strafe: number, advance: number) {
  const [fx, fz] = forward(me.yaw);
  let clear = 0;
  for (let step = 1; step <= 6; step++) {
    const distance = .18 * step;
    const x = me.x + (fx * advance - fz * strafe) * distance;
    const z = me.z + (fz * advance + fx * strafe) * distance;
    if (!insideMovementBounds(map, x, z) || !canSlideTo(map, me, x, z) ||
        groundAt(map, x, z, me.y) < me.y - map.step) break;
    clear = step;
  }
  return clear;
}

/** Label the student's own decisions using its observations and walkability immediately underfoot.
 * No opponent entity, scenario name, spawn location, outcome or future state enters this function. */
export function decisionCoach() {
  let headings: number[] = [];
  let sweep = 0;
  let sweepRemaining = 0;
  let previousYaw = 0;
  return (obs: readonly number[], fresh: boolean, map: ArenaMap, me: PlayerState): CoachTargets => {
    const yaw = Math.atan2(obs[scene + 3], obs[scene + 4]);
    if (fresh || obs[0] > 0) {
      headings = [];
      sweepRemaining = 0;
      sweep = 0;
    }
    const labels: CoachTargets = [null, null, null, null, null];
    const [confidence, targetYaw, targetPitch, distance] = obs;
    if (confidence > 0) {
      labels[0] = clamp(targetYaw / .9, .95);
      labels[1] = clamp(targetPitch / .55, .95);
    } else {
      const delta = fresh ? 0 : wrapAngle(yaw - previousYaw);
      headings.push(delta);
      if (headings.length > 6) headings.shift();
      if (sweepRemaining > 0) sweepRemaining = Math.max(0, Math.min(Math.PI, sweepRemaining - delta * sweep));
      const recency = obs[scene + 9];
      if (recency > .4) {
        // This bearing refers only to the last *observed* contact. A lost target is allowed to move.
        const lastBearing = Math.atan2(obs[scene + 10], obs[scene + 11]);
        if (Math.abs(lastBearing) > .18) labels[0] = clamp(lastBearing / .9, .7);
      } else {
        const turned = headings.reduce((a, b) => a + b, 0);
        if (sweepRemaining <= 0 && headings.length === 6 && Math.abs(turned) < .65) {
          // Pick one direction and keep it across decisions instead of teaching left/right jitter.
          const openness = obs[scene + 8] - obs[scene + 6];
          sweep = Math.abs(turned) > .12 ? Math.sign(turned) : openness >= 0 ? 1 : -1;
          sweepRemaining = Math.PI;
        }
        if (sweepRemaining > 0) labels[0] = .52 * sweep;
      }
    }
    previousYaw = yaw;
    if (confidence < 1) labels[4] = 0;
    else {
      const weapon = WEAPONS[me.weapon];
      const angle = Math.hypot(targetYaw, targetPitch);
      const tolerance = Math.min(.13, Math.atan2(.37, Math.max(1, distance * 45)));
      // A proposal lasts 12 ticks. Request fire when tracking can settle within that interval;
      // the motor checks current visibility and alignment again at the actual trigger tick.
      const requestCone = Math.min(.30, 3 * tolerance + .065);
      if (angle < requestCone && !me.reload && (weapon.kind === 'melee' ? distance * 45 < weapon.range * .85 : obs[8] > 0)) labels[4] = 1;
      else if (angle > requestCone + .08 || me.reload) labels[4] = 0;
    }
    if (me.grounded && me.rootUntil <= me.abilityTick && me.pullT <= 0 && clearance(map, me, 0, 1) < 2) {
      const left = clearance(map, me, -1, 0), right = clearance(map, me, 1, 0);
      if (Math.max(left, right) >= 2) {
        const side = left === right ? (obs[scene + 6] >= obs[scene + 8] ? 1 : -1) : right > left ? 1 : -1;
        labels[2] = .85 * side;
        labels[3] = 0;
        if (confidence === 0) labels[0] = -.5 * side;
      } else if (clearance(map, me, 0, -1) >= 2) {
        labels[2] = 0;
        labels[3] = -.8;
      }
    }
    return labels;
  };
}
