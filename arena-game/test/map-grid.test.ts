// The collision grid is only a broad phase: every query must match the full scan exactly.
import { describe, expect, it } from 'vitest';
import { getMap, MAPS } from '../shared/arenaMap.ts';
import { blockedAt, ceilingAt, disableGrid, groundAt, raycastMap, recover, type Vec3 } from '../shared/map.ts';

describe('map collision grid', () => {
  for (const info of MAPS) it(`${info.id} matches the full scan`, () => {
    const m = getMap(info.id);
    const lin = { ...m };
    disableGrid(lin);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const b = m.data.bounds;
    for (let i = 0; i < 4000; i++) {
      const x = b.min[0] - 2 + rnd() * (b.max[0] - b.min[0] + 4), z = b.min[2] - 2 + rnd() * (b.max[2] - b.min[2] + 4);
      const y = rnd() * 6 - 0.5;
      expect(groundAt(m, x, z, y)).toBe(groundAt(lin, x, z, y));
      expect(blockedAt(m, x, z, y)?.id).toBe(blockedAt(lin, x, z, y)?.id);
      expect(ceilingAt(m, x, z, y)).toBe(ceilingAt(lin, x, z, y));
      const p = { x, y, z }, q = { x, y, z };
      recover(m, p); recover(lin, q);
      expect(p).toEqual(q);
      const yaw = rnd() * Math.PI * 2, pitch = (rnd() - 0.5) * 1.2;
      const d: Vec3 = [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw)];
      const o: Vec3 = [x, y + 1.5, z];
      const len = rnd() * 80;
      expect(raycastMap(m, o, d, len)).toBe(raycastMap(lin, o, d, len));
    }
    // axis-aligned and vertical rays hit the DDA's degenerate branches
    for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0], [0, 1, 0]] as Vec3[]) for (let i = 0; i < 200; i++) {
      const o: Vec3 = [b.min[0] + rnd() * (b.max[0] - b.min[0]), rnd() * 4, b.min[2] + rnd() * (b.max[2] - b.min[2])];
      expect(raycastMap(m, o, d, 70)).toBe(raycastMap(lin, o, d, 70));
    }
  });
});
