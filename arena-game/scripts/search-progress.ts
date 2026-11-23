// Search credit is calculated after the simulated match. Only the actor's own
// observed movement and subsequent sightings are used, never a hidden rival pose.
import { HUMAN_FEATURES, wrapAngle } from '../shared/humanCombat.ts';
import type { MapData } from '../shared/map.ts';

interface Decision { obs: number[]; axes: number[]; reset: boolean; reward: number }
const scene = HUMAN_FEATURES.length;

// The pose at index j + 1 is the first observation after action j.
function creditProgress(steps: Decision[], bounds: MapData['bounds'], start: number, end: number, reward: number, facing: boolean) {
  const scaleX = (bounds.max[0] - bounds.min[0]) / 2, scaleZ = (bounds.max[2] - bounds.min[2]) / 2;
  const routeX = (steps[end].obs[scene] - steps[start].obs[scene]) * scaleX;
  const routeZ = (steps[end].obs[scene + 2] - steps[start].obs[scene + 2]) * scaleZ;
  let total = 0;
  const gains: number[] = [];
  for (let j = start; j < end; j++) {
    const before = steps[j].obs, after = steps[j + 1].obs;
    const dx = (after[scene] - before[scene]) * scaleX, dz = (after[scene + 2] - before[scene + 2]) * scaleZ;
    const progress = facing ? -dx * after[scene + 3] - dz * after[scene + 4] : dx * routeX + dz * routeZ;
    const gain = Math.max(0, progress);
    gains.push(gain);
    total += gain;
  }
  if (total > 0) for (const [offset, gain] of gains.entries()) steps[start + offset].reward += reward * gain / total;
}

// A stalled search can end with a useful sidestep. Attribute the wall-press
// penalty to forward requests followed by little actual movement.
function penalizeStall(steps: Decision[], bounds: MapData['bounds'], start: number, end: number, secondsPerDecision: number) {
  const blocked: number[] = [];
  for (let j = start; j < end; j++) {
    if (Math.tanh(steps[j].axes[3]) <= .3) continue;
    const before = steps[j].obs, after = steps[j + 1].obs;
    const dx = (after[scene] - before[scene]) * (bounds.max[0] - bounds.min[0]) / 2;
    const dz = (after[scene + 2] - before[scene + 2]) * (bounds.max[2] - bounds.min[2]) / 2;
    if (Math.hypot(dx, dz) < .5 * secondsPerDecision) blocked.push(j);
  }
  if (blocked.length) {
    for (const j of blocked) steps[j].reward -= .015 / blocked.length;
  } else {
    steps[end - 1].reward -= .015;
  }
}

export function scoreSearchProgress(steps: Decision[], bounds: MapData['bounds'], period: number, tickRate: number) {
  const horizon = Math.max(2, Math.round(3 * tickRate / period));
  let unseenSteps = 0, unseenStartX = 0, unseenStartZ = 0, searchReach = 0;
  let count = 0, turn = 0, range = 0, startX = 0, startZ = 0, heading = 0;
  let minimumYaw = 0, maximumYaw = 0, previousSearchStalled = false;
  let forwardAttempts = 0, forwardMeters = 0, lastX = 0, lastZ = 0;
  let recovery: { x: number; z: number; start: number; newGround: boolean; timedOut: boolean } | undefined;
  let recovered = 0, stayedBlocked = 0;
  let discoveries = 0, positiveCredits = 0, negativeCredits = 0, newCells = 0;
  const visited = new Set<string>();
  // A respawn starts a new segment but revisiting the same ground is still a revisit.
  const unsuccessful = new Map<string, number>();
  let route: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const { obs, reset } = steps[i];
    if (reset) { count = unseenSteps = 0; previousSearchStalled = false; }
    const x = obs[scene] * (bounds.max[0] - bounds.min[0]) * .5;
    const z = obs[scene + 2] * (bounds.max[2] - bounds.min[2]) * .5;
    const yaw = Math.atan2(obs[scene + 3], obs[scene + 4]);
    const cell = Math.floor(x / 4) + ',' + Math.floor(z / 4);
    if (reset || obs[0] > 0) recovery = undefined;
    if (recovery) {
      // A scan or wall press is one event even if it lasts several windows.
      // End the observation on contact or respawn; a truncated wait is unscored.
      recovery.newGround ||= !visited.has(cell);
      if (Math.hypot(x - recovery.x, z - recovery.z) >= 2) {
        if (!recovery.timedOut) {
          recovered++;
          if (recovery.newGround && positiveCredits < 12) {
            // Assign the bounded recovery reward to actions which actually moved
            // the player toward the exit, including a useful sideways step.
            const credits = Math.min(2, 12 - positiveCredits);
            creditProgress(steps, bounds, recovery.start, i, .01 * credits, false);
            positiveCredits += credits;
          }
        }
        recovery = undefined;
      } else if (i - recovery.start >= horizon && !recovery.timedOut) {
        recovery.timedOut = true;
        stayedBlocked++;
        if (negativeCredits < 8) {
          penalizeStall(steps, bounds, recovery.start, i, period / tickRate);
          negativeCredits++;
        }
      }
    }
    if (obs[0] > 0) {
      // A new approach that actually revealed a rival is more useful than distance alone.
      if (unseenSteps >= 2 && discoveries < 3 && Math.max(searchReach, Math.hypot(x - unseenStartX, z - unseenStartZ)) >= 2) {
        // Reserve sighting credit even when the approach used the entire movement budget.
        steps[i - 1].reward += .02;
        discoveries++;
      }
      count = unseenSteps = 0; previousSearchStalled = false; visited.add(cell); continue;
    }
    // The sighting belongs to the full search, even when it falls at the
    // beginning of the next three-second movement measurement.
    if (!unseenSteps) { unseenStartX = x; unseenStartZ = z; searchReach = 0; }
    unseenSteps++;
    searchReach = Math.max(searchReach, Math.hypot(x - unseenStartX, z - unseenStartZ));
    if (!count) { forwardAttempts = forwardMeters = 0; startX = x; startZ = z; turn = minimumYaw = maximumYaw = 0; range = 0; newCells = 0; route = []; }
    else {
      // Only past actions could have produced the displacement observed now.
      if (Math.tanh(steps[i - 1].axes[3]) > .3) forwardAttempts++;
      forwardMeters -= (x - lastX) * Math.sin(yaw) + (z - lastZ) * Math.cos(yaw);
      turn += wrapAngle(yaw - heading);
      minimumYaw = Math.min(minimumYaw, turn);
      maximumYaw = Math.max(maximumYaw, turn);
    }
    lastX = x; lastZ = z; heading = yaw;
    range = Math.max(range, Math.hypot(x - startX, z - startZ));
    if (!visited.has(cell)) newCells++;
    if (route.at(-1) !== cell) route.push(cell);
    if (++count >= horizon) {
      const scanned = maximumYaw - minimumYaw > Math.PI * .65;
      const pushing = forwardAttempts >= .75 * (horizon - 1);
      if (!recovery && range < 1.5 && (scanned || pushing)) recovery = { x, z, start: i, newGround: false, timedOut: false };
      // Credit and debit remain small compared with a frag or the match outcome.
      if (newCells >= 2 && Math.hypot(x - startX, z - startZ) >= 4 && positiveCredits < 12) {
        // The same ground can be covered backing away from the camera. Reward
        // additional forward progress only on a genuinely new, displaced route.
        const start = i + 1 - count;
        creditProgress(steps, bounds, start, i, .01, false);
        positiveCredits++;
        if (forwardMeters >= 4 && positiveCredits < 12) {
          creditProgress(steps, bounds, start, i, .01, true);
          positiveCredits++;
        }
      } else if (negativeCredits < 8 && (
        (range < 2.5 && (scanned || previousSearchStalled)) ||
        (range < 1.5 && pushing)
      )) {
        if (range < 1.5 && pushing) penalizeStall(steps, bounds, i + 1 - count, i, period / tickRate);
        else steps[i - 1].reward -= .015;
        negativeCredits++;
      }
      if (route.length >= 3) {
        const path = route.join('/');
        const attempts = unsuccessful.get(path) ?? 0;
        // Give a useful approach time to reveal a rival. Never look through a respawn.
        let revealed = false;
        for (let j = i + 1; j < Math.min(steps.length, i + 1 + horizon); j++) {
          if (steps[j].reset) break;
          if (steps[j].obs[0] > 0) { revealed = true; break; }
        }
        if (!revealed) {
          unsuccessful.set(path, attempts + 1);
          if (attempts >= 2 && negativeCredits < 8) {
            steps[i - 1].reward -= .01;
            negativeCredits++;
          }
        }
      }
      previousSearchStalled = range < 1.5;
      count = 0;
    }
    visited.add(cell);
  }
  return { recovered, stayedBlocked };
}
