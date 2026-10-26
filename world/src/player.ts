// First-person capsule controller over three-mesh-bvh colliders.
// This is a viewer controller for walking the map. The real game movement will live in the
// shared deterministic applyInput(step, state) rules; the capsule/collider setup here is meant to carry over.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

export interface Collider { name: string; bvh: MeshBVH; enabled: boolean }

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
};

const seg = new THREE.Line3();
const box = new THREE.Box3();
const triPoint = new THREE.Vector3();
const capPoint = new THREE.Vector3();
const delta = new THREE.Vector3();
const dir = new THREE.Vector3();

export class Player {
  pos = new THREE.Vector3(); // feet
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  swimming = false;
  flying = false;

  constructor(public colliders: Collider[], public waterLevel: number) {}

  teleport(x: number, y: number, z: number, yaw?: number) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
  }

  /** input: x = strafe (+right), z = forward (+fwd) */
  step(dt: number, input: { x: number; z: number; jump: boolean; sprint: boolean; up: number }) {
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = fwd.multiplyScalar(input.z).add(right.multiplyScalar(input.x));
    if (wish.lengthSq() > 1) wish.normalize();

    if (this.flying) {
      const sp = PLAYER.fly * (input.sprint ? 2.5 : 1);
      const look = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      this.pos.addScaledVector(look, input.z * sp * dt).addScaledVector(r, input.x * sp * dt);
      this.pos.y += input.up * sp * dt;
      this.vel.set(0, 0, 0);
      return;
    }

    const feetDepth = this.waterLevel - this.pos.y;
    this.swimming = feetDepth > 1.15;
    let speed = input.sprint ? PLAYER.sprint : PLAYER.walk;
    if (this.swimming) {
      speed *= 0.55;
      this.vel.y += (feetDepth - 1.15) * 30 * dt; // buoyancy keeps the head above water
      this.vel.y *= Math.pow(0.02, dt);
      if (input.jump) this.vel.y = Math.max(this.vel.y, 2.5);
    } else {
      if (this.onGround && input.jump) this.vel.y = PLAYER.jump;
      this.vel.y = Math.max(this.vel.y - PLAYER.gravity * dt, -PLAYER.maxFall);
    }

    this.pos.addScaledVector(wish, speed * dt);
    this.pos.addScaledVector(this.vel, dt);
    this.collide(dt);
    if (this.pos.y < -30) this.pos.y = 40; // safety net
  }

  private collide(dt: number) {
    const r = PLAYER.radius;
    seg.start.set(this.pos.x, this.pos.y + r, this.pos.z);
    seg.end.set(this.pos.x, this.pos.y + PLAYER.height - r, this.pos.z);
    const before = seg.start.clone();
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
            seg.start.addScaledVector(dir, depth);
            seg.end.addScaledVector(dir, depth);
          }
        },
      });
    }
    delta.subVectors(seg.start, before);
    // grounded if we were pushed up more than gravity pulled us down (i.e. standing on something walkable)
    this.onGround = delta.y > Math.abs(dt * this.vel.y * 0.25) && delta.y > 0.6 * delta.length();
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
