/** 1812 field engineering. Visual-only replacements: callers preserve original
 * collision/RNG/markers. No emissive geometry: story fires remain state controlled. */
import * as THREE from 'three';
import { Batch, BOX, T } from '../geo.js';
import type { Piece } from '../structures.js';
import { BEACONS, CROSSING, ICE_Y } from './layout.js';
type HeightAt = (x: number, z: number) => number;
type P = [number, number, number];
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const BALL = new THREE.IcosahedronGeometry(1, 1);
const RING = new THREE.TorusGeometry(1, 0.065, 5, 16);
const C = { wood: '#80624a', end: '#a18764', dark: '#4f4038', iron: '#44474c', rope: '#b1a086', canvas: '#ddd3b7', seam: '#b7aa8f', snow: '#eef3fa', snowShade: '#d6e0ec', blue: '#344e7e', gold: '#b69751' };
/** Material-only batching: geometry, vertex colors and caller collision are unchanged. */
const surfaces = new Map<string, Batch>();
export function resetFieldworkSurfaces() { surfaces.clear(); }
export function fieldworkSurfacePieces(): Piece[] { return [...surfaces.values()].map(batch => ({ name: batch.name, material: batch.material, batch, outline: true, userData: { winterFieldworkSurface: true } })); }
function surface(b: Batch, color: string, forced?: string) {
  const material = forced ?? (color === C.gold ? 'M_WinterGold' :
    [C.iron, '#6c6854', '#88806a', '#24292e'].includes(color) ? 'M_WinterIron' :
    [C.canvas, C.blue, C.seam, C.rope, '#d6c9a8'].includes(color) ? 'M_WinterCanvas' : undefined);
  if (!material) return b;
  const key = `${b.name}_${material.slice(2)}`;
  let target = surfaces.get(key);
  if (!target) { target = new Batch(key, material); surfaces.set(key, target); }
  return target;
}
function beam(b: Batch, a: P, c: P, r: number, color: string, square = false) {
  const av = new THREE.Vector3(...a), cv = new THREE.Vector3(...c), delta = cv.clone().sub(av);
  surface(b, color).add(square ? BOX : CYL, color, new THREE.Matrix4().compose(av.add(cv).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()), new THREE.Vector3(r, delta.length(), r)), false);
}
function panel(b: Batch, pts: P[], color: string) {
  // Real thin linen shell, not coplanar reversed faces (those cause ray noise
  // and z fighting). Choose a stable polygon normal even on straight seams.
  const vertices = pts.map(p => new THREE.Vector3(...p)), base = vertices[0];
  let normal = new THREE.Vector3();
  for (let k = 1; k < vertices.length - 1; k++) {
    const n = vertices[k].clone().sub(base).cross(vertices[k + 1].clone().sub(base));
    if (n.lengthSq() > normal.lengthSq()) normal = n;
  }
  normal.normalize().multiplyScalar(0.006);
  const front = vertices.map(p => p.clone().add(normal).toArray()), back = vertices.map(p => p.clone().sub(normal).toArray());
  const pos: number[] = [];
  for (let k = 1; k < pts.length - 1; k++) pos.push(...front[0], ...front[k], ...front[k + 1], ...back[0], ...back[k + 1], ...back[k]);
  for (let k = 0; k < pts.length; k++) {
    const n = (k + 1) % pts.length;
    pos.push(...front[k], ...back[k], ...back[n], ...front[k], ...back[n], ...front[n]);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  surface(b, color, color === C.gold ? 'M_WinterGold' : 'M_WinterCanvas').add(geo, color, new THREE.Matrix4(), false);
}
function frame(x: number, y: number, z: number, ry: number) {
  return (u: number, v: number, w: number): P => [x + Math.cos(ry) * u + Math.sin(ry) * w, y + v, z - Math.sin(ry) * u + Math.cos(ry) * w];
}
export function fieldTent(b: Batch, x: number, z: number, ry: number, w: number, d: number, color: string, heightAt: HeightAt) {
  const y = Math.min(heightAt(x, z), heightAt(x - 2, z), heightAt(x + 2, z), heightAt(x, z - 2), heightAt(x, z + 2));
  // Original triangular prism ridge is along local X after rz=π/2.
  // Match its footprint/peak so preserved collision never sticks outside canvas.
  const h = w * 0.75, e = 0.025; w *= Math.sqrt(3) / 2; ry += Math.PI / 2;
  const p = frame(x, y, z, ry);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const za = -d / 2 + d * k / 4, zb = za + d / 4;
      panel(b, [p(0, h, za), p(s * w * 0.27, h * 0.46, za), p(s * w / 2, e, za), p(s * w / 2, e, zb), p(s * w * 0.27, h * 0.46, zb), p(0, h, zb)], k % 2 ? color : C.canvas);
      beam(b, p(0, h + 0.008, za), p(s * w / 2, e, za), 0.018, C.seam);
    }
    beam(b, p(s * w / 2, e, -d / 2), p(s * w / 2, e, d / 2), 0.028, C.seam);
    panel(b, [p(0, h, -d / 2), p(s * w / 2, e, -d / 2), p(0, e, -d / 2)], color);
    // Soldier tents retain closed overlapping entrance flaps, matching their
    // original solid collider; only the imperial pavilion is walk-in.
    panel(b, [p(s * 0.018, h, d / 2 + 0.015), p(s * w / 2, e, d / 2), p(s * 0.018, e, d / 2 + 0.035)], color);
    beam(b, p(s * 0.025, e, d / 2 + 0.04), p(s * 0.025, h, d / 2 + 0.02), 0.018, C.seam);
    for (const zz of [-d / 2, d / 2]) {
      const stake = p(s * (w / 2 + 0.8), 0, zz + Math.sign(zz) * 0.25); stake[1] = heightAt(stake[0], stake[2]);
      beam(b, p(s * w / 2, e + 0.1, zz), [stake[0], stake[1] + 0.16, stake[2]], 0.018, C.rope);
      beam(b, stake, [stake[0] + s * 0.06, stake[1] + 0.33, stake[2]], 0.045, C.dark);
    }
    for (let k = 0; k < 3; k++) b.add(BALL, k % 2 ? C.snowShade : C.snow, T(...p(s * w * 0.49, 0.12, (k - 1) * d * 0.28), ry, 0.2, 0.11 + k * 0.015, d * 0.22), false);
  }
  for (const zz of [-d / 2, d / 2 - 0.1]) beam(b, p(0, 0, zz), p(0, h + 0.08, zz), 0.055, C.dark);
  beam(b, p(0, h, -d / 2 - 0.1), p(0, h, d / 2 + 0.1), 0.045, C.dark);
  b.add(CYL, '#777467', T(...p(w * 0.28, 0.22, d * 0.22), ry, 0.18, 0.9, 0.18, Math.PI / 2), false);
}
export function buildCrossingTimber(b: Batch, heightAt: HeightAt) {
  for (const [i, z] of CROSSING.bridges.entries()) {
    const x0 = CROSSING.c[0] - 34, x1 = CROSSING.c[0] + 28, y = ICE_Y + 1.3;
    for (let x = x0; x < x1; x += 4) {
      if (i === 0 && Math.abs(x - CROSSING.c[0]) < 6) continue;
      for (let k = 0; k < 9; k++) {
        const xx = x + (k + 0.5) * 4 / 9;
        b.add(BOX, ['#8c7157', '#79604a', '#9b8060', '#80664e'][(k + i) % 4], T(xx, y - 0.13, z + Math.sin(xx * 7) * 0.025, 0, 4 / 9 - 0.012, 0.26, 4.09 + Math.sin(xx * 3.7) * 0.09), false);
        for (const s of [-1.38, 1.38]) surface(b, C.iron).add(CYL, C.iron, T(xx, y + 0.006, z + s, 0, 0.026, 0.014, 0.026), false);
        // Wind-blown edge dusting: never evenly spaced white runway tiles.
        const drift = Math.sin(xx * 1.7 + i * 2.3);
        if ((k + Math.floor(x / 4)) % 4 === 0 && drift > -0.42) b.add(BALL, drift > 0.4 ? C.snow : C.snowShade, T(xx, y + 0.018, z + (drift > 0 ? 1.85 : -1.85), xx * 0.2, 0.35 + Math.abs(drift) * 0.24, 0.035, 0.18 + Math.abs(Math.cos(xx)) * 0.25), false);
      }
      for (const s of [-1.45, 1.45]) {
        beam(b, [x, y - 0.35, z + s], [x + 4, y - 0.35, z + s], 0.22, C.dark, true);
        beam(b, [x + 1.65, ICE_Y - 0.45, z + s * 1.18], [x + 2, y - 0.24, z + s], 0.13, C.wood);
      }
      beam(b, [x + 2, y - 0.42, z - 2.18], [x + 2, y - 0.42, z + 2.18], 0.23, C.end, true);
      beam(b, [x + 1.65, ICE_Y - 0.18, z - 1.8], [x + 2, y - 0.5, z + 1.5], 0.085, C.dark);
      beam(b, [x + 1.65, ICE_Y - 0.18, z + 1.8], [x + 2, y - 0.5, z - 1.5], 0.085, C.dark);
    }
    for (const [x, dir] of [[x0, 1], [x1, -1]] as const) {
      const g = heightAt(x - dir * 8, z), rise = y - g;
      b.add(BOX, C.wood, T(x - dir * 4, g + rise / 2, z, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 4.2, 0.3, Math.hypot(8, rise), -Math.atan2(rise, 8)), false);
      for (const s of [-1.7, 1.7]) beam(b, [x - dir * 8, g - 0.16, z + s], [x, y - 0.2, z + s], 0.19, C.dark, true);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) beam(b, [x - dir * 7.8, g + k * 0.18, z + s * 2.5], [x - dir * 5, g + k * 0.18, z + s * 2.5], 0.11, C.wood);
    }
  }
}
function wheel(b: Batch, p: ReturnType<typeof frame>, u: number, v: number, w: number, r: number, ry: number) {
  surface(b, C.iron).add(RING, C.iron, T(...p(u, v, w), ry + Math.PI / 2, r, r, r), false);
  b.add(RING, C.wood, T(...p(u, v, w), ry + Math.PI / 2, r * 0.9, r * 0.9, r * 0.9), false);
  for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; beam(b, p(u, v, w), p(u, v + Math.sin(a) * r * 0.88, w + Math.cos(a) * r * 0.88), 0.045, C.end); }
  beam(b, p(u - 0.14, v, w), p(u + 0.14, v, w), 0.14, C.dark);
}
export function fieldWagon(b: Batch, x: number, y: number, z: number, ry: number) {
  const p = frame(x, y, z, ry);
  for (const zz of [-1.15, 1.15]) { beam(b, p(-1.4, 0.66, zz), p(1.4, 0.66, zz), 0.09, C.iron); for (const s of [-1, 1]) wheel(b, p, s * 1.2, 0.66, zz, 0.63, ry); }
  for (let k = 0; k < 6; k++) b.add(BOX, k % 2 ? C.wood : C.end, T(...p(0, 0.85, (k - 2.5) * 0.54), ry, 2, 0.13, 0.52), false);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) b.add(BOX, k % 2 ? C.wood : '#8d7355', T(...p(s, 1.01 + k * 0.2, 0), ry, 0.1, 0.16, 3.25), false);
    for (const zz of [-1.45, 0, 1.45]) beam(b, p(s * 1.05, 0.78, zz), p(s * 1.05, 1.55, zz), 0.075, C.dark, true);
    beam(b, p(s * 0.65, 0.78, 1.4), p(s * 0.5, 0.3, 4.1), 0.075, C.dark);
  }
  surface(b, C.canvas).add(BOX, C.canvas, T(...p(-0.3, 1.16, -0.35), ry + 0.08, 1.15, 0.55, 1.9), false);
  for (const zz of [-1.0, 0.3]) beam(b, p(-0.89, 1.44, zz), p(0.3, 1.44, zz), 0.025, C.rope);
  b.add(BALL, C.snow, T(...p(-0.3, 1.47, -0.35), ry, 0.56, 0.1, 0.85), false);
}
export function fieldCannon(b: Batch, x: number, y: number, z: number, ry: number) {
  const p = frame(x, y, z, ry);
  for (const s of [-1, 1]) { wheel(b, p, s * 0.92, 0.67, -0.15, 0.65, ry); beam(b, p(s * 0.36, 0.75, -0.7), p(s * 0.22, 0.19, 1.9), 0.2, '#686746', true); }
  beam(b, p(-1.05, 0.67, -0.15), p(1.05, 0.67, -0.15), 0.09, C.iron);
  const muzzle = p(0, 1.21, -2.0), breech = p(0, 1.03, 0.52);
  beam(b, breech, muzzle, 0.22, '#6c6854');
  const axis = new THREE.Vector3(...muzzle).sub(new THREE.Vector3(...breech)).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
  surface(b, '#88806a').add(new THREE.TorusGeometry(0.22, 0.045, 6, 12), '#88806a', new THREE.Matrix4().compose(new THREE.Vector3(...muzzle), q, new THREE.Vector3(1, 1, 1)), false);
  surface(b, '#24292e').add(new THREE.CircleGeometry(0.18, 12), '#24292e', new THREE.Matrix4().compose(new THREE.Vector3(...muzzle).addScaledVector(axis, 0.005), q, new THREE.Vector3(1, 1, 1)), false);
  beam(b, p(0, 1.03, 0.48), p(0, 1.02, 0.7), 0.1, '#6c6854');
}
export function imperialPavilion(b: Batch, tx: number, y: number, tz: number, w: number, d: number) {
  const p = frame(tx, y, tz, 0), eave = 4.3, ridge = 6.0;
  for (const s of [-1, 1]) {
    surface(b, C.blue).add(BOX, C.blue, T(...p(s * w / 2, eave / 2, 0), 0, 0.16, eave, d), false);
    surface(b, C.blue).add(BOX, C.blue, T(...p(s * (w / 2 - 2), eave / 2, d / 2), 0, 4, eave, 0.16), false);
    for (let k = 0; k < 7; k++) {
      const za = -d / 2 - 0.3 + k * (d + 0.6) / 7, zb = za + (d + 0.6) / 7;
      panel(b, [p(0, ridge, za), p(s * (w / 2 + 0.4), eave, za), p(s * (w / 2 + 0.4), eave, zb), p(0, ridge, zb)], k % 2 ? '#405c8a' : '#e1d8bf');
      beam(b, p(0, ridge + 0.01, za), p(s * (w / 2 + 0.4), eave + 0.01, za), 0.025, C.seam);
    }
    for (const zz of [-d / 2, 0, d / 2]) {
      beam(b, p(s * w / 2, 0, zz), p(s * w / 2, eave + 0.1, zz), 0.075, C.dark);
      beam(b, p(s * w / 2, eave, zz), p(s * (w / 2 + 2.2), 0.1, zz + (zz ? Math.sign(zz) : 1) * 0.8), 0.028, C.rope);
      beam(b, p(s * (w / 2 + 2.2), 0, zz + (zz ? Math.sign(zz) : 1) * 0.8), p(s * (w / 2 + 2.2), 0.38, zz + (zz ? Math.sign(zz) : 1) * 0.8), 0.06, C.dark);
    }
    panel(b, [p(s * 2, 0, d / 2 + 0.09), p(s * 2, eave, d / 2 + 0.09), p(s * 2.9, eave, d / 2 + 0.1), p(s * 3.2, 0.5, d / 2 + 0.1)], '#ded6c1');
  }
  surface(b, C.blue).add(BOX, C.blue, T(...p(0, eave / 2, -d / 2), 0, w, eave, 0.16), false);
  for (const zz of [-d / 2, d / 2]) panel(b, [p(-w / 2, eave, zz), p(0, ridge, zz), p(w / 2, eave, zz)], '#ded6c1');
  for (let k = -2; k <= 2; k++) surface(b, '#d6c9a8').add(BOX, '#d6c9a8', T(...p(k * 2.2, eave / 2, -d / 2 - 0.09), 0, 0.3, eave - 0.15, 0.025), false);
  beam(b, p(-w / 2, eave, d / 2 + 0.11), p(w / 2, eave, d / 2 + 0.11), 0.07, C.gold);
  // Keep map-table footprint identical to its original collision box.
  for (const xx of [-1.5, 1.5]) for (const zz of [-2.2, -0.8]) beam(b, p(xx, 0, zz), p(xx, 0.85, zz), 0.1, C.dark, true);
  b.add(BOX, C.wood, T(...p(0, 0.85, -1.5), 0, 3.6, 0.1, 1.8), false);
  b.add(BOX, '#d1c49e', T(...p(0, 0.91, -1.5), 0.1, 3, 0.018, 1.4), false);
  for (let k = 0; k < 5; k++) beam(b, p(-1.1 + k * 0.3, 0.93, -1.85 + k * 0.13), p(-0.7 + k * 0.3, 0.93, -1.63 + k * 0.1), 0.012, '#736b52');
  const sx = tx + 3, sz = tz + d / 2 + 1.5;
  beam(b, [sx, y, sz], [sx, y + 3.8, sz], 0.055, C.dark);
  surface(b, C.gold).add(BALL, C.gold, T(sx, y + 3.9, sz, 0, 0.13, 0.23, 0.09), false);
  for (const s of [-1, 1]) panel(b, [[sx, y + 3.94, sz], [sx + s * 0.54, y + 4.18, sz], [sx + s * 0.43, y + 3.85, sz], [sx + s * 0.1, y + 3.78, sz]], C.gold);
  for (let k = 0; k < 3; k++) { const xa = sx + k * 0.3, xb = xa + 0.3; panel(b, [[xa, y + 3.5 - k * 0.015, sz + k * 0.025], [xb, y + 3.485 - k * 0.015, sz + (k + 1) * 0.025], [xb, y + 2.735 - k * 0.015, sz + (k + 1) * 0.025], [xa, y + 2.75 - k * 0.015, sz + k * 0.025]], ['#435e86', '#dfdacb', '#9d4e47'][k]); }
}
export function decorateFieldworks(heightAt: HeightAt): Piece[] {
  const b = new Batch('Fieldworks_Details', 'M_WinterTimber');
  for (const [i, [x, z]] of [[-205, 176], [-222, 200], [-150, 168]].entries()) {
    const y = heightAt(x - 3.4, z - 3.2), p = frame(x - 3.4, y, z - 3.2, 0.15 + i * 0.3);
    for (let k = 0; k < 4; k++) beam(b, p(-1.8, 0.22 + k * 0.23, -0.8), p(1.8 - k * 0.14, 0.22 + k * 0.23, -0.8), 0.14, k % 2 ? C.wood : C.dark);
    for (const s of [-1, 1]) beam(b, p(s * 1.5, 0, -0.95), p(s * 1.5, 1.5, -0.95), 0.08, C.dark);
    panel(b, [p(-1.6, 1.25, -0.85), p(1.5, 1.4, -0.85), p(1.5, 0.1, -2.4), p(-1.6, 0.1, -2.4)], ['#9a9279', '#857d68', '#a69b7d'][i]);
    for (let k = 0; k < 3; k++) b.add(CYL, '#777365', T(...p(-0.8 + k * 0.65, 0.26, -1.1), 0.15, 0.22, 0.7, 0.22, Math.PI / 2), false);
    const kx = x + 1.45, kz = z + 0.1, ky = heightAt(kx, kz);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; beam(b, [kx + Math.cos(a) * 0.6, ky, kz + Math.sin(a) * 0.6], [kx, ky + 1.45, kz], 0.035, C.iron); }
    beam(b, [kx, ky + 1.45, kz], [kx, ky + 0.8, kz], 0.014, C.iron);
    surface(b, C.iron).add(new THREE.CylinderGeometry(0.27, 0.22, 0.32, 10), C.iron, T(kx, ky + 0.67, kz), false);
  }
  BEACONS.forEach(([x, z]) => {
    const y = Math.min(heightAt(x, z), heightAt(x + 3, z), heightAt(x - 3, z), heightAt(x, z + 3), heightAt(x, z - 3));
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, xx = x + Math.cos(a) * 2.1, zz = z + Math.sin(a) * 2.1;
      b.add(BALL, k % 2 ? '#747b80' : '#899199', T(xx, y + 0.35, zz, a, 0.65, 0.35, 0.45), false);
      if (k % 2 === 0) b.add(BALL, C.snow, T(xx, y + 0.65, zz, a, 0.53, 0.09, 0.35), false);
    }
    const sx = x + 5.8, sz = z - 3.5, sy = heightAt(sx, sz);
    for (let row = 0; row < 2; row++) for (let k = 0; k < 3 - row; k++) {
      const zz = sz + k * 0.32 + row * 0.16;
      beam(b, [sx - 1.2, sy + 0.18 + row * 0.3, zz], [sx + 1.2, sy + 0.18 + row * 0.3, zz], 0.16, C.wood);
      b.add(CYL, C.end, T(sx + 1.21, sy + 0.18 + row * 0.3, zz, 0, 0.13, 0.018, 0.13, 0, Math.PI / 2), false);
    }
  });
  return [{ name: 'Fieldworks_Details', material: 'M_WinterTimber', batch: b, outline: true }];
}

/** Frozen marchers: greatcoat hems, crossed equipment straps and covered shakos,
 * rather than featureless cylinders. Every pose stays on its original footprint. */
export function fieldFrozenSoldier(b: Batch, x: number, y: number, z: number, variant: number) {
  const ry = -0.12 + (variant % 3) * 0.12, p = frame(x, y, z, ry), coat = ['#8e9aa7', '#9b9e9c', '#8594a5'][variant % 3];
  for (const s of [-1, 1]) {
    beam(b, p(s * 0.14, 0.08, 0.06 * s), p(s * 0.13, 0.66, 0), 0.12, '#626d7a');
    b.add(BOX, '#57616e', T(...p(s * 0.14, 0.09, 0.07 + s * 0.06), ry, 0.2, 0.18, 0.32), false);
  }
  b.add(new THREE.CylinderGeometry(0.25, 0.38, 0.96, 8), coat, T(...p(0, 1.08, 0), ry, 1, 1, 0.73), false);
  b.add(BALL, '#a9afb3', T(...p(0, 1.75, 0.025), ry, 0.18, 0.23, 0.18), false);
  b.add(new THREE.CylinderGeometry(0.21, 0.19, 0.25, 8), '#707e8c', T(...p(0, 1.96, 0), ry), false);
  b.add(BOX, '#606d7b', T(...p(0, 1.86, 0.15), ry, 0.32, 0.045, 0.2), false);
  for (const s of [-1, 1]) {
    beam(b, p(s * 0.25, 1.49, 0), p(s * 0.32, 1.09, 0.15 + (variant % 2) * 0.06), 0.11, coat);
    beam(b, p(s * 0.32, 1.09, 0.15), p(s * 0.15, 1.01, 0.27), 0.09, coat);
    beam(b, p(s * 0.2, 1.52, 0.16), p(-s * 0.21, 0.88, 0.22), 0.025, '#c1c7c8');
  }
  b.add(BOX, '#707c87', T(...p(0, 1.27, -0.3), ry, 0.42, 0.5, 0.22), false);
  b.add(CYL, '#b4b9b9', T(...p(0, 1.59, -0.31), ry, 0.12, 0.48, 0.12, 0, Math.PI / 2), false);
  b.add(BALL, C.snow, T(...p(0, 2.1, 0), ry, 0.22, 0.075, 0.21), false);
  for (const s of [-1, 1]) b.add(BALL, C.snowShade, T(...p(s * 0.23, 1.55, 0), ry, 0.15, 0.045, 0.19), false);
  beam(b, p(0.4, 0.08, -0.12), p(0.39, 1.81 + (variant % 3) * 0.06, -0.1), 0.025, '#81878c');
}

/** Dry-laid watch-fire base: jointed stone courses and a stacked timber pyre.
 * Replaces ONLY the static pedestal/log visuals, never its fire or frost crystal. */
export function fieldBeaconBase(b: Batch, x: number, y: number, z: number, variant: number) {
  b.add(new THREE.CylinderGeometry(2.28, 2.43, 1.1, 12), '#565e65', T(x, y + 0.55, z), false);
  const n = 9 + variant;
  for (let row = 0; row < 3; row++) for (let k = 0; k < n; k++) {
    const a = (k + (row % 2) * 0.5) * Math.PI * 2 / n, r = 2.24 - row * 0.035;
    const xx = x + Math.cos(a) * r, zz = z + Math.sin(a) * r;
    b.add(BOX, ['#7b8388', '#8b9090', '#69747e', '#7e898e'][(k + row + variant) % 4], T(xx, y + 0.19 + row * 0.39, zz, -a, 0.67, 0.36 - (k % 3) * 0.012, 2 * Math.PI * r / n - 0.055), false);
    if (row === 2 && (k + variant) % 3 === 0) b.add(BALL, C.snowShade, T(xx, y + 1.18, zz, -a, 0.35, 0.055, 0.43), false);
  }
  b.add(new THREE.CylinderGeometry(2.04, 2.07, 0.04, 12), '#414348', T(x, y + 1.13, z), false);
  for (let row = 0; row < 3; row++) {
    const ry = row % 2 ? Math.PI / 2 : 0, p = frame(x, y + 1.31 + row * 0.26, z, ry);
    for (const s of [-0.73, 0.73]) {
      beam(b, p(s, 0, -1.42 + row * 0.09), p(s, 0, 1.42 - row * 0.09), 0.15, row === 0 ? '#4e4640' : C.wood);
      b.add(CYL, C.end, T(...p(s, 0, 1.43 - row * 0.09), ry, 0.12, 0.018, 0.12, Math.PI / 2), false);
    }
  }
  for (const s of [-1, 1]) beam(b, [x + s * 0.8, y + 1.27, z + 0.7], [x + s * 0.2, y + 2.25, z - 0.35], 0.11, C.dark);
}
