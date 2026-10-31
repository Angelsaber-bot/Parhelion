import * as THREE from 'three';
import type { Collider } from './player';

export const EVADE_GROUND_SUPPORT = { drop: .01, rayLift: .002, walkableNormal: Math.cos(50*Math.PI/180), epsilon: 1e-7 } as const;
interface Body {
  pos: THREE.Vector3; vel: THREE.Vector3; onGround: boolean;
  swimming: boolean; gliding: boolean; inUpdraft: boolean; flying: boolean;
}
/** Tiny geometric contact recovery, NOT airborne/coyote permission. Player calls
 * only after a prior-grounded non-jump physics step loses contact in this
 * physics step. The legacy class name is retained for existing diagnostics.
 * At most one downward ray pass and one existing capsule solve. Saved vectors
 * are reused; no mesh/resource/gameplay-clock allocation or timer alteration.
 */
export class EvadeGroundSupport {
  private readonly position = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly ray = new THREE.Ray();
  private supportPasses = 0;
  private bvhRaycasts = 0;
  private capsuleRetries = 0;
  private recovered = 0;
  private rejected = 0;
  private rolledBack = 0;
  tryRecover(body: Body, colliders: readonly Collider[], resolveCollision: () => void): boolean {
    if (body.onGround || body.vel.y > 0 || body.swimming || body.gliding || body.inUpdraft || body.flying
      || !Number.isFinite(body.pos.lengthSq()) || !Number.isFinite(body.vel.lengthSq())) return false;
    const { drop, rayLift, walkableNormal, epsilon } = EVADE_GROUND_SUPPORT;
    this.ray.origin.copy(body.pos); this.ray.origin.y += rayLift; this.ray.direction.set(0,-1,0);
    this.supportPasses++;
    let closest: ReturnType<Collider['bvh']['raycastFirst']> = null;
    for (const collider of colliders) if (collider.enabled) {
      this.bvhRaycasts++;
      const hit = collider.bvh.raycastFirst(this.ray, THREE.DoubleSide, 0, drop + rayLift + .000001);
      if (hit && (!closest || hit.distance < closest.distance)) closest = hit;
    }
    // Support must be below the feet, not merely a capsule rim touching an edge.
    if (!closest || Math.abs(closest.face?.normal.y ?? 0) < walkableNormal
      || closest.point.y > body.pos.y + epsilon || body.pos.y - closest.point.y > drop + epsilon) {
      this.rejected++; return false;
    }
    this.position.copy(body.pos); this.velocity.copy(body.vel); const grounded = body.onGround;
    body.pos.y -= drop; this.capsuleRetries++;
    let accepted = false;
    try {
      resolveCollision();
      const vertical = body.pos.y - this.position.y;
      accepted = body.onGround && Math.abs(body.pos.x-this.position.x) <= epsilon && Math.abs(body.pos.z-this.position.z) <= epsilon
        && vertical >= -drop-epsilon && vertical <= epsilon;
      if (accepted) { this.recovered++; return true; }
      return false;
    } finally {
      if (!accepted) {
        body.pos.copy(this.position); body.vel.copy(this.velocity); body.onGround = grounded; this.rolledBack++;
      }
    }
  }
  get diagnostics() {
    return { supportPasses:this.supportPasses, bvhRaycasts:this.bvhRaycasts, capsuleRetries:this.capsuleRetries,
      recovered:this.recovered, rejected:this.rejected, rolledBack:this.rolledBack,
      maxSupportPassesPerStep:1, maxCapsuleRetriesPerStep:1, drop:EVADE_GROUND_SUPPORT.drop };
  }
}
