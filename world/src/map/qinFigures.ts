import * as THREE from 'three';
/**
 * Terracotta figures as primitive lists, so the baked garrison and the runtime
 * turntable ranks share one model. Local frame: +Z forward, +Y up, feet at y=0.
 */
export type QinPrim =
  | { kind: 'box'; size: [number, number, number]; at: [number, number, number]; rot?: [number, number, number]; color: string; solid?: boolean }
  | { kind: 'cyl'; top: number; bottom: number; h: number; at: [number, number, number]; rot?: [number, number, number]; color: string; seg?: number; solid?: boolean }
  | { kind: 'ball'; r: number; scale?: [number, number, number]; at: [number, number, number]; color: string };

export const QIN_CLAY = { body: '#a88b70', dark: '#86705a', light: '#bba085', face: '#b59a80', hair: '#5f5047', red: '#9a4b3c', green: '#5f7a5c', violet: '#6e5d78', bronze: '#5f7c66', wood: '#5c4532' };
/** 0 spearman, 1 armoured infantry, 2 crossbowman, 3 officer, 4 kneeling archer. */
export type WarriorKind = 0 | 1 | 2 | 3 | 4;

function limb(out: QinPrim[], a: [number, number, number], b: [number, number, number], r: number, color: string) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
  // Cylinder axis is +Y: pitch about X then yaw about Y aligns it with the segment.
  const pitch = Math.acos(Math.max(-1, Math.min(1, dy / len))), yaw = Math.atan2(dx, dz);
  out.push({ kind: 'cyl', top: r * .92, bottom: r, h: len, at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [pitch, yaw, 0], color, seg: 7 });
}

export function warriorPrims(kind: WarriorKind, variant = 0): QinPrim[] {
  const C = QIN_CLAY, p: QinPrim[] = [], body = variant % 3 === 0 ? C.body : variant % 3 === 1 ? C.light : C.dark;
  const collar = [C.red, C.green, C.violet][variant % 3], kneel = kind === 4, drop = kneel ? .5 : 0;
  p.push({ kind: 'box', size: [.82, .1, .78], at: [0, .05, 0], color: C.dark, solid: true });
  if (!kneel) {
    for (const s of [-1, 1]) {
      p.push({ kind: 'box', size: [.16, .1, .3], at: [s * .12, .15, .05], color: C.dark });
      p.push({ kind: 'cyl', top: .085, bottom: .095, h: .5, at: [s * .12, .45, 0], color: body, seg: 7 });
      for (let k = 0; k < 3; k++) p.push({ kind: 'cyl', top: .1, bottom: .1, h: .035, at: [s * .12, .28 + k * .12, 0], color: C.dark, seg: 7 });
    }
  } else {
    // Right knee down, left knee up: the archer's braced firing crouch.
    p.push({ kind: 'box', size: [.16, .1, .3], at: [-.13, .15, .3], color: C.dark });
    limb(p, [-.13, .2, .3], [-.13, .55, .28], .09, body);
    limb(p, [-.13, .55, .28], [-.13, .62, -.05], .1, body);
    limb(p, [.13, .13, .12], [.13, .13, -.32], .09, body);
    p.push({ kind: 'box', size: [.15, .2, .12], at: [.13, .2, -.38], color: C.dark });
    limb(p, [.13, .15, .12], [.13, .6, -.04], .1, body);
  }
  const robeTop = 1.07 - drop, robeLen = kind === 3 ? .7 : .42;
  p.push({ kind: 'cyl', top: .25, bottom: kind === 3 ? .4 : .34, h: robeLen, at: [0, robeTop - robeLen / 2, 0], color: body, seg: 10 });
  p.push({ kind: 'cyl', top: kind === 3 ? .41 : .35, bottom: kind === 3 ? .41 : .35, h: .05, at: [0, robeTop - robeLen + .02, 0], color: collar, seg: 10 });
  // Lamellar armour: officers wear a shorter plated vest over the robe.
  const torso = 1.32 - drop;
  p.push({ kind: 'box', size: [.5, .52, .32], at: [0, torso, 0], color: body, solid: true });
  const rows = kind === 3 ? 3 : 4;
  for (let r = 0; r < rows; r++) for (const z of [.165, -.165]) p.push({ kind: 'box', size: [.53, .045, .02], at: [0, torso - .2 + r * .1, z], color: r % 2 ? C.dark : C.light });
  for (let c = -2; c <= 2; c++) p.push({ kind: 'box', size: [.025, .32, .02], at: [c * .1, torso - .05, .172], color: C.dark });
  if (kind !== 3) for (const s of [-1, 1]) p.push({ kind: 'box', size: [.17, .12, .32], at: [s * .32, torso + .2, 0], rot: [0, 0, s * -.38], color: C.light });
  else for (const s of [-1, 1]) p.push({ kind: 'box', size: [.05, .3, .02], at: [s * .12, torso + .05, .18], color: C.red });
  p.push({ kind: 'box', size: [.54, .06, .35], at: [0, robeTop + .03, 0], color: C.hair });
  p.push({ kind: 'cyl', top: .12, bottom: .14, h: .07, at: [0, torso + .29, 0], color: collar, seg: 8 });
  p.push({ kind: 'cyl', top: .06, bottom: .065, h: .1, at: [0, torso + .36, 0], color: C.face, seg: 6 });
  const head = torso + .5;
  p.push({ kind: 'ball', r: .13, scale: [1, 1.15, 1.05], at: [0, head, 0], color: C.face });
  p.push({ kind: 'ball', r: .133, scale: [1.02, .92, 1], at: [0, head + .04, -.03], color: C.hair });
  p.push({ kind: 'box', size: [.035, .05, .04], at: [0, head - .01, .14], color: C.face });
  p.push({ kind: 'box', size: [.1, .018, .02], at: [0, head - .06, .13], color: C.hair });
  for (const s of [-1, 1]) p.push({ kind: 'box', size: [.03, .06, .04], at: [s * .135, head, 0], color: C.face });
  if (kind === 3) {
    // Officer's two-tailed cap (鹖冠).
    p.push({ kind: 'box', size: [.2, .08, .2], at: [0, head + .16, -.02], color: C.hair });
    for (const s of [-1, 1]) p.push({ kind: 'box', size: [.05, .14, .04], at: [s * .06, head + .25, -.06], rot: [-.4, 0, s * .2], color: C.hair });
  } else p.push({ kind: 'ball', r: .065, at: [.07, head + .14, -.03], color: C.hair });
  // Arms: shoulder, elbow and hand positions per role.
  const sh = torso + .2, L: [number, number, number] = [-.3, sh, 0], R: [number, number, number] = [.3, sh, 0];
  type Pose = { elbow: [number, number, number]; hand: [number, number, number] };
  const pose: Record<WarriorKind, [Pose, Pose]> = {
    0: [{ elbow: [-.36, sh - .3, .02], hand: [-.34, sh - .58, .06] }, { elbow: [.38, sh - .3, 0], hand: [.32, sh - .32, .28] }],
    1: [{ elbow: [-.37, sh - .3, 0], hand: [-.35, sh - .58, .04] }, { elbow: [.37, sh - .3, 0], hand: [.35, sh - .58, .04] }],
    2: [{ elbow: [-.3, sh - .32, .12], hand: [-.1, sh - .3, .36] }, { elbow: [.32, sh - .32, .1], hand: [.12, sh - .3, .34] }],
    3: [{ elbow: [-.32, sh - .32, .1], hand: [-.04, sh - .46, .22] }, { elbow: [.32, sh - .32, .1], hand: [.04, sh - .46, .22] }],
    4: [{ elbow: [-.32, sh - .28, .16], hand: [-.12, sh - .2, .38] }, { elbow: [.3, sh - .3, .12], hand: [.1, sh - .22, .36] }],
  };
  for (const [i, s] of [L, R].entries()) {
    const { elbow, hand } = pose[kind][i];
    limb(p, s, elbow, .072, body); limb(p, elbow, hand, .06, body);
    p.push({ kind: 'box', size: [.08, .1, .08], at: hand, color: C.face });
  }
  if (kind === 0) {
    const h = pose[0][1].hand; p.push({ kind: 'cyl', top: .02, bottom: .022, h: 2.9, at: [h[0], .95, h[2]], color: C.wood, seg: 5 });
    p.push({ kind: 'cyl', top: 0, bottom: .05, h: .26, at: [h[0], 2.53, h[2]], color: C.bronze, seg: 5 });
  } else if (kind === 2 || kind === 4) {
    p.push({ kind: 'box', size: [.06, .06, .62], at: [0, sh - .27, .4], color: C.wood });
    p.push({ kind: 'box', size: [.72, .035, .04], at: [0, sh - .25, .68], rot: [0, 0, 0], color: C.wood });
    p.push({ kind: 'box', size: [.07, .09, .07], at: [0, sh - .32, .3], color: C.bronze });
  } else if (kind === 3) {
    p.push({ kind: 'cyl', top: .025, bottom: .025, h: .9, at: [0, sh - .9, .25], color: C.bronze, seg: 5 });
    p.push({ kind: 'box', size: [.16, .03, .05], at: [0, sh - .5, .24], color: C.bronze });
  }
  if (kneel) p.push({ kind: 'box', size: [.24, .3, .1], at: [.2, torso - .05, -.2], rot: [0, 0, -.2], color: C.dark });
  return p;
}

/** A team horse for the garrison chariot; ~2.6 m long, facing +Z. */
export function horsePrims(variant = 0): QinPrim[] {
  const C = QIN_CLAY, p: QinPrim[] = [], body = variant % 2 ? C.body : C.light;
  p.push({ kind: 'cyl', top: .36, bottom: .38, h: 1.6, at: [0, 1.25, 0], rot: [Math.PI / 2, 0, 0], color: body, seg: 9, solid: true });
  p.push({ kind: 'ball', r: .4, scale: [1, 1, .9], at: [0, 1.28, .78], color: body });
  p.push({ kind: 'ball', r: .4, scale: [1, 1, .9], at: [0, 1.28, -.78], color: body });
  limb(p, [0, 1.45, .95], [0, 2.0, 1.3], .17, body);
  p.push({ kind: 'box', size: [.22, .24, .55], at: [0, 2.0, 1.55], rot: [.5, 0, 0], color: body });
  p.push({ kind: 'box', size: [.06, .36, .5], at: [0, 1.95, 1.15], rot: [.9, 0, 0], color: C.hair });
  for (const s of [-1, 1]) p.push({ kind: 'box', size: [.05, .14, .05], at: [s * .07, 2.22, 1.36], color: body });
  for (const [x, z] of [[-.2, .7], [.2, .7], [-.2, -.7], [.2, -.7]]) {
    limb(p, [x, 1.05, z], [x, .55, z + .04], .085, body); limb(p, [x, .55, z + .04], [x, .08, z], .065, body);
    p.push({ kind: 'cyl', top: .08, bottom: .09, h: .08, at: [x, .04, z], color: C.dark, seg: 6 });
  }
  limb(p, [0, 1.3, -1.12], [0, .75, -1.3], .07, C.hair);
  return p;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1), cylCache = new Map<string, THREE.CylinderGeometry>(), ballGeo = new THREE.SphereGeometry(1, 9, 6);
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
/** Unit geometry and its local transform for one primitive (Euler order YXZ). */
export function primGeometry(prim: QinPrim): { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 } {
  const rot = 'rot' in prim && prim.rot ? prim.rot : [0, 0, 0];
  tmpQ.setFromEuler(tmpE.set(rot[0], rot[1], rot[2], 'YXZ'));
  const at = new THREE.Vector3(...prim.at);
  if (prim.kind === 'box') return { geometry: unitBox, matrix: new THREE.Matrix4().compose(at, tmpQ, new THREE.Vector3(...prim.size)) };
  if (prim.kind === 'ball') { const s = prim.scale ?? [1, 1, 1]; return { geometry: ballGeo, matrix: new THREE.Matrix4().compose(at, tmpQ, new THREE.Vector3(prim.r * s[0], prim.r * s[1], prim.r * s[2])) }; }
  const key = `${prim.top.toFixed(3)}:${prim.bottom.toFixed(3)}:${prim.seg ?? 8}`;
  let g = cylCache.get(key); if (!g) { g = new THREE.CylinderGeometry(prim.top, prim.bottom, 1, prim.seg ?? 8); cylCache.set(key, g); }
  return { geometry: g, matrix: new THREE.Matrix4().compose(at, tmpQ, new THREE.Vector3(1, prim.h, 1)) };
}
/** Visit every primitive of a figure placed at (x,y,z) with heading yaw and uniform scale. */
export function placeFigure(prims: QinPrim[], x: number, y: number, z: number, yaw: number, visit: (geometry: THREE.BufferGeometry, color: string, matrix: THREE.Matrix4, solid: boolean) => void, scale = 1) {
  const root = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale));
  for (const prim of prims) { const { geometry, matrix } = primGeometry(prim); visit(geometry, prim.color, root.clone().multiply(matrix), 'solid' in prim && !!prim.solid); }
}
