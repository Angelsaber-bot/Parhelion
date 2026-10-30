import type { StrikeOriginGeometry } from './combatActions';
import type { Point3 } from './combat';
/** A bounded presentation command; callers bind contacts to their current skill generation. */
export interface SkillPoseCommand {
  direction: Point3;
  contacts: number;
  onContact: (position: Point3, direction: Point3, socket?: string, geometry?: StrikeOriginGeometry) => void;
  onFinish: (completed: boolean) => void;
}
export function validSkillPose(command: SkillPoseCommand): boolean {
  return Number.isInteger(command.contacts) && command.contacts > 0 && command.contacts <= 4
    && Number.isFinite(command.direction.x) && Number.isFinite(command.direction.z)
    && Math.hypot(command.direction.x, command.direction.z) > 1e-6;
}
