import type { Point3, SpawnPoint } from './combat';

export interface EliteProfile { hp: number; attack: 'sweep' | 'burst'; range: number; radius: number; windup: number; recovery: number; speed: number; damage: number; paired?: boolean }

/** One roaming elite per region, never a new random pack or a progression requirement. */
export const MINIBOSSES = [
  { id: 'elite_valley_sentinel', profile: { hp: 220, attack: 'burst', range: 18, radius: 4.5, windup: 1.4, recovery: 1.6, speed: 2.6, damage: 20 }, region: 'alpha', name: ['棱光哨卫', 'Prism Sentinel'], x: 202, z: -4, kind: 'crystal', colors: ['#3c566c', '#8adfe5', '#c9ffff'] },
  { id: 'elite_oath_knight', profile: { hp: 264, attack: 'sweep', range: 3.5, radius: 4, windup: 1.35, recovery: 1.5, speed: 3, damage: 24 }, region: 'britain', name: ['失誓骑士', 'Oathless Knight'], x: -500, z: 25, kind: 'shade', colors: ['#584c49', '#ddaa68', '#ffe3ae'] },
  { id: 'elite_reef_captain', profile: { hp: 220, attack: 'sweep', range: 2.4, radius: 2.8, windup: .9, recovery: 1.7, speed: 4.4, damage: 20 }, region: 'blacksail', name: ['暗礁船长', 'Reef Captain'], x: 780, z: -70, kind: 'crystal', colors: ['#344c51', '#66cab8', '#b2fff1'] },
  { id: 'elite_frost_officer', profile: { hp: 242, attack: 'sweep', range: 2.8, radius: 3.2, windup: 1.05, recovery: 1.2, speed: 4, damage: 20 }, region: 'winter', name: ['霜线督军', 'Frostline Officer'], x: 40, z: -680, kind: 'crystal', colors: ['#405269', '#97cbff', '#e2f5ff'] },
  { id: 'elite_ember_samurai', profile: { hp: 242, attack: 'sweep', range: 3, radius: 3.5, windup: 1, recovery: 1.65, speed: 3.8, damage: 18, paired: true }, region: 'kyoto', name: ['余烬武士', 'Ember Samurai'], x: 100, z: 560, kind: 'shade', colors: ['#674343', '#ff976a', '#ffe3a1'] },
] satisfies { id: string; region: string; name: [string, string]; x: number; z: number; kind: 'shade' | 'crystal'; colors: [string, string, string]; profile: EliteProfile }[];

/** Bounded deterministic placement through the same town/water/quest exclusion filter as regular enemies.
 * Skip an elite entirely when its remote pocket has no safe ground; never fall back into a settlement.
 */
export function makeMinibossSpawns(place: (x: number, z: number) => Point3 | null, existing: readonly SpawnPoint[] = []): SpawnPoint[] {
  const result: SpawnPoint[] = [];
  for (const def of MINIBOSSES) {
    for (let attempt = 0; attempt < 49; attempt++) {
      const ring = Math.ceil(attempt / 8), angle = (attempt % 8) * Math.PI / 4;
      const p = place(def.x + Math.cos(angle) * ring * 5, def.z + Math.sin(angle) * ring * 5);
      if (!p || [...existing, ...result].some(s => Math.hypot(s.p.x - p.x, s.p.z - p.z) < 16)) continue;
      result.push({ id: def.id, kind: def.kind, p, miniboss: def.id });
      break;
    }
  }
  return result;
}

export function minibossProfile(e: Pick<SpawnPoint, 'miniboss'>): EliteProfile | undefined {
  return MINIBOSSES.find(def => def.id === e.miniboss)?.profile;
}
