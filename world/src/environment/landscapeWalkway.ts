import * as THREE from 'three';
import { SiteArt } from '../story/campaignSites';
import { polylineRibbon } from '../map/polylineRibbon';

export type LandscapePoint = [number, number, number];
export interface WalkwayStyle {
  width: number;
  floor: string;
  edge: string;
  rails?: boolean;
  steps?: boolean;
  /** Mitered ramps avoid overlapping horizontal caps at steep, tight bends. */
  continuousCorners?: boolean;
  railOpenings?: readonly { p: LandscapePoint; radius: number }[];
  supports?: (x: number, z: number, ceiling: number) => number | null;
}

/** A continuous walk surface with supported joints. Collision is the top ribbon,
 * so caps at the joins cannot catch a capsule walking up a flight of stairs. */
export function landscapeWalkway(art: SiteArt, points: readonly LandscapePoint[], style: WalkwayStyle) {
  const vertices: number[] = [], half = style.width / 2;
  for (let i = 1; i < points.length; i++) {
    const a = new THREE.Vector3(...points[i - 1]), b = new THREE.Vector3(...points[i]);
    const d = b.clone().sub(a), run = Math.hypot(d.x, d.z);
    if (run < .05) continue;
    const side = new THREE.Vector3(d.z / run, 0, -d.x / run);
    const corners = [a.clone().addScaledVector(side, -half), a.clone().addScaledVector(side, half),
      b.clone().addScaledVector(side, half), b.clone().addScaledVector(side, -half)];
    for (const index of [0, 2, 1, 0, 3, 2]) vertices.push(...corners[index].toArray());
    const yaw = Math.atan2(d.x, d.z), slope = -Math.atan2(d.y, run);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(slope, yaw, 0, 'YXZ'));
    const e = new THREE.Euler().setFromQuaternion(q);
    const rotation: LandscapePoint = [e.x, e.y, e.z];
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const middle = a.clone().lerp(b, .5).addScaledVector(normal, -.15);
    art.box(middle.toArray(), [style.width, .3, d.length() + .06], style.floor, false, 'body', rotation);
    if (style.steps && Math.abs(d.y) > .3) {
      const count = Math.max(1, Math.ceil(Math.abs(d.y) / .16));
      for (let n = 0; n < count; n++) {
        const p = a.clone().lerp(b, (n + .5) / count);
        // Treads follow the continuous collision ramp; the top edge never hides
        // more than half a normal step in the character's foot animation.
        art.box([p.x, p.y - .085, p.z], [style.width - .06, .17, run / count + .015],
          n % 5 ? style.floor : style.edge, false, 'body', [0, yaw, 0]);
      }
    }
    if (style.rails) for (const sign of [-1, 1]) {
      const p = a.clone().addScaledVector(side, sign * (half - .11));
      const q = b.clone().addScaledVector(side, sign * (half - .11));
      const opening = (v: THREE.Vector3, margin = 0) => (style.railOpenings ?? []).some(gap =>
        Math.abs(v.y - gap.p[1]) < 2.5 && Math.hypot(v.x - gap.p[0], v.z - gap.p[2]) < gap.radius + margin);
      const sections = style.railOpenings?.length ? Math.ceil(run / 1.25) : 1;
      for (let n = 0; n < sections; n++) {
        const start = p.clone().lerp(q, n / sections), end = p.clone().lerp(q, (n + 1) / sections);
        if (opening(start.clone().lerp(end, .5), run / sections / 2)) continue;
        for (const height of [.5, 1.08]) art.beam([start.x, start.y + height, start.z], [end.x, end.y + height, end.z], .12, style.edge, true);
      }
      for (let length = .6; length < run; length += 3) {
        const foot = p.clone().lerp(q, length / run);
        if (opening(foot)) continue;
        art.box([foot.x, foot.y + .54, foot.z], [.14, 1.08, .14], style.edge, true);
      }
    }
    if (style.supports) for (let length = 1.5; length < run; length += 7) {
      const top = a.clone().lerp(b, length / run);
      const bottom = style.supports(top.x, top.z, top.y - .4);
      if (bottom === null || top.y - bottom < .8) continue;
      for (const sign of [-1, 1]) {
        const x = top.x + side.x * sign * (half - .4), z = top.z + side.z * sign * (half - .4);
        art.box([x, (top.y + bottom) / 2 - .1, z], [.35, top.y - bottom, .35], style.edge, true);
      }
      art.beam([top.x - side.x * (half - .4), bottom + .4, top.z - side.z * (half - .4)],
        [top.x + side.x * (half - .4), top.y - .25, top.z + side.z * (half - .4)], .19, style.edge);
    }
    // Round joints cover the wedge between differently oriented strips, with no
    // wall across the centre of a bend. The endpoints remain flat, flush landings.
    if (i < points.length - 1 && !style.continuousCorners) {
      const joint = new THREE.CircleGeometry(half + .03, 16).rotateX(-Math.PI / 2).translate(b.x, b.y, b.z);
      art.add(joint, style.floor, [0, 0, 0]);
      art.solids.push(joint.toNonIndexed()); joint.dispose();
    }
  }
  const surface = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
    style.continuousCorners ? polylineRibbon(points, style.width) : vertices, 3));
  surface.computeVertexNormals(); art.solids.push(surface);
}
