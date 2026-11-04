/**
 * Era-boss arena mechanics (phase 2 only). Each chapter boss lays its own telegraphed ground
 * hazard on a fixed cadence, read and answered differently:
 *  - 空位之王 · 誓剑雨: blades fall where you stand and where you are heading — change lanes.
 *  - 亡航提督 · 侧舷齐射: two parallel cannon lanes, one through you — step to the open side.
 *  - 执冬者 · 冻土绽放: a frost ring blooms around you, then the centre freezes — hold, then leave.
 *  - 业火之主 · 业火追迹: fire pillars march along your running line — stop short or double back.
 * Pure rules: planning is deterministic from positions, velocity and the volley count.
 */
type P3 = { x: number; y: number; z: number };
export type HazardShape =
  | { shape: 'circle'; r: number }
  | { shape: 'ring'; r: number; inner: number }
  | { shape: 'strip'; dir: [number, number]; length: number; width: number };
export type HazardPlan = HazardShape & { at: P3; delay: number; damage: number };
export type Hazard = HazardPlan & { id: number; boss: string; t: number };
export interface BossHazardDef {
  readonly every: number;
  /** seconds from the phase break to the first volley */
  readonly first: number;
  readonly name: readonly [string, string];
  readonly counter: readonly [string, string];
  readonly color: string;
}

export const BOSS_HAZARDS: Readonly<Record<string, BossHazardDef>> = Object.freeze({
  boss_vacant_king: { every: 7, first: 2.4, color: '#ffd77a', name: ['誓剑雨', 'Oath Blade Rain'], counter: ['别停也别直跑，横向换线', 'Don’t stand or run straight: change lanes'] },
  boss_drowned_admiral: { every: 8, first: 2.6, color: '#ff8a3c', name: ['侧舷齐射', 'Broadside'], counter: ['看清两条炮线，向空着的一侧横移', 'Read both lanes and sidestep to the open side'] },
  boss_winter_warden: { every: 7.5, first: 2.4, color: '#9fe4ff', name: ['冻土绽放', 'Frost Bloom'], counter: ['先守在中心，冰环碎后立刻离开', 'Hold the centre, then leave once the ring shatters'] },
  boss_hellfire_lord: { every: 7, first: 2.2, color: '#ff4a3a', name: ['业火追迹', 'Hellfire Trail'], counter: ['火柱沿你的跑线追来：急停或折返', 'Pillars chase your running line: stop short or double back'] },
});

const norm = (x: number, z: number): [number, number] => { const l = Math.hypot(x, z); return l > 1e-6 ? [x / l, z / l] : [1, 0]; };
const at = (p: P3, dx = 0, dz = 0): P3 => ({ x: p.x + dx, y: p.y, z: p.z + dz });

/** One volley for a boss. `velocity` is the player's ground velocity (m/s); `volley` counts from 0. */
export function planBossHazards(bossId: string, boss: P3, player: P3, velocity: { x: number; z: number }, volley: number): HazardPlan[] {
  const [ax, az] = norm(player.x - boss.x, player.z - boss.z); // boss → player
  const side = volley % 2 ? 1 : -1;
  const speed = Math.hypot(velocity.x, velocity.z);
  // where the player is heading; a standing player is "heading" away from the boss
  const [hx, hz] = speed > .8 ? norm(velocity.x, velocity.z) : [ax, az];
  switch (bossId) {
    case 'boss_vacant_king': {
      const lead = Math.min(4.5, Math.max(3, speed * .9));
      return [
        { shape: 'circle', r: 2.4, at: at(player), delay: 1.3, damage: 18 },
        { shape: 'circle', r: 2.4, at: at(player, hx * lead, hz * lead), delay: 1.5, damage: 18 },
        { shape: 'circle', r: 2.4, at: at(player, -hz * 3.6 * side, hx * 3.6 * side), delay: 1.7, damage: 18 },
      ];
    }
    case 'boss_drowned_admiral': {
      // lanes run across the boss's line of fire; one through the player, one beside it
      const dir: [number, number] = [-az, ax];
      return [
        { shape: 'strip', dir, length: 30, width: 3.2, at: at(player), delay: 1.5, damage: 20 },
        { shape: 'strip', dir, length: 30, width: 3.2, at: at(player, ax * 4 * side, az * 4 * side), delay: 1.5, damage: 20 },
      ];
    }
    case 'boss_winter_warden':
      return [
        { shape: 'ring', r: 6.5, inner: 2.3, at: at(player), delay: 1.6, damage: 17 },
        { shape: 'circle', r: 2.3, at: at(player), delay: 2.7, damage: 17 },
      ];
    case 'boss_hellfire_lord': {
      const step = Math.max(2.4, Math.min(4, speed * .5));
      return [0, 1, 2, 3, 4].map(k => ({ shape: 'circle' as const, r: 2, at: at(player, hx * step * k, hz * step * k), delay: 1 + k * .28, damage: 16 }));
    }
  }
  return [];
}

/** Whether a grounded point stands inside the hazard's footprint when it bursts. */
export function hazardContains(h: HazardShape & { at: P3 }, p: P3): boolean {
  if (Math.abs(p.y - h.at.y) > 3) return false;
  const dx = p.x - h.at.x, dz = p.z - h.at.z, d = Math.hypot(dx, dz);
  if (h.shape === 'circle') return d <= h.r;
  if (h.shape === 'ring') return d <= h.r && d >= h.inner;
  const along = dx * h.dir[0] + dz * h.dir[1], across = -dx * h.dir[1] + dz * h.dir[0];
  return Math.abs(along) <= h.length / 2 && Math.abs(across) <= h.width / 2;
}
