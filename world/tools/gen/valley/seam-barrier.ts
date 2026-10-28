import * as THREE from 'three';
import { Batch, T } from '../geo.js';
import { SEAM_W, SEAM_N, SEAM_E, SEAM_S, WORLD } from '../layout.js';
import { LINKS, REGIONS } from '../../../src/regions.js';
import type { Piece } from '../structures.js';

export type SeamDirection = 'west' | 'north' | 'east' | 'south';
export interface SeamBarrier {
  id: SeamDirection;
  center: readonly [number, number];
  /** Into the valley, matching seam()'s interaction-marker offset. */
  inward: readonly [number, number];
  color: string;
  link: number;
  base?: number;
}

/** Same authored centers as the visible 15 m pylon pairs and portal veil. */
export const SEAM_BARRIERS: readonly SeamBarrier[] = [
  { id: 'west', center: SEAM_W.c, inward: [1, 0], color: '#ffb36b', link: 1 },
  { id: 'north', center: SEAM_N.c, inward: [0, 1], color: '#bfe9ff', link: 2, base: WORLD.waterLevel + .12 },
  { id: 'east', center: SEAM_E.c, inward: [-1, 0], color: '#7fb0ff', link: 0 },
  { id: 'south', center: SEAM_S.c, inward: [0, -1], color: '#ff6a3d', link: 3, base: SEAM_S.y },
];
export const SEAM_FIELD = { halfOpening: 10, thickness: .6, bottom: -10, height: 80, boundaryOverlap: .75 } as const;
export const SEAM_UNLOCK = ['summon_circle'] as const;
export type SeamSegment = { a: [number, number]; b: [number, number] };

/** A central curtain BETWEEN the existing pylons, with short visible returns to
 * the existing link mouth. Without the returns a moved curtain could be walked
 * around inside Alpha's unchanged playable rectangle. No old remote wall remains. */
export function seamBarrierSegments(s: SeamBarrier): SeamSegment[] {
  const [cx, cz] = s.center, [ix, iz] = s.inward;
  const tx = iz, tz = -ix, h = SEAM_FIELD.halfOpening;
  const a: [number, number] = [cx - tx * h, cz - tz * h];
  const b: [number, number] = [cx + tx * h, cz + tz * h];
  const play = REGIONS.find(r => r.id === 'alpha')!.play, link = LINKS[s.link];
  const overlap = SEAM_FIELD.boundaryOverlap;
  const mouth = (p: [number, number]): [number, number] => ix !== 0
    ? [ix > 0 ? play[0] - overlap : play[1] + overlap,
       p[1] < cz ? link[2] - overlap : link[3] + overlap]
    : [p[0] < cx ? link[0] - overlap : link[1] + overlap,
       iz > 0 ? play[2] - overlap : play[3] + overlap];
  return [{ a, b }, { a, b: mouth(a) }, { a: b, b: mouth(b) }];
}

export function buildSeamBarrier(s: SeamBarrier, heightAt: (x: number, z: number) => number): Piece {
  const base = s.base ?? heightAt(...s.center), field = new Batch(`Seam_${s.id}_Gate`, 'M_Beam');
  for (const { a, b } of seamBarrierSegments(s)) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const transform = T((a[0] + b[0]) / 2, base + SEAM_FIELD.bottom + SEAM_FIELD.height / 2,
      (a[1] + b[1]) / 2, -Math.atan2(dz, dx), Math.hypot(dx, dz) + SEAM_FIELD.thickness,
      SEAM_FIELD.height, SEAM_FIELD.thickness);
    // Identical complete ART/COLLISION geometry, not an invisible return beyond
    // the picture. Retain the old 80 m vertical progression envelope. Additive
    // material and restrained vertex tint keep the upper field unobtrusive.
    const panel = new THREE.BoxGeometry(1, 1, 1, 1, 2, 1);
    const pp = panel.attributes.position;
    // Middle row is exactly the 15 m pylon cap; only the upper extension fades.
    for (let i = 0; i < pp.count; i++) if (Math.abs(pp.getY(i)) < 1e-6) pp.setY(i, -.1875);
    field.add(panel, s.color, transform);
    const visible = field.vis.at(-1)!, p = visible.attributes.position, color = visible.attributes.color;
    const tint = new THREE.Color(s.color);
    for (let i = 0; i < p.count; i++) {
      const strength = p.getY(i) > base + 15.01 ? .025 : .22;
      color.setXYZ(i, tint.r * strength, tint.g * strength, tint.b * strength);
    }
  }
  return { name: field.name, material: 'M_Beam', batch: field, dynamic: true,
    userData: { opensWhen: [...SEAM_UNLOCK] } };
}
