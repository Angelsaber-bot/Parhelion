import type { Point3, SpawnPoint } from './combat';

export const KNIGHT_TRIAL_ID = 'elite_oath_knight';
export const KNIGHT_TRIAL_CLEAR = 'era_britain_knight_defeated';
export const KYOTO_QUIET_LEDGE = { x: -224, y: 11.56, z: 840 } as const;
export const AKECHI_GUARDS = [
  { id: 'wild_35d', x: -202, z: 882, role: 'lancer' as const },
  { id: 'wild_35e', x: -206, z: 908, role: 'duelist' as const },
] as const;
/** Reserve two existing Kyoto pack actors, not additional population. Every relocation must pass
 * the UNCHANGED wilderness validator; a failed candidate keeps the original actor/home intact. */
export function authorEncounters(spawns: SpawnPoint[], place: (x: number, z: number) => Point3 | null): SpawnPoint[] {
  const result = spawns.map(s => ({ ...s, p: { ...s.p } }));
  for (const guard of AKECHI_GUARDS) {
    const actor = result.find(s => s.id === guard.id);
    if (!actor) continue;
    const p = place(guard.x, guard.z);
    if (!p || result.some(s => s !== actor && Math.hypot(s.p.x - p.x, s.p.z - p.z) < 9)) continue;
    actor.p = p; actor.role = guard.role; actor.encounter = 'akechi';
  }
  // Existing road-side pairs get complementary purposes without moving or growing them.
  for (const actor of result) {
    if (actor.id === 'wild_59') actor.role = 'duelist';
    if (actor.id === 'wild_59b') actor.role = 'bombardier';
    if (actor.id === 'wild_14') actor.role = 'musketeer';
    if (actor.id === 'wild_14b') actor.role = 'breaker';
  }
  return result;
}
