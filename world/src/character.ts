// ARCHIVED SEGMENTED BASELINE: retained for explicit regression fixtures only.
// The default game imports skinnedCharacter.ts; this is NOT an automatic load-failure fallback.
// Compatible explorer rig. Authored Fujimaru-inspired surfaces replace the legacy
// placeholder (toon + outline, ~1.7 m) with a simple procedural rig for idle / walk / run / jump / swim.
// It is meant to be replaced by a Blender model that keeps the same joint names
// (Hips, Spine, Head, Arm_L/R + Forearm_L/R, Thigh_L/R + Shin_L/R).
import * as THREE from 'three';
import { installAuthoredPlayer, deformUniformCloth } from './playerMesh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PALETTE = {
  skin: '#ffe3d2',
  blush: '#ffb5b0',
  hair: '#eef3ff',
  hairTip: '#6fd6ea',
  coat: '#f6f3ec',
  trim: '#2fb3b4',
  inner: '#2c3550',
  scarf: '#f08a4b',
  pants: '#3a4560',
  boots: '#4b3a33',
  glove: '#2c3550',
  eye: '#24345c',
  iris: '#3fd0e0',
  gold: '#f4c95d',
  pack: '#8b6a4f',
  metal: '#6f7a8c',
};

type Piece = [THREE.BufferGeometry, THREE.ColorRepresentation, THREE.Matrix4?];

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function T(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}

function build(pieces: Piece[]): THREE.BufferGeometry {
  const gs = pieces.map(([geo, color, m]) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    if (m) g.applyMatrix4(m);
    g.computeVertexNormals();
    const c = new THREE.Color(color);
    const arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  });
  return mergeGeometries(gs);
}

const sphere = (d = 2) => new THREE.IcosahedronGeometry(1, d);
const cyl = (rt: number, rb: number, h: number, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r: number, h: number, s = 6) => new THREE.ConeGeometry(r, h, s);
const box = () => new THREE.BoxGeometry(1, 1, 1);

export interface CharacterRig {
  root: THREE.Group;
  joints: Record<string, THREE.Object3D>;
  meshes: THREE.Mesh[];
  /**
 * Authored male protagonist surfaces on the original compatible procedural animation rig.
 * Model source: assets/characters/player/build_player.py. Geometry is indexed and quantized.
 * Joint and weapon anchor conventions are intentionally preserved for TPS gameplay.
 */
  gunHold: { p: THREE.Vector3; q: THREE.Quaternion };
  gunSling: { p: THREE.Vector3; q: THREE.Quaternion };
  gunHands: { right: THREE.Vector3; left: THREE.Vector3 };
  gunAnchors: { grip: THREE.Vector3; support: THREE.Vector3 };
}

/** Arm angles for the low-ready rifle hold: right hand on the grip, left hand under the handguard. */
export const READY = {
  Arm_R: [0.3, -0.35], Forearm_R: -1.575,
  Arm_L: [-0.8, 0.5], Forearm_L: -0.4,
};

// The Arena's Lumen AR (Dawn skin), rebuilt from vertex-coloured parts so it shares the explorer's
// toon material and outline. Gun space as in the Arena: barrel along -Z, grip below the receiver.
const GUN = { body: '#eaf0ee', accent: '#63d9db', dark: '#1d2630', metal: '#3a4250', scale: 1.1 };
const GRIP = new THREE.Vector3(0, -0.1, 0.07);
const HANDGUARD = new THREE.Vector3(0, -0.06, -0.2);
function gunPieces(): Piece[] {
  const b = (w: number, h: number, d: number, c: string, x = 0, y = 0, z = 0, rx = 0): Piece => [box(), c, T(x, y, z, w, h, d, rx)];
  const c = (r: number, l: number, col: string, x = 0, y = 0, z = 0): Piece => [cyl(r, r, l, 12), col, T(x, y, z, 1, 1, 1, Math.PI / 2)];
  return [
    b(0.068, 0.09, 0.4, GUN.body),
    b(0.07, 0.022, 0.28, GUN.accent, 0, 0.056, -0.02),
    b(0.05, 0.12, 0.06, GUN.dark, 0, -0.1, 0.07), // grip
    b(0.045, 0.13, 0.07, GUN.metal, 0, -0.1, -0.05, 0.18), // magazine
    b(0.074, 0.03, 0.18, GUN.dark, 0, -0.035, -0.22), // handguard
    c(0.017, 0.2, GUN.metal, 0, 0.005, -0.33), // barrel
    c(0.025, 0.05, GUN.dark, 0, 0.005, -0.43), // flash hider
    b(0.06, 0.08, 0.16, GUN.body, 0, -0.012, 0.27), // stock
    b(0.064, 0.02, 0.05, GUN.dark, 0, 0.012, 0.34),
    b(0.03, 0.035, 0.06, GUN.dark, 0, 0.085, 0.02), // red-dot housing
    b(0.022, 0.022, 0.004, GUN.accent, 0, 0.088, -0.012),
    b(0.072, 0.008, 0.12, GUN.accent, 0, 0.0, -0.14), // energy strip
    b(0.03, 0.012, 0.42, GUN.dark, 0.036, -0.01, 0.0), // sling strap
  ];
}

/** Rotation taking gun space (-Z barrel, +Y up) to a barrel direction `fwd` with the gun's top towards `up`. */
function gunBasis(fwd: THREE.Vector3, up: THREE.Vector3) {
  const z = fwd.clone().normalize().negate();
  const x = up.clone().cross(z).normalize();
  const y = z.clone().cross(x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * Builds the rig. Faces +Z. `material` is applied to every part (pass the world's toon material).
 */
export function buildCharacter(material: THREE.Material): CharacterRig {
  const P = PALETTE;
  const joints: Record<string, THREE.Object3D> = {};
  const meshes: THREE.Mesh[] = [];
  const joint = (name: string, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const o = new THREE.Group();
    o.name = name;
    o.position.set(x, y, z);
    parent.add(o);
    joints[name] = o;
    return o;
  };
  const part = (name: string, parent: THREE.Object3D, pieces: Piece[]) => {
    const m = new THREE.Mesh(build(pieces), material);
    m.name = name;
    m.castShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };

  const root = new THREE.Group();
  root.name = 'Explorer';
  const hips = joint('Hips', root, 0, 0.92, 0);
  const spine = joint('Spine', hips, 0, 0.1, 0);
  const head = joint('Head', spine, 0, 0.56, 0.01);
  // Keep secondary-motion contracts even where the male uniform has no scarf or ponytail.
  joint('CoatTails', hips, 0, 0.06, 0);
  joint('ScarfTail', spine, 0.06, 0.46, -0.1);
  joint('Ponytail', head, 0, 0.2, -0.13);
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    const arm = joint(`Arm_${side}`, spine, 0.235 * s, 0.42, 0);
    joint(`Forearm_${side}`, arm, 0, -0.27, 0);
    const thigh = joint(`Thigh_${side}`, hips, 0.09 * s, -0.06, 0);
    joint(`Shin_${side}`, thigh, 0, -0.42, 0);
  }
  // wind glider (Genshin-style wings), folded away unless gliding
  const glider = joint('Glider', spine, 0, 0.36, -0.24);
  const wing: Piece[] = [];
  for (const s of [-1, 1]) {
    wing.push(
      [box(), P.trim, T(0.72 * s, 0.06, 0.02, 1.15, 0.018, 0.5, 0, 0.18 * s, 0.1 * s)],
      [box(), P.inner, T(0.6 * s, 0.07, -0.3, 0.86, 0.016, 0.32, 0, 0.32 * s, 0.1 * s)],
      [box(), P.scarf, T(0.74 * s, 0.075, 0.27, 1.15, 0.03, 0.04, 0, 0.18 * s, 0.1 * s)],
      [cyl(0.012, 0.012, 1.25, 5), P.metal, T(0.72 * s, 0.05, 0.0, 1, 1, 1, 0, 0.18 * s, Math.PI / 2 + 0.1 * s)],
    );
  }
  wing.push([cyl(0.025, 0.025, 0.42, 6), P.metal, T(0, -0.15, 0)]);
  part('GliderWings', glider, wing);
  glider.scale.setScalar(0.001);

  // rifle: solve the hold from where the ready pose puts the hands, so grip and handguard sit in them
  const gun = joint('Gun', spine, 0, 0, 0);
  part('Rifle', gun, gunPieces()).scale.setScalar(GUN.scale);
  const handAt = (side: 'L' | 'R') => {
    const arm = joints[`Arm_${side}`], fore = joints[`Forearm_${side}`];
    const [ax, az] = READY[`Arm_${side}`];
    arm.rotation.set(ax, 0, az);
    fore.rotation.set(READY[`Forearm_${side}`], 0, 0);
    arm.updateMatrix(); fore.updateMatrix();
    return new THREE.Vector3(0, -0.28, 0).applyMatrix4(fore.matrix).applyMatrix4(arm.matrix);
  };
  const handR = handAt('R'), handL = handAt('L');
  const axis = HANDGUARD.clone().sub(GRIP).multiplyScalar(GUN.scale);
  const holdQ = gunBasis(handL.clone().sub(handR), new THREE.Vector3(0, 1, 0));
  // tilt so the gun-space grip→handguard line (not quite the barrel) runs hand to hand
  holdQ.multiply(new THREE.Quaternion().setFromUnitVectors(axis.clone().normalize(), new THREE.Vector3(0, 0, -1)));
  const gunHold = { p: handR.clone().sub(GRIP.clone().multiplyScalar(GUN.scale).applyQuaternion(holdQ)), q: holdQ };
  const gunSling = {
    p: new THREE.Vector3(0.02, 0.26, -0.19),
    q: gunBasis(new THREE.Vector3(-0.55, 0.84, 0), new THREE.Vector3(0, 0, -1)),
  };
  gun.position.copy(gunHold.p); gun.quaternion.copy(gunHold.q);
  installAuthoredPlayer(joints, meshes, material);
  return { root, joints, meshes, gunHold, gunSling, gunHands: { right: handR, left: handL }, gunAnchors: { grip: GRIP.clone().multiplyScalar(GUN.scale), support: HANDGUARD.clone().multiplyScalar(GUN.scale) } };
}

/** Procedural animation state machine driven by the physics controller. */
export class CharacterAnimator {
  private phase = 0;
  private t = 0;
  private air = 0;
  private glide = 0;
  private ready = 1;
  facing = 0;

  constructor(public rig: CharacterRig) {}

  update(dt: number, s: { speed: number; onGround: boolean; swimming: boolean; vy: number; moveYaw: number | null; flying?: boolean; gliding?: boolean; aim?: number; pitch?: number }) {
    const J = this.rig.joints;
    this.t += dt;
    // turn towards the movement direction (Genshin-style free movement)
    if (s.moveYaw !== null) {
      let d = s.moveYaw - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 12);
    }
    this.rig.root.rotation.y = this.facing;
    this.air = THREE.MathUtils.damp(this.air, s.onGround || s.swimming ? 0 : 1, 10, dt);

    const run = THREE.MathUtils.clamp(s.speed / 9, 0, 1);
    const move = THREE.MathUtils.clamp(s.speed / 2, 0, 1);
    this.phase += dt * (4 + s.speed * 1.25);
    const sw = Math.sin(this.phase);
    const amp = (0.35 + run * 0.5) * move;

    // legs
    for (const [side, sgn] of [['L', 1], ['R', -1]] as const) {
      const ph = sw * sgn;
      const kneeBend = Math.max(0, Math.sin(this.phase + (sgn > 0 ? 0 : Math.PI) + 0.9));
      J[`Thigh_${side}`].rotation.x = -ph * amp - this.air * 0.7;
      J[`Shin_${side}`].rotation.x = kneeBend * (0.25 + run * 0.9) * move + this.air * 1.1;
      J[`Arm_${side}`].rotation.y = 0;
      J[`Forearm_${side}`].rotation.y = J[`Forearm_${side}`].rotation.z = 0;
      // arms swing opposite to legs; elbows bend more when running
      J[`Arm_${side}`].rotation.x = ph * amp * 0.9 + (s.swimming ? -2.6 + Math.sin(this.t * 4 + sgn) * 0.6 : 0) - this.air * 0.4;
      J[`Arm_${side}`].rotation.z = (0.12 + this.air * 0.5) * -sgn;
      J[`Forearm_${side}`].rotation.x = -(0.25 + run * 0.9) * (s.swimming ? 0.2 : 1);
    }
    // rifle at the low ready on foot; slung on the back while swimming or gliding
    this.ready = THREE.MathUtils.damp(this.ready, s.swimming || s.gliding ? 0 : 1, 8, dt);
    const r = this.ready;
    if (r > 0.001) {
      const lerp = THREE.MathUtils.lerp;
      for (const side of ['L', 'R'] as const) {
        const [ax, az] = READY[`Arm_${side}`];
        J[`Arm_${side}`].rotation.x = lerp(J[`Arm_${side}`].rotation.x, ax, r);
        J[`Arm_${side}`].rotation.z = lerp(J[`Arm_${side}`].rotation.z, az, r);
        J[`Forearm_${side}`].rotation.x = lerp(J[`Forearm_${side}`].rotation.x, READY[`Forearm_${side}`], r);
      }
    }
    const { gunHold: H, gunSling: S } = this.rig;
    J.Gun.position.lerpVectors(S.p, H.p, r);
    J.Gun.quaternion.slerpQuaternions(S.q, H.q, r);

    // body
    const breathe = Math.sin(this.t * 2.2) * 0.012 * (1 - move);
    J.Hips.position.y = 0.92 + Math.abs(Math.cos(this.phase)) * 0.05 * move - run * 0.03 + breathe - (s.swimming ? 0.55 : 0);
    J.Spine.rotation.x = run * 0.22 + (s.swimming ? 0.9 : 0);
    J.Spine.rotation.y = sw * 0.12 * move;
    J.Hips.rotation.y = -sw * 0.08 * move;
    J.Head.rotation.x = -run * 0.16 + Math.sin(this.t * 1.1) * 0.02 - (s.swimming ? 0.7 : 0);
    // secondary motion
    J.Ponytail.rotation.x = 0.25 + run * 0.6 + Math.sin(this.phase * 2) * 0.12 * move + this.air * Math.sign(-s.vy) * 0.3 + Math.sin(this.t * 1.7) * 0.05;
    J.Ponytail.rotation.z = Math.sin(this.phase) * 0.15 * move;
    J.ScarfTail.rotation.x = 0.2 + run * 0.9 + Math.sin(this.t * 6) * 0.08 * (0.3 + run);
    // Short uniform panels: small cloth motion, never flip the entire waist shell upward.
    J.CoatTails.rotation.x = run * 0.08 + this.air * 0.06 + Math.abs(sw) * 0.025 * move;

    // gliding: wings unfold, arms up holding the frame, body tilts forward, legs trail
    this.glide = THREE.MathUtils.damp(this.glide, s.gliding ? 1 : 0, 9, dt);
    const g = this.glide;
    if (J.Glider) J.Glider.scale.setScalar(Math.max(0.001, g));
    if (g > 0.001) {
      const lerp = THREE.MathUtils.lerp;
      const flutter = Math.sin(this.t * 9) * 0.04;
      for (const [side, sgn] of [['L', 1], ['R', -1]] as const) {
        J[`Arm_${side}`].rotation.x = lerp(J[`Arm_${side}`].rotation.x, -2.7, g);
        J[`Arm_${side}`].rotation.z = lerp(J[`Arm_${side}`].rotation.z, -0.55 * sgn, g);
        J[`Forearm_${side}`].rotation.x = lerp(J[`Forearm_${side}`].rotation.x, -0.25, g);
        J[`Thigh_${side}`].rotation.x = lerp(J[`Thigh_${side}`].rotation.x, 0.35 + Math.sin(this.t * 3 + sgn) * 0.08, g);
        J[`Shin_${side}`].rotation.x = lerp(J[`Shin_${side}`].rotation.x, 0.35, g);
      }
      J.Spine.rotation.x = lerp(J.Spine.rotation.x, 0.45, g);
      J.Head.rotation.x = lerp(J.Head.rotation.x, -0.45, g);
      J.Ponytail.rotation.x = lerp(J.Ponytail.rotation.x, 1.3 + flutter * 3, g);
      J.ScarfTail.rotation.x = lerp(J.ScarfTail.rotation.x, 1.35 + flutter * 4, g);
      J.CoatTails.rotation.x = lerp(J.CoatTails.rotation.x, 0.12 + flutter * 0.3, g);
      if (J.Glider) J.Glider.rotation.z = Math.sin(this.t * 1.3) * 0.05;
    }
    applyRifleAim(this.rig, s.aim ?? 0, s.pitch ?? 0);
    deformUniformCloth(this.rig.joints, this.rig.meshes);
  }
}

/** Two-bone arms hold the grip/support anchors when the TPS rifle is raised to aim. */
export function applyRifleAim(rig: CharacterRig, amount: number, pitch: number) {
  if (amount <= 0) return;
  const J = rig.joints, a = THREE.MathUtils.clamp(amount, 0, 1);
  J.Spine.rotation.x *= 1 - a; J.Spine.rotation.y *= 1 - a; J.Hips.rotation.y *= 1 - a;
  J.Head.rotation.x = THREE.MathUtils.lerp(J.Head.rotation.x, -pitch, a);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, Math.PI, 0, 'YXZ'));
  const gripTarget = new THREE.Vector3(0.10, 0.34, 0.08);
  const position = gripTarget.clone().sub(rig.gunAnchors.grip.clone().applyQuaternion(q));
  J.Gun.position.lerp(position, a); J.Gun.quaternion.slerp(q, a);
  for (const side of ['R', 'L'] as const) {
    const target = (side === 'R' ? rig.gunAnchors.grip : rig.gunAnchors.support).clone().applyQuaternion(q).add(position);
    const arm = J[`Arm_${side}`], fore = J[`Forearm_${side}`];
    const delta = target.clone().sub(arm.position), distance = Math.min(0.549, Math.max(.001, delta.length()));
    const axis = delta.normalize(), pole = new THREE.Vector3(side === 'R' ? 1 : -1, -0.7, -0.3);
    pole.addScaledVector(axis, -pole.dot(axis)).normalize();
    const along = (0.27 ** 2 - 0.28 ** 2 + distance ** 2) / (2 * distance);
    const height = Math.sqrt(Math.max(0, 0.27 ** 2 - along ** 2));
    const elbow = arm.position.clone().addScaledVector(axis, along).addScaledVector(pole, height);
    const armQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), elbow.clone().sub(arm.position).normalize());
    const foreQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(elbow).normalize());
    foreQ.premultiply(armQ.clone().invert());
    arm.quaternion.slerp(armQ, a); fore.quaternion.slerp(foreQ, a);
  }
}
