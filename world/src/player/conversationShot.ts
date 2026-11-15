import * as THREE from 'three';

/**
 * Talking with a resident: the camera slips out to one side of the protagonist and frames both heads, so
 * the person speaking is never hidden behind the back you are steering. It picks the side the camera is
 * already on, falls back to the other when a wall is in the way, and gives up (leaving the ordinary
 * camera alone) when neither side has room or a clear line to the speaker. Pure placement: the caller
 * owns blending and the collision query.
 */
export const CONVERSATION_SHOT = Object.freeze({
  /** Camera offset from the protagonist's head: behind them along the line to the speaker, out to the side, and up. */
  back: 1.25, side: 1.15, lift: .12,
  /** Where between the two heads the camera looks (0 protagonist, 1 speaker). */
  bias: .7,
  /** Shortest usable arm, wall clearance, and how far apart the two may stand. */
  minArm: .9, skin: .25, near: .4, reach: 5,
  /** Blend rates per second, in and out, and the view angle (degrees) the shot narrows to. */
  in: 5, out: 7, fov: 58,
});

/** Distance to the first blocker along a unit direction, or null when the way is clear. */
export type ShotCast = (from: THREE.Vector3, direction: THREE.Vector3, max: number) => number | null;
export interface ConversationShot { position: THREE.Vector3; target: THREE.Vector3; side: 1 | -1 }

const flat = new THREE.Vector3(), right = new THREE.Vector3(), arm = new THREE.Vector3(), sight = new THREE.Vector3(), want = new THREE.Vector3();

/** `camera` is where the view currently is (or the last shot), which decides the preferred side. */
export function conversationShot(playerHead: THREE.Vector3, speakerHead: THREE.Vector3, camera: THREE.Vector3, cast: ShotCast,
  out: ConversationShot = { position: new THREE.Vector3(), target: new THREE.Vector3(), side: 1 }): ConversationShot | null {
  const C = CONVERSATION_SHOT;
  flat.subVectors(speakerHead, playerHead); flat.y = 0;
  const apart = flat.length();
  if (!(apart >= C.near && apart <= C.reach) || !Number.isFinite(speakerHead.y - playerHead.y)) return null;
  flat.multiplyScalar(1 / apart); right.set(-flat.z, 0, flat.x);
  const prefer: 1 | -1 = (camera.x - playerHead.x) * right.x + (camera.z - playerHead.z) * right.z < 0 ? -1 : 1;
  for (const side of [prefer, -prefer as 1 | -1]) {
    want.copy(playerHead).addScaledVector(flat, -C.back).addScaledVector(right, side * C.side); want.y += C.lift;
    arm.subVectors(want, playerHead); const length = arm.length(); arm.multiplyScalar(1 / length);
    const wall = cast(playerHead, arm, length + C.skin), allowed = wall === null ? length : Math.min(length, wall - C.skin);
    if (allowed < C.minArm) continue;
    out.position.copy(playerHead).addScaledVector(arm, allowed);
    sight.subVectors(speakerHead, out.position); const far = sight.length(); sight.multiplyScalar(1 / far);
    if (cast(out.position, sight, Math.max(0, far - .45)) !== null) continue;
    out.target.lerpVectors(playerHead, speakerHead, C.bias); out.side = side;
    return out;
  }
  return null;
}
