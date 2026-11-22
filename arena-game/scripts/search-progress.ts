// Search credit is calculated after the simulated match. Only the actor's own
// observed movement and subsequent sightings are used, never a hidden rival pose.
import { HUMAN_FEATURES, wrapAngle } from '../shared/humanCombat.ts';
import type { MapData } from '../shared/map.ts';

interface Decision { obs: number[]; axes: number[]; reset: boolean; reward: number }
const scene = HUMAN_FEATURES.length;

export function scoreSearchProgress(steps: Decision[], bounds: MapData['bounds'], period: number, tickRate: number) {
  const horizon = Math.max(2, Math.round(3 * tickRate / period));
  let count = 0, turn = 0, range = 0, startX = 0, startZ = 0, heading = 0;
  let minimumYaw = 0, maximumYaw = 0, previousSearchStalled = false;
  let forwardAttempts = 0;
  let positiveCredits = 0, negativeCredits = 0, newCells = 0;
  const visited = new Set<string>();
  // A respawn starts a new segment but revisiting the same ground is still a revisit.
  const unsuccessful = new Map<string, number>();
  let route: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const { obs, reset } = steps[i];
    if (reset) { count = 0; previousSearchStalled = false; }
    const x = obs[scene] * (bounds.max[0] - bounds.min[0]) * .5;
    const z = obs[scene + 2] * (bounds.max[2] - bounds.min[2]) * .5;
    const yaw = Math.atan2(obs[scene + 3], obs[scene + 4]);
    const cell = Math.floor(x / 4) + ',' + Math.floor(z / 4);
    if (obs[0] > 0) {
      // A new approach that actually revealed a rival is more useful than distance alone.
      if (!reset && count >= 2 && range >= 2 && positiveCredits <= 10) { steps[i - 1].reward += .02; positiveCredits += 2; }
      count = 0; previousSearchStalled = false; visited.add(cell); continue;
    }
    if (!count) { forwardAttempts = 0; startX = x; startZ = z; turn = minimumYaw = maximumYaw = 0; range = 0; newCells = 0; route = []; }
    else {
      // Only past actions could have produced the displacement observed now.
      if (Math.tanh(steps[i - 1].axes[3]) > .3) forwardAttempts++;
      turn += wrapAngle(yaw - heading);
      minimumYaw = Math.min(minimumYaw, turn);
      maximumYaw = Math.max(maximumYaw, turn);
    }
    heading = yaw;
    range = Math.max(range, Math.hypot(x - startX, z - startZ));
    if (!visited.has(cell)) newCells++;
    if (route.at(-1) !== cell) route.push(cell);
    if (++count >= horizon) {
      // Credit and debit remain small compared with a frag or the match outcome.
      if (newCells >= 2 && Math.hypot(x - startX, z - startZ) >= 4 && positiveCredits < 12) {
        // Give the actions that finally left a stagnant search area credit for the recovery.
        const credits = Math.min(previousSearchStalled ? 2 : 1, 12 - positiveCredits);
        steps[i - 1].reward += .01 * credits; positiveCredits += credits;
      } else if (negativeCredits < 8 && (
        (range < 2.5 && (maximumYaw - minimumYaw > Math.PI * .65 || previousSearchStalled)) ||
        (range < 1.5 && forwardAttempts >= .75 * (horizon - 1))
      )) {
        steps[i - 1].reward -= .015; negativeCredits++;
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
}
