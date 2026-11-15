import { meleeMotion } from '../weapons/meleeArt.ts';
import { motionBlend, motionDt } from './characterMotion.ts';
// Anime-proportioned Arena fighters, built procedurally (same approach as the World explorer:
// merged vertex-coloured parts on a small joint rig, drawn with the cel shader). Two designs:
//   Aster  white long coat, pale-blue long hair with an ahoge, floating parhelion halo
//   Vega   dark bodysuit, orange twin-tails, fin "ears", lighter build
// Team colour goes on trims, belt and gloves so sides read at a glance. Upper body and arms hang
// off the aim pivot (shoulder height), so the gun and head follow the player's pitch.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { celMaterial } from '../rendering/cel.ts';

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

export const FIGHTER_PALETTES = [
  { // Aster
    skin: '#ffe3d2', hair: '#d8ecff', hairTip: '#7fc8ff', coat: '#f4f1ea', inner: '#2c3550', pants: '#3a4560',
    boots: '#e8e4dc', eye: '#24345c', iris: '#5fb8ff',
  },
  { // Vega
    skin: '#ffe0cc', hair: '#ffb347', hairTip: '#ff7a3d', coat: '#2a3146', inner: '#1b2030', pants: '#2a3146',
    boots: '#1b2030', eye: '#3a2440', iris: '#ff8a3d',
  },
  {skin:'#ffe1cf',hair:'#e5c76e',hairTip:'#e9dc9d',coat:'#355eaa',inner:'#dce5ec',pants:'#f2e8d9',boots:'#b9c9d9',eye:'#29413c',iris:'#72b78d'},
  {skin:'#c89878',hair:'#30252a',hairTip:'#473034',coat:'#7a3036',inner:'#252833',pants:'#3b3641',boots:'#2c2932',eye:'#30272b',iris:'#e8bd6e'},
  {skin:'#ffe2d2',hair:'#9b5049',hairTip:'#cf7e6a',coat:'#e9e4d4',inner:'#833443',pants:'#353b66',boots:'#554254',eye:'#34344a',iris:'#8ba9ee'},
  {skin:'#eac3a3',hair:'#4b3440',hairTip:'#705058',coat:'#254f76',inner:'#f1e2c4',pants:'#e2d5bb',boots:'#263443',eye:'#3e3436',iris:'#8cbdc3'},
  {skin:'#ffe4d4',hair:'#e4c580',hairTip:'#f0dba4',coat:'#9aa6c0',inner:'#7e6eaa',pants:'#4f497b',boots:'#c5ccdc',eye:'#343a59',iris:'#a3a4ed'},
  {skin:'#bc835c',hair:'#262c42',hairTip:'#40516e',coat:'#e6cc78',inner:'#213b67',pants:'#eee6cd',boots:'#c6a755',eye:'#4b3530',iris:'#f6c961'},
  {skin:'#f3d8ca',hair:'#d9e0db',hairTip:'#4b9993',coat:'#eee9da',inner:'#283843',pants:'#273b43',boots:'#b3c4b6',eye:'#345355',iris:'#70d5bc'},
];

export interface FighterRig {
  root: THREE.Group;
  aim: THREE.Group;
  joints: Record<string, THREE.Object3D>;
  material: THREE.Material;
}

export function buildFighter(char: number, team: number): FighterRig {
  const P = FIGHTER_PALETTES[char] ?? FIGHTER_PALETTES[0];
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
  if (char !== 1) {
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
  } else if (char === 1) {
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
  } else if (char === 0) {
    // parhelion halo floats above the head and catches the bloom
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 6, 32), celMaterial({ color: 0xfff2b0, emissive: 0xffe58a, emissiveIntensity: 1.6 }));
    halo.rotation.x = Math.PI / 2 - 0.2;
    halo.position.set(0, 0.42, 0.02);
    head.add(halo);
    joints.Halo = halo;
  }

  // Competitive identity pieces remain cosmetic: one common head and shoulder hit volume.
  const gold='#e6c16a',silver='#d7e0eb';
  const blade=(parent:THREE.Object3D,x:number,y:number,z:number,roll:number,color=gold)=>part(parent,[
    [box(),color,T(x,y,z,.035,.62,.028,0,0,roll)], [box(),silver,T(x,y-.22,z,.05,.42,.018,0,0,roll)],
    [box(),color,T(x,y+.15,z,.18,.035,.05,0,0,roll)]
  ]);
  const badge=(parent:THREE.Object3D,color:string,x=0,y=.25,z=-.17)=>part(parent,[[sphere(1),color,T(x,y,z,.06,.06,.018)]]);
  if(char===2){ // Saber: coiled bun, blue ribbon, breastplate, fitted skirt armour, sheathed holy blade.
    part(head,[[sphere(2),P.hair,T(0,.12,.17,.105,.1,.065)],[box(),P.coat,T(0,.12,.21,.2,.06,.025)],[cone(.012,.11,4),P.hair,T(.02,.31,-.01,1,1,1,.5,0,.3)]]);
    part(spine,[[sphere(2),silver,T(0,.25,-.09,.19,.19,.075)],[box(),gold,T(0,.25,-.169,.02,.24,.015)]]);
    for(const side of [-1,1])part(hips,[[box(),silver,T(side*.17,-.14,0,.1,.3,.2,0,0,side*.15)]]);
    blade(spine,-.19,.14,.22,-.25);badge(spine,gold);
  }
  if(char===3){ // Blackbeard: tricorn, dense beard, brass coat buttons and powder sash.
    part(head,[[box(),P.hair,T(0,.27,0,.42,.07,.28)],[cone(.22,.16,3),'#2b2734',T(0,.34,0,1,1,.85,0,Math.PI/2)],[cone(.09,.2,8),P.hair,T(0,-.02,-.1,1,1,.7,Math.PI)],[box(),gold,T(0,.31,-.14,.07,.05,.015)]]);
    part(spine,[[box(),gold,T(0,.23,-.15,.025,.39,.025,0,0,-.6)]]);
    for(const side of [-1,1])for(let i=0;i<4;i++)badge(spine,gold,side*.1,.08+i*.09,-.15);
  }
  if(char===4){ // Musashi: ponytail, short kimono sleeves, waist knot and twin scabbards.
    const tail=joint('Tail_R',head,0,.19,.14);
    part(tail,[[cone(.07,.4,8),P.hair,T(0,-.16,.05,1,1,.75,Math.PI-.3)],[box(),P.inner,T(0,0,.015,.13,.07,.06)]]);
    part(spine,[[box(),P.inner,T(-.06,.24,-.15,.07,.38,.025,0,0,-.32)],[box(),P.pants,T(.07,.22,-.15,.07,.35,.025,0,0,.32)]]);
    part(hips,[[sphere(1),P.inner,T(-.18,.04,-.13,.08,.055,.04)]]);
    blade(hips,-.23,-.2,.12,.35,'#435382');blade(hips,.22,-.19,.13,-.35,'#81364c');
  }
  if(char===5){ // Napoleon: bicorne, gold epaulettes, double-breasted coat; always on foot.
    part(head,[[sphere(1),'#253447',T(0,.3,0,.27,.11,.13)],[box(),gold,T(0,.26,-.12,.38,.025,.025)],[sphere(1),'#c95b52',T(.08,.29,-.13,.04,.04,.015)]]);
    for(const side of [-1,1])part(spine,[[box(),gold,T(side*.22,.42,0,.13,.055,.19)]]);
    for(const side of [-1,1])for(let i=0;i<4;i++)badge(spine,gold,side*.075,.08+i*.09,-.15);
    part(spine,[[box(),P.inner,T(0,.29,-.17,.21,.035,.02,0,0,-.55)]]);
  }
  if(char===6){ // Jeanne: silver circlet, twin braids, plate shoulders and furled back flag.
    part(head,[[box(),silver,T(0,.2,-.12,.29,.045,.035)],[sphere(1),'#8f7dd7',T(0,.2,-.145,.03,.035,.015)]]);
    for(const side of [-1,1])for(let i=0;i<5;i++)part(head,[[sphere(1),P.hair,T(side*.13,-.02-i*.055,.08,.035,.045,.035)]]);
    part(spine,[[sphere(2),silver,T(0,.25,-.08,.19,.19,.08)],[box(),P.inner,T(.16,.15,.25,.09,.65,.06)],[cyl(.012,.012,.9,6),gold,T(.19,.19,.24)]]);
    badge(spine,'#8d7bc9');
  }
  if(char===7){ // Ozymandias: gold crown, dark side locks and lapis collar; no broad wings.
    part(head,[[cyl(.155,.155,.045,12),gold,T(0,.23,0)],[cone(.04,.12,4),gold,T(0,.31,-.1)]]);
    for(const side of [-1,1])part(head,[[box(),P.hair,T(side*.13,-.015,.04,.05,.25,.08)],[box(),gold,T(side*.13,-.12,.04,.055,.03,.09)]]);
    part(spine,[[cyl(.21,.16,.1,12),gold,T(0,.37,0,1,1,.8)],[box(),P.inner,T(0,.22,-.15,.17,.26,.025)]]);
    badge(spine,'#59b5d1');
  }
  if(char===8){ // Qin: compact crown, white robe, jade shoulder motifs and close-set back fan.
    part(head,[[box(),'#263c43',T(0,.29,0,.3,.025,.23)],[box(),gold,T(0,.31,-.1,.31,.018,.03)],[box(),P.hair,T(0,-.08,.12,.23,.38,.045)]]);
    for(let i=0;i<5;i++)part(head,[[cyl(.006,.006,.1,5),gold,T(-.11+i*.055,.23,-.12)]]);
    for(const side of [-1,1])part(spine,[[sphere(1),'#69aaa0',T(side*.22,.38,.02,.09,.065,.12)],[box(),gold,T(side*.12,.17,.22,.035,.48,.03,0,0,side*.22)]]);
    part(spine,[[box(),'#69aaa0',T(0,.23,-.15,.055,.3,.02)]]);badge(spine,gold);
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
  private landing = 0;
  private wasGrounded = true;
  private lastVy = 0;

  constructor(private rig: FighterRig) {}

  reset(crouched = false, grounded = true) {
    this.phase = this.t = this.landing = this.lastVy = 0;
    this.crouch = crouched ? 1 : 0;
    this.air = grounded ? 0 : 1;
    this.wasGrounded = grounded;
    this.update(0, 0, 0, crouched, grounded);
    this.melee(0, 0);
  }

  melee(windup: number, strike: number, weapon = 5) {
    const J = this.rig.joints, motion = meleeMotion(weapon, windup, strike, false);
    const [pitch, yaw, roll] = motion.rotation;
    // The support hand follows the same continuous preparation/impact/recovery curve.
    // Spear and hammer remain two-handed; the sword keeps its off-hand clear.
    const twoHanded = weapon === 6 || weapon === 7;
    // Raised weapon (+pitch) lifts the arms; the shoulders turn with the swing direction.
    J.Arm_R.rotation.set(1.15 + pitch * .6, yaw * .45, -.12 + roll * .35);
    J.Forearm_R.rotation.x = .45 + Math.max(0, pitch) * .25;
    J.Arm_L.rotation.set(1.25 + pitch * (twoHanded ? .5 : .1), yaw * (twoHanded ? .32 : -.15), .62 + roll * (twoHanded ? .25 : -.15));
    J.Forearm_L.rotation.x = .7 + Math.max(0, pitch) * (twoHanded ? .25 : .04);
  }

  ability(kind:string,phase:string) {
    if(phase==='idle'||phase==='recovery')return;
    const J=this.rig.joints;
    J.Arm_L.rotation.set(kind==='guard'?1.7:kind==='prayer'?1.4:1.8,0,.25);
    J.Forearm_L.rotation.x=kind==='guard'?1.1:.55;
    if(kind==='prayer'||kind==='guard'){J.Arm_R.rotation.x=1.55;J.Forearm_R.rotation.x=.9;}
  }

  update(dt: number, speed: number, vy: number, crouched = false, grounded = true, forward = speed, strafe = 0) {
    dt = motionDt(dt);
    const J = this.rig.joints;
    this.crouch += ((crouched ? 1 : 0) - this.crouch) * motionBlend(dt, 15);
    const crouch = this.crouch;
    this.t += dt;
    // Grounding comes from the snapshot, not vertical speed: apexes remain airborne and
    // walking up ramps remains walking. This filter changes only the visible blend.
    if (grounded && !this.wasGrounded) this.landing = Math.min(1, .25 + Math.abs(this.lastVy) / 12);
    this.wasGrounded = grounded;
    this.lastVy = vy;
    this.landing *= Math.exp(-dt * 12);
    this.air += ((grounded ? 0 : 1) - this.air) * motionBlend(dt, 13);
    const run = Math.min(1, speed / 5.5), move = Math.min(1, speed / 1.5);
    const ground = 1 - this.air, weight = move * ground;
    const along = speed > .001 ? forward / speed : 0;
    const across = speed > .001 ? strafe / speed : 0;
    // Stride phase follows travel instead of ticking at idle. Shorter crouched/backward steps.
    this.phase = (this.phase + dt * speed * (1.85 + crouch * .8) * ground) % (Math.PI * 2);
    const sw = Math.sin(this.phase);
    const amp = (.4 + run * .4) * weight * (1 - crouch * .65);
    const rise = Math.max(0, Math.min(1, vy / 6));
    for (const [side, sgn] of [['L', 1], ['R', -1]] as const) {
      const step = sw * sgn;
      const knee = Math.max(0, Math.sin(this.phase + (sgn > 0 ? 0 : Math.PI) + .9));
      J[`Thigh_${side}`].rotation.set(
        step * amp * along * (along < 0 ? .72 : 1) + this.air * (.18 + rise * .25) + crouch * 1.15 + this.landing * .08,
        0,
        // Leave a small outward stance so lateral steps never cross through the other foot.
        step * amp * across * .17 - sgn * Math.abs(across) * weight * .105,
      );
      J[`Shin_${side}`].rotation.x = -(knee * (.3 + run * .8) * weight + this.air * (.45 + rise * .55)) - crouch * 2.3 - this.landing * .16;
    }
    const breathe = Math.sin(this.t * 2.2) * .008 * (1 - move) * ground;
    const travelTwist = Math.atan2(strafe, Math.abs(forward) + .2) * .26 * weight;
    J.Hips.position.y = .9 + Math.abs(Math.cos(this.phase)) * .035 * weight - run * .02 * ground + breathe - crouch * .5 - this.landing * .035;
    J.Spine.rotation.x = -run * along * .12 * ground - crouch * .12;
    J.Spine.rotation.y = sw * .1 * weight - travelTwist * .55;
    J.Hips.rotation.y = travelTwist - sw * .07 * weight;
    J.Hips.rotation.z = -across * run * .035 * ground;
    this.rig.aim.position.y = 1.35 + (J.Hips.position.y - .9) - crouch * .16;
    if (J.Halo) J.Halo.position.y = .42 + Math.sin(this.t * 2) * .02;
    for (const s of ['L', 'R']) {
      if (J[`Tail_${s}`]) {
        J[`Tail_${s}`].rotation.x = .2 + run * .45 + Math.sin(this.phase * 2) * .08 * weight + Math.sin(this.t * 1.7) * .05;
        J[`Tail_${s}`].rotation.z = Math.sin(this.phase) * .12 * weight * (s === 'L' ? 1 : -1);
      }
    }
  }
}
