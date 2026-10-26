// Anime-proportioned Arena fighters, built procedurally (same approach as the World explorer:
// merged vertex-coloured parts on a small joint rig, drawn with the cel shader). Two designs:
//   Aster  white long coat, pale-blue long hair with an ahoge, floating parhelion halo
//   Vega   dark bodysuit, orange twin-tails, fin "ears", lighter build
// Team colour goes on trims, belt and gloves so sides read at a glance. Upper body and arms hang
// off the aim pivot (shoulder height), so the gun and head follow the player's pitch.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { celMaterial } from './cel.ts';

type Piece = [THREE.BufferGeometry, THREE.ColorRepresentation, THREE.Matrix4?];

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function T(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}

function build(pieces: Piece[]): THREE.BufferGeometry {
  const gs = pieces.map(([geo, color, m]) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
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

const DESIGNS = [
  { // Aster
    skin: '#ffe3d2', hair: '#d8ecff', hairTip: '#7fc8ff', coat: '#f4f1ea', inner: '#2c3550', pants: '#3a4560',
    boots: '#e8e4dc', eye: '#24345c', iris: '#5fb8ff',
  },
  { // Vega
    skin: '#ffe0cc', hair: '#ffb347', hairTip: '#ff7a3d', coat: '#2a3146', inner: '#1b2030', pants: '#2a3146',
    boots: '#1b2030', eye: '#3a2440', iris: '#ff8a3d',
  },
];

export interface FighterRig {
  root: THREE.Group;
  aim: THREE.Group;
  joints: Record<string, THREE.Object3D>;
  material: THREE.Material;
}

export function buildFighter(char: number, team: number): FighterRig {
  const P = DESIGNS[char] ?? DESIGNS[0];
  const TEAM = '#' + team.toString(16).padStart(6, '0');
  const material = celMaterial({ color: 0xffffff, vertexColors: true }, 0.35);
  const joints: Record<string, THREE.Object3D> = {};
  const root = new THREE.Group();
  const joint = (name: string, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const o = new THREE.Group();
    o.position.set(x, y, z);
    parent.add(o);
    joints[name] = o;
    return o;
  };
  const part = (parent: THREE.Object3D, pieces: Piece[]) => {
    const m = new THREE.Mesh(build(pieces), material);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const slim = char === 1 ? 0.9 : 1;

  // ---- legs and pelvis (facing -Z, like the camera)
  const hips = joint('Hips', root, 0, 0.9, 0);
  part(hips, [
    [cyl(0.15 * slim, 0.17 * slim, 0.2), P.pants, T(0, -0.02, 0, 1, 1, 0.8)],
    [cyl(0.178 * slim, 0.178 * slim, 0.06, 14), TEAM, T(0, 0.08, 0, 1, 1, 0.82)],
    [box(), '#f4c95d', T(0, 0.08, -0.145, 0.07, 0.05, 0.02)],
  ]);
  if (char === 0) {
    part(hips, [ // coat tails
      [box(), P.coat, T(-0.1, -0.26, 0.12, 0.17, 0.48, 0.03, -0.12)],
      [box(), P.coat, T(0.1, -0.26, 0.12, 0.17, 0.48, 0.03, -0.12)],
      [box(), TEAM, T(0, -0.5, 0.15, 0.36, 0.035, 0.035, -0.12)],
    ]);
  }
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    const thigh = joint(`Thigh_${side}`, hips, 0.09 * s * slim, -0.06, 0);
    part(thigh, [[cyl(0.078 * slim, 0.06, 0.42, 9), P.pants, T(0, -0.21, 0)]]);
    const shin = joint(`Shin_${side}`, thigh, 0, -0.42, 0);
    part(shin, [
      [cyl(0.058, 0.05, 0.36, 9), P.pants, T(0, -0.18, 0)],
      [cyl(0.066, 0.06, 0.22, 9), P.boots, T(0, -0.31, 0)],
      [box(), P.boots, T(0, -0.42, -0.04, 0.11, 0.07, 0.22)],
      [box(), TEAM, T(0, -0.21, 0, 0.135, 0.025, 0.135)],
    ]);
  }

  // ---- torso twists with the stride; the aim pivot carries arms, head and gun
  const spine = joint('Spine', hips, 0, 0.1, 0);
  part(spine, [
    [cyl(0.2 * slim, 0.155 * slim, 0.44, 12), P.coat, T(0, 0.21, 0, 1, 1, 0.72)],
    [cyl(0.1, 0.13, 0.4, 8), P.inner, T(0, 0.22, -0.035, 1, 1, 0.75)],
    [box(), TEAM, T(-0.07, 0.21, -0.13, 0.025, 0.42, 0.02, 0, 0, 0.08)],
    [box(), TEAM, T(0.07, 0.21, -0.13, 0.025, 0.42, 0.02, 0, 0, -0.08)],
    [sphere(1), P.coat, T(-0.2 * slim, 0.41, 0, 0.09, 0.07, 0.09)],
    [sphere(1), P.coat, T(0.2 * slim, 0.41, 0, 0.09, 0.07, 0.09)],
    [box(), P.inner, T(0, 0.26, 0.16, 0.22, 0.26, 0.08)], // power pack
    [box(), TEAM, T(0, 0.3, 0.205, 0.16, 0.05, 0.012)],
  ]);
  const aim = joint('Aim', root, 0, 1.35, 0);

  const head = joint('Head', aim, 0, 0.2, 0.01);
  part(head, [
    [cyl(0.04, 0.045, 0.08, 8), P.skin, T(0, -0.04, 0)],
    [sphere(2), P.skin, T(0, 0.11, 0, 0.135, 0.15, 0.135)],
    [sphere(1), P.skin, T(0, 0.04, -0.05, 0.08, 0.06, 0.07)],
    [sphere(1), P.eye, T(-0.05, 0.1, -0.118, 0.032, 0.045, 0.012)],
    [sphere(1), P.eye, T(0.05, 0.1, -0.118, 0.032, 0.045, 0.012)],
    [sphere(1), P.iris, T(-0.05, 0.092, -0.125, 0.022, 0.028, 0.008)],
    [sphere(1), P.iris, T(0.05, 0.092, -0.125, 0.022, 0.028, 0.008)],
    [sphere(0), '#ffffff', T(-0.042, 0.112, -0.131, 0.009, 0.011, 0.004)],
    [sphere(0), '#ffffff', T(0.058, 0.112, -0.131, 0.009, 0.011, 0.004)],
    [sphere(0), '#ffb5b0', T(-0.075, 0.055, -0.105, 0.022, 0.01, 0.006)],
    [sphere(0), '#ffb5b0', T(0.075, 0.055, -0.105, 0.022, 0.01, 0.006)],
    [box(), '#c9776b', T(0, 0.035, -0.13, 0.025, 0.006, 0.004)],
  ]);
  const hair: Piece[] = [
    [sphere(2), P.hair, T(0, 0.15, 0.012, 0.152, 0.15, 0.155)],
    [sphere(1), P.hair, T(0, 0.12, 0.06, 0.15, 0.13, 0.13)],
  ];
  for (const [x, rz, ry] of [[-0.09, -0.35, -0.3], [-0.045, -0.15, -0.1], [0, 0, 0], [0.05, 0.15, 0.1], [0.095, 0.35, 0.3]] as const) {
    hair.push([cone(0.042, 0.15, 5), P.hair, T(x, 0.19, -0.115, 1, 1, 0.6, -(Math.PI - 0.35), ry, rz)]);
  }
  if (char === 0) {
    // long straight hair down the back, side locks with tinted tips, an ahoge
    hair.push([box(), P.hair, T(0, -0.08, 0.1, 0.26, 0.42, 0.06, 0.12)]);
    hair.push([box(), P.hairTip, T(0, -0.3, 0.125, 0.25, 0.06, 0.055, 0.12)]);
    for (const s of [-1, 1]) {
      hair.push([cone(0.04, 0.3, 5), P.hair, T(0.125 * s, 0.03, -0.02, 1, 1, 0.7, Math.PI + 0.1, 0, -0.12 * s)]);
      hair.push([cone(0.018, 0.07, 5), P.hairTip, T(0.137 * s, -0.13, -0.025, 1, 1, 0.7, Math.PI + 0.1, 0, -0.12 * s)]);
    }
    hair.push([cone(0.012, 0.12, 4), P.hair, T(0.01, 0.31, -0.02, 1, 1, 1, 0.5, 0, 0.3)]);
  } else {
    // fin ears in team colour; twin-tails hang from joints so they swing
    for (const s of [-1, 1]) {
      hair.push([cone(0.05, 0.2, 4), TEAM, T(0.13 * s, 0.27, 0.02, 1, 1, 0.5, 0, 0, -0.45 * s)]);
      hair.push([cone(0.035, 0.18, 5), P.hair, T(0.13 * s, 0.03, -0.03, 1, 1, 0.7, Math.PI + 0.1, 0, -0.1 * s)]);
    }
  }
  part(head, hair);
  if (char === 1) {
    for (const s of [-1, 1]) {
      const tail = joint(`Tail_${s < 0 ? 'L' : 'R'}`, head, 0.14 * s, 0.2, 0.06);
      part(tail, [
        [sphere(1), TEAM, T(0, 0, 0, 0.035, 0.035, 0.035)],
        [cone(0.075, 0.46, 6), P.hair, T(0.03 * s, -0.22, 0.04, 1, 1, 0.8, Math.PI - 0.2, 0, 0.12 * s)],
        [cone(0.03, 0.1, 6), P.hairTip, T(0.06 * s, -0.46, 0.09, 1, 1, 0.8, Math.PI - 0.2, 0, 0.12 * s)],
      ]);
    }
  } else {
    // parhelion halo floats above the head and catches the bloom
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 6, 32), celMaterial({ color: 0xfff2b0, emissive: 0xffe58a, emissiveIntensity: 1.6 }));
    halo.rotation.x = Math.PI / 2 - 0.2;
    halo.position.set(0, 0.42, 0.02);
    head.add(halo);
    joints.Halo = halo;
  }

  // arms reach for the gun: right hand on the grip, left hand under the barrel
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    const arm = joint(`Arm_${side}`, aim, 0.22 * s * slim, 0.0, 0);
    part(arm, [
      [cyl(0.055, 0.048, 0.27, 8), P.coat, T(0, -0.13, 0)],
      [cyl(0.058, 0.058, 0.03, 8), TEAM, T(0, -0.25, 0)],
    ]);
    const fore = joint(`Forearm_${side}`, arm, 0, -0.27, 0);
    part(fore, [
      [cyl(0.047, 0.04, 0.24, 8), P.inner, T(0, -0.12, 0)],
      [sphere(1), TEAM, T(0, -0.27, 0, 0.048, 0.056, 0.042)],
    ]);
  }
  // (a hanging arm points down -Y; +X rotation swings it forward toward -Z, the facing direction)
  joints.Arm_R.rotation.set(1.15, 0, -0.12);
  joints.Forearm_R.rotation.set(0.45, 0, 0);
  joints.Arm_L.rotation.set(1.25, 0, 0.62);
  joints.Forearm_L.rotation.set(0.7, 0, 0);
  return { root, aim, joints, material };
}

/** Procedural run / idle / air animation driven by interpolated snapshot motion. */
export class FighterAnimator {
  private phase = 0;
  private t = 0;
  private air = 0;
  private crouch = 0;

  constructor(private rig: FighterRig) {}

  melee(windup: number, strike: number) {
    const J = this.rig.joints;
    J.Arm_R.rotation.set(1.15 + windup * .6 - strike * .35, -windup * .25 + strike * .2, -.12 + windup * .15);
    J.Forearm_R.rotation.x = .45 + windup * .25;
    J.Arm_L.rotation.set(1.25 + windup * .3 - strike * .2, 0, .62);
    J.Forearm_L.rotation.x = .7 + windup * .1;
  }

  update(dt: number, speed: number, vy: number, crouched = false) {
    const J = this.rig.joints;
    this.crouch += ((crouched ? 1 : 0) - this.crouch) * Math.min(1, dt * 15);
    const crouch = this.crouch;
    this.t += dt;
    const airborne = Math.abs(vy) > 0.6 ? 1 : 0;
    this.air += (airborne - this.air) * Math.min(1, dt * 10);
    const run = Math.min(1, speed / 5.5), move = Math.min(1, speed / 1.5);
    this.phase += dt * (5 + speed * 1.6);
    const sw = Math.sin(this.phase);
    const amp = (0.4 + run * 0.45) * move * (1 - crouch * 0.65);
    for (const [side, sgn] of [['L', 1], ['R', -1]] as const) {
      const knee = Math.max(0, Math.sin(this.phase + (sgn > 0 ? 0 : Math.PI) + 0.9));
      J[`Thigh_${side}`].rotation.x = ph(sw, sgn) * amp - this.air * 0.6 + crouch * 1.15;
      J[`Shin_${side}`].rotation.x = -(knee * (0.3 + run * 0.9) * move + this.air * 1.0) - crouch * 2.3;
    }
    const breathe = Math.sin(this.t * 2.2) * 0.012 * (1 - move);
    J.Hips.position.y = 0.9 + Math.abs(Math.cos(this.phase)) * 0.05 * move - run * 0.03 + breathe - crouch * 0.5;
    J.Spine.rotation.x = -run * 0.15 - crouch * 0.12;
    J.Spine.rotation.y = sw * 0.12 * move;
    J.Hips.rotation.y = -sw * 0.08 * move;
    this.rig.aim.position.y = 1.35 + (J.Hips.position.y - 0.9) - crouch * .16;
    if (J.Halo) J.Halo.position.y = 0.42 + Math.sin(this.t * 2) * 0.02;
    for (const s of ['L', 'R']) {
      if (J[`Tail_${s}`]) {
        J[`Tail_${s}`].rotation.x = 0.2 + run * 0.6 + Math.sin(this.phase * 2) * 0.1 * move + Math.sin(this.t * 1.7) * 0.05;
        J[`Tail_${s}`].rotation.z = Math.sin(this.phase) * 0.15 * move * (s === 'L' ? 1 : -1);
      }
    }
  }
}

const ph = (sw: number, sgn: number) => sw * sgn;
