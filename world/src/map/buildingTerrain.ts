import type { BufferGeometry } from 'three';
import { EGYPT_TOMB_FRONTS } from './egyptPlan';

function terrace(x: number, y: number, z: number, yaw: number, halfWidth: number, halfDepth: number, shoulder: number) {
  return { x, y, z, cos: Math.cos(yaw), sin: Math.sin(yaw), halfWidth, halfDepth, shoulder,
    radius: Math.hypot(halfWidth, halfDepth) + shoulder };
}
const sites = {
  // The rotated stone base is 62 × 34 m. Its bottom is at 15.08 m.
  britain: [terrace(-215, 15.45, -305, .6, 34, 20, 9)],
  // Recess a small forecourt at the sill. The cliff still encloses the back of each tomb.
  egypt: EGYPT_TOMB_FRONTS.map(({x, y, z, yaw}) =>
    terrace(x + Math.sin(yaw), y + .06, z + Math.cos(yaw), yaw, 5.5, 3.1, 3.4)),
};

/** Core ground, its collision mesh and streamed ground all pass through this same cut. */
export function gradeBuildingTerrain(region: keyof typeof sites, geometry: BufferGeometry) {
  const result = geometry.clone(), position = result.getAttribute('position');
  for (const lot of sites[region]) {
    for (let i = 0; i < position.count; i++) {
      const dx = position.getX(i) - lot.x, dz = position.getZ(i) - lot.z;
      if (Math.abs(dx) > lot.radius || Math.abs(dz) > lot.radius) continue;
      const u = Math.max(0, Math.abs(dx * lot.cos - dz * lot.sin) - lot.halfWidth);
      const v = Math.max(0, Math.abs(dx * lot.sin + dz * lot.cos) - lot.halfDepth);
      const t = Math.hypot(u, v) / lot.shoulder;
      if (t < 1) position.setY(i, lot.y + (position.getY(i) - lot.y) * t * t * (3 - 2 * t));
    }
  }
  position.needsUpdate = true;
  if (result.hasAttribute('normal')) result.computeVertexNormals();
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}
