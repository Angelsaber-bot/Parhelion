import { HUMAN_FEATURES } from '../shared/humanCombat.ts';
import type { MapData } from '../shared/map.ts';

interface ObservationStep { obs: readonly number[]; reset: boolean; reward: number }

/** Score the first sighting of a stationary rival. The caller clips observations at
 * the end of the wait. Credit the successful approach, excluding loops and respawns. */
export function creditWaitingSearch(steps: ObservationStep[], bounds: MapData['bounds']) {
  if (!steps.length || steps[0].obs[0] > 0) return false;
  const xIndex = HUMAN_FEATURES.length, zIndex = xIndex + 2;
  const cell = (obs: readonly number[]) => {
    const x = (obs[xIndex] + 1) * (bounds.max[0] - bounds.min[0]) / 2;
    const z = (obs[zIndex] + 1) * (bounds.max[2] - bounds.min[2]) / 2;
    return `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  };
  const route = [{ cell: cell(steps[0].obs), action: -1 }];
  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];
    if (step.reset) return false;
    const here = cell(step.obs);
    if (here !== route.at(-1)!.cell) {
      const lastVisit = route.findIndex(entry => entry.cell === here);
      if (lastVisit >= 0) route.length = lastVisit + 1;
      else route.push({ cell: here, action: i - 1 });
    }
    if (step.obs[0] !== 1) continue;
    steps[i - 1].reward += .04;
    for (const { action } of route.slice(1)) steps[action].reward += .08 / (route.length - 1);
    return true;
  }
  return false;
}
