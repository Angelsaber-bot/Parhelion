import { smokeBlocks } from '../../shared/grenade.ts';
import { lineOfSight, type ArenaMap, type Vec3 } from '../../shared/map.ts';
import type { Smoke } from '../../shared/grenade.ts';

/** Sample heights (standing, crouched) for "can I already see this player". */
const SAMPLES: readonly (readonly [number, number])[] = [[.3, .3], [1.1, .8], [1.6, 1.05]];

/**
 * Qin's edict reveal draws an enemy's silhouette only while walls (or smoke) hide every sampled
 * point of their body from the camera. A player you can see at all is drawn normally, so the
 * silhouette never tints a visible body or its own inner layers.
 */
export function hiddenFromView(map: ArenaMap, eye: Vec3, feet: Vec3, crouched: boolean, smokes: readonly Smoke[] = []): boolean {
  for (const [stand, crouch] of SAMPLES) {
    const point: Vec3 = [feet[0], feet[1] + (crouched ? crouch : stand), feet[2]];
    if (lineOfSight(map, eye, point) && !smokeBlocks(smokes, eye, point)) return false;
  }
  return true;
}
