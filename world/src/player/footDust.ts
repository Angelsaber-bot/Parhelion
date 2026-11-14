import * as THREE from 'three';

/**
 * The ground answers the protagonist's feet: a small puff every stride, a ring of dust on a hard
 * landing, a kick on take-off, and droplets instead of dust when wading. The puff's colour and weight
 * come from where you are — snow in the winter city, sand in Egypt and on the pirate coast, ash in
 * burning Kyoto, pale stone dust in the home town. One instanced mesh (one draw call), a fixed pool,
 * no per-frame allocation. Visual only.
 */
export type DustSurface = 'earth' | 'snow' | 'sand' | 'ash' | 'stone' | 'water';
export const FOOT_DUST = Object.freeze({
  pool: 56, life: .6,
  /** Metres between stride puffs at a walk and at a sprint (interpolated by speed). */
  strideWalk: .85, strideSprint: 1.3, walkSpeed: 4.5, sprintSpeed: 9, minSpeed: 1.6,
  /** A landing puffs only when it hits the ground at least this fast (m/s); the ring grows up to `landMax`. */
  landMin: 5, landMax: 22, takeoff: 4,
  /** Wading depth range (m) that splashes instead of dusting. */
  wadeMin: .04, wadeMax: 1.15,
});
export const DUST_LOOK: Readonly<Record<DustSurface, { color: number; size: number; rise: number; gravity: number; drag: number }>> = Object.freeze({
  earth: { color: 0xd8c8a4, size: .15, rise: .9, gravity: .6, drag: 3.2 },
  snow: { color: 0xd6e2f2, size: .17, rise: 1.3, gravity: 3.2, drag: 2.2 },
  sand: { color: 0xf0deb0, size: .16, rise: .8, gravity: .9, drag: 3 },
  ash: { color: 0xa69b96, size: .15, rise: 1.1, gravity: .2, drag: 2.6 },
  stone: { color: 0xdedbd2, size: .11, rise: .7, gravity: .5, drag: 3.6 },
  water: { color: 0xe8f8ff, size: .09, rise: 3.4, gravity: 11, drag: .4 },
});
const REGION_SURFACE: Readonly<Record<string, DustSurface>> = Object.freeze({
  alpha: 'earth', britain: 'earth', qin: 'earth', orleans: 'earth', home: 'stone', kyoto: 'ash', winter: 'snow', egypt: 'sand', blacksail: 'sand',
});
/** What the feet are kicking up: water when wading, else the region's ground. */
export function dustSurface(region: string, wadeDepth: number): DustSurface {
  if (wadeDepth > FOOT_DUST.wadeMin && wadeDepth <= FOOT_DUST.wadeMax) return 'water';
  return REGION_SURFACE[region] ?? 'earth';
}
/** Stride length for a ground speed: longer steps at a run. */
export function strideLength(speed: number) {
  const t = THREE.MathUtils.clamp((speed - FOOT_DUST.walkSpeed) / (FOOT_DUST.sprintSpeed - FOOT_DUST.walkSpeed), 0, 1);
  return FOOT_DUST.strideWalk + (FOOT_DUST.strideSprint - FOOT_DUST.strideWalk) * t;
}
/** How many puffs a landing throws (0 below the threshold). */
export function landingPuffs(fallSpeed: number) {
  if (!(fallSpeed >= FOOT_DUST.landMin)) return 0;
  return Math.round(6 + 10 * THREE.MathUtils.clamp((fallSpeed - FOOT_DUST.landMin) / (FOOT_DUST.landMax - FOOT_DUST.landMin), 0, 1));
}

export interface FootDustState { pos: THREE.Vector3; vel: THREE.Vector3; onGround: boolean; swimming: boolean; gliding: boolean; flying?: boolean }

export class FootDust {
  readonly mesh: THREE.InstancedMesh;
  private readonly geometry = new THREE.IcosahedronGeometry(1, 1);
  private readonly material = new THREE.MeshBasicMaterial({ transparent: true, opacity: .5, depthWrite: false });
  private readonly p = Array.from({ length: FOOT_DUST.pool }, () => new THREE.Vector3());
  private readonly v = Array.from({ length: FOOT_DUST.pool }, () => new THREE.Vector3());
  private readonly age = new Float32Array(FOOT_DUST.pool).fill(Infinity);
  private readonly size = new Float32Array(FOOT_DUST.pool);
  private readonly look: DustSurface[] = new Array(FOOT_DUST.pool).fill('earth');
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly tmpA = new THREE.Vector3(); private readonly tmpB = new THREE.Vector3();
  private readonly last = new THREE.Vector3(Infinity, 0, 0);
  private next = 0; private travelled = 0; private foot = 1; private wasGround = true; private airFall = 0; private seed = 1;
  /** Puffs emitted so far (tests and diagnostics). */
  emitted = 0;
  constructor() {
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, FOOT_DUST.pool);
    this.mesh.name = 'FootDust'; this.mesh.frustumCulled = false; this.mesh.raycast = () => {}; this.mesh.renderOrder = 2;
    this.dummy.scale.setScalar(0); this.dummy.updateMatrix();
    for (let i = 0; i < FOOT_DUST.pool; i++) { this.mesh.setMatrixAt(i, this.dummy.matrix); this.mesh.setColorAt(i, this.color.set(0xffffff)); }
    this.mesh.userData.noGroundGrime = true;
  }
  /** Cheap deterministic jitter (no Math.random: replays and tests stay stable). */
  private rand() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, surface: DustSurface, scale = 1) {
    const i = this.next; this.next = (this.next + 1) % FOOT_DUST.pool;
    this.p[i].set(x, y, z); this.v[i].set(vx, vy, vz); this.age[i] = 0; this.look[i] = surface;
    this.size[i] = DUST_LOOK[surface].size * scale * (.75 + this.rand() * .5);
    this.mesh.setColorAt(i, this.color.set(DUST_LOOK[surface].color)); if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.emitted++;
  }
  /** A ring thrown outward from a point: landings, take-offs. */
  burst(at: THREE.Vector3, count: number, surface: DustSurface, speed = 2.2) {
    const look = DUST_LOOK[surface];
    for (let k = 0; k < count; k++) {
      const a = (k + this.rand() * .6) / count * Math.PI * 2, s = speed * (.6 + this.rand() * .6);
      this.spawn(at.x + Math.cos(a) * .18, at.y + .06, at.z + Math.sin(a) * .18, Math.cos(a) * s, look.rise * (.5 + this.rand() * .8), Math.sin(a) * s, surface, 1.15);
    }
  }
  /** A spray thrown back off a surface a round just struck. `back` is a unit vector pointing away from the
   * surface (toward the shooter); the chips fan around it and lift a little. */
  impact(at: THREE.Vector3, back: THREE.Vector3, surface: DustSurface, count = 4) {
    const look = DUST_LOOK[surface];
    // Two axes across the spray.
    const ax = Math.abs(back.y) < .9 ? this.tmpA.set(0, 1, 0).cross(back).normalize() : this.tmpA.set(1, 0, 0).cross(back).normalize(), ay = this.tmpB.crossVectors(back, ax);
    for (let k = 0; k < count; k++) {
      const out = 1.4 + this.rand() * 2.2, u = (this.rand() - .5) * 2.4, w = (this.rand() - .5) * 2.4;
      this.spawn(at.x + back.x * .05, at.y + back.y * .05, at.z + back.z * .05,
        back.x * out + ax.x * u + ay.x * w, back.y * out + ax.y * u + ay.y * w + look.rise * .4, back.z * out + ax.z * u + ay.z * w, surface, .7);
    }
    this.mesh.visible = true;
  }
  /** Advance the puffs and emit new ones from how the player is moving. `enabled` false only ages what is already out. */
  update(dt: number, s: FootDustState, surface: DustSurface, enabled = true) {
    if (!(dt > 0)) return;
    const grounded = s.onGround && !s.swimming && !s.gliding && !s.flying;
    // Ground speed from how far the feet actually moved: the player's `vel` only carries the vertical part.
    const fresh = Number.isFinite(this.last.x), mx = fresh ? s.pos.x - this.last.x : 0, mz = fresh ? s.pos.z - this.last.z : 0, moved = Math.hypot(mx, mz);
    const speed = moved / dt < 40 ? moved / dt : 0; this.last.copy(s.pos);
    if (enabled) {
      if (!grounded && !s.swimming) this.airFall = Math.max(this.airFall, -s.vel.y);
      if (grounded && !this.wasGround) { const n = landingPuffs(this.airFall); if (n) this.burst(s.pos, n, surface, 1.6 + n * .12); this.travelled = 0; }
      if (!grounded && this.wasGround && s.vel.y > FOOT_DUST.takeoff && !s.swimming && !s.flying) this.burst(s.pos, 5, surface, 1.4);
      if (grounded) this.airFall = 0;
      if (grounded && speed > FOOT_DUST.minSpeed) {
        this.travelled += moved;
        const stride = strideLength(speed);
        if (this.travelled >= stride) {
          this.travelled %= stride; this.foot = -this.foot;
          // The foot that just pushed off: a little to its side and behind, thrown back and up.
          const ux = mx / moved, uz = mz / moved, sx = -uz * .16 * this.foot, sz = ux * .16 * this.foot, look = DUST_LOOK[surface];
          const n = surface === 'water' ? 5 : speed > 7 ? 4 : 3;
          for (let k = 0; k < n; k++) {
            const back = .4 + this.rand() * 1.2, side = (this.rand() - .5) * 1.8;
            this.spawn(s.pos.x + sx - ux * .15, s.pos.y + .05, s.pos.z + sz - uz * .15, -ux * back - uz * side, look.rise * (.5 + this.rand() * .7), -uz * back + ux * side, surface, speed > 7 ? 1.15 : .9);
          }
        }
      } else if (!grounded) this.travelled = 0;
    }
    this.wasGround = grounded;
    let live = false;
    for (let i = 0; i < FOOT_DUST.pool; i++) {
      if (this.age[i] >= FOOT_DUST.life) continue;
      this.age[i] += dt; const look = DUST_LOOK[this.look[i]], t = Math.min(1, this.age[i] / FOOT_DUST.life);
      this.v[i].y -= look.gravity * dt; this.v[i].multiplyScalar(Math.max(0, 1 - look.drag * dt)); this.p[i].addScaledVector(this.v[i], dt);
      // Swell quickly, then thin away: no alpha per puff, the shrink is the fade.
      const k = t < .25 ? .45 + t / .25 * .55 : 1 - ((t - .25) / .75) ** 1.6;
      this.dummy.position.copy(this.p[i]); this.dummy.rotation.set(i, this.age[i] * 2 + i, 0); this.dummy.scale.setScalar(t >= 1 ? 0 : this.size[i] * k); this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix); live = true;
    }
    if (live) this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = live;
  }
  /** Drop everything in the air (teleports, respawns). */
  clear() { this.age.fill(Infinity); this.last.set(Infinity, 0, 0); this.travelled = 0; this.airFall = 0; this.wasGround = true; this.mesh.visible = false; }
  dispose() { this.mesh.removeFromParent(); this.geometry.dispose(); this.material.dispose(); this.mesh.dispose(); }
}
