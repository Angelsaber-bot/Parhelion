// First-person capsule controller over three-mesh-bvh colliders.
// This is a viewer controller for walking the map. The real game movement will live in the
// shared deterministic applyInput(step, state) rules; the capsule/collider setup here is meant to carry over.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

export interface Collider { name: string; bvh: MeshBVH; enabled: boolean }
/** Vertical wind column: lifts a gliding player from y0 up to about y1. */
export interface Updraft { x: number; z: number; r: number; y0: number; y1: number }

export const PLAYER = {
  radius: 0.35,
  height: 1.75,
  eye: 1.62,
  walk: 5.5,
  sprint: 9,
  jump: 7.2,
  gravity: 22,
  fly: 40,
  maxFall: 28, // keeps per-step travel below the capsule radius at 120 Hz
  glide: 8.5, // horizontal glider speed
  glideSink: 2.4, // glider descent rate
  lift: 30, // updraft acceleration
  liftMax: 10,
};

const seg = new THREE.Line3();
const box = new THREE.Box3();
const triPoint = new THREE.Vector3();
const capPoint = new THREE.Vector3();
const delta = new THREE.Vector3();
const dir = new THREE.Vector3();
const WALKABLE = Math.cos(THREE.MathUtils.degToRad(50));

export class Player {
  pos = new THREE.Vector3(); // feet
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  swimming = false;
  /** Genshin-style glider: press jump in the air to open/close. Updrafts open it automatically. */
  gliding = false;
  inUpdraft = false;
  updrafts: Updraft[] = [];
  private jumpHeld = false;
  private _flying = false;
  get flying() { return this._flying; }
  set flying(value: boolean) {
    if (value === this._flying) return;
    this._flying = value;
    this.jumpHeld = false;
    this.gliding = false;
    // Debug flight can move arbitrarily far from the last grounded/water contact.
    this.vel.set(0, 0, 0);
    this.onGround = false;
    this.swimming = false;
    this.gliding = false;
  }

  constructor(public colliders: Collider[], public waterLevel: number) {}

  /** Full new-game placement, unlike an ordinary teleport/defeat respawn. */
  restartAt(x: number, y: number, z: number, yaw = 0) {
    this.flying = false;
    this.pitch = 0;
    this.jumpHeld = false;
    this.inUpdraft = false;
    this.teleport(x, y, z, yaw);
  }

  teleport(x: number, y: number, z: number, yaw?: number) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    // Contact flags belong to the old location, not the destination.
    this.onGround = false;
    this.swimming = false;
    this.gliding = false;
    if (yaw !== undefined) this.yaw = yaw;
  }

  /** input: x = strafe (+right), z = forward (+fwd) */
  step(dt: number, input: { x: number; z: number; jump: boolean; sprint: boolean; evade?: { x: number; z: number; strength?: number } }) {
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = fwd.multiplyScalar(input.z).add(right.multiplyScalar(input.x));
    if (wish.lengthSq() > 1) wish.normalize();

    if (this.flying) {
      const sp = PLAYER.fly * (input.sprint ? 2.5 : 1);
      // Original free-flight: W/S follow the full camera direction, including pitch.
      // A/D remain screen-right strafe. Space/F keep their normal meanings; no altitude bindings.
      const cp = Math.cos(this.pitch);
      const look = new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
      const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const flight = look.multiplyScalar(input.z).addScaledVector(r, input.x);
      if (flight.lengthSq() > 1) flight.normalize();
      this.pos.addScaledVector(flight, sp * dt);
      this.vel.set(0, 0, 0);
      return;
    }

    const jumpPressed = input.jump && !this.jumpHeld;
    this.jumpHeld = input.jump;
    const feetDepth = this.waterLevel - this.pos.y;
    this.swimming = feetDepth > 1.15;
    let speed = input.sprint ? PLAYER.sprint : PLAYER.walk;
    let lift = 0;
    this.inUpdraft = false;
    for (const u of this.updrafts) {
      if (Math.hypot(this.pos.x - u.x, this.pos.z - u.z) > u.r || this.pos.y < u.y0 - 1 || this.pos.y > u.y1 + 2) continue;
      this.inUpdraft = true;
      lift = PLAYER.lift * THREE.MathUtils.smoothstep(u.y1 + 1, u.y1 - 6, this.pos.y);
    }
    if (this.onGround || this.swimming) this.gliding = false;
    else if (jumpPressed) this.gliding = !this.gliding;
    if (this.inUpdraft && !this.onGround && !this.swimming) this.gliding = true;
    if (this.gliding) {
      speed = PLAYER.glide;
      this.vel.y -= PLAYER.gravity * 0.35 * dt;
      if (lift > 0) this.vel.y = Math.min(this.vel.y + lift * dt, PLAYER.liftMax);
      else if (this.vel.y > 0) this.vel.y *= Math.pow(0.15, dt);
      this.vel.y = Math.max(this.vel.y, -PLAYER.glideSink);
    } else if (this.swimming) {
      speed *= 0.55;
      this.vel.y += (feetDepth - 1.15) * 30 * dt; // buoyancy keeps the head above water
      this.vel.y *= Math.pow(0.02, dt);
      if (input.jump) this.vel.y = Math.max(this.vel.y, 2.5);
      // lunge out of the water onto a low ledge (rocks, piers, stepping stones)
      if (jumpPressed && feetDepth < 1.6) this.vel.y = 8.2;
    } else {
      if (this.onGround && input.jump) this.vel.y = PLAYER.jump;
      this.vel.y = Math.max(this.vel.y - PLAYER.gravity * dt, -PLAYER.maxFall);
      // vents also kick a standing/jumping player up so the column is easy to enter
      if (lift > 0) this.vel.y = Math.max(this.vel.y, 4);
    }

    if (input.evade && !this.swimming && !this.gliding && this.onGround &&
      Number.isFinite(input.evade.x) && Number.isFinite(input.evade.z)) {
      const magnitude = Math.hypot(input.evade.x, input.evade.z);
      if (magnitude > .001) this.pos.addScaledVector(new THREE.Vector3(input.evade.x / magnitude, 0, input.evade.z / magnitude), 13 * dt * THREE.MathUtils.clamp(input.evade.strength ?? 1, 0, 1));
    } else this.pos.addScaledVector(wish, speed * dt);
    this.pos.addScaledVector(this.vel, dt);
    this.collide();
    // Landing is authoritative in this step: do not leave the canopy/ADS in glide mode
    // until the next physics step (which can be a different rendered frame).
    if (this.onGround) this.gliding = false;
    // Horizontal velocity only comes from slope slides / landings. Kill it on the ground and
    // bleed it off in the air or water, otherwise it carries over and the player keeps gliding.
    if (this.onGround) { this.vel.x = 0; this.vel.z = 0; }
    else {
      const k = Math.pow(this.swimming ? 0.02 : 0.3, dt);
      this.vel.x *= k; this.vel.z *= k;
    }
    if (this.pos.y < -30) this.pos.y = 40; // safety net
  }

  private collide() {
    const r = PLAYER.radius;
    seg.start.set(this.pos.x, this.pos.y + r, this.pos.z);
    seg.end.set(this.pos.x, this.pos.y + PLAYER.height - r, this.pos.z);
    const before = seg.start.clone();
    let floorContact = false;
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      box.makeEmpty().expandByPoint(seg.start).expandByPoint(seg.end);
      box.min.addScalar(-r); box.max.addScalar(r);
      c.bvh.shapecast({
        intersectsBounds: (b) => b.intersectsBox(box),
        intersectsTriangle: (tri) => {
          const d = tri.closestPointToSegment(seg, triPoint, capPoint);
          if (d < r) {
            dir.subVectors(capPoint, triPoint).normalize();
            const depth = r - d;
            if (dir.y > WALKABLE) {
              // walkable floor: resolve straight up so standing on a slope doesn't creep downhill
              floorContact = true;
              const up = depth / dir.y;
              seg.start.y += up;
              seg.end.y += up;
            } else {
              seg.start.addScaledVector(dir, depth);
              seg.end.addScaledVector(dir, depth);
            }
          }
        },
      });
    }
    delta.subVectors(seg.start, before);
    // grounded = touching a walkable surface (≤ ~50°) while not moving upwards (e.g. mid-jump)
    this.onGround = floorContact && this.vel.y <= 0;
    this.pos.add(delta);
    if (this.onGround) this.vel.y = Math.max(0, Math.min(this.vel.y, 0));
    else if (delta.lengthSq() > 1e-10) {
      delta.normalize();
      this.vel.addScaledVector(delta, -delta.dot(this.vel)); // slide along what we hit
    }
  }

  eyePos(out: THREE.Vector3) {
    return out.set(this.pos.x, this.pos.y + PLAYER.eye, this.pos.z);
  }
}
