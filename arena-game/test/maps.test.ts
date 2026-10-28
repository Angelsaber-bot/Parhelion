// Every registered Arena map must be playable with the shared rules: anchors on solid ground,
// spawns hidden from the enemy, authored routes walkable with the real movement code, all key
// areas connected for bots, and a bot match that produces kills.
import { describe, expect, it } from 'vitest';
import { getMap, MAPS } from '../shared/arenaMap.ts';
import { Bot, BOT_SKILL } from '../shared/bot.ts';
import { TICK_HZ } from '../shared/content.ts';
import { blockedAt, ceilingAt, groundAt, lineOfSight, type ArenaMap, type Vec3 } from '../shared/map.ts';
import { Match } from '../shared/match.ts';
import { NavGrid } from '../shared/nav.ts';
import { applyInput, newPlayer, type Input, type PlayerState } from '../shared/sim.ts';

function walk(m: ArenaMap, pts: Vec3[], maxSeconds = 90): { p: PlayerState; ok: boolean; at: number } {
  const p = newPlayer('w', 'A', 0);
  Object.assign(p, { x: pts[0][0], y: groundAt(m, pts[0][0], pts[0][2], pts[0][1] + 0.1), z: pts[0][2], alive: true });
  let i = 1, seq = 0;
  while (i < pts.length && seq < maxSeconds * TICK_HZ) {
    const t = pts[i];
    const dx = t[0] - p.x, dz = t[2] - p.z;
    if (Math.hypot(dx, dz) < 0.3) { i++; continue; }
    const yaw = Math.atan2(-dx, -dz);
    const inp: Input = { seq: ++seq, mx: 0, mz: 1, yaw, pitch: 0, buttons: 0, weapon: 0, view: 0 };
    applyInput(m, p, inp);
  }
  return { p, ok: i >= pts.length, at: i };
}

for (const info of MAPS) {
  const m = getMap(info.id);
  const d = m.data;
  const spawns = d.anchors.filter((a) => a.kind === 'spawn');
  describe(`map ${info.id}`, () => {
    it('ids are unique and both teams have two spawns', () => {
      const ids = [...d.objects, ...d.anchors].map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const team of ['west', 'east']) expect(spawns.filter((s) => s.team === team).length).toBeGreaterThanOrEqual(2);
    });

    it('anchors stand on ground and are not inside solids', () => {
      for (const a of d.anchors) {
        if (!['spawn', 'cover', 'objective'].includes(a.kind)) continue;
        const [x, y, z] = a.position;
        expect(Math.abs(groundAt(m, x, z, y + 0.05) - y), a.id).toBeLessThan(0.02);
        expect(blockedAt(m, x, z, y), a.id).toBeNull();
      }
    });

    it('opposing spawns cannot see each other', () => {
      for (const a of spawns) for (const b of spawns) {
        if (a.team === b.team) continue;
        const eye = (p: Vec3): Vec3 => [p[0], p[1] + m.eye, p[2]];
        expect(lineOfSight(m, eye(a.position), eye(b.position)), `${a.id} -> ${b.id}`).toBe(false);
      }
    });

    it('authored routes are walkable both ways with the game movement', () => {
      for (const r of d.routes) for (const pts of [r.points, [...r.points].reverse()]) {
        const { p, ok, at } = walk(m, pts);
        expect(ok, `${r.id} stuck before point ${at} at ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).toBe(true);
        expect(Math.abs(p.y - pts[pts.length - 1][1]), r.id).toBeLessThan(0.05);
      }
    });

    it('nav grid connects every spawn, cover and objective anchor', () => {
      const nav = new NavGrid(m);
      const from = nav.nearest(spawns[0].position[0], 0, spawns[0].position[2])!;
      for (const a of d.anchors) {
        if (!['spawn', 'cover', 'objective'].includes(a.kind)) continue;
        const n = nav.nearest(a.position[0], a.position[1], a.position[2])!;
        expect(Math.abs(n.y - a.position[1]), a.id).toBeLessThan(0.3);
        expect(nav.path(from, n), a.id).not.toBeNull();
      }
    });

    it('bots finish a 2v2 on it', { timeout: 60000 }, () => {
      const match = new Match(m, '2v2');
      for (let i = 0; i < 4; i++) {
        match.addPlayer(`b${i}`, { name: `B${i}`, team: i % 2 ? 'B' : 'A', char: i % 2, skins: [0, 0, 0], bot: true }, new Bot(i + 1, BOT_SKILL.hard));
      }
      // a match can end (score limit) and restart inside the window, so keep the best tally
      let kills = 0;
      for (let t = 0; t < 120 * TICK_HZ; t++) {
        match.step();
        if (t % TICK_HZ === 0) kills = Math.max(kills, match.snapshot().players.reduce((s, p) => s + p.kills, 0));
      }
      expect(kills).toBeGreaterThan(3);
    });
  });
}

describe('map sakura specifics', () => {
  const m = getMap('sakura');
  it('is mirror-symmetric across x = 0', () => {
    const key = (s: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }) =>
      [s.minX, s.maxX, s.minY, s.maxY, s.minZ, s.maxZ].map((v) => Math.round(v * 1000)).join();
    const all = m.solids.map(key);
    for (const s of m.solids) expect(all, s.id).toContain(key({ ...s, minX: -s.maxX, maxX: -s.minX }));
  });
  it('the hall is roofed and closed except for its four doors', () => {
    expect(ceilingAt(m, 0, -3.6, 0)).toBeCloseTo(3.4);
    expect(ceilingAt(m, 0, -12, 0)).toBe(Infinity);
    // stage-to-stage through both side doors is cut by the sanctuary
    expect(lineOfSight(m, [-16, 1.2 + m.eye, 0], [16, 1.2 + m.eye, 0])).toBe(false);
  });
  it('the sando is the long lane: 30 m+ sightlines exist there and nowhere through the hall', () => {
    expect(lineOfSight(m, [-20, m.eye, -17], [20, m.eye, -17])).toBe(true);
    expect(lineOfSight(m, [-20, m.eye, 0], [20, m.eye, 0])).toBe(false);
  });
});
