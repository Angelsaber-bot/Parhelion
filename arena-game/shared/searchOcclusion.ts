import { TICK_HZ } from './content.ts';
import { smokeBlocks, type Smoke } from './grenade.ts';
import { rayShield } from './hit.ts';
import { wrapAngle } from './humanCombat.ts';
import { raycastMap, type ArenaMap, type Vec3 } from './map.ts';
import type { Shield } from './match.ts';
import { aimDir, forward, playerEye, type PlayerState } from './sim.ts';

const SENSOR_RANGE = 9;
const SIDE_ANGLE = .48;

/** Sample one sight line inside the camera, stopping at the first opaque surface. */
function visibleSmoke(map: ArenaMap, eye: Vec3, ray: Vec3, smokes: readonly Smoke[], shields: readonly Shield[]) {
  let reach = Math.min(SENSOR_RANGE, raycastMap(map, eye, ray, SENSOR_RANGE));
  for (const shield of shields) {
    if (shield.hp > 0 && shield.life > 0) {
      reach = Math.min(reach, rayShield(eye, ray, shield.x, shield.y, shield.z, shield.yaw));
    }
  }
  return reach > .2 && smokeBlocks(smokes, eye, [
    eye[0] + ray[0] * reach, eye[1] + ray[1] * reach, eye[2] + ray[2] * reach,
  ]);
}

/** Step sideways around visible smoke while keeping the affected lane in view. */
export function smokeEdgeSearch() {
  let probeAt = 0, flankUntil = 0, orientUntil = 0;
  let peekSide = 1, bearing = 0, gazeX = 0, gazeZ = 0;
  return (map: ArenaMap, me: PlayerState, tick: number, smokes: readonly Smoke[], strafe: number,
    lastSeenYaw?: number, shields: readonly Shield[] = []) => {
    if (tick >= probeAt && tick >= orientUntil) {
      probeAt = tick + 8;
      if (!smokes.length) return;
      const eye: Vec3 = [me.x, me.y + playerEye(map, me), me.z];
      const opaqueAt = (offset: number) => visibleSmoke(map, eye, aimDir(me.yaw + offset, me.pitch), smokes, shields);
      const ahead = opaqueAt(0), left = opaqueAt(SIDE_ANGLE), right = opaqueAt(-SIDE_ANGLE);
      if (ahead || left || right) {
        bearing = me.yaw + (ahead ? 0 : left ? SIDE_ANGLE : -SIDE_ANGLE);
        const [x, z] = forward(bearing);
        const leftRoom = raycastMap(map, eye, [z, 0, -x], 5);
        const rightRoom = raycastMap(map, eye, [-z, 0, x], 5);
        if (leftRoom < 1 && rightRoom >= 1) peekSide = 1;
        else if (rightRoom < 1 && leftRoom >= 1) peekSide = -1;
        else if (left !== right) peekSide = left ? 1 : -1;
        else peekSide = strafe < 0 ? -1 : 1;

        const [gx, gz] = forward(lastSeenYaw ?? bearing);
        gazeX = me.x + gx * SENSOR_RANGE;
        gazeZ = me.z + gz * SENSOR_RANGE;
        flankUntil = tick + Math.round(.92 * TICK_HZ);
        orientUntil = flankUntil + Math.round(.68 * TICK_HZ);
      }
    }
    if (tick >= orientUntil) return;
    const [x, z] = forward(bearing);
    const face = Math.atan2(me.x - gazeX, me.z - gazeZ);
    return { dx: -z * peekSide, dz: x * peekSide, yaw: wrapAngle(face - me.yaw), moving: tick < flankUntil };
  };
}
